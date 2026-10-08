import { BrickWall, CircleDot, Droplets, Fan, Flower2, Grid3x3, Spline, TreeDeciduous, Waves } from 'lucide-react'
import { count, money } from '../../core/format'
import type { Scenario, ToolDef } from '../../core/scenario'
import { BUDGET, CELL_FT, COST, GAL_PER_CELL_INCH, REQUIRED, STORMS, type StormId } from './config'
import { designCost } from './cost'
import { FloodProperties } from './FloodProperties'
import { campus, FloodRun, type FloodResult, type OffsiteEdge } from './sim/engine'
import type { FloodObject } from './types'
import { FloodWorld } from './world/FloodWorld'

const perFt = (n: number) => `$${n} / ft`
const gal = (cellIn: number) => `${count(cellIn * GAL_PER_CELL_INCH)} gal`

const tools: ToolDef[] = [
  { id: 'drain', label: 'Storm Drain', icon: CircleDot, accent: '#3d4a43', priceLabel: money(COST.drain), summary: 'Collects surface water nearby. Holds very little unless piped somewhere.', placement: 'point' },
  { id: 'pipe', label: 'Drainage Pipe', icon: Spline, accent: '#7c5cbf', priceLabel: `from ${perFt(COST.pipePerFt.small)}`, summary: 'Carries water underground from a drain or pond to a drain, pond, or outlet.', placement: 'link' },
  { id: 'channel', label: 'Drainage Channel', icon: Waves, accent: '#2b8a8a', priceLabel: perFt(COST.channelPerFt), summary: 'An open ditch. Surface water that reaches it flows along it.', placement: 'path' },
  { id: 'pond', label: 'Retention Pond', icon: Droplets, accent: '#2f6f6a', priceLabel: `from ${money(COST.pond.small)}`, summary: 'Stores stormwater until it is full.', placement: 'footprint' },
  { id: 'rainGarden', label: 'Rain Garden', icon: Flower2, accent: '#b8508a', priceLabel: money(COST.rainGarden), summary: 'Planted basin that soaks up runoff very quickly.', placement: 'footprint' },
  { id: 'permeable', label: 'Permeable Pavement', icon: Grid3x3, accent: '#b8902f', priceLabel: `${money(COST.permeablePerCell / (CELL_FT * CELL_FT))} / sq ft`, summary: 'Replaces asphalt or concrete with paving that lets water soak through.', placement: 'paint' },
  { id: 'pump', label: 'Pump', icon: Fan, accent: '#d0702a', priceLabel: `from ${money(COST.pump.small)}`, summary: 'Moves water from its intake to a spot you choose, at a limited rate.', placement: 'point' },
  { id: 'barrier', label: 'Flood Barrier', icon: BrickWall, accent: '#7d847f', priceLabel: perFt(COST.barrierPerFt), summary: 'A low wall that blocks surface water.', placement: 'path' },
  { id: 'tree', label: 'Tree', icon: TreeDeciduous, accent: '#3f7d46', priceLabel: money(COST.tree), summary: 'Roots and canopy help a little water soak in nearby.', placement: 'point' },
]

const EDGE_NAME: Record<OffsiteEdge, string> = {
  north: 'across the north edge',
  south: 'across the south edge',
  east: 'across the east edge',
  west: 'across the west edge',
  creek: 'into the creek as surface runoff',
}

function observations(r: FloodResult): string[] {
  const out: string[] = []
  const order = campus.buildings.map((b, i) => ({ b, d: r.buildingFloodIn[i] })).sort((a, b) => b.d - a.d)
  out.push(`${order[0].b.name} had the deepest water against its walls: ${order[0].d.toFixed(1)} in.`)
  for (const { b, d } of order.slice(1)) if (d > REQUIRED.maxFloodIn) out.push(`${b.name} also flooded: ${d.toFixed(1)} in.`)
  const t = r.totals
  const offPct = (100 * t.offsite) / t.rain
  if (offPct >= 2) {
    const [edge] = (Object.entries(r.offsiteBy) as [OffsiteEdge, number][]).sort((a, b) => b[1] - a[1])[0]
    out.push(`${Math.round(offPct)}% of the rain ran off campus unmanaged, mostly ${EDGE_NAME[edge]}.`)
  }
  if (t.ponded / t.rain >= 0.02) out.push(`${gal(t.ponded)} was still standing on the ground when the storm ended.`)
  r.ponds.forEach((p, i) => {
    const name = r.ponds.length > 1 ? `Pond ${i + 1}` : 'The retention pond'
    if (p.fillPct >= 99) out.push(`${name} filled completely.`)
    else out.push(`${name} filled to ${Math.round(p.fillPct)}% of its capacity.`)
  })
  if (r.overloadedDrains) out.push(`${r.overloadedDrains} storm drain${r.overloadedDrains > 1 ? 's' : ''} could not take in water as fast as it arrived.`)
  if (r.pipesAtCapacity) out.push(`${r.pipesAtCapacity} pipe${r.pipesAtCapacity > 1 ? 's' : ''} ran completely full during the storm.`)
  return out
}

