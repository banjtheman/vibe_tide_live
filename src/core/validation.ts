import {
  LEVEL_SCHEMA_VERSION,
  TILE_IDS,
  type GridPoint,
  type LevelDocument,
  type TileId,
  type ValidationIssue,
  type ValidationReport,
} from "./contracts";

export const MIN_LEVEL_WIDTH = 6;
export const MIN_LEVEL_HEIGHT = 6;
export const MAX_LEVEL_WIDTH = 256;
export const MAX_LEVEL_HEIGHT = 128;

export const REACHABILITY_RULES = Object.freeze({
  maxJumpAcross: 4,
  maxJumpRise: 3,
  maxSafeDrop: 5,
});

const TILE_ID_SET = new Set<number>(TILE_IDS);
const SUPPORT_TILES = new Set<TileId>([1, 2, 4]);
const PASSABLE_TILES = new Set<TileId>([0, 3]);

export interface RepairOptions {
  now?: string;
  surfaceTile?: 1 | 2 | 4;
}

export interface RepairResult {
  level: LevelDocument;
  changed: boolean;
  before: ValidationReport;
  after: ValidationReport;
}

export function isTileId(value: unknown): value is TileId {
  return typeof value === "number" && TILE_ID_SET.has(value);
}

export function isSupportTile(tile: TileId): boolean {
  return SUPPORT_TILES.has(tile);
}

export function isPassableTile(tile: TileId): boolean {
  return PASSABLE_TILES.has(tile);
}

function pointKey(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

function tileAt(level: LevelDocument, x: number, y: number): TileId | null {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) {
    return null;
  }
  const tile = level.tiles[y]?.[x];
  return isTileId(tile) ? tile : null;
}

function isStandingCell(level: LevelDocument, x: number, y: number): boolean {
  const tile = tileAt(level, x, y);
  const support = tileAt(level, x, y + 1);
  return tile !== null && support !== null && isPassableTile(tile) && isSupportTile(support);
}

function collectStandingCells(level: LevelDocument): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let y = 0; y < level.height - 1; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if (isStandingCell(level, x, y)) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function findSpawn(standingCells: readonly GridPoint[], level: LevelDocument): GridPoint | null {
  const candidates = standingCells.filter(({ x, y }) => tileAt(level, x, y) !== 3);
  candidates.sort((a, b) => a.x - b.x || b.y - a.y);
  const first = candidates[0];
  return first ? { ...first } : null;
}

function findGoals(level: LevelDocument): GridPoint[] {
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

function jumpArcIsClear(level: LevelDocument, from: GridPoint, to: GridPoint): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const horizontalDistance = Math.abs(dx);
  const samples = Math.max(6, horizontalDistance * 4);
  const lift = Math.max(2, from.y - to.y + 1);

  for (let sample = 1; sample < samples; sample += 1) {
    const progress = sample / samples;
    const x = Math.round(from.x + dx * progress);
    const arcY = from.y + dy * progress - lift * 4 * progress * (1 - progress);
    const y = Math.floor(arcY);
    const tile = tileAt(level, x, y);
    if (tile === null || !isPassableTile(tile)) {
      return false;
    }
  }
  return true;
}

function canReach(level: LevelDocument, from: GridPoint, to: GridPoint): boolean {
  const dx = Math.abs(to.x - from.x);
  const rise = from.y - to.y;
  const drop = to.y - from.y;

  if (dx === 0) {
    return false;
  }
  if (dx === 1 && Math.abs(to.y - from.y) <= 1) {
    const upperY = Math.min(from.y, to.y);
    const intervening = tileAt(level, to.x, upperY);
    return intervening !== null && isPassableTile(intervening);
  }
  if (
    dx > REACHABILITY_RULES.maxJumpAcross ||
    rise > REACHABILITY_RULES.maxJumpRise ||
    drop > REACHABILITY_RULES.maxSafeDrop
  ) {
    return false;
  }
  return jumpArcIsClear(level, from, to);
}

