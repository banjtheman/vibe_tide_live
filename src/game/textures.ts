import Phaser from "phaser";

import {
  DEFAULT_BACKGROUND_ID,
  backgroundDefinition,
  type BackgroundId,
} from "../core/backgrounds";
import { DEFAULT_TILE_SIZE } from "./geometry";

export const OPTIONAL_OTTER_KEY = "vibetide:otter:asset";
export const V1_OTTER_ATLAS_KEY = "vibetide:otter:v1-atlas";

export function backgroundTextureKey(id: BackgroundId): string {
  return `vibetide:background:${id}`;
}

export const PROCEDURAL_TEXTURES = {
  background: "vibetide:background:procedural",
  player: "vibetide:player:procedural",
  grass: "vibetide:tile:grass",
  rock: "vibetide:tile:rock",
  goal: "vibetide:tile:goal",
  ice: "vibetide:tile:ice",
  vent: "vibetide:tile:vent",
  coral: "vibetide:tile:coral",
  deepWater: "vibetide:tile:deep-water",
  reefCrawler: "vibetide:enemy:reef-crawler",
  swellWingUp: "vibetide:enemy:swell-wing:up",
  swellWingDown: "vibetide:enemy:swell-wing:down",
  tideSpitterIdle: "vibetide:enemy:tide-spitter:idle",
  tideSpitterFire: "vibetide:enemy:tide-spitter:fire",
  tidePearl: "vibetide:enemy:tide-pearl",
} as const;

const BACKDROP_SIZE = 512;

export function queueOptionalVibeTideAssets(
  scene: Phaser.Scene,
  selectedBackground: BackgroundId = DEFAULT_BACKGROUND_ID,
): void {
  for (const backgroundId of new Set([DEFAULT_BACKGROUND_ID, selectedBackground])) {
    const textureKey = backgroundTextureKey(backgroundId);
    if (!scene.textures.exists(textureKey)) {
      scene.load.image(textureKey, backgroundDefinition(backgroundId).assetPath);
    }
  }

  const attemptedKey = "vibetide:optional-assets-attempted";
  if (scene.registry.get(attemptedKey) === true) {
    return;
  }

  scene.registry.set(attemptedKey, true);
  scene.load.image(OPTIONAL_OTTER_KEY, "/assets/vibetide-otter.webp");
  scene.load.spritesheet(V1_OTTER_ATLAS_KEY, "/assets/vibetide-otter-v1-atlas.png", {
    frameWidth: 444,
    frameHeight: 444,
    endFrame: 7,
  });
}