export const floodScenario: Scenario<FloodObject, FloodResult> = {
  id: 'flood',
  title: 'Flooded Campus',
  discipline: 'Civil + Environmental Engineering',
  tagline: 'A severe storm is approaching. Protect the school from flooding.',
  intro: {
    heading: 'Severe Storm Warning',
    paragraphs: [
      'A major storm is approaching Sequoia High School.',
      "The campus's existing drainage system cannot handle the expected rainfall. Several classrooms and important facilities are at risk of flooding.",
      'Your engineering team has been asked to redesign the campus stormwater system.',
      'Protect the school while staying within budget.',
    ],
  },
  instructions: [
    'Drag engineering tools onto the campus.',
    `Stay within your ${money(BUDGET)} budget.`,
    'Press RUN STORM TEST.',
    'Use the results to improve your design.',
    'Meet all three requirements.',
  ],
  budget: BUDGET,
  runLabel: 'Run Storm Test',
  variants: [
    { id: 'standard', label: STORMS.standard.label, blurb: `${STORMS.standard.rainIn} in of rain` },
    { id: 'advanced', label: STORMS.advanced.label, blurb: '+50% rainfall', requiresPass: true },
  ],
  tools,
  requirements: [
    {
      id: 'flood',
      label: 'Building Flooding',
      passLabel: 'Buildings Protected',
      target: `≤ ${REQUIRED.maxFloodIn.toFixed(1)} in`,
      status: (r) =>
        r ? { value: `${r.maxFloodIn.toFixed(1)} in`, pass: r.maxFloodIn <= REQUIRED.maxFloodIn } : { value: null, pass: null },
    },
    {
      id: 'runoff',
      label: 'Runoff Managed',
      passLabel: 'Runoff Managed',
      target: `≥ ${REQUIRED.runoffManagedPct}%`,
      status: (r) =>
        r
          ? { value: `${Math.floor(r.runoffManagedPct)}%`, pass: r.runoffManagedPct >= REQUIRED.runoffManagedPct }
          : { value: null, pass: null },
    },
    {
      id: 'budget',
      label: 'Project Cost',
      passLabel: 'Within Budget',
      target: `≤ ${money(BUDGET)}`,
      status: (_r, cost) => ({ value: money(cost), pass: cost <= BUDGET }),
    },
  ],
  initialDesign: () => [],
  cost: designCost,
  remove: (design, id) => design.filter((o) => o.id !== id && !(o.kind === 'pipe' && (o.from === id || o.to === id))),
  createRun: (design, variantId) => new FloodRun(design, variantId as StormId),
  observations,
  stats: (r, design) => [
    { label: 'Total cost', value: money(designCost(design)) },
    { label: 'Max building flooding', value: `${r.maxFloodIn.toFixed(1)} in` },
    { label: 'Runoff managed', value: `${r.runoffManagedPct.toFixed(1)}%` },
    { label: 'Components', value: String(r.componentCount) },
    { label: 'Water stored', value: gal(r.totals.stored) },
    { label: 'Water soaked in', value: gal(r.totals.infiltrated) },
    { label: 'Water drained to outlets', value: gal(r.totals.drained) },
    { label: 'Water pumped', value: gal(r.totals.pumped) },
  ],
  summary: (r) => `${r.maxFloodIn.toFixed(1)} in · ${Math.floor(r.runoffManagedPct)}%`,
  World: FloodWorld,
  Properties: FloodProperties,
  overlayLabel: 'Flood map',
}
