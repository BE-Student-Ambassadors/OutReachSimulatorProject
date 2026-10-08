/**
 * Every tunable number for Flooded Campus lives here: grid, costs, capacities, rates.
 * Balancing tests in sim/ depend on these, so re-run `npm test` after changing them.
 */
import type { Size2, Size3 } from './types'

export const GRID_W = 96
export const GRID_H = 60
/** Each grid cell is a 10 ft × 10 ft square. */
export const CELL_FT = 10
/** Gallons in one inch of water over one cell (100 sq ft). */
export const GAL_PER_CELL_INCH = 62.3

export const BUDGET = 150_000

export const COST = {
  drain: 5_000,
  pipePerFt: { small: 60, medium: 100, large: 160 } satisfies Record<Size3, number>,
  channelPerFt: 40,
  pond: { small: 15_000, medium: 25_000, large: 40_000 } satisfies Record<Size3, number>,
  rainGarden: 8_000,
  permeablePerCell: 900, // $9 / sq ft
  pump: { small: 10_000, large: 20_000 } satisfies Record<Size2, number>,
  barrierPerFt: 45,
  tree: 1_000,
}

/** Footprints, in cells (width × height). */
export const POND_SIZE: Record<Size3, number> = { small: 6, medium: 8, large: 10 }
export const RAIN_GARDEN_SIZE = 4

export const REQUIRED = {
  maxFloodIn: 2.0,
  runoffManagedPct: 90,
}
