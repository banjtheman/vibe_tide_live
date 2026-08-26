import type {
  LevelDocument,
  PlaytestReport,
} from "../core/contracts";

export type JsonSchema = Readonly<Record<string, unknown>>;

export interface WebMCPToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface WebMCPExecuteOptions {
  signal?: AbortSignal;
}

export interface WebMCPTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: WebMCPToolAnnotations;
  execute(
    input: Record<string, unknown>,
    options?: WebMCPExecuteOptions,
  ): Promise<string>;
}

export interface WebMCPRegisterOptions {
  signal?: AbortSignal;
  exposedTo?: readonly string[];
}

/** Minimal producer-side surface from the 26 August 2026 WebMCP draft. */
export interface WebMCPModelContext {
  registerTool(tool: WebMCPTool, options?: WebMCPRegisterOptions): Promise<void>;
}

export interface VibeTideWebMCPCallbacks {
  /** Runs after the store has entered play mode and opened a playtest report. */
  onStartPlaytest?: (
    report: PlaytestReport,
    options: WebMCPExecuteOptions,
  ) => void | Promise<void>;
  /** Produces a durable link using the host application's canonical codec. */
  createShareLink?: (
    level: LevelDocument,
    options: WebMCPExecuteOptions,
  ) => string | Promise<string>;
}

export interface VibeTideToolsRegistration {
  readonly supported: boolean;
  readonly registeredTools: readonly string[];
  readonly signal: AbortSignal;
  destroy(): void;
  unregister(): void;
}
