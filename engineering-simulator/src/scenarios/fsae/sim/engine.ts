import type { SimRun } from '../../../core/scenario'
import { getElectrical, getMechanical, getSoftware, POWER_PATHS, REQUIRED } from '../config'
import { designCost, designFunds } from '../cost'
import type { FsaeObject, FsaeVariantId, PowerPathId } from '../types'
import { accuracy, driverlessLap, type DriverlessResult } from './autonomy'
import { aeroForces, carParams, MS_TO_MPH, topSpeed, type Aero } from './car'
import { lapProfile, type LapProfile } from './lapsim'
import { readAll, type PowerState } from './power'
import { getTrack, placeName } from './track'

/** Speed the wind tunnel and results report aero forces at: 25 m/s ≈ 56 mph. */
export const REPORT_SPEED_MS = 25

export interface PowerSummary {
  id: PowerPathId
  label: string
  volts: number
  lo: number
  hi: number
  state: PowerState
}

export interface FsaeResult {
  variant: FsaeVariantId
  lapS: number
  topMph: number
  topPlace: string
  slowestMph: number
  slowestPlace: string
  /** Straight-line top speed if the straight were long enough, mph. */
  maxMph: number
  aero: Aero
  downforceN: number
  dragN: number
  massKg: number
  powerKw: number
  motorVolts: number
  motorState: PowerState
  pumpState: PowerState
  jointsWelded: number
  jointsTotal: number
  weldQualityPct: number
  rideHeightMm: number
  power: PowerSummary[]
  powerInRange: number
  driverless: DriverlessResult
  accuracyPct: number
  visibilityPct: number
  cost: number
  funds: number
  lapPass: boolean
  conesPass: boolean
  powerPass: boolean
  fundsPass: boolean
  /** Speed profile for the replay. */
  profile: LapProfile
}

/** How well the cameras see: 1 in daylight; at night it follows the headlights. */
export function visibility(design: FsaeObject[], variant: FsaeVariantId): number {
  if (variant !== 'night') return 1
  const lights = readAll(getElectrical(design)).headlights
  if (lights.state === 'ok') return 1
  if (lights.state === 'low') return 1 - 0.55 * (1 - lights.volts / lights.spec.lo)
  return Math.min(1.12, lights.level)
}

export function evaluate(design: FsaeObject[], variant: FsaeVariantId = 'standard'): FsaeResult {
  const track = getTrack()
  const p = carParams(design)
  const profile = lapProfile(p, track)
  const mech = getMechanical(design)
  const sw = getSoftware(design)
  const readings = readAll(getElectrical(design))
  const power = POWER_PATHS.map((s) => {
    const r = readings[s.id]
    return { id: s.id, label: s.label, volts: r.volts, lo: s.lo, hi: s.hi, state: r.state }
  })
  const vis = visibility(design, variant)
  const computer = readings.computer
  const driverless = driverlessLap(sw, computer.volts, computer.state !== 'low', vis)
  const forces = aeroForces(p.aero, REPORT_SPEED_MS)
  const cost = designCost(design)
  const funds = designFunds(design)
  const powerInRange = power.filter((x) => x.state === 'ok').length
  // Night laps are a little slower: the driver brakes earlier when the track is dark.
  const nightFactor = variant === 'night' ? 1 + 0.06 * Math.max(0, 1 - vis) : 1
  const lapS = Math.round(profile.lapS * nightFactor * 100) / 100

  return {
    variant,
    lapS,
    topMph: profile.topMs * MS_TO_MPH,
    topPlace: placeName(track, profile.topAt),
    slowestMph: profile.slowestMs * MS_TO_MPH,
    slowestPlace: placeName(track, profile.slowestAt),
    maxMph: topSpeed(p) * MS_TO_MPH,
    aero: p.aero,
    downforceN: forces.downforce,
    dragN: forces.drag,
    massKg: p.massKg,
    powerKw: p.powerW / 1000,
    motorVolts: p.motorVolts,
    motorState: p.motorState,
    pumpState: p.pumpState,
    jointsWelded: p.jointsWelded,
    jointsTotal: mech.welds.length,
    weldQualityPct: Math.round(p.stiffness * 100),
    rideHeightMm: mech.rideHeightMm,
    power,
    powerInRange,
    driverless,
    accuracyPct: Math.round(accuracy(sw, vis) * 100),
    visibilityPct: Math.round(vis * 100),
    cost,
    funds,
    lapPass: lapS <= REQUIRED.maxLapS,
    conesPass: driverless.missed <= REQUIRED.maxConesHit,
    powerPass: powerInRange === POWER_PATHS.length,
    fundsPass: cost <= funds,
    profile,
  }
}

