import type {
  AirframeMaterialId,
  AirframeObject,
  ChuteSizeId,
  FinProfileId,
  GyroConfigObject,
  ImpulseClassId,
  LaunchSetupObject,
  NoseConeId,
  PayloadMotorId,
  PayloadMotorObject,
  PayloadTestRigObject,
  RocketBayId,
  RocketObject,
  RocketProgramId,
  RocketVariantId,
  WeightDistObject,
} from './types'

export const BUDGET = 120_000

export const REQUIRED = {
  /** IREC target altitude in feet. */
  targetApogeeFt: 10_000,
  /** Maximum allowed apogee error (+/- ft from 10,000 ft) to pass Rocket Altitude requirement. */
  maxApogeeErrorFt: 850,
  /** Maximum landing distance from target bullseye pad (ft) for an intact payload. */
  maxLandingDistFt: 50,
  /** Minimum average gyroscope calibration score (0..100) to avoid spin-out. */
  minGyroCalibrationPct: 75,
  /** Minimum motor torque (N*m) required in standard vs crosswind to prevent spin-out. */
  minMotorTorqueNm: 2.2,
  minMotorTorqueCrosswindNm: 3.8,
  /** Maximum payload motor mass (kg) before descent rate overloads the landing structure (splatter!). */
  maxMotorMassKg: 5.5,
} as const

export const VARIANTS: Record<
  RocketVariantId,
  {
    label: string
    blurb: string
    windMph: number
    turbulenceFactor: number
    mode: 'full' | 'payload-only' | 'rocket-only'
  }
> = {
  standard: {
    label: 'Full IREC Mission',
    blurb: '10,000 ft launch + payload drop',
    windMph: 10,
    turbulenceFactor: 1.0,
    mode: 'full',
  },
  'payload-drop': {
    label: 'Payload Drop Test',
    blurb: 'Drop test from crane/drone',
    windMph: 10,
    turbulenceFactor: 1.0,
    mode: 'payload-only',
  },
  'rocket-launch': {
    label: 'Rocket Flight Test',
    blurb: 'Ascent & apogee test',
    windMph: 10,
    turbulenceFactor: 1.0,
    mode: 'rocket-only',
  },
  crosswind: {
    label: 'Desert Crosswind Finals',
    blurb: '24 mph gusting desert wind',
    windMph: 24,
    turbulenceFactor: 1.35,
    mode: 'full',
  },
}

export interface PayloadMotorSpec {
  id: PayloadMotorId
  name: string
  massKg: number
  torqueNm: number
  powerW: number
  cost: number
  specLine: string
}

export const PAYLOAD_MOTORS: Record<PayloadMotorId, PayloadMotorSpec> = {
  'micro-gimbal': {
    id: 'micro-gimbal',
    name: 'Micro Brushless 40W',
    massKg: 0.6,
    torqueNm: 0.6,
    powerW: 40,
    cost: 4_000,
    specLine: '0.6 kg · 0.6 N·m torque · Ultralight camera gimbal motor',
  },
  'light-servo': {
    id: 'light-servo',
    name: 'NEMA-17 Reaction Servo 110W',
    massKg: 1.3,
    torqueNm: 1.4,
    powerW: 110,
    cost: 9_000,
    specLine: '1.3 kg · 1.4 N·m torque · Small reaction wheel drive',
  },
  'aero-torque': {
    id: 'aero-torque',
    name: 'Aerospace Torque Drive 260W',
    massKg: 2.7,
    torqueNm: 3.2,
    powerW: 260,
    cost: 18_000,
    specLine: '2.7 kg · 3.2 N·m torque · Flight-grade reaction control motor',
  },
  'carbon-twin': {
    id: 'carbon-twin',
    name: 'Carbon-Pro Twin Gimbal 380W',
    massKg: 3.4,
    torqueNm: 4.6,
    powerW: 380,
    cost: 28_000,
    specLine: '3.4 kg · 4.6 N·m torque · High-authority dual reaction wheel',
  },
  'heavy-iron': {
    id: 'heavy-iron',
    name: 'Industrial Cast-Iron Drive 950W',
    massKg: 9.8,
    torqueNm: 8.5,
    powerW: 950,
    cost: 12_000,
    specLine: '9.8 kg · 8.5 N·m torque · Heavy industrial cast-iron housing',
  },
}

export interface ChuteSpec {
  id: ChuteSizeId
  name: string
  diameterM: number
  dragAreaM2: number
  cost: number
  specLine: string
}

