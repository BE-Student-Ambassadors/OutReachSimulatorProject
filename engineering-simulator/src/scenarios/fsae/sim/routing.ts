import type { RouteBoardSpec, WireSpec } from '../config'
import { mulberry32 } from './rng'

/**
 * Routing boards (a "Flow"-style puzzle): every wire has two pins, wires run between neighbouring
 * tie points, wires can't cross, and a neat board uses every tie point.
 *
 * Boards are generated from a seed by walking one random path through every cell and cutting it
 * into one piece per wire, so every board has at least one full solution.
 */

export interface RouteBoard {
  rows: number
  cols: number
  wires: WireSpec[]
  /** Pin cells for each wire, by wire id. */
  pins: Record<string, [number, number]>
  /** One full-board solution (used by tests and reference designs). */
  solution: Record<string, number[]>
}

export const cellRow = (cell: number, cols: number) => Math.floor(cell / cols)
export const cellCol = (cell: number, cols: number) => cell % cols

export function adjacent(a: number, b: number, cols: number): boolean {
  return Math.abs(cellRow(a, cols) - cellRow(b, cols)) + Math.abs(cellCol(a, cols) - cellCol(b, cols)) === 1
}

function neighbours(cell: number, rows: number, cols: number): number[] {
  const r = Math.floor(cell / cols)
  const c = cell % cols
  const out: number[] = []
  if (r > 0) out.push(cell - cols)
  if (r < rows - 1) out.push(cell + cols)
  if (c > 0) out.push(cell - 1)
  if (c < cols - 1) out.push(cell + 1)
  return out
}

/** A random path through every cell, by "backbite" moves starting from a snake. */
function hamiltonianPath(rand: () => number, rows: number, cols: number): number[] {
  let path: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) path.push(r * cols + (r % 2 === 0 ? c : cols - 1 - c))
  }
  const moves = rows * cols * 60
  for (let m = 0; m < moves; m++) {
    if (rand() >= 0.5) path.reverse()
    const ns = neighbours(path[0], rows, cols)
    const n = ns[Math.floor(rand() * ns.length)]
    if (n !== path[1]) {
      const i = path.indexOf(n)
      path = [...path.slice(0, i).reverse(), ...path.slice(i)]
    }
  }
  return path
}

const MIN_WIRE = 4

export function generateBoard(seed: number, spec: RouteBoardSpec, wireList: WireSpec[]): RouteBoard {
  const { rows, cols } = spec
  const wires = wireList.slice(0, spec.wires)
  const rand = mulberry32(seed)
  const n = wires.length
  for (let attempt = 0; attempt < 400; attempt++) {
    const path = hamiltonianPath(rand, rows, cols)
    // Random wire lengths, each at least MIN_WIRE long, adding up to the whole board.
    const spare = rows * cols - n * MIN_WIRE
    const weights = Array.from({ length: n }, () => 0.4 + rand())
    const total = weights.reduce((a, b) => a + b, 0)
    const lengths = weights.map((w) => MIN_WIRE + Math.floor((w / total) * spare))
    lengths[n - 1] += rows * cols - lengths.reduce((a, b) => a + b, 0)

    const pieces: number[][] = []
    let at = 0
    for (const len of lengths) {
      pieces.push(path.slice(at, at + len))
      at += len
    }
    // Pins right next to each other make a wire that doesn't need routing; try again.
    if (pieces.some((p) => adjacent(p[0], p[p.length - 1], cols))) continue

    const pins: Record<string, [number, number]> = {}
    const solution: Record<string, number[]> = {}
    wires.forEach((w, i) => {
      const p = rand() < 0.5 ? pieces[i] : [...pieces[i]].reverse()
      pins[w.id] = [p[0], p[p.length - 1]]
      solution[w.id] = p
    })
    return { rows, cols, wires, pins, solution }
  }
  throw new Error('could not generate a routing board')
}

const cache = new Map<string, RouteBoard>()

/** Boards are cached by everything that shapes them. */
export function boardFor(seed: number, spec: RouteBoardSpec, wires: WireSpec[]): RouteBoard {
  const key = `${seed}|${spec.rows}x${spec.cols}x${spec.wires}|${wires.map((w) => w.id).join(',')}`
  let b = cache.get(key)
  if (!b) {
    b = generateBoard(seed, spec, wires)
    cache.set(key, b)
  }
  return b
}

/** Which wire's pin sits on this cell, if any. */
export function pinAt(board: RouteBoard, cell: number): string | null {
  for (const w of board.wires) if (board.pins[w.id].includes(cell)) return w.id
  return null
}

/** A wire is connected when it runs cell by cell from one of its pins to the other, over no other pins. */
export function wireConnected(board: RouteBoard, id: string, path: number[] | undefined): boolean {
  if (!path || path.length < 2) return false
  const [a, b] = board.pins[id]
  const ends = (path[0] === a && path[path.length - 1] === b) || (path[0] === b && path[path.length - 1] === a)
  if (!ends) return false
  for (let i = 1; i < path.length; i++) if (!adjacent(path[i - 1], path[i], board.cols)) return false
  for (let i = 1; i < path.length - 1; i++) if (pinAt(board, path[i]) !== null) return false
  return new Set(path).size === path.length
}

export interface BoardStatus {
  connected: Record<string, boolean>
  connectedCount: number
  /** Share of tie points used by wires or pins, 0..1. */
  fill: number
  /** Every wire connected and every tie point used. */
  complete: boolean
}

export function boardStatus(board: RouteBoard, routes: Record<string, number[]>): BoardStatus {
  const used = new Set<number>()
  const connected: Record<string, boolean> = {}
  for (const w of board.wires) {
    board.pins[w.id].forEach((p) => used.add(p))
    const path = routes[w.id]
    connected[w.id] = wireConnected(board, w.id, path)
    path?.forEach((p) => used.add(p))
  }
  const connectedCount = Object.values(connected).filter(Boolean).length
  const cells = board.rows * board.cols
  return { connected, connectedCount, fill: used.size / cells, complete: connectedCount === board.wires.length && used.size === cells }
}
