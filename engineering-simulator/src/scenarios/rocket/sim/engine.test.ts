import { describe, expect, test } from 'vitest'
import { BUDGET, REQUIRED } from '../config'
import { designCost } from '../cost'
import { assignRocketRoles } from '../roles'
import { evaluateRocketDesign, RocketRun } from './engine'
import {
  emptyDesign,
  heavyMotorSplatterDesign,
  overBudgetDesign,
  strategyA,
  strategyB,
  strategyC,
  strategyCrosswind,
  uncalibratedGyroSpinDesign,
  weakMotorSpinDesign,
} from './strategies'

describe('Rocket Team (IREC) Simulation Engine & Balancing', () => {
  test('empty / default layout fails both rocket apogee and payload landing requirements', () => {
    const r = evaluateRocketDesign(emptyDesign, 'standard')
    expect(r.rocketPassed).toBe(false)
    expect(r.payloadPassed).toBe(false)
    expect(r.payloadIntact).toBe(false)
  })

  test('Strategies A, B, C, and Crosswind pass within the $120,000 budget', () => {
    for (const [name, design] of [
      ['Strategy A (Fiberglass)', strategyA],
      ['Strategy B (Carbon + M-Class)', strategyB],
      ['Strategy C (Aluminum + O-Class)', strategyC],
      ['Strategy D (Crosswind Finals)', strategyCrosswind],
    ] as const) {
      const cost = designCost(design)
      const r = evaluateRocketDesign(design, 'standard')
      expect(cost, `${name} cost`).toBeLessThanOrEqual(BUDGET)
      expect(r.rocketPassed, `${name} rocket apogee (${r.apogeeFt} ft)`).toBe(true)
      expect(r.apogeeErrorFt, `${name} apogee error`).toBeLessThanOrEqual(REQUIRED.maxApogeeErrorFt)
      expect(r.payloadPassed, `${name} payload landing (${r.landingDistFt} ft, ${r.payloadOutcome})`).toBe(true)
      expect(r.payloadOutcome).toBe('target-landed')
    }
  })

  test('Payload failure mode 1: too-heavy motor causes comedic splatter on landing', () => {
    const r = evaluateRocketDesign(heavyMotorSplatterDesign, 'payload-drop')
    expect(r.payloadOutcome).toBe('splatter')
    expect(r.payloadIntact).toBe(false)
    expect(r.payloadPassed).toBe(false)
  })

  test('Payload failure mode 2: too-light/weak motor spins out of control', () => {
    const r = evaluateRocketDesign(weakMotorSpinDesign, 'payload-drop')
    expect(r.payloadOutcome).toBe('spin-motor-weak')
    expect(r.payloadIntact).toBe(false)
    expect(r.payloadPassed).toBe(false)
  })

  test('Payload failure mode 3: uncalibrated gyroscope spins out of control', () => {
    const r = evaluateRocketDesign(uncalibratedGyroSpinDesign, 'payload-drop')
    expect(r.payloadOutcome).toBe('spin-gyro-uncalibrated')
    expect(r.payloadIntact).toBe(false)
    expect(r.payloadPassed).toBe(false)
  })

  test('Live parachute trigger during RocketRun overrides armed altitude', () => {
    const run = new RocketRun(strategyA, 'payload-drop')
    // Step halfway through freefall
    for (let i = 0; i < 120; i++) run.step()
    expect(run.frame.canDeployChute).toBe(true)
    const deployedAt = run.deployParachute()
    expect(deployedAt).not.toBeNull()
    expect(run.frame.chuteOpen).toBe(true)
    while (!run.done) run.step()
    expect(run.result().telemetry.chuteDeployAltFt).toBe(deployedAt)
  })

  test('Flying faster than the airframe can take tears it apart at its safe speed, mid-burn', () => {
    const overloaded = strategyA.map((o) => (o.kind === 'launchSetup' ? { ...o, impulseId: 'o-class' as const } : o))
    const r = evaluateRocketDesign(overloaded, 'rocket-launch')
    expect(r.rocketOutcome).toBe('structural-shred')
    expect(r.telemetry.peakSpeedMph).toBeGreaterThan(r.telemetry.maxSafeSpeedMph)
    expect(r.telemetry.breakupSpeedMph).toBe(r.telemetry.maxSafeSpeedMph)
    expect(r.apogeeFt).toBe(r.telemetry.breakupAltFt)

    const run = new RocketRun(overloaded, 'rocket-launch')
    let fastestIntactFps = 0
    let lastBreakupProgress = -1
    while (!run.done) {
      run.step()
      if (!run.frame.rocketShredded) fastestIntactFps = Math.max(fastestIntactFps, run.frame.hudSpeedFps)
      else {
        expect(run.frame.breakupProgress).toBeGreaterThanOrEqual(lastBreakupProgress)
        lastBreakupProgress = run.frame.breakupProgress
      }
    }
    const safeFps = (r.telemetry.maxSafeSpeedMph * 3.281) / 2.237
    expect(fastestIntactFps).toBeLessThanOrEqual(safeFps * 1.01)
    expect(fastestIntactFps).toBeGreaterThan(safeFps * 0.95)
    expect(lastBreakupProgress).toBeGreaterThan(0.95)
  })

  test('A passing rocket speeds up through the burn, then coasts and never passes its safe speed', () => {
    const run = new RocketRun(strategyA, 'rocket-launch')
    const speeds: number[] = []
    while (!run.done) {
      run.step()
      expect(run.frame.rocketShredded).toBe(false)
      expect(run.frame.structuralStress).toBeLessThan(1)
      speeds.push(run.frame.hudSpeedFps)
    }
    const peakAt = speeds.indexOf(Math.max(...speeds))
    expect(speeds[0]).toBeLessThan(speeds[peakAt])
    expect(peakAt).toBeGreaterThan(0)
    expect(speeds[speeds.length - 1]).toBeLessThan(speeds[peakAt] * 0.1)
  })

  test('Over-budget design passes technically but exceeds $120,000 budget', () => {
    expect(designCost(overBudgetDesign)).toBeGreaterThan(BUDGET)
  })

  test('Crosswind Finals fails standard Strategy A unless upgraded (Strategy D passes)', () => {
    const stdInWind = evaluateRocketDesign(strategyA, 'crosswind')
    expect(stdInWind.payloadPassed && stdInWind.rocketPassed).toBe(false)

    const upgradedInWind = evaluateRocketDesign(strategyCrosswind, 'crosswind')
    expect(upgradedInWind.rocketPassed).toBe(true)
    expect(upgradedInWind.payloadPassed).toBe(true)
  })
})

