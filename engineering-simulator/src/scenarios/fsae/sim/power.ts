import { POWER_PATHS, type PowerPathSpec } from '../config'
import type { ElectricalObject, PowerPart, PowerPathId } from '../types'

export type PowerState = 'low' | 'ok' | 'high'

export interface PathReading {
  id: PowerPathId
  spec: PowerPathSpec
  volts: number
  state: PowerState
  /** Volts each slot's part changes (negative = drop). */
  partDeltas: [number, number]
  /** Power turned into heat by resistors on this path, watts (P = I² × R). */
  heatW: number
  /** 0 = off, 1 = exactly at the middle of the rated range, >1 = over. */
  level: number
}

export function partDelta(part: PowerPart | null, amps: number): number {
  if (!part) return 0
  return part.type === 'resistor' ? -amps * part.value : part.value
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function readPath(elec: ElectricalObject, spec: PowerPathSpec): PathReading {
  const [a, b] = elec.slots[spec.id]
  const partDeltas: [number, number] = [round1(partDelta(a, spec.amps)), round1(partDelta(b, spec.amps))]
  const volts = Math.max(0, round1(spec.sourceV + partDeltas[0] + partDeltas[1]))
  // Small tolerance so a reading of exactly the limit counts as in range.
  const state: PowerState = volts < spec.lo - 1e-6 ? 'low' : volts > spec.hi + 1e-6 ? 'high' : 'ok'
  const heatW = [a, b].reduce((s, p) => s + (p?.type === 'resistor' ? spec.amps * spec.amps * p.value : 0), 0)
  return { id: spec.id, spec, volts, state, partDeltas, heatW, level: volts / ((spec.lo + spec.hi) / 2) }
}

export function readAll(elec: ElectricalObject): Record<PowerPathId, PathReading> {
  return Object.fromEntries(POWER_PATHS.map((s) => [s.id, readPath(elec, s)])) as Record<PowerPathId, PathReading>
}

export function pathsInRange(elec: ElectricalObject): number {
  return POWER_PATHS.filter((s) => readPath(elec, s).state === 'ok').length
}

export function partCount(elec: ElectricalObject, type: PowerPart['type']): number {
  return Object.values(elec.slots).reduce((n, pair) => n + pair.filter((p) => p?.type === type).length, 0)
}
