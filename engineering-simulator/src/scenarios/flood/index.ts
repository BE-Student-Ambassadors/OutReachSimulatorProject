import { BrickWall, CircleDot, Droplets, Fan, Flower2, Grid3x3, Spline, TreeDeciduous, Waves } from 'lucide-react'
import { money } from '../../core/format'
import type { Scenario, ToolDef } from '../../core/scenario'
import { BUDGET, CELL_FT, COST, REQUIRED } from './config'
import { FloodWorld } from './FloodWorld'
import type { FloodObject } from './types'

/** Filled in by the simulation (phase 2). */
export interface FloodResult {
  maxFloodIn: number
  runoffManagedPct: number
}

const perFt = (n: number) => `$${n} / ft`

const tools: ToolDef[] = [
  { id: 'drain', label: 'Storm Drain', icon: CircleDot, accent: '#38bdf8', priceLabel: money(COST.drain), summary: 'Collects surface water nearby. Works best when piped to an outlet.', placement: 'point' },
  { id: 'pipe', label: 'Drainage Pipe', icon: Spline, accent: '#a78bfa', priceLabel: `from ${perFt(COST.pipePerFt.small)}`, summary: 'Carries water underground between drains, ponds, and outlets.', placement: 'path' },
  { id: 'channel', label: 'Drainage Channel', icon: Waves, accent: '#22d3ee', priceLabel: perFt(COST.channelPerFt), summary: 'An open ditch. Surface water prefers to flow along it.', placement: 'path' },
  { id: 'pond', label: 'Retention Pond', icon: Droplets, accent: '#3b82f6', priceLabel: `from ${money(COST.pond.small)}`, summary: 'Stores stormwater until it is full.', placement: 'footprint' },
  { id: 'rainGarden', label: 'Rain Garden', icon: Flower2, accent: '#f472b6', priceLabel: money(COST.rainGarden), summary: 'Planted basin that soaks up runoff very quickly.', placement: 'footprint' },
  { id: 'permeable', label: 'Permeable Pavement', icon: Grid3x3, accent: '#fbbf24', priceLabel: `${money(COST.permeablePerCell / (CELL_FT * CELL_FT))} / sq ft`, summary: 'Replaces asphalt or concrete with paving that lets water soak through.', placement: 'paint' },
  { id: 'pump', label: 'Pump', icon: Fan, accent: '#fb923c', priceLabel: `from ${money(COST.pump.small)}`, summary: 'Moves water from its intake to a spot you choose, at a limited rate.', placement: 'point' },
  { id: 'barrier', label: 'Flood Barrier', icon: BrickWall, accent: '#f87171', priceLabel: perFt(COST.barrierPerFt), summary: 'A low wall that blocks surface water.', placement: 'path' },
  { id: 'tree', label: 'Tree', icon: TreeDeciduous, accent: '#4ade80', priceLabel: money(COST.tree), summary: 'Roots and canopy help a little water soak in nearby.', placement: 'point' },
]

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
  tools,
  requirements: [
    {
      id: 'flood',
      label: 'Building Flooding',
      target: `≤ ${REQUIRED.maxFloodIn.toFixed(1)} in`,
      status: (r) =>
        r ? { value: `${r.maxFloodIn.toFixed(1)} in`, pass: r.maxFloodIn <= REQUIRED.maxFloodIn } : { value: null, pass: null },
    },
    {
      id: 'runoff',
      label: 'Runoff Managed',
      target: `≥ ${REQUIRED.runoffManagedPct}%`,
      status: (r) =>
        r
          ? { value: `${Math.floor(r.runoffManagedPct)}%`, pass: r.runoffManagedPct >= REQUIRED.runoffManagedPct }
          : { value: null, pass: null },
    },
    {
      id: 'budget',
      label: 'Project Cost',
      target: `≤ ${money(BUDGET)}`,
      status: (_r, cost) => ({ value: money(cost), pass: cost <= BUDGET }),
    },
  ],
  initialDesign: () => [],
  cost: () => 0,
  World: FloodWorld,
}