export const CHUTE_SPECS: Record<ChuteSizeId, ChuteSpec> = {
  'drogue-small': {
    id: 'drogue-small',
    name: '1.2 m Drogue Canopy',
    diameterM: 1.2,
    dragAreaM2: 1.1,
    cost: 3_000,
    specLine: 'Fast descent · Low wind drift, high landing speed',
  },
  'main-standard': {
    id: 'main-standard',
    name: '2.4 m Cruciform Main Chute',
    diameterM: 2.4,
    dragAreaM2: 4.2,
    cost: 8_000,
    specLine: 'Balanced descent rate and stability for 4–8 kg payloads',
  },
  'tandem-large': {
    id: 'tandem-large',
    name: '3.4 m Tandem Parafoil',
    diameterM: 3.4,
    dragAreaM2: 6.2,
    cost: 15_000,
    specLine: 'Softest landing · Catches more crosswind during descent',
  },
}

export interface RocketBaySpec {
  id: RocketBayId
  label: string
  shortLabel: string
  baseMassKg: number
  color: string
  description: string
}

export const ROCKET_BAYS: Record<RocketBayId, RocketBaySpec> = {
  'nose-ballast': {
    id: 'nose-ballast',
    label: 'Tungsten Trim Ballast',
    shortLabel: 'Ballast',
    baseMassKg: 2.2,
    color: '#475569',
    description: 'Dense nose weight that shifts Center of Gravity (CG) forward.',
  },
  'payload-bay': {
    id: 'payload-bay',
    label: 'IREC Payload Module',
    shortLabel: 'Payload',
    baseMassKg: 3.2, // plus chosen payload motor mass!
    color: '#d97706',
    description: 'Carries the gyroscope, reaction motor, and recovery rig.',
  },
  'avionics-bay': {
    id: 'avionics-bay',
    label: 'Avionics & GPS Telemetry',
    shortLabel: 'Avionics',
    baseMassKg: 1.6,
    color: '#0284c7',
    description: 'Barometric altimeter, flight computer, and dual-deploy charges.',
  },
  'recovery-bay': {
    id: 'recovery-bay',
    label: 'Airframe Recovery Harness',
    shortLabel: 'Recovery',
    baseMassKg: 2.4,
    color: '#16a34a',
    description: ' Kevlar shock cords and airframe recovery parachutes.',
  },
  'propellant-tank': {
    id: 'propellant-tank',
    label: 'APCP Propellant Grain Case',
    shortLabel: 'Propellant',
    baseMassKg: 11.5,
    color: '#dc2626',
    description: 'High-mass solid composite propellant grains.',
  },
  'motor-nozzle': {
    id: 'motor-nozzle',
    label: 'Booster Casing & Graphite Nozzle',
    shortLabel: 'Booster Nozzle',
    baseMassKg: 7.8,
    color: '#7c3aed',
    description: 'Thrust structure and nozzle. Must be at the tail to exhaust!',
  },
}

/**
 * Default starting bay order is intentionally top-heavy/scrambled (propellant & nozzle misplaced)
 * so the starting design fails until the Weight Distribution Engineer orders it properly.
 */
export const DEFAULT_BAY_ORDER: RocketBayId[] = [
  'propellant-tank',
  'recovery-bay',
  'motor-nozzle',
  'avionics-bay',
  'payload-bay',
  'nose-ballast',
]

/** Ideal forward-to-aft order that places CG ahead of CP with nozzle at the aft end. */
export const IDEAL_BAY_ORDER: RocketBayId[] = [
  'nose-ballast',
  'payload-bay',
  'avionics-bay',
  'recovery-bay',
  'propellant-tank',
  'motor-nozzle',
]

export interface AirframeMaterialSpec {
  id: AirframeMaterialId
  name: string
  massKg: number
  maxQLimitKpa: number
  cost: number
  specLine: string
}

