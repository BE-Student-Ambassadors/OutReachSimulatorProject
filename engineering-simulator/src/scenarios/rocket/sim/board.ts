import { BOARD_BY_ID, BOARDS, CIRCUITS, type CircuitSpec } from '../config'
import type { BoardId, CircuitId, ElectricalObject } from '../types'
import { mulberry32 } from './rng'

/**
 * The breadboard puzzles (a "Flow"-style board each): every circuit has two pins, wires run between
 * neighbouring holes, wires can't cross, and a finished board uses every hole. There are two boards
 * on the avionics sled, each with its own circuits.
 *
 * Boards are generated from a seed by walking one random path through every hole and cutting it
 * into one piece per circuit, so every board is guaranteed to have at least one full solution.
 */

export interface Board {
  id: BoardId
  rows: number
  cols: number
  /** The circuits wired on this board. */
  circuits: CircuitSpec[]
  /** Pin cells for each of its circuits. */
  pins: Partial<Record<CircuitId, [number, number]>>
  /** One full-board solution (used by tests and reference designs). */
  solution: Partial<Record<CircuitId, number[]>>
}

export const circuitsOn = (id: BoardId) => CIRCUITS.filter((c) => c.board === id)

export const cellRow = (cell: number, cols: number) => Math.floor(cell / cols)
export const cellCol = (cell: number, cols: number) => cell % cols

export function adjacent(a: number, b: number, cols: number): boolean {
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

export function generateBoard(seed: number, id: BoardId): Board {
  const { rows, cols } = BOARD_BY_ID[id]
  const circuits = circuitsOn(id)
  const rand = mulberry32(seed * 31 + BOARDS.findIndex((b) => b.id === id))
  const n = circuits.length
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

    const pins: Board['pins'] = {}
    const solution: Board['solution'] = {}
    circuits.forEach((c, i) => {
      const p = rand() < 0.5 ? pieces[i] : [...pieces[i]].reverse()
      pins[c.id] = [p[0], p[p.length - 1]]
      solution[c.id] = p
    })
    return { id, rows, cols, circuits, pins, solution }
  }
  throw new Error('could not generate a breadboard')
}

const boardCache = new Map<string, Board>()
export function boardFor(seed: number, id: BoardId): Board {
  const key = `${seed}|${id}`
  let b = boardCache.get(key)
  if (!b) {
    b = generateBoard(seed, id)
    boardCache.set(key, b)
  }
  return b
}

/** Which circuit's pin sits on this cell, if any. */
export function pinAt(board: Board, cell: number): CircuitId | null {
  for (const c of board.circuits) if (board.pins[c.id]!.includes(cell)) return c.id
  return null
}

/** A wire is connected when it runs hole by hole from one of its pins to the other, over no other pins. */
export function wireConnected(board: Board, id: CircuitId, path: number[] | undefined): boolean {
  if (!path || path.length < 2 || !board.pins[id]) return false
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

export interface StationStatus extends BoardStatus {
  boards: Record<BoardId, BoardStatus>
  boardsComplete: number
}

function oneBoard(el: ElectricalObject | null, id: BoardId): BoardStatus {
  const circuits = circuitsOn(id)
  const connected = Object.fromEntries(CIRCUITS.map((c) => [c.id, false])) as Record<CircuitId, boolean>
  if (!el) return { connected, connectedCount: 0, fill: 0, complete: false }
  const board = boardFor(el.seed, id)
  const used = new Set<number>()
  for (const c of circuits) {
    board.pins[c.id]!.forEach((p) => used.add(p))
    const path = el.paths[c.id]
    connected[c.id] = wireConnected(board, c.id, path)
    path?.forEach((p) => used.add(p))
  }
  const connectedCount = circuits.filter((c) => connected[c.id]).length
  const fill = used.size / (board.rows * board.cols)
  return { connected, connectedCount, fill, complete: connectedCount === circuits.length && used.size === board.rows * board.cols }
}

/** Both breadboards: which circuits are connected, and how much of each board is used. */
export function boardStatus(el: ElectricalObject | null): StationStatus {
  const boards = Object.fromEntries(BOARDS.map((b) => [b.id, oneBoard(el, b.id)])) as Record<BoardId, BoardStatus>
  const connected = Object.fromEntries(CIRCUITS.map((c) => [c.id, boards[c.board].connected[c.id]])) as Record<CircuitId, boolean>
  const holes = BOARDS.reduce((n, b) => n + b.rows * b.cols, 0)
  const fill = BOARDS.reduce((n, b) => n + boards[b.id].fill * b.rows * b.cols, 0) / holes
  const boardsComplete = BOARDS.filter((b) => boards[b.id].complete).length
  return {
    connected,
    connectedCount: Object.values(connected).filter(Boolean).length,
    fill,
    complete: boardsComplete === BOARDS.length,
    boards,
    boardsComplete,
  }
}
