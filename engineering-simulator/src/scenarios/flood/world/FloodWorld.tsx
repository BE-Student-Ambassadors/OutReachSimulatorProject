import { CameraControls } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Compass, Minus, Plus, RotateCcw, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { uid } from '../../../core/format'
import type { WorldProps } from '../../../core/scenario'
import { SURF } from '../campus'
import { GRID_H, GRID_W, POND_SIZE, RAIN_GARDEN_SIZE } from '../config'
import { idx, inBounds } from '../geometry'
import { canPlaceFootprint, canPlacePoint, footprint, isOffLimits, isPaintable, isPipeSource, nodeAt } from '../rules'
import { campus, FloodRun, type FloodResult } from '../sim/engine'
import type { FloodKind, FloodObject, Pt } from '../types'
import { Atmosphere } from './Atmosphere'
import { FloodOverlay, Terrain, Water } from './Ground'
import { ObjectMesh, type Tint } from './Objects'
import { LabelLayer, LabelProjector, type LabelEls, type LabelSpec } from './Labels'
import { buildingExtent, heightAt } from './scale'
import { Buildings, Scenery } from './Scenery'
import { floodUi, useFloodUi } from './uiStore'

type Cell = { x: number; y: number }

const HINTS: Record<string, string> = {
  drain: 'Click the campus to place a storm drain.',
  pipe: 'Drag from a drain or pond to another drain, pond, or outlet.',
  channel: 'Drag to dig a channel. It is graded so water flows from where you start toward where you finish.',
  pond: 'Click the campus to dig a retention pond.',
  rainGarden: 'Click the campus to plant a rain garden.',
  permeable: 'Drag across parking lot, courtyard, or sidewalk paving to replace it.',
  pump: 'Click to place the pump intake.',
  barrier: 'Drag to build a flood barrier.',
  tree: 'Click the campus to plant a tree.',
}

const LABELS: LabelSpec[] = [
  ...campus.buildings.map((b) => ({
    key: b.key,
    pos: [b.x + b.w / 2, buildingExtent(b).tall + 1.2, b.y + b.h / 2] as [number, number, number],
    text: b.name,
    kind: 'building' as const,
    building: b.index,
  })),
  ...campus.outlets.map((o) => {
    const ground = new Float32Array(campus.elevation.map((e) => e * 12))
    return {
      key: o.id,
      pos: [o.x + 0.5, heightAt(ground, o.x + 0.5, o.y + 0.5) + 1.6, o.y + 0.5] as [number, number, number],
      text: o.name,
      kind: 'outlet' as const,
    }
  }),
]

const MOVABLE: FloodKind[] = ['drain', 'tree', 'pump', 'pond', 'rainGarden', 'channel', 'barrier']

function makeObject(kind: string, c: Cell): FloodObject | null {
  switch (kind) {
    case 'drain':
      return { id: uid('drain'), kind: 'drain', x: c.x, y: c.y }
    case 'tree':
      return { id: uid('tree'), kind: 'tree', x: c.x, y: c.y }
    case 'pump':
      return { id: uid('pump'), kind: 'pump', x: c.x, y: c.y, size: 'small', out: { x: c.x, y: c.y } }
    case 'pond': {
      const s = POND_SIZE.medium
      return { id: uid('pond'), kind: 'pond', x: c.x - Math.floor(s / 2), y: c.y - Math.floor(s / 2), size: 'medium' }
    }
    case 'rainGarden':
      return { id: uid('rg'), kind: 'rainGarden', x: c.x - RAIN_GARDEN_SIZE / 2, y: c.y - RAIN_GARDEN_SIZE / 2 }
  }
  return null
}

function isValid(design: FloodObject[], o: FloodObject, ignoreId?: string) {
  const f = footprint(o)
  if (f) return canPlaceFootprint(design, f.x, f.y, f.s, ignoreId)
  if (o.kind === 'drain' || o.kind === 'tree' || o.kind === 'pump') return canPlacePoint(design, o.x, o.y, ignoreId)
  return true
}

