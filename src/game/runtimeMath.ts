export interface Point2D {
  x: number;
  y: number;
}

export interface CameraFollowProfile {
  calmPortrait: boolean;
  deadzoneWidth: number;
  deadzoneHeight: number;
  lerpX: number;
  lerpY: number;
}

/**
 * Keeps portrait play steady: normal jumps stay inside a tall safe area while
 * horizontal travel is followed with a slower, softer catch-up.
 */
export function cameraFollowProfile(width: number, height: number): CameraFollowProfile {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const calmPortrait = safeWidth <= 540 && safeHeight >= safeWidth * 0.75;

  if (calmPortrait) {
    return {
      calmPortrait: true,
      deadzoneWidth: Math.max(
        1,
        Math.round(Math.min(safeWidth - 96, Math.max(144, safeWidth * 0.5))),
      ),
      deadzoneHeight: Math.max(
        1,
        Math.round(Math.min(safeHeight - 96, Math.max(216, safeHeight * 0.68))),
      ),
      lerpX: 0.1,
      lerpY: 0.055,
    };
  }

  return {
    calmPortrait: false,
    deadzoneWidth: Math.max(110, safeWidth * 0.26),
    deadzoneHeight: Math.max(80, safeHeight * 0.2),
    lerpX: 0.13,
    lerpY: 0.17,
  };
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
