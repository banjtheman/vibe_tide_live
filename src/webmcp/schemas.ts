import type { JsonSchema } from "./types";

const tileIdSchema = {
  type: "integer",
  enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
} as const;

const difficultySchema = {
  type: "string",
  enum: ["beginner", "moderate", "tricky"],
} as const;

const primaryMechanicSchema = {
  type: "string",
  enum: ["platforming", "ice", "spikes", "water", "mixed"],
} as const;

export const EMPTY_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const satisfies JsonSchema;
export const CREATE_LEVEL_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 60,
      description: "Short player-facing level name.",
    },
    description: {
      type: "string",
      maxLength: 240,
      description: "Short description of the intended experience.",
    },
    width: { type: "integer", minimum: 20, maximum: 80 },
    height: { type: "integer", minimum: 10, maximum: 32 },
    difficulty: difficultySchema,
    primary_mechanic: primaryMechanicSchema,
    seed: { type: "integer", minimum: 0, maximum: 2147483647 },
    sections: {
      type: "array",
      minItems: 1,
      maxItems: 16,
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["run", "gap", "stairs", "ice", "spikes", "water", "finish"],
          },
          length: { type: "integer", minimum: 1, maximum: 40 },
          intensity: { type: "integer", enum: [1, 2, 3] },
        },
        required: ["kind", "length"],
        additionalProperties: false,
      },
    },
  },
  required: ["name"],
  additionalProperties: false,
} as const satisfies JsonSchema;

const coordinateProperties = {
  x: { type: "integer", minimum: 0 },
  y: { type: "integer", minimum: 0 },
} as const;

const patchOperationSchemas = [
  {
    type: "object",
    properties: {
      kind: { const: "set_tile" },
      ...coordinateProperties,
      tile: tileIdSchema,
    },
    required: ["kind", "x", "y", "tile"],
    additionalProperties: false,
  },
  {
    type: "object",
    properties: {
      kind: { const: "fill_rect" },
      ...coordinateProperties,
      width: { type: "integer", minimum: 1 },
      height: { type: "integer", minimum: 1 },
      tile: tileIdSchema,
    },
    required: ["kind", "x", "y", "width", "height", "tile"],
    additionalProperties: false,
  },
  {
    type: "object",
    properties: {
      kind: { const: "clear_rect" },
      ...coordinateProperties,
      width: { type: "integer", minimum: 1 },
      height: { type: "integer", minimum: 1 },
    },
    required: ["kind", "x", "y", "width", "height"],
    additionalProperties: false,
  },
  {
    type: "object",
    properties: {
      kind: { const: "platform" },
      ...coordinateProperties,
      length: { type: "integer", minimum: 1 },
      tile: { type: "integer", enum: [1, 2, 4] },
    },
    required: ["kind", "x", "y", "length", "tile"],
    additionalProperties: false,
  },
  {
    type: "object",
    properties: {
      kind: { const: "move_goal" },
      ...coordinateProperties,
    },
    required: ["kind", "x", "y"],
    additionalProperties: false,
  },
] as const;

export const APPLY_PATCH_SCHEMA = {
  type: "object",
  properties: {
    operations: {
      type: "array",
      minItems: 1,
      maxItems: 64,
      items: { oneOf: patchOperationSchemas },
    },
    reason: {
      type: "string",
      minLength: 1,
      maxLength: 160,
      description: "Brief player-facing reason for this atomic batch of edits.",
    },
  },
  required: ["operations", "reason"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const SET_METADATA_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 60 },
    description: { type: "string", maxLength: 240 },
    difficulty: difficultySchema,
    primary_mechanic: primaryMechanicSchema,
  },
  minProperties: 1,
  additionalProperties: false,
} as const satisfies JsonSchema;
