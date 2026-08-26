# WebMCP implementation notes

## Producer API

VibeTide registers imperative tools with:

```ts
await document.modelContext.registerTool(tool, { signal });
```

`registerVibeTideTools(store, callbacks)` returns the support state, registered names, the registration signal, and `destroy()` / `unregister()` aliases. Aborting the controller removes the page tools.

The app treats execution options defensively because early host implementations may omit the optional invocation object even though the current draft documents `{ signal }`. When supplied, cancellation is checked before and after asynchronous callbacks.

`create_share_link` returns the same self-contained `vt2.` level URL as the human Share action. Current links include `mode=play`, so recipients land directly in the Phaser playtest; legacy `vt1.` links remain readable and older links without a mode continue to open in the builder.

`set_level_background` changes only the level’s visual scene. The ten accepted IDs are `golden-coast`, `neon-moonwave`, `bioluminescent-grotto`, `stormglass-reef`, `moonlit-lagoon`, `aurora-current`, `sunken-temple`, `kelp-cathedral`, `starlight-tidepool`, and `festival-shore`. Blueprint creation accepts the same optional `background` field, and the compact share codec preserves it.

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
| `8` | reef crawler | passable enemy spawn; ground patrol |
| `9` | swell-wing | passable enemy spawn; flying patrol |
| `10` | tide-spitter | passable enemy spawn; ranged attack |

Coordinates start at `(0, 0)` in the top-left. Tile rows returned by `inspect_level` are top-to-bottom integer arrays, which keeps enemy markers and exact edits compact and deterministic.

## Local test harness

`InMemoryModelContext` implements the same producer registration surface for unit tests. It captures tools, observes abort-driven teardown, and invokes handlers with cancellation signals. Browser QA should still exercise the host’s real WebMCP capability because host compatibility issues cannot be caught by the in-memory harness alone.

References:

- [WebMCP draft report](https://webmachinelearning.github.io/webmcp/)
- [OpenAI site-tools guide](https://learn.chatgpt.com/docs/webmcp)
