import {
  backgroundDefinition,
  isBackgroundId,
  type BackgroundId,
} from "./backgrounds";
import {
  type ActivityEntry,
  type DeathCluster,
  type GridPoint,
  type LevelBlueprint,
  type LevelDocument,
  type LevelMetadata,
  type LevelPatchOperation,
  type MutationResult,
  type PlaytestEvent,
  type PlaytestReport,
  type StudioMode,
  type StudioSnapshot,
  type StudioStore,
  type TileId,
  LEVEL_SIZE_LIMITS,
} from "./contracts";
import { decodeLevel, encodeLevel } from "./codec";
import { generateLevel } from "./generator";
import { isPassableTile, isSupportTile, isTileId, repairLevel, validateLevel } from "./validation";

export const DEFAULT_STORAGE_KEY = "vibe-tide-live:studio:v1";
export const DEFAULT_HISTORY_LIMIT = 32;
export const DEFAULT_ACTIVITY_LIMIT = 48;
export const DEFAULT_MAX_PATCH_OPERATIONS = 96;
export const DEFAULT_MAX_PATCH_CELLS = 8_192;
export const DEFAULT_MAX_PLAYTEST_EVENTS = 2_000;

const PERSISTENCE_VERSION = 1 as const;
const PLAYTEST_EVENT_TYPES = new Set<PlaytestEvent["type"]>([
  "start",
  "death",
  "checkpoint",
  "complete",
  "quit",
]);

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface LevelStoreOptions {
  initialLevel?: LevelDocument;
  storage?: StorageLike | null;
  storageKey?: string;
  historyLimit?: number;
  activityLimit?: number;
  maxPatchOperations?: number;
  maxPatchCells?: number;
  maxPlaytestEvents?: number;
  now?: () => string | Date;
}

interface PersistedStoreV1 {
  version: typeof PERSISTENCE_VERSION;
  level: string;
  history: string[];
  lastPlaytest: PlaytestReport | null;
  activity: ActivityEntry[];
}

interface RestoredState {
  level: LevelDocument;
  history: LevelDocument[];
  lastPlaytest: PlaytestReport | null;
  activity: ActivityEntry[];
}

interface MutableBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function cloneLevel(level: LevelDocument): LevelDocument {
  return {
    ...level,
    tiles: level.tiles.map((row) => [...row]),
    metadata: { ...level.metadata },
  };
}

function cloneEvent(event: PlaytestEvent): PlaytestEvent {
  return { ...event, position: { ...event.position } };
}

function clonePlaytest(report: PlaytestReport): PlaytestReport {
  return {
    ...report,
    events: report.events.map(cloneEvent),
    deathClusters: report.deathClusters.map((cluster) => ({
      count: cluster.count,
      center: { ...cluster.center },
    })),
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

function resolveStorage(storage: StorageLike | null | undefined): StorageLike | null {
  if (storage !== undefined) {
    return storage;
  }
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, value));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGridPoint(value: unknown): value is GridPoint {
  return (
    isObject(value) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  );
}

function restorePlaytest(value: unknown, levelId: string): PlaytestReport | null {
  if (
    !isObject(value) ||
    value.levelId !== levelId ||
    typeof value.revision !== "number" ||
    !Number.isInteger(value.revision) ||
    typeof value.startedAt !== "string" ||
    (value.endedAt !== null && typeof value.endedAt !== "string") ||
    typeof value.completed !== "boolean" ||
    typeof value.elapsedMs !== "number" ||
    !Number.isFinite(value.elapsedMs) ||
    typeof value.deaths !== "number" ||
    !Number.isInteger(value.deaths) ||
    !Array.isArray(value.events)
  ) {
    return null;
  }

  const events: PlaytestEvent[] = [];
  for (const candidate of value.events) {
    if (
      !isObject(candidate) ||
      typeof candidate.type !== "string" ||
      !PLAYTEST_EVENT_TYPES.has(candidate.type as PlaytestEvent["type"]) ||
      !isGridPoint(candidate.position) ||
      typeof candidate.elapsedMs !== "number" ||
      !Number.isFinite(candidate.elapsedMs) ||
      typeof candidate.deaths !== "number" ||
      !Number.isInteger(candidate.deaths) ||
      typeof candidate.revision !== "number" ||
      !Number.isInteger(candidate.revision) ||
      typeof candidate.timestamp !== "string"
    ) {
      return null;
    }
    events.push({
      type: candidate.type as PlaytestEvent["type"],
      position: { x: candidate.position.x, y: candidate.position.y },
      elapsedMs: Math.max(0, candidate.elapsedMs),
      deaths: Math.max(0, candidate.deaths),
      revision: candidate.revision,
      timestamp: candidate.timestamp,
    });
  }

  return {
    levelId,
    revision: value.revision,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    completed: value.completed,
    elapsedMs: Math.max(0, value.elapsedMs),
    deaths: Math.max(0, value.deaths),
    events,
    deathClusters: clusterDeaths(events),
  };
}

function restoreActivity(value: unknown, limit: number): ActivityEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: ActivityEntry[] = [];
  for (const candidate of value.slice(0, limit)) {
    if (
      !isObject(candidate) ||
      typeof candidate.id !== "string" ||
      (candidate.source !== "human" &&
        candidate.source !== "agent" &&
        candidate.source !== "system" &&
        candidate.source !== "game") ||
      typeof candidate.action !== "string" ||
      typeof candidate.detail !== "string" ||
      typeof candidate.revision !== "number" ||
      !Number.isInteger(candidate.revision) ||
      typeof candidate.timestamp !== "string"
    ) {
      continue;
    }
    entries.push({
      id: candidate.id.slice(0, 128),
      source: candidate.source,
      action: candidate.action.slice(0, 48),
      detail: candidate.detail.slice(0, 160),
      revision: candidate.revision,
      timestamp: candidate.timestamp,
    });
  }
  return entries;
}

