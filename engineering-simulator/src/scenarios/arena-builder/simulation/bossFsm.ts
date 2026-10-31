import type { BossBehavior, BossConfig, BossStateId } from '../types/project'

export interface BossFsmTransitionResult {
  nextState: BossStateId
  resetTimer: boolean
  telegraphActive: boolean
  telegraphProgress: number // 0 to 1
  canMove: boolean
  moveDirection: 'towards' | 'away' | 'flank' | 'none'
  shouldFireAttack: boolean
  isVulnerable: boolean
}

export function updateBossFsm(
  state: BossStateId,
  timer: number,
  dt: number,
  behavior: BossBehavior,
  distanceToHero: number,
  bossHpPct: number,
): BossFsmTransitionResult {
  const nextTimer = timer + dt

  switch (state) {
    case 'IDLE': {
      if (distanceToHero <= behavior.detectionRange) {
        return {
          nextState: 'DETECT',
          resetTimer: true,
          telegraphActive: false,
          telegraphProgress: 0,
          canMove: false,
          moveDirection: 'none',
          shouldFireAttack: false,
          isVulnerable: false,
        }
      }
      return {
        nextState: 'IDLE',
        resetTimer: false,
        telegraphActive: false,
        telegraphProgress: 0,
        canMove: false,
        moveDirection: 'none',
        shouldFireAttack: false,
        isVulnerable: false,
      }
    }

    case 'DETECT': {
      // Alert pause before pursuit (0.2s)
      if (nextTimer >= 0.2) {
        return {
          nextState: 'CHASE',
          resetTimer: true,
          telegraphActive: false,
          telegraphProgress: 0,
          canMove: true,
          moveDirection: 'towards',
          shouldFireAttack: false,
          isVulnerable: false,
        }
      }
      return {
        nextState: 'DETECT',
        resetTimer: false,
        telegraphActive: false,
        telegraphProgress: 0,
        canMove: false,
        moveDirection: 'none',
        shouldFireAttack: false,
        isVulnerable: false,
      }
    }

    case 'CHASE': {
      // Check retreat threshold if hurt and close
      if (behavior.retreatThreshold > 0 && bossHpPct <= behavior.retreatThreshold && distanceToHero < 150) {
        return {
          nextState: 'RETREAT',
          resetTimer: true,
          telegraphActive: false,
          telegraphProgress: 0,
          canMove: true,
          moveDirection: 'away',
          shouldFireAttack: false,
          isVulnerable: false,
        }
      }

      // Check attack range
      if (distanceToHero <= behavior.attackRange) {
        return {
          nextState: 'WINDUP',
          resetTimer: true,
          telegraphActive: true,
          telegraphProgress: 0,
          canMove: false,
          moveDirection: 'none',
          shouldFireAttack: false,
          isVulnerable: false,
        }
      }

      // Lost target if too far
      if (distanceToHero > behavior.detectionRange * 1.4) {
        return {
          nextState: 'IDLE',
          resetTimer: true,
          telegraphActive: false,
          telegraphProgress: 0,
          canMove: false,
          moveDirection: 'none',
          shouldFireAttack: false,
          isVulnerable: false,
        }
      }

      return {
        nextState: 'CHASE',
        resetTimer: false,
        telegraphActive: false,
        telegraphProgress: 0,
        canMove: true,
        moveDirection: 'towards',
        shouldFireAttack: false,
        isVulnerable: false,
      }
    }

    case 'WINDUP': {
      const progress = Math.min(1, nextTimer / Math.max(0.01, behavior.attackWindup))
      if (nextTimer >= behavior.attackWindup) {
        return {
          nextState: 'ATTACK',
          resetTimer: true,
          telegraphActive: false,
          telegraphProgress: 1,
          canMove: false,
          moveDirection: 'none',
          shouldFireAttack: true,
          isVulnerable: false,
        }
      }
      return {
        nextState: 'WINDUP',
        resetTimer: false,
        telegraphActive: true,
        telegraphProgress: progress,
        canMove: false,
        moveDirection: 'none',
        shouldFireAttack: false,
        isVulnerable: false,
      }
    }

    case 'ATTACK': {
      // Attack execution lasts 0.15s
      if (nextTimer >= 0.15) {
        // In the debugging challenge, stateAfterAttack might be bugged to 'ATTACK' or 'CHASE'
        const nextState = behavior.stateAfterAttack || 'RECOVER'
        return {
          nextState,
          resetTimer: true,
          telegraphActive: false,
          telegraphProgress: 0,
          canMove: nextState === 'CHASE',
          moveDirection: nextState === 'CHASE' ? 'towards' : 'none',
          shouldFireAttack: false,
          isVulnerable: nextState === 'RECOVER',
        }
      }
      return {
        nextState: 'ATTACK',
        resetTimer: false,
        telegraphActive: false,
        telegraphProgress: 0,
        canMove: false,
        moveDirection: 'none',
        shouldFireAttack: false,
        isVulnerable: false,
      }
    }

    case 'RECOVER': {
      // Recovery window where boss is vulnerable
      if (nextTimer >= behavior.recoveryDuration) {
        return {
          nextState: 'CHASE',
          resetTimer: true,
          telegraphActive: false,
          telegraphProgress: 0,
          canMove: true,
          moveDirection: 'towards',
          shouldFireAttack: false,
          isVulnerable: false,
        }
      }
      return {
        nextState: 'RECOVER',
        resetTimer: false,
        telegraphActive: false,
        telegraphProgress: 0,
        canMove: false,
        moveDirection: 'none',
        shouldFireAttack: false,
        isVulnerable: true,
      }
    }

    case 'RETREAT': {
      // Retreat for 1.8s
      if (nextTimer >= 1.8 || distanceToHero >= behavior.detectionRange * 0.9) {
        return {
          nextState: 'REPOSITION',
          resetTimer: true,
          telegraphActive: false,
          telegraphProgress: 0,
          canMove: true,
          moveDirection: 'flank',
          shouldFireAttack: false,
          isVulnerable: false,
        }
      }
      return {
        nextState: 'RETREAT',
        resetTimer: false,
        telegraphActive: false,
        telegraphProgress: 0,
        canMove: true,
        moveDirection: 'away',
        shouldFireAttack: false,
        isVulnerable: false,
      }
    }

    case 'REPOSITION': {
      if (nextTimer >= 1.2) {
        return {
          nextState: 'CHASE',
          resetTimer: true,
          telegraphActive: false,
          telegraphProgress: 0,
          canMove: true,
          moveDirection: 'towards',
          shouldFireAttack: false,
          isVulnerable: false,
        }
      }
      return {
        nextState: 'REPOSITION',
        resetTimer: false,
        telegraphActive: false,
        telegraphProgress: 0,
        canMove: true,
        moveDirection: 'flank',
        shouldFireAttack: false,
        isVulnerable: false,
      }
    }

    default:
      return {
        nextState: 'IDLE',
        resetTimer: true,
        telegraphActive: false,
        telegraphProgress: 0,
        canMove: false,
        moveDirection: 'none',
        shouldFireAttack: false,
        isVulnerable: false,
      }
  }
}

