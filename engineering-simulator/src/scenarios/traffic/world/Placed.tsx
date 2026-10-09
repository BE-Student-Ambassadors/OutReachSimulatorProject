import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { BIKE_SEGMENTS, CROSS_SITES, CURB_EDGES, crossingEdge, PED_EDGES, PED_NODE, SIGNAL_NODES, STOP_NODES, type Pt } from '../network'
import type { TrafficRun } from '../sim/engine'
import { BAY_LANES, curbOutline, gapEnds, laneOutline, TURN_LANES } from '../sites'
import type { TrafficObject } from '../types'

/** 3D models for everything students place. Each is clickable to select it. */

function Polyline({ pts, w, y, color, opacity = 1 }: { pts: Pt[]; w: number; y: number; color: string; opacity?: number }) {
  return (
    <>
      {pts.slice(0, -1).map((a, i) => {
        const b = pts[i + 1]
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        if (len < 0.01) return null
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
        return (
          <mesh key={i} position={[(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2]} rotation={[-Math.PI / 2, 0, -ang]} receiveShadow>
            <planeGeometry args={[len + w * 0.6, w]} />
            <meshStandardMaterial color={color} roughness={0.9} transparent={opacity < 1} opacity={opacity} />
          </mesh>
        )
      })}
    </>
  )
}

/** Offset a polyline sideways (positive = right of travel). */
function offset(pts: Pt[], d: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [p[0] - ((b[1] - a[1]) / len) * d, p[1] + ((b[0] - a[0]) / len) * d]
  })
}

/** Wraps a placed item; `hit` adds a generous invisible click target [x, z, radius]. */
function Pick({ id, onSelect, children, hit }: { id: string; onSelect(id: string): void; children: ReactNode; hit?: [number, number, number] }) {
  return (
    <group
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onSelect(id)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {children}
      {hit && (
        <mesh position={[hit[0], 4, hit[1]]}>
          <cylinderGeometry args={[hit[2], hit[2], 8, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function SelectRing({ x, z, r }: { x: number; z: number; r: number }) {
  return (
    <mesh position={[x, 0.3, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
      <ringGeometry args={[r, r + 0.9, 40]} />
      <meshBasicMaterial color="#ffffff" depthTest={false} transparent opacity={0.95} />
    </mesh>
  )
}

function Pole({ x, z, h = 6, color = '#5b605c' }: { x: number; z: number; h?: number; color?: string }) {
  return (
    <mesh position={[x, h / 2, z]} castShadow>
      <cylinderGeometry args={[0.18, 0.22, h, 8]} />
      <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
    </mesh>
  )
}

function SignalHead({ x, z, node, run }: { x: number; z: number; node: keyof typeof SIGNAL_NODES; run: TrafficRun | null }) {
  const red = useRef<THREE.MeshStandardMaterial>(null)
  const green = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    // Lights show what Main Street sees: green in phase A.
    const ph = run ? run.phase(node) : 'A'
    if (red.current) red.current.emissiveIntensity = ph === 'A' ? 0.05 : 1.6
    if (green.current) green.current.emissiveIntensity = ph === 'A' ? 1.6 : 0.05
  })
  return (
    <group position={[x, 0, z]}>
      <Pole x={0} z={0} h={7} />
      <mesh position={[0, 7.4, 0]} castShadow>
        <boxGeometry args={[1.2, 2.6, 1.2]} />
        <meshStandardMaterial color="#2f3a33" />
      </mesh>
      <mesh position={[0, 8.1, 0.62]}>
        <circleGeometry args={[0.38, 16]} />
        <meshStandardMaterial ref={red} color="#5a1610" emissive="#ff2a1a" emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[0, 6.8, 0.62]}>
        <circleGeometry args={[0.38, 16]} />
        <meshStandardMaterial ref={green} color="#11401f" emissive="#2fe36a" emissiveIntensity={1.6} />
      </mesh>
    </group>
  )
}

function Beacon({ x, z, edge, run }: { x: number; z: number; edge: number; run: TrafficRun | null }) {
  const light = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const active = run ? run.edgeBusy[edge] > run.t : false
    if (light.current) light.current.emissiveIntensity = active ? (Math.sin(clock.elapsedTime * 14) > 0 ? 2.4 : 0.2) : 0.15
  })
  return (
    <group position={[x, 0, z]}>
      <Pole x={0} z={0} h={4.5} color="#d9a52b" />
      <mesh position={[0, 4.8, 0]}>
        <boxGeometry args={[1.4, 0.6, 0.5]} />
        <meshStandardMaterial ref={light} color="#7a5a10" emissive="#ffc21a" emissiveIntensity={0.15} />
      </mesh>
    </group>
  )
}

function Guard({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]} scale={2}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.9, 3, 8]} />
        <meshStandardMaterial color="#f07c1a" />
      </mesh>
      <mesh position={[0, 1.75, 0]} castShadow>
        <sphereGeometry args={[0.26, 10, 8]} />
        <meshStandardMaterial color="#c99a72" />
      </mesh>
      <mesh position={[0.55, 1.5, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.06, 8]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
    </group>
  )
}

