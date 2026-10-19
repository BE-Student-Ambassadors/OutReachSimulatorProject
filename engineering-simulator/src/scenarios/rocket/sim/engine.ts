import type { SimRun } from '../../../core/scenario'
import { getBusiness, getElectrical, getMechanical, getSoftware, REQUIRED, VARIANTS } from '../config'
import type { RocketObject, RocketVariantId } from '../types'
import { boardStatus } from './board'
import { totalFunds } from './business'
import { partsSpent, resolveBuild, type Build } from './build'
import { compile, type Instr, type Program, type SettingName, type Value } from './rocketScript'

export type FlightOutcome = 'flight' | 'no-ignition' | 'no-liftoff' | 'breakup'

/** Why the motor never lit. Several can be true at once. */
export type IgnitionBlock =
  | 'no-body'
  | 'no-avionics'
  | 'no-program'
  | 'no-power'
  | 'no-ignite-command'
  | 'no-igniter'
  | 'no-motor'

export type ChuteOutcome = 'not-deployed' | 'open' | 'torn' | 'separated' | 'no-parachute' | 'no-charge'

export interface FlightLogEntry {
  t: number
  text: string
}

export interface RocketResult {
  variantId: RocketVariantId
  outcome: FlightOutcome
  ignitionBlocks: IgnitionBlock[]
  apogeeFt: number
  apogeeErrorFt: number
  apogeePassed: boolean
  peakSpeedMph: number
  maxSafeMph: number
  weakestPart: 'body tube' | 'fins'
  breakupAltFt: number
  breakupSpeedMph: number
  /** No working fins: the rocket cartwheeled. */
  tumbled: boolean
  /** A warped fin spun the rocket as it climbed. */
  corkscrew: boolean
  /** Without a nose cone in its slot, the open tube end pushes a lot of air. */
  noNose: boolean
  burnSeconds: number
  fuelRanOut: boolean
  chute: ChuteOutcome
  deployAltFt: number | null
  deploySpeedMph: number | null
  /** The flight computer knew it was falling (altimeter + power). */
  sawFalling: boolean
  landingFps: number
  recoveryPassed: boolean
  driftFt: number
  flightSeconds: number
  massKg: number
  thrustToWeight: number
  hasTelemetry: boolean
  spent: number
  funds: number
  budgetPassed: boolean
  log: FlightLogEntry[]
  /** Settings when the flight computer started, for the stats table. */
  startSettings: Record<SettingName, number> | null
}

interface Sample {
  t: number
  altM: number
  xM: number
  vM: number
  thrusting: boolean
  /** 0 packed, 0..1 opening/open, -1 torn or gone. */
  chute: number
}

const G = 9.81
const RHO = 1.12
const TUBE_AREA = Math.PI * 0.033 * 0.033
/** Battery, breadboard and flight computer. */
const ELECTRONICS_KG = 0.1
const BODY_CD = 0.12
const OPEN_TUBE_CD = 0.75
const DT = 0.01
const SAMPLE_EVERY = 0.05
const MAX_FLIGHT_S = 320
const CHUTE_INFLATE_S = 0.6

export const M_TO_FT = 3.281
export const MS_TO_MPH = 2.237

/** Debris after a breakup: keeps climbing while air drag bleeds off its speed, then falls. */
export const DEBRIS_DRAG = 1.6
export const DEBRIS_GRAVITY_FPS2 = 120
export const BREAKUP_SECONDS = 4.6

export function debrisRiseFt(climbFps: number, tSec: number): number {
  const coast = (climbFps * (1 - Math.exp(-DEBRIS_DRAG * tSec))) / DEBRIS_DRAG
  return coast - 0.5 * DEBRIS_GRAVITY_FPS2 * tSec * tSec
}

/** Touchdowns this fast smash the rocket to pieces (shown in the 3D scene). */
export const SMASH_FPS = 45

class BlockRunner {
  pc = 0
  waitUntil: number | null = null
  readonly body: Instr[]
  constructor(body: Instr[]) {
    this.body = body
  }
}

