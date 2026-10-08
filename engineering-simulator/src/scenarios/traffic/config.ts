/**
 * Every tunable number for Morning Traffic. Distances are meters, times seconds.
 * Balancing tests in sim/ depend on these: re-run `npm test` (and the TUNE table) after changing them.
 */
import type { ProgramId, SignalSplit } from './types'

export const BUDGET = 200_000
export const M_TO_FT = 3.281

export const COST = {
  crosswalk: 4_000,
  beacon: 15_000,
  signal: 75_000,
  stop: 1_500,
  guard: 6_000,
  curbPerFt: 40,
  turnLane: 30_000,
  busBay: 40_000,
  bikeLanePerFt: 35,
  sidewalkPerFt: 60,
  program: { carpool: 20_000, sideGate: 8_000, helpers: 6_000 } satisfies Record<ProgramId, number>,
}

export const REQUIRED = { onTimePct: 95, maxUnsafe: 20 }

/** Clock: the test runs from 7:25 to 8:10; the bell rings at 8:05. */
export const CLOCK = { startMin: 7 * 60 + 25, bellMin: 8 * 60 + 5, endMin: 8 * 60 + 10 }

export const SIM = {
  dt: 0.5,
  students: 1800,
  share: { car: 0.4, bus: 0.25, walk: 0.2, bike: 0.15 },
  studentsPerCar: 2,
  busCount: 6,
  studentsPerWalker: 4,
  studentsPerBike: 2,
  /** Where school-bound cars come from (fractions of drop-off cars). */
  carOrigins: { west: 0.35, east: 0.35, oak: 0.15, elm: 0.15 },
  /** With the side gate open, some east-side drivers switch to Elm Street. */
  carOriginsSideGate: { west: 0.35, east: 0.2, oak: 0.15, elm: 0.3 },
  /** Drop-off arrival window (minutes after 7:25) — triangular distribution. */
  carWindow: { from: 5, peak: 25, to: 37 },
  walkWindow: { from: 10, to: 32 },
  busTimes: [17, 19, 21, 23, 25, 27],
  throughPerHour: { main: 400, pine: 60, elm: 40 },
  speed: { main: 12, side: 10, loop: 5, bus: 10 },
  accel: 2,
  brake: 3,
  carLength: 5,
  busLength: 12,
  dwell: { normal: 25, helpers: 14, bus: 60, rainExtra: 6 },
  slotSpacing: 7.5,
  /** Gap acceptance: approaching cars closer than this many seconds block a turn or merge. */
  gapSec: 3.2,
  crossGapSec: 4.5,
  walkSpeed: 1.3,
  bikeSpeed: 4.5,
  /** Jaywalk if the legal route is this many times longer than the direct one. */
  jaywalkRatio: 1.5,
  /** An unprotected crossing is unsafe if a moving car is this close (seconds). */
  unsafeSec: 2,
  pedWaitMax: { marked: 15, unmarked: 6 },
  guard: { every: 35, hold: 12 },
  signalCycle: 60,
  signalSplit: { main: 0.6, even: 0.5, side: 0.4 } satisfies Record<SignalSplit, number>,
  carpoolCut: 0.15,
  /** Share of all students who switch from car to bike per connected bike route. */
  bikeShiftPerRoute: 0.04,
}

export const VARIANTS = {
  standard: { label: 'Morning Test', carMul: 1, speedMul: 1, dwellExtra: 0 },
  rainy: { label: 'Rainy Monday', carMul: 1.3, speedMul: 0.85, dwellExtra: SIM.dwell.rainExtra },
}
export type VariantId = keyof typeof VARIANTS
