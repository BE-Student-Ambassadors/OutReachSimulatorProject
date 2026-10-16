import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  AIRFRAME_MATERIALS,
  getAirframe,
  getGyroConfig,
  getLaunchSetup,
  getPayloadMotor,
  getPayloadTestRig,
} from '../config'
import type { RocketRun } from '../sim/engine'
import type { AirframeMaterialId, RocketObject } from '../types'

export type CameraFocusMode = 'overview' | 'payload-closeup' | 'rocket-closeup'

const MATERIAL_STYLES: Record<
  AirframeMaterialId,
  {
    upperColor: string
    lowerColor: string
    bandColor: string
    finColor: string
    metalness: number
    roughness: number
  }
> = {
  cardboard: {
    upperColor: '#caa472',
    lowerColor: '#b58d5a',
    bandColor: '#94a3b8', // duct tape silver seams
    finColor: '#9c7444',
    metalness: 0.05,
    roughness: 0.88,
  },
  aluminum: {
    upperColor: '#e2e8f0',
    lowerColor: '#cbd5e1',
    bandColor: '#1e3a8a',
    finColor: '#b8461b',
    metalness: 0.78,
    roughness: 0.22,
  },
  fiberglass: {
    upperColor: '#f8fafc',
    lowerColor: '#1e293b',
    bandColor: '#b8461b',
    finColor: '#b8461b',
    metalness: 0.22,
    roughness: 0.28,
  },
  carbon: {
    upperColor: '#18181b',
    lowerColor: '#09090b',
    bandColor: '#f59e0b',
    finColor: '#27272a',
    metalness: 0.45,
    roughness: 0.2,
  },
  steel: {
    upperColor: '#64748b',
    lowerColor: '#475569',
    bandColor: '#eab308',
    finColor: '#334155',
    metalness: 0.82,
    roughness: 0.38,
  },
}

interface DebrisPieceSpec {
  vx: number
  vy: number
  vz: number
  rx: number
  ry: number
  scale: [number, number, number]
  color: string
  shape: 'box' | 'cyl' | 'sphere'
}

const DEBRIS_COLORS = ['#dc2626', '#f59e0b', '#0284c7', '#7c3aed', '#16a34a', '#e2e8f0', '#fb7185', '#fbbf24']

const DEBRIS_PIECES: DebrisPieceSpec[] = Array.from({ length: 32 }, (_, i) => {
  const angle = (i / 32) * Math.PI * 2 + (i % 3) * 0.4
  const speed = 6 + (i % 7) * 2.8
  return {
    vx: Math.cos(angle) * speed,
    vy: 8 + (i % 5) * 4.5,
    vz: Math.sin(angle) * speed,
    rx: ((i % 4) + 1) * 4,
    ry: ((i % 5) + 1) * 5,
    scale:
      i % 3 === 0
        ? [1.1, 0.25, 0.8]
        : i % 3 === 1
          ? [0.55, 0.55, 0.55]
          : [0.35, 1.3, 0.35],
    color: DEBRIS_COLORS[i % DEBRIS_COLORS.length],
    shape: i % 3 === 0 ? 'box' : i % 3 === 1 ? 'sphere' : 'cyl',
  }
})

const ALT_SCALE = 1 / 38
const DIST_SCALE = 1 / 4.5
const PAD_X = -28

export function RocketScene({
  design,
  run,
  showOverlay,
  focusMode = 'overview',
}: {
  design: RocketObject[]
  run: RocketRun | null
  showOverlay: boolean
  focusMode?: CameraFocusMode
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#0b192c] via-[#2b5876] to-[#e4d5be]">
      <Canvas shadows camera={{ position: [0, 20, 56], fov: 40, near: 0.5, far: 1400 }}>
        <SceneContents design={design} run={run} showOverlay={showOverlay} focusMode={focusMode} />
      </Canvas>
    </div>
  )
}

