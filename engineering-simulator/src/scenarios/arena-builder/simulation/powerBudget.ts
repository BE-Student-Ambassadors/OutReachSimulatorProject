import { TOTAL_HERO_POWER_BUDGET } from '../data/heroCatalog'
import type { HeroConfig } from '../types/project'

export interface PowerBudgetBreakdown {
  speedPower: number
  healthPower: number
  damagePower: number
  cooldownPower: number
  weaponPower: number
  abilityPower: number
  totalPowerUsed: number
  maxPowerBudget: number
  isOverBudget: boolean
  remainingPower: number
}

export function calculateHeroPower(hero: HeroConfig): PowerBudgetBreakdown {
  // Speed: 120 - 240 px/s -> 0 to 25 points
  const speedPower = Math.round(((Math.max(120, Math.min(240, hero.moveSpeed)) - 120) / (240 - 120)) * 25)

  // Health: 80 - 220 HP -> 0 to 30 points
  const healthPower = Math.round(((Math.max(80, Math.min(220, hero.maxHealth)) - 80) / (220 - 80)) * 30)

  // Attack Damage: 12 - 35 dmg -> 0 to 25 points
  const damagePower = Math.round(((Math.max(12, Math.min(35, hero.attackDamage)) - 12) / (35 - 12)) * 25)

  // Attack Cooldown: 0.8s (slow) to 0.25s (fast) -> 0 to 20 points
  const cooldownPower = Math.round(((0.8 - Math.max(0.25, Math.min(0.8, hero.attackCooldown))) / (0.8 - 0.25)) * 20)

  // Weapon baseline cost
  const weaponPower = hero.weapon === 'hammer' ? 14 : hero.weapon === 'sword' ? 10 : 10

  // Ability baseline cost
  const abilityPower = hero.ability === 'heal' ? 14 : hero.ability === 'shield' ? 11 : 10

  const totalPowerUsed = speedPower + healthPower + damagePower + cooldownPower + weaponPower + abilityPower
  const isOverBudget = totalPowerUsed > TOTAL_HERO_POWER_BUDGET
  const remainingPower = TOTAL_HERO_POWER_BUDGET - totalPowerUsed

  return {
    speedPower,
    healthPower,
    damagePower,
    cooldownPower,
    weaponPower,
    abilityPower,
    totalPowerUsed,
    maxPowerBudget: TOTAL_HERO_POWER_BUDGET,
    isOverBudget,
    remainingPower,
  }
}

export function isHeroConfigValid(hero: HeroConfig): { valid: boolean; reason?: string } {
  if (!hero.name.trim()) {
    return { valid: false, reason: 'Hero must have a name.' }
  }
  const budget = calculateHeroPower(hero)
  if (budget.isOverBudget) {
    return { valid: false, reason: `Power budget exceeded (${budget.totalPowerUsed}/${TOTAL_HERO_POWER_BUDGET} pts). Reduce some attributes.` }
  }
  return { valid: true }
}
