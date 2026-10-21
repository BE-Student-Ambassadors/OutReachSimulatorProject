import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SPONSORS, type SponsorSpec } from '../config'
import { mulberry32 } from '../sim/autonomy'
import { getTrack, TRACK_WIDTH, type Track } from '../sim/track'
import { CarModel } from './CarModel'
import type { CarLook, Pose } from './look'

/**
 * The autocross course and the event around it: grandstands, barriers, kerbs, sponsor boards,
 * the paddock and floodlights. At night the floodlights light the course.
 */
export function TrackScene({ night = false, knocked }: { night?: boolean; knocked: ReadonlySet<number> }) {
  const track = getTrack()
  const sky = night ? '#111814' : '#cfe0d2'

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
      <fog attach="fog" args={[sky, night ? 90 : 160, night ? 260 : 420]} />
      <group>
        {night ? (
          <>
            {/* Floodlights from above: an even, slightly warm light over the whole venue. */}
            <hemisphereLight args={['#e9e4d6', '#24302a', 1.45]} />
            <directionalLight position={[bounds.cx - 40, 140, bounds.cz - 30]} intensity={0.55} color="#fff4dc" />
          </>
        ) : (
          <>
            <hemisphereLight args={['#ffffff', '#7f9a70', 1.1]} />
            <directionalLight position={[bounds.cx + 60, 120, bounds.cz + 40]} intensity={1.5} />
          </>
        )}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bounds.cx, -0.02, bounds.cz]}>
          <planeGeometry args={[700, 600]} />
          <meshStandardMaterial color={night ? '#33452f' : '#86a96f'} />
        </mesh>
        <mesh geometry={asphalt} position={[0, 0.005, 0]}>
          <meshStandardMaterial color={night ? '#3d4240' : '#555c58'} roughness={0.95} />
        </mesh>
        {lines.map((g, i) => (
          <mesh key={i} geometry={g} position={[0, 0.012, 0]}>
            <meshStandardMaterial color="#f4f3ec" />
          </mesh>
        ))}
        <Kerbs track={track} />
        <StartLine track={track} />
        <Cones track={track} knocked={knocked} />
        <Venue track={track} night={night} />
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

/** A spot beside the course, `offset` m to one side (1 = left of travel), with the course heading there. */
interface SidePoint {
  x: number
  z: number
  h: number
  side: 1 | -1
}

/**
 * Points every `every` samples, `offset` m to each side of the course, keeping only those at
 * least `clear` m from every part of the track (so nothing lands on another stretch of it).
 */
function sidePoints(track: Track, offset: number, every: number, clear: number, phase = 0): SidePoint[] {
  const n = track.x.length
  const out: SidePoint[] = []
  for (let i = phase; i < n; i += every) {
    for (const side of [1, -1] as const) {
      // Left of travel is (tz, -tx).
      const x = track.x[i] + track.tz[i] * offset * side
      const z = track.z[i] - track.tx[i] * offset * side
      let near = Infinity
      for (let j = 0; j < n; j += 2) near = Math.min(near, (track.x[j] - x) ** 2 + (track.z[j] - z) ** 2)
      if (near >= clear * clear) out.push({ x, z, h: Math.atan2(track.tz[i], track.tx[i]), side })
    }
  }
  return out
}

interface Block {
  x: number
  y: number
  z: number
  ry: number
  color: string
  /** Length multiplier along local x (default 1). */
  sx?: number
}

/**
 * Blocks laid end to end `offset` m to each side of the course, one per `every` samples, each
 * stretched to meet the next so there are no gaps on the outside of corners. Blocks closer
 * than `clear` m to any part of the track are left out.
 */
function edgeBlocks(track: Track, offset: number, every: number, clear: number, include: (i: number) => boolean, color: (i: number) => string, y: number, length: number): Block[] {
  const n = track.x.length
  const out: Block[] = []
  const at = (i: number, side: number) => {
    const k = i % n
    return [track.x[k] + track.tz[k] * offset * side, track.z[k] - track.tx[k] * offset * side] as const
  }
  for (let i = 0; i < n; i += every) {
    if (!include(i)) continue
    for (const side of [1, -1]) {
      const [ax, az] = at(i, side)
      const [bx, bz] = at(i + every, side)
      const x = (ax + bx) / 2
      const z = (az + bz) / 2
      let near = Infinity
      for (let j = 0; j < n; j += 2) near = Math.min(near, (track.x[j] - x) ** 2 + (track.z[j] - z) ** 2)
      if (near < clear * clear) continue
      out.push({ x, y, z, ry: -Math.atan2(bz - az, bx - ax), color: color(i), sx: (Math.hypot(bx - ax, bz - az) + 0.03) / length })
    }
  }
  return out
}

