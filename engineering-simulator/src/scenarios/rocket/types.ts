import type { RolePrefObject as CoreRolePrefObject } from '../../core/roles'
import type { DesignObject } from '../../core/scenario'

/** The four jobs on the team. */
export type RocketRoleId = 'electrical' | 'mechanical' | 'software' | 'business'

export type RocketVariantId = 'standard'

// ---- Electrical ----

/** Each circuit is one wire on a breadboard joining two component pins. */
export type CircuitId = 'power' | 'igniter' | 'eject' | 'altimeter' | 'radio'

/** The two breadboards on the avionics sled. Each circuit lives on one of them. */
export type BoardId = 'flight' | 'sensor'

/** The two battery leads in the rocket that each need a resistor spliced in. */
export type LineId = 'computer' | 'igniter'

/** What a stretch of wire runs past. */
export type SpliceZone = 'clear' | 'moving'

/** Work on one battery lead: where it was cut, the two crimps (quality 0..1) and the resistor spliced in. */
export interface LineWork {
  /** 0 (battery end) .. 1 (part end); null = not cut. */
  cutAt: number | null
  crimps: [number | null, number | null]
  /** The spliced resistor's value, ohms; null = none fitted yet. */
  ohms: number | null
}

/**
 * Electrical: two breadboards plus two battery leads. The breadboard puzzles (pin positions) come
 * from `seed`; `paths` are the wires drawn; `lines` is the splice work on each battery lead.
 */
export interface ElectricalObject extends DesignObject {
  id: 'station:electrical'
  kind: 'electrical'
  seed: number
  /** Cell indices (row * cols + col) along each wire, starting at one of its pins. */
  paths: Partial<Record<CircuitId, number[]>>
  /** Missing on designs saved before the battery leads existed: those read as untouched. */
  lines?: Partial<Record<LineId, LineWork>>
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
export type RolePrefObject = CoreRolePrefObject<RocketRoleId>

export type RocketObject = ElectricalObject | MechanicalObject | SoftwareObject | BusinessObject | RolePrefObject
