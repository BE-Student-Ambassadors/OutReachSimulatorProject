import type {
  ArenaLayout,
  BaselinePlaytestCase,
  BalanceSettings,
  BossBehavior,
  BossConfig,
  HeroConfig,
  QaSettings,
  TeamGameProject,
} from '../types/project'
import { createFlawedStarterArenaLayout } from './arenaCatalog'

export function createInitialQaSettings(): QaSettings {
  return {
    projectileWallRule: 'continue_moving', // Flawed starter: ignores walls
    diagnosedSystem: '',
    bugReproduced: false,
    bugFixed: false,
    verificationWallPassed: false,
    verificationOpenPassed: false,
    triageCompleted: false,
    experimentBudgetRemaining: 6,
    testedRuns: [],
    selectedRootCause: '',
    selectedPhysicsPatch: null,
    intermittentBugSolved: false,
  }
}

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
      // Flawed starter attack hitbox
      attackReach: 32,
      attackArcDegrees: 35,
      attackOffsetAngle: 0,
      hitboxValidated: false,
      // Role 1: Unwinnable Duel starting flaws
      heavyEndlag: 1.2, // severe 1.2s lag
      heavyPoiseStartup: false, // easily interrupted
      heavyDashCancelWindow: false,
      swiftRecoveryGap: 0.05, // instant spam
      duelMysterySolved: false,
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
        recoveryDuration: 0.8,
        retreatThreshold: 25,
        attackType: 'heavy_cleave',
        stateAfterAttack: 'ATTACK', // Defect: loops directly to attack without recovery!
        activeBugId: 'relentless_loop',
        bugResolved: false,
        logicSequence: ['ATTACK', 'CHASE', 'ATTACK', 'CHECK_RANGE'],
        distanceOperator: '>',
        // Role 2: Initial behavior graph with flawed edges
        graphEdges: [
          { id: 'e1', from: 'CHASE', to: 'TELEGRAPH_SLAM', condition: 'Target In Range <= 80', enabled: true },
          { id: 'e2', from: 'CHASE', to: 'TELEGRAPH_BEAM', condition: 'Target In Range <= 250', enabled: true }, // FLAW: ignores line-of-sight!
          { id: 'e3', from: 'TELEGRAPH_SLAM', to: 'ATTACK', condition: 'Target Angle <= 45', enabled: true }, // FLAW: no timer fallback if player rolls behind!
          { id: 'e4', from: 'TELEGRAPH_BEAM', to: 'ATTACK', condition: 'Timer Expired', enabled: true },
          { id: 'e5', from: 'ATTACK', to: 'RECOVER', condition: 'Always', enabled: true },
          { id: 'e6', from: 'RECOVER', to: 'CHASE', condition: 'Always', enabled: true }, // FLAW: always loops to chase, skipping sub-30% retreat!
          { id: 'e7', from: 'RECOVER', to: 'RETREAT_SHIELD', condition: 'Health < 30%', enabled: false }, // disabled initially!
        ],
        behaviorGraphValidated: false,
      },
    },
    arena: {
      ...createFlawedStarterArenaLayout(),
      hasSafeSpotCheese: false,
      chokepointCount: 0,
      spatialPuzzleSolved: false,
    },
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
    qa: createInitialQaSettings(),
    roleCompletion: {
      gameplay: false,
      programming: false,
      arena: false,
      balance: false,
    },
    playtestHistory: [],
    published: false,
    activeBugChallengeId: 'relentless_loop',
    activeViewMode: 'puzzles',
  }
}

/**
 * Robust normalizer for TeamGameProject.
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
    attackOffsetAngle: typeof h.attackOffsetAngle === 'number' ? h.attackOffsetAngle : base.hero.attackOffsetAngle ?? 0,
    hitboxValidated: typeof h.hitboxValidated === 'boolean' ? h.hitboxValidated : false,
    heavyEndlag: typeof h.heavyEndlag === 'number' ? h.heavyEndlag : base.hero.heavyEndlag ?? 1.2,
    heavyPoiseStartup: typeof h.heavyPoiseStartup === 'boolean' ? h.heavyPoiseStartup : base.hero.heavyPoiseStartup ?? false,
    heavyDashCancelWindow: typeof h.heavyDashCancelWindow === 'boolean' ? h.heavyDashCancelWindow : base.hero.heavyDashCancelWindow ?? false,
    swiftRecoveryGap: typeof h.swiftRecoveryGap === 'number' ? h.swiftRecoveryGap : base.hero.swiftRecoveryGap ?? 0.05,
    duelMysterySolved: typeof h.duelMysterySolved === 'boolean' ? h.duelMysterySolved : false,
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
      logicSequence: Array.isArray(bb.logicSequence) ? bb.logicSequence : base.boss.behavior.logicSequence,
      distanceOperator: bb.distanceOperator || base.boss.behavior.distanceOperator,
      graphEdges: Array.isArray(bb.graphEdges) ? bb.graphEdges : base.boss.behavior.graphEdges,
      behaviorGraphValidated: typeof bb.behaviorGraphValidated === 'boolean' ? bb.behaviorGraphValidated : false,
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
    wallEditsCount: typeof a.wallEditsCount === 'number' ? a.wallEditsCount : 0,
    hasSafeSpotCheese: typeof a.hasSafeSpotCheese === 'boolean' ? a.hasSafeSpotCheese : false,
    chokepointCount: typeof a.chokepointCount === 'number' ? a.chokepointCount : 0,
    spatialPuzzleSolved: typeof a.spatialPuzzleSolved === 'boolean' ? a.spatialPuzzleSolved : false,
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

  // 5. QA
  const q = (r.qa ?? {}) as Partial<QaSettings>
  const qa: QaSettings = {
    projectileWallRule: q.projectileWallRule || base.qa.projectileWallRule,
    diagnosedSystem: typeof q.diagnosedSystem === 'string' ? q.diagnosedSystem : '',
    bugReproduced: Boolean(q.bugReproduced),
    bugFixed: Boolean(q.bugFixed),
    verificationWallPassed: Boolean(q.verificationWallPassed),
    verificationOpenPassed: Boolean(q.verificationOpenPassed),
    triageCompleted: Boolean(q.triageCompleted),
    experimentBudgetRemaining: typeof q.experimentBudgetRemaining === 'number' ? q.experimentBudgetRemaining : 6,
    testedRuns: Array.isArray(q.testedRuns) ? q.testedRuns : [],
    selectedRootCause: typeof q.selectedRootCause === 'string' ? q.selectedRootCause : '',
    selectedPhysicsPatch: q.selectedPhysicsPatch || null,
    intermittentBugSolved: Boolean(q.intermittentBugSolved),
  }

  // 6. Meta
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
    qa,
    roleCompletion,
    playtestHistory: Array.isArray(r.playtestHistory) ? r.playtestHistory : [],
    published: Boolean(r.published),
    activeBugChallengeId: r.activeBugChallengeId || base.activeBugChallengeId,
    activeViewMode: r.activeViewMode || 'puzzles',
  }
}
