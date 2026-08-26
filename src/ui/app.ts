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
  "Build me a moderate VibeTide level called Sunset Circuit. Start friendly, introduce slippery sea-glass platforms, add one fair spike challenge, keep the goal reachable, then start a playtest.";

const TOOL_NAMES = [
  "inspect_level",
  "create_level_from_blueprint",
  "apply_level_patch",
  "set_level_metadata",
  "validate_level",
  "get_playtest_report",
  "start_playtest",
  "undo_last_change",
  "create_share_link",
] as const;

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
    (tile) => `
      <button class="palette__item" type="button" data-brush="${tile}" aria-pressed="${tile === 1 ? "true" : "false"}">
        <span class="tile-swatch tile--${tile}" aria-hidden="true"></span>
        <span class="palette__label">${TILE_DEFINITIONS[tile].name}</span>
      </button>`,
  ).join("");
}

function makeToolMarkup(): string {
  return TOOL_NAMES.map(
    (name) => `<li><span>${name}</span><span class="tool-badge">page</span></li>`,
  ).join("");
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
          <span class="wordmark__mark" aria-hidden="true">≈</span>
          <span>
            <span class="wordmark__wave">VibeTide</span>
            <span class="wordmark__live">Live workbench</span>
          </span>
        </a>
        <div class="topbar__center" aria-label="Document status">
          <span class="connection-chip" data-webmcp-chip>Checking page tools</span>
          <span class="revision-chip" data-revision>Revision 0</span>
        </div>
        <div class="topbar__actions">
          <button class="button button--quiet button--small" type="button" data-action="undo">Undo</button>
          <button class="button button--quiet button--small" type="button" data-action="share">Share</button>
          <button class="button button--accent" type="button" data-action="play">Play now</button>
        </div>
      </header>

      <main class="workbench">
        <aside class="rail rail--left" aria-label="Level tools">
          <section class="rail__section">
            <p class="eyebrow">Level details</p>
            <h2 class="section-title">Shape the tide</h2>
            <label class="field">
              <span class="field-label">Name</span>
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
            <p class="eyebrow">Brush</p>
            <h2 class="section-title">Paint the route</h2>
            <div class="palette" aria-label="Tile palette">${makePaletteMarkup()}</div>
          </section>

          <section class="rail__section">
            <p class="eyebrow">Draft</p>
            <h2 class="section-title">Need another wave?</h2>
            <p class="section-copy">Generate a fresh, valid route from the details above. Your current draft stays in the shared URL if you copy it first.</p>
            <button class="button button--sea" type="button" data-action="fresh" style="width: 100%; margin-top: var(--space-3)">Fresh draft</button>
          </section>
        </aside>

        <section class="stage-shell" aria-label="Level workbench">
          <div class="stage-toolbar">
            <div class="stage-title">
              <h1 data-level-name>First light</h1>
              <p data-level-meta>48 × 18 · beginner · human</p>
            </div>
            <div class="mode-switch" aria-label="Studio mode">
              <button type="button" data-mode="edit" aria-pressed="true">Edit</button>
              <button type="button" data-mode="play" aria-pressed="false">Play</button>
            </div>
          </div>

          <div class="stage" data-stage data-mode="edit">
            <p class="stage-hint" data-stage-hint>Drag to paint · choose a tile on the left</p>
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
            <span data-stage-status>Ready to edit</span>
            <span class="stage-foot__keys"><kbd>A</kbd><kbd>D</kbd> move <kbd>Space</kbd> jump</span>
          </div>
        </section>

        <aside class="rail rail--right" aria-label="Agent and playtest details">
          <section class="rail__section">
            <p class="eyebrow">Live state</p>
            <h2 class="section-title">Route pulse</h2>
            <div class="metric-grid">
              <div class="metric"><span class="metric__label">Reachable</span><strong class="metric__value" data-metric="reachable">0%</strong></div>
              <div class="metric"><span class="metric__label">Deaths</span><strong class="metric__value" data-metric="deaths">0</strong></div>
              <div class="metric"><span class="metric__label">Time</span><strong class="metric__value" data-metric="time">—</strong></div>
              <div class="metric"><span class="metric__label">Author</span><strong class="metric__value" data-metric="author">You</strong></div>
            </div>
            <div class="validity" data-validity data-valid="true" style="margin-top: var(--space-3)">
              <span class="validity__mark" aria-hidden="true">✓</span>
              <div><strong data-validity-title>Ready to ride</strong><span data-validity-copy>The spawn can reach the finish buoy.</span></div>
            </div>
          </section>

          <section class="rail__section">
            <p class="eyebrow">Agent handoff</p>
            <h2 class="section-title">Ask from the browser</h2>
            <p class="section-copy">There is no chatbot in the page. ChatGPT or Codex discovers these tools while visiting it.</p>
            <div class="prompt-card" style="margin-top: var(--space-3)">
              <code>${AGENT_PROMPT}</code>
              <button class="button button--accent button--small" type="button" data-action="copy-prompt">Copy starter prompt</button>
            </div>
            <p class="tool-count" data-tool-count style="margin: var(--space-3) 0 var(--space-2)">9 page tools declared</p>
            <ul class="tool-list">${makeToolMarkup()}</ul>
          </section>

          <section class="rail__section">
            <p class="eyebrow">Activity</p>
            <h2 class="section-title">What changed</h2>
            <ol class="activity-list" data-activity></ol>
          </section>

          <section class="rail__section">
            <button class="button" type="button" data-action="export" style="width: 100%">Export level JSON</button>
          </section>
        </aside>
      </main>

      <footer class="status-strip" aria-label="VibeTide capabilities" tabindex="0">
        <div class="status-strip__track">
          <span class="status-strip__item">Build on the live page</span>
          <span class="status-strip__item">Play without a rebuild</span>
          <span class="status-strip__item">Inspect every revision</span>
          <span class="status-strip__item">Repair from real playtests</span>
          <span class="status-strip__item">Build on the live page</span>
          <span class="status-strip__item">Play without a rebuild</span>
          <span class="status-strip__item">Inspect every revision</span>
          <span class="status-strip__item">Repair from real playtests</span>
        </div>
      </footer>
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
  const playButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-action="play"], [data-mode="play"]')];
  const undoButton = requireElement<HTMLButtonElement>(root, '[data-action="undo"]');

  let game: VibeTideGameController | null = null;
  let renderedRevision = -1;
  let unsubscribe: (() => void) | null = null;
  let toastSequence = 0;

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
      empty.textContent = "Edits from you, the game, and the visiting agent will appear here.";
      activityList.replaceChildren(empty);
      return;
    }
    const nodes = entries.map((entry) => {
      const item = document.createElement("li");
      item.className = "activity";
      item.dataset.source = entry.source;
      const source = document.createElement("span");
      source.className = "activity__source";
      source.textContent = `${entry.source} · r${entry.revision}`;
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
    stageHint.textContent = snapshot.mode === "play" ? "Reach the coral finish buoy" : "Drag to paint · choose a tile on the left";
    stageStatus.textContent = snapshot.mode === "play" ? "Playtest recording live" : "Every edit is available to the visiting agent";
    levelName.textContent = level.metadata.name;
    levelMeta.textContent = `${level.width} × ${level.height} · ${level.metadata.difficulty} · ${level.metadata.author}`;
    revision.textContent = `Revision ${level.revision}`;
    undoButton.disabled = !snapshot.canUndo;
    playButtons.forEach((button) => {
      button.disabled = !validation.valid;
      button.title = validation.valid ? "Play this revision" : "Fix validation issues before playing";
    });
    modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === snapshot.mode)));

    syncField(nameInput, level.metadata.name);
    syncField(descriptionInput, level.metadata.description);
    syncField(difficultyInput, level.metadata.difficulty);
    syncField(mechanicInput, level.metadata.primaryMechanic);

    requireElement<HTMLElement>(root, '[data-metric="reachable"]').textContent = String(validation.reachableCells);
    const report = snapshot.activePlaytest ?? snapshot.lastPlaytest;
    requireElement<HTMLElement>(root, '[data-metric="deaths"]').textContent = String(report?.deaths ?? 0);
    requireElement<HTMLElement>(root, '[data-metric="time"]').textContent = formatDuration(report?.elapsedMs ?? 0);
    requireElement<HTMLElement>(root, '[data-metric="author"]').textContent = level.metadata.author === "human" ? "You" : level.metadata.author === "agent" ? "Agent" : "Both";

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
      showToast("Fix the route issue before starting a playtest.");
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
  requireElement<HTMLButtonElement>(root, '[data-action="play"]').addEventListener("click", () => switchMode("play"));
  undoButton.addEventListener("click", () => {
    store.undo("human");
  });

  paletteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tile = Number(button.dataset.brush) as TileId;
      if (!TILE_IDS.includes(tile)) return;
      editor.setBrush(tile);
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
      .then(() => showToast("Starter prompt copied"))
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
    showToast("Level JSON exported");
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
