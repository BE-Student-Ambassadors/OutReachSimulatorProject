/** Where things may be placed. Shared by the World (ghost previews) and the design logic. */
import { inRect, SURF } from './campus'
import { GRID_H, GRID_W, POND_SIZE, RAIN_GARDEN_SIZE } from './config'
import { campus } from './sim/engine'
import { idx, inBounds } from './geometry'
import type { FloodObject } from './types'

const roadCell = new Uint8Array(GRID_W * GRID_H)
for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) if (campus.roads.some((r) => inRect(r, x, y))) roadCell[idx(x, y)] = 1

/** Cells nothing can be built on: buildings, the creek, and public roads. */
export function isOffLimits(c: number) {
  const s = campus.surface[c]
  return s === SURF.building || s === SURF.creek || roadCell[c] === 1
}

/** Asphalt or concrete on campus (not public roads). */
export function isPaintable(c: number) {
  const s = campus.surface[c]
  return (s === SURF.asphalt || s === SURF.concrete) && !roadCell[c]
}

export function footprint(o: FloodObject): { x: number; y: number; s: number } | null {
  if (o.kind === 'pond') return { x: o.x, y: o.y, s: POND_SIZE[o.size] }
  if (o.kind === 'rainGarden') return { x: o.x, y: o.y, s: RAIN_GARDEN_SIZE }
  return null
}

function overlapsFootprint(design: FloodObject[], x: number, y: number, s: number, ignoreId?: string) {
  return design.some((o) => {
    if (o.id === ignoreId) return false
    const f = footprint(o)
    return !!f && x < f.x + f.s && x + s > f.x && y < f.y + f.s && y + s > f.y
  })
}

export function canPlacePoint(design: FloodObject[], x: number, y: number, ignoreId?: string) {
  if (!inBounds(x, y) || isOffLimits(idx(x, y))) return false
  if (overlapsFootprint(design, x, y, 1, ignoreId)) return false
  return !design.some(
    (o) => o.id !== ignoreId && (o.kind === 'drain' || o.kind === 'pump' || o.kind === 'tree') && o.x === x && o.y === y,
  )
}

export function canPlaceFootprint(design: FloodObject[], x: number, y: number, s: number, ignoreId?: string) {
  if (x < 0 || y < 0 || x + s > GRID_W || y + s > GRID_H) return false
  for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) if (isOffLimits(idx(xx, yy))) return false
  if (overlapsFootprint(design, x, y, s, ignoreId)) return false
  return !design.some(
    (o) =>
      o.id !== ignoreId &&
      (o.kind === 'drain' || o.kind === 'pump' || o.kind === 'tree') &&
      o.x >= x && o.x < x + s && o.y >= y && o.y < y + s,
  )
}

/** The pipe node (drain, pond, or outlet) at a cell, if any. */
export function nodeAt(design: FloodObject[], x: number, y: number): string | null {
  for (const o of design) {
    if (o.kind === 'drain' && Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1) return o.id
  }
  for (const o of design) {
    if (o.kind !== 'pond') continue
    const s = POND_SIZE[o.size]
    if (x >= o.x - 1 && x <= o.x + s && y >= o.y - 1 && y <= o.y + s) return o.id
  }
  for (const o of campus.outlets) if (Math.hypot(o.x - x, o.y - y) <= 2.5) return o.id
  return null
}

export const isPipeSource = (design: FloodObject[], id: string) =>
  design.some((o) => o.id === id && (o.kind === 'drain' || o.kind === 'pond'))
