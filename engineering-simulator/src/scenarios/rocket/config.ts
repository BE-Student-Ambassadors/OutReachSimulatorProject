import type {
  BusinessObject,
  CircuitId,
  ElectricalObject,
  KitPartId,
  MechanicalObject,
  PartCategory,
  RocketObject,
  RocketVariantId,
  SlotId,
  SoftwareObject,
  SponsorId,
} from './types'

/** Money the team starts with before any sponsor pays. Not enough for a full rocket on its own. */
export const SEED_FUNDS = 40

export const REQUIRED = {
  targetApogeeFt: 1500,
  apogeeToleranceFt: 150,
  /** Fastest touchdown the rocket survives without damage. */
  maxLandingFps: 20,
} as const

export const VARIANTS: Record<RocketVariantId, { label: string; blurb: string; windMph: number }> = {
  standard: { label: 'Launch Day', blurb: 'Light breeze, 6 mph', windMph: 6 },
}

// ---------------------------------------------------------------- electrical

export interface CircuitSpec {
  id: CircuitId
  label: string
  /** The two pins the wire joins. */
  pins: [string, string]
  color: string
  /** What the circuit does, as a fact. */
  summary: string
}

export const CIRCUITS: CircuitSpec[] = [
  { id: 'power', label: 'Power', pins: ['BAT', 'FC·PWR'], color: '#c23b22', summary: 'Battery to the flight computer. Everything else runs on this.' },
  { id: 'igniter', label: 'Igniter', pins: ['FC·IGN', 'IGNITER'], color: '#d99a1e', summary: 'Lets the flight computer light the motor.' },
  { id: 'eject', label: 'Ejection charge', pins: ['FC·EJ', 'EJECT'], color: '#7c4dbd', summary: 'Pops the parachute out of the body tube.' },
  { id: 'altimeter', label: 'Altimeter', pins: ['ALT', 'FC·ALT'], color: '#3f8f52', summary: 'Tells the flight computer its height and when it starts falling.' },
  { id: 'radio', label: 'Radio', pins: ['RADIO', 'FC·TX'], color: '#cf4f86', summary: 'Sends live altitude and speed to the ground station.' },
]

export const BOARD_ROWS = 6
export const BOARD_COLS = 7

// ---------------------------------------------------------------- mechanical

export interface PartListing {
  id: string
  category: PartCategory
  title: string
  condition: 'New' | 'Used' | 'Handmade' | 'Open box'
  price: number
  seller: string
  /** Seller feedback, percent positive. */
  rating: number
  massKg: number
  /** Item specifics, as listed. */
  specs: string[]
  sellerNote: string
  /** Drag coefficient this part adds (nose cones and fins). */
  cd?: number
  /** Fastest the part can fly before it tears (body tubes and fins), mph. */
  safeMph?: number
  /** A warped fin makes the rocket corkscrew. */
  warped?: boolean
  thrustN?: number
  /** Seconds of fuel at 100% throttle. */
  fuelSec?: number
  fuelKg?: number
  /** Parachute drag area (Cd × area), m². */
  chuteCdA?: number
  /** Fastest the canopy can open without ripping, mph. */
  chuteMaxMph?: number
}