interface Flight {
  result: RocketResult
  samples: Sample[]
  apogeeT: number
  endT: number
  breakupT: number | null
  ignitedT: number | null
  build: Build
}

export function simulateFlight(design: RocketObject[], variantId: RocketVariantId = 'standard'): Flight {
  const variant = VARIANTS[variantId] ?? VARIANTS.standard
  const mech = getMechanical(design)
  const build = resolveBuild(mech)
  const circuits = boardStatus(getElectrical(design)).connected
  const software = getSoftware(design)
  const compiled = software?.uploadedSource ? compile(software.uploadedSource) : null
  const program: Program | null = compiled?.ok ? compiled.program : null

  const spent = partsSpent(mech)
  const funds = totalFunds(getBusiness(design))

  const motor = build.motor
  const fins = build.fins
  const chuteSpec = build.parachute
  const computerOn = !!program && circuits.power && build.avionics && !!build.body

  const fuelStartKg = build.motor?.fuelKg ?? 0
  const dryMass = build.massKg + ELECTRONICS_KG - fuelStartKg
  const tumbled = !fins
  const corkscrew = !!fins?.warped
  const noNose = !build.nose
  let cd = BODY_CD + (build.nose?.cd ?? OPEN_TUBE_CD) + (fins?.cd ?? 0)
  if (tumbled) cd *= 4
  if (corkscrew) cd *= 1.3
  const thrustEfficiency = tumbled ? 0.35 : 1

  const bodySafe = build.body?.safeMph ?? 0
  const finSafe = fins?.safeMph ?? Infinity
  const maxSafeMph = Math.min(bodySafe, finSafe)
  const weakestPart: 'body tube' | 'fins' = finSafe < bodySafe ? 'fins' : 'body tube'
  const windMs = variant.windMph / MS_TO_MPH

  const vars: Record<SettingName, number> = program ? { ...program.settings } : { throttle: 100, burn_time: 0, deploy_altitude: 0 }
  const startSettings = program ? { ...program.settings } : null
  const resolve = (v: Value) => (typeof v === 'number' ? v : vars[v])

  const ignitionBlocks: IgnitionBlock[] = []
  const blockIgnition = (b: IgnitionBlock) => {
    if (!ignitionBlocks.includes(b)) ignitionBlocks.push(b)
  }

  let t = 0
  let alt = 0
  let x = 0
  let v = 0
  let fuel = fuelStartKg
  let engineOn = false
  let everIgnited = false
  let ignitedT: number | null = null
  let burn = 0
  let fuelRanOut = false
  let liftoff = false
  let liftoffT = 0
  let apogee = 0
  let apogeeT = 0
  let peakV = 0
  let chute = 'not-deployed' as ChuteOutcome
  let chuteT = 0
  let deployAltFt: number | null = null
  let deploySpeedMph: number | null = null
  let sawFalling = false
  let landed = false
  let landingV = 0
  let breakupT: number | null = null
  let breakupAlt = 0
  let breakupV = 0
  let maxTW = 0
  const log: FlightLogEntry[] = []
  const samples: Sample[] = []
  let nextSample = 0

  const launch = computerOn && program?.blocks.launch ? new BlockRunner(program.blocks.launch) : null
  const fallingBody = computerOn && circuits.altimeter ? program?.blocks.falling : undefined
  let falling: BlockRunner | null = null

  const exec = (ins: Instr) => {
    switch (ins.op) {
      case 'ignite': {
        if (!circuits.igniter) blockIgnition('no-igniter')
        if (!motor) blockIgnition('no-motor')
        if (circuits.igniter && motor && fuel > 0) {
          engineOn = true
          if (!everIgnited) ignitedT = t
          everIgnited = true
        }
        return
      }
      case 'cutoff':
        engineOn = false
        return
      case 'deploy': {
        if (chute !== 'not-deployed') return
        if (!circuits.eject) {
          chute = 'no-charge'
          return
        }
        if (!chuteSpec) {
          chute = 'no-parachute'
          return
        }
        deployAltFt = Math.round(alt * M_TO_FT)
        deploySpeedMph = Math.round(Math.abs(v) * MS_TO_MPH)
        chuteT = t
        // Nothing ties a canopy to the rocket without the shock cord: it flies off on its own.
        chute = !build.shockCord ? 'separated' : deploySpeedMph > (chuteSpec.chuteMaxMph ?? 0) ? 'torn' : 'open'
        return
      }
      case 'set':
        vars[ins.name] = ins.value
        return
      case 'log':
        log.push({ t, text: ins.text })
        return
      case 'beep':
        log.push({ t, text: 'BEEP' })
        return
    }
  }

  const step = (r: BlockRunner) => {
    for (let guard = 0; r.pc < r.body.length && guard < 64; guard++) {
      const ins = r.body[r.pc]
      if (ins.op === 'wait') {
        r.waitUntil ??= t + Math.max(0, resolve(ins.value))
        if (t + 1e-9 < r.waitUntil) return
        r.waitUntil = null
      } else if (ins.op === 'waitUntil') {
        const reading = circuits.altimeter ? alt * M_TO_FT : 0
        const target = resolve(ins.value)
        if (!(ins.cmp === '<' ? reading < target : reading > target)) return
      } else {
        exec(ins)
      }
      r.pc++
    }
  }

  // Before the countdown: anything that stops the flight computer from running at all.
  if (!build.body) blockIgnition('no-body')
  if (!build.avionics) blockIgnition('no-avionics')
  if (!program) blockIgnition('no-program')
  if (!circuits.power) blockIgnition('no-power')

  while (t < MAX_FLIGHT_S) {
    if (launch) step(launch)
    if (fallingBody && !falling && liftoff && v < 0 && alt > 0) {
      sawFalling = true
      falling = new BlockRunner(fallingBody)
    }
    if (falling) step(falling)

    const mass = dryMass + fuel
    const throttle = Math.max(0, Math.min(100, vars.throttle)) / 100
    let thrust = 0
    if (engineOn && fuel > 0 && motor) {
      thrust = (motor.thrustN ?? 0) * throttle * thrustEfficiency
      fuel -= ((motor.fuelKg ?? 0) / (motor.fuelSec ?? 1)) * throttle * DT
      if (throttle > 0) burn += DT
      if (fuel <= 0) {
        fuel = 0
        engineOn = false
        fuelRanOut = true
      }
    }
    maxTW = Math.max(maxTW, thrust / (mass * G))

    if (!liftoff) {
      if (thrust > mass * G) {
        liftoff = true
        liftoffT = t
      } else {
        recordSample()
        t += DT
        // Nothing left that could still lift it off the pad.
        if ((everIgnited && !engineOn) || (!everIgnited && t > 6) || (launch && launch.pc >= launch.body.length && !engineOn)) break
        continue
      }
    }

    let open = 0
    if (chute === 'open') open = Math.min(1, (t - chuteT) / CHUTE_INFLATE_S)
    else if (chute === 'torn') open = 0.08
    const dragArea = cd * TUBE_AREA + open * (chuteSpec?.chuteCdA ?? 0)
    const drag = 0.5 * RHO * dragArea * v * Math.abs(v)
    const a = (thrust - drag) / mass - G
    v += a * DT
    alt += v * DT
    x += windMs * (chute === 'open' ? 1 : 0.25) * DT

    if (v > 0 && v * MS_TO_MPH > maxSafeMph && breakupT === null) {
      breakupT = t
      breakupAlt = alt
      breakupV = v
      apogee = alt
      apogeeT = t
      peakV = v
      recordSample()
      break
    }
    if (alt > apogee) {
      apogee = alt
      apogeeT = t
    }
    peakV = Math.max(peakV, Math.abs(v) * (v > 0 ? 1 : 0))

    if (alt <= 0 && t > liftoffT + 0.2) {
      alt = 0
      landed = true
      landingV = Math.abs(v)
      recordSample()
      break
    }
    if (alt < 0) {
      alt = 0
      v = Math.max(0, v)
    }
    recordSample()
    t += DT
  }

  function recordSample() {
    if (t + 1e-9 < nextSample) return
    nextSample += SAMPLE_EVERY
    samples.push({
      t,
      altM: alt,
      xM: x,
      vM: v,
      thrusting: engineOn && fuel > 0 && Math.max(0, vars.throttle) > 0,
      chute: chute === 'open' ? Math.min(1, (t - chuteT) / CHUTE_INFLATE_S) : chute === 'torn' || chute === 'separated' ? -1 : 0,
    })
  }

  if (!everIgnited) {
    if (computerOn && !(launch?.body.some((i) => i.op === 'ignite') ?? false)) blockIgnition('no-ignite-command')
    if (!circuits.igniter) blockIgnition('no-igniter')
    if (!motor) blockIgnition('no-motor')
  }

  const outcome: FlightOutcome =
    breakupT !== null ? 'breakup' : liftoff ? 'flight' : everIgnited ? 'no-liftoff' : 'no-ignition'
  const apogeeFt = Math.round(apogee * M_TO_FT)
  const apogeeErrorFt = Math.abs(apogeeFt - REQUIRED.targetApogeeFt)
  const landingFps = outcome === 'flight' && landed ? Number((landingV * M_TO_FT).toFixed(1)) : 0
  const totalMass = dryMass + fuelStartKg

  const result: RocketResult = {
    variantId,
    outcome,
    ignitionBlocks: everIgnited ? [] : ignitionBlocks,
    apogeeFt,
    apogeeErrorFt,
    apogeePassed: outcome === 'flight' && apogeeErrorFt <= REQUIRED.apogeeToleranceFt,
    peakSpeedMph: Math.round(peakV * MS_TO_MPH),
    maxSafeMph: Number.isFinite(maxSafeMph) ? Math.round(maxSafeMph) : 0,
    weakestPart,
    breakupAltFt: Math.round(breakupAlt * M_TO_FT),
    breakupSpeedMph: Math.round(breakupV * MS_TO_MPH),
    tumbled: tumbled && liftoff,
    corkscrew: corkscrew && liftoff,
    noNose: noNose && liftoff,
    burnSeconds: Number(burn.toFixed(1)),
    fuelRanOut,
    chute,
    deployAltFt,
    deploySpeedMph,
    sawFalling,
    landingFps,
    recoveryPassed: outcome === 'flight' && landed && landingFps <= REQUIRED.maxLandingFps,
    driftFt: Math.round(x * M_TO_FT),
    flightSeconds: Number((landed ? t - liftoffT : 0).toFixed(1)),
    massKg: Number(totalMass.toFixed(2)),
    thrustToWeight: Number(maxTW.toFixed(1)),
    hasTelemetry: circuits.radio && circuits.power,
    spent,
    funds,
    budgetPassed: spent <= funds,
    log,
    startSettings,
  }
  return { result, samples, apogeeT, endT: t, breakupT, ignitedT, build }
}

