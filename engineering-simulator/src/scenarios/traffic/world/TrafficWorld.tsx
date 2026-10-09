import { CameraControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { WorldProps } from '../../../core/scenario'
import type { CameraHome } from '../../../shared/three/camera'
import { CameraRig, ViewButtons } from '../../../shared/three/CameraRig'
import { LabelLayer, LabelProjector, type LabelEls, type PinnedLabel } from '../../../shared/three/Labels'
import { CLOCK } from '../config'
import { crossingEdge, MAP_H, MAP_W } from '../network'
import type { TrafficResult, TrafficRun } from '../sim/engine'
import type { GapId, TrafficObject } from '../types'
import { sitesFor, type Site } from '../sites'
import { Agents } from './Agents'
import { DelayMap } from './DelayMap'
import { PlacedObject, SiteOutline } from './Placed'
import { Streets, Zebra } from './Streets'

const HOME: CameraHome = {
  pos: [MAP_W / 2 - 115, 320, MAP_H + 215],
  target: [MAP_W / 2 + 10, 0, MAP_H / 2],
  radius: 158,
  bounds: new THREE.Box3(new THREE.Vector3(-40, -10, -40), new THREE.Vector3(MAP_W + 40, 80, MAP_H + 40)),
}

const LABELS: PinnedLabel[] = [
  { key: 'main', pos: [95, 1, 30], text: 'Main St', tone: 'street' },
  { key: 'oak', pos: [40, 1, 200], text: 'Oak Ave', tone: 'street' },
  { key: 'elm', pos: [360, 1, 215], text: 'Elm St', tone: 'street' },
  { key: 'pine', pos: [120, 1, 250], text: 'Pine St', tone: 'street' },
  { key: 'school', pos: [200, 14, 127], text: 'Sequoia High School', tone: 'place' },
  { key: 'entrance', pos: [200, 3, 44], text: 'Main entrance', tone: 'tag' },
  { key: 'loop', pos: [200, 2, 80], text: 'Drop-off loop', tone: 'tag' },
  { key: 'side', pos: [350, 3, 150], text: 'Side gate', tone: 'tag' },
  { key: 'apts', pos: [250, 17, 8], text: 'Apartments', tone: 'place' },
]

export function TrafficWorld(props: WorldProps<TrafficObject, TrafficResult>) {
  const { design, run, activeTool, selectedId, locked, onCommit, onSelect, onToolDone, lastResult, showOverlay } = props
  const pinEls = useRef<LabelEls>(new Map())
  const overlay = showOverlay && lastResult && !run ? lastResult : null
  const pins = useMemo(
    () => (overlay ? overlay.unsafeSpots.map((p, i) => ({ key: `pin${i}`, pos: [p.x, 3, p.y] as [number, number, number], students: p.students, name: p.name })) : []),
    [overlay],
  )
  const [hot, setHot] = useState<string | null>(null)
  const siteEls = useRef<LabelEls>(new Map())
  const sites = useMemo(() => (activeTool && !locked ? sitesFor(activeTool, design) : []), [activeTool, locked, design])
  const anchors = useMemo(() => sites.map((s) => ({ key: s.key, pos: [s.x, 4, s.y] as [number, number, number] })), [sites])
  const place = (site: Site) => {
    const o = site.make()
    onCommit([...design, o], o.id)
    onToolDone()
    setHot(null)
  }
  const trafficRun = run as TrafficRun | null
  const controls = useRef<CameraControls>(null)
  const labelEls = useRef<LabelEls>(new Map())
  const filledGaps = useMemo(() => new Set<GapId>(design.flatMap((o) => (o.kind === 'sidewalk' ? [o.gap] : []))), [design])
  const crosswalks = useMemo(
    () => [...new Set(design.flatMap((o) => (o.kind === 'crosswalk' || o.kind === 'beacon' || o.kind === 'guard' ? [o.site] : [])))],
    [design],
  )

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#dfe9dc] ring-1 ring-black/10" onContextMenu={(e) => e.preventDefault()}>
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        camera={{ fov: 32, near: 2, far: 3000, position: [...HOME.pos] }}
        gl={{ antialias: true }}
        onPointerMissed={() => !activeTool && onSelect(null)}
      >
        <CameraRig controlsRef={controls} home={HOME} maxDistance={1200} />
        <Lights />
        <LabelProjector labels={LABELS} els={labelEls} />
        <Streets filledGaps={filledGaps} />
        {crosswalks.map((s) => (
          <Zebra key={s} edgeIndex={crossingEdge(s)} />
        ))}
        {design.map((o) => (
          <PlacedObject key={o.id} o={o} selected={o.id === selectedId} run={trafficRun} onSelect={(id) => !locked && !activeTool && onSelect(id)} />
        ))}
        {sites.map((s) => s.outline && <SiteOutline key={s.key} pts={s.outline} hot={hot === s.key} />)}
        <LabelProjector labels={anchors} els={siteEls} />
        <Agents run={trafficRun} />
        {overlay && <DelayMap result={overlay} />}
        <LabelProjector labels={pins} els={pinEls} />
        {import.meta.env.DEV && <TestHook run={trafficRun} />}
      </Canvas>
      <LabelLayer labels={LABELS} els={labelEls} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pins.map((p) => (
          <div
            key={p.key}
            ref={(el) => {
              if (el) pinEls.current.set(p.key, el)
              else pinEls.current.delete(p.key)
            }}
            className="absolute left-0 top-0 will-change-transform"
            style={{ visibility: 'hidden' }}
            title={p.name}
          >
            <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-rust px-2 py-0.5 font-mono text-[11px] font-semibold text-white shadow-lg ring-2 ring-white">
              ! {p.students} unsafe
            </span>
          </div>
        ))}
      </div>
      <SiteButtons sites={sites} els={siteEls} hot={hot} onHover={setHot} onPick={place} />
      {activeTool && !locked && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-forest px-4 py-1.5 text-sm font-medium text-white shadow-lg">
          {sites.length ? 'Pick one of the highlighted spots.' : 'There are no more spots for this tool.'} <span className="ml-1 text-white/60">Esc to cancel</span>
        </div>
      )}
      <ViewButtons controlsRef={controls} home={HOME} zoomStep={60} />
      {trafficRun && <Clock run={trafficRun} />}
    </div>
  )
}

