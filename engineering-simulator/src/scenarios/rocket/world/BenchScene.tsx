import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { nearestT, subCurve } from '../../../shared/three/curves'
import { BATTERY_AT, CUT_MARGIN, LINE_BY_ID, LINES, lineOf } from '../config'
import type { LineReading } from '../sim/power'
import type { BoardId, ElectricalObject, LineId } from '../types'
import { BOARD_AT, leadCurve, sameJob, ZONE_TINT, type BenchJob } from './benchGeo'

const TUBE_R = 0.16
const NOSE_X = 0.62
const TAIL_X = -1.2
const WIRE_R = 0.0065
const ARM_SWITCH_Y = 0.15
const ARM_SWITCH_Z = -0.06

/**
 * The electronics workbench: the rocket lies on two cradles with the side of its body tube cut
 * away, so the avionics sled, both breadboards, the battery leads and the motor are in view.
 * x runs toward the nose, y is up, z faces the viewer.
 */

export interface BenchSceneProps {
  el: ElectricalObject
  readings: Record<LineId, LineReading>
  job: BenchJob | null
  /** The active lead is waiting to be cut. */
  cutting: boolean
  hoverT: number | null
  done: { boards: Record<BoardId, boolean>; lines: Record<LineId, boolean> }
  locked: boolean
  onPick(job: BenchJob): void
  onHoverCut(t: number | null): void
  onCut(t: number): void
}