export type RunPhase = 'autocross' | 'driverless'

export interface RunFrame {
  phase: RunPhase
  /** Fractional track sample the car is at. */
  pos: number
  speedMph: number
  /** Seconds on the lap clock. */
  clockS: number
  /** Driverless gates passed so far that were missed (cone knocked over). */
  knocked: number[]
  gateIndex: number
}

const AUTOCROSS_SHARE = 0.55
const TOTAL_TICKS = 900
/** Driverless lap speed as a share of the autocross speed. */
const DRIVERLESS_PACE = 0.6

/** The animated test the shell plays: one autocross lap, then the driverless lap. */
export class FsaeRun implements SimRun<FsaeResult> {
  readonly totalTicks = TOTAL_TICKS
  readonly durationSeconds = 18
  private tick = 0
  private readonly r: FsaeResult
  private readonly gateSamples: number[]

  constructor(design: FsaeObject[], variant: FsaeVariantId) {
    this.r = evaluate(design, variant)
    const n = this.r.profile.v.length
    this.gateSamples = Array.from({ length: this.r.driverless.gates }, (_, g) => Math.round(((g + 0.5) * n) / this.r.driverless.gates))
  }

  step(): boolean {
    if (this.tick < this.totalTicks) this.tick++
    return !this.done
  }
  get done() {
    return this.tick >= this.totalTicks
  }
  get progress() {
    return this.tick / this.totalTicks
  }
  get intensity() {
    return 0
  }
  result(): FsaeResult {
    return this.r
  }
  clockLabel(): string {
    return `${this.frame().clockS.toFixed(1)} s`
  }

  get variant(): FsaeVariantId {
    return this.r.variant
  }

  gateSample(g: number): number {
    return this.gateSamples[g]
  }

  frame(): RunFrame {
    const { profile, driverless } = this.r
    const n = profile.v.length
    const p = this.progress
    if (p < AUTOCROSS_SHARE) {
      const t = (p / AUTOCROSS_SHARE) * profile.lapS
      const pos = sampleAtTime(profile, t)
      const i = Math.floor(pos) % n
      return { phase: 'autocross', pos, speedMph: profile.v[i] * MS_TO_MPH, clockS: Math.min(t, this.r.lapS), knocked: [], gateIndex: 0 }
    }
    const f = (p - AUTOCROSS_SHARE) / (1 - AUTOCROSS_SHARE)
    const pos = f * n
    const i = Math.floor(pos) % n
    const passed = this.gateSamples.filter((s) => s <= pos).length
    const lapS = profile.lapS / DRIVERLESS_PACE
    return {
      phase: 'driverless',
      pos,
      speedMph: profile.v[i] * DRIVERLESS_PACE * MS_TO_MPH,
      clockS: f * lapS,
      knocked: driverless.missedGates.filter((g) => g < passed),
      gateIndex: passed,
    }
  }
}

/** Fractional sample index the car reaches at time t on the lap. */
export function sampleAtTime(profile: LapProfile, t: number): number {
  const ts = profile.t
  const n = profile.v.length
  if (t <= 0) return 0
  if (t >= ts[n]) return n - 0.001
  let lo = 0
  let hi = n
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (ts[mid] <= t) lo = mid
    else hi = mid
  }
  return lo + (t - ts[lo]) / (ts[lo + 1] - ts[lo])
}
