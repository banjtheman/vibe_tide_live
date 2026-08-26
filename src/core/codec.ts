import {
  LEVEL_SCHEMA_VERSION,
  type Difficulty,
  type LevelDocument,
  type LevelMetadata,
  type PrimaryMechanic,
  type TileId,
} from "./contracts";
import { DEFAULT_BACKGROUND_ID, isBackgroundId, type BackgroundId } from "./backgrounds";
import { isTileId, MAX_LEVEL_HEIGHT, MAX_LEVEL_WIDTH, MIN_LEVEL_HEIGHT, MIN_LEVEL_WIDTH } from "./validation";

const LEGACY_LEVEL_CODEC_VERSION = 1 as const;
export const LEVEL_CODEC_VERSION = 2 as const;
export const LEVEL_CODEC_PREFIX = `vt${LEVEL_CODEC_VERSION}.` as const;

const BASE64_URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const DIFFICULTIES = new Set<Difficulty>(["beginner", "moderate", "tricky"]);
const MECHANICS = new Set<PrimaryMechanic>(["platforming", "ice", "spikes", "water", "mixed"]);
const AUTHORS = new Set<LevelMetadata["author"]>(["human", "agent", "human+agent"]);

type CompactLevelV1 = [
  id: string,
  revision: number,
  width: number,
  height: number,
  tileRuns: number[],
  name: string,
  description: string,
  difficulty: Difficulty,
  primaryMechanic: PrimaryMechanic,
  author: LevelMetadata["author"],
  createdAt: string,
  updatedAt: string,
];

type CompactLevelV2 = [
  ...CompactLevelV1,
  background: BackgroundId,
];

type CodecEnvelopeV2 = [version: typeof LEVEL_CODEC_VERSION, level: CompactLevelV2];

export class LevelCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevelCodecError";
  }
}

export type DecodeLevelResult =
  | { ok: true; level: LevelDocument }
  | { ok: false; error: string };

function encodeBase64Url(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;
    output += BASE64_URL_ALPHABET[(combined >>> 18) & 63];
    output += BASE64_URL_ALPHABET[(combined >>> 12) & 63];
    if (index + 1 < bytes.length) {
      output += BASE64_URL_ALPHABET[(combined >>> 6) & 63];
    }
    if (index + 2 < bytes.length) {
      output += BASE64_URL_ALPHABET[combined & 63];
    }
  }
  return output;
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new LevelCodecError("Level code contains invalid URL-safe base64 data.");
  }

  const output: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of value) {
    const decoded = BASE64_URL_ALPHABET.indexOf(character);
    if (decoded < 0) {
      throw new LevelCodecError("Level code contains an invalid character.");
    }
    buffer = buffer * 64 + decoded;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >>> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(output);
}

function encodeTileRuns(tiles: readonly (readonly TileId[])[]): number[] {
  const runs: number[] = [];
  let previous: TileId | null = null;
  let count = 0;
  for (const row of tiles) {
    for (const tile of row) {
      if (tile === previous) {
        count += 1;
      } else {
        if (previous !== null) {
          runs.push(previous, count);
        }
        previous = tile;
        count = 1;
      }
    }
  }
  if (previous !== null) {
    runs.push(previous, count);
  }
  return runs;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function requireString(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) {
    throw new LevelCodecError(`${label} is missing or too long.`);
  }
  return value;
}

function decodeTileRuns(value: unknown, width: number, height: number): TileId[][] {
  if (!Array.isArray(value) || value.length === 0 || value.length % 2 !== 0) {
    throw new LevelCodecError("Tile run data is malformed.");
  }
  const expectedCells = width * height;
  const flattened: TileId[] = [];
  for (let index = 0; index < value.length; index += 2) {
    const tile = value[index];
    const count = value[index + 1];
    if (!isTileId(tile) || !isIntegerInRange(count, 1, expectedCells)) {
      throw new LevelCodecError("Tile run contains an unsupported tile or count.");
    }
    if (flattened.length + count > expectedCells) {
      throw new LevelCodecError("Tile run exceeds the declared dimensions.");
    }
    for (let offset = 0; offset < count; offset += 1) {
      flattened.push(tile);
    }
  }
  if (flattened.length !== expectedCells) {
    throw new LevelCodecError("Tile runs do not fill the declared dimensions.");
  }

  return Array.from({ length: height }, (_, y) =>
    flattened.slice(y * width, (y + 1) * width),
  );
}

function compactLevel(level: LevelDocument): CompactLevelV2 {
  return [
    level.id,
    level.revision,
    level.width,
    level.height,
    encodeTileRuns(level.tiles),
    level.metadata.name,
    level.metadata.description,
    level.metadata.difficulty,
    level.metadata.primaryMechanic,
    level.metadata.author,
    level.createdAt,
    level.updatedAt,
    level.metadata.background,
  ];
}