function mergeAuthor(
  existing: LevelMetadata["author"],
  source: "human" | "agent",
): LevelMetadata["author"] {
  if (existing === "human+agent" || existing === source) {
    return existing;
  }
  return "human+agent";
}

function distanceSquared(left: GridPoint, right: GridPoint): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

/** Groups nearby deaths with deterministic connected-component clustering. */
export function clusterDeaths(
  events: readonly PlaytestEvent[],
  radius = 2,
): DeathCluster[] {
  const deaths = events.filter((event) => event.type === "death").map((event) => event.position);
  const visited = new Set<number>();
  const clusters: DeathCluster[] = [];
  const threshold = Math.max(0, radius) ** 2;

  for (let start = 0; start < deaths.length; start += 1) {
    if (visited.has(start)) {
      continue;
    }
    const members: GridPoint[] = [];
    const queue = [start];
    visited.add(start);
    for (let index = 0; index < queue.length; index += 1) {
      const currentIndex = queue[index];
      if (currentIndex === undefined) {
        continue;
      }
      const current = deaths[currentIndex];
      if (!current) {
        continue;
      }
      members.push(current);
      for (let candidateIndex = 0; candidateIndex < deaths.length; candidateIndex += 1) {
        const candidate = deaths[candidateIndex];
        if (
          candidate &&
          !visited.has(candidateIndex) &&
          distanceSquared(current, candidate) <= threshold
        ) {
          visited.add(candidateIndex);
          queue.push(candidateIndex);
        }
      }
    }
    if (members.length > 0) {
      const total = members.reduce(
        (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 },
      );
      clusters.push({
        center: {
          x: Math.round((total.x / members.length) * 10) / 10,
          y: Math.round((total.y / members.length) * 10) / 10,
        },
        count: members.length,
      });
    }
  }

  return clusters.sort(
    (left, right) =>
      right.count - left.count || left.center.x - right.center.x || left.center.y - right.center.y,
  );
}

function normalizePoint(point: GridPoint, level: LevelDocument): GridPoint {
  const x = Number.isFinite(point.x) ? Math.round(point.x) : 0;
  const y = Number.isFinite(point.y) ? Math.round(point.y) : 0;
  return {
    x: Math.max(0, Math.min(level.width - 1, x)),
    y: Math.max(0, Math.min(level.height - 1, y)),
  };
}

function updateBounds(bounds: MutableBounds | null, x: number, y: number): MutableBounds {
  if (!bounds) {
    return { minX: x, minY: y, maxX: x, maxY: y };
  }
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
  return bounds;
}

function publicBounds(bounds: MutableBounds | null): MutationResult["changedBounds"] {
  return bounds
    ? {
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.maxX - bounds.minX + 1,
        height: bounds.maxY - bounds.minY + 1,
      }
    : null;
}

