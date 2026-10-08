/**
 * Grid hydrology for Flooded Campus. Pure TypeScript: no React, no DOM.
 *
 * Units: water depth and bed height in inches; volumes in cell-inches
 * (1 cell-inch = 62.3 gal). One `step()` is one tick.
 *
 * Runoff managed = (infiltrated + drained + stored) / rainfall.
 *   infiltrated: soaked into the ground (incl. tree canopy interception)
 *   drained:     delivered to an outlet by pipes, pumps, channels, or city road inlets
 *   stored:      held in ponds, rain gardens, and drain sumps at the end of the test
 * Unmanaged water is whatever left the site overland (map edges, the creek) or is
 * still sitting on the surface when the test ends.
 */
import { createCampus, inRect, SURF } from '../campus'
import { GRID_H, GRID_W, POND_SIZE, RAIN_GARDEN_SIZE, SIM, STORMS, type StormId } from '../config'
import { cellsInRadius, idx, inBounds, rasterizePath, rectCells } from '../geometry'
import type { FloodObject } from '../types'

export const campus = createCampus()

export interface FloodTotals {
  rain: number
  infiltrated: number
  drained: number
  stored: number
  pumped: number
  offsite: number
  ponded: number
}

export interface FloodResult {
  storm: StormId
  maxFloodIn: number
  /** Max flood depth (inches) at each building, indexed like campus.buildings. */
  buildingFloodIn: number[]
  runoffManagedPct: number
  /** Cell-inches. */
  totals: FloodTotals
  ponds: { id: string; fillPct: number }[]
  /** Drains that could not keep up at some point (water backed up or inlet full). */
  overloadedDrains: number
  /** Pipes that ran at full capacity for a meaningful part of the storm. */
  pipesAtCapacity: number
  componentCount: number
  offsiteBy: Record<OffsiteEdge, number>
  /** Max depth above natural ground per cell, inches (for the heat overlay). */
  maxDepth: Float32Array
}

export type OffsiteEdge = 'north' | 'south' | 'east' | 'west' | 'creek'

type Node = DrainNode | PondNode | OutletNode
interface Link {
  to: Node
  cap: number
  fullTicks: number
}
interface DrainNode {
  kind: 'drain'
  id: string
  cell: number
  capture: number[]
  rate: number
  buffer: number
  cap: number
  out: Link[]
  overloadTicks: number
}
interface PondNode {
  kind: 'pond'
  id: string
  cells: number[]
  capacity: number
  out: Link[]
}
interface OutletNode {
  kind: 'outlet'
  id: string
}
interface Pump {
  intake: number[]
  rate: number
  out: number
  toOutlet: boolean
}

const N = GRID_W * GRID_H
const BUILDING = 1
const WALL = 2

export class FloodRun {
  readonly storm: StormId
  readonly totalTicks = SIM.rainTicks + SIM.drainTicks
  tick = 0

  /** Natural ground, inches. */
  readonly ground = new Float32Array(N)
  /** Ground after excavation (ponds, channels, gardens, drain inlets), inches. */
  readonly bed = new Float32Array(N)
  readonly water = new Float32Array(N)
  readonly maxDepth = new Float32Array(N)
  readonly blocked = new Uint8Array(N)
  readonly pondCell = new Int16Array(N).fill(-1)
  readonly buildingFlood: number[]
  /** Current flood depth at each building, inches. */
  readonly buildingNow: number[]

  private readonly infil = new Float32Array(N)
  private readonly rainMul = new Float32Array(N).fill(1)
  private readonly sink = new Uint8Array(N) // 1 = offsite (creek), 2 = drained (channel → outlet)
  private readonly storage = new Uint8Array(N) // ponds + rain gardens
  private readonly roadCells: number[] = []
  private readonly delta = new Float32Array(N)
  /** For channel cells: the next cell downstream along the channel, else -1. */
  readonly channelNext = new Int32Array(N).fill(-1)
  private readonly rings: number[][]
  private readonly downspouts: number[][]
  private readonly roofCells: number[]
  private readonly drains: DrainNode[] = []
  private readonly ponds: PondNode[] = []
  private readonly order: (DrainNode | PondNode)[]
  private readonly pumps: Pump[] = []
  private readonly rainTotal: number
  private readonly componentCount: number
  /** Where unmanaged water left the site, cell-inches. */
  readonly offsiteBy: Record<OffsiteEdge, number> = { north: 0, south: 0, east: 0, west: 0, creek: 0 }
  readonly totals: FloodTotals = { rain: 0, infiltrated: 0, drained: 0, stored: 0, pumped: 0, offsite: 0, ponded: 0 }

