import Phaser from "phaser";

import { DEFAULT_TILE_SIZE } from "./geometry";

export const OPTIONAL_BACKGROUND_KEY = "vibetide:background:asset";
export const OPTIONAL_OTTER_KEY = "vibetide:otter:asset";

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
} as const;

const BACKDROP_SIZE = 512;

export function queueOptionalVibeTideAssets(scene: Phaser.Scene): void {
  const attemptedKey = "vibetide:optional-assets-attempted";
  if (scene.registry.get(attemptedKey) === true) {
    return;
  }

  scene.registry.set(attemptedKey, true);
  scene.load.image(OPTIONAL_BACKGROUND_KEY, "/assets/vibetide-background.webp");
  scene.load.image(OPTIONAL_OTTER_KEY, "/assets/vibetide-otter.webp");
}

export function ensureProceduralTextures(scene: Phaser.Scene): void {
  createTexture(scene, PROCEDURAL_TEXTURES.background, BACKDROP_SIZE, BACKDROP_SIZE, (pen) => {
    pen.fillGradientStyle(0x73cdd2, 0x8cddd8, 0xf7d58f, 0xf2bc72, 1);
    pen.fillRect(0, 0, BACKDROP_SIZE, BACKDROP_SIZE);

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
    pen.fillGradientStyle(0xd79a55, 0xe9b767, 0xb76f40, 0xc98148, 1);
    pen.fillRect(0, 0, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE);
    pen.fillStyle(0xf0cb79, 0.34);
    pen.fillCircle(10, 22, 3);
    pen.fillCircle(34, 34, 4);
    pen.fillCircle(22, 43, 2);
    pen.fillStyle(0x2c8d73);
    pen.fillRoundedRect(0, 0, DEFAULT_TILE_SIZE, 10, 4);
    pen.fillStyle(0x66bd7d);
    pen.fillTriangle(3, 9, 9, 0, 13, 9);
    pen.fillTriangle(18, 9, 24, 1, 29, 9);
    pen.fillTriangle(35, 9, 40, 2, 46, 9);
    pen.lineStyle(2, 0x8d5638, 0.45);
    pen.strokeRoundedRect(1, 1, DEFAULT_TILE_SIZE - 2, DEFAULT_TILE_SIZE - 2, 5);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.rock, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.fillGradientStyle(0x306775, 0x3d7c84, 0x214d60, 0x295767, 1);
    pen.fillRoundedRect(0, 0, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, 6);
    pen.fillStyle(0x6ca0a0, 0.45);
    pen.fillTriangle(4, 5, 27, 3, 18, 21);
    pen.fillTriangle(28, 24, 46, 13, 44, 37);
    pen.fillStyle(0x173e50, 0.48);
    pen.fillTriangle(3, 42, 20, 25, 28, 47);
    pen.lineStyle(2, 0x9ec4b6, 0.25);
    pen.strokeRoundedRect(1, 1, DEFAULT_TILE_SIZE - 2, DEFAULT_TILE_SIZE - 2, 6);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.goal, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.lineStyle(4, 0x305a68, 1);
    pen.lineBetween(24, 15, 24, 46);
    pen.fillStyle(0xff724c);
    pen.fillRoundedRect(11, 5, 26, 24, 11);
    pen.fillStyle(0xfff4d6);
    pen.fillRect(12, 13, 24, 7);
    pen.fillStyle(0xffa25c, 0.9);
    pen.fillCircle(24, 7, 4);
    pen.fillStyle(0x1b7180, 0.86);
    pen.fillEllipse(24, 44, 27, 6);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.ice, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.fillGradientStyle(0xc8f6ed, 0xb1e8e9, 0x6fcbd7, 0x78d3da, 1);
    pen.fillRoundedRect(0, 0, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, 6);
    pen.fillStyle(0xffffff, 0.55);
    pen.fillTriangle(5, 8, 33, 4, 12, 24);
    pen.lineStyle(2, 0xe9fffa, 0.76);
    pen.lineBetween(4, 10, 43, 10);
    pen.lineBetween(13, 29, 22, 21);
    pen.lineBetween(22, 21, 31, 29);
    pen.lineStyle(2, 0x318eaa, 0.4);
    pen.strokeRoundedRect(1, 1, DEFAULT_TILE_SIZE - 2, DEFAULT_TILE_SIZE - 2, 6);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.vent, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.fillGradientStyle(0x443f50, 0x584552, 0x252e40, 0x303144, 1);
    pen.fillRoundedRect(1, 13, 46, 35, 7);
    pen.fillStyle(0xff6845, 0.9);
    pen.fillTriangle(7, 22, 13, 1, 19, 22);
    pen.fillTriangle(18, 22, 25, 5, 31, 22);
    pen.fillTriangle(29, 22, 37, 0, 42, 22);
    pen.fillStyle(0xffbf5f, 0.9);
    pen.fillTriangle(11, 21, 14, 10, 17, 21);
    pen.fillTriangle(23, 21, 26, 13, 29, 21);
    pen.lineStyle(2, 0x161e2e, 0.65);
    pen.lineBetween(6, 32, 42, 32);
    pen.lineBetween(10, 40, 38, 40);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.coral, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.fillStyle(0xd89a57);
    pen.fillRect(0, 36, DEFAULT_TILE_SIZE, 12);
    pen.fillStyle(0xf45f68);
    pen.fillTriangle(1, 38, 8, 8, 15, 38);
    pen.fillTriangle(11, 38, 20, 0, 28, 38);
    pen.fillTriangle(24, 38, 33, 11, 40, 38);
    pen.fillTriangle(35, 38, 43, 5, 48, 38);
    pen.fillStyle(0xffa069, 0.76);
    pen.fillTriangle(6, 35, 9, 19, 12, 35);
    pen.fillTriangle(28, 35, 33, 21, 37, 35);
  });

  createTexture(scene, PROCEDURAL_TEXTURES.deepWater, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, (pen) => {
    pen.fillGradientStyle(0x166b7a, 0x207f87, 0x0f405d, 0x123752, 1);
    pen.fillRect(0, 0, DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE);
    pen.lineStyle(3, 0x83ddd0, 0.8);
    pen.beginPath();
    pen.moveTo(0, 8);
    pen.lineTo(8, 4);
    pen.lineTo(16, 8);
    pen.lineTo(24, 4);
    pen.lineTo(32, 8);
    pen.lineTo(40, 4);
    pen.lineTo(48, 8);
    pen.strokePath();
    pen.lineStyle(2, 0x5ab8b7, 0.28);
    pen.lineBetween(8, 23, 32, 23);
    pen.lineBetween(19, 36, 44, 36);
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
