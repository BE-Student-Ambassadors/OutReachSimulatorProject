/**
 * Pure simulation module for Role 1 — The Unwinnable Duel.
 *
 * Simulates frame-based combat interactions including:
 * - Windup (Startup)
 * - Active Strike Frames
 * - Endlag (Recovery Window)
 * - Poise / Stagger Interruption
 * - Reactive Dash-Cancels
 * - Swift Flurry Armor-Piercing Combos & Evasion
 */

import type { HeroConfig } from '../types/project'

export interface DuelOpponent {
  id: 'scout' | 'sentinel' | 'mirror'
  name: string
  archetype: 'agile_scout' | 'iron_sentinel' | 'mirror_duelist'
  maxHp: number
  damage: number
  windup: number
  active: number
  endlag: number
  armor: number // flat damage reduction
  speed: number
  description: string
}

export const DUEL_OPPONENTS: Record<string, DuelOpponent> = {
  scout: {
    id: 'scout',
    name: 'Agile Scout',
    archetype: 'agile_scout',
    maxHp: 65,
    damage: 14,
    windup: 0.15,
    active: 0.1,
    endlag: 0.2,
    armor: 0,
    speed: 210,
    description: 'Fast skirmisher that exploits long recovery windows and staggers unprotected windups.',
  },
  sentinel: {
    id: 'sentinel',
    name: 'Iron Sentinel',
    archetype: 'iron_sentinel',
    maxHp: 160,
    damage: 24,
    windup: 0.7,
    active: 0.2,
    endlag: 0.7,
    armor: 6, // blocks light scratches
    speed: 100,
    description: 'Heavily armored juggernaut that brushes off rapid light taps and delivers crushing counter-strikes.',
  },
  mirror: {
    id: 'mirror',
    name: 'Shadow Duelist',
    archetype: 'mirror_duelist',
    maxHp: 110,
    damage: 18,
    windup: 0.35,
    active: 0.15,
    endlag: 0.45,
    armor: 2,
    speed: 160,
    description: 'Balanced combatant used to evaluate duel symmetry and matchup variance.',
  },
}

export interface DuelSimulationResult {
  winner: 'player' | 'opponent'
  duration: number
  playerHpRemaining: number
  opponentHpRemaining: number
  playerHitsLanded: number
  opponentHitsLanded: number
  punishHitsTakenDuringLag: number
  staggeredCount: number
  log: string[]
}

