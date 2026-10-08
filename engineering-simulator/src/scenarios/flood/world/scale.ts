import type { Building } from '../campus'
import { GRID_H, GRID_W } from '../config'
import { campus } from '../sim/engine'

/** World units: 1 unit = 1 grid cell horizontally. Elevation is exaggerated so slopes read clearly. */
export const UNITS_PER_FT = 0.5
export const UNITS_PER_IN = UNITS_PER_FT / 12
/** Water depth is drawn taller than true scale so a 2" flood is visible. */
export const WATER_EXAG = 3.5

let minGround = Infinity
for (const e of campus.elevation) minGround = Math.min(minGround, e)
export const BASE_IN = minGround * 12 - 6

/** World Y for a height in inches. */
export const yOf = (inches: number) => (inches - BASE_IN) * UNITS_PER_IN

/** Bilinear height (world Y) of a bed field at grid coordinates (cell centers at .5). */
export function heightAt(bed: Float32Array, gx: number, gy: number) {
  const x = Math.max(0, Math.min(GRID_W - 1, gx - 0.5))
  const y = Math.max(0, Math.min(GRID_H - 1, gy - 0.5))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(GRID_W - 1, x0 + 1)
  const y1 = Math.min(GRID_H - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const a = bed[y0 * GRID_W + x0] * (1 - fx) + bed[y0 * GRID_W + x1] * fx
  const b = bed[y1 * GRID_W + x0] * (1 - fx) + bed[y1 * GRID_W + x1] * fx
  return yOf(a * (1 - fy) + b * fy)
}

/** Vertex X/Z for cell column/row: cell centers, with the border pushed out to the map edge. */
export const vx = (x: number) => (x === 0 ? 0 : x === GRID_W - 1 ? GRID_W : x + 0.5)
export const vz = (y: number) => (y === 0 ? 0 : y === GRID_H - 1 ? GRID_H : y + 0.5)

export const CENTER = { x: GRID_W / 2, z: GRID_H / 2 }

const HEIGHTS: Record<string, number> = { A: 3.4, B: 3.4, GYM: 4.6, CAF: 2.8 }

/** Bottom and roof height (world Y) of a building. */
export function buildingExtent(b: Building) {
  let m = Infinity
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) m = Math.min(m, campus.elevation[y * campus.w + x])
  const base = yOf(m * 12) - 0.3
  return { base, tall: base + 0.3 + (HEIGHTS[b.key] ?? 3) }
}
