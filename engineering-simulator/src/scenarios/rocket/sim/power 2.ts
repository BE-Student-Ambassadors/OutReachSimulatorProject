import { crimpOhms, CRIMP } from '../../../shared/crimp/crimp'
import { LINES, lineOf, type LineSpec, type LineZone } from '../config'
import type { ElectricalObject, LineId } from '../types'

/**
 * The two battery leads: what voltage reaches the flight computer and the igniter. Each lead
 * can be cut, crimped and given a resistor (V = I × R) to bring the battery's 9 V down.
 */

export type PowerState = 'low' | 'ok' | 'high'

export interface LineReading {
  id: LineId
  spec: LineSpec
  volts: number
  state: PowerState
  /** Volts the resistor drops. */
  resistorDrop: number
  /** Volts lost in the two crimped connections. */
  crimpDrop: number
  /** Power turned into heat by the resistor, watts (P = I² × R). */
  heatW: number
  /** 0 = off, 1 = the middle of the rated range, >1 = over. */
  level: number
  /** Cut and not yet closed again (a crimp or the resistor missing): nothing arrives. */
  open: boolean
  /** A weak crimp where the wire gets moved: fine on the bench, shakes loose on the pad. */
  loose: boolean
}

export function zoneAt(id: LineId, t: number): LineZone {
  const zones = LINES.find((l) => l.id === id)!.zones
  return zones.find((z) => t >= z.from && t <= z.to) ?? zones[zones.length - 1]
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function readLine(el: ElectricalObject | null, spec: LineSpec): LineReading {
  const line = lineOf(el, spec.id)
  const base = { id: spec.id, spec, resistorDrop: 0, crimpDrop: 0, heatW: 0, open: false, loose: false }
  let volts = spec.sourceV
  if (line.cutAt !== null) {
    const [a, b] = line.crimps
    if (a === null || b === null || line.ohms === null) {
      volts = 0
      base.open = true
    } else {
      base.resistorDrop = round1(spec.amps * line.ohms)
      base.crimpDrop = round1(spec.amps * (crimpOhms(a, false) + crimpOhms(b, false)))
      base.heatW = spec.amps * spec.amps * line.ohms
      base.loose = zoneAt(spec.id, line.cutAt).zone === 'moving' && Math.min(a, b) < CRIMP.looseBelow
      volts = Math.max(0, spec.sourceV - base.resistorDrop - base.crimpDrop)
    }
  }
  volts = round1(volts)
  // Small tolerance so a reading of exactly the limit counts as in range.
  const state: PowerState = volts < spec.lo - 1e-6 ? 'low' : volts > spec.hi + 1e-6 ? 'high' : 'ok'
  return { ...base, volts, state, level: volts / ((spec.lo + spec.hi) / 2) }
}

export function readLines(el: ElectricalObject | null): Record<LineId, LineReading> {
  return Object.fromEntries(LINES.map((s) => [s.id, readLine(el, s)])) as Record<LineId, LineReading>
}

export interface LineProgress {
  cut: boolean
  crimped: number
  resistor: boolean
  inRange: boolean
  zone: LineZone | null
  /** Steps finished out of 4. */
  steps: number
  done: boolean
}

export function lineProgress(el: ElectricalObject | null, id: LineId): LineProgress {
  const line = lineOf(el, id)
  const zone = line.cutAt === null ? null : zoneAt(id, line.cutAt)
  const cut = zone !== null
  const crimped = line.crimps.filter((c) => c !== null).length
  const resistor = line.ohms !== null
  const inRange = readLine(el, LINES.find((l) => l.id === id)!).state === 'ok'
  const steps = [cut, crimped === 2, resistor, inRange].filter(Boolean).length
  return { cut, crimped, resistor, inRange, zone, steps, done: steps === 4 }
}