export function evaluateRocketDesign(design: RocketObject[], variantId: RocketVariantId = 'standard'): RocketResult {
  return simulateFlight(design, variantId).result
}

// ---------------------------------------------------------------- playback

export type FlightPhase = 'pad' | 'ascent' | 'descent' | 'landed'

export interface LiveSimFrame {
  phase: FlightPhase
  /** Real flight time, seconds. */
  tSec: number
  /** World feet: x (downwind), y (altitude), z. */
  rocketPos: [number, number, number]
  rocketRot: [number, number, number]
  rocketThrusting: boolean
  rocketShredded: boolean
  /** 0 packed, 0..1 opening/open; negative = torn or flew off. */
  chute: number
  /** 0..1 after a hard touchdown (pieces flying). */
  splatterProgress: number
  hudAltitudeFt: number
  hudSpeedFps: number
  /** Speed ÷ safe speed while climbing (≥ 1 means it is tearing apart). */
  structuralStress: number
  breakupProgress: number
  breakupSeconds: number
  breakupPos: [number, number, number]
  breakupClimbFps: number
  /** Latest LOG line from the flight computer. */
  lastLog: string | null
}

const TOTAL_TICKS = 360
const LANDED_HOLD_S = 2.6

export class RocketRun implements SimRun<RocketResult> {
  readonly totalTicks = TOTAL_TICKS
  readonly durationSeconds: number
  private tickCount = 0
  private readonly flight: Flight
  /** Playback seconds → real flight seconds, as a piecewise-linear map. */
  private readonly timeMap: [number, number][]

