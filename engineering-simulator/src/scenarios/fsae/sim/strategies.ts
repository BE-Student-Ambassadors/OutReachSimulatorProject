import { getBusiness, getElectrical, getMechanical, getSoftware, JOINTS, POWER_PATHS } from '../config'
import type {
  BusinessObject,
  Deal,
  ElectricalObject,
  FrontWingId,
  FsaeObject,
  LineWork,
  MechanicalObject,
  PowerPart,
  PowerPathId,
  SensorId,
  SoftwareObject,
  SponsorId,
} from '../types'
import { payoutFor } from './business'
import { lineBoard, sensorBoard, zoneAt } from './harness'

/** Reference designs for balancing tests. Not shown to students. */

export interface MechSpec {
  front: FrontWingId
  rear: number
  wheelbase: number
  track: number
  ride: number
  weld?: number
}

export function mech(s: MechSpec): MechanicalObject {
  return {
    ...getMechanical([]),
    welds: JOINTS.map(() => s.weld ?? 1),
    frontWing: s.front,
    rearWing: s.rear,
    wheelbaseMm: s.wheelbase,
    trackMm: s.track,
    rideHeightMm: s.ride,
    touchedWings: true,
    touchedSize: true,
    tunnelRuns: 1,
    updatedAt: 1,
  }
}

export const R = (value: number): PowerPart => ({ type: 'resistor', value })
export const B = (value: number): PowerPart => ({ type: 'booster', value })

const SEED = 4242

export interface SpliceSpec {
  part: PowerPart
  /** Where along the wire to cut (default: the middle of its first clear stretch). */
  cutAt?: number
  crimp?: number
  routed?: boolean
}

/** A spliced wire: cut, crimped, part fitted and (by default) routed with the board's own solution. */
export function splice(path: PowerPathId, s: SpliceSpec, seed = SEED): LineWork {
  const cutAt = s.cutAt ?? clearSpot(path)
  const zone = zoneAt(path, cutAt).zone
  const q = s.crimp ?? 1
  return { cutAt, crimps: [q, q], part: s.part, routes: s.routed === false ? {} : { ...lineBoard(seed, path, zone).solution } }
}

/** A spot on a clear stretch of the wire. */
function clearSpot(path: PowerPathId): number {
  return [0.5, 0.2, 0.3, 0.15, 0.85, 0.9].find((t) => zoneAt(path, t).zone === 'clear') ?? 0.5
}

export const ALL_SENSORS: Partial<Record<SensorId, string>> = { camera: 'camera-hoop', wheel: 'wheel-front' }

export function elec(
  lines: Partial<Record<PowerPathId, SpliceSpec>>,
  mounts: Partial<Record<SensorId, string>> = ALL_SENSORS,
  sensorWires = true,
  seed = SEED,
): ElectricalObject {
  const base = getElectrical([])
  const out: ElectricalObject = { ...base, seed, mounts: { ...base.mounts, ...mounts }, sensorRoutes: sensorWires ? { ...sensorBoard(seed).solution } : {}, updatedAt: 1 }
  for (const p of POWER_PATHS) {
    const s = lines[p.id]
    if (s) out.lines = { ...out.lines, [p.id]: splice(p.id, s, seed) }
  }
  return out
}

/** Every wire in range: 40 V motor, 5 V computer. */
export const GOOD_LINES: Record<PowerPathId, SpliceSpec> = {
  motor: { part: R(0.8) },
  computer: { part: R(3.5) },
}
export const goodPower = () => elec(GOOD_LINES)

/** A software station with the first `cleared` graph courses done (Easy, then Medium, then Hard). */
export function software(opts: { cleared?: number; seed?: number } = {}): SoftwareObject {
  const n = opts.cleared ?? 3
  const level = (i: number) => ({ cleared: i < n, shots: i < n ? 4 : 0, solution: i < n ? '0.2x + 2sin(0.6x)' : null })
  return { ...getSoftware([]), seed: opts.seed ?? SEED, levels: { easy: level(0), medium: level(1), hard: level(2) }, updatedAt: 1 }
}

const paidDeal = (sponsorId: SponsorId, agreed: number, effort: number): Deal => ({
  sponsorId,
  stage: 'paid',
  agreed,
  offer: agreed,
  countered: false,
  flyer: null,
  effort,
  payout: payoutFor(agreed, effort),
})

/** Three sponsors, each sent a flyer with a fair amount of work in it. */
export function businessDone(): BusinessObject {
  return {
    ...getBusiness([]),
    seed: SEED,
    deals: [paidDeal('nimbus', 5000, 0.6), paidDeal('voltcell', 4500, 0.6), paidDeal('harbor', 3000, 0.6)],
    updatedAt: 1,
  }
}

