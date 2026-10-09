import type { CameraControls } from '@react-three/drei'
import type * as THREE from 'three'

/**
 * Shared tabletop camera for 3D scenarios: left mouse is free for building,
 * right-drag rotates, wheel zooms, middle pans. Re-frames on canvas resize.
 *
 * Lessons baked in: `fitToBox` snaps to axis-aligned views, so we use setLookAt +
 * getDistanceToFitSphere, and maxDistance must be large enough not to clamp the fit.
 */
export interface CameraHome {
  pos: readonly [number, number, number]
  target: readonly [number, number, number]
  /** Radius of the sphere that should fit in view at a wide (≥ wideAspect) canvas. */
  radius: number
  wideAspect?: number
  bounds: THREE.Box3
}

export function goHome(c: CameraControls, home: CameraHome, smooth: boolean, aspect = (c.camera as THREE.PerspectiveCamera).aspect) {
  c.setLookAt(...home.pos, ...home.target, smooth)
  c.dollyTo(c.getDistanceToFitSphere(home.radius * Math.max(1, (home.wideAspect ?? 1.42) / aspect)), smooth)
}
