import { describe, expect, it } from 'vitest'
import {
  ARENA_COLS,
  ARENA_ROWS,
  createEmptyArenaLayout,
  createStarterArenaLayout,
} from '../data/arenaCatalog'
import { DEBUG_CHALLENGES } from '../data/bossCatalog'
import { ABILITY_SPECS, TOTAL_HERO_POWER_BUDGET, WEAPON_SPECS } from '../data/heroCatalog'
import { createInitialGameProject, normalizeGameProject } from '../data/initialProject'
import {
  projectFromDesign,
  withPart,
  withProject,
} from '../teamSync'
import type { ArenaLayout, HeroConfig } from '../types/project'
import { validateArenaLayout } from './arenaValidation'
import {
  computeBalanceTelemetry,
  generatePlaytestObservations,
} from './balanceMath'
import {
  runBossAiSimulation,
  updateBossFsm,
  validateBossConfig,
} from './bossFsm'
import { CombatSimulation } from './combatEngine'
import { calculateHeroPower, isHeroConfigValid } from './powerBudget'

describe('Role 1: Gameplay Designer & Power Budget', () => {
  it('calculates balanced power budget for default hero config', () => {
    const project = createInitialGameProject()
    const budget = calculateHeroPower(project.hero)

    expect(budget.totalPowerUsed).toBeLessThanOrEqual(TOTAL_HERO_POWER_BUDGET)
    expect(budget.isOverBudget).toBe(false)
    expect(budget.remainingPower).toBeGreaterThanOrEqual(0)

    const validResult = isHeroConfigValid(project.hero)
    expect(validResult.valid).toBe(true)
  })

  it('rejects hero configs that exceed the 100 pt power budget', () => {
    const maxedHero: HeroConfig = {
      name: 'Overpowered Tank',
      moveSpeed: 240, // max speed
      maxHealth: 220, // max health
      attackDamage: 35, // max damage
      attackCooldown: 0.25, // fastest attack
      weapon: 'hammer', // highest weapon cost
      ability: 'heal', // highest ability cost
      attackReach: 80,
      attackArcDegrees: 110,
      hitboxValidated: true,
    }

    const budget = calculateHeroPower(maxedHero)
    expect(budget.totalPowerUsed).toBeGreaterThan(TOTAL_HERO_POWER_BUDGET)
    expect(budget.isOverBudget).toBe(true)

    const validResult = isHeroConfigValid(maxedHero)
    expect(validResult.valid).toBe(false)
    expect(validResult.reason).toContain('Power budget exceeded')
  })

  it('verifies distinct behaviors and multipliers across all three weapons', () => {
    const sword = WEAPON_SPECS.sword
    const blaster = WEAPON_SPECS.blaster
    const hammer = WEAPON_SPECS.hammer

    // Damage differences
    expect(hammer.damageMultiplier).toBeGreaterThan(sword.damageMultiplier)
    expect(sword.damageMultiplier).toBeGreaterThan(blaster.damageMultiplier)

    // Range differences
    expect(blaster.rangePx).toBeGreaterThan(hammer.rangePx)
    expect(hammer.rangePx).toBeGreaterThan(sword.rangePx)

    // Knockback differences
    expect(hammer.knockback).toBeGreaterThan(sword.knockback)
    expect(sword.knockback).toBeGreaterThan(blaster.knockback)

    // Cooldown differences (hammer is slower, sword is faster)
    expect(hammer.cooldownModifier).toBeGreaterThan(blaster.cooldownModifier)
    expect(blaster.cooldownModifier).toBeGreaterThan(sword.cooldownModifier)
  })

  it('verifies distinct tactical properties across all three special abilities', () => {
    const dash = ABILITY_SPECS.dash
    const shield = ABILITY_SPECS.shield
    const heal = ABILITY_SPECS.heal

    expect(dash.durationSeconds).toBeLessThan(shield.durationSeconds)
    expect(dash.cooldownSeconds).toBeLessThan(shield.cooldownSeconds)
    expect(shield.cooldownSeconds).toBeLessThan(heal.cooldownSeconds)
  })

  it('detects starter attack hitbox defect (too short reach to hit dummy at 75px) and validates fix', () => {
    const project = createInitialGameProject()
    // Starter reach is 32px, arc is 35deg - deliberately defective
    expect(project.hero.attackReach).toBe(32)
    expect(project.hero.attackArcDegrees).toBe(35)
    expect(project.hero.hitboxValidated).toBe(false)

    // Dummy located at 75px away: dist (75) > reach (32 + dummyRadius ~18) -> fails to hit
    const dummyDist = 75
    const canHitStarter = dummyDist <= (project.hero.attackReach! + 18)
    expect(canHitStarter).toBe(false)

    // Repaired hitbox: reach expanded to 80px, arc to 90deg
    const repairedHero: HeroConfig = {
      ...project.hero,
      attackReach: 80,
      attackArcDegrees: 90,
      hitboxValidated: true,
    }
    const canHitRepaired = dummyDist <= (repairedHero.attackReach! + 18)
    expect(canHitRepaired).toBe(true)
    expect(repairedHero.hitboxValidated).toBe(true)
  })
})

