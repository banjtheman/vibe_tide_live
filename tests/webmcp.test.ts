import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryModelContext,
  registerVibeTideTools,
  VIBE_TIDE_TOOL_NAMES,
  WebMCPInputError,
  type WebMCPModelContext,
} from "../src/webmcp";
import type {
  LevelBlueprint,
  LevelDocument,
  LevelMetadata,
  LevelPatchOperation,
  MutationResult,
  PlaytestEvent,
  PlaytestReport,
  StudioMode,
  StudioSnapshot,
  StudioStore,
} from "../src/core/contracts";

const validReport = {
  valid: true,
  issues: [],
  spawn: { x: 1, y: 2 },
  goal: { x: 4, y: 2 },
  reachableCells: 12,
} as const;

function initialLevel(): LevelDocument {
  return {
    schemaVersion: 1,
    id: "level-test",
    revision: 3,
    width: 6,
    height: 4,
    tiles: [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 3, 0],
      [1, 1, 1, 1, 1, 1],
    ],
    metadata: {
      name: "Test Tide",
      description: "A small test level.",
      difficulty: "beginner",
      primaryMechanic: "platforming",
      author: "human",
    },
    createdAt: "2026-08-26T12:00:00.000Z",
    updatedAt: "2026-08-26T12:00:00.000Z",
  };
}

function playtest(): PlaytestReport {
  return {
    levelId: "level-test",
    revision: 3,
    startedAt: "2026-08-26T12:01:00.000Z",
    endedAt: null,
    completed: false,
    elapsedMs: 0,
    deaths: 0,
    events: [],
    deathClusters: [],
  };
}

class StoreDouble implements StudioStore {
  snapshot: StudioSnapshot = {
    level: initialLevel(),
    mode: "edit",
    validation: { ...validReport, issues: [] },
    activePlaytest: null,
    lastPlaytest: null,
    activity: [],
    canUndo: true,
  };

  lastBlueprint: LevelBlueprint | null = null;
  lastPatch: { operations: LevelPatchOperation[]; reason: string } | null = null;
  lastMetadata: Partial<LevelMetadata> | null = null;
  lastSource: "human" | "agent" | null = null;

  getSnapshot(): StudioSnapshot {
    return this.snapshot;
  }

  subscribe(): () => void {
    return () => undefined;
  }

  createLevel(blueprint: LevelBlueprint, source: "human" | "agent" = "human"): MutationResult {
    this.lastBlueprint = blueprint;
    this.lastSource = source;
    return this.result("blueprint accepted");
  }

  applyPatch(
    operations: LevelPatchOperation[],
    reason: string,
    source: "human" | "agent" = "human",
  ): MutationResult {
    this.lastPatch = { operations, reason };
    this.lastSource = source;
    return this.result("patch accepted");
  }

  setMetadata(
    changes: Partial<Pick<LevelMetadata, "name" | "description" | "difficulty" | "primaryMechanic">>,
    source: "human" | "agent" = "human",
  ): MutationResult {
    this.lastMetadata = changes;
    this.lastSource = source;
    return this.result("metadata accepted");
  }

  setMode(mode: StudioMode, source: "human" | "agent" = "human"): StudioSnapshot {
    this.snapshot = { ...this.snapshot, mode };
    this.lastSource = source;
    return this.snapshot;
  }

  beginPlaytest(): PlaytestReport {
    const report = playtest();
    this.snapshot = { ...this.snapshot, activePlaytest: report };
    return report;
  }

  recordPlaytestEvent(
    _event: Omit<PlaytestEvent, "revision" | "timestamp">,
  ): PlaytestReport {
    return this.snapshot.activePlaytest ?? playtest();
  }

  endPlaytest(completed: boolean): PlaytestReport | null {
    const current = this.snapshot.activePlaytest;
    if (current === null) {
      return null;
    }
    const ended = { ...current, completed, endedAt: "2026-08-26T12:02:00.000Z" };
    this.snapshot = { ...this.snapshot, activePlaytest: null, lastPlaytest: ended };
    return ended;
  }

  undo(source: "human" | "agent" = "human"): MutationResult {
    this.lastSource = source;
    return this.result("change undone");
  }

