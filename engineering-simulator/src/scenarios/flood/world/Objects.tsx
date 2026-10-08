import { Line } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { GRID_W, POND_SIZE, RAIN_GARDEN_SIZE, SIM } from '../config'
import { nodePosition } from '../cost'
import { rasterizePath } from '../geometry'
import type { FloodObject, Pt } from '../types'
import { TreeModel } from './Scenery'
import { heightAt } from './scale'

const ACCENT = {
  drain: '#3d4a43',
  pipe: '#7c5cbf',
  channel: '#2b9fb3',
  pond: '#2a6f97',
  rainGarden: '#c4568d',
  permeable: '#d9b45a',
  pump: '#e07a2e',
  barrier: '#9aa19c',
  tree: '#3f7d46',
}

export type Tint = 'none' | 'ghost' | 'invalid'

const tintColor = (tint: Tint, base: string) => (tint === 'invalid' ? '#d4380d' : tint === 'ghost' ? '#3d8b4f' : base)

function M({ color, tint = 'none', ...rest }: { color: string; tint?: Tint } & Partial<THREE.MeshStandardMaterialParameters>) {
  return (
    <meshStandardMaterial
      color={tintColor(tint, color)}
      transparent={tint !== 'none'}
      opacity={tint === 'none' ? 1 : 0.6}
      roughness={0.7}
      {...rest}
    />
  )
}

function SelectRing({ radius, y = 0.06 }: { radius: number; y?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} renderOrder={5}>
      <ringGeometry args={[radius, radius + 0.18, 40]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthTest={false} />
    </mesh>
  )
}

function RadiusDisc({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} renderOrder={4}>
      <circleGeometry args={[radius, 40]} />
      <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} />
    </mesh>
  )
}

interface ObjProps {
  o: FloodObject
  design: FloodObject[]
  bed: Float32Array
  selected?: boolean
  tint?: Tint
  flowing?: boolean
  onPointerDown?(e: ThreeEvent<PointerEvent>): void
}

const at = (bed: Float32Array, x: number, y: number) => [x, heightAt(bed, x, y), y] as const

function Pickable({ children, onPointerDown }: { children: ReactNode; onPointerDown?: ObjProps['onPointerDown'] }) {
  return (
    <group
      onPointerDown={onPointerDown}
      onPointerOver={() => onPointerDown && (document.body.style.cursor = 'grab')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {children}
    </group>
  )
}

export function ObjectMesh(props: ObjProps) {
  const { o, bed, selected, tint = 'none', onPointerDown } = props
  switch (o.kind) {
    case 'drain':
      return (
        <Pickable onPointerDown={onPointerDown}>
          <group position={at(bed, o.x + 0.5, o.y + 0.5)}>
            <mesh position={[0, 0.06, 0]} castShadow>
              <boxGeometry args={[0.95, 0.12, 0.95]} />
              <M color="#2f3833" tint={tint} metalness={0.6} roughness={0.4} />
            </mesh>
            {[-0.25, 0, 0.25].map((dx) => (
              <mesh key={dx} position={[dx, 0.125, 0]}>
                <boxGeometry args={[0.08, 0.02, 0.75]} />
                <M color="#8a948e" tint={tint} metalness={0.7} />
              </mesh>
            ))}
            {(selected || tint !== 'none') && <RadiusDisc radius={SIM.drain.radius} color="#2a6f97" />}
            {selected && <SelectRing radius={0.8} />}
          </group>
        </Pickable>
      )
    case 'tree':
      return (
        <Pickable onPointerDown={onPointerDown}>
          <group position={at(bed, o.x + 0.5, o.y + 0.5)}>
            <TreeModel color={tint === 'none' ? ACCENT.tree : tintColor(tint, '')} />
            {(selected || tint !== 'none') && <RadiusDisc radius={SIM.tree.radius} color="#3f7d46" />}
            {selected && <SelectRing radius={1} />}
          </group>
        </Pickable>
      )
    case 'pond':
      return <PondMesh {...props} o={o} />
    case 'rainGarden':
      return <GardenMesh {...props} o={o} />
    case 'pump':
      return <PumpMesh {...props} o={o} />
    case 'barrier':
      return <BarrierMesh {...props} points={o.points} />
    case 'channel':
      return <ChannelMesh {...props} points={o.points} />
    case 'permeable':
      return <PermeableMesh {...props} cells={o.cells} />
    case 'pipe':
      return <PipeMesh {...props} o={o} />
  }
}

function PondMesh({ o, bed, selected, tint = 'none', onPointerDown }: ObjProps & { o: Extract<FloodObject, { kind: 'pond' }> }) {
  const s = POND_SIZE[o.size]
  const cx = o.x + s / 2
  const cz = o.y + s / 2
  const floor = heightAt(bed, cx, cz)
  const rim = Math.max(heightAt(bed, o.x - 0.5, o.y - 0.5), heightAt(bed, o.x + s + 0.5, o.y + s + 0.5), floor + 0.6)
  return (
    <Pickable onPointerDown={onPointerDown}>
      <group>
        <mesh position={[cx, floor + 0.02, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[s - 0.2, s - 0.2]} />
          <M color="#7b6a4f" tint={tint} roughness={1} />
        </mesh>
        {/* Stone edging */}
        {[
          [cx, o.y, s + 0.4, 0.4],
          [cx, o.y + s, s + 0.4, 0.4],
          [o.x, cz, 0.4, s],
          [o.x + s, cz, 0.4, s],
        ].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, rim + 0.08, z]} castShadow>
            <boxGeometry args={[w, 0.25, d]} />
            <M color="#b9b3a3" tint={tint} roughness={0.9} />
          </mesh>
        ))}
        {tint !== 'none' && (
          <mesh position={[cx, rim - 0.2, cz]}>
            <boxGeometry args={[s, 0.6, s]} />
            <M color="#2a6f97" tint={tint} />
          </mesh>
        )}
        {selected && (
          <group position={[cx, rim, cz]}>
            <SelectRing radius={s * 0.72} y={0.3} />
          </group>
        )}
      </group>
    </Pickable>
  )
}

