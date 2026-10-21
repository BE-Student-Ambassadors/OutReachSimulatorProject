import { describe, expect, test } from 'vitest'
import { CIRCUITS, REQUIRED, SPONSOR_BY_ID } from '../config'
import { assignRocketRoles } from '../roles'
import type { CircuitId } from '../types'
import { BOARDS } from '../config'
import { boardStatus, generateBoard, wireConnected } from './board'
import { readLines } from './power'
import { counterReply, effortScore, payoutFor, sponsorCeiling, vibeFlyer } from './business'
import { evaluateRocketDesign, RocketRun } from './engine'
import { BUG_COUNT, compile, starterProgram } from './rocketScript'
import { defaultNumbers, emptyDesign, STRATEGY_PARTS, strategyMid, strategyPremium, strategyThrifty, teamDesign, untouchedProgram } from './strategies'

const { MID_PARTS, CHEAP_PARTS, PREMIUM_PARTS, TWO_DEALS } = STRATEGY_PARTS
const midWith = (over: Partial<Parameters<typeof teamDesign>[0]>) =>
  teamDesign({ parts: MID_PARTS, settings: { throttle: 55, burn_time: 3, deploy_altitude: 1300 }, deals: TWO_DEALS, ...over } as Parameters<typeof teamDesign>[0])
const allBut = (c: CircuitId) => CIRCUITS.map((x) => x.id).filter((x) => x !== c)

