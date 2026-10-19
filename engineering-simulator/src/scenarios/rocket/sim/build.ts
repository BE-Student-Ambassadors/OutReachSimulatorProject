import { BLUEPRINT, KIT_PARTS, LISTING_BY_ID, RESTOCKING_FEE, type PartListing } from '../config'
import type { KitPartId, MechanicalObject, PartCategory, SlotId } from '../types'

export type BenchItem =
  | { kind: 'kit'; id: KitPartId; label: string; massKg: number }
  | { kind: 'part'; id: string; listing: PartListing }

export const isKitId = (id: string): id is KitPartId => id in KIT_PARTS

export function benchItem(mech: MechanicalObject, itemId: string): BenchItem | null {
  if (isKitId(itemId)) return { kind: 'kit', id: itemId, label: KIT_PARTS[itemId].label, massKg: KIT_PARTS[itemId].massKg }
  const order = mech.orders.find((o) => o.id === itemId && !o.returned)
  const listing = order ? LISTING_BY_ID[order.listingId] : undefined
  return listing ? { kind: 'part', id: itemId, listing } : null
}

export const itemTakes = (item: BenchItem): PartCategory | KitPartId => (item.kind === 'kit' ? item.id : item.listing.category)
export const itemMass = (item: BenchItem) => (item.kind === 'kit' ? item.massKg : item.listing.massKg)

/** What the rocket is made of, as the flight sees it. A part only does its job in its own blueprint slot. */
export interface Build {
  nose: PartListing | null
  body: PartListing | null
  fins: PartListing | null
  motor: PartListing | null
  parachute: PartListing | null
  shockCord: boolean
  avionics: boolean
  /** Every part on the rocket counts toward mass, even in the wrong slot. */
  massKg: number
  /** Slots holding a part that belongs somewhere else. */
  misplaced: SlotId[]
  filled: number
}

export function resolveBuild(mech: MechanicalObject): Build {
  const b: Build = {
    nose: null,
    body: null,
    fins: null,
    motor: null,
    parachute: null,
    shockCord: false,
    avionics: false,
    massKg: 0,
    misplaced: [],
    filled: 0,
  }
  for (const slot of BLUEPRINT) {
    const id = mech.placements[slot.id]
    const item = id ? benchItem(mech, id) : null
    if (!item) continue
    b.filled++
    b.massKg += itemMass(item)
    if (itemTakes(item) !== slot.takes) {
      b.misplaced.push(slot.id)
      continue
    }
    if (item.kind === 'kit') {
      if (item.id === 'kit:shock-cord') b.shockCord = true
      else b.avionics = true
    } else {
      b[item.listing.category] = item.listing
    }
  }
  return b
}

/** Money spent at the shop: every purchase, less refunds (returns keep a restocking fee). */
export function partsSpent(mech: MechanicalObject): number {
  return mech.orders.reduce((sum, o) => {
    const price = LISTING_BY_ID[o.listingId]?.price ?? 0
    return sum + (o.returned ? Math.min(price, RESTOCKING_FEE) : price)
  }, 0)
}
