import type {
  ArenaLayout,
  BaselinePlaytestCase,
  BalanceSettings,
  BossBehavior,
  BossConfig,
  HeroConfig,
  TeamGameProject,
} from '../types/project'
import { createFlawedStarterArenaLayout } from './arenaCatalog'

export function createInitialGameProject(): TeamGameProject {
  return {
    studioName: 'Slugs Game Studio',
    gameTitle: 'Cyber Colosseum',
    hero: {
      name: 'Vanguard',
      moveSpeed: 180,
      maxHealth: 120,
      attackDamage: 20,
      attackCooldown: 0.45,
      weapon: 'sword',
      ability: 'dash',
      // Flawed starter attack hitbox (defect: too short reach & narrow arc)
      attackReach: 32,
      attackArcDegrees: 35,
      hitboxValidated: false,
    },
    boss: {
      name: 'Goliath Prime',
      maxHealth: 260,
      attackDamage: 24,
      behavior: {
        detectionRange: 350,
        chaseSpeed: 120,
        attackRange: 80,
        attackWindup: 0.7,
        recoveryDuration: 0.1, // Defect: recovery is 0.1s in Relentless Loop!
        retreatThreshold: 25,
        attackType: 'heavy_cleave',
        stateAfterAttack: 'ATTACK', // Defect: loops directly to attack without recovery!
        activeBugId: 'relentless_loop',
        bugResolved: false,
      },
    },
    arena: createFlawedStarterArenaLayout(),
    balance: {
      targetDurationCategory: 'medium',
      targetPlayerHitsToWin: 12,
      targetBossHitsToDefeatHero: 5,
      notes: 'Studio Thesis: The duel should provide readable punishment windows after boss strikes.',
      baselineCase: {
        id: 'baseline-test-01',
        fightDurationSeconds: 14,
        playerHitsLanded: 2,
        bossHitsLanded: 6,
        playerHealthRemaining: 0,
        bossHealthRemaining: 85,
        issueReported: 'The boss attacks relentlessly without pause and the hero collapses in 14 seconds before being able to dodge.',
      },
      selectedHypothesis: '',
      testedParameter: '',
      reflection: '',
      investigationCompleted: false,
    },
    roleCompletion: {
      gameplay: false,
      programming: false,
      arena: false,
      balance: false,
    },
    playtestHistory: [],
    published: false,
    activeBugChallengeId: 'relentless_loop',
  }
}

/**
 * Robust normalizer for TeamGameProject.
 * Safely guards against missing or partial fields from older local storage versions,
 * incomplete network states, or concurrent editing updates.
 */
