import * as THREE from 'three'
import { HARNESS } from '../config'
import type { PowerPathId, SensorId } from '../types'
import type { CarLook } from './look'
import type { CameraGoal } from '../../../shared/three/CameraFly'

export { nearestT, subCurve } from '../../../shared/three/curves'
export type { CameraGoal } from '../../../shared/three/CameraFly'

/**
 * Where harness parts sit on the 3D car. Harness coordinates are meters on the default-size
 * car (y up from the top of the floor); they stretch with the wheelbase and track like the frame.
 */
export function harnessPoint(p: readonly [number, number, number], look: CarLook): THREE.Vector3 {
  const floorY = look.rideHeightMm / 1000 + 0.02
  return new THREE.Vector3(p[0] * (look.wheelbaseMm / 1600), floorY + p[1], p[2] * (look.trackMm / 1200))
}

const curveCache = new Map<string, THREE.CatmullRomCurve3>()

export function wireCurve(path: PowerPathId, look: CarLook): THREE.CatmullRomCurve3 {
  const key = `${path}|${look.wheelbaseMm}|${look.trackMm}|${look.rideHeightMm}`
  let c = curveCache.get(key)
  if (!c) {
    c = new THREE.CatmullRomCurve3(HARNESS[path].points.map((p) => harnessPoint(p, look)), false, 'centripetal')
    curveCache.set(key, c)
  }
  return c
}

/** Insulation colors: the high-voltage lines are orange, as the rules require. */
export const WIRE_LOOK: Record<PowerPathId, { color: string; radius: number }> = {
  motor: { color: '#e06a1b', radius: 0.011 },
  computer: { color: '#2a2d2b', radius: 0.0055 },
}

export const ZONE_TINT = { hot: '#e0723c', moving: '#e1b12c', clear: '#74a85f' } as const

export type Job = PowerPathId | 'sensors'

/** Where each part sits (harness coordinates), for markers and the camera. */
export const PART_SPOT: Record<PowerPathId, [number, number, number]> = {
  motor: [-0.8, 0.16, 0],
  computer: [0.05, 0.1, -0.31],
}

export const SENSOR_DOT: Record<SensorId, string> = { lidar: '#7c4dbd', camera: '#e06a1b', wheel: '#3a3f3c' }


/** Close-up camera for a wire: looking at its middle from its own side. */
export function wireGoal(path: PowerPathId, look: CarLook): CameraGoal {
  const curve = wireCurve(path, look)
  const target = curve.getPointAt(0.5)
  const dir = new THREE.Vector3(...HARNESS[path].view).normalize()
  const span = Math.max(1, curve.getLength() * 1.1)
  return { target, pos: target.clone().addScaledVector(dir, span) }
}

export const HOME_GOAL: CameraGoal = { target: new THREE.Vector3(0, 0.35, 0), pos: new THREE.Vector3(2.6, 1.9, 2.8) }
export const SENSOR_GOAL: CameraGoal = { target: new THREE.Vector3(0.3, 0.4, 0), pos: new THREE.Vector3(2.4, 1.6, 2.2) }
