import {
  TILE_DEFINITIONS,
  TILE_IDS,
  type LevelDocument,
  type StudioSnapshot,
  type StudioStore,
  type TileId,
} from "../core/contracts";
import type { VibeTideGameController } from "../game";
import { mountLevelEditor } from "./editor";

const AGENT_PROMPT =
  "Make me a playful beach level called Sunset Circuit. Give it an easy opening, a slippery sea-glass stretch, one fair spike challenge, and a finish I can reach.";

export interface StudioUIController {
  readonly gameMount: HTMLElement;
  setGameController(controller: VibeTideGameController): void;
  setWebMCPStatus(supported: boolean, toolCount: number): void;
  focusGame(): void;
  showToast(message: string): void;
  destroy(): void;
}

export interface StudioUIOptions {
  createShareUrl(level: LevelDocument): string;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing studio element: ${selector}`);
  return element;
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "—";
  const seconds = Math.round(milliseconds / 100) / 10;
  return `${seconds}s`;
}

function makePaletteMarkup(): string {
  return TILE_IDS.map(
    (tile) => {
      const definition = TILE_DEFINITIONS[tile];
      return `
      <button class="palette__item" type="button" data-brush="${tile}" aria-pressed="${tile === 1 ? "true" : "false"}" aria-describedby="tile-description-${tile}" title="${definition.description}">
        <span class="tile-swatch tile--${tile}" aria-hidden="true"></span>
        <span class="palette__copy">
          <span class="palette__label">${definition.name}</span>
          <span class="palette__kind" aria-hidden="true">${definition.category}</span>
        </span>
        <span class="palette__selected" aria-hidden="true">✓</span>
        <span class="sr-only" id="tile-description-${tile}">${definition.description}</span>
      </button>`;
    },
  ).join("");
}

function makePieceGuideMarkup(tile: TileId): string {
  const definition = TILE_DEFINITIONS[tile];
  return `
    <div class="piece-guide" data-piece-guide>
      <span class="tile-swatch piece-guide__swatch tile--${tile}" data-piece-swatch aria-hidden="true"></span>
      <div class="piece-guide__copy">
        <div class="piece-guide__heading">
          <strong data-piece-name>${definition.name}</strong>
          <span class="piece-guide__kind" data-piece-kind>${definition.category}</span>
        </div>
        <p data-piece-description>${definition.description}</p>
      </div>
    </div>`;
}

export function mountStudioUI(
  root: HTMLElement,
  store: StudioStore,
  options: StudioUIOptions,
): StudioUIController {
  root.innerHTML = `
    <div class="studio-shell">
      <header class="topbar">
        <a class="wordmark" href="/" aria-label="VibeTide Live home">
          <span class="wordmark__mark" aria-hidden="true"><span>≈</span></span>
          <span>
            <span class="wordmark__wave">VibeTide</span>
            <span class="wordmark__live">Play · build · share</span>
          </span>
        </a>
        <div class="topbar__center" aria-label="Level status">
          <span class="save-chip"><span aria-hidden="true">●</span> Saved as you build</span>
          <span class="revision-chip" data-revision>Version 0</span>
        </div>
        <div class="topbar__actions">
          <button class="button button--quiet button--small" type="button" data-action="undo">Undo</button>
          <button class="button button--quiet button--small" type="button" data-action="share">Share</button>
          <button class="button button--accent" type="button" data-action="play"><span aria-hidden="true">▶</span> Play level</button>
        </div>
      </header>

      <main class="workbench">
        <aside class="rail rail--left" aria-label="Level tools">
          <section class="rail__section">
            <p class="eyebrow">Your level</p>
            <h2 class="section-title">Set the scene</h2>
            <label class="field">
              <span class="field-label">Level name</span>
              <input data-field="name" maxlength="80" autocomplete="off" />
            </label>
            <label class="field">
              <span class="field-label">Description</span>
              <textarea data-field="description" maxlength="360"></textarea>
            </label>
            <div class="field-row">
              <label class="field">
                <span class="field-label">Difficulty</span>
                <select data-field="difficulty">
                  <option value="beginner">Beginner</option>
                  <option value="moderate">Moderate</option>
                  <option value="tricky">Tricky</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">Focus</span>
                <select data-field="primaryMechanic">
                  <option value="platforming">Platform</option>
                  <option value="ice">Sea glass</option>
                  <option value="spikes">Spikes</option>
                  <option value="water">Water</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
            </div>
          </section>

