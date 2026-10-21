import { describe, expect, test } from 'vitest'
import { CRIMP, DIMS, FRONT_WINGS, getBusiness, getElectrical, getMechanical, getSoftware, HARNESS, LIDAR_COLOR_RULE, PLANNER_LINE, POWER_PATHS, REQUIRED, ROUTE_BOARDS, SENSOR_BOARD, SENSOR_WIRES, SPLICE_WIRES, SPONSOR_BY_ID, SPONSORS, WING_START } from '../config'
import type { FsaeObject } from '../types'
import { linePath, ruleAccuracy, testScans } from './autonomy'
import { counterReply, effortScore, fundsRaised, payoutFor, sponsorCeiling, totalFunds, vibeFlyer } from './business'
import { evaluate, FsaeRun, type FsaeResult } from './engine'
import { lineBoard, lineProgress, scoreCrimp, sensorBoard, zoneAt } from './harness'
import { readAll } from './power'
import { boardStatus, generateBoard } from './routing'
import * as S from './strategies'
import { getTrack } from './track'

const passes = (r: FsaeResult) => r.lapPass && r.driverlessPass && r.powerPass && r.fundsPass

describe('fsae balancing', () => {
  test('doing nothing fails every requirement', () => {
    const r = evaluate(S.empty())
    expect(r.lapPass).toBe(false)
    expect(r.driverlessPass).toBe(false)
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

  test('the untouched default car (welded, wired, line drawn) is too slow', () => {
    const d: FsaeObject[] = [S.mech({ front: WING_START.front, rear: WING_START.rear, wheelbase: DIMS.wheelbase.start, track: DIMS.track.start, ride: DIMS.rideHeight.start }), S.goodPower(), S.software(), S.businessDone()]
    expect(evaluate(d).lapS).toBeGreaterThan(REQUIRED.maxLapS)
  })

  test.each([
    ['unbalanced wings', S.unbalanced],
    ['floor scraping', S.scraping],
    ['sloppy welds', S.sloppyWelds],
    ['motor over-voltage', S.hotMotor],
  ])('%s misses the lap time', (_name, make) => {
    expect(evaluate(make()).lapPass).toBe(false)
  })

  test('every front wing design is used by some passing car', () => {
    const used = [S.downforce, S.lowDrag, S.balanced, S.budget].filter((m) => passes(evaluate(m()))).map((m) => getMechanical(m()).frontWing)
    for (const w of FRONT_WINGS) expect(used).toContain(w.id)
  })

  test('designs saved before the new stations still load', () => {
    const oldElec = { id: 'station:electrical', kind: 'electrical', slots: { motor: [null, null] }, updatedAt: 3 } as unknown as FsaeObject
    const oldSw = { id: 'station:software', kind: 'software', seed: 77, roundsDone: 4, weights: [1, 2, 3, 4], updatedAt: 3 } as unknown as FsaeObject
    const oldBiz = { id: 'station:business', kind: 'business', panels: [], deals: [], updatedAt: 3 } as unknown as FsaeObject
    const d = [S.mech({ front: 'dual', rear: 60, wheelbase: 1600, track: 1200, ride: 40 }), oldElec, oldSw, oldBiz]
    expect(() => evaluate(d)).not.toThrow()
    expect(getElectrical(d).lines.motor.cutAt).toBeNull()
    expect(getSoftware(d).seed).toBe(77)
    expect(getBusiness(d).deals).toEqual([])
  })
})

describe('electrical harness', () => {
  test('V = I × R on the motor splice, minus the crimps', () => {
    const r = readAll(S.goodPower())
    expect(r.motor.volts).toBe(40)
    expect(r.motor.heatW).toBeCloseTo(80) // 10 A² × 0.8 Ω
    expect(r.computer.volts).toBe(5)
  })

  test('an untouched wire carries its raw voltage; a cut, unfinished wire carries nothing', () => {
    const raw = evaluate(S.noElectrical())
    expect(raw.powerReady).toBe(0)
    expect(raw.motorState).toBe('high')
    const cut = getElectrical([])
    cut.lines.computer = { cutAt: 0.3, crimps: [1, null], part: null, routes: {} }
    expect(readAll(cut).computer.volts).toBe(0)
    expect(readAll(cut).computer.open).toBe(true)
  })

  test('bad crimps next to the motor drop volts; weak crimps by the suspension shake loose on the lap', () => {
    const hot = evaluate(S.hotCrimp())
    expect(hot.motorState).toBe('low')
    expect(hot.powerPass).toBe(false)
    const loose = evaluate(S.looseCrimp())
    const bench = readAll(getElectrical(S.looseCrimp())).computer
    expect(bench.state).toBe('ok')
    expect(loose.power.find((p) => p.id === 'computer')!.loose).toBe(true)
    expect(loose.powerPass).toBe(false)
  })

  test('wiring that is not tied down fails inspection', () => {
    const r = evaluate(S.untidy())
    expect(r.power.every((p) => p.state === 'ok')).toBe(true)
    expect(r.powerPass).toBe(false)
  })

  test('the reference harness ticks every checklist step', () => {
    const e = S.goodPower()
    for (const p of POWER_PATHS) expect(lineProgress(e, p.id).done).toBe(true)
  })

  test('every wire has a hot or moving stretch and a clear one', () => {
    for (const p of POWER_PATHS) {
      const zones = HARNESS[p.id].zones
      expect(zones[0].from).toBe(0)
      expect(zones[zones.length - 1].to).toBe(1)
      expect(zones.some((z) => z.zone === 'clear')).toBe(true)
      expect(zones.some((z) => z.zone !== 'clear')).toBe(true)
      expect(zoneAt(p.id, 0.5)).toBeTruthy()
    }
  })

  test('crimping: the right die, strip length and squeeze make a perfect crimp; mistakes are reported as facts', () => {
    const good = scoreCrimp({ die: 'red', stripMm: CRIMP.stripTargetMm, squeeze: 0.86 }, 18)
    expect(good.quality).toBe(1)
    const wrongDie = scoreCrimp({ die: 'yellow', stripMm: 6, squeeze: 0.86 }, 18)
    expect(wrongDie.quality).toBeLessThan(0.5)
    const short = scoreCrimp({ die: 'red', stripMm: 3, squeeze: 0.86 }, 18)
    expect(short.quality).toBeLessThan(1)
    const crushed = scoreCrimp({ die: 'red', stripMm: 6, squeeze: 1.05 }, 18)
    expect(crushed.quality).toBeLessThanOrEqual(0.5)
    for (const r of [good, wrongDie, short, crushed]) for (const f of r.facts) expect(f).not.toMatch(/\b(should|try|need to|add)\b/i)
  })

  test.each([1, 7, 99, 4242, 123456])('seed %i: every routing board has a full solution', (seed) => {
    for (const p of POWER_PATHS) for (const z of ['clear', 'moving', 'hot'] as const) expect(boardStatus(lineBoard(seed, p.id, z), lineBoard(seed, p.id, z).solution).complete).toBe(true)
    expect(boardStatus(sensorBoard(seed), sensorBoard(seed).solution).complete).toBe(true)
    expect(() => generateBoard(seed, ROUTE_BOARDS.clear, SPLICE_WIRES)).not.toThrow()
    expect(() => generateBoard(seed, SENSOR_BOARD, SENSOR_WIRES)).not.toThrow()
  })
})

describe('driverless', () => {
  test('no power to the computer: the car does not finish', () => {
    expect(evaluate(S.cutComputer()).driverless.finished).toBe(false)
    expect(evaluate(S.empty()).driverless.finished).toBe(false)
  })

  test('the LiDAR comes mounted and wired, even with no other sensors', () => {
    const r = evaluate(S.lidarOnly()).driverless
    expect(r.lidar).toBe(true)
    expect(r.camera).toBe(false)
    expect(r.wheel).toBe(false)
  })

  test('no graph course cleared: the car has no path-planning code and does not finish', () => {
    const r = evaluate(S.untouchedSoftware())
    expect(r.driverless.finished).toBe(false)
    expect(r.driverless.planner).toBe(0)
  })

  test('each graph course cleared makes the driverless lap faster; only all three pass', () => {
    const [one, two, three] = [S.easyOnly(), S.twoCourses(), S.balanced()].map((d) => evaluate(d).driverless)
    expect(two.lapS).toBeLessThan(one.lapS - 2)
    expect(three.lapS).toBeLessThan(two.lapS - 1)
    expect(evaluate(S.easyOnly()).driverlessPass).toBe(false)
    expect(evaluate(S.twoCourses()).driverlessPass).toBe(false)
    expect(evaluate(S.balanced()).driverlessPass).toBe(true)
    expect(evaluate(S.balanced(), 'night').driverlessPass).toBe(true)
  })

  test('courses count in order: Hard without Medium only counts Easy', () => {
    expect(evaluate(S.skippedMedium()).driverless.planner).toBe(1)
  })

  test.each([1, 7, 99, 4242, 123456])('seed %i: the LiDAR’s built-in color rule reads cone colors reliably', (seed) => {
    expect(ruleAccuracy(LIDAR_COLOR_RULE, testScans(seed))).toBeGreaterThanOrEqual(0.9)
  })

  test('the planner’s racing line stays on the course', () => {
    const path = linePath(PLANNER_LINE)
    expect(path.x.length).toBe(getTrack().x.length)
    expect(Math.max(...path.off.map(Math.abs))).toBeLessThanOrEqual(3.9)
  })
})

describe('business', () => {
  test('sponsors accept up to their limit, make a final offer a bit over, and walk away far over', () => {
    const ceiling = sponsorCeiling(9, 'voltcell')
    expect(Math.abs(ceiling - SPONSOR_BY_ID.voltcell.ceiling)).toBeLessThanOrEqual(500)
    expect(counterReply(9, 'voltcell', ceiling)).toEqual({ kind: 'accepted', amount: ceiling })
    expect(counterReply(9, 'voltcell', ceiling + 500).kind).toBe('final-offer')
    expect(counterReply(9, 'voltcell', ceiling * 3).kind).toBe('walked-away')
  })

  test('more effort pays more', () => {
    const low = effortScore({ strokes: 2, colorsUsed: 1, stickers: 0, texts: 0, coverage: 0.01, promptWords: 3 })
    const high = effortScore({ strokes: 40, colorsUsed: 6, stickers: 6, texts: 3, coverage: 0.3, promptWords: 20 })
    expect(high).toBeGreaterThan(low)
    expect(high).toBeCloseTo(1, 5)
    expect(payoutFor(4000, high)).toBe(6000)
    expect(payoutFor(4000, 0)).toBe(2000)
  })

  test('vibe prompts shape the flyer', () => {
    const f = vibeFlyer('a bold red and black poster with a race car that says "Slice fuels the pit crew"', 'slice')
    expect(f.headline).toBe('Slice fuels the pit crew')
    expect(f.motif).toBe('car')
    expect(f.palette[0]).toBe('#d33a2c')
  })

  test('one rushed flyer does not pay for the car', () => {
    expect(fundsRaised(S.businessRushed())).toBeLessThan(1000)
    expect(evaluate(S.brokeTeam()).fundsPass).toBe(false)
  })

  test('accepting every opening offer with no work on the flyers is not enough', () => {
    const biz = { ...getBusiness([]), deals: SPONSORS.map((x) => ({ sponsorId: x.id, stage: 'paid' as const, agreed: x.opening, offer: x.opening, countered: false, flyer: null, effort: 0, payout: payoutFor(x.opening, 0) })) }
    expect(totalFunds(biz)).toBeLessThan(evaluate(S.budget()).cost)
  })
})

describe('run playback', () => {
  test('plays the autocross lap then the driverless lap on the team line and finishes', () => {
    const run = new FsaeRun(S.balanced(), 'standard')
    let guard = 0
    const n = getTrack().x.length
    let sawDriverless = false
    let maxOff = 0
    while (!run.done && guard++ < 5000) {
      run.step()
      const f = run.frame()
      expect(f.pos).toBeGreaterThanOrEqual(0)
      expect(f.pos).toBeLessThanOrEqual(n)
      if (f.phase === 'driverless') {
        sawDriverless = true
        maxOff = Math.max(maxOff, Math.abs(f.off))
      }
    }
    expect(run.done).toBe(true)
    expect(sawDriverless).toBe(true)
    expect(maxOff).toBeGreaterThan(1)
  })
})