function reachableFrom(
  level: LevelDocument,
  spawn: GridPoint,
  standingCells: readonly GridPoint[],
): Set<string> {
  const byKey = new Map(standingCells.map((point) => [pointKey(point), point]));
  const reached = new Set<string>([pointKey(spawn)]);
  const queue: GridPoint[] = [spawn];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) {
      continue;
    }
    for (let xOffset = -REACHABILITY_RULES.maxJumpAcross; xOffset <= REACHABILITY_RULES.maxJumpAcross; xOffset += 1) {
      if (xOffset === 0) {
        continue;
      }
      for (let yOffset = -REACHABILITY_RULES.maxJumpRise; yOffset <= REACHABILITY_RULES.maxSafeDrop; yOffset += 1) {
        const candidate = byKey.get(`${current.x + xOffset},${current.y + yOffset}`);
        if (!candidate || reached.has(pointKey(candidate)) || !canReach(level, current, candidate)) {
          continue;
        }
        reached.add(pointKey(candidate));
        queue.push(candidate);
      }
    }
  }

  return reached;
}

function hasSafeDimensions(level: LevelDocument): boolean {
  return (
    Number.isInteger(level.width) &&
    Number.isInteger(level.height) &&
    level.width >= MIN_LEVEL_WIDTH &&
    level.width <= MAX_LEVEL_WIDTH &&
    level.height >= MIN_LEVEL_HEIGHT &&
    level.height <= MAX_LEVEL_HEIGHT
  );
}

/**
 * Validates structure and a deliberately conservative, tile-based approximation
 * of platformer reachability. A report never throws, even for malformed runtime data.
 */
export function validateLevel(level: LevelDocument): ValidationReport {
  const issues: ValidationIssue[] = [];
  const dimensionsAreSafe = hasSafeDimensions(level);

  if (!dimensionsAreSafe) {
    issues.push({
      code: "invalid_dimensions",
      message: `Level dimensions must be integers between ${MIN_LEVEL_WIDTH}×${MIN_LEVEL_HEIGHT} and ${MAX_LEVEL_WIDTH}×${MAX_LEVEL_HEIGHT}.`,
      severity: "error",
    });
  }

  const expectedHeight = Number.isInteger(level.height) && level.height >= 0 ? level.height : 0;
  const expectedWidth = Number.isInteger(level.width) && level.width >= 0 ? level.width : 0;
  if (!Array.isArray(level.tiles) || level.tiles.length !== expectedHeight) {
    issues.push({
      code: "ragged_grid",
      message: "Tile rows do not match the declared level height.",
      severity: "error",
    });
  }

  if (Array.isArray(level.tiles)) {
    for (let y = 0; y < level.tiles.length; y += 1) {
      const row = level.tiles[y];
      if (!Array.isArray(row) || row.length !== expectedWidth) {
        if (!issues.some((issue) => issue.code === "ragged_grid")) {
          issues.push({
            code: "ragged_grid",
            message: "Every tile row must match the declared level width.",
            location: { x: 0, y },
            severity: "error",
          });
        }
        continue;
      }
      for (let x = 0; x < row.length; x += 1) {
        if (!isTileId(row[x])) {
          issues.push({
            code: "invalid_tile",
            message: `Tile at ${x},${y} is outside the supported 0–7 range.`,
            location: { x, y },
            severity: "error",
          });
        }
      }
    }
  }

  const hasStructuralError = issues.some(
    (issue) =>
      issue.code === "invalid_dimensions" || issue.code === "ragged_grid" || issue.code === "invalid_tile",
  );
  if (hasStructuralError) {
    return { valid: false, issues, spawn: null, goal: null, reachableCells: 0 };
  }

  const standingCells = collectStandingCells(level);
  const spawn = findSpawn(standingCells, level);
  const goals = findGoals(level);
  const goal = goals[0] ? { ...goals[0] } : null;

  if (!spawn) {
    issues.push({
      code: "missing_spawn",
      message: "No safe standing cell is available for the player spawn.",
      severity: "error",
    });
  }
  if (!goal) {
    issues.push({ code: "missing_goal", message: "Add one finish buoy tile.", severity: "error" });
  }

  const reached = spawn ? reachableFrom(level, spawn, standingCells) : new Set<string>();
  if (spawn && goal && !reached.has(pointKey(goal))) {
    issues.push({
      code: "unreachable_goal",
      message: "The finish buoy is not reachable under the safe jump limits.",
      location: { ...goal },
      severity: "error",
    });
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
    spawn,
    goal,
    reachableCells: reached.size,
  };
}

function clampInteger(value: number, minimum: number, maximum: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.round(value))) : fallback;
}

