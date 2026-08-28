import { describe, expect, it } from "vitest";

import {
  aimedProjectileVelocity,
  alignSpriteFeetToSurface,
  cameraFollowProfile,
} from "../src/game/runtimeMath";

describe("runtime geometry", () => {
  it("aligns the physics feet above the supporting tile", () => {
    expect(alignSpriteFeetToSurface(384, 38.5)).toBe(344.5);
  });

  it("launches a full-speed projectile toward the player with a shallow close-range arc", () => {
    const velocity = aimedProjectileVelocity(
      { x: 500, y: 200 },
      { x: 450, y: 400 },
      -1,
      360,
      144,
      48,
    );

    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(360, 8);
    expect(velocity.x).toBeLessThan(-300);
    expect(velocity.y).toBeGreaterThan(0);
    expect(velocity.y).toBeLessThan(120);
  });

  it("uses a tall, slow camera safe area for portrait mobile play", () => {
    const profile = cameraFollowProfile(390, 430);

    expect(profile.calmPortrait).toBe(true);
    expect(profile.zoom).toBe(0.8);
    expect(profile.deadzoneWidth).toBe(195);
    expect(profile.deadzoneHeight).toBe(292);
    expect(profile.deadzoneHeight / 2).toBeGreaterThan(126);
    expect(profile.lerpX).toBe(0.1);
    expect(profile.lerpY).toBe(0.055);
  });

  it("keeps the existing responsive follow on wide game views", () => {
    const profile = cameraFollowProfile(960, 540);

    expect(profile.calmPortrait).toBe(false);
    expect(profile.zoom).toBe(1);
    expect(profile.deadzoneWidth).toBeCloseTo(249.6);
    expect(profile.deadzoneHeight).toBe(108);
    expect(profile.lerpX).toBe(0.13);
    expect(profile.lerpY).toBe(0.17);
  });
});
