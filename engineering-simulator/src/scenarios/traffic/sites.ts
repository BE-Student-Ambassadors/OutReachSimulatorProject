/**
 * Candidate sites for snap tools: where each tool may go given the current design,
 * with a 3D anchor for the marker and an optional outline to preview its extent.
 */
import { uid } from '../../core/format'
import { objectCost } from './cost'
import {
  BAY_SITES,
  BIKE_SEGMENTS,
  CROSS_SITES,
  CURB_EDGES,
  EXISTING_CROSSWALKS,
  GAPS,
  LANE_BY_ID,
  PED_EDGES,
  PED_NODE,
  pointAt,
  SIGNAL_NODES,
  STOP_NODES,
  TURN_SITES,
  type Pt,
} from './network'
import type { BaySiteId, BikeSegId, CrossSiteId, CurbEdgeId, GapId, SignalNodeId, StopNodeId, TrafficObject, TurnSiteId } from './types'

export interface Site {
  key: string
  /** Map coordinates of the marker. */
  x: number
  y: number
  name: string
  cost: number
  outline?: Pt[]
  make(): TrafficObject
}

const lanePts = (laneId: string, from = 0, to = Infinity): Pt[] => {
  const g = LANE_BY_ID.get(laneId)!
  const out: Pt[] = []
  let len = 0
  for (let i = 0; i < g.pts.length - 1; i++) len += Math.hypot(g.pts[i + 1][0] - g.pts[i][0], g.pts[i + 1][1] - g.pts[i][1])
  const end = Math.min(to, len)
  for (let s = from; s < end; s += 3) {
    const p = pointAt(g.pts, s)
    out.push([p.x, p.y])
  }
  const p = pointAt(g.pts, end)
  out.push([p.x, p.y])
  return out
}
const mid = (pts: Pt[]) => pts[Math.floor(pts.length / 2)]

/** Lane geometry each turn-lane / bus-bay option adds to the street. */
export const TURN_LANES: Record<TurnSiteId, string[]> = {
  'in-left': ['POCKET_IN_L'],
  'in-right': ['POCKET_IN_R'],
  'out-split': ['EXIT_L', 'EXIT_R'],
}
export const BAY_LANES: Record<BaySiteId, string> = { 'bay-main': 'BAY_MAIN', 'bay-oak': 'BAY_OAK', 'bay-elm': 'BAY_ELM' }

export const curbOutline = (edge: CurbEdgeId) => {
  const e = CURB_EDGES[edge]
  return lanePts(e.lane, e.from, e.to)
}
export const laneOutline = (laneId: string) => lanePts(laneId)

export function gapEnds(gap: GapId): [Pt, Pt] {
  const e = PED_EDGES.find((x) => x.gap === gap)!
  const a = PED_NODE.get(e.a)!
  const b = PED_NODE.get(e.b)!
  return [
    [a.x, a.y],
    [b.x, b.y],
  ]
}

