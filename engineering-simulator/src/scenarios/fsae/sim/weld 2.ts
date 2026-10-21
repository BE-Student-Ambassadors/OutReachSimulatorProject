/**
 * Welding one frame joint, step by step: line the tubes up in the fixture, clamp them, run
 * the bead, sand it down. Pure TypeScript so the scoring can be tested headlessly.
 *
 * Bench units: the tube radius is 1 (a 1-inch tube, so 1 unit = 12.7 mm). x runs along the
 * tubes with the seam at x = 0, y is up, z faces the welder. The seam the welder sees runs
 * from y = -1 (bottom) to y = 1 (top).
 */
import { mulberry32 } from './autonomy'

export const MM_PER_UNIT = 12.7
export const TUBE_LEN = 5.5
export const SEAM_CELLS = 32
const CELL = 2 / SEAM_CELLS
export const cellY = (i: number) => -1 + (i + 0.5) * CELL

/** Heat spreads this far along the seam from the arc (units). */
const ARC_SPREAD = 0.09
/** Normalizes heat so a steady 0.3 units/s pass (about 7 s for the whole seam) gives heat 1. */
const HEAT_NORM = (ARC_SPREAD * Math.sqrt(Math.PI)) / 0.3
/** Heat at a spot: below `gap` it never fused, below `cold` it fused poorly, above `burn` it burned through. */
export const HEAT = { gap: 0.15, cold: 0.55, hot: 1.9, burn: 2.8 } as const

// ---------------------------------------------------------------- fixture

export interface Fixture {
  /** Space between the tube ends, mm. */
  gapMm: number
  /** Height mismatch of the loose tube, mm (+ = higher). */
  offsetMm: number
  /** Clamp position along each tube (x, units), null = no clamp. [fixed tube (x < 0), loose tube (x > 0)]. */
  clamps: [number | null, number | null]
  /** Where the loose tube sags to when nothing holds it in line, mm. */
  sagMm: number
  /** Shop items helping hold the joint right now. */
  angle: boolean
  spacer: ShopItemId | null
  taped: boolean
  /** Shop items tried during this fit-up; once clamped, the ones that were holding the joint. */
  used: ShopItemId[]
  /** Little deterministic random stream (how the tube slides and sags). */
  rng: number
}

/**
 * The shop shelf: ordinary things lying around, none of them made for lining up a joint.
 * Blurbs say what each thing is, never what to do with it.
 */
export type ShopItemId = 'angle' | 'drill' | 'coin' | 'wire' | 'pencil' | 'tape' | 'hammer'
export const SHOP: { id: ShopItemId; name: string; blurb: string; thickMm?: number }[] = [
  { id: 'angle', name: 'Angle iron offcut', blurb: 'A scrap of steel angle: two flat legs at a right angle.' },
  { id: 'drill', name: 'Drill bit', blurb: 'A 1/16 in bit for drilling holes. 1.6 mm thick.', thickMm: 1.6 },
  { id: 'coin', name: 'Quarter', blurb: 'Pocket change. 1.75 mm thick.', thickMm: 1.75 },
  { id: 'wire', name: 'Welding wire', blurb: 'A coil of the wire the welder feeds. 0.9 mm thick.', thickMm: 0.9 },
  { id: 'pencil', name: 'Pencil', blurb: 'For marking cut lines. 7 mm thick.', thickMm: 7 },
  { id: 'tape', name: 'Duct tape', blurb: 'Very sticky, a little stretchy.' },
  { id: 'hammer', name: 'Hammer', blurb: 'For hitting things.' },
]
export const SHOP_BY_ID = Object.fromEntries(SHOP.map((s) => [s.id, s])) as Record<ShopItemId, (typeof SHOP)[number]>

const roll = (f: Fixture): [number, number] => {
  const rng = (f.rng * 1103515245 + 12345) % 2147483648
  return [rng / 2147483648, rng]
}

/** The loose tube starts sagged out of line with a wide gap; how far varies per joint. */
export function startFixture(seed: number): Fixture {
  const rand = mulberry32(seed * 7919 + 13)
  const sag = (rand() < 0.5 ? -1 : 1) * (2.5 + rand() * 1.5)
  return { gapMm: 5 + rand() * 4, offsetMm: sag, clamps: [null, null], sagMm: sag, angle: false, spacer: null, taped: false, used: [], rng: Math.floor(rand() * 1e9) }
}