/** Instanced boxes from a list of transforms and colors (set once). */
function Blocks({ items, size }: { items: Block[]; size: [number, number, number] }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      d.position.set(it.x, it.y, it.z)
      d.rotation.set(0, it.ry, 0)
      d.scale.set(it.sx ?? 1, 1, 1)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
      m.setColorAt(i, c.set(it.color))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [items])
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} key={items.length}>
      <boxGeometry args={size} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  )
}

/** Red and white kerbs on the edge of every corner. */
function Kerbs({ track }: { track: Track }) {
  const items = useMemo(
    () => edgeBlocks(track, TRACK_WIDTH / 2 + 0.95, 1, 0, (i) => Math.abs(track.k[i]) >= 0.025, (i) => (i % 2 ? '#c8281c' : '#f4f3ec'), 0.02, 1),
    [track],
  )
  return <Blocks items={items} size={[1, 0.04, 0.7]} />
}

const CROWD_COLORS = ['#b8461b', '#2c5b3c', '#d9a52b', '#f4f3ec', '#7c4dbd', '#cf4f86', '#3a3f3c', '#74a85f', '#e07a2e']

/**
 * Covered bleachers with a crowd. Local x runs along the stand; the front faces local +z
 * (toward the track) and the tiers climb away from it.
 */
function Grandstand({ x, z, ry, length, rows = 6, seed = 1, roof = true }: { x: number; z: number; ry: number; length: number; rows?: number; seed?: number; roof?: boolean }) {
  const crowd = useMemo(() => {
    const rand = mulberry32(seed)
    const out: Block[] = []
    for (let r = 0; r < rows; r++) {
      for (let px = -length / 2 + 0.6; px < length / 2 - 0.4; px += 0.75) {
        if (rand() < 0.22) continue
        out.push({ x: px + (rand() - 0.5) * 0.2, y: 1.1 + r * 0.7 + 0.35, z: -r * 1.1 - 0.1, ry: 0, color: CROWD_COLORS[Math.floor(rand() * CROWD_COLORS.length)] })
      }
    }
    return out
  }, [length, rows, seed])
  const depth = rows * 1.1
  const top = 1.1 + rows * 0.7
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      {Array.from({ length: rows }, (_, r) => (
        <mesh key={r} position={[0, (0.75 + r * 0.7) / 2 + 0.2, -r * 1.1]}>
          <boxGeometry args={[length, 0.75 + r * 0.7 + 0.4, 1.1]} />
          <meshStandardMaterial color={r % 2 ? '#c9ccc4' : '#b9bdb3'} />
        </mesh>
      ))}
      {/* Front wall with a forest-green band */}
      <mesh position={[0, 0.6, 0.6]}>
        <boxGeometry args={[length, 1.2, 0.1]} />
        <meshStandardMaterial color="#2c5b3c" />
      </mesh>
      <Blocks items={crowd} size={[0.42, 0.7, 0.32]} />
      {roof && (
        <>
          {[-0.5, -0.25, 0, 0.25, 0.5].map((f) => (
            <mesh key={f} position={[f * (length - 1), (top + 3.4) / 2, -depth + 0.3]}>
              <boxGeometry args={[0.3, top + 3.4, 0.3]} />
              <meshStandardMaterial color="#3a3f3c" />
            </mesh>
          ))}
          <mesh position={[0, top + 3.4, -depth / 2 + 0.2]} rotation={[0.08, 0, 0]}>
            <boxGeometry args={[length + 1, 0.25, depth + 2.4]} />
            <meshStandardMaterial color="#e9e8e1" />
          </mesh>
        </>
      )}
    </group>
  )
}

/** A sponsor board: brand color with the name painted on. */
function SponsorBoard({ p, sponsor }: { p: SidePoint; sponsor: SponsorSpec }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 128
    const g = c.getContext('2d')
    if (g) {
      g.fillStyle = sponsor.brandColor
      g.fillRect(0, 0, 512, 128)
      g.fillStyle = '#ffffff'
      g.font = '700 56px "Bricolage Grotesque Variable", system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(sponsor.name, 256, 66, 480)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [sponsor])
  useEffect(() => () => texture.dispose(), [texture])
  // Face the track: on the left of travel the track is toward local +z.
  const ry = -p.h + (p.side === 1 ? 0 : Math.PI)
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, ry, 0]}>
      {[-3.6, 3.6].map((x) => (
        <mesh key={x} position={[x, 1.1, -0.05]}>
          <boxGeometry args={[0.12, 2.2, 0.12]} />
          <meshStandardMaterial color="#3a3f3c" />
        </mesh>
      ))}
      <mesh position={[0, 2.1, 0]}>
        <planeGeometry args={[8, 2]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      <mesh position={[0, 2.1, -0.04]}>
        <boxGeometry args={[8.1, 2.1, 0.06]} />
        <meshStandardMaterial color="#3a3f3c" />
      </mesh>
    </group>
  )
}

