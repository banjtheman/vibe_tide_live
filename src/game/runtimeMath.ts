export interface Point2D {
  x: number;
  y: number;
}

/**
 * Returns a sprite center Y that leaves its physics feet just above a surface.
 * The body offset is measured after Phaser applies the sprite's display scale.
 */
export function alignSpriteFeetToSurface(
  surfaceY: number,
  bodyBottomOffsetFromSpriteCenter: number,
  clearance = 1,
): number {
  return surfaceY - clearance - bodyBottomOffsetFromSpriteCenter;
}

/**
 * Builds a shallow, constant-speed shot toward a target. A minimum horizontal
 * run keeps nearby targets from turning a platform projectile straight down.
 */
export function aimedProjectileVelocity(
  origin: Point2D,
  target: Point2D,
  direction: -1 | 1,
  speed: number,
  minimumHorizontalRun: number,
  maximumVerticalRise: number,
): Point2D {
  const horizontalRun = direction * Math.max(Math.abs(target.x - origin.x), minimumHorizontalRun);
  const verticalRise = Math.max(
    -maximumVerticalRise,
    Math.min(maximumVerticalRise, target.y - origin.y),
  );
  const magnitude = Math.hypot(horizontalRun, verticalRise) || 1;

  return {
    x: (horizontalRun / magnitude) * speed,
    y: (verticalRise / magnitude) * speed,
  };
}