export interface BossValidationReport {
  valid: boolean
  issues: string[]
}

export function validateBossConfig(boss: BossConfig): BossValidationReport {
  const issues: string[] = []
  const { behavior } = boss

  if (!boss.name.trim()) {
    issues.push('Boss must have a designated title or name.')
  }
  if (behavior.stateAfterAttack !== 'RECOVER') {
    issues.push(`State machine bug: Transition after ATTACK is set to [${behavior.stateAfterAttack}]. Boss must transition to [RECOVER] to allow player counter-attacks!`)
  }
  if (behavior.recoveryDuration < 0.3) {
    issues.push(`Recovery duration (${behavior.recoveryDuration.toFixed(2)}s) is too short. Player needs an opening to counter-attack!`)
  }
  if (behavior.attackWindup < 0.3) {
    issues.push(`Attack windup (${behavior.attackWindup.toFixed(2)}s) is too fast. Player cannot read or dodge incoming attacks.`)
  }
  if (behavior.attackRange >= behavior.detectionRange) {
    issues.push(`Attack range (${behavior.attackRange}px) cannot be greater than or equal to detection range (${behavior.detectionRange}px).`)
  }
  if (behavior.chaseSpeed > 220) {
    issues.push(`Chase speed (${behavior.chaseSpeed}px/s) is excessively high for standard player maneuvering.`)
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

export interface SimulationEventLog {
  timestamp: string
  fromState: BossStateId
  toState: BossStateId
  message: string
}

export interface BossSimulationReport {
  passed: boolean
  statesVisited: Set<BossStateId>
  cyclesCompleted: number
  stuck: boolean
  summary: string
  eventLog: SimulationEventLog[]
}

/**
 * Headless simulation test: tests the boss AI over 10 simulated seconds
 * with a mock hero standing at different distances to confirm state cycle integrity.
 */
export function runBossAiSimulation(behavior: BossBehavior): BossSimulationReport {
  let state: BossStateId = 'IDLE'
  let timer = 0
  const dt = 0.05 // 20 updates per second
  const totalTicks = 200 // 10 seconds total
  const statesVisited = new Set<BossStateId>([state])
  let cyclesCompleted = 0
  let stuck = false
  let sameStateTicks = 0
  const eventLog: SimulationEventLog[] = []

  let mockDistance = 400
  const hpPct = 100

  for (let tick = 0; tick < totalTicks; tick++) {
    const simTime = (tick * dt).toFixed(2)

    if (state === 'IDLE') mockDistance = 250 // hero approaches
    else if (state === 'CHASE') mockDistance = Math.max(behavior.attackRange - 10, mockDistance - behavior.chaseSpeed * dt)
    else if (state === 'RECOVER') mockDistance = behavior.attackRange + 40 // hero steps back or strikes

    const prevState: BossStateId = state
    const res = updateBossFsm(state, timer, dt, behavior, mockDistance, hpPct)

    if (res.nextState === prevState) {
      sameStateTicks++
      timer += dt
    } else {
      sameStateTicks = 0
      timer = 0
      state = res.nextState
      statesVisited.add(state)

      let msg = `Transitioned to [${state}]`
      if (state === 'DETECT') msg = `Hero detected at ${Math.round(mockDistance)}px (Detection threshold: ${behavior.detectionRange}px)`
      else if (state === 'CHASE') msg = `Pursuing hero at ${behavior.chaseSpeed}px/s`
      else if (state === 'WINDUP') msg = `Hero within attack range (${Math.round(mockDistance)}px <= ${behavior.attackRange}px). Telegraph active for ${behavior.attackWindup.toFixed(2)}s`
      else if (state === 'ATTACK') msg = `Unleashed attack: ${behavior.attackType}`
      else if (state === 'RECOVER') msg = `Vulnerable recovery window active for ${behavior.recoveryDuration.toFixed(2)}s`

      eventLog.push({
        timestamp: `${simTime}s`,
        fromState: prevState,
        toState: state,
        message: msg,
      })

      if (prevState === 'RECOVER' && state === 'CHASE') {
        cyclesCompleted++
      }
    }

    // Check for deadlock (stuck in any single state for > 4 simulated seconds)
    if (sameStateTicks > 80) {
      stuck = true
      eventLog.push({
        timestamp: `${simTime}s`,
        fromState: state,
        toState: state,
        message: `DEADLOCK DETECTED: AI became permanently stuck in [${state}]!`,
      })
      break
    }
  }

  // The AI only passes if it doesn't loop directly into attack and enters recovery
  const loopsWithoutRecovery = behavior.stateAfterAttack !== 'RECOVER'
  const passed =
    !stuck &&
    !loopsWithoutRecovery &&
    statesVisited.has('CHASE') &&
    statesVisited.has('WINDUP') &&
    statesVisited.has('ATTACK') &&
    statesVisited.has('RECOVER')

  return {
    passed,
    statesVisited,
    cyclesCompleted,
    stuck,
    summary: passed
      ? `AI simulation passed: Completed ${cyclesCompleted} full attack-recovery cycle(s) without deadlocks.`
      : loopsWithoutRecovery
        ? `Bug detected: Boss transitions from ATTACK directly to [${behavior.stateAfterAttack}] without entering RECOVER!`
        : stuck
          ? `AI became stuck in state [${state}]. Review state duration and triggers.`
          : 'AI failed to complete all attack and recovery states.',
    eventLog: eventLog.slice(0, 15),
  }
}
