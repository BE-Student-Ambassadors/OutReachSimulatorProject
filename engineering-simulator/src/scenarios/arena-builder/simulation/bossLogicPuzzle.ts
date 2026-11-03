/**
 * Simulation and validation for Role 2 — Gameplay Programmer: The Boss Logic Puzzle.
 *
 * The boss is behaving erratically: attacking before reaching the player, attacking repeatedly
 * without recovery, or getting stuck. The programmer must reorder visual instruction blocks
 * and ensure the range comparison operator is correct.
 */

export type BossLogicBlockId = 'CHASE' | 'CHECK_RANGE' | 'ATTACK' | 'RECOVER'

export interface BossLogicBlock {
  id: BossLogicBlockId
  label: string
  description: string
  color: string
}

export const BOSS_LOGIC_BLOCKS: Record<BossLogicBlockId, BossLogicBlock> = {
  CHASE: {
    id: 'CHASE',
    label: 'CHASE PLAYER',
    description: 'Pursue the player across the arena to close distance.',
    color: '#3b82f6', // blue
  },
  CHECK_RANGE: {
    id: 'CHECK_RANGE',
    label: 'CHECK ATTACK RANGE',
    description: 'Evaluate if player distance satisfies attack condition.',
    color: '#8b5cf6', // purple
  },
  ATTACK: {
    id: 'ATTACK',
    label: 'EXECUTE ATTACK',
    description: 'Wind up and trigger the boss melee cleave.',
    color: '#ef4444', // red
  },
  RECOVER: {
    id: 'RECOVER',
    label: 'RECOVERY COOLDOWN',
    description: 'Vulnerable recovery window allowing counter-attacks.',
    color: '#10b981', // green
  },
}

export interface BossSimulationStep {
  stepIndex: number
  blockId: BossLogicBlockId
  bossDistance: number
  inRange: boolean
  actionDescription: string
  errorDetected?: string
}

export interface BossLogicRunResult {
  valid: boolean
  steps: BossSimulationStep[]
  loopCyclesCompleted: number
  status:
    | 'premature_attack'
    | 'unrecovered_attack'
    | 'inverted_condition'
    | 'infinite_chase'
    | 'missing_blocks'
    | 'success'
  failureReason?: string
  message: string
}

/**
 * Headless simulator that executes a sequence of instruction blocks in a loop.
 * Boss starts at initialDistance (default 220px), attackRange is 80px.
 */
