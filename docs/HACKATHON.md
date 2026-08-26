# WebMCP Challenge strategy

## Product thesis

VibeTide Live should win on the *quality of the collaboration loop*, not on the raw count of tools.

Most agent-enabled editors stop when an artifact has been generated. VibeTide makes the generated artifact immediately embodied: a person can play it, produce objective failure data, and let the agent repair the exact revision. The visual editor and the agent tools operate on one shared deterministic state, so the handoff is obvious on screen and easy for judges to trust.

## Judging fit

The official challenge lists usefulness, originality, execution, thoughtful use of WebMCP, and the quality of the human-agent experience.

| Criterion | VibeTide proof |
| --- | --- |
| Usefulness | Nontechnical creators get a valid first draft and precise revisions without learning a level-editor UI |
| Originality | The agent’s output becomes an immediately playable game, and play becomes structured feedback for the next agent action |
| Execution | Deterministic generation, atomic patches, validation, undo, compact sharing, responsive play, and tested schemas |
| Thoughtful WebMCP | Tools expose domain intent such as “platform,” “move goal,” and “playtest report,” not brittle UI clicks |
| Human-agent experience | Agent edits remain visible, humans can paint and undo, and authorship/activity stay legible throughout the session |

## The 75-second demo

**0–8s — Establish the surface**

Open VibeTide Live. Point out that there is no embedded chatbot: the editor is already useful for a person, and the visiting agent discovers nine page tools.

**8–23s — Build through intent**

Ask: “Create Sunset Circuit: moderate, mixed, friendly opening, sea-glass run, fair spike section, reachable finish.” Show the full route appear in one moment and the author switch to Agent.

**23–31s — Prove, don’t promise**

Have the agent call `validate_level`. Keep the green “Ready to ride” state and exact tool result visible.

**31–48s — Play on the same page**

Call `start_playtest`. Control the headphone otter immediately. Intentionally hit one hazard once, then continue or restart.

**48–64s — Close the loop**

Ask the agent to inspect the playtest report, identify the death cluster, and patch a safer platform near that coordinate. Show the revision and activity feed update.

**64–75s — Human agency and handoff**

Paint one tile manually, use agent undo, and call `create_share_link`. End on: “The level, player feedback, and agent are all collaborating through the live page.”

## Demo prompt

> Build me a moderate VibeTide level called Sunset Circuit. Start friendly, introduce slippery sea-glass platforms, add one fair spike challenge, keep the goal reachable, then start a playtest. After I play, inspect the report and make one targeted repair without replacing the whole level.

## What is already complete

- Core state, generation, validation, persistence, undo, codec, and telemetry
- Nine WebMCP tools with schemas, runtime guards, cancellation, and browser verification
- Playable Phaser runtime, three distinct enemy families, and responsive player-first UI
- Original branded coast and an animated eight-frame version of the upright V1 headphone otter
- Manual paint → shared revision → agent inspection/undo round trip
- Automated type, core, geometry, and WebMCP tests

## Remaining submission polish

1. Deploy to a stable HTTPS URL and verify the production origin in ChatGPT’s in-app browser.
2. Add lightweight sound and two or three tactile effects if they improve play without distracting from the WebMCP story.
3. Record the concise build → validate → play → repair → share demo.
4. Add final repository and live-app URLs to Devpost, plus screenshots and the demo video.
5. Run the same scripted demo from a clean browser profile immediately before submission.

## Submission facts to keep straight

- OpenAI’s live challenge page currently lists the deadline as **September 3, 2026 at 1:00 p.m. PT**.
- A submission needs a project description, working live app, code repository, and demo video.
- Ten winners are planned; each receives OpenAI cash and product prizes, with additional supporter prizes.

Always re-check the [official challenge page](https://openai.com/webmcp-challenge/) before the final submission because dates and requirements can change.
