import { CIRCUITS } from '../config'
import type { BusinessObject, CircuitId, Deal, ElectricalObject, LineId, LineWork, MechanicalObject, RocketObject, SlotId, SoftwareObject, SponsorId } from '../types'
import { boardFor } from './board'
import { payoutFor } from './business'
import { starterProgram, withSettings } from './rocketScript'

/**
 * Reference designs for balancing tests: a whole team's work, built the way students would build it.
 */

export interface TeamPlan {
  parts: { nose: string; body: string; fins: string; motor: string; parachute: string }
  /** Overrides where parts go (default: every part in its own slot, kit parts included). */
  placements?: Partial<Record<SlotId, string | null>>
  circuits?: CircuitId[]
  /** Overrides the splice on a battery lead (default: both spliced cleanly with the right resistor; null = untouched). */
  lines?: Partial<Record<LineId, LineWork | null>>
  /** 'clean' = bugs fixed; 'buggy' = uploaded as it came; null = nothing uploaded. */
  program?: 'clean' | 'buggy' | null
  settings?: { throttle?: number; burn_time?: number; deploy_altitude?: number }
  /** Replace the whole uploaded program. */
  source?: string
  deals?: { sponsor: SponsorId; agreed: number; effort: number }[]
}

const SEED = 4242

/** Battery leads cut on a clear stretch, crimped well, with a resistor that brings each into range. */
export const GOOD_LINES: Record<LineId, LineWork> = {
  computer: { cutAt: 0.15, crimps: [1, 1], ohms: 8 },
  igniter: { cutAt: 0.6, crimps: [1, 1], ohms: 2.5 },
}

export function teamDesign(plan: TeamPlan): RocketObject[] {
  const circuits = plan.circuits ?? CIRCUITS.map((c) => c.id)
  const lines: Partial<Record<LineId, LineWork>> = {}
  for (const id of ['computer', 'igniter'] as const) {
    const l = plan.lines && id in plan.lines ? plan.lines[id] : GOOD_LINES[id]
    if (l) lines[id] = l
  }
  const electrical: ElectricalObject = {
    id: 'station:electrical',
    kind: 'electrical',
    seed: SEED,
    paths: Object.fromEntries(circuits.map((c) => [c, boardFor(SEED, CIRCUITS.find((x) => x.id === c)!.board).solution[c]])),
    lines,
    updatedAt: 1,
  }

  const p = plan.parts
  const orders = (['nose', 'body', 'fins', 'motor', 'parachute'] as const).map((cat, i) => ({
    id: `order-${cat}`,
    listingId: p[cat],
    orderedAt: i,
    returned: false,
  }))
  const placements: Partial<Record<SlotId, string>> = {
    nose: 'order-nose',
    parachute: 'order-parachute',
    shockCord: 'kit:shock-cord',
    avionics: 'kit:avionics-bay',
    body: 'order-body',
    motor: 'order-motor',
    fins: 'order-fins',
  }
  for (const [slot, item] of Object.entries(plan.placements ?? {}) as [SlotId, string | null][]) {
    if (item === null) delete placements[slot]
    else placements[slot] = item
  }
  const mechanical: MechanicalObject = { id: 'station:mechanical', kind: 'mechanical', orders, placements, updatedAt: 1 }

  const starter = starterProgram(SEED)
  const mode = plan.program === undefined ? 'clean' : plan.program
  const base = mode === 'buggy' ? starter.source : starter.clean
  const uploaded = plan.source ?? (mode === null ? null : withSettings(base, plan.settings ?? {}))
  const software: SoftwareObject = {
    id: 'station:software',
    kind: 'software',
    seed: SEED,
    pluggedIn: true,
    source: uploaded ?? starter.source,
    uploadedSource: uploaded,
    updatedAt: 1,
  }

  const deals: Deal[] = (plan.deals ?? []).map((d) => ({
    sponsorId: d.sponsor,
    stage: 'paid',
    agreed: d.agreed,
    offer: d.agreed,
    countered: false,
    flyer: null,
    effort: d.effort,
    payout: payoutFor(d.agreed, d.effort),
  }))
  const business: BusinessObject = { id: 'station:business', kind: 'business', seed: SEED, deals, updatedAt: 1 }

  return [electrical, mechanical, software, business]
}

const MID_PARTS = { nose: 'nose-ogive', body: 'body-phenolic', fins: 'fins-plywood', motor: 'motor-standard', parachute: 'chute-nylon' }
const CHEAP_PARTS = { nose: 'nose-blunt', body: 'body-cardboard', fins: 'fins-plywood', motor: 'motor-mini', parachute: 'chute-nylon' }
const PREMIUM_PARTS = { nose: 'nose-vk', body: 'body-fiberglass', fins: 'fins-g10', motor: 'motor-pro', parachute: 'chute-ripstop' }

const TWO_DEALS = [
  { sponsor: 'summit-solar' as const, agreed: 55, effort: 0.6 },
  { sponsor: 'ridgeline' as const, agreed: 40, effort: 0.6 },
]

export const emptyDesign: RocketObject[] = []

/** As it arrives: starter program uploaded with its bugs, untouched numbers. */
export const untouchedProgram = teamDesign({ parts: MID_PARTS, program: 'buggy', deals: TWO_DEALS })

/** Bugs fixed but the starting numbers left alone. */
export const defaultNumbers = teamDesign({ parts: MID_PARTS, deals: TWO_DEALS })

/** Strategy A: middle-of-the-shop parts, moderate throttle. */
export const strategyMid = teamDesign({
  parts: MID_PARTS,
  settings: { throttle: 55, burn_time: 3, deploy_altitude: 1300 },
  deals: TWO_DEALS,
})

/** Strategy B: cheapest parts that can still work, one sponsor, careful numbers. */
export const strategyThrifty = teamDesign({
  parts: CHEAP_PARTS,
  settings: { throttle: 52, burn_time: 4.5, deploy_altitude: 1200 },
  deals: [{ sponsor: 'tidewater', agreed: 40, effort: 0.4 }],
})

/** Strategy C: premium parts, lots of fundraising, low throttle on a big motor. */
export const strategyPremium = teamDesign({
  parts: PREMIUM_PARTS,
  settings: { throttle: 50, burn_time: 2.5, deploy_altitude: 1000 },
  deals: [
    { sponsor: 'summit-solar', agreed: 65, effort: 0.9 },
    { sponsor: 'tidewater', agreed: 55, effort: 0.9 },
    { sponsor: 'ridgeline', agreed: 50, effort: 0.8 },
  ],
})

export const STRATEGY_PARTS = { MID_PARTS, CHEAP_PARTS, PREMIUM_PARTS, TWO_DEALS }
