export const BACKGROUND_IDS = [
  "golden-coast",
  "neon-moonwave",
  "bioluminescent-grotto",
  "stormglass-reef",
  "moonlit-lagoon",
  "aurora-current",
  "sunken-temple",
  "kelp-cathedral",
  "starlight-tidepool",
  "festival-shore",
] as const;

export type BackgroundId = (typeof BACKGROUND_IDS)[number];

export interface BackgroundDefinition {
  id: BackgroundId;
  name: string;
  description: string;
  assetPath: string;
  thumbnailPath: string;
}

export const DEFAULT_BACKGROUND_ID: BackgroundId = "golden-coast";

export const BACKGROUND_DEFINITIONS: readonly BackgroundDefinition[] = [
  {
    id: "golden-coast",
    name: "Golden Coast",
    description: "Warm sunset palms and bright turquoise surf.",
    assetPath: "/assets/vibetide-background.webp",
    thumbnailPath: "/assets/backgrounds/thumbs/golden-coast.webp",
  },
  {
    id: "neon-moonwave",
    name: "Neon Moonwave",
    description: "Midnight swells beneath a violet moon.",
    assetPath: "/assets/backgrounds/neon-moonwave.webp",
    thumbnailPath: "/assets/backgrounds/thumbs/neon-moonwave.webp",
  },
  {
    id: "bioluminescent-grotto",
    name: "Glow Grotto",
    description: "Teal cave light and violet crystal edges.",
    assetPath: "/assets/backgrounds/bioluminescent-grotto.webp",
    thumbnailPath: "/assets/backgrounds/thumbs/bioluminescent-grotto.webp",
  },
  {
    id: "stormglass-reef",
    name: "Stormglass Reef",
    description: "Silver rain shafts over a restless teal sea.",
    assetPath: "/assets/backgrounds/stormglass-reef.webp",
    thumbnailPath: "/assets/backgrounds/thumbs/stormglass-reef.webp",
  },
  {
    id: "moonlit-lagoon",
    name: "Moonlit Lagoon",
    description: "A pearl moon above a quiet tropical bay.",
    assetPath: "/assets/backgrounds/moonlit-lagoon.webp",
    thumbnailPath: "/assets/backgrounds/thumbs/moonlit-lagoon.webp",
  },
  {
    id: "aurora-current",
    name: "Aurora Current",
    description: "Turquoise and violet ribbons above dark water.",
    assetPath: "/assets/backgrounds/aurora-current.webp",
    thumbnailPath: "/assets/backgrounds/thumbs/aurora-current.webp",
  },
  {
    id: "sunken-temple",
    name: "Sunken Temple",
    description: "Coral ruins frame a misty turquoise bay.",
    assetPath: "/assets/backgrounds/sunken-temple.webp",
    thumbnailPath: "/assets/backgrounds/thumbs/sunken-temple.webp",
  },
  {
    id: "kelp-cathedral",
    name: "Kelp Cathedral",
    description: "Emerald light through a towering underwater forest.",
    assetPath: "/assets/backgrounds/kelp-cathedral.webp",
    thumbnailPath: "/assets/backgrounds/thumbs/kelp-cathedral.webp",
  },
  {
    id: "starlight-tidepool",
    name: "Starlight Tidepool",
    description: "Cosmic reflections along an ink-blue shore.",
    assetPath: "/assets/backgrounds/starlight-tidepool.webp",
    thumbnailPath: "/assets/backgrounds/thumbs/starlight-tidepool.webp",
  },
  {
    id: "festival-shore",
    name: "Festival Shore",
    description: "Coral dusk with rhythmic lights at the water’s edge.",
    assetPath: "/assets/backgrounds/festival-shore.webp",
    thumbnailPath: "/assets/backgrounds/thumbs/festival-shore.webp",
  },
] as const;

const BACKGROUND_ID_SET = new Set<string>(BACKGROUND_IDS);

export function isBackgroundId(value: unknown): value is BackgroundId {
  return typeof value === "string" && BACKGROUND_ID_SET.has(value);
}

export function backgroundDefinition(id: BackgroundId): BackgroundDefinition {
  return BACKGROUND_DEFINITIONS.find((definition) => definition.id === id) ?? BACKGROUND_DEFINITIONS[0]!;
}