describe('Role 2: Programmer & Boss AI FSM', () => {
  it('progresses boss through the complete state cycle when transition is RECOVER: IDLE -> DETECT -> CHASE -> WINDUP -> ATTACK -> RECOVER', () => {
    const project = createInitialGameProject()
    const behavior = {
      ...project.boss.behavior,
      stateAfterAttack: 'RECOVER' as const,
      recoveryDuration: 0.8,
    }

    // 1. Far away: IDLE
    const idleRes = updateBossFsm('IDLE', 0, 0.05, behavior, 500, 100)
    expect(idleRes.nextState).toBe('IDLE')

    // 2. Enters detection range: triggers DETECT
    const detectRes = updateBossFsm('IDLE', 0, 0.05, behavior, behavior.detectionRange - 50, 100)
    expect(detectRes.nextState).toBe('DETECT')

    // 3. Detect alert window finishes: transitions to CHASE
    const chaseRes = updateBossFsm('DETECT', 0.25, 0.05, behavior, 250, 100)
    expect(chaseRes.nextState).toBe('CHASE')
    expect(chaseRes.canMove).toBe(true)

    // 4. Closes within attack range: triggers WINDUP with telegraph
    const windupRes = updateBossFsm('CHASE', 0, 0.05, behavior, behavior.attackRange - 10, 100)
    expect(windupRes.nextState).toBe('WINDUP')
    expect(windupRes.telegraphActive).toBe(true)

    // 5. Windup completes: fires ATTACK
    const attackRes = updateBossFsm('WINDUP', behavior.attackWindup, 0.05, behavior, behavior.attackRange - 10, 100)
    expect(attackRes.nextState).toBe('ATTACK')
    expect(attackRes.shouldFireAttack).toBe(true)

    // 6. Attack completes: enters vulnerable RECOVER state
    const recoverRes = updateBossFsm('ATTACK', 0.16, 0.05, behavior, behavior.attackRange - 10, 100)
    expect(recoverRes.nextState).toBe('RECOVER')
    expect(recoverRes.isVulnerable).toBe(true)

    // 7. Recovery window ends: resumes CHASE
    const resumeRes = updateBossFsm('RECOVER', behavior.recoveryDuration, 0.05, behavior, behavior.attackRange + 50, 100)
    expect(resumeRes.nextState).toBe('CHASE')
  })

  it('detects starter Relentless Loop defect where boss bypasses RECOVER and loops attacks', () => {
    const project = createInitialGameProject()
    expect(project.boss.behavior.stateAfterAttack).toBe('ATTACK')

    const simReport = runBossAiSimulation(project.boss.behavior)
    expect(simReport.passed).toBe(false)
    expect(simReport.summary).toContain('RECOVER')
  })

  it('runs headless AI simulation to verify state cycling and deadlock prevention once RECOVER transition is restored', () => {
    const project = createInitialGameProject()
    const fixedBehavior = {
      ...project.boss.behavior,
      stateAfterAttack: 'RECOVER' as const,
      recoveryDuration: 0.8,
    }
    const simReport = runBossAiSimulation(fixedBehavior)

    expect(simReport.passed).toBe(true)
    expect(simReport.stuck).toBe(false)
    expect(simReport.cyclesCompleted).toBeGreaterThan(0)
    expect(simReport.statesVisited.has('CHASE')).toBe(true)
    expect(simReport.statesVisited.has('WINDUP')).toBe(true)
    expect(simReport.statesVisited.has('ATTACK')).toBe(true)
    expect(simReport.statesVisited.has('RECOVER')).toBe(true)
  })

  it('detects invalid boss configurations', () => {
    const project = createInitialGameProject()
    const invalidBoss = {
      ...project.boss,
      behavior: {
        ...project.boss.behavior,
        recoveryDuration: 0.1, // too short
        attackRange: 400, // exceeds detection range
        detectionRange: 200,
      },
    }

    const report = validateBossConfig(invalidBoss)
    expect(report.valid).toBe(false)
    expect(report.issues.some((i) => i.includes('Recovery duration'))).toBe(true)
    expect(report.issues.some((i) => i.includes('Attack range'))).toBe(true)
  })

  it('validates debugging challenges and resolution criteria', () => {
    const recoveryBug = DEBUG_CHALLENGES.find((c) => c.id === 'zero_recovery')!
    expect(recoveryBug.isResolved(recoveryBug.buggyConfig)).toBe(false)
    expect(recoveryBug.isResolved({ ...recoveryBug.buggyConfig, recoveryDuration: 0.8 })).toBe(true)

    const reachBug = DEBUG_CHALLENGES.find((c) => c.id === 'phantom_reach')!
    expect(reachBug.isResolved(reachBug.buggyConfig)).toBe(false)
    expect(reachBug.isResolved({ ...reachBug.buggyConfig, attackRange: 80, detectionRange: 350 })).toBe(true)
  })
})

