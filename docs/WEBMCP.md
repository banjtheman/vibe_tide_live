# WebMCP implementation notes

## Producer API

VibeTide registers imperative tools with:

```ts
await document.modelContext.registerTool(tool, { signal });
```

`registerVibeTideTools(store, callbacks)` returns the support state, registered names, the registration signal, and `destroy()` / `unregister()` aliases. Aborting the controller removes the page tools.

The app treats execution options defensively because early host implementations may omit the optional invocation object even though the current draft documents `{ signal }`. When supplied, cancellation is checked before and after asynchronous callbacks.

## Design rules

- Prefer domain operations over DOM imitation.
- Keep read tools side-effect free and mark them with `readOnlyHint`.
- Require a human-readable reason for patch batches.
- Reject additional properties and out-of-range values twice: once via JSON Schema and once at runtime.
- Keep a batch atomic. Either every operation is valid and applies, or none of it does.
- Return concise strings or compact JSON strings so the next model turn has high-signal context.
- Never invent a separate agent state; the human UI, game, and page tools share one `LevelStore` snapshot.

## Tile contract

| ID | Name | Behavior |
| --- | --- | --- |
| `0` | air | empty |
| `1` | dune grass | solid |
| `2` | reef rock | solid |
| `3` | finish buoy | goal |
| `4` | sea glass | slippery solid |
| `5` | hot vent | hazard |
| `6` | coral spikes | hazard |
| `7` | deep water | hazard |

Coordinates start at `(0, 0)` in the top-left. Tile rows returned by `inspect_level` are top-to-bottom strings, which makes exact inspection compact and deterministic.

## Local test harness

`InMemoryModelContext` implements the same producer registration surface for unit tests. It captures tools, observes abort-driven teardown, and invokes handlers with cancellation signals. Browser QA should still exercise the host’s real WebMCP capability because host compatibility issues cannot be caught by the in-memory harness alone.

References:

- [WebMCP draft report](https://webmachinelearning.github.io/webmcp/)
- [OpenAI site-tools guide](https://learn.chatgpt.com/docs/webmcp)