describe('Rocket Team flight', () => {
  test('the empty design never leaves the pad', () => {
    const r = evaluateRocketDesign(emptyDesign)
    expect(r.outcome).toBe('no-ignition')
    expect(r.apogeePassed).toBe(false)
    expect(r.recoveryPassed).toBe(false)
  })

  test('three different strategies pass every requirement', () => {
    for (const [name, d] of [
      ['mid parts', strategyMid],
      ['thrifty parts', strategyThrifty],
      ['premium parts', strategyPremium],
    ] as const) {
      const r = evaluateRocketDesign(d)
      expect(r.apogeePassed, `${name}: apogee ${r.apogeeFt} ft (${r.outcome})`).toBe(true)
      expect(r.recoveryPassed, `${name}: landing ${r.landingFps} ft/s (${r.chute})`).toBe(true)
      expect(r.budgetPassed, `${name}: spent ${r.spent} of ${r.funds}`).toBe(true)
    }
  })

  test('the starting program, uploaded with its bugs, does not run', () => {
    const r = evaluateRocketDesign(untouchedProgram)
    expect(r.outcome).toBe('no-ignition')
    expect(r.ignitionBlocks).toContain('no-program')
  })

  test('with the bugs fixed, the starting numbers fly but are not tuned for every build', () => {
    const r = evaluateRocketDesign(defaultNumbers)
    expect(r.outcome).toBe('flight')
  })

  test('each circuit matters', () => {
    expect(evaluateRocketDesign(midWith({ circuits: allBut('power') })).ignitionBlocks).toContain('no-power')
    expect(evaluateRocketDesign(midWith({ circuits: allBut('igniter') })).ignitionBlocks).toContain('no-igniter')

    const noEject = evaluateRocketDesign(midWith({ circuits: allBut('eject') }))
    expect(noEject.chute).toBe('no-charge')
    expect(noEject.recoveryPassed).toBe(false)

    // Without the altimeter the computer never learns it is falling, so "ON falling" never runs.
    const noAlt = evaluateRocketDesign(midWith({ circuits: allBut('altimeter') }))
    expect(noAlt.sawFalling).toBe(false)
    expect(noAlt.chute).toBe('not-deployed')
    expect(noAlt.recoveryPassed).toBe(false)

    const noRadio = evaluateRocketDesign(midWith({ circuits: allBut('radio') }))
    expect(noRadio.hasTelemetry).toBe(false)
    expect(noRadio.apogeePassed).toBe(true)
  })

  test('assembly mistakes have physical consequences', () => {
    const noFins = evaluateRocketDesign(midWith({ placements: { fins: null } }))
    expect(noFins.tumbled).toBe(true)
    expect(noFins.apogeePassed).toBe(false)

    const noCord = evaluateRocketDesign(midWith({ placements: { shockCord: null } }))
    expect(noCord.chute).toBe('separated')
    expect(noCord.recoveryPassed).toBe(false)

    const swapped = evaluateRocketDesign(midWith({ placements: { motor: 'order-fins', fins: 'order-motor' } }))
    expect(swapped.outcome).toBe('no-ignition')
    expect(swapped.ignitionBlocks).toContain('no-motor')

    const noBay = evaluateRocketDesign(midWith({ placements: { avionics: null } }))
    expect(noBay.ignitionBlocks).toContain('no-avionics')
  })

  test('too much throttle on a cardboard tube tears it apart at its rated speed', () => {
    const r = evaluateRocketDesign(teamDesign({ parts: CHEAP_PARTS, settings: { throttle: 100, burn_time: 4 } }))
    expect(r.outcome).toBe('breakup')
    expect(r.breakupSpeedMph).toBeGreaterThanOrEqual(r.maxSafeMph)
    expect(r.breakupSpeedMph).toBeLessThan(r.maxSafeMph + 3)
  })

  test('opening the parachute too low (too fast) rips it', () => {
    const r = evaluateRocketDesign(midWith({ settings: { throttle: 55, burn_time: 3, deploy_altitude: 300 } }))
    expect(r.chute).toBe('torn')
    expect(r.recoveryPassed).toBe(false)
  })

  test('a small parachute lands too fast', () => {
    const r = evaluateRocketDesign(teamDesign({ parts: { ...MID_PARTS, parachute: 'chute-bag' }, settings: { throttle: 55, burn_time: 3, deploy_altitude: 5000 } }))
    expect(r.chute).toBe('open')
    expect(r.landingFps).toBeGreaterThan(REQUIRED.maxLandingFps)
  })

  test('premium parts without sponsors are over budget', () => {
    const r = evaluateRocketDesign(teamDesign({ parts: PREMIUM_PARTS, settings: { throttle: 50, burn_time: 2.5, deploy_altitude: 1000 } }))
    expect(r.apogeePassed).toBe(true)
    expect(r.budgetPassed).toBe(false)
  })

  test('code can change throttle mid-flight', () => {
    const source = [
      'SET throttle = 100',
      'ON launch:',
      '  IGNITE engine',
      '  WAIT 0.5',
      '  SET throttle = 40',
      '  WAIT 3',
      '  CUTOFF engine',
      'END',
      'ON falling:',
      '  DEPLOY parachute',
      'END',
    ].join('\n')
    const r = evaluateRocketDesign(midWith({ source }))
    expect(r.outcome).toBe('flight')
    expect(r.chute).toBe('open')
    expect(r.recoveryPassed).toBe(true)
  })

  test('playback runs to the end with sane frames, and breakups play forward', () => {
    for (const d of [strategyMid, teamDesign({ parts: CHEAP_PARTS, settings: { throttle: 100, burn_time: 4 } }), emptyDesign]) {
      const run = new RocketRun(d)
      let lastBreakup = 0
      while (!run.done) {
        run.step()
        const f = run.frame
        expect(Number.isFinite(f.rocketPos[1])).toBe(true)
        expect(f.rocketPos[1]).toBeGreaterThanOrEqual(0)
        expect(f.breakupProgress).toBeGreaterThanOrEqual(lastBreakup)
        lastBreakup = f.breakupProgress
      }
      expect(run.durationSeconds).toBeGreaterThan(3)
      expect(run.durationSeconds).toBeLessThan(26)
    }
    const run = new RocketRun(strategyMid)
    while (!run.done) run.step()
    expect(run.frame.phase).toBe('landed')
  })
})

