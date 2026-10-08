/**
 * Reference designs used by the balancing tests. These are NOT shown to students;
 * they exist to prove that several different approaches can pass.
 */
import { GRID_W } from '../config'
import type { FloodObject, Pt, Size3 } from '../types'

let n = 0
const id = (k: string) => `${k}-${n++}`
const drain = (x: number, y: number): FloodObject => ({ id: id('drain'), kind: 'drain', x, y })
const pipe = (from: FloodObject | string, to: FloodObject | string, size: Size3): FloodObject => ({
  id: id('pipe'),
  kind: 'pipe',
  from: typeof from === 'string' ? from : from.id,
  to: typeof to === 'string' ? to : to.id,
  size,
})
const pond = (x: number, y: number, size: Size3): FloodObject => ({ id: id('pond'), kind: 'pond', x, y, size })
const garden = (x: number, y: number): FloodObject => ({ id: id('rg'), kind: 'rainGarden', x, y })
const channel = (...points: Pt[]): FloodObject => ({ id: id('ch'), kind: 'channel', points })
const barrier = (...points: Pt[]): FloodObject => ({ id: id('bar'), kind: 'barrier', points })
const tree = (x: number, y: number): FloodObject => ({ id: id('tree'), kind: 'tree', x, y })
const pump = (x: number, y: number, size: 'small' | 'large', out: Pt): FloodObject => ({ id: id('pump'), kind: 'pump', x, y, size, out })
const permeable = (x0: number, y0: number, w: number, h: number): FloodObject => {
  const cells: number[] = []
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) cells.push(y * GRID_W + x)
  return { id: id('perm'), kind: 'permeable', cells }
}

const SEWER = 'outlet-sewer'
const CREEK = 'outlet-creek'
const SOUTH = 'outlet-south'

/** A: many drains + big pipes. */
export function strategyA(): FloodObject[] {
  const p1 = drain(17, 19)
  const p2 = drain(22, 19)
  const a1 = drain(21, 24)
  const b1 = drain(49, 38)
  const b2 = drain(53, 38)
  const b3 = drain(57, 38)
  const b4 = drain(61, 38)
  const w1 = drain(45, 41)
  return [
    p1, p2, a1, b1, b2, b3, b4, w1,
    pipe(w1, SOUTH, 'small'),
    pipe(p1, p2, 'small'),
    pipe(p2, a1, 'medium'),
    pipe(a1, SEWER, 'medium'),
    pipe(b1, b2, 'medium'),
    pipe(b2, SOUTH, 'large'),
    pipe(b3, b4, 'medium'),
    pipe(b4, CREEK, 'large'),
  ]
}

/** B: retention pond + permeable pavement. */
export function strategyB(): FloodObject[] {
  return [pond(28, 24, 'medium'), pond(50, 29, 'large'), permeable(12, 16, 16, 4), garden(19, 22), garden(42, 36)]
}

/** C: channels + rain gardens + a small pipe network. */
export function strategyC(): FloodObject[] {
  const d = drain(21, 24)
  return [
    channel({ x: 30, y: 26 }, { x: 46, y: 37 }, { x: 70, y: 38 }, { x: 80, y: 47 }, { x: 92, y: 55 }),
    garden(56, 51),
    garden(18, 21),
    d,
    pipe(d, SEWER, 'small'),
  ]
}

/** D: pumps + drains + infiltration. */
export function strategyD(): FloodObject[] {
  const d1 = drain(19, 19)
  const d2 = drain(24, 19)
  return [
    pump(52, 38, 'large', { x: 93, y: 50 }),
    pump(59, 38, 'large', { x: 93, y: 46 }),
    d1, d2,
    pipe(d1, d2, 'small'),
    pipe(d2, SEWER, 'medium'),
    garden(19, 22),
    garden(42, 39),
    tree(36, 30), tree(40, 34), tree(44, 36),
  ]
}

/** Buy a lot of everything: should work but blow the budget. */
export function strategyEverything(): FloodObject[] {
  return [...strategyA(), ...strategyB(), ...strategyC(), ...strategyD()]
}

/** A protective barrier around Building A only. */
export function barrierAroundA(): FloodObject[] {
  return [barrier({ x: 7, y: 24 }, { x: 28, y: 24 }, { x: 28, y: 39 })]
}

/** Strategy B plus a wall that shields Building A — the diverted water has to go somewhere. */
export function strategyBWithBarrier(): FloodObject[] {
  return [...strategyB(), ...barrierAroundA()]
}

/** Assorted things dropped without much thought. */
export function randomish(): FloodObject[] {
  return [tree(70, 10), tree(80, 25), drain(88, 30), garden(5, 55), pond(80, 5, 'small')]
}
