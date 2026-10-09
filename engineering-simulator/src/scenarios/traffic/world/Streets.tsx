import { useMemo } from 'react'
import { crossingEdge, EXISTING_CROSSWALKS, MAP_H, MAP_W, PED_EDGES, PED_NODE, type Pt } from '../network'
import type { GapId } from '../types'

/**
 * Static streetscape (meters; world X = map x, world Z = map y). Built from the
 * same network data the simulation uses, so what students see matches the model.
 */

const ASPHALT = '#4b5057'
const CONCRETE = '#d8d4c8'
const DIRT = '#a08a68'
const GRASS = '#7fb26a'

/** A flat strip of width w from a to b at height y. */
function Strip({ a, b, w, y, color }: { a: Pt; b: Pt; w: number; y: number; color: string }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  return (
    <mesh position={[(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2]} rotation={[-Math.PI / 2, 0, -ang]} receiveShadow>
      <planeGeometry args={[len + w * 0.02, w]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  )
}

function Rect({ x0, y0, x1, y1, y, color }: { x0: number; y0: number; x1: number; y1: number; y: number; color: string }) {
  return (
    <mesh position={[(x0 + x1) / 2, y, (y0 + y1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[x1 - x0, y1 - y0]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  )
}

function Dashes({ a, b, y, color, dash = 3, gap = 4, w = 0.18 }: { a: Pt; b: Pt; y: number; color: string; dash?: number; gap?: number; w?: number }) {
  const segs = useMemo(() => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const out: [Pt, Pt][] = []
    for (let s = 0; s < len; s += dash + gap) {
      const t0 = s / len
      const t1 = Math.min(1, (s + dash) / len)
      out.push([
        [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0],
        [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1],
      ])
    }
    return out
  }, [a, b, dash, gap])
  return (
    <>
      {segs.map(([p, q], i) => (
        <Strip key={i} a={p} b={q} w={w} y={y} color={color} />
      ))}
    </>
  )
}

/** Zebra stripes across the street for a crossing edge. */
export function Zebra({ edgeIndex, color = '#f5f5f0' }: { edgeIndex: number; color?: string }) {
  const e = PED_EDGES[edgeIndex]
  const a = PED_NODE.get(e.a)!
  const b = PED_NODE.get(e.b)!
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const stripes: Pt[] = []
  for (let s = 2.2; s < len - 2; s += 1.2) stripes.push([a.x + ux * s, a.y + uy * s])
  return (
    <>
      {stripes.map(([x, y], i) => (
        <Strip key={i} a={[x - uy * 2, y + ux * 2]} b={[x + uy * 2, y - ux * 2]} w={0.6} y={0.07} color={color} />
      ))}
    </>
  )
}

function House({ x, z, w, d, h, wall, roof }: { x: number; z: number; w: number; d: number; h: number; wall: string; roof: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wall} roughness={0.9} />
      </mesh>
      <mesh position={[0, h + 1.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.4, 1.4, w * 0.98, 3]} />
        <meshStandardMaterial color={roof} roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

function Block({ x0, y0, x1, y1, h, wall = '#f4f1e8', roof = '#3f6b4a' }: { x0: number; y0: number; x1: number; y1: number; h: number; wall?: string; roof?: string }) {
  const w = x1 - x0
  const d = y1 - y0
  return (
    <group position={[(x0 + x1) / 2, 0, (y0 + y1) / 2]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wall} roughness={0.85} />
      </mesh>
      <mesh position={[0, h + 0.15, 0]} castShadow>
        <boxGeometry args={[w + 0.6, 0.3, d + 0.6]} />
        <meshStandardMaterial color="#e9e5da" roughness={0.9} />
      </mesh>
      <mesh position={[0, h + 0.32, 0]}>
        <boxGeometry args={[w - 1.2, 0.05, d - 1.2]} />
        <meshStandardMaterial color={roof} roughness={0.8} />
      </mesh>
      {/* window band */}
      {[d / 2 + 0.02, -d / 2 - 0.02].map((z) => (
        <mesh key={z} position={[0, h * 0.55, z]}>
          <boxGeometry args={[w * 0.92, h * 0.22, 0.05]} />
          <meshStandardMaterial color="#3d5a4a" roughness={0.3} metalness={0.2} />
        </mesh>
      ))}
    </group>
  )
}

function Tree({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s * 2.2}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 1.2, 6]} />
        <meshStandardMaterial color="#7a5a3a" />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <icosahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial color="#3f7d46" flatShading />
      </mesh>
    </group>
  )
}

const HOUSE_COLORS = ['#e8dcc4', '#d9e2d0', '#f1e6d6', '#dcd3c3', '#e6e0d2']
const ROOF_COLORS = ['#8a5a44', '#5c6b73', '#7a6a55', '#6b4f3f']

/** Everything that never changes: ground, roads, sidewalks, buildings, trees. */
export function Streets({ filledGaps }: { filledGaps: Set<GapId> }) {
  const houses = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; h: number; wall: string; roof: string }[] = []
    let k = 0
    for (let z = 52; z < 240; z += 18) out.push({ x: 16, z, w: 14, d: 11, h: 4.5, wall: HOUSE_COLORS[k % 5], roof: ROOF_COLORS[k++ % 4] })
    for (let z = 52; z < 240; z += 18) out.push({ x: 384, z, w: 14, d: 11, h: 4.5, wall: HOUSE_COLORS[k % 5], roof: ROOF_COLORS[k++ % 4] })
    return out
  }, [])
  const trees = useMemo(() => {
    const out: [number, number, number][] = []
    for (let x = 60; x < 345; x += 22) out.push([x, 44.5, 0.9])
    for (let z = 60; z < 240; z += 25) out.push([50, z, 1], [350, z, 1])
    out.push([175, 60, 1.1], [225, 60, 1.1], [200, 70, 0.9], [120, 225, 1.2], [280, 230, 1.1], [320, 120, 1])
    return out
  }, [])

  return (
    <group>
      {/* Ground + tabletop sides */}
      <Rect x0={0} y0={0} x1={MAP_W} y1={MAP_H} y={0} color={GRASS} />
      <mesh position={[MAP_W / 2, -3.08, MAP_H / 2]}>
        <boxGeometry args={[MAP_W, 6, MAP_H]} />
        <meshStandardMaterial color="#6b5a43" roughness={1} />
      </mesh>

      {/* Campus lawn, plaza, and the loop island */}
      <Rect x0={58} y0={44} x1={342} y1={242} y={0.01} color="#8cc077" />
      <Rect x0={152.5} y0={39} x1={247.5} y1={77.5} y={0.02} color="#93c67d" />
      <Strip a={[200, 41]} b={[200, 100]} w={6} y={0.05} color={CONCRETE} />
      <Rect x0={160} y0={84} x1={240} y1={100} y={0.04} color={CONCRETE} />

      {/* Streets */}
      <Rect x0={0} y0={23} x1={MAP_W} y1={37} y={0.03} color={ASPHALT} />
      <Rect x0={36.5} y0={37} x1={43.5} y1={MAP_H} y={0.03} color={ASPHALT} />
      <Rect x0={356.5} y0={37} x1={363.5} y1={MAP_H} y={0.03} color={ASPHALT} />
      <Rect x0={0} y0={246.5} x1={MAP_W} y1={253.5} y={0.031} color={ASPHALT} />
      <Strip a={[150, 37]} b={[150, 82.25]} w={4.5} y={0.032} color={ASPHALT} />
      <Strip a={[147.75, 80]} b={[252.25, 80]} w={4.5} y={0.032} color={ASPHALT} />
      <Strip a={[250, 82.25]} b={[250, 37]} w={4.5} y={0.032} color={ASPHALT} />
      <Strip a={[363.5, 150]} b={[297.75, 150]} w={4.5} y={0.032} color={ASPHALT} />
      <Strip a={[300, 147.75]} b={[300, 180]} w={4.5} y={0.032} color={ASPHALT} />
      <Rect x0={302} y0={156} x1={350} y1={186} y={0.033} color="#5a5f66" />

      {/* Markings */}
      <Strip a={[0, 29.85]} b={[MAP_W, 29.85]} w={0.16} y={0.06} color="#e8c547" />
      <Strip a={[0, 30.15]} b={[MAP_W, 30.15]} w={0.16} y={0.06} color="#e8c547" />
      <Dashes a={[0, 26.5]} b={[MAP_W, 26.5]} y={0.06} color="#f2f2ec" />
      <Dashes a={[0, 33.5]} b={[MAP_W, 33.5]} y={0.06} color="#f2f2ec" />
      <Dashes a={[40, 40]} b={[40, MAP_H]} y={0.06} color="#e8c547" />
      <Dashes a={[360, 40]} b={[360, MAP_H]} y={0.06} color="#e8c547" />
      <Dashes a={[0, 250]} b={[MAP_W, 250]} y={0.06} color="#e8c547" />

      {/* Sidewalks (and the missing pieces, shown as worn dirt paths) */}
      {PED_EDGES.map((e, i) => {
        if (e.kind === 'cross') return null
        const a = PED_NODE.get(e.a)!
        const b = PED_NODE.get(e.b)!
        const missing = e.kind === 'gap' && !(e.gap && filledGaps.has(e.gap))
        return <Strip key={i} a={[a.x, a.y]} b={[b.x, b.y]} w={missing ? 1.6 : 3} y={0.045} color={missing ? DIRT : CONCRETE} />
      })}
      {EXISTING_CROSSWALKS.map((s) => (
        <Zebra key={s} edgeIndex={crossingEdge(s)} />
      ))}

      {/* School buildings */}
      <Block x0={95} y0={104} x1={305} y1={150} h={11} />
      <Block x0={95} y0={165} x1={165} y1={220} h={13} />
      <Block x0={180} y0={165} x1={295} y1={215} h={9} />
      {/* Apartments north of Main */}
      {[
        [8, 92],
        [108, 192],
        [208, 292],
        [308, 392],
      ].map(([x0, x1]) => (
        <Block key={x0} x0={x0} y0={2} x1={x1} y1={15} h={15} wall="#efe4d2" roof="#8a6f55" />
      ))}
      {houses.map((h, i) => (
        <House key={i} {...h} />
      ))}
      {trees.map(([x, z, s], i) => (
        <Tree key={i} x={x} z={z} s={s} />
      ))}
    </group>
  )
}