function translate(o: FloodObject, dx: number, dy: number): FloodObject {
  switch (o.kind) {
    case 'drain':
    case 'tree':
    case 'pond':
    case 'rainGarden':
      return { ...o, x: o.x + dx, y: o.y + dy }
    case 'pump':
      return { ...o, x: o.x + dx, y: o.y + dy, out: o.out }
    case 'channel':
    case 'barrier':
      return { ...o, points: o.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    default:
      return o
  }
}

const brush = (c: Cell) => [idx(c.x, c.y), idx(c.x + 1, c.y), idx(c.x, c.y + 1), idx(c.x + 1, c.y + 1)].filter((i) => i < GRID_W * GRID_H)

interface Gesture {
  kind: 'stroke' | 'paint' | 'move' | 'pipe'
  points: Pt[]
  cells: Set<number>
  id?: string
  from?: string
  start?: Cell
}

export function FloodWorld(props: WorldProps<FloodObject, FloodResult>) {
  const { design, activeTool, selectedId, locked, debug, run, lastResult, showOverlay, onCommit, onSelect, onToolDone } = props
  const { aimingPump } = useFloodUi()
  const [hover, setHover] = useState<Cell | null>(null)
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const [pipeFromRaw, setPipeFrom] = useState<string | null>(null)
  const pipeFrom = activeTool === 'pipe' ? pipeFromRaw : null
  const hoverRef = useRef<Cell | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const controls = useRef<CameraControls>(null)
  const labelEls = useRef<LabelEls>(new Map())
  const floodRun = run as FloodRun | null

  // The ground shape follows the design: ponds, gardens, and channels are dug into it.
  const bed = useMemo(() => new FloodRun(design).bed, [design])

  useEffect(() => {
    if (locked) floodUi.set({ aimingPump: null })
  }, [locked])

  const setG = (g: Gesture | null) => {
    gestureRef.current = g
    setGesture(g)
  }

  const cellOf = (e: ThreeEvent<PointerEvent>): Cell => ({
    x: Math.max(0, Math.min(GRID_W - 1, Math.floor(e.point.x))),
    y: Math.max(0, Math.min(GRID_H - 1, Math.floor(e.point.z))),
  })

  const extend = (g: Gesture, c: Cell): Gesture => {
    if (g.kind === 'stroke') {
      const last = g.points[g.points.length - 1]
      if (last && last.x === c.x && last.y === c.y) return g
      return { ...g, points: [...g.points, { x: c.x, y: c.y }] }
    }
    if (g.kind === 'paint') {
      const cells = new Set(g.cells)
      for (const i of brush(c)) if (isPaintable(i)) cells.add(i)
      return { ...g, cells }
    }
    return g
  }

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const c = cellOf(e)
    const prev = hoverRef.current
    if (prev && prev.x === c.x && prev.y === c.y) return
    hoverRef.current = c
    setHover(c)
    const g = gestureRef.current
    if (g) setG(extend(g, c))
    else if (!locked && (e.buttons & 1) && activeTool && (activeTool === 'channel' || activeTool === 'barrier' || activeTool === 'permeable')) {
      // Dragged straight from the toolbox: start drawing as soon as the pointer is on the map.
      startTool(c)
    }
  }

  const startTool = (c: Cell) => {
    if (activeTool === 'channel' || activeTool === 'barrier') setG({ kind: 'stroke', points: [{ x: c.x, y: c.y }], cells: new Set() })
    else if (activeTool === 'permeable') setG(extend({ kind: 'paint', points: [], cells: new Set() }, c))
  }

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || locked) return
    const c = cellOf(e)
    hoverRef.current = c
    if (aimingPump) {
      const p = design.find((o) => o.id === aimingPump)
      if (p?.kind === 'pump') onCommit(design.map((o) => (o.id === p.id ? { ...p, out: { x: c.x, y: c.y } } : o)), p.id)
      floodUi.set({ aimingPump: null })
      return
    }
    if (!activeTool) {
      if (!gestureRef.current) onSelect(null)
      return
    }
    if (activeTool === 'pipe') {
      const node = nodeAt(design, c.x, c.y)
      if (!pipeFrom && node && isPipeSource(design, node)) {
        setPipeFrom(node)
        setG({ kind: 'pipe', points: [], cells: new Set(), from: node })
      }
      return
    }
    startTool(c)
  }

  const finish = useCallback(() => {
    const g = gestureRef.current
    const c = hoverRef.current
    setG(null)
    if (locked) return
    if (g?.kind === 'move' && g.id && g.start) {
      const o = design.find((d) => d.id === g.id)
      if (!o || !c) return
      const moved = translate(o, c.x - g.start.x, c.y - g.start.y)
      if ((c.x !== g.start.x || c.y !== g.start.y) && isValid(design, moved, o.id)) onCommit(design.map((d) => (d.id === o.id ? moved : d)), o.id)
      return
    }
    if (g?.kind === 'stroke') {
      const pts = g.points.filter((p) => !isOffLimits(idx(p.x, p.y)))
      if (pts.length >= 2) {
        const o: FloodObject = { id: uid(activeTool ?? 'path'), kind: activeTool === 'barrier' ? 'barrier' : 'channel', points: pts }
        onCommit([...design, o], o.id)
      }
      onToolDone()
      return
    }
    if (g?.kind === 'paint') {
      const taken = new Set(design.flatMap((o) => (o.kind === 'permeable' ? o.cells : [])))
      const cells = [...g.cells].filter((i) => !taken.has(i))
      if (cells.length) {
        const o: FloodObject = { id: uid('perm'), kind: 'permeable', cells }
        onCommit([...design, o], o.id)
      }
      onToolDone()
      return
    }
    if (!c || !activeTool) return
    if (activeTool === 'pipe') {
      const from = g?.from ?? pipeFrom
      const to = nodeAt(design, c.x, c.y)
      if (from && to && to !== from) {
        const exists = design.some((o) => o.kind === 'pipe' && o.from === from && o.to === to)
        if (!exists) {
          const o: FloodObject = { id: uid('pipe'), kind: 'pipe', from, to, size: 'medium' }
          onCommit([...design, o], o.id)
        }
        setPipeFrom(null)
        onToolDone()
      }
      return
    }
    const o = makeObject(activeTool, c)
    if (o && isValid(design, o)) {
      onCommit([...design, o], o.id)
      if (o.kind === 'pump') floodUi.set({ aimingPump: o.id })
      onToolDone()
    }
  }, [activeTool, design, locked, onCommit, onToolDone, pipeFrom])

  // Finish gestures wherever the pointer is released (also handles drops from the toolbox).
  useEffect(() => {
    const up = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (hoverRef.current || gestureRef.current) finish()
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [finish])

  const onObjectDown = (o: FloodObject) => (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || locked || activeTool || aimingPump) return
    e.stopPropagation()
    onSelect(o.id)
    if (MOVABLE.includes(o.kind)) {
      const c = cellOf(e)
      hoverRef.current = c
      setG({ kind: 'move', points: [], cells: new Set(), id: o.id, start: c })
    }
  }

  // ---- previews
  let shown = design
  let ghost: { o: FloodObject; tint: Tint } | null = null
  if (gesture?.kind === 'move' && gesture.id && gesture.start && hover) {
    const o = design.find((d) => d.id === gesture.id)
    if (o) {
      const moved = translate(o, hover.x - gesture.start.x, hover.y - gesture.start.y)
      shown = design.filter((d) => d.id !== o.id)
      ghost = { o: moved, tint: isValid(design, moved, o.id) ? 'ghost' : 'invalid' }
    }
  } else if (gesture?.kind === 'stroke' && gesture.points.length) {
    ghost = { o: { id: 'ghost', kind: activeTool === 'barrier' ? 'barrier' : 'channel', points: gesture.points }, tint: 'ghost' }
  } else if (gesture?.kind === 'paint') {
    ghost = { o: { id: 'ghost', kind: 'permeable', cells: [...gesture.cells] }, tint: 'ghost' }
  } else if (activeTool && hover && !locked && activeTool !== 'pipe' && activeTool !== 'channel' && activeTool !== 'barrier') {
    if (activeTool === 'permeable') {
      const cells = brush(hover)
      ghost = { o: { id: 'ghost', kind: 'permeable', cells }, tint: cells.every(isPaintable) ? 'ghost' : 'invalid' }
    } else {
      const o = makeObject(activeTool, hover)
      if (o) ghost = { o, tint: isValid(design, o) ? 'ghost' : 'invalid' }
    }
  }

  const pipeSource = gesture?.from ?? pipeFrom
  const hoverNode = activeTool === 'pipe' && hover ? nodeAt(design, hover.x, hover.y) : null
  let hint = activeTool ? HINTS[activeTool] : null
  if (activeTool === 'pipe' && pipeSource) hint = 'Now release or click on the drain, pond, or outlet it should carry water to.'
  if (aimingPump) hint = 'Click where the pump should send its water.'
  if (locked) hint = null

  const flowing = !!floodRun && !floodRun.done
  const hoverInfo = debug && hover && inBounds(hover.x, hover.y) ? hover : null

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#dfe9dc] ring-1 ring-black/10" onContextMenu={(e) => e.preventDefault()}>
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        camera={{ fov: 32, near: 1, far: 600, position: [GRID_W / 2, 78, GRID_H + 70] }}
        gl={{ antialias: true }}
        onPointerMissed={() => !activeTool && !aimingPump && onSelect(null)}
      >
        <CameraRig controlsRef={controls} />
        <Atmosphere run={floodRun} />
        <LabelProjector labels={LABELS} els={labelEls} run={floodRun} />
        <Terrain bed={bed} onPointerMove={onMove} onPointerDown={onDown} onPointerUp={() => {}} onPointerLeave={() => {
          hoverRef.current = null
          setHover(null)
        }} />
        <Water run={floodRun} bed={bed} />
        {showOverlay && lastResult && !run && <FloodOverlay maxDepth={lastResult.maxDepth} bed={bed} />}
        <Buildings run={floodRun} />
        <Scenery bed={bed} />
        {shown.map((o) => (
          <ObjectMesh
            key={o.id}
            o={o}
            design={design}
            bed={bed}
            selected={o.id === selectedId || o.id === hoverNode || o.id === pipeSource}
            flowing={flowing}
            onPointerDown={onObjectDown(o)}
          />
        ))}
        {ghost && <ObjectMesh o={ghost.o} design={design} bed={bed} tint={ghost.tint} />}
        {debug && <DebugGrid />}
        {import.meta.env.DEV && <TestHook bed={bed} />}
      </Canvas>

      <LabelLayer labels={LABELS} els={labelEls} />

      {hint && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-forest px-4 py-1.5 text-sm font-medium text-white shadow-lg">
          {hint} <span className="ml-1 text-white/60">Esc to cancel</span>
        </div>
      )}

      <ViewButtons controlsRef={controls} />

      {hoverInfo && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 font-mono text-[11px] text-ink shadow">
          ({hoverInfo.x}, {hoverInfo.y}) · {Object.entries(SURF).find(([, v]) => v === campus.surface[idx(hoverInfo.x, hoverInfo.y)])?.[0]} · elev{' '}
          {campus.elevation[idx(hoverInfo.x, hoverInfo.y)].toFixed(2)} ft · bed {(bed[idx(hoverInfo.x, hoverInfo.y)] / 12).toFixed(2)} ft
        </div>
      )}
    </div>
  )
}

