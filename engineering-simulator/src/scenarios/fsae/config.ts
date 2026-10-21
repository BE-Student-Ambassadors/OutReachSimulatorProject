import type {
  BusinessObject,
  ColorRule,
  ElectricalObject,
  FrontWingId,
  FsaeObject,
  FsaeVariantId,
  GraphLevelState,
  LineWork,
  MechanicalObject,
  PowerPathId,
  ScanFeatureId,
  SensorId,
  SoftwareObject,
  SpliceZone,
  SponsorId,
} from './types'

// ---------------------------------------------------------------- requirements

export const REQUIRED = {
  /** Autocross lap time, seconds. */
  maxLapS: 31.8,
  /** Cones the driverless car may hit on its lap. */
  maxConesHit: 2,
  /** Driverless lap time, seconds. */
  maxDriverlessS: 37.5,
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
  baseCar: 11000,
  rearWing: 1300,
  /** Extra tubing and longer arms for a longer or wider car, per mm. */
  perMmWheelbase: 4,
  perMmTrack: 6,
  resistor: 40,
  booster: 450,
  /** Two crimp connectors per splice. */
  crimpPair: 6,
} as const

// ---------------------------------------------------------------- mechanical

/** Corners of the chassis frame, meters (x forward, y up, z right). The frame tubes run between them. */
export const FRAME_NODES: { x: number; y: number; z: number }[] = [
  { x: 0.95, y: 0.28, z: -0.22 }, // front bulkhead, left
  { x: 0.95, y: 0.28, z: 0.22 }, // front bulkhead, right
  { x: 0.35, y: 0.62, z: -0.3 }, // front hoop, left
  { x: 0.35, y: 0.62, z: 0.3 }, // front hoop, right
  { x: -0.25, y: 0.95, z: 0 }, // main hoop, top
  { x: -0.25, y: 0.3, z: -0.34 }, // main hoop, left
  { x: -0.25, y: 0.3, z: 0.34 }, // main hoop, right
  { x: -0.85, y: 0.32, z: 0 }, // rear frame
]

/**
 * Frame joints the mechanical engineer welds: one with the seam running straight up and down
 * on the welding bench, one with it running sideways across. Positions come from FRAME_NODES.
 */
export const JOINTS: { x: number; y: number; z: number; label: string; seam: 'vertical' | 'sideways' }[] = [
  { ...FRAME_NODES[4], label: 'Main hoop, top', seam: 'vertical' },
  { ...FRAME_NODES[2], label: 'Front hoop, left', seam: 'sideways' },
]

/** Wall-clock time a newly called race heat turns green. */
export const heatStartTime = () => Date.now() + RACE_COUNTDOWN_S * 1000

export const DIMS = {
  wheelbase: { min: 1525, max: 1800, start: 1600, step: 5 },
  track: { min: 1100, max: 1400, start: 1200, step: 5 },
  rideHeight: { min: 15, max: 80, start: 65, step: 1 },
} as const

export const WING_START: { front: FrontWingId; rear: number } = { front: 'flat', rear: 10 }

export interface FrontWingSpec {
  id: FrontWingId
  label: string
  /** What it is (never what it does for the lap). */
  blurb: string
  /** Number of stacked wing elements, for the drawing. */
  elements: number
  /** Downforce coefficient (½·ρ·CL·A, N per (m/s)²). */
  cl: number
  /** Drag coefficient (½·ρ·CD·A, N per (m/s)²). */
  cd: number
  kg: number
  cost: number
  /** 0..1, how hard the wing turns the air (drives the drawing and the wind-tunnel smoke). */
  level: number
}

/** The front wing designs the mechanical engineer chooses between. */
export const FRONT_WINGS: FrontWingSpec[] = [
  { id: 'flat', label: 'Flat plate', blurb: 'One flat sheet, barely tilted.', elements: 1, cl: 0.21, cd: 0.017, kg: 3, cost: 600, level: 0.15 },
  { id: 'single', label: 'Single element', blurb: 'One curved wing.', elements: 1, cl: 0.37, cd: 0.044, kg: 3.5, cost: 800, level: 0.4 },
  { id: 'dual', label: 'Two element', blurb: 'A main wing with a flap above it.', elements: 2, cl: 0.52, cd: 0.072, kg: 4.5, cost: 1100, level: 0.65 },
  { id: 'triple', label: 'Three element', blurb: 'A main wing, two stacked flaps and tall endplates.', elements: 3, cl: 0.68, cd: 0.099, kg: 5.5, cost: 1400, level: 0.9 },
]