describe('Role 3: Arena Designer & Grid Pathfinding', () => {
  it('validates starter arena layout as fully reachable and valid', () => {
    const layout = createStarterArenaLayout()
    const validation = validateArenaLayout(layout)

    expect(validation.valid).toBe(true)
    expect(validation.hasPlayerSpawn).toBe(true)
    expect(validation.hasBossSpawn).toBe(true)
    expect(validation.playerSpawnValid).toBe(true)
    expect(validation.bossSpawnValid).toBe(true)
    expect(validation.isReachable).toBe(true)
    expect(validation.pathDistance).toBeGreaterThan(0)
    expect(validation.isHazardExcessive).toBe(false)
  })

  it('detects completely blocked arenas using BFS reachability', () => {
    const layout = createStarterArenaLayout()
    // Create an impassable wall barrier completely dividing the arena horizontally
    for (let c = 1; c < ARENA_COLS - 1; c++) {
      layout.tiles[6][c] = 'wall'
    }
    layout.playerSpawn = { col: 2, row: 2 }
    layout.bossSpawn = { col: 13, row: 10 }

    const validation = validateArenaLayout(layout)
    expect(validation.isReachable).toBe(false)
    expect(validation.valid).toBe(false)
    expect(validation.issues.some((i) => i.includes('unreachable'))).toBe(true)
  })

  it('detects spawns placed inside impassable obstacles', () => {
    const layout = createStarterArenaLayout()
    layout.playerSpawn = { col: 0, row: 0 } // border wall

    const validation = validateArenaLayout(layout)
    expect(validation.playerSpawnValid).toBe(false)
    expect(validation.valid).toBe(false)
    expect(validation.issues.some((i) => i.includes('trapped inside'))).toBe(true)
  })

  it('detects excessive hazard coverage (> 35% of non-wall area)', () => {
    const layout = createEmptyArenaLayout()
    // Fill interior with hazards
    for (let r = 1; r < ARENA_ROWS - 1; r++) {
      for (let c = 1; c < ARENA_COLS - 1; c++) {
        layout.tiles[r][c] = 'hazard'
      }
    }

    const validation = validateArenaLayout(layout)
    expect(validation.isHazardExcessive).toBe(true)
    expect(validation.valid).toBe(false)
  })

  it('detects starter arena defects (unreachable boss path) and validates fix when path is cleared', () => {
    const project = createInitialGameProject()
    // The initial arena layout has deliberate defects (unreachable boss path)
    const initialValidation = validateArenaLayout(project.arena)
    expect(initialValidation.valid).toBe(false)
    expect(initialValidation.isReachable).toBe(false)

    // Clear the blocking wall in column 8 at row 5
    project.arena.tiles[5][8] = 'empty'

    const repairedValidation = validateArenaLayout(project.arena)
    expect(repairedValidation.isReachable).toBe(true)
    expect(repairedValidation.pathDistance).toBeGreaterThan(0)
    expect(repairedValidation.valid).toBe(true)
  })
})