export function simulateDuelMatch(
  playstyle: 'heavy' | 'swift',
  opponent: DuelOpponent,
  params: {
    heavyEndlag: number
    heavyPoiseStartup: boolean
    heavyDashCancelWindow: boolean
    swiftRecoveryGap: number
    initiativeOffset?: number
  },
): DuelSimulationResult {
  const isHeavy = playstyle === 'heavy'

  let playerHp = isHeavy ? 150 : 100
  let opponentHp = opponent.maxHp
  const playerDmg = isHeavy ? 36 : 14
  const playerWindup = isHeavy ? 0.45 : 0.12
  const playerActive = 0.15
  const playerEndlag = isHeavy ? params.heavyEndlag : params.swiftRecoveryGap
  const hasPoise = isHeavy ? params.heavyPoiseStartup : false
  const hasDashCancel = isHeavy ? params.heavyDashCancelWindow : false

  let pState: 'ready' | 'windup' | 'active' | 'endlag' = 'ready'
  let pTimer = params.initiativeOffset && params.initiativeOffset > 0 ? params.initiativeOffset : 0

  let oState: 'ready' | 'windup' | 'active' | 'endlag' = 'ready'
  let oTimer = params.initiativeOffset && params.initiativeOffset < 0 ? -params.initiativeOffset : 0

  let time = 0
  const dt = 0.05
  const maxTime = 30.0

  let playerHits = 0
  let opponentHits = 0
  let punishHits = 0
  let staggeredCount = 0
  let comboCounter = 0
  const log: string[] = []

  while (time < maxTime && playerHp > 0 && opponentHp > 0) {
    time += dt

    // 1. Player State Advance
    pTimer -= dt
    if (pTimer <= 0) {
      if (pState === 'ready') {
        pState = 'windup'
        pTimer = playerWindup
      } else if (pState === 'windup') {
        pState = 'active'
        pTimer = playerActive
        playerHits++
        comboCounter++

        // Swift Striker rhythm combo: 3rd hit pierces armor
        let effectiveDmg = Math.max(2, playerDmg - opponent.armor)
        if (!isHeavy && comboCounter % 3 === 0) {
          effectiveDmg = 26 // armor-piercing critical flurry
          log.push(`[${time.toFixed(1)}s] CRITICAL FLURRY! Swift combo pierced armor for ${effectiveDmg} dmg!`)
        } else {
          log.push(`[${time.toFixed(1)}s] Player ${isHeavy ? 'Heavy Strike' : 'Swift Flurry'} hit for ${effectiveDmg} dmg. (Foe HP: ${opponentHp})`)
        }

        opponentHp = Math.max(0, opponentHp - effectiveDmg)

        // High-impact heavy strike staggers light opponent's windup
        if (isHeavy && opponent.armor === 0 && oState === 'windup') {
          oState = 'endlag'
          oTimer = 0.3
          log.push(`[${time.toFixed(1)}s] Opponent staggered by high-impact blow!`)
        }
      } else if (pState === 'active') {
        pState = 'endlag'
        pTimer = (hasDashCancel && oState === 'windup') ? playerEndlag * 0.45 : playerEndlag
      } else if (pState === 'endlag') {
        pState = 'ready'
      }
    }

    // 2. Opponent State Advance
    oTimer -= dt
    if (oTimer <= 0) {
      if (oState === 'ready') {
        oState = 'windup'
        oTimer = opponent.windup
      } else if (oState === 'windup') {
        oState = 'active'
        oTimer = opponent.active
        opponentHits++

        // Swift Striker evasion against slow telegraphs
        const isEvaded = !isHeavy && opponent.windup >= 0.6 && opponentHits % 2 === 1 && params.swiftRecoveryGap >= 0.18
        if (isEvaded) {
          log.push(`[${time.toFixed(1)}s] Swift Striker agilely evaded ${opponent.name}'s slow telegraph!`)
        } else {
          if (opponentHp > 0) playerHp = Math.max(0, playerHp - opponent.damage)
          log.push(`[${time.toFixed(1)}s] ${opponent.name} struck for ${opponent.damage} dmg. (Player HP: ${playerHp})`)
        }

        if (pState === 'endlag') {
          punishHits++
          log.push(`[${time.toFixed(1)}s] CRITICAL: Player punished during vulnerable recovery lag!`)
        }

        // Stagger check on player during windup
        if (pState === 'windup') {
          if (!hasPoise) {
            pState = 'endlag'
            pTimer = 0.4
            staggeredCount++
            comboCounter = 0
            log.push(`[${time.toFixed(1)}s] Player interrupted and staggered during windup! (No Poise Armor)`)
          } else {
            log.push(`[${time.toFixed(1)}s] Player Poise Armor absorbed the blow without interruption!`)
          }
        }
      } else if (oState === 'active') {
        oState = 'endlag'
        oTimer = opponent.endlag
      } else if (oState === 'endlag') {
        oState = 'ready'
      }
    }
  }

  const winner = playerHp > 0 && opponentHp <= 0 ? 'player' : 'opponent'

  return {
    winner,
    duration: Math.round(time * 10) / 10,
    playerHpRemaining: Math.round(playerHp),
    opponentHpRemaining: Math.round(opponentHp),
    playerHitsLanded: playerHits,
    opponentHitsLanded: opponentHits,
    punishHitsTakenDuringLag: punishHits,
    staggeredCount,
    log: log.slice(-12),
  }
}

export interface DuelValidationResult {
  solved: boolean
  heavyVsScoutPassed: boolean
  swiftVsSentinelPassed: boolean
  mirrorMatchBalanced: boolean
  timeToKillSensible: boolean
  feedback: string
  scenarios: {
    heavyVsScout: DuelSimulationResult
    swiftVsSentinel: DuelSimulationResult
    heavyVsSwift: { heavyWinrate: number; swiftWinrate: number; log: string }
  }
}