export const FRONT_WING_BY_ID = Object.fromEntries(FRONT_WINGS.map((w) => [w.id, w])) as Record<FrontWingId, FrontWingSpec>


export const CAR = {
  /** Car without wings plus a 70 kg driver. */
  baseMassKg: 285,
  rearWingKg: 6,
  kgPerMmTrack: 0.03,
  kgPerMmWheelbase: 0.02,
  /** Tire friction coefficient with a perfect frame. */
  tireMu: 1.45,
  /** Downforce coefficient (½·ρ·CL·A, N per (m/s)²). The front wing's comes from FRONT_WINGS. */
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
  { id: 'computer', label: 'Driverless computer', sourceV: 12, sourceLabel: '12 V pack', amps: 2, lo: 4.5, hi: 5.5, summary: 'Runs the self-driving software and reads the sensors.' },
]

export const POWER_PATH_BY_ID = Object.fromEntries(POWER_PATHS.map((p) => [p.id, p])) as Record<PowerPathId, PowerPathSpec>

export const DIALS = {
  resistor: { min: 0, max: 10, step: 0.1, start: 1, unit: 'Ω' },
  booster: { min: 0, max: 12, step: 0.5, start: 2, unit: 'V' },
} as const

export interface HarnessZone {
  /** Stretch of the wire, 0 (power end) .. 1 (part end). */
  from: number
  to: number
  zone: SpliceZone
  /** What is there, as a fact. */
  label: string
}

export interface HarnessSpec {
  /** Wire size (AWG: a smaller number is a thicker wire). */
  awg: number
  /**
   * The wire's path from the power end to the part, meters on the default-size car
   * (x forward from the middle of the wheelbase, y up from the top of the floor, z to the right).
   */
  points: [number, number, number][]
  zones: HarnessZone[]
  /** Direction the close-up camera looks from (toward the middle of the wire). */
  view: [number, number, number]
}

/** The wires of the car's harness, as they run on the frame. */
export const HARNESS: Record<PowerPathId, HarnessSpec> = {
  motor: {
    awg: 10,
    points: [
      [-0.42, 0.39, 0.12],
      [-0.58, 0.4, 0.17],
      [-0.72, 0.32, 0.19],
      [-0.79, 0.22, 0.15],
      [-0.8, 0.17, 0.11],
    ],
    zones: [
      { from: 0, to: 0.4, zone: 'clear', label: 'Over the battery pack' },
      { from: 0.4, to: 0.68, zone: 'moving', label: 'Beside the rear suspension mount: moves over every bump' },
      { from: 0.68, to: 1, zone: 'hot', label: 'Against the motor case: about 85 °C on a lap' },
    ],
    view: [-0.35, 1, 0.75],
  },
  computer: {
    awg: 18,
    points: [
      [0.26, 0.06, 0.18],
      [0.3, 0.03, 0],
      [0.22, 0.03, -0.2],
      [0.1, 0.08, -0.3],
      [0.05, 0.1, -0.31],
    ],
    zones: [
      { from: 0, to: 0.25, zone: 'clear', label: 'Beside the 12 V battery' },
      { from: 0.25, to: 0.6, zone: 'moving', label: 'Under the pedal box: feet and pedals move here' },
      { from: 0.6, to: 1, zone: 'clear', label: 'Left floor rail' },
    ],
    view: [0.45, 1, -0.75],
  },
}

/** Cuts closer than this to either end leave too little wire to crimp. */
export const CUT_MARGIN = 0.08

export { CRIMP, type CrimpDie } from '../../shared/crimp/crimp'

export interface RouteBoardSpec {
  rows: number
  cols: number
  wires: number
}

