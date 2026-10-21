import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { RocketRun } from '../sim/engine'
import type { RocketLook } from './look'
import type { DroneLink } from './droneLink'
import { DroneRig } from './DroneView'
import { BreakupDebris, SmokeTrail } from './RocketFx'
import { makeEmitters } from './smokeEmitters'
import { ALT_SCALE, DIST_SCALE, PAD_X, PAD_Y } from './sceneScale'
import { WorldErrorBoundary } from '../../../shell/WorldErrorBoundary'

/** Speed of sound at the launch site in ft/s, for the vapor cone. */
const MACH1_FPS = 1115
const HEAT_GLOW = new THREE.Color('#ff4d1a')
const GHOST = '#9aa59c'

interface DebrisPieceSpec {
  v: [number, number, number]
  r: [number, number]
  scale: [number, number, number]
  part: 'body' | 'nose' | 'fins' | 'dark'
}

/** Pieces that scatter when the rocket hits the ground far too fast. */
const SMASH_PIECES: DebrisPieceSpec[] = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.4
  const speed = 5 + (i % 7) * 2.2
  return {
    v: [Math.cos(a) * speed, 7 + (i % 5) * 3.5, Math.sin(a) * speed],
    r: [((i % 4) + 1) * 4, ((i % 5) + 1) * 5],
    scale: i % 3 === 0 ? [1.1, 0.25, 0.8] : i % 3 === 1 ? [0.5, 0.5, 0.5] : [0.3, 1.3, 0.3],
    part: (['body', 'nose', 'fins', 'dark'] as const)[i % 4],
  }
})

/** A thin cylinder from a to b (shroud lines). */
function lineBetween(a: THREE.Vector3, b: THREE.Vector3) {
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const dir = b.clone().sub(a)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  return { pos: mid, quat: q, len: dir.length() }
}

/** While a drone is flying, it owns the camera (see DroneView). */
export interface DroneCamera {
  linkRef: { current: DroneLink }
  active: boolean
}

export function RocketScene({ look, run, drone }: { look: RocketLook; run: RocketRun | null; drone?: DroneCamera }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#7fa7c6] via-[#b9cfd9] to-[#e8dcc3]">
      <WorldErrorBoundary>
        <Canvas shadows camera={{ position: [10, 9, 18], fov: 42, near: 0.5, far: 2400 }}>
          <Sky />
          <SceneContents look={look} run={run} droneFlying={!!drone?.active} />
          {drone && run && <DroneRig linkRef={drone.linkRef} run={run} active={drone.active} />}
        </Canvas>
      </WorldErrorBoundary>
    </div>
  )
}

/**
 * The sky as part of the 3D scene (not just the page behind it), so drone recordings capture it.
 * Same colors as the page gradient: sand at the horizon to blue overhead.
 */
function Sky() {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(2000, 32, 16)
    const pos = g.getAttribute('position')
    const colors: number[] = []
    const low = new THREE.Color('#e8dcc3')
    const mid = new THREE.Color('#b9cfd9')
    const high = new THREE.Color('#7fa7c6')
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i) / 2000
      if (h < 0.15) c.copy(low).lerp(mid, Math.max(0, h) / 0.15)
      else c.copy(mid).lerp(high, Math.min(1, (h - 0.15) / 0.6))
      colors.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return g
  }, [])
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  )
}

