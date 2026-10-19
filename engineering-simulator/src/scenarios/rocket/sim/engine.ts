import type { SimRun } from '../../../core/scenario'
import {
  AIRFRAME_MATERIALS,
  CHUTE_SPECS,
  FIN_PROFILES,
  getAirframe,
  getGyroConfig,
  getLaunchSetup,
  getPayloadMotor,
  getPayloadTestRig,
  getWeightDist,
  hasProgram,
  IMPULSE_CLASSES,
  NOSE_CONES,
  PAYLOAD_MOTORS,
  REQUIRED,
  ROCKET_BAYS,
  VARIANTS,
} from '../config'
import type { RocketBayId, RocketObject, RocketVariantId } from '../types'

export type RocketFlightOutcome =
  | 'nominal-apogee'
  | 'pad-stall'
  | 'unstable-tumble'
  | 'structural-shred'
  | 'altitude-miss'

export type PayloadDropOutcome =
  | 'target-landed'
  | 'splatter'
  | 'spin-motor-weak'
  | 'spin-gyro-uncalibrated'
  | 'drifted-off-target'

export interface RocketTelemetrySummary {
  /** Center of Gravity in calibers from nose tip (0..10). */
  cgCalibers: number
  /** Center of Pressure in calibers from nose tip (0..10). */
  cpCalibers: number
  /** Stability margin = CP - CG in calibers (ideal: 1.5..3.0). */
  stabilityCalibers: number
  /** Total liftoff mass in kg. */
  totalRocketMassKg: number
  /** Peak dynamic pressure experienced during ascent in kPa. */
  peakDynamicPressureKpa: number
  /** Structural Max-Q limit of airframe in kPa. */
  structuralLimitKpa: number
  /** Peak Mach number during ascent. */
  maxMach: number
  /** Peak speed the rocket would reach at motor burnout, intact (mph). */
  peakSpeedMph: number
  /** Fastest the rocket can fly before something tears off (mph): the weaker of airframe and fins. */
  maxSafeSpeedMph: number
  /** Which part gives out first when the rocket flies too fast. */
  weakestPart: 'airframe' | 'fins'
  /** Speed (mph) and altitude (ft) where the rocket tore apart; 0 when it held together. */
  breakupSpeedMph: number
  breakupAltFt: number
  /** Whether the motor nozzle is properly positioned at the tail (slot 5). */
  nozzleAtTail: boolean
  /** Average gyroscope calibration score (0..100%). */
  gyroCalibrationPct: number
  /** Chosen payload motor mass in kg. */
  payloadMotorMassKg: number
  /** Chosen payload motor torque in N*m. */
  payloadMotorTorqueNm: number
  /** Payload landing vertical speed in ft/s. */
  landingSpeedFps: number
  /** Altitude (ft) where the parachute deployed. */
  chuteDeployAltFt: number
}

export interface RocketResult {
  variantId: RocketVariantId
  mode: 'full' | 'payload-only' | 'rocket-only'
  /** Peak rocket altitude reached in feet. */
  apogeeFt: number
  /** Absolute difference from 10,000 ft IREC target. */
  apogeeErrorFt: number
  /** Whether the rocket sub-team met its altitude & structural stability goal. */
  rocketPassed: boolean
  rocketOutcome: RocketFlightOutcome
  /** Distance from the bullseye target pad center in feet. */
  landingDistFt: number
  /** Whether the payload landed intact (did not splatter or spin-crash). */
  payloadIntact: boolean
  /** Whether the payload sub-team met its intact + accuracy requirement. */
  payloadPassed: boolean
  payloadOutcome: PayloadDropOutcome
  /** Detailed engineering telemetry for UI & factual observations. */
  telemetry: RocketTelemetrySummary
}