  constructor(design: FloodObject[], storm: StormId = 'standard') {
    this.storm = storm
    this.rainTotal = STORMS[storm].rainIn
    this.componentCount = design.length
    const { surface, building } = campus

    for (let i = 0; i < N; i++) {
      this.ground[i] = campus.elevation[i] * 12
      const s = surface[i]
      if (building[i] >= 0) this.blocked[i] = BUILDING
      if (s === SURF.creek) this.sink[i] = 1
      this.infil[i] =
        s === SURF.asphalt
          ? SIM.infiltration.asphalt
          : s === SURF.concrete
            ? SIM.infiltration.concrete
            : s === SURF.field
              ? SIM.infiltration.field
              : s === SURF.grass
                ? SIM.infiltration.grass
                : 0
    }
    for (let y = 0; y < GRID_H; y++)
      for (let x = 0; x < GRID_W; x++) if (campus.roads.some((r) => inRect(r, x, y))) this.roadCells.push(idx(x, y))
    this.bed.set(this.ground)

    const outlets = new Map<string, OutletNode>(campus.outlets.map((o) => [o.id, { kind: 'outlet', id: o.id }]))
    const nodes = new Map<string, Node>(outlets)
    const cityOutlet: OutletNode = { kind: 'outlet', id: 'city' }

    for (const d of campus.existingDrains) this.addDrain(d.id, d.x, d.y, SIM.existingDrain.rate).out.push(link(cityOutlet, SIM.existingDrain.outflow))

    // Surface changes first, then structures that depend on the final bed.
    for (const o of design) if (o.kind === 'permeable') for (const c of o.cells) if (this.paintable(c)) this.infil[c] = SIM.infiltration.permeable
    for (const o of design)
      if (o.kind === 'tree')
        for (const c of cellsInRadius(o.x + 0.5, o.y + 0.5, SIM.tree.radius)) {
          this.infil[c] += SIM.tree.infiltrationBonus
          this.rainMul[c] = Math.min(this.rainMul[c], 1 - SIM.tree.interception)
        }
    for (const o of design)
      if (o.kind === 'rainGarden')
        for (const c of rectCells(o.x, o.y, RAIN_GARDEN_SIZE, RAIN_GARDEN_SIZE)) {
          if (this.blocked[c]) continue
          this.bed[c] = Math.min(this.bed[c], this.ground[c] - SIM.rainGardenDepthIn)
          this.infil[c] = SIM.infiltration.rainGarden
          this.storage[c] = 1
        }
    for (const o of design) {
      if (o.kind !== 'pond') continue
      const s = POND_SIZE[o.size]
      const cells = rectCells(o.x, o.y, s, s).filter((c) => !this.blocked[c])
      if (!cells.length) continue
      const floor = Math.min(...cells.map((c) => this.ground[c])) - SIM.pondDepthIn
      const rimCells = rectCells(o.x - 1, o.y - 1, s + 2, s + 2).filter((c) => !cells.includes(c) && !this.blocked[c])
      const rim = rimCells.length ? Math.min(...rimCells.map((c) => this.ground[c])) : floor + SIM.pondDepthIn
      const pond: PondNode = { kind: 'pond', id: o.id, cells, capacity: cells.length * Math.max(1, rim - floor), out: [] }
      for (const c of cells) {
        this.bed[c] = Math.min(this.bed[c], floor)
        this.infil[c] = 0.002
        this.storage[c] = 1
        this.pondCell[c] = this.ponds.length
      }
      this.ponds.push(pond)
      nodes.set(o.id, pond)
    }
    for (const o of design) {
      if (o.kind !== 'channel') continue
      const cells = rasterizePath(o.points).filter((c) => !this.blocked[c])
      let prev = Infinity
      cells.forEach((c, k) => {
        const b = Math.min(this.ground[c] - SIM.channel.depthIn, prev - SIM.channel.gradeIn)
        this.bed[c] = Math.min(this.bed[c], b)
        prev = this.bed[c]
        if (k < cells.length - 1 && this.channelNext[c] < 0) this.channelNext[c] = cells[k + 1]
      })
      const end = cells[cells.length - 1]
      if (end !== undefined && this.nearOutlet(end)) this.sink[end] = 2
    }
    for (const o of design) if (o.kind === 'barrier') for (const c of rasterizePath(o.points)) if (!this.blocked[c]) this.blocked[c] = WALL
    for (const o of design) if (o.kind === 'drain' && !this.blocked[idx(o.x, o.y)]) nodes.set(o.id, this.addDrain(o.id, o.x, o.y, SIM.drain.rate))
    for (const o of design) {
      if (o.kind !== 'pipe') continue
      const from = nodes.get(o.from)
      const to = nodes.get(o.to)
      if (!from || !to || from === to || from.kind === 'outlet') continue
      from.out.push(link(to, SIM.pipeCapacity[o.size]))
    }
    for (const d of this.drains) d.cap = d.out.length ? SIM.drain.buffer : SIM.drain.sump
    for (const o of design) {
      if (o.kind !== 'pump') continue
      const intake = cellsInRadius(o.x + 0.5, o.y + 0.5, SIM.pump.radius).filter((c) => !this.blocked[c])
      const ox = Math.floor(o.out.x)
      const oy = Math.floor(o.out.y)
      const outIdx = inBounds(ox, oy) ? idx(ox, oy) : -1
      const toOutlet = outIdx < 0 || this.sink[outIdx] > 0 || this.nearOutlet(outIdx)
      this.pumps.push({ intake, rate: SIM.pump.rate[o.size], out: outIdx >= 0 && !this.blocked[outIdx] ? outIdx : -1, toOutlet })
    }

    this.order = topoOrder([...this.drains, ...this.ponds])
    this.rings = campus.buildings.map((b) => rectCells(b.x - 1, b.y - 1, b.w + 2, b.h + 2).filter((c) => campus.building[c] < 0))
    // Downspouts discharge on the downhill half of each building's perimeter.
    this.downspouts = this.rings.map((ring) => {
      const sorted = [...ring].sort((a, b) => this.ground[a] - this.ground[b])
      return sorted.slice(0, Math.ceil(sorted.length / 2))
    })
    this.roofCells = campus.buildings.map((b) => b.w * b.h)
    this.buildingFlood = campus.buildings.map(() => 0)
    this.buildingNow = campus.buildings.map(() => 0)
  }

