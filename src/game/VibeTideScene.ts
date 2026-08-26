import Phaser from "phaser";

import type { GridPoint, LevelDocument, StudioSnapshot, TileId } from "../core/contracts";
import {
  DEFAULT_TILE_SIZE,
  cellCenter,
  findLeftmostStandableCell,
  isSolidTile,
  levelPixelBounds,
  tileAt,
  tileAtWorldPoint,
  worldToGridPoint,
} from "./geometry";
import {
  deriveEnemySpawns,
  isEnemyTile,
  type EnemyArchetype,
  type EnemySpawn,
} from "./enemies";
import type { SharedControlState } from "./input";
import {
  OPTIONAL_BACKGROUND_KEY,
  OPTIONAL_OTTER_KEY,
  PROCEDURAL_TEXTURES,
  V1_OTTER_ATLAS_KEY,
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

const PLAYER_WIDTH = 88;
const PLAYER_HEIGHT = 88;
const PLAYER_IDLE_ANIMATION_KEY = "vibetide:otter:idle";
const PLAYER_RUN_ANIMATION_KEY = "vibetide:otter:run";
const RUN_SPEED = 300;
const ICE_RUN_SPEED = 430;
const JUMP_VELOCITY = 610;
const GRAVITY = 1_480;
const COYOTE_WINDOW_MS = 110;
const JUMP_BUFFER_MS = 130;
const CRAWLER_SPEED = 88;
const FLYER_SPEED = 72;
const TIDE_PEARL_SPEED = 245;
const ENEMY_RESPAWN_MS = 2_800;

interface EnemyRuntimeState {
  spawn: EnemySpawn;
  direction: -1 | 1;
  defeated: boolean;
  respawnTicket: number;
  baseScaleX: number;
  baseScaleY: number;
  nextActionAt: number;
}

export class VibeTideScene extends Phaser.Scene {
  private readonly hooks: VibeTideSceneHooks;
  private readonly sharedControls: SharedControlState;

  private level: LevelDocument | null = null;
  private player: Phaser.Physics.Arcade.Sprite | null = null;
  private solids: Phaser.Physics.Arcade.StaticGroup | null = null;
  private hazards: Phaser.Physics.Arcade.StaticGroup | null = null;
  private goals: Phaser.Physics.Arcade.StaticGroup | null = null;
  private enemies: Phaser.Physics.Arcade.Group | null = null;
  private projectiles: Phaser.Physics.Arcade.Group | null = null;
  private readonly enemyStates = new Map<Phaser.Physics.Arcade.Sprite, EnemyRuntimeState>();
  private readonly projectileExpirations = new Map<Phaser.Physics.Arcade.Sprite, number>();
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
      this.createEnemies(snapshot.level);
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
    if (!this.isPlayMode || this.isComplete) {
      return;
    }

    this.updateEnemies(time);
    this.updateProjectiles(time);

    if (this.isRespawning || this.player === null) {
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

    this.updatePlayerAnimation(grounded, horizontalInput, body.velocity.y);

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
        if (tile === undefined || tile === 0 || isEnemyTile(tile)) {
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

  private textureFor(tile: Exclude<TileId, 0 | 8 | 9 | 10>): string {
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
    const hasAnimatedOtter = this.textures.exists(V1_OTTER_ATLAS_KEY);
    const playerTexture = hasAnimatedOtter
      ? V1_OTTER_ATLAS_KEY
      : this.textures.exists(OPTIONAL_OTTER_KEY)
        ? OPTIONAL_OTTER_KEY
        : PROCEDURAL_TEXTURES.player;

    this.player = this.physics.add.sprite(spawn.x, spawn.y, playerTexture, 0);
    this.player.setDisplaySize(PLAYER_WIDTH, PLAYER_HEIGHT);
    if (hasAnimatedOtter) {
      const bodyWidth = this.player.width * 0.34;
      const bodyHeight = this.player.height * 0.56;
      this.player.setBodySize(bodyWidth, bodyHeight, false);
      this.player.setOffset(
        (this.player.width - bodyWidth) / 2,
        this.player.height - bodyHeight - 28,
      );
    } else {
      this.player.setBodySize(this.player.width * 0.72, this.player.height * 0.84, true);
    }
    this.player.setDepth(12);
    this.player.setBounce(0);
    this.player.setCollideWorldBounds(false);
    this.player.setGravityY(GRAVITY);

    if (hasAnimatedOtter) {
      this.ensurePlayerAnimations();
      this.player.play(PLAYER_IDLE_ANIMATION_KEY);
    }

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

  private ensurePlayerAnimations(): void {
    if (!this.anims.exists(PLAYER_IDLE_ANIMATION_KEY)) {
      this.anims.create({
        key: PLAYER_IDLE_ANIMATION_KEY,
        frames: this.anims.generateFrameNumbers(V1_OTTER_ATLAS_KEY, { start: 0, end: 1 }),
        frameRate: 2,
        repeat: -1,
      });
    }

    if (!this.anims.exists(PLAYER_RUN_ANIMATION_KEY)) {
      this.anims.create({
        key: PLAYER_RUN_ANIMATION_KEY,
        frames: this.anims.generateFrameNumbers(V1_OTTER_ATLAS_KEY, { start: 2, end: 5 }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  private updatePlayerAnimation(
    grounded: boolean,
    horizontalInput: -1 | 0 | 1,
    verticalVelocity: number,
  ): void {
    if (this.player === null || this.player.texture.key !== V1_OTTER_ATLAS_KEY) {
      return;
    }

    if (!grounded) {
      this.player.anims.stop();
      this.player.setFrame(verticalVelocity < 0 ? 6 : 7);
      return;
    }

    if (horizontalInput !== 0 || Math.abs(this.player.body?.velocity.x ?? 0) > 24) {
      this.player.play(PLAYER_RUN_ANIMATION_KEY, true);
      return;
    }

    this.player.play(PLAYER_IDLE_ANIMATION_KEY, true);
  }

  private createEnemies(level: LevelDocument): void {
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.enemyStates.clear();
    this.projectileExpirations.clear();

    for (const spawn of deriveEnemySpawns(level)) {
      const position = cellCenter(spawn.cell);
      const sprite = this.physics.add.sprite(
        position.x,
        position.y,
        this.textureForEnemy(spawn.archetype),
      );
      const size = this.enemyDisplaySize(spawn.archetype);
      sprite.setDisplaySize(size.width, size.height);
      sprite.setBodySize(
        sprite.width * (spawn.archetype === "swell-wing" ? 0.7 : 0.74),
        sprite.height * (spawn.archetype === "tide-spitter" ? 0.72 : 0.68),
        true,
      );
      sprite.setDepth(10);
      sprite.setBounce(0);
      sprite.setCollideWorldBounds(false);
      sprite.setImmovable(true);
      sprite.setFlipX(spawn.direction < 0);
      sprite.setGravityY(spawn.archetype === "swell-wing" ? 0 : GRAVITY);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.allowGravity = spawn.archetype !== "swell-wing";

      this.enemies.add(sprite);
      this.enemyStates.set(sprite, {
        spawn,
        direction: spawn.direction,
        defeated: false,
        respawnTicket: 0,
        baseScaleX: sprite.scaleX,
        baseScaleY: sprite.scaleY,
        nextActionAt: this.time.now + 760 + spawn.phaseMs,
      });
    }

    if (this.solids !== null) {
      this.physics.add.collider(this.enemies, this.solids);
      this.physics.add.collider(this.projectiles, this.solids, (projectile) => {
        this.destroyProjectile(projectile as Phaser.Physics.Arcade.Sprite);
      });
    }
    if (this.hazards !== null) {
      this.physics.add.overlap(this.enemies, this.hazards, (enemy) => {
        this.defeatEnemy(enemy as Phaser.Physics.Arcade.Sprite, true);
      });
    }
    if (this.player !== null) {
      this.physics.add.collider(this.player, this.enemies, (_player, enemy) => {
        this.handlePlayerEnemyContact(enemy as Phaser.Physics.Arcade.Sprite);
      });
      this.physics.add.overlap(this.player, this.projectiles, (_player, projectile) => {
        this.destroyProjectile(projectile as Phaser.Physics.Arcade.Sprite);
        this.killPlayer();
      });
    }
  }

  private enemyDisplaySize(archetype: EnemyArchetype): { width: number; height: number } {
    switch (archetype) {
      case "reef-crawler":
        return { width: 46, height: 40 };
      case "swell-wing":
        return { width: 54, height: 44 };
      case "tide-spitter":
        return { width: 50, height: 42 };
    }
  }

  private textureForEnemy(archetype: EnemyArchetype, firing = false): string {
    switch (archetype) {
      case "reef-crawler":
        return PROCEDURAL_TEXTURES.reefCrawler;
      case "swell-wing":
        return PROCEDURAL_TEXTURES.swellWingUp;
      case "tide-spitter":
        return firing
          ? PROCEDURAL_TEXTURES.tideSpitterFire
          : PROCEDURAL_TEXTURES.tideSpitterIdle;
    }
  }

  private updateEnemies(time: number): void {
    if (this.level === null) {
      return;
    }

    const bounds = levelPixelBounds(this.level);
    for (const [enemy, state] of this.enemyStates) {
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      if (state.defeated || !enemy.active || !body.enable) {
        continue;
      }

      if (enemy.y > bounds.height + DEFAULT_TILE_SIZE * 1.5) {
        this.defeatEnemy(enemy, true);
        continue;
      }

      switch (state.spawn.archetype) {
        case "reef-crawler":
          this.updateCrawler(enemy, body, state, time);
          break;
        case "swell-wing":
          this.updateSwellWing(enemy, body, state, time);
          break;
        case "tide-spitter":
          this.updateTideSpitter(enemy, state, time);
          break;
      }
    }
  }

  private updateCrawler(
    enemy: Phaser.Physics.Arcade.Sprite,
    body: Phaser.Physics.Arcade.Body,
    state: EnemyRuntimeState,
    time: number,
  ): void {
    if (this.level === null) {
      return;
    }

    const grounded = body.blocked.down || body.touching.down;
    const blockedAhead = state.direction < 0 ? body.blocked.left : body.blocked.right;
    const aheadX = state.direction < 0 ? body.left - 5 : body.right + 5;
    const hasSupport = isSolidTile(
      tileAtWorldPoint(this.level, { x: aheadX, y: body.bottom + 3 }),
    );
    const minimumX = (state.spawn.patrol.minX + 0.35) * DEFAULT_TILE_SIZE;
    const maximumX = (state.spawn.patrol.maxX + 0.65) * DEFAULT_TILE_SIZE;
    const passedPatrolEdge =
      (state.direction < 0 && enemy.x <= minimumX) ||
      (state.direction > 0 && enemy.x >= maximumX);

    if (blockedAhead || passedPatrolEdge || (grounded && !hasSupport)) {
      state.direction = state.direction === -1 ? 1 : -1;
    }

    enemy.setVelocityX(state.direction * CRAWLER_SPEED);
    enemy.setFlipX(state.direction < 0);
    enemy.setAngle(Math.sin((time + state.spawn.phaseMs) / 105) * 2.5);
  }

  private updateSwellWing(
    enemy: Phaser.Physics.Arcade.Sprite,
    body: Phaser.Physics.Arcade.Body,
    state: EnemyRuntimeState,
    time: number,
  ): void {
    const minimumX = (state.spawn.patrol.minX + 0.35) * DEFAULT_TILE_SIZE;
    const maximumX = (state.spawn.patrol.maxX + 0.65) * DEFAULT_TILE_SIZE;
    const blockedAhead = state.direction < 0 ? body.blocked.left : body.blocked.right;
    if (
      blockedAhead ||
      (state.direction < 0 && enemy.x <= minimumX) ||
      (state.direction > 0 && enemy.x >= maximumX)
    ) {
      state.direction = state.direction === -1 ? 1 : -1;
    }

    const hasPatrolRoom = state.spawn.patrol.minX !== state.spawn.patrol.maxX;
    const phase = (time + state.spawn.phaseMs) / 230;
    enemy.setVelocityX(hasPatrolRoom ? state.direction * FLYER_SPEED : 0);
    enemy.setVelocityY(Math.cos(phase) * 32);
    enemy.setFlipX(state.direction < 0);
    enemy.setAngle(Math.sin(phase) * 4);
    enemy.setTexture(
      Math.floor((time + state.spawn.phaseMs) / 150) % 2 === 0
        ? PROCEDURAL_TEXTURES.swellWingUp
        : PROCEDURAL_TEXTURES.swellWingDown,
    );
  }

  private updateTideSpitter(
    enemy: Phaser.Physics.Arcade.Sprite,
    state: EnemyRuntimeState,
    time: number,
  ): void {
    enemy.setVelocityX(0);
    enemy.setAngle(Math.sin((time + state.spawn.phaseMs) / 380) * 1.8);

    const player = this.player;
    if (player === null || !player.active) {
      return;
    }
    const direction: -1 | 1 = player.x < enemy.x ? -1 : 1;
    state.direction = direction;
    enemy.setFlipX(direction < 0);

    if (time < state.nextActionAt) {
      return;
    }
    state.nextActionAt = time + 1_650 + (state.spawn.phaseMs % 360);
    const horizontalDistance = Math.abs(player.x - enemy.x);
    const verticalDistance = Math.abs(player.y - enemy.y);
    if (
      horizontalDistance <= DEFAULT_TILE_SIZE * 9 &&
      verticalDistance <= DEFAULT_TILE_SIZE * 3.25
    ) {
      this.fireTidePearl(enemy, direction, time);
    }
  }

  private fireTidePearl(
    enemy: Phaser.Physics.Arcade.Sprite,
    direction: -1 | 1,
    time: number,
  ): void {
    if (this.projectiles === null || this.projectileExpirations.size >= 24) {
      return;
    }

    enemy.setTexture(PROCEDURAL_TEXTURES.tideSpitterFire);
    this.time.delayedCall(150, () => {
      const state = this.enemyStates.get(enemy);
      if (state && !state.defeated && enemy.active) {
        enemy.setTexture(PROCEDURAL_TEXTURES.tideSpitterIdle);
      }
    });

    const projectile = this.physics.add.sprite(
      enemy.x + direction * 28,
      enemy.y - 1,
      PROCEDURAL_TEXTURES.tidePearl,
    );
    projectile.setDisplaySize(20, 20);
    projectile.setBodySize(14, 14, true);
    projectile.setDepth(11);
    projectile.setGravityY(0);
    projectile.setVelocityX(direction * TIDE_PEARL_SPEED);
    projectile.setAngularVelocity(direction * 220);
    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    this.projectiles.add(projectile);
    this.projectileExpirations.set(projectile, time + 3_200);
  }

  private updateProjectiles(time: number): void {
    for (const [projectile, expiresAt] of this.projectileExpirations) {
      if (!projectile.active || time >= expiresAt) {
        this.destroyProjectile(projectile);
      }
    }
  }

  private destroyProjectile(projectile: Phaser.Physics.Arcade.Sprite): void {
    if (!this.projectileExpirations.delete(projectile)) {
      return;
    }
    projectile.destroy();
  }

  private clearProjectiles(): void {
    for (const projectile of [...this.projectileExpirations.keys()]) {
      this.destroyProjectile(projectile);
    }
  }

  private handlePlayerEnemyContact(enemy: Phaser.Physics.Arcade.Sprite): void {
    const state = this.enemyStates.get(enemy);
    if (state === undefined || state.defeated || this.player === null || this.isRespawning) {
      return;
    }

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
    const descending = playerBody.velocity.y > 55 || playerBody.deltaY() > 1;
    const aboveEnemy = playerBody.bottom <= enemyBody.top + Math.max(16, enemyBody.height * 0.45);
    if (descending && aboveEnemy) {
      this.defeatEnemy(enemy, true);
      this.player.setVelocityY(-JUMP_VELOCITY * 0.58);
      this.lastGroundedAt = Number.NEGATIVE_INFINITY;
      this.cameras.main.shake(55, 0.0025);
      return;
    }

    this.killPlayer();
  }

  private defeatEnemy(enemy: Phaser.Physics.Arcade.Sprite, shouldRespawn: boolean): void {
    const state = this.enemyStates.get(enemy);
    if (state === undefined || state.defeated) {
      return;
    }

    state.defeated = true;
    state.respawnTicket += 1;
    const ticket = state.respawnTicket;
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    enemy.setVelocity(0, 0);
    this.tweens.add({
      targets: enemy,
      alpha: 0,
      scaleX: state.baseScaleX * 1.18,
      scaleY: state.baseScaleY * 0.24,
      y: enemy.y + 10,
      duration: 170,
      ease: "Quad.In",
      onComplete: () => {
        if (state.defeated) {
          enemy.setActive(false).setVisible(false);
        }
      },
    });

    if (shouldRespawn) {
      this.scheduleEnemyRespawn(enemy, state, ticket, ENEMY_RESPAWN_MS);
    }
  }

  private scheduleEnemyRespawn(
    enemy: Phaser.Physics.Arcade.Sprite,
    state: EnemyRuntimeState,
    ticket: number,
    delay: number,
  ): void {
    this.time.delayedCall(delay, () => {
      if (state.respawnTicket !== ticket || !state.defeated || this.isComplete) {
        return;
      }
      const spawn = cellCenter(state.spawn.cell);
      if (
        this.player?.active === true &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, spawn.x, spawn.y) <
          DEFAULT_TILE_SIZE * 2.25
      ) {
        this.scheduleEnemyRespawn(enemy, state, ticket, 750);
        return;
      }
      this.resetEnemy(enemy, state);
    });
  }

  private resetEnemy(enemy: Phaser.Physics.Arcade.Sprite, state: EnemyRuntimeState): void {
    const position = cellCenter(state.spawn.cell);
    this.tweens.killTweensOf(enemy);
    enemy.enableBody(true, position.x, position.y, true, true);
    enemy
      .setAlpha(1)
      .setScale(state.baseScaleX, state.baseScaleY)
      .setAngle(0)
      .setTexture(this.textureForEnemy(state.spawn.archetype))
      .setFlipX(state.spawn.direction < 0);
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = state.spawn.archetype !== "swell-wing";
    enemy.setGravityY(state.spawn.archetype === "swell-wing" ? 0 : GRAVITY);
    enemy.setVelocity(0, 0);
    state.direction = state.spawn.direction;
    state.defeated = false;
    state.nextActionAt = this.time.now + 760 + state.spawn.phaseMs;
  }

  private resetEnemyPopulation(): void {
    this.clearProjectiles();
    for (const [enemy, state] of this.enemyStates) {
      state.respawnTicket += 1;
      this.resetEnemy(enemy, state);
    }
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
    this.clearProjectiles();

    this.time.delayedCall(360, () => {
      if (this.player === null || this.isComplete) {
        return;
      }

      const spawn = cellCenter(this.spawnCell);
      this.resetEnemyPopulation();
      this.player.enableBody(true, spawn.x, spawn.y, true, true);
      this.player.clearTint();
      this.player.setVelocity(0, 0);
      this.player.setAcceleration(0, 0);
      if (this.player.texture.key === V1_OTTER_ATLAS_KEY) {
        this.player.play(PLAYER_IDLE_ANIMATION_KEY, true);
      }
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
    this.clearProjectiles();
    this.player.setAcceleration(0, 0);
    this.player.setVelocity(0, 0);
    this.player.setTint(0xffdf76);
    if (this.player.texture.key === V1_OTTER_ATLAS_KEY) {
      this.player.play(PLAYER_IDLE_ANIMATION_KEY, true);
    }
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
    this.enemies = null;
    this.projectiles = null;
    this.enemyStates.clear();
    this.projectileExpirations.clear();
    this.backdrop = null;
  }
}