export interface LiveSimFrame {
  phase: 'rocket-ascent' | 'apogee-sep' | 'payload-freefall' | 'payload-chute' | 'impact'
  /** Rocket position in world feet: x (crossrange), y (altitude), z (downrange). */
  rocketPos: [number, number, number]
  /** Rocket pitch/yaw/roll euler angles in radians. */
  rocketRot: [number, number, number]
  rocketThrusting: boolean
  rocketShredded: boolean
  /** Payload position in world feet: x, y (altitude), z. */
  payloadPos: [number, number, number]
  /** Payload euler rotation in radians (spins fast when out of control!). */
  payloadRot: [number, number, number]
  /** Current angular velocity (rad/s) of payload. */
  payloadSpinRate: number
  chuteOpen: boolean
  /** 0..1 progress of comedic splatter explosion after ground impact. */
  splatterProgress: number
  /** Current altitude displayed on the HUD (ft). */
  hudAltitudeFt: number
  /** Current vertical speed displayed on HUD (ft/s). */
  hudSpeedFps: number
  /** Whether the user can currently press "DEPLOY PARACHUTE NOW!". */
  canDeployChute: boolean
  /** Current speed ÷ max safe speed during ascent (≥ 1 means it is tearing apart). */
  structuralStress: number
  /** 0 until the rocket tears apart, then 0..1 through the breakup animation. */
  breakupProgress: number
  /** Seconds since breakup (drives debris motion in the 3D scene). */
  breakupSeconds: number
  /** Where the rocket was when it tore apart (world feet), and how fast it was climbing. */
  breakupPos: [number, number, number]
  breakupClimbFps: number
}

const BAY_POSITIONS_CAL: number[] = [1.5, 2.8, 4.1, 5.4, 6.9, 8.6]

/** Air density at the launch site (~4,600 ft elevation), kg/m³. */
const AIR_DENSITY = 1.05
const SPEED_OF_SOUND_MS = 340
const MS_TO_MPH = 2.237
const MS_TO_FPS = 3.281

/**
 * Dynamic pressure q = ½ρv², so the speed at which the air pushes with q kPa is v = √(2q/ρ).
 * A part rated for q kPa is therefore rated for exactly this speed.
 */
export function speedForPressureMph(qKpa: number): number {
  return Math.round(Math.sqrt((2 * qKpa * 1000) / AIR_DENSITY) * MS_TO_MPH)
}

/** Share of the climb (by time) spent burning; speed peaks at burnout, then the rocket coasts. */
export const BOOST_FRACTION = 0.22

/** Speed ÷ peak speed at ascent progress p (0..1): linear rise during the burn, linear coast-down after. */
export function ascentSpeedFrac(p: number): number {
  if (p <= BOOST_FRACTION) return p / BOOST_FRACTION
  return Math.max(0, 1 - (p - BOOST_FRACTION) / (1 - BOOST_FRACTION))
}

/** Altitude ÷ apogee at ascent progress p (the integral of ascentSpeedFrac). */
export function ascentAltFrac(p: number): number {
  if (p <= BOOST_FRACTION) return (p * p) / BOOST_FRACTION
  const q = (p - BOOST_FRACTION) / (1 - BOOST_FRACTION)
  return BOOST_FRACTION + (1 - BOOST_FRACTION) * (1 - (1 - q) * (1 - q))
}

/** Debris after a breakup: keeps climbing while air drag bleeds off its speed, then falls. */
export const DEBRIS_DRAG = 1.6
export const DEBRIS_GRAVITY_FPS2 = 260
export const BREAKUP_SECONDS = 4.6

export function debrisRiseFt(climbFps: number, tSec: number): number {
  const coast = (climbFps * (1 - Math.exp(-DEBRIS_DRAG * tSec))) / DEBRIS_DRAG
  return coast - 0.5 * DEBRIS_GRAVITY_FPS2 * tSec * tSec
}

/**
 * Mass of one internal bay as the simulation sees it: the payload bay carries the chosen payload
 * motor, and the nose ballast carries the launch team's trim weight.
 */
export function rocketBayMassKg(design: RocketObject[], bayId: RocketBayId): number {
  const base = ROCKET_BAYS[bayId].baseMassKg
  if (bayId === 'payload-bay') return base + PAYLOAD_MOTORS[getPayloadMotor(design).motorId].massKg
  if (bayId === 'nose-ballast') return base + getLaunchSetup(design).ballastTrimKg
  return base
}

/**
 * Pure calculation of rocket stability, aerodynamics, apogee, and payload descent metrics.
 * Shared by headless simulation and live workstation previews.
 */
