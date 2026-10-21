import * as THREE from 'three'

/** The stretch of a curve between two fractions of its length, as its own smooth curve. */
export function subCurve(curve: THREE.Curve<THREE.Vector3>, from: number, to: number, samples = 24): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= samples; i++) pts.push(curve.getPointAt(Math.min(1, Math.max(0, from + ((to - from) * i) / samples))))
  return new THREE.CatmullRomCurve3(pts)
}

/** Fraction along the wire nearest to a 3D point. */
export function nearestT(curve: THREE.Curve<THREE.Vector3>, p: THREE.Vector3, samples = 240): number {
  let best = 0
  let bd = Infinity
  const v = new THREE.Vector3()
  for (let i = 0; i <= samples; i++) {
    curve.getPointAt(i / samples, v)
    const d = v.distanceToSquared(p)
    if (d < bd) {
      bd = d
      best = i / samples
    }
  }
  return best
}
