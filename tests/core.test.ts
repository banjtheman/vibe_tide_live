import { describe, expect, it, vi } from "vitest";

import {
  LEVEL_CODEC_PREFIX,
  LevelCodecError,
  LevelStore,
  clusterDeaths,
  decodeLevel,
  encodeLevel,
  generateLevel,
  repairLevel,
  tryDecodeLevel,
  validateLevel,
  type LevelBlueprint,
  type LevelDocument,
  type PlaytestEvent,
  type StorageLike,
} from "../src/core";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function tickingClock(): () => string {
  let tick = 0;
  return () => {
    const timestamp = new Date(Date.UTC(2026, 7, 26, 12, 0, 0, tick));
    tick += 1;
    return timestamp.toISOString();
  };
}

const richBlueprint: LevelBlueprint = {
  name: "Glass current",
  description: "A deterministic test route.",
  width: 56,
  height: 20,
  difficulty: "tricky",
  primaryMechanic: "mixed",
  seed: 42,
  sections: [
    { kind: "run", length: 4 },
    { kind: "gap", length: 8, intensity: 3 },
    { kind: "stairs", length: 9, intensity: 2 },
    { kind: "ice", length: 8 },
    { kind: "spikes", length: 8, intensity: 3 },
    { kind: "water", length: 8, intensity: 2 },
    { kind: "finish", length: 1 },
  ],
};

describe("deterministic level generator", () => {
  it("produces byte-for-byte stable documents from the same blueprint", () => {
    const first = generateLevel(richBlueprint);
    const second = generateLevel({ ...richBlueprint, sections: richBlueprint.sections?.map((section) => ({ ...section })) });

    expect(second).toEqual(first);
    expect(first.id).toMatch(/^tide_[a-z0-9]+$/);
    expect(first.createdAt).toBe("1970-01-01T00:00:00.000Z");
    expect(validateLevel(first).valid).toBe(true);
  });

  it("honors every supported mechanic while staying conservatively reachable", () => {
    for (const primaryMechanic of ["platforming", "ice", "spikes", "water", "mixed"] as const) {
      for (const difficulty of ["beginner", "moderate", "tricky"] as const) {
        const level = generateLevel({
          name: `${primaryMechanic}-${difficulty}`,
          width: 48,
          height: 18,
          primaryMechanic,
          difficulty,
          seed: 9,
        });
        const report = validateLevel(level);
        expect(report.valid, `${primaryMechanic}/${difficulty}: ${JSON.stringify(report.issues)}`).toBe(true);
        expect(report.spawn?.x).toBeLessThan(report.goal?.x ?? 0);
      }
    }
  });

  it("clamps creation dimensions and normalizes oversized section totals", () => {
    const level = generateLevel({
      name: "Bounds",
      width: 999,
      height: 2,
      sections: [{ kind: "water", length: 9_999, intensity: 3 }],
    });

    expect(level.width).toBe(80);
    expect(level.height).toBe(10);
    expect(level.tiles).toHaveLength(10);
    expect(level.tiles.every((row) => row.length === 80)).toBe(true);
    expect(validateLevel(level).valid).toBe(true);
  });

  it("uses seed changes to vary decoration/layout without compromising validity", () => {
    const first = generateLevel({ ...richBlueprint, seed: 1 });
    const second = generateLevel({ ...richBlueprint, seed: 2 });

    expect(second.tiles).not.toEqual(first.tiles);
    expect(validateLevel(first).valid).toBe(true);
    expect(validateLevel(second).valid).toBe(true);
  });
});

