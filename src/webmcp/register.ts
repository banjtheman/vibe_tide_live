import type {
  LevelDocument,
  MutationResult,
  PlaytestReport,
  StudioSnapshot,
  StudioStore,
  ValidationReport,
} from "../core/contracts";
import {
  APPLY_PATCH_SCHEMA,
  CREATE_LEVEL_SCHEMA,
  EMPTY_INPUT_SCHEMA,
  RESIZE_LEVEL_SCHEMA,
  SET_BACKGROUND_SCHEMA,
  SET_METADATA_SCHEMA,
} from "./schemas";
import type {
  VibeTideToolsRegistration,
  VibeTideWebMCPCallbacks,
  WebMCPExecuteOptions,
  WebMCPModelContext,
  WebMCPTool,
} from "./types";
import {
  parseBlueprint,
  parseBackground,
  parseEmptyInput,
  parseMetadata,
  parsePatch,
  parseResizeLevel,
} from "./validation";

export const VIBE_TIDE_TOOL_NAMES = [
  "inspect_level",
  "create_level_from_blueprint",
  "resize_level",
  "apply_level_patch",
  "set_level_metadata",
  "set_level_background",
  "validate_level",
  "get_playtest_report",
  "start_playtest",
  "undo_last_change",
  "create_share_link",
] as const;

export type VibeTideToolName = (typeof VIBE_TIDE_TOOL_NAMES)[number];

type DocumentWithModelContext = Document & { modelContext?: WebMCPModelContext };

function activeModelContext(): WebMCPModelContext | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  return (document as DocumentWithModelContext).modelContext;
}

const NEVER_ABORTED_SIGNAL = new AbortController().signal;

function assertNotAborted(options?: WebMCPExecuteOptions): void {
  options?.signal?.throwIfAborted();
}

function callbackOptions(options?: WebMCPExecuteOptions): WebMCPExecuteOptions {
  return { signal: options?.signal ?? NEVER_ABORTED_SIGNAL };
}

function compactValidation(report: ValidationReport): object {
  return {
    valid: report.valid,
    spawn: report.spawn,
    goal: report.goal,
    reachable_cells: report.reachableCells,
    issues: report.issues.map(({ code, message, location, severity }) => ({
      code,
      severity,
      message,
      ...(location === undefined ? {} : { location }),
    })),
  };
}

function inspectResult(snapshot: StudioSnapshot): string {
  const level = snapshot.level;
  return JSON.stringify({
    id: level.id,
    revision: level.revision,
    size: { width: level.width, height: level.height },
    metadata: level.metadata,
    mode: snapshot.mode,
    can_undo: snapshot.canUndo,
    validation: compactValidation(snapshot.validation),
    tile_rows_top_to_bottom: level.tiles.map((row) => [...row]),
  });
}

function mutationResult(action: string, result: MutationResult): string {
  const validation = result.validation.valid
    ? "valid"
    : `${result.validation.issues.length} validation issue(s)`;
  return `${result.ok ? action : `${action} failed`}: ${result.summary} Revision ${result.revision}; ${validation}.`;
}

function validationResult(report: ValidationReport): string {
  return JSON.stringify(compactValidation(report));
}

function playtestResult(report: PlaytestReport | null): string {
  if (report === null) {
    return "No playtest report is available yet.";
  }
  return JSON.stringify({
    level_id: report.levelId,
    revision: report.revision,
    started_at: report.startedAt,
    ended_at: report.endedAt,
    completed: report.completed,
    elapsed_ms: report.elapsedMs,
    deaths: report.deaths,
    death_clusters: report.deathClusters,
    recent_events: report.events.slice(-12),
  });
}

