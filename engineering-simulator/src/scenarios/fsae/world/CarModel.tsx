import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { FRAME_NODES, FRONT_WING_BY_ID, JOINTS } from '../config'
import type { FrontWingId } from '../types'
import type { CarLook } from './look'

/**
 * A low-poly Formula SAE car. Origin is on the ground, midway between the axles;
 * the car faces +x. Units are meters.
 */

const WHEEL_R = 0.24

const FRAME_TUBES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [2, 5],
  [3, 6],
  [2, 4],
  [3, 4],
  [4, 5],
  [4, 6],
  [5, 7],
  [6, 7],
  [4, 7],
  [0, 5],
  [1, 6],
]

function Tube({ a, b, radius = 0.018, color = '#9aa3ad' }: { a: THREE.Vector3; b: THREE.Vector3; radius?: number; color?: string }) {
  const { pos, quat, len } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    return { pos: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), quat, len }
  }, [a, b])
  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[radius, radius, len, 8]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
    </mesh>
  )
}

export interface CarModelProps {
  look: CarLook
  body?: string
  accent?: string
  /** 0 = off, 1 = normal, >1 = over-bright. */
  headlights?: number
  brakeLight?: number
  /** Garage view: show the bare frame and joints instead of bodywork. */
  frame?: boolean
  welds?: number[]
  /** Frame view: draw the weld joints (on by default). */
  showJoints?: boolean
  activeJoint?: number | null
  onJointDown?(i: number, e: ThreeEvent<PointerEvent>): void
  /** Semi-transparent ghost car (replays). */
  ghost?: boolean
  /** Wheel spin angle, radians. */
  wheelSpin?: number
  /** Front wheel steer angle, radians. */
  steer?: number
}

