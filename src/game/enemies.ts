import type { GridPoint, LevelDocument } from "../core/contracts";
import { findLeftmostStandableCell, isSolidTile, tileAt } from "./geometry";

export const ENEMY_ARCHETYPES = ["reef-crawler", "swell-wing", "tide-spitter"] as const;

export type EnemyArchetype = (typeof ENEMY_ARCHETYPES)[number];
export type EnemyTileId = 8 | 9 | 10;

export interface EnemySpawn {
  id: string;
  archetype: EnemyArchetype;
  /** The actual cell used to place the enemy. Flyers sit above their anchor. */
  cell: GridPoint;
  /** A safe standing cell used to derive the spawn and restore it after death. */
  anchorCell: GridPoint;
  direction: -1 | 1;
  patrol: {
    minX: number;
    maxX: number;
  };
  /** Stable animation/fire offset so a group does not move in lockstep. */
  phaseMs: number;
}

const START_CLEARANCE_COLUMNS = 4;
const GOAL_CLEARANCE_COLUMNS = 2;
const MINIMUM_SPAWN_SPACING = 5;
const MAXIMUM_ENEMIES = 7;

/**
 * Derives a compact, stable enemy population from level geometry. Enemy data is
 * intentionally not persisted yet, so old shared levels immediately gain life
 * without a schema migration.
 */
export function deriveEnemySpawns(level: LevelDocument): EnemySpawn[] {
  const seed = hashLevelTiles(level);
  const markerSpawns = collectEnemyMarkers(level, seed);
  if (markerSpawns.length > 0) {
    return markerSpawns;
  }

  const playerSpawn = findLeftmostStandableCell(level);
  const goals = collectGoalCells(level);
  const candidates = collectLowestStandableCells(level).filter((cell) => {
    if (
      playerSpawn !== null &&
      cell.x <= playerSpawn.x + START_CLEARANCE_COLUMNS
    ) {
      return false;
    }

    return !goals.some(
      (goal) =>
        Math.abs(goal.x - cell.x) <= GOAL_CLEARANCE_COLUMNS &&
        Math.abs(goal.y - cell.y) <= 3,
    );
  });

  if (candidates.length === 0) {
    return [];
  }

  const desiredCount = Math.min(
    MAXIMUM_ENEMIES,
    candidates.length,
    Math.max(1, Math.floor(level.width / 7)),
  );
  const initialColumn =
    (playerSpawn?.x ?? -START_CLEARANCE_COLUMNS) +
    START_CLEARANCE_COLUMNS +
    1 +
    (seed % 3);
  const selected: GridPoint[] = [];
  let nextColumn = initialColumn;

  for (const candidate of candidates) {
    if (selected.length >= desiredCount) {
      break;
    }
    if (candidate.x < nextColumn) {
      continue;
    }

    selected.push(candidate);
    nextColumn = candidate.x + MINIMUM_SPAWN_SPACING;
  }

  // Broken-up levels may not have a platform at each regular interval. Fill
  // remaining slots from the safest available cells while retaining breathing
  // room between encounters.
  if (selected.length < desiredCount) {
    for (const candidate of candidates) {
      if (selected.length >= desiredCount) {
        break;
      }
      if (selected.some((cell) => Math.abs(cell.x - candidate.x) < 3)) {
        continue;
      }
      selected.push(candidate);
    }
    selected.sort(compareGridPoints);
  }

  return selected.map((anchorCell, index) => {
    const archetype = ENEMY_ARCHETYPES[index % ENEMY_ARCHETYPES.length]!;
    const cell =
      archetype === "swell-wing" ? findFlyerCell(level, anchorCell) : { ...anchorCell };
    const patrol = findPatrolRange(level, archetype, cell, anchorCell);
    const direction: -1 | 1 = ((seed >>> (index % 24)) & 1) === 0 ? -1 : 1;

    return {
      id: `enemy-${index}-${anchorCell.x}-${anchorCell.y}`,
      archetype,
      cell,
      anchorCell: { ...anchorCell },
      direction,
      patrol,
      phaseMs: 180 + ((seed + index * 977) % 1_400),
    };
  });
}

