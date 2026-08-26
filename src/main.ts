import "./styles.css";

import { createLevelStore, encodeLevel, tryDecodeLevel, type LevelDocument } from "./core";
import type { VibeTideGameController } from "./game";
import { mountStudioUI } from "./ui";
import { registerVibeTideTools, VIBE_TIDE_TOOL_NAMES, type VibeTideToolsRegistration } from "./webmcp";

function shareUrlFor(level: LevelDocument): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("level", encodeLevel(level));
  return url.toString();
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("VibeTide could not find its app mount.");

const sharedLevel = new URLSearchParams(window.location.search).get("level");
const decoded = sharedLevel ? tryDecodeLevel(sharedLevel) : null;
const store = createLevelStore(decoded?.ok ? { initialLevel: decoded.level } : {});
const ui = mountStudioUI(root, store, { createShareUrl: shareUrlFor });
let game: VibeTideGameController | null = null;
const gameReady = import("./game")
  .then(({ mountVibeTideGame }) => {
    game = mountVibeTideGame(ui.gameMount, store);
    ui.setGameController(game);
    return game;
  })
  .catch((error: unknown) => {
    ui.showToast(`Game runtime could not start: ${error instanceof Error ? error.message : "unknown error"}`);
    return null;
  });

if (decoded && !decoded.ok) {
  ui.showToast(`Shared level could not be opened: ${decoded.error}`);
}

let webMCP: VibeTideToolsRegistration | null = null;

void registerVibeTideTools(store, {
  onStartPlaytest: async () => {
    await gameReady;
    window.setTimeout(() => ui.focusGame(), 80);
  },
  createShareLink: async (level) => shareUrlFor(level),
})
  .then((registration) => {
    webMCP = registration;
    ui.setWebMCPStatus(registration.supported, registration.registeredTools.length || VIBE_TIDE_TOOL_NAMES.length);
  })
  .catch((error: unknown) => {
    ui.setWebMCPStatus(false, VIBE_TIDE_TOOL_NAMES.length);
    ui.showToast(`Page tools could not register: ${error instanceof Error ? error.message : "unknown error"}`);
  });

window.addEventListener(
  "beforeunload",
  () => {
    webMCP?.destroy();
    game?.destroy();
    ui.destroy();
  },
  { once: true },
);