function StopSign({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Pole x={0} z={0} h={3.6} />
      <mesh position={[0, 3.9, 0]} rotation={[Math.PI / 2, 0, Math.PI / 8]}>
        <cylinderGeometry args={[0.9, 0.9, 0.08, 8]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
    </group>
  )
}

function crossingEnds(site: keyof typeof CROSS_SITES): [Pt, Pt] {
  const e = PED_EDGES[crossingEdge(site)]
  const a = PED_NODE.get(e.a)!
  const b = PED_NODE.get(e.b)!
  return [
    [a.x, a.y],
    [b.x, b.y],
  ]
}

export function PlacedObject({ o, selected, run, onSelect }: { o: TrafficObject; selected: boolean; run: TrafficRun | null; onSelect(id: string): void }) {
  switch (o.kind) {
    case 'crosswalk': {
      const s = CROSS_SITES[o.site]
      return (
        <Pick id={o.id} onSelect={onSelect}>
          {/* invisible hit area over the zebra */}
          <mesh position={[s.x, 0.1, s.y]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[9, 9]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {selected && <SelectRing x={s.x} z={s.y} r={6} />}
        </Pick>
      )
    }
    case 'beacon': {
      const [a, b] = crossingEnds(o.site)
      const edge = crossingEdge(o.site)
      return (
        <Pick id={o.id} onSelect={onSelect} hit={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 8]}>
          <Beacon x={a[0] + 1.5} z={a[1]} edge={edge} run={run} />
          <Beacon x={b[0] + 1.5} z={b[1]} edge={edge} run={run} />
          {selected && <SelectRing x={(a[0] + b[0]) / 2} z={(a[1] + b[1]) / 2} r={7} />}
        </Pick>
      )
    }
    case 'guard': {
      const [, b] = crossingEnds(o.site)
      return (
        <Pick id={o.id} onSelect={onSelect} hit={[b[0], b[1], 5]}>
          <Guard x={b[0] - 1.5} z={b[1]} />
          {selected && <SelectRing x={b[0]} z={b[1]} r={3} />}
        </Pick>
      )
    }
    case 'signal': {
      const n = SIGNAL_NODES[o.node]
      return (
        <Pick id={o.id} onSelect={onSelect} hit={[n.x, n.y, 11]}>
          <SignalHead x={n.x + 5} z={n.y + 9} node={o.node} run={run} />
          <SignalHead x={n.x - 5} z={n.y - 9} node={o.node} run={run} />
          {selected && <SelectRing x={n.x} z={n.y} r={10} />}
        </Pick>
      )
    }
    case 'stop': {
      const n = STOP_NODES[o.node]
      return (
        <Pick id={o.id} onSelect={onSelect} hit={[n.x, n.y, 8]}>
          <StopSign x={n.x + 5} z={n.y + 6} />
          <StopSign x={n.x - 5} z={n.y - 6} />
          {selected && <SelectRing x={n.x} z={n.y} r={7} />}
        </Pick>
      )
    }
    case 'curb': {
      const pts = offset(curbOutline(o.edge), 2.6)
      const [x, y] = pts[Math.floor(pts.length / 2)]
      return (
        <Pick id={o.id} onSelect={onSelect}>
          <Polyline pts={pts} w={2.6} y={0.09} color={selected ? '#c8b6f0' : '#7c5cbf'} opacity={0.85} />
          {selected && <SelectRing x={x} z={y} r={(CURB_EDGES[o.edge].to - CURB_EDGES[o.edge].from) / 2} />}
        </Pick>
      )
    }
    case 'turnLane': {
      const lanes = TURN_LANES[o.site]
      const first = laneOutline(lanes[0])
      const [x, y] = first[Math.floor(first.length / 2)]
      return (
        <Pick id={o.id} onSelect={onSelect}>
          {lanes.map((l) => (
            <Polyline key={l} pts={laneOutline(l)} w={3.4} y={0.05} color={selected ? '#8a9099' : '#4b5057'} />
          ))}
          {lanes.map((l) => (
            <Polyline key={`m${l}`} pts={laneOutline(l).slice(-4, -1)} w={0.5} y={0.08} color="#f2f2ec" />
          ))}
          {selected && <SelectRing x={x} z={y} r={14} />}
        </Pick>
      )
    }
    case 'busBay': {
      const pts = laneOutline(BAY_LANES[o.site])
      const [x, y] = pts[Math.floor(pts.length / 2)]
      return (
        <Pick id={o.id} onSelect={onSelect}>
          <Polyline pts={pts} w={3.6} y={0.05} color="#4b5057" />
          <Polyline pts={offset(pts, 1.6)} w={0.35} y={0.08} color="#f2b81c" />
          <Polyline pts={offset(pts, -1.6)} w={0.35} y={0.08} color="#f2b81c" />
          {selected && <SelectRing x={x} z={y} r={15} />}
        </Pick>
      )
    }
    case 'bikeLane': {
      const pts = BIKE_SEGMENTS[o.segment].pts
      return (
        <Pick id={o.id} onSelect={onSelect}>
          <Polyline pts={pts} w={2} y={0.1} color={selected ? '#9fe0d0' : '#2b8a8a'} />
          {selected && <SelectRing x={(pts[0][0] + pts[1][0]) / 2} z={(pts[0][1] + pts[1][1]) / 2} r={6} />}
        </Pick>
      )
    }
    case 'sidewalk': {
      // The concrete itself is drawn by <Streets>; this is just the hit area.
      const [a, b] = gapEnds(o.gap)
      return (
        <Pick id={o.id} onSelect={onSelect}>
          <Polyline pts={[a, b]} w={4} y={0.12} color="#ffffff" opacity={selected ? 0.5 : 0.01} />
          {selected && <SelectRing x={(a[0] + b[0]) / 2} z={(a[1] + b[1]) / 2} r={6} />}
        </Pick>
      )
    }
    case 'program':
      return null
  }
}

/** Outlines for the active tool's candidate sites (what each option would cover). */
export function SiteOutline({ pts, hot }: { pts: Pt[]; hot: boolean }) {
  return <Polyline pts={pts} w={hot ? 3.2 : 2.2} y={0.2} color={hot ? '#2c5b3c' : '#74a85f'} opacity={hot ? 0.95 : 0.6} />
}
