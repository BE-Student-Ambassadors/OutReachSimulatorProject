import { BOARD_COLS, BOARD_ROWS, CIRCUITS } from '../config'
import type { CircuitId, ElectricalObject } from '../types'
import { mulberry32 } from './rng'

/**
 * The breadboard puzzle (a "Flow"-style board): every circuit has two pins, wires run between
 * neighbouring holes, wires can't cross, and a finished board uses every hole.
 *
 * Boards are generated from a seed by walking one random path through every hole and cutting it
 * into one piece per circuit, so every board is guaranteed to have at least one full solution.
 */

export interface Board {
  rows: number
  cols: number
  /** Pin cells for each circuit. */
  pins: Record<CircuitId, [number, number]>
  /** One full-board solution (used by tests and reference designs). */
  solution: Record<CircuitId, number[]>
}

export const cellRow = (cell: number, cols = BOARD_COLS) => Math.floor(cell / cols)
export const cellCol = (cell: number, cols = BOARD_COLS) => cell % cols

export function adjacent(a: number, b: number, cols = BOARD_COLS): boolean {
  const dr = Math.abs(cellRow(a, cols) - cellRow(b, cols))
  const dc = Math.abs(cellCol(a, cols) - cellCol(b, cols))
  return dr + dc === 1
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
    const fromHead = rand() < 0.5
    if (!fromHead) path.reverse()
    const head = path[0]
    const ns = neighbours(head, rows, cols)
    const n = ns[Math.floor(rand() * ns.length)]
    if (n !== path[1]) {
      const i = path.indexOf(n)
      path = [...path.slice(0, i).reverse(), ...path.slice(i)]
    }
  }
  return path
}

const MIN_WIRE = 5

export function generateBoard(seed: number, rows = BOARD_ROWS, cols = BOARD_COLS): Board {
  const rand = mulberry32(seed)
  const n = CIRCUITS.length
  for (let attempt = 0; attempt < 200; attempt++) {
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
    // Pins right next to each other make a wire that doesn't need drawing; try again.
    if (pieces.some((p) => adjacent(p[0], p[p.length - 1], cols))) continue

    const pins = {} as Record<CircuitId, [number, number]>
    const solution = {} as Record<CircuitId, number[]>
    CIRCUITS.forEach((c, i) => {
      const p = rand() < 0.5 ? pieces[i] : [...pieces[i]].reverse()
      pins[c.id] = [p[0], p[p.length - 1]]
      solution[c.id] = p
    })
    return { rows, cols, pins, solution }
  }
  throw new Error('could not generate a breadboard')
}

const boardCache = new Map<number, Board>()
export function boardFor(seed: number): Board {
  let b = boardCache.get(seed)
  if (!b) {
    b = generateBoard(seed)
    boardCache.set(seed, b)
  }
  return b
}

/** Which circuit's pin sits on this cell, if any. */
export function pinAt(board: Board, cell: number): CircuitId | null {
  for (const c of CIRCUITS) if (board.pins[c.id].includes(cell)) return c.id
  return null
}

/** A wire is connected when it runs hole by hole from one of its pins to the other, over no other pins. */
export function wireConnected(board: Board, id: CircuitId, path: number[] | undefined): boolean {
  if (!path || path.length < 2) return false
  const [a, b] = board.pins[id]
  const ends = (path[0] === a && path[path.length - 1] === b) || (path[0] === b && path[path.length - 1] === a)
  if (!ends) return false
  for (let i = 1; i < path.length; i++) if (!adjacent(path[i - 1], path[i], board.cols)) return false
  for (let i = 1; i < path.length - 1; i++) if (pinAt(board, path[i]) !== null) return false
  return new Set(path).size === path.length
}

export interface BoardStatus {
  connected: Record<CircuitId, boolean>
  connectedCount: number
  /** Share of holes used by wires or pins, 0..1. */
  fill: number
  complete: boolean
}

export function boardStatus(el: ElectricalObject | null): BoardStatus {
  const connected = Object.fromEntries(CIRCUITS.map((c) => [c.id, false])) as Record<CircuitId, boolean>
  if (!el) return { connected, connectedCount: 0, fill: 0, complete: false }
  const board = boardFor(el.seed)
  const used = new Set<number>()
  for (const c of CIRCUITS) {
    board.pins[c.id].forEach((p) => used.add(p))
    const path = el.paths[c.id]
    connected[c.id] = wireConnected(board, c.id, path)
    path?.forEach((p) => used.add(p))
  }
  const connectedCount = Object.values(connected).filter(Boolean).length
  const fill = used.size / (board.rows * board.cols)
  return { connected, connectedCount, fill, complete: connectedCount === CIRCUITS.length && used.size === board.rows * board.cols }
}
