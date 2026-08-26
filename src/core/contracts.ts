export const LEVEL_SCHEMA_VERSION = 1 as const;

export const TILE_IDS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export type TileId = (typeof TILE_IDS)[number];

export const TILE_DEFINITIONS = {
  0: { name: "air", behavior: "empty" },
  1: { name: "dune grass", behavior: "solid" },
  2: { name: "reef rock", behavior: "solid" },
  3: { name: "finish buoy", behavior: "goal" },
  4: { name: "sea glass", behavior: "slippery" },
  5: { name: "hot vent", behavior: "hazard" },
  6: { name: "coral spikes", behavior: "hazard" },
  7: { name: "deep water", behavior: "hazard" },
} as const satisfies Record<TileId, { name: string; behavior: string }>;

export type Difficulty = "beginner" | "moderate" | "tricky";
export type PrimaryMechanic = "platforming" | "ice" | "spikes" | "water" | "mixed";

export interface LevelMetadata {
  name: string;
  description: string;
  difficulty: Difficulty;
  primaryMechanic: PrimaryMechanic;
  author: "human" | "agent" | "human+agent";
}

export interface LevelDocument {
  schemaVersion: typeof LEVEL_SCHEMA_VERSION;
  id: string;
  revision: number;
  width: number;
  height: number;
  tiles: TileId[][];
  metadata: LevelMetadata;
  createdAt: string;
  updatedAt: string;
}

export type StudioMode = "edit" | "play";

export interface GridPoint {
  x: number;
  y: number;
}

export interface ValidationIssue {
  code:
    | "invalid_dimensions"
    | "ragged_grid"
    | "invalid_tile"
    | "missing_spawn"
    | "missing_goal"
    | "unreachable_goal";
  message: string;
  location?: GridPoint;
  severity: "error" | "warning";
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  spawn: GridPoint | null;
  goal: GridPoint | null;
  reachableCells: number;
}

export interface PlaytestEvent {
  type: "start" | "death" | "checkpoint" | "complete" | "quit";
  position: GridPoint;
  elapsedMs: number;
  deaths: number;
  revision: number;
  timestamp: string;
}

export interface DeathCluster {
  center: GridPoint;
  count: number;
}

export interface PlaytestReport {
  levelId: string;
  revision: number;
  startedAt: string;
  endedAt: string | null;
  completed: boolean;
  elapsedMs: number;
  deaths: number;
  events: PlaytestEvent[];
  deathClusters: DeathCluster[];
}

export interface ActivityEntry {
  id: string;
  source: "human" | "agent" | "system" | "game";
  action: string;
  detail: string;
  revision: number;
  timestamp: string;
}

export interface StudioSnapshot {
  level: LevelDocument;
  mode: StudioMode;
  validation: ValidationReport;
  activePlaytest: PlaytestReport | null;
  lastPlaytest: PlaytestReport | null;
  activity: ActivityEntry[];
  canUndo: boolean;
}

export interface LevelSectionSpec {
  kind: "run" | "gap" | "stairs" | "ice" | "spikes" | "water" | "finish";
  length: number;
  intensity?: 1 | 2 | 3;
}

export interface LevelBlueprint {
  name: string;
  description?: string;
  width?: number;
  height?: number;
  difficulty?: Difficulty;
  primaryMechanic?: PrimaryMechanic;
  seed?: number;
  sections?: LevelSectionSpec[];
}

export type LevelPatchOperation =
  | { kind: "set_tile"; x: number; y: number; tile: TileId }
  | { kind: "fill_rect"; x: number; y: number; width: number; height: number; tile: TileId }
  | { kind: "clear_rect"; x: number; y: number; width: number; height: number }
  | { kind: "platform"; x: number; y: number; length: number; tile: 1 | 2 | 4 }
  | { kind: "move_goal"; x: number; y: number };

export interface MutationResult {
  ok: boolean;
  revision: number;
  summary: string;
  changedBounds: { x: number; y: number; width: number; height: number } | null;
  validation: ValidationReport;
}

export interface StudioStore {
  getSnapshot(): StudioSnapshot;
  subscribe(listener: (snapshot: StudioSnapshot) => void): () => void;
  createLevel(blueprint: LevelBlueprint, source?: "human" | "agent"): MutationResult;
  applyPatch(
    operations: LevelPatchOperation[],
    reason: string,
    source?: "human" | "agent",
  ): MutationResult;
  setMetadata(
    changes: Partial<Pick<LevelMetadata, "name" | "description" | "difficulty" | "primaryMechanic">>,
    source?: "human" | "agent",
  ): MutationResult;
  setMode(mode: StudioMode, source?: "human" | "agent"): StudioSnapshot;
  beginPlaytest(): PlaytestReport;
  recordPlaytestEvent(event: Omit<PlaytestEvent, "revision" | "timestamp">): PlaytestReport;
  endPlaytest(completed: boolean): PlaytestReport | null;
  undo(source?: "human" | "agent"): MutationResult;
  exportProject(): LevelDocument;
}