export const LISTINGS: PartListing[] = [
  // Nose cones
  {
    id: 'nose-blunt',
    category: 'nose',
    title: 'Plastic nose cone, rounded, scuffed',
    condition: 'Used',
    price: 4,
    seller: 'garage_finds_88',
    rating: 91,
    massKg: 0.05,
    specs: ['Shape: rounded (blunt)', 'Fits 2.6 in tube', 'Weight: 50 g'],
    sellerNote: 'Pulled off an old kit. Some scratches.',
    cd: 0.5,
  },
  {
    id: 'nose-ogive',
    category: 'nose',
    title: 'Ogive nose cone, white plastic',
    condition: 'New',
    price: 12,
    seller: 'rocketry_outlet',
    rating: 99,
    massKg: 0.055,
    specs: ['Shape: ogive (pointed curve)', 'Fits 2.6 in tube', 'Weight: 55 g'],
    sellerNote: 'Ships in 1 business day.',
    cd: 0.38,
  },
  {
    id: 'nose-vk',
    category: 'nose',
    title: 'Fiberglass Von Kármán nose cone',
    condition: 'New',
    price: 30,
    seller: 'apex_composites',
    rating: 100,
    massKg: 0.09,
    specs: ['Shape: Von Kármán (low drag)', 'Fits 2.6 in tube', 'Weight: 90 g'],
    sellerNote: 'Hand laid fiberglass, sanded smooth.',
    cd: 0.31,
  },
  // Body tubes
  {
    id: 'body-cardboard',
    category: 'body',
    title: 'Cardboard mailing tube, 2.6 in × 30 in',
    condition: 'Used',
    price: 3,
    seller: 'officesurplus_co',
    rating: 95,
    massKg: 0.12,
    specs: ['Material: spiral cardboard', 'Rated speed: 210 mph', 'Weight: 120 g'],
    sellerNote: 'Mailing tubes, lightly used. Caps not included.',
    safeMph: 210,
  },
  {
    id: 'body-phenolic',
    category: 'body',
    title: 'Phenolic body tube (small dent)',
    condition: 'Open box',
    price: 11,
    seller: 'rocketry_outlet',
    rating: 99,
    massKg: 0.18,
    specs: ['Material: phenolic resin', 'Rated speed: 330 mph', 'Weight: 180 g'],
    sellerNote: 'Small dent near one end from shipping. Otherwise new.',
    safeMph: 330,
  },
  {
    id: 'body-fiberglass',
    category: 'body',
    title: 'Fiberglass airframe tube, 2.6 in',
    condition: 'New',
    price: 34,
    seller: 'apex_composites',
    rating: 100,
    massKg: 0.3,
    specs: ['Material: fiberglass', 'Rated speed: 650 mph', 'Weight: 300 g'],
    sellerNote: 'Competition grade.',
    safeMph: 650,
  },
  // Fins
  {
    id: 'fins-balsa',
    category: 'fins',
    title: 'Balsa fin set (3), one slightly warped',
    condition: 'Used',
    price: 3,
    seller: 'garage_finds_88',
    rating: 91,
    massKg: 0.025,
    specs: ['Material: balsa wood', 'Rated speed: 240 mph', 'Weight: 25 g', 'One fin bent about 3°'],
    sellerNote: 'Left in a hot car. Still usable I think.',
    cd: 0.12,
    safeMph: 240,
    warped: true,
  },
  {
    id: 'fins-plywood',
    category: 'fins',
    title: 'Plywood fin set (3), laser cut',
    condition: 'New',
    price: 9,
    seller: 'makerspace_cuts',
    rating: 97,
    massKg: 0.06,
    specs: ['Material: 1/8 in plywood', 'Rated speed: 360 mph', 'Weight: 60 g'],
    sellerNote: 'Cut to order.',
    cd: 0.1,
    safeMph: 360,
  },
  {
    id: 'fins-g10',
    category: 'fins',
    title: 'G10 fiberglass fin set (3), beveled',
    condition: 'New',
    price: 24,
    seller: 'apex_composites',
    rating: 100,
    massKg: 0.1,
    specs: ['Material: G10 fiberglass', 'Rated speed: 700 mph', 'Weight: 100 g', 'Edges beveled'],
    sellerNote: 'Same fins the college teams use.',
    cd: 0.08,
    safeMph: 700,
  },
  // Motors
  {
    id: 'motor-mini',
    category: 'motor',
    title: 'Mini hybrid motor, "fired once, works"',
    condition: 'Used',
    price: 14,
    seller: 'launchday_leftovers',
    rating: 88,
    massKg: 0.2,
    specs: ['Max thrust: 45 N', 'Fuel: 2.6 s at full throttle', 'Weight: 260 g with fuel'],
    sellerNote: 'Fired once at a club launch. Cleaned.',
    thrustN: 45,
    fuelSec: 2.6,
    fuelKg: 0.06,
  },
  {
    id: 'motor-standard',
    category: 'motor',
    title: 'Hybrid motor, standard',
    condition: 'New',
    price: 32,
    seller: 'rocketry_outlet',
    rating: 99,
    massKg: 0.24,
    specs: ['Max thrust: 70 N', 'Fuel: 3.2 s at full throttle', 'Weight: 330 g with fuel'],
    sellerNote: 'Sealed box.',
    thrustN: 70,
    fuelSec: 3.2,
    fuelKg: 0.09,
  },
  {
    id: 'motor-pro',
    category: 'motor',
    title: 'Pro hybrid motor, high thrust',
    condition: 'New',
    price: 64,
    seller: 'apex_composites',
    rating: 100,
    massKg: 0.28,
    specs: ['Max thrust: 105 N', 'Fuel: 3.8 s at full throttle', 'Weight: 410 g with fuel'],
    sellerNote: 'Our strongest motor that fits a 2.6 in tube.',
    thrustN: 105,
    fuelSec: 3.8,
    fuelKg: 0.13,
  },
  // Parachutes
  {
    id: 'chute-bag',
    category: 'parachute',
    title: 'Homemade trash-bag parachute, 18 in',
    condition: 'Handmade',
    price: 2,
    seller: 'thrifty_launches',
    rating: 84,
    massKg: 0.015,
    specs: ['Diameter: 18 in', 'Material: trash bag', 'Max opening speed: 50 mph', 'Weight: 15 g'],
    sellerNote: 'Made it myself. Tape is strong.',
    chuteCdA: 0.12,
    chuteMaxMph: 50,
  },
  {
    id: 'chute-nylon',
    category: 'parachute',
    title: 'Nylon parachute, 30 in',
    condition: 'New',
    price: 11,
    seller: 'rocketry_outlet',
    rating: 99,
    massKg: 0.04,
    specs: ['Diameter: 30 in', 'Material: nylon', 'Max opening speed: 90 mph', 'Weight: 40 g'],
    sellerNote: 'Includes shroud lines.',
    chuteCdA: 0.46,
    chuteMaxMph: 90,
  },
  {
    id: 'chute-ripstop',
    category: 'parachute',
    title: 'Ripstop parachute, 42 in, with swivel',
    condition: 'New',
    price: 22,
    seller: 'apex_composites',
    rating: 100,
    massKg: 0.07,
    specs: ['Diameter: 42 in', 'Material: ripstop nylon', 'Max opening speed: 130 mph', 'Weight: 70 g'],
    sellerNote: 'Swivel keeps the lines from twisting.',
    chuteCdA: 0.8,
    chuteMaxMph: 130,
  },
]

