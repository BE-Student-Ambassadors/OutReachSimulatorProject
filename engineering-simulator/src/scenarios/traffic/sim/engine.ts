/**
 * Morning Traffic simulation. Pure TypeScript: no React, no DOM. Deterministic (seeded).
 *
 * Vehicles drive along fixed lanes (no lane changes) with a simple follow-the-leader rule.
 * Turns and merges are "transfers" between lanes, guarded by gap acceptance, signals,
 * or stop signs. Drop-off cars queue for curb slots. Walkers and bikes route over a
 * sidewalk graph and choose between a legal route and a shorter one that jaywalks.
 *
 * Unsafe crossing (counted in students): a walker/bike group enters a vehicle lane
 *   - at an unmarked spot (mid-block or a corner without a crosswalk), or
 *   - at a plain crosswalk (no signal, beacon, guard, or all-way stop) while a moving
 *     car is within SIM.unsafeSec of the crossing.
 * On time: a student reaches an entrance before the 8:05 bell.
 */
import { CLOCK, SIM, VARIANTS, type VariantId } from '../config'
import {
  BIKE_ROUTES,
  CROSS_SITES,
  CURB_EDGES,
  DEFAULT_CURBS,
  ENTRANCES,
  EXISTING_CROSSWALKS,
  GATE_DEFAULT_CURB,
  LANES,
  PED_EDGES,
  PED_NODE,
  PED_NODES,
  PED_ORIGINS,
  SIGNAL_NODES,
  STOP_NODES,
  WALK_FROM,
  ebS,
  pointAt,
  polylineLength,
  wbS,
  type LaneGeom,
  type PedEdge,
  type PedOrigin,
  type Pt,
} from '../network'
import type { CrossSiteId, SignalNodeId, SignalSplit, StopNodeId, TrafficObject } from '../types'

// ---------------------------------------------------------------- types

type Gate = (car: Car) => boolean

interface Lane {
  id: string
  geom: LaneGeom
  len: number
  v0: number
  cars: Car[]
  slots: Slot[]
  walkFromSlots: number
  signalStops: { s: number; node: SignalNodeId }[]
  stopSigns: { s: number; node: StopNodeId }[]
  crossings: { s: number; edge: number }[]
  /** Stopped car-seconds per 5 m bin (delay map). */
  delay: Float32Array
}

interface Slot {
  s: number
  car: Car | null
}

interface Leg {
  lane: Lane
  end: number
  next: { lane: Lane; s: number; gate: Gate } | null
  curb?: boolean
  stop?: { s: number; walk: number; despawn: boolean }
}

export interface Car {
  id: number
  kind: 'school' | 'through' | 'bus'
  lane: Lane
  s: number
  v: number
  len: number
  legs: Leg[]
  leg: number
  students: number
  spawnT: number
  dropT: number | null
  walk: number
  state: 'pending' | 'drive' | 'parked' | 'dwell' | 'done'
  slot: Slot | null
  until: number
  stopWait: number
  passed: Set<string>
  origin: string
  /** Has dropped its students (school cars, buses). */
  dropped: boolean
}

export interface Ped {
  id: number
  kind: 'walk' | 'bike'
  students: number
  path: { x0: number; y0: number; x1: number; y1: number; len: number; edge: number }[]
  i: number
  along: number
  state: 'pending' | 'move' | 'wait' | 'done'
  waited: number
  spawnT: number
  arriveT: number | null
  x: number
  y: number
  origin: PedOrigin
  jaywalks: boolean
}

export interface UnsafeSpot {
  name: string
  x: number
  y: number
  students: number
}

export interface TrafficResult {
  variant: VariantId
  onTimePct: number
  lateStudents: number
  totalStudents: number
  unsafe: number
  unsafeSpots: UnsafeSpot[]
  maxMainQueue: number
  mainQueueMin: number
  avgDropWaitMin: number
  /** Minutes late relative to schedule, per bus. */
  busLateMin: number[]
  modeSplit: { car: number; bus: number; walk: number; bike: number }
  idleMin: number
  laneDelay: Record<string, Float32Array>
  componentCount: number
}

// ---------------------------------------------------------------- helpers

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const triangular = (r: number, a: number, c: number, b: number) =>
  r < (c - a) / (b - a) ? a + Math.sqrt(r * (b - a) * (c - a)) : b - Math.sqrt((1 - r) * (b - a) * (b - c))

const TICKS = Math.round(((CLOCK.endMin - CLOCK.startMin) * 60) / SIM.dt)
const BELL = (CLOCK.bellMin - CLOCK.startMin) * 60

// ---------------------------------------------------------------- the run

export class TrafficRun {
  readonly variant: VariantId
  readonly totalTicks = TICKS
  tick = 0
  t = 0

  readonly lanes = new Map<string, Lane>()
  readonly cars: Car[] = []
  readonly peds: Ped[] = []
  /** Seconds until which each pedestrian edge is occupied by people crossing. */
  readonly edgeBusy = new Float64Array(PED_EDGES.length)
  /** Every unsafe crossing so far (append-only, for the 3D flash), as [x, y, sim time]. */
  readonly flashes: [number, number, number][] = []

