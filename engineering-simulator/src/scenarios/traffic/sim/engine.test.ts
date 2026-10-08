import { describe, expect, test } from 'vitest'
import { BUDGET, REQUIRED } from '../config'
import { designCost } from '../cost'
import type { TrafficObject } from '../types'
import { runMorning, type TrafficResult } from './engine'
import * as S from './strategies'

const passesTech = (r: TrafficResult) => r.onTimePct >= REQUIRED.onTimePct && r.unsafe <= REQUIRED.maxUnsafe
const passes = (d: TrafficObject[], r: TrafficResult) => passesTech(r) && designCost(d) <= BUDGET
const mainDelay = (r: TrafficResult) => ['EB_R', 'EB_L', 'WB_L', 'WB_R'].reduce((a, id) => a + r.laneDelay[id].reduce((x, y) => x + y, 0), 0)

describe('traffic balancing', () => {
  test('doing nothing fails both performance requirements', () => {
    const r = runMorning([])
    expect(r.onTimePct).toBeLessThan(REQUIRED.onTimePct - 10)
    expect(r.unsafe).toBeGreaterThan(5 * REQUIRED.maxUnsafe)
    expect(r.maxMainQueue).toBeGreaterThan(15) // spill-back onto Main Street is obvious
  })

  test('random placements fail', () => {
    const d = S.randomish()
    expect(passes(d, runMorning(d))).toBe(false)
  })

  test.each([
    ['A: flow engineering', S.strategyA],
    ['B: mode shift', S.strategyB],
    ['C: spread the load', S.strategyC],
    ['D: cheap operations', S.strategyD],
  ])('strategy %s passes within budget', (_name, make) => {
    const d = make()
    const r = runMorning(d)
    expect(r.onTimePct).toBeGreaterThanOrEqual(REQUIRED.onTimePct)
    expect(r.unsafe).toBeLessThanOrEqual(REQUIRED.maxUnsafe)
    expect(designCost(d)).toBeLessThanOrEqual(BUDGET)
  })

  test('buying everything works technically but blows the budget', () => {
    const d = S.strategyEverything()
    expect(passesTech(runMorning(d))).toBe(true)
    expect(designCost(d)).toBeGreaterThan(BUDGET)
  })

  test('Rainy Monday is harder for every strategy', () => {
    for (const make of [S.strategyA, S.strategyB, S.strategyC, S.strategyD]) {
      const d = make()
      expect(runMorning(d, 'rainy').onTimePct).toBeLessThan(runMorning(d).onTimePct)
    }
  })
})

describe('traffic mechanics', () => {
  const withoutMid = S.strategyA().filter((o) => !('site' in o && o.site === 'main-200'))

  test('an unprotected crosswalk on Main helps safety but slows Main Street and is not enough', () => {
    const none = runMorning(withoutMid)
    const plain = runMorning([...withoutMid, S.crosswalk('main-200')])
    const beacon = runMorning([...withoutMid, S.crosswalk('main-200'), S.beacon('main-200')])
    expect(plain.unsafe).toBeLessThan(none.unsafe)
    expect(plain.unsafe).toBeGreaterThan(REQUIRED.maxUnsafe)
    expect(mainDelay(plain)).toBeGreaterThan(mainDelay(none) * 1.05)
    expect(beacon.unsafe).toBe(0)
  })

  test('a bike lane that does not connect shifts nobody; a complete route does', () => {
    const base = runMorning([]).modeSplit.bike
    expect(runMorning([S.bikeLane('bl-pine')]).modeSplit.bike).toBeCloseTo(base)
    expect(runMorning([S.bikeLane('bl-pine'), S.bikeLane('bl-elm')]).modeSplit.bike).toBeGreaterThan(base)
  })

  test('every student is accounted for', () => {
    const r = runMorning(S.strategyC())
    expect(r.totalStudents).toBeGreaterThan(1790)
    expect(r.totalStudents).toBeLessThan(1810)
  })

  test('the simulation is deterministic', () => {
    expect(runMorning(S.strategyB()).onTimePct).toBe(runMorning(S.strategyB()).onTimePct)
  })

  test('odd designs do not crash', () => {
    const odd: TrafficObject[] = [
      S.beacon('pine-200'), // beacon without a crosswalk
      S.signal('in'),
      S.signal('in', 'side'), // duplicate signal
      S.curb('gate-curb'), // needs the side gate, which is closed
      S.guard('oak-100'),
      S.stop('oak-100'),
      S.busBay('bay-oak'),
      S.busBay('bay-oak'),
    ]
    const r = runMorning(odd)
    expect(Number.isFinite(r.onTimePct)).toBe(true)
    expect(Number.isFinite(r.unsafe)).toBe(true)
  })
})