export const AIRFRAME_MATERIALS: Record<AirframeMaterialId, AirframeMaterialSpec> = {
  cardboard: {
    id: 'cardboard',
    name: 'Phenolic Kraft Cardboard',
    massKg: 3.5,
    maxQLimitKpa: 28,
    cost: 6_000,
    specLine: '3.5 kg · Max-Q limit 28 kPa · Light & cheap, weak at supersonic speed',
  },
  aluminum: {
    id: 'aluminum',
    name: '6061-T6 Aerospace Aluminum',
    massKg: 9.2,
    maxQLimitKpa: 85,
    cost: 20_000,
    specLine: '9.2 kg · Max-Q limit 85 kPa · Strong metallic airframe, heavier',
  },
  fiberglass: {
    id: 'fiberglass',
    name: 'S-Glass Filament Fiberglass',
    massKg: 5.8,
    maxQLimitKpa: 78,
    cost: 28_000,
    specLine: '5.8 kg · Max-Q limit 78 kPa · Balanced strength-to-weight composite',
  },
  carbon: {
    id: 'carbon',
    name: 'Autoclave Carbon Fiber',
    massKg: 4.1,
    maxQLimitKpa: 110,
    cost: 44_000,
    specLine: '4.1 kg · Max-Q limit 110 kPa · Ultra-light, highest stiffness',
  },
  steel: {
    id: 'steel',
    name: 'Welded Schedule-40 Steel',
    massKg: 21.0,
    maxQLimitKpa: 140,
    cost: 10_000,
    specLine: '21.0 kg · Max-Q limit 140 kPa · Extremely heavy structural tube',
  },
}

export interface NoseConeSpec {
  id: NoseConeId
  name: string
  dragCd: number
  cpShiftCal: number
  cost: number
  specLine: string
}

export const NOSE_CONES: Record<NoseConeId, NoseConeSpec> = {
  blunt: {
    id: 'blunt',
    name: 'Blunt Hemispherical',
    dragCd: 0.68,
    cpShiftCal: -0.2,
    cost: 2_000,
    specLine: 'Cd 0.68 · High wave drag above Mach 0.7',
  },
  conical: {
    id: 'conical',
    name: '15° Conical Nose',
    dragCd: 0.48,
    cpShiftCal: 0.0,
    cost: 5_000,
    specLine: 'Cd 0.48 · Simple Mach-capable cone',
  },
  ogive: {
    id: 'ogive',
    name: 'Tangent Ogive',
    dragCd: 0.36,
    cpShiftCal: 0.15,
    cost: 9_000,
    specLine: 'Cd 0.36 · Smooth aerodynamic profile',
  },
  'von-karman': {
    id: 'von-karman',
    name: 'Von Kármán Haack Series',
    dragCd: 0.29,
    cpShiftCal: 0.25,
    cost: 14_000,
    specLine: 'Cd 0.29 · Minimum transonic wave drag',
  },
}

export interface FinProfileSpec {
  id: FinProfileId
  name: string
  cpCalibersFromNose: number
  dragDeltaCd: number
  flutterLimitKpa: number
  cost: number
  specLine: string
}

export const FIN_PROFILES: Record<FinProfileId, FinProfileSpec> = {
  rectangular: {
    id: 'rectangular',
    name: 'Large Rectangular Fins',
    cpCalibersFromNose: 7.4,
    dragDeltaCd: 0.14,
    flutterLimitKpa: 45,
    cost: 3_000,
    specLine: 'High drag · Prone to fin flutter at high dynamic pressure',
  },
  trapezoidal: {
    id: 'trapezoidal',
    name: 'Tapered Trapezoidal Fins',
    cpCalibersFromNose: 7.9,
    dragDeltaCd: 0.06,
    flutterLimitKpa: 85,
    cost: 8_000,
    specLine: 'Balanced CP authority (7.9 cal) and low transonic drag',
  },
  'clipped-delta': {
    id: 'clipped-delta',
    name: 'Swept Clipped-Delta Fins',
    cpCalibersFromNose: 8.3,
    dragDeltaCd: 0.04,
    flutterLimitKpa: 115,
    cost: 13_000,
    specLine: 'Shifts CP furthest aft (8.3 cal) · Highest flutter resistance',
  },
}

export interface ImpulseSpec {
  id: ImpulseClassId
  name: string
  totalImpulseNs: number
  peakDynamicPressureKpa: number
  cost: number
  specLine: string
}

