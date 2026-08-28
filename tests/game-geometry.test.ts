import { describe, expect, it } from "vitest";

import type { LevelDocument, TileId } from "../src/core/contracts";
import {
  cellCenter,
  findFinishLineX,
  findLeftmostStandableCell,
  findPlayerSpawnCell,
  isHazardTile,
  isSolidTile,
  levelPixelBounds,
  tileAt,
  tileAtWorldPoint,
  worldToGridPoint,
} from "../src/game/geometry";
import { deriveEnemySpawns, isEnemyTile } from "../src/game/enemies";

function level(tiles: TileId[][]): LevelDocument {
  return {
    schemaVersion: 1,
    id: "geometry-test",
    revision: 1,
    width: tiles[0]?.length ?? 0,
    height: tiles.length,
    tiles,
    metadata: {
      name: "Geometry test",
      description: "",
      difficulty: "beginner",
      primaryMechanic: "platforming",
      background: "golden-coast",
      author: "agent",
    },
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
  };
}

describe("findLeftmostStandableCell", () => {
  it("chooses the leftmost column and lowest standable air cell", () => {
    const document = level([
      [0, 0, 0, 0],
      [0, 0, 1, 0],
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [1, 1, 1, 4],
    ]);

    expect(findLeftmostStandableCell(document)).toEqual({ x: 0, y: 3 });
  });

  it("accepts ice as a standable surface and ignores hazards", () => {
    const document = level([
      [0, 0, 0],
      [0, 0, 0],
      [7, 5, 4],
    ]);

    expect(findLeftmostStandableCell(document)).toEqual({ x: 2, y: 1 });
  });

  it("does not use the finish buoy itself as a spawn cell", () => {
    const document = level([
      [3, 0, 0],
      [1, 2, 1],
    ]);

    expect(findLeftmostStandableCell(document)).toEqual({ x: 1, y: 0 });
  });

  it("returns null when the level has no valid standing space", () => {
    expect(findLeftmostStandableCell(level([[0, 0], [5, 7]]))).toBeNull();
  });
});

describe("findPlayerSpawnCell", () => {
  it("prefers an inset spawn so wide character art stays on screen", () => {
    const document = level([
      [0, 0, 0],
      [1, 1, 1],
    ]);

    expect(findPlayerSpawnCell(document)).toEqual({ x: 1, y: 0 });
  });

  it("falls back to the edge for narrow legacy layouts", () => {
    const document = level([
      [0, 7],
      [1, 7],
    ]);

    expect(findPlayerSpawnCell(document)).toEqual({ x: 0, y: 0 });
  });
});

describe("grid geometry", () => {
  const document = level([
    [0, 3, 0],
    [1, 4, 7],
  ]);

  it("converts cells and level dimensions into pixels", () => {
    expect(cellCenter({ x: 2, y: 1 }, 40)).toEqual({ x: 100, y: 60 });
    expect(levelPixelBounds(document, 40)).toEqual({ width: 120, height: 80 });
  });

  it("turns the finish buoy column into a full-height finish line", () => {
    expect(findFinishLineX(document, 40)).toBe(60);
    expect(findFinishLineX(level([[0, 0], [1, 1]]), 40)).toBeNull();
  });

  it("maps world coordinates to clamped telemetry cells", () => {
    expect(worldToGridPoint({ x: 81, y: 39 }, document, 40)).toEqual({ x: 2, y: 0 });
    expect(worldToGridPoint({ x: -20, y: 999 }, document, 40)).toEqual({ x: 0, y: 1 });
  });

  it("reads grid and world tiles safely", () => {
    expect(tileAt(document, 1, 0)).toBe(3);
    expect(tileAt(document, -1, 0)).toBeUndefined();
    expect(tileAtWorldPoint(document, { x: 85, y: 65 }, 40)).toBe(7);
  });

  it("classifies collision behaviors", () => {
    expect([1, 2, 4].every((tile) => isSolidTile(tile as TileId))).toBe(true);
    expect([5, 6, 7].every((tile) => isHazardTile(tile as TileId))).toBe(true);
    expect(isSolidTile(7)).toBe(false);
    expect(isHazardTile(0)).toBe(false);
  });
});

describe("deterministic enemy placement", () => {
  it("turns explicit enemy marker tiles into their matching archetypes", () => {
    const document = level([
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 8, 0, 0, 0, 10, 0, 3],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ]);

    const spawns = deriveEnemySpawns(document);
    expect(spawns.map(({ archetype, cell }) => ({ archetype, cell }))).toEqual([
      { archetype: "reef-crawler", cell: { x: 5, y: 4 } },
      { archetype: "swell-wing", cell: { x: 7, y: 1 } },
      { archetype: "tide-spitter", cell: { x: 9, y: 4 } },
    ]);
    expect([8, 9, 10].every((tile) => isEnemyTile(tile))).toBe(true);
  });

  it("adds a stable, well-spaced fallback population to marker-free legacy levels", () => {
    const width = 30;
    const tiles: TileId[][] = Array.from({ length: 6 }, () =>
      Array<TileId>(width).fill(0),
    );
    tiles[4]![28] = 3;
    tiles[5]!.fill(1);
    const document = level(tiles);

    const first = deriveEnemySpawns(document);
    const second = deriveEnemySpawns(document);
    expect(second).toEqual(first);
    expect(new Set(first.map((spawn) => spawn.archetype))).toEqual(
      new Set(["reef-crawler", "swell-wing", "tide-spitter"]),
    );
    expect(first.every((spawn) => spawn.anchorCell.x >= 5 && spawn.anchorCell.x <= 25)).toBe(
      true,
    );
    expect(first.every((spawn, index) => index === 0 || spawn.cell.x - first[index - 1]!.cell.x >= 3)).toBe(
      true,
    );
  });
});
