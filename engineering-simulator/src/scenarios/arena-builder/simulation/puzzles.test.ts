import { describe, expect, it } from 'vitest'
import {
  createEmptyArenaLayout,
  createFlawedStarterArenaLayout,
} from '../data/arenaCatalog'
import { createInitialGameProject, normalizeGameProject } from '../data/initialProject'
import {
  DUEL_OPPONENTS,
  simulateDuelMatch,
  validateDuelMystery,
} from './duelPuzzle'
import {
  BOSS_GRAPH_SCENARIOS,
  simulateBossGraphScenario,
  validateBossGraph,
} from './bossGraphPuzzle'
import {
  findArenaPath,
  validateArenaPuzzle,
} from './arenaPuzzle'
import {
  runQaExperiment,
  runQaRegressionSuite,
  validateQaInvestigation,
} from './qaInvestigationPuzzle'

describe('Role 1 — Gameplay Designer: The Unwinnable Duel', () => {
  it('flawed starting parameters cause Heavy Colossus to fail against Agile Scout', () => {
    const res = simulateDuelMatch('heavy', DUEL_OPPONENTS.scout, {
      heavyEndlag: 1.2,
      heavyPoiseStartup: false,
      heavyDashCancelWindow: false,
      swiftRecoveryGap: 0.05,
    })

    // Heavy loses due to endless stagger and punish hits during 1.2s endlag
    expect(res.staggeredCount).toBeGreaterThan(0)
    expect(res.winner).toBe('opponent')
  })

  it('rejects instant stun-lock when Swift Striker has near-zero recovery gap', () => {
    const project = createInitialGameProject()
    // Flawed state with swiftRecoveryGap = 0.05
    const val = validateDuelMystery(project.hero)
    expect(val.solved).toBe(false)
    expect(val.swiftVsSentinelPassed).toBe(false)
  })

  it('successfully validates combat parity when endlag, poise, and recovery are tuned', () => {
    const project = createInitialGameProject()
    project.hero.heavyEndlag = 0.45
    project.hero.heavyPoiseStartup = true
    project.hero.heavyDashCancelWindow = true
    project.hero.swiftRecoveryGap = 0.25

    const val = validateDuelMystery(project.hero)
    expect(val.solved).toBe(true)
    expect(val.heavyVsScoutPassed).toBe(true)
    expect(val.swiftVsSentinelPassed).toBe(true)
    expect(val.mirrorMatchBalanced).toBe(true)
    expect(val.timeToKillSensible).toBe(true)
  })
})

describe('Role 2 — Gameplay Programmer: The Broken Boss', () => {
  const flawedEdges = [
    { id: 'e1', from: 'CHASE' as const, to: 'TELEGRAPH_SLAM' as const, condition: 'Target In Range <= 80', enabled: true },
    { id: 'e2', from: 'CHASE' as const, to: 'TELEGRAPH_BEAM' as const, condition: 'Target In Range <= 250', enabled: true },
    { id: 'e3', from: 'TELEGRAPH_SLAM' as const, to: 'ATTACK' as const, condition: 'Target Angle <= 45', enabled: true },
    { id: 'e4', from: 'TELEGRAPH_BEAM' as const, to: 'ATTACK' as const, condition: 'Timer Expired', enabled: true },
    { id: 'e5', from: 'ATTACK' as const, to: 'RECOVER' as const, condition: 'Always', enabled: true },
    { id: 'e6', from: 'RECOVER' as const, to: 'CHASE' as const, condition: 'Always', enabled: true },
    { id: 'e7', from: 'RECOVER' as const, to: 'RETREAT_SHIELD' as const, condition: 'Health < 30%', enabled: false },
  ]

  it('flawed starter graph passes Scenario 1 but fails Scenario 2 (dodge-behind)', () => {
    const s1 = simulateBossGraphScenario(BOSS_GRAPH_SCENARIOS[0], flawedEdges)
    expect(s1.success).toBe(true)

    const s2 = simulateBossGraphScenario(BOSS_GRAPH_SCENARIOS[1], flawedEdges)
    expect(s2.success).toBe(false)
    expect(s2.failureReason).toContain('stalled')
  })

  it('flawed starter graph fails Scenario 3 (shooting through pillar) and Scenario 4 (sub-30% shield)', () => {
    const s3 = simulateBossGraphScenario(BOSS_GRAPH_SCENARIOS[2], flawedEdges)
    expect(s3.success).toBe(false)

    const s4 = simulateBossGraphScenario(BOSS_GRAPH_SCENARIOS[3], flawedEdges)
    expect(s4.success).toBe(false)
  })

  it('repaired graph passes all 4 visible scenarios AND the unseen regression scenario', () => {
    const repairedEdges = [
      { id: 'e1', from: 'CHASE' as const, to: 'TELEGRAPH_SLAM' as const, condition: 'Target In Range <= 80', enabled: true },
      { id: 'e2', from: 'CHASE' as const, to: 'TELEGRAPH_BEAM' as const, condition: 'Target In Range <= 250 AND LineOfSight == true', enabled: true },
      { id: 'e3', from: 'TELEGRAPH_SLAM' as const, to: 'ATTACK' as const, condition: 'Timer Expired', enabled: true },
      { id: 'e4', from: 'TELEGRAPH_BEAM' as const, to: 'ATTACK' as const, condition: 'Timer Expired', enabled: true },
      { id: 'e5', from: 'ATTACK' as const, to: 'RECOVER' as const, condition: 'Always', enabled: true },
      { id: 'e7', from: 'RECOVER' as const, to: 'RETREAT_SHIELD' as const, condition: 'Health < 30%', enabled: true },
      { id: 'e6', from: 'RECOVER' as const, to: 'CHASE' as const, condition: 'Always', enabled: true },
    ]

    const val = validateBossGraph(repairedEdges)
    expect(val.solved).toBe(true)
    expect(val.visibleScenariosPassed).toBe(true)
    expect(val.regressionPassed).toBe(true)
  })
})

