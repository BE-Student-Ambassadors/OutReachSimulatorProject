/**
 * Pure simulation module for Role 2 — The Broken Boss.
 *
 * Implements a true state-transition decision graph for boss AI behavior.
 * Evaluates behavior across 4 visible test scenarios and 1 unseen regression test.
 */

import type { BossGraphEdge, BossStateId } from '../types/project'

export interface BossGraphScenario {
  id: string
  name: string
  description: string
  playerInitialPos: { x: number; y: number }
  bossInitialPos: { x: number; y: number }
  bossInitialHpPct: number // 100 or 25
  playerBehavior: 'stationary' | 'dodge_behind' | 'hide_behind_wall' | 'burst_damage' | 'hit_and_run'
  hasObstacleWall: boolean
}

export const BOSS_GRAPH_SCENARIOS: BossGraphScenario[] = [
  {
    id: 's1_frontal',
    name: 'Scenario 1: Frontal Engagement',
    description: 'Player stands directly in front within melee reach.',
    playerInitialPos: { x: 75, y: 0 },
    bossInitialPos: { x: 0, y: 0 },
    bossInitialHpPct: 100,
    playerBehavior: 'stationary',
    hasObstacleWall: false,
  },
  {
    id: 's2_dodge',
    name: 'Scenario 2: Roll-Behind Evasion',
    description: 'Player dashes directly behind the boss during telegraph windup.',
    playerInitialPos: { x: 75, y: 0 },
    bossInitialPos: { x: 0, y: 0 },
    bossInitialHpPct: 100,
    playerBehavior: 'dodge_behind',
    hasObstacleWall: false,
  },
  {
    id: 's3_wall',
    name: 'Scenario 3: Pillar Obstruction',
    description: 'Player takes cover behind an arena wall pillar within 200px.',
    playerInitialPos: { x: 180, y: 0 },
    bossInitialPos: { x: 0, y: 0 },
    bossInitialHpPct: 100,
    playerBehavior: 'hide_behind_wall',
    hasObstacleWall: true,
  },
  {
    id: 's4_low_hp',
    name: 'Scenario 4: Critical Health Phase',
    description: 'Boss is reduced to 25% HP while in recovery.',
    playerInitialPos: { x: 80, y: 0 },
    bossInitialPos: { x: 0, y: 0 },
    bossInitialHpPct: 25,
    playerBehavior: 'burst_damage',
    hasObstacleWall: false,
  },
  {
    id: 's5_regression',
    name: 'Scenario 5: Hit-and-Run Skirmish (Regression)',
    description: 'Unseen challenge test: Player alternates kiting and close-range passes.',
    playerInitialPos: { x: 180, y: 40 },
    bossInitialPos: { x: 0, y: 0 },
    bossInitialHpPct: 100,
    playerBehavior: 'hit_and_run',
    hasObstacleWall: true,
  },
]

export interface ScenarioRunResult {
  scenarioId: string
  success: boolean
  failureReason: string | null
  executionTimeline: { time: number; state: BossStateId; note: string }[]
  stepsCount: number
}