describe("validation and conservative repair", () => {
  it("reports structural runtime corruption without throwing", () => {
    const ragged = generateLevel({ name: "Ragged" }) as LevelDocument;
    ragged.tiles[2] = [0, 1];
    (ragged.tiles[3] as unknown[])[4] = 99;

    const report = validateLevel(ragged);
    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain("ragged_grid");
    expect(report.issues.map((issue) => issue.code)).toContain("invalid_tile");
    expect(report.reachableCells).toBe(0);
  });

  it("detects a supported but isolated finish", () => {
    const level = generateLevel({ name: "Island", width: 32, height: 14 });
    const goal = validateLevel(level).goal;
    expect(goal).not.toBeNull();
    for (let x = 8; x <= 16; x += 1) {
      for (let y = 0; y < level.height; y += 1) {
        level.tiles[y]![x] = 0;
      }
    }

    const report = validateLevel(level);
    expect(report.valid).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "unreachable_goal" })]),
    );
  });

  it("repairs invalid tiles, missing endpoints, and reachability into a safe corridor", () => {
    const level = generateLevel({ name: "Repair me", width: 28, height: 12 });
    for (const row of level.tiles) {
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] === 3) {
          row[x] = 0;
        }
      }
    }
    level.tiles[0] = [99 as never];

    const repaired = repairLevel(level, { now: "2026-08-26T12:00:00.000Z" });
    expect(repaired.changed).toBe(true);
    expect(repaired.before.valid).toBe(false);
    expect(repaired.after.valid).toBe(true);
    expect(repaired.level.metadata).toEqual(level.metadata);
    expect(repaired.level.tiles.every((row) => row.length === repaired.level.width)).toBe(true);
    expect(repaired.level.updatedAt).toBe("2026-08-26T12:00:00.000Z");
  });

  it("understands slippery support and jumps over tile 5–7 hazards", () => {
    const level = generateLevel({ name: "Hazards", width: 20, height: 10 });
    const report = validateLevel(level);
    const y = report.spawn?.y ?? 6;
    for (let x = 0; x < level.width; x += 1) {
      level.tiles[y]![x] = 0;
      level.tiles[y + 1]![x] = 4;
    }
    const goalX = level.width - 2;
    level.tiles[y]![goalX] = 3;
    level.tiles[y]![5] = 5;
    level.tiles[y]![10] = 6;
    level.tiles[y]![15] = 7;

    expect(validateLevel(level).valid).toBe(true);
  });
});

describe("versioned URL-safe codec", () => {
  it("round-trips all document fields with compact URL-safe output", () => {
    const level = generateLevel(richBlueprint, { now: "2026-08-26T12:00:00.000Z" });
    const encoded = encodeLevel(level);

    expect(encoded.startsWith(LEVEL_CODEC_PREFIX)).toBe(true);
    expect(encoded).toMatch(/^vt1\.[A-Za-z0-9_-]+$/);
    expect(decodeLevel(encoded)).toEqual(level);
    expect(decodeLevel(`https://example.test/play?level=${encoded}`)).toEqual(level);
    expect(decodeLevel(`https://example.test/play#level=${encoded}`)).toEqual(level);
  });

  it("rejects corrupt data and unsupported versions with useful failures", () => {
    expect(() => decodeLevel("vt2.AAAA")).toThrow(/version 2/i);
    expect(() => decodeLevel("vt1.%%%")) .toThrow(LevelCodecError);
    expect(tryDecodeLevel("not-a-level")).toEqual({
      ok: false,
      error: expect.stringContaining("vt1."),
    });
  });

  it("refuses to encode malformed grids", () => {
    const level = generateLevel({ name: "Bad export" });
    level.tiles.pop();
    expect(() => encodeLevel(level)).toThrow(/structurally invalid/i);
  });
});