export function isEnemyTile(tile: number | undefined): tile is EnemyTileId {
  return tile === 8 || tile === 9 || tile === 10;
}

export function enemyArchetypeForTile(tile: EnemyTileId): EnemyArchetype {
  switch (tile) {
    case 8:
      return "reef-crawler";
    case 9:
      return "swell-wing";
    case 10:
      return "tide-spitter";
  }
}

function collectEnemyMarkers(level: LevelDocument, seed: number): EnemySpawn[] {
  const markers: Array<{ cell: GridPoint; tile: EnemyTileId }> = [];
  for (let x = 0; x < level.width; x += 1) {
    for (let y = 0; y < level.height; y += 1) {
      const tile = tileAt(level, x, y);
      if (isEnemyTile(tile)) {
        markers.push({ cell: { x, y }, tile });
      }
    }
  }

  return markers.map(({ cell, tile }, index) => {
    const archetype = enemyArchetypeForTile(tile);
    return {
      id: `marker-${cell.x}-${cell.y}`,
      archetype,
      cell: { ...cell },
      anchorCell: { ...cell },
      direction: ((seed >>> (index % 24)) & 1) === 0 ? -1 : 1,
      patrol: findPatrolRange(level, archetype, cell, cell),
      phaseMs: 180 + ((seed + index * 977) % 1_400),
    };
  });
}

function collectGoalCells(level: LevelDocument): GridPoint[] {
  const goals: GridPoint[] = [];
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if (tileAt(level, x, y) === 3) {
        goals.push({ x, y });
      }
    }
  }
  return goals;
}

function collectLowestStandableCells(level: LevelDocument): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let x = 0; x < level.width; x += 1) {
    for (let y = level.height - 2; y >= 0; y -= 1) {
      if (isStandableCell(level, x, y)) {
        cells.push({ x, y });
        break;
      }
    }
  }
  return cells;
}

function isStandableCell(level: LevelDocument, x: number, y: number): boolean {
  const tile = tileAt(level, x, y);
  return (tile === 0 || isEnemyTile(tile)) && isSolidTile(tileAt(level, x, y + 1));
}

function findFlyerCell(level: LevelDocument, anchor: GridPoint): GridPoint {
  for (const rise of [2, 1] as const) {
    const y = anchor.y - rise;
    if (y >= 0 && tileAt(level, anchor.x, y) === 0) {
      return { x: anchor.x, y };
    }
  }
  return { ...anchor };
}

function findPatrolRange(
  level: LevelDocument,
  archetype: EnemyArchetype,
  cell: GridPoint,
  anchor: GridPoint,
): { minX: number; maxX: number } {
  const maximumRadius = archetype === "tide-spitter" ? 0 : archetype === "swell-wing" ? 3 : 2;
  let minX = cell.x;
  let maxX = cell.x;

  for (let distance = 1; distance <= maximumRadius; distance += 1) {
    const x = cell.x - distance;
    const clear =
      x >= 0 &&
      tileAt(level, x, cell.y) === 0 &&
      (archetype === "swell-wing" || isStandableCell(level, x, anchor.y));
    if (!clear) {
      break;
    }
    minX = x;
  }

  for (let distance = 1; distance <= maximumRadius; distance += 1) {
    const x = cell.x + distance;
    const clear =
      x < level.width &&
      tileAt(level, x, cell.y) === 0 &&
      (archetype === "swell-wing" || isStandableCell(level, x, anchor.y));
    if (!clear) {
      break;
    }
    maxX = x;
  }

  return { minX, maxX };
}

function hashLevelTiles(level: LevelDocument): number {
  let hash = 2_166_136_261;
  const mix = (value: number): void => {
    hash ^= value & 0xff;
    hash = Math.imul(hash, 16_777_619) >>> 0;
  };

  mix(level.width);
  mix(level.height);
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      mix(tileAt(level, x, y) ?? 0xff);
    }
  }
  return hash >>> 0;
}

function compareGridPoints(left: GridPoint, right: GridPoint): number {
  return left.x - right.x || right.y - left.y;
}
