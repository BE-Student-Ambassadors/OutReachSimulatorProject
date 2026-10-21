import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CUT_MARGIN, HARNESS, POWER_PATHS, SENSOR_MOUNTS, type SensorMountSpec } from '../config'
import type { PathReading } from '../sim/power'
import type { ElectricalObject, PowerPathId, SensorId } from '../types'
import { CarModel } from './CarModel'

export { CameraFly } from '../../../shared/three/CameraFly'
import { harnessPoint, nearestT, PART_SPOT, SENSOR_DOT, subCurve, WIRE_LOOK, wireCurve, ZONE_TINT, type Job } from './harnessGeo'
import type { CarLook } from './look'

export interface HarnessSceneProps {
  look: CarLook
  elec: ElectricalObject
  readings: Record<PowerPathId, PathReading>
  job: Job | null
  /** The active wire is waiting to be cut. */
  cutting: boolean
  hoverT: number | null
  done: Record<PowerPathId, boolean>
  sensorsWorking: Record<SensorId, boolean>
  mountPreview: string | null
  locked: boolean
  onPickJob(job: Job): void
  onHoverCut(t: number | null): void
  onCut(t: number): void
  onPickMount(id: string): void
}

export function HarnessScene(props: HarnessSceneProps) {
  const { look, job, done } = props
  return (
    <>
      <hemisphereLight args={['#ffffff', '#c8cbbf', 1.05]} />
      <directionalLight position={[3, 6, 4]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 3, -3]} intensity={0.35} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[7, 48]} />
        <meshStandardMaterial color="#d7d9d1" />
      </mesh>
      <gridHelper args={[14, 28, '#b9bcb2', '#c9cbc2']} position={[0, 0.002, 0]} />

      <CarModel look={look} frame showJoints={false} headlights={0.2} />
      <Components {...props} />
      {POWER_PATHS.map((p) => (
        <Wire key={p.id} path={p.id} {...props} active={job === p.id} dim={job !== null && job !== p.id} />
      ))}
      {job === null &&
        POWER_PATHS.filter((p) => !done[p.id]).map((p) => (
          <Beacon key={p.id} at={harnessPoint(PART_SPOT[p.id], look)} onClick={() => props.onPickJob(p.id)} />
        ))}
      <Sensors {...props} />
      {job === null && <ComputerSensorsBeacon {...props} />}
    </>
  )
}

// ---------------------------------------------------------------- wires

function Wire({
  path,
  look,
  elec,
  readings,
  active,
  dim,
  cutting,
  hoverT,
  locked,
  onHoverCut,
  onCut,
  onPickJob,
}: HarnessSceneProps & { path: PowerPathId; active: boolean; dim: boolean }) {
  const curve = wireCurve(path, look)
  const line = elec.lines[path]
  const { color, radius } = WIRE_LOOK[path]
  const len = curve.getLength()
  const cutAt = line.cutAt
  const gapHalf = (line.part ? 0.06 : 0.016) / len

  const pieces = useMemo(() => {
    if (cutAt === null) return [curve]
    return [subCurve(curve, 0, Math.max(0, cutAt - gapHalf)), subCurve(curve, Math.min(1, cutAt + gapHalf), 1)]
  }, [curve, cutAt, gapHalf])

  const zones = useMemo(
    () => (active && cutting ? HARNESS[path].zones.map((z) => ({ ...z, curve: subCurve(curve, z.from, z.to, 20) })) : []),
    [active, cutting, curve, path],
  )

  const hoverZone = hoverT === null ? null : HARNESS[path].zones.find((z) => hoverT >= z.from && hoverT <= z.to)
  const opacity = dim ? 0.25 : 1

  return (
    <group>
      {pieces.map((c, i) => (
        <mesh key={i} castShadow={!dim}>
          <tubeGeometry args={[c, 48, radius, 8, false]} />
          <meshStandardMaterial color={color} roughness={0.55} transparent={dim} opacity={opacity} emissive={active ? color : '#000000'} emissiveIntensity={active ? 0.25 : 0} />
        </mesh>
      ))}
      {zones.map((z) => (
        <mesh key={z.from}>
          <tubeGeometry args={[z.curve, 24, radius + 0.012, 10, false]} />
          <meshBasicMaterial color={ZONE_TINT[z.zone]} transparent opacity={hoverZone === z || hoverZone?.from === z.from ? 0.55 : 0.22} depthWrite={false} />
        </mesh>
      ))}
      {cutAt !== null && <SpliceParts curve={curve} cutAt={cutAt} gapHalf={gapHalf} elec={elec} path={path} reading={readings[path]} dim={dim} />}
      {/* Fat invisible tube: easy to hover and click. */}
      <mesh
        visible={false}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (!active || !cutting || locked) return
          e.stopPropagation()
          onHoverCut(nearestT(curve, e.point))
          document.body.style.cursor = 'crosshair'
        }}
        onPointerOut={() => {
          if (active && cutting) onHoverCut(null)
          document.body.style.cursor = ''
        }}
        onPointerOver={() => {
          if (!active && !locked) document.body.style.cursor = 'pointer'
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          if (locked) return
          if (!active) return onPickJob(path)
          if (!cutting) return
          const t = nearestT(curve, e.point)
          if (t >= CUT_MARGIN && t <= 1 - CUT_MARGIN) onCut(t)
        }}
      >
        <tubeGeometry args={[curve, 64, 0.03, 6, false]} />
        <meshBasicMaterial />
      </mesh>
      {active && cutting && hoverT !== null && <CutMarker curve={curve} t={hoverT} />}
    </group>
  )
}