function findGoal(level: LevelDocument): GridPoint | null {
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if (level.tiles[y]?.[x] === 3) {
        return { x, y };
      }
    }
  }
  return null;
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

function relocateGoalToReachableLanding(level: LevelDocument, preferredY: number): void {
  clearGoals(level.tiles);
  const candidates: GridPoint[] = [];
  for (let y = 0; y < level.height - 1; y += 1) {
    for (let x = 1; x < level.width; x += 1) {
      const tile = level.tiles[y]?.[x];
      const support = level.tiles[y + 1]?.[x];
      if (tile !== undefined && support !== undefined && isPassableTile(tile) && isSupportTile(support)) {
        candidates.push({ x, y });
      }
    }
  }
  candidates.sort(
    (left, right) =>
      right.x - left.x || Math.abs(left.y - preferredY) - Math.abs(right.y - preferredY),
  );

  for (const candidate of candidates) {
    const previous = level.tiles[candidate.y]![candidate.x]!;
    level.tiles[candidate.y]![candidate.x] = 3;
    if (validateLevel(level).valid) {
      return;
    }
    level.tiles[candidate.y]![candidate.x] = previous;
  }

  const fallback = candidates[0] ?? {
    x: Math.max(1, level.width - 2),
    y: Math.max(1, level.height - 3),
  };
  level.tiles[fallback.y]![fallback.x] = 3;
  if (fallback.y + 1 < level.height) {
    level.tiles[fallback.y + 1]![fallback.x] = 1;
  }
}

export class LevelStore implements StudioStore {
  private level: LevelDocument;
  private mode: StudioMode = "edit";
  private validation = validateLevel(
    generateLevel({ name: "Untitled tide" }),
  );
  private activePlaytest: PlaytestReport | null = null;
  private lastPlaytest: PlaytestReport | null = null;
  private activity: ActivityEntry[] = [];
  private history: LevelDocument[] = [];
  private snapshot: StudioSnapshot;
  private readonly listeners = new Set<(snapshot: StudioSnapshot) => void>();
  private readonly storage: StorageLike | null;
  private readonly storageKey: string;
  private readonly historyLimit: number;
  private readonly activityLimit: number;
  private readonly maxPatchOperations: number;
  private readonly maxPatchCells: number;
  private readonly maxPlaytestEvents: number;
  private readonly now: () => string;
  private activitySequence = 0;

  constructor(options: LevelStoreOptions = {}) {
    this.storage = resolveStorage(options.storage);
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.historyLimit = boundedInteger(options.historyLimit, DEFAULT_HISTORY_LIMIT, 1, 256);
    this.activityLimit = boundedInteger(options.activityLimit, DEFAULT_ACTIVITY_LIMIT, 1, 256);
    this.maxPatchOperations = boundedInteger(
      options.maxPatchOperations,
      DEFAULT_MAX_PATCH_OPERATIONS,
      1,
      2_048,
    );
    this.maxPatchCells = boundedInteger(options.maxPatchCells, DEFAULT_MAX_PATCH_CELLS, 1, 65_536);
    this.maxPlaytestEvents = boundedInteger(
      options.maxPlaytestEvents,
      DEFAULT_MAX_PLAYTEST_EVENTS,
      8,
      20_000,
    );
    this.now = () => {
      const value = options.now?.() ?? new Date();
      return value instanceof Date ? value.toISOString() : value;
    };

    const restored = options.initialLevel ? null : this.restore();
    if (options.initialLevel) {
      this.level = repairLevel(cloneLevel(options.initialLevel), { now: options.initialLevel.updatedAt }).level;
    } else if (restored) {
      this.level = restored.level;
      this.history = restored.history.slice(-this.historyLimit);
      this.lastPlaytest = restored.lastPlaytest;
      this.activity = restored.activity.slice(0, this.activityLimit);
    } else {
      const timestamp = this.now();
      this.level = generateLevel(
        {
          name: "First light",
          description: "A friendly shoreline for sketching the next route.",
          difficulty: "beginner",
          primaryMechanic: "platforming",
        },
        { now: timestamp, author: "human" },
      );
    }
    this.validation = validateLevel(this.level);
    this.activitySequence = this.activity.length;
    this.snapshot = this.buildSnapshot();
  }