export function evaluateRocketDesign(
  design: RocketObject[],
  variantId: RocketVariantId = 'standard',
  manualChuteAltFt?: number,
): RocketResult {
  const variant = VARIANTS[variantId] ?? VARIANTS.standard
  const gyro = getGyroConfig(design)
  const motorObj = getPayloadMotor(design)
  const testRig = getPayloadTestRig(design)
  const weightDist = getWeightDist(design)
  const airframe = getAirframe(design)
  const launch = getLaunchSetup(design)

  const motorSpec = PAYLOAD_MOTORS[motorObj.motorId]
  const chuteSpec = CHUTE_SPECS[testRig.chuteSize]
  const matSpec = AIRFRAME_MATERIALS[airframe.materialId]
  const noseSpec = NOSE_CONES[airframe.noseConeId]
  const finSpec = FIN_PROFILES[airframe.finProfileId]
  const impulseSpec = IMPULSE_CLASSES[launch.impulseId]

  const hasReefing = hasProgram(design, 'reefing')
  const hasCarbonFins = hasProgram(design, 'carbonFins')
  const hasWindSonde = hasProgram(design, 'windSonde')

  // ---- 1. Rocket Mass & CG/CP Stability ----
  const bayMass = (bayId: RocketBayId): number => rocketBayMassKg(design, bayId)

  let bayMassSum = 0
  let weightedCgSum = 0
  weightDist.bayOrder.forEach((bayId, idx) => {
    const m = bayMass(bayId)
    const pos = BAY_POSITIONS_CAL[idx] ?? 5.0
    bayMassSum += m
    weightedCgSum += m * pos
  })

  // Include airframe tube mass centered at 5.2 calibers
  const totalRocketMassKg = bayMassSum + matSpec.massKg
  const cgCalibers = (weightedCgSum + matSpec.massKg * 5.2) / totalRocketMassKg
  const cpCalibers = finSpec.cpCalibersFromNose + noseSpec.cpShiftCal
  const stabilityCalibers = cpCalibers - cgCalibers

  const nozzleAtTail = weightDist.bayOrder[5] === 'motor-nozzle'
  const propellantNearTail =
    weightDist.bayOrder[4] === 'propellant-tank' || weightDist.bayOrder[3] === 'propellant-tank'

  // ---- 2. Rocket Ascent & Apogee ----
  const totalCd = noseSpec.dragCd + finSpec.dragDeltaCd
  // Dynamic pressure scales with impulse and inversely with mass & drag
  const peakDynamicPressureKpa = Math.round(
    impulseSpec.peakDynamicPressureKpa * (36 / Math.max(24, totalRocketMassKg)) * (0.45 / Math.max(0.28, totalCd)),
  )
  const structuralLimitKpa = matSpec.maxQLimitKpa + (hasCarbonFins ? 25 : 0)
  const flutterLimitKpa = finSpec.flutterLimitKpa + (hasCarbonFins ? 30 : 0)

  // Pressure grows with speed², so every pressure rating is also a speed limit.
  const peakSpeedMph = speedForPressureMph(peakDynamicPressureKpa)
  const weakestPart: 'airframe' | 'fins' = flutterLimitKpa < structuralLimitKpa ? 'fins' : 'airframe'
  const maxSafeSpeedMph = speedForPressureMph(Math.min(structuralLimitKpa, flutterLimitKpa))
  let breakupSpeedMph = 0
  let breakupAltFt = 0

  // Altitude the rocket would coast to if it held together.
  const impulseFactor = impulseSpec.totalImpulseNs / 10_200
  const massFactor = 37.3 / totalRocketMassKg
  const dragEfficiency = 0.42 / totalCd
  // Drag non-linearity (dampens slightly so small variations stay controllable)
  const aeroMultiplier = Math.pow(dragEfficiency, 0.55)

  let rocketOutcome: RocketFlightOutcome = 'nominal-apogee'
  let apogeeFt: number
  let maxMach = Number(((peakSpeedMph / MS_TO_MPH) / SPEED_OF_SOUND_MS).toFixed(2))

  if (!nozzleAtTail) {
    rocketOutcome = 'pad-stall'
    apogeeFt = 420
    maxMach = 0.15
  } else if (stabilityCalibers < 1.1 || !propellantNearTail) {
    rocketOutcome = 'unstable-tumble'
    apogeeFt = Math.round(1100 + Math.max(0, stabilityCalibers) * 450)
    maxMach = 0.42
  } else if (peakSpeedMph > maxSafeSpeedMph) {
    // Still accelerating when it passes its safe speed: it tears apart right there, mid-burn.
    rocketOutcome = 'structural-shred'
    const intactApogeeFt = 10_000 * impulseFactor * massFactor * aeroMultiplier
    const speedRatio = maxSafeSpeedMph / peakSpeedMph
    breakupSpeedMph = maxSafeSpeedMph
    breakupAltFt = Math.max(250, Math.round(intactApogeeFt * ascentAltFrac(BOOST_FRACTION * speedRatio)))
    apogeeFt = breakupAltFt
    maxMach = Number(((maxSafeSpeedMph / MS_TO_MPH) / SPEED_OF_SOUND_MS).toFixed(2))
  } else {
    // Aerodynamically stable & structurally sound flight, calibrated around 10,000 ft
    // Stability penalty if over-stable (> 3.0 calibers weathercocks into wind)
    const overStablePenalty =
      stabilityCalibers > 3.0 ? Math.max(0.72, 1 - (stabilityCalibers - 3.0) * 0.14 * variant.turbulenceFactor) : 1.0

    // Rail angle vs wind: ideal rail angle is ~86 deg in 10 mph wind, ~82 deg in 24 mph crosswind
    const idealRailDeg = variant.windMph > 18 ? 82 : 86
    const railErrorDeg = Math.abs(launch.railAngleDeg - idealRailDeg)
    const railFactor = Math.cos((railErrorDeg * Math.PI) / 180)

    apogeeFt = Math.round(10_000 * impulseFactor * massFactor * aeroMultiplier * overStablePenalty * railFactor)

    if (Math.abs(apogeeFt - REQUIRED.targetApogeeFt) > REQUIRED.maxApogeeErrorFt) {
      rocketOutcome = 'altitude-miss'
    }
  }

  const apogeeErrorFt = Math.abs(apogeeFt - REQUIRED.targetApogeeFt)
  const rocketPassed =
    rocketOutcome === 'nominal-apogee' && apogeeErrorFt <= REQUIRED.maxApogeeErrorFt

  // ---- 3. Payload Drop, Gyroscope, Motor & Parachute ----
  const gyroCalibrationPct = Math.round((gyro.rollScore + gyro.pitchScore + gyro.yawScore) / 3)
  const payloadTotalMassKg = ROCKET_BAYS['payload-bay'].baseMassKg + motorSpec.massKg
  const chuteAltFt = manualChuteAltFt ?? testRig.armedChuteAltFt

  // Effective descent rate under canopy (ft/s)
  // Heavy motor (9.8 kg -> 13 kg payload) overwhelms parachute -> > 32 ft/s impact
  const baseDescentFps = 16.5 * Math.sqrt(payloadTotalMassKg / chuteSpec.dragAreaM2)
  const chuteDecelRatio =
    chuteAltFt < 550
      ? 2.4 // opened way too close to ground!
      : testRig.dropAltitudeFt < 1800
        ? 1.9 // dropped from too low to decelerate!
        : 1.0
  const landingSpeedFps = Number((baseDescentFps * chuteDecelRatio).toFixed(1))

  const minTorqueNeeded =
    variantId === 'crosswind' && !hasReefing
      ? REQUIRED.minMotorTorqueCrosswindNm
      : REQUIRED.minMotorTorqueNm

  let payloadOutcome: PayloadDropOutcome = 'target-landed'
  let landingDistFt: number
  let payloadIntact = true

  if (
    motorSpec.massKg > REQUIRED.maxMotorMassKg ||
    chuteAltFt < 550 ||
    testRig.dropAltitudeFt < 1800 ||
    landingSpeedFps > 27.5
  ) {
    // Comedic splatter into pieces!
    payloadOutcome = 'splatter'
    payloadIntact = false
    landingDistFt = Math.round(65 + motorSpec.massKg * 6)
  } else if (motorSpec.torqueNm < minTorqueNeeded) {
    // Motor is too light/weak -> spins out of control!
    payloadOutcome = 'spin-motor-weak'
    payloadIntact = false
    landingDistFt = Math.round(165 + (minTorqueNeeded - motorSpec.torqueNm) * 55 * variant.turbulenceFactor)
  } else if (gyroCalibrationPct < REQUIRED.minGyroCalibrationPct) {
    // Gyroscope is out of calibration -> spins out of control!
    payloadOutcome = 'spin-gyro-uncalibrated'
    payloadIntact = false
    landingDistFt = Math.round(145 + (REQUIRED.minGyroCalibrationPct - gyroCalibrationPct) * 2.8)
  } else {
    // Stabilized descent! Calculate distance from target pad center (bullseye)
    // Ideal chute deployment altitude is 1000..1500 ft
    const idealChuteAlt = 1200
    const chuteTimingDriftFt = Math.max(0, Math.abs(chuteAltFt - idealChuteAlt) - 200) * 0.045

    // Ideal wind lead angle: 8 deg in standard (10 mph), 15 deg in crosswind (24 mph)
    const idealWindLead = variant.windMph > 18 ? 15 : 8
    const windLeadErrorFt = Math.abs(testRig.windLeadDeg - idealWindLead) * (variant.windMph > 18 ? 4.2 : 2.6)

    // Oversized tandem chute catches extra crosswind unless reefing is active
    const canopyWindPenaltyFt =
      testRig.chuteSize === 'tandem-large' && !hasReefing ? variant.windMph * 1.4 : 0

    // Gyro precision bonus (75..100% -> 8..0 ft residual error)
    const gyroResidualFt = Math.max(0, (96 - gyroCalibrationPct) * 0.4)

    let rawDist = 8 + chuteTimingDriftFt + windLeadErrorFt + canopyWindPenaltyFt + gyroResidualFt
    if (hasReefing) rawDist *= 0.68
    if (hasWindSonde) rawDist *= 0.62

    // If this is a full mission and the rocket failed violently on ascent, the payload is deployed off-nominal
    if (variant.mode === 'full' && (rocketOutcome === 'pad-stall' || rocketOutcome === 'unstable-tumble' || rocketOutcome === 'structural-shred')) {
      rawDist += 95
    }

    landingDistFt = Math.round(rawDist)
    if (landingDistFt > REQUIRED.maxLandingDistFt) {
      payloadOutcome = 'drifted-off-target'
    }
  }

  // In rocket-only sub-test, carry over payload pass status based on current payload design;
  // in payload-only sub-test, carry over rocket pass status based on current rocket design.
  const payloadPassed = payloadIntact && landingDistFt <= REQUIRED.maxLandingDistFt

  return {
    variantId,
    mode: variant.mode,
    apogeeFt,
    apogeeErrorFt,
    rocketPassed,
    rocketOutcome,
    landingDistFt,
    payloadIntact,
    payloadPassed,
    payloadOutcome,
    telemetry: {
      cgCalibers: Number(cgCalibers.toFixed(2)),
      cpCalibers: Number(cpCalibers.toFixed(2)),
      stabilityCalibers: Number(stabilityCalibers.toFixed(2)),
      totalRocketMassKg: Number(totalRocketMassKg.toFixed(1)),
      peakDynamicPressureKpa,
      structuralLimitKpa,
      maxMach,
      peakSpeedMph,
      maxSafeSpeedMph,
      weakestPart,
      breakupSpeedMph,
      breakupAltFt,
      nozzleAtTail,
      gyroCalibrationPct,
      payloadMotorMassKg: motorSpec.massKg,
      payloadMotorTorqueNm: motorSpec.torqueNm,
      landingSpeedFps,
      chuteDeployAltFt: Math.round(chuteAltFt),
    },
  }
}

