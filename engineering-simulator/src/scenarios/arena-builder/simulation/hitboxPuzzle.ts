/**
 * Simulation and validation for Role 1 — Gameplay Designer: The Hitbox Mystery.
 *
 * Playtesters complain the sword visually touches the enemy without registering damage.
 * The student must inspect collision geometry, adjust reach and arc to match the visual
 * sword swing, and avoid striking an unintended target outside the visible arc.
 */

export interface HitboxTarget {
  id: string
  label: string
  x: number // Relative to hero (0,0)
  y: number
  radius: number
  isIntended: boolean
}

export interface HitboxPuzzleConfig {
  swordVisualLength: number
  swordVisualArcDegrees: number
  intendedTarget: HitboxTarget
  unintendedTarget: HitboxTarget
}

export const HITBOX_PUZZLE_DEFAULTS: HitboxPuzzleConfig = {
  swordVisualLength: 80,
  swordVisualArcDegrees: 110,
  // Intended training dummy: directly in front, distance 75px
  intendedTarget: {
    id: 'dummy-intended',
    label: 'Training Dummy (Target)',
    x: 75,
    y: 0,
    radius: 16,
    isIntended: true,
  },
  // Unintended bystander dummy: off to the side (distance ~80px, angle ~62°)
  unintendedTarget: {
    id: 'dummy-unintended',
    label: 'Friendly Bystander (Do Not Hit)',
    x: 38,
    y: 70,
    radius: 14,
    isIntended: false,
  },
}

export interface HitboxCheckResult {
  hit: boolean
  distance: number
  angleDegrees: number
  inReach: boolean
  inArc: boolean
}

export interface HitboxPuzzleValidation {
  valid: boolean
  intendedHit: boolean
  unintendedHit: boolean
  intendedDetails: HitboxCheckResult
  unintendedDetails: HitboxCheckResult
  visualMismatch: boolean
  message: string
  status: 'too_short' | 'oversized' | 'aim_misaligned' | 'success'
}

/**
 * Checks whether an attack sector defined by reach, arcDegrees, and offsetAngleDegrees
 * intersects a circular target positioned relative to the attacker at (0, 0) facing +X (0 rad).
 */
export function checkTargetHit(
  target: HitboxTarget,
  reach: number,
  arcDegrees: number,
  offsetAngleDegrees: number = 0,
): HitboxCheckResult {
  const dist = Math.hypot(target.x, target.y)
  const angleRad = Math.atan2(target.y, target.x)
  const angleDeg = (angleRad * 180) / Math.PI

  // Angular difference from attack facing
  let diff = Math.abs(angleDeg - offsetAngleDegrees)
  while (diff > 180) diff = Math.abs(diff - 360)

  // Target has physical radius, expanding effective reach and arc slightly
  const angularRadius = Math.asin(Math.min(0.99, target.radius / Math.max(1, dist))) * (180 / Math.PI)

  const inReach = dist <= reach + target.radius
  const inArc = diff <= arcDegrees / 2 + angularRadius

  return {
    hit: inReach && inArc,
    distance: Math.round(dist),
    angleDegrees: Math.round(diff),
    inReach,
    inArc,
  }
}

/**
 * Validates the student's attack hitbox configuration against the intended and unintended targets.
 */
export function validateHitboxPuzzle(
  reach: number,
  arcDegrees: number,
  offsetAngleDegrees: number = 0,
  config: HitboxPuzzleConfig = HITBOX_PUZZLE_DEFAULTS,
): HitboxPuzzleValidation {
  const intendedDetails = checkTargetHit(config.intendedTarget, reach, arcDegrees, offsetAngleDegrees)
  const unintendedDetails = checkTargetHit(config.unintendedTarget, reach, arcDegrees, offsetAngleDegrees)

  const intendedHit = intendedDetails.hit
  const unintendedHit = unintendedDetails.hit

  // Hitbox reasonably matches visual sword (reach ~60-95px, arc ~65-130°, offset within +/-20°)
  const visualMismatch =
    reach < 55 || reach > 100 || arcDegrees < 60 || arcDegrees > 140 || Math.abs(offsetAngleDegrees) > 25

  if (!intendedHit) {
    if (!intendedDetails.inReach) {
      return {
        valid: false,
        intendedHit: false,
        unintendedHit,
        intendedDetails,
        unintendedDetails,
        visualMismatch: true,
        status: 'too_short',
        message: `Whiff! Your attack reach (${reach}px) stops short of the training dummy (${intendedDetails.distance}px). The sword visually touches it, but the hitbox fails to connect.`,
      }
    }
    return {
      valid: false,
      intendedHit: false,
      unintendedHit,
      intendedDetails,
      unintendedDetails,
      visualMismatch: true,
      status: 'aim_misaligned',
      message: `Miss! The attack arc (${arcDegrees}°) is too narrow or misaligned to envelop the training dummy.`,
    }
  }

  if (unintendedHit) {
    return {
      valid: false,
      intendedHit: true,
      unintendedHit: true,
      intendedDetails,
      unintendedDetails,
      visualMismatch: true,
      status: 'oversized',
      message: `Defect! The hitbox struck the unintended target outside the sword swing arc. The collision geometry is excessively large compared to the visible weapon.`,
    }
  }

  if (visualMismatch) {
    return {
      valid: false,
      intendedHit: true,
      unintendedHit: false,
      intendedDetails,
      unintendedDetails,
      visualMismatch: true,
      status: 'aim_misaligned',
      message: `Almost, but the hitbox offset or dimensions do not match the sword animation. Keep the offset centered with the swing.`,
    }
  }

  return {
    valid: true,
    intendedHit: true,
    unintendedHit: false,
    intendedDetails,
    unintendedDetails,
    visualMismatch: false,
    status: 'success',
    message: `HITBOX REPAIRED! Your attack now matches the sword animation. You've solved a gameplay collision problem!`,
  }
}