  getSnapshot(): StudioSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: StudioSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  createLevel(blueprint: LevelBlueprint, source: "human" | "agent" = "human"): MutationResult {
    const timestamp = this.now();
    const next = generateLevel(blueprint, { now: timestamp, author: source });
    this.rememberCurrentLevel();
    this.level = next;
    this.mode = "edit";
    this.activePlaytest = null;
    this.lastPlaytest = null;
    this.activity = [];
    this.addActivity(source, "Created level", next.metadata.name);
    this.validation = validateLevel(this.level);
    this.publish();
    return {
      ok: true,
      revision: next.revision,
      summary: `Created ${next.metadata.name}`,
      changedBounds: { x: 0, y: 0, width: next.width, height: next.height },
      validation: this.validation,
    };
  }

  resizeLevel(
    width: number,
    height: number,
    source: "human" | "agent" = "human",
  ): MutationResult {
    const widthChanges = width !== this.level.width;
    const heightChanges = height !== this.level.height;
    if (
      !Number.isInteger(width) ||
      (widthChanges &&
        (width < LEVEL_SIZE_LIMITS.minWidth || width > LEVEL_SIZE_LIMITS.maxWidth))
    ) {
      return this.noChange(
        `Level length must be a whole number from ${LEVEL_SIZE_LIMITS.minWidth} to ${LEVEL_SIZE_LIMITS.maxWidth}.`,
        false,
      );
    }
    if (
      !Number.isInteger(height) ||
      (heightChanges &&
        (height < LEVEL_SIZE_LIMITS.minHeight || height > LEVEL_SIZE_LIMITS.maxHeight))
    ) {
      return this.noChange(
        `Level height must be a whole number from ${LEVEL_SIZE_LIMITS.minHeight} to ${LEVEL_SIZE_LIMITS.maxHeight}.`,
        false,
      );
    }
    if (!widthChanges && !heightChanges) {
      return this.noChange("Level size already matches.", true);
    }

    const previousWidth = this.level.width;
    const previousHeight = this.level.height;
    const previousGoal = findGoal(this.level);
    const verticalOffset = height - previousHeight;
    const tiles: TileId[][] = Array.from({ length: height }, (_, newY) => {
      const previousY = newY - verticalOffset;
      return Array.from({ length: width }, (_, x) => {
        if (previousY < 0 || previousY >= previousHeight || x >= previousWidth) {
          return 0;
        }
        return this.level.tiles[previousY]?.[x] ?? 0;
      });
    });
    const next: LevelDocument = {
      ...this.level,
      width,
      height,
      tiles,
      metadata: {
        ...this.level.metadata,
        author: mergeAuthor(this.level.metadata.author, source),
      },
    };

    const transformedGoalY = previousGoal ? previousGoal.y + verticalOffset : height - 3;
    const finishWasPinnedToRightEdge =
      previousGoal !== null && previousGoal.x >= previousWidth - 2;
    const canExtendPinnedFinish =
      finishWasPinnedToRightEdge &&
      width > previousWidth &&
      transformedGoalY >= 1 &&
      transformedGoalY < height - 1;

    if (canExtendPinnedFinish) {
      clearGoals(next.tiles);
      const supportAtOldFinish = next.tiles[transformedGoalY + 1]?.[previousGoal.x];
      const supportTile =
        supportAtOldFinish !== undefined && isSupportTile(supportAtOldFinish)
          ? supportAtOldFinish
          : 1;
      for (let x = previousGoal.x; x < width; x += 1) {
        next.tiles[transformedGoalY]![x] = 0;
        next.tiles[transformedGoalY + 1]![x] = supportTile;
        if (transformedGoalY > 0) {
          next.tiles[transformedGoalY - 1]![x] = 0;
        }
      }
      next.tiles[transformedGoalY]![width - 2] = 3;
    } else if (findGoal(next) === null) {
      relocateGoalToReachableLanding(
        next,
        Math.max(0, Math.min(height - 2, transformedGoalY)),
      );
    }

    if (this.validation.valid && !validateLevel(next).valid) {
      return this.noChange(
        "That size would cut away the playable route. Move the route lower or farther left, then resize again.",
        false,
      );
    }

    const detail = `${previousWidth} × ${previousHeight} → ${width} × ${height}`;
    this.commitLevel(next, source, "Resized level", detail);
    return {
      ok: true,
      revision: this.level.revision,
      summary: `Resized level to ${width} × ${height}`,
      changedBounds: { x: 0, y: 0, width, height },
      validation: this.validation,
    };
  }

