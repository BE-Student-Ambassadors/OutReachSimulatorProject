/**
 * Simulation and validation for Role 4 — QA Tester / Producer: The Bug Detective.
 *
 * Players and testers report: "The boss hit me even though I was behind a wall!"
 * The QA tester reproduces the issue in a controlled stage, isolates the defect to
 * boss projectile collision rules, repairs the rule, and runs two verification tests
 * (wall collision vs open space travel).
 */

import type { ProjectileWallRule, QaSettings } from '../types/project'

export interface BugReport {
  id: string
  reporter: string
  quote: string
  clue: string
}

export const BUG_REPORTS: BugReport[] = [
  {
    id: 'report-a',
    reporter: 'Tester A (Combat Focus)',
    quote: 'The boss hit me even though I was taking cover behind a thick wall!',
    clue: 'Happens during defensive play while hiding behind solid reinforced walls.',
  },
  {
    id: 'report-b',
    reporter: 'Tester B (Boss Mechanics)',
    quote: 'It only seems to happen when the boss uses its ranged plasma spray attack.',
    clue: 'Melee cleaves do not phase through walls — only ranged projectiles do.',
  },
  {
    id: 'report-c',
    reporter: 'Tester C (Systems QA)',
    quote: 'My hero blaster shots stop at walls, but the boss’s projectiles fly straight through.',
    clue: 'Hero projectile collision works, but boss projectile collision rule is flawed.',
  },
]

export const DIAGNOSTIC_OPTIONS = [
  {
    id: 'health_calc',
    label: 'Health Calculation & Armor Formulas',
    correct: false,
    feedback: 'Incorrect. Damage numbers are calculated properly; the issue is how objects interact spatially.',
  },
  {
    id: 'projectile_collision',
    label: 'Boss Projectile Wall Collision Logic',
    correct: true,
    feedback: 'Correct! The boss projectile loop is missing wall-hit termination checks.',
  },
  {
    id: 'move_speed',
    label: 'Player Movement Speed & Acceleration',
    correct: false,
    feedback: 'Incorrect. Movement speeds do not affect whether projectiles pass through physical barriers.',
  },
  {
    id: 'melee_damage',
    label: 'Melee Attack Range & Knockback',
    correct: false,
    feedback: 'Incorrect. The bug reports specifically isolate ranged attacks, not melee swings.',
  },
]

export const RULE_OPTIONS: Array<{ rule: ProjectileWallRule; label: string; description: string; isCorrect: boolean }> = [
  {
    rule: 'continue_moving',
    label: 'CONTINUE MOVING (Ignore Wall Collisions)',
    description: 'Current Buggy Rule: Projectiles phase through walls as if they were open air.',
    isCorrect: false,
  },
  {
    rule: 'stop_despawn',
    label: 'STOP AND DESPAWN (Destroy on Impact)',
    description: 'Industry Standard: Colliding with a wall triggers impact sparks and destroys the projectile.',
    isCorrect: true,
  },
  {
    rule: 'ignore_collision',
    label: 'IGNORE COLLISION (No Impact Checks)',
    description: 'Defective Rule: Completely bypasses the physics and tile grid query.',
    isCorrect: false,
  },
]

export interface ProjectileReproductionResult {
  projectileX: number
  projectileY: number
  hitWall: boolean
  passedThroughWall: boolean
  damagedHero: boolean
  log: string
}

/**
 * Headlessly tests boss projectile behavior in a 1D/2D scenario:
 * Boss at x=360, Wall at x=200, Hero at x=80.
 */
export function simulateProjectileTrajectory(
  hasWall: boolean,
  rule: ProjectileWallRule,
): ProjectileReproductionResult {
  const bossX = 360
  const wallX = 200
  const heroX = 80
  let pX = bossX
  let hitWall = false
  let passedThrough = false

  const speed = 400 // px/s
  const dt = 0.05
  let time = 0

  while (time < 1.0) {
    pX -= speed * dt
    time += dt

    if (hasWall && pX <= wallX && !hitWall) {
      hitWall = true
      if (rule === 'stop_despawn') {
        // Destroyed on wall impact!
        return {
          projectileX: wallX,
          projectileY: 150,
          hitWall: true,
          passedThroughWall: false,
          damagedHero: false,
          log: '[VERIFIED] Boss Plasma Bolt collided with Reinforced Wall at x=200 and was blocked! Hero is safe.',
        }
      } else {
        // Ignored or continued through wall
        passedThrough = true
      }
    }

    if (pX <= heroX) {
      return {
        projectileX: heroX,
        projectileY: 150,
        hitWall,
        passedThroughWall: hasWall,
        damagedHero: true,
        log: hasWall
          ? '[BUG DETECTED] Boss Plasma Bolt phased through Reinforced Wall and struck Hero behind cover for 18 damage!'
          : '[NORMAL] Boss Plasma Bolt traveled unobstructed through open space and hit Hero for 18 damage.',
      }
    }
  }

  return {
    projectileX: pX,
    projectileY: 150,
    hitWall,
    passedThroughWall: passedThrough,
    damagedHero: false,
    log: 'Projectile expired without reaching target.',
  }
}

export interface QaPuzzleValidation {
  valid: boolean
  bugReproduced: boolean
  ruleFixed: boolean
  wallTestPassed: boolean
  openTestPassed: boolean
  message: string
}

export function validateQaPuzzle(qa: QaSettings): QaPuzzleValidation {
  const ruleFixed = qa.projectileWallRule === 'stop_despawn'
  const wallTest = simulateProjectileTrajectory(true, qa.projectileWallRule)
  const openTest = simulateProjectileTrajectory(false, qa.projectileWallRule)

  const wallTestPassed = wallTest.hitWall && !wallTest.damagedHero && !wallTest.passedThroughWall
  const openTestPassed = !openTest.hitWall && openTest.damagedHero

  if (!ruleFixed) {
    return {
      valid: false,
      bugReproduced: qa.bugReproduced,
      ruleFixed: false,
      wallTestPassed,
      openTestPassed,
      message: 'Defect active: Boss projectiles still continue through walls. Change the rule to STOP AND DESPAWN.',
    }
  }

  if (!wallTestPassed) {
    return {
      valid: false,
      bugReproduced: qa.bugReproduced,
      ruleFixed: true,
      wallTestPassed,
      openTestPassed,
      message: 'Wall verification failed: The projectile did not safely terminate at the wall.',
    }
  }

  if (!openTestPassed) {
    return {
      valid: false,
      bugReproduced: qa.bugReproduced,
      ruleFixed: true,
      wallTestPassed,
      openTestPassed,
      message: 'Open space verification failed: Projectiles must still travel freely when no walls are in the way.',
    }
  }

  return {
    valid: true,
    bugReproduced: true,
    ruleFixed: true,
    wallTestPassed: true,
    openTestPassed: true,
    message:
      "BUG VERIFIED AND FIXED! You reproduced a defect, identified its cause, and verified the solution. This is an important part of game quality assurance.",
  }
}