  private readonly r = rng(20251008)
  private readonly signals = new Map<SignalNodeId, number>()
  private readonly stopQueues = new Map<StopNodeId, { queue: Car[]; lastGo: number }>()
  private readonly guards = new Map<number, { next: number; holdUntil: number }>()
  private readonly beacons = new Set<number>()
  private readonly marked = new Set<CrossSiteId>()
  private readonly pending: Car[] = []
  private readonly dwell: number
  private readonly pullForward: boolean
  private readonly speedMul: number
  private readonly componentCount: number
  private readonly modeSplit: TrafficResult['modeSplit']
  private readonly unsafeByEdge = new Float64Array(PED_EDGES.length)
  private readonly busSchedule = new Map<number, number>()
  private queueTicks = 0
  private maxQueue = 0
  private idleSec = 0
  private nextId = 1

  constructor(design: TrafficObject[], variant: VariantId = 'standard') {
    this.variant = variant
    const V = VARIANTS[variant]
    this.componentCount = design.length
    this.speedMul = V.speedMul
    const has = <K extends TrafficObject['kind']>(kind: K, pred: (o: Extract<TrafficObject, { kind: K }>) => boolean) =>
      design.some((o) => o.kind === kind && pred(o as Extract<TrafficObject, { kind: K }>))
    const program = (p: string) => has('program', (o) => o.program === p)
    const sideGate = program('sideGate')
    const helpers = program('helpers')
    this.dwell = (helpers ? SIM.dwell.helpers : SIM.dwell.normal) + V.dwellExtra
    this.pullForward = helpers

    // Lanes
    for (const g of LANES) {
      const len = polylineLength(g.pts)
      const v0 =
        g.id.startsWith('EB') || g.id.startsWith('WB')
          ? SIM.speed.main
          : g.id === 'LOOP' || g.id.startsWith('EXIT') || g.id === 'GATE' || g.id.startsWith('BAY')
            ? SIM.speed.loop
            : SIM.speed.side
      this.lanes.set(g.id, {
        id: g.id, geom: g, len, v0, cars: [], slots: [], walkFromSlots: 0,
        signalStops: [], stopSigns: [], crossings: [], delay: new Float32Array(Math.ceil(len / 5) + 1),
      })
    }
    const lane = (id: string) => this.lanes.get(id)!

    // Curb slots
    const addCurb = (laneId: string, from: number, to: number) => {
      const l = lane(laneId)
      for (let s = from; s <= to + 0.01; s += SIM.slotSpacing) l.slots.push({ s, car: null })
      l.slots.sort((a, b) => a.s - b.s)
    }
    for (const c of DEFAULT_CURBS) addCurb(c.lane, c.from, c.to)
    if (sideGate) addCurb(GATE_DEFAULT_CURB.lane, GATE_DEFAULT_CURB.from, GATE_DEFAULT_CURB.to)
    for (const o of design) {
      if (o.kind !== 'curb') continue
      const e = CURB_EDGES[o.edge]
      if (e.needsGate && !sideGate) continue
      addCurb(e.lane, e.from, e.to)
    }
    lane('LOOP').walkFromSlots = WALK_FROM.LOOP
    lane('OAK_N').walkFromSlots = WALK_FROM.OAK_N
    lane('GATE').walkFromSlots = WALK_FROM.GATE

    // Crosswalks, beacons, guards, signals, stops
    for (const s of EXISTING_CROSSWALKS) this.marked.add(s)
    for (const o of design) if (o.kind === 'crosswalk' || o.kind === 'beacon' || o.kind === 'guard') this.marked.add(o.site)
    const edgeOfSite = (site: CrossSiteId) => PED_EDGES.findIndex((e) => e.site === site)
    for (const o of design) if (o.kind === 'beacon') this.beacons.add(edgeOfSite(o.site))
    for (const o of design) if (o.kind === 'guard') this.guards.set(edgeOfSite(o.site), { next: SIM.guard.every, holdUntil: -1 })
    for (const o of design) if (o.kind === 'signal') this.signals.set(o.node, SIM.signalSplit[o.split as SignalSplit])
    for (const o of design) if (o.kind === 'stop') this.stopQueues.set(o.node, { queue: [], lastGo: -10 })

    for (const id of this.signals.keys()) {
      const x = SIGNAL_NODES[id].x
      for (const l of ['EB_R', 'EB_L']) lane(l).signalStops.push({ s: ebS(x) - 8, node: id })
      for (const l of ['WB_R', 'WB_L']) lane(l).signalStops.push({ s: wbS(x) - 8, node: id })
    }
    for (const [id] of this.stopQueues) for (const st of STOP_NODES[id].stops) lane(st.lane).stopSigns.push({ s: st.s, node: id })
    PED_EDGES.forEach((e, i) => e.lanes?.forEach((cl) => lane(cl.lane).crossings.push({ s: cl.s, edge: i })))

    // ---------------------------------------------------------------- demand
    const N = SIM.students
    const extraCar = N * SIM.share.car * (V.carMul - 1)
    const softShare = SIM.share.walk + SIM.share.bike
    let walkStudents = N * SIM.share.walk - extraCar * (SIM.share.walk / softShare)
    let bikeStudents = N * SIM.share.bike - extraCar * (SIM.share.bike / softShare)
    let carStudents = N * SIM.share.car + extraCar
    const busStudents = N * SIM.share.bus

    const segs = new Set(design.flatMap((o) => (o.kind === 'bikeLane' ? [o.segment] : [])))
    const routes = BIKE_ROUTES.filter((r) => r.segments.every((s) => segs.has(s)))
    const shift = Math.min(carStudents * 0.5, routes.length * SIM.bikeShiftPerRoute * N)
    carStudents -= shift
    bikeStudents += shift
    walkStudents = Math.max(0, walkStudents)
    bikeStudents = Math.max(0, bikeStudents)
    this.modeSplit = { car: carStudents / N, bus: busStudents / N, walk: walkStudents / N, bike: bikeStudents / N }

    // ---------------------------------------------------------------- vehicle routes
    const turnLane = (site: string) => has('turnLane', (o) => o.site === site)
    const pocketR = turnLane('in-right')
    const pocketL = turnLane('in-left')
    const split = turnLane('out-split')
    const oakCurb = lane('OAK_N').slots.length > 0
    const sig = (node: SignalNodeId) => this.signals.has(node)
    const phaseB = (node: SignalNodeId) => () => this.phase(node) === 'B'

    const merge = (target: Lane, s: number): Gate => (car) => this.space(target, s, car.len + 1) && !this.approaching(target, s, SIM.gapSec)
    const conflicts = (pts: { lane: string; s: number }[]) => () =>
      pts.every((p) => !this.occupied(lane(p.lane), p.s) && !this.approaching(lane(p.lane), p.s, SIM.crossGapSec))
    const both = (...gates: Gate[]): Gate => (car) => gates.every((g) => g(car))
    const space = (target: Lane, s: number): Gate => (car) => this.space(target, s, car.len + 1)
    /** A movement controlled by a signal (protected in phase B) or by gaps when unsignalized. */
    const controlled = (node: SignalNodeId, target: Lane, s: number, conf: { lane: string; s: number }[], mergeGap: boolean): Gate =>
      sig(node)
        ? both(phaseB(node), space(target, s))
        : both(conflicts(conf), mergeGap ? merge(target, s) : space(target, s))

    const EB = (x: number) => [{ lane: 'EB_R', s: ebS(x) }, { lane: 'EB_L', s: ebS(x) }]
    const leftIn = controlled('in', lane('LOOP'), 0, EB(150), false)
    const rightIn = space(lane('LOOP'), 0)
    const rightOut = sig('out') ? both(phaseB('out'), space(lane('EB_R'), ebS(252))) : merge(lane('EB_R'), ebS(252))
    // Left-out drivers turn into the outer westbound lane (the inner one may hold the left-in queue).
    const leftOut = controlled('out', lane('WB_R'), wbS(248), EB(248), true)
    const oakRight = sig('oak') ? both(phaseB('oak'), space(lane('EB_R'), 42)) : merge(lane('EB_R'), 42)
    const elmLeft = controlled('elm', lane('WB_L'), wbS(360), EB(360), true)
    const busElmLeft = controlled('elm', lane('ELM_S'), 0, EB(358), false)

    const leg = (l: string, end: number, next?: { lane: string; s: number; gate: Gate }, extra?: Partial<Leg>): Leg => ({
      lane: lane(l),
      end,
      next: next ? { lane: lane(next.lane), s: next.s, gate: next.gate } : null,
      ...extra,
    })
    const despawnAtEnd = (l: string) => leg(l, lane(l).len)

    const loopLegs = (exitLeft: boolean): Leg[] => {
      const out = exitLeft
        ? { lane: 'WB_R', s: wbS(248), gate: leftOut }
        : { lane: 'EB_R', s: ebS(252), gate: rightOut }
      const tail = exitLeft ? despawnAtEnd('WB_R') : despawnAtEnd('EB_R')
      if (split) {
        const exitLane = exitLeft ? 'EXIT_L' : 'EXIT_R'
        return [
          leg('LOOP', 160.5, { lane: exitLane, s: 0, gate: space(lane(exitLane), 0) }, { curb: true }),
          leg(exitLane, lane(exitLane).len, out),
          tail,
        ]
      }
      return [leg('LOOP', lane('LOOP').len, out, { curb: true }), tail]
    }
    const viaEbToLoop = (exitLeft: boolean): Leg[] =>
      pocketR
        ? [leg('EB_R', 105, { lane: 'POCKET_IN_R', s: 0, gate: space(lane('POCKET_IN_R'), 0) }), leg('POCKET_IN_R', lane('POCKET_IN_R').len, { lane: 'LOOP', s: 0, gate: rightIn }), ...loopLegs(exitLeft)]
        : [leg('EB_R', 150, { lane: 'LOOP', s: 0, gate: rightIn }), ...loopLegs(exitLeft)]
    const viaWbToLoop = (exitLeft: boolean): Leg[] =>
      pocketL
        ? [leg('WB_L', 205, { lane: 'POCKET_IN_L', s: 0, gate: space(lane('POCKET_IN_L'), 0) }), leg('POCKET_IN_L', lane('POCKET_IN_L').len, { lane: 'LOOP', s: 0, gate: leftIn }), ...loopLegs(exitLeft)]
        : [leg('WB_L', 250, { lane: 'LOOP', s: 0, gate: leftIn }), ...loopLegs(exitLeft)]

    const routeFor = (origin: string): Leg[] => {
      switch (origin) {
        case 'west':
          return viaEbToLoop(true)
        case 'east':
          return viaWbToLoop(false)
        case 'oak':
          return oakCurb
            ? [leg('OAK_N', lane('OAK_N').len, { lane: 'EB_R', s: 42, gate: oakRight }, { curb: true }), despawnAtEnd('EB_R')]
            : [leg('OAK_N', lane('OAK_N').len, { lane: 'EB_R', s: 42, gate: oakRight }), ...viaEbToLoop(true)]
        case 'elm':
        default:
          return sideGate
            ? [leg('ELM_N', 110, { lane: 'GATE', s: 0, gate: both(conflicts([{ lane: 'ELM_S', s: 112.5 }]), space(lane('GATE'), 0)) }), leg('GATE', lane('GATE').len, undefined, { curb: true })]
            : [leg('ELM_N', lane('ELM_N').len, { lane: 'WB_L', s: wbS(360), gate: elmLeft }), ...viaWbToLoop(false)]
      }
    }

    // School cars
    const carCount = Math.max(1, Math.round((carStudents / SIM.studentsPerCar) * (program('carpool') ? 1 - SIM.carpoolCut : 1)))
    const perCar = carStudents / carCount
    const origins = sideGate ? SIM.carOriginsSideGate : SIM.carOrigins
    const originList = Object.entries(origins) as [string, number][]
    for (let k = 0; k < carCount; k++) {
      const u = this.r()
      let acc = 0
      let origin = originList[0][0]
      for (const [o, f] of originList) {
        acc += f
        if (u <= acc) {
          origin = o
          break
        }
      }
      const W = SIM.carWindow
      const spawnT = triangular(this.r(), W.from, W.peak, W.to) * 60
      this.addPending('school', routeFor(origin), spawnT, perCar, origin)
    }

    // Buses
    const bays = design.flatMap((o) => (o.kind === 'busBay' ? [o.site] : []))
    SIM.busTimes.forEach((min, i) => {
      const where = bays.length ? bays[i % bays.length] : 'stop'
      const stop = (s: number, walk: number, despawn: boolean) => ({ stop: { s, walk, despawn } })
      const legs: Leg[] =
        where === 'bay-main'
          ? [leg('EB_R', 283, { lane: 'BAY_MAIN', s: 0, gate: space(lane('BAY_MAIN'), 0) }), leg('BAY_MAIN', lane('BAY_MAIN').len, undefined, stop(30, WALK_FROM.BAY_MAIN, true))]
          : where === 'bay-oak'
            ? [leg('OAK_N', 165, { lane: 'BAY_OAK', s: 0, gate: space(lane('BAY_OAK'), 0) }), leg('BAY_OAK', lane('BAY_OAK').len, undefined, stop(27, WALK_FROM.BAY_OAK, true))]
            : where === 'bay-elm'
              ? [leg('WB_L', wbS(358), { lane: 'ELM_S', s: 0, gate: busElmLeft }), leg('ELM_S', 97.5, { lane: 'BAY_ELM', s: 0, gate: space(lane('BAY_ELM'), 0) }), leg('BAY_ELM', lane('BAY_ELM').len, undefined, stop(27, WALK_FROM.BAY_ELM, true))]
              : [{ ...leg('EB_R', lane('EB_R').len), stop: { s: 300, walk: WALK_FROM.MAIN_STOP, despawn: false } }]
      const bus = this.addPending('bus', legs, min * 60, busStudents / SIM.busCount, where)
      this.busSchedule.set(bus.id, min * 60 + 45)
    })

    // Through traffic
    const through = (laneId: string, perHour: number) => {
      const gap = 3600 / perHour
      for (let t = this.r() * gap; t < TICKS * SIM.dt; t += gap * (0.6 + 0.8 * this.r())) this.addPending('through', [despawnAtEnd(laneId)], t, 0, 'through')
    }
    for (const l of ['EB_R', 'EB_L', 'WB_L', 'WB_R']) through(l, SIM.throughPerHour.main / 2)
    through('PINE_E', SIM.throughPerHour.pine)
    through('PINE_W', SIM.throughPerHour.pine)
    through('ELM_N', SIM.throughPerHour.elm)
    through('ELM_S', SIM.throughPerHour.elm)
    this.pending.sort((a, b) => a.spawnT - b.spawnT)

    // ---------------------------------------------------------------- walkers and bikes
    const graph = this.pedGraph(design)
    const addPeds = (kind: 'walk' | 'bike', students: number, shares: Partial<Record<PedOrigin, number>>) => {
      const per = kind === 'walk' ? SIM.studentsPerWalker : SIM.studentsPerBike
      const count = Math.round(students / per)
      if (!count) return
      const each = students / count
      const list = Object.entries(shares) as [PedOrigin, number][]
      for (let k = 0; k < count; k++) {
        const u = this.r()
        let acc = 0
        let origin = list[0][0]
        for (const [o, f] of list) {
          acc += f
          if (u <= acc) {
            origin = o
            break
          }
        }
        const spawnT = (SIM.walkWindow.from + this.r() * (SIM.walkWindow.to - SIM.walkWindow.from)) * 60
        const route = kind === 'bike' ? routes.find((r) => r.origins.includes(origin)) : undefined
        const plan = route ? this.bikeLanePath(origin, route.entrance) : graph(origin, kind)
        const [sx, sy] = PED_ORIGINS[origin].spawn
        this.peds.push({
          id: this.nextId++, kind, students: each, path: plan.path, i: 0, along: 0, state: 'pending', waited: 0,
          spawnT, arriveT: null, x: sx, y: sy, origin, jaywalks: plan.jaywalks,
        })
      }
    }
    addPeds('walk', walkStudents, { north: 0.35, west: 0.3, south: 0.25, east: 0.1 })
    addPeds('bike', bikeStudents, { west: 0.4, south: 0.4, north: 0.2 })
  }

