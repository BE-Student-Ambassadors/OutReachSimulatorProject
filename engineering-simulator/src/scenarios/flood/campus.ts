/**
 * The fictional Sequoia High campus: terrain, surfaces, buildings, outlets.
 * North (top) is high ground; the land falls ~1% toward the south-east. A swale
 * carries parking-lot runoff toward a low bowl where Building B sits.
 */
import { GRID_H, GRID_W } from './config'

export const SURF = {
  asphalt: 0,
  concrete: 1,
  grass: 2,
  field: 3,
  building: 4,
  creek: 5,
  permeable: 6,
  rainGarden: 7,
} as const
export type SurfaceId = (typeof SURF)[keyof typeof SURF]

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Building extends Rect {
  index: number
  key: string
  name: string
  roof: string
}

export interface Zone extends Rect {
  name: string
}

export interface Outlet {
  id: string
  name: string
  x: number
  y: number
}

export interface ExistingDrain {
  id: string
  x: number
  y: number
}

export interface Campus {
  w: number
  h: number
  /** Ground elevation, feet. */
  elevation: Float32Array
  surface: Uint8Array
  /** Building index per cell, or -1. */
  building: Int8Array
  buildings: Building[]
  zones: Zone[]
  outlets: Outlet[]
  existingDrains: ExistingDrain[]
  parking: Rect
  roads: Rect[]
}

export const PARKING: Rect = { x: 6, y: 6, w: 30, h: 14 }
export const COURTYARD: Rect = { x: 38, y: 20, w: 44, h: 14 }
export const FIELD: Rect = { x: 70, y: 38, w: 22, h: 18 }
const ROADS: Rect[] = [
  { x: 0, y: 0, w: GRID_W, h: 4 },
  { x: 0, y: 0, w: 4, h: GRID_H },
  { x: 14, y: 4, w: 5, h: 2 }, // parking entrance
]
const SIDEWALKS: Rect[] = [
  { x: 4, y: 21, w: 34, h: 2 }, // parking → courtyard
  { x: 16, y: 23, w: 2, h: 3 }, // to Building A
  { x: 55, y: 34, w: 3, h: 6 }, // courtyard → Building B
  { x: 26, y: 43, w: 21, h: 2 }, // A → B
  { x: 67, y: 34, w: 2, h: 22 }, // along the field
  { x: 4, y: 31, w: 5, h: 2 }, // A west door → road
]
const CREEK: Rect = { x: 94, y: 40, w: 2, h: GRID_H - 40 }

const BUILDINGS: Omit<Building, 'index'>[] = [
  { key: 'A', name: 'Building A', x: 9, y: 26, w: 17, h: 11, roof: '#cbd5e1' },
  { key: 'B', name: 'Building B', x: 47, y: 40, w: 18, h: 10, roof: '#cbd5e1' },
  { key: 'GYM', name: 'Gym', x: 42, y: 6, w: 16, h: 12, roof: '#d6d3d1' },
  { key: 'CAF', name: 'Cafeteria', x: 64, y: 8, w: 14, h: 10, roof: '#d6d3d1' },
]

const swale = { x0: 21, y0: 20, x1: 56, y1: 45 }
const bowl = { x: 56, y: 46, r: 9, depth: 0.5 }

export function groundElevation(x: number, y: number): number {
  let e = 20 - 0.1 * y - 0.025 * x
  // Swale from the parking lot down toward the bowl.
  const dx = swale.x1 - swale.x0
  const dy = swale.y1 - swale.y0
  const t = Math.max(0, Math.min(1, ((x - swale.x0) * dx + (y - swale.y0) * dy) / (dx * dx + dy * dy)))
  const sd = Math.hypot(x - (swale.x0 + t * dx), y - (swale.y0 + t * dy))
  e -= 0.5 * Math.exp(-(sd * sd) / (2 * 5 * 5))
  // The low bowl around Building B.
  const bd = Math.hypot(x - bowl.x, y - bowl.y)
  e -= bowl.depth * Math.exp(-(bd * bd) / (2 * bowl.r * bowl.r))
  return e
}

function fill(arr: Uint8Array, r: Rect, v: number) {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) if (x >= 0 && y >= 0 && x < GRID_W && y < GRID_H) arr[y * GRID_W + x] = v
}

export function inRect(r: Rect, x: number, y: number) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
}

export function createCampus(): Campus {
  const n = GRID_W * GRID_H
  const elevation = new Float32Array(n)
  const surface = new Uint8Array(n).fill(SURF.grass)
  const building = new Int8Array(n).fill(-1)

  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) elevation[y * GRID_W + x] = groundElevation(x, y)

  for (const r of ROADS) fill(surface, r, SURF.asphalt)
  fill(surface, PARKING, SURF.asphalt)
  fill(surface, COURTYARD, SURF.concrete)
  for (const r of SIDEWALKS) fill(surface, r, SURF.concrete)
  fill(surface, FIELD, SURF.field)
  fill(surface, CREEK, SURF.creek)

  const buildings = BUILDINGS.map((b, index) => ({ ...b, index }))
  for (const b of buildings) {
    fill(surface, b, SURF.building)
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) building[y * GRID_W + x] = b.index
  }

  return {
    w: GRID_W,
    h: GRID_H,
    elevation,
    surface,
    building,
    buildings,
    zones: [
      { name: 'Parking Lot', ...PARKING },
      { name: 'Courtyard', ...COURTYARD },
      { name: 'Athletic Field', ...FIELD },
    ],
    outlets: [
      { id: 'outlet-sewer', name: 'Storm Sewer Main', x: 2, y: 46 },
      { id: 'outlet-creek', name: 'Creek Outfall', x: 94, y: 56 },
      { id: 'outlet-south', name: 'South Sewer Manhole', x: 38, y: 58 },
    ],
    existingDrains: [
      { id: 'existing-1', x: 26, y: 10 },
      { id: 'existing-2', x: 60, y: 27 },
    ],
    parking: PARKING,
    roads: ROADS,
  }
}