const spacerMm = (f: Fixture) => (f.spacer ? SHOP_BY_ID[f.spacer].thickMm! : 0)
const used = (f: Fixture, id: ShopItemId) => (f.used.includes(id) ? f.used : [...f.used, id])

/** Pushing the loose tube by hand. Whatever is in the way still is: angle iron, a spacer. Tape tears. */
export function moveLoose(f: Fixture, gapMm: number, offsetMm: number): Fixture {
  return {
    ...f,
    taped: false,
    gapMm: Math.max(spacerMm(f), Math.min(14, gapMm)),
    offsetMm: f.angle ? 0 : Math.max(-8, Math.min(8, offsetMm)),
  }
}

/** Letting go: nothing holding it, the round tube slides back and sags out of line. */
export function letGo(f: Fixture): { f: Fixture; note: string } {
  const [r1, s1] = roll(f)
  const [r2, s2] = roll({ ...f, rng: s1 })
  let { gapMm, offsetMm } = f
  const notes: string[] = []
  const pinned = f.spacer !== null && gapMm <= spacerMm(f) + 0.25
  if (pinned) gapMm = spacerMm(f)
  else if (!f.taped) {
    const slid = 0.4 + r1 * 1.4
    gapMm = Math.min(14, gapMm + slid)
    notes.push(`slid ${slid.toFixed(1)} mm apart`)
  }
  if (f.angle) offsetMm = 0
  else if (!f.taped) {
    const next = offsetMm + (f.sagMm - offsetMm) * 0.75 + (r2 - 0.5) * 0.4
    if (Math.abs(next - offsetMm) > 0.2) notes.push(`sagged ${Math.abs(next - offsetMm).toFixed(1)} mm out of line`)
    offsetMm = next
  }
  const note = notes.length ? `You let go: the loose tube ${notes.join(' and ')}.` : 'You let go: the loose tube stayed put.'
  return { f: { ...f, gapMm, offsetMm, rng: s2 }, note }
}

/** Trying one of the shop items on the joint (or taking it back off). */
export function tryItem(f: Fixture, id: ShopItemId): { f: Fixture; note: string } {
  const item = SHOP_BY_ID[id]
  switch (id) {
    case 'angle':
      if (f.angle) return letGo({ ...f, angle: false })
      return { f: { ...f, angle: true, offsetMm: 0, used: used(f, id) }, note: 'The angle iron is under the joint. Both tubes rest in its corner.' }
    case 'tape':
      if (f.taped) return letGo({ ...f, taped: false })
      return { f: { ...f, taped: true, used: used(f, id) }, note: 'The joint is wrapped in duct tape.' }
    case 'hammer': {
      const [r, rng] = roll(f)
      const moved = Math.min(f.gapMm - spacerMm(f), 0.8 + r * 0.8)
      const offsetMm = f.angle ? 0 : f.offsetMm + (r - 0.5) * 1.2
      return {
        f: { ...f, gapMm: f.gapMm - moved, offsetMm, rng, used: used(f, id) },
        note: moved > 0.05 ? `Tap: the loose tube moved ${moved.toFixed(1)} mm closer.` : 'Tap: the loose tube didn’t move.',
      }
    }
    default: {
      if (f.spacer === id) return letGo({ ...f, spacer: null })
      const mm = item.thickMm!
      return {
        f: { ...f, spacer: id, gapMm: Math.max(f.gapMm, mm), used: used(f, id) },
        note: `The ${item.name.toLowerCase()} is standing in the gap between the tube ends.`,
      }
    }
  }
}

/** Clamps on: they hold the tubes now, so the spacer and tape come out. The angle iron stays under. */
export const clampUp = (f: Fixture): Fixture => ({
  ...f,
  spacer: null,
  taped: false,
  used: [...(f.angle ? (['angle'] as const) : []), ...(f.spacer ? [f.spacer] : []), ...(f.taped ? (['tape'] as const) : [])],
})

