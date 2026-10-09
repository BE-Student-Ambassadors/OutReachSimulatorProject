import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { carPose, type TrafficRun } from '../sim/engine'

/**
 * Every vehicle and person drawn with instanced meshes (one draw call per kind),
 * positioned from the simulation each frame. Never one React component per agent.
 */

const CAR_COLORS = ['#c0392b', '#f5f5f0', '#2c3e50', '#e1b12c', '#7f8c8d', '#27613b', '#dfe6e9', '#34495e', '#8e5a3c', '#5d7ea6']
const MAX_CARS = 1600
const MAX_BUSES = 8
const MAX_PEDS = 400
const MAX_FLASH = 40

/** Vehicles and people are drawn larger than life so they read at campus scale. */
const VEHICLE_SCALE = 1.35
const PERSON_SCALE = 2.1

const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const pos = new THREE.Vector3()
const scl = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const color = new THREE.Color()

function place(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, angle: number, s = 1) {
  q.setFromAxisAngle(up, -angle)
  pos.set(x, y, z)
  scl.set(s, s, s)
  m4.compose(pos, q, scl)
  mesh.setMatrixAt(i, m4)
}

export function Agents({ run }: { run: TrafficRun | null }) {
  const body = useRef<THREE.InstancedMesh>(null)
  const cabin = useRef<THREE.InstancedMesh>(null)
  const brakes = useRef<THREE.InstancedMesh>(null)
  const bus = useRef<THREE.InstancedMesh>(null)
  const busRoof = useRef<THREE.InstancedMesh>(null)
  const walker = useRef<THREE.InstancedMesh>(null)
  const bike = useRef<THREE.InstancedMesh>(null)
  const flash = useRef<THREE.InstancedMesh>(null)
  const beam = useRef<THREE.InstancedMesh>(null)
  /** Flashes are timed in real seconds (the sim runs ~150× faster than real time). */
  const seen = useRef({ run: null as TrafficRun | null, count: 0, live: [] as { x: number; y: number; born: number }[] })

  const geo = useMemo(
    () => ({
      body: new THREE.BoxGeometry(4.4, 1.1, 1.9).translate(0, 0.75, 0),
      cabin: new THREE.BoxGeometry(2.3, 0.75, 1.7).translate(-0.2, 1.65, 0),
      brake: new THREE.BoxGeometry(0.15, 0.3, 1.7).translate(-2.25, 0.95, 0),
      bus: new THREE.BoxGeometry(12, 2.6, 2.5).translate(0, 1.6, 0),
      busRoof: new THREE.BoxGeometry(11.6, 0.6, 2.56).translate(0, 2.2, 0),
      walker: new THREE.CapsuleGeometry(0.45, 1.1, 3, 8).translate(0, 1.0, 0),
      bike: new THREE.BoxGeometry(1.9, 1.4, 0.5).translate(0, 0.9, 0),
      flash: new THREE.RingGeometry(3, 5, 32).rotateX(-Math.PI / 2).translate(0, 0.25, 0),
      beam: new THREE.CylinderGeometry(0.9, 0.9, 14, 10, 1, true).translate(0, 7, 0),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  // Per-car paint, assigned once by id.
  useEffect(() => {
    // Create the per-instance color buffers before first render so the shader includes them.
    const b = body.current
    const w = walker.current
    if (!b || !w) return
    for (let i = 0; i < MAX_CARS; i++) b.setColorAt(i, color.set(CAR_COLORS[i % CAR_COLORS.length]))
    for (let i = 0; i < MAX_PEDS; i++) w.setColorAt(i, color.set('#f5f5f0'))
    ;(b.material as THREE.Material).needsUpdate = true
    ;(w.material as THREE.Material).needsUpdate = true
  }, [])

  useFrame(({ clock }) => {
    const meshes = [body.current, cabin.current, brakes.current, bus.current, busRoof.current, walker.current, bike.current, flash.current, beam.current]
    if (meshes.some((m) => !m)) return
    const [B, C, K, U, R, W, Y, F, M] = meshes as THREE.InstancedMesh[]
    let nc = 0
    let nk = 0
    let nb = 0
    let nw = 0
    let ny = 0
    let nf = 0
    if (run) {
      for (const c of run.cars) {
        if (c.state === 'pending' || c.state === 'done') continue
        const p = carPose(c)
        let x = p.x
        let z = p.y
        if (c.state === 'parked') {
          // Pull over to the curb (right-hand side of travel).
          x += -Math.sin(p.angle) * 2.6
          z += Math.cos(p.angle) * 2.6
        }
        if (c.kind === 'bus') {
          if (nb >= MAX_BUSES) continue
          // carPose is the front bumper; draw the body behind it.
          place(U, nb, x - Math.cos(p.angle) * 6, 0, z - Math.sin(p.angle) * 6, p.angle, 1.15)
          place(R, nb, x - Math.cos(p.angle) * 6, 0, z - Math.sin(p.angle) * 6, p.angle, 1.15)
          nb++
          continue
        }
        if (nc >= MAX_CARS) continue
        const cx = x - Math.cos(p.angle) * 2.3
        const cz = z - Math.sin(p.angle) * 2.3
        place(B, nc, cx, 0, cz, p.angle, VEHICLE_SCALE)
        place(C, nc, cx, 0, cz, p.angle, VEHICLE_SCALE)
        B.setColorAt(nc, color.set(CAR_COLORS[c.id % CAR_COLORS.length]))
        nc++
        if (c.v < 0.5 && c.state === 'drive') place(K, nk++, cx, 0, cz, p.angle, VEHICLE_SCALE)
      }
      for (const p of run.peds) {
        if (p.state === 'pending' || p.state === 'done') continue
        const step = p.path[Math.min(p.i, p.path.length - 1)]
        const ang = step ? Math.atan2(step.y1 - step.y0, step.x1 - step.x0) : 0
        if (p.kind === 'bike') {
          if (ny < MAX_PEDS) place(Y, ny++, p.x, 0, p.y, ang, PERSON_SCALE * 0.8)
        } else if (nw < MAX_PEDS) {
          W.setColorAt(nw, color.set(p.state === 'wait' ? '#e8a317' : '#f5f5f0'))
          place(W, nw++, p.x, 0, p.y, ang, PERSON_SCALE)
        }
      }
      const now = clock.elapsedTime
      const fl = seen.current
      if (fl.run !== run) Object.assign(fl, { run, count: 0, live: [] })
      for (; fl.count < run.flashes.length; fl.count++) {
        const [x, y] = run.flashes[fl.count]
        fl.live.push({ x, y, born: now })
      }
      fl.live = fl.live.filter((f) => now - f.born < 1.6)
      for (const f of fl.live) {
        if (nf >= MAX_FLASH) break
        const age = now - f.born
        place(F, nf, f.x, 0, f.y, 0, 1 + age * 1.4)
        place(M, nf, f.x, 0, f.y, 0, Math.max(0.05, 1 - age / 1.6))
        nf++
      }
    }
    B.count = nc
    C.count = nc
    K.count = nk
    U.count = nb
    R.count = nb
    W.count = nw
    Y.count = ny
    F.count = nf
    M.count = nf
    for (const m of [B, C, K, U, R, W, Y, F, M]) m.instanceMatrix.needsUpdate = true
    if (B.instanceColor) B.instanceColor.needsUpdate = true
    if (W.instanceColor) W.instanceColor.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={body} args={[geo.body, undefined, MAX_CARS]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.45} metalness={0.25} />
      </instancedMesh>
      <instancedMesh ref={cabin} args={[geo.cabin, undefined, MAX_CARS]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#26323a" roughness={0.2} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={brakes} args={[geo.brake, undefined, MAX_CARS]} frustumCulled={false}>
        <meshStandardMaterial color="#ff2a1a" emissive="#ff2a1a" emissiveIntensity={1.4} />
      </instancedMesh>
      <instancedMesh ref={bus} args={[geo.bus, undefined, MAX_BUSES]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#f2b81c" roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={busRoof} args={[geo.busRoof, undefined, MAX_BUSES]} frustumCulled={false}>
        <meshStandardMaterial color="#2f3a33" roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={walker} args={[geo.walker, undefined, MAX_PEDS]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={bike} args={[geo.bike, undefined, MAX_PEDS]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#d0702a" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={flash} args={[geo.flash, undefined, MAX_FLASH]} frustumCulled={false}>
        <meshBasicMaterial color="#e5341b" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
      {/* A short red beam makes each unsafe crossing visible from across the map. */}
      <instancedMesh ref={beam} args={[geo.beam, undefined, MAX_FLASH]} frustumCulled={false}>
        <meshBasicMaterial color="#ff3b1f" transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  )
}
