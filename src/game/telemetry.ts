import type { GridPoint, PlaytestEvent, StudioStore } from "../core/contracts";

export class PlaytestTelemetry {
  private active = false;
  private startedAt = 0;
  private deaths = 0;
  private revision = 0;
  private lastPosition: GridPoint = { x: 0, y: 0 };

  constructor(private readonly store: StudioStore) {}

  start(position: GridPoint, revision: number): void {
    if (this.active) {
      this.quit(this.lastPosition);
    }

    this.active = true;
    this.startedAt = monotonicNow();
    this.deaths = 0;
    this.revision = revision;
    this.lastPosition = position;

    this.callStore(() => this.store.beginPlaytest());
    this.record("start", position);
  }

  death(position: GridPoint): void {
    if (!this.active) {
      return;
    }

    this.deaths += 1;
    this.lastPosition = position;
    this.record("death", position);
  }

  complete(position: GridPoint): void {
    if (!this.active) {
      return;
    }

    this.lastPosition = position;
    this.record("complete", position);
    this.active = false;
    this.callStore(() => this.store.endPlaytest(true));
  }

  quit(position: GridPoint): void {
    if (!this.active) {
      return;
    }

    this.lastPosition = position;
    this.record("quit", position);
    this.active = false;
    this.callStore(() => this.store.endPlaytest(false));
  }

  private record(type: PlaytestEvent["type"], position: GridPoint): void {
    const event: Omit<PlaytestEvent, "revision" | "timestamp"> = {
      type,
      position,
      elapsedMs: Math.max(0, Math.round(monotonicNow() - this.startedAt)),
      deaths: this.deaths,
    };

    this.callStore(() => this.store.recordPlaytestEvent(event));
  }

  private callStore(operation: () => unknown): void {
    try {
      operation();
    } catch (error: unknown) {
      // Gameplay should remain available if an analytics adapter is temporarily
      // unavailable. The store remains the sole telemetry destination.
      console.warn(`VibeTide playtest telemetry failed at revision ${this.revision}.`, error);
    }
  }
}

function monotonicNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}