describe('Role 4: Producer Balance & Playtest Telemetry', () => {
  it('loads starter baseline playtest report reflecting unfair starter balance', () => {
    const project = createInitialGameProject()
    expect(project.balance.baselineCase).toBeDefined()
    expect(project.balance.baselineCase?.playerHealthRemaining).toBe(0)
    expect(project.balance.baselineCase?.fightDurationSeconds).toBe(14)
    expect(project.balance.investigationCompleted).toBe(false)
  })

  it('validates hypothesis selection and balance investigation completion', () => {
    const project = createInitialGameProject()
    const investigatedBalance = {
      ...project.balance,
      selectedHypothesis: 'Boss recovery window is too short for hero to punish attacks safely',
      testedParameter: 'recoveryDuration',
      reflection: 'Increasing boss recovery window from 0.1s to 0.8s gave the hero enough time to counter-attack without suffering guaranteed damage.',
      investigationCompleted: true,
    }

    expect(investigatedBalance.investigationCompleted).toBe(true)
    expect(investigatedBalance.reflection.length).toBeGreaterThan(20)
    expect(investigatedBalance.testedParameter).toBe('recoveryDuration')
  })
  it('computes mathematical balance telemetry based on actual configs', () => {
    const project = createInitialGameProject()
    const telemetry = computeBalanceTelemetry(project.hero, project.boss)

    expect(telemetry.hitsToDefeatBoss).toBeGreaterThan(5)
    expect(telemetry.hitsToDefeatHero).toBeGreaterThan(2)
    expect(telemetry.effectiveHeroDamage).toBeGreaterThan(0)
    expect(telemetry.expectedDurationEstimate).toContain('s')
  })

  it('generates fact-only post-test observations without giving prescriptive advice', () => {
    const project = createInitialGameProject()
    const mockResult = {
      id: 'test-run-1',
      attemptNumber: 1,
      timestamp: Date.now(),
      winner: 'player' as const,
      durationSeconds: 38.4,
      heroDamageDealt: 260,
      bossDamageDealt: 72,
      hitsLanded: 13,
      hitsReceived: 3,
      attacksDodged: 4,
      heroRemainingHpPct: 40,
      bossRemainingHpPct: 0,
      heroWeapon: project.hero.weapon,
      heroAbility: project.hero.ability,
    }

    const observations = generatePlaytestObservations(mockResult, project.hero, project.boss)

    expect(observations.length).toBeGreaterThan(2)
    // Must contain factual metrics
    expect(observations.some((o) => o.includes('38.4 seconds'))).toBe(true)
    expect(observations.some((o) => o.includes('13 hit(s) dealing 260 damage'))).toBe(true)
    expect(observations.some((o) => o.includes('4 telegraphed boss attack zone(s)'))).toBe(true)
    // Never prescriptive advice (no "you should add" or "change your weapon")
    observations.forEach((obs) => {
      expect(obs.toLowerCase()).not.toContain('you should')
      expect(obs.toLowerCase()).not.toContain('need to change')
    })
  })
})

