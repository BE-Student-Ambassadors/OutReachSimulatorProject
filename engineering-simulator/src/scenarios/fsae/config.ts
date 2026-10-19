import type {
  BusinessObject,
  ElectricalObject,
  FeatureId,
  FsaeObject,
  FsaeVariantId,
  MechanicalObject,
  PowerPathId,
  SoftwareObject,
  SponsorId,
  StoryPanel,
  ToyId,
} from './types'

// ---------------------------------------------------------------- requirements

export const REQUIRED = {
  /** Autocross lap time, seconds. */
  maxLapS: 31.8,
  /** Cones the driverless car may hit on its lap. */
  maxConesHit: 2,
} as const

/** Money the team has before any sponsor signs. Not enough to finish the car. */
export const SEED_FUNDS = 6000

export const VARIANTS: Record<FsaeVariantId, { label: string; blurb: string }> = {
  standard: { label: 'Competition Test', blurb: 'Daytime autocross + driverless lap' },
  night: { label: 'Night Test', blurb: 'Same course after dark' },
}

// ---------------------------------------------------------------- costs

export const COSTS = {
  /** Motor, battery pack, tires, steel tubing, seat: what every car needs. */
  baseCar: 9800,
  frontWing: 900,
  rearWing: 1300,
  /** Extra tubing and longer arms for a longer or wider car, per mm. */
  perMmWheelbase: 4,
  perMmTrack: 6,
  resistor: 40,
  booster: 450,
} as const

// ---------------------------------------------------------------- mechanical

/** Frame joints the mechanical engineer welds. Positions are on the chassis, meters (x forward, y up, z right). */
export const JOINTS: { x: number; y: number; z: number; label: string }[] = [
  { x: 0.95, y: 0.28, z: -0.22, label: 'Front bulkhead, left' },
  { x: 0.95, y: 0.28, z: 0.22, label: 'Front bulkhead, right' },
  { x: 0.35, y: 0.62, z: -0.3, label: 'Front hoop, left' },
  { x: 0.35, y: 0.62, z: 0.3, label: 'Front hoop, right' },
  { x: -0.25, y: 0.95, z: 0, label: 'Main hoop, top' },
  { x: -0.25, y: 0.3, z: -0.34, label: 'Main hoop, left' },
  { x: -0.25, y: 0.3, z: 0.34, label: 'Main hoop, right' },
  { x: -0.85, y: 0.32, z: 0, label: 'Rear frame' },
]

/** The weld heat meter: release inside the window for a solid joint. */
export const WELD = {
  /** Seconds of holding to go from 0 to 100 % heat. */
  fillSeconds: 2.2,
  goodLow: 55,
  goodHigh: 80,
} as const

export function weldQuality(heat: number): { q: number; label: string } {
  if (heat >= WELD.goodLow && heat <= WELD.goodHigh) return { q: 1, label: 'Solid weld' }
  if (heat > WELD.goodHigh) return { q: 0.75, label: 'Too hot: the metal burned through a little' }
  if (heat >= 35) return { q: 0.7, label: 'Cold weld: the metal didn’t fully melt together' }
  return { q: 0.35, label: 'Barely tacked: just a spot of weld' }
}

/** Wall-clock time a newly called race heat turns green. */
export const heatStartTime = () => Date.now() + RACE_COUNTDOWN_S * 1000

export const DIMS = {
  wheelbase: { min: 1525, max: 1800, start: 1600, step: 5 },
  track: { min: 1100, max: 1400, start: 1200, step: 5 },
  rideHeight: { min: 15, max: 80, start: 65, step: 1 },
} as const

export const WING_START = { front: 10, rear: 10 }

export const CAR = {
  /** Car without wings plus a 70 kg driver. */
  baseMassKg: 285,
  frontWingKg: 4,
  rearWingKg: 6,
  kgPerMmTrack: 0.03,
  kgPerMmWheelbase: 0.02,
  /** Tire friction coefficient with a perfect frame. */
  tireMu: 1.45,
  /** Downforce coefficient (½·ρ·CL·A, N per (m/s)²). */
  clFrontBase: 0.12,
  clFrontPerPct: 0.0062,
  clRearBase: 0.14,
  clRearPerPct: 0.0085,
  /** Floor ground effect: full below `floorFullMm`, none above `floorNoneMm`. */
  clFloorMax: 0.42,
  floorFullMm: 30,
  floorNoneMm: 70,
  /** Below this, the floor hits the bumps and the ground effect drops. */
  bottomOutMm: 28,
  /** Drag coefficient (½·ρ·CD·A, N per (m/s)²). */
  cdBase: 0.44,
  cdFrontPerPct: 0.0011,
  cdRearPerPct: 0.0034,
  cdPerMmTrack: 0.0003,
  rollingCoef: 0.015,
  /** Motor output at exactly the middle of its rated voltage, watts. */
  ratedPowerW: 62000,
  /** What the motor controller allows when the motor is over-voltage. */
  protectPowerW: 38000,
  /** Front share of downforce that feels neutral. */
  balanceLow: 0.36,
  balanceHigh: 0.52,
} as const

