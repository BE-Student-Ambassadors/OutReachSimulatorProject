import { emptyPanels, getElectrical, getMechanical, getSoftware, JOINTS, SPONSORS } from '../config'
import type { BusinessObject, ElectricalObject, FsaeObject, MechanicalObject, PowerPart, PowerPathId, SoftwareObject, StoryPanel } from '../types'
import { trueWeights } from './autonomy'
import { offerFor, sponsorInterest } from './business'

/** Reference designs for balancing tests. Not shown to students. */

export interface MechSpec {
  front: number
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

const R = (value: number): PowerPart => ({ type: 'resistor', value })
const B = (value: number): PowerPart => ({ type: 'booster', value })

export function elec(parts: Partial<Record<PowerPathId, PowerPart[]>>): ElectricalObject {
  const base = getElectrical([])
  const slots = { ...base.slots }
  for (const [id, list] of Object.entries(parts) as [PowerPathId, PowerPart[]][]) slots[id] = [list[0] ?? null, list[1] ?? null]
  return { ...base, slots, updatedAt: 1 }
}

/** Every path in range: 40 V motor, 24 V pump, 12 V lights, 12 V brake light, 5 V computer. */
export const goodPower = () => elec({ motor: [R(0.8)], pump: [R(6)], headlights: [B(3)], brake: [B(2)], computer: [R(3.5)] })

export function software(seed: number, weights?: (number | null)[]): SoftwareObject {
  return { ...getSoftware([]), seed, roundsDone: 4, weights: weights ?? trueWeights(seed), validatedAccuracy: 1, updatedAt: 1 }
}

const STORY: StoryPanel[] = [
  {
    toys: [
      { toy: 'school', x: 0.3, y: 0.5, flip: false },
      { toy: 'crowd', x: 0.7, y: 0.6, flip: false },
    ],
    caption: 'Our high school team wants to build an electric race car for the community',
  },
  {
    toys: [
      { toy: 'wrench', x: 0.3, y: 0.5, flip: false },
      { toy: 'battery', x: 0.6, y: 0.5, flip: false },
      { toy: 'robot', x: 0.8, y: 0.4, flip: false },
    ],
    caption: 'We weld the frame, wire the battery and code a self-driving computer with data',
  },
  {
    toys: [
      { toy: 'car', x: 0.4, y: 0.6, flip: false },
      { toy: 'cone', x: 0.7, y: 0.6, flip: false },
      { toy: 'flag', x: 0.85, y: 0.3, flip: false },
    ],
    caption: 'On the track our fast car grips every corner and races to win',
  },
  {
    toys: [
      { toy: 'trophy', x: 0.5, y: 0.5, flip: false },
      { toy: 'pizza', x: 0.2, y: 0.6, flip: false },
      { toy: 'heart', x: 0.8, y: 0.3, flip: false },
    ],
    caption: 'Sponsors join our team, our fans and our future engineers to celebrate together',
  },
]

/** A finished story pitched to every sponsor, every offer accepted. */
export function businessDone(): BusinessObject {
  const biz: BusinessObject = { id: 'station:business', kind: 'business', panels: STORY, deals: [], updatedAt: 1 }
  biz.deals = SPONSORS.map((s) => {
    const interest = sponsorInterest(biz, s.id).score
    return { sponsorId: s.id, interest, offer: offerFor(s.id, interest), accepted: true }
  })
  return biz
}

/** A story with one lazy panel: what a rushed pitch earns. */
export function businessRushed(): BusinessObject {
  const panels = emptyPanels()
  panels[0] = { toys: [{ toy: 'car', x: 0.5, y: 0.5, flip: false }, { toy: 'cone', x: 0.2, y: 0.5, flip: false }], caption: 'we have a car' }
  const biz: BusinessObject = { id: 'station:business', kind: 'business', panels, deals: [], updatedAt: 1 }
  biz.deals = SPONSORS.map((s) => {
    const interest = sponsorInterest(biz, s.id).score
    return { sponsorId: s.id, interest, offer: offerFor(s.id, interest), accepted: true }
  })
  return biz
}

const SEED = 4242

function team(m: MechSpec, extra: FsaeObject[] = []): FsaeObject[] {
  return [mech(m), goodPower(), software(SEED), businessDone(), ...extra]
}

/** Big wings, low floor: lots of grip, lots of drag. */
export const downforce = () => team({ front: 80, rear: 90, wheelbase: 1575, track: 1300, ride: 32 })
/** Wings mostly tucked in, long car: fast on the straight, careful in corners. */
export const lowDrag = () => team({ front: 25, rear: 30, wheelbase: 1700, track: 1250, ride: 30 })
/** Middle of the road everywhere. */
export const balanced = () => team({ front: 50, rear: 60, wheelbase: 1650, track: 1200, ride: 40 })
/** Narrow, short and cheap, wings half out. */
export const budget = () => team({ front: 55, rear: 55, wheelbase: 1525, track: 1100, ride: 35 })

/** Nothing done at all. */
export const empty = (): FsaeObject[] => []

/** Everything finished except the electrical station: every path still at its raw voltage. */
export const noElectrical = (): FsaeObject[] => [mech({ front: 60, rear: 70, wheelbase: 1600, track: 1250, ride: 34 }), software(SEED), businessDone()]

/** Front wing all the way out, rear wing tucked: the car is badly unbalanced. */
export const unbalanced = () => team({ front: 100, rear: 0, wheelbase: 1600, track: 1250, ride: 40 })

/** Ride height so low the floor hits the bumps. */
export const scraping = () => team({ front: 60, rear: 70, wheelbase: 1600, track: 1250, ride: 16 })

/** Frame barely welded. */
export const sloppyWelds = () => team({ front: 60, rear: 70, wheelbase: 1600, track: 1250, ride: 34, weld: 0.3 })

/** Weights off by one on two features. */
export const sloppyMath = () => {
  const w = trueWeights(SEED)
  return [mech({ front: 60, rear: 70, wheelbase: 1600, track: 1250, ride: 34 }), goodPower(), software(SEED, [w[0], w[1] + 2, w[2], w[3] - 1]), businessDone()]
}

/** Great car, rushed pitch. */
export const brokeTeam = () => [mech({ front: 60, rear: 70, wheelbase: 1600, track: 1250, ride: 34 }), goodPower(), software(SEED), businessRushed()]

/** Headlights left dim (fine by day, a problem at night). */
export const dimLights = () => [
  mech({ front: 60, rear: 70, wheelbase: 1600, track: 1250, ride: 34 }),
  elec({ motor: [R(0.8)], pump: [R(6)], brake: [B(2)], computer: [R(3.5)] }),
  software(SEED),
  businessDone(),
]

/** Motor over-voltage: the controller protects it by limiting power. */
export const hotMotor = () => [
  mech({ front: 60, rear: 70, wheelbase: 1600, track: 1250, ride: 34 }),
  elec({ pump: [R(6)], headlights: [B(3)], brake: [B(2)], computer: [R(3.5)] }),
  software(SEED),
  businessDone(),
]