export function BenchScene(props: BenchSceneProps) {
  const { job, done, onPick } = props
  return (
    <>
      <hemisphereLight args={['#ffffff', '#c8cbbf', 1.05]} />
      <directionalLight position={[2, 5, 4]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
      <directionalLight position={[-3, 2, -3]} intensity={0.35} />
      {/* Workbench top */}
      <mesh position={[0, -0.27, 0]} receiveShadow>
        <boxGeometry args={[3.4, 0.06, 1.3]} />
        <meshStandardMaterial color="#c9b48f" roughness={0.85} />
      </mesh>
      <Rocket />
      <Parts {...props} />
      {LINES.map((l) => (
        <Lead key={l.id} id={l.id} {...props} active={job?.kind === 'line' && job.id === l.id} dim={!!job && !(job.kind === 'line' && job.id === l.id)} />
      ))}
      {job === null && (
        <>
          {LINES.filter((l) => !done.lines[l.id]).map((l) => (
            <Beacon key={l.id} at={new THREE.Vector3(...l.partAt).add(new THREE.Vector3(0, 0.09, 0))} onClick={() => onPick({ kind: 'line', id: l.id })} />
          ))}
          {(['flight', 'sensor'] as const)
            .filter((b) => !done.boards[b])
            .map((b) => (
              <Beacon key={b} at={new THREE.Vector3(...BOARD_AT[b]).add(new THREE.Vector3(0, 0.06, 0.07))} onClick={() => onPick({ kind: 'board', id: b })} />
            ))}
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------- the rocket

function Rocket() {
  const len = NOSE_X - TAIL_X
  return (
    <group>
      {/* Cradles */}
      {[0.35, -0.8].map((x) => (
        <mesh key={x} position={[x, -0.2, 0]} castShadow>
          <boxGeometry args={[0.08, 0.1, 0.36]} />
          <meshStandardMaterial color="#6b5a45" roughness={0.8} />
        </mesh>
      ))}
      {/* Body tube with the front side cut away */}
      <mesh position={[(NOSE_X + TAIL_X) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[TUBE_R, TUBE_R, len, 40, 1, true, Math.PI * 0.6, Math.PI * 1.3]} />
        <meshStandardMaterial color="#f2f1ea" roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      {/* Nose cone */}
      <mesh position={[NOSE_X + 0.24, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <coneGeometry args={[TUBE_R, 0.48, 40]} />
        <meshStandardMaterial color="#2c5b3c" roughness={0.45} />
      </mesh>
      {/* Folded parachute and its shock cord */}
      <mesh position={[0.53, -0.06, 0]} scale={[1.4, 0.8, 1]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color="#e06a1b" roughness={0.8} />
      </mesh>
      {/* Avionics sled */}
      <mesh position={[0.16, -0.06, 0]} receiveShadow>
        <boxGeometry args={[0.62, 0.012, 0.2]} />
        <meshStandardMaterial color="#b9a27a" roughness={0.8} />
      </mesh>
      {/* Bulkhead between the avionics bay and the motor section */}
      <mesh position={[-0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[TUBE_R - 0.004, TUBE_R - 0.004, 0.012, 40]} />
        <meshStandardMaterial color="#9c8762" roughness={0.8} transparent opacity={0.55} />
      </mesh>
      {/* Motor in its mount */}
      <mesh position={[-0.9, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.065, 0.065, 0.6, 24]} />
        <meshStandardMaterial color="#5a5f5b" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[-1.215, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.05, 0.03, 20]} />
        <meshStandardMaterial color="#2a2d2b" />
      </mesh>
      {/* Fins */}
      {[0, 1, 2].map((i) => {
        const a = Math.PI / 2 + (i * 2 * Math.PI) / 3
        return (
          <mesh key={i} position={[TAIL_X + 0.14, Math.sin(a) * (TUBE_R + 0.09), Math.cos(a) * (TUBE_R + 0.09)]} rotation={[-a + Math.PI / 2, 0, 0]} castShadow>
            <boxGeometry args={[0.26, 0.18, 0.008]} />
            <meshStandardMaterial color="#2c5b3c" roughness={0.5} />
          </mesh>
        )
      })}
    </group>
  )
}

// ---------------------------------------------------------------- parts that react to their voltage

function Parts({ el, readings, job, done, locked, onPick }: BenchSceneProps) {
  const fcLed = useRef<THREE.MeshStandardMaterial>(null)
  const sensorLed = useRef<THREE.MeshStandardMaterial>(null)
  const igniterTip = useRef<THREE.MeshStandardMaterial>(null)
  const igniterLight = useRef<THREE.PointLight>(null)
  const latest = useRef({ readings, done })
  useEffect(() => {
    latest.current = { readings, done }
  })

  useFrame(({ clock }) => {
    const { readings: r, done: d } = latest.current
    const t = clock.elapsedTime
    const c = r.computer
    if (fcLed.current) {
      const flicker = c.state === 'low' && c.volts > 0 ? (Math.sin(t * 10) > 0.2 ? 1 : 0.1) : 1
      fcLed.current.emissive.set(c.volts <= 0 ? '#000000' : c.state === 'ok' ? '#3fe07a' : c.state === 'high' ? '#ff3b2a' : '#e1b12c')
      fcLed.current.emissiveIntensity = c.volts <= 0 ? 0 : 2 * flicker
    }
    if (sensorLed.current) sensorLed.current.emissiveIntensity = c.state === 'ok' && d.boards.sensor ? 2 : 0
    // The igniter warms with its voltage: orange in its range, white-hot above it.
    const ig = r.igniter
    const heat = Math.min(2.2, Math.max(0, ig.level) ** 2)
    if (igniterTip.current) {
      igniterTip.current.emissive.set(ig.state === 'high' ? '#fff1c9' : '#ff6a1a')
      igniterTip.current.emissiveIntensity = heat * (0.85 + 0.15 * Math.sin(t * 7))
    }
    if (igniterLight.current) igniterLight.current.intensity = heat * 0.08
  })

  const pick = (j: BenchJob) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!locked && !sameJob(job, j)) onPick(j)
  }
  const hover = {
    onPointerOver: () => {
      if (!locked) document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => (document.body.style.cursor = ''),
  }
  const dimmed = (j: BenchJob) => !!job && !sameJob(job, j)

  return (
    <group>
      {/* 9 V battery */}
      <group position={BATTERY_AT}>
        <mesh castShadow position={[0, -0.015, 0]}>
          <boxGeometry args={[0.1, 0.06, 0.07]} />
          <meshStandardMaterial color="#1c1f1d" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.016, 0]}>
          <boxGeometry args={[0.1, 0.004, 0.07]} />
          <meshStandardMaterial color="#d99a1e" />
        </mesh>
      </group>
      {/* Arming switch on the top of the body tube */}
      <group position={[0.22, ARM_SWITCH_Y, ARM_SWITCH_Z]} rotation={[0.45, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.04, 0.02, 0.03]} />
          <meshStandardMaterial color="#2a2d2b" />
        </mesh>
        <mesh position={[0.008, 0.016, 0]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.006, 0.024, 0.006]} />
          <meshStandardMaterial color="#c23b22" />
        </mesh>
      </group>
      {/* The two breadboards */}
      {(['flight', 'sensor'] as const).map((b) => {
        const wired = Object.entries(el.paths).length > 0
        return (
          <group key={b} position={BOARD_AT[b]} onClick={pick({ kind: 'board', id: b })} {...hover}>
            <mesh castShadow>
              <boxGeometry args={b === 'flight' ? [0.14, 0.014, 0.12] : [0.12, 0.014, 0.1]} />
              <meshStandardMaterial color="#fbfaf5" roughness={0.6} transparent={dimmed({ kind: 'board', id: b })} opacity={dimmed({ kind: 'board', id: b }) ? 0.5 : 1} />
            </mesh>
            {/* Hole grid */}
            <mesh position={[0, 0.0075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={b === 'flight' ? [0.12, 0.1] : [0.1, 0.08]} />
              <meshStandardMaterial color={done.boards[b] ? '#cfe3d4' : wired ? '#e6e1cf' : '#dcd7c6'} />
            </mesh>
            {/* Status LED: the computer on the flight board, the sensors on the sensor board */}
            <mesh position={[b === 'flight' ? 0.055 : 0.045, 0.012, 0.045]}>
              <sphereGeometry args={[0.006, 10, 8]} />
              <meshStandardMaterial ref={b === 'flight' ? fcLed : sensorLed} color="#1a1a1a" emissive="#3fe07a" emissiveIntensity={0} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
      {/* Igniter in the motor nozzle */}
      <group position={LINE_BY_ID.igniter.partAt} onClick={pick({ kind: 'line', id: 'igniter' })} {...hover}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.006, 0.006, 0.05, 8]} />
          <meshStandardMaterial ref={igniterTip} color="#7a4a2a" emissive="#ff6a1a" emissiveIntensity={0} toneMapped={false} />
        </mesh>
        <pointLight ref={igniterLight} position={[-0.05, 0, 0.03]} color="#ff7a2a" intensity={0} distance={0.25} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- battery leads

function Lead({
  id,
  el,
  readings,
  active,
  dim,
  cutting,
  hoverT,
  locked,
  onHoverCut,
  onCut,
  onPick,
}: BenchSceneProps & { id: LineId; active: boolean; dim: boolean }) {
  const curve = leadCurve(id)
  const spec = LINE_BY_ID[id]
  const line = lineOf(el, id)
  const len = curve.getLength()
  const cutAt = line.cutAt
  const gapHalf = (line.ohms !== null ? 0.035 : 0.01) / len

  const pieces = useMemo(() => {
    if (cutAt === null) return [curve]
    return [subCurve(curve, 0, Math.max(0, cutAt - gapHalf)), subCurve(curve, Math.min(1, cutAt + gapHalf), 1)]
  }, [curve, cutAt, gapHalf])

  const zones = useMemo(() => (active && cutting ? spec.zones.map((z) => ({ ...z, curve: subCurve(curve, z.from, z.to, 20) })) : []), [active, cutting, curve, spec])
  const hoverZone = hoverT === null ? null : spec.zones.find((z) => hoverT >= z.from && hoverT <= z.to)

  return (
    <group>
      {pieces.map((c, i) => (
        <mesh key={i} castShadow={!dim}>
          <tubeGeometry args={[c, 64, WIRE_R, 8, false]} />
          <meshStandardMaterial
            color={spec.color}
            roughness={0.55}
            transparent={dim}
            opacity={dim ? 0.3 : 1}
            emissive={active ? spec.color : '#000000'}
            emissiveIntensity={active ? 0.25 : 0}
          />
        </mesh>
      ))}
      {zones.map((z) => (
        <mesh key={z.from}>
          <tubeGeometry args={[z.curve, 24, WIRE_R + 0.007, 10, false]} />
          <meshBasicMaterial color={ZONE_TINT[z.zone]} transparent opacity={hoverZone?.from === z.from ? 0.55 : 0.22} depthWrite={false} />
        </mesh>
      ))}
      {cutAt !== null && <Splice curve={curve} cutAt={cutAt} gapHalf={gapHalf} crimps={line.crimps} ohms={line.ohms} reading={readings[id]} dim={dim} />}
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
          if (!active) return onPick({ kind: 'line', id })
          if (!cutting) return
          const t = nearestT(curve, e.point)
          if (t >= CUT_MARGIN && t <= 1 - CUT_MARGIN) onCut(t)
        }}
      >
        <tubeGeometry args={[curve, 64, 0.022, 6, false]} />
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
        <torusGeometry args={[0.014, 0.002, 8, 24]} />
        <meshBasicMaterial color={ok ? '#1b2a20' : '#b8461b'} />
      </mesh>
      {ok &&
        [0.6, -0.6].map((a) => (
          <mesh key={a} rotation={[0, 0, a]} position={[0, 0.02, 0]}>
            <boxGeometry args={[0.003, 0.026, 0.0015]} />
            <meshBasicMaterial color="#1b2a20" />
          </mesh>
        ))}
    </group>
  )
}

/** Crimped connectors and the spliced resistor, which glows with the heat it sheds. */
function Splice({
  curve,
  cutAt,
  gapHalf,
  crimps,
  ohms,
  reading,
  dim,
}: {
  curve: THREE.Curve<THREE.Vector3>
  cutAt: number
  gapHalf: number
  crimps: [number | null, number | null]
  ohms: number | null
  reading: LineReading
  dim: boolean
}) {
  const at = (t: number) => {
    const c = Math.min(1, Math.max(0, t))
    return { pos: curve.getPointAt(c), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), curve.getTangentAt(c)) }
  }
  const len = curve.getLength()
  const ends = [at(cutAt - gapHalf + 0.005 / len), at(cutAt + gapHalf - 0.005 / len)]
  const mid = at(cutAt)
  const glow = useRef<THREE.MeshStandardMaterial>(null)
  const heat = Math.min(1, reading.heatW / 14)
  useFrame(({ clock }) => {
    if (glow.current) glow.current.emissiveIntensity = heat * (0.8 + 0.2 * Math.sin(clock.elapsedTime * 3))
  })
  return (
    <group>
      {ends.map((e, i) => {
        const q = crimps[i]
        return (
          <group key={i} position={e.pos} quaternion={e.quat}>
            {q === null ? (
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[WIRE_R * 0.8, WIRE_R * 0.8, 0.008, 8]} />
                <meshStandardMaterial color="#c8743a" metalness={0.8} roughness={0.3} />
              </mesh>
            ) : (
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[WIRE_R * 1.6, WIRE_R * 1.6, 0.013, 12]} />
                <meshStandardMaterial
                  color={q >= 0.85 ? '#d4d8d6' : q >= 0.6 ? '#b8b2a0' : '#8e7d62'}
                  metalness={0.85}
                  roughness={0.3}
                  transparent={dim}
                  opacity={dim ? 0.3 : 1}
                />
              </mesh>
            )}
          </group>
        )
      })}
      {ohms !== null && (
        <group position={mid.pos} quaternion={mid.quat}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.009, 0.009, 0.04, 14]} />
            <meshStandardMaterial ref={glow} color="#d8c39a" roughness={0.5} emissive="#ff5a1a" emissiveIntensity={0} transparent={dim} opacity={dim ? 0.3 : 1} />
          </mesh>
          {/* Color bands */}
          {[-0.012, -0.004, 0.004, 0.013].map((x, i) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.0093, 0.0093, 0.003, 14]} />
              <meshStandardMaterial color={['#7a4a2a', '#1c1f1d', '#c23b22', '#d4af37'][i]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

// ---------------------------------------------------------------- markers

/** A pulsing ring that marks a job still waiting for work. */
function Beacon({ at, onClick }: { at: THREE.Vector3; onClick(): void }) {
  const ref = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.lookAt(camera.position)
    ref.current.scale.setScalar(1 + 0.18 * Math.sin(clock.elapsedTime * 4))
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
      <ringGeometry args={[0.022, 0.032, 28]} />
      <meshBasicMaterial color="#e1b12c" transparent opacity={0.9} side={THREE.DoubleSide} depthTest={false} />
    </mesh>
  )
}