/** Clickable markers for the armed tool's candidate sites, pinned to the 3D map. */
function SiteButtons({ sites, els, hot, onHover, onPick }: { sites: Site[]; els: React.RefObject<LabelEls>; hot: string | null; onHover(k: string | null): void; onPick(s: Site): void }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {sites.map((s) => (
        <div
          key={s.key}
          ref={(el) => {
            if (el) els.current.set(s.key, el)
            else els.current.delete(s.key)
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ visibility: 'hidden' }}
        >
          <button
            type="button"
            onClick={() => onPick(s)}
            onPointerEnter={() => onHover(s.key)}
            onPointerLeave={() => onHover(null)}
            className={`pointer-events-auto flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-1 pr-2.5 text-xs font-semibold shadow-lg ring-2 transition ${
              hot === s.key ? 'scale-105 bg-forest text-white ring-white' : 'bg-white text-ink ring-forest/70'
            }`}
          >
            <span className={`grid size-5 place-items-center rounded-full text-sm leading-none ${hot === s.key ? 'bg-white text-forest' : 'bg-forest text-white'}`}>+</span>
            {hot === s.key ? (
              <>
                {s.name} <span className="font-mono font-medium opacity-80">${s.cost.toLocaleString()}</span>
              </>
            ) : (
              <span className="font-mono font-medium">${(s.cost / 1000).toFixed(s.cost < 10000 ? 1 : 0)}k</span>
            )}
          </button>
        </div>
      ))}
    </div>
  )
}

function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null)
  const aim = useRef<THREE.Object3D>(null)
  useEffect(() => {
    if (sun.current && aim.current) sun.current.target = aim.current
  }, [])
  return (
    <>
      <color attach="background" args={['#e3ecdf']} />
      <object3D ref={aim} position={[MAP_W / 2, 0, MAP_H / 2]} />
      <hemisphereLight args={['#f6f8ef', '#5d6b4f', 1.15]} />
      {/* Low morning sun from the east */}
      <directionalLight
        ref={sun}
        position={[MAP_W / 2 + 160, 180, MAP_H / 2 - 120]}
        intensity={2.3}
        color="#fff3dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-260}
        shadow-camera-right={260}
        shadow-camera-top={260}
        shadow-camera-bottom={-260}
        shadow-camera-near={10}
        shadow-camera-far={700}
        shadow-bias={-0.0004}
      />
    </>
  )
}

/** Big clock and bell countdown, updated straight from the run each frame. */
function Clock({ run }: { run: TrafficRun }) {
  const time = useRef<HTMLDivElement>(null)
  const bell = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (time.current) time.current.textContent = run.clockLabel()
      if (bell.current) {
        const s = run.secondsToBell
        bell.current.textContent = s > 0 ? `Bell in ${Math.ceil(s / 60)} min` : 'Bell has rung'
        bell.current.style.color = s > 0 ? (s < 300 ? '#b8461b' : '') : '#b8461b'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run])
  return (
    <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-white/95 px-4 py-2 shadow ring-1 ring-black/10">
      <div ref={time} className="font-mono text-3xl font-semibold leading-none text-ink tabular">
        {`${Math.floor(CLOCK.startMin / 60)}:${String(CLOCK.startMin % 60).padStart(2, '0')}`}
      </div>
      <div ref={bell} className="mt-1 text-xs font-semibold text-ink/60" />
    </div>
  )
}

/** Dev-only: lets browser automation convert map meters to screen pixels. */
function TestHook({ run }: { run: TrafficRun | null }) {
  const { camera, gl } = useThree()
  useEffect(() => {
    const w = window as unknown as { __trafficProject?: (x: number, y: number) => { x: number; y: number }; __trafficFlashes?: () => number }
    w.__trafficFlashes = () => run?.flashes.length ?? 0 // total so far
    w.__trafficProject = (x, y) => {
      const v = new THREE.Vector3(x, 0, y).project(camera)
      const r = gl.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }
  }, [camera, gl, run])
  return null
}