const TOTAL_TICKS = 360

/**
 * Interactive & headless simulation run for Rocket Team.
 * Supports:
 * - 'payload-drop': Payload drop test from crane/high-altitude carrier (camera follows payload)
 * - 'rocket-launch': Rocket flight test to apogee (camera follows rocket)
 * - 'standard' & 'crosswind': Full IREC mission (rocket ascent -> apogee payload deployment -> landing)
 */
export class RocketRun implements SimRun<RocketResult> {
  readonly totalTicks = TOTAL_TICKS
  private tickCount = 0
  private readonly design: RocketObject[]
  private readonly variantId: RocketVariantId
  private manualChuteAltFt: number | undefined
  private computedResult: RocketResult

  readonly frame: LiveSimFrame = {
    phase: 'rocket-ascent',
    rocketPos: [0, 0, 0],
    rocketRot: [0, 0, 0],
    rocketThrusting: false,
    rocketShredded: false,
    payloadPos: [0, 3500, 0],
    payloadRot: [0, 0, 0],
    payloadSpinRate: 0,
    chuteOpen: false,
    splatterProgress: 0,
    hudAltitudeFt: 0,
    hudSpeedFps: 0,
    canDeployChute: false,
    structuralStress: 0,
    breakupProgress: 0,
    breakupSeconds: 0,
    breakupPos: [0, 0, 0],
    breakupClimbFps: 0,
  }