export function normalizeGameProject(raw?: unknown): TeamGameProject {
  const base = createInitialGameProject()
  if (!raw || typeof raw !== 'object') return base

  const r = raw as Partial<TeamGameProject>

  // 1. Hero
  const h = (r.hero ?? {}) as Partial<HeroConfig>
  const hero: HeroConfig = {
    name: typeof h.name === 'string' && h.name ? h.name : base.hero.name,
    moveSpeed: typeof h.moveSpeed === 'number' ? h.moveSpeed : base.hero.moveSpeed,
    maxHealth: typeof h.maxHealth === 'number' ? h.maxHealth : base.hero.maxHealth,
    attackDamage: typeof h.attackDamage === 'number' ? h.attackDamage : base.hero.attackDamage,
    attackCooldown: typeof h.attackCooldown === 'number' ? h.attackCooldown : base.hero.attackCooldown,
    weapon: h.weapon || base.hero.weapon,
    ability: h.ability || base.hero.ability,
    attackReach: typeof h.attackReach === 'number' ? h.attackReach : base.hero.attackReach,
    attackArcDegrees: typeof h.attackArcDegrees === 'number' ? h.attackArcDegrees : base.hero.attackArcDegrees,
    hitboxValidated: typeof h.hitboxValidated === 'boolean' ? h.hitboxValidated : false,
  }

  // 2. Boss
  const b = (r.boss ?? {}) as Partial<BossConfig>
  const bb = (b.behavior ?? {}) as Partial<BossBehavior>
  const boss: BossConfig = {
    name: typeof b.name === 'string' && b.name ? b.name : base.boss.name,
    maxHealth: typeof b.maxHealth === 'number' ? b.maxHealth : base.boss.maxHealth,
    attackDamage: typeof b.attackDamage === 'number' ? b.attackDamage : base.boss.attackDamage,
    behavior: {
      detectionRange: typeof bb.detectionRange === 'number' ? bb.detectionRange : base.boss.behavior.detectionRange,
      chaseSpeed: typeof bb.chaseSpeed === 'number' ? bb.chaseSpeed : base.boss.behavior.chaseSpeed,
      attackRange: typeof bb.attackRange === 'number' ? bb.attackRange : base.boss.behavior.attackRange,
      attackWindup: typeof bb.attackWindup === 'number' ? bb.attackWindup : base.boss.behavior.attackWindup,
      recoveryDuration: typeof bb.recoveryDuration === 'number' ? bb.recoveryDuration : base.boss.behavior.recoveryDuration,
      retreatThreshold: typeof bb.retreatThreshold === 'number' ? bb.retreatThreshold : base.boss.behavior.retreatThreshold,
      attackType: bb.attackType || base.boss.behavior.attackType,
      stateAfterAttack: bb.stateAfterAttack || base.boss.behavior.stateAfterAttack,
      activeBugId: bb.activeBugId !== undefined ? bb.activeBugId : base.boss.behavior.activeBugId,
      bugResolved: typeof bb.bugResolved === 'boolean' ? bb.bugResolved : false,
    },
  }

  // 3. Arena
  const a = (r.arena ?? {}) as Partial<ArenaLayout>
  const arena: ArenaLayout = {
    cols: typeof a.cols === 'number' ? a.cols : base.arena.cols,
    rows: typeof a.rows === 'number' ? a.rows : base.arena.rows,
    playerSpawn:
      a.playerSpawn && typeof a.playerSpawn.col === 'number' && typeof a.playerSpawn.row === 'number'
        ? a.playerSpawn
        : base.arena.playerSpawn,
    bossSpawn:
      a.bossSpawn && typeof a.bossSpawn.col === 'number' && typeof a.bossSpawn.row === 'number'
        ? a.bossSpawn
        : base.arena.bossSpawn,
    tiles: Array.isArray(a.tiles) && a.tiles.length === base.arena.rows ? a.tiles : base.arena.tiles,
    hasTestedWalk: typeof a.hasTestedWalk === 'boolean' ? a.hasTestedWalk : false,
  }

  // 4. Balance
  const bal = (r.balance ?? {}) as Partial<BalanceSettings>
  const baseCase = (bal.baselineCase ?? {}) as Partial<BaselinePlaytestCase>
  const fallbackCase = base.balance.baselineCase!
  const baselineCase: BaselinePlaytestCase = {
    id: baseCase.id || fallbackCase.id,
    fightDurationSeconds: typeof baseCase.fightDurationSeconds === 'number' ? baseCase.fightDurationSeconds : fallbackCase.fightDurationSeconds,
    playerHitsLanded: typeof baseCase.playerHitsLanded === 'number' ? baseCase.playerHitsLanded : fallbackCase.playerHitsLanded,
    bossHitsLanded: typeof baseCase.bossHitsLanded === 'number' ? baseCase.bossHitsLanded : fallbackCase.bossHitsLanded,
    playerHealthRemaining: typeof baseCase.playerHealthRemaining === 'number' ? baseCase.playerHealthRemaining : fallbackCase.playerHealthRemaining,
    bossHealthRemaining: typeof baseCase.bossHealthRemaining === 'number' ? baseCase.bossHealthRemaining : fallbackCase.bossHealthRemaining,
    issueReported: typeof baseCase.issueReported === 'string' && baseCase.issueReported ? baseCase.issueReported : fallbackCase.issueReported,
  }

  const balance: BalanceSettings = {
    targetDurationCategory: bal.targetDurationCategory || base.balance.targetDurationCategory,
    targetPlayerHitsToWin: typeof bal.targetPlayerHitsToWin === 'number' ? bal.targetPlayerHitsToWin : base.balance.targetPlayerHitsToWin,
    targetBossHitsToDefeatHero: typeof bal.targetBossHitsToDefeatHero === 'number' ? bal.targetBossHitsToDefeatHero : base.balance.targetBossHitsToDefeatHero,
    notes: typeof bal.notes === 'string' ? bal.notes : base.balance.notes,
    baselineCase,
    selectedHypothesis: typeof bal.selectedHypothesis === 'string' ? bal.selectedHypothesis : '',
    testedParameter: typeof bal.testedParameter === 'string' ? bal.testedParameter : '',
    reflection: typeof bal.reflection === 'string' ? bal.reflection : '',
    investigationCompleted: typeof bal.investigationCompleted === 'boolean' ? bal.investigationCompleted : false,
  }

  // 5. Meta
  const rc = (r.roleCompletion ?? {}) as Partial<TeamGameProject['roleCompletion']>
  const roleCompletion = {
    gameplay: Boolean(rc.gameplay),
    programming: Boolean(rc.programming),
    arena: Boolean(rc.arena),
    balance: Boolean(rc.balance),
  }

  return {
    studioName: typeof r.studioName === 'string' && r.studioName ? r.studioName : base.studioName,
    gameTitle: typeof r.gameTitle === 'string' && r.gameTitle ? r.gameTitle : base.gameTitle,
    hero,
    boss,
    arena,
    balance,
    roleCompletion,
    playtestHistory: Array.isArray(r.playtestHistory) ? r.playtestHistory : [],
    published: Boolean(r.published),
    activeBugChallengeId: r.activeBugChallengeId || base.activeBugChallengeId,
  }
}