  readonly frame: LiveSimFrame = {
    phase: 'pad',
    tSec: 0,
    rocketPos: [0, 0, 0],
    rocketRot: [0, 0, 0],
    rocketThrusting: false,
    rocketShredded: false,
    chute: 0,
    splatterProgress: 0,
    hudAltitudeFt: 0,
    hudSpeedFps: 0,
    structuralStress: 0,
    breakupProgress: 0,
    breakupSeconds: 0,
    breakupPos: [0, 0, 0],
    breakupClimbFps: 0,
    lastLog: null,
  }

  constructor(design: RocketObject[], variantId: RocketVariantId = 'standard') {
    this.flight = simulateFlight(design, variantId)
    const f = this.flight
    const r = f.result
    const pre = 1.2 // countdown beat on the pad
    if (r.outcome === 'breakup' && f.breakupT !== null) {
      const climb = Math.max(1.6, f.breakupT * 1.1)
      this.timeMap = [
        [0, -pre],
        [pre, 0],
        [pre + climb, f.breakupT],
      ]
      this.durationSeconds = pre + climb + BREAKUP_SECONDS + 0.4
    } else if (r.outcome !== 'flight') {
      this.timeMap = [
        [0, -pre],
        [pre, 0],
        [pre + Math.max(2.5, f.endT), Math.max(2.5, f.endT)],
      ]
      this.durationSeconds = pre + Math.max(2.5, f.endT) + 0.8
    } else {
      const up = Math.min(9, Math.max(3.5, f.apogeeT * 0.75))
      const down = Math.min(8, Math.max(3, (f.endT - f.apogeeT) * 0.11))
      this.timeMap = [
        [0, -pre],
        [pre, 0],
        [pre + up, f.apogeeT],
        [pre + up + down, f.endT],
      ]
      this.durationSeconds = pre + up + down + LANDED_HOLD_S
    }
    this.updateFrame()
  }

