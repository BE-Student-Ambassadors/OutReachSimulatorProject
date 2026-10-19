import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getTrack, TRACK_WIDTH, type Track } from '../sim/track'
import { CarModel } from './CarModel'
import type { CarLook, Pose } from './look'

/** Ground, asphalt, start line, cones and a little scenery for the autocross course. */
export function TrackScene({ night = false, knocked }: { night?: boolean; knocked: ReadonlySet<number> }) {
  const track = getTrack()
  const sky = night ? '#0d1612' : '#cfe0d2'

  const asphalt = useMemo(() => ribbon(track, -TRACK_WIDTH / 2 - 0.6, TRACK_WIDTH / 2 + 0.6), [track])
  const lines = useMemo(() => [ribbon(track, TRACK_WIDTH / 2 - 0.35, TRACK_WIDTH / 2 - 0.2), ribbon(track, -TRACK_WIDTH / 2 + 0.2, -TRACK_WIDTH / 2 + 0.35)], [track])
  const bounds = useMemo(() => {
    const xs = track.x
    const zs = track.z
    return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cz: (Math.min(...zs) + Math.max(...zs)) / 2 }
  }, [track])

  return (
    <>
      {/* Background and fog must be direct children of the scene. */}
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, night ? 40 : 160, night ? 140 : 420]} />
      <group>
      <hemisphereLight args={[night ? '#3a4a60' : '#ffffff', night ? '#0b100d' : '#7f9a70', night ? 0.25 : 1.1]} />
      <directionalLight position={[bounds.cx + 60, 120, bounds.cz + 40]} intensity={night ? 0.15 : 1.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bounds.cx, -0.02, bounds.cz]}>
        <planeGeometry args={[700, 600]} />
        <meshStandardMaterial color={night ? '#1d2a1f' : '#86a96f'} />
      </mesh>
      <mesh geometry={asphalt} position={[0, 0.005, 0]}>
        <meshStandardMaterial color={night ? '#26292a' : '#555c58'} roughness={0.95} />
      </mesh>
      {lines.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, 0.012, 0]}>
          <meshStandardMaterial color="#f4f3ec" />
        </mesh>
      ))}
      <StartLine track={track} />
      <Cones track={track} knocked={knocked} />
      <Scenery track={track} night={night} />
      </group>
    </>
  )
}

/** A flat strip alongside the centerline between two signed offsets (positive = left). */
function ribbon(track: Track, from: number, to: number): THREE.BufferGeometry {
  const n = track.x.length
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const k = i % n
    // Left of travel is (tz, -tx).
    const lx = track.tz[k]
    const lz = -track.tx[k]
    pos.push(track.x[k] + lx * from, 0, track.z[k] + lz * from, track.x[k] + lx * to, 0, track.z[k] + lz * to)
    if (i < n) {
      const a = i * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // Make sure the strip faces up whichever way it was wound.
  const nrm = g.getAttribute('normal')
  if (nrm.getY(0) < 0) {
    g.setIndex(idx.map((_, j) => idx[j - (j % 3) + [0, 2, 1][j % 3]]))
    g.computeVertexNormals()
  }
  return g
}

function StartLine({ track }: { track: Track }) {
  const h = Math.atan2(track.tz[0], track.tx[0])
  const squares = useMemo(() => {
    const out: [number, number, boolean][] = []
    const cols = 12
    for (let c = 0; c < cols; c++) for (let r = 0; r < 2; r++) out.push([r * 0.6 - 0.3, -TRACK_WIDTH / 2 + (c + 0.5) * (TRACK_WIDTH / cols), (c + r) % 2 === 0])
    return out
  }, [])
  return (
    <group position={[track.x[0], 0.015, track.z[0]]} rotation={[0, -h, 0]}>
      {squares.map(([x, z, black], i) => (
        <mesh key={i} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.6, TRACK_WIDTH / 12]} />
          <meshStandardMaterial color={black ? '#1b1d1c' : '#f4f3ec'} />
        </mesh>
      ))}
      {/* Gantry */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, 2.2, s * (TRACK_WIDTH / 2 + 1.2)]}>
          <boxGeometry args={[0.25, 4.4, 0.25]} />
          <meshStandardMaterial color="#3a3f3c" />
        </mesh>
      ))}
      <mesh position={[0, 4.4, 0]}>
        <boxGeometry args={[0.4, 0.8, TRACK_WIDTH + 2.6]} />
        <meshStandardMaterial color="#2c5b3c" />
      </mesh>
    </group>
  )
}

