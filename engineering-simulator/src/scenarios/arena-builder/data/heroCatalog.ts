import type { AbilityType, WeaponType } from '../types/project'

export interface WeaponSpec {
  id: WeaponType
  name: string
  tagline: string
  description: string
  rangeCategory: 'Short Melee' | 'Long Range' | 'Heavy Melee'
  damageMultiplier: number
  rangePx: number
  cooldownModifier: number
  knockback: number
  soundEffect: string
  color: string
}

export const WEAPON_SPECS: Record<WeaponType, WeaponSpec> = {
  sword: {
    id: 'sword',
    name: 'Plasma Blade',
    tagline: 'Fast, high-damage melee arc',
    description: 'Deals heavy damage in a sweeping frontal arc (~70px reach). Requires getting up close and personal to land hits.',
    rangeCategory: 'Short Melee',
    damageMultiplier: 1.25,
    rangePx: 75,
    cooldownModifier: 0.85,
    knockback: 18,
    soundEffect: 'slash',
    color: '#06b6d4', // cyan
  },
  blaster: {
    id: 'blaster',
    name: 'Pulse Rifle',
    tagline: 'Ranged energy projectiles',
    description: 'Fires energy bolts across the arena (~450px range). Allows attacking safely from distance, but stopped by walls.',
    rangeCategory: 'Long Range',
    damageMultiplier: 0.9,
    rangePx: 450,
    cooldownModifier: 1.0,
    knockback: 6,
    soundEffect: 'blast',
    color: '#3b82f6', // blue
  },
  hammer: {
    id: 'hammer',
    name: 'Titan Maul',
    tagline: 'Crushing shockwave & heavy knockback',
    description: 'Slow ground slam (+60% damage) that creates a circular shockwave and hurls the boss backward, creating room to breathe.',
    rangeCategory: 'Heavy Melee',
    damageMultiplier: 1.6,
    rangePx: 90,
    cooldownModifier: 1.45,
    knockback: 65,
    soundEffect: 'hammer',
    color: '#f59e0b', // amber
  },
}

export interface AbilitySpec {
  id: AbilityType
  name: string
  tagline: string
  description: string
  cooldownSeconds: number
  durationSeconds: number
  color: string
}

export const ABILITY_SPECS: Record<AbilityType, AbilitySpec> = {
  dash: {
    id: 'dash',
    name: 'Phase Dash',
    tagline: 'Instant burst of speed with i-frames',
    description: 'Bursts 3.5x movement speed in your direction for 0.22s, dodging all incoming damage. Essential for escaping boss telegraphs.',
    cooldownSeconds: 4.0,
    durationSeconds: 0.22,
    color: '#a855f7', // purple
  },
  shield: {
    id: 'shield',
    name: 'Kinetic Barrier',
    tagline: 'Reduces incoming damage by 75%',
    description: 'Deploys a glowing defensive bubble that absorbs 75% of incoming boss and hazard damage for 2.5 seconds.',
    cooldownSeconds: 6.0,
    durationSeconds: 2.5,
    color: '#38bdf8', // sky
  },
  heal: {
    id: 'heal',
    name: 'Nano Repair',
    tagline: 'Restores +35 HP instantly',
    description: 'Activates emergency nanites, healing 35 health (up to maximum health). High cooldown rewards careful timing.',
    cooldownSeconds: 8.0,
    durationSeconds: 0.5,
    color: '#10b981', // emerald
  },
}

export const TOTAL_HERO_POWER_BUDGET = 100

export const HERO_STAT_BOUNDS = {
  moveSpeed: { min: 120, max: 240, step: 10, default: 180, label: 'Move Speed', unit: 'px/s' },
  maxHealth: { min: 80, max: 220, step: 10, default: 120, label: 'Max Health', unit: 'HP' },
  attackDamage: { min: 12, max: 35, step: 1, default: 20, label: 'Attack Damage', unit: 'dmg' },
  attackCooldown: { min: 0.25, max: 0.8, step: 0.05, default: 0.45, label: 'Attack Cooldown', unit: 's' },
} as const