          <section class="rail__section">
            <p class="eyebrow">Build pieces</p>
            <h2 class="section-title" id="piece-picker-title">Pick, then paint</h2>
            <p class="section-copy palette-intro">Choose a piece to see what it does, then drag it across the level.</p>
            ${makePieceGuideMarkup(1)}
            <div class="palette" role="group" aria-labelledby="piece-picker-title">${makePaletteMarkup()}</div>
          </section>

          <section class="rail__section">
            <p class="eyebrow">New route</p>
            <h2 class="section-title">Mix it up</h2>
            <p class="section-copy">Create a fresh route from the settings above.</p>
            <button class="button button--sea button--wide section-action" type="button" data-action="fresh">Surprise me</button>
          </section>
        </aside>

        <section class="stage-shell" aria-label="VibeTide level">
          <div class="stage-toolbar">
            <div class="stage-title">
              <h1 data-level-name>First light</h1>
              <p data-level-meta>48 × 18 · beginner</p>
            </div>
            <div class="mode-switch" aria-label="Level mode">
              <button type="button" data-mode="edit" aria-pressed="true">Build</button>
              <button type="button" data-mode="play" aria-pressed="false">Play</button>
            </div>
          </div>

          <div class="stage" data-stage data-mode="edit">
            <p class="stage-hint" data-stage-hint>Choose a piece, then drag to paint</p>
            <div class="editor-viewport" data-editor></div>
            <div class="game-mount" data-game-mount></div>
            <div class="touch-controls" data-touch-controls aria-label="Touch controls">
              <div class="touch-cluster">
                <button class="touch-button" type="button" data-control="left" aria-label="Move left">←</button>
                <button class="touch-button" type="button" data-control="right" aria-label="Move right">→</button>
              </div>
              <button class="touch-button" type="button" data-control="jump" aria-label="Jump">↑</button>
            </div>
          </div>

          <div class="stage-foot">
            <span class="stage-foot__status"><span aria-hidden="true">●</span> <span data-stage-status>Ready to build</span></span>
            <span class="stage-foot__keys"><kbd>A</kbd><kbd>D</kbd> move <span aria-hidden="true">·</span> <kbd>Space</kbd> jump</span>
          </div>
        </section>

        <aside class="rail rail--right" aria-label="Level and playtest details">
          <section class="rail__section">
            <p class="eyebrow">Playtest</p>
            <h2 class="section-title">How’s this run?</h2>
            <div class="metric-grid">
              <div class="metric"><span class="metric__label">Open tiles</span><strong class="metric__value" data-metric="reachable">0</strong></div>
              <div class="metric"><span class="metric__label">Deaths</span><strong class="metric__value" data-metric="deaths">0</strong></div>
              <div class="metric"><span class="metric__label">Best run</span><strong class="metric__value" data-metric="time">—</strong></div>
              <div class="metric"><span class="metric__label">Made by</span><strong class="metric__value metric__value--word" data-metric="author">You</strong></div>
            </div>
            <div class="validity" data-validity data-valid="true">
              <span class="validity__mark" aria-hidden="true">✓</span>
              <div><strong data-validity-title>Ready to ride</strong><span data-validity-copy>The spawn can reach the finish buoy.</span></div>
            </div>
          </section>

          <section class="rail__section">
            <p class="eyebrow">Level ideas</p>
            <h2 class="section-title">Make the next wave</h2>
            <p class="section-copy">Tell Codex what sounds fun, or start with this idea.</p>
            <div class="idea-card">
              <p>${AGENT_PROMPT}</p>
              <button class="button button--accent button--wide" type="button" data-action="copy-prompt">Copy level idea</button>
            </div>
          </section>