/** Routing board around a splice: a cut in a clear stretch has more wire to tie down. */
export const ROUTE_BOARDS: Record<SpliceZone, RouteBoardSpec> = {
  clear: { rows: 5, cols: 6, wires: 4 },
  moving: { rows: 4, cols: 5, wires: 3 },
  hot: { rows: 4, cols: 5, wires: 3 },
}

export interface WireSpec {
  id: string
  label: string
  color: string
  /** Pin labels at the two ends. */
  pins: [string, string]
}

/** Wires on a splice's routing board. */
export const SPLICE_WIRES: WireSpec[] = [
  { id: 'pos', label: 'Power (+)', color: '#c8281c', pins: ['PART +', 'LOOM +'] },
  { id: 'neg', label: 'Return (−)', color: '#2a2d2b', pins: ['PART −', 'LOOM −'] },
  { id: 'sense', label: 'Sense', color: '#e1b12c', pins: ['SENSE', 'METER'] },
  { id: 'shield', label: 'Shield', color: '#3f8f4f', pins: ['SHIELD', 'FRAME'] },
]

// ---------------------------------------------------------------- autonomy sensors

export interface SensorSpec {
  id: SensorId
  label: string
  cost: number
  /** What it does, as a fact. */
  summary: string
}

/** The LiDAR comes with the car, already mounted on the front wing pylon and wired to the computer. */
export const LIDAR = { label: 'LiDAR', cost: 1200, mount: 'lidar-wing' } as const

/** The sensors the electrical engineer mounts and wires. */
export const SENSORS: SensorSpec[] = [
  { id: 'camera', label: 'Camera', cost: 350, summary: 'Sees colors, so it can tell the yellow cones (left edge) from the orange cones (right edge).' },
  { id: 'wheel', label: 'Wheel-speed sensor', cost: 120, summary: 'Counts the teeth of a ring on a wheel hub as it turns: how far and how fast that wheel has rolled.' },
]

export interface SensorMountSpec {
  id: string
  sensor: SensorId
  label: string
  /** Mounting point on the default-size car (same axes as HARNESS). */
  pos: [number, number, number]
  /** Facts about this spot. */
  facts: string[]
  /** Extra cost for a bracket. */
  bracket: number
  /** LiDAR / camera: distance it picks out cones on open stretches, m. */
  rangeM?: number
  /** LiDAR: distance in tight turns, where nearer cones hide farther ones. */
  tightRangeM?: number
  /** LiDAR: cones closer than this are under the laser. */
  blindM?: number
  /** Camera: distance it tells cone colors apart under floodlights. */
  nightRangeM?: number
  /** Camera: how much the image shakes, as steering error, m. */
  shakeM?: number
  /** Wheel-speed: steering error from a wrong distance count, m. */
  odometryM?: number
}

export const SENSOR_MOUNTS: SensorMountSpec[] = [
  {
    id: 'lidar-wing',
    sensor: 'lidar',
    label: 'Front wing pylon',
    pos: [1.3, 0.12, 0],
    facts: ['Height 0.2 m, below the tops of the cones.', 'Picks out cones 30 m ahead; in tight turns nearer cones hide farther ones (13 m).', 'Cones closer than 0.8 m are under the laser.'],
    bracket: 60,
    rangeM: 30,
    tightRangeM: 13,
    blindM: 0.8,
  },
  {
    id: 'camera-hoop',
    sensor: 'camera',
    label: 'Top of the main hoop',
    pos: [-0.22, 0.92, 0],
    facts: ['Height 1.2 m: tells cone colors apart 28 m ahead in daylight, 8 m under floodlights.', 'The hoop shakes at speed: the image wobbles about 8 cm.'],
    bracket: 40,
    rangeM: 28,
    nightRangeM: 8,
    shakeM: 0.08,
  },
  {
    id: 'camera-cockpit',
    sensor: 'camera',
    label: 'Cockpit, at eye height',
    pos: [0.15, 0.55, 0],
    facts: ['Height 0.75 m: tells cone colors apart 22 m ahead in daylight, 7 m under floodlights.', 'The image wobbles about 4 cm.'],
    bracket: 40,
    rangeM: 22,
    nightRangeM: 7,
    shakeM: 0.04,
  },
  {
    id: 'camera-nose',
    sensor: 'camera',
    label: 'Tip of the nose',
    pos: [1.12, 0.24, 0],
    facts: ['Height 0.4 m: nearer cones block farther ones, so it tells colors apart 16 m ahead in daylight, 6 m under floodlights.', 'The image wobbles about 2 cm.'],
    bracket: 40,
    rangeM: 16,
    nightRangeM: 6,
    shakeM: 0.02,
  },
  {
    id: 'wheel-front',
    sensor: 'wheel',
    label: 'Front right hub',
    pos: [0.8, 0.1, 0.5],
    facts: ['The front wheels are not driven by the motor: they roll without slipping.', 'Needs a bracket on the upright ($90).'],
    bracket: 90,
    odometryM: 0.03,
  },
  {
    id: 'wheel-rear',
    sensor: 'wheel',
    label: 'Rear right hub',
    pos: [-0.8, 0.1, 0.5],
    facts: ['The rear wheels are driven by the motor: they slip a little when it pushes hard.', 'The upright already has a mounting tab.'],
    bracket: 0,
    odometryM: 0.35,
  },
]