describe('RocketScript', () => {
  test('every starting program arrives broken, and its clean version compiles', () => {
    const sources = new Set<string>()
    for (let seed = 1; seed <= 300; seed++) {
      const s = starterProgram(seed)
      const buggy = compile(s.source)
      expect(buggy.ok, `seed ${seed}`).toBe(false)
      expect(buggy.errors.length).toBeGreaterThanOrEqual(2)
      expect(buggy.errors.length).toBeLessThanOrEqual(BUG_COUNT + 2)
      expect(compile(s.clean).ok, `clean seed ${seed}`).toBe(true)
      sources.add(s.source)
    }
    expect(sources.size).toBeGreaterThan(250)
  })

  test('errors say where and what, never what to type', () => {
    const r = compile('SET throtle = 70\nON launch:\n  IGNTIE engine\n  LOG "hi\n')
    expect(r.ok).toBe(false)
    const lines = r.errors.map((e) => e.line)
    expect(lines).toEqual(expect.arrayContaining([1, 2, 3, 4]))
    for (const e of r.errors) expect(e.message.toLowerCase()).not.toMatch(/did you mean|try |should/)
  })

  test('settings are range checked', () => {
    expect(compile('SET throttle = 140').ok).toBe(false)
    expect(compile('SET throttle = 100').ok).toBe(true)
  })
})

describe('Breadboards', () => {
  test('every generated board has a full-board solution and no trivial wires', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const paths = {}
      for (const spec of BOARDS) {
        const b = generateBoard(seed, spec.id)
        const cells = new Set<number>()
        for (const c of b.circuits) {
          const path = b.solution[c.id]!
          expect(wireConnected(b, c.id, path), `seed ${seed} ${c.id}`).toBe(true)
          path.forEach((p) => cells.add(p))
        }
        expect(cells.size).toBe(b.rows * b.cols)
        Object.assign(paths, b.solution)
      }
      const status = boardStatus({ id: 'station:electrical', kind: 'electrical', seed, paths, updatedAt: 0 })
      expect(status.complete).toBe(true)
      expect(status.boardsComplete).toBe(2)
    }
  })
})

describe('Battery leads', () => {
  test('V = I × R: the reference resistors bring both leads into range', () => {
    const el = teamDesign({ parts: MID_PARTS }).find((o) => o.kind === 'electrical') as Parameters<typeof readLines>[0]
    const r = readLines(el)
    expect(r.computer.volts).toBe(5) // 9 V − 0.5 A × 8 Ω
    expect(r.igniter.volts).toBe(4) // 9 V − 2 A × 2.5 Ω
    expect(r.computer.state).toBe('ok')
    expect(r.igniter.state).toBe('ok')
  })

  test('untouched leads carry the full 9 V: the computer shuts off', () => {
    const r = evaluateRocketDesign(midWith({ lines: { computer: null } }))
    expect(r.computerState).toBe('high')
    expect(r.ignitionBlocks).toContain('computer-voltage')
  })

  test('an igniter out of its range never lights the motor', () => {
    const hot = evaluateRocketDesign(midWith({ lines: { igniter: null } }))
    expect(hot.outcome).toBe('no-ignition')
    expect(hot.ignitionBlocks).toContain('igniter-voltage')
    const cold = evaluateRocketDesign(midWith({ lines: { igniter: { cutAt: 0.6, crimps: [1, 1], ohms: 3.5 } } }))
    expect(cold.igniterState).toBe('low')
    expect(cold.outcome).toBe('no-ignition')
  })

  test('a cut lead that is not joined back up carries nothing', () => {
    const r = evaluateRocketDesign(midWith({ lines: { computer: { cutAt: 0.15, crimps: [1, null], ohms: null } } }))
    expect(r.computerVolts).toBe(0)
    expect(r.ignitionBlocks).toContain('computer-voltage')
  })

  test('weak crimps where the wire gets moved shake loose', () => {
    const ign = evaluateRocketDesign(midWith({ lines: { igniter: { cutAt: 0.25, crimps: [0.4, 0.4], ohms: 2.5 } } }))
    expect(ign.ignitionBlocks).toContain('igniter-loose')
    // The computer's lead holds on the pad, then drops out at liftoff: the program stops running mid-flight.
    const fc = evaluateRocketDesign(midWith({ lines: { computer: { cutAt: 0.5, crimps: [0.4, 0.4], ohms: 8 } } }))
    expect(fc.ignitionBlocks).toEqual([])
    expect(fc.computerDropped).toBe(true)
    expect(fc.recoveryPassed).toBe(false)
  })
})

