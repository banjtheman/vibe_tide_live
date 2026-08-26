import {
  TILE_DEFINITIONS,
  type LevelDocument,
  type LevelPatchOperation,
  type StudioStore,
  type TileId,
} from "../core/contracts";

export interface LevelEditorController {
  render(level: LevelDocument): void;
  setBrush(tile: TileId): void;
  getBrush(): TileId;
  destroy(): void;
}

const cellSelector = ".level-cell[data-x][data-y]";

function readCell(element: Element | null): { element: HTMLButtonElement; x: number; y: number } | null {
  const button = element?.closest<HTMLButtonElement>(cellSelector);
  if (!button) return null;

  const x = Number(button.dataset.x);
  const y = Number(button.dataset.y);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { element: button, x, y };
}

export function mountLevelEditor(container: HTMLElement, store: StudioStore): LevelEditorController {
  const grid = document.createElement("div");
  grid.className = "level-grid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", "Editable level grid");
  container.replaceChildren(grid);

  let brush: TileId = 1;
  let drawing = false;
  let pointerId: number | null = null;
  let level: LevelDocument | null = null;
  const pending = new Map<string, LevelPatchOperation>();

  const previewCell = (target: Element | null): void => {
    const cell = readCell(target);
    if (!cell || !level) return;
    if (cell.x < 0 || cell.x >= level.width || cell.y < 0 || cell.y >= level.height) return;

    const key = `${cell.x},${cell.y}`;
    pending.set(key, { kind: "set_tile", x: cell.x, y: cell.y, tile: brush });
    for (const id of Object.keys(TILE_DEFINITIONS)) {
      cell.element.classList.remove(`tile--${id}`);
    }
    cell.element.classList.add(`tile--${brush}`);
    cell.element.dataset.tile = String(brush);
    cell.element.setAttribute("aria-label", `${TILE_DEFINITIONS[brush].name} at column ${cell.x + 1}, row ${cell.y + 1}`);
  };

  const commit = (): void => {
    if (!drawing) return;
    drawing = false;
    pointerId = null;
    const operations = [...pending.values()];
    pending.clear();
    if (operations.length > 0) {
      store.applyPatch(operations, `Painted ${operations.length} ${operations.length === 1 ? "tile" : "tiles"}`, "human");
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || store.getSnapshot().mode !== "edit") return;
    drawing = true;
    pointerId = event.pointerId;
    pending.clear();
    previewCell(document.elementFromPoint(event.clientX, event.clientY));
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!drawing || event.pointerId !== pointerId) return;
    previewCell(document.elementFromPoint(event.clientX, event.clientY));
    event.preventDefault();
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    commit();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const cell = readCell(event.target as Element | null);
    if (!cell || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    pending.clear();
    drawing = true;
    pending.set(`${cell.x},${cell.y}`, { kind: "set_tile", x: cell.x, y: cell.y, tile: brush });
    commit();
  };

  grid.addEventListener("pointerdown", onPointerDown);
  grid.addEventListener("pointermove", onPointerMove);
  grid.addEventListener("keydown", onKeyDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", commit);

  return {
    render(nextLevel): void {
      level = nextLevel;
      grid.style.gridTemplateColumns = `repeat(${nextLevel.width}, var(--cell-size))`;
      grid.setAttribute("aria-colcount", String(nextLevel.width));
      grid.setAttribute("aria-rowcount", String(nextLevel.height));

      const fragment = document.createDocumentFragment();
      for (let y = 0; y < nextLevel.height; y += 1) {
        const row = nextLevel.tiles[y];
        if (!row) continue;
        for (let x = 0; x < nextLevel.width; x += 1) {
          const tile = row[x] ?? 0;
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = `level-cell tile--${tile}`;
          cell.dataset.x = String(x);
          cell.dataset.y = String(y);
          cell.dataset.tile = String(tile);
          cell.setAttribute("role", "gridcell");
          cell.setAttribute("aria-label", `${TILE_DEFINITIONS[tile].name} at column ${x + 1}, row ${y + 1}`);
          fragment.append(cell);
        }
      }
      grid.replaceChildren(fragment);
    },
    setBrush(tile): void {
      brush = tile;
    },
    getBrush(): TileId {
      return brush;
    },
    destroy(): void {
      grid.removeEventListener("pointerdown", onPointerDown);
      grid.removeEventListener("pointermove", onPointerMove);
      grid.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", commit);
    },
  };
}