const HOME = { pos: [GRID_W / 2 - 28, 78, GRID_H + 52] as const, target: [GRID_W / 2 + 3, 0, GRID_H / 2] as const }

/** Angled three-quarter view, pulled back just far enough to fit the campus. */
function goHome(c: CameraControls, smooth: boolean, aspect = (c.camera as THREE.PerspectiveCamera).aspect) {
  c.setLookAt(...HOME.pos, ...HOME.target, smooth)
  // Narrower canvases need to pull back further so the east and west edges stay in view.
  c.dollyTo(c.getDistanceToFitSphere(41.5 * Math.max(1, 1.42 / aspect)), smooth)
}

function CameraRig({ controlsRef }: { controlsRef: React.RefObject<CameraControls | null> }) {
  const { size } = useThree()
  // Re-frame the campus whenever the canvas changes size (first layout, window resize).
  useEffect(() => {
    const c = controlsRef.current
    if (c && size.width > 0 && size.height > 0) goHome(c, false, size.width / size.height)
  }, [controlsRef, size.width, size.height])
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    // Left button is for building; right-drag rotates, wheel zooms, middle pans.
    c.mouseButtons.left = 0 // ACTION.NONE
    c.mouseButtons.right = 1 // ACTION.ROTATE
    c.mouseButtons.middle = 2 // ACTION.TRUCK
    c.mouseButtons.wheel = 16 // ACTION.DOLLY
    c.setBoundary(new THREE.Box3(new THREE.Vector3(-10, -5, -10), new THREE.Vector3(GRID_W + 10, 20, GRID_H + 10)))
  }, [controlsRef])
  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={30}
      maxDistance={260}
      minPolarAngle={0.15}
      maxPolarAngle={1.2}
      dollySpeed={0.6}
      azimuthRotateSpeed={0.5}
      polarRotateSpeed={0.5}
      smoothTime={0.2}
    />
  )
}