  get done(): boolean {
    return this.tickCount >= this.totalTicks
  }

  get progress(): number {
    return Math.min(1, this.tickCount / this.totalTicks)
  }

  get intensity(): number {
    return this.frame.rocketThrusting ? 0.9 : 0.4
  }

  clockLabel(): string {
    const t = Math.max(0, this.frame.tSec)
    const s = Math.floor(t)
    const base = this.frame.tSec < 0 ? `T−${Math.ceil(-this.frame.tSec)}` : `T+${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    return this.flight.result.hasTelemetry ? `${base} · ${Math.round(this.frame.hudAltitudeFt).toLocaleString()} ft` : base
  }

  step(): boolean {
    if (this.done) return false
    this.tickCount++
    this.updateFrame()
    return !this.done
  }

  result(): RocketResult {
    return this.flight.result
  }

  /** Real flight seconds at this playback moment. */
  private realTime(playS: number): number {
    const m = this.timeMap
    for (let i = 1; i < m.length; i++) {
      if (playS <= m[i][0]) {
        const [p0, t0] = m[i - 1]
        const [p1, t1] = m[i]
        return t0 + ((playS - p0) / (p1 - p0)) * (t1 - t0)
      }
    }
    return m[m.length - 1][1]
  }

  private sampleAt(t: number): Sample {
    const s = this.flight.samples
    if (!s.length) return { t: 0, altM: 0, xM: 0, vM: 0, thrusting: false, chute: 0 }
    const i = Math.max(0, Math.min(s.length - 1, Math.floor(t / SAMPLE_EVERY)))
    const a = s[i]
    const b = s[Math.min(s.length - 1, i + 1)]
    const k = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0
    return {
      t,
      altM: a.altM + (b.altM - a.altM) * k,
      xM: a.xM + (b.xM - a.xM) * k,
      vM: a.vM + (b.vM - a.vM) * k,
      thrusting: a.thrusting,
      chute: a.chute < 0 || b.chute < 0 ? (a.chute < 0 ? -1 : a.chute) : a.chute + (b.chute - a.chute) * k,
    }
  }

  private updateFrame(): void {
    const f = this.flight
    const r = f.result
    const playS = this.progress * this.durationSeconds
    const fr = this.frame

    // Breakup: after the rocket tears apart the debris plays out in real time.
    if (r.outcome === 'breakup' && f.breakupT !== null && playS > this.timeMap[2][0]) {
      const secs = Math.min(BREAKUP_SECONDS, playS - this.timeMap[2][0])
      const last = f.samples[f.samples.length - 1]
      const climbFps = r.breakupSpeedMph * (M_TO_FT / MS_TO_MPH)
      const centerAlt = Math.max(0, r.breakupAltFt + debrisRiseFt(climbFps, secs))
      fr.phase = 'ascent'
      fr.tSec = f.breakupT + secs
      fr.rocketShredded = true
      fr.rocketThrusting = false
      fr.structuralStress = 1
      fr.breakupProgress = secs / BREAKUP_SECONDS
      fr.breakupSeconds = secs
      fr.breakupPos = [last.xM * M_TO_FT, r.breakupAltFt, 0]
      fr.breakupClimbFps = climbFps
      fr.rocketPos = [last.xM * M_TO_FT, centerAlt, 0]
      fr.hudAltitudeFt = centerAlt
      fr.hudSpeedFps = centerAlt <= 0 ? 0 : Math.round(Math.abs(climbFps * Math.exp(-DEBRIS_DRAG * secs) - DEBRIS_GRAVITY_FPS2 * secs))
      fr.chute = 0
      return
    }

    const t = this.realTime(playS)
    const s = this.sampleAt(Math.max(0, t))
    const altFt = s.altM * M_TO_FT
    const climbing = s.vM >= 0
    const landedNow = r.outcome === 'flight' && t >= f.endT - 1e-6

    fr.tSec = t
    fr.rocketShredded = false
    fr.breakupProgress = 0
    fr.breakupSeconds = 0
    fr.rocketThrusting = t >= 0 && s.thrusting
    fr.chute = s.chute
    fr.hudAltitudeFt = altFt
    fr.hudSpeedFps = Math.round(Math.abs(s.vM) * M_TO_FT)
    fr.structuralStress = climbing && r.maxSafeMph > 0 ? (s.vM * MS_TO_MPH) / r.maxSafeMph : 0
    fr.phase = t < 0 || (r.outcome !== 'flight' && altFt < 1) ? 'pad' : landedNow ? 'landed' : t <= f.apogeeT ? 'ascent' : 'descent'
    fr.lastLog = [...r.log].reverse().find((l) => l.t <= t)?.text ?? null

    // Attitude: upright while climbing; a tumbling rocket cartwheels; under a parachute it hangs
    // sideways and sways; falling free it turns nose-down.
    const sinceApogee = Math.max(0, t - f.apogeeT)
    let rot: [number, number, number] = [0, 0, 0]
    if (r.tumbled && t > 0.15) {
      const spin = (t - 0.15) * 7
      rot = [spin, spin * 0.6, Math.sin(spin) * 1.2]
    } else if (fr.phase === 'descent' || fr.phase === 'landed') {
      if (s.chute > 0) {
        rot = [0, t * 0.4, 1.25 * s.chute + Math.sin(t * 2.2) * 0.12]
      } else {
        rot = [0, 0, Math.min(Math.PI * 0.92, sinceApogee * 1.4)]
      }
    } else if (r.corkscrew && climbing) {
      rot = [0, t * 9, 0.06]
    }
    if (landedNow) rot = [0, 0, Math.PI / 2]
    fr.rocketRot = rot
    fr.rocketPos = [s.xM * M_TO_FT, altFt, 0]
    fr.splatterProgress =
      landedNow && r.landingFps > SMASH_FPS ? Math.min(1, ((playS - this.timeMap[this.timeMap.length - 1][0]) / LANDED_HOLD_S) * 1.4) : 0
  }
}