function SceneContents({
  design,
  run,
  showOverlay,
  focusMode,
}: {
  design: RocketObject[]
  run: RocketRun | null
  showOverlay: boolean
  focusMode: CameraFocusMode
}) {
  const airframe = getAirframe(design)
  const launch = getLaunchSetup(design)
  const motor = getPayloadMotor(design)
  const gyro = getGyroConfig(design)
  const testRig = getPayloadTestRig(design)

  const matStyle = MATERIAL_STYLES[airframe.materialId] ?? MATERIAL_STYLES.fiberglass
  const railTiltRad = ((90 - launch.railAngleDeg) * Math.PI) / 180
  const avgGyro = (gyro.rollScore + gyro.pitchScore + gyro.yawScore) / 3

  // ---- True Aerospace Geometries (Ogive Nose Cone, Boat-Tail, Bell Nozzle, Swept Airfoil Fins) ----
  const { ogiveNoseGeo, tipCapGeo, boatTailGeo, nozzleBellGeo, sweptFinGeo, deltaFinGeo } = useMemo(() => {
    const R = 0.52 // sleek airframe radius
    const L = 2.65 // long high-fineness nose cone

    // Tangent ogive profile points for LatheGeometry
    const ogivePts: THREE.Vector2[] = []
    const steps = 28
    for (let i = 0; i <= steps; i++) {
      const t = i / steps // 0 at base, 1 at tip
      const y = t * L * 0.86
      // Smooth Von Karman / Haack-like taper
      const r = R * Math.pow(1 - t * 0.86, 0.62)
      ogivePts.push(new THREE.Vector2(r, y))
    }
    const ogiveNoseGeo = new THREE.LatheGeometry(ogivePts, 32)

    // Metallic stainless nose tip cap (top 14% of nose cone)
    const tipPts: THREE.Vector2[] = []
    for (let i = 0; i <= 10; i++) {
      const t = 0.86 + (i / 10) * 0.14
      const y = t * L
      const r = i === 10 ? 0.0 : R * Math.pow(1 - t, 0.62)
      tipPts.push(new THREE.Vector2(r, y))
    }
    const tipCapGeo = new THREE.LatheGeometry(tipPts, 24)

    // Tapered aft boat-tail fairing
    const boatPts = [
      new THREE.Vector2(0.36, 0),
      new THREE.Vector2(0.45, 0.35),
      new THREE.Vector2(R, 0.75),
    ]
    const boatTailGeo = new THREE.LatheGeometry(boatPts, 32)

    // Contoured De Laval Rocket Bell Nozzle
    const bellPts = [
      new THREE.Vector2(0.34, 0),
      new THREE.Vector2(0.31, 0.25),
      new THREE.Vector2(0.24, 0.5),
      new THREE.Vector2(0.18, 0.7),
    ]
    const nozzleBellGeo = new THREE.LatheGeometry(bellPts, 28)

    // Swept Trapezoidal Airfoil Fin (ExtrudeGeometry)
    const trapShape = new THREE.Shape()
    trapShape.moveTo(0, 0) // root bottom
    trapShape.lineTo(0, 1.85) // root top (strake)
    trapShape.lineTo(0.22, 1.35) // strake step
    trapShape.lineTo(0.92, 0.32) // swept leading edge to tip
    trapShape.lineTo(0.92, -0.22) // tip chord
    trapShape.lineTo(0, -0.05) // trailing edge back to root
    trapShape.closePath()

    const extrudeOpts: THREE.ExtrudeGeometryOptions = {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.02,
      bevelSegments: 2,
    }
    const sweptFinGeo = new THREE.ExtrudeGeometry(trapShape, extrudeOpts)
    sweptFinGeo.center()

    // High-Sweep Clipped-Delta Supersonic Fin
    const deltaShape = new THREE.Shape()
    deltaShape.moveTo(0, 0)
    deltaShape.lineTo(0, 2.15)
    deltaShape.lineTo(1.08, 0.15)
    deltaShape.lineTo(1.08, -0.28)
    deltaShape.lineTo(0, -0.1)
    deltaShape.closePath()
    const deltaFinGeo = new THREE.ExtrudeGeometry(deltaShape, extrudeOpts)
    deltaFinGeo.center()

    return { ogiveNoseGeo, tipCapGeo, boatTailGeo, nozzleBellGeo, sweptFinGeo, deltaFinGeo }
  }, [])

  const rocketGroup = useRef<THREE.Group>(null)
  const flameGroup = useRef<THREE.Group>(null)
  const shredGroup = useRef<THREE.Group>(null)

  const payloadGroup = useRef<THREE.Group>(null)
  const payloadBody = useRef<THREE.Group>(null)
  const flywheelRef = useRef<THREE.Mesh>(null)
  const chuteGroup = useRef<THREE.Group>(null)
  const splatterGroup = useRef<THREE.Group>(null)
  const spinRing = useRef<THREE.Mesh>(null)
  const dropTrackerGroup = useRef<THREE.Group>(null)
  const dropBeamRef = useRef<THREE.Mesh>(null)
  const groundReticleRef = useRef<THREE.Group>(null)

  // Relative camera offset & look offset so camera locks onto moving rocket/payload with zero lag
  const camOffsetRef = useRef(new THREE.Vector3(0, 4.5, 11.5))
  const lookOffsetRef = useRef(new THREE.Vector3(0, 0, 0))
  const wasRunningRef = useRef(false)

  const clouds = useMemo(
    () => [
      { pos: [-25, 35, -30] as [number, number, number], s: 6 },
      { pos: [28, 55, -24] as [number, number, number], s: 7.5 },
      { pos: [-10, 82, -35] as [number, number, number], s: 8 },
      { pos: [18, 115, -28] as [number, number, number], s: 7 },
      { pos: [-22, 150, -32] as [number, number, number], s: 9 },
      { pos: [12, 195, -30] as [number, number, number], s: 8.5 },
    ],
    [],
  )

  // Altitude gate rings every 1,000 ft along the payload drop corridor so you feel the speed of freefall
  const altitudeGates = useMemo(
    () =>
      [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000].map((altFt) => ({
        altFt,
        y: altFt * ALT_SCALE + 1.1,
        isDeployZone: altFt >= 1000 && altFt <= 3000,
      })),
    [],
  )

  useFrame((state, dt) => {
    const cam = state.camera
    const t = state.clock.elapsedTime

    // Spin the internal reaction flywheel inside the payload capsule
    if (flywheelRef.current) {
      const wheelSpeed = motor.motorId === 'heavy-iron' ? 16 : motor.motorId === 'micro-gimbal' ? 2 : 9
      flywheelRef.current.rotation.y = t * wheelSpeed
    }

    if (!run) {
      wasRunningRef.current = false
      // Position rocket on the launch tower & payload on the display stand
      if (rocketGroup.current) {
        rocketGroup.current.visible = true
        rocketGroup.current.position.set(PAD_X, 6.6, 0)
        rocketGroup.current.rotation.set(0, t * 0.25, -railTiltRad)
      }
      if (flameGroup.current) flameGroup.current.visible = false
      if (shredGroup.current) shredGroup.current.visible = false

      if (payloadGroup.current) {
        payloadGroup.current.visible = true
        payloadGroup.current.position.set(0, 2.2, 0)
        // Wobble if gyro is uncalibrated, spin smoothly if calibrated!
        const wobble = avgGyro < 75 ? Math.sin(t * 5.5) * 0.22 : 0
        payloadGroup.current.rotation.set(wobble, t * 0.5, wobble * 0.7)
      }
      if (payloadBody.current) {
        payloadBody.current.visible = true
        payloadBody.current.rotation.set(0, 0, 0)
      }
      if (chuteGroup.current) chuteGroup.current.visible = false
      if (splatterGroup.current) splatterGroup.current.visible = false
      if (spinRing.current) spinRing.current.visible = false
      if (dropTrackerGroup.current) dropTrackerGroup.current.visible = false

      // Smoothly move camera to match the current step's focus!
      let desiredPos: THREE.Vector3
      let lookTarget: THREE.Vector3
      if (focusMode === 'rocket-closeup') {
        desiredPos = new THREE.Vector3(PAD_X + 3.5, 7.2, 14.5)
        lookTarget = new THREE.Vector3(PAD_X - 1.5, 6.8, 0)
      } else if (focusMode === 'payload-closeup') {
        desiredPos = new THREE.Vector3(1.8, 3.2, 8.2)
        lookTarget = new THREE.Vector3(-0.6, 2.2, 0)
      } else {
        desiredPos = new THREE.Vector3(-10, 15, 48)
        lookTarget = new THREE.Vector3(-12, 6.5, 0)
      }
      cam.position.lerp(desiredPos, Math.min(1, dt * 4.5))
      cam.lookAt(lookTarget)
      return
    }

    const f = run.frame
    const isPayloadPhase =
      f.phase === 'payload-freefall' || f.phase === 'payload-chute' || f.phase === 'impact'

    // Snap camera offset cleanly when a run starts
    if (!wasRunningRef.current) {
      wasRunningRef.current = true
      if (isPayloadPhase) {
        camOffsetRef.current.set(0, 4.6, 10.5)
        lookOffsetRef.current.set(0, -0.2, 0)
      } else {
        camOffsetRef.current.set(2.5, 2.5, 18.5)
        lookOffsetRef.current.set(0, 0.5, 0)
      }
    }

    // ---- Update Rocket Mesh ----
    const rx = PAD_X + f.rocketPos[0] * DIST_SCALE
    const ry = Math.max(6.2, f.rocketPos[1] * ALT_SCALE + 6.2)
    const rz = f.rocketPos[2] * DIST_SCALE

    if (rocketGroup.current) {
      rocketGroup.current.visible = !isPayloadPhase || run.result().mode === 'full'
      rocketGroup.current.position.set(rx, ry, rz)
      rocketGroup.current.rotation.set(f.rocketRot[0], f.rocketRot[1], -f.rocketRot[2])
    }

    if (flameGroup.current) {
      flameGroup.current.visible = f.rocketThrusting && !isPayloadPhase
      const flicker = 0.9 + Math.sin(t * 55) * 0.22
      flameGroup.current.scale.set(flicker, 1 + Math.cos(t * 42) * 0.28, flicker)
    }

    if (shredGroup.current && rocketGroup.current) {
      shredGroup.current.visible = f.rocketShredded
      if (f.rocketShredded) {
        shredGroup.current.position.copy(rocketGroup.current.position)
        shredGroup.current.rotation.set(t * 3, t * 2, t)
      }
    }

    // ---- Update Payload, Parachute & Comedic Splatter ----
    const px = f.payloadPos[0] * DIST_SCALE
    const py = Math.max(1.1, f.payloadPos[1] * ALT_SCALE + 1.1)
    const pz = f.payloadPos[2] * DIST_SCALE

    if (payloadGroup.current) {
      payloadGroup.current.visible = isPayloadPhase
      payloadGroup.current.position.set(px, py, pz)
      payloadGroup.current.rotation.set(0, 0, 0)
    }

    const isSplattered = f.phase === 'impact' && f.splatterProgress > 0
    if (payloadBody.current) {
      payloadBody.current.visible = !isSplattered
      payloadBody.current.rotation.set(f.payloadRot[0], f.payloadRot[1], f.payloadRot[2])
    }

    if (chuteGroup.current) {
      chuteGroup.current.visible = isPayloadPhase && f.chuteOpen && !isSplattered
      const chuteScale =
        testRig.chuteSize === 'tandem-large' ? 1.35 : testRig.chuteSize === 'drogue-small' ? 0.65 : 1.0
      chuteGroup.current.scale.setScalar(chuteScale)
      chuteGroup.current.rotation.z = Math.sin(t * 3) * 0.08
    }

    if (spinRing.current) {
      const spinningWild = isPayloadPhase && f.payloadSpinRate > 5 && !isSplattered
      spinRing.current.visible = spinningWild
      if (spinningWild) {
        spinRing.current.rotation.set(t * 9, t * 11, 0)
      }
    }

    // Update Vertical Drop Telemetry Beam & Ground Landing Reticle
    if (dropTrackerGroup.current) {
      dropTrackerGroup.current.visible = isPayloadPhase
      if (isPayloadPhase && dropBeamRef.current && groundReticleRef.current) {
        const beamHeight = Math.max(0.1, py)
        dropBeamRef.current.position.set(px, beamHeight * 0.5, pz)
        dropBeamRef.current.scale.set(1, beamHeight, 1)
        groundReticleRef.current.position.set(px, 0.08, pz)
        groundReticleRef.current.rotation.y = t * 1.8
      }
    }

    if (splatterGroup.current) {
      splatterGroup.current.visible = isSplattered
      if (isSplattered) {
        splatterGroup.current.position.set(px, 0.4, pz)
        const sp = f.splatterProgress
        splatterGroup.current.children.forEach((child, idx) => {
          const spec = DEBRIS_PIECES[idx]
          if (!spec) return
          const rawY = spec.vy * sp - 18 * sp * sp
          const bounceY = rawY < 0 ? Math.abs(rawY) * 0.45 : rawY
          child.position.set(spec.vx * sp, Math.max(0.15, bounceY), spec.vz * sp)
          child.rotation.set(spec.rx * sp * 3, spec.ry * sp * 3, sp * 5)
        })
      }
    }

    // ---- Hard-Locked Chase Camera (Zero Lag on Falling Payload & Ascending Rocket) ----
    if (isPayloadPhase) {
      const shake =
        isSplattered && f.splatterProgress < 0.45 ? (0.45 - f.splatterProgress) * 2.8 : 0
      const shakeX = Math.sin(t * 65) * shake
      const shakeY = Math.cos(t * 58) * shake

      // Smoothly adjust only the relative offset from the payload so the payload itself is 100% locked
      const desiredOffset =
        f.phase === 'impact'
          ? new THREE.Vector3(0, 3.6, 11.2)
          : f.chuteOpen
            ? new THREE.Vector3(0, 3.8, 13.8)
            : new THREE.Vector3(0, 4.6, 10.2)

      const desiredLookOffset =
        f.phase === 'impact'
          ? new THREE.Vector3(0, 0.1, 0)
          : f.chuteOpen
            ? new THREE.Vector3(0, 1.4, 0) // frame both payload and open parachute canopy
            : new THREE.Vector3(0, -0.25, 0) // dead-center on the falling payload looking slightly down toward the pad

      camOffsetRef.current.lerp(desiredOffset, Math.min(1, dt * 6))
      lookOffsetRef.current.lerp(desiredLookOffset, Math.min(1, dt * 8))

      cam.position.set(
        px + camOffsetRef.current.x + shakeX,
        Math.max(2.2, py + camOffsetRef.current.y) + shakeY,
        pz + camOffsetRef.current.z,
      )
      cam.lookAt(
        px + lookOffsetRef.current.x,
        Math.max(0.6, py + lookOffsetRef.current.y),
        pz + lookOffsetRef.current.z,
      )
    } else {
      // Lock onto the ascending rocket with zero vertical lag
      const desiredOffset = new THREE.Vector3(2.2, 2.0, 18.5)
      const desiredLookOffset = new THREE.Vector3(0, 0.4, 0)
      camOffsetRef.current.lerp(desiredOffset, Math.min(1, dt * 5))
      lookOffsetRef.current.lerp(desiredLookOffset, Math.min(1, dt * 6))

      cam.position.set(
        rx + camOffsetRef.current.x,
        Math.max(8, ry + camOffsetRef.current.y),
        rz + camOffsetRef.current.z,
      )
      cam.lookAt(
        rx + lookOffsetRef.current.x,
        Math.max(6, ry + lookOffsetRef.current.y),
        rz + lookOffsetRef.current.z,
      )
    }
  })

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight
        castShadow
        position={[35, 85, 45]}
        intensity={1.5}
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-30, 25, -20]} intensity={0.45} color="#bae6fd" />

      {/* Spaceport America Desert Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#d8c3a5" roughness={0.94} />
      </mesh>

      {/* Distant Desert Mesas */}
      <group position={[0, 0, -105]}>
        <mesh position={[-75, 14, 0]}>
          <cylinderGeometry args={[22, 34, 28, 7]} />
          <meshStandardMaterial color="#b58969" roughness={0.9} />
        </mesh>
        <mesh position={[15, 18, -20]}>
          <cylinderGeometry args={[30, 46, 36, 8]} />
          <meshStandardMaterial color="#a47556" roughness={0.9} />
        </mesh>
        <mesh position={[90, 12, 10]}>
          <cylinderGeometry args={[18, 28, 24, 6]} />
          <meshStandardMaterial color="#c09676" roughness={0.9} />
        </mesh>
      </group>

      {/* High-Altitude Clouds */}
      <group>
        {clouds.map((c, i) => (
          <group key={i} position={c.pos} scale={c.s}>
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[1.2, 12, 12]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.78} roughness={1} />
            </mesh>
            <mesh position={[1.1, -0.15, 0.2]}>
              <sphereGeometry args={[0.9, 10, 10]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.78} roughness={1} />
            </mesh>
            <mesh position={[-1.0, -0.2, -0.1]}>
              <sphereGeometry args={[0.85, 10, 10]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.78} roughness={1} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Detailed Aerospace Truss Launch Tower (Left side, x = PAD_X) */}
      <group position={[PAD_X, 0, 0]}>
        {/* Octagonal Concrete Blast Pad & Flame Trench */}
        <mesh position={[0, 0.25, 0]} receiveShadow>
          <cylinderGeometry args={[6.5, 7.2, 0.5, 8]} />
          <meshStandardMaterial color="#64748b" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.65, 0]}>
          <coneGeometry args={[1.8, 0.9, 4]} />
          <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
        </mesh>

        {/* Tilted Truss Launch Tower & Guide Rail */}
        <group position={[0, 0.4, 0]} rotation={[0, 0, -railTiltRad]}>
          {/* 4 Vertical Truss Columns */}
          {[
            [-1.9, -0.55],
            [-1.9, 0.55],
            [-0.95, -0.55],
            [-0.95, 0.55],
          ].map(([tx, tz], i) => (
            <mesh key={i} position={[tx, 7.5, tz]} castShadow>
              <cylinderGeometry args={[0.09, 0.09, 15, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.35} />
            </mesh>
          ))}
          {/* Horizontal Truss Tiers along the Tower */}
          {[2, 4.5, 7, 9.5, 12, 14.5].map((ty, idx) => (
            <mesh key={idx} position={[-1.42, ty, 0]}>
              <boxGeometry args={[1.15, 0.12, 1.25]} />
              <meshStandardMaterial color="#dc2626" metalness={0.4} roughness={0.45} />
            </mesh>
          ))}
          {/* Precision Anodized Launch Guide Rail */}
          <mesh position={[-0.68, 7.5, 0]}>
            <boxGeometry args={[0.14, 15, 0.14]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Upper Umbilical Retract Arm */}
          <mesh position={[-0.35, 9.2, 0]}>
            <boxGeometry args={[0.75, 0.16, 0.22]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.3} />
          </mesh>
        </group>
      </group>

      {/* Target Bullseye Landing Zone (Center-Right, x = 0, z = 0) */}
      <group position={[0, 0.05, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[50 * DIST_SCALE - 0.35, 50 * DIST_SCALE, 64]} />
          <meshBasicMaterial color="#16a34a" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <circleGeometry args={[32 * DIST_SCALE, 48]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[18 * DIST_SCALE, 26 * DIST_SCALE, 48]} />
          <meshBasicMaterial color="#dc2626" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <circleGeometry args={[7 * DIST_SCALE, 36]} />
          <meshBasicMaterial color="#dc2626" />
        </mesh>
      </group>

      {showOverlay && (
        <group position={[0, 0.2, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.2, 50 * DIST_SCALE, 48]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.22} />
          </mesh>
        </group>
      )}

      {/* =====================================================================
          SLEEK AEROSPACE IREC SOUNDING ROCKET (Multi-Stage + Curved Ogive + Airfoil Fins)
         ===================================================================== */}
      <group ref={rocketGroup} position={[PAD_X, 6.6, 0]}>
        {/* 1. Curved Tangent-Ogive / Von Kármán Nose Cone */}
        <group position={[0, 3.4, 0]}>
          <mesh geometry={ogiveNoseGeo} castShadow>
            <meshStandardMaterial
              color={matStyle.upperColor}
              metalness={matStyle.metalness}
              roughness={matStyle.roughness}
            />
          </mesh>
          {/* Polished Stainless-Steel Mach Tip Spike */}
          <mesh geometry={tipCapGeo} castShadow>
            <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.12} />
          </mesh>
          {/* Nose Base Separation Ring */}
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.53, 0.53, 0.12, 32]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>

        {/* 2. Upper Payload Fairing & Avionics Section */}
        <mesh castShadow position={[0, 1.85, 0]}>
          <cylinderGeometry args={[0.52, 0.52, 3.0, 32]} />
          <meshStandardMaterial
            color={matStyle.upperColor}
            metalness={matStyle.metalness}
            roughness={matStyle.roughness}
          />
        </mesh>

        {/* Precision Roll-Tracking Stripes & Avionics Band */}
        <mesh position={[0, 2.55, 0]}>
          <cylinderGeometry args={[0.526, 0.526, 0.38, 32]} />
          <meshStandardMaterial color={matStyle.bandColor} metalness={0.35} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.532, 0.532, 0.28, 32]} />
          <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Glowing Telemetry Window Port */}
        <mesh position={[0, 0.35, 0.51]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        {/* 3. Lower High-Power Booster Airframe */}
        <mesh castShadow position={[0, -1.7, 0]}>
          <cylinderGeometry args={[0.52, 0.52, 3.9, 32]} />
          <meshStandardMaterial
            color={matStyle.lowerColor}
            metalness={matStyle.metalness}
            roughness={matStyle.roughness}
          />
        </mesh>

        {/* External Avionics Cable Raceway Spine */}
        <mesh position={[0.51, -0.3, 0]} castShadow>
          <boxGeometry args={[0.06, 6.2, 0.08]} />
          <meshStandardMaterial color={matStyle.bandColor} metalness={0.5} roughness={0.3} />
        </mesh>

        {/* Aft Fin Can Retainer Band */}
        <mesh position={[0, -3.45, 0]}>
          <cylinderGeometry args={[0.53, 0.53, 0.22, 32]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.22} />
        </mesh>

        {/* 4. 4x Swept Airfoil Fins (ExtrudeGeometry) */}
        {[0, 1, 2, 3].map((idx) => (
          <group key={idx} rotation={[0, (idx * Math.PI) / 2, 0]}>
            <mesh
              geometry={airframe.finProfileId === 'clipped-delta' ? deltaFinGeo : sweptFinGeo}
              position={[0.92, -2.75, 0]}
              castShadow
            >
              <meshStandardMaterial
                color={matStyle.finColor}
                metalness={0.45}
                roughness={0.28}
              />
            </mesh>
          </group>
        ))}

        {/* 5. Tapered Boat-Tail & Graphite De Laval Bell Nozzle */}
        <mesh geometry={boatTailGeo} position={[0, -4.4, 0]} castShadow>
          <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.28} />
        </mesh>
        <mesh geometry={nozzleBellGeo} position={[0, -5.05, 0]}>
          <meshStandardMaterial color="#18181b" metalness={0.6} roughness={0.35} side={THREE.DoubleSide} />
        </mesh>

        {/* 6. Multi-Layer Rocket Exhaust Plume & Mach Shock Diamonds */}
        <group ref={flameGroup} position={[0, -5.05, 0]} visible={false}>
          {/* Inner White-Hot Core */}
          <mesh position={[0, -1.2, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.28, 2.4, 16]} />
            <meshBasicMaterial color="#fef08a" />
          </mesh>
          {/* Outer Supersonic Orange Plume */}
          <mesh position={[0, -2.3, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.62, 4.6, 18]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.82} />
          </mesh>
          {/* Mach Shock Diamonds */}
          {[-1.0, -2.1, -3.2].map((dy, i) => (
            <mesh key={i} position={[0, dy, 0]} scale={[1 - i * 0.22, 0.45, 1 - i * 0.22]}>
              <octahedronGeometry args={[0.38, 1]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Structural Shred Debris (if rocket breaks apart at Max-Q) */}
      <group ref={shredGroup} visible={false}>
        {[-1.5, -0.5, 0.6, 1.4].map((offset, i) => (
          <mesh key={i} position={[offset * 1.4, offset, 0]} rotation={[i, i * 0.8, 0]}>
            <boxGeometry args={[0.7, 1.2, 0.4]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
        ))}
      </group>

      {/* =====================================================================
          SLEEK SPACECRAFT PAYLOAD CAPSULE, REACTION FLYWHEEL & DOME PARACHUTE
         ===================================================================== */}
      <group ref={payloadGroup} position={[0, 2.2, 0]}>
        <group ref={payloadBody}>
          {/* Hexagonal Gold-Foil Spacecraft Bus */}
          <mesh castShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[0.78, 0.86, 1.45, 6]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.72} roughness={0.22} />
          </mesh>
          {/* Upper Carbon Avionics Deck */}
          <mesh position={[0, 0.82, 0]}>
            <cylinderGeometry args={[0.58, 0.78, 0.22, 6]} />
            <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.3} />
          </mesh>
          {/* Visible Spinning Gyroscope Reaction Wheel Ring */}
          <mesh ref={flywheelRef} position={[0, 0.15, 0]}>
            <torusGeometry
              args={[
                0.92,
                motor.motorId === 'heavy-iron' ? 0.18 : motor.motorId === 'micro-gimbal' ? 0.05 : 0.1,
                12,
                28,
              ]}
            />
            <meshStandardMaterial
              color={
                motor.motorId === 'heavy-iron'
                  ? '#991b1b'
                  : motor.motorId === 'micro-gimbal'
                    ? '#38bdf8'
                    : '#10b981'
              }
              metalness={0.75}
              roughness={0.2}
            />
          </mesh>
          {/* 4 Shock-Absorbing Landing Struts */}
          {[0, 1, 2, 3].map((legIdx) => (
            <group key={legIdx} rotation={[0, (legIdx * Math.PI) / 2 + Math.PI / 4, 0]}>
              <mesh position={[0.78, -0.78, 0]} rotation={[0, 0, -0.45]}>
                <cylinderGeometry args={[0.04, 0.04, 0.75, 8]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[0.98, -1.05, 0]}>
                <cylinderGeometry args={[0.16, 0.18, 0.06, 12]} />
                <meshStandardMaterial color="#334155" />
              </mesh>
            </group>
          ))}
          {/* High-Gain Helical Telemetry Dish */}
          <mesh position={[0, 1.18, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.55, 8]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.8} />
          </mesh>
        </group>

        {/* Out-of-Control Red Spin Warning Halo */}
        <mesh ref={spinRing} visible={false}>
          <torusGeometry args={[1.65, 0.08, 10, 32]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>

        {/* Deployed Parachute Canopy + Shroud Lines */}
        <group ref={chuteGroup} position={[0, 4.2, 0]} visible={false}>
          <mesh position={[0, 0.8, 0]} castShadow>
            <sphereGeometry args={[2.4, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
            <meshStandardMaterial color="#f97316" side={THREE.DoubleSide} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.82, 0]}>
            <sphereGeometry args={[2.42, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
            <meshStandardMaterial color="#ffffff" wireframe />
          </mesh>
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`${sx}:${sz}`}
                position={[sx * 0.85, -1.2, sz * 0.85]}
                rotation={[sz * 0.32, 0, -sx * 0.32]}
              >
                <cylinderGeometry args={[0.025, 0.025, 4.0, 6]} />
                <meshBasicMaterial color="#f8fafc" />
              </mesh>
            )),
          )}
        </group>
      </group>

      {/* Comedic Splatter Debris Cloud */}
      <group ref={splatterGroup} visible={false}>
        {DEBRIS_PIECES.map((piece, idx) => (
          <mesh key={idx} scale={piece.scale} castShadow>
            {piece.shape === 'box' ? (
              <boxGeometry args={[0.7, 0.7, 0.7]} />
            ) : piece.shape === 'sphere' ? (
              <sphereGeometry args={[0.45, 10, 10]} />
            ) : (
              <cylinderGeometry args={[0.25, 0.25, 0.8, 10]} />
            )}
            <meshStandardMaterial color={piece.color} metalness={0.3} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* Payload Freefall Telemetry Beam, Ground Target Crosshair & Altitude Gate Rings */}
      <group ref={dropTrackerGroup} visible={false}>
        {/* Vertical Laser Drop Line from Payload to Ground */}
        <mesh ref={dropBeamRef}>
          <cylinderGeometry args={[0.035, 0.035, 1, 8]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.45} />
        </mesh>

        {/* Ground Projected Landing Reticle */}
        <group ref={groundReticleRef} position={[0, 0.08, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.1, 1.35, 24]} />
            <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.18, 0.35, 16]} />
            <meshBasicMaterial color="#f97316" side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* Altitude Gate Rings Every 1,000 ft to Give Speed & Parachute Timing Reference */}
        {altitudeGates.map((gate) => (
          <mesh key={gate.altFt} position={[0, gate.y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[5.5, 5.75, 36]} />
            <meshBasicMaterial
              color={gate.isDeployZone ? '#22c55e' : '#bae6fd'}
              transparent
              opacity={gate.isDeployZone ? 0.55 : 0.28}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </>
  )
}

export { AIRFRAME_MATERIALS }