export const MOUNT_BY_ID = Object.fromEntries(SENSOR_MOUNTS.map((m) => [m.id, m])) as Record<string, SensorMountSpec>

/** Sensor cables on their routing board, each from the sensor to a port on the computer. */
export const SENSOR_WIRES: WireSpec[] = [
  { id: 'camera', label: 'Camera cable', color: '#e06a1b', pins: ['CAMERA', 'CPU 1'] },
  { id: 'wheel', label: 'Wheel-speed cable', color: '#2a2d2b', pins: ['WHEEL', 'CPU 2'] },
]
export const SENSOR_BOARD: RouteBoardSpec = { rows: 4, cols: 5, wires: 2 }

// ---------------------------------------------------------------- software (driverless)

export const DRIVERLESS = {
  /** Points along the course where the racing line's offset is set. */
  stations: 48,
  /** Farthest the middle of the car may be drawn from the middle of the course, m. */
  maxOffsetM: 3.9,
  /** Braking the planner counts on when deciding how fast it can go with what it sees, m/s². */
  planBrakeMs2: 9,
  /** Steering error with good sensors, m. */
  baseErrorM: 0.08,
  /** Steering error from counting distance with no wheel-speed sensor at all, m. */
  noWheelErrorM: 0.6,
  /** Grip around the lap is never quite what the planner expects: it dips by up to this share in most places... */
  gripDipBase: 0.05,
  /** ...and by up to this much more in a few dusty corners. */
  gripDipDusty: 0.16,
  dustyCorners: 4,
  /** How far the car slides wide per unit of grip it asked for but didn't have, m. */
  slideWideM: 30,
  coneRadiusM: 0.18,
  /** Places on the lap the car has to tell the left edge from the right edge by color. */
  colorChecks: 24,
  /** Cones hit while a starved computer reboots. */
  rebootHits: 6,
  /** A starved or over-voltage computer runs slow; the planner caps speed to this share. */
  hotComputerPace: 0.9,
} as const

/**
 * The racing line the planner knows how to drive once its code is complete (outside, inside at
 * the apex, outside again), never more than 2.4 m from the middle of the course.
 */
export const PLANNER_LINE = [
  0.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.2, 1.5, 1, 0, -0.2, 0.3, 0, 0.3, -0.6, -1, -2.1, 0.4, 2.4, -2.4, -1.4, 2.4, -2.4, -2.1, 2, -0.8, -0.2, -1.2, -1, -1.6, -2.4,
  -2.4, -2.1, 1, 1.2, 2.4, -0.2, -2.4, -0.9, -2.4, -2.4, -1, 0.9,
]

/**
 * What the path planner can do, by how many graph courses the software engineer cleared (in
 * order). `line`: share of the racing line it dares to drive (0 = the middle of the course);
 * `gripUse`: share of the tires' grip it plans to use; `steady`: how much it wobbles (1 = least).
 */