  applyPatch(
    operations: LevelPatchOperation[],
    reason: string,
    source: "human" | "agent" = "human",
  ): MutationResult {
    if (!Array.isArray(operations) || operations.length === 0) {
      return this.noChange("No patch operations supplied.", true);
    }
    if (operations.length > this.maxPatchOperations) {
      return this.noChange(`Patch exceeds the ${this.maxPatchOperations}-operation limit.`, false);
    }
    if (typeof reason !== "string" || reason.trim().length === 0) {
      return this.noChange("Patch reason is required.", false);
    }

    let requestedCells = 0;
    for (const operation of operations) {
      const operationError = this.validateOperation(operation);
      if (operationError) {
        return this.noChange(operationError, false);
      }
      switch (operation.kind) {
        case "set_tile":
          requestedCells += 1;
          break;
        case "fill_rect":
        case "clear_rect":
          requestedCells += operation.width * operation.height;
          break;
        case "platform":
          requestedCells += operation.length;
          break;
        case "move_goal":
          requestedCells +=
            1 +
            this.level.tiles.reduce(
              (count, row) =>
                count + row.reduce<number>((rowCount, tile) => rowCount + (tile === 3 ? 1 : 0), 0),
              0,
            );
          break;
      }
      if (requestedCells > this.maxPatchCells) {
        return this.noChange(`Patch exceeds the ${this.maxPatchCells}-cell limit.`, false);
      }
    }

    const tiles = this.level.tiles.map((row) => [...row]);
    let bounds: MutableBounds | null = null;
    const setTile = (x: number, y: number, tile: TileId): void => {
      const row = tiles[y];
      if (row && row[x] !== tile) {
        row[x] = tile;
        bounds = updateBounds(bounds, x, y);
      }
    };

    for (const operation of operations) {
      switch (operation.kind) {
        case "set_tile":
          setTile(operation.x, operation.y, operation.tile);
          break;
        case "fill_rect":
        case "clear_rect": {
          const tile: TileId = operation.kind === "fill_rect" ? operation.tile : 0;
          for (let y = operation.y; y < operation.y + operation.height; y += 1) {
            for (let x = operation.x; x < operation.x + operation.width; x += 1) {
              setTile(x, y, tile);
            }
          }
          break;
        }
        case "platform":
          for (let x = operation.x; x < operation.x + operation.length; x += 1) {
            setTile(x, operation.y, operation.tile);
          }
          break;
        case "move_goal":
          for (let y = 0; y < this.level.height; y += 1) {
            for (let x = 0; x < this.level.width; x += 1) {
              if (tiles[y]?.[x] === 3) {
                setTile(x, y, 0);
              }
            }
          }
          setTile(operation.x, operation.y, 3);
          break;
      }
    }

    if (!bounds) {
      return this.noChange("Patch already matches the level.", true);
    }
    const summary = reason.trim().replace(/\s+/g, " ").slice(0, 120);
    this.commitLevel(
      {
        ...this.level,
        tiles,
        metadata: { ...this.level.metadata, author: mergeAuthor(this.level.metadata.author, source) },
      },
      source,
      "Edited level",
      summary,
    );
    return {
      ok: true,
      revision: this.level.revision,
      summary,
      changedBounds: publicBounds(bounds),
      validation: this.validation,
    };
  }

  setMetadata(
    changes: Partial<Pick<LevelMetadata, "name" | "description" | "difficulty" | "primaryMechanic">>,
    source: "human" | "agent" = "human",
  ): MutationResult {
    const result = this.normalizeMetadataChanges(changes);
    if (!result.ok) {
      return this.noChange(result.error, false);
    }
    const nextMetadata: LevelMetadata = {
      ...this.level.metadata,
      ...result.changes,
      author: mergeAuthor(this.level.metadata.author, source),
    };
    const changed = (Object.keys(result.changes) as (keyof typeof result.changes)[]).some(
      (key) => nextMetadata[key] !== this.level.metadata[key],
    );
    if (!changed) {
      return this.noChange("Metadata already matches the level.", true);
    }
    this.commitLevel(
      { ...this.level, tiles: this.level.tiles.map((row) => [...row]), metadata: nextMetadata },
      source,
      "Updated details",
      Object.keys(result.changes).join(", ").slice(0, 120),
    );
    return {
      ok: true,
      revision: this.level.revision,
      summary: "Updated level details",
      changedBounds: null,
      validation: this.validation,
    };
  }

