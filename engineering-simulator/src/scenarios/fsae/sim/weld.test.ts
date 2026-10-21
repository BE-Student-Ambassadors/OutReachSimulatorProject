import { describe, expect, test } from 'vitest'
import { arcHeat, clampUp, letGo, liftTorch, moveLoose, newBead, sand, scoreWeld, startFinish, startFixture, trackTorch, tryItem, type Bead, type Fixture, type Grit } from './weld'

const DT = 1 / 60
const lined = (clamps: Fixture['clamps'] = [-1.6, 1.6]): Fixture => ({ ...startFixture(1), gapMm: 1, offsetMm: 0.2, clamps })

/** Move the lit torch along `path(t)` (seam position, -1..1) for `seconds`. */
function stroke(b: Bead, f: Fixture, seconds: number, path: (t: number) => number, x = 0) {
  liftTorch(b)
  for (let t = 0; t <= seconds; t += DT) {
    const y = Math.max(-1, Math.min(1, path(t)))
    trackTorch(b, y)
    arcHeat(b, f, x, y, DT)
  }
  liftTorch(b)
}

/** One straight pass from the top of the seam to the bottom at `speed` units/s, with optional hand wobble. */
function weld(f: Fixture, speed: number, wobble = { amp: 0, hz: 0 }, x = 0): Bead {
  const b = newBead()
  stroke(b, f, 2 / speed, (t) => 1 - speed * t + wobble.amp * Math.sin(2 * Math.PI * wobble.hz * t), x)
  return b
}

/** Light scrubbing sweeps down the seam until it looks flush (giving up after 12), then `extra` more sweeps. */
function sandDown(b: Bead, grit: Grit, extra = 0) {
  const f = startFinish(b)
  const sweep = () => {
    for (let y = 1; y >= -1; y -= 0.02) sand(f, grit, 0, y, 0.1)
  }
  for (let i = 0; i < 12 && Math.max(...f.height) > 0.3; i++) sweep()
  for (let i = 0; i < extra; i++) sweep()
  return f
}

describe('welding a joint', () => {
  test('one smooth stroke (lined up, clamped, right grit) is a solid weld', () => {
    const fx = lined()
    const b = weld(fx, 0.28)
    const r = scoreWeld(fx, b, sandDown(b, 60))
    expect(r.gaps + r.cold + r.burned + r.piled).toBe(0)
    expect(r.strokes).toBe(1)
    expect(r.backtracks).toBe(0)
    expect(r.highMm).toBeLessThan(0.5)
    expect(r.quality).toBeGreaterThanOrEqual(0.95)
  })

  test('bottom to top works just as well', () => {
    const fx = lined()
    const b = newBead()
    stroke(b, fx, 2 / 0.28, (t) => -1 + 0.28 * t)
    expect(scoreWeld(fx, b, sandDown(b, 60)).quality).toBeGreaterThanOrEqual(0.95)
  })

  test('a little hand shake along the stroke is fine', () => {
    const fx = lined()
    const b = weld(fx, 0.28, { amp: 0.004, hz: 7 })
    const r = scoreWeld(fx, b, sandDown(b, 60))
    expect(r.backtracks).toBe(0)
    expect(r.quality).toBeGreaterThanOrEqual(0.95)
  })

  test('wiggling up and down goes back over the bead: it piles up, spits and is weaker', () => {
    const fx = lined()
    const b = weld(fx, 0.28, { amp: 0.09, hz: 3 })
    const r = scoreWeld(fx, b, sandDown(b, 60))
    expect(r.backtracks).toBeGreaterThan(10)
    expect(r.piled).toBeGreaterThan(5)
    expect(r.spatter).toBeGreaterThan(5)
    expect(r.quality).toBeLessThan(0.75)
  })

  test('stopping and restarting halfway is weaker than one stroke', () => {
    const fx = lined()
    const b = newBead()
    stroke(b, fx, 1 / 0.28, (t) => 1 - 0.28 * t)
    stroke(b, fx, 1 / 0.28, (t) => 0 - 0.28 * t)
    const r = scoreWeld(fx, b, sandDown(b, 60))
    expect(r.strokes).toBe(2)
    expect(r.quality).toBeLessThan(0.95)
    expect(r.quality).toBeGreaterThan(0.75)
  })

  test('a second full pass over the bead piles metal everywhere', () => {
    const fx = lined()
    const b = weld(fx, 0.5)
    stroke(b, fx, 2 / 0.5, (t) => 1 - 0.5 * t)
    const r = scoreWeld(fx, b, startFinish(b))
    expect(r.piled).toBeGreaterThan(20)
    expect(r.spatter).toBeGreaterThan(10)
  })

  test('one fast swipe leaves cold spots and gaps', () => {
    const fx = lined()
    const b = weld(fx, 1.6)
    const r = scoreWeld(fx, b, sandDown(b, 60))
    expect(r.cold + r.gaps).toBeGreaterThan(20)
    expect(r.quality).toBeLessThan(0.6)
  })

  test('crawling too slowly burns through', () => {
    const fx = lined()
    const b = weld(fx, 0.09)
    const r = scoreWeld(fx, b, sandDown(b, 60))
    expect(r.burned).toBeGreaterThan(20)
    expect(r.quality).toBeLessThan(0.6)
  })

  test('working off the seam leaves arc marks and no fusion', () => {
    const fx = lined()
    const b = weld(fx, 0.28, { amp: 0, hz: 0 }, 0.8)
    const r = scoreWeld(fx, b, startFinish(b))
    expect(r.stray).toBeGreaterThan(5)
    expect(r.covered).toBe(0)
  })

  test('tubes left out of line make a weaker joint', () => {
    const good = lined()
    const off: Fixture = { ...lined(), offsetMm: 4, gapMm: 7 }
    const a = weld(good, 0.28)
    const b = weld(off, 0.28)
    expect(scoreWeld(off, b, sandDown(b, 60)).quality).toBeLessThan(scoreWeld(good, a, sandDown(a, 60)).quality - 0.25)
  })

  test('a clamp on top of the seam blocks the torch there', () => {
    const fx = lined([-0.5, 1.6])
    const b = weld(fx, 0.28)
    const r = scoreWeld(fx, b, sandDown(b, 60))
    expect(r.hitClamp).toBe(true)
    expect(r.gaps).toBeGreaterThan(4)
  })

  test('without clamps the tubes pull out of line', () => {
    const fx = lined([null, null])
    const b = weld(fx, 0.28)
    const r = scoreWeld(fx, b, sandDown(b, 60))
    expect(r.shiftedMm).toBeGreaterThan(2)
    expect(r.quality).toBeLessThan(0.85)
  })

  test('grits: 24 scratches, 320 barely removes, 60 gets it flush', () => {
    const fx = lined()
    const b = weld(fx, 0.28)
    expect(scoreWeld(fx, b, sandDown(b, 24)).scratched).toBe(true)
    expect(scoreWeld(fx, b, sandDown(b, 320)).highMm).toBeGreaterThan(0.8)
    expect(scoreWeld(fx, b, sandDown(b, 60)).highMm).toBeLessThan(0.5)
  })

  test('sanding far past flush cuts into the tube', () => {
    const fx = lined()
    const b = weld(fx, 0.28)
    const r = scoreWeld(fx, b, sandDown(b, 60, 8))
    expect(r.digMm).toBeGreaterThan(0.25)
    expect(r.quality).toBeLessThan(0.95)
  })
})