  // ---------------------------------------------------------------- SimRun API

  get done() {
    return this.tick >= this.totalTicks
  }
  get progress() {
    return this.tick / this.totalTicks
  }
  /** 0..1, how busy the morning is right now (drives ambient effects). */
  get intensity() {
    const min = this.t / 60
    return Math.max(0, 1 - Math.abs(min - SIM.carWindow.peak) / 20)
  }
  clockLabel() {
    const total = CLOCK.startMin + Math.floor(this.t / 60)
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  }
  get secondsToBell() {
    return BELL - this.t
  }

  step(): boolean {
    if (this.done) return false
    this.spawn()
    this.updateGuards()
    this.updatePeds()
    this.updateCars()
    this.measure()
    this.tick++
    this.t = this.tick * SIM.dt
    return !this.done
  }

  result(): TrafficResult {
    let total = 0
    let onTime = 0
    let dropWait = 0
    let dropN = 0
    const busLate: number[] = []
    for (const c of this.cars) {
      if (c.kind === 'through') continue
      total += c.students
      if (c.dropT !== null && c.dropT + c.walk <= BELL) onTime += c.students
      if (c.kind === 'school' && c.dropT !== null) {
        dropWait += c.dropT - c.spawnT
        dropN++
      }
      if (c.kind === 'bus') {
        const sched = this.busSchedule.get(c.id) ?? c.spawnT
        busLate.push(Math.max(0, ((c.dropT ?? TICKS * SIM.dt) - sched) / 60))
      }
    }
    for (const p of this.peds) {
      total += p.students
      if (p.arriveT !== null && p.arriveT <= BELL) onTime += p.students
    }
    const spots: UnsafeSpot[] = []
    PED_EDGES.forEach((e, i) => {
      if (this.unsafeByEdge[i] <= 0) return
      const a = PED_NODE.get(e.a)!
      const b = PED_NODE.get(e.b)!
      spots.push({
        name: e.site ? CROSS_SITES[e.site].name : (e.corner ?? 'a street'),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        students: Math.round(this.unsafeByEdge[i]),
      })
    })
    spots.sort((a, b) => b.students - a.students)
    const laneDelay: Record<string, Float32Array> = {}
    for (const l of this.lanes.values()) laneDelay[l.id] = l.delay.slice()
    return {
      variant: this.variant,
      onTimePct: total ? (100 * onTime) / total : 100,
      lateStudents: Math.round(total - onTime),
      totalStudents: Math.round(total),
      unsafe: Math.round(this.unsafeByEdge.reduce((a, b) => a + b, 0)),
      unsafeSpots: spots,
      maxMainQueue: this.maxQueue,
      mainQueueMin: (this.queueTicks * SIM.dt) / 60,
      avgDropWaitMin: dropN ? dropWait / dropN / 60 : 0,
      busLateMin: busLate,
      modeSplit: this.modeSplit,
      idleMin: this.idleSec / 60,
      laneDelay,
      componentCount: this.componentCount,
    }
  }

