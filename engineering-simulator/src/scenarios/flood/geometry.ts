import { GRID_H, GRID_W } from './config'
import type { Pt } from './types'

export const idx = (x: number, y: number) => y * GRID_W + x
export const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID_W && y < GRID_H

/** Cells along a polyline, 4-connected so water can follow it and barriers have no diagonal gaps. */
export function rasterizePath(points: Pt[]): number[] {
  const out: number[] = []
  const seen = new Set<number>()
  const push = (x: number, y: number) => {
    if (!inBounds(x, y)) return
    const i = idx(x, y)
    if (!seen.has(i)) {
      seen.add(i)
      out.push(i)
    }
  }
  if (points.length === 1) push(Math.floor(points[0].x), Math.floor(points[0].y))
  for (let s = 0; s < points.length - 1; s++) {
    let x = Math.floor(points[s].x)
    let y = Math.floor(points[s].y)
    const x1 = Math.floor(points[s + 1].x)
    const y1 = Math.floor(points[s + 1].y)
    const dx = Math.abs(x1 - x)
    const dy = Math.abs(y1 - y)
    const sx = x1 > x ? 1 : -1
    const sy = y1 > y ? 1 : -1
    let err = dx - dy
    push(x, y)
    while (x !== x1 || y !== y1) {
      // Step in one axis at a time: 4-connected supercover.
      if (err > 0 || (err === 0 && dx >= dy)) {
        x += sx
        err -= dy
      } else {
        y += sy
        err += dx
      }
      push(x, y)
    }
  }
  return out
}

export function pathLengthCells(points: Pt[]): number {
  let len = 0
  for (let i = 0; i < points.length - 1; i++)
    len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
  return len
}

/** Cells whose centers are within r of (cx, cy) (cx, cy in cell units, e.g. 10.5 = center of cell 10). */
export function cellsInRadius(cx: number, cy: number, r: number): number[] {
  const out: number[] = []
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if (inBounds(x, y) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) out.push(idx(x, y))
  return out
}

export function rectCells(x: number, y: number, w: number, h: number): number[] {
  const out: number[] = []
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (inBounds(xx, yy)) out.push(idx(xx, yy))
  return out
}
