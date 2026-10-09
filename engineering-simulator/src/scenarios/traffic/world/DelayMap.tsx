import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { LANE_BY_ID, pointAt } from '../network'
import type { TrafficResult } from '../sim/engine'

/** Bins are 5 m long (see Lane.delay in the engine). */
const BIN = 5
const STOPS: [number, THREE.Color][] = [
  [0.5, new THREE.Color('#fde68a')],
  [2, new THREE.Color('#fb923c')],
  [5, new THREE.Color('#b8461b')],
  [10, new THREE.Color('#5c1a0b')],
]
const tmp = new THREE.Color()

function colorFor(carMin: number) {
  let k = 0
  while (k < STOPS.length - 2 && carMin > STOPS[k + 1][0]) k++
  const [a, ca] = STOPS[k]
  const [b, cb] = STOPS[k + 1]
  return tmp.copy(ca).lerp(cb, Math.min(1, Math.max(0, (carMin - a) / (b - a))))
}

/** Streets tinted by how long cars sat stopped on each 5 m stretch during the last test. */
export function DelayMap({ result }: { result: TrafficResult }) {
  const geometry = useMemo(() => {
    const pos: number[] = []
    const col: number[] = []
    for (const [laneId, bins] of Object.entries(result.laneDelay)) {
      const g = LANE_BY_ID.get(laneId)
      if (!g) continue
      bins.forEach((sec, i) => {
        const carMin = sec / 60
        if (carMin < 0.5) return
        const a = pointAt(g.pts, i * BIN)
        const b = pointAt(g.pts, (i + 1) * BIN)
        const nx = -Math.sin(a.angle) * 1.7
        const nz = Math.cos(a.angle) * 1.7
        const y = 0.16
        const quad = [
          [a.x - nx, a.y - nz],
          [a.x + nx, a.y + nz],
          [b.x + nx, b.y + nz],
          [b.x - nx, b.y - nz],
        ]
        for (const idx of [0, 1, 2, 0, 2, 3]) pos.push(quad[idx][0], y, quad[idx][1])
        const c = colorFor(carMin)
        for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b)
      })
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    return geo
  }, [result])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} renderOrder={3}>
      <meshBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}
