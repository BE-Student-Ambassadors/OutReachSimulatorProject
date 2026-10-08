import { COST, M_TO_FT } from './config'
import { BIKE_SEGMENTS, CURB_EDGES, GAPS } from './network'
import type { TrafficObject } from './types'

export const curbFt = (o: Extract<TrafficObject, { kind: 'curb' }>) => (CURB_EDGES[o.edge].to - CURB_EDGES[o.edge].from) * M_TO_FT
export const bikeFt = (o: Extract<TrafficObject, { kind: 'bikeLane' }>) => BIKE_SEGMENTS[o.segment].lengthM * M_TO_FT
export const sidewalkFt = (o: Extract<TrafficObject, { kind: 'sidewalk' }>) => GAPS[o.gap].lengthM * M_TO_FT

export function objectCost(o: TrafficObject): number {
  switch (o.kind) {
    case 'crosswalk':
      return COST.crosswalk
    case 'beacon':
      return COST.beacon
    case 'guard':
      return COST.guard
    case 'signal':
      return COST.signal
    case 'stop':
      return COST.stop
    case 'curb':
      return Math.round((curbFt(o) * COST.curbPerFt) / 100) * 100
    case 'turnLane':
      return COST.turnLane
    case 'busBay':
      return COST.busBay
    case 'bikeLane':
      return Math.round((bikeFt(o) * COST.bikeLanePerFt) / 100) * 100
    case 'sidewalk':
      return Math.round((sidewalkFt(o) * COST.sidewalkPerFt) / 100) * 100
    case 'program':
      return COST.program[o.program]
  }
}

export const designCost = (design: TrafficObject[]) => design.reduce((sum, o) => sum + objectCost(o), 0)
