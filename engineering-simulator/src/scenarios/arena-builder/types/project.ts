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
  // Hitbox / Combat Tuning
  attackReach: number // px (35 - 110)
  attackArcDegrees: number // degrees (40 - 160)
  attackOffsetAngle?: number // degrees (-45 - +45)
  hitboxValidated: boolean
  // Role 1 — The Unwinnable Duel Tuning
  heavyEndlag?: number // seconds of recovery for heavy strikes (flawed: 1.2s; tuned: 0.35s - 0.55s)
  heavyPoiseStartup?: boolean // whether heavy attack grants poise during windup
  heavyDashCancelWindow?: boolean // whether heavy weapon can cancel recovery into dash
  swiftRecoveryGap?: number // seconds of recovery for swift attacks (flawed: 0.05s; tuned: 0.20s - 0.35s)
  duelMysterySolved?: boolean // role 1 completion flag
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
  | 'TELEGRAPH_SLAM'
  | 'TELEGRAPH_BEAM'
  | 'RETREAT_SHIELD'

export type BossAttackType = 'heavy_cleave' | 'slam_shockwave' | 'fireball_spray'

export type BossLogicOperator = '<=' | '>' | '=='

export interface BossGraphNode {
  id: BossStateId
  label: string
  description: string
  x: number
  y: number
}

export interface BossGraphEdge {
  id: string
  from: BossStateId
  to: BossStateId
  condition: string // e.g. 'Target In Range <= 150', 'Line of Sight == true', 'Timer Expired', 'Health < 30%', 'Always'
  enabled: boolean
}

export interface BossBehavior {
  detectionRange: number // px (150 - 450)
  chaseSpeed: number // px/s (60 - 180)
  attackRange: number // px (50 - 160)
  attackWindup: number // seconds (0.3 - 1.5)
  recoveryDuration: number // seconds (0.3 - 2.0)
  retreatThreshold: number // % HP (0 - 50)
  attackType: BossAttackType
  // State Machine Debugger & Puzzle Tuning
  stateAfterAttack: BossStateId // should transition to 'RECOVER'
  activeBugId: 'relentless_loop' | 'phantom_reach' | null
  bugResolved: boolean
  logicSequence?: string[] // Instruction block order
  distanceOperator?: BossLogicOperator
  // Role 2 — The Broken Boss Graph Debugger
  graphEdges?: BossGraphEdge[]
  behaviorGraphValidated?: boolean // role 2 completion flag
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
  wallEditsCount?: number
  // Role 3 — The Three-Wall Challenge Diagnostics
  hasSafeSpotCheese?: boolean
  chokepointCount?: number
  spatialPuzzleSolved?: boolean // role 3 completion flag
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
  baselineCase: BaselinePlaytestCase
  selectedHypothesis: string
  testedParameter: string
  reflection: string
  investigationCompleted: boolean
}

export type ProjectileWallRule = 'continue_moving' | 'stop_despawn' | 'ignore_collision'

export interface QaExperimentRun {
  id: string
  heroAction: 'normal' | 'dash' | 'shield' | 'heavy_attack'
  bossAction: 'ranged_orb' | 'ground_slam' | 'cleave' | 'idle'
  environment: 'open' | 'near_wall' | 'hazard'
  bugTriggered: boolean
  log: string
  damageDealt: number
}

export interface QaSettings {
  projectileWallRule: ProjectileWallRule
  diagnosedSystem: string
  bugReproduced: boolean
  bugFixed: boolean
  verificationWallPassed: boolean
  verificationOpenPassed: boolean
  triageCompleted?: boolean
  // Role 4 — The Intermittent Bug
  experimentBudgetRemaining?: number
  testedRuns?: QaExperimentRun[]
  selectedRootCause?: string
  selectedPhysicsPatch?: 'patch_wall_iframe' | 'patch_disable_wall' | 'patch_remove_shield' | null
  intermittentBugSolved?: boolean // role 4 completion flag
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
  qa: QaSettings
  roleCompletion: RoleCompletionStatus
  playtestHistory: PlaytestResult[]
  published: boolean
  activeBugChallengeId?: string | null
  activeViewMode?: 'puzzles' | 'creative'
}

export type ArenaBuilderRole = 'gameplay' | 'programming' | 'arena' | 'balance'
export type ActiveTab = 'studio' | ArenaBuilderRole | 'playtest' | 'publish' | 'creative'