  // ---------------------------------------------------------------- control state

  phase(node: SignalNodeId): 'A' | 'B' | 'clear' {
    const g = this.signals.get(node)
    if (g === undefined) return 'A'
    const C = SIM.signalCycle
    const tc = (this.t + (node === 'out' ? 20 : node === 'elm' ? 35 : node === 'oak' ? 10 : 0)) % C
    const gA = g * C
    if (tc < gA - 2) return 'A'
    if (tc < gA) return 'clear'
    if (tc < C - 2) return 'B'
    return 'clear'
  }

  private updateGuards() {
    for (const [edge, g] of this.guards) {
      if (this.t < g.next) continue
      const waiting = this.peds.some((p) => p.state === 'wait' && p.path[p.i]?.edge === edge)
      if (waiting) {
        g.holdUntil = this.t + SIM.guard.hold
        g.next = this.t + SIM.guard.every
        this.edgeBusy[edge] = Math.max(this.edgeBusy[edge], g.holdUntil)
      } else g.next = this.t + 3
    }
  }

  // ---------------------------------------------------------------- spawning

  private addPending(kind: Car['kind'], legs: Leg[], spawnT: number, students: number, origin: string): Car {
    const car: Car = {
      id: this.nextId++, kind, lane: legs[0].lane, s: 0, v: 0, len: kind === 'bus' ? SIM.busLength : SIM.carLength,
      legs, leg: 0, students, spawnT, dropT: null, walk: 0, state: 'pending', slot: null, until: 0, stopWait: 0,
      passed: new Set(), origin, dropped: false,
    }
    this.cars.push(car)
    this.pending.push(car)
    return car
  }

