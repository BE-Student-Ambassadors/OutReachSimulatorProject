import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export interface CameraGoal {
  target: THREE.Vector3
  pos: THREE.Vector3
}

type OrbitLike = { target: THREE.Vector3; update(): void }

/** Flies the camera to a goal whenever it changes. */
export function CameraFly({ goal, onArrive }: { goal: CameraGoal | null; onArrive?(): void }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null
  const fly = useRef<{ fromPos: THREE.Vector3; fromTarget: THREE.Vector3; to: CameraGoal; t: number } | null>(null)
  const arrive = useRef(onArrive)
  useEffect(() => {
    arrive.current = onArrive
  })
  useEffect(() => {
    if (!controls || !goal) return
    fly.current = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), to: goal, t: 0 }
  }, [goal, camera, controls])
  useFrame((_, dt) => {
    const f = fly.current
    if (!f || !controls) return
    f.t = Math.min(1, f.t + Math.min(dt, 1 / 30) / 0.8)
    const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2
    camera.position.lerpVectors(f.fromPos, f.to.pos, e)
    controls.target.lerpVectors(f.fromTarget, f.to.target, e)
    controls.update()
    if (f.t >= 1) {
      fly.current = null
      arrive.current?.()
    }
  })
  return null
}