  constructor(design: RocketObject[], variantId: RocketVariantId = 'standard') {
    this.design = design
    this.variantId = variantId
    this.computedResult = evaluateRocketDesign(design, variantId)
    this.updateFrame(0)
  }

  get done(): boolean {
    return this.tickCount >= this.totalTicks
  }

  get progress(): number {
    return Math.min(1, this.tickCount / this.totalTicks)
  }

  /**
   * Full missions that clear the rocket phase play out over 18 s. Anything that only shows the
   * climb is shorter: a breakup gets time to show the debris, a pad stall or tumble ends quickly.
   */
  get durationSeconds(): number {
    const r = this.computedResult
    if (r.mode === 'payload-only' || (r.mode === 'full' && r.rocketPassed)) return 18
    if (r.rocketOutcome === 'structural-shred') return 8
    if (r.rocketOutcome === 'pad-stall' || r.rocketOutcome === 'unstable-tumble') return 4
    return 10
  }

  get intensity(): number {
    return this.frame.rocketThrusting ? 0.9 : this.frame.splatterProgress > 0 ? 1.0 : 0.4
  }

  /**
   * Called when the Payload Tester clicks "DEPLOY PARACHUTE NOW!" during the live 3D drop.
   * Records the live altitude at the moment of click and re-evaluates landing accuracy/splatter.
   */
  deployParachute(): number | null {
    if (!this.frame.canDeployChute || this.frame.chuteOpen) return null
    const triggeredAlt = Math.max(100, Math.round(this.frame.hudAltitudeFt))
    this.manualChuteAltFt = triggeredAlt
    this.computedResult = evaluateRocketDesign(this.design, this.variantId, triggeredAlt)
    this.frame.chuteOpen = true
    this.frame.canDeployChute = false
    return triggeredAlt
  }