  get done() {
    return this.tick >= this.totalTicks
  }
  get progress() {
    return this.tick / this.totalTicks
  }
  /** 0..1 rain intensity relative to this storm's peak. */
  get intensity() {
    return this.tick < SIM.rainTicks ? Math.sin((Math.PI * (this.tick + 0.5)) / SIM.rainTicks) : 0
  }

  /** Advance one tick. Returns false when the test is over. */
  step(): boolean {
    if (this.done) return false
    if (this.tick < SIM.rainTicks) this.rain((this.rainTotal * Math.PI) / (2 * SIM.rainTicks) * this.intensity)
    for (let s = 0; s < SIM.substeps; s++) this.flow()
    this.infiltrate()
    this.captureDrains()
    this.routePipes()
    this.runPumps()
    this.measure()
    this.tick++
    return !this.done
  }

  result(): FloodResult {
    let stored = 0
    let ponded = 0
    for (let i = 0; i < N; i++) {
      if (this.storage[i]) stored += this.water[i]
      else ponded += this.water[i]
    }
    for (const d of this.drains) stored += d.buffer
    const t = { ...this.totals, stored, ponded }
    const managed = t.infiltrated + t.drained + t.stored
    return {
      storm: this.storm,
      maxFloodIn: Math.max(...this.buildingFlood),
      buildingFloodIn: [...this.buildingFlood],
      runoffManagedPct: t.rain > 0 ? (100 * managed) / t.rain : 100,
      totals: t,
      ponds: this.ponds.map((p) => ({ id: p.id, fillPct: Math.min(100, (100 * this.sum(p.cells)) / p.capacity) })),
      overloadedDrains: this.drains.filter((d) => !d.id.startsWith('existing') && d.overloadTicks > 10).length,
      pipesAtCapacity: this.order.reduce((n, d) => (d.id.startsWith('existing') ? n : n + d.out.filter((l) => l.fullTicks > 20).length), 0),
      componentCount: this.componentCount,
      offsiteBy: { ...this.offsiteBy },
      maxDepth: this.maxDepth.slice(),
    }
  }

  // ---------------------------------------------------------------- steps