  exportProject(): LevelDocument {
    return this.snapshot.level;
  }

  private result(summary: string): MutationResult {
    return {
      ok: true,
      revision: this.snapshot.level.revision + 1,
      summary,
      changedBounds: null,
      validation: this.snapshot.validation,
    };
  }
}

function installModelContext(modelContext?: WebMCPModelContext): void {
  Object.defineProperty(globalThis, "document", {
    value: { modelContext },
    configurable: true,
    writable: true,
  });
}

describe("registerVibeTideTools", () => {
  beforeEach(() => {
    installModelContext();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
  });

  it("registers the nine standard tools and unregisters all of them via AbortSignal", async () => {
    const modelContext = new InMemoryModelContext();
    installModelContext(modelContext);

    const registration = await registerVibeTideTools(new StoreDouble());

    expect(registration.supported).toBe(true);
    expect(registration.registeredTools).toEqual(VIBE_TIDE_TOOL_NAMES);
    expect([...modelContext.tools.keys()]).toEqual(VIBE_TIDE_TOOL_NAMES);
    expect(modelContext.tools.get("inspect_level")?.annotations?.readOnlyHint).toBe(true);
    expect(modelContext.tools.get("validate_level")?.annotations?.readOnlyHint).toBe(true);
    expect(modelContext.tools.get("get_playtest_report")?.annotations?.readOnlyHint).toBe(true);
    expect(modelContext.tools.get("apply_level_patch")?.annotations?.readOnlyHint).toBe(false);
    expect(modelContext.tools.get("create_share_link")?.annotations?.readOnlyHint).toBe(false);

    registration.unregister();
    registration.destroy();

    expect(registration.signal.aborted).toBe(true);
    expect(modelContext.tools.size).toBe(0);
  });

  it("returns a safe no-op registration when WebMCP is unavailable", async () => {
    const registration = await registerVibeTideTools(new StoreDouble());

    expect(registration.supported).toBe(false);
    expect(registration.registeredTools).toEqual([]);
    registration.destroy();
    expect(registration.signal.aborted).toBe(true);
  });

  it("returns a compact level snapshot and rejects undeclared fields at runtime", async () => {
    const modelContext = new InMemoryModelContext();
    installModelContext(modelContext);
    await registerVibeTideTools(new StoreDouble());

    const output = JSON.parse(await modelContext.invoke("inspect_level")) as Record<string, unknown>;
    expect(output.revision).toBe(3);
    expect(output.tile_rows_top_to_bottom).toEqual([
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 3, 0],
      [1, 1, 1, 1, 1, 1],
    ]);
    await expect(modelContext.invoke("inspect_level", { surprise: true })).rejects.toBeInstanceOf(
      WebMCPInputError,
    );
  });

  it("accepts early hosts that omit execution options", async () => {
    const modelContext = new InMemoryModelContext();
    installModelContext(modelContext);
    await registerVibeTideTools(new StoreDouble());

    const inspectTool = modelContext.tools.get("inspect_level");
    expect(inspectTool).toBeDefined();
    const output = JSON.parse(await inspectTool!.execute({})) as { revision: number };
    expect(output.revision).toBe(3);
  });

  it("validates and translates a blueprint before invoking the store as agent", async () => {
    const store = new StoreDouble();
    const modelContext = new InMemoryModelContext();
    installModelContext(modelContext);
    await registerVibeTideTools(store);

    const output = await modelContext.invoke("create_level_from_blueprint", {
      name: "  Glass Current  ",
      width: 48,
      height: 18,
      difficulty: "tricky",
      primary_mechanic: "ice",
      seed: 42,
      sections: [{ kind: "ice", length: 8, intensity: 2 }],
    });

    expect(store.lastSource).toBe("agent");
    expect(store.lastBlueprint).toEqual({
      name: "Glass Current",
      width: 48,
      height: 18,
      difficulty: "tricky",
      primaryMechanic: "ice",
      seed: 42,
      sections: [{ kind: "ice", length: 8, intensity: 2 }],
    });
    expect(output).toContain("Created level");
    await expect(
      modelContext.invoke("create_level_from_blueprint", { name: "Too wide", width: 81 }),
    ).rejects.toThrow("width must be an integer from 20 to 80");
  });

  it("validates patch bounds and sends one atomic operation batch", async () => {
    const store = new StoreDouble();
    const modelContext = new InMemoryModelContext();
    installModelContext(modelContext);
    await registerVibeTideTools(store);

    await modelContext.invoke("apply_level_patch", {
      operations: [
        { kind: "set_tile", x: 2, y: 1, tile: 4 },
        { kind: "set_tile", x: 4, y: 1, tile: 10 },
        { kind: "platform", x: 1, y: 2, length: 4, tile: 2 },
      ],
      reason: "Ease the central jump",
    });

    expect(store.lastPatch).toEqual({
      operations: [
        { kind: "set_tile", x: 2, y: 1, tile: 4 },
        { kind: "set_tile", x: 4, y: 1, tile: 10 },
        { kind: "platform", x: 1, y: 2, length: 4, tile: 2 },
      ],
      reason: "Ease the central jump",
    });
    expect(store.lastSource).toBe("agent");
    await expect(
      modelContext.invoke("apply_level_patch", {
        operations: [{ kind: "fill_rect", x: 5, y: 0, width: 2, height: 1, tile: 1 }],
        reason: "Outside the grid",
      }),
    ).rejects.toThrow("operations[0].width must be an integer from 1 to 1");
  });

  it("translates metadata names and exposes validation without mutation", async () => {
    const store = new StoreDouble();
    const modelContext = new InMemoryModelContext();
    installModelContext(modelContext);
    await registerVibeTideTools(store);

    await modelContext.invoke("set_level_metadata", {
      name: " Moonwake ",
      primary_mechanic: "water",
    });
    const validation = JSON.parse(await modelContext.invoke("validate_level")) as {
      valid: boolean;
    };

    expect(store.lastMetadata).toEqual({ name: "Moonwake", primaryMechanic: "water" });
    expect(validation.valid).toBe(true);
    await expect(modelContext.invoke("set_level_metadata", {})).rejects.toThrow(
      "provide at least one metadata field",
    );
  });

  it("starts valid playtests, reports telemetry, and honors execution cancellation", async () => {
    const store = new StoreDouble();
    const onStartPlaytest = vi.fn(async () => undefined);
    const modelContext = new InMemoryModelContext();
    installModelContext(modelContext);
    await registerVibeTideTools(store, { onStartPlaytest });

    const started = await modelContext.invoke("start_playtest");
    const report = JSON.parse(await modelContext.invoke("get_playtest_report")) as {
      revision: number;
    };

    expect(started).toContain("Playtest started");
    expect(store.snapshot.mode).toBe("play");
    expect(onStartPlaytest).toHaveBeenCalledOnce();
    expect(report.revision).toBe(3);

    const controller = new AbortController();
    controller.abort();
    await expect(modelContext.invoke("undo_last_change", {}, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("does not enter play mode when validation fails", async () => {
    const store = new StoreDouble();
    store.snapshot = {
      ...store.snapshot,
      validation: {
        ...store.snapshot.validation,
        valid: false,
        issues: [
          {
            code: "missing_goal",
            message: "Add a finish buoy.",
            severity: "error",
          },
        ],
      },
    };
    const modelContext = new InMemoryModelContext();
    installModelContext(modelContext);
    await registerVibeTideTools(store);

    expect(await modelContext.invoke("start_playtest")).toContain("not started");
    expect(store.snapshot.mode).toBe("edit");
  });

  it("uses the host's canonical share callback and clearly reports when absent", async () => {
    const store = new StoreDouble();
    const modelContext = new InMemoryModelContext();
    const createShareLink = vi.fn(async () => "https://vibetide.test/l/abc123");
    installModelContext(modelContext);
    await registerVibeTideTools(store, { createShareLink });

    expect(await modelContext.invoke("create_share_link")).toBe(
      "Share link for revision 3: https://vibetide.test/l/abc123",
    );
    expect(createShareLink).toHaveBeenCalledWith(store.snapshot.level, {
      signal: expect.any(AbortSignal),
    });

    const secondContext = new InMemoryModelContext();
    installModelContext(secondContext);
    await registerVibeTideTools(store);
    expect(await secondContext.invoke("create_share_link")).toContain("Share link unavailable");
  });
});