function expandLevel(
  value: unknown,
  version: typeof LEGACY_LEVEL_CODEC_VERSION | typeof LEVEL_CODEC_VERSION,
): LevelDocument {
  const expectedLength = version === LEGACY_LEVEL_CODEC_VERSION ? 12 : 13;
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new LevelCodecError("Level payload has an unsupported shape.");
  }
  const [idValue, revisionValue, widthValue, heightValue, runs, nameValue, descriptionValue, difficultyValue, mechanicValue, authorValue, createdValue, updatedValue] = value;
  const backgroundValue = version === LEVEL_CODEC_VERSION ? value[12] : undefined;
  const id = requireString(idValue, "Level id", 128);
  if (!isIntegerInRange(revisionValue, 0, Number.MAX_SAFE_INTEGER)) {
    throw new LevelCodecError("Level revision is invalid.");
  }
  if (!isIntegerInRange(widthValue, MIN_LEVEL_WIDTH, MAX_LEVEL_WIDTH)) {
    throw new LevelCodecError("Level width is outside supported bounds.");
  }
  if (!isIntegerInRange(heightValue, MIN_LEVEL_HEIGHT, MAX_LEVEL_HEIGHT)) {
    throw new LevelCodecError("Level height is outside supported bounds.");
  }
  const name = requireString(nameValue, "Level name", 80);
  if (typeof descriptionValue !== "string" || descriptionValue.length > 2_000) {
    throw new LevelCodecError("Level description is invalid.");
  }
  if (typeof difficultyValue !== "string" || !DIFFICULTIES.has(difficultyValue as Difficulty)) {
    throw new LevelCodecError("Level difficulty is invalid.");
  }
  if (typeof mechanicValue !== "string" || !MECHANICS.has(mechanicValue as PrimaryMechanic)) {
    throw new LevelCodecError("Primary mechanic is invalid.");
  }
  if (typeof authorValue !== "string" || !AUTHORS.has(authorValue as LevelMetadata["author"])) {
    throw new LevelCodecError("Level author is invalid.");
  }
  const background = backgroundValue === undefined ? DEFAULT_BACKGROUND_ID : backgroundValue;
  if (!isBackgroundId(background)) {
    throw new LevelCodecError("Level background is unsupported.");
  }
  const createdAt = requireString(createdValue, "Creation timestamp", 64);
  const updatedAt = requireString(updatedValue, "Update timestamp", 64);
  if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) {
    throw new LevelCodecError("Level timestamps must be ISO-compatible dates.");
  }

  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id,
    revision: revisionValue,
    width: widthValue,
    height: heightValue,
    tiles: decodeTileRuns(runs, widthValue, heightValue),
    metadata: {
      name,
      description: descriptionValue,
      difficulty: difficultyValue as Difficulty,
      primaryMechanic: mechanicValue as PrimaryMechanic,
      background,
      author: authorValue as LevelMetadata["author"],
    },
    createdAt,
    updatedAt,
  };
}

function extractCode(input: string): string {
  const trimmed = input.trim();
  if (/^vt\d+\./.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("level");
    const fromHash = new URLSearchParams(url.hash.replace(/^#/, "")).get("level");
    if (fromQuery) {
      return fromQuery;
    }
    if (fromHash) {
      return fromHash;
    }
  } catch {
    // The final error below is more useful than a URL parse error.
  }
  throw new LevelCodecError(`Level code must start with ${LEVEL_CODEC_PREFIX}`);
}

/** Encodes a complete level as a compact, versioned URL-safe string. */
export function encodeLevel(level: LevelDocument): string {
  if (
    level.schemaVersion !== LEVEL_SCHEMA_VERSION ||
    !isIntegerInRange(level.width, MIN_LEVEL_WIDTH, MAX_LEVEL_WIDTH) ||
    !isIntegerInRange(level.height, MIN_LEVEL_HEIGHT, MAX_LEVEL_HEIGHT) ||
    level.tiles.length !== level.height ||
    level.tiles.some((row) => row.length !== level.width || row.some((tile) => !isTileId(tile)))
  ) {
    throw new LevelCodecError("Cannot encode a structurally invalid tile grid.");
  }
  const compact = compactLevel(level);
  // Run the compact form through the same strict checks as imported data so a
  // runtime-cast document cannot produce a share code that fails on receipt.
  expandLevel(compact, LEVEL_CODEC_VERSION);
  const envelope: CodecEnvelopeV2 = [LEVEL_CODEC_VERSION, compact];
  return LEVEL_CODEC_PREFIX + encodeBase64Url(new TextEncoder().encode(JSON.stringify(envelope)));
}

/** Decodes a code, or a full URL containing it in a `level` query/hash parameter. */
export function decodeLevel(input: string): LevelDocument {
  const code = extractCode(input);
  const match = /^vt(\d+)\.(.+)$/.exec(code);
  if (!match) {
    throw new LevelCodecError("Level code prefix is malformed.");
  }
  const version = Number(match[1]);
  if (version !== LEGACY_LEVEL_CODEC_VERSION && version !== LEVEL_CODEC_VERSION) {
    throw new LevelCodecError(`Unsupported level codec version ${version}.`);
  }
  const body = match[2];
  if (!body) {
    throw new LevelCodecError("Level code is empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64Url(body)));
  } catch (error) {
    if (error instanceof LevelCodecError) {
      throw error;
    }
    throw new LevelCodecError("Level code could not be decoded.");
  }
  if (!Array.isArray(parsed) || parsed.length !== 2 || parsed[0] !== version) {
    throw new LevelCodecError("Level payload version does not match its prefix.");
  }
  return expandLevel(parsed[1], version);
}

export function tryDecodeLevel(input: string): DecodeLevelResult {
  try {
    return { ok: true, level: decodeLevel(input) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown level codec error." };
  }
}