export const LISTING_BY_ID: Record<string, PartListing> = Object.fromEntries(LISTINGS.map((l) => [l.id, l]))

export const CATEGORY_LABELS: Record<PartCategory, string> = {
  nose: 'Nose cones',
  body: 'Body tubes',
  fins: 'Fin sets',
  motor: 'Motors',
  parachute: 'Parachutes',
}

export const KIT_PARTS: Record<KitPartId, { label: string; massKg: number; note: string }> = {
  'kit:shock-cord': { label: 'Shock cord', massKg: 0.03, note: 'Elastic cord that ties the parachute to the rocket.' },
  'kit:avionics-bay': { label: 'Avionics bay', massKg: 0.07, note: 'Holds the breadboard and flight computer.' },
}

export interface BlueprintSlot {
  id: SlotId
  label: string
  /** What belongs here: a shop category or a kit part. */
  takes: PartCategory | KitPartId
}

/** Nose to tail, the way the blueprint draws it. */
export const BLUEPRINT: BlueprintSlot[] = [
  { id: 'nose', label: 'Nose cone', takes: 'nose' },
  { id: 'parachute', label: 'Parachute', takes: 'parachute' },
  { id: 'shockCord', label: 'Shock cord', takes: 'kit:shock-cord' },
  { id: 'avionics', label: 'Avionics bay', takes: 'kit:avionics-bay' },
  { id: 'body', label: 'Body tube', takes: 'body' },
  { id: 'motor', label: 'Motor', takes: 'motor' },
  { id: 'fins', label: 'Fin set', takes: 'fins' },
]