  private spawn() {
    // Each lane admits at most one new car per tick, in spawn order; the rest wait off-map.
    const admitted = new Set<Lane>()
    for (let i = 0; i < this.pending.length; i++) {
      const c = this.pending[i]
      if (c.spawnT > this.t) break
      if (admitted.has(c.lane)) continue
      if (!this.space(c.lane, 0, c.len + 2)) {
        admitted.add(c.lane)
        continue
      }
      c.state = 'drive'
      c.s = 0
      c.v = Math.min(c.lane.v0, 8)
      c.lane.cars.push(c)
      admitted.add(c.lane)
      this.pending.splice(i, 1)
      i--
    }
  }

  // ---------------------------------------------------------------- vehicles

  private updateCars() {
    const dt = SIM.dt
    for (const l of this.lanes.values()) l.cars.sort((a, b) => b.s - a.s)
    // Parked cars leave their slots when their dwell is over.
    for (const c of this.cars) {
      if (c.state === 'parked' && this.t >= c.until && c.slot) {
        const l = c.lane
        if (this.space(l, c.slot.s - c.len, c.len + 3) && !this.approaching(l, c.slot.s, 1.5)) {
          c.slot.car = null
          c.s = c.slot.s
          c.slot = null
          c.v = 0
          c.state = 'drive'
          l.cars.push(c)
          l.cars.sort((a, b) => b.s - a.s)
        }
      }
    }
    for (const l of this.lanes.values()) {
      for (let i = 0; i < l.cars.length; i++) {
        const c = l.cars[i]
        if (c.lane !== l) continue
        const leader = i > 0 ? l.cars[i - 1] : null
        this.driveOne(c, leader)
        if (c.v < 0.5 && c.state === 'drive') {
          this.idleSec += dt
          l.delay[Math.min(l.delay.length - 1, Math.floor(c.s / 5))] += dt
        }
      }
      l.cars = l.cars.filter((c) => c.lane === l && (c.state === 'drive' || c.state === 'dwell'))
    }
  }

