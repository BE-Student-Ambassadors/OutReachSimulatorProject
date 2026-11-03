/**
 * Pure simulation module for Role 4 — The Intermittent Bug.
 *
 * Implements a multi-variable deductive investigation engine:
 * - Hidden defect triggered strictly by: Shield Guard + Ground Slam + Near Wall
 * - Limited experiment budget (6 runs)
 * - Hypothesis formulation & physics patch selection
 * - Automated 5-stage regression verification suite
 */

import type { QaExperimentRun, QaSettings } from '../types/project'

export interface ExperimentParams {
  heroAction: 'normal' | 'dash' | 'shield' | 'heavy_attack'
  bossAction: 'ranged_orb' | 'ground_slam' | 'cleave' | 'idle'
  environment: 'open' | 'near_wall' | 'hazard'
}

export function runQaExperiment(
  params: ExperimentParams,
  patch: 'patch_wall_iframe' | 'patch_disable_wall' | 'patch_remove_shield' | null = null,
): QaExperimentRun {
  const { heroAction, bossAction, environment } = params
  const id = `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`

  // The hidden bug condition: Shield + Ground Slam + Near Wall (without valid patch)
  const isBugTriggerCondition =
    heroAction === 'shield' &&
    bossAction === 'ground_slam' &&
    environment === 'near_wall'

  let bugTriggered = false
  let damageDealt = 0
  let log = ''

  if (patch === 'patch_disable_wall') {
    // Bad patch: wall collision disabled entirely
    damageDealt = 0
    log = 'TEST FAILED: Wall collision is disabled. Hero clipped straight out of bounds through the arena boundary!'
    return { id, heroAction, bossAction, environment, bugTriggered: false, log, damageDealt }
  }

  if (patch === 'patch_remove_shield' && heroAction === 'shield') {
    damageDealt = 28
    log = 'TEST FAILED: Shield ability was removed from engine. Hero took full unmitigated boss hit.'
    return { id, heroAction, bossAction, environment, bugTriggered: false, log, damageDealt }
  }

  if (isBugTriggerCondition) {
    if (patch === 'patch_wall_iframe') {
      // Repaired!
      bugTriggered = false
      damageDealt = 0
      log = 'PATCH VERIFIED: Shield absorbed Ground Slam. Hero contacted wall; 0.15s bounce immunity active. Knockback safely resolved with zero re-trigger.'
    } else {
      // Glitch triggers!
      bugTriggered = true
      damageDealt = 112 // 400% spike
      log = 'CRITICAL DEFECT CONFIRMED: Ground Slam knockback collided with wall boundary. Inverted rebound re-triggered shield collision without I-frame reset -> 4-hit infinite loop (112 dmg)!'
    }
  } else {
    // Normal combat behaviors
    if (bossAction === 'idle') {
      damageDealt = 0
      log = `Boss idle. Hero executed [${heroAction}] in [${environment}] environment. Collision check: NORMAL.`
    } else if (heroAction === 'dash') {
      damageDealt = 0
      log = `Hero dashed through [${bossAction}]. Active I-frames absorbed impact. Collision check: NORMAL.`
    } else if (heroAction === 'shield') {
      if (bossAction === 'ranged_orb') {
        damageDealt = 0
        log = 'Shield absorbed Energy Orb. Projectile dissipated. Knockback: 0. Collision check: NORMAL.'
      } else if (bossAction === 'cleave') {
        damageDealt = 4
        log = 'Shield absorbed Cleave arc. Minor chip damage (4 dmg). Knockback: 20px. Collision check: NORMAL.'
      } else if (bossAction === 'ground_slam' && environment === 'open') {
        damageDealt = 0
        log = 'Shield absorbed Ground Slam shockwave. Knockback applied: 75px slide across open floor. Deceleration: NORMAL.'
      } else if (bossAction === 'ground_slam' && environment === 'hazard') {
        damageDealt = 16
        log = 'Shield absorbed Ground Slam, but hero slid into plasma hazard. Environmental hazard tick (16 dmg). Collision check: NORMAL.'
      }
    } else if (heroAction === 'heavy_attack') {
      damageDealt = bossAction === 'ground_slam' ? 28 : 18
      log = `Hero committed to Heavy Attack during [${bossAction}]. Trades hit for standard damage (${damageDealt} dmg). Collision check: NORMAL.`
    } else {
      // Normal moving/standing
      damageDealt = bossAction === 'ground_slam' ? 28 : bossAction === 'cleave' ? 22 : 15
      log = `Hero took unblocked [${bossAction}] in [${environment}] environment. Standard damage (${damageDealt} dmg). Collision check: NORMAL.`
    }
  }

  return {
    id,
    heroAction,
    bossAction,
    environment,
    bugTriggered,
    log,
    damageDealt,
  }
}

export interface RegressionTestItem {
  id: string
  name: string
  passed: boolean
  details: string
}

