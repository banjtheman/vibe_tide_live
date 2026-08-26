export type SceneId =
  | "hook"
  | "play"
  | "webmcp"
  | "agent-create"
  | "playtest"
  | "build"
  | "share"
  | "close";

export interface StoryScene {
  id: SceneId;
  eyebrow: string;
  headline: string;
  narration: string;
  accent: "coral" | "cyan" | "violet" | "gold" | "green";
}

export const STORY_SCENES: readonly StoryScene[] = [
  {
    id: "hook",
    eyebrow: "A game you can describe",
    headline: "Describe a level. Play it instantly.",
    narration:
      "What if making a game level were as easy as describing the vibe—and the result were playable instantly? This is VibeTide Live: a platformer built for people and agents together.",
    accent: "coral",
  },
  {
    id: "play",
    eyebrow: "Play",
    headline: "Guide the otter to the finish buoy",
    narration:
      "VibeTide is a colorful, browser-based two-dimensional platformer and instant level maker. Guide our headphone-wearing otter to the coral finish buoy. Move with A and D or the arrow keys, jump with Space, or use touch controls on mobile.",
    accent: "cyan",
  },
  {
    id: "webmcp",
    eyebrow: "The breakthrough",
    headline: "The webpage is the tool",
    narration:
      "The breakthrough is WebMCP: an experimental open standard that lets a website expose structured actions to the agent visiting the page. There is no chatbot bolted onto the game. Instead of guessing from pixels, Codex discovers ten real tools to inspect, create, patch, validate, playtest, undo, change the world, and share.",
    accent: "violet",
  },
  {
    id: "agent-create",
    eyebrow: "Human + agent",
    headline: "One request becomes a playable route",
    narration:
      "Watch the loop. We ask Codex for Sunset Circuit: a friendly opening, Neon Moonwave, a sea-glass run, one fair spike challenge, all three enemy types, and a reachable finish. The page's create-level tool updates the editor instantly. Codex validates the route, and Ready to ride confirms it works.",
    accent: "coral",
  },
  {
    id: "playtest",
    eyebrow: "Play becomes feedback",
    headline: "Create. Validate. Play. Learn. Repair.",
    narration:
      "Then we play. A reef crawler patrols, a swell-wing flies overhead, and a tide-spitter launches pearls across the level. If we hit a hazard, the death becomes structured playtest feedback. Codex reads the report and makes one targeted repair without replacing our work.",
    accent: "gold",
  },
  {
    id: "build",
    eyebrow: "People stay in control",
    headline: "Pick a piece and paint the level",
    narration:
      "People stay in control. Switch to Build, choose a piece, and paint right onto the grid. Add solid reef rock, slippery sea glass, deep water, hot vents, coral spikes, or enemies. Rename the level, tune its difficulty, and choose from ten illustrated ocean worlds. Every change is playable immediately.",
    accent: "green",
  },
  {
    id: "share",
    eyebrow: "Share",
    headline: "One URL. Ready to play.",
    narration:
      "When the run feels right, Share creates one compact URL that opens the exact level in Play mode. No account, server upload, or JSON download. A friend can jump in immediately, then switch to Build and remix it.",
    accent: "cyan",
  },
  {
    id: "close",
    eyebrow: "VibeTide Live",
    headline: "Play it. Build it. Share the tide.",
    narration:
      "VibeTide Live turns a conversation into a game—and play into the next creative instruction. The webpage is the tool. Play it. Build it. Share the tide.",
    accent: "coral",
  },
] as const;

export const DEMO_PROMPT =
  "Build me a moderate VibeTide level called Sunset Circuit. Use Neon Moonwave. Start friendly, add a sea-glass run, one fair spike challenge, all three enemies, and a reachable finish. Validate it, then start a playtest.";

export const WEBMCP_TOOLS = [
  "inspect_level",
  "create_level_from_blueprint",
  "apply_level_patch",
  "set_level_metadata",
  "set_level_background",
  "validate_level",
  "get_playtest_report",
  "start_playtest",
  "undo_last_change",
  "create_share_link",
] as const;