// ---------------------------------------------------------------- electrical

export interface PowerPathSpec {
  id: PowerPathId
  label: string
  /** What arrives at the component with nothing added, volts. */
  sourceV: number
  /** Where the voltage comes from, as shown on the schematic. */
  sourceLabel: string
  /** Current the component draws, amps (used for V = I × R). */
  amps: number
  lo: number
  hi: number
  /** Factual description of what the part does. */
  summary: string
}

export const POWER_PATHS: PowerPathSpec[] = [
  { id: 'motor', label: 'Drive motor', sourceV: 48, sourceLabel: '48 V main pack', amps: 10, lo: 38, hi: 42, summary: 'Turns the rear wheels. More voltage, more power.' },
  { id: 'pump', label: 'Cooling pump', sourceV: 48, sourceLabel: '48 V main pack', amps: 4, lo: 22, hi: 26, summary: 'Pushes coolant through the motor so it stays cool.' },
  { id: 'headlights', label: 'Headlights', sourceV: 9, sourceLabel: '12 V pack (long wire, 9 V arrives)', amps: 3, lo: 11.5, hi: 13, summary: 'Lights the track ahead for the driver and the cameras.' },
  { id: 'brake', label: 'Brake light', sourceV: 10, sourceLabel: '12 V pack (10 V arrives)', amps: 1, lo: 11, hi: 13, summary: 'Required by the rules: shows when the car is braking.' },
  { id: 'computer', label: 'Driverless computer', sourceV: 12, sourceLabel: '12 V pack', amps: 2, lo: 4.5, hi: 5.5, summary: 'Runs the self-driving software and reads the cameras.' },
]

export const POWER_PATH_BY_ID = Object.fromEntries(POWER_PATHS.map((p) => [p.id, p])) as Record<PowerPathId, PowerPathSpec>

export const DIALS = {
  resistor: { min: 0, max: 10, step: 0.1, start: 1, unit: 'Ω' },
  booster: { min: 0, max: 12, step: 0.5, start: 2, unit: 'V' },
} as const

// ---------------------------------------------------------------- software

export const FEATURES: { id: FeatureId; label: string; symbol: string }[] = [
  { id: 'shape', label: 'Shape', symbol: 'x₁' },
  { id: 'color', label: 'Color', symbol: 'x₂' },
  { id: 'stripe', label: 'Stripe', symbol: 'x₃' },
  { id: 'size', label: 'Size', symbol: 'x₄' },
]

/** The answer choices offered in every data round (one of them is the real difference). */
export const DIFFERENCE_CHOICES = ['Shape', 'Color', 'Stripe', 'Size', 'Brightness', 'Background'] as const

export const TEST_SET_SIZE = 40
/** Number of cone gates the driverless car must read on its lap. */
export const DRIVERLESS_GATES = 40

// ---------------------------------------------------------------- business

export interface SponsorSpec {
  id: SponsorId
  name: string
  industry: string
  /** Most they will ever pay. */
  maxOffer: number
  brandColor: string
  /** Words in captions that interest them. */
  keywords: string[]
  /** Toys that interest them. */
  toys: ToyId[]
  /** What they say they care about (shown to students). */
  cares: string
}

export const SPONSORS: SponsorSpec[] = [
  {
    id: 'voltcell',
    name: 'VoltCell Batteries',
    industry: 'Battery maker',
    maxOffer: 3500,
    brandColor: '#d99a1e',
    keywords: ['electric', 'battery', 'energy', 'power', 'charge', 'volt', 'clean', 'green', 'efficient'],
    toys: ['battery', 'car'],
    cares: 'Electric cars and clean energy',
  },
  {
    id: 'gripline',
    name: 'GripLine Tires',
    industry: 'Tire shop',
    maxOffer: 3000,
    brandColor: '#3a3a3a',
    keywords: ['fast', 'speed', 'grip', 'corner', 'race', 'win', 'track', 'tire', 'lap', 'quick'],
    toys: ['tire', 'flag', 'trophy', 'cone'],
    cares: 'Speed, racing and winning',
  },
  {
    id: 'nimbus',
    name: 'Nimbus Robotics',
    industry: 'Robotics startup',
    maxOffer: 3200,
    brandColor: '#7c4dbd',
    keywords: ['self-driving', 'driverless', 'autonomous', 'robot', 'ai', 'smart', 'data', 'computer', 'code', 'future', 'sensor'],
    toys: ['robot', 'cone'],
    cares: 'Self-driving tech and AI',
  },
  {
    id: 'harbor',
    name: 'Harbor Credit Union',
    industry: 'Local bank',
    maxOffer: 2500,
    brandColor: '#2c5b3c',
    keywords: ['community', 'school', 'student', 'local', 'team', 'together', 'learn', 'town', 'family', 'future'],
    toys: ['school', 'crowd', 'heart'],
    cares: 'Students and the local community',
  },
  {
    id: 'slice',
    name: 'Slice Pizza Co.',
    industry: 'Pizza shop',
    maxOffer: 1500,
    brandColor: '#c23b22',
    keywords: ['pizza', 'fun', 'party', 'celebrate', 'hungry', 'crowd', 'fans', 'friends', 'eat'],
    toys: ['pizza', 'crowd', 'trophy'],
    cares: 'Fun, fans and celebrations',
  },
]

