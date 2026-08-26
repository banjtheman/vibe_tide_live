import Phaser from "phaser";

import type { StudioStore } from "../core/contracts";
import { VIBE_TIDE_SCENE_KEY, VibeTideScene } from "./VibeTideScene";
import { SharedControlState } from "./input";
import type { VibeTideControl, VibeTideControlState } from "./input";
import { PlaytestTelemetry } from "./telemetry";

export interface VibeTideGameController {
  destroy(): void;
  restart(): void;
  focus(): void;
  setControl(control: VibeTideControl, pressed: boolean): void;
  setControls(controls: Partial<VibeTideControlState>): void;
  jump(): void;
}

export function mountVibeTideGame(
  container: HTMLElement,
  store: StudioStore,
): VibeTideGameController {
  const controls = new SharedControlState();
  const telemetry = new PlaytestTelemetry(store);
  let destroyed = false;
  let observedSnapshot = store.getSnapshot();

  const scene = new VibeTideScene(
    {
      readSnapshot: () => store.getSnapshot(),
      onPlayStarted: (position, revision) => telemetry.start(position, revision),
      onPlayerDeath: (position) => telemetry.death(position),
      onLevelComplete: (position) => telemetry.complete(position),
    },
    controls,
  );

  const initialSize = measureContainer(container);
  const game = new Phaser.Game({
    // Canvas is the most reliable renderer inside embedded agent browsers and
    // keeps the same deterministic 2D presentation across WebMCP hosts.
    type: Phaser.CANVAS,
    parent: container,
    width: initialSize.width,
    height: initialSize.height,
    backgroundColor: "#78cbd0",
    transparent: false,
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: initialSize.width,
      height: initialSize.height,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    input: {
      keyboard: true,
      touch: true,
      mouse: true,
    },
    scene,
  });

  const focusCanvas = (): void => {
    const canvas = game.canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute(
      "aria-label",
      "VibeTide level. Move with arrow keys or A and D. Jump with Space, W, or Up.",
    );
    canvas.focus({ preventScroll: true });
  };

  const handlePointerDown = (): void => focusCanvas();
  game.canvas.addEventListener("pointerdown", handlePointerDown);

  const restartScene = (): void => {
    if (destroyed) {
      return;
    }

    controls.release();
    telemetry.quit(scene.getCurrentGridPosition());
    if (game.scene.isActive(VIBE_TIDE_SCENE_KEY)) {
      scene.scene.restart();
    }
  };

  const unsubscribe = store.subscribe((snapshot) => {
    const revisionChanged = snapshot.level.revision !== observedSnapshot.level.revision;
    const modeChanged = snapshot.mode !== observedSnapshot.mode;
    observedSnapshot = snapshot;

    if (revisionChanged || modeChanged) {
      restartScene();
    }
  });

  const resizeGame = (): void => {
    if (destroyed) {
      return;
    }

    const size = measureContainer(container);
    if (game.scale.width !== size.width || game.scale.height !== size.height) {
      game.scale.resize(size.width, size.height);
    }
  };

  let resizeObserver: ResizeObserver | null = null;
  let usesWindowResize = false;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(resizeGame);
    resizeObserver.observe(container);
  } else {
    window.addEventListener("resize", resizeGame);
    usesWindowResize = true;
  }

  game.events.once(Phaser.Core.Events.READY, resizeGame);

  return {
    destroy(): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      unsubscribe();
      telemetry.quit(scene.getCurrentGridPosition());
      controls.release();
      resizeObserver?.disconnect();
      if (usesWindowResize) {
        window.removeEventListener("resize", resizeGame);
      }
      game.canvas.removeEventListener("pointerdown", handlePointerDown);
      game.destroy(true);
    },
    restart: restartScene,
    focus: focusCanvas,
    setControl(control, pressed): void {
      controls.setControl(control, pressed);
    },
    setControls(next): void {
      controls.setControls(next);
    },
    jump(): void {
      controls.pulseJump();
    },
  };
}

function measureContainer(container: HTMLElement): { width: number; height: number } {
  const bounds = container.getBoundingClientRect();
  const width = Math.max(320, Math.round(bounds.width || container.clientWidth || 960));
  const fallbackHeight = Math.min(720, Math.max(360, Math.round(width * 0.5625)));
  const height = Math.max(240, Math.round(bounds.height || container.clientHeight || fallbackHeight));
  return { width, height };
}
