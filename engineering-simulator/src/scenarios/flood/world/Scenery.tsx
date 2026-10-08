import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { COURTYARD, PARKING, type Building } from '../campus'
import { REQUIRED } from '../config'
import { campus, type FloodRun } from '../sim/engine'
import { buildingExtent, heightAt } from './scale'


function windowTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#f4f1e8'
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = '#e4dfd1'
  g.fillRect(0, 56, 64, 8)
  g.fillStyle = '#3d5a4a'
  g.fillRect(10, 16, 44, 22)
  g.fillStyle = 'rgba(255,255,255,0.25)'
  g.fillRect(10, 16, 44, 5)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function BuildingMesh({ b, run }: { b: Building; run: FloodRun | null }) {
  const { base, tall } = useMemo(() => buildingExtent(b), [b])
  const materials = useMemo(() => {
    const longSide = windowTexture()
    longSide.repeat.set(b.w / 2.4, 1.5)
    const shortSide = windowTexture()
    shortSide.repeat.set(b.h / 2.4, 1.5)
    const wallL = new THREE.MeshStandardMaterial({ map: longSide, roughness: 0.85 })
    const wallS = new THREE.MeshStandardMaterial({ map: shortSide, roughness: 0.85 })
    const top = new THREE.MeshStandardMaterial({ color: '#d9d6cc', roughness: 0.9 })
    return { list: [wallS, wallS, top, top, wallL, wallL] }
  }, [b])
  const body = useRef<THREE.Mesh>(null)
  const pulse = useRef(0)

  useFrame((_, dt) => {
    const depth = run ? run.buildingNow[b.index] : 0
    const over = depth > REQUIRED.maxFloodIn
    pulse.current += dt * 5
    const k = over ? 0.35 + 0.25 * Math.sin(pulse.current) : depth > 0.6 ? 0.15 : 0
    const mats = (body.current?.material ?? []) as THREE.MeshStandardMaterial[]
    for (const m of [mats[0], mats[4]]) {
      if (!m) continue
      m.emissive.set(over ? '#d4380d' : '#e8a317')
      m.emissiveIntensity = k
    }
  })

  return (
    <group>
      <mesh
        ref={body}
        position={[b.x + b.w / 2, (base + tall) / 2, b.y + b.h / 2]}
        material={materials.list}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[b.w, tall - base, b.h]} />
      </mesh>
      {/* Roof: parapet + green membrane + rooftop units */}
      <mesh position={[b.x + b.w / 2, tall + 0.08, b.y + b.h / 2]} castShadow>
        <boxGeometry args={[b.w + 0.3, 0.16, b.h + 0.3]} />
        <meshStandardMaterial color="#e9e5da" roughness={0.9} />
      </mesh>
      <mesh position={[b.x + b.w / 2, tall + 0.17, b.y + b.h / 2]}>
        <boxGeometry args={[b.w - 0.6, 0.02, b.h - 0.6]} />
        <meshStandardMaterial color="#3f6b4a" roughness={0.8} />
      </mesh>
      {[0, 1].map((i) => (
        <mesh key={i} position={[b.x + 2.5 + i * 2.4, tall + 0.5, b.y + 2.2]} castShadow>
          <boxGeometry args={[1.6, 0.6, 1.2]} />
          <meshStandardMaterial color="#b8bdb5" roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
    </group>
  )
}

export function Buildings({ run }: { run: FloodRun | null }) {
  return (
    <>
      {campus.buildings.map((b) => (
        <BuildingMesh key={b.key} b={b} run={run} />
      ))}
    </>
  )
}

export function TreeModel({ scale = 1, color = '#3f7d46' }: { scale?: number; color?: string }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 1, 6]} />
        <meshStandardMaterial color="#7a5a3a" roughness={1} />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <icosahedronGeometry args={[0.85, 0]} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.25, 1.9, 0.1]} castShadow>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

const CAR_COLORS = ['#c0392b', '#f5f5f0', '#2c3e50', '#e1b12c', '#7f8c8d', '#27613b', '#f5f5f0', '#34495e']

/** Static set dressing: parked cars, courtyard trees, outlets, existing drains. */
export function Scenery({ bed }: { bed: Float32Array }) {
  const cars = useMemo(() => {
    const out: { x: number; z: number; c: string }[] = []
    let k = 0
    for (const row of [PARKING.y + 1.9, PARKING.y + 7.3, PARKING.y + 9.9])
      for (let x = PARKING.x + 2; x < PARKING.x + PARKING.w - 1; x += 2) {
        if ((x * 7 + row * 3) % 5 < 2) continue
        out.push({ x, z: row, c: CAR_COLORS[k++ % CAR_COLORS.length] })
      }
    return out
  }, [])
  const planters = [
    [COURTYARD.x + 6, COURTYARD.y + 6],
    [COURTYARD.x + 20, COURTYARD.y + 4],
    [COURTYARD.x + 34, COURTYARD.y + 8],
  ]
  return (
    <group>
      {cars.map((c, i) => {
        const y = heightAt(bed, c.x, c.z)
        return (
          <group key={i} position={[c.x, y, c.z]}>
            <mesh position={[0, 0.28, 0]} castShadow>
              <boxGeometry args={[0.9, 0.4, 1.9]} />
              <meshStandardMaterial color={c.c} roughness={0.4} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0.6, -0.1]} castShadow>
              <boxGeometry args={[0.78, 0.3, 1]} />
              <meshStandardMaterial color="#26323a" roughness={0.2} metalness={0.4} />
            </mesh>
          </group>
        )
      })}
      {planters.map(([x, z], i) => (
        <group key={i} position={[x, heightAt(bed, x, z), z]}>
          <mesh position={[0, 0.2, 0]} receiveShadow>
            <boxGeometry args={[2.4, 0.4, 2.4]} />
            <meshStandardMaterial color="#9a8467" roughness={1} />
          </mesh>
          <group position={[0, 0.4, 0]}>
            <TreeModel scale={1.3} />
          </group>
        </group>
      ))}
      {campus.existingDrains.map((d) => (
        <group key={d.id} position={[d.x + 0.5, heightAt(bed, d.x + 0.5, d.y + 0.5) + 0.03, d.y + 0.5]}>
          <mesh>
            <boxGeometry args={[0.8, 0.06, 0.8]} />
            <meshStandardMaterial color="#5b605c" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {campus.outlets.map((o) => {
        const y = heightAt(bed, o.x + 0.5, o.y + 0.5)
        return (
          <group key={o.id} position={[o.x + 0.5, y, o.y + 0.5]}>
            <mesh position={[0, 0.25, 0]} castShadow>
              <cylinderGeometry args={[0.7, 0.8, 0.5, 16]} />
              <meshStandardMaterial color="#7d8580" roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0.51, 0]}>
              <cylinderGeometry args={[0.5, 0.5, 0.03, 16]} />
              <meshStandardMaterial color="#2f3a33" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