export const IMPULSE_CLASSES: Record<ImpulseClassId, ImpulseSpec> = {
  'l-class': {
    id: 'l-class',
    name: 'L-Class 65% Grain Load',
    totalImpulseNs: 4_600,
    peakDynamicPressureKpa: 24,
    cost: 6_000,
    specLine: '4,600 N·s impulse · Low peak altitude (~5,800 ft)',
  },
  'm-class': {
    id: 'm-class',
    name: 'M-Class 88% Grain Load',
    totalImpulseNs: 8_400,
    peakDynamicPressureKpa: 52,
    cost: 12_000,
    specLine: '8,400 N·s impulse · Tuned for ultra-light carbon airframes',
  },
  'n-class': {
    id: 'n-class',
    name: 'N-Class 100% IREC Standard',
    totalImpulseNs: 10_200,
    peakDynamicPressureKpa: 64,
    cost: 16_000,
    specLine: '10,200 N·s impulse · Standard 10,000 ft IREC motor',
  },
  'o-class': {
    id: 'o-class',
    name: 'O-Class 125% Overpressure',
    totalImpulseNs: 14_800,
    peakDynamicPressureKpa: 92,
    cost: 24_000,
    specLine: '14,800 N·s impulse · Overshoots 10,000 ft unless very heavy',
  },
}

export const PROGRAM_SPECS: Record<
  RocketProgramId,
  { id: RocketProgramId; label: string; cost: number; summary: string }
> = {
  reefing: {
    id: 'reefing',
    label: 'Stepped Parachute Reefing',
    cost: 8_000,
    summary: 'Opens canopy in two stages to reduce opening shock and cut wind drift by 35%.',
  },
  carbonFins: {
    id: 'carbonFins',
    label: 'Carbon Tip-to-Tip Fin Layup',
    cost: 9_000,
    summary: 'Reinforces fin roots and airframe joints (+25 kPa structural Max-Q margin).',
  },
  windSonde: {
    id: 'windSonde',
    label: 'GPS Wind-Sonde Telemetry',
    cost: 7_000,
    summary: 'Measures upper-air wind shear before drop, reducing landing drift error by 40%.',
  },
}

export const STATION_COSTS = {
  gyroCalibration: 5_000, // base instrumentation cost once calibrated
}

// ---- Default state extractors (used by both headless sim and 3D/station UI) ----

export function getGyroConfig(design: RocketObject[]): GyroConfigObject {
  const found = design.find((o): o is GyroConfigObject => o.kind === 'gyro')
  return (
    found ?? {
      id: 'station:payload-gyro',
      kind: 'gyro',
      rollScore: 28,
      pitchScore: 35,
      yawScore: 22,
      updatedAt: 0,
    }
  )
}

export function getPayloadMotor(design: RocketObject[]): PayloadMotorObject {
  const found = design.find((o): o is PayloadMotorObject => o.kind === 'payloadMotor')
  return (
    found ?? {
      id: 'station:payload-motor',
      kind: 'payloadMotor',
      motorId: 'micro-gimbal', // starts with too-weak motor by default
      updatedAt: 0,
    }
  )
}

export function getPayloadTestRig(design: RocketObject[]): PayloadTestRigObject {
  const found = design.find((o): o is PayloadTestRigObject => o.kind === 'payloadTest')
  return (
    found ?? {
      id: 'station:payload-tester',
      kind: 'payloadTest',
      dropAltitudeFt: 3500,
      armedChuteAltFt: 350, // starts dangerously low so default drop test splatters or drifts
      windLeadDeg: 0,
      chuteSize: 'drogue-small',
      updatedAt: 0,
    }
  )
}

export function getWeightDist(design: RocketObject[]): WeightDistObject {
  const found = design.find((o): o is WeightDistObject => o.kind === 'weightDist')
  return (
    found ?? {
      id: 'station:rocket-mass',
      kind: 'weightDist',
      bayOrder: [...DEFAULT_BAY_ORDER],
      updatedAt: 0,
    }
  )
}

export function getAirframe(design: RocketObject[]): AirframeObject {
  const found = design.find((o): o is AirframeObject => o.kind === 'airframe')
  return (
    found ?? {
      id: 'station:rocket-material',
      kind: 'airframe',
      materialId: 'cardboard',
      noseConeId: 'blunt',
      finProfileId: 'rectangular',
      updatedAt: 0,
    }
  )
}

export function getLaunchSetup(design: RocketObject[]): LaunchSetupObject {
  const found = design.find((o): o is LaunchSetupObject => o.kind === 'launchSetup')
  return (
    found ?? {
      id: 'station:rocket-tester',
      kind: 'launchSetup',
      railAngleDeg: 89,
      impulseId: 'l-class',
      ballastTrimKg: 0,
      updatedAt: 0,
    }
  )
}

export function hasProgram(design: RocketObject[], program: RocketProgramId): boolean {
  return design.some((o) => o.kind === 'program' && o.program === program)
}
