# VibeTide Live

**A live 2D platformer workbench where people and agents build, playtest, and repair the same level on the same page.**

VibeTide Live is a fresh Phaser implementation of the original VibeTide idea, built for the 2026 WebMCP Challenge. There is deliberately no chatbot inside the app. A WebMCP-capable browser discovers the page’s structured level-design tools, so ChatGPT or Codex can create a playable route, revise exact tiles, start the game, inspect playtest telemetry, and produce a share link without guessing through the visual UI.

![VibeTide coastal art](public/assets/vibetide-background.webp)

## The loop

1. A person asks their visiting agent for a level in ordinary language.
2. The agent calls `create_level_from_blueprint` and `validate_level`.
3. The new route appears instantly in the visual editor.
4. The person plays it immediately—no export or rebuild step.
5. Deaths and completion are recorded as structured playtest telemetry.
6. The agent reads the report, patches the problem area, and hands back a new revision.
7. Either collaborator can undo or create a compact playable URL.

That closed loop is the point: WebMCP turns a game editor into a shared creative surface, not a form an agent fills out on someone’s behalf.

## What works now

- Deterministic blueprint-to-level generation with platforming, gaps, stairs, sea glass, spikes, and water
- Atomic tile patches, metadata edits, revision history, undo, and local persistence
- Conservative structural and reachability validation
- Phaser 3 side-scrolling runtime with Arcade physics, coyote time, jump buffering, ice momentum, hazards, goals, camera follow, keyboard controls, and mobile touch controls
- Playtest sessions with completion, elapsed time, deaths, recent events, and death clustering
- Compact versioned `vt1.` level codec for playable share URLs
- Nine imperative WebMCP tools registered directly on `document.modelContext`
- Responsive workbench UI with manual grid painting and visible human/agent/game activity
- Original VibeTide coastal art and a headphone-wearing otter hero

## Page tools

| Tool | Purpose |
| --- | --- |
| `inspect_level` | Read metadata, revision, mode, validation, and exact tile rows |
| `create_level_from_blueprint` | Generate a complete playable level from bounded creative intent |
| `apply_level_patch` | Atomically set tiles, fill/clear areas, add platforms, or move the goal |
| `set_level_metadata` | Rename or retune the player-facing level details |
| `validate_level` | Check spawn, goal, structure, and conservative reachability |
| `get_playtest_report` | Read completion, timing, deaths, clusters, and recent events |
| `start_playtest` | Enter play mode and begin a telemetry session |
| `undo_last_change` | Restore the previous level content as a new revision |
| `create_share_link` | Encode the current revision into a playable URL |

All inputs have narrow JSON Schemas and a second runtime-validation layer. Mutations are bounded, patch batches are atomic, and the registration is torn down with an `AbortController`.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:4173/` in ChatGPT’s in-app browser or a compatible experimental browser. Try:

> Build me a moderate VibeTide level called Sunset Circuit. Start friendly, introduce slippery sea-glass platforms, add one fair spike challenge, keep the goal reachable, then start a playtest.

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

## Architecture

```text
Human editor ─┐
              ├─> LevelStore ─> frozen snapshot ─> editor + Phaser scene
WebMCP tools ─┘       │                              │
                     ├─> validator + undo            └─> playtest events
                     └─> vt1 URL codec <──────────────────────┘
```

- `src/core` is framework-free level state, generation, validation, telemetry aggregation, persistence, and encoding.
- `src/webmcp` is the standards-facing producer layer and its independent input validators.
- `src/game` is the Phaser runtime and input/physics integration.
- `src/ui` is the human workbench and manual tile editor.

## Browser compatibility

WebMCP is experimental. The ordinary editor and game work without it; the agent tool surface activates only when `document.modelContext` is present. The game intentionally uses Phaser’s Canvas renderer because it is reliable inside embedded agent browsers as well as ordinary desktop and mobile browsers.

The implementation follows the current [WebMCP draft](https://webmachinelearning.github.io/webmcp/) and OpenAI’s [site-tools guide](https://learn.chatgpt.com/docs/webmcp).

## Project notes

- [Hackathon strategy and demo script](docs/HACKATHON.md)
- [WebMCP integration notes](docs/WEBMCP.md)
- [Art direction and provenance](docs/ART.md)

The repository is intentionally independent from the older Unity, iOS, and MCP experiments. No Corgi Engine code or licensed Unity package is used.