  private driveOne(c: Car, leader: Car | null) {
    const dt = SIM.dt
    const leg = c.legs[c.leg]
    const l = c.lane
    if (c.state === 'dwell') {
      if (this.t >= c.until) {
        c.state = 'drive'
        if (leg.stop?.despawn) this.finish(c)
      }
      return
    }

    let gap = Infinity
    if (leader) gap = leader.s - leader.len - c.s - 1.5

    // Bus stop (in lane or in a bay)
    if (leg.stop && !c.dropped) {
      const d = leg.stop.s - c.s
      if (d <= 0.4) {
        c.dropped = true
        c.dropT = this.t
        c.walk = leg.stop.walk
        c.state = 'dwell'
        c.until = this.t + SIM.dwell.bus
        c.v = 0
        return
      }
      gap = Math.min(gap, d)
    }

    // Drop-off curb
    if (leg.curb && !c.dropped && l.slots.length) {
      if (!c.slot) {
        const ahead = l.slots.filter((s) => s.s >= c.s - 0.5)
        const free = ahead.filter((s) => !s.car)
        const pick = free.length ? (this.pullForward ? free[free.length - 1] : free[0]) : null
        if (pick) {
          pick.car = c
          c.slot = pick
        } else {
          // Wait at the start of the curb zone so parked cars can still pull out.
          const hold = l.slots[0].s - 7
          gap = Math.min(gap, c.s <= hold ? hold - c.s : 0)
        }
      }
      if (c.slot) {
        const d = c.slot.s - c.s
        if (d <= 0.4) {
          c.dropped = true
          c.dropT = this.t
          c.walk = l.walkFromSlots
          c.state = 'parked'
          c.until = this.t + this.dwell
          c.v = 0
          return
        }
        gap = Math.min(gap, d)
      }
    }

    // Signals, stop signs, people in crosswalks
    for (const st of l.signalStops) {
      const d = st.s - c.s
      if (d > -0.2 && d < 60 && this.phase(st.node) !== 'A') gap = Math.min(gap, d)
    }
    for (const st of l.stopSigns) {
      const key = `${st.node}:${l.id}`
      if (c.passed.has(key)) continue
      const d = st.s - c.s
      if (d < -0.5 || d > 50) continue
      if (d <= 0.6 && c.v < 0.3) {
        const q = this.stopQueues.get(st.node)!
        if (!q.queue.includes(c)) q.queue.push(c)
        c.stopWait += dt
        if (c.stopWait >= 1.5 && q.queue[0] === c && this.t - q.lastGo > 1.8) {
          c.passed.add(key)
          q.queue.shift()
          q.lastGo = this.t
          c.stopWait = 0
          continue
        }
      }
      gap = Math.min(gap, d)
    }
    for (const x of l.crossings) {
      const d = x.s - 3 - c.s
      if (d > 0.5 && d < 30 && this.edgeBusy[x.edge] > this.t) gap = Math.min(gap, d)
    }

    // End of this leg: turn/merge if allowed, otherwise wait at the line.
    const toEnd = leg.end - c.s
    if (leg.next) {
      if (toEnd <= 0.4) {
        if (leg.next.gate(c)) {
          this.transfer(c, leg.next.lane, leg.next.s)
          return
        }
        c.v = 0
        return
      }
      if (toEnd < 30) gap = Math.min(gap, toEnd)
    } else if (toEnd <= 0.4) {
      this.finish(c)
      return
    }

    const vmax = (c.kind === 'bus' ? Math.min(l.v0, SIM.speed.bus) : l.v0) * this.speedMul
    const vSafe = Math.sqrt(2 * SIM.brake * Math.max(0, gap - 0.3))
    c.v = Math.max(0, Math.min(vmax, vSafe, c.v + SIM.accel * dt))
    if (gap < 0.3) c.v = 0
    c.s += Math.min(c.v * dt, Math.max(0, gap))
  }