/** Closer than this to the seam, a clamp's pad shades the top of the seam from the torch. */
const CLAMP_BLOCKS = 0.9
/** Farther than this (or no clamp), the tube pulls out of line as the weld cools. */
const CLAMP_HOLDS = 3.4
/** The top of the seam a too-close clamp covers. */
const BLOCKED_ABOVE = 0.55

export const clampBlocks = (f: Fixture) => f.clamps.some((c) => c !== null && Math.abs(c) < CLAMP_BLOCKS)
const blocked = (f: Fixture, y: number) => y > BLOCKED_ABOVE && clampBlocks(f)

/** How far (mm) the tubes pull out of line while welding, from loose or missing clamps. */
export function shiftMm(f: Fixture): number {
  const loose = (c: number | null) => c === null || Math.abs(c) > CLAMP_HOLDS
  return (loose(f.clamps[0]) ? 0.8 : 0) + (loose(f.clamps[1]) ? 1.6 : 0)
}

// ---------------------------------------------------------------- the bead
//
// A good bead goes down in one smooth, continuous stroke from one end of the seam to the
// other. Stopping and restarting, or moving back over metal that's already welded, spits
// out extra metal: spatter on the tube and lumps piled on the bead.

export interface Bead {
  /** Heat each spot along the seam received. */
  heat: number[]
  /** Extra metal piled on each spot by going back over it, mm-ish (0 = clean). */
  lumps: number[]
  /** Which pass last laid metal on each spot (-1 = none). */
  pass: number[]
  /** Heat each spot already had from earlier passes when the current pass reached it. */
  prior: number[]
  /** Separate strokes: each time the arc struck the seam again after going out. */
  strokes: number
  /** Times the torch turned around and went back along the seam. */
  backtracks: number
  hitClamp: boolean
  /** Arc marks where the arc wandered off the seam onto the tube. */
  stray: { x: number; y: number }[]
  /** Balls of metal spat onto the tube by going back over the weld. */
  spatter: { x: number; y: number }[]
  arcSeconds: number
  /** Current pass: changes on every new stroke and every turn-around. */
  passId: number
  /** True while the current stroke has laid metal (a new strike counts as a new stroke). */
  laying: boolean
  // Torch motion tracker.
  lastY: number | null
  dir: number
  ext: number
  /** Little deterministic random stream for where spatter lands. */
  rng: number
}

export const newBead = (): Bead => ({
  heat: Array.from({ length: SEAM_CELLS }, () => 0),
  lumps: Array.from({ length: SEAM_CELLS }, () => 0),
  pass: Array.from({ length: SEAM_CELLS }, () => -1),
  prior: Array.from({ length: SEAM_CELLS }, () => 0),
  strokes: 0,
  backtracks: 0,
  hitClamp: false,
  stray: [],
  spatter: [],
  arcSeconds: 0,
  passId: 0,
  laying: false,
  lastY: null,
  dir: 0,
  ext: 0,
  rng: 12345,
})

const rand = (b: Bead) => {
  b.rng = (b.rng * 1103515245 + 12345) % 2147483648
  return b.rng / 2147483648
}

/** The arc only strikes on the tubes. */
export const onMetal = (x: number, y: number) => Math.abs(y) <= 1 && Math.abs(x) <= TUBE_LEN

/** Lumps above this make a spot "piled up". */
export const LUMPY = 0.35

