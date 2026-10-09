import { TrafficArt } from './CardArt'
import { Bike, BusFront, CornerUpLeft, DoorOpen, Footprints, HandHelping, Octagon, Route, ShieldUser, Siren, SquareParking, TrafficCone, Users } from 'lucide-react'
import { count, money, uid } from '../../core/format'
import type { Scenario, ToolDef } from '../../core/scenario'
import { BUDGET, COST, REQUIRED, VARIANTS, type VariantId } from './config'
import { designCost } from './cost'
import { TrafficRun, type TrafficResult } from './sim/engine'
import { TrafficProperties } from './TrafficProperties'
import type { ProgramId, TrafficObject } from './types'
import { TrafficWorld } from './world/TrafficWorld'

const perFt = (n: number) => `$${n} / ft`

const tools: ToolDef[] = [
  { id: 'crosswalk', label: 'Crosswalk', icon: Footprints, accent: '#3d4a43', priceLabel: money(COST.crosswalk), summary: 'Painted crossing. Drivers must yield to people in it.', placement: 'snap' },
  { id: 'beacon', label: 'Flashing Beacon', icon: Siren, accent: '#d9a52b', priceLabel: money(COST.beacon), summary: 'Push-button lights on a crosswalk. Drivers stop sooner and more reliably.', placement: 'snap' },
  { id: 'signal', label: 'Traffic Signal', icon: TrafficCone, accent: '#b8461b', priceLabel: money(COST.signal), summary: 'Takes turns between Main St and the side street, with a walk phase.', placement: 'snap' },
  { id: 'stop', label: 'All-Way Stop', icon: Octagon, accent: '#c0392b', priceLabel: money(COST.stop), summary: 'Every car stops before going. Only on quieter streets.', placement: 'snap' },
  { id: 'guard', label: 'Crossing Guard', icon: ShieldUser, accent: '#2c5b3c', priceLabel: money(COST.guard), summary: 'Stops traffic and walks groups across a crosswalk.', placement: 'snap' },
  { id: 'curb', label: 'Drop-off Curb', icon: SquareParking, accent: '#7c5cbf', priceLabel: perFt(COST.curbPerFt), summary: 'More curb space where cars can stop to let students out.', placement: 'snap' },
  { id: 'turnLane', label: 'Turn Lane', icon: CornerUpLeft, accent: '#5d7ea6', priceLabel: money(COST.turnLane), summary: 'Lets turning cars wait in their own lane.', placement: 'snap' },
  { id: 'busBay', label: 'Bus Bay', icon: BusFront, accent: '#d0702a', priceLabel: money(COST.busBay), summary: 'A pull-out where buses stop out of the traffic lane.', placement: 'snap' },
  { id: 'bikeLane', label: 'Bike Lane', icon: Bike, accent: '#2b8a8a', priceLabel: perFt(COST.bikeLanePerFt), summary: 'A marked lane for bikes along a street.', placement: 'snap' },
  { id: 'sidewalk', label: 'Sidewalk', icon: Route, accent: '#8a8a7a', priceLabel: perFt(COST.sidewalkPerFt), summary: 'Fills a missing piece of sidewalk.', placement: 'snap' },
  { id: 'program:carpool', label: 'Carpool Program', icon: Users, accent: '#3f7d46', priceLabel: money(COST.program.carpool), summary: 'Families share rides: fewer cars for the same students.', placement: 'program' },
  { id: 'program:sideGate', label: 'Open Side Gate', icon: DoorOpen, accent: '#3f7d46', priceLabel: money(COST.program.sideGate), summary: 'Staff open a drop-off area in the staff lot, reached from Elm St.', placement: 'program' },
  { id: 'program:helpers', label: 'Drop-off Helpers', icon: HandHelping, accent: '#3f7d46', priceLabel: money(COST.program.helpers), summary: 'Volunteers keep the line moving: cars pull forward and students hop out fast.', placement: 'program' },
]

function observations(r: TrafficResult): string[] {
  const out: string[] = []
  if (r.lateStudents > 0) out.push(`${count(r.lateStudents)} students (${(100 - r.onTimePct).toFixed(0)}%) reached school after the bell.`)
  else out.push('Every student reached school before the bell.')
  if (r.mainQueueMin >= 1) out.push(`Drop-off cars were queued on Main Street for ${Math.round(r.mainQueueMin)} minutes (longest queue: ${r.maxMainQueue} cars).`)
  if (r.unsafeSpots.length) {
    const top = r.unsafeSpots[0]
    out.push(`Most unsafe crossings (${top.students} students) happened at ${top.name}.`)
    if (r.unsafeSpots.length > 1) out.push(`Unsafe crossings also happened at ${r.unsafeSpots.slice(1, 3).map((s) => s.name).join(' and ')}.`)
  }
  const late = r.busLateMin.map((m, i) => ({ m, i })).filter((b) => b.m >= 2)
  if (late.length) {
    const worst = late.sort((a, b) => b.m - a.m)[0]
    out.push(`${late.length} of ${r.busLateMin.length} buses ran late (Bus ${worst.i + 1} by ${Math.round(worst.m)} minutes).`)
  }
  out.push(`The average drop-off car took ${r.avgDropWaitMin.toFixed(1)} minutes from arriving to letting students out.`)
  return out
}