function CutMarker({ curve, t }: { curve: THREE.Curve<THREE.Vector3>; t: number }) {
  const ok = t >= CUT_MARGIN && t <= 1 - CUT_MARGIN
  const { pos, quat } = useMemo(() => {
    const pos = curve.getPointAt(t)
    const tan = curve.getTangentAt(t)
    return { pos, quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan) }
  }, [curve, t])
  return (
    <group position={pos} quaternion={quat}>
      <mesh>
        <torusGeometry args={[0.022, 0.003, 8, 24]} />
        <meshBasicMaterial color={ok ? '#1b2a20' : '#b8461b'} />
      </mesh>
      {/* Scissor blades */}
      {ok &&
        [0.6, -0.6].map((a) => (
          <mesh key={a} rotation={[0, 0, a]} position={[0, 0.03, 0]}>
            <boxGeometry args={[0.004, 0.04, 0.002]} />
            <meshBasicMaterial color="#1b2a20" />
          </mesh>
        ))}
    </group>
  )
}

/** Crimped connectors and the spliced part. */
function SpliceParts({
  curve,
  cutAt,
  gapHalf,
  elec,
  path,
  reading,
  dim,
}: {
  curve: THREE.Curve<THREE.Vector3>
  cutAt: number
  gapHalf: number
  elec: ElectricalObject
  path: PowerPathId
  reading: PathReading
  dim: boolean
}) {
  const line = elec.lines[path]
  const at = (t: number) => {
    const pos = curve.getPointAt(Math.min(1, Math.max(0, t)))
    const tan = curve.getTangentAt(Math.min(1, Math.max(0, t)))
    return { pos, quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tan) }
  }
  const len = curve.getLength()
  const ends = [at(cutAt - gapHalf + 0.008 / len), at(cutAt + gapHalf - 0.008 / len)]
  const mid = at(cutAt)
  const glow = useRef<THREE.MeshStandardMaterial>(null)
  const heat = Math.min(1, reading.heatW / 120)
  useFrame(({ clock }) => {
    if (glow.current) glow.current.emissiveIntensity = heat * (0.8 + 0.2 * Math.sin(clock.elapsedTime * 3))
  })
  const r = WIRE_LOOK[path].radius
  return (
    <group>
      {ends.map((e, i) => {
        const q = line.crimps[i]
        return (
          <group key={i} position={e.pos} quaternion={e.quat}>
            {q === null ? (
              // Bare copper strands sticking out of a fresh cut.
              <mesh>
                <cylinderGeometry args={[r * 0.8, r * 0.8, 0.012, 8]} />
                <meshStandardMaterial color="#c8743a" metalness={0.8} roughness={0.3} />
              </mesh>
            ) : (
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[r * 1.6, r * 1.6, 0.02, 12]} />
                <meshStandardMaterial color={q >= 0.85 ? '#d4d8d6' : q >= 0.6 ? '#b8b2a0' : '#8e7d62'} metalness={0.85} roughness={0.3} transparent={dim} opacity={dim ? 0.3 : 1} />
              </mesh>
            )}
          </group>
        )
      })}
      {line.part && (
        <group position={mid.pos} quaternion={mid.quat} scale={1.5}>
          {line.part.type === 'resistor' ? (
            <group>
              <mesh castShadow>
                <boxGeometry args={[0.07, 0.024, 0.026]} />
                <meshStandardMaterial ref={glow} color="#c9a24a" metalness={0.6} roughness={0.35} emissive="#ff5a1a" emissiveIntensity={0} transparent={dim} opacity={dim ? 0.3 : 1} />
              </mesh>
              {[-0.024, -0.008, 0.008, 0.024].map((x) => (
                <mesh key={x} position={[x, 0.016, 0]}>
                  <boxGeometry args={[0.004, 0.01, 0.026]} />
                  <meshStandardMaterial color="#b28c3a" metalness={0.6} roughness={0.35} />
                </mesh>
              ))}
            </group>
          ) : (
            <group>
              <mesh castShadow>
                <boxGeometry args={[0.07, 0.006, 0.04]} />
                <meshStandardMaterial color="#2f6b3e" roughness={0.6} transparent={dim} opacity={dim ? 0.3 : 1} />
              </mesh>
              <mesh position={[-0.012, 0.012, 0]}>
                <cylinderGeometry args={[0.011, 0.011, 0.016, 14]} />
                <meshStandardMaterial color="#1c1f1d" />
              </mesh>
              <mesh position={[0.018, 0.01, 0]}>
                <boxGeometry args={[0.018, 0.014, 0.03]} />
                <meshStandardMaterial color="#9aa3ad" metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
          )}
        </group>
      )}
    </group>
  )
}

