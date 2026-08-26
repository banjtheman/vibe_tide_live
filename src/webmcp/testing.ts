import type {
  WebMCPExecuteOptions,
  WebMCPModelContext,
  WebMCPRegisterOptions,
  WebMCPTool,
} from "./types";

/** In-memory producer/consumer harness for tests and local smoke checks. */
export class InMemoryModelContext implements WebMCPModelContext {
  readonly tools = new Map<string, WebMCPTool>();

  async registerTool(tool: WebMCPTool, options: WebMCPRegisterOptions = {}): Promise<void> {
    if (options.signal?.aborted) {
      return;
    }
    if (tool.name.trim().length === 0 || tool.description.trim().length === 0) {
      throw new TypeError("WebMCP tools require non-empty names and descriptions.");
    }
    if (this.tools.has(tool.name)) {
      throw new DOMException(`A tool named ${tool.name} is already registered.`, "InvalidStateError");
    }

    this.tools.set(tool.name, tool);
    options.signal?.addEventListener(
      "abort",
      () => {
        if (this.tools.get(tool.name) === tool) {
          this.tools.delete(tool.name);
        }
      },
      { once: true },
    );
  }

  getTools(): readonly WebMCPTool[] {
    return [...this.tools.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  async invoke(
    name: string,
    input: Record<string, unknown> = {},
    signal: AbortSignal = new AbortController().signal,
  ): Promise<string> {
    const tool = this.tools.get(name);
    if (tool === undefined) {
      throw new DOMException(`No registered tool named ${name}.`, "NotFoundError");
    }
    const options: WebMCPExecuteOptions = { signal };
    return tool.execute(input, options);
  }
}
