import {
  TILE_IDS,
  type Difficulty,
  type LevelBlueprint,
  type LevelPatchOperation,
  type LevelSectionSpec,
  type PrimaryMechanic,
  type TileId,
} from "../core/contracts";
import { BACKGROUND_IDS, type BackgroundId } from "../core/backgrounds";

const DIFFICULTIES = ["beginner", "moderate", "tricky"] as const;
const PRIMARY_MECHANICS = ["platforming", "ice", "spikes", "water", "mixed"] as const;
const SECTION_KINDS = ["run", "gap", "stairs", "ice", "spikes", "water", "finish"] as const;

type InputRecord = Record<string, unknown>;

export interface MetadataInput {
  name?: string;
  description?: string;
  difficulty?: Difficulty;
  primaryMechanic?: PrimaryMechanic;
}
export class WebMCPInputError extends Error {
  constructor(toolName: string, detail: string) {
    super(`Invalid input for ${toolName}: ${detail}`);
    this.name = "WebMCPInputError";
  }
}

function record(input: unknown, toolName: string): InputRecord {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new WebMCPInputError(toolName, "expected an object");
  }
  return input as InputRecord;
}

function exactKeys(input: InputRecord, allowed: readonly string[], toolName: string): void {
  const unexpected = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new WebMCPInputError(toolName, `unexpected field ${JSON.stringify(unexpected[0])}`);
  }
}

function required(input: InputRecord, key: string, toolName: string): unknown {
  if (!(key in input)) {
    throw new WebMCPInputError(toolName, `missing required field ${JSON.stringify(key)}`);
  }
  return input[key];
}

