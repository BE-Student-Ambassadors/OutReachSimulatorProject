/** Things students can place. Most snap to fixed candidate sites so the street network stays valid. */

export type CrossSiteId = 'main-40' | 'main-150' | 'main-200' | 'main-250' | 'main-360' | 'oak-100' | 'pine-200' | 'elm-150'
export type SignalNodeId = 'oak' | 'in' | 'out' | 'elm'
export type StopNodeId = 'oak-100' | 'elm-150'
export type CurbEdgeId = 'loop-in' | 'loop-south' | 'loop-out' | 'oak-curb' | 'gate-curb'
export type TurnSiteId = 'in-left' | 'in-right' | 'out-split'
export type BaySiteId = 'bay-main' | 'bay-oak' | 'bay-elm'
export type BikeSegId = 'bl-oak' | 'bl-main' | 'bl-pine' | 'bl-elm'
export type GapId = 'gap-oak-east' | 'gap-elm-west' | 'gap-main-south'
export type ProgramId = 'carpool' | 'sideGate' | 'helpers'
export type SignalSplit = 'main' | 'even' | 'side'

export type CrosswalkObj = { id: string; kind: 'crosswalk'; site: CrossSiteId }
export type BeaconObj = { id: string; kind: 'beacon'; site: CrossSiteId }
export type GuardObj = { id: string; kind: 'guard'; site: CrossSiteId }
export type SignalObj = { id: string; kind: 'signal'; node: SignalNodeId; split: SignalSplit }
export type StopObj = { id: string; kind: 'stop'; node: StopNodeId }
export type CurbObj = { id: string; kind: 'curb'; edge: CurbEdgeId }
export type TurnLaneObj = { id: string; kind: 'turnLane'; site: TurnSiteId }
export type BusBayObj = { id: string; kind: 'busBay'; site: BaySiteId }
export type BikeLaneObj = { id: string; kind: 'bikeLane'; segment: BikeSegId }
export type SidewalkObj = { id: string; kind: 'sidewalk'; gap: GapId }
export type ProgramObj = { id: string; kind: 'program'; program: ProgramId }

export type TrafficObject =
  | CrosswalkObj
  | BeaconObj
  | GuardObj
  | SignalObj
  | StopObj
  | CurbObj
  | TurnLaneObj
  | BusBayObj
  | BikeLaneObj
  | SidewalkObj
  | ProgramObj

export type TrafficKind = TrafficObject['kind']