  private rain(r: number) {
    const { water, blocked, sink, rainMul, totals } = this
    for (let i = 0; i < N; i++) {
      if (blocked[i] || sink[i] === 1) continue
      const add = r * rainMul[i]
      water[i] += add
      totals.rain += r
      totals.infiltrated += r - add // canopy interception
    }
    // Roof water comes down the downspouts onto the ground around each building.
    for (let b = 0; b < this.rings.length; b++) {
      const ring = this.downspouts[b]
      const vol = r * this.roofCells[b]
      totals.rain += vol
      const each = vol / ring.length
      for (const c of ring) {
        if (blocked[c]) totals.infiltrated += each // lands on a barrier; negligible, keep the books balanced
        else water[c] += each
      }
    }
  }

  private flow() {
    const { water, bed, blocked, delta, sink, totals, channelNext } = this
    const c = SIM.flowRate
    delta.fill(0)
    // Channels convey water downstream directly (much faster than overland flow).
    for (let i = 0; i < N; i++) {
      const nx = channelNext[i]
      if (nx >= 0 && water[i] > 0 && !blocked[nx]) {
        const m = water[i] * SIM.channel.conveyance
        delta[i] -= m
        delta[nx] += m
      }
    }
    for (let y = 0; y < GRID_H; y++)
      for (let x = 0; x < GRID_W; x++) {
        const i = y * GRID_W + x
        const w = water[i] + (delta[i] < 0 ? delta[i] : 0)
        if (w <= 1e-7 || blocked[i]) continue
        const h = bed[i] + water[i]
        // Neighbor head differences (0 when blocked or uphill). Off-map edges use extrapolated ground.
        const dl = x > 0 ? (blocked[i - 1] ? 0 : h - bed[i - 1] - water[i - 1]) : h - (2 * bed[i] - bed[i + 1])
        const dr = x < GRID_W - 1 ? (blocked[i + 1] ? 0 : h - bed[i + 1] - water[i + 1]) : h - (2 * bed[i] - bed[i - 1])
        const du = y > 0 ? (blocked[i - GRID_W] ? 0 : h - bed[i - GRID_W] - water[i - GRID_W]) : h - (2 * bed[i] - bed[i + GRID_W])
        const dd = y < GRID_H - 1 ? (blocked[i + GRID_W] ? 0 : h - bed[i + GRID_W] - water[i + GRID_W]) : h - (2 * bed[i] - bed[i - GRID_W])
        const pl = dl > 0 ? dl : 0
        const pr = dr > 0 ? dr : 0
        const pu = du > 0 ? du : 0
        const pd = dd > 0 ? dd : 0
        const sum = pl + pr + pu + pd
        if (sum <= 0) continue
        const total = Math.min(w, sum * c)
        const k = total / sum
        delta[i] -= total
        if (pl) {
          if (x > 0) delta[i - 1] += pl * k
          else this.leave('west', pl * k)
        }
        if (pr) {
          if (x < GRID_W - 1) delta[i + 1] += pr * k
          else this.leave('east', pr * k)
        }
        if (pu) {
          if (y > 0) delta[i - GRID_W] += pu * k
          else this.leave('north', pu * k)
        }
        if (pd) {
          if (y < GRID_H - 1) delta[i + GRID_W] += pd * k
          else this.leave('south', pd * k)
        }
      }
    for (let i = 0; i < N; i++) {
      const w = water[i] + delta[i]
      water[i] = w > 0 ? w : 0
      if (sink[i] && water[i] > 0) {
        if (sink[i] === 1) this.leave('creek', water[i])
        else totals.drained += water[i]
        water[i] = 0
      }
    }
  }

  private infiltrate() {
    const { water, infil, totals } = this
    for (let i = 0; i < N; i++) {
      const w = water[i]
      if (w <= 0) continue
      const f = w < infil[i] ? w : infil[i]
      water[i] = w - f
      totals.infiltrated += f
    }
    for (const c of this.roadCells) {
      const f = Math.min(water[c], SIM.roadInlet)
      water[c] -= f
      totals.drained += f
    }
  }

  private captureDrains() {
    for (const d of this.drains) {
      const free = d.cap - d.buffer
      const avail = this.sum(d.capture)
      if (free < 0.05 && avail > 0.05) d.overloadTicks++
      const take = Math.min(d.rate, avail, Math.max(0, free))
      if (take <= 0) continue
      this.removeFrom(d.capture, take, avail)
      d.buffer += take
    }
  }

  private routePipes() {
    for (const node of this.order) {
      for (const l of node.out) {
        const avail = node.kind === 'drain' ? node.buffer : this.sum(node.cells)
        const move = Math.min(l.cap, avail)
        if (move <= 0) continue
        if (move >= l.cap * 0.98) l.fullTicks++
        if (node.kind === 'drain') node.buffer -= move
        else this.removeFrom(node.cells, move, avail)
        this.deliver(l.to, move)
      }
    }
  }