describe('Role 3 — Level Designer: The Three-Wall Challenge', () => {
  it('identifies that the starter flawed layout is completely impassable', () => {
    const flawed = createFlawedStarterArenaLayout()
    const path = findArenaPath(flawed)
    expect(path).toBeNull()

    const val = validateArenaPuzzle(flawed, flawed)
    expect(val.isReachable).toBe(false)
    expect(val.solved).toBe(false)
  })

  it('detects chokepoint and cheese safe-spot when naively breaking only the center tile', () => {
    const original = createFlawedStarterArenaLayout()
    const modified = createFlawedStarterArenaLayout()
    // Naively break only row 6 col 8
    modified.tiles[6][8] = 'empty'

    const val = validateArenaPuzzle(modified, original)
    expect(val.isReachable).toBe(true)
    // Chokepoint or cheese spot detected
    expect(val.solved).toBe(false)
  })

  it('solves the puzzle when opening a 2-wide route and sealing the cheese pocket within 3 edits', () => {
    const original = createFlawedStarterArenaLayout()
    const modified = createFlawedStarterArenaLayout()

    // 1. Remove wall at (8, 3) (upper flank)
    modified.tiles[3][8] = 'empty'
    // 2. Remove wall at (8, 4) (creating 2-wide passage)
    modified.tiles[4][8] = 'empty'
    // 3. Seal the cheese alcove at (12, 2)
    modified.tiles[2][12] = 'wall'

    const val = validateArenaPuzzle(modified, original)
    expect(val.isReachable).toBe(true)
    expect(val.wallEditsCount).toBe(3)
    expect(val.budgetExceeded).toBe(false)
    expect(val.dodgeClearancePassed).toBe(true)
    expect(val.noCheeseSafeSpotPassed).toBe(true)
    expect(val.solved).toBe(true)
  })

  it('rejects layout if wall edits exceed the budget of 3', () => {
    const original = createFlawedStarterArenaLayout()
    const emptyLayout = createEmptyArenaLayout()

    const val = validateArenaPuzzle(emptyLayout, original)
    expect(val.budgetExceeded).toBe(true)
    expect(val.solved).toBe(false)
  })
})

describe('Role 4 — QA Tester: The Intermittent Bug', () => {
  it('triggers the glitch strictly under Shield + Ground Slam + Near Wall', () => {
    const bugRun = runQaExperiment({
      heroAction: 'shield',
      bossAction: 'ground_slam',
      environment: 'near_wall',
    })
    expect(bugRun.bugTriggered).toBe(true)
    expect(bugRun.damageDealt).toBe(112)

    // Other combinations do not trigger the bug
    const openRun = runQaExperiment({
      heroAction: 'shield',
      bossAction: 'ground_slam',
      environment: 'open',
    })
    expect(openRun.bugTriggered).toBe(false)

    const dashRun = runQaExperiment({
      heroAction: 'dash',
      bossAction: 'ground_slam',
      environment: 'near_wall',
    })
    expect(dashRun.bugTriggered).toBe(false)
  })

  it('rejects crude patch that disables wall collisions entirely', () => {
    const reg = runQaRegressionSuite('patch_disable_wall')
    expect(reg.allPassed).toBe(false)
    expect(reg.tests.find((t) => t.id === 'reg_wall_collision')?.passed).toBe(false)
  })

  it('rejects crude patch that removes shield ability', () => {
    const reg = runQaRegressionSuite('patch_remove_shield')
    expect(reg.allPassed).toBe(false)
    expect(reg.tests.find((t) => t.id === 'reg_shield_feature')?.passed).toBe(false)
  })

  it('surgical wall-bounce immunity patch passes all 5 regression tests', () => {
    const reg = runQaRegressionSuite('patch_wall_iframe')
    expect(reg.allPassed).toBe(true)
    expect(reg.tests.every((t) => t.passed)).toBe(true)
  })

  it('full investigation validation requires bug reproduction, correct hypothesis, and valid patch', () => {
    const project = createInitialGameProject()
    // Initially not solved
    expect(validateQaInvestigation(project.qa).solved).toBe(false)

    // Log a run that reproduces the bug
    const bugRun = runQaExperiment({
      heroAction: 'shield',
      bossAction: 'ground_slam',
      environment: 'near_wall',
    })
    project.qa.testedRuns = [bugRun]
    project.qa.selectedRootCause = 'shield_slam_wall'
    project.qa.selectedPhysicsPatch = 'patch_wall_iframe'

    const val = validateQaInvestigation(project.qa)
    expect(val.solved).toBe(true)
  })
})

describe('Team Game Project Integration', () => {
  it('normalizes project state cleanly preserving all 4 puzzle repairs', () => {
    const project = createInitialGameProject()
    project.hero.duelMysterySolved = true
    project.boss.behavior.behaviorGraphValidated = true
    project.arena.spatialPuzzleSolved = true
    project.qa.intermittentBugSolved = true

    const normalized = normalizeGameProject(project)
    expect(normalized.hero.duelMysterySolved).toBe(true)
    expect(normalized.boss.behavior.behaviorGraphValidated).toBe(true)
    expect(normalized.arena.spatialPuzzleSolved).toBe(true)
    expect(normalized.qa.intermittentBugSolved).toBe(true)
  })
})
