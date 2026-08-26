import Phaser from "phaser";

import type { GridPoint, LevelDocument, StudioSnapshot, TileId } from "../core/contracts";
import {
  DEFAULT_TILE_SIZE,
  cellCenter,
  findLeftmostStandableCell,
  levelPixelBounds,
  tileAt,
  tileAtWorldPoint,
  worldToGridPoint,
} from "./geometry";
import type { SharedControlState } from "./input";
import {
  OPTIONAL_BACKGROUND_KEY,
  OPTIONAL_OTTER_KEY,
  PROCEDURAL_TEXTURES,
  ensureProceduralTextures,
  queueOptionalVibeTideAssets,
} from "./textures";

export const VIBE_TIDE_SCENE_KEY = "vibetide-live-runtime";

export interface VibeTideSceneHooks {
  readSnapshot(): StudioSnapshot;
  onPlayStarted(position: GridPoint, revision: number): void;
  onPlayerDeath(position: GridPoint): void;
  onLevelComplete(position: GridPoint): void;
}

const PLAYER_WIDTH = 74;
const PLAYER_HEIGHT = 50;
const RUN_SPEED = 300;
const ICE_RUN_SPEED = 430;
const JUMP_VELOCITY = 610;
const GRAVITY = 1_480;
const COYOTE_WINDOW_MS = 110;
const JUMP_BUFFER_MS = 130;

export class VibeTideScene extends Phaser.Scene {
  private readonly hooks: VibeTideSceneHooks;
  private readonly sharedControls: SharedControlState;

  private level: LevelDocument | null = null;
  private player: Phaser.Physics.Arcade.Sprite | null = null;
  private solids: Phaser.Physics.Arcade.StaticGroup | null = null;
  private hazards: Phaser.Physics.Arcade.StaticGroup | null = null;
  private goals: Phaser.Physics.Arcade.StaticGroup | null = null;
  private backdrop: Phaser.GameObjects.Image | null = null;
  private spawnCell: GridPoint = { x: 0, y: 0 };
  private isPlayMode = false;
  private isRespawning = false;
  private isComplete = false;
  private lastGroundedAt = Number.NEGATIVE_INFINITY;
  private jumpBufferedAt = Number.NEGATIVE_INFINITY;
  private lastTouchJumpSequence = 0;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private keyA: Phaser.Input.Keyboard.Key | null = null;
  private keyD: Phaser.Input.Keyboard.Key | null = null;
  private keyW: Phaser.Input.Keyboard.Key | null = null;

  constructor(hooks: VibeTideSceneHooks, controls: SharedControlState) {
    super({ key: VIBE_TIDE_SCENE_KEY });
    this.hooks = hooks;
    this.sharedControls = controls;
  }

  preload(): void {
    queueOptionalVibeTideAssets(this);
  }

  create(): void {
    const snapshot = this.hooks.readSnapshot();
    this.level = snapshot.level;
    this.isPlayMode = snapshot.mode === "play";
    this.isRespawning = false;
    this.isComplete = false;
    this.player = null;
    this.lastGroundedAt = Number.NEGATIVE_INFINITY;
    this.jumpBufferedAt = Number.NEGATIVE_INFINITY;
    this.lastTouchJumpSequence = this.sharedControls.jumpSequence;

    ensureProceduralTextures(this);
    this.createBackdrop();
    this.createLevelTiles(snapshot.level);
    this.configureCamera(snapshot.level);

    if (this.isPlayMode) {
      this.physics.world.resume();
      this.createPlayer(snapshot.level);
      this.configureControls();
      this.hooks.onPlayStarted(this.spawnCell, snapshot.level.revision);
    } else {
      this.physics.world.pause();
      this.centerPreviewOnSpawn(snapshot.level);
    }

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.handleResize(this.scale.gameSize);
  }

  update(time: number): void {
    if (!this.isPlayMode || this.isComplete || this.isRespawning || this.player === null) {
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) {
      this.lastGroundedAt = time;
    }

    const onIce = grounded && this.isPlayerOnIce(body);
    const horizontalInput = this.readHorizontalInput();
    const acceleration = onIce ? 760 : grounded ? 2_250 : 1_180;
    const drag = onIce ? 65 : grounded ? 1_850 : 90;
    const maximumSpeed = onIce ? ICE_RUN_SPEED : RUN_SPEED;

    this.player.setAccelerationX(horizontalInput * acceleration);
    this.player.setDragX(drag);
    this.player.setMaxVelocity(maximumSpeed, 900);

    if (horizontalInput < 0) {
      this.player.setFlipX(true);
    } else if (horizontalInput > 0) {
      this.player.setFlipX(false);
    }

    if (this.readJumpPressed()) {
      this.jumpBufferedAt = time;
    }

    const isJumpBuffered = time - this.jumpBufferedAt <= JUMP_BUFFER_MS;
    const canUseCoyoteTime = time - this.lastGroundedAt <= COYOTE_WINDOW_MS;
    if (isJumpBuffered && canUseCoyoteTime) {
      this.player.setVelocityY(-JUMP_VELOCITY);
      this.jumpBufferedAt = Number.NEGATIVE_INFINITY;
      this.lastGroundedAt = Number.NEGATIVE_INFINITY;
    }

    const bounds = levelPixelBounds(this.level ?? { width: 1, height: 1 });
    if (
      this.player.y > bounds.height + DEFAULT_TILE_SIZE * 1.5 ||
      this.player.x < -DEFAULT_TILE_SIZE ||
      this.player.x > bounds.width + DEFAULT_TILE_SIZE
    ) {
      this.killPlayer();
    }
  }

