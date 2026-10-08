import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GRID_H, GRID_W } from '../config'
import type { FloodRun } from '../sim/engine'

const CLEAR_SKY = new THREE.Color('#dfe9dc')
const STORM_SKY = new THREE.Color('#4b5752')
const DROPS = 2200
const TOP = 30

/** Sun, sky color, and rain. `storm` eases toward the run's rain intensity. */
export function Atmosphere({ run }: { run: FloodRun | null }) {
  const { scene } = useThree()
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const rain = useRef<THREE.LineSegments>(null)
  const storm = useRef(0)
  const bg = useRef(CLEAR_SKY.clone())

  // Aim the sun at the middle of campus (the target must live in the scene to update).
  useEffect(() => {
    const light = sun.current
    if (!light) return
    light.target.position.set(GRID_W / 2, 0, GRID_H / 2)
    scene.add(light.target)
    return () => void scene.remove(light.target)
  }, [scene])

  const drops = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(DROPS * 6)
    const seed = (i: number) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1
    for (let i = 0; i < DROPS; i++) {
      const x = seed(i) * (GRID_W + 20) - 10
      const z = seed(i + 9999) * (GRID_H + 20) - 10
      const y = seed(i + 4242) * TOP
      pos.set([x, y, z, x + 0.15, y + 0.9, z + 0.05], i * 6)
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((frame, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const target = run && !run.done ? 0.45 + 0.55 * run.intensity : run ? 0.15 : 0
    storm.current += (target - storm.current) * Math.min(1, dt * 1.8)
    const s = storm.current
    bg.current.copy(CLEAR_SKY).lerp(STORM_SKY, s)
    frame.scene.background = bg.current
    if (frame.scene.fog) (frame.scene.fog as THREE.Fog).color.copy(bg.current)
    if (sun.current) sun.current.intensity = 2.4 - 1.9 * s
    if (hemi.current) hemi.current.intensity = 1.1 - 0.5 * s

    const r = rain.current
    if (!r) return
    const raining = run && !run.done ? run.intensity : 0
    r.visible = raining > 0.02
    ;(r.material as THREE.LineBasicMaterial).opacity = 0.15 + 0.45 * raining
    if (!r.visible) return
    const pos = drops.getAttribute('position') as THREE.BufferAttribute
    const p = pos.array as Float32Array
    const fall = dt * (38 + 30 * raining)
    for (let i = 0; i < DROPS; i++) {
      const o = i * 6
      p[o + 1] -= fall
      p[o + 4] -= fall
      if (p[o + 1] < -1) {
        p[o + 1] += TOP
        p[o + 4] += TOP
      }
    }
    pos.needsUpdate = true
  })

  return (
    <>
      <fog attach="fog" args={['#dfe9dc', 150, 320]} />
      <hemisphereLight ref={hemi} args={['#f4f8ef', '#5d6b4f', 1.1]} />
      <directionalLight
        ref={sun}
        position={[GRID_W / 2 - 30, 70, GRID_H / 2 - 40]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-62}
        shadow-camera-right={62}
        shadow-camera-top={62}
        shadow-camera-bottom={-62}
        shadow-camera-near={10}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
      />
      <lineSegments ref={rain} geometry={drops} visible={false} frustumCulled={false}>
        <lineBasicMaterial color="#dbe7ef" transparent opacity={0.4} />
      </lineSegments>
    </>
  )
}