  clockLabel(): string {
    const p = this.progress
    // The animation runs about 2.5× faster than a real flight.
    const tSec = Math.round(p * this.durationSeconds * 2.5)
    return `T+${String(Math.floor(tSec / 60)).padStart(1, '0')}:${String(tSec % 60).padStart(2, '0')} · ${Math.round(this.frame.hudAltitudeFt).toLocaleString()} ft`
  }

  step(): boolean {
    if (this.done) return false
    this.tickCount++
    this.updateFrame(this.progress)
    return !this.done
  }

  private updateFrame(p: number): void {
    const r = this.computedResult
    const testRig = getPayloadTestRig(this.design)
    const launch = getLaunchSetup(this.design)
    const mode = r.mode

    if (mode === 'payload-only') {
      this.updatePayloadDropFrame(p, testRig.dropAltitudeFt)
      return
    }

    // If testing rocket-only, OR if the rocket launch fails in full mode, show the rocket ascent/failure
    if (mode === 'rocket-only' || !r.rocketPassed) {
      this.updateRocketAscentFrame(p)
      return
    }

    // Full IREC Mission (when rocket launch succeeds): 0..0.45 is Rocket Ascent to Apogee, 0.45..1.0 is Payload Drop from Apogee
    if (p < 0.45) {
      this.updateRocketAscentFrame(p / 0.45)
    } else {
      const dropP = (p - 0.45) / 0.55
      const startAlt = Math.max(1500, Math.min(testRig.dropAltitudeFt, r.apogeeFt))
      this.updatePayloadDropFrame(dropP, startAlt)
    }
    void launch
  }

