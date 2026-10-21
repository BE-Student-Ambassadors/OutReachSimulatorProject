import { CRIMP, POWER_PATHS, type PowerPathSpec } from '../config'
import type { ElectricalObject, PowerPart, PowerPathId } from '../types'
import { crimpOhms, zoneAt } from './harness'

export type PowerState = 'low' | 'ok' | 'high'

export interface PathReading {
  id: PowerPathId
  spec: PowerPathSpec
  volts: number
  state: PowerState
  /** Volts the spliced part changes (negative = drop). */
  partDelta: number
  /** Volts lost in the two crimped connections. */
  crimpDrop: number
  /** Power turned into heat by the resistor, watts (P = I² × R). */
  heatW: number
  /** 0 = off, 1 = exactly at the middle of the rated range, >1 = over. */
  level: number
  /** The wire is cut and not yet closed again (no part, or an end not crimped): nothing arrives. */
  open: boolean
  /** A weak crimp next to moving parts: fine on the bench, shakes loose on a lap. */
  loose: boolean
}

export function partDelta(part: PowerPart | null, amps: number): number {
  if (!part) return 0
  return part.type === 'resistor' ? -amps * part.value : part.value
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * What the component receives. `onLap`: during a lap, where a loose splice keeps cutting out
 * (on average the part gets well under its bench voltage).
 */
export function readPath(elec: ElectricalObject, spec: PowerPathSpec, onLap = false): PathReading {
  const line = elec.lines[spec.id]
  const base = { id: spec.id, spec, partDelta: 0, crimpDrop: 0, heatW: 0, open: false, loose: false }
  let volts = spec.sourceV
  if (line.cutAt !== null) {
    const zone = zoneAt(spec.id, line.cutAt).zone
    const [a, b] = line.crimps
    if (a === null || b === null || !line.part) {
      volts = 0
      base.open = true
    } else {
      base.partDelta = round1(partDelta(line.part, spec.amps))
      base.crimpDrop = round1(spec.amps * (crimpOhms(a, zone === 'hot') + crimpOhms(b, zone === 'hot')))
      base.heatW = line.part.type === 'resistor' ? spec.amps * spec.amps * line.part.value : 0
      base.loose = zone === 'moving' && Math.min(a, b) < CRIMP.looseBelow
      volts = Math.max(0, spec.sourceV + base.partDelta - base.crimpDrop)
      if (onLap && base.loose) volts *= 0.6
    }
  }
  volts = round1(volts)
  // Small tolerance so a reading of exactly the limit counts as in range.
  const state: PowerState = volts < spec.lo - 1e-6 ? 'low' : volts > spec.hi + 1e-6 ? 'high' : 'ok'
  return { ...base, volts, state, level: volts / ((spec.lo + spec.hi) / 2) }
}

export function readAll(elec: ElectricalObject, onLap = false): Record<PowerPathId, PathReading> {
  return Object.fromEntries(POWER_PATHS.map((s) => [s.id, readPath(elec, s, onLap)])) as Record<PowerPathId, PathReading>
}

export function partCount(elec: ElectricalObject, type: PowerPart['type']): number {
  return Object.values(elec.lines).filter((l) => l.part?.type === type).length
}

export function spliceCount(elec: ElectricalObject): number {
  return Object.values(elec.lines).filter((l) => l.cutAt !== null).length
}