describe('lining up with whatever is on the shop shelf', () => {
  /** Drag the loose tube by hand to a perfect fit, then let go. */
  const byHand = (f: Fixture) => letGo(moveLoose(f, 1.5, 0)).f

  test('by hand alone, the tube slides apart and sags out of line when let go', () => {
    const f = byHand(startFixture(7))
    expect(Math.abs(f.offsetMm)).toBeGreaterThan(1.5)
    expect(f.gapMm).toBeGreaterThan(1.8)
  })

  test('angle iron as a cradle keeps the tubes in line', () => {
    const f = byHand(tryItem(startFixture(7), 'angle').f)
    expect(f.offsetMm).toBe(0)
  })

  test('a drill bit, a coin or welding wire in the gap sets it', () => {
    for (const id of ['drill', 'coin', 'wire'] as const) {
      const placed = tryItem(startFixture(7), id).f
      const f = letGo(moveLoose(placed, 0, placed.offsetMm)).f
      expect(f.gapMm).toBeLessThanOrEqual(2)
      expect(f.gapMm).toBeGreaterThan(0.5)
    }
  })

  test('a pencil is too thick to make a usable gap', () => {
    const placed = tryItem(startFixture(7), 'pencil').f
    expect(letGo(moveLoose(placed, 0, 0)).f.gapMm).toBe(7)
  })

  test('tape holds wherever the hand put it; moving the tube tears it', () => {
    const lined = moveLoose(startFixture(7), 1.2, 0.1)
    const taped = tryItem(lined, 'tape').f
    const f = letGo(taped).f
    expect(f.gapMm).toBeCloseTo(1.2)
    expect(f.offsetMm).toBeCloseTo(0.1)
    expect(moveLoose(f, 3, 0).taped).toBe(false)
  })

  test('different combinations all reach a solid fit-up', () => {
    const angleAndBit = (() => {
      const a = tryItem(tryItem(startFixture(3), 'angle').f, 'drill').f
      return letGo(moveLoose(a, 0, 0)).f
    })()
    const tapeOnly = letGo(tryItem(moveLoose(startFixture(3), 1.5, 0), 'tape').f).f
    const angleAndHammer = (() => {
      let f = tryItem(startFixture(3), 'angle').f
      for (let i = 0; i < 8 && f.gapMm > 2; i++) f = tryItem(f, 'hammer').f
      return letGo(tryItem(f, 'tape').f).f
    })()
    for (const f of [angleAndBit, tapeOnly, angleAndHammer]) {
      const b = weld({ ...f, clamps: [-1.6, 1.6] }, 0.28)
      expect(scoreWeld({ ...f, clamps: [-1.6, 1.6] }, b, sandDown(b, 60)).quality).toBeGreaterThanOrEqual(0.95)
    }
  })

  test('craftsmanship is judged apart from strength', () => {
    const fx = lined()
    const clean = weld(fx, 0.28)
    expect(scoreWeld(fx, clean, sandDown(clean, 60)).looks).toBe('neat')
    const wiggly = weld(fx, 0.28, { amp: 0.09, hz: 3 })
    expect(scoreWeld(fx, wiggly, sandDown(wiggly, 60)).looks).toBe('messy')
  })

  test('the report credits only what was holding the joint when the clamps went on', () => {
    let f = startFixture(5)
    f = tryItem(f, 'pencil').f
    f = tryItem(f, 'pencil').f
    f = tryItem(tryItem(f, 'angle').f, 'coin').f
    f = clampUp({ ...f, clamps: [-1.6, 1.6] })
    const b = weld(f, 0.28)
    expect(scoreWeld(f, b, sandDown(b, 60)).heldWith).toEqual(['angle', 'coin'])
  })
})