export function ensureProceduralTextures(scene: Phaser.Scene): void {
  createTexture(scene, PROCEDURAL_TEXTURES.background, BACKDROP_SIZE, BACKDROP_SIZE, (pen) => {
    // `Graphics.fillGradientStyle` is WebGL-only and does not survive
    // `generateTexture` in the Canvas renderer used by the game. Layered,
    // opaque bands keep the fallback backdrop deterministic in both renderers.
    pen.fillStyle(0x73cdd2, 1);
    pen.fillRect(0, 0, BACKDROP_SIZE, 180);
    pen.fillStyle(0xa7dcca, 1);
    pen.fillRect(0, 180, BACKDROP_SIZE, 104);
    pen.fillStyle(0xf4ce87, 1);
    pen.fillRect(0, 284, BACKDROP_SIZE, 228);

    pen.fillStyle(0xffe6a8, 0.8);
    pen.fillCircle(410, 94, 58);
    pen.fillStyle(0xfff3c9, 0.72);
    pen.fillCircle(410, 94, 39);

    pen.fillStyle(0xd6f0db, 0.52);
    pen.fillEllipse(82, 95, 146, 34);
    pen.fillEllipse(168, 128, 190, 42);
    pen.fillEllipse(342, 183, 238, 50);

    pen.fillStyle(0x2899a5, 0.58);
    pen.fillRect(0, 280, BACKDROP_SIZE, 232);
    pen.fillStyle(0x42b6b6, 0.5);
    pen.fillRect(0, 316, BACKDROP_SIZE, 196);
    pen.lineStyle(4, 0xbce9d9, 0.58);
    for (let y = 300; y < BACKDROP_SIZE; y += 34) {
      for (let x = -20; x < BACKDROP_SIZE + 40; x += 64) {
        pen.beginPath();
        pen.arc(x + (y % 68), y, 24, Math.PI, Math.PI * 2);
        pen.strokePath();
      }
    }

    pen.fillStyle(0x175f70, 0.12);
    pen.fillEllipse(90, 448, 220, 84);
    pen.fillEllipse(382, 476, 330, 112);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.grass, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    fillOpaqueTile(pen, 0xc87943);
    pen.fillStyle(0xe8ad61, 1);
    pen.fillRect(3, 12, DEFAULT_TILE_SIZE - 6, 16);
    pen.fillStyle(0xb96239, 1);
    pen.fillRect(3, 28, DEFAULT_TILE_SIZE - 6, DEFAULT_TILE_SIZE - 31);
    pen.fillStyle(0xf3cc77, 1);
    pen.fillCircle(10, 22, 3);
    pen.fillCircle(34, 34, 4);
    pen.fillCircle(22, 42, 2);
    pen.fillStyle(0x1f786d, 1);
    pen.fillRect(2, 2, DEFAULT_TILE_SIZE - 4, 11);
    pen.fillStyle(0x71cf8a, 1);
    pen.fillTriangle(3, 12, 9, 2, 14, 12);
    pen.fillTriangle(17, 12, 24, 3, 30, 12);
    pen.fillTriangle(34, 12, 40, 3, 46, 12);
    strokeOpaqueTile(pen, 0x174a4c);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.rock, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    fillOpaqueTile(pen, 0x275b68);
    pen.fillStyle(0x477f86, 1);
    pen.fillRect(3, 3, DEFAULT_TILE_SIZE - 6, 21);
    pen.fillStyle(0x1d495b, 1);
    pen.fillRect(3, 24, DEFAULT_TILE_SIZE - 6, DEFAULT_TILE_SIZE - 27);
    pen.fillStyle(0x78aaa3, 1);
    pen.fillTriangle(4, 5, 28, 4, 18, 22);
    pen.fillStyle(0x3a7379, 1);
    pen.fillTriangle(28, 24, 46, 13, 44, 37);
    pen.fillStyle(0x173e50, 1);
    pen.fillTriangle(3, 42, 20, 25, 28, 47);
    pen.lineStyle(2, 0xa8d2bd, 1);
    pen.lineBetween(6, 7, 25, 6);
    strokeOpaqueTile(pen, 0x123b4b);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.goal, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.lineStyle(4, 0x305a68, 1);
    pen.lineBetween(24, 15, 24, 46);
    pen.fillStyle(0xff724c, 1);
    pen.fillRoundedRect(11, 5, 26, 24, 11);
    pen.fillStyle(0xfff4d6, 1);
    pen.fillRect(12, 13, 24, 7);
    pen.fillStyle(0xffa25c, 1);
    pen.fillCircle(24, 7, 4);
    pen.fillStyle(0x1b7180, 1);
    pen.fillEllipse(24, 44, 27, 6);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.ice, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    fillOpaqueTile(pen, 0x55b7c7);
    pen.fillStyle(0xbdeee8, 1);
    pen.fillRect(3, 3, DEFAULT_TILE_SIZE - 6, 21);
    pen.fillStyle(0x6fcbd7, 1);
    pen.fillRect(3, 24, DEFAULT_TILE_SIZE - 6, DEFAULT_TILE_SIZE - 27);
    pen.fillStyle(0xffffff, 1);
    pen.fillTriangle(5, 8, 33, 4, 12, 24);
    pen.fillStyle(0x9ee9e5, 1);
    pen.fillTriangle(18, 42, 42, 18, 43, 43);
    pen.lineStyle(2, 0xe9fffa, 1);
    pen.lineBetween(4, 10, 43, 10);
    pen.lineBetween(13, 29, 22, 21);
    pen.lineBetween(22, 21, 31, 29);
    strokeOpaqueTile(pen, 0x237b91);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.vent, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    fillOpaqueTile(pen, 0x292f43);
    pen.fillStyle(0x574853, 1);
    pen.fillRect(3, 14, DEFAULT_TILE_SIZE - 6, 15);
    pen.fillStyle(0x252e40, 1);
    pen.fillRect(3, 29, DEFAULT_TILE_SIZE - 6, 16);
    pen.fillStyle(0x511f35, 1);
    pen.fillRect(3, 3, DEFAULT_TILE_SIZE - 6, 12);
    pen.fillStyle(0xff6845, 1);
    pen.fillTriangle(7, 22, 13, 1, 19, 22);
    pen.fillTriangle(18, 22, 25, 5, 31, 22);
    pen.fillTriangle(29, 22, 37, 0, 42, 22);
    pen.fillStyle(0xffc45f, 1);
    pen.fillTriangle(11, 21, 14, 10, 17, 21);
    pen.fillTriangle(23, 21, 26, 13, 29, 21);
    pen.lineStyle(2, 0x151d2d, 1);
    pen.lineBetween(6, 32, 42, 32);
    pen.lineBetween(10, 40, 38, 40);
    strokeOpaqueTile(pen, 0x141d2b);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.coral, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    fillOpaqueTile(pen, 0xc85f52);
    pen.fillStyle(0xe7a35e, 1);
    pen.fillRect(3, 3, DEFAULT_TILE_SIZE - 6, DEFAULT_TILE_SIZE - 6);
    pen.fillStyle(0xf45f68, 1);
    pen.fillTriangle(1, 38, 8, 8, 15, 38);
    pen.fillTriangle(11, 38, 20, 0, 28, 38);
    pen.fillTriangle(24, 38, 33, 11, 40, 38);
    pen.fillTriangle(35, 38, 43, 5, 48, 38);
    pen.fillStyle(0xffc071, 1);
    pen.fillTriangle(6, 35, 9, 19, 12, 35);
    pen.fillTriangle(28, 35, 33, 21, 37, 35);
    pen.fillStyle(0xa94150, 1);
    pen.fillRect(3, 38, DEFAULT_TILE_SIZE - 6, 7);
    strokeOpaqueTile(pen, 0x743b46);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.deepWater, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    fillOpaqueTile(pen, 0x0d3d5a);
    pen.fillStyle(0x197581, 1);
    pen.fillRect(3, 3, DEFAULT_TILE_SIZE - 6, 21);
    pen.fillStyle(0x103f5c, 1);
    pen.fillRect(3, 24, DEFAULT_TILE_SIZE - 6, DEFAULT_TILE_SIZE - 27);
    pen.lineStyle(3, 0x83ddd0, 1);
    pen.beginPath();
    pen.moveTo(3, 9);
    pen.lineTo(8, 4);
    pen.lineTo(16, 8);
    pen.lineTo(24, 4);
    pen.lineTo(32, 8);
    pen.lineTo(40, 4);
    pen.lineTo(45, 8);
    pen.strokePath();
    pen.lineStyle(2, 0x5ab8b7, 1);
    pen.lineBetween(8, 23, 32, 23);
    pen.lineBetween(19, 36, 44, 36);
    strokeOpaqueTile(pen, 0x092f4a);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.player, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.fillStyle(0x8e5839);
    pen.fillEllipse(37, 34, 23, 10);
    pen.fillStyle(0x9f6844);
    pen.fillEllipse(24, 30, 28, 31);
    pen.fillCircle(23, 15, 13);
    pen.fillCircle(14, 7, 5);
    pen.fillCircle(32, 7, 5);
    pen.fillStyle(0xe4b27a);
    pen.fillEllipse(21, 20, 17, 13);
    pen.fillStyle(0x193743);
    pen.fillCircle(18, 12, 2);
    pen.fillCircle(28, 12, 2);
    pen.fillCircle(22, 19, 2.5);
    pen.lineStyle(1.5, 0x593624, 0.9);
    pen.lineBetween(21, 22, 16, 24);
    pen.lineBetween(23, 22, 28, 24);
    pen.fillStyle(0xffc780, 0.9);
    pen.fillEllipse(24, 36, 15, 7);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.reefCrawler, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.lineStyle(4, 0x244f55, 1);
    pen.lineBetween(13, 28, 4, 36);
    pen.lineBetween(16, 33, 9, 43);
    pen.lineBetween(35, 28, 44, 36);
    pen.lineBetween(32, 33, 39, 43);
    pen.fillStyle(0x163f48, 1);
    pen.fillEllipse(24, 40, 34, 6);
    pen.fillStyle(0x42b7a1, 1);
    pen.fillRoundedRect(9, 17, 30, 21, 10);
    pen.fillStyle(0x28757b, 1);
    pen.fillRoundedRect(11, 29, 26, 7, 4);
    pen.lineStyle(2, 0x173641, 1);
    pen.strokeRoundedRect(9, 17, 30, 21, 10);
    pen.fillStyle(0xf2a65e, 1);
    pen.fillTriangle(15, 19, 8, 7, 22, 17);
    pen.fillTriangle(33, 19, 40, 7, 27, 17);
    pen.fillStyle(0xf8eed2);
    pen.fillCircle(18, 23, 4);
    pen.fillCircle(30, 23, 4);
    pen.fillStyle(0x173641);
    pen.fillCircle(19, 23, 2);
    pen.fillCircle(29, 23, 2);
    pen.lineStyle(2, 0x173641, 0.8);
    pen.beginPath();
    pen.arc(24, 29, 6, 0.15, Math.PI - 0.15);
    pen.strokePath();
  });

  createTexture(scene, PROCEDURAL_TEXTURES.swellWingUp, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.fillStyle(0x194e62, 0.24);
    pen.fillEllipse(24, 40, 30, 6);
    pen.fillStyle(0x6a7fd7);
    pen.fillTriangle(23, 27, 2, 7, 8, 32);
    pen.fillTriangle(25, 27, 46, 7, 40, 32);
    pen.fillStyle(0x95a7ef);
    pen.fillTriangle(20, 24, 8, 12, 12, 29);
    pen.fillTriangle(28, 24, 40, 12, 36, 29);
    pen.fillStyle(0x4265ac);
    pen.fillEllipse(24, 27, 22, 25);
    pen.fillTriangle(20, 35, 24, 47, 28, 35);
    pen.fillStyle(0xe9f8ef);
    pen.fillCircle(20, 24, 3);
    pen.fillCircle(28, 24, 3);
    pen.fillStyle(0x173641);
    pen.fillCircle(20, 24, 1.5);
    pen.fillCircle(28, 24, 1.5);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.swellWingDown, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.fillStyle(0x194e62, 0.24);
    pen.fillEllipse(24, 42, 30, 6);
    pen.fillStyle(0x6a7fd7);
    pen.fillTriangle(21, 25, 2, 33, 12, 41);
    pen.fillTriangle(27, 25, 46, 33, 36, 41);
    pen.fillStyle(0x95a7ef);
    pen.fillTriangle(19, 29, 8, 33, 14, 37);
    pen.fillTriangle(29, 29, 40, 33, 34, 37);
    pen.fillStyle(0x4265ac);
    pen.fillEllipse(24, 25, 22, 25);
    pen.fillTriangle(20, 34, 24, 47, 28, 34);
    pen.fillStyle(0xe9f8ef);
    pen.fillCircle(20, 22, 3);
    pen.fillCircle(28, 22, 3);
    pen.fillStyle(0x173641);
    pen.fillCircle(20, 22, 1.5);
    pen.fillCircle(28, 22, 1.5);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.tideSpitterIdle, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.fillStyle(0x153e55, 0.26);
    pen.fillEllipse(24, 42, 34, 6);
    pen.fillStyle(0xe16e71);
    pen.fillRoundedRect(10, 20, 28, 21, 10);
    pen.fillStyle(0xf39b79);
    pen.fillTriangle(13, 23, 8, 10, 20, 21);
    pen.fillTriangle(28, 21, 35, 8, 38, 25);
    pen.fillStyle(0x275f76);
    pen.fillRoundedRect(27, 23, 19, 10, 5);
    pen.fillStyle(0x173641);
    pen.fillCircle(43, 28, 3);
    pen.fillStyle(0xf8eed2);
    pen.fillCircle(18, 25, 4);
    pen.fillStyle(0x173641);
    pen.fillCircle(19, 25, 2);
    pen.fillStyle(0xffcf79, 0.9);
    pen.fillCircle(16, 36, 3);
    pen.fillCircle(29, 37, 3);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.tideSpitterFire, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.fillStyle(0x153e55, 0.26);
    pen.fillEllipse(22, 42, 34, 6);
    pen.fillStyle(0xe16e71);
    pen.fillRoundedRect(8, 20, 28, 21, 10);
    pen.fillStyle(0xf39b79);
    pen.fillTriangle(11, 23, 6, 10, 18, 21);
    pen.fillTriangle(26, 21, 33, 8, 36, 25);
    pen.fillStyle(0x327e91);
    pen.fillRoundedRect(25, 21, 23, 14, 7);
    pen.fillStyle(0x102f43);
    pen.fillCircle(44, 28, 4);
    pen.fillStyle(0xf8eed2);
    pen.fillCircle(16, 25, 4);
    pen.fillStyle(0x173641);
    pen.fillCircle(17, 25, 2);
    pen.fillStyle(0xffcf79, 0.9);
    pen.fillCircle(14, 36, 3);
    pen.fillCircle(27, 37, 3);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.tidePearl, 20, 20, (pen) => {
    // Strong, fully opaque comet silhouette so it reads clearly while crossing
    // the illustrated backdrop; the runtime controls its travel direction.
    pen.fillStyle(0x123f59, 1);
    pen.fillTriangle(0, 10, 11, 2, 11, 18);
    pen.fillCircle(12, 10, 8);
    pen.fillStyle(0x2caab9, 1);
    pen.fillTriangle(3, 10, 12, 5, 12, 15);
    pen.fillCircle(12, 10, 6);
    pen.fillStyle(0x8ff3e0, 1);
    pen.fillCircle(13, 10, 4);
    pen.fillStyle(0xf8fff1, 1);
    pen.fillCircle(15, 8, 2);
    pen.lineStyle(2, 0x123f59, 1);
    pen.strokeCircle(12, 10, 7);
  });
}

function createTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (pen: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const pen = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(pen);
  pen.generateTexture(key, width, height);
  pen.destroy();
}

function fillOpaqueTile(pen: Phaser.GameObjects.Graphics, color: number): void {
  pen.fillStyle(color, 1);
  pen.fillRect(0, 0, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE);
}

function strokeOpaqueTile(pen: Phaser.GameObjects.Graphics, color: number): void {
  pen.lineStyle(3, color, 1);
  pen.strokeRect(1.5, 1.5, DEFAULT_TILE_SIZE - 3, DEFAULT_TILE_SIZE - 3);
}