function SceneContents({ look, run, droneFlying }: { look: RocketLook; run: RocketRun | null; droneFlying: boolean }) {
  const bodyColor = look.body?.color ?? GHOST
  const finColor = look.fins?.color ?? GHOST
  const noseColor = look.nose?.color ?? GHOST

  const { ogiveGeo, bluntGeo, boatTailGeo, nozzleBellGeo, finGeo } = useMemo(() => {
    const R = 0.52
    const L = 2.6
    const ogivePts: THREE.Vector2[] = []
    for (let i = 0; i <= 28; i++) {
      const t = i / 28
      ogivePts.push(new THREE.Vector2(R * Math.pow(1 - t, 0.62), t * L))
    }
    const bluntPts: THREE.Vector2[] = []
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * (Math.PI / 2)
      bluntPts.push(new THREE.Vector2(R * Math.cos(a), R * 1.1 * Math.sin(a)))
    }
    const boatTailGeo = new THREE.LatheGeometry([new THREE.Vector2(0.36, 0), new THREE.Vector2(0.45, 0.35), new THREE.Vector2(R, 0.75)], 32)
    const nozzleBellGeo = new THREE.LatheGeometry(
      [new THREE.Vector2(0.34, 0), new THREE.Vector2(0.31, 0.25), new THREE.Vector2(0.24, 0.5), new THREE.Vector2(0.18, 0.7)],
      28,
    )
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.lineTo(0, 1.85)
    shape.lineTo(0.22, 1.35)
    shape.lineTo(0.92, 0.32)
    shape.lineTo(0.92, -0.22)
    shape.lineTo(0, -0.05)
    shape.closePath()
    const finGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.02, bevelSegments: 2 })
    finGeo.center()
    return {
      ogiveGeo: new THREE.LatheGeometry(ogivePts, 32),
      bluntGeo: new THREE.LatheGeometry(bluntPts, 32),
      boatTailGeo,
      nozzleBellGeo,
      finGeo,
    }
  }, [])

  const shroud = useMemo(() => {
    const tip = new THREE.Vector3(0, -5.2, 0)
    return [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2
      return lineBetween(new THREE.Vector3(Math.cos(a) * 2.2, 0.4, Math.sin(a) * 2.2), tip)
    })
  }, [])

  const rocketGroup = useRef<THREE.Group>(null)
  const shakeGroup = useRef<THREE.Group>(null)
  const flameGroup = useRef<THREE.Group>(null)
  const flameLight = useRef<THREE.PointLight>(null)
  const vaporCone = useRef<THREE.Mesh>(null)
  const chuteGroup = useRef<THREE.Group>(null)
  const smashGroup = useRef<THREE.Group>(null)
  const finRefs = useRef<(THREE.Mesh | null)[]>([])
  const glowMats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const emitters = useRef(makeEmitters())
  const nozzleLocal = useMemo(() => new THREE.Vector3(0, -5.6, 0), [])
  const camOffset = useRef(new THREE.Vector3(9, 3, 18))
  const lookTmp = useMemo(() => new THREE.Vector3(), [])

  const clouds = useMemo(
    () =>
      [
        [-60, 60, -90, 8],
        [70, 95, -110, 10],
        [-30, 140, -80, 9],
        [40, 190, -95, 11],
        [-80, 230, -120, 12],
      ] as [number, number, number, number][],
    [],
  )

  useFrame((state, dt) => {
    const cam = state.camera
    const t = state.clock.elapsedTime
    const rg = rocketGroup.current
    const f = run?.frame

    if (!run || !f) {
      if (rg) {
        rg.visible = true
        rg.position.set(PAD_X, PAD_Y, 0)
        rg.rotation.set(0, t * 0.3, 0)
      }
      if (flameGroup.current) flameGroup.current.visible = false
      if (vaporCone.current) vaporCone.current.visible = false
      if (chuteGroup.current) chuteGroup.current.visible = false
      if (smashGroup.current) smashGroup.current.visible = false
      glowMats.current.forEach((m) => m?.emissive.setRGB(0, 0, 0))
      emitters.current.nozzle.active = false
      cam.position.lerp(new THREE.Vector3(PAD_X + 9, 8.5, 17), Math.min(1, dt * 3))
      cam.lookAt(PAD_X, PAD_Y + 0.6, 0)
      return
    }

    const rx = PAD_X + f.rocketPos[0] * DIST_SCALE
    const ry = Math.max(PAD_Y, f.rocketPos[1] * ALT_SCALE + PAD_Y)
    const rz = f.rocketPos[2] * DIST_SCALE
    const smashed = f.splatterProgress > 0

    if (rg) {
      rg.visible = !f.rocketShredded && !smashed
      // Lying on its side after landing.
      rg.position.set(rx, f.phase === 'landed' ? 0.6 : ry, rz)
      rg.rotation.set(f.rocketRot[0], f.rocketRot[1], -f.rocketRot[2])
    }

    // Near its safe speed the airframe glows, the rocket buzzes and the fins flutter.
    const strain = THREE.MathUtils.clamp((f.structuralStress - 0.86) / 0.14, 0, 1)
    if (shakeGroup.current) {
      const amp = strain * strain * 0.09
      shakeGroup.current.position.set(Math.sin(t * 83) * amp, 0, Math.cos(t * 71) * amp)
    }
    glowMats.current.forEach((m) => {
      if (!m) return
      m.emissive.copy(HEAT_GLOW)
      m.emissiveIntensity = strain * strain * 0.6
    })
    finRefs.current.forEach((fin, i) => {
      if (!fin) return
      const flutter = strain * 0.2
      fin.rotation.set(Math.sin(t * 64 + i) * flutter, 0, Math.cos(t * 51 + i) * flutter * 0.4)
    })

    const thrusting = f.rocketThrusting && !f.rocketShredded
    if (flameGroup.current) {
      flameGroup.current.visible = thrusting
      const flicker = 0.9 + Math.sin(t * 55) * 0.18
      flameGroup.current.scale.set(flicker, 1.1 + Math.cos(t * 42) * 0.25, flicker)
    }
    if (flameLight.current) flameLight.current.intensity = thrusting ? 30 + Math.sin(t * 37) * 6 : 0
    if (vaporCone.current) {
      const mach = f.hudSpeedFps / MACH1_FPS
      const vapor = f.rocketShredded ? 0 : Math.max(0, 1 - Math.abs(mach - 1) / 0.08)
      vaporCone.current.visible = vapor > 0.02
      ;(vaporCone.current.material as THREE.MeshBasicMaterial).opacity = vapor * 0.85
    }
    if (rg) {
      rg.updateMatrixWorld()
      emitters.current.nozzle.active = thrusting
      emitters.current.nozzle.size = f.hudAltitudeFt < 60 ? 2.4 : 1.0
      emitters.current.nozzle.pos.copy(nozzleLocal)
      rg.localToWorld(emitters.current.nozzle.pos)
    }

    // Parachute: opens above the rocket and carries it down; a torn one flaps as a small rag.
    if (chuteGroup.current) {
      const cg = chuteGroup.current
      const open = f.chute
      const torn = open < 0
      cg.visible = !!look.chute && (open > 0 || (torn && f.phase === 'descent')) && f.phase !== 'landed' && !smashed
      const size = (look.chute?.scale ?? 1) * (torn ? 0.35 : 0.25 + 0.75 * open)
      cg.scale.set(size, torn ? 0.5 : size, size)
      cg.position.set(rx, ry + 5.2 * (torn ? 0.6 : 1), rz)
      cg.rotation.set(Math.sin(t * 2.4) * (torn ? 0.5 : 0.08), torn ? t * 4 : t * 0.3, Math.cos(t * 2) * (torn ? 0.5 : 0.06))
    }

    if (smashGroup.current) {
      smashGroup.current.visible = smashed
      if (smashed) {
        const sp = f.splatterProgress
        smashGroup.current.position.set(rx, 0.4, rz)
        smashGroup.current.children.forEach((child, i) => {
          const spec = SMASH_PIECES[i]
          if (!spec) return
          const y = spec.v[1] * sp - 16 * sp * sp
          child.position.set(spec.v[0] * sp, Math.max(0.15, y < 0 ? Math.abs(y) * 0.4 : y), spec.v[2] * sp)
          child.rotation.set(spec.r[0] * sp * 3, spec.r[1] * sp * 3, sp * 5)
        })
      }
    }

    // Chase camera: below and behind on the way up, wider while it drifts down, low at touchdown.
    if (droneFlying) return
    const desired =
      f.phase === 'pad'
        ? new THREE.Vector3(9, 2.2, 18)
        : f.rocketShredded
          ? new THREE.Vector3(5, 4, 34)
          : f.phase === 'ascent'
            ? new THREE.Vector3(4, -4, 24)
            : f.phase === 'descent'
              ? new THREE.Vector3(7, 1, 26)
              : new THREE.Vector3(8, 4, 16)
    camOffset.current.lerp(desired, Math.min(1, dt * (f.rocketShredded ? 2.2 : 3)))
    const jolt = f.rocketShredded ? Math.max(0, 1 - f.breakupSeconds / 0.7) * 0.9 : strain * strain * 0.12
    const camY = f.phase === 'landed' ? 4 : Math.max(2.5, ry + camOffset.current.y)
    cam.position.set(rx + camOffset.current.x + Math.sin(t * 61) * jolt, camY + Math.cos(t * 53) * jolt, rz + camOffset.current.z)
    lookTmp.set(rx, f.phase === 'landed' ? 1 : f.phase === 'descent' ? ry + 2 : ry - 1.5, rz)
    cam.lookAt(lookTmp)
  })

  const bodyMat = (i: number, color: string) => (
    <meshStandardMaterial
      ref={(m) => {
        glowMats.current[i] = m
      }}
      color={color}
      metalness={look.body?.metalness ?? 0}
      roughness={look.body?.roughness ?? 0.6}
      transparent={!look.body}
      opacity={look.body ? 1 : 0.28}
    />
  )

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight castShadow position={[35, 85, 45]} intensity={1.5} shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-30, 25, -20]} intensity={0.4} color="#fff1dd" />

      {/* Desert launch field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1600, 1600]} />
        <meshStandardMaterial color="#d8c3a5" roughness={0.94} />
      </mesh>
      <group position={[0, 0, -160]}>
        {[
          [-110, 18, 0, 26, 40, 36, 7, '#b58969'],
          [30, 24, -30, 36, 56, 48, 8, '#a47556'],
          [150, 16, 10, 22, 34, 32, 6, '#c09676'],
        ].map(([x, y, z, rt, rb, h, seg, c], i) => (
          <mesh key={i} position={[x as number, y as number, z as number]}>
            <cylinderGeometry args={[rt as number, rb as number, h as number, seg as number]} />
            <meshStandardMaterial color={c as string} roughness={0.9} />
          </mesh>
        ))}
      </group>
      {clouds.map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]} scale={s}>
          {[
            [0, 0, 0, 1.2],
            [1.1, -0.15, 0.2, 0.9],
            [-1, -0.2, -0.1, 0.85],
          ].map(([cx, cy, cz, r], j) => (
            <mesh key={j} position={[cx, cy, cz]}>
              <sphereGeometry args={[r, 12, 12]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.8} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Launch pad and rail */}
      <group position={[PAD_X, 0, 0]}>
        <mesh position={[0, 0.25, 0]} receiveShadow>
          <cylinderGeometry args={[4.5, 5, 0.5, 8]} />
          <meshStandardMaterial color="#8a8f88" roughness={0.85} />
        </mesh>
        <mesh position={[-0.62, 7.4, 0]} castShadow>
          <boxGeometry args={[0.14, 14, 0.14]} />
          <meshStandardMaterial color="#2a2f2b" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[-1.4, 0.9, 0]}>
          <boxGeometry args={[1.6, 0.9, 1.4]} />
          <meshStandardMaterial color="#d9a52b" roughness={0.6} />
        </mesh>
      </group>

      {/* The rocket, built from whatever is on the blueprint. Missing parts show as ghosts. */}
      <group ref={rocketGroup} position={[PAD_X, PAD_Y, 0]}>
        <group ref={shakeGroup}>
          <group position={[0, 3.4, 0]}>
            <mesh geometry={look.nose?.blunt ? bluntGeo : ogiveGeo} castShadow>
              <meshStandardMaterial
                ref={(m) => {
                  glowMats.current[0] = m
                }}
                color={noseColor}
                roughness={0.35}
                transparent={!look.nose}
                opacity={look.nose ? 1 : 0.28}
              />
            </mesh>
          </group>
          <mesh castShadow position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.52, 0.52, 7, 32]} />
            {bodyMat(1, bodyColor)}
          </mesh>
          {look.body && (
            <mesh position={[0, 2.2, 0]}>
              <cylinderGeometry args={[0.528, 0.528, 0.3, 32]} />
              <meshStandardMaterial color="#2c5b3c" roughness={0.4} />
            </mesh>
          )}
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[0, (i * Math.PI * 2) / 3 + (look.fins?.warped && i === 1 ? 0.06 : 0), 0]}>
              <mesh
                ref={(m) => {
                  finRefs.current[i] = m
                }}
                geometry={finGeo}
                position={[0.92, -2.75, 0]}
                rotation={[0, 0, look.fins?.warped && i === 1 ? 0.07 : 0]}
                castShadow
              >
                <meshStandardMaterial color={finColor} roughness={0.5} transparent={!look.fins} opacity={look.fins ? 1 : 0.28} />
              </mesh>
            </group>
          ))}
          <mesh geometry={boatTailGeo} position={[0, -4.35, 0]} castShadow>
            <meshStandardMaterial color={look.motor ? '#3b3f3c' : GHOST} metalness={0.7} roughness={0.3} transparent={!look.motor} opacity={look.motor ? 1 : 0.28} />
          </mesh>
          <mesh geometry={nozzleBellGeo} position={[0, -5.0, 0]}>
            <meshStandardMaterial color={look.motor ? '#18181b' : GHOST} metalness={0.6} roughness={0.35} side={THREE.DoubleSide} transparent={!look.motor} opacity={look.motor ? 1 : 0.28} />
          </mesh>

          <group ref={flameGroup} position={[0, -5.0, 0]} visible={false}>
            <mesh position={[0, -1.2, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.24, 2.4, 16]} />
              <meshBasicMaterial color="#fffbeb" />
            </mesh>
            <mesh position={[0, -1.6, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.38, 3.2, 16]} />
              <meshBasicMaterial color="#fde047" transparent opacity={0.9} depthWrite={false} />
            </mesh>
            <mesh position={[0, -2.6, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.66, 5.2, 18]} />
              <meshBasicMaterial color="#f97316" transparent opacity={0.7} depthWrite={false} />
            </mesh>
            <pointLight ref={flameLight} position={[0, -1.5, 0]} color="#fb923c" intensity={0} distance={40} decay={1.2} />
          </group>

          <mesh ref={vaporCone} position={[0, 0.2, 0]} visible={false}>
            <cylinderGeometry args={[0.56, 1.7, 2.6, 32, 1, true]} />
            <meshBasicMaterial color="#f8fafc" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>

      {/* Parachute canopy and shroud lines (world space, above the hanging rocket) */}
      <group ref={chuteGroup} visible={false}>
        <mesh castShadow>
          <sphereGeometry args={[2.5, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color={look.chute?.color ?? '#e0662a'} side={THREE.DoubleSide} roughness={0.55} />
        </mesh>
        {shroud.map((s, i) => (
          <mesh key={i} position={s.pos} quaternion={s.quat}>
            <cylinderGeometry args={[0.02, 0.02, s.len, 5]} />
            <meshBasicMaterial color="#f4f1ea" />
          </mesh>
        ))}
      </group>

      <group ref={smashGroup} visible={false}>
        {SMASH_PIECES.map((p, i) => (
          <mesh key={i} scale={p.scale} castShadow>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial
              color={p.part === 'body' ? bodyColor : p.part === 'nose' ? noseColor : p.part === 'fins' ? finColor : '#2a2f2b'}
              roughness={0.6}
            />
          </mesh>
        ))}
      </group>

      <SmokeTrail run={run} emitters={emitters} />
      <BreakupDebris
        run={run}
        geos={{ nose: ogiveGeo, tip: ogiveGeo, boatTail: boatTailGeo, nozzle: nozzleBellGeo, fin: finGeo }}
        bodyColors={{ upper: bodyColor, lower: bodyColor, fin: finColor, metalness: look.body?.metalness ?? 0, roughness: look.body?.roughness ?? 0.6 }}
        bayColors={['#3f8f52', look.chute?.color ?? '#e0662a', '#d99a1e', '#7c4dbd', '#2a2f2b', '#c23b22']}
        onMotorSmoke={(pos, burning) => {
          emitters.current.motor.active = burning
          emitters.current.motor.pos.copy(pos)
        }}
      />
    </>
  )
}