export const trafficScenario: Scenario<TrafficObject, TrafficResult> = {
  id: 'traffic',
  title: 'Morning Traffic',
  discipline: 'Civil + Transportation Engineering',
  tagline: 'Drop-off traffic is gridlocked. Get everyone to class on time, safely.',
  intro: {
    heading: 'Morning Gridlock',
    paragraphs: [
      'Every morning, traffic around Sequoia High School grinds to a halt.',
      'Parent drop-off lines spill onto Main Street, buses get stuck, and students dodge cars to make it to class.',
      'The city has asked your engineering team to redesign how students get to school.',
      'Get students to class on time and safely, while staying within budget.',
    ],
  },
  instructions: [
    'Add crossings, lanes, curbs, and programs around the school.',
    `Stay within your ${money(BUDGET)} budget.`,
    'Press RUN MORNING TEST.',
    'Use the results to improve your design.',
    'Meet all three requirements.',
  ],
  budget: BUDGET,
  runLabel: 'Run Morning Test',
  variants: [
    { id: 'standard', label: VARIANTS.standard.label, blurb: '1,800 students, 7:25–8:05' },
    { id: 'rainy', label: VARIANTS.rainy.label, blurb: 'more cars, slower roads', requiresPass: true },
  ],
  tools,
  requirements: [
    {
      id: 'onTime',
      label: 'Students On Time',
      passLabel: 'Students On Time',
      target: `≥ ${REQUIRED.onTimePct}%`,
      status: (r) => (r ? { value: `${Math.floor(r.onTimePct)}%`, pass: r.onTimePct >= REQUIRED.onTimePct } : { value: null, pass: null }),
    },
    {
      id: 'unsafe',
      label: 'Unsafe Crossings',
      passLabel: 'Safe Crossings',
      target: `≤ ${REQUIRED.maxUnsafe}`,
      status: (r) => (r ? { value: count(r.unsafe), pass: r.unsafe <= REQUIRED.maxUnsafe } : { value: null, pass: null }),
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
  remove: (design, id) => {
    const gone = design.find((o) => o.id === id)
    // A beacon or guard belongs to its crosswalk: removing the crosswalk removes them too.
    return design.filter(
      (o) => o.id !== id && !(gone?.kind === 'crosswalk' && (o.kind === 'beacon' || o.kind === 'guard') && o.site === gone.site),
    )
  },
  programs: {
    isOn: (design, toolId) => design.some((o) => o.kind === 'program' && `program:${o.program}` === toolId),
    toggle: (design, toolId) => {
      const program = toolId.replace('program:', '') as ProgramId
      const on = design.some((o) => o.kind === 'program' && o.program === program)
      return on
        ? design.filter((o) => !(o.kind === 'program' && o.program === program))
        : [...design, { id: uid('program'), kind: 'program', program }]
    },
  },
  createRun: (design, variantId) => new TrafficRun(design, variantId as VariantId),
  observations,
  stats: (r, design) => [
    { label: 'Total cost', value: money(designCost(design)) },
    { label: 'Students on time', value: `${r.onTimePct.toFixed(1)}%` },
    { label: 'Unsafe crossings', value: count(r.unsafe) },
    { label: 'Avg drop-off time', value: `${r.avgDropWaitMin.toFixed(1)} min` },
    { label: 'Longest Main St queue', value: `${r.maxMainQueue} cars` },
    { label: 'Late buses', value: String(r.busLateMin.filter((m) => m >= 2).length) },
    { label: 'By car / bus', value: `${Math.round(r.modeSplit.car * 100)}% / ${Math.round(r.modeSplit.bus * 100)}%` },
    { label: 'Walk / bike', value: `${Math.round(r.modeSplit.walk * 100)}% / ${Math.round(r.modeSplit.bike * 100)}%` },
    { label: 'Car idling', value: `${count(r.idleMin)} min` },
  ],
  summary: (r) => `${Math.floor(r.onTimePct)}% · ${r.unsafe} unsafe`,
  World: TrafficWorld,
  Properties: TrafficProperties,
  CardArt: TrafficArt,
}