describe("LevelStore transactions, history, and persistence", () => {
  it("publishes deeply frozen replacement snapshots and supports unsubscribe", () => {
    const store = new LevelStore({ storage: null, now: tickingClock() });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.getSnapshot();
    expect(Object.isFrozen(before)).toBe(true);
    expect(Object.isFrozen(before.level.tiles[0])).toBe(true);
    expect(() => {
      before.level.tiles[0]![0] = 7;
    }).toThrow();

    const result = store.setMetadata({ name: "Subscriber test" });
    expect(result.ok).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toBe(store.getSnapshot());
    expect(store.getSnapshot()).not.toBe(before);

    unsubscribe();
    store.setMetadata({ description: "No second callback" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("rejects a mixed valid/invalid patch atomically", () => {
    const store = new LevelStore({ storage: null, now: tickingClock() });
    const before = store.exportProject();
    const result = store.applyPatch(
      [
        { kind: "set_tile", x: 2, y: 2, tile: 6 },
        { kind: "clear_rect", x: -1, y: 0, width: 2, height: 2 },
      ],
      "This whole transaction should fail",
    );

    expect(result.ok).toBe(false);
    expect(store.exportProject()).toEqual(before);
    expect(store.getSnapshot().canUndo).toBe(false);
  });

  it("enforces operation/cell budgets before mutation", () => {
    const store = new LevelStore({
      storage: null,
      now: tickingClock(),
      maxPatchOperations: 2,
      maxPatchCells: 3,
    });
    const before = store.exportProject();

    expect(
      store.applyPatch(
        [
          { kind: "set_tile", x: 0, y: 0, tile: 1 },
          { kind: "set_tile", x: 1, y: 0, tile: 1 },
          { kind: "set_tile", x: 2, y: 0, tile: 1 },
        ],
        "Too many ops",
      ).ok,
    ).toBe(false);
    expect(
      store.applyPatch([{ kind: "fill_rect", x: 0, y: 0, width: 2, height: 2, tile: 1 }], "Too many cells").ok,
    ).toBe(false);
    expect(store.exportProject()).toEqual(before);
  });

  it("commits multiple operations once, returns exact bounds, and keeps revisions monotonic through undo", () => {
    const store = new LevelStore({ storage: null, now: tickingClock() });
    const initialRevision = store.getSnapshot().level.revision;
    const edited = store.applyPatch(
      [
        { kind: "fill_rect", x: 2, y: 1, width: 2, height: 2, tile: 6 },
        { kind: "platform", x: 8, y: 3, length: 3, tile: 4 },
      ],
      "Add a glass hazard beat",
      "agent",
    );

    expect(edited.ok).toBe(true);
    expect(edited.revision).toBe(initialRevision + 1);
    expect(edited.changedBounds).toEqual({ x: 2, y: 1, width: 9, height: 3 });
    expect(store.getSnapshot().canUndo).toBe(true);

    const undone = store.undo();
    expect(undone.ok).toBe(true);
    expect(undone.revision).toBe(initialRevision + 2);
    expect(store.getSnapshot().level.revision).toBe(initialRevision + 2);
    expect(store.getSnapshot().canUndo).toBe(false);
  });

  it("bounds history and metadata/activity text", () => {
    const store = new LevelStore({ storage: null, now: tickingClock(), historyLimit: 2, activityLimit: 2 });
    store.setMetadata({ name: "One" }, "human");
    store.setMetadata({ name: "Two" }, "agent");
    store.setMetadata({ name: "Three" }, "human");

    expect(store.getSnapshot().level.metadata.author).toBe("human+agent");
    expect(store.getSnapshot().activity).toHaveLength(2);
    expect(store.undo().ok).toBe(true);
    expect(store.undo().ok).toBe(true);
    expect(store.undo().ok).toBe(false);
  });

  it("persists the level, history, activity, and last playtest when storage is available", () => {
    const storage = new MemoryStorage();
    const first = new LevelStore({ storage, now: tickingClock() });
    first.setMetadata({ name: "Saved current" });
    first.beginPlaytest();
    first.recordPlaytestEvent({ type: "death", position: { x: 4, y: 5 }, elapsedMs: 900, deaths: 1 });
    first.endPlaytest(false);

    const restored = new LevelStore({ storage, now: tickingClock() });
    expect(restored.exportProject()).toEqual(first.exportProject());
    expect(restored.getSnapshot().canUndo).toBe(true);
    expect(restored.getSnapshot().lastPlaytest?.deaths).toBe(1);
    expect(restored.getSnapshot().activity).toEqual(first.getSnapshot().activity);
  });

  it("ignores corrupt persistence and remains usable", () => {
    const storage = new MemoryStorage();
    storage.setItem("vibe-tide-live:studio:v1", "{bad json");
    const store = new LevelStore({ storage, now: tickingClock() });
    expect(store.getSnapshot().validation.valid).toBe(true);
    expect(store.setMetadata({ name: "Recovered" }).ok).toBe(true);
  });

  it("creates normalized playable levels and clears project history", () => {
    const store = new LevelStore({ storage: null, now: tickingClock() });
    store.setMetadata({ name: "Old work" });
    const created = store.createLevel({
      name: "Agent beach",
      width: 200,
      height: 4,
      sections: [{ kind: "spikes", length: 500, intensity: 3 }],
    }, "agent");

    expect(created.ok).toBe(true);
    expect(created.validation.valid).toBe(true);
    expect(store.getSnapshot().level.width).toBe(80);
    expect(store.getSnapshot().level.height).toBe(10);
    expect(store.getSnapshot().canUndo).toBe(false);
    expect(store.getSnapshot().level.metadata.author).toBe("agent");
  });
});

describe("playtest telemetry", () => {
  it("clusters connected death locations with stable weighted centers", () => {
    const base = {
      elapsedMs: 100,
      deaths: 1,
      revision: 1,
      timestamp: "2026-08-26T12:00:00.000Z",
    };
    const events: PlaytestEvent[] = [
      { ...base, type: "death", position: { x: 4, y: 5 } },
      { ...base, type: "death", position: { x: 5, y: 5 } },
      { ...base, type: "death", position: { x: 6, y: 5 } },
      { ...base, type: "death", position: { x: 20, y: 2 } },
    ];

    expect(clusterDeaths(events, 1)).toEqual([
      { center: { x: 5, y: 5 }, count: 3 },
      { center: { x: 20, y: 2 }, count: 1 },
    ]);
  });

  it("tracks start, cumulative deaths, completion, elapsed time, and final clusters", () => {
    const store = new LevelStore({ storage: null, now: tickingClock() });
    const started = store.beginPlaytest();
    expect(started.events[0]?.type).toBe("start");
    expect(store.getSnapshot().mode).toBe("play");

    store.recordPlaytestEvent({ type: "death", position: { x: 5, y: 6 }, elapsedMs: 500, deaths: 0 });
    store.recordPlaytestEvent({ type: "death", position: { x: 6, y: 6 }, elapsedMs: 900, deaths: 1 });
    store.recordPlaytestEvent({ type: "death", position: { x: 22, y: 6 }, elapsedMs: 1_200, deaths: 2 });
    const active = store.recordPlaytestEvent({
      type: "complete",
      position: { x: 999, y: -20 },
      elapsedMs: 2_400,
      deaths: 3,
    });

    expect(active.deaths).toBe(3);
    expect(active.completed).toBe(true);
    expect(active.deathClusters.map((cluster) => cluster.count)).toEqual([2, 1]);
    expect(active.events.at(-1)?.position.x).toBe(store.getSnapshot().level.width - 1);
    expect(active.events.at(-1)?.position.y).toBe(0);

    const ended = store.endPlaytest(false);
    expect(ended?.completed).toBe(true);
    expect(ended?.elapsedMs).toBe(2_400);
    expect(ended?.endedAt).not.toBeNull();
    expect(store.getSnapshot().activePlaytest).toBeNull();
    expect(store.getSnapshot().lastPlaytest).toEqual(ended);
    expect(store.getSnapshot().mode).toBe("edit");
  });

  it("requires an active playtest before accepting events", () => {
    const store = new LevelStore({ storage: null });
    expect(() =>
      store.recordPlaytestEvent({
        type: "death",
        position: { x: 0, y: 0 },
        elapsedMs: 0,
        deaths: 0,
      }),
    ).toThrow(/begin a playtest/i);
  });
});
