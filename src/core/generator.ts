import {
  LEVEL_SCHEMA_VERSION,
  type Difficulty,
  type LevelBlueprint,
  type LevelDocument,
  type LevelMetadata,
  type LevelSectionSpec,
  type PrimaryMechanic,
  type TileId,
} from "./contracts";
import { repairLevel, validateLevel } from "./validation";

export const MIN_GENERATED_WIDTH = 20;
export const MAX_GENERATED_WIDTH = 80;
export const MIN_GENERATED_HEIGHT = 10;
export const MAX_GENERATED_HEIGHT = 32;

const DETERMINISTIC_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export interface GenerateLevelOptions {
  now?: string;
  id?: string;
  author?: LevelMetadata["author"];
}

interface NormalizedBlueprint {
  name: string;
  description: string;
  width: number;
  height: number;
  difficulty: Difficulty;
  primaryMechanic: PrimaryMechanic;
  seed: number;
  sections: LevelSectionSpec[];
}

function clampInteger(value: number | undefined, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function defaultSections(mechanic: PrimaryMechanic, difficulty: Difficulty): LevelSectionSpec[] {
  const intensity: 1 | 2 | 3 = difficulty === "beginner" ? 1 : difficulty === "moderate" ? 2 : 3;
  switch (mechanic) {
    case "ice":
      return [
        { kind: "run", length: 6 },
        { kind: "ice", length: 12, intensity },
        { kind: "gap", length: 7, intensity: Math.min(2, intensity) as 1 | 2 },
        { kind: "ice", length: 10, intensity },
      ];
    case "spikes":
      return [
        { kind: "run", length: 7 },
        { kind: "spikes", length: 12, intensity },
        { kind: "stairs", length: 8, intensity },
        { kind: "spikes", length: 10, intensity },
      ];
    case "water":
      return [
        { kind: "run", length: 6 },
        { kind: "water", length: 12, intensity },
        { kind: "stairs", length: 8, intensity },
        { kind: "water", length: 10, intensity },
      ];
    case "mixed":
      return [
        { kind: "run", length: 5 },
        { kind: "gap", length: 7, intensity },
        { kind: "ice", length: 8, intensity },
        { kind: "spikes", length: 8, intensity },
        { kind: "water", length: 8, intensity },
      ];
    case "platforming":
      return [
        { kind: "run", length: 7 },
        { kind: "gap", length: 8, intensity },
        { kind: "stairs", length: 10, intensity },
        { kind: "gap", length: 8, intensity },
      ];
  }
}

function inferMechanic(sections: readonly LevelSectionSpec[]): PrimaryMechanic {
  const kinds = new Set(sections.map((section) => section.kind));
  const featured = [kinds.has("ice"), kinds.has("spikes"), kinds.has("water")].filter(Boolean).length;
  if (featured > 1) {
    return "mixed";
  }
  if (kinds.has("ice")) {
    return "ice";
  }
  if (kinds.has("spikes")) {
    return "spikes";
  }
  if (kinds.has("water")) {
    return "water";
  }
  return "platforming";
}

function normalizeSections(
  requested: readonly LevelSectionSpec[] | undefined,
  mechanic: PrimaryMechanic,
  difficulty: Difficulty,
): LevelSectionSpec[] {
  const source = requested && requested.length > 0 ? requested : defaultSections(mechanic, difficulty);
  const normalized: LevelSectionSpec[] = [];
  for (const section of source) {
    if (section.kind === "finish") {
      continue;
    }
    normalized.push({
      kind: section.kind,
      length: clampInteger(section.length, 1, 32, 1),
      ...(section.intensity === undefined
        ? {}
        : { intensity: clampInteger(section.intensity, 1, 3, 1) as 1 | 2 | 3 }),
    });
  }
  return normalized.length > 0 ? normalized : [{ kind: "run", length: 12 }];
}

function normalizeBlueprint(blueprint: LevelBlueprint): NormalizedBlueprint {
  const difficulty = blueprint.difficulty ?? "moderate";
  const provisionalMechanic = blueprint.primaryMechanic ?? inferMechanic(blueprint.sections ?? []);
  const sections = normalizeSections(blueprint.sections, provisionalMechanic, difficulty);
  const seedSource = JSON.stringify({
    name: blueprint.name,
    description: blueprint.description ?? "",
    width: blueprint.width ?? 48,
    height: blueprint.height ?? 18,
    difficulty,
    primaryMechanic: provisionalMechanic,
    sections,
  });
  return {
    name: blueprint.name.trim().slice(0, 80) || "Untitled tide",
    description: (blueprint.description ?? "A fresh route through the tide.").trim().slice(0, 360),
    width: clampInteger(blueprint.width, MIN_GENERATED_WIDTH, MAX_GENERATED_WIDTH, 48),
    height: clampInteger(blueprint.height, MIN_GENERATED_HEIGHT, MAX_GENERATED_HEIGHT, 18),
    difficulty,
    primaryMechanic: provisionalMechanic,
    seed: clampInteger(blueprint.seed, 0, 0xffff_ffff, hashString(seedSource)),
    sections,
  };
}

function levelId(blueprint: NormalizedBlueprint): string {
  return `tide_${hashString(JSON.stringify(blueprint)).toString(36).padStart(7, "0")}`;
}

/**
 * Creates a stable layout from a blueprint. With no options the entire document,
 * including its epoch timestamp and content-derived id, is deterministic. Stores
 * should pass `now` when a real creation timestamp is desired.
 */
export function generateLevel(blueprint: LevelBlueprint, options: GenerateLevelOptions = {}): LevelDocument {
  const normalized = normalizeBlueprint(blueprint);
  const random = makeRandom(normalized.seed);
  const tiles: TileId[][] = Array.from({ length: normalized.height }, () =>
    Array<TileId>(normalized.width).fill(0),
  );
  const baselineY = normalized.height - 4;
  const minimumWalkY = Math.max(2, baselineY - 3);
  const maximumWalkY = Math.min(normalized.height - 2, baselineY + 2);

  const setSurface = (x: number, walkY: number, surface: 1 | 2 | 4): void => {
    tiles[walkY]![x] = 0;
    tiles[walkY + 1]![x] = surface;
    for (let y = walkY + 2; y < normalized.height; y += 1) {
      tiles[y]![x] = random() < 0.12 ? 1 : 2;
    }
    if (walkY > 0) {
      tiles[walkY - 1]![x] = 0;
    }
  };

  const setHazardColumn = (x: number, walkY: number, hazard: 6 | 7): void => {
    tiles[walkY]![x] = hazard;
    if (hazard === 7) {
      for (let y = walkY + 1; y < normalized.height; y += 1) {
        tiles[y]![x] = 7;
      }
    }
  };

  let walkY = baselineY;
  setSurface(0, walkY, 1);
  setSurface(1, walkY, 1);

  const featureStart = 2;
  const featureEnd = normalized.width - 3;
  let x = featureStart;
  let sectionIndex = 0;
  let sectionOffset = 0;

  while (x <= featureEnd) {
    const section = normalized.sections[sectionIndex];
    if (!section) {
      setSurface(x, walkY, 1);
      x += 1;
      continue;
    }
    const intensity = section.intensity ?? (normalized.difficulty === "tricky" ? 3 : normalized.difficulty === "moderate" ? 2 : 1);

    switch (section.kind) {
      case "run":
        setSurface(x, walkY, random() < 0.16 ? 2 : 1);
        break;
      case "ice":
        setSurface(x, walkY, 4);
        break;
      case "gap": {
        const gapWidth = Math.min(3, intensity);
        const phase = sectionOffset % (gapWidth + 2);
        if (phase === 0 || phase > gapWidth) {
          setSurface(x, walkY, 2);
        }
        break;
      }
      case "spikes": {
        setSurface(x, walkY, 2);
        const spacing = intensity === 1 ? 5 : intensity === 2 ? 4 : 3;
        if (sectionOffset % spacing === spacing - 2) {
          setHazardColumn(x, walkY, 6);
        }
        break;
      }
      case "water": {
        const waterWidth = Math.min(3, intensity);
        const phase = sectionOffset % (waterWidth + 2);
        if (phase === 0 || phase > waterWidth) {
          setSurface(x, walkY, 2);
        } else {
          setHazardColumn(x, walkY, 7);
        }
        break;
      }
      case "stairs": {
        const stepSpan = intensity === 3 ? 1 : 2;
        if (sectionOffset > 0 && sectionOffset % stepSpan === 0) {
          const waveLength = Math.max(2, intensity + 1);
          const rising = Math.floor(sectionOffset / (stepSpan * waveLength)) % 2 === 0;
          walkY = Math.min(maximumWalkY, Math.max(minimumWalkY, walkY + (rising ? -1 : 1)));
        }
        setSurface(x, walkY, 2);
        break;
      }
      case "finish":
        // Finish sections are removed by normalization; the case keeps this switch
        // exhaustive if a LevelSectionSpec is constructed dynamically.
        setSurface(x, walkY, 1);
        break;
    }

    x += 1;
    sectionOffset += 1;
    if (sectionOffset >= section.length) {
      sectionIndex += 1;
      sectionOffset = 0;
    }
  }

  const goalX = normalized.width - 2;
  setSurface(goalX, walkY, 1);
  setSurface(normalized.width - 1, walkY, 1);
  tiles[walkY]![goalX] = 3;

  const timestamp = options.now ?? DETERMINISTIC_TIMESTAMP;
  const generated: LevelDocument = {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: options.id ?? levelId(normalized),
    revision: 1,
    width: normalized.width,
    height: normalized.height,
    tiles,
    metadata: {
      name: normalized.name,
      description: normalized.description,
      difficulty: normalized.difficulty,
      primaryMechanic: normalized.primaryMechanic,
      author: options.author ?? "agent",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const validation = validateLevel(generated);
  return validation.valid ? generated : repairLevel(generated, { now: timestamp }).level;
}
