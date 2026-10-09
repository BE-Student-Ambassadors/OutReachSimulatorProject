import { CameraControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { WorldProps } from '../../../core/scenario'
import type { CameraHome } from '../../../shared/three/camera'
import { CameraRig, ViewButtons } from '../../../shared/three/CameraRig'
import { LabelLayer, LabelProjector, type LabelEls, type PinnedLabel } from '../../../shared/three/Labels'
import { CLOCK } from '../config'
import { crossingEdge, MAP_H, MAP_W } from '../network'
import type { TrafficResult, TrafficRun } from '../sim/engine'
import type { GapId, TrafficObject } from '../types'
import { Agents } from './Agents'
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
  const { design, run } = props
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
      <Canvas shadows="percentage" dpr={[1, 1.75]} camera={{ fov: 32, near: 2, far: 3000, position: [...HOME.pos] }} gl={{ antialias: true }}>
        <CameraRig controlsRef={controls} home={HOME} maxDistance={1200} />
        <Lights />
        <LabelProjector labels={LABELS} els={labelEls} />
        <Streets filledGaps={filledGaps} />
        {crosswalks.map((s) => (
          <Zebra key={s} edgeIndex={crossingEdge(s)} />
        ))}
        <Agents run={trafficRun} />
        {import.meta.env.DEV && <TestHook />}
      </Canvas>
      <LabelLayer labels={LABELS} els={labelEls} />
      <ViewButtons controlsRef={controls} home={HOME} zoomStep={60} />
      {trafficRun && <Clock run={trafficRun} />}
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
function TestHook() {
  const { camera, gl } = useThree()
  useEffect(() => {
    const w = window as unknown as { __trafficProject?: (x: number, y: number) => { x: number; y: number } }
    w.__trafficProject = (x, y) => {
      const v = new THREE.Vector3(x, 0, y).project(camera)
      const r = gl.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }
  }, [camera, gl])
  return null
}