  private deliver(to: Node, v: number) {
    if (to.kind === 'outlet') this.totals.drained += v
    else if (to.kind === 'pond') for (const c of to.cells) this.water[c] += v / to.cells.length
    else {
      to.buffer += v
      if (to.buffer > to.cap) {
        // Surcharge: the downstream drain is full, so water bubbles back up onto the surface.
        this.water[to.cell] += to.buffer - to.cap
        to.buffer = to.cap
        to.overloadTicks++
      }
    }
  }

  private runPumps() {
    for (const p of this.pumps) {
      const avail = this.sum(p.intake)
      const take = Math.min(p.rate, avail)
      if (take <= 0) continue
      this.removeFrom(p.intake, take, avail)
      this.totals.pumped += take
      if (p.toOutlet) this.totals.drained += take
      else if (p.out >= 0) this.water[p.out] += take
      else this.water[p.intake[0]] += take
    }
  }

  private measure() {
    const { water, bed, ground, maxDepth } = this
    for (let i = 0; i < N; i++) {
      const d = bed[i] + water[i] - ground[i]
      if (d > maxDepth[i]) maxDepth[i] = d
    }
    for (let b = 0; b < this.rings.length; b++) {
      let m = 0
      for (const c of this.rings[b]) if (!this.blocked[c]) m = Math.max(m, bed[c] + water[c] - ground[c])
      this.buildingNow[b] = m
      if (m > this.buildingFlood[b]) this.buildingFlood[b] = m
    }
  }

  // ---------------------------------------------------------------- helpers

  private leave(edge: OffsiteEdge, v: number) {
    this.totals.offsite += v
    this.offsiteBy[edge] += v
  }

  private addDrain(id: string, x: number, y: number, rate: number): DrainNode {
    const cell = idx(x, y)
    this.bed[cell] -= SIM.drain.depressionIn
    const d: DrainNode = {
      kind: 'drain',
      id,
      cell,
      capture: cellsInRadius(x + 0.5, y + 0.5, SIM.drain.radius).filter((c) => !this.blocked[c]),
      rate,
      buffer: 0,
      cap: SIM.drain.sump,
      out: [],
      overloadTicks: 0,
    }
    this.drains.push(d)
    return d
  }

  private paintable(c: number) {
    const s = campus.surface[c]
    return (s === SURF.asphalt || s === SURF.concrete) && !this.roadCells.includes(c)
  }

  private nearOutlet(c: number) {
    const x = c % GRID_W
    const y = Math.floor(c / GRID_W)
    if (campus.outlets.some((o) => Math.hypot(o.x - x, o.y - y) <= SIM.outletReach)) return true
    for (const n of cellsInRadius(x + 0.5, y + 0.5, 1.5)) if (this.sink[n] === 1) return true
    return false
  }

  private sum(cells: number[]) {
    let s = 0
    for (const c of cells) s += this.water[c]
    return s
  }

  private removeFrom(cells: number[], amount: number, avail: number) {
    const f = 1 - amount / avail
    for (const c of cells) this.water[c] *= f
  }
}

function link(to: Node, cap: number): Link {
  return { to, cap, fullTicks: 0 }
}

/** Upstream nodes first so water can travel a whole chain in one tick. */
function topoOrder(nodes: (DrainNode | PondNode)[]): (DrainNode | PondNode)[] {
  const indeg = new Map<Node, number>(nodes.map((n) => [n, 0]))
  for (const n of nodes) for (const l of n.out) if (indeg.has(l.to)) indeg.set(l.to, indeg.get(l.to)! + 1)
  const queue = nodes.filter((n) => indeg.get(n) === 0)
  const out: (DrainNode | PondNode)[] = []
  while (queue.length) {
    const n = queue.shift()!
    out.push(n)
    for (const l of n.out) {
      if (!indeg.has(l.to)) continue
      const d = indeg.get(l.to)! - 1
      indeg.set(l.to, d)
      if (d === 0) queue.push(l.to as DrainNode | PondNode)
    }
  }
  for (const n of nodes) if (!out.includes(n)) out.push(n) // cycles: process in any order
  return out
}

export function runStorm(design: FloodObject[], storm: StormId = 'standard'): FloodResult {
  const run = new FloodRun(design, storm)
  while (run.step());
  return run.result()
}