export const PLANNER_BY_CLEARED: ({ line: number; gripUse: number; steady: number } | null)[] = [
  null,
  { line: 0, gripUse: 0.6, steady: 1.8 },
  { line: 0.5, gripUse: 0.7, steady: 1.35 },
  { line: 1, gripUse: 0.8, steady: 1 },
]

/** The LiDAR software's built-in rule for telling yellow cones from orange ones. */
export const LIDAR_COLOR_RULE: ColorRule = { feature: 'contrast', threshold: 0.9, orangeAbove: true }

/** The LiDAR scan of one cone: beam strengths from bottom to top. */
export const SCAN = {
  beams: 6,
  /** Which beams cross the cone's stripe. */
  stripeBeams: [2, 3],
  /** Return strength (0..100) of each surface up close. Yellow cones have a black stripe, orange cones a white one. */
  yellow: { body: 70, stripe: 26 },
  orange: { body: 40, stripe: 74 },
  /** Strength halves by this distance, m. */
  falloffM: 6,
  noise: 7,
  maxDistM: 30,
  trainCount: 32,
  testCount: 80,
} as const

export const SCAN_FEATURES: { id: ScanFeatureId; label: string; blurb: string; max: number; step: number }[] = [
  { id: 'overall', label: 'Overall strength', blurb: 'Average strength of every beam that hit the cone.', max: 100, step: 1 },
  { id: 'middle', label: 'Middle beams', blurb: 'Average strength of the two middle beams.', max: 100, step: 1 },
  { id: 'contrast', label: 'Middle ÷ ends', blurb: 'Middle beams divided by the top and bottom beams.', max: 3, step: 0.05 },
]

// ---------------------------------------------------------------- business (sponsor deals and flyers)

export interface SponsorSpec {
  id: SponsorId
  name: string
  industry: string
  contact: string
  /** Their opening offer for one flyer. */
  opening: number
  /** The most they will agree to. Hidden from students. */
  ceiling: number
  pitch: string
  brandColor: string
}

export const SPONSORS: SponsorSpec[] = [
  {
    id: 'voltcell',
    name: 'VoltCell',
    industry: 'Battery maker',
    contact: 'Alex, partnerships',
    opening: 3500,
    ceiling: 5500,
    pitch: 'We build batteries for electric cars, so an electric race car is right up our street. We want a flyer for our booth at the auto show.',
    brandColor: '#d99a1e',
  },
  {
    id: 'gripline',
    name: 'GripLine Tires',
    industry: 'Tire maker',
    contact: 'Sam, regional sales',
    opening: 3000,
    ceiling: 5000,
    pitch: 'Every lap you drive is on somebody’s tires. Make us a flyer for our shop counter and we will help pay for the car.',
    brandColor: '#2a2d2b',
  },
  {
    id: 'roadking',
    name: 'RoadKing Auto',
    industry: 'Auto repair shop',
    contact: 'Rosa, owner',
    opening: 2500,
    ceiling: 4500,
    pitch: 'Half our mechanics started out on a school car team. We would love a flyer for the waiting room.',
    brandColor: '#c23b22',
  },
  {
    id: 'nimbus',
    name: 'Nimbus Robotics',
    industry: 'Robotics startup',
    contact: 'Dev, hiring lead',
    opening: 4000,
    ceiling: 6000,
    pitch: 'We make self-driving robots and we are always looking for future engineers. Send us a flyer we can take to the career fair.',
    brandColor: '#7c4dbd',
  },
  {
    id: 'harbor',
    name: 'Harbor Credit Union',
    industry: 'Local bank',
    contact: 'Ms. Lee, community outreach',
    opening: 2500,
    ceiling: 4000,
    pitch: 'We sponsor one student team a semester. Send us a flyer we can post in the lobby.',
    brandColor: '#2c5b3c',
  },
  {
    id: 'slice',
    name: 'Slice Pizza',
    industry: 'Pizza shop',
    contact: 'Tony, owner',
    opening: 1500,
    ceiling: 3000,
    pitch: 'Our customers are your neighbors! Make us a fun flyer for the front window and we will chip in.',
    brandColor: '#e06a1b',
  },
]