/** The arc burning at (x, y) for `dt` seconds. */
export function arcHeat(b: Bead, f: Fixture, x: number, y: number, dt: number) {
  if (!onMetal(x, y)) return
  dt = Math.min(dt, 1 / 30)
  b.arcSeconds += dt
  const ax = Math.abs(x)
  const lateral = ax <= 0.15 ? 1 : Math.max(0, 1 - (ax - 0.15) / 0.3)
  if (lateral === 0) {
    const last = b.stray[b.stray.length - 1]
    if (b.stray.length < 80 && (!last || Math.hypot(last.x - x, last.y - y) > 0.08)) b.stray.push({ x, y })
    return
  }
  if (blocked(f, y)) {
    b.hitClamp = true
    return
  }
  if (!b.laying) {
    b.laying = true
    b.strokes++
  }
  let overlap = 0
  for (let i = 0; i < SEAM_CELLS; i++) {
    if (blocked(f, cellY(i))) continue
    const w = Math.exp(-(((y - cellY(i)) / ARC_SPREAD) ** 2))
    if (w <= 0.01) continue
    if (w > 0.5 && b.pass[i] !== b.passId) {
      b.prior[i] = b.heat[i]
      b.pass[i] = b.passId
    }
    // Going back over metal an earlier pass already laid: it piles up and spits.
    if (w > 0.5 && b.prior[i] >= HEAT.cold) {
      b.lumps[i] += dt * w * 2
      overlap = Math.max(overlap, w)
    }
    b.heat[i] += (dt * w * lateral) / HEAT_NORM
  }
  // Spatter: a few balls of metal thrown onto the tube around the arc each frame it piles up.
  if (overlap > 0 && b.spatter.length < 160 && rand(b) < dt * 14) {
    const r = 0.15 + rand(b) * 0.55
    const a = rand(b) * Math.PI * 2
    b.spatter.push({ x: x + Math.cos(a) * r, y: Math.max(-0.99, Math.min(0.99, y + Math.sin(a) * r * 0.5)) })
  }
}

/** Movement against the stroke smaller than this is hand jitter, not a turn-around. */
const JITTER = 0.04

/** Follows the torch along the seam and notices when it turns around. */
export function trackTorch(b: Bead, y: number) {
  if (b.lastY === null) {
    b.lastY = b.ext = y
    b.dir = 0
    return
  }
  b.lastY = y
  if (b.dir === 0) {
    if (Math.abs(y - b.ext) > JITTER) {
      b.dir = Math.sign(y - b.ext)
      b.ext = y
    }
    return
  }
  if ((y - b.ext) * b.dir > 0) {
    b.ext = y
    return
  }
  if (Math.abs(y - b.ext) > JITTER) {
    // Turned around: from here on the torch is going back over its own bead.
    if (b.laying) b.backtracks++
    b.passId++
    b.ext = y
    b.dir = -b.dir
  }
}

/** The arc went out (button released): the next strike starts a new stroke. */
export const liftTorch = (b: Bead) => {
  b.lastY = null
  if (b.laying) b.passId++
  b.laying = false
}

export type SpotKind = 'gap' | 'cold' | 'good' | 'hot' | 'burned'
export const spotKind = (heat: number): SpotKind =>
  heat < HEAT.gap ? 'gap' : heat < HEAT.cold ? 'cold' : heat <= HEAT.hot ? 'good' : heat <= HEAT.burn ? 'hot' : 'burned'

// ---------------------------------------------------------------- sanding

export const GRITS = [
  { grit: 24, name: 'Very coarse', rate: 0.3, scratches: true },
  { grit: 60, name: 'Coarse', rate: 0.12, scratches: false },
  { grit: 120, name: 'Medium', rate: 0.04, scratches: false },
  { grit: 320, name: 'Fine', rate: 0.007, scratches: false },
] as const
export type Grit = (typeof GRITS)[number]['grit']
/** Frame tube wall thickness, mm: sanding can't cut deeper than through it. */
export const WALL_MM = 1.6

export interface Finish {
  /** Bead height above the tube at each spot, mm. */
  height: number[]
  /** How deep sanding cut into the tube wall at each spot, mm. */
  dig: number[]
  /** Total metal removed at each spot, mm (shows where the tube was sanded bright). */
  worn: number[]
  scratched: boolean
}

export const beadHeightMm = (heat: number, lumps = 0) => (heat < HEAT.gap ? 0 : 0.5 + 0.45 * Math.min(heat, 3) + 0.9 * Math.min(lumps, 2))

export const startFinish = (b: Bead): Finish => ({
  height: b.heat.map((h, i) => beadHeightMm(h, b.lumps[i])),
  dig: b.heat.map(() => 0),
  worn: b.heat.map(() => 0),
  scratched: false,
})

