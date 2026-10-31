/**
 * Type definitions for the Arena Game Builder collaborative scenario.
 */

export type WeaponType = 'sword' | 'blaster' | 'hammer'
export type AbilityType = 'dash' | 'shield' | 'heal'

export interface HeroConfig {
  name: string
  moveSpeed: number // px/s (120 - 240)
  maxHealth: number // 80 - 220
  attackDamage: number // 12 - 35
  attackCooldown: number // seconds (0.25 - 0.8)
  weapon: WeaponType
  ability: AbilityType
  // Combat Mechanics Lab Hitbox Tuning
  attackReach: number // px (35 - 110)
  attackArcDegrees: number // degrees (40 - 160)
  hitboxValidated: boolean
}

export type BossStateId =
  | 'IDLE'
  | 'DETECT'
  | 'CHASE'
  | 'WINDUP'
  | 'ATTACK'
  | 'RECOVER'
  | 'RETREAT'
  | 'REPOSITION'

export type BossAttackType = 'heavy_cleave' | 'slam_shockwave' | 'fireball_spray'

export interface BossBehavior {
  detectionRange: number // px (150 - 450)
  chaseSpeed: number // px/s (60 - 180)
  attackRange: number // px (50 - 160)
  attackWindup: number // seconds (0.3 - 1.5)
  recoveryDuration: number // seconds (0.3 - 2.0)
  retreatThreshold: number // % HP (0 - 50)
  attackType: BossAttackType
  // State Machine Debugger Tuning
  stateAfterAttack: BossStateId // should transition to 'RECOVER'
  activeBugId: 'relentless_loop' | 'phantom_reach' | null
  bugResolved: boolean
}

export interface BossConfig {
  name: string
  maxHealth: number
  attackDamage: number
  behavior: BossBehavior
}

export type TileType = 'empty' | 'wall' | 'cover' | 'hazard'

export interface ArenaLayout {
  cols: number
  rows: number
  tiles: TileType[][] // [row][col]
  playerSpawn: { col: number; row: number }
  bossSpawn: { col: number; row: number }
  hasTestedWalk?: boolean
}

export interface BaselinePlaytestCase {
  id: string
  fightDurationSeconds: number
  playerHitsLanded: number
  bossHitsLanded: number
  playerHealthRemaining: number
  bossHealthRemaining: number
  issueReported: string
}

export interface BalanceSettings {
  targetDurationCategory: 'short' | 'medium' | 'epic' // 20-30s | 30-50s | 50-80s
  targetPlayerHitsToWin: number
  targetBossHitsToDefeatHero: number
  notes: string
  // Balance Investigation Workflow
  baselineCase: BaselinePlaytestCase
  selectedHypothesis: string
  testedParameter: string
  reflection: string
  investigationCompleted: boolean
}

export interface PlaytestResult {
  id: string
  attemptNumber: number
  timestamp: number
  winner: 'player' | 'boss'
  durationSeconds: number
  heroDamageDealt: number
  bossDamageDealt: number
  hitsLanded: number
  hitsReceived: number
  attacksDodged: number
  heroRemainingHpPct: number
  bossRemainingHpPct: number
  heroWeapon: WeaponType
  heroAbility: AbilityType
}

export interface RoleCompletionStatus {
  gameplay: boolean
  programming: boolean
  arena: boolean
  balance: boolean
}

export interface TeamGameProject {
  studioName: string
  gameTitle: string
  hero: HeroConfig
  boss: BossConfig
  arena: ArenaLayout
  balance: BalanceSettings
  roleCompletion: RoleCompletionStatus
  playtestHistory: PlaytestResult[]
  published: boolean
  activeBugChallengeId?: string | null
}

export type ArenaBuilderRole = 'gameplay' | 'programming' | 'arena' | 'balance'
export type ActiveTab = 'studio' | ArenaBuilderRole | 'playtest' | 'publish'
