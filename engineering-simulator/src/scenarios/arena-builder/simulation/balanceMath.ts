import { WEAPON_SPECS } from '../data/heroCatalog'
import type { BossConfig, HeroConfig, PlaytestResult } from '../types/project'

export interface BalanceTelemetry {
  effectiveHeroDamage: number
  hitsToDefeatBoss: number
  hitsToDefeatHero: number
  heroDpsEstimated: number
  bossRecoveryRating: 'Very Punishing (Short)' | 'Balanced & Fair' | 'Very Generous (Long)'
  expectedDurationEstimate: string
  balanceSummary: string
}

export function computeBalanceTelemetry(hero: HeroConfig, boss: BossConfig): BalanceTelemetry {
  const weaponSpec = WEAPON_SPECS[hero.weapon]
  const effectiveHeroDamage = Math.round(hero.attackDamage * weaponSpec.damageMultiplier)

  const hitsToDefeatBoss = Math.ceil(boss.maxHealth / Math.max(1, effectiveHeroDamage))
  const hitsToDefeatHero = Math.ceil(hero.maxHealth / Math.max(1, boss.attackDamage))

  const attackRate = 1 / Math.max(0.1, hero.attackCooldown * weaponSpec.cooldownModifier)
  const heroDpsEstimated = Math.round(effectiveHeroDamage * attackRate * 0.7) // assume 70% uptime

  const recovery = boss.behavior.recoveryDuration
  const bossRecoveryRating =
    recovery < 0.6
      ? 'Very Punishing (Short)'
      : recovery > 1.2
        ? 'Very Generous (Long)'
        : 'Balanced & Fair'

  const estSeconds = Math.round(hitsToDefeatBoss * (hero.attackCooldown + 1.2))
  const expectedDurationEstimate = `~${Math.max(15, estSeconds - 5)}–${estSeconds + 15}s`

  let balanceSummary = ''
  if (hitsToDefeatHero <= 3) {
    balanceSummary = 'High lethality: Hero can only withstand 3 or fewer boss strikes. Consider increasing hero health or lowering boss attack damage.'
  } else if (hitsToDefeatBoss > 25) {
    balanceSummary = 'Extended sponge: Boss requires over 25 successful hits to defeat. Consider increasing hero attack damage or lowering boss health.'
  } else {
    balanceSummary = 'Balanced match: Both combatants have distinct tactical win conditions and readable vulnerability windows.'
  }

  return {
    effectiveHeroDamage,
    hitsToDefeatBoss,
    hitsToDefeatHero,
    heroDpsEstimated,
    bossRecoveryRating,
    expectedDurationEstimate,
    balanceSummary,
  }
}

export function generatePlaytestObservations(result: PlaytestResult, hero: HeroConfig, boss: BossConfig): string[] {
  const observations: string[] = []

  // Outcome & Duration
  if (result.winner === 'boss') {
    observations.push(`The player was defeated after ${result.durationSeconds.toFixed(1)} seconds.`)
  } else {
    observations.push(`The hero defeated the boss in ${result.durationSeconds.toFixed(1)} seconds!`)
  }

  // Hit efficiency
  observations.push(
    `The hero landed ${result.hitsLanded} hit(s) dealing ${result.heroDamageDealt} damage, while the boss landed ${result.hitsReceived} hit(s) dealing ${result.bossDamageDealt} damage.`,
  )

  // Dodges
  if (result.attacksDodged > 0) {
    observations.push(`The player successfully dodged out of ${result.attacksDodged} telegraphed boss attack zone(s).`)
  } else {
    observations.push('The player did not evade any boss attack telegraphs before impact.')
  }

  // Boss Recovery & Mechanics
  const recovery = boss.behavior.recoveryDuration
  if (recovery <= 0.5) {
    observations.push(`The boss had a brief recovery window of ${recovery.toFixed(2)}s, giving the hero very few openings to strike back safely.`)
  } else {
    observations.push(`The boss had a ${recovery.toFixed(2)}s recovery window, creating identifiable punish opportunities after attacks.`)
  }

  // Weapon performance
  if (hero.weapon === 'blaster') {
    observations.push(`Pulse rifle projectiles were stopped whenever obstacles or walls blocked line of sight.`)
  } else if (hero.weapon === 'hammer') {
    observations.push(`Titan maul strikes exerted strong knockback on the boss, resetting engagement distance.`)
  } else {
    observations.push(`Plasma blade required close-range engagement to connect with the boss hitbox.`)
  }

  // Remaining health
  if (result.winner === 'player') {
    observations.push(`Hero finished the duel with ${result.heroRemainingHpPct.toFixed(0)}% health remaining.`)
  } else {
    observations.push(`Boss survived with ${result.bossRemainingHpPct.toFixed(0)}% health remaining.`)
  }

  return observations
}
