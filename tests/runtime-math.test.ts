import { describe, expect, it } from "vitest";

import {
  aimedProjectileVelocity,
  alignSpriteFeetToSurface,
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
});
