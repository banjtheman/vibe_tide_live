# Art direction and provenance

## Direction

VibeTide Live keeps the original project’s ocean-and-music identity, but moves away from the older glossy neon presentation toward a tactile golden-hour coast:

- warm parchment, coral, sea-glass teal, deep ink navy, and dusty violet
- hand-painted paper-cut forms with subtle canvas texture
- readable silhouettes and quiet center fields that do not compete with level geometry
- the headphone-wearing otter remains the identity anchor

## Generated source assets

The source PNGs in `art/source/` were generated with OpenAI ImageGen on August 26, 2026 for this repository:

- `vibetide-background.png` — original wide tropical shoreline, with no borrowed characters, logos, or platform elements
- `vibetide-otter.png` — the first new painted otter exploration, retained as a fallback asset
- `vibetide-otter-v1-atlas.png` — the production identity-preserving animation source, based on the original upright V1 otter and its purple headphones with cyan inner rings
- `public/og.png` — the wide social card used by Open Graph and X previews, generated with the built-in ImageGen tool from the brief in `art/source/vibetide-social-card.prompt.txt`

The primary runtime atlas in `public/assets/vibetide-otter-v1-atlas.png` contains two idle frames, four run frames, one jump frame, and one fall frame. ImageGen performed the character-preserving redraw and alpha extraction; a deterministic post-process isolated the eight connected sprites, centered them in equal 444 × 444 cells, and aligned them to one baseline. The exact generation brief and references are recorded beside the source atlas.

Enemy art is drawn procedurally in Phaser so crawlers, flyers, spitters, and projectiles remain crisp, lightweight, and original at every scale.

No old Unity package, Corgi Engine asset, or third-party game art is included.
