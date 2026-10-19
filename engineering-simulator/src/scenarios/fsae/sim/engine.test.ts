import { describe, expect, test } from 'vitest'
import { DIMS, REQUIRED, WING_START } from '../config'
import type { FsaeObject, PowerPart } from '../types'
import { accuracy, coneThreshold, testSet, trueWeights, weightEquations } from './autonomy'
import { evaluate, FsaeRun, type FsaeResult } from './engine'
import { readAll } from './power'
import * as S from './strategies'
import { getTrack } from './track'

const passes = (r: FsaeResult) => r.lapPass && r.conesPass && r.powerPass && r.fundsPass

describe('fsae balancing', () => {
  test('doing nothing fails every requirement', () => {
    const r = evaluate(S.empty())
    expect(r.lapPass).toBe(false)
    expect(r.conesPass).toBe(false)
    expect(r.powerPass).toBe(false)
    expect(r.fundsPass).toBe(false)
  })

  test.each([
    ['big downforce', S.downforce],
    ['low drag', S.lowDrag],
    ['balanced', S.balanced],
    ['budget', S.budget],
  ])('%s car passes, day and night', (_name, make) => {
    expect(passes(evaluate(make()))).toBe(true)
    expect(passes(evaluate(make(), 'night'))).toBe(true)
  })

  test('the untouched default car (welded, wired, trained) is too slow', () => {
    const d: FsaeObject[] = [S.mech({ front: WING_START.front, rear: WING_START.rear, wheelbase: DIMS.wheelbase.start, track: DIMS.track.start, ride: DIMS.rideHeight.start }), S.goodPower(), S.software(4242), S.businessDone()]
    const r = evaluate(d)
    expect(r.lapS).toBeGreaterThan(REQUIRED.maxLapS)
  })

  test.each([
    ['unbalanced wings', S.unbalanced],
    ['floor scraping', S.scraping],
    ['sloppy welds', S.sloppyWelds],
    ['motor over-voltage', S.hotMotor],
  ])('%s misses the lap time', (_name, make) => {
    expect(evaluate(make()).lapPass).toBe(false)
  })

  test('raw voltages put nothing in range, and the motor runs protected', () => {
    const r = evaluate(S.noElectrical())
    expect(r.powerInRange).toBe(0)
    expect(r.motorState).toBe('high')
  })

  test('wrong weights hit cones', () => {
    expect(evaluate(S.sloppyMath()).conesPass).toBe(false)
  })

  test('a rushed pitch does not pay for the car', () => {
    expect(evaluate(S.brokeTeam()).fundsPass).toBe(false)
  })

  test('dim headlights are fine by day but miss cones at night', () => {
    expect(evaluate(S.dimLights()).driverless.missed).toBe(0)
    expect(evaluate(S.dimLights(), 'night').conesPass).toBe(false)
  })

  test('nothing breaks: super bright lights still drive the course', () => {
    const bright: [PowerPart, null] = [{ type: 'booster', value: 12 }, null]
    const d = S.downforce().map((o) => (o.kind === 'electrical' ? { ...o, slots: { ...o.slots, headlights: bright } } : o))
    const r = evaluate(d, 'night')
    expect(r.power.find((p) => p.id === 'headlights')!.state).toBe('high')
    expect(r.driverless.missed).toBe(0)
  })
})

describe('electrical', () => {
  test('V = I × R on the motor line', () => {
    const r = readAll(S.goodPower())
    expect(r.motor.volts).toBe(40)
    expect(r.motor.heatW).toBeCloseTo(80) // 10 A² × 0.8 Ω
    expect(r.computer.volts).toBe(5)
    expect(r.headlights.volts).toBe(12)
  })
})

describe('software', () => {
  test.each([1, 7, 99, 4242, 123456])('seed %i: equations solve to the true weights, which score 100%%', (seed) => {
    const w = trueWeights(seed)
    for (const eq of weightEquations(seed)) {
      const known = eq.x.reduce((s, xi, i) => (i === eq.unknown ? s : s + xi * w[i]), 0)
      expect((eq.target - known) / eq.x[eq.unknown]).toBe(w[eq.unknown])
      expect(eq.x[eq.unknown]).toBeGreaterThan(0)
      // Later weights never appear in an earlier equation.
      eq.x.forEach((xi, i) => i > eq.unknown && expect(xi).toBe(0))
    }
    expect(accuracy(S.software(seed))).toBe(1)
    expect(testSet(seed).every((it) => it.x.length === 4)).toBe(true)
    expect(coneThreshold(seed)).toBeGreaterThan(0)
  })

  test('an untrained model drives over every cone', () => {
    expect(evaluate([]).driverless.missed).toBe(40)
  })
})

describe('run playback', () => {
  test('plays the autocross lap then the driverless lap and finishes', () => {
    const run = new FsaeRun(S.balanced(), 'standard')
    let guard = 0
    const n = getTrack().x.length
    let sawDriverless = false
    while (!run.done && guard++ < 5000) {
      run.step()
      const f = run.frame()
      expect(f.pos).toBeGreaterThanOrEqual(0)
      expect(f.pos).toBeLessThanOrEqual(n)
      if (f.phase === 'driverless') sawDriverless = true
    }
    expect(run.done).toBe(true)
    expect(sawDriverless).toBe(true)
  })
})
