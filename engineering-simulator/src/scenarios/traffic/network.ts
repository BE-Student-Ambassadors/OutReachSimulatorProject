/**
 * The fictional streets around a high school (meters; x east, y south; map is 400 × 260).
 *
 *   y=19  ─────────── north sidewalk (apartments beyond) ────────────
 *   y=25/28 Main St westbound (WB_R outer, WB_L inner)
 *   y=32/35 Main St eastbound (EB_L inner, EB_R outer)
 *   y=41  ─────────── south sidewalk ─── main entrance at x=200 ─────
 *         Oak Ave x=40   |  drop-off loop x=150→250, y≤80  |  Elm St x=360
 *   y=250 Pine St
 *
 * Everything here is static geometry. The engine decides what is open, signalized, etc.
 */
import type { BaySiteId, BikeSegId, CrossSiteId, CurbEdgeId, GapId, SignalNodeId, StopNodeId, TurnSiteId } from './types'

export const MAP_W = 400
export const MAP_H = 260

export type Pt = [number, number]

export interface LaneGeom {
  id: string
  pts: Pt[]
  /** Street this lane belongs to (for the delay map and observations). */
  street: string
}

const L = (id: string, street: string, ...pts: Pt[]): LaneGeom => ({ id, street, pts })

export const LANES: LaneGeom[] = [
  L('EB_R', 'Main Street', [0, 35.25], [400, 35.25]),
  L('EB_L', 'Main Street', [0, 31.75], [400, 31.75]),
  L('WB_L', 'Main Street', [400, 28.25], [0, 28.25]),
  L('WB_R', 'Main Street', [400, 24.75], [0, 24.75]),
  L('OAK_N', 'Oak Avenue', [41.75, 260], [41.75, 37.5]),
  L('ELM_N', 'Elm Street', [361.75, 260], [361.75, 37.5]),
  L('ELM_S', 'Elm Street', [358.25, 37.5], [358.25, 260]),
  L('PINE_E', 'Pine Street', [0, 251.75], [400, 251.75]),
  L('PINE_W', 'Pine Street', [400, 248.25], [0, 248.25]),
  L('LOOP', 'Drop-off loop', [150, 37.5], [150, 80], [250, 80], [250, 37.5]),
  L('POCKET_IN_R', 'Main Street', [105, 38.6], [150, 38.6]),
  L('POCKET_IN_L', 'Main Street', [195, 30], [150, 30]),
  L('EXIT_R', 'Drop-off loop', [251.75, 62], [251.75, 37.5]),
  L('EXIT_L', 'Drop-off loop', [248.25, 62], [248.25, 37.5]),
  L('BAY_MAIN', 'Main Street', [283, 38.6], [318, 38.6]),
  L('BAY_OAK', 'Oak Avenue', [45.4, 95], [45.4, 65]),
  L('BAY_ELM', 'Elm Street', [354.6, 135], [354.6, 165]),
  L('GATE', 'Staff lot', [361.75, 150], [340, 150], [300, 150], [300, 178]),
]

export const LANE_BY_ID = new Map(LANES.map((l) => [l.id, l]))

export function polylineLength(pts: Pt[]) {
  let len = 0
  for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
  return len
}

/** Point and heading at distance s along a polyline. */
export function pointAt(pts: Pt[], s: number): { x: number; y: number; angle: number } {
  let rest = Math.max(0, s)
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[i + 1]
    const seg = Math.hypot(bx - ax, by - ay)
    if (rest <= seg || i === pts.length - 2) {
      const t = seg ? Math.min(1, rest / seg) : 0
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, angle: Math.atan2(by - ay, bx - ax) }
    }
    rest -= seg
  }
  const [x, y] = pts[pts.length - 1]
  return { x, y, angle: 0 }
}

/** EB lanes measure s = x; WB lanes s = 400 − x. */
export const ebS = (x: number) => x
export const wbS = (x: number) => MAP_W - x

// ---------------------------------------------------------------- intersections

export const SIGNAL_NODES: Record<SignalNodeId, { name: string; x: number; y: number }> = {
  oak: { name: 'Main St & Oak Ave', x: 40, y: 30 },
  in: { name: 'Main St & loop entrance', x: 150, y: 30 },
  out: { name: 'Main St & loop exit', x: 250, y: 30 },
  elm: { name: 'Main St & Elm St', x: 360, y: 30 },
}

export const STOP_NODES: Record<StopNodeId, { name: string; x: number; y: number; stops: { lane: string; s: number }[] }> = {
  'oak-100': { name: 'Oak Ave service drive', x: 40, y: 100, stops: [{ lane: 'OAK_N', s: 156 }] },
  'elm-150': { name: 'Elm St side gate', x: 360, y: 150, stops: [{ lane: 'ELM_N', s: 106 }, { lane: 'ELM_S', s: 108 }] },
}

// ---------------------------------------------------------------- pedestrian network