  private transfer(c: Car, to: Lane, s: number) {
    c.lane = to
    c.s = s
    c.v = Math.min(c.v, 4)
    c.leg++
    c.stopWait = 0
    to.cars.push(c)
    to.cars.sort((a, b) => b.s - a.s)
  }

  private finish(c: Car) {
    c.state = 'done'
    if (c.kind === 'school' && !c.dropped) {
      // Never reached a curb (e.g. the route had none): students hop out at the end.
      c.dropped = true
      c.dropT = this.t
      c.walk = 120
    }
  }

  /** No car body overlaps [s, s + front], and nothing is right behind s. */
  private space(l: Lane, s: number, front: number) {
    for (const c of l.cars) {
      if (c.s - c.len < s + front && c.s > s - 6) return false
    }
    return true
  }

  /** A moving car will reach s within T seconds. */
  approaching(l: Lane, s: number, T: number) {
    for (const c of l.cars) {
      if (c.s < s && c.s > s - 90 && c.v > 1 && (s - c.s) / c.v < T) return true
    }
    return false
  }

  /** A car body is sitting on s. */
  private occupied(l: Lane, s: number) {
    for (const c of l.cars) if (c.s >= s - 1.5 && c.s - c.len <= s + 1.5) return true
    return false
  }

  // ---------------------------------------------------------------- walkers and bikes

  private updatePeds() {
    const dt = SIM.dt
    for (const p of this.peds) {
      if (p.state === 'done') continue
      if (p.state === 'pending') {
        if (p.spawnT > this.t) continue
        p.state = 'move'
      }
      const speed = p.kind === 'bike' ? SIM.bikeSpeed : SIM.walkSpeed
      let budget = speed * dt
      while (budget > 0 && (p.state as Ped['state']) !== 'done') {
        const step = p.path[p.i]
        if (!step) {
          p.state = 'done'
          p.arriveT = this.t
          break
        }
        if (p.along === 0 && step.edge >= 0 && PED_EDGES[step.edge].kind === 'cross') {
          if (!this.tryCross(p, step.edge, step.len / speed)) {
            p.state = 'wait'
            p.waited += dt
            break
          }
        }
        p.state = 'move'
        const left = step.len - p.along
        if (budget >= left) {
          budget -= left
          p.i++
          p.along = 0
          p.waited = 0
        } else {
          p.along += budget
          budget = 0
        }
      }
      const step = p.path[Math.min(p.i, p.path.length - 1)]
      if (step) {
        const t = step.len ? Math.min(1, p.along / step.len) : 1
        p.x = p.state === 'done' ? step.x1 : step.x0 + (step.x1 - step.x0) * t
        p.y = p.state === 'done' ? step.y1 : step.y0 + (step.y1 - step.y0) * t
      }
    }
  }

  /** Decide whether a group may start crossing now; record unsafe crossings. */
  private tryCross(p: Ped, edge: number, duration: number): boolean {
    const e = PED_EDGES[edge]
    const lanes = (e.lanes ?? []).map((cl) => ({ lane: this.lanes.get(cl.lane)!, s: cl.s }))
    const carWithin = (T: number) => lanes.some((x) => this.approaching(x.lane, x.s, T))
    const site = e.site ? CROSS_SITES[e.site] : null
    const marked = !!e.site && this.marked.has(e.site)
    let safe: boolean
    let go: boolean

    if (marked && site?.signal && this.signals.has(site.signal)) {
      go = this.phase(site.signal) === 'B'
      safe = true
    } else if (marked && this.guards.has(edge)) {
      go = this.guards.get(edge)!.holdUntil > this.t
      safe = true
    } else if (marked && (this.beacons.has(edge) || (site?.stop && this.stopQueues.has(site.stop)))) {
      // Drivers stop reliably; wait only for cars that physically can't stop.
      go = !carWithin(1.2)
      safe = true
    } else if (marked) {
      go = !carWithin(4) || p.waited >= SIM.pedWaitMax.marked
      safe = !carWithin(SIM.unsafeSec)
    } else {
      go = !carWithin(4) || p.waited >= SIM.pedWaitMax.unmarked
      safe = false
    }
    if (!go) return false
    this.edgeBusy[edge] = Math.max(this.edgeBusy[edge], this.t + duration)
    if (!safe) {
      this.unsafeByEdge[edge] += p.students
      const a = PED_NODE.get(e.a)!
      const b = PED_NODE.get(e.b)!
      this.flashes.push([(a.x + b.x) / 2, (a.y + b.y) / 2, this.t])
    }
    return true
  }