export function CarModel({
  look,
  body = '#2c5b3c',
  accent = '#f4f3ec',
  headlights = 0,
  brakeLight = 0,
  frame = false,
  welds,
  showJoints = true,
  activeJoint = null,
  onJointDown,
  ghost = false,
  wheelSpin = 0,
  steer = 0,
}: CarModelProps) {
  const L = look.wheelbaseMm / 1000
  const T = look.trackMm / 1000
  const ride = look.rideHeightMm / 1000
  const r = look.rearWing / 100
  const floorY = ride + 0.02

  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => (
    <meshStandardMaterial color={color} roughness={0.45} metalness={0.15} transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} {...extra} />
  )

  const nodes = useMemo(() => FRAME_NODES.map((j) => new THREE.Vector3(j.x * (L / 1.6), floorY + j.y * 0.85, j.z * (T / 1.2))), [L, T, floorY])
  const joints = useMemo(() => JOINTS.map((j) => new THREE.Vector3(j.x * (L / 1.6), floorY + j.y * 0.85, j.z * (T / 1.2))), [L, T, floorY])

  const fwX = L / 2 + 0.7
  // Rear wing: rises on its stalks and tips up as it extends.
  const rwX = -L / 2 - 0.28 - 0.12 * r
  const rwY = floorY + 0.78 + 0.32 * r
  const rwAngle = 0.08 + 0.42 * r

  const wheels: [number, number, boolean][] = [
    [L / 2, T / 2, true],
    [L / 2, -T / 2, true],
    [-L / 2, T / 2, false],
    [-L / 2, -T / 2, false],
  ]

  return (
    <group>
      {/* Wheels */}
      {wheels.map(([x, z, front]) => (
        <group key={`${x}${z}`} position={[x, WHEEL_R, z]} rotation={[0, front ? steer : 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, -wheelSpin]} castShadow>
            <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.2, 20]} />
            {mat('#1c1f1d', { roughness: 0.9 })}
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, -wheelSpin]} position={[0, 0, z > 0 ? 0.101 : -0.101]}>
            <cylinderGeometry args={[0.13, 0.13, 0.01, 12]} />
            {mat('#c9ccc8', { metalness: 0.7 })}
          </mesh>
          {/* Suspension arms back to the chassis */}
          {!frame && (
            <mesh position={[0, 0.02, z > 0 ? -T / 4 + 0.08 : T / 4 - 0.08]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, T / 2 - 0.25, 6]} />
              {mat('#3a3f3c', { metalness: 0.6 })}
            </mesh>
          )}
        </group>
      ))}

      {frame ? (
        <group>
          {FRAME_TUBES.map(([a, b]) => (
            <Tube key={`${a}-${b}`} a={nodes[a]} b={nodes[b]} />
          ))}
          {/* Floor rails */}
          <Tube a={new THREE.Vector3(L / 2 + 0.2, floorY + 0.05, -0.18)} b={new THREE.Vector3(-L / 2 - 0.05, floorY + 0.05, -0.28)} />
          <Tube a={new THREE.Vector3(L / 2 + 0.2, floorY + 0.05, 0.18)} b={new THREE.Vector3(-L / 2 - 0.05, floorY + 0.05, 0.28)} />
          {showJoints && joints.map((p, i) => {
            const q = welds?.[i] ?? -1
            const active = activeJoint === i
            const color = q < 0 ? '#e1b12c' : q >= 0.95 ? '#74a85f' : '#d9a52b'
            return (
              <mesh
                key={i}
                position={p}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onJointDown?.(i, e)
                }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')}
                onPointerOut={() => (document.body.style.cursor = '')}
              >
                <sphereGeometry args={[q < 0 ? 0.055 : 0.045, 16, 12]} />
                <meshStandardMaterial
                  color={active ? '#ffb347' : color}
                  emissive={active ? '#ff7a1a' : q < 0 ? '#e1b12c' : '#000000'}
                  emissiveIntensity={active ? 2.2 : q < 0 ? 0.35 : 0}
                />
              </mesh>
            )
          })}
          {/* Seat so the frame reads as a car */}
          <mesh position={[-0.05, floorY + 0.18, 0]}>
            <boxGeometry args={[0.45, 0.06, 0.38]} />
            {mat('#3a3f3c')}
          </mesh>
        </group>
      ) : (
        <group>
          {/* Main tub */}
          <mesh position={[0.05, floorY + 0.22, 0]} castShadow>
            <boxGeometry args={[L * 0.95, 0.36, 0.62]} />
            {mat(body)}
          </mesh>
          {/* Nose */}
          <mesh position={[L / 2 + 0.25, floorY + 0.22, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
            <coneGeometry args={[0.24, 0.85, 16]} />
            {mat(body)}
          </mesh>
          {/* White stripe */}
          <mesh position={[0.1, floorY + 0.405, 0]}>
            <boxGeometry args={[L * 0.9, 0.012, 0.14]} />
            {mat(accent)}
          </mesh>
          {/* Sidepods */}
          {[1, -1].map((s) => (
            <mesh key={s} position={[-0.12, floorY + 0.17, s * (0.42 + (T - 1.1) * 0.15)]} castShadow>
              <boxGeometry args={[L * 0.55, 0.26, 0.26]} />
              {mat(body)}
            </mesh>
          ))}
          {/* Cockpit opening, driver, roll hoop */}
          <mesh position={[-0.05, floorY + 0.41, 0]}>
            <boxGeometry args={[0.6, 0.02, 0.42]} />
            {mat('#121614')}
          </mesh>
          <mesh position={[-0.2, floorY + 0.62, 0]} castShadow>
            <sphereGeometry args={[0.13, 16, 12]} />
            {mat('#f4f3ec')}
          </mesh>
          <mesh position={[-0.13, floorY + 0.62, 0]}>
            <boxGeometry args={[0.04, 0.07, 0.18]} />
            {mat('#1b2a20')}
          </mesh>
          <mesh position={[-0.42, floorY + 0.62, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.22, 0.022, 8, 16, Math.PI]} />
            {mat('#c9ccc8', { metalness: 0.7 })}
          </mesh>
          {/* Motor / battery box behind the driver */}
          <mesh position={[-L / 2 + 0.15, floorY + 0.28, 0]} castShadow>
            <boxGeometry args={[0.5, 0.4, 0.5]} />
            {mat('#3a3f3c')}
          </mesh>
          {/* Headlights */}
          {[1, -1].map((s) => (
            <mesh key={s} position={[L / 2 + 0.05, floorY + 0.28, s * 0.25]}>
              <boxGeometry args={[0.04, 0.06, 0.1]} />
              <meshStandardMaterial color="#fff8dc" emissive="#fff3c4" emissiveIntensity={Math.min(8, headlights * 2.5)} toneMapped={false} transparent={ghost} opacity={ghost ? 0.35 : 1} />
            </mesh>
          ))}
          {/* Brake light */}
          <mesh position={[-L / 2 - 0.12, floorY + 0.5, 0]}>
            <boxGeometry args={[0.03, 0.06, 0.16]} />
            <meshStandardMaterial color="#5a1010" emissive="#ff2a1a" emissiveIntensity={Math.min(8, brakeLight * 3)} toneMapped={false} transparent={ghost} opacity={ghost ? 0.35 : 1} />
          </mesh>
        </group>
      )}

      {/* Front wing (the chosen design), mounted on a pylon from the nose */}
      <group position={[fwX, floorY + 0.08, 0]}>
        <mesh position={[-0.3, 0.07, 0]}>
          <boxGeometry args={[0.42, 0.03, 0.08]} />
          {mat('#3a3f3c')}
        </mesh>
        <FrontWing id={look.frontWing} span={T + 0.05} mat={mat} body={body} accent={accent} />
      </group>

      {/* Rear wing: two stalks, main plane + flap, endplates */}
      <group position={[rwX, 0, 0]}>
        {[0.12, -0.12].map((z) => (
          <mesh key={z} position={[0.08, (floorY + 0.3 + rwY) / 2, z]}>
            <boxGeometry args={[0.04, rwY - floorY - 0.3, 0.02]} />
            {mat('#3a3f3c')}
          </mesh>
        ))}
        <group position={[0, rwY, 0]}>
          <mesh rotation={[0, 0, rwAngle * 0.5]} castShadow>
            <boxGeometry args={[0.32, 0.025, 0.95]} />
            {mat(body)}
          </mesh>
          <mesh position={[-0.16, 0.06 + 0.1 * r, 0]} rotation={[0, 0, rwAngle]} castShadow>
            <boxGeometry args={[0.2, 0.018, 0.95]} />
            {mat(accent)}
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} position={[-0.06, 0.04, s * 0.485]}>
              <boxGeometry args={[0.45, 0.32, 0.012]} />
              {mat(body)}
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