/** A floodlight tower. At night its lamps glow and it lights a pool of track. */
function LightTower({ p, night }: { p: SidePoint; night: boolean }) {
  const ry = -p.h + (p.side === 1 ? 0 : Math.PI)
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 7, 0]}>
        <cylinderGeometry args={[0.18, 0.28, 14, 8]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 14.2, 0.2]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[3.2, 1.4, 0.3]} />
        <meshStandardMaterial color="#3a3f3c" />
      </mesh>
      <mesh position={[0, 14.2, 0.37]} rotation={[0.5, 0, 0]}>
        <planeGeometry args={[2.9, 1.15]} />
        <meshStandardMaterial color="#fffbe8" emissive="#fff6d8" emissiveIntensity={night ? 3 : 0.1} toneMapped={!night} />
      </mesh>
      {night && (
        <mesh position={[0, 0.03, 10]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[15, 32]} />
          <meshBasicMaterial color="#fff2c8" transparent opacity={0.09} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
  )
}

/** Garages for the teams beside the paddock, with team tents in front. */
function Paddock() {
  const garages = 8
  return (
    <group position={[-12, 0, 27]}>
      <mesh position={[0, 2.5, 3]}>
        <boxGeometry args={[garages * 7, 5, 8]} />
        <meshStandardMaterial color="#e9e8e1" />
      </mesh>
      <mesh position={[0, 5.15, 3]}>
        <boxGeometry args={[garages * 7 + 0.6, 0.3, 8.6]} />
        <meshStandardMaterial color="#2c5b3c" />
      </mesh>
      {Array.from({ length: garages }, (_, i) => (
        <mesh key={i} position={[(i - (garages - 1) / 2) * 7, 1.7, -1.02]}>
          <planeGeometry args={[5.4, 3.4]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#3a3f3c' : '#5b625e'} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {[-21, -7, 7, 21].map((x, i) => (
        <group key={x} position={[x, 0, -6]}>
          <mesh position={[0, 2.4, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[3.2, 1.2, 4]} />
            <meshStandardMaterial color={['#b8461b', '#f4f3ec', '#d9a52b', '#2c5b3c'][i]} />
          </mesh>
          {[
            [-2.2, -2.2],
            [2.2, -2.2],
            [-2.2, 2.2],
            [2.2, 2.2],
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

/** Everything around the course, all kept clear of the track. */
function Venue({ track, night }: { track: Track; night: boolean }) {
  const barriers = useMemo(() => edgeBlocks(track, 17, 2, 16.5, () => true, (i) => ((i / 2) % 2 ? '#c8281c' : '#f4f3ec'), 0.45, 2), [track])
  const boards = useMemo(() => sidePoints(track, 19, 34, 18.5, 10), [track])
  const towers = useMemo(() => sidePoints(track, 21, 52, 20.5, 30), [track])
  return (
    <group>
      <Blocks items={barriers} size={[2, 0.9, 0.5]} />
      {boards.map((p, i) => (
        <SponsorBoard key={i} p={p} sponsor={SPONSORS[i % SPONSORS.length]} />
      ))}
      {towers.map((p, i) => (
        <LightTower key={i} p={p} night={night} />
      ))}
      {/* Main grandstands along the start straight, then bleachers at the big corners. */}
      <Grandstand x={-50} z={-21} ry={0} length={44} rows={8} seed={3} />
      <Grandstand x={2} z={-21} ry={0} length={44} rows={8} seed={5} />
      <Grandstand x={58} z={-21} ry={0} length={36} rows={6} seed={7} />
      <Grandstand x={172} z={36} ry={-Math.PI / 2} length={30} rows={5} seed={11} />
      <Grandstand x={-18} z={130} ry={Math.PI} length={34} rows={5} seed={13} />
      <Grandstand x={70} z={96} ry={Math.PI} length={26} rows={4} seed={17} roof={false} />
      <Paddock />
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

/** A car driven by a pose getter (read every frame, no React re-renders). At night its headlights cast a beam. */
export function TrackCar({
  get,
  look,
  brake,
  night = false,
  ghost = false,
  body,
}: {
  get(): Pose & { braking?: boolean }
  look: CarLook
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
  return (
    <group ref={group}>
      <CarModel look={look} ghost={ghost} body={body} headlights={night ? 1.2 : 0.3} brakeLight={0.4} />
      {night && !ghost && (
        <>
          <primitive object={target} position={[14, 0, 0]} />
          <spotLight target={target} position={[look.wheelbaseMm / 2000 + 0.4, 0.7, 0]} color="#fff3d0" angle={0.6} penumbra={0.5} decay={1} distance={45} intensity={26} />
        </>
      )}
      {!ghost && <pointLight ref={brakeMat} position={[-look.wheelbaseMm / 2000 - 0.4, 0.6, 0]} color="#ff2a1a" intensity={0} distance={4} />}
    </group>
  )
}