/** One small deal and a flyer sent in with almost no work on it. */
export function businessRushed(): BusinessObject {
  return {
    ...getBusiness([]),
    seed: SEED,
    deals: [paidDeal('slice', 1500, 0.1)],
    updatedAt: 1,
  }
}

function team(m: MechSpec, extra: FsaeObject[] = []): FsaeObject[] {
  return [mech(m), goodPower(), software(), businessDone(), ...extra]
}

/** Big wings, low floor: lots of grip, lots of drag. */
export const downforce = () => team({ front: 'triple', rear: 90, wheelbase: 1575, track: 1300, ride: 32 })
/** Wings mostly tucked in, long car: fast on the straight, careful in corners. */
export const lowDrag = () => team({ front: 'flat', rear: 30, wheelbase: 1700, track: 1250, ride: 30 })
/** Middle of the road everywhere. */
export const balanced = () => team({ front: 'single', rear: 60, wheelbase: 1650, track: 1200, ride: 40 })
/** Narrow, short and cheap, wings half out. */
export const budget = () => team({ front: 'dual', rear: 55, wheelbase: 1525, track: 1100, ride: 35 })

const MID: MechSpec = { front: 'dual', rear: 70, wheelbase: 1600, track: 1250, ride: 34 }

/** Nothing done at all. */
export const empty = (): FsaeObject[] => []

/** Everything finished except the electrical station: raw voltages, no sensors. */
export const noElectrical = (): FsaeObject[] => [mech(MID), software(), businessDone()]

/** Biggest front wing, rear wing tucked: the car is badly unbalanced. */
export const unbalanced = () => team({ front: 'triple', rear: 0, wheelbase: 1600, track: 1250, ride: 40 })

/** Ride height so low the floor hits the bumps. */
export const scraping = () => team({ front: 'dual', rear: 70, wheelbase: 1600, track: 1250, ride: 16 })

/** Frame barely welded. */
export const sloppyWelds = () => team({ ...MID, weld: 0.3 })

/** The software engineer never touched the station: no path-planning code at all. */
export const untouchedSoftware = () => [mech(MID), goodPower(), { ...getSoftware([]), seed: SEED }, businessDone()]

/** Only the Easy graph course cleared: the planner crawls down the middle of the course. */
export const easyOnly = () => [mech(MID), goodPower(), software({ cleared: 1 }), businessDone()]

/** Easy and Medium cleared, Hard not. */
export const twoCourses = () => [mech(MID), goodPower(), software({ cleared: 2 }), businessDone()]

/** Hard cleared but not Medium: courses count in order, so only Easy counts. */
export const skippedMedium = (): FsaeObject[] => {
  const sw = software({ cleared: 3 })
  return [mech(MID), goodPower(), { ...sw, levels: { ...sw.levels, medium: { cleared: false, shots: 9, solution: null } } }, businessDone()]
}




/** Wheel-speed sensor on a driven wheel. */
export const rearWheelSensor = () => [mech(MID), elec(GOOD_LINES, { ...ALL_SENSORS, wheel: 'wheel-rear' }), software(), businessDone()]

/** No camera or wheel-speed sensor: only the LiDAR the car comes with. */
export const lidarOnly = () => [mech(MID), elec(GOOD_LINES, {}, false), software(), businessDone()]

/** Computer wire cut but never spliced back together: the computer has no power. */
export const cutComputer = (): FsaeObject[] => {
  const e = elec(GOOD_LINES)
  return [mech(MID), { ...e, lines: { ...e.lines, computer: { ...e.lines.computer, crimps: [null, null], part: null } } }, software(), businessDone()]
}

/** Great car, one rushed flyer. */
export const brokeTeam = () => [mech(MID), goodPower(), software(), businessRushed()]

/** Motor left at 48 V: the controller protects it by limiting power. */
export const hotMotor = () => [mech(MID), elec({ ...GOOD_LINES, motor: undefined }), software(), businessDone()]

/** Motor splice crimped badly right next to the motor: the hot connections drop volts. */
export const hotCrimp = () => [mech(MID), elec({ ...GOOD_LINES, motor: { part: R(0.8), cutAt: 0.85, crimp: 0.3 } }), software(), businessDone()]

/** Computer splice crimped weakly under the pedal box: it shakes loose. */
export const looseCrimp = () => [mech(MID), elec({ ...GOOD_LINES, computer: { part: R(3.5), cutAt: 0.4, crimp: 0.4 } }), software(), businessDone()]

/** Everything spliced and in range, but nothing tied down. */
export const untidy = () =>
  [mech(MID), elec(Object.fromEntries(POWER_PATHS.map((p) => [p.id, { ...GOOD_LINES[p.id], routed: false }]))), software(), businessDone()]