describe('Combat Simulation Engine', () => {
  it('simulates 2D combat movement and collision with walls', () => {
    const project = createInitialGameProject()
    const sim = new CombatSimulation(project.hero, project.boss, project.arena)

    const initialX = sim.heroX
    // Move left towards perimeter wall
    for (let i = 0; i < 60; i++) {
      sim.update(0.016, {
        up: false,
        down: false,
        left: true,
        right: false,
        attack: false,
        ability: false,
      })
    }

    // Hero moved left, but remains inside arena bounds and does not penetrate wall (tile 0)
    expect(sim.heroX).toBeLessThan(initialX)
    expect(sim.heroX).toBeGreaterThanOrEqual(48) // tile 1 start
  })

  it('executes player sword attack and damages boss when in range', () => {
    const project = createInitialGameProject()
    const sim = new CombatSimulation(project.hero, project.boss, project.arena)

    // Place hero right next to boss, facing boss
    sim.heroX = 300
    sim.heroY = 300
    sim.bossX = 340
    sim.bossY = 300
    sim.heroFacingAngle = 0 // facing right towards boss

    const initialBossHp = sim.bossHp
    sim.update(0.016, {
      up: false,
      down: false,
      left: false,
      right: false,
      attack: true,
      ability: false,
    })

    expect(sim.bossHp).toBeLessThan(initialBossHp)
    expect(sim.hitsLanded).toBe(1)
    expect(sim.heroDamageDealt).toBeGreaterThan(0)
  })

  it('applies shield damage reduction when kinetic barrier is active', () => {
    const project = createInitialGameProject()
    project.hero.ability = 'shield'
    const sim = new CombatSimulation(project.hero, project.boss, project.arena)

    // Activate shield
    sim.update(0.016, {
      up: false,
      down: false,
      left: false,
      right: false,
      attack: false,
      ability: true,
    })
    expect(sim.heroShieldActive).toBe(true)

    // Place boss directly on hero and execute boss attack
    sim.bossX = sim.heroX + 10
    sim.bossY = sim.heroY
    sim.bossFacingAngle = Math.PI // facing left at hero

    // Trigger boss cleave directly
    const initialHeroHp = sim.heroHp
    // update boss attack
    sim.bossFsmState = 'WINDUP'
    sim.bossFsmTimer = project.boss.behavior.attackWindup + 0.1
    sim.update(0.016, {
      up: false,
      down: false,
      left: false,
      right: false,
      attack: false,
      ability: false,
    })

    const damageTaken = initialHeroHp - sim.heroHp
    // Standard boss attack is 24 damage. With shield (75% reduction), damage is ~6.
    expect(damageTaken).toBeLessThan(12)
    expect(damageTaken).toBeGreaterThan(0)
  })

  it('triggers victory condition when boss health reaches 0', () => {
    const project = createInitialGameProject()
    const sim = new CombatSimulation(project.hero, project.boss, project.arena)

    sim.damageBoss(sim.bossHp, 'TEST FINISHER')
    sim.update(0.016, {
      up: false,
      down: false,
      left: false,
      right: false,
      attack: false,
      ability: false,
    })

    expect(sim.isGameOver).toBe(true)
    expect(sim.winner).toBe('player')

    const result = sim.generateResult(1)
    expect(result.winner).toBe('player')
    expect(result.bossRemainingHpPct).toBe(0)
  })
})

