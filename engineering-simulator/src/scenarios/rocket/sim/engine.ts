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
}

const BAY_POSITIONS_CAL: number[] = [1.5, 2.8, 4.1, 5.4, 6.9, 8.6]

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
  const bayMass = (bayId: RocketBayId): number => {
    const base = ROCKET_BAYS[bayId].baseMassKg
    if (bayId === 'payload-bay') return base + motorSpec.massKg
    if (bayId === 'nose-ballast') return base + launch.ballastTrimKg
    return base
  }

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

  let rocketOutcome: RocketFlightOutcome = 'nominal-apogee'
  let apogeeFt: number
  let maxMach: number

  if (!nozzleAtTail) {
    rocketOutcome = 'pad-stall'
    apogeeFt = 420
    maxMach = 0.15
  } else if (stabilityCalibers < 1.1 || !propellantNearTail) {
    rocketOutcome = 'unstable-tumble'
    apogeeFt = Math.round(1100 + Math.max(0, stabilityCalibers) * 450)
    maxMach = 0.42
  } else if (peakDynamicPressureKpa > structuralLimitKpa || peakDynamicPressureKpa > flutterLimitKpa) {
    rocketOutcome = 'structural-shred'
    apogeeFt = 4350
    maxMach = 1.18
  } else {
    // Aerodynamically stable & structurally sound flight
    // Ideal mass/impulse/drag calibration around 10,000 ft
    const impulseFactor = impulseSpec.totalImpulseNs / 10_200
    const massFactor = 37.3 / totalRocketMassKg
    const dragEfficiency = 0.42 / totalCd
    // Drag non-linearity (dampens slightly so small variations stay controllable)
    const aeroMultiplier = Math.pow(dragEfficiency, 0.55)

    // Stability penalty if over-stable (> 3.0 calibers weathercocks into wind)
    const overStablePenalty =
      stabilityCalibers > 3.0 ? Math.max(0.72, 1 - (stabilityCalibers - 3.0) * 0.14 * variant.turbulenceFactor) : 1.0

    // Rail angle vs wind: ideal rail angle is ~86 deg in 10 mph wind, ~82 deg in 24 mph crosswind
    const idealRailDeg = variant.windMph > 18 ? 82 : 86
    const railErrorDeg = Math.abs(launch.railAngleDeg - idealRailDeg)
    const railFactor = Math.cos((railErrorDeg * Math.PI) / 180)

    apogeeFt = Math.round(10_000 * impulseFactor * massFactor * aeroMultiplier * overStablePenalty * railFactor)
    maxMach = Number((0.88 * impulseFactor * Math.sqrt(massFactor * dragEfficiency)).toFixed(2))

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
   * If a rocket launch fails, play a quick 3-second animation of the failure;
   * if it succeeds, let the full animation play out.
   */
  get durationSeconds(): number {
    if (this.computedResult.mode !== 'payload-only' && !this.computedResult.rocketPassed) {
      return 3
    }
    return 18
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
    const totalSec = this.durationSeconds === 3 ? 3 : 45
    const tSec = Math.round(p * totalSec)
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
    const launch = getLaunchSetup(this.design)
    const tiltRad = ((90 - launch.railAngleDeg) * Math.PI) / 180

    this.frame.phase = ascentP < 0.92 ? 'rocket-ascent' : 'apogee-sep'
    this.frame.canDeployChute = false
    this.frame.chuteOpen = false
    this.frame.splatterProgress = 0

    // Smooth ease-out curve to apogee
    const altCurve = 1 - Math.pow(1 - ascentP, 2.1)
    const altFt = r.apogeeFt * altCurve
    const crossX = Math.sin(tiltRad) * altFt * 0.18

    this.frame.rocketThrusting = ascentP < 0.42 && r.rocketOutcome !== 'pad-stall'
    this.frame.rocketShredded = r.rocketOutcome === 'structural-shred' && ascentP > 0.52

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
    this.frame.hudSpeedFps = Math.round((1 - ascentP) * r.telemetry.maxMach * 1116)
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