export function sitesFor(tool: string, design: TrafficObject[]): Site[] {
  const markedSites = new Set<CrossSiteId>([
    ...EXISTING_CROSSWALKS,
    ...design.flatMap((o) => (o.kind === 'crosswalk' ? [o.site] : [])),
  ])
  const placed = (kind: string, key: (o: TrafficObject) => string | undefined) =>
    new Set(design.filter((o) => o.kind === kind).map(key).filter((k): k is string => !!k))
  const site = <T,>(key: string, x: number, y: number, name: string, obj: T & { kind: TrafficObject['kind'] }, outline?: Pt[]): Site => {
    const o = { id: '', ...obj } as unknown as TrafficObject
    return { key, x, y, name, outline, cost: objectCost(o), make: () => ({ ...o, id: uid(o.kind) }) as TrafficObject }
  }

  switch (tool) {
    case 'crosswalk': {
      return (Object.keys(CROSS_SITES) as CrossSiteId[])
        .filter((s) => !markedSites.has(s))
        .map((s) => site(s, CROSS_SITES[s].x, CROSS_SITES[s].y, CROSS_SITES[s].name, { kind: 'crosswalk' as const, site: s }))
    }
    case 'beacon':
    case 'guard': {
      const taken = placed(tool, (o) => ('site' in o ? (o.site as string) : undefined))
      return [...markedSites]
        .filter((s) => !taken.has(s))
        .map((s) => site(s, CROSS_SITES[s].x, CROSS_SITES[s].y, CROSS_SITES[s].name, { kind: tool, site: s }))
    }
    case 'signal': {
      const taken = placed('signal', (o) => (o.kind === 'signal' ? o.node : undefined))
      return (Object.keys(SIGNAL_NODES) as SignalNodeId[])
        .filter((n) => !taken.has(n))
        .map((n) => site(n, SIGNAL_NODES[n].x, SIGNAL_NODES[n].y, SIGNAL_NODES[n].name, { kind: 'signal' as const, node: n, split: 'even' as const }))
    }
    case 'stop': {
      const taken = placed('stop', (o) => (o.kind === 'stop' ? o.node : undefined))
      return (Object.keys(STOP_NODES) as StopNodeId[])
        .filter((n) => !taken.has(n))
        .map((n) => site(n, STOP_NODES[n].x, STOP_NODES[n].y, STOP_NODES[n].name, { kind: 'stop' as const, node: n }))
    }
    case 'curb': {
      const taken = placed('curb', (o) => (o.kind === 'curb' ? o.edge : undefined))
      return (Object.keys(CURB_EDGES) as CurbEdgeId[])
        .filter((e) => !taken.has(e))
        .map((e) => {
          const pts = curbOutline(e)
          const [x, y] = mid(pts)
          return site(e, x, y, CURB_EDGES[e].name, { kind: 'curb' as const, edge: e }, pts)
        })
    }
    case 'turnLane': {
      const taken = placed('turnLane', (o) => (o.kind === 'turnLane' ? o.site : undefined))
      return (Object.keys(TURN_SITES) as TurnSiteId[])
        .filter((t) => !taken.has(t))
        .map((t) => {
          const pts = TURN_LANES[t].flatMap((l) => laneOutline(l))
          const [x, y] = mid(laneOutline(TURN_LANES[t][0]))
          return site(t, x, y, TURN_SITES[t].name, { kind: 'turnLane' as const, site: t }, pts)
        })
    }
    case 'busBay': {
      const taken = placed('busBay', (o) => (o.kind === 'busBay' ? o.site : undefined))
      return (Object.keys(BAY_SITES) as BaySiteId[])
        .filter((b) => !taken.has(b))
        .map((b) => {
          const pts = laneOutline(BAY_LANES[b])
          const [x, y] = mid(pts)
          return site(b, x, y, BAY_SITES[b].name, { kind: 'busBay' as const, site: b }, pts)
        })
    }
    case 'bikeLane': {
      const taken = placed('bikeLane', (o) => (o.kind === 'bikeLane' ? o.segment : undefined))
      return (Object.keys(BIKE_SEGMENTS) as BikeSegId[])
        .filter((b) => !taken.has(b))
        .map((b) => {
          const pts = BIKE_SEGMENTS[b].pts
          const [x, y] = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2]
          return site(b, x, y, BIKE_SEGMENTS[b].name, { kind: 'bikeLane' as const, segment: b }, pts)
        })
    }
    case 'sidewalk': {
      const taken = placed('sidewalk', (o) => (o.kind === 'sidewalk' ? o.gap : undefined))
      return (Object.keys(GAPS) as GapId[])
        .filter((g) => !taken.has(g))
        .map((g) => {
          const pts = gapEnds(g)
          return site(g, (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2, GAPS[g].name, { kind: 'sidewalk' as const, gap: g }, pts)
        })
    }
  }
  return []
}