          <section class="rail__section">
            <p class="eyebrow">Level history</p>
            <h2 class="section-title">Recent changes</h2>
            <ol class="activity-list" data-activity></ol>
          </section>

          <section class="rail__section">
            <button class="button button--wide" type="button" data-action="export">Download level</button>
          </section>
        </aside>
      </main>

      <span hidden data-webmcp-chip></span>
      <span hidden data-tool-count></span>
      <div class="toast-region" aria-live="polite" aria-atomic="true" data-toasts></div>
    </div>`;

  const editorMount = requireElement<HTMLElement>(root, "[data-editor]");
  const gameMount = requireElement<HTMLElement>(root, "[data-game-mount]");
  const editor = mountLevelEditor(editorMount, store);
  const stage = requireElement<HTMLElement>(root, "[data-stage]");
  const stageHint = requireElement<HTMLElement>(root, "[data-stage-hint]");
  const stageStatus = requireElement<HTMLElement>(root, "[data-stage-status]");
  const levelName = requireElement<HTMLElement>(root, "[data-level-name]");
  const levelMeta = requireElement<HTMLElement>(root, "[data-level-meta]");
  const revision = requireElement<HTMLElement>(root, "[data-revision]");
  const toolChip = requireElement<HTMLElement>(root, "[data-webmcp-chip]");
  const toolCount = requireElement<HTMLElement>(root, "[data-tool-count]");
  const activityList = requireElement<HTMLOListElement>(root, "[data-activity]");
  const validity = requireElement<HTMLElement>(root, "[data-validity]");
  const validityMark = requireElement<HTMLElement>(root, ".validity__mark");
  const validityTitle = requireElement<HTMLElement>(root, "[data-validity-title]");
  const validityCopy = requireElement<HTMLElement>(root, "[data-validity-copy]");
  const toasts = requireElement<HTMLElement>(root, "[data-toasts]");
  const nameInput = requireElement<HTMLInputElement>(root, '[data-field="name"]');
  const descriptionInput = requireElement<HTMLTextAreaElement>(root, '[data-field="description"]');
  const difficultyInput = requireElement<HTMLSelectElement>(root, '[data-field="difficulty"]');
  const mechanicInput = requireElement<HTMLSelectElement>(root, '[data-field="primaryMechanic"]');
  const modeButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-mode]")];
  const paletteButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-brush]")];
  const pieceSwatch = requireElement<HTMLElement>(root, "[data-piece-swatch]");
  const pieceName = requireElement<HTMLElement>(root, "[data-piece-name]");
  const pieceKind = requireElement<HTMLElement>(root, "[data-piece-kind]");
  const pieceDescription = requireElement<HTMLElement>(root, "[data-piece-description]");
  const playButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-action="play"], [data-mode="play"]')];
  const topPlayButton = requireElement<HTMLButtonElement>(root, '[data-action="play"]');
  const undoButton = requireElement<HTMLButtonElement>(root, '[data-action="undo"]');

  let game: VibeTideGameController | null = null;
  let renderedRevision = -1;
  let unsubscribe: (() => void) | null = null;
  let toastSequence = 0;
  let selectedBrush: TileId = 1;

  const showPieceGuide = (tile: TileId): void => {
    const definition = TILE_DEFINITIONS[tile];
    pieceSwatch.className = `tile-swatch piece-guide__swatch tile--${tile}`;
    pieceName.textContent = definition.name;
    pieceKind.textContent = definition.category;
    pieceDescription.textContent = definition.description;
  };

  const showToast = (message: string): void => {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toast.dataset.toast = String((toastSequence += 1));
    toasts.append(toast);
    window.setTimeout(() => toast.remove(), 3400);
  };

  const updateActivity = (snapshot: StudioSnapshot): void => {
    const entries = snapshot.activity.slice(0, 7);
    if (entries.length === 0) {
      const empty = document.createElement("li");
      empty.className = "section-copy";
      empty.textContent = "Your edits and playtest moments will show up here.";
      activityList.replaceChildren(empty);
      return;
    }
    const nodes = entries.map((entry) => {
      const item = document.createElement("li");
      item.className = "activity";
      item.dataset.source = entry.source;
      const source = document.createElement("span");
      source.className = "activity__source";
      const sourceName =
        entry.source === "human"
          ? "You"
          : entry.source === "agent"
            ? "Codex"
            : entry.source === "game"
              ? "Playtest"
              : "VibeTide";
      source.textContent = `${sourceName} · v${entry.revision}`;
      const detail = document.createElement("span");
      detail.className = "activity__detail";
      detail.textContent = `${entry.action} — ${entry.detail}`;
      item.append(source, detail);
      return item;
    });
    activityList.replaceChildren(...nodes);
  };

  const syncField = (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void => {
    if (document.activeElement !== field && field.value !== value) field.value = value;
  };

  const render = (snapshot: StudioSnapshot): void => {
    const { level, validation } = snapshot;
    if (renderedRevision !== level.revision) {
      editor.render(level);
      renderedRevision = level.revision;
    }

    stage.dataset.mode = snapshot.mode;
    stageHint.textContent = snapshot.mode === "play" ? "Reach the coral finish buoy!" : "Choose a piece, then drag to paint";
    stageStatus.textContent = snapshot.mode === "play" ? "Run in progress" : "Your changes save as you paint";
    levelName.textContent = level.metadata.name;
    levelMeta.textContent = `${level.width} × ${level.height} · ${level.metadata.difficulty}`;
    revision.textContent = `Version ${level.revision}`;
    undoButton.disabled = !snapshot.canUndo;
    playButtons.forEach((button) => {
      button.disabled = !validation.valid;
      button.title = validation.valid ? "Play this level" : "Fix the route before playing";
    });
    topPlayButton.disabled = snapshot.mode === "play" ? false : !validation.valid;
    topPlayButton.textContent = snapshot.mode === "play" ? "← Build level" : "▶ Play level";
    topPlayButton.title =
      snapshot.mode === "play" ? "Return to the level builder" : topPlayButton.title;
    modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === snapshot.mode)));

    syncField(nameInput, level.metadata.name);
    syncField(descriptionInput, level.metadata.description);
    syncField(difficultyInput, level.metadata.difficulty);
    syncField(mechanicInput, level.metadata.primaryMechanic);

    requireElement<HTMLElement>(root, '[data-metric="reachable"]').textContent = String(validation.reachableCells);
    const report = snapshot.activePlaytest ?? snapshot.lastPlaytest;
    requireElement<HTMLElement>(root, '[data-metric="deaths"]').textContent = String(report?.deaths ?? 0);
    requireElement<HTMLElement>(root, '[data-metric="time"]').textContent = formatDuration(report?.elapsedMs ?? 0);
    requireElement<HTMLElement>(root, '[data-metric="author"]').textContent =
      level.metadata.author === "human" ? "You" : level.metadata.author === "agent" ? "Codex" : "You + Codex";

    validity.dataset.valid = String(validation.valid);
    validityMark.textContent = validation.valid ? "✓" : "!";
    validityTitle.textContent = validation.valid ? "Ready to ride" : `${validation.issues.length} route issue${validation.issues.length === 1 ? "" : "s"}`;
    validityCopy.textContent = validation.valid
      ? "The spawn can reach the finish buoy."
      : (validation.issues[0]?.message ?? "The route needs attention.");
    updateActivity(snapshot);
  };

  const switchMode = (mode: "edit" | "play"): void => {
    if (mode === "play" && !store.getSnapshot().validation.valid) {
      showToast("Fix the route before starting a run.");
      return;
    }
    store.setMode(mode, "human");
    if (mode === "play") {
      window.setTimeout(() => game?.focus(), 80);
    }
  };

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => switchMode(button.dataset.mode === "play" ? "play" : "edit"));
  });
  topPlayButton.addEventListener("click", () => {
    switchMode(store.getSnapshot().mode === "play" ? "edit" : "play");
  });
  undoButton.addEventListener("click", () => {
    store.undo("human");
  });

  paletteButtons.forEach((button) => {
    const tile = Number(button.dataset.brush) as TileId;
    button.addEventListener("pointerenter", () => {
      if (TILE_IDS.includes(tile)) showPieceGuide(tile);
    });
    button.addEventListener("pointerleave", () => showPieceGuide(selectedBrush));
    button.addEventListener("focus", () => {
      if (TILE_IDS.includes(tile)) showPieceGuide(tile);
    });
    button.addEventListener("blur", () => showPieceGuide(selectedBrush));
    button.addEventListener("click", () => {
      if (!TILE_IDS.includes(tile)) return;
      selectedBrush = tile;
      editor.setBrush(tile);
      showPieceGuide(tile);
      paletteButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    });
  });

  nameInput.addEventListener("change", () => store.setMetadata({ name: nameInput.value }, "human"));
  descriptionInput.addEventListener("change", () => store.setMetadata({ description: descriptionInput.value }, "human"));
  difficultyInput.addEventListener("change", () => {
    store.setMetadata({ difficulty: difficultyInput.value as "beginner" | "moderate" | "tricky" }, "human");
  });
  mechanicInput.addEventListener("change", () => {
    store.setMetadata({ primaryMechanic: mechanicInput.value as "platforming" | "ice" | "spikes" | "water" | "mixed" }, "human");
  });

  requireElement<HTMLButtonElement>(root, '[data-action="fresh"]').addEventListener("click", () => {
    const current = store.getSnapshot().level.metadata;
    store.createLevel(
      {
        name: nameInput.value.trim() || current.name,
        description: descriptionInput.value.trim() || current.description,
        difficulty: difficultyInput.value as "beginner" | "moderate" | "tricky",
        primaryMechanic: mechanicInput.value as "platforming" | "ice" | "spikes" | "water" | "mixed",
        seed: Date.now() >>> 0,
      },
      "human",
    );
  });

  requireElement<HTMLButtonElement>(root, '[data-action="copy-prompt"]').addEventListener("click", () => {
    void copyText(AGENT_PROMPT)
      .then(() => showToast("Level idea copied"))
      .catch(() => showToast("Could not access the clipboard"));
  });

  requireElement<HTMLButtonElement>(root, '[data-action="share"]').addEventListener("click", () => {
    const shareUrl = options.createShareUrl(store.exportProject());
    void copyText(shareUrl)
      .then(() => showToast("Playable level link copied"))
      .catch(() => showToast("Could not access the clipboard"));
  });

  requireElement<HTMLButtonElement>(root, '[data-action="export"]').addEventListener("click", () => {
    const snapshot = store.exportProject();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${snapshot.metadata.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "vibetide-level"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Level downloaded");
  });

  root.querySelectorAll<HTMLButtonElement>("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (control === "jump") game?.jump();
      if (control === "left" || control === "right") game?.setControl(control, true);
    });
    const release = (): void => {
      if (control === "left" || control === "right") game?.setControl(control, false);
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  unsubscribe = store.subscribe(render);
  render(store.getSnapshot());

  return {
    gameMount,
    setGameController(controller): void {
      game = controller;
    },
    setWebMCPStatus(supported, count): void {
      toolChip.textContent = supported ? `${count} page tools live` : `${count} tools ready · WebMCP browser needed`;
      toolCount.textContent = supported ? `${count} page tools registered` : `${count} page tools declared`;
    },
    focusGame(): void {
      game?.focus();
    },
    showToast,
    destroy(): void {
      unsubscribe?.();
      unsubscribe = null;
      editor.destroy();
      game = null;
      root.replaceChildren();
    },
  };
}