/** One scrub of the sanding disc at (x, y) over `dist` units. Returns the metal removed (mm). */
export function sand(f: Finish, grit: Grit, x: number, y: number, dist: number): number {
  if (Math.abs(x) > 0.8 || Math.abs(y) > 1.1 || dist <= 0) return 0
  const g = GRITS.find((s) => s.grit === grit)!
  if (g.scratches) f.scratched = true
  let removed = 0
  for (let i = 0; i < SEAM_CELLS; i++) {
    const w = Math.exp(-(((y - cellY(i)) / 0.22) ** 2))
    if (w < 0.02) continue
    let cut = g.rate * dist * w
    const take = Math.min(f.height[i], cut)
    f.height[i] -= take
    cut -= take
    // Past flush, the disc is cutting the tube itself.
    if (cut > 0) f.dig[i] = Math.min(WALL_MM, f.dig[i] + cut * 0.7)
    f.worn[i] += take + cut
    removed += take + cut
  }
  return removed
}

// ---------------------------------------------------------------- scoring

export interface WeldReport {
  /** 0..1, the joint's strength (what the frame's stiffness uses). */
  quality: number
  label: string
  /** Share of the seam that fused (0..1). */
  covered: number
  gaps: number
  cold: number
  hot: number
  burned: number
  /** Separate strokes the bead was laid in. */
  strokes: number
  backtracks: number
  /** Spots where metal piled up from going back over the weld. */
  piled: number
  /** 0..1: 1 = one continuous stroke with no going back. */
  smooth: number
  gapMm: number
  /** Total height mismatch after welding, mm. */
  offsetMm: number
  shiftedMm: number
  hitClamp: boolean
  stray: number
  spatter: number
  /** Average bead height left above the tube, mm. */
  highMm: number
  /** Deepest cut into the tube wall, mm. */
  digMm: number
  scratched: boolean
  /** Shop items used to hold the fit-up. */
  heldWith: ShopItemId[]
  /** Craftsmanship: how the bead looks, judged apart from its strength. */
  looks: 'neat' | 'uneven' | 'messy'
}

const SPOT_STRENGTH: Record<SpotKind, number> = { gap: 0, cold: 0.5, good: 1, hot: 0.85, burned: 0.4 }
/** A piled-up spot is metal lying on top of metal, not fused into it. */
const PILED_STRENGTH = 0.75

export function scoreWeld(fx: Fixture, b: Bead, f: Finish): WeldReport {
  const kinds = b.heat.map(spotKind)
  const n = (k: SpotKind) => kinds.filter((x) => x === k).length
  const piledAt = (i: number) => kinds[i] !== 'gap' && b.lumps[i] > LUMPY
  const fusion = kinds.reduce((s, k, i) => s + SPOT_STRENGTH[k] * (piledAt(i) ? PILED_STRENGTH : 1), 0) / SEAM_CELLS
  const covered = (SEAM_CELLS - n('gap')) / SEAM_CELLS
  const piled = kinds.filter((_, i) => piledAt(i)).length
  // Every stop-and-restart and every turn-around leaves a weak tie-in in the bead.
  const smooth = covered === 0 ? 0 : Math.max(0, 1 - 0.25 * Math.max(0, b.strokes - 1) - 0.08 * b.backtracks)
  const steady = 0.6 + 0.4 * smooth

  const shifted = b.arcSeconds > 0 ? shiftMm(fx) : 0
  const offset = Math.abs(fx.offsetMm) + shifted
  const fit = (offset <= 0.5 ? 1 : Math.max(0.6, 1 - (offset - 0.5) * 0.1)) * (fx.gapMm <= 2 ? 1 : Math.max(0.6, 1 - (fx.gapMm - 2) * 0.06))

  const weldedIdx = kinds.flatMap((k, i) => (k === 'gap' ? [] : [i]))
  const highMm = weldedIdx.length ? weldedIdx.reduce((s, i) => s + f.height[i], 0) / weldedIdx.length : 0
  const digMm = Math.max(0, ...f.dig)
  const cutDown = digMm >= WALL_MM ? 0.4 : digMm > 0.25 ? Math.max(0.65, 1 - (digMm - 0.25) * 0.5) : 1
  const finish = (highMm > 0.5 ? 0.93 : 1) * cutDown * (f.scratched ? 0.9 : 1)

  // How it looks: an even width all along, no lumps, nothing spat on the tube.
  const laid = weldedIdx.map((i) => b.heat[i])
  const mean = laid.length ? laid.reduce((a, h) => a + h, 0) / laid.length : 0
  const spread = mean ? Math.sqrt(laid.reduce((a, h) => a + (h - mean) ** 2, 0) / laid.length) / mean : 1
  const marks = b.spatter.length + b.stray.length
  const looks: WeldReport['looks'] =
    n('gap') === 0 && piled === 0 && marks <= 2 && spread < 0.25 ? 'neat' : piled <= 4 && marks <= 12 && spread < 0.5 ? 'uneven' : 'messy'

  const quality = Math.round(Math.max(0, Math.min(1, fusion * steady * fit * finish)) * 100) / 100
  return {
    quality,
    label: quality >= 0.95 ? 'Solid weld' : quality >= 0.75 ? 'Decent weld' : quality >= 0.5 ? 'Weak weld' : 'Poor weld',
    covered,
    gaps: n('gap'),
    cold: n('cold'),
    hot: n('hot'),
    burned: n('burned'),
    strokes: b.strokes,
    backtracks: b.backtracks,
    piled,
    smooth,
    gapMm: fx.gapMm,
    offsetMm: offset,
    shiftedMm: shifted,
    hitClamp: b.hitClamp,
    stray: b.stray.length,
    spatter: b.spatter.length,
    highMm,
    digMm,
    scratched: f.scratched,
    heldWith: fx.used.filter((id) => id !== 'hammer' && id !== 'pencil'),
    looks,
  }
}

