import { DRIVERLESS_GATES, FEATURES, TEST_SET_SIZE } from '../config'
import type { FeatureId, SoftwareObject } from '../types'

/** Small seeded random generator (same seed, same numbers on every device). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const int = (rand: () => number, lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))

// ---------------------------------------------------------------- data rounds

export interface DataRound {
  /** The feature that differs between the two pictures (the right answer). */
  feature: FeatureId
  answer: 'Shape' | 'Color' | 'Stripe' | 'Size'
  /** Picture A is a cone; B is the same picture with one thing changed. */
  aLabel: string
  bLabel: string
  /** Background for both pictures, so only one thing differs. */
  background: 'asphalt' | 'grass'
}

/** The four "what's different?" rounds; order and backgrounds vary per team. */
export function dataRounds(seed: number): DataRound[] {
  const rand = mulberry32(seed ^ 0x51ed)
  const all: DataRound[] = [
    { feature: 'shape', answer: 'Shape', aLabel: 'Cone', bLabel: 'Barrel', background: 'asphalt' },
    { feature: 'color', answer: 'Color', aLabel: 'Cone', bLabel: 'Gray post', background: 'asphalt' },
    { feature: 'stripe', answer: 'Stripe', aLabel: 'Cone', bLabel: 'Party hat', background: 'asphalt' },
    { feature: 'size', answer: 'Size', aLabel: 'Cone', bLabel: 'Toy cone', background: 'asphalt' },
  ]
  return all.map((r) => ({ ...r, background: rand() < 0.5 ? 'asphalt' : 'grass' }))
}

// ---------------------------------------------------------------- the neuron

/** The weights the data actually supports (hidden from students; the algebra leads to them). */
export function trueWeights(seed: number): number[] {
  const rand = mulberry32(seed ^ 0xbeef)
  return FEATURES.map(() => int(rand, 1, 5))
}

/** Score at or above this means "that's a cone" (depends on the team's weights). */
export function coneThreshold(seed: number): number {
  return Math.round(1.6 * trueWeights(seed).reduce((a, b) => a + b, 0))
}

export interface WeightEquation {
  /** Which weight this equation finds (index into FEATURES). */
  unknown: number
  /** Feature values of the example picture, one per feature (0 = feature not present). */
  x: number[]
  /** The score this picture should get. */
  target: number
}

/**
 * One equation per weight. Equation k uses only features 0..k, so every earlier weight is
 * already known: x_k · w_k + (known part) = target.
 */
export function weightEquations(seed: number): WeightEquation[] {
  const rand = mulberry32(seed ^ 0xa1b2)
  const w = trueWeights(seed)
  return FEATURES.map((_, k) => {
    const x = FEATURES.map((__, i) => (i === k ? int(rand, 2, 4) : i < k && rand() < 0.7 ? int(rand, 1, 3) : 0))
    const target = x.reduce((s, xi, i) => s + xi * w[i], 0)
    return { unknown: k, x, target }
  })
}

export function score(weights: number[], x: number[]): number {
  return x.reduce((s, xi, i) => s + xi * (weights[i] ?? 0), 0)
}

export interface TestItem {
  x: number[]
  isCone: boolean
}

/** Pictures the model is checked against: cones with clear features and look-alikes missing some. */
export function testSet(seed: number, size = TEST_SET_SIZE): TestItem[] {
  const rand = mulberry32(seed ^ 0x7e57)
  const w = trueWeights(seed)
  const th = coneThreshold(seed)
  const items: TestItem[] = []
  while (items.length < size) {
    const cone = items.length % 2 === 0
    const x = FEATURES.map(() => int(rand, 0, 3))
    const s = score(w, x)
    // Pictures close to the line on the correct side: the hard cases that test the weights.
    if (cone && s >= th + 1 && s <= th + 6) items.push({ x, isCone: true })
    if (!cone && s <= th - 1 && s >= th - 6) items.push({ x, isCone: false })
  }
  return items
}

/** The weights the model actually runs with (unanswered = 0). */
export function modelWeights(sw: SoftwareObject): number[] {
  return sw.weights.map((w) => (typeof w === 'number' && Number.isFinite(w) ? w : 0))
}

export function trained(sw: SoftwareObject): boolean {
  return sw.roundsDone >= FEATURES.length && sw.weights.every((w) => typeof w === 'number' && Number.isFinite(w))
}

/**
 * Share of test pictures classified correctly. `visibility` (0..1+) scales what the camera sees:
 * in the dark, dim headlights make features read weaker.
 */
export function accuracy(sw: SoftwareObject, visibility = 1): number {
  const w = modelWeights(sw)
  const th = coneThreshold(sw.seed)
  const items = testSet(sw.seed)
  const right = items.filter((it) => score(w, it.x.map((xi) => xi * visibility)) >= th === it.isCone).length
  return right / items.length
}

export interface DriverlessResult {
  gates: number
  missed: number
  /** Things that weren't cones but the car swerved for. */
  phantom: number
  /** Which gates were missed (index 0..gates-1), for the animation. */
  missedGates: number[]
  computerOk: boolean
  modelReady: boolean
}

/**
 * The driverless lap: at each gate the camera sees a cone (and sometimes a look-alike beside the track).
 * A cone the model doesn't recognise gets driven over.
 */
export function driverlessLap(sw: SoftwareObject, computerVolts: number, computerOk: boolean, visibility: number): DriverlessResult {
  const gates = DRIVERLESS_GATES
  const modelReady = trained(sw)
  const rand = mulberry32(sw.seed ^ 0xd21e)
  const w = trueWeights(sw.seed)
  const mw = modelWeights(sw)
  const th = coneThreshold(sw.seed)
  const missedGates: number[] = []
  let phantom = 0
  // A starved computer keeps rebooting; it is blind for part of every reboot.
  const rebootEvery = computerOk || computerVolts >= 4.5 ? Infinity : computerVolts < 3 ? 3 : 6
  for (let g = 0; g < gates; g++) {
    let cone: number[]
    do cone = FEATURES.map(() => int(rand, 0, 3))
    while (score(w, cone) < th + 1 || score(w, cone) > th + 8)
    let decoy: number[]
    do decoy = FEATURES.map(() => int(rand, 0, 3))
    while (score(w, decoy) >= th || score(w, decoy) < th - 6)
    const blind = !modelReady || g % rebootEvery === rebootEvery - 1
    const seen = !blind && score(mw, cone.map((c) => c * visibility)) >= th
    if (!seen) missedGates.push(g)
    if (!blind && score(mw, decoy.map((d) => d * visibility)) >= th) phantom++
  }
  return { gates, missed: missedGates.length, phantom, missedGates, computerOk, modelReady }
}
