import type { GridPoint, LevelDocument, TileId } from "../core/contracts";

export const DEFAULT_TILE_SIZE = 48;

export const SOLID_TILE_IDS = [1, 2, 4] as const;
export const HAZARD_TILE_IDS = [5, 6, 7] as const;

export interface PixelPoint {
  x: number;
  y: number;
}

export interface PixelBounds {
  width: number;
  height: number;
}

export function isSolidTile(tile: TileId | undefined): tile is 1 | 2 | 4 {
  return tile === 1 || tile === 2 || tile === 4;
}

export function isHazardTile(tile: TileId | undefined): tile is 5 | 6 | 7 {
  return tile === 5 || tile === 6 || tile === 7;
}

export function tileAt(level: LevelDocument, x: number, y: number): TileId | undefined {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
    return undefined;
  }

  if (x >= level.width || y >= level.height) {
    return undefined;
  }

  return level.tiles[y]?.[x];
}

/**
 * Finds the first playable air cell when scanning left-to-right. If a column
 * contains multiple platforms, the lowest valid standing space wins so the
 * player starts on the floor instead of a decorative ledge.
 */
export function findLeftmostStandableCell(level: LevelDocument): GridPoint | null {
  return findStandableCellFromColumn(level, 0);
}

/**
 * Picks a player spawn with one column of visual breathing room when possible.
 * Legacy/narrow levels still fall back to the true leftmost standable cell.
 */
export function findPlayerSpawnCell(level: LevelDocument): GridPoint | null {
  return findStandableCellFromColumn(level, 1) ?? findLeftmostStandableCell(level);
}

/**
 * Treats the leftmost finish buoy as a full-height finish line. The buoy stays
 * the visual marker, while a player who jumps above it still clears the run.
 */
export function findFinishLineX(
  level: LevelDocument,
  tileSize = DEFAULT_TILE_SIZE,
): number | null {
  for (let x = 0; x < level.width; x += 1) {
    for (let y = 0; y < level.height; y += 1) {
      if (tileAt(level, x, y) === 3) {
        return (x + 0.5) * tileSize;
      }
    }
  }

  return null;
}

function findStandableCellFromColumn(
  level: LevelDocument,
  startingColumn: number,
): GridPoint | null {
  for (let x = startingColumn; x < level.width; x += 1) {
    for (let y = level.height - 2; y >= 0; y -= 1) {
      if (tileAt(level, x, y) === 0 && isSolidTile(tileAt(level, x, y + 1))) {
        return { x, y };
      }
    }
  }

  return null;
}

export function cellCenter(point: GridPoint, tileSize = DEFAULT_TILE_SIZE): PixelPoint {
  return {
    x: (point.x + 0.5) * tileSize,
    y: (point.y + 0.5) * tileSize,
  };
}

export function levelPixelBounds(
  level: Pick<LevelDocument, "width" | "height">,
  tileSize = DEFAULT_TILE_SIZE,
): PixelBounds {
  return {
    width: Math.max(1, level.width) * tileSize,
    height: Math.max(1, level.height) * tileSize,
  };
}

export function worldToGridPoint(
  point: PixelPoint,
  level: Pick<LevelDocument, "width" | "height">,
  tileSize = DEFAULT_TILE_SIZE,
): GridPoint {
  const maxX = Math.max(0, level.width - 1);
  const maxY = Math.max(0, level.height - 1);

  return {
    x: clamp(Math.floor(point.x / tileSize), 0, maxX),
    y: clamp(Math.floor(point.y / tileSize), 0, maxY),
  };
}

export function tileAtWorldPoint(
  level: LevelDocument,
  point: PixelPoint,
  tileSize = DEFAULT_TILE_SIZE,
): TileId | undefined {
  return tileAt(level, Math.floor(point.x / tileSize), Math.floor(point.y / tileSize));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