describe('Scenario & Shared Project Synchronization', () => {
  it('serializes and deserializes TeamGameProject through scenario design objects', () => {
    const initial = createInitialGameProject()
    initial.studioName = 'Custom Slug Studios'
    initial.gameTitle = 'Cyber Colosseum Deluxe'
    initial.hero.name = 'Titanium'

    const designObjects = withProject([], initial)
    expect(designObjects.length).toBeGreaterThan(0)

    const reconstructed = projectFromDesign(designObjects)
    expect(reconstructed.studioName).toBe('Custom Slug Studios')
    expect(reconstructed.gameTitle).toBe('Cyber Colosseum Deluxe')
    expect(reconstructed.hero.name).toBe('Titanium')
  })

  it('allows individual role updates without corrupting other roles', () => {
    const initial = createInitialGameProject()
    let design = withProject([], initial)

    // Update only hero
    const modifiedHero = { ...initial.hero, name: 'Apex Warrior', moveSpeed: 210 }
    design = withPart(design, 'hero', modifiedHero)

    const result = projectFromDesign(design)
    expect(result.hero.name).toBe('Apex Warrior')
    expect(result.hero.moveSpeed).toBe(210)
    // Boss, arena, and balance remain identical to initial
    expect(result.boss.name).toBe(initial.boss.name)
    expect(result.arena.cols).toBe(initial.arena.cols)
    expect(result.balance.targetDurationCategory).toBe(initial.balance.targetDurationCategory)
  })
})

