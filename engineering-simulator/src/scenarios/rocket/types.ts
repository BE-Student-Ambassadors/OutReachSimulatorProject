import type { DesignObject } from '../../core/scenario'

/** The four seats on the team. */
export type RocketRoleId = 'electrical' | 'mechanical' | 'software' | 'business'

export type RocketVariantId = 'standard'

// ---- Electrical ----

/** Each circuit is one wire on the breadboard joining two component pins. */
export type CircuitId = 'power' | 'igniter' | 'eject' | 'altimeter' | 'radio'

/** Electrical: the breadboard. Its puzzle (pin positions) comes from `seed`; `paths` are the wires drawn. */
export interface ElectricalObject extends DesignObject {
  id: 'station:electrical'
  kind: 'electrical'
  seed: number
  /** Cell indices (row * cols + col) along each wire, starting at one of its pins. */
  paths: Partial<Record<CircuitId, number[]>>
  updatedAt: number
}

// ---- Mechanical ----

export type PartCategory = 'nose' | 'body' | 'fins' | 'motor' | 'parachute'

/** Parts the team already owns (they come in the starter box, not from the shop). */
export type KitPartId = 'kit:shock-cord' | 'kit:avionics-bay'

/** Places on the blueprint, nose to tail. */
export type SlotId = 'nose' | 'parachute' | 'shockCord' | 'avionics' | 'body' | 'motor' | 'fins'

export interface PartOrder {
  /** Unique per purchase, so the same listing can be bought twice. */
  id: string
  listingId: string
  /** Wall-clock ms; the parcel arrives a few seconds later. */
  orderedAt: number
  returned: boolean
}

export interface MechanicalObject extends DesignObject {
  id: 'station:mechanical'
  kind: 'mechanical'
  orders: PartOrder[]
  /** What sits in each blueprint slot: an order id or a kit part id. */
  placements: Partial<Record<SlotId, string>>
  updatedAt: number
}

// ---- Software ----

export interface SoftwareObject extends DesignObject {
  id: 'station:software'
  kind: 'software'
  /** Picks which bugs and starting numbers this team's program has. */
  seed: number
  pluggedIn: boolean
  /** The program as last saved in the editor. */
  source: string
  /** The program the flight computer is running (null until the first successful upload). */
  uploadedSource: string | null
  updatedAt: number
}

// ---- Business ----

export type SponsorId = 'ridgeline' | 'byte-burger' | 'summit-solar' | 'tidewater' | 'pixel-print'

export type FlyerMotif = 'rocket' | 'stars' | 'mountains' | 'food' | 'sun' | 'tools' | 'money' | 'wave'
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
  seed: number
  deals: Deal[]
  updatedAt: number
}

/** A player's 1st and 2nd role picks (synced across the group). */
export interface RolePrefObject extends DesignObject {
  kind: 'rolePref'
  playerId: string
  playerName: string
  choices: RocketRoleId[]
  updatedAt: number
}

export type RocketObject = ElectricalObject | MechanicalObject | SoftwareObject | BusinessObject | RolePrefObject