// ---------------------------------------------------------------- components that react to their voltage

function Components({ look, readings, job, locked, onPickJob }: HarnessSceneProps) {
  const p = (spot: [number, number, number]) => harnessPoint(spot, look)
  const motorRotor = useRef<THREE.Group>(null)
  const motorMat = useRef<THREE.MeshStandardMaterial>(null)
  const screen = useRef<THREE.MeshStandardMaterial>(null)
  const latest = useRef(readings)
  useEffect(() => {
    latest.current = readings
  })

  useFrame(({ clock }, dt) => {
    const r = latest.current
    const t = clock.elapsedTime
    const spin = (lvl: number) => (lvl > 0 ? Math.min(2.2, lvl) : 0)
    if (motorRotor.current) motorRotor.current.rotation.z -= dt * 26 * spin(r.motor.level)
    if (motorMat.current) motorMat.current.emissiveIntensity = r.motor.state === 'high' ? 0.6 + 0.4 * Math.sin(t * 8) : 0
    if (screen.current) {
      const c = r.computer
      const flicker = c.state === 'low' && c.volts > 0 ? (Math.sin(t * 10) > 0.2 ? 1 : 0.1) : 1
      screen.current.emissive.set(c.volts <= 0 ? '#000000' : c.state === 'ok' ? '#3fe07a' : c.state === 'high' ? '#ff3b2a' : '#e1b12c')
      screen.current.emissiveIntensity = c.volts <= 0 ? 0 : 1.6 * flicker
    }
  })

  const pick = (j: Job) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!locked && job !== j) onPickJob(j)
  }
  const hover = {
    onPointerOver: () => {
      if (!locked) document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => (document.body.style.cursor = ''),
  }

  return (
    <group>
      {/* 48 V main pack (accumulator) */}
      <group position={p([-0.5, 0.2, 0])}>
        <mesh castShadow>
          <boxGeometry args={[0.4, 0.34, 0.44]} />
          <meshStandardMaterial color="#3a3f3c" roughness={0.6} />
        </mesh>
        {[-0.1, 0.1].map((x) => (
          <mesh key={x} position={[x, 0.171, 0]}>
            <boxGeometry args={[0.04, 0.002, 0.42]} />
            <meshStandardMaterial color="#e06a1b" />
          </mesh>
        ))}
      </group>
      {/* 12 V pack */}
      <group position={p([0.3, 0.1, 0.24])}>
        <mesh castShadow>
          <boxGeometry args={[0.14, 0.12, 0.1]} />
          <meshStandardMaterial color="#1c1f1d" />
        </mesh>
        <mesh position={[0, 0.061, 0]}>
          <boxGeometry args={[0.12, 0.002, 0.08]} />
          <meshStandardMaterial color="#74a85f" />
        </mesh>
      </group>
      {/* Drive motor */}
      <group position={p(PART_SPOT.motor)} onClick={pick('motor')} {...hover}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.2, 24]} />
          <meshStandardMaterial ref={motorMat} color="#4a504c" metalness={0.5} roughness={0.4} emissive="#ff6a1a" emissiveIntensity={0} />
        </mesh>
        <group ref={motorRotor} position={[0, 0, 0.105]}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]} position={[0, 0, 0]}>
              <boxGeometry args={[0.18, 0.02, 0.012]} />
              <meshStandardMaterial color="#c9ccc8" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.01]}>
            <cylinderGeometry args={[0.025, 0.025, 0.02, 12]} />
            <meshStandardMaterial color="#d99a1e" />
          </mesh>
        </group>
      </group>
      {/* Driverless computer */}
      <group position={p(PART_SPOT.computer)} onClick={pick('computer')} {...hover}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.05, 0.15]} />
          <meshStandardMaterial color="#1b2a20" />
        </mesh>
        <mesh position={[0, 0.026, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, 0.08]} />
          <meshStandardMaterial ref={screen} color="#0c0f0d" emissive="#3fe07a" emissiveIntensity={0} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- markers

