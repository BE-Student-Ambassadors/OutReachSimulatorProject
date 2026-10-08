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
  pipePerFt: { small: 40, medium: 70, large: 110 } satisfies Record<Size3, number>,
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

/**
 * Simulation tuning. Water depths are inches; volumes are "cell-inches"
 * (one inch over one cell = 62.3 gal). Rates are per tick.
 */
export const SIM = {
  rainTicks: 360,
  /** Ticks after the rain stops, so water finishes moving before results are taken. */
  drainTicks: 90,
  substeps: 4,
  /** Fraction of the head difference that moves to a neighbor per substep. */
  flowRate: 0.2,
  /** Infiltration, inches per tick. */
  infiltration: {
    asphalt: 0.0005,
    concrete: 0.0005,
    grass: 0.02,
    field: 0.022,
    permeable: 0.03,
    rainGarden: 0.12,
  },
  /** City curb inlets along the public roads (inches per tick per road cell). */
  roadInlet: 0.02,
  drain: { radius: 2, rate: 2, buffer: 4, sump: 40, depressionIn: 4 },
  existingDrain: { rate: 0.4, outflow: 0.3 },
  pipeCapacity: { small: 2.5, medium: 5, large: 10 } satisfies Record<Size3, number>,
  pump: { radius: 1.5, rate: { small: 3, large: 6 } satisfies Record<Size2, number> },
  pondDepthIn: 36,
  rainGardenDepthIn: 8,
  channel: { depthIn: 6, gradeIn: 0.4, conveyance: 0.6 },
  tree: { radius: 2.5, infiltrationBonus: 0.004, interception: 0.15 },
  /** Distance (cells) within which a channel end or pump discharge counts as reaching an outlet. */
  outletReach: 3,
}

export const STORMS = {
  standard: { label: 'Storm Test', rainIn: 3.0 },
  advanced: { label: 'Advanced Storm Test', rainIn: 4.5 },
}
export type StormId = keyof typeof STORMS

export const REQUIRED = {
  maxFloodIn: 2.0,
  runoffManagedPct: 90,
}
