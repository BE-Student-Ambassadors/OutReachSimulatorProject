import * as THREE from 'three'
import type { CameraGoal } from '../../../shared/three/CameraFly'
import { LINE_BY_ID } from '../config'
import type { BoardId, LineId } from '../types'

/** Where things sit on the electronics workbench: x toward the rocket's nose, y up, z toward the viewer. */

export type BenchJob = { kind: 'board'; id: BoardId } | { kind: 'line'; id: LineId }

export const sameJob = (a: BenchJob | null, b: BenchJob | null) => !!a && !!b && a.kind === b.kind && a.id === b.id

export const ZONE_TINT = { moving: '#e1b12c', clear: '#74a85f' } as const

/** Where each breadboard sits on the sled. */
export const BOARD_AT: Record<BoardId, [number, number, number]> = { flight: [0.13, -0.045, 0], sensor: [-0.04, -0.045, 0] }

const curveCache = new Map<LineId, THREE.CatmullRomCurve3>()
export function leadCurve(id: LineId): THREE.CatmullRomCurve3 {
  let c = curveCache.get(id)
  if (!c) {
    c = new THREE.CatmullRomCurve3(
      LINE_BY_ID[id].points.map((p) => new THREE.Vector3(...p)),
      false,
      'centripetal',
    )
    curveCache.set(id, c)
  }
  return c
}

export const HOME_GOAL: CameraGoal = { target: new THREE.Vector3(-0.2, 0, 0), pos: new THREE.Vector3(0.1, 1.05, 2.3) }

export function jobGoal(job: BenchJob): CameraGoal {
  if (job.kind === 'board') {
    const target = new THREE.Vector3(...BOARD_AT[job.id])
    // Look from the front and a little to the right, so the board sits clear of the overlay panel.
    target.x += 0.12
    return { target, pos: target.clone().add(new THREE.Vector3(0.05, 0.5, 0.6)) }
  }
  const curve = leadCurve(job.id)
  const target = curve.getPointAt(0.5)
  const dir = new THREE.Vector3(...LINE_BY_ID[job.id].view).normalize()
  return { target, pos: target.clone().addScaledVector(dir, Math.max(0.55, curve.getLength() * 0.75)) }
}
