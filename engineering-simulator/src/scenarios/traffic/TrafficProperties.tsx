import { count, money } from '../../core/format'
import type { PropertiesProps } from '../../core/scenario'
import { SIM } from './config'
import { bikeFt, curbFt, objectCost, sidewalkFt } from './cost'
import { BAY_SITES, BIKE_ROUTES, BIKE_SEGMENTS, CROSS_SITES, CURB_EDGES, GAPS, SIGNAL_NODES, STOP_NODES, TURN_SITES } from './network'
import type { SignalSplit, TrafficObject } from './types'

const SPLITS: { id: SignalSplit; label: string }[] = [
  { id: 'main', label: 'Main 60%' },
  { id: 'even', label: '50 / 50' },
  { id: 'side', label: 'Side 60%' },
]

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-ink/60">{k}</span>
      <span className="text-right font-mono text-sm font-medium text-ink">{v}</span>
    </div>
  )
}

export function TrafficProperties({ object: o, design, locked, onChange }: PropertiesProps<TrafficObject>) {
  const rows: [string, string][] = []
  let extra: React.ReactNode = null
  const has = (pred: (x: TrafficObject) => boolean) => design.some(pred)

  switch (o.kind) {
    case 'crosswalk':
    case 'beacon':
    case 'guard':
      rows.push(['Where', CROSS_SITES[o.site].name])
      if (o.kind === 'guard') rows.push(['Walks groups across', `every ${SIM.guard.every} s`])
      break
    case 'signal': {
      rows.push(['Where', SIGNAL_NODES[o.node].name], ['Cycle', `${SIM.signalCycle} s`])
      extra = (
        <div className="my-2">
          <div className="mb-1 text-xs font-medium text-ink/60">Green time for Main St vs. the side street</div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-paper p-1 ring-1 ring-black/5">
            {SPLITS.map((sp) => (
              <button
                key={sp.id}
                type="button"
                disabled={locked}
                onClick={() => onChange({ ...o, split: sp.id })}
                className={`rounded-md py-1.5 text-xs font-semibold transition ${o.split === sp.id ? 'bg-forest text-white shadow-sm' : 'text-ink/70 hover:bg-white'}`}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>
      )
      break
    }
    case 'stop':
      rows.push(['Where', STOP_NODES[o.node].name])
      break
    case 'curb': {
      const e = CURB_EDGES[o.edge]
      rows.push(['Where', e.name], ['Length', `${count(curbFt(o))} ft`], ['Car spaces', String(Math.floor((e.to - e.from) / SIM.slotSpacing) + 1)])
      if (e.needsGate && !has((x) => x.kind === 'program' && x.program === 'sideGate')) rows.push(['Status', 'unused while the side gate is closed'])
      break
    }
    case 'turnLane':
      rows.push(['Where', TURN_SITES[o.site].name])
      break
    case 'busBay':
      rows.push(['Where', BAY_SITES[o.site].name])
      break
    case 'bikeLane': {
      rows.push(['Street', BIKE_SEGMENTS[o.segment].name], ['Length', `${count(bikeFt(o))} ft`])
      const built = new Set(design.flatMap((x) => (x.kind === 'bikeLane' ? [x.segment] : [])))
      const route = BIKE_ROUTES.find((r) => r.segments.includes(o.segment))
      if (route) rows.push(['Route to school', route.segments.every((sg) => built.has(sg)) ? 'complete' : 'not connected yet'])
      break
    }
    case 'sidewalk':
      rows.push(['Where', GAPS[o.gap].name], ['Length', `${count(sidewalkFt(o))} ft`])
      break
    case 'program':
      break
  }

  return (
    <div>
      {extra}
      <div className="divide-y divide-black/5">
        {rows.map(([k, v]) => (
          <Row key={k} k={k} v={v} />
        ))}
        <div className="flex items-baseline justify-between gap-3 pt-2">
          <span className="text-sm font-semibold text-ink">Cost</span>
          <span className="font-mono text-base font-semibold text-ink">{money(objectCost(o))}</span>
        </div>
      </div>
    </div>
  )
}