export function simulateBossGraphScenario(
  scenario: BossGraphScenario,
  edges: BossGraphEdge[],
): ScenarioRunResult {
  const activeEdges = edges.filter((e) => e.enabled)
  const timeline: { time: number; state: BossStateId; note: string }[] = []

  let currentState: BossStateId = 'CHASE'
  let stateTimer = 0
  const bossHpPct = scenario.bossInitialHpPct

  let playerX = scenario.playerInitialPos.x
  let playerY = scenario.playerInitialPos.y
  let bossX = scenario.bossInitialPos.x
  let bossY = scenario.bossInitialPos.y

  let time = 0
  const dt = 0.1
  const maxTime = 12.0
  let success = false
  let failureReason: string | null = null

  let attacksExecuted = 0
  let retreatShieldTriggered = false
  let stuckCounter = 0
  let lastState: BossStateId = currentState

  while (time < maxTime) {
    time += dt
    stateTimer += dt

    // 1. Simulate Player Movement & Dynamics
    if (scenario.playerBehavior === 'dodge_behind') {
      if (currentState === 'TELEGRAPH_SLAM' && stateTimer > 0.15) {
        playerX = -75 // rolls behind boss!
        playerY = 0
      }
    } else if (scenario.playerBehavior === 'hit_and_run') {
      playerX = 140 + Math.cos(time * 1.5) * 60
      playerY = Math.sin(time * 1.5) * 50
    }

    // Distance and Angle
    const dx = playerX - bossX
    const dy = playerY - bossY
    const dist = Math.hypot(dx, dy)
    const angleToPlayer = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI))
    // Line of sight clears once boss moves past obstacle or if no wall
    const lineOfSight = !scenario.hasObstacleWall || (scenario.id === 's5_regression' && bossX > 80)

    // Boss movement during CHASE
    if (currentState === 'CHASE') {
      const speed = 110
      if (dist > 60) {
        bossX += (dx / Math.max(1, dist)) * speed * dt
        bossY += (dy / Math.max(1, dist)) * speed * dt
      }
    }

    // 2. Telegraph Minimum Duration Check
    const isWindingUp =
      (currentState === 'TELEGRAPH_SLAM' && stateTimer < 0.5) ||
      (currentState === 'TELEGRAPH_BEAM' && stateTimer < 0.6)

    // Evaluate Outgoing Transitions
    const outgoing = activeEdges.filter((e) => e.from === currentState)
    let nextState: BossStateId | null = null
    let transitionReason = ''

    if (!isWindingUp) {
      for (const edge of outgoing) {
        const cond = edge.condition.trim()
        let matched = false

        if (cond === 'Always') {
          if (currentState === 'RECOVER') {
            if (stateTimer >= 0.6) matched = true
          } else {
            matched = true
          }
        } else if (cond === 'Timer Expired') {
          matched = true
        } else if (cond === 'Target In Range <= 80') {
          if (dist <= 80) matched = true
        } else if (cond === 'Target In Range <= 250') {
          if (dist <= 250) matched = true
        } else if (cond.includes('Target In Range <= 250') && cond.includes('LineOfSight == true')) {
          if (dist <= 250 && lineOfSight) matched = true
        } else if (cond === 'Target Angle <= 45') {
          if (angleToPlayer <= 45) matched = true
        } else if (cond === 'Health < 30%') {
          if (bossHpPct < 30) matched = true
        }

        if (matched) {
          nextState = edge.to
          transitionReason = edge.condition
          break
        }
      }
    }

    // 3. Detect Stuck State / Infinite Loop
    if (!isWindingUp && currentState !== 'CHASE' && (nextState === currentState || nextState === null)) {
      stuckCounter++
      if (stuckCounter > 25) {
        failureReason = `Boss stalled indefinitely in [${currentState}] state with no valid exit transition.`
        break
      }
    } else {
      stuckCounter = 0
    }

    // 4. State Action Processing
    if (nextState && nextState !== currentState) {
      timeline.push({
        time: Math.round(time * 10) / 10,
        state: nextState,
        note: `Transitioned from ${currentState} via condition: "${transitionReason}"`,
      })
      currentState = nextState
      stateTimer = 0
    }

    if (currentState === 'ATTACK') {
      attacksExecuted++
      // If boss attempts ranged beam through wall in Scenario 3, that's a failure!
      if (scenario.hasObstacleWall && !lineOfSight && lastState === 'TELEGRAPH_BEAM') {
        failureReason = 'Boss attempted to execute ranged beam directly through solid stone pillar!'
        break
      }
    } else if (currentState === 'RETREAT_SHIELD') {
      retreatShieldTriggered = true
    }

    // Check specific scenario win conditions
    if (scenario.id === 's1_frontal' && attacksExecuted >= 1) {
      success = true
      break
    }
    if (scenario.id === 's2_dodge' && (currentState === 'ATTACK' || currentState === 'RECOVER')) {
      success = true
      break
    }
    if (scenario.id === 's3_wall' && (attacksExecuted >= 1 || time > 2.0) && failureReason === null) {
      success = true
      break
    }
    if (scenario.id === 's4_low_hp' && retreatShieldTriggered) {
      success = true
      break
    }
    if (scenario.id === 's5_regression' && (attacksExecuted >= 1 || time > 3.0) && failureReason === null) {
      success = true
      break
    }

    lastState = currentState
  }

  if (!success && !failureReason) {
    if (scenario.id === 's2_dodge') {
      failureReason = 'Boss froze in telegraph state when player rolled behind, missing a fallback timer transition.'
    } else if (scenario.id === 's4_low_hp') {
      failureReason = 'Boss failed to trigger Retreat Shield when below 30% HP during recovery.'
    } else {
      failureReason = `Scenario timed out in [${lastState}] state before achieving tactical objective.`
    }
  }

  return {
    scenarioId: scenario.id,
    success,
    failureReason: success ? null : failureReason,
    executionTimeline: timeline,
    stepsCount: timeline.length,
  }
}

export interface BossGraphValidationResult {
  solved: boolean
  allPassed: boolean
  visibleScenariosPassed: boolean
  regressionPassed: boolean
  scenarioResults: Record<string, ScenarioRunResult>
  feedback: string
}

export function validateBossGraph(edges: BossGraphEdge[]): BossGraphValidationResult {
  const scenarioResults: Record<string, ScenarioRunResult> = {}

  let visibleCount = 0
  let regressionCount = 0

  for (const scen of BOSS_GRAPH_SCENARIOS) {
    const res = simulateBossGraphScenario(scen, edges)
    scenarioResults[scen.id] = res

    if (scen.id === 's5_regression') {
      if (res.success) regressionCount++
    } else {
      if (res.success) visibleCount++
    }
  }

  const visibleScenariosPassed = visibleCount === 4
  const regressionPassed = regressionCount === 1
  const allPassed = visibleScenariosPassed && regressionPassed

  let feedback: string
  if (!scenarioResults['s1_frontal']?.success) {
    feedback = `Scenario 1 Failed: ${scenarioResults['s1_frontal']?.failureReason}`
  } else if (!scenarioResults['s2_dodge']?.success) {
    feedback = `Scenario 2 Failed: ${scenarioResults['s2_dodge']?.failureReason}`
  } else if (!scenarioResults['s3_wall']?.success) {
    feedback = `Scenario 3 Failed: ${scenarioResults['s3_wall']?.failureReason}`
  } else if (!scenarioResults['s4_low_hp']?.success) {
    feedback = `Scenario 4 Failed: ${scenarioResults['s4_low_hp']?.failureReason}`
  } else if (!regressionPassed) {
    feedback = `Regression Scenario Failed: ${scenarioResults['s5_regression']?.failureReason}`
  } else {
    feedback = 'BOSS BEHAVIOR GRAPH FULLY STABILIZED! All dynamic combat scenarios and unseen regression tests passed with zero deadlocks.'
  }

  return {
    solved: allPassed,
    allPassed,
    visibleScenariosPassed,
    regressionPassed,
    scenarioResults,
    feedback,
  }
}