export interface PedNode {
  id: string
  x: number
  y: number
}
export interface CrossLane {
  lane: string
  s: number
}
export interface PedEdge {
  a: string
  b: string
  kind: 'walk' | 'gap' | 'cross'
  gap?: GapId
  /** Candidate crosswalk site, or undefined for a fixed unmarked corner crossing. */
  site?: CrossSiteId
  corner?: string
  lanes?: CrossLane[]
}

const n = (id: string, x: number, y: number): PedNode => ({ id, x, y })
export const PED_NODES: PedNode[] = [
  // North sidewalk of Main
  n('N44', 44, 19), n('N150', 150, 19), n('N200', 200, 19), n('N250', 250, 19), n('N364', 364, 19),
  // South sidewalk of Main
  n('S0', 0, 41), n('S36', 36, 41), n('S44', 44, 41), n('S150', 150, 41), n('S200', 200, 41), n('S250', 250, 41),
  n('S356', 356, 41), n('S364', 364, 41), n('S400', 400, 41),
  // Oak sidewalks
  n('O36_100', 36, 100), n('O36_246', 36, 246), n('O44_100', 44, 100), n('O44_120', 44, 120), n('O44_246', 44, 246),
  // Pine sidewalks
  n('P200n', 200, 246), n('P200s', 200, 255),
  // Elm sidewalks
  n('E356_150', 356, 150), n('E356_246', 356, 246), n('E364_150', 364, 150), n('E364_246', 364, 246),
]
export const PED_NODE = new Map(PED_NODES.map((p) => [p.id, p]))

const mainLanes = (x: number): CrossLane[] => [
  { lane: 'EB_R', s: ebS(x) },
  { lane: 'EB_L', s: ebS(x) },
  { lane: 'WB_L', s: wbS(x) },
  { lane: 'WB_R', s: wbS(x) },
]
const w = (a: string, b: string): PedEdge => ({ a, b, kind: 'walk' })

export const PED_EDGES: PedEdge[] = [
  w('N44', 'N150'), w('N150', 'N200'), w('N200', 'N250'), w('N250', 'N364'),
  w('S0', 'S36'), w('S44', 'S150'), w('S150', 'S200'), w('S200', 'S250'), w('S364', 'S400'),
  { a: 'S250', b: 'S356', kind: 'gap', gap: 'gap-main-south' },
  w('S36', 'O36_100'), w('O36_100', 'O36_246'),
  w('S44', 'O44_100'), w('O44_100', 'O44_120'),
  { a: 'O44_120', b: 'O44_246', kind: 'gap', gap: 'gap-oak-east' },
  w('O44_246', 'P200n'), w('P200n', 'E356_246'),
  w('S356', 'E356_150'),
  { a: 'E356_150', b: 'E356_246', kind: 'gap', gap: 'gap-elm-west' },
  w('S364', 'E364_150'), w('E364_150', 'E364_246'),
  // Candidate crosswalk sites
  { a: 'N44', b: 'S44', kind: 'cross', site: 'main-40', lanes: mainLanes(44) },
  { a: 'N150', b: 'S150', kind: 'cross', site: 'main-150', lanes: mainLanes(150) },
  { a: 'N200', b: 'S200', kind: 'cross', site: 'main-200', lanes: mainLanes(200) },
  { a: 'N250', b: 'S250', kind: 'cross', site: 'main-250', lanes: mainLanes(250) },
  { a: 'N364', b: 'S364', kind: 'cross', site: 'main-360', lanes: mainLanes(364) },
  { a: 'O36_100', b: 'O44_100', kind: 'cross', site: 'oak-100', lanes: [{ lane: 'OAK_N', s: 160 }] },
  { a: 'P200s', b: 'P200n', kind: 'cross', site: 'pine-200', lanes: [{ lane: 'PINE_E', s: 200 }, { lane: 'PINE_W', s: 200 }] },
  { a: 'E364_150', b: 'E356_150', kind: 'cross', site: 'elm-150', lanes: [{ lane: 'ELM_N', s: 110 }, { lane: 'ELM_S', s: 112.5 }] },
  // Fixed unmarked corner crossings (never protected)
  { a: 'S36', b: 'S44', kind: 'cross', corner: 'Oak Ave at Main St', lanes: [{ lane: 'OAK_N', s: 218 }] },
  { a: 'S356', b: 'S364', kind: 'cross', corner: 'Elm St at Main St', lanes: [{ lane: 'ELM_N', s: 218 }, { lane: 'ELM_S', s: 4 }] },
  { a: 'O36_246', b: 'O44_246', kind: 'cross', corner: 'Oak Ave at Pine St', lanes: [{ lane: 'OAK_N', s: 14 }] },
  { a: 'E356_246', b: 'E364_246', kind: 'cross', corner: 'Elm St at Pine St', lanes: [{ lane: 'ELM_N', s: 14 }, { lane: 'ELM_S', s: 208 }] },
]