export function runQaRegressionSuite(patch: 'patch_wall_iframe' | 'patch_disable_wall' | 'patch_remove_shield' | null): {
  allPassed: boolean
  tests: RegressionTestItem[]
  feedback: string
} {
  const tests: RegressionTestItem[] = []

  // 1. Bug condition test (Shield + Slam + Near Wall)
  const bugTest = runQaExperiment(
    { heroAction: 'shield', bossAction: 'ground_slam', environment: 'near_wall' },
    patch,
  )
  const bugResolved = !bugTest.bugTriggered && bugTest.damageDealt === 0 && patch === 'patch_wall_iframe'
  tests.push({
    id: 'reg_bug_fix',
    name: 'Bug Trigger Condition (Shield + Slam + Near Wall)',
    passed: bugResolved,
    details: bugResolved ? 'Defect resolved: wall bounce immunity prevented multi-hit loop.' : 'Bug still triggered or invalid patch result.',
  })

  // 2. Open floor shield test (Shield + Slam + Open)
  const openTest = runQaExperiment(
    { heroAction: 'shield', bossAction: 'ground_slam', environment: 'open' },
    patch,
  )
  const openPassed = openTest.damageDealt === 0 && !openTest.bugTriggered
  tests.push({
    id: 'reg_open_shield',
    name: 'Open Floor Shielding (Shield + Slam + Open)',
    passed: openPassed,
    details: openPassed ? 'Shield sliding works properly on open terrain.' : 'Shield mechanics degraded.',
  })

  // 3. Wall collision integrity (Normal movement + Wall)
  const wallIntegrity = patch !== 'patch_disable_wall'
  tests.push({
    id: 'reg_wall_collision',
    name: 'Wall Boundary Integrity (Solid Barrier Physics)',
    passed: wallIntegrity,
    details: wallIntegrity ? 'Wall barriers remain completely solid and impenetrable.' : 'REGRESSION: Walls disabled, entities fall out of bounds.',
  })

  // 4. Dash evasive mechanics
  const dashTest = runQaExperiment(
    { heroAction: 'dash', bossAction: 'cleave', environment: 'near_wall' },
    patch,
  )
  const dashPassed = dashTest.damageDealt === 0
  tests.push({
    id: 'reg_dash_iframes',
    name: 'Dash Evasion & I-Frames',
    passed: dashPassed,
    details: dashPassed ? 'Dash invulnerability functions properly near obstacles.' : 'Dash timing failed.',
  })

  // 5. Shield availability
  const shieldAvailable = patch !== 'patch_remove_shield'
  tests.push({
    id: 'reg_shield_feature',
    name: 'Shield Guard Combat Feature Availability',
    passed: shieldAvailable,
    details: shieldAvailable ? 'Shield ability remains fully accessible in player loadout.' : 'REGRESSION: Shield ability was deleted.',
  })

  const allPassed = tests.every((t) => t.passed)

  let feedback: string
  if (allPassed) {
    feedback = 'REGRESSION SUITE PASSED! The surgical wall-bounce immunity patch completely eliminates the multi-hit glitch while keeping all core combat physics intact.'
  } else {
    feedback = 'REGRESSION SUITE FAILED: Your selected patch introduced unintended side-effects or failed to eliminate the defect.'
  }

  return { allPassed, tests, feedback }
}

export interface QaPuzzleValidationResult {
  solved: boolean
  bugEverReproduced: boolean
  budgetRemaining: number
  hypothesisCorrect: boolean
  patchCorrect: boolean
  regressionPassed: boolean
  feedback: string
}

export function validateQaInvestigation(qa: QaSettings): QaPuzzleValidationResult {
  const testedRuns = qa.testedRuns ?? []
  const bugEverReproduced = testedRuns.some((r) => r.bugTriggered)
  const budgetRemaining = qa.experimentBudgetRemaining ?? 6

  const rootCause = qa.selectedRootCause ?? ''
  const hypothesisCorrect =
    rootCause.includes('shield') &&
    rootCause.includes('slam') &&
    rootCause.includes('wall')

  const patchCorrect = qa.selectedPhysicsPatch === 'patch_wall_iframe'
  const regression = runQaRegressionSuite(qa.selectedPhysicsPatch ?? null)
  const regressionPassed = regression.allPassed

  let feedback: string
  if (!bugEverReproduced) {
    feedback = 'BUG NOT REPRODUCED: You must reproduce the defect in the test chamber before you can isolate its cause.'
  } else if (!hypothesisCorrect) {
    feedback = 'INCORRECT HYPOTHESIS: Your identified trigger conditions do not match the telemetry data from your experiments.'
  } else if (!patchCorrect) {
    feedback = 'INEFFECTIVE PATCH: Choose a surgical fix that resolves the rebound multi-hit without breaking wall collision or removing the shield.'
  } else if (!regressionPassed) {
    feedback = regression.feedback
  } else {
    feedback = 'INTERMITTENT BUG RESOLVED! You systematically isolated the 3-condition trigger, proved root cause, and verified the engine patch.'
  }

  const solved = bugEverReproduced && hypothesisCorrect && patchCorrect && regressionPassed

  return {
    solved,
    bugEverReproduced,
    budgetRemaining,
    hypothesisCorrect,
    patchCorrect,
    regressionPassed,
    feedback,
  }
}