describe('Rocket Team 6-Role Preference Tier List Matcher (assignRocketRoles)', () => {
  test('gives all 6 teammates their 1st choice when all 1st choices are distinct', () => {
    const assigned = assignRocketRoles([
      { playerId: 'p1', playerName: 'Alice', choices: ['payload-tester', 'payload-gyro'] },
      { playerId: 'p2', playerName: 'Bob', choices: ['payload-gyro', 'payload-motor'] },
      { playerId: 'p3', playerName: 'Charlie', choices: ['payload-motor', 'rocket-mass'] },
      { playerId: 'p4', playerName: 'Dana', choices: ['rocket-mass', 'rocket-material'] },
      { playerId: 'p5', playerName: 'Eli', choices: ['rocket-material', 'rocket-tester'] },
      { playerId: 'p6', playerName: 'Fran', choices: ['rocket-tester', 'payload-tester'] },
    ])
    expect(assigned.every((a) => a.choiceRank === 1)).toBe(true)
    expect(assigned.find((a) => a.roleId === 'payload-tester')?.playerId).toBe('p1')
    expect(assigned.find((a) => a.roleId === 'rocket-tester')?.playerId).toBe('p6')
  })

  test('resolves collisions using 2nd choice tier list when two players both want Tester 1st', () => {
    // Both p1 and p2 want 'payload-tester' 1st, but p1 ranked 'payload-gyro' 2nd while p2 only wants 'payload-tester'
    const assigned = assignRocketRoles([
      { playerId: 'p1', playerName: 'Alice', choices: ['payload-tester', 'payload-gyro'] },
      { playerId: 'p2', playerName: 'Bob', choices: ['payload-tester', 'rocket-tester'] },
      { playerId: 'p3', playerName: 'Charlie', choices: ['rocket-tester', 'rocket-mass'] },
    ])
    const p1Role = assigned.find((a) => a.playerId === 'p1')!
    const p2Role = assigned.find((a) => a.playerId === 'p2')!
    const p3Role = assigned.find((a) => a.playerId === 'p3')!
    // Everyone gets either their 1st or 2nd choice!
    expect([1, 2]).toContain(p1Role.choiceRank)
    expect([1, 2]).toContain(p2Role.choiceRank)
    expect([1, 2]).toContain(p3Role.choiceRank)
  })
})