export const SPONSOR_BY_ID = Object.fromEntries(SPONSORS.map((s) => [s.id, s])) as Record<SponsorId, SponsorSpec>

export const TOYS: { id: ToyId; label: string }[] = [
  { id: 'car', label: 'Race car' },
  { id: 'trophy', label: 'Trophy' },
  { id: 'cone', label: 'Cone' },
  { id: 'flag', label: 'Checkered flag' },
  { id: 'tire', label: 'Tire' },
  { id: 'battery', label: 'Battery' },
  { id: 'robot', label: 'Robot' },
  { id: 'school', label: 'School' },
  { id: 'crowd', label: 'Fans' },
  { id: 'pizza', label: 'Pizza' },
  { id: 'wrench', label: 'Wrench' },
  { id: 'heart', label: 'Heart' },
]

export const STORY_BEATS = [
  { title: 'The challenge', prompt: 'What is your team up against?' },
  { title: 'The build', prompt: 'How are you building the car?' },
  { title: 'Race day', prompt: 'What happens on the track?' },
  { title: 'Why join us', prompt: 'What does a sponsor get?' },
]

/** A panel counts as finished with at least this many toys and caption words. */
export const PANEL_MIN_TOYS = 2
export const PANEL_MIN_WORDS = 4

// ---------------------------------------------------------------- race

/** Seconds between trace samples. */
export const TRACE_DT = 0.2
export const CONE_PENALTY_S = 2
/** Seconds from "start race" to green light. */
export const RACE_COUNTDOWN_S = 6

// ---------------------------------------------------------------- station objects

export function getMechanical(design: FsaeObject[]): MechanicalObject {
  return (
    design.find((o): o is MechanicalObject => o.kind === 'mechanical') ?? {
      id: 'station:mechanical',
      kind: 'mechanical',
      welds: JOINTS.map(() => -1),
      frontWing: WING_START.front,
      rearWing: WING_START.rear,
      wheelbaseMm: DIMS.wheelbase.start,
      trackMm: DIMS.track.start,
      rideHeightMm: DIMS.rideHeight.start,
      touchedWings: false,
      touchedSize: false,
      tunnelRuns: 0,
      updatedAt: 0,
    }
  )
}

export function getElectrical(design: FsaeObject[]): ElectricalObject {
  return (
    design.find((o): o is ElectricalObject => o.kind === 'electrical') ?? {
      id: 'station:electrical',
      kind: 'electrical',
      slots: { motor: [null, null], pump: [null, null], headlights: [null, null], brake: [null, null], computer: [null, null] },
      updatedAt: 0,
    }
  )
}

/** The software station. Its seed is fixed per team once the object exists. */
export function getSoftware(design: FsaeObject[]): SoftwareObject {
  return (
    design.find((o): o is SoftwareObject => o.kind === 'software') ?? {
      id: 'station:software',
      kind: 'software',
      seed: 1,
      roundsDone: 0,
      misses: 0,
      weights: FEATURES.map(() => null),
      validatedAccuracy: null,
      updatedAt: 0,
    }
  )
}

export function emptyPanels(): StoryPanel[] {
  return STORY_BEATS.map(() => ({ toys: [], caption: '' }))
}

export function getBusiness(design: FsaeObject[]): BusinessObject {
  return (
    design.find((o): o is BusinessObject => o.kind === 'business') ?? {
      id: 'station:business',
      kind: 'business',
      panels: emptyPanels(),
      deals: [],
      updatedAt: 0,
    }
  )
}

/** Replace (or add) an object, stamping it as the newest version. */
export function upsert(design: FsaeObject[], next: FsaeObject): FsaeObject[] {
  const stamped = { ...next, updatedAt: Math.max(Date.now(), next.updatedAt + 1) } as FsaeObject
  return design.some((o) => o.id === next.id) ? design.map((o) => (o.id === next.id ? stamped : o)) : [...design, stamped]
}
