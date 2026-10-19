import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { DEBRIS_GRAVITY_FPS2, type RocketRun } from '../sim/engine'
import { ALT_SCALE, rocketScenePos } from './sceneScale'
import type { SmokeEmitters } from './smokeEmitters'

const PUFFS = 180
const PUFF_LIFE = 3.8
const EMIT_EVERY = 0.026

interface PuffBuffer {
  pos: THREE.Vector3[]
  born: Float32Array
  size: Float32Array
  next: number
  lastEmit: number
  run: RocketRun | null
  tmp: THREE.Object3D
}

function makePuffBuffer(): PuffBuffer {
  return {
    pos: Array.from({ length: PUFFS }, () => new THREE.Vector3()),
    born: new Float32Array(PUFFS).fill(-99),
    size: new Float32Array(PUFFS),
    next: 0,
    lastEmit: 0,
    run: null,
    tmp: new THREE.Object3D(),
  }
}

/** Exhaust smoke: a ring buffer of puffs that swell, drift up and fade where they were left. */
export function SmokeTrail({ run, emitters }: { run: RocketRun | null; emitters: RefObject<SmokeEmitters> }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const bufRef = useRef<PuffBuffer | null>(null)

  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    bufRef.current ??= makePuffBuffer()
    const buf = bufRef.current
    const tmp = buf.tmp
    const now = state.clock.elapsedTime
    if (buf.run !== run) {
      buf.born.fill(-99)
      buf.run = run
    }
    if (run && now - buf.lastEmit > EMIT_EVERY) {
      buf.lastEmit = now
      for (const em of [emitters.current.nozzle, emitters.current.motor]) {
        if (!em.active) continue
        const i = buf.next
        buf.next = (i + 1) % PUFFS
        buf.pos[i].set(
          em.pos.x + (Math.random() - 0.5) * 0.3,
          em.pos.y + (Math.random() - 0.5) * 0.3,
          em.pos.z + (Math.random() - 0.5) * 0.3,
        )
        buf.born[i] = now
        buf.size[i] = em.size * (0.8 + Math.random() * 0.45)
      }
    }
    for (let i = 0; i < PUFFS; i++) {
      const age = now - buf.born[i]
      if (age < 0 || age > PUFF_LIFE) {
        tmp.scale.setScalar(0)
      } else {
        const fade = Math.min(1, (PUFF_LIFE - age) / 1.1)
        tmp.position.set(buf.pos[i].x + age * 0.35, buf.pos[i].y + age * 0.45, buf.pos[i].z)
        tmp.scale.setScalar(buf.size[i] * (0.7 + age * 2.1) * fade)
      }
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PUFFS]} frustumCulled={false}>
      <sphereGeometry args={[1, 14, 10]} />
      <meshStandardMaterial color="#efece6" transparent opacity={0.42} depthWrite={false} roughness={1} />
    </instancedMesh>
  )
}

/** Deterministic pseudo-random numbers so the breakup looks the same on every replay. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

type FragmentKind = 'nose' | 'shell-upper' | 'shell-lower' | 'fin' | 'motor' | 'bay' | 'shard'

interface FragmentSpec {
  kind: FragmentKind
  /** Start offset from the rocket's center (scene units, rocket upright). */
  off: [number, number, number]
  /** Kick away from the breakup point (scene units/s) and spin (rad/s). */
  v: [number, number, number]
  w: [number, number, number]
  /** Air drag: light shards stop quickly, the heavy motor keeps flying. */
  k: number
  /** Extra per-kind data: which shell half / fin / bay, and shard size. */
  index: number
  rot0: number
}

function buildFragments(): FragmentSpec[] {
  const rnd = seeded(7)
  const r = (a: number, b: number) => a + (b - a) * rnd()
  const out: FragmentSpec[] = [
    { kind: 'nose', off: [0, 3.4, 0], v: [r(1, 2.5), r(1, 3), r(-1, 1)], w: [r(1.5, 3), 0.4, r(2, 4)], k: 1.3, index: 0, rot0: 0 },
    { kind: 'motor', off: [0, -4.6, 0], v: [r(-1.5, 1.5), r(-2, 0), r(1, 2.5)], w: [r(4, 7), 0.6, r(2, 3)], k: 0.9, index: 0, rot0: 0 },
  ]
  for (const half of [0, 1]) {
    const side = half === 0 ? -1 : 1
    out.push({ kind: 'shell-upper', off: [0, 1.85, 0], v: [side * r(3, 5), r(0, 2), r(-2, 2)], w: [r(-2, 2), r(-1, 1), -side * r(3, 5)], k: 1.9, index: half, rot0: 0 })
    out.push({ kind: 'shell-lower', off: [0, -1.7, 0], v: [side * r(2.5, 4.5), r(-1, 1), r(-2, 2)], w: [r(-2, 2), r(-1, 1), -side * r(2, 4)], k: 1.7, index: half, rot0: 0 })
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    out.push({ kind: 'fin', off: [Math.cos(a) * 0.92, -2.75, -Math.sin(a) * 0.92], v: [Math.cos(a) * r(5, 8), r(1, 4), -Math.sin(a) * r(5, 8)], w: [r(5, 9), r(3, 6), r(4, 8)], k: 2.6, index: i, rot0: a })
  }
  for (let i = 0; i < 6; i++) {
    out.push({ kind: 'bay', off: [0, 2.8 - i * 1.25, 0], v: [r(-4, 4), r(-1, 3), r(-4, 4)], w: [r(2, 6), r(2, 6), r(2, 6)], k: 2.1, index: i, rot0: 0 })
  }
  for (let i = 0; i < 18; i++) {
    out.push({ kind: 'shard', off: [r(-0.5, 0.5), r(-4, 3.5), r(-0.5, 0.5)], v: [r(-8, 8), r(-2, 7), r(-8, 8)], w: [r(4, 12), r(4, 12), r(4, 12)], k: 3.2, index: i, rot0: r(0, 6) })
  }
  return out
}

