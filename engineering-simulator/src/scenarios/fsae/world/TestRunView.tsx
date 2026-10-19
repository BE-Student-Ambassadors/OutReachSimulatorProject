import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { getElectrical, getMechanical } from '../config'
import type { FsaeRun } from '../sim/engine'
import { readAll } from '../sim/power'
import { getTrack } from '../sim/track'
import type { FsaeObject } from '../types'
import { lookOf, poseAt, type Pose } from './look'
import { ChaseCamera, TrackCar, TrackScene } from './TrackScene'

/** The Competition Test playing out: an autocross lap at full speed, then the driverless lap. */
export function TestRunView({ run, design }: { run: FsaeRun; design: FsaeObject[] }) {
  const track = getTrack()
  const look = lookOf(getMechanical(design))
  const lights = readAll(getElectrical(design)).headlights.level
  const night = run.variant === 'night'
  const knocked = useMemo(() => new Set<number>(), [])
  const pose = useRef<Pose & { braking: boolean }>({ ...poseAt(track, 0), braking: false })

  // Each driverless gate is a pair of cones; a missed gate knocks over the cone on alternating sides.
  const gateCone = useMemo(() => {
    const out: number[] = []
    for (let g = 0; g < run.result().driverless.gates; g++) {
      const s = run.gateSample(g)
      let best = 0
      let bd = Infinity
      track.cones.forEach((c, i) => {
        if (c.side !== (g % 2 ? 'left' : 'right')) return
        const d = Math.min(Math.abs(c.i - s), track.x.length - Math.abs(c.i - s))
        if (d < bd) {
          bd = d
          best = i
        }
      })
      out.push(best)
    }
    return out
  }, [run, track])

  const hud = useRef<{ phase: HTMLDivElement | null; clock: HTMLDivElement | null; speed: HTMLDivElement | null; cones: HTMLDivElement | null }>({ phase: null, clock: null, speed: null, cones: null })
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const f = run.frame()
      const h = hud.current
      if (h.phase) h.phase.textContent = f.phase === 'autocross' ? 'Autocross lap' : 'Driverless lap'
      if (h.clock) h.clock.textContent = `${f.clockS.toFixed(2)} s`
      if (h.speed) h.speed.textContent = `${Math.round(f.speedMph)} mph`
      if (h.cones) h.cones.textContent = f.phase === 'driverless' ? `${f.knocked.length} hit · ${f.gateIndex}/${run.result().driverless.gates} gates` : '—'
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl ring-1 ring-line">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 55, near: 0.2, far: 800 }}>
        <TrackScene night={night} knocked={knocked} />
        <RunDriver run={run} poseRef={pose} knocked={knocked} gateCone={gateCone} />
        <TrackCar get={() => pose.current} look={look} night={night} headlights={lights} brake={() => pose.current.braking} />
        <ChaseCamera get={() => pose.current} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto flex w-fit items-center gap-6 rounded-2xl bg-ink/90 px-5 py-2.5 text-white shadow-xl">
        <Stat label={night ? 'Night test' : 'Competition test'} refEl={(el) => { hud.current.phase = el }} big={false} />
        <Stat label="Lap clock" refEl={(el) => { hud.current.clock = el }} />
        <Stat label="Speed" refEl={(el) => { hud.current.speed = el }} />
        <Stat label="Cones" refEl={(el) => { hud.current.cones = el }} big={false} />
      </div>
    </div>
  )
}

function Stat({ label, refEl, big = true }: { label: string; refEl(el: HTMLDivElement | null): void; big?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-white/55">{label}</div>
      <div ref={refEl} className={`font-mono font-bold tabular ${big ? 'text-xl' : 'text-sm text-mint'}`} />
    </div>
  )
}

function RunDriver({ run, poseRef, knocked, gateCone }: { run: FsaeRun; poseRef: { current: Pose & { braking: boolean } }; knocked: Set<number>; gateCone: number[] }) {
  const track = getTrack()
  const lastSpeed = useRef(0)
  useFrame(() => {
    const f = run.frame()
    poseRef.current = { ...poseAt(track, f.pos), braking: f.speedMph < lastSpeed.current - 0.05 }
    lastSpeed.current = f.speedMph
    knocked.clear()
    for (const g of f.knocked) knocked.add(gateCone[g])
  })
  return null
}