describe('State Normalization & Simulation Crash Prevention Regression Tests', () => {
  it('normalizes legacy or incomplete project state without throwing', () => {
    // Legacy state from earlier versions lacking new role challenge attributes
    const legacyState = {
      studioName: 'Legacy Studio',
      hero: {
        name: 'Retro Knight',
        moveSpeed: 160,
        maxHealth: 100,
        attackDamage: 18,
        attackCooldown: 0.5,
        weapon: 'sword' as const,
        ability: 'dash' as const,
        // Missing: attackReach, attackArcDegrees, hitboxValidated
      },
      boss: {
        name: 'Old Boss',
        maxHealth: 200,
        attackDamage: 20,
        behavior: {
          detectionRange: 300,
          chaseSpeed: 100,
          attackRange: 70,
          attackWindup: 0.8,
          recoveryDuration: 0.6,
          retreatThreshold: 20,
          attackType: 'heavy_cleave' as const,
          // Missing: stateAfterAttack, activeBugId, bugResolved
        },
      },
      arena: {
        cols: 16,
        rows: 12,
        tiles: createStarterArenaLayout().tiles,
        // Missing: hasTestedWalk
      },
      balance: {
        targetDurationCategory: 'medium' as const,
        targetPlayerHitsToWin: 10,
        targetBossHitsToDefeatHero: 4,
        notes: 'Legacy test note',
        // Missing: baselineCase, selectedHypothesis, testedParameter, reflection, investigationCompleted
      },
    }

    const normalized = normalizeGameProject(legacyState)

    // Verify hero fallbacks
    expect(normalized.hero.name).toBe('Retro Knight')
    expect(normalized.hero.attackReach).toBeDefined()
    expect(normalized.hero.attackReach).toBeGreaterThan(0)
    expect(normalized.hero.attackArcDegrees).toBeDefined()
    expect(typeof normalized.hero.hitboxValidated).toBe('boolean')

    // Verify boss behavior fallbacks
    expect(normalized.boss.name).toBe('Old Boss')
    expect(normalized.boss.behavior.stateAfterAttack).toBeDefined()
    expect(typeof normalized.boss.behavior.bugResolved).toBe('boolean')

    // Verify arena fallbacks
    expect(normalized.arena.playerSpawn).toBeDefined()
    expect(normalized.arena.bossSpawn).toBeDefined()
    expect(typeof normalized.arena.hasTestedWalk).toBe('boolean')

    // Verify balance fallbacks (specifically the root cause of the trim crash)
    expect(normalized.balance.baselineCase).toBeDefined()
    expect(normalized.balance.baselineCase.fightDurationSeconds).toBeGreaterThan(0)
    expect(typeof normalized.balance.reflection).toBe('string')
    expect(() => normalized.balance.reflection.trim()).not.toThrow()
    expect(normalized.balance.selectedHypothesis).toBe('')
    expect(normalized.balance.investigationCompleted).toBe(false)
  })

  it('guarantees projectFromDesign handles empty design array and partial objects safely', () => {
    // Totally empty design
    const projectEmpty = projectFromDesign([])
    expect(projectEmpty.hero.name).toBe('Vanguard')
    expect(projectEmpty.balance.baselineCase).toBeDefined()
    expect(() => projectEmpty.balance.reflection.trim()).not.toThrow()

    // Partial design with only hero part
    const heroDesign = withPart([], 'hero', { name: 'Solo Hero' })
    const projectHeroOnly = projectFromDesign(heroDesign)
    expect(projectHeroOnly.hero.name).toBe('Solo Hero')
    expect(projectHeroOnly.boss.name).toBe('Goliath Prime')
    expect(projectHeroOnly.balance.baselineCase).toBeDefined()
    expect(projectHeroOnly.balance.reflection).toBe('')
  })

  it('initializes CombatSimulation safely with customized hero, boss, and arena', () => {
    const project = createInitialGameProject()
    // Customizations
    project.hero.weapon = 'blaster'
    project.hero.ability = 'heal'
    project.hero.moveSpeed = 220
    project.boss.behavior.chaseSpeed = 140
    project.boss.behavior.attackRange = 90

    const sim = new CombatSimulation(project.hero, project.boss, project.arena)

    expect(sim.heroHp).toBe(project.hero.maxHealth)
    expect(sim.bossHp).toBe(project.boss.maxHealth)
    expect(sim.isGameOver).toBe(false)

    // Simulate hero movements
    const initialY = sim.heroY
    sim.update(0.016, {
      up: true,
      down: false,
      left: false,
      right: false,
      attack: false,
      ability: false,
    })
    expect(sim.heroY).toBeLessThan(initialY)
  })

  it('handles simulation restart and rematch without state leakage or crash', () => {
    const project = createInitialGameProject()
    const sim1 = new CombatSimulation(project.hero, project.boss, project.arena)

    // Defeat boss in first run
    sim1.damageBoss(sim1.bossHp, 'FATAL STRIKE')
    sim1.update(0.016, {
      up: false,
      down: false,
      left: false,
      right: false,
      attack: false,
      ability: false,
    })

    expect(sim1.isGameOver).toBe(true)
    expect(sim1.winner).toBe('player')

    // Restart combat (rematch)
    const sim2 = new CombatSimulation(project.hero, project.boss, project.arena)
    expect(sim2.isGameOver).toBe(false)
    expect(sim2.winner).toBeNull()
    expect(sim2.bossHp).toBe(project.boss.maxHealth)
    expect(sim2.heroHp).toBe(project.hero.maxHealth)
    expect(sim2.battleTimeSeconds).toBe(0)
  })

  it('safely handles missing spawn points in arena layout without throwing', () => {
    const project = createInitialGameProject()
    // Malformed layout missing spawns
    const malformedArena = {
      cols: 16,
      rows: 12,
      tiles: createStarterArenaLayout().tiles,
    } as unknown as ArenaLayout

    expect(() => new CombatSimulation(project.hero, project.boss, malformedArena)).not.toThrow()
    const sim = new CombatSimulation(project.hero, project.boss, malformedArena)
    expect(sim.heroX).toBeGreaterThan(0)
    expect(sim.bossX).toBeGreaterThan(0)
  })
})
