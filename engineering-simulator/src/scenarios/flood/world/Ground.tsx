import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GRID_H, GRID_W } from '../config'
import { renderTerrain } from '../render/terrain'
import { campus, type FloodRun } from '../sim/engine'
import { UNITS_PER_IN, vx, vz, WATER_EXAG, yOf } from './scale'

const N = GRID_W * GRID_H

/** A W×H vertex grid (one vertex per cell center) with UVs mapping onto the campus texture. */
function gridGeometry(withColor: boolean) {
  const g = new THREE.BufferGeometry()
  const pos = new Float32Array(N * 3)
  const uv = new Float32Array(N * 2)
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      const i = y * GRID_W + x
      pos[i * 3] = vx(x)
      pos[i * 3 + 2] = vz(y)
      uv[i * 2] = vx(x) / GRID_W
      uv[i * 2 + 1] = 1 - vz(y) / GRID_H
    }
  const index: number[] = []
  for (let y = 0; y < GRID_H - 1; y++)
    for (let x = 0; x < GRID_W - 1; x++) {
      const a = y * GRID_W + x
      index.push(a, a + GRID_W, a + 1, a + 1, a + GRID_W, a + GRID_W + 1)
    }
  g.setIndex(index)
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  if (withColor) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 4), 4))
  return g
}

function setHeights(g: THREE.BufferGeometry, bed: Float32Array, lift = 0) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < N; i++) pos.array[i * 3 + 1] = yOf(bed[i]) + lift
  pos.needsUpdate = true
  g.computeVertexNormals()
  g.computeBoundingSphere()
  g.computeBoundingBox()
}

interface TerrainProps {
  bed: Float32Array
  onPointerMove(e: ThreeEvent<PointerEvent>): void
  onPointerDown(e: ThreeEvent<PointerEvent>): void
  onPointerUp(e: ThreeEvent<PointerEvent>): void
  onPointerLeave(): void
}

export function Terrain({ bed, ...handlers }: TerrainProps) {
  const geometry = useMemo(() => gridGeometry(false), [])
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(renderTerrain(document.createElement('canvas'), campus))
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
  useEffect(() => setHeights(geometry, bed), [geometry, bed])
  useEffect(() => () => (geometry.dispose(), texture.dispose()), [geometry, texture])

  return (
    <group>
      <mesh geometry={geometry} receiveShadow {...handlers}>
        <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
      </mesh>
      <Skirt bed={bed} />
    </group>
  )
}

/** Soil-colored sides so the campus reads as a model on a table. */
function Skirt({ bed }: { bed: Float32Array }) {
  const geometry = useMemo(() => {
    const ring: [number, number][] = []
    for (let x = 0; x < GRID_W; x++) ring.push([x, 0])
    for (let y = 1; y < GRID_H; y++) ring.push([GRID_W - 1, y])
    for (let x = GRID_W - 2; x >= 0; x--) ring.push([x, GRID_H - 1])
    for (let y = GRID_H - 2; y > 0; y--) ring.push([0, y])
    ring.push([0, 0])
    const pos: number[] = []
    const bottom = -2.2
    for (let k = 0; k < ring.length - 1; k++) {
      const [x0, y0] = ring[k]
      const [x1, y1] = ring[k + 1]
      const a = [vx(x0), yOf(bed[y0 * GRID_W + x0]), vz(y0)]
      const b = [vx(x1), yOf(bed[y1 * GRID_W + x1]), vz(y1)]
      pos.push(...a, a[0], bottom, a[2], ...b, ...b, a[0], bottom, a[2], b[0], bottom, b[2])
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    return g
  }, [bed])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#6b5a43" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  )
}

const SHALLOW = new THREE.Color('#9fd3e6')
const DEEP = new THREE.Color('#2a6f97')
const tmp = new THREE.Color()

/** The live water surface, rebuilt from the simulation every frame. */
export function Water({ run, bed }: { run: FloodRun | null; bed: Float32Array }) {
  const geometry = useMemo(() => gridGeometry(true), [])
  const mesh = useRef<THREE.Mesh>(null)
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    if (!mesh.current) return
    mesh.current.visible = !!run
    if (!run) return
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    const col = geometry.getAttribute('color') as THREE.BufferAttribute
    const p = pos.array as Float32Array
    const c = col.array as Float32Array
    const w = run.water
    for (let i = 0; i < N; i++) {
      const d = w[i]
      const wet = d > 0.04
      // Dry vertices tuck just under the ground so the water edge feathers out.
      // Thin films are exaggerated so they read; deep water is closer to true scale (no spikes).
      p[i * 3 + 1] = wet ? yOf(bed[i]) + (d + Math.min(d, 2.5) * (WATER_EXAG - 1)) * UNITS_PER_IN + 0.02 : yOf(bed[i]) - 0.04
      const t = Math.min(1, d / 8)
      tmp.copy(SHALLOW).lerp(DEEP, t)
      c[i * 4] = tmp.r
      c[i * 4 + 1] = tmp.g
      c[i * 4 + 2] = tmp.b
      c[i * 4 + 3] = wet ? Math.min(0.92, 0.45 + d * 0.12) : 0
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    geometry.computeVertexNormals()
  })

  return (
    <mesh ref={mesh} geometry={geometry} renderOrder={2}>
      <meshStandardMaterial vertexColors transparent roughness={0.15} metalness={0.1} depthWrite={false} />
    </mesh>
  )
}

/** Max-flood heat map from the last test, laid just above the ground. */
export function FloodOverlay({ maxDepth, bed }: { maxDepth: Float32Array; bed: Float32Array }) {
  const geometry = useMemo(() => gridGeometry(true), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    setHeights(geometry, bed, 0.05)
    const col = geometry.getAttribute('color') as THREE.BufferAttribute
    const c = col.array as Float32Array
    const stops: [number, THREE.Color][] = [
      [0.25, new THREE.Color('#fde68a')],
      [1, new THREE.Color('#fb923c')],
      [2, new THREE.Color('#dc2626')],
      [5, new THREE.Color('#7f1d1d')],
    ]
    for (let i = 0; i < N; i++) {
      const d = maxDepth[i]
      if (d < 0.25) {
        c[i * 4 + 3] = 0
        continue
      }
      let k = 0
      while (k < stops.length - 2 && d > stops[k + 1][0]) k++
      const [d0, c0] = stops[k]
      const [d1, c1] = stops[k + 1]
      tmp.copy(c0).lerp(c1, Math.min(1, Math.max(0, (d - d0) / (d1 - d0))))
      c[i * 4] = tmp.r
      c[i * 4 + 1] = tmp.g
      c[i * 4 + 2] = tmp.b
      c[i * 4 + 3] = 0.78
    }
    col.needsUpdate = true
  }, [geometry, maxDepth, bed])
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial vertexColors transparent depthWrite={false} />
    </mesh>
  )
}