  private updateRocketAscentFrame(ascentP: number): void {
    const r = this.computedResult
    const t = r.telemetry
    const launch = getLaunchSetup(this.design)
    const tiltRad = ((90 - launch.railAngleDeg) * Math.PI) / 180

    this.frame.phase = ascentP < 0.92 ? 'rocket-ascent' : 'apogee-sep'
    this.frame.canDeployChute = false
    this.frame.chuteOpen = false
    this.frame.splatterProgress = 0
    this.frame.breakupProgress = 0
    this.frame.breakupSeconds = 0
    this.frame.rocketShredded = false

    if (r.rocketOutcome === 'structural-shred') {
      this.updateBreakupFrame(ascentP, tiltRad)
      return
    }

    const altFt = r.apogeeFt * ascentAltFrac(ascentP)
    const crossX = Math.sin(tiltRad) * altFt * 0.18
    const peakMph = t.maxMach * SPEED_OF_SOUND_MS * MS_TO_MPH
    const speedMph = peakMph * ascentSpeedFrac(ascentP)

    this.frame.rocketThrusting = ascentP < BOOST_FRACTION && r.rocketOutcome !== 'pad-stall'
    this.frame.structuralStress = speedMph / t.maxSafeSpeedMph

    if (r.rocketOutcome === 'unstable-tumble' && ascentP > 0.2) {
      const spin = (ascentP - 0.2) * 28
      this.frame.rocketRot = [spin, spin * 0.7, tiltRad + Math.sin(spin) * 1.4]
      this.frame.rocketPos = [crossX + Math.sin(spin * 0.5) * 180, altFt, Math.cos(spin * 0.5) * 120]
    } else {
      this.frame.rocketRot = [0, 0, tiltRad]
      this.frame.rocketPos = [crossX, altFt, 0]
    }

    this.frame.payloadPos = [...this.frame.rocketPos]
    this.frame.hudAltitudeFt = altFt
    this.frame.hudSpeedFps = Math.round((speedMph * MS_TO_FPS) / MS_TO_MPH)
  }

  /**
   * Too-fast flight: the first 42% of the run climbs (still burning) until the rocket passes its
   * safe speed; the rest follows the debris as it coasts up, slows and falls.
   */
  private updateBreakupFrame(p: number, tiltRad: number): void {
    const t = this.computedResult.telemetry
    const climbShare = 0.42
    const failP = BOOST_FRACTION * (t.maxSafeSpeedMph / t.peakSpeedMph)
    const altAt = (ap: number) => (t.breakupAltFt * ascentAltFrac(ap)) / ascentAltFrac(failP)
    const breakupClimbFps = (t.breakupSpeedMph * MS_TO_FPS) / MS_TO_MPH

    if (p < climbShare) {
      const ascentP = (p / climbShare) * failP
      const altFt = altAt(ascentP)
      const speedMph = t.peakSpeedMph * ascentSpeedFrac(ascentP)
      this.frame.rocketThrusting = true
      this.frame.structuralStress = speedMph / t.maxSafeSpeedMph
      this.frame.rocketRot = [0, 0, tiltRad]
      this.frame.rocketPos = [Math.sin(tiltRad) * altFt * 0.18, altFt, 0]
      this.frame.payloadPos = [...this.frame.rocketPos]
      this.frame.hudAltitudeFt = altFt
      this.frame.hudSpeedFps = Math.round((speedMph * MS_TO_FPS) / MS_TO_MPH)
      return
    }

    const bp = (p - climbShare) / (1 - climbShare)
    const secs = bp * BREAKUP_SECONDS
    const origin: [number, number, number] = [Math.sin(tiltRad) * t.breakupAltFt * 0.18, t.breakupAltFt, 0]
    const centerAlt = Math.max(0, t.breakupAltFt + debrisRiseFt(breakupClimbFps, secs))

    this.frame.phase = 'rocket-ascent'
    this.frame.rocketShredded = true
    this.frame.rocketThrusting = false
    this.frame.structuralStress = 1
    this.frame.breakupProgress = bp
    this.frame.breakupSeconds = secs
    this.frame.breakupPos = origin
    this.frame.breakupClimbFps = breakupClimbFps * Math.cos(tiltRad)
    this.frame.rocketRot = [0, 0, tiltRad]
    this.frame.rocketPos = [origin[0], centerAlt, 0]
    this.frame.payloadPos = [...this.frame.rocketPos]
    this.frame.hudAltitudeFt = centerAlt
    this.frame.hudSpeedFps =
      centerAlt <= 0
        ? 0
        : Math.round(Math.abs(breakupClimbFps * Math.exp(-DEBRIS_DRAG * secs) - DEBRIS_GRAVITY_FPS2 * secs))
  }