export const SPONSOR_BY_ID = Object.fromEntries(SPONSORS.map((s) => [s.id, s])) as Record<SponsorId, SponsorSpec>

/** A finished flyer pays between these shares of the agreed amount, depending on effort. */
export const PAYOUT_MIN_SHARE = 0.5
export const PAYOUT_MAX_SHARE = 1.5

// ---------------------------------------------------------------- race

/** Seconds between trace samples. */
export const TRACE_DT = 0.2
export const CONE_PENALTY_S = 2
/** Seconds from "start race" to green light. */
export const RACE_COUNTDOWN_S = 6

// ---------------------------------------------------------------- station objects

export function getMechanical(design: FsaeObject[]): MechanicalObject {
  const found = design.find((o): o is MechanicalObject => o.kind === 'mechanical')
  // Older saved designs stored the front wing as a slider number: those read as the starting wing.
  if (found) return FRONT_WING_BY_ID[found.frontWing] ? found : { ...found, frontWing: WING_START.front }
  return {
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
}

export const emptyLine = (): LineWork => ({ cutAt: null, crimps: [null, null], part: null, routes: {} })

export function getElectrical(design: FsaeObject[]): ElectricalObject {
  const found = design.find((o): o is ElectricalObject => o.kind === 'electrical')
  const lines = Object.fromEntries(POWER_PATHS.map((p) => [p.id, found?.lines?.[p.id] ?? emptyLine()])) as Record<PowerPathId, LineWork>
  const mounts = { camera: null, wheel: null, ...found?.mounts, lidar: LIDAR.mount }
  // Designs saved before the 3D harness stored parts in slots: those read as an untouched harness.
  if (found?.lines) return { ...found, lines, mounts, sensorRoutes: found.sensorRoutes ?? {} }
  return { id: 'station:electrical', kind: 'electrical', seed: found?.seed ?? 1, lines, mounts, sensorRoutes: {}, updatedAt: found?.updatedAt ?? 0 }
}

export const centerLine = () => Array.from({ length: DRIVERLESS.stations }, () => 0)

const freshLevel = (): GraphLevelState => ({ cleared: false, shots: 0, solution: null })

/** The software station. Its seed is fixed per team once the object exists. */
export function getSoftware(design: FsaeObject[]): SoftwareObject {
  const found = design.find((o): o is SoftwareObject => o.kind === 'software')
  if (found && found.levels?.easy && found.levels.medium && found.levels.hard) return found
  // Designs saved before the graph planner existed keep their seed and start fresh.
  return {
    id: 'station:software',
    kind: 'software',
    seed: found?.seed ?? 1,
    levels: { easy: freshLevel(), medium: freshLevel(), hard: freshLevel() },
    updatedAt: found?.updatedAt ?? 0,
  }
}

/** Graph courses cleared in order (Easy, then Medium, then Hard): 0..3. */
export function coursesCleared(sw: SoftwareObject): number {
  const order = [sw.levels.easy, sw.levels.medium, sw.levels.hard]
  const first = order.findIndex((l) => !l.cleared)
  return first === -1 ? 3 : first
}

export function getBusiness(design: FsaeObject[]): BusinessObject {
  const found = design.find((o): o is BusinessObject => o.kind === 'business')
  if (found && typeof found.seed === 'number' && Array.isArray(found.deals)) return found
  // Designs saved before the sponsor inbox (livery, sponsorship packets) start with no deals.
  return { id: 'station:business', kind: 'business', seed: 0, deals: [], updatedAt: found?.updatedAt ?? 0 }
}

/** Replace (or add) an object, stamping it as the newest version. */
export function upsert(design: FsaeObject[], next: FsaeObject): FsaeObject[] {
  const stamped = { ...next, updatedAt: Math.max(Date.now(), next.updatedAt + 1) } as FsaeObject
  return design.some((o) => o.id === next.id) ? design.map((o) => (o.id === next.id ? stamped : o)) : [...design, stamped]
}