function copyAndNormalizeGrid(level: LevelDocument, width: number, height: number): TileId[][] {
  const rows: TileId[][] = [];
  let keptGoal = false;
  for (let y = 0; y < height; y += 1) {
    const sourceRow = Array.isArray(level.tiles) ? level.tiles[y] : undefined;
    const row: TileId[] = [];
    for (let x = 0; x < width; x += 1) {
      const candidate: unknown = Array.isArray(sourceRow) ? sourceRow[x] : 0;
      let tile: TileId = isTileId(candidate) ? candidate : 0;
      if (tile === 3) {
        if (keptGoal) {
          tile = 0;
        } else {
          keptGoal = true;
        }
      }
      row.push(tile);
    }
    rows.push(row);
  }
  return rows;
}

function clearGoals(tiles: TileId[][]): void {
  for (const row of tiles) {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === 3) {
        row[x] = 0;
      }
    }
  }
}

function laySafeCorridor(
  tiles: TileId[][],
  width: number,
  fromX: number,
  goalX: number,
  walkY: number,
  surfaceTile: 1 | 2 | 4,
): void {
  const left = Math.max(0, Math.min(fromX, goalX));
  const right = Math.min(width - 1, Math.max(fromX, goalX));
  for (let x = left; x <= right; x += 1) {
    tiles[walkY]![x] = 0;
    tiles[walkY + 1]![x] = surfaceTile;
    if (walkY > 0) {
      tiles[walkY - 1]![x] = 0;
    }
  }
  clearGoals(tiles);
  tiles[walkY]![goalX] = 3;
}

/** Repairs malformed documents and, when needed, adds the smallest simple safe corridor. */
export function repairLevel(level: LevelDocument, options: RepairOptions = {}): RepairResult {
  const before = validateLevel(level);
  const sourceRows = Array.isArray(level.tiles) ? level.tiles : [];
  const widestSourceRow = sourceRows.reduce(
    (width, row) => (Array.isArray(row) ? Math.max(width, row.length) : width),
    0,
  );
  const width = clampInteger(level.width, MIN_LEVEL_WIDTH, MAX_LEVEL_WIDTH, Math.max(24, widestSourceRow));
  const height = clampInteger(level.height, MIN_LEVEL_HEIGHT, MAX_LEVEL_HEIGHT, Math.max(12, sourceRows.length));
  const tiles = copyAndNormalizeGrid(level, width, height);
  const surfaceTile = options.surfaceTile ?? 1;
  const base: LevelDocument = {
    ...level,
    schemaVersion: LEVEL_SCHEMA_VERSION,
    width,
    height,
    tiles,
    metadata: { ...level.metadata },
    updatedAt: options.now ?? level.updatedAt,
  };

  let report = validateLevel(base);
  const fallbackWalkY = Math.max(1, height - 3);
  if (!report.spawn) {
    const spawnX = Math.min(1, width - 1);
    tiles[fallbackWalkY]![spawnX] = 0;
    tiles[fallbackWalkY + 1]![spawnX] = surfaceTile;
    if (fallbackWalkY > 0) {
      tiles[fallbackWalkY - 1]![spawnX] = 0;
    }
    report = validateLevel(base);
  }

  if (!report.goal) {
    const goalX = Math.max(0, width - 2);
    tiles[fallbackWalkY]![goalX] = 3;
    tiles[fallbackWalkY + 1]![goalX] = surfaceTile;
    report = validateLevel(base);
  }

  if (!report.valid) {
    const spawn = report.spawn ?? { x: Math.min(1, width - 1), y: fallbackWalkY };
    let goalX = report.goal?.x ?? width - 2;
    if (goalX <= spawn.x) {
      goalX = Math.max(spawn.x + 1, width - 2);
      goalX = Math.min(width - 1, goalX);
    }
    const walkY = Math.min(height - 2, Math.max(1, spawn.y, report.goal?.y ?? fallbackWalkY));
    laySafeCorridor(tiles, width, spawn.x, goalX, walkY, surfaceTile);
    report = validateLevel(base);
  }

  if (!report.valid) {
    // Structural repair above should make this rare. A full-width corridor is the
    // deterministic last resort and intentionally preserves all off-corridor art.
    laySafeCorridor(tiles, width, 0, width - 2, fallbackWalkY, surfaceTile);
    report = validateLevel(base);
  }

  const changed =
    !before.valid ||
    width !== level.width ||
    height !== level.height ||
    JSON.stringify(tiles) !== JSON.stringify(level.tiles);
  return { level: base, changed, before, after: report };
}