  /** Build a router over the sidewalk graph for this design. */
  private pedGraph(design: TrafficObject[]) {
    const filled = new Set(design.flatMap((o) => (o.kind === 'sidewalk' ? [o.gap] : [])))
    const adj = new Map<string, { to: string; edge: number; len: number }[]>()
    for (const node of PED_NODES) adj.set(node.id, [])
    PED_EDGES.forEach((e, i) => {
      const a = PED_NODE.get(e.a)!
      const b = PED_NODE.get(e.b)!
      const len = Math.hypot(a.x - b.x, a.y - b.y)
      adj.get(e.a)!.push({ to: e.b, edge: i, len })
      adj.get(e.b)!.push({ to: e.a, edge: i, len })
    })
    const usable = (e: PedEdge, kind: 'walk' | 'bike', legalOnly: boolean) => {
      if (e.kind === 'gap' && kind === 'walk' && !(e.gap && filled.has(e.gap))) return false
      if (e.kind === 'cross' && legalOnly && !(e.site && this.marked.has(e.site))) return false
      return true
    }
    const dijkstra = (from: string, to: string, kind: 'walk' | 'bike', legalOnly: boolean) => {
      const dist = new Map<string, number>([[from, 0]])
      const prev = new Map<string, { node: string; edge: number }>()
      const open = new Set([from])
      while (open.size) {
        let best = ''
        let bd = Infinity
        for (const k of open) {
          const d = dist.get(k) ?? Infinity
          if (d < bd) {
            bd = d
            best = k
          }
        }
        open.delete(best)
        if (best === to) break
        for (const nb of adj.get(best)!) {
          if (!usable(PED_EDGES[nb.edge], kind, legalOnly)) continue
          const nd = bd + nb.len
          if (nd < (dist.get(nb.to) ?? Infinity)) {
            dist.set(nb.to, nd)
            prev.set(nb.to, { node: best, edge: nb.edge })
            open.add(nb.to)
          }
        }
      }
      const total = dist.get(to)
      if (total === undefined) return null
      const edges: { from: string; to: string; edge: number }[] = []
      let cur = to
      while (cur !== from) {
        const pv = prev.get(cur)!
        edges.unshift({ from: pv.node, to: cur, edge: pv.edge })
        cur = pv.node
      }
      return { total, edges }
    }
    return (origin: PedOrigin, kind: 'walk' | 'bike') => {
      const o = PED_ORIGINS[origin]
      let best: { total: number; edges: { from: string; to: string; edge: number }[]; jay: boolean } | null = null
      for (const ent of Object.values(ENTRANCES)) {
        const legal = dijkstra(o.node, ent, kind, true)
        const direct = dijkstra(o.node, ent, kind, false)
        if (!direct) continue
        const useLegal = legal && legal.total <= SIM.jaywalkRatio * direct.total
        const pick = useLegal ? { ...legal!, jay: false } : { ...direct, jay: true }
        if (!best || pick.total < best.total) best = pick
      }
      const [sx, sy] = o.spawn
      const start = PED_NODE.get(o.node)!
      const path: Ped['path'] = [{ x0: sx, y0: sy, x1: start.x, y1: start.y, len: Math.hypot(sx - start.x, sy - start.y), edge: -1 }]
      for (const e of best?.edges ?? []) {
        const a = PED_NODE.get(e.from)!
        const b = PED_NODE.get(e.to)!
        path.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, len: Math.hypot(a.x - b.x, a.y - b.y), edge: e.edge })
      }
      return { path, jaywalks: !!best?.jay }
    }
  }

  /** Riders on a complete bike route never cross traffic. */
  private bikeLanePath(origin: PedOrigin, entrance: keyof typeof ENTRANCES) {
    const ent = PED_NODE.get(ENTRANCES[entrance])!
    const pts: Pt[] = [PED_ORIGINS[origin].spawn]
    if (entrance === 'main') {
      if (origin === 'south') pts.push([200, 246], [44, 246])
      else pts.push([44, 100])
      pts.push([44, 41])
    } else pts.push([200, 246], [356, 246])
    pts.push([ent.x, ent.y])
    const path: Ped['path'] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]
      const [x1, y1] = pts[i + 1]
      path.push({ x0, y0, x1, y1, len: Math.hypot(x1 - x0, y1 - y0), edge: -1 })
    }
    return { path, jaywalks: false }
  }

  // ---------------------------------------------------------------- metrics

  private measure() {
    let q = 0
    for (const id of ['EB_R', 'WB_L']) {
      const l = this.lanes.get(id)!
      for (const c of l.cars) if (c.kind === 'school' && !c.dropped && c.v < 1) q++
    }
    if (q > this.maxQueue) this.maxQueue = q
    if (q >= 3) this.queueTicks++
  }
}

export function runMorning(design: TrafficObject[], variant: VariantId = 'standard'): TrafficResult {
  const run = new TrafficRun(design, variant)
  while (run.step());
  return run.result()
}

/** For the 3D view: world position of a vehicle. */
export function carPose(c: Car) {
  if (c.state === 'parked' && c.slot) return pointAt(c.lane.geom.pts, c.slot.s)
  return pointAt(c.lane.geom.pts, c.s)
}
