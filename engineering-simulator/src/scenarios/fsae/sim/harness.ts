import {
  getElectrical,
  HARNESS,
  LIDAR,
  MOUNT_BY_ID,
  POWER_PATHS,
  ROUTE_BOARDS,
  SENSOR_BOARD,
  SENSOR_WIRES,
  SENSORS,
  SPLICE_WIRES,
  type HarnessZone,
  type SensorMountSpec,
} from '../config'
import type { ElectricalObject, PowerPathId, SensorId, SpliceZone } from '../types'
import { readPath } from './power'
import { boardFor, boardStatus, type RouteBoard } from './routing'

// ---------------------------------------------------------------- where the wire is cut

export function zoneAt(path: PowerPathId, t: number): HarnessZone {
  const zones = HARNESS[path].zones
  return zones.find((z) => t >= z.from && t <= z.to) ?? zones[zones.length - 1]
}

const ZONE_ORDER: SpliceZone[] = ['clear', 'moving', 'hot']

/** The routing board around a splice: depends on the team, the wire and what the cut is next to. */
export function lineBoard(seed: number, path: PowerPathId, zone: SpliceZone): RouteBoard {
  const k = POWER_PATHS.findIndex((p) => p.id === path)
  return boardFor(seed * 31 + k * 7 + ZONE_ORDER.indexOf(zone) + 1, ROUTE_BOARDS[zone], SPLICE_WIRES)
}

export function sensorBoard(seed: number): RouteBoard {
  return boardFor(seed * 31 + 97, SENSOR_BOARD, SENSOR_WIRES)
}

export { crimpOhms, dieFit, scoreCrimp, type CrimpInput, type CrimpReport, type DieFit } from '../../../shared/crimp/crimp'

// ---------------------------------------------------------------- progress

export interface LineProgress {
  cut: boolean
  crimped: number
  part: boolean
  inRange: boolean
  routed: boolean
  zone: HarnessZone | null
  /** Steps finished out of 5. */
  steps: number
  done: boolean
}

export function lineProgress(elec: ElectricalObject, path: PowerPathId): LineProgress {
  const line = elec.lines[path]
  const zone = line.cutAt === null ? null : zoneAt(path, line.cutAt)
  const cut = zone !== null
  const crimped = line.crimps.filter((c) => c !== null).length
  const part = !!line.part
  const inRange = readPath(elec, POWER_PATHS.find((p) => p.id === path)!).state === 'ok'
  const routed = !!zone && boardStatus(lineBoard(elec.seed, path, zone.zone), line.routes).complete
  const steps = [cut, crimped === 2, part, inRange, routed].filter(Boolean).length
  return { cut, crimped, part, inRange, routed, zone, steps, done: steps === 5 }
}

// ---------------------------------------------------------------- sensors

export interface SensorStatus {
  id: SensorId
  mount: SensorMountSpec | null
  /** Its cable runs pin to pin on the sensor board. */
  wired: boolean
  /** Mounted and wired (the computer still needs power to read it). */
  working: boolean
}

export function sensorStatus(elec: ElectricalObject): Record<SensorId, SensorStatus> & { boardComplete: boolean } {
  const st = boardStatus(sensorBoard(elec.seed), elec.sensorRoutes)
  const out = Object.fromEntries(
    SENSORS.map((s) => {
      const mount = elec.mounts[s.id] ? (MOUNT_BY_ID[elec.mounts[s.id]!] ?? null) : null
      const wired = !!st.connected[s.id]
      return [s.id, { id: s.id, mount, wired, working: !!mount && wired }]
    }),
  ) as Record<SensorId, SensorStatus>
  // The LiDAR comes mounted and wired.
  out.lidar = { id: 'lidar', mount: MOUNT_BY_ID[LIDAR.mount], wired: true, working: true }
  return { ...out, boardComplete: st.complete }
}

/**
 * The lab's test rig: what the software engineer simulates with before the car's own sensors
 * and computer are ready (LiDAR on the front wing, camera on the hoop, front wheel sensor, 5 V computer).
 */
export function benchRig(seed: number): ElectricalObject {
  const base = getElectrical([])
  return {
    ...base,
    seed,
    mounts: { lidar: LIDAR.mount, camera: 'camera-hoop', wheel: 'wheel-front' },
    sensorRoutes: { ...sensorBoard(seed).solution },
    lines: { ...base.lines, computer: { cutAt: 0.8, crimps: [1, 1], part: { type: 'resistor', value: 3.5 }, routes: {} } },
  }
}

/** The car's own sensors can drive the car: a cone sensor works and the computer has power. */
export function carSensorsReady(elec: ElectricalObject): boolean {
  const s = sensorStatus(elec)
  return (s.lidar.working || s.camera.working) && readPath(elec, POWER_PATHS.find((p) => p.id === 'computer')!).volts >= 1
}
