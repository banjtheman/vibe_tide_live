import "./styles.css";

import { createLevelStore, tryDecodeLevel, type LevelDocument } from "./core";
import type { VibeTideGameController } from "./game";
import { applyDocumentSeo, createLevelPageSeo, ROOT_PAGE_SEO } from "./seo";
import { createPlayableShareUrl, parseSharedLevelUrl, shouldAutoStartSharedLevel } from "./share";
import { mountStudioUI } from "./ui";
import { registerVibeTideTools, VIBE_TIDE_TOOL_NAMES, type VibeTideToolsRegistration } from "./webmcp";

function shareUrlFor(level: LevelDocument): string {
  return createPlayableShareUrl(level);
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("VibeTide could not find its app mount.");

const sharedRequest = parseSharedLevelUrl(window.location.href);
const decoded = sharedRequest.levelCode ? tryDecodeLevel(sharedRequest.levelCode) : null;
applyDocumentSeo(
  decoded?.ok ? createLevelPageSeo(decoded.level, window.location.href) : ROOT_PAGE_SEO,
);
const store = createLevelStore(decoded?.ok ? { initialLevel: decoded.level } : {});
if (
  shouldAutoStartSharedLevel(
    sharedRequest,
    decoded?.ok === true,
    store.getSnapshot().validation.valid,
  )
) {
  store.beginPlaytest();
}
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
  ui.showToast("This level link is damaged or outdated. Start a new level to keep playing.");
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
