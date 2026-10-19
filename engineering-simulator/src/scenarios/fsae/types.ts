import type { DesignObject } from '../../core/scenario'

/**
 * Every object carries `updatedAt` (wall-clock ms): the multiplayer layer merges teammates'
 * writes object by object and keeps the newest. Objects are never removed, only updated.
 */

export type FsaeRoleId = 'mechanical' | 'electrical' | 'software' | 'business'

export type FsaeVariantId = 'standard' | 'night'

// ---- Mechanical ----

export interface MechanicalObject extends DesignObject {
  id: 'station:mechanical'
  kind: 'mechanical'
  /** Weld quality per frame joint, 0..1. -1 = not welded yet. */
  welds: number[]
  /** How far each wing is slid out, 0..100 %. */
  frontWing: number
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

export type PowerPathId = 'motor' | 'pump' | 'headlights' | 'brake' | 'computer'
export type PowerPartType = 'resistor' | 'booster'

export interface PowerPart {
  type: PowerPartType
  /** Ohms for a resistor, added volts for a booster (the dial). */
  value: number
}

export interface ElectricalObject extends DesignObject {
  id: 'station:electrical'
  kind: 'electrical'
  /** Up to two parts on each path, in slot order. null = empty slot. */
  slots: Record<PowerPathId, [PowerPart | null, PowerPart | null]>
  updatedAt: number
}

// ---- Software ----

export type FeatureId = 'shape' | 'color' | 'stripe' | 'size'

export interface SoftwareObject extends DesignObject {
  id: 'station:software'
  kind: 'software'
  /** Picks this team's images, equations and test set. */
  seed: number
  /** How many of the 4 data rounds are done. */
  roundsDone: number
  /** Wrong guesses so far (only shown as a count). */
  misses: number
  /** The student's answer for each weight, in feature order. null = not answered. */
  weights: (number | null)[]
  /** Accuracy from the last validation run, 0..1, or null if never validated. */
  validatedAccuracy: number | null
  updatedAt: number
}

// ---- Business ----

export type ToyId = 'car' | 'trophy' | 'cone' | 'flag' | 'crowd' | 'battery' | 'robot' | 'school' | 'pizza' | 'wrench' | 'tire' | 'heart'

export interface ToyPlacement {
  toy: ToyId
  /** Position inside the panel, 0..1. */
  x: number
  y: number
  flip: boolean
}

export interface StoryPanel {
  toys: ToyPlacement[]
  caption: string
}

export type SponsorId = 'voltcell' | 'gripline' | 'nimbus' | 'harbor' | 'slice'

export interface SponsorDeal {
  sponsorId: SponsorId
  /** What the sponsor offered after the pitch. */
  offer: number
  accepted: boolean
  /** The 0..1 interest score behind the offer, for the reaction text. */
  interest: number
}

export interface BusinessObject extends DesignObject {
  id: 'station:business'
  kind: 'business'
  panels: StoryPanel[]
  deals: SponsorDeal[]
  updatedAt: number
}

// ---- Team ----

/** Who is doing which job. Anyone can still open any station. */
export interface ClaimObject extends DesignObject {
  id: `claim:${FsaeRoleId}`
  kind: 'claim'
  role: FsaeRoleId
  playerId: string | null
  playerName: string | null
  updatedAt: number
}

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
  | ClaimObject
  | RaceCallObject
  | LapObject
