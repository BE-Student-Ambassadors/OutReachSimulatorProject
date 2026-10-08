/**
 * Reference designs for the balancing tests. Never shown to students; they prove that
 * several different approaches can pass.
 */
import type { BaySiteId, BikeSegId, CrossSiteId, CurbEdgeId, GapId, ProgramId, SignalNodeId, SignalSplit, StopNodeId, TrafficObject, TurnSiteId } from '../types'

let n = 0
const id = (k: string) => `${k}-${n++}`
export const crosswalk = (site: CrossSiteId): TrafficObject => ({ id: id('cw'), kind: 'crosswalk', site })
export const beacon = (site: CrossSiteId): TrafficObject => ({ id: id('bc'), kind: 'beacon', site })
export const guard = (site: CrossSiteId): TrafficObject => ({ id: id('gd'), kind: 'guard', site })
export const signal = (node: SignalNodeId, split: SignalSplit = 'even'): TrafficObject => ({ id: id('sig'), kind: 'signal', node, split })
export const stop = (node: StopNodeId): TrafficObject => ({ id: id('stop'), kind: 'stop', node })
export const curb = (edge: CurbEdgeId): TrafficObject => ({ id: id('curb'), kind: 'curb', edge })
export const turnLane = (site: TurnSiteId): TrafficObject => ({ id: id('tl'), kind: 'turnLane', site })
export const busBay = (site: BaySiteId): TrafficObject => ({ id: id('bay'), kind: 'busBay', site })
export const bikeLane = (segment: BikeSegId): TrafficObject => ({ id: id('bl'), kind: 'bikeLane', segment })
export const sidewalk = (gap: GapId): TrafficObject => ({ id: id('sw'), kind: 'sidewalk', gap })
export const program = (p: ProgramId): TrafficObject => ({ id: id('prog'), kind: 'program', program: p })

/** Safe crossings that every strategy needs in some form. */
const basicSafety = (): TrafficObject[] => [crosswalk('oak-100'), crosswalk('pine-200'), crosswalk('elm-150'), sidewalk('gap-elm-west')]

/** A: flow engineering — turn lanes everywhere, more curb. */
export function strategyA(): TrafficObject[] {
  return [
    turnLane('in-left'),
    turnLane('in-right'),
    turnLane('out-split'),
    curb('loop-south'),
    curb('loop-in'),
    beacon('main-200'),
    crosswalk('main-200'),
    ...basicSafety(),
  ]
}

/** B: mode shift — bike routes, sidewalks, carpool. */
export function strategyB(): TrafficObject[] {
  return [
    program('carpool'),
    bikeLane('bl-oak'),
    bikeLane('bl-main'),
    bikeLane('bl-pine'),
    bikeLane('bl-elm'),
    sidewalk('gap-oak-east'),
    curb('loop-south'),
    crosswalk('main-200'),
    guard('main-200'),
    ...basicSafety(),
  ]
}

/** C: spread the load — side gate drop-off, a bus bay off Main, Oak curb. */
export function strategyC(): TrafficObject[] {
  return [
    program('sideGate'),
    curb('gate-curb'),
    curb('oak-curb'),
    busBay('bay-elm'),
    crosswalk('main-200'),
    beacon('main-200'),
    ...basicSafety(),
  ]
}

/** D: cheap operations — programs, guards, all-way stops, curb paint. */
export function strategyD(): TrafficObject[] {
  return [
    program('helpers'),
    program('carpool'),
    curb('loop-south'),
    curb('loop-in'),
    curb('loop-out'),
    crosswalk('main-200'),
    guard('main-200'),
    crosswalk('oak-100'),
    stop('oak-100'),
    crosswalk('elm-150'),
    stop('elm-150'),
    crosswalk('pine-200'),
    sidewalk('gap-elm-west'),
  ]
}

export function strategyEverything(): TrafficObject[] {
  return [...strategyA(), ...strategyB(), ...strategyC(), ...strategyD(), signal('out', 'side'), busBay('bay-main')]
}

export function randomish(): TrafficObject[] {
  return [crosswalk('main-360'), stop('elm-150'), curb('loop-out'), bikeLane('bl-pine')]
}