type Mat = (color: string, extra?: Partial<THREE.MeshStandardMaterialParameters>) => ReactNode

/**
 * The front wing designs, drawn from the side profile out: a flat plate, one curved element,
 * or a main plane with one or two flaps stacked above and behind it.
 */
function FrontWing({ id, span, mat, body, accent }: { id: FrontWingId; span: number; mat: Mat; body: string; accent: string }) {
  const spec = FRONT_WING_BY_ID[id] ?? FRONT_WING_BY_ID.flat
  const endH = 0.12 + 0.06 * spec.elements
  // [x, y, chord, angle] for each element, front to back.
  const parts: [number, number, number, number][] =
    id === 'flat'
      ? [[0, 0, 0.34, 0.03]]
      : id === 'single'
        ? [
            [0.06, -0.005, 0.18, -0.04],
            [-0.1, 0.012, 0.18, 0.28],
          ]
        : id === 'dual'
          ? [
              [0.02, 0, 0.3, 0.08],
              [-0.15, 0.06, 0.17, 0.45],
            ]
          : [
              [0.03, 0, 0.3, 0.08],
              [-0.13, 0.065, 0.15, 0.42],
              [-0.23, 0.14, 0.12, 0.75],
            ]
  return (
    <group>
      {parts.map(([x, y, chord, angle], i) => (
        <mesh key={i} position={[x, y, 0]} rotation={[0, 0, angle]} castShadow>
          <boxGeometry args={[chord, i === 0 ? 0.022 : 0.016, span]} />
          {mat(i % 2 === 0 ? accent : body)}
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} position={[-0.06, endH / 2 - 0.04, s * (span / 2 + 0.01)]}>
          <boxGeometry args={[0.42, endH, 0.012]} />
          {mat(body)}
        </mesh>
      ))}
    </group>
  )
}