  getCurrentGridPosition(): GridPoint {
    if (this.level === null || this.player === null) {
      return this.spawnCell;
    }

    return worldToGridPoint({ x: this.player.x, y: this.player.y }, this.level);
  }

  private createBackdrop(): void {
    const texture = this.textures.exists(OPTIONAL_BACKGROUND_KEY)
      ? OPTIONAL_BACKGROUND_KEY
      : PROCEDURAL_TEXTURES.background;

    this.backdrop = this.add.image(0, 0, texture).setOrigin(0).setScrollFactor(0).setDepth(-100);
  }

  private createLevelTiles(level: LevelDocument): void {
    const bounds = levelPixelBounds(level);
    this.physics.world.setBounds(
      0,
      0,
      bounds.width,
      bounds.height + DEFAULT_TILE_SIZE * 3,
      false,
      false,
      false,
      false,
    );

    this.solids = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();
    this.goals = this.physics.add.staticGroup();

    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const tile = tileAt(level, x, y);
        if (tile === undefined || tile === 0) {
          continue;
        }

        const center = cellCenter({ x, y });
        if (tile === 1 || tile === 2 || tile === 4) {
          this.addStaticTile(this.solids, center, this.textureFor(tile), tile);
        } else if (tile === 3) {
          const goal = this.addStaticTile(this.goals, center, this.textureFor(tile), tile);
          goal.setDepth(4);
          this.tweens.add({
            targets: goal,
            angle: { from: -2.5, to: 2.5 },
            duration: 1_100,
            ease: "Sine.InOut",
            yoyo: true,
            repeat: -1,
          });
        } else {
          const hazard = this.addStaticTile(this.hazards, center, this.textureFor(tile), tile);
          hazard.setDepth(tile === 7 ? 1 : 3);
        }
      }
    }
  }

  private addStaticTile(
    group: Phaser.Physics.Arcade.StaticGroup,
    center: { x: number; y: number },
    texture: string,
    tile: TileId,
  ): Phaser.Physics.Arcade.Image {
    const image = group.create(center.x, center.y, texture) as Phaser.Physics.Arcade.Image;
    image.setDisplaySize(DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE);
    image.setData("tileId", tile);
    image.refreshBody();
    return image;
  }

  private textureFor(tile: Exclude<TileId, 0>): string {
    switch (tile) {
      case 1:
        return PROCEDURAL_TEXTURES.grass;
      case 2:
        return PROCEDURAL_TEXTURES.rock;
      case 3:
        return PROCEDURAL_TEXTURES.goal;
      case 4:
        return PROCEDURAL_TEXTURES.ice;
      case 5:
        return PROCEDURAL_TEXTURES.vent;
      case 6:
        return PROCEDURAL_TEXTURES.coral;
      case 7:
        return PROCEDURAL_TEXTURES.deepWater;
    }
  }

  private configureCamera(level: LevelDocument): void {
    const bounds = levelPixelBounds(level);
    const camera = this.cameras.main;
    camera.setBounds(0, 0, bounds.width, bounds.height);
    camera.setBackgroundColor("#78cbd0");
    camera.roundPixels = true;
  }

  private centerPreviewOnSpawn(level: LevelDocument): void {
    this.spawnCell = findLeftmostStandableCell(level) ?? this.findFallbackSpawn(level);
    const spawn = cellCenter(this.spawnCell);
    this.cameras.main.centerOn(spawn.x, spawn.y);
  }

  private createPlayer(level: LevelDocument): void {
    this.spawnCell = findLeftmostStandableCell(level) ?? this.findFallbackSpawn(level);
    const spawn = cellCenter(this.spawnCell);
    const playerTexture = this.textures.exists(OPTIONAL_OTTER_KEY)
      ? OPTIONAL_OTTER_KEY
      : PROCEDURAL_TEXTURES.player;

    this.player = this.physics.add.sprite(spawn.x, spawn.y, playerTexture);
    this.player.setDisplaySize(PLAYER_WIDTH, PLAYER_HEIGHT);
    this.player.setBodySize(this.player.width * 0.72, this.player.height * 0.84, true);
    this.player.setDepth(12);
    this.player.setBounce(0);
    this.player.setCollideWorldBounds(false);
    this.player.setGravityY(GRAVITY);

    if (this.solids !== null) {
      this.physics.add.collider(this.player, this.solids);
    }
    if (this.hazards !== null) {
      this.physics.add.overlap(this.player, this.hazards, () => this.killPlayer());
    }
    if (this.goals !== null) {
      this.physics.add.overlap(this.player, this.goals, () => this.completeLevel());
    }

    const camera = this.cameras.main;
    camera.startFollow(this.player, true, 0.13, 0.17);
    camera.centerOn(spawn.x, spawn.y);
  }

  private configureControls(): void {
    const keyboard = this.input.keyboard;
    if (keyboard === null) {
      return;
    }

    this.cursors = keyboard.createCursorKeys();
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.W,
    ]);
  }

  private readHorizontalInput(): -1 | 0 | 1 {
    const left =
      this.sharedControls.state.left ||
      this.cursors?.left.isDown === true ||
      this.keyA?.isDown === true;
    const right =
      this.sharedControls.state.right ||
      this.cursors?.right.isDown === true ||
      this.keyD?.isDown === true;

    if (left === right) {
      return 0;
    }

    return left ? -1 : 1;
  }

  private readJumpPressed(): boolean {
    let pressed = false;
    if (this.cursors !== null) {
      pressed =
        Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.space);
    }
    if (this.keyW !== null) {
      pressed = Phaser.Input.Keyboard.JustDown(this.keyW) || pressed;
    }

    if (this.lastTouchJumpSequence !== this.sharedControls.jumpSequence) {
      this.lastTouchJumpSequence = this.sharedControls.jumpSequence;
      pressed = true;
    }

    return pressed;
  }

  private isPlayerOnIce(body: Phaser.Physics.Arcade.Body): boolean {
    if (this.level === null) {
      return false;
    }

    const footY = body.bottom + 2;
    const inset = Math.min(8, body.halfWidth * 0.5);
    return (
      tileAtWorldPoint(this.level, { x: body.left + inset, y: footY }) === 4 ||
      tileAtWorldPoint(this.level, { x: body.right - inset, y: footY }) === 4
    );
  }

  private killPlayer(): void {
    if (this.player === null || this.isRespawning || this.isComplete) {
      return;
    }

    this.isRespawning = true;
    this.hooks.onPlayerDeath(this.getCurrentGridPosition());
    this.cameras.main.shake(140, 0.006);
    this.player.setTint(0xff7c68);
    this.player.disableBody(true, true);

    this.time.delayedCall(360, () => {
      if (this.player === null || this.isComplete) {
        return;
      }

      const spawn = cellCenter(this.spawnCell);
      this.player.enableBody(true, spawn.x, spawn.y, true, true);
      this.player.clearTint();
      this.player.setVelocity(0, 0);
      this.player.setAcceleration(0, 0);
      this.lastGroundedAt = Number.NEGATIVE_INFINITY;
      this.jumpBufferedAt = Number.NEGATIVE_INFINITY;
      this.isRespawning = false;
    });
  }

  private completeLevel(): void {
    if (this.player === null || this.isRespawning || this.isComplete) {
      return;
    }

    this.isComplete = true;
    this.player.setAcceleration(0, 0);
    this.player.setVelocity(0, 0);
    this.player.setTint(0xffdf76);
    this.physics.world.pause();
    this.hooks.onLevelComplete(this.getCurrentGridPosition());
    this.cameras.main.flash(350, 255, 238, 174, false);

    const label = this.add
      .text(this.scale.width / 2, Math.max(42, this.scale.height * 0.18), "TIDE CLEARED", {
        color: "#183f4b",
        backgroundColor: "#fff2c9",
        fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
        fontSize: "24px",
        fontStyle: "bold",
        padding: { x: 18, y: 10 },
        stroke: "#ffffff",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.tweens.add({
      targets: label,
      scale: { from: 0.86, to: 1 },
      alpha: { from: 0, to: 1 },
      duration: 240,
      ease: "Back.Out",
    });
  }

  private findFallbackSpawn(level: LevelDocument): GridPoint {
    for (let x = 0; x < level.width; x += 1) {
      for (let y = level.height - 1; y >= 0; y -= 1) {
        if (tileAt(level, x, y) === 0) {
          return { x, y };
        }
      }
    }

    return { x: 0, y: 0 };
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    if (this.backdrop !== null) {
      this.backdrop.setDisplaySize(gameSize.width, gameSize.height);
    }

    this.cameras.main.setDeadzone(
      Math.max(110, gameSize.width * 0.26),
      Math.max(80, gameSize.height * 0.2),
    );
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.cursors = null;
    this.keyA = null;
    this.keyD = null;
    this.keyW = null;
    this.player = null;
    this.solids = null;
    this.hazards = null;
    this.goals = null;
    this.backdrop = null;
  }
}