function Cones({ track, knocked }: { track: Track; knocked: ReadonlySet<number> }) {
  const left = useRef<THREE.InstancedMesh>(null)
  const right = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  // Knocked cones topple over smoothly.
  const tilt = useRef(new Float32Array(track.cones.length))
  const sides = useMemo(() => {
    const l: number[] = []
    const r: number[] = []
    track.cones.forEach((c, i) => (c.side === 'left' ? l : r).push(i))
    return { l, r }
  }, [track])

  useFrame((_, dt) => {
    for (const [mesh, list] of [
      [left.current, sides.l],
      [right.current, sides.r],
    ] as const) {
      if (!mesh) continue
      list.forEach((ci, j) => {
        const c = track.cones[ci]
        const target = knocked.has(ci) ? Math.PI / 2 : 0
        tilt.current[ci] += (target - tilt.current[ci]) * Math.min(1, dt * 8)
        const t = tilt.current[ci]
        dummy.position.set(c.x, 0.33 * Math.cos(t) + 0.12 * Math.sin(t), c.z)
        dummy.rotation.set(t, (ci * 1.7) % Math.PI, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(j, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={left} args={[undefined, undefined, sides.l.length]}>
        <coneGeometry args={[0.2, 0.66, 10]} />
        <meshStandardMaterial color="#e8c22a" />
      </instancedMesh>
      <instancedMesh ref={right} args={[undefined, undefined, sides.r.length]}>
        <coneGeometry args={[0.2, 0.66, 10]} />
        <meshStandardMaterial color="#ef7d22" />
      </instancedMesh>
    </>
  )
}

/** Trees, a grandstand and pit tents, kept clear of the course. */
function Scenery({ track, night }: { track: Track; night: boolean }) {
  const trees = useMemo(() => {
    const out: [number, number, number][] = []
    let seed = 7
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const n = track.x.length
    for (let tries = 0; tries < 900 && out.length < 120; tries++) {
      const x = -170 + rand() * 380
      const z = -80 + rand() * 260
      let near = Infinity
      for (let i = 0; i < n; i += 4) near = Math.min(near, (track.x[i] - x) ** 2 + (track.z[i] - z) ** 2)
      if (near > 15 * 15) out.push([x, z, 0.8 + rand() * 0.8])
    }
    return out
  }, [track])
  const trunk = useRef<THREE.InstancedMesh>(null)
  const crown = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const d = new THREE.Object3D()
    trees.forEach(([x, z, s], i) => {
      d.position.set(x, 1.2 * s, z)
      d.scale.setScalar(s)
      d.updateMatrix()
      trunk.current?.setMatrixAt(i, d.matrix)
      d.position.set(x, 3.6 * s, z)
      d.updateMatrix()
      crown.current?.setMatrixAt(i, d.matrix)
    })
    if (trunk.current) trunk.current.instanceMatrix.needsUpdate = true
    if (crown.current) crown.current.instanceMatrix.needsUpdate = true
  }, [trees])

  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, trees.length]}>
        <cylinderGeometry args={[0.2, 0.3, 2.4, 6]} />
        <meshStandardMaterial color="#5b4630" />
      </instancedMesh>
      <instancedMesh ref={crown} args={[undefined, undefined, trees.length]}>
        <coneGeometry args={[1.6, 4, 8]} />
        <meshStandardMaterial color={night ? '#1f3324' : '#3f7a4a'} />
      </instancedMesh>
      {/* Grandstand beside the main straight */}
      <group position={[20, 0, -16]}>
        {[0, 1, 2, 3].map((r) => (
          <mesh key={r} position={[0, 0.5 + r * 0.7, -r * 1.1]}>
            <boxGeometry args={[40, 1, 1.1]} />
            <meshStandardMaterial color={r % 2 ? '#d7d9d1' : '#c4c7bd'} />
          </mesh>
        ))}
        <mesh position={[0, 5.2, -3.5]}>
          <boxGeometry args={[42, 0.2, 6]} />
          <meshStandardMaterial color="#2c5b3c" />
        </mesh>
      </group>
      {/* Pit tents */}
      {[-30, -18, -6].map((x, i) => (
        <group key={x} position={[x, 0, 16]}>
          <mesh position={[0, 2.4, 0]}>
            <coneGeometry args={[3.6, 1.4, 4]} />
            <meshStandardMaterial color={['#b8461b', '#f4f3ec', '#d9a52b'][i]} />
          </mesh>
          {[
            [-2.4, -2.4],
            [2.4, -2.4],
            [-2.4, 2.4],
            [2.4, 2.4],
          ].map(([a, b]) => (
            <mesh key={`${a}${b}`} position={[a, 0.9, b]}>
              <cylinderGeometry args={[0.06, 0.06, 1.8, 6]} />
              <meshStandardMaterial color="#9aa3ad" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/**
 * Third-person camera that follows a car. `get()` returns the car's pose each frame.
 */
export function ChaseCamera({ get, distance = 7.5, height = 3.2 }: { get(): { x: number; z: number; h: number }; distance?: number; height?: number }) {
  const { camera } = useThree()
  const first = useRef(true)
  const look = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const p = get()
    const fx = Math.cos(p.h)
    const fz = Math.sin(p.h)
    const want = new THREE.Vector3(p.x - fx * distance, height, p.z - fz * distance)
    const k = first.current ? 1 : 1 - Math.exp(-dt * 5)
    first.current = false
    camera.position.lerp(want, k)
    look.lerp(new THREE.Vector3(p.x + fx * 4, 0.6, p.z + fz * 4), k)
    camera.lookAt(look)
  })
  return null
}

/**
 * A car driven by a pose getter (read every frame, no React re-renders). At night it carries
 * a headlight beam whose brightness follows the headlight voltage.
 */
export function TrackCar({
  get,
  look,
  headlights = 1,
  brake,
  night = false,
  ghost = false,
  body,
}: {
  get(): Pose & { braking?: boolean }
  look: CarLook
  headlights?: number
  brake?: () => boolean
  night?: boolean
  ghost?: boolean
  body?: string
}) {
  const group = useRef<THREE.Group>(null)
  const brakeMat = useRef<THREE.PointLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const p = get()
    group.current?.position.set(p.x, 0, p.z)
    if (group.current) group.current.rotation.y = -p.h
    if (brakeMat.current) brakeMat.current.intensity = brake?.() ? 3 : 0
  })
  const beam = Math.max(0, headlights) ** 3
  return (
    <group ref={group}>
      <CarModel look={look} ghost={ghost} body={body} headlights={night ? Math.max(0.2, headlights) : 0.3} brakeLight={0.4} />
      {night && !ghost && beam > 0.02 && (
        <>
          <primitive object={target} position={[14, 0, 0]} />
          <spotLight target={target} position={[look.wheelbaseMm / 2000 + 0.4, 0.7, 0]} color="#fff3d0" angle={beam > 2 ? 0.9 : 0.55} penumbra={0.5} decay={1} distance={14 + 30 * Math.min(3, beam)} intensity={22 * beam} />
          {/* Over-bright headlights light up everything around the car. */}
          {beam > 2 && <pointLight position={[look.wheelbaseMm / 2000 + 3, 2.5, 0]} color="#fff8e0" intensity={18 * beam} decay={1} distance={40} />}
        </>
      )}
      {!ghost && <pointLight ref={brakeMat} position={[-look.wheelbaseMm / 2000 - 0.4, 0.6, 0]} color="#ff2a1a" intensity={0} distance={4} />}
    </group>
  )
}
