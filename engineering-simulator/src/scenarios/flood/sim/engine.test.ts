import { describe, expect, test } from 'vitest'
import { BUDGET, REQUIRED } from '../config'
import { designCost } from '../cost'
import type { FloodObject } from '../types'
import { runStorm, type FloodResult } from './engine'
import * as S from './strategies'

const passesTech = (r: FloodResult) => r.maxFloodIn <= REQUIRED.maxFloodIn && r.runoffManagedPct >= REQUIRED.runoffManagedPct
const passes = (d: FloodObject[], r: FloodResult) => passesTech(r) && designCost(d) <= BUDGET

describe('balancing', () => {
  test('doing nothing fails badly', () => {
    const r = runStorm([])
    expect(r.maxFloodIn).toBeGreaterThan(3 * REQUIRED.maxFloodIn)
    expect(r.runoffManagedPct).toBeLessThan(REQUIRED.runoffManagedPct)
  })

  test('random placements fail', () => {
    const d = S.randomish()
    expect(passes(d, runStorm(d))).toBe(false)
  })

  test.each([
    ['A: drains + big pipes', S.strategyA],
    ['B: ponds + permeable pavement', S.strategyB],
    ['C: channel + rain gardens + small pipes', S.strategyC],
    ['D: pumps + drains + infiltration', S.strategyD],
  ])('strategy %s passes within budget', (_name, make) => {
    const d = make()
    const r = runStorm(d)
    expect(r.maxFloodIn).toBeLessThanOrEqual(REQUIRED.maxFloodIn)
    expect(r.runoffManagedPct).toBeGreaterThanOrEqual(REQUIRED.runoffManagedPct)
    expect(designCost(d)).toBeLessThanOrEqual(BUDGET)
  })

  test('buying everything works technically but blows the budget', () => {
    const d = S.strategyEverything()
    expect(passesTech(runStorm(d))).toBe(true)
    expect(designCost(d)).toBeGreaterThan(BUDGET)
  })

  test('the advanced storm is harder for every strategy', () => {
    for (const make of [S.strategyA, S.strategyB, S.strategyC, S.strategyD]) {
      const d = make()
      const std = runStorm(d)
      const adv = runStorm(d, 'advanced')
      expect(adv.maxFloodIn).toBeGreaterThan(std.maxFloodIn)
      expect(adv.runoffManagedPct).toBeLessThan(std.runoffManagedPct)
    }
  })
})

describe('physics', () => {
  test('water is conserved', () => {
    const r = runStorm(S.strategyEverything())
    const t = r.totals
    expect(t.infiltrated + t.drained + t.stored + t.offsite + t.ponded).toBeCloseTo(t.rain, 0)
  })

  test('the simulation is deterministic', () => {
    const d = S.strategyB()
    expect(runStorm(d).maxFloodIn).toBe(runStorm(d).maxFloodIn)
  })

  test('a badly angled barrier makes flooding worse, a sensible one helps', () => {
    const base = runStorm([]).buildingFloodIn
    const angled = runStorm([{ id: 'b', kind: 'barrier', points: [{ x: 5, y: 22 }, { x: 34, y: 27 }] }])
    const shield = runStorm([{ id: 'b', kind: 'barrier', points: [{ x: 45, y: 38 }, { x: 66, y: 38 }] }])
    expect(angled.buildingFloodIn[0]).toBeGreaterThan(base[0]) // Building A
    expect(shield.buildingFloodIn[1]).toBeLessThan(base[1] * 0.7) // Building B
  })

  test('nonsense input does not crash', () => {
    const junk: FloodObject[] = [
      { id: 'p', kind: 'pipe', from: 'missing', to: 'outlet-creek', size: 'large' },
      { id: 'q', kind: 'pipe', from: 'd', to: 'd', size: 'small' },
      { id: 'd', kind: 'drain', x: 50, y: 45 }, // inside Building B
      { id: 'c', kind: 'channel', points: [] },
      { id: 'w', kind: 'barrier', points: [{ x: -5, y: -5 }, { x: 200, y: 200 }] },
      { id: 'u', kind: 'pump', x: 0, y: 0, size: 'small', out: { x: -10, y: 999 } },
      { id: 'o', kind: 'pond', x: 90, y: 55, size: 'large' },
    ]
    const r = runStorm(junk)
    expect(Number.isFinite(r.maxFloodIn)).toBe(true)
    expect(Number.isFinite(r.runoffManagedPct)).toBe(true)
  })
})