/** A pulsing ring that marks a part still waiting for work. */
function Beacon({ at, onClick, color = '#e1b12c' }: { at: THREE.Vector3; onClick(): void; color?: string }) {
  const ref = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.lookAt(camera.position)
    const s = 1 + 0.18 * Math.sin(clock.elapsedTime * 4)
    ref.current.scale.setScalar(s)
  })
  return (
    <mesh
      ref={ref}
      position={at}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <ringGeometry args={[0.13, 0.155, 40]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} depthTest={false} />
    </mesh>
  )
}

function ComputerSensorsBeacon({ look, elec, onPickJob }: HarnessSceneProps) {
  if (Object.values(elec.mounts).every(Boolean)) return null
  return <Beacon at={harnessPoint([0.95, 0.4, 0], look)} color="#7c4dbd" onClick={() => onPickJob('sensors')} />
}

// ---------------------------------------------------------------- self-driving sensors

function Sensors({ look, elec, job, mountPreview, sensorsWorking, readings, locked, onPickMount }: HarnessSceneProps) {
  const powered = readings.computer.volts > 0 && readings.computer.state !== 'low'
  return (
    <group>
      {SENSOR_MOUNTS.map((m) => {
        const mounted = elec.mounts[m.sensor] === m.id
        const preview = mountPreview === m.id && !mounted
        const showSpot = job === 'sensors' && !mounted
        if (!mounted && !preview && !showSpot) return null
        return (
          <group key={m.id} position={harnessPoint(m.pos, look)}>
            {(mounted || preview) && <SensorModel mount={m} ghost={preview} spinning={mounted && powered && sensorsWorking[m.sensor]} />}
            {showSpot && !preview && (
              <mesh
                onClick={(e) => {
                  e.stopPropagation()
                  if (!locked) onPickMount(m.id)
                }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')}
                onPointerOut={() => (document.body.style.cursor = '')}
              >
                <sphereGeometry args={[0.035, 16, 12]} />
                <meshStandardMaterial color={SENSOR_DOT[m.sensor]} emissive={SENSOR_DOT[m.sensor]} emissiveIntensity={0.6} transparent opacity={0.75} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

function SensorModel({ mount, ghost, spinning }: { mount: SensorMountSpec; ghost: boolean; spinning: boolean }) {
  const head = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (head.current && spinning) head.current.rotation.y += dt * 12
  })
  const m = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => (
    <meshStandardMaterial color={color} transparent={ghost} opacity={ghost ? 0.45 : 1} roughness={0.4} {...extra} />
  )
  if (mount.sensor === 'lidar')
    return (
      <group>
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[0.07, 0.015, 0.07]} />
          {m('#3a3f3c')}
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.06, 24]} />
          {m('#2a2d2b')}
        </mesh>
        <group ref={head} position={[0, 0.02, 0]}>
          <mesh>
            <cylinderGeometry args={[0.041, 0.041, 0.022, 24]} />
            {m('#4a3a6a', { metalness: 0.5 })}
          </mesh>
          <mesh position={[0.041, 0, 0]}>
            <boxGeometry args={[0.004, 0.016, 0.02]} />
            <meshStandardMaterial color="#ff3b2a" emissive="#ff3b2a" emissiveIntensity={spinning ? 2 : 0} toneMapped={false} />
          </mesh>
        </group>
      </group>
    )
  if (mount.sensor === 'camera')
    return (
      <group>
        <mesh>
          <boxGeometry args={[0.05, 0.04, 0.09]} />
          {m('#1c1f1d')}
        </mesh>
        {[-0.025, 0.025].map((z) => (
          <mesh key={z} position={[0.028, 0, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.01, 16]} />
            {m('#e06a1b', { emissive: spinning ? '#e06a1b' : '#000000', emissiveIntensity: 0.4 })}
          </mesh>
        ))}
      </group>
    )
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.05, 12]} />
        {m('#3a3f3c', { metalness: 0.5 })}
      </mesh>
      <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.07, 0.006, 6, 30]} />
        {m('#9aa3ad', { metalness: 0.7 })}
      </mesh>
    </group>
  )
}