  setBackground(
    background: BackgroundId,
    source: "human" | "agent" = "human",
  ): MutationResult {
    if (!isBackgroundId(background)) {
      return this.noChange("Background is unsupported.", false);
    }
    if (background === this.level.metadata.background) {
      return this.noChange("Background already matches the level.", true);
    }
    this.commitLevel(
      {
        ...this.level,
        tiles: this.level.tiles.map((row) => [...row]),
        metadata: {
          ...this.level.metadata,
          background,
          author: mergeAuthor(this.level.metadata.author, source),
        },
      },
      source,
      "Changed backdrop",
      backgroundDefinition(background).name,
    );
    return {
      ok: true,
      revision: this.level.revision,
      summary: `Changed backdrop to ${backgroundDefinition(background).name}`,
      changedBounds: null,
      validation: this.validation,
    };
  }

  setMode(mode: StudioMode, source: "human" | "agent" = "human"): StudioSnapshot {
    if (mode !== "edit" && mode !== "play") {
      return this.snapshot;
    }
    if (this.mode !== mode) {
      this.mode = mode;
      this.addActivity(source, mode === "play" ? "Entered play mode" : "Returned to editor", this.level.metadata.name);
      this.publish();
    }
    return this.snapshot;
  }

  beginPlaytest(): PlaytestReport {
    if (this.activePlaytest) {
      return this.snapshot.activePlaytest as PlaytestReport;
    }
    const timestamp = this.now();
    const position = this.validation.spawn ?? { x: 0, y: 0 };
    this.activePlaytest = {
      levelId: this.level.id,
      revision: this.level.revision,
      startedAt: timestamp,
      endedAt: null,
      completed: false,
      elapsedMs: 0,
      deaths: 0,
      events: [
        {
          type: "start",
          position: { ...position },
          elapsedMs: 0,
          deaths: 0,
          revision: this.level.revision,
          timestamp,
        },
      ],
      deathClusters: [],
    };
    this.mode = "play";
    this.addActivity("game", "Started playtest", `Revision ${this.level.revision}`);
    this.publish();
    return this.snapshot.activePlaytest as PlaytestReport;
  }

  recordPlaytestEvent(event: Omit<PlaytestEvent, "revision" | "timestamp">): PlaytestReport {
    if (!this.activePlaytest) {
      throw new Error("Begin a playtest before recording events.");
    }
    if (!PLAYTEST_EVENT_TYPES.has(event.type)) {
      throw new Error("Unsupported playtest event type.");
    }
    const elapsedMs = Number.isFinite(event.elapsedMs)
      ? Math.max(this.activePlaytest.elapsedMs, Math.round(event.elapsedMs))
      : this.activePlaytest.elapsedMs;
    const suppliedDeaths = Number.isFinite(event.deaths) ? Math.max(0, Math.round(event.deaths)) : 0;
    const deaths =
      event.type === "death"
        ? Math.max(this.activePlaytest.deaths + 1, suppliedDeaths)
        : Math.max(this.activePlaytest.deaths, suppliedDeaths);
    const recorded: PlaytestEvent = {
      type: event.type,
      position: normalizePoint(event.position, this.level),
      elapsedMs,
      deaths,
      revision: this.activePlaytest.revision,
      timestamp: this.now(),
    };
    const replacesImplicitStart =
      event.type === "start" &&
      this.activePlaytest.events.length === 1 &&
      this.activePlaytest.events[0]?.type === "start";
    const events = replacesImplicitStart ? [recorded] : [...this.activePlaytest.events, recorded];
    if (events.length > this.maxPlaytestEvents) {
      events.splice(1, events.length - this.maxPlaytestEvents);
    }
    this.activePlaytest = {
      ...this.activePlaytest,
      completed: this.activePlaytest.completed || event.type === "complete",
      elapsedMs,
      deaths,
      events,
      deathClusters: clusterDeaths(events),
    };
    this.publish();
    return this.snapshot.activePlaytest as PlaytestReport;
  }

  endPlaytest(completed: boolean): PlaytestReport | null {
    if (!this.activePlaytest) {
      return null;
    }
    const finished: PlaytestReport = {
      ...this.activePlaytest,
      endedAt: this.now(),
      completed: this.activePlaytest.completed || completed,
      events: this.activePlaytest.events.map(cloneEvent),
      deathClusters: clusterDeaths(this.activePlaytest.events),
    };
    this.activePlaytest = null;
    this.lastPlaytest = finished;
    this.mode = "edit";
    const seconds = Math.round(finished.elapsedMs / 100) / 10;
    this.addActivity(
      "game",
      finished.completed ? "Completed playtest" : "Ended playtest",
      `${seconds}s, ${finished.deaths} ${finished.deaths === 1 ? "death" : "deaths"}`,
    );
    this.publish();
    return this.snapshot.lastPlaytest as PlaytestReport;
  }