function GardenMesh({ o, bed, selected, tint = 'none', onPointerDown }: ObjProps & { o: Extract<FloodObject, { kind: 'rainGarden' }> }) {
  const s = RAIN_GARDEN_SIZE
  const cx = o.x + s / 2
  const cz = o.y + s / 2
  const y = heightAt(bed, cx, cz)
  const flowers = useMemo(() => {
    const out: [number, number, string][] = []
    for (let i = 0; i < 18; i++) {
      const a = (i * 137.5 * Math.PI) / 180
      const r = Math.sqrt((i + 0.5) / 18) * (s / 2 - 0.4)
      out.push([Math.cos(a) * r, Math.sin(a) * r, i % 3 === 0 ? '#f0a3c4' : i % 3 === 1 ? '#c4568d' : '#f7e07a'])
    }
    return out
  }, [s])
  return (
    <Pickable onPointerDown={onPointerDown}>
      <group position={[cx, y, cz]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
          <planeGeometry args={[s - 0.1, s - 0.1]} />
          <M color="#5b4a36" tint={tint} roughness={1} />
        </mesh>
        {flowers.map(([x, z, c], i) => (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.25, 0]}>
              <coneGeometry args={[0.28, 0.5, 5]} />
              <M color="#4d8a4f" tint={tint} flatShading />
            </mesh>
            <mesh position={[0, 0.55, 0]}>
              <sphereGeometry args={[0.13, 6, 5]} />
              <M color={c} tint={tint} />
            </mesh>
          </group>
        ))}
        {selected && <SelectRing radius={s * 0.72} y={0.6} />}
      </group>
    </Pickable>
  )
}

function PumpMesh({ o, bed, selected, tint = 'none', onPointerDown }: ObjProps & { o: Extract<FloodObject, { kind: 'pump' }> }) {
  const [x, y, z] = at(bed, o.x + 0.5, o.y + 0.5)
  const out = at(bed, Math.max(0, Math.min(GRID_W, o.out.x + 0.5)), o.out.y + 0.5)
  const fan = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => fan.current && (fan.current.rotation.y += dt * 6))
  const big = o.size === 'large'
  const hasOut = o.out.x !== o.x || o.out.y !== o.y
  return (
    <group>
      <Pickable onPointerDown={onPointerDown}>
        <group position={[x, y, z]} scale={big ? 1.25 : 1}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[1.1, 0.7, 1.1]} />
            <M color={ACCENT.pump} tint={tint} roughness={0.5} />
          </mesh>
          <mesh ref={fan} position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.1, 6]} />
            <M color="#3a3f3c" tint={tint} metalness={0.6} />
          </mesh>
          {(selected || tint !== 'none') && <RadiusDisc radius={SIM.pump.radius} color="#e07a2e" />}
          {selected && <SelectRing radius={0.95} />}
        </group>
      </Pickable>
      {hasOut && (
        <>
          <Line
            points={arc([x, y + 0.8, z], [out[0], out[1] + 0.3, out[2]])}
            raycast={() => null}
            color={ACCENT.pump}
            lineWidth={2.5}
            dashed
            dashSize={0.6}
            gapSize={0.35}
          />
          <mesh position={[out[0], out[1] + 0.1, out[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.35, 0.6, 24]} />
            <meshBasicMaterial color={ACCENT.pump} />
          </mesh>
        </>
      )}
    </group>
  )
}

/** A raised arc between two points (for pump discharge hoses). */
function arc(a: readonly [number, number, number], b: readonly [number, number, number], lift = 2.5) {
  const pts: [number, number, number][] = []
  const len = Math.hypot(b[0] - a[0], b[2] - a[2])
  const h = Math.min(lift + len * 0.04, 6)
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * h, a[2] + (b[2] - a[2]) * t])
  }
  return pts
}

/** Douglas–Peucker: turns a staircase of cells into a smooth polyline. */
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts
  const [a, b] = [pts[0], pts[pts.length - 1]]
  let worst = 0
  let at = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len
    if (d > worst) {
      worst = d
      at = i
    }
  }
  if (worst <= tol) return [a, b]
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)]
}