describe('Business', () => {
  test('sponsors accept up to their limit, make a final offer a bit over, and walk away far over', () => {
    const ceiling = sponsorCeiling(9, 'ridgeline')
    expect(Math.abs(ceiling - SPONSOR_BY_ID.ridgeline.ceiling)).toBeLessThanOrEqual(5)
    expect(counterReply(9, 'ridgeline', ceiling)).toEqual({ kind: 'accepted', amount: ceiling })
    expect(counterReply(9, 'ridgeline', ceiling + 5).kind).toBe('final-offer')
    expect(counterReply(9, 'ridgeline', ceiling * 3).kind).toBe('walked-away')
  })

  test('more effort pays more', () => {
    const low = effortScore({ strokes: 2, colorsUsed: 1, stickers: 0, texts: 0, coverage: 0.01, promptWords: 3 })
    const high = effortScore({ strokes: 40, colorsUsed: 6, stickers: 6, texts: 3, coverage: 0.3, promptWords: 20 })
    expect(high).toBeGreaterThan(low)
    expect(high).toBeCloseTo(1, 5)
    expect(payoutFor(50, high)).toBe(75)
    expect(payoutFor(50, 0)).toBe(25)
  })

  test('vibe prompts shape the flyer', () => {
    const f = vibeFlyer('a bold red and black poster with a rocket that says "Fly with Byte Burger"', 'byte-burger')
    expect(f.headline).toBe('Fly with Byte Burger')
    expect(f.motif).toBe('rocket')
    expect(f.palette[0]).toBe('#d33a2c')
  })
})

describe('Role matcher', () => {
  const jobsOf = (a: ReturnType<typeof assignRocketRoles>, id: string) => (Object.keys(a) as (keyof typeof a)[]).filter((r) => a[r].some((t) => t.id === id))

  test('four players with distinct first picks all get them', () => {
    const a = assignRocketRoles([
      { playerId: 'a', playerName: 'A', choices: ['electrical', 'software'] },
      { playerId: 'b', playerName: 'B', choices: ['mechanical', 'business'] },
      { playerId: 'c', playerName: 'C', choices: ['software', 'electrical'] },
      { playerId: 'd', playerName: 'D', choices: ['business', 'mechanical'] },
    ])
    expect(jobsOf(a, 'a')).toEqual(['electrical'])
    expect(jobsOf(a, 'b')).toEqual(['mechanical'])
    expect(jobsOf(a, 'c')).toEqual(['software'])
    expect(jobsOf(a, 'd')).toEqual(['business'])
  })

  test('two players with clashing picks split all four jobs, two each, including the ones they picked', () => {
    const a = assignRocketRoles([
      { playerId: 'a', playerName: 'A', choices: ['software', 'electrical'] },
      { playerId: 'b', playerName: 'B', choices: ['software', 'business'] },
    ])
    expect(Object.values(a).every((p) => p.length === 1)).toBe(true)
    expect(jobsOf(a, 'a')).toHaveLength(2)
    expect(jobsOf(a, 'b')).toHaveLength(2)
    const picked = (id: string, mine: string[]) => jobsOf(a, id).some((r) => mine.includes(r))
    expect(picked('a', ['software', 'electrical']) && picked('b', ['software', 'business'])).toBe(true)
  })

  test('three players: every job is covered and one player takes a second job', () => {
    const a = assignRocketRoles([
      { playerId: 'a', playerName: 'A', choices: ['electrical'] },
      { playerId: 'b', playerName: 'B', choices: ['mechanical'] },
      { playerId: 'c', playerName: 'C', choices: [] },
    ])
    expect(Object.values(a).every((p) => p.length === 1)).toBe(true)
    expect(['a', 'b', 'c'].map((id) => jobsOf(a, id).length).sort()).toEqual([1, 1, 2])
  })
})
