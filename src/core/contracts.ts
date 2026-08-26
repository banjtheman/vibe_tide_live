import type { BackgroundId } from "./backgrounds";

export const LEVEL_SCHEMA_VERSION = 1 as const;

export const TILE_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type TileId = (typeof TILE_IDS)[number];

export const TILE_DEFINITIONS = {
  0: {
    name: "air",
    behavior: "empty",
    category: "Eraser",
    description: "Erase a piece and leave open space for jumps and movement.",
  },
  1: {
    name: "dune grass",
    behavior: "solid",
    category: "Solid ground",
    description: "Safe, solid ground the otter can run and jump on.",
  },
  2: {
    name: "reef rock",
    behavior: "solid",
    category: "Solid block",
    description: "A sturdy block for building walls, floors, and platforms.",
  },
  3: {
    name: "finish buoy",
    behavior: "goal",
    category: "Goal",
    description: "Reach this buoy to finish the level.",
  },
  4: {
    name: "sea glass",
    behavior: "slippery",
    category: "Slippery ground",
    description: "Solid ground that makes stopping and turning harder.",
  },
  5: {
    name: "hot vent",
    behavior: "hazard",
    category: "Hazard",
    description: "Touching this dangerous vent sends the otter back to the start.",
  },
  6: {
    name: "coral spikes",
    behavior: "hazard",
    category: "Hazard",
    description: "Sharp coral that sends the otter back to the start on contact.",
  },
  7: {
    name: "deep water",
    behavior: "hazard",
    category: "Hazard",
    description: "Falling into deep water sends the otter back to the start.",
  },
  8: {
    name: "reef crawler",
    behavior: "enemy",
    category: "Ground enemy",
    description: "Patrols its platform. Land on it to defeat it.",
  },
  9: {
    name: "swell-wing",
    behavior: "enemy",
    category: "Flying enemy",
    description: "Glides through the air. Land on it to defeat it.",
  },
  10: {
    name: "tide-spitter",
    behavior: "enemy",
    category: "Ranged enemy",
    description: "Fires tide pearls toward the otter. Land on it to defeat it.",
  },
} as const satisfies Record<
  TileId,
  { name: string; behavior: string; category: string; description: string }
>;

export type Difficulty = "beginner" | "moderate" | "tricky";
export type PrimaryMechanic = "platforming" | "ice" | "spikes" | "water" | "mixed";

export interface LevelMetadata {
  name: string;
  description: string;
  difficulty: Difficulty;
  primaryMechanic: PrimaryMechanic;
  background: BackgroundId;
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
  background?: BackgroundId;
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
  setBackground(background: BackgroundId, source?: "human" | "agent"): MutationResult;
  setMode(mode: StudioMode, source?: "human" | "agent"): StudioSnapshot;
  beginPlaytest(): PlaytestReport;
  recordPlaytestEvent(event: Omit<PlaytestEvent, "revision" | "timestamp">): PlaytestReport;
  endPlaytest(completed: boolean): PlaytestReport | null;
  undo(source?: "human" | "agent"): MutationResult;
  exportProject(): LevelDocument;
}