  undo(source: "human" | "agent" = "human"): MutationResult {
    const previous = this.history.pop();
    if (!previous) {
      return this.noChange("Nothing to undo.", false);
    }
    const revision = Math.max(this.level.revision, previous.revision) + 1;
    this.level = {
      ...cloneLevel(previous),
      revision,
      updatedAt: this.now(),
      metadata: { ...previous.metadata, author: mergeAuthor(previous.metadata.author, source) },
    };
    this.validation = validateLevel(this.level);
    this.addActivity(source, "Undid edit", `Restored content as revision ${revision}`);
    this.publish();
    return {
      ok: true,
      revision,
      summary: "Undid the latest edit",
      changedBounds: { x: 0, y: 0, width: this.level.width, height: this.level.height },
      validation: this.validation,
    };
  }

  exportProject(): LevelDocument {
    return cloneLevel(this.level);
  }

  clearPersistence(): void {
    try {
      this.storage?.removeItem?.(this.storageKey);
    } catch {
      // Storage is best effort; an unavailable browser store must not break editing.
    }
  }

  private commitLevel(
    next: LevelDocument,
    source: "human" | "agent",
    action: string,
    detail: string,
  ): void {
    this.rememberCurrentLevel();
    this.level = {
      ...next,
      revision: this.level.revision + 1,
      createdAt: this.level.createdAt,
      updatedAt: this.now(),
    };
    this.validation = validateLevel(this.level);
    this.addActivity(source, action, detail);
    this.publish();
  }

