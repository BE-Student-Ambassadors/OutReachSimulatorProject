import type { RolePrefObject as CoreRolePrefObject } from '../../core/roles'
import type { DesignObject } from '../../core/scenario'

/**
 * Every object carries `updatedAt` (wall-clock ms): the multiplayer layer merges teammates'
 * writes object by object and keeps the newest. Objects are never removed, only updated.
 */

export type FsaeRoleId = 'mechanical' | 'electrical' | 'software' | 'business'

export type FsaeVariantId = 'standard' | 'night'

// ---- Mechanical ----

export type FrontWingId = 'flat' | 'single' | 'dual' | 'triple'

export interface MechanicalObject extends DesignObject {
  id: 'station:mechanical'
  kind: 'mechanical'
  /** Weld quality per frame joint, 0..1. -1 = not welded yet. */
  welds: number[]
  /** Which front wing design is fitted. */
  frontWing: FrontWingId
  /** How far the rear wing is slid out, 0..100 %. */
  rearWing: number
  wheelbaseMm: number
  trackMm: number
  rideHeightMm: number
  /** Which controls have been touched (for the checklist). */
  touchedWings: boolean
  touchedSize: boolean
  tunnelRuns: number
  updatedAt: number
}

// ---- Electrical ----

export type PowerPathId = 'motor' | 'computer'
export type PowerPartType = 'resistor' | 'booster'

export interface PowerPart {
  type: PowerPartType
  /** Ohms for a resistor, added volts for a booster (the dial). */
  value: number
}

/** What a stretch of harness wire runs past: something hot, something that moves, or nothing. */
export type SpliceZone = 'hot' | 'moving' | 'clear'

/** The work on one wire of the harness: cut it, crimp the two new ends, fit a part, tie it down. */
export interface LineWork {
  /** Where the wire was cut, 0 (power end) .. 1 (part end). null = not cut. */
  cutAt: number | null
  /** Quality of the two crimped connectors, 0..1 (power side, part side). null = not crimped. */
  crimps: [number | null, number | null]
  /** The part spliced into the cut. */
  part: PowerPart | null
  /** Routing board wires (Flow puzzle): wire id → board cells, pin to pin. */
  routes: Record<string, number[]>
}

export type SensorId = 'lidar' | 'camera' | 'wheel'

export interface ElectricalObject extends DesignObject {
  id: 'station:electrical'
  kind: 'electrical'
  /** Picks this team's routing boards. */
  seed: number
  lines: Record<PowerPathId, LineWork>
  /** Where each autonomy sensor is mounted (an id from SENSOR_MOUNTS). null = not mounted. */
  mounts: Record<SensorId, string | null>
  /** Routing board for the sensor cables to the driverless computer. */
  sensorRoutes: Record<string, number[]>
  updatedAt: number
}

// ---- Software ----

/** Which number the LiDAR color rule compares, computed from one cone's scan. */
export type ScanFeatureId = 'overall' | 'middle' | 'contrast'

export interface ColorRule {
  feature: ScanFeatureId
  threshold: number
  /** true: values above the threshold are read as orange (right-side) cones. */
  orangeAbove: boolean
}

export type GraphLevelId = 'easy' | 'medium' | 'hard'

/** One of the path planner's graph courses. */
export interface GraphLevelState {
  cleared: boolean
  shots: number
  /** The function that cleared it. */
  solution: string | null
}

export interface SoftwareObject extends DesignObject {
  id: 'station:software'
  kind: 'software'
  /** Picks this team's graph courses. */
  seed: number
  levels: Record<GraphLevelId, GraphLevelState>
  updatedAt: number
}

// ---- Business ----

export type SponsorId = 'voltcell' | 'gripline' | 'roadking' | 'nimbus' | 'harbor' | 'slice'

export type FlyerMotif = 'car' | 'flag' | 'bolt' | 'stars' | 'food' | 'sun' | 'tools' | 'money'
export type FlyerLayout = 'poster' | 'banner' | 'badge'

/** The generated flyer: what the vibe-design prompt turned into. */
export interface FlyerSpec {
  prompt: string
  headline: string
  tagline: string
  palette: [string, string, string]
  motif: FlyerMotif
  layout: FlyerLayout
}

export interface Deal {
  sponsorId: SponsorId
  /** offer → (counter) → design → paid; or walked away. */
  stage: 'offer' | 'design' | 'paid' | 'declined'
  /** Base amount the sponsor agreed to (0 until a deal is struck). */
  agreed: number
  /** Their current offer while negotiating. */
  offer: number
  /** A team gets one counter-offer per sponsor. */
  countered: boolean
  flyer: FlyerSpec | null
  /** 0..1 effort score of the finished flyer. */
  effort: number
  payout: number
}

export interface BusinessObject extends DesignObject {
  id: 'station:business'
  kind: 'business'
  /** Picks each sponsor's hidden limit for this team. */
  seed: number
  deals: Deal[]
  updatedAt: number
}

// ---- Team ----

/** A player's 1st and 2nd job picks. Jobs are split among the whole team (see roles.ts); anyone can still open any station. */
export type RolePrefObject = CoreRolePrefObject<FsaeRoleId>

/** "Everyone to the start line": every device counts down to the same start time. */
export interface RaceCallObject extends DesignObject {
  id: 'race:call'
  kind: 'raceCall'
  heat: number
  startAt: number
  night: boolean
  byName: string
  updatedAt: number
}

export interface LapObject extends DesignObject {
  kind: 'lap'
  playerId: string
  playerName: string
  heat: number
  night: boolean
  /** Raw driving time, seconds. */
  driveS: number
  conesHit: number
  /** Driving time plus 2 s per cone (FSAE rule). */
  totalS: number
  /** Position samples every TRACE_DT seconds: x, z, heading (radians), flattened and rounded. */
  trace: number[]
  updatedAt: number
}

export type FsaeObject =
  | MechanicalObject
  | ElectricalObject
  | SoftwareObject
  | BusinessObject
  | RolePrefObject
  | RaceCallObject
  | LapObject