export const CROSS_SITES: Record<CrossSiteId, { name: string; x: number; y: number; signal?: SignalNodeId; stop?: StopNodeId }> = {
  'main-40': { name: 'Main St at Oak Ave', x: 44, y: 30, signal: 'oak' },
  'main-150': { name: 'Main St at the loop entrance', x: 150, y: 30, signal: 'in' },
  'main-200': { name: 'Main St at the main entrance', x: 200, y: 30 },
  'main-250': { name: 'Main St at the loop exit', x: 250, y: 30, signal: 'out' },
  'main-360': { name: 'Main St at Elm St', x: 364, y: 30, signal: 'elm' },
  'oak-100': { name: 'Oak Ave at the service drive', x: 40, y: 100, stop: 'oak-100' },
  'pine-200': { name: 'Pine St', x: 200, y: 250 },
  'elm-150': { name: 'Elm St at the side gate', x: 360, y: 150, stop: 'elm-150' },
}

export const crossingEdge = (site: CrossSiteId) => PED_EDGES.findIndex((e) => e.site === site)

/** The crossing sites that exist before students change anything. */
export const EXISTING_CROSSWALKS: CrossSiteId[] = ['main-40']

export const ENTRANCES = { main: 'S200', side: 'E356_150' } as const

export const PED_ORIGINS = {
  north: { node: 'N200', spawn: [200, 4] as Pt, label: 'apartments north of Main St' },
  west: { node: 'O36_100', spawn: [2, 100] as Pt, label: 'the west neighborhood' },
  south: { node: 'P200s', spawn: [200, 259] as Pt, label: 'the south neighborhood' },
  east: { node: 'E364_150', spawn: [398, 150] as Pt, label: 'the east neighborhood' },
}
export type PedOrigin = keyof typeof PED_ORIGINS

export const GAPS: Record<GapId, { name: string; lengthM: number }> = {
  'gap-oak-east': { name: 'Oak Ave east sidewalk', lengthM: 126 },
  'gap-elm-west': { name: 'Elm St west sidewalk', lengthM: 96 },
  'gap-main-south': { name: 'Main St south sidewalk (east end)', lengthM: 106 },
}

// ---------------------------------------------------------------- drop-off, turn lanes, bus bays, bikes

/** Curb slots on each lane, as [from s, to s]. */
export const DEFAULT_CURBS: { lane: string; from: number; to: number }[] = [{ lane: 'LOOP', from: 63, to: 88 }]
export const CURB_EDGES: Record<CurbEdgeId, { name: string; lane: string; from: number; to: number; needsGate?: boolean }> = {
  'loop-in': { name: 'Loop entrance drive', lane: 'LOOP', from: 10, to: 37 },
  'loop-south': { name: 'Loop far curb', lane: 'LOOP', from: 96, to: 140 },
  'loop-out': { name: 'Loop exit drive', lane: 'LOOP', from: 146, to: 158 },
  'oak-curb': { name: 'Oak Ave curb by campus', lane: 'OAK_N', from: 118, to: 163 },
  'gate-curb': { name: 'Staff lot curb', lane: 'GATE', from: 44, to: 74, needsGate: true },
}
export const GATE_DEFAULT_CURB = { lane: 'GATE', from: 24, to: 41 }

/** Seconds to walk from each drop-off area to an entrance. */
export const WALK_FROM = { LOOP: 40, OAK_N: 140, GATE: 35, BAY_MAIN: 80, MAIN_STOP: 80, BAY_OAK: 150, BAY_ELM: 20 }

export const TURN_SITES: Record<TurnSiteId, { name: string }> = {
  'in-left': { name: 'Left-turn lane into the loop' },
  'in-right': { name: 'Right-turn lane into the loop' },
  'out-split': { name: 'Separate left/right lanes at the loop exit' },
}

export const BAY_SITES: Record<BaySiteId, { name: string }> = {
  'bay-main': { name: 'Bus bay on Main St' },
  'bay-oak': { name: 'Bus bay on Oak Ave' },
  'bay-elm': { name: 'Bus bay on Elm St' },
}

export const BIKE_SEGMENTS: Record<BikeSegId, { name: string; lengthM: number; pts: Pt[] }> = {
  'bl-oak': { name: 'Oak Ave', lengthM: 205, pts: [[44, 246], [44, 41]] },
  'bl-main': { name: 'Main St (Oak to entrance)', lengthM: 156, pts: [[44, 41], [200, 41]] },
  'bl-pine': { name: 'Pine St', lengthM: 312, pts: [[44, 246], [356, 246]] },
  'bl-elm': { name: 'Elm St (Pine to side gate)', lengthM: 96, pts: [[356, 246], [356, 150]] },
}
/** Bike routes that, once fully built, let riders reach school without crossing traffic. */
export const BIKE_ROUTES: { segments: BikeSegId[]; origins: PedOrigin[]; entrance: keyof typeof ENTRANCES }[] = [
  { segments: ['bl-oak', 'bl-main'], origins: ['west', 'south'], entrance: 'main' },
  { segments: ['bl-pine', 'bl-elm'], origins: ['south'], entrance: 'side' },
]