function cellCenters(cells: number[]) {
  return cells.map((c) => ({ x: (c % GRID_W) + 0.5, y: Math.floor(c / GRID_W) + 0.5 }))
}

function BarrierMesh({ points, bed, selected, tint = 'none', onPointerDown }: ObjProps & { points: Pt[] }) {
  const cells = useMemo(() => cellCenters(rasterizePath(points)), [points])
  return (
    <Pickable onPointerDown={onPointerDown}>
      <group>
        {cells.map((c, i) => (
          <mesh key={i} position={[c.x, heightAt(bed, c.x, c.y) + 0.35, c.y]} castShadow receiveShadow>
            <boxGeometry args={[1.02, 0.7, 1.02]} />
            <M color={selected ? '#c9cfca' : ACCENT.barrier} tint={tint} roughness={0.85} />
          </mesh>
        ))}
        {cells.map((c, i) => (
          <mesh key={`s${i}`} position={[c.x, heightAt(bed, c.x, c.y) + 0.72, c.y]}>
            <boxGeometry args={[1.03, 0.06, 1.03]} />
            <M color={selected ? '#ffffff' : '#e07a2e'} tint={tint} />
          </mesh>
        ))}
      </group>
    </Pickable>
  )
}

function ChannelMesh({ points, bed, selected, tint = 'none', onPointerDown }: ObjProps & { points: Pt[] }) {
  const cells = useMemo(() => cellCenters(rasterizePath(points)), [points])
  if (cells.length < 2) return null
  const line = simplify(cells, 0.75).map((c) => [c.x, heightAt(bed, c.x, c.y) + 0.12, c.y] as [number, number, number])
  const last = line[line.length - 1]
  const prev = line[line.length - 2]
  const ang = Math.atan2(last[0] - prev[0], last[2] - prev[2])
  return (
    <Pickable onPointerDown={onPointerDown}>
      <group>
        {cells.map((c, i) => (
          <mesh key={i} position={[c.x, heightAt(bed, c.x, c.y) + 0.03, c.y]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[1.05, 1.05]} />
            <M color="#8c7a5c" tint={tint} roughness={1} />
          </mesh>
        ))}
        <Line points={line} raycast={() => null} color={selected ? '#ffffff' : tintColor(tint, ACCENT.channel)} lineWidth={selected ? 5 : 3.5} />
        {/* Arrowhead shows the direction water is graded to flow. */}
        <mesh position={[last[0], last[1] + 0.25, last[2]]} rotation={[Math.PI / 2, 0, -ang]}>
          <coneGeometry args={[0.45, 0.9, 3]} />
          <meshBasicMaterial color={tintColor(tint, ACCENT.channel)} />
        </mesh>
      </group>
    </Pickable>
  )
}

function PermeableMesh({ cells, bed, selected, tint = 'none', onPointerDown }: ObjProps & { cells: number[] }) {
  const pts = useMemo(() => cellCenters(cells), [cells])
  return (
    <Pickable onPointerDown={onPointerDown}>
      <group>
        {pts.map((c, i) => (
          <mesh key={i} position={[c.x, heightAt(bed, c.x, c.y) + 0.035, c.y]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[0.94, 0.94]} />
            <M color={selected ? '#f1d98e' : ACCENT.permeable} tint={tint} roughness={1} />
          </mesh>
        ))}
      </group>
    </Pickable>
  )
}

function PipeMesh({ o, design, bed, selected, flowing, onPointerDown }: ObjProps & { o: Extract<FloodObject, { kind: 'pipe' }> }) {
  const a = nodePosition(design, o.from)
  const b = nodePosition(design, o.to)
  const ref = useRef<{ material: { dashOffset: number } } | null>(null)
  useFrame((_, dt) => {
    if (flowing && ref.current) ref.current.material.dashOffset -= dt * 3
  })
  if (!a || !b) return null
  const width = o.size === 'large' ? 6 : o.size === 'medium' ? 4.5 : 3
  const pa: [number, number, number] = [a.x, heightAt(bed, a.x, a.y) + 0.22, a.y]
  const pb: [number, number, number] = [b.x, heightAt(bed, b.x, b.y) + 0.22, b.y]
  const mid: [number, number, number] = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2]
  const ang = Math.atan2(pb[0] - pa[0], pb[2] - pa[2])
  return (
    <Pickable onPointerDown={onPointerDown}>
      <group>
        <Line
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={ref as any}
          points={[pa, pb]}
          raycast={() => null}
          color={selected ? '#ffffff' : ACCENT.pipe}
          lineWidth={width}
          dashed
          dashSize={0.9}
          gapSize={0.35}
        />
        <mesh position={mid} rotation={[Math.PI / 2, 0, -ang]}>
          <coneGeometry args={[0.5, 1, 3]} />
          <meshBasicMaterial color={selected ? '#ffffff' : ACCENT.pipe} />
        </mesh>
      </group>
    </Pickable>
  )
}