const spots = (k: number) => (k === 1 ? '1 spot' : `${k} spots`)
const mm = (v: number) => `${v.toFixed(1)} mm`

export const LOOKS_TEXT: Record<WeldReport['looks'], string> = {
  neat: 'Neat: one even bead, the same width all the way, clean tube around it.',
  uneven: 'Uneven: the bead’s width wanders and there are a few marks around it.',
  messy: 'Messy: lumps, gaps or spatter along the joint.',
}

/** What happened to the joint, as facts (never what to change). */
export function weldFacts(r: WeldReport): string[] {
  const out: string[] = [`The bead covered ${Math.round(r.covered * 100)}% of the seam.`]
  if (r.gaps) out.push(`${spots(r.gaps)} along the seam never fused.`)
  if (r.cold) out.push(`${spots(r.cold)} ran cold: the metal didn’t fully melt together.`)
  if (r.hot) out.push(`${spots(r.hot)} ran hot.`)
  if (r.burned) out.push(`${spots(r.burned)} burned through the tube wall.`)
  if (r.strokes <= 1 && r.backtracks === 0) out.push('The bead went down in one continuous stroke.')
  else {
    if (r.strokes > 1) out.push(`The bead was laid in ${r.strokes} separate strokes, each with a stop and restart.`)
    if (r.backtracks) out.push(`The torch turned around and went back over the bead ${r.backtracks === 1 ? 'once' : `${r.backtracks} times`}.`)
  }
  if (r.piled) out.push(`Extra metal piled up in ${spots(r.piled)} where the torch went back over the weld.`)
  if (r.spatter) out.push(`${r.spatter} balls of spatter stuck to the tube around the weld.`)
  out.push(`The tube ends were ${mm(r.offsetMm)} out of line with a ${mm(r.gapMm)} gap.`)
  const held = r.heldWith.map((id) => `the ${SHOP_BY_ID[id].name.toLowerCase()}`)
  out.push(held.length ? `The fit-up was held with ${held.length > 1 ? `${held.slice(0, -1).join(', ')} and ${held.at(-1)}` : held[0]}.` : 'The fit-up was held by hand.')
  if (r.shiftedMm > 0) out.push(`While the weld cooled, the tubes pulled ${mm(r.shiftedMm)} out of line.`)
  if (r.hitClamp) out.push('The arc hit the clamp at one end of the seam.')
  if (r.stray) out.push(`${r.stray} arc marks on the tube where the arc left the seam.`)
  if (r.highMm > 0.5) out.push(`The bead was left ${mm(r.highMm)} above the tube on average.`)
  else if (r.digMm >= WALL_MM) out.push('Sanding ground all the way through the tube wall.')
  else if (r.digMm > 0.25) out.push(`Sanding cut ${mm(r.digMm)} into the ${mm(WALL_MM)} tube wall.`)
  else out.push('The bead was sanded flush with the tube.')
  if (r.scratched) out.push('The 24 grit disc left deep scratches in the tube.')
  return out
}