function stringValue(
  value: unknown,
  field: string,
  toolName: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") {
    throw new WebMCPInputError(toolName, `${field} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new WebMCPInputError(
      toolName,
      `${field} must contain ${minimum}-${maximum} characters after trimming`,
    );
  }
  return normalized;
}

function integerValue(
  value: unknown,
  field: string,
  toolName: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new WebMCPInputError(
      toolName,
      `${field} must be an integer from ${minimum} to ${maximum}`,
    );
  }
  return value as number;
}

function enumValue<T extends string>(
  value: unknown,
  field: string,
  toolName: string,
  options: readonly T[],
): T {
  if (typeof value !== "string" || !options.includes(value as T)) {
    throw new WebMCPInputError(toolName, `${field} must be one of ${options.join(", ")}`);
  }
  return value as T;
}

export function parseEmptyInput(input: unknown, toolName: string): void {
  const value = record(input, toolName);
  exactKeys(value, [], toolName);
}

export function parseBlueprint(input: unknown): LevelBlueprint {
  const toolName = "create_level_from_blueprint";
  const value = record(input, toolName);
  exactKeys(
    value,
    [
      "name",
      "description",
      "width",
      "height",
      "difficulty",
      "primary_mechanic",
      "background",
      "seed",
      "sections",
    ],
    toolName,
  );

  const blueprint: LevelBlueprint = {
    name: stringValue(required(value, "name", toolName), "name", toolName, 1, 60),
  };

  if (value.description !== undefined) {
    blueprint.description = stringValue(value.description, "description", toolName, 0, 240);
  }
  if (value.width !== undefined) {
    blueprint.width = integerValue(value.width, "width", toolName, 20, 80);
  }
  if (value.height !== undefined) {
    blueprint.height = integerValue(value.height, "height", toolName, 10, 32);
  }
  if (value.difficulty !== undefined) {
    blueprint.difficulty = enumValue(value.difficulty, "difficulty", toolName, DIFFICULTIES);
  }
  if (value.primary_mechanic !== undefined) {
    blueprint.primaryMechanic = enumValue(
      value.primary_mechanic,
      "primary_mechanic",
      toolName,
      PRIMARY_MECHANICS,
    );
  }
  if (value.background !== undefined) {
    blueprint.background = enumValue(
      value.background,
      "background",
      toolName,
      BACKGROUND_IDS,
    );
  }
  if (value.seed !== undefined) {
    blueprint.seed = integerValue(value.seed, "seed", toolName, 0, 2147483647);
  }
  if (value.sections !== undefined) {
    if (!Array.isArray(value.sections) || value.sections.length < 1 || value.sections.length > 16) {
      throw new WebMCPInputError(toolName, "sections must contain 1-16 section objects");
    }
    blueprint.sections = value.sections.map((section, index) => parseSection(section, index, toolName));
  }

  return blueprint;
}

function parseSection(input: unknown, index: number, toolName: string): LevelSectionSpec {
  const value = record(input, toolName);
  exactKeys(value, ["kind", "length", "intensity"], toolName);
  const section: LevelSectionSpec = {
    kind: enumValue(required(value, "kind", toolName), `sections[${index}].kind`, toolName, SECTION_KINDS),
    length: integerValue(
      required(value, "length", toolName),
      `sections[${index}].length`,
      toolName,
      1,
      40,
    ),
  };
  if (value.intensity !== undefined) {
    section.intensity = integerValue(
      value.intensity,
      `sections[${index}].intensity`,
      toolName,
      1,
      3,
    ) as 1 | 2 | 3;
  }
  return section;
}

export function parsePatch(
  input: unknown,
  levelWidth: number,
  levelHeight: number,
): { operations: LevelPatchOperation[]; reason: string } {
  const toolName = "apply_level_patch";
  const value = record(input, toolName);
  exactKeys(value, ["operations", "reason"], toolName);
  const rawOperations = required(value, "operations", toolName);
  if (!Array.isArray(rawOperations) || rawOperations.length < 1 || rawOperations.length > 64) {
    throw new WebMCPInputError(toolName, "operations must contain 1-64 patch operations");
  }
  const operations = rawOperations.map((operation, index) =>
    parsePatchOperation(operation, index, levelWidth, levelHeight, toolName),
  );
  const reason = stringValue(required(value, "reason", toolName), "reason", toolName, 1, 160);
  return { operations, reason };
}

function parsePatchOperation(
  input: unknown,
  index: number,
  levelWidth: number,
  levelHeight: number,
  toolName: string,
): LevelPatchOperation {
  const value = record(input, toolName);
  const prefix = `operations[${index}]`;
  const kind = enumValue(
    required(value, "kind", toolName),
    `${prefix}.kind`,
    toolName,
    ["set_tile", "fill_rect", "clear_rect", "platform", "move_goal"] as const,
  );
  const x = integerValue(required(value, "x", toolName), `${prefix}.x`, toolName, 0, levelWidth - 1);
  const y = integerValue(required(value, "y", toolName), `${prefix}.y`, toolName, 0, levelHeight - 1);

  if (kind === "set_tile") {
    exactKeys(value, ["kind", "x", "y", "tile"], toolName);
    const tile = integerValue(required(value, "tile", toolName), `${prefix}.tile`, toolName, 0, 10);
    if (!TILE_IDS.includes(tile as TileId)) {
      throw new WebMCPInputError(toolName, `${prefix}.tile is not a known tile`);
    }
    return { kind, x, y, tile: tile as TileId };
  }

  if (kind === "move_goal") {
    exactKeys(value, ["kind", "x", "y"], toolName);
    return { kind, x, y };
  }

  if (kind === "platform") {
    exactKeys(value, ["kind", "x", "y", "length", "tile"], toolName);
    const length = integerValue(
      required(value, "length", toolName),
      `${prefix}.length`,
      toolName,
      1,
      levelWidth - x,
    );
    const tile = integerValue(required(value, "tile", toolName), `${prefix}.tile`, toolName, 1, 4);
    if (tile !== 1 && tile !== 2 && tile !== 4) {
      throw new WebMCPInputError(toolName, `${prefix}.tile must be 1, 2, or 4 for a platform`);
    }
    return { kind, x, y, length, tile };
  }

  exactKeys(
    value,
    kind === "fill_rect"
      ? ["kind", "x", "y", "width", "height", "tile"]
      : ["kind", "x", "y", "width", "height"],
    toolName,
  );
  const width = integerValue(
    required(value, "width", toolName),
    `${prefix}.width`,
    toolName,
    1,
    levelWidth - x,
  );
  const height = integerValue(
    required(value, "height", toolName),
    `${prefix}.height`,
    toolName,
    1,
    levelHeight - y,
  );
  if (kind === "fill_rect") {
    const tile = integerValue(required(value, "tile", toolName), `${prefix}.tile`, toolName, 0, 10);
    return { kind, x, y, width, height, tile: tile as TileId };
  }
  return { kind, x, y, width, height };
}

export function parseMetadata(input: unknown): MetadataInput {
  const toolName = "set_level_metadata";
  const value = record(input, toolName);
  exactKeys(value, ["name", "description", "difficulty", "primary_mechanic"], toolName);
  if (Object.keys(value).length === 0) {
    throw new WebMCPInputError(toolName, "provide at least one metadata field");
  }
  const changes: MetadataInput = {};
  if (value.name !== undefined) {
    changes.name = stringValue(value.name, "name", toolName, 1, 60);
  }
  if (value.description !== undefined) {
    changes.description = stringValue(value.description, "description", toolName, 0, 240);
  }
  if (value.difficulty !== undefined) {
    changes.difficulty = enumValue(value.difficulty, "difficulty", toolName, DIFFICULTIES);
  }
  if (value.primary_mechanic !== undefined) {
    changes.primaryMechanic = enumValue(
      value.primary_mechanic,
      "primary_mechanic",
      toolName,
      PRIMARY_MECHANICS,
    );
  }
  return changes;
}

export function parseBackground(input: unknown): BackgroundId {
  const toolName = "set_level_background";
  const value = record(input, toolName);
  exactKeys(value, ["background"], toolName);
  return enumValue(
    required(value, "background", toolName),
    "background",
    toolName,
    BACKGROUND_IDS,
  );
}