export function validateDuelMystery(hero: HeroConfig): DuelValidationResult {
  const heavyEndlag = hero.heavyEndlag ?? 1.2
  const heavyPoiseStartup = hero.heavyPoiseStartup ?? false
  const heavyDashCancelWindow = hero.heavyDashCancelWindow ?? false
  const swiftRecoveryGap = hero.swiftRecoveryGap ?? 0.05

  const params = {
    heavyEndlag,
    heavyPoiseStartup,
    heavyDashCancelWindow,
    swiftRecoveryGap,
  }

  // Scenario 1: Heavy Colossus vs Agile Scout
  const heavyVsScout = simulateDuelMatch('heavy', DUEL_OPPONENTS.scout, params)
  const heavyVsScoutPassed = heavyVsScout.winner === 'player' && heavyVsScout.staggeredCount <= 1

  // Scenario 2: Swift Striker vs Iron Sentinel
  // Swift needs a modest recovery gap (0.18s - 0.35s) so it cannot infinite-stunlock without risk
  const swiftVsSentinel = simulateDuelMatch('swift', DUEL_OPPONENTS.sentinel, params)
  const swiftVsSentinelPassed = swiftVsSentinel.winner === 'player' && swiftRecoveryGap >= 0.18

  // Scenario 3: Mirror Duel (Heavy vs Swift)
  let heavyWins = 0
  for (let i = 0; i < 5; i++) {
    const offset = (i - 2) * 0.12
    const res = simulateDuelMatch('heavy', {
      id: 'mirror',
      name: 'Swift Shadow',
      archetype: 'agile_scout',
      maxHp: 125,
      damage: 22,
      windup: 0.12,
      active: 0.15,
      endlag: swiftRecoveryGap,
      armor: 0,
      speed: 200,
      description: 'Shadow replica',
    }, { ...params, initiativeOffset: offset })
    if (res.winner === 'player') heavyWins++
  }

  const heavyWinrate = heavyWins / 5
  const swiftWinrate = 1 - heavyWinrate
  const mirrorMatchBalanced = heavyWinrate >= 0.2 && heavyWinrate <= 0.8

  const timeToKillSensible =
    heavyVsScout.duration >= 1.2 &&
    heavyVsScout.duration <= 25.0 &&
    swiftVsSentinel.duration >= 3.0 &&
    swiftVsSentinel.duration <= 25.0

  let feedback: string
  if (!heavyVsScoutPassed) {
    if (heavyVsScout.staggeredCount > 1) {
      feedback = 'Heavy Colossus is constantly interrupted during windup. Consider granting Poise Armor during attack startup.'
    } else {
      feedback = 'Heavy Colossus has excessive endlag (recovery window). The Agile Scout counters repeatedly while the hero cannot move.'
    }
  } else if (!swiftVsSentinelPassed) {
    if (swiftRecoveryGap < 0.18) {
      feedback = 'Swift Striker has near-zero recovery gap (0.05s), leading to unintended infinite-stun spam that fails against armored counter-attacks.'
    } else {
      feedback = 'Swift Striker fails against Iron Sentinel. Ensure attack pacing allows tactical evasion.'
    }
  } else if (!mirrorMatchBalanced) {
    feedback = `Matchup asymmetry too high (Heavy winrate: ${(heavyWinrate * 100).toFixed(0)}%). Tune endlag and recovery gap to bring winrates closer to parity.`
  } else if (!timeToKillSensible) {
    feedback = 'Time-To-Kill is out of balance (matches conclude too quickly or take too long).'
  } else {
    feedback = 'COMBAT PARITY RESTORED! Both archetypes are viable across diverse combat encounters with readable counter-play.'
  }

  const solved = heavyVsScoutPassed && swiftVsSentinelPassed && mirrorMatchBalanced && timeToKillSensible

  return {
    solved,
    heavyVsScoutPassed,
    swiftVsSentinelPassed,
    mirrorMatchBalanced,
    timeToKillSensible,
    feedback,
    scenarios: {
      heavyVsScout,
      swiftVsSentinel,
      heavyVsSwift: {
        heavyWinrate,
        swiftWinrate,
        log: `Heavy Colossus won ${heavyWins}/5 duels against Swift Striker (${(heavyWinrate * 100).toFixed(0)}% winrate).`,
      },
    },
  }
}