const FRAGMENTS = buildFragments()
const SMOKE_BALLS = 12

/**
 * The rocket's own parts flying apart after it tears itself to pieces: nose cone, ripped body
 * shells, fins, the still-burning motor, the internal bays and small shards, plus a flash,
 * fireball, shockwave and a smoke cloud.
 */
export function BreakupDebris({
  run,
  geos,
  bodyColors,
  bayColors,
  onMotorSmoke,
}: {
  run: RocketRun | null
  geos: {
    nose: THREE.BufferGeometry
    tip: THREE.BufferGeometry
    boatTail: THREE.BufferGeometry
    nozzle: THREE.BufferGeometry
    fin: THREE.BufferGeometry
  }
  bodyColors: { upper: string; lower: string; fin: string; metalness: number; roughness: number }
  bayColors: string[]
  /** Reports where the still-burning motor is, so the smoke trail can follow it. */
  onMotorSmoke(pos: THREE.Vector3, burning: boolean): void
}) {
  const root = useRef<THREE.Group>(null)
  const pieces = useRef<(THREE.Object3D | null)[]>([])
  const flash = useRef<THREE.Mesh>(null)
  const fireball = useRef<THREE.Mesh>(null)
  const shock = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const motorFlame = useRef<THREE.Group>(null)
  const smoke = useRef<(THREE.Mesh | null)[]>([])
  const smokeDirs = useMemo(() => {
    const rnd = seeded(11)
    return Array.from({ length: SMOKE_BALLS }, () =>
      new THREE.Vector3(rnd() - 0.5, rnd() - 0.3, rnd() - 0.5).normalize().multiplyScalar(2 + rnd() * 3),
    )
  }, [])
  const motorWorld = useRef(new THREE.Vector3())

  useFrame((state) => {
    const g = root.current
    if (!g) return
    const f = run?.frame
    if (!f || !f.rocketShredded) {
      g.visible = false
      onMotorSmoke(motorWorld.current, false)
      return
    }
    g.visible = true
    const t = f.breakupSeconds
    const [ox, oy, oz] = rocketScenePos(f.breakupPos)
    const climb = f.breakupClimbFps * ALT_SCALE
    const grav = DEBRIS_GRAVITY_FPS2 * ALT_SCALE

    FRAGMENTS.forEach((spec, i) => {
      const obj = pieces.current[i]
      if (!obj) return
      const e = (1 - Math.exp(-spec.k * t)) / spec.k
      const y = oy + spec.off[1] + (climb + spec.v[1]) * e - 0.5 * grav * t * t
      const grounded = y <= 0.25
      obj.position.set(ox + spec.off[0] + spec.v[0] * e, grounded ? 0.25 : y, oz + spec.off[2] + spec.v[2] * e)
      if (!grounded) {
        const spin = (1 - Math.exp(-0.45 * t)) / 0.45
        obj.rotation.set(spec.w[0] * spin, spec.rot0 + spec.w[1] * spin, spec.w[2] * spin)
      }
      if (spec.kind === 'motor') {
        obj.getWorldPosition(motorWorld.current)
        const burning = t < 1.8 && !grounded
        onMotorSmoke(motorWorld.current, burning)
        if (motorFlame.current) {
          motorFlame.current.visible = burning
          const flick = 0.75 + Math.sin(state.clock.elapsedTime * 50) * 0.2
          motorFlame.current.scale.set(flick, flick * (1 - t / 1.8) + 0.2, flick)
        }
      }
    })

    // Flash → fireball → shockwave ring, all centred where it broke up.
    const fx = (m: THREE.Mesh | null, scale: number, opacity: number) => {
      if (!m) return
      m.visible = opacity > 0.01
      m.position.set(ox, oy, oz)
      m.scale.setScalar(Math.max(0.001, scale))
      ;(m.material as THREE.MeshBasicMaterial).opacity = opacity
    }
    fx(flash.current, 1.5 + t * 22, Math.max(0, 0.9 - t / 0.16))
    fx(fireball.current, 1.2 + Math.min(1, t / 0.35) * 4.5, Math.max(0, 0.95 - t / 1.3))
    fx(shock.current, 1 + t * 26, Math.max(0, 0.7 - t / 0.75))
    if (shock.current) shock.current.lookAt(state.camera.position)
    if (light.current) {
      light.current.position.set(ox, oy, oz)
      light.current.intensity = Math.max(0, 1 - t / 0.9) * 120
    }

    smoke.current.forEach((m, i) => {
      if (!m) return
      const d = smokeDirs[i]
      const e = 1 - Math.exp(-1.4 * t)
      m.position.set(ox + d.x * e * 2.2, oy + d.y * e * 2.2 + t * 0.6, oz + d.z * e * 2.2)
      m.scale.setScalar(0.5 + e * (1.5 + (i % 4) * 0.35))
      ;(m.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.6 * (1 - t / 4.6))
    })
  })

  const piece = (el: THREE.Object3D | null, i: number) => {
    pieces.current[i] = el
  }

  return (
    <group ref={root} visible={false}>
      {FRAGMENTS.map((spec, i) => {
        if (spec.kind === 'nose')
          return (
            <group key={i} ref={(el) => piece(el, i)}>
              <mesh geometry={geos.nose} castShadow position={[0, -1.1, 0]}>
                <meshStandardMaterial color={bodyColors.upper} metalness={bodyColors.metalness} roughness={bodyColors.roughness} />
              </mesh>
              <mesh geometry={geos.tip} position={[0, -1.1, 0]}>
                <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.12} />
              </mesh>
            </group>
          )
        if (spec.kind === 'shell-upper' || spec.kind === 'shell-lower') {
          const upper = spec.kind === 'shell-upper'
          return (
            <mesh key={i} ref={(el) => piece(el, i)} castShadow>
              <cylinderGeometry args={[0.52, 0.52, upper ? 3 : 3.9, 20, 1, true, spec.index * Math.PI, Math.PI * 0.92]} />
              <meshStandardMaterial
                color={upper ? bodyColors.upper : bodyColors.lower}
                metalness={bodyColors.metalness}
                roughness={bodyColors.roughness}
                side={THREE.DoubleSide}
              />
            </mesh>
          )
        }
        if (spec.kind === 'fin')
          return (
            <mesh key={i} ref={(el) => piece(el, i)} geometry={geos.fin} castShadow>
              <meshStandardMaterial color={bodyColors.fin} metalness={0.45} roughness={0.28} />
            </mesh>
          )
        if (spec.kind === 'motor')
          return (
            <group key={i} ref={(el) => piece(el, i)}>
              <mesh geometry={geos.boatTail} position={[0, 0.2, 0]} castShadow>
                <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.28} />
              </mesh>
              <mesh geometry={geos.nozzle} position={[0, -0.45, 0]}>
                <meshStandardMaterial color="#18181b" metalness={0.6} roughness={0.35} side={THREE.DoubleSide} />
              </mesh>
              <group ref={motorFlame} position={[0, -0.5, 0]}>
                <mesh position={[0, -0.9, 0]} rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[0.32, 1.8, 14]} />
                  <meshBasicMaterial color="#fde68a" />
                </mesh>
                <mesh position={[0, -1.6, 0]} rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[0.55, 3.2, 14]} />
                  <meshBasicMaterial color="#f97316" transparent opacity={0.8} />
                </mesh>
              </group>
            </group>
          )
        if (spec.kind === 'bay')
          return (
            <mesh key={i} ref={(el) => piece(el, i)} castShadow>
              <cylinderGeometry args={[0.36, 0.36, 0.55, 14]} />
              <meshStandardMaterial color={bayColors[spec.index] ?? '#94a3b8'} roughness={0.5} />
            </mesh>
          )
        const s = 0.18 + (spec.index % 4) * 0.08
        return (
          <mesh key={i} ref={(el) => piece(el, i)}>
            <boxGeometry args={[s * 1.6, s, 0.03]} />
            <meshStandardMaterial
              color={spec.index % 3 === 0 ? bodyColors.lower : bodyColors.upper}
              metalness={bodyColors.metalness}
              roughness={bodyColors.roughness}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}

      <mesh ref={flash}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshBasicMaterial color="#fffbeb" transparent depthWrite={false} />
      </mesh>
      <mesh ref={fireball}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#fb923c" transparent depthWrite={false} />
      </mesh>
      <mesh ref={shock}>
        <ringGeometry args={[0.85, 1, 48]} />
        <meshBasicMaterial color="#ffffff" transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight ref={light} color="#fb923c" intensity={0} distance={90} decay={1.2} />
      {Array.from({ length: SMOKE_BALLS }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            smoke.current[i] = el
          }}
        >
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#57534e' : '#a8a29e'} transparent depthWrite={false} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}
