import type { SimRun } from '../../../core/scenario'
import { getElectrical, getMechanical, getSoftware, POWER_PATHS, REQUIRED } from '../config'
import { designCost, designFunds } from '../cost'
import type { FsaeObject, FsaeVariantId, PowerPathId } from '../types'
import { driverlessLap, type DriverlessResult } from './autonomy'
import { aeroForces, carParams, MS_TO_MPH, topSpeed, type Aero } from './car'
import { lineProgress } from './harness'
import { lapProfile, type LapProfile } from './lapsim'
import { readAll, type PowerState } from './power'
import { getTrack, placeName } from './track'

/** Speed the wind tunnel and results report aero forces at: 25 m/s ≈ 56 mph. */
export const REPORT_SPEED_MS = 25

export interface PowerSummary {
  id: PowerPathId
  label: string
  /** Voltage on the lap (a loose splice keeps cutting out). */
  volts: number
  lo: number
  hi: number
  state: PowerState
  /** The splice was crimped weakly next to moving parts and shook loose. */
  loose: boolean
  /** The wire was cut and not closed again. */
  open: boolean
  /** Any splice is routed and tied down neatly (an untouched wire counts as tied down). */
  tied: boolean
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
  jointsWelded: number
  jointsTotal: number
  weldQualityPct: number
  rideHeightMm: number
  power: PowerSummary[]
  /** Wires in their rated range on the lap and tied down. */
  powerReady: number
  driverless: DriverlessResult
  cost: number
  funds: number
  lapPass: boolean
  driverlessPass: boolean
  powerPass: boolean
  fundsPass: boolean
  /** Speed profile for the replay. */
  profile: LapProfile
}

export function evaluate(design: FsaeObject[], variant: FsaeVariantId = 'standard'): FsaeResult {
  const track = getTrack()
  const p = carParams(design)
  const profile = lapProfile(p, track)
  const mech = getMechanical(design)
  const sw = getSoftware(design)
  const elec = getElectrical(design)
  const readings = readAll(elec, true)
  const power = POWER_PATHS.map((s) => {
    const r = readings[s.id]
    const line = elec.lines[s.id]
    const tied = line.cutAt === null || lineProgress(elec, s.id).routed
    return { id: s.id, label: s.label, volts: r.volts, lo: s.lo, hi: s.hi, state: r.state, loose: r.loose, open: r.open, tied }
  })
  const driverless = driverlessLap(sw, p, elec, variant === 'night')
  const forces = aeroForces(p.aero, REPORT_SPEED_MS)
  const cost = designCost(design)
  const funds = designFunds(design)
  const powerReady = power.filter((x) => x.state === 'ok' && x.tied).length
  const lapS = Math.round(profile.lapS * 100) / 100

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
    jointsWelded: p.jointsWelded,
    jointsTotal: mech.welds.length,
    weldQualityPct: Math.round(p.stiffness * 100),
    rideHeightMm: mech.rideHeightMm,
    power,
    powerReady,
    driverless,
    cost,
    funds,
    lapPass: lapS <= REQUIRED.maxLapS,
    driverlessPass: driverless.finished && driverless.conesHit <= REQUIRED.maxConesHit && driverless.lapS <= REQUIRED.maxDriverlessS,
    powerPass: powerReady === POWER_PATHS.length,
    fundsPass: cost <= funds,
    profile,
  }
}

export type RunPhase = 'autocross' | 'driverless'

export interface RunFrame {
  phase: RunPhase
  /** Fractional track sample the car is at. */
  pos: number
  /** Sideways offset from the middle of the course, m (+ = left). */
  off: number
  speedMph: number
  /** Seconds on the lap clock. */
  clockS: number
  /** Cones knocked over so far (indices into the track's cones). */
  knocked: number[]
}

const AUTOCROSS_SHARE = 0.5
const TOTAL_TICKS = 1000

/** The animated test the shell plays: one autocross lap, then the driverless lap on the team's racing line. */
export class FsaeRun implements SimRun<FsaeResult> {
  readonly totalTicks = TOTAL_TICKS
  readonly durationSeconds = 22
  private tick = 0
  private readonly r: FsaeResult

  constructor(design: FsaeObject[], variant: FsaeVariantId) {
    this.r = evaluate(design, variant)
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

  frame(): RunFrame {
    const { profile, driverless: d } = this.r
    const n = profile.v.length
    const p = this.progress
    if (p < AUTOCROSS_SHARE) {
      const t = (p / AUTOCROSS_SHARE) * profile.lapS
      const pos = sampleAtTime(profile, t)
      const i = Math.floor(pos) % n
      return { phase: 'autocross', pos, off: 0, speedMph: profile.v[i] * MS_TO_MPH, clockS: Math.min(t, this.r.lapS), knocked: [] }
    }
    const f = (p - AUTOCROSS_SHARE) / (1 - AUTOCROSS_SHARE)
    if (!d.finished) return { phase: 'driverless', pos: 0, off: d.off[0] ?? 0, speedMph: 0, clockS: 0, knocked: [] }
    const t = f * d.lapS
    const pos = sampleAtTime({ t: d.t, v: d.v }, t)
    const i = Math.floor(pos) % n
    const cones = getTrack().cones
    const knocked = d.hitCones.filter((c) => cones[c].i <= pos)
    const j = (i + 1) % n
    const off = d.off[i] + (d.off[j] - d.off[i]) * (pos - Math.floor(pos))
    return { phase: 'driverless', pos, off, speedMph: d.v[i] * MS_TO_MPH, clockS: Math.min(t, d.lapS), knocked }
  }
}

/** Fractional sample index the car reaches at time t on the lap. */
export function sampleAtTime(profile: Pick<LapProfile, 't' | 'v'>, t: number): number {
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