  private rememberCurrentLevel(): void {
    this.history.push(cloneLevel(this.level));
    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }
  }

  private validateOperation(operation: LevelPatchOperation): string | null {
    if (!operation || typeof operation !== "object" || typeof operation.kind !== "string") {
      return "Patch contains a malformed operation.";
    }
    const pointIsValid = (x: number, y: number): boolean =>
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      y >= 0 &&
      x < this.level.width &&
      y < this.level.height;
    switch (operation.kind) {
      case "set_tile":
        return pointIsValid(operation.x, operation.y) && isTileId(operation.tile)
          ? null
          : "set_tile is outside the grid or uses an unsupported tile.";
      case "fill_rect":
        if (!isTileId(operation.tile)) {
          return "fill_rect uses an unsupported tile.";
        }
        return this.validateRectangle(operation.x, operation.y, operation.width, operation.height);
      case "clear_rect":
        return this.validateRectangle(operation.x, operation.y, operation.width, operation.height);
      case "platform":
        if (operation.tile !== 1 && operation.tile !== 2 && operation.tile !== 4) {
          return "platform must use a solid or slippery surface tile.";
        }
        return this.validateRectangle(operation.x, operation.y, operation.length, 1);
      case "move_goal":
        return pointIsValid(operation.x, operation.y) ? null : "move_goal is outside the grid.";
      default:
        return "Patch contains an unsupported operation.";
    }
  }

  private validateRectangle(x: number, y: number, width: number, height: number): string | null {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      x < 0 ||
      y < 0 ||
      x + width > this.level.width ||
      y + height > this.level.height
    ) {
      return "Rectangle operation is empty or outside the grid.";
    }
    return null;
  }

  private normalizeMetadataChanges(
    changes: Partial<Pick<LevelMetadata, "name" | "description" | "difficulty" | "primaryMechanic">>,
  ):
    | {
        ok: true;
        changes: Partial<Pick<LevelMetadata, "name" | "description" | "difficulty" | "primaryMechanic">>;
      }
    | { ok: false; error: string } {
    if (!changes || typeof changes !== "object") {
      return { ok: false, error: "Metadata changes are malformed." };
    }
    const normalized: Partial<Pick<LevelMetadata, "name" | "description" | "difficulty" | "primaryMechanic">> = {};
    if (changes.name !== undefined) {
      if (typeof changes.name !== "string" || changes.name.trim().length === 0) {
        return { ok: false, error: "Level name cannot be empty." };
      }
      normalized.name = changes.name.trim().slice(0, 80);
    }
    if (changes.description !== undefined) {
      if (typeof changes.description !== "string") {
        return { ok: false, error: "Level description must be text." };
      }
      normalized.description = changes.description.trim().slice(0, 360);
    }
    if (changes.difficulty !== undefined) {
      if (
        changes.difficulty !== "beginner" &&
        changes.difficulty !== "moderate" &&
        changes.difficulty !== "tricky"
      ) {
        return { ok: false, error: "Level difficulty is unsupported." };
      }
      normalized.difficulty = changes.difficulty;
    }
    if (changes.primaryMechanic !== undefined) {
      if (
        changes.primaryMechanic !== "platforming" &&
        changes.primaryMechanic !== "ice" &&
        changes.primaryMechanic !== "spikes" &&
        changes.primaryMechanic !== "water" &&
        changes.primaryMechanic !== "mixed"
      ) {
        return { ok: false, error: "Primary mechanic is unsupported." };
      }
      normalized.primaryMechanic = changes.primaryMechanic;
    }
    return { ok: true, changes: normalized };
  }

  private noChange(summary: string, ok: boolean): MutationResult {
    return {
      ok,
      revision: this.level.revision,
      summary,
      changedBounds: null,
      validation: this.validation,
    };
  }

  private addActivity(
    source: ActivityEntry["source"],
    action: string,
    detail: string,
  ): void {
    this.activitySequence += 1;
    const timestamp = this.now();
    const entry: ActivityEntry = {
      id: `activity_${this.level.revision}_${this.activitySequence}_${Date.parse(timestamp) || 0}`,
      source,
      action: action.replace(/\s+/g, " ").trim().slice(0, 48),
      detail: detail.replace(/\s+/g, " ").trim().slice(0, 160),
      revision: this.level.revision,
      timestamp,
    };
    this.activity = [entry, ...this.activity].slice(0, this.activityLimit);
  }

  private buildSnapshot(): StudioSnapshot {
    return deepFreeze({
      level: cloneLevel(this.level),
      mode: this.mode,
      validation: {
        ...this.validation,
        issues: this.validation.issues.map((issue) => ({
          ...issue,
          ...(issue.location ? { location: { ...issue.location } } : {}),
        })),
        spawn: this.validation.spawn ? { ...this.validation.spawn } : null,
        goal: this.validation.goal ? { ...this.validation.goal } : null,
      },
      activePlaytest: this.activePlaytest ? clonePlaytest(this.activePlaytest) : null,
      lastPlaytest: this.lastPlaytest ? clonePlaytest(this.lastPlaytest) : null,
      activity: this.activity.map((entry) => ({ ...entry })),
      canUndo: this.history.length > 0,
    });
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot();
    this.persist();
    for (const listener of [...this.listeners]) {
      try {
        listener(this.snapshot);
      } catch {
        // A UI subscriber cannot roll back a committed edit or block other subscribers.
      }
    }
  }

  private persist(): void {
    if (!this.storage) {
      return;
    }
    const payload: PersistedStoreV1 = {
      version: PERSISTENCE_VERSION,
      level: encodeLevel(this.level),
      history: this.history.slice(-this.historyLimit).map(encodeLevel),
      lastPlaytest: this.lastPlaytest ? clonePlaytest(this.lastPlaytest) : null,
      activity: this.activity.map((entry) => ({ ...entry })),
    };
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Quota errors and privacy-mode storage failures are intentionally non-fatal.
    }
  }

  private restore(): RestoredState | null {
    if (!this.storage) {
      return null;
    }
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isObject(parsed) || parsed.version !== PERSISTENCE_VERSION || typeof parsed.level !== "string") {
        return null;
      }
      const level = decodeLevel(parsed.level);
      const history = Array.isArray(parsed.history)
        ? parsed.history
            .filter((entry): entry is string => typeof entry === "string")
            .slice(-this.historyLimit)
            .flatMap((entry) => {
              try {
                return [decodeLevel(entry)];
              } catch {
                return [];
              }
            })
        : [];
      return {
        level,
        history,
        lastPlaytest: restorePlaytest(parsed.lastPlaytest, level.id),
        activity: restoreActivity(parsed.activity, this.activityLimit),
      };
    } catch {
      return null;
    }
  }
}

export function createLevelStore(options: LevelStoreOptions = {}): StudioStore {
  return new LevelStore(options);
}