function makeTools(
  store: StudioStore,
  callbacks: VibeTideWebMCPCallbacks,
): readonly WebMCPTool[] {
  return [
    {
      name: "inspect_level",
      title: "Inspect VibeTide level",
      description:
        "Read the current level grid, metadata, revision, mode, and validation state. Tile rows are top-to-bottom integer arrays using tile IDs 0 through 10; 8 places a reef crawler, 9 a flying swell-wing, and 10 a ranged tide-spitter.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input, options) => {
        parseEmptyInput(input, "inspect_level");
        assertNotAborted(options);
        return inspectResult(store.getSnapshot());
      },
    },
    {
      name: "create_level_from_blueprint",
      title: "Create VibeTide level",
      description:
        "Replace the current level with a deterministic playable level built from a name, difficulty, mechanic, background, seed, and optional ordered sections.",
      inputSchema: CREATE_LEVEL_SCHEMA,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, options) => {
        const blueprint = parseBlueprint(input);
        assertNotAborted(options);
        return mutationResult("Created level", store.createLevel(blueprint, "agent"));
      },
    },
    {
      name: "resize_level",
      title: "Resize VibeTide level",
      description:
        "Change the current level length, height, or both. The left edge and seafloor stay anchored; added space opens on the right or above, while shorter dimensions trim the far right or sky. A finish pinned to the far edge follows a longer course, and the complete change can be undone once.",
      inputSchema: RESIZE_LEVEL_SCHEMA,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, options) => {
        const dimensions = parseResizeLevel(input);
        assertNotAborted(options);
        const level = store.getSnapshot().level;
        return mutationResult(
          "Resized level",
          store.resizeLevel(
            dimensions.width ?? level.width,
            dimensions.height ?? level.height,
            "agent",
          ),
        );
      },
    },
    {
      name: "apply_level_patch",
      title: "Patch VibeTide level",
      description:
        "Apply one atomic batch of bounded tile, rectangle, platform, or goal edits to the current level. Coordinates use x from the left and y from the top.",
      inputSchema: APPLY_PATCH_SCHEMA,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, options) => {
        const snapshot = store.getSnapshot();
        const { operations, reason } = parsePatch(
          input,
          snapshot.level.width,
          snapshot.level.height,
        );
        assertNotAborted(options);
        return mutationResult("Applied patch", store.applyPatch(operations, reason, "agent"));
      },
    },
    {
      name: "set_level_metadata",
      title: "Set level metadata",
      description:
        "Update one or more player-facing metadata fields on the current level without changing its tiles.",
      inputSchema: SET_METADATA_SCHEMA,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, options) => {
        const changes = parseMetadata(input);
        assertNotAborted(options);
        return mutationResult("Updated metadata", store.setMetadata(changes, "agent"));
      },
    },
    {
      name: "set_level_background",
      title: "Set level background",
      description:
        "Change the current level's visual backdrop without changing its tiles. Choose one of: golden-coast, neon-moonwave, bioluminescent-grotto, stormglass-reef, moonlit-lagoon, aurora-current, sunken-temple, kelp-cathedral, starlight-tidepool, or festival-shore.",
      inputSchema: SET_BACKGROUND_SCHEMA,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, options) => {
        const background = parseBackground(input);
        assertNotAborted(options);
        return mutationResult("Changed background", store.setBackground(background, "agent"));
      },
    },
    {
      name: "validate_level",
      title: "Validate VibeTide level",
      description:
        "Read the current level's spawn, goal, reachability, and structural validation report without changing state.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input, options) => {
        parseEmptyInput(input, "validate_level");
        assertNotAborted(options);
        return validationResult(store.getSnapshot().validation);
      },
    },
    {
      name: "get_playtest_report",
      title: "Get playtest report",
      description:
        "Read the active or most recent playtest summary, including completion, deaths, death clusters, and recent events.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input, options) => {
        parseEmptyInput(input, "get_playtest_report");
        assertNotAborted(options);
        const snapshot = store.getSnapshot();
        return playtestResult(snapshot.activePlaytest ?? snapshot.lastPlaytest);
      },
    },
    {
      name: "start_playtest",
      title: "Start playtest",
      description:
        "Enter play mode and start telemetry for the current revision. The level must pass validation first.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, options) => {
        parseEmptyInput(input, "start_playtest");
        assertNotAborted(options);
        const snapshot = store.getSnapshot();
        if (!snapshot.validation.valid) {
          return `Playtest not started: fix ${snapshot.validation.issues.length} validation issue(s) first.`;
        }
        store.setMode("play", "agent");
        const report = store.beginPlaytest();
        await callbacks.onStartPlaytest?.(report, callbackOptions(options));
        assertNotAborted(options);
        return `Playtest started for level ${report.levelId} revision ${report.revision}.`;
      },
    },
    {
      name: "undo_last_change",
      title: "Undo last level change",
      description:
        "Undo the most recent reversible level or metadata mutation and return the restored revision and validation state.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, options) => {
        parseEmptyInput(input, "undo_last_change");
        assertNotAborted(options);
        return mutationResult("Undo", store.undo("agent"));
      },
    },
    {
      name: "create_share_link",
      title: "Create level share link",
      description:
        "Create a self-contained public URL that opens the current level revision directly in Play mode.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, options) => {
        parseEmptyInput(input, "create_share_link");
        assertNotAborted(options);
        if (callbacks.createShareLink === undefined) {
          return "Share link unavailable: the host has not configured a canonical share-link callback.";
        }
        const level: LevelDocument = store.exportProject();
        const link = (await callbacks.createShareLink(level, callbackOptions(options))).trim();
        assertNotAborted(options);
        if (link.length === 0) {
          throw new Error("The share-link callback returned an empty URL.");
        }
        return `Share link for revision ${level.revision}: ${link}`;
      },
    },
  ];
}

/**
 * Registers VibeTide's live page tools on the current document.modelContext.
 * Abort-driven teardown follows the 26 August 2026 WebMCP draft.
 */
export async function registerVibeTideTools(
  store: StudioStore,
  callbacks: VibeTideWebMCPCallbacks = {},
): Promise<VibeTideToolsRegistration> {
  const controller = new AbortController();
  const modelContext = activeModelContext();
  const registeredTools: string[] = [];
  const destroy = (): void => controller.abort();

  if (modelContext === undefined) {
    return {
      supported: false,
      registeredTools,
      signal: controller.signal,
      destroy,
      unregister: destroy,
    };
  }

  try {
    for (const tool of makeTools(store, callbacks)) {
      await modelContext.registerTool(tool, { signal: controller.signal });
      registeredTools.push(tool.name);
    }
  } catch (error) {
    controller.abort();
    throw error;
  }

  return {
    supported: true,
    registeredTools,
    signal: controller.signal,
    destroy,
    unregister: destroy,
  };
}