  private updatePayloadDropFrame(dropP: number, startAltFt: number): void {
    const r = this.computedResult
    const chuteTriggerAlt = this.manualChuteAltFt ?? r.telemetry.chuteDeployAltFt

    // Impact happens at dropP = 0.84 so 0.84..1.0 shows landing / comedic splatter animation!
    const impactP = 0.84
    if (dropP >= impactP) {
      const postP = (dropP - impactP) / (1 - impactP)
      this.frame.phase = 'impact'
      this.frame.canDeployChute = false
      this.frame.hudAltitudeFt = 0
      this.frame.hudSpeedFps = 0
      const landX = r.landingDistFt
      this.frame.payloadPos = [landX, 0, 0]
      this.frame.splatterProgress = r.payloadOutcome === 'splatter' ? Math.min(1, postP * 1.25) : 0
      return
    }

    const fallFrac = dropP / impactP // 0..1 from startAltFt down to 0
    const currentAltFt = startAltFt * (1 - fallFrac)
    const chuteNowOpen = currentAltFt <= chuteTriggerAlt
    this.frame.chuteOpen = chuteNowOpen
    this.frame.phase = chuteNowOpen ? 'payload-chute' : 'payload-freefall'
    this.frame.canDeployChute = !chuteNowOpen && currentAltFt > 250
    this.frame.splatterProgress = 0

    // Drift laterally from initial release offset toward final landingDistFt
    const startOffsetFt = -90
    const xPos = startOffsetFt + (r.landingDistFt - startOffsetFt) * fallFrac

    const spinningOut =
      r.payloadOutcome === 'spin-motor-weak' || r.payloadOutcome === 'spin-gyro-uncalibrated'

    if (spinningOut) {
      const spinAngle = fallFrac * 46
      const spiralRadius = 22 * Math.sin(fallFrac * Math.PI)
      this.frame.payloadSpinRate = 18
      this.frame.payloadRot = [spinAngle * 1.3, spinAngle * 1.9, Math.sin(spinAngle) * 1.1]
      this.frame.payloadPos = [
        xPos + Math.cos(spinAngle * 0.6) * spiralRadius,
        currentAltFt,
        Math.sin(spinAngle * 0.6) * spiralRadius,
      ]
    } else {
      // Gentle oscillation before chute, rock-steady after chute
      const sway = chuteNowOpen ? Math.sin(fallFrac * 10) * 0.05 : Math.sin(fallFrac * 16) * 0.14
      this.frame.payloadSpinRate = 0.2
      this.frame.payloadRot = [sway * 0.5, fallFrac * 2, sway]
      this.frame.payloadPos = [xPos, currentAltFt, 0]
    }

    this.frame.hudAltitudeFt = currentAltFt
    this.frame.hudSpeedFps = chuteNowOpen
      ? r.telemetry.landingSpeedFps
      : Math.min(165, Math.round(35 + fallFrac * 140))
  }

  result(): RocketResult {
    return this.computedResult
  }
}