export function simulateBossLogic(
  sequence: BossLogicBlockId[],
  distanceOperator: '<=' | '>' | '==' = '<=',
  attackRange: number = 80,
  initialDistance: number = 220,
): BossLogicRunResult {
  const steps: BossSimulationStep[] = []

  if (!sequence || sequence.length === 0) {
    return {
      valid: false,
      steps: [],
      loopCyclesCompleted: 0,
      status: 'missing_blocks',
      failureReason: 'No instruction blocks provided.',
      message: 'No instruction blocks provided. The boss requires instructions to act.',
    }
  }

  let curDist = initialDistance
  let hasCheckedRange = false
  let inAttackRange = false
  let previousBlock: BossLogicBlockId | null = null
  let attackCount = 0
  let recoveryCount = 0
  const maxSteps = 16

  for (let i = 0; i < maxSteps; i++) {
    const block = sequence[i % sequence.length]
    let actionDesc = ''
    let error: string | undefined

    switch (block) {
      case 'CHASE': {
        // Boss moves closer by 75px per chase step
        curDist = Math.max(30, curDist - 75)
        actionDesc = `Boss pursues hero. Distance narrowed to ${curDist}px.`
        hasCheckedRange = false
        break
      }

      case 'CHECK_RANGE': {
        hasCheckedRange = true
        if (distanceOperator === '<=') {
          inAttackRange = curDist <= attackRange
        } else if (distanceOperator === '>') {
          inAttackRange = curDist > attackRange
        } else {
          inAttackRange = curDist === attackRange
        }

        actionDesc = `Evaluated: distance (${curDist}px) ${distanceOperator} ${attackRange}px -> ${inAttackRange ? 'TRUE (In Range)' : 'FALSE (Out of Range)'}.`
        break
      }

      case 'ATTACK': {
        attackCount++

        // Check premature attack: attacked before confirming range or while too far
        if (!hasCheckedRange && curDist > attackRange) {
          error = 'The boss attempted an attack before confirming the player was in range.'
          steps.push({
            stepIndex: i + 1,
            blockId: block,
            bossDistance: curDist,
            inRange: false,
            actionDescription: `Boss swung weapon while hero was still ${curDist}px away!`,
            errorDetected: error,
          })
          return {
            valid: false,
            steps,
            loopCyclesCompleted: 0,
            status: 'premature_attack',
            failureReason: error,
            message: 'Defect: The boss attempted an attack before confirming the player was in range.',
          }
        }

        // Check inverted operator
        if (distanceOperator === '>' && inAttackRange && curDist > attackRange) {
          error = 'Comparison inverted: boss attacked because distance was GREATER than attack range!'
          steps.push({
            stepIndex: i + 1,
            blockId: block,
            bossDistance: curDist,
            inRange: false,
            actionDescription: `Triggered by incorrect (dist > ${attackRange}px) condition at ${curDist}px!`,
            errorDetected: error,
          })
          return {
            valid: false,
            steps,
            loopCyclesCompleted: 0,
            status: 'inverted_condition',
            failureReason: error,
            message: 'Defect: The distance condition is inverted (> instead of <=). The boss attacks only when far away!',
          }
        }

        // Check if attack happened repeatedly without recovery
        if (previousBlock === 'ATTACK' || (attackCount > 1 && recoveryCount === 0)) {
          error = 'The boss attacked repeatedly without entering recovery.'
          steps.push({
            stepIndex: i + 1,
            blockId: block,
            bossDistance: curDist,
            inRange: inAttackRange,
            actionDescription: 'Boss strikes consecutively without vulnerable cooldown!',
            errorDetected: error,
          })
          return {
            valid: false,
            steps,
            loopCyclesCompleted: 0,
            status: 'unrecovered_attack',
            failureReason: error,
            message: 'Defect: The boss attacked repeatedly without entering recovery!',
          }
        }

        actionDesc = `Boss unleashes cleave attack at distance ${curDist}px!`
        break
      }

      case 'RECOVER': {
        recoveryCount++
        actionDesc = 'Boss pauses in vulnerable recovery state (0.8s), open to counter-attack.'
        break
      }
    }

    steps.push({
      stepIndex: i + 1,
      blockId: block,
      bossDistance: curDist,
      inRange: curDist <= attackRange,
      actionDescription: actionDesc,
      errorDetected: error,
    })

    previousBlock = block

    // If we completed a full cycle with approach, attack, and recover
    if (attackCount >= 1 && recoveryCount >= 1 && curDist <= attackRange) {
      break
    }
  }

  // Check completeness after running
  const uniqueBlocks = new Set(sequence)
  if (!uniqueBlocks.has('CHASE') || !uniqueBlocks.has('ATTACK')) {
    return {
      valid: false,
      steps,
      loopCyclesCompleted: 0,
      status: 'missing_blocks',
      failureReason: 'Missing essential behavior blocks. Boss logic requires Chase, Attack, and Recovery.',
      message: 'Missing essential behavior blocks. The boss must be able to chase, attack, and recover.',
    }
  }

  if (!uniqueBlocks.has('RECOVER')) {
    return {
      valid: false,
      steps,
      loopCyclesCompleted: 0,
      status: 'unrecovered_attack',
      failureReason: 'The boss attacked without entering recovery.',
      message: 'Defect: The boss attacked repeatedly without entering recovery.',
    }
  }

  // Verification
  if (attackCount >= 1 && recoveryCount >= 1 && distanceOperator === '<=') {
    return {
      valid: true,
      steps,
      loopCyclesCompleted: 1,
      status: 'success',
      message:
        "BOSS AI REPAIRED! You fixed the enemy's behavior logic. This is how programmers use conditions and state machines to control game characters.",
    }
  }

  return {
    valid: false,
    steps,
    loopCyclesCompleted: 0,
    status: 'infinite_chase',
    failureReason: 'The boss sequence could not complete a clean attack-and-recover cycle.',
    message: 'The boss sequence did not successfully execute an attack and recover cycle.',
  }
}