function ViewButtons({ controlsRef }: { controlsRef: React.RefObject<CameraControls | null> }) {
  const btn = 'grid size-9 place-items-center rounded-lg bg-white/95 text-ink shadow ring-1 ring-black/10 transition hover:bg-white active:scale-95'
  const c = () => controlsRef.current
  return (
    <div className="absolute right-3 top-3 flex items-center gap-1.5">
      <button type="button" title="Rotate left" className={btn} onClick={() => c()?.rotate(-Math.PI / 6, 0, true)}>
        <RotateCcw className="size-4" />
      </button>
      <button type="button" title="Rotate right" className={btn} onClick={() => c()?.rotate(Math.PI / 6, 0, true)}>
        <RotateCw className="size-4" />
      </button>
      <button type="button" title="Zoom in" className={btn} onClick={() => c()?.dolly(12, true)}>
        <Plus className="size-4" />
      </button>
      <button type="button" title="Zoom out" className={btn} onClick={() => c()?.dolly(-12, true)}>
        <Minus className="size-4" />
      </button>
      <button type="button" title="Reset view" className={btn} onClick={() => {
          const cc = c()
          if (cc) goHome(cc, true)
        }}>
        <Compass className="size-4" />
      </button>
      <span className="ml-1 font-mono text-[10px] leading-tight text-ink/55">
        right-drag
        <br />
        to rotate
      </span>
    </div>
  )
}

function DebugGrid() {
  return <gridHelper args={[GRID_W, GRID_W, '#c026d3', '#e879f9']} position={[GRID_W / 2, 3.2, GRID_W / 2]} scale={[1, 1, GRID_H / GRID_W]} />
}

/** Dev-only: lets browser automation convert grid cells to screen pixels. */
function TestHook({ bed }: { bed: Float32Array }) {
  const { camera, gl } = useThree()
  useEffect(() => {
    const w = window as unknown as { __floodProject?: (x: number, y: number) => { x: number; y: number } }
    w.__floodProject = (x, y) => {
      const v = new THREE.Vector3(x, heightAt(bed, x, y), y).project(camera)
      const r = gl.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }
  }, [camera, gl, bed])
  return null
}