/** Seconds from "Buy It Now" until the parcel shows up on the bench. */
export const SHIPPING_SECONDS = 6
/** Kept by the shop when a part goes back. */
export const RESTOCKING_FEE = 2

// ---------------------------------------------------------------- business

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
    id: 'ridgeline',
    name: 'Ridgeline Hardware',
    industry: 'Hardware store',
    contact: 'Dana, store manager',
    opening: 35,
    ceiling: 55,
    pitch: 'We love seeing students build things. We could put up a flyer by our register if it shows off your rocket and our store.',
    brandColor: '#b8461b',
  },
  {
    id: 'byte-burger',
    name: 'Byte Burger',
    industry: 'Restaurant',
    contact: 'Marco, owner',
    opening: 25,
    ceiling: 45,
    pitch: 'Our customers are your neighbors! Make us a fun flyer for the front window and we will chip in.',
    brandColor: '#d99a1e',
  },
  {
    id: 'summit-solar',
    name: 'Summit Solar Co.',
    industry: 'Solar installer',
    contact: 'Priya, marketing lead',
    opening: 50,
    ceiling: 70,
    pitch: 'Clean energy and rockets both need engineers. We want a flyer for our booth at the county fair.',
    brandColor: '#2c5b3c',
  },
  {
    id: 'tidewater',
    name: 'Tidewater Credit Union',
    industry: 'Bank',
    contact: 'Mr. Okafor, community outreach',
    opening: 40,
    ceiling: 60,
    pitch: 'We sponsor one student team a semester. Send us a flyer we can post in the lobby.',
    brandColor: '#3f8f52',
  },
  {
    id: 'pixel-print',
    name: 'Pixel Print Shop',
    industry: 'Print shop',
    contact: 'Jo, designer',
    opening: 20,
    ceiling: 40,
    pitch: 'We print flyers all day. Impress us with yours and we will sponsor you.',
    brandColor: '#7c4dbd',
  },
]

export const SPONSOR_BY_ID: Record<SponsorId, SponsorSpec> = Object.fromEntries(SPONSORS.map((s) => [s.id, s])) as Record<
  SponsorId,
  SponsorSpec
>

/** A finished flyer pays between these shares of the agreed amount, depending on effort. */
export const PAYOUT_MIN_SHARE = 0.5
export const PAYOUT_MAX_SHARE = 1.5

// ---------------------------------------------------------------- getters

export function getElectrical(design: RocketObject[]): ElectricalObject | null {
  return design.find((o): o is ElectricalObject => o.kind === 'electrical') ?? null
}

export function getMechanical(design: RocketObject[]): MechanicalObject {
  return (
    design.find((o): o is MechanicalObject => o.kind === 'mechanical') ?? {
      id: 'station:mechanical',
      kind: 'mechanical',
      orders: [],
      placements: {},
      updatedAt: 0,
    }
  )
}

export function getSoftware(design: RocketObject[]): SoftwareObject | null {
  return design.find((o): o is SoftwareObject => o.kind === 'software') ?? null
}

export function getBusiness(design: RocketObject[]): BusinessObject | null {
  return design.find((o): o is BusinessObject => o.kind === 'business') ?? null
}

export function upsert(design: RocketObject[], next: RocketObject): RocketObject[] {
  return design.some((o) => o.id === next.id) ? design.map((o) => (o.id === next.id ? next : o)) : [...design, next]
}
