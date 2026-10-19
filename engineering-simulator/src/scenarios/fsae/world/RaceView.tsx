import { Canvas, useFrame } from '@react-three/fiber'
import { Flag, LogOut } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CONE_PENALTY_S, getElectrical, getMechanical, TRACE_DT } from '../config'
import type { CarParams } from '../sim/car'
import { MS_TO_MPH } from '../sim/car'
import { readAll } from '../sim/power'
import { pushTrace, startState, stepDrive, tracePose, type DriveInput, type DriveState } from '../sim/race'
import { getTrack } from '../sim/track'
import type { FsaeObject, LapObject } from '../types'
import { GHOST_COLORS, lookOf } from './look'
import { ChaseCamera, TrackCar, TrackScene } from './TrackScene'

export interface FinishedLap {
  driveS: number
  conesHit: number
  trace: number[]
}

/**
 * One driver's lap of a heat. The countdown is tied to the wall clock (`startAt`), so every
 * teammate's screen turns green at the same moment. Teammates' laps from earlier heats drive
 * alongside as ghosts.
 */
export function RaceView({
  design,
  params,
  startAt,
  night,
  heat,
  ghosts,
  onFinish,
  onExit,
}: {
  design: FsaeObject[]
  params: CarParams
  startAt: number
  night: boolean
  heat: number
  ghosts: LapObject[]
  onFinish(lap: FinishedLap): void
  onExit(): void
}) {
  const track = getTrack()
  const look = lookOf(getMechanical(design))
  const lights = readAll(getElectrical(design)).headlights.level
  const input = useRef<DriveInput>({ throttle: 0, brake: 0, steer: 0 })
  const state = useRef<DriveState>(startState(track))
  const [result, setResult] = useState<FinishedLap | null>(null)
  const hud = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const keys = new Set<string>()
    const apply = () => {
      const has = (...k: string[]) => k.some((x) => keys.has(x))
      input.current = {
        throttle: has('arrowup', 'w') ? 1 : 0,
        brake: has('arrowdown', 's', ' ') ? 1 : 0,
        steer: (has('arrowleft', 'a') ? 1 : 0) - (has('arrowright', 'd') ? 1 : 0),
      }
    }
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
      keys.add(k)
      apply()
    }
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase())
      apply()
    }
    const blur = () => {
      keys.clear()
      apply()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const knocked = useKnocked(state)
  // Dev-only hook so browser automation can steer by reading the car's state.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __fsaeRaceState?: () => DriveState }
    w.__fsaeRaceState = () => state.current
    return () => {
      delete w.__fsaeRaceState
    }
  }, [])
  const ghostCars = useMemo(() => ghosts.filter((g) => g.trace.length >= 6).slice(0, 6), [ghosts])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl ring-1 ring-line">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 60, near: 0.2, far: 800 }}>
        <TrackScene night={night} knocked={knocked} />
        <Driver
          params={params}
          startAt={startAt}
          inputRef={input}
          stateRef={state}
          hudRef={hud}
          onDone={(lap) => {
            setResult(lap)
            onFinish(lap)
          }}
        />
        <TrackCar get={() => state.current} look={look} night={night} headlights={lights} brake={() => input.current.brake > 0 && state.current.v > 0.5} />
        {ghostCars.map((g, i) => (
          <TrackCar key={g.id} ghost get={() => tracePose(g.trace, state.current.timeS)} look={look} body={GHOST_COLORS[i % GHOST_COLORS.length]} />
        ))}
        <ChaseCamera get={() => state.current} />
      </Canvas>

      {/* Countdown lights */}
      <div ref={(el) => { hud.current.countdown = el }} className="pointer-events-none absolute inset-x-0 top-[28%] mx-auto hidden w-fit flex-col items-center">
        <div className="flex gap-3 rounded-2xl bg-ink/90 px-5 py-4 shadow-2xl">
          {[0, 1, 2].map((i) => (
            <span key={i} ref={(el) => { hud.current[`lamp${i}`] = el }} className="size-10 rounded-full bg-white/15" />
          ))}
        </div>
        <div ref={(el) => { hud.current.countText = el }} className="mt-2 font-display text-4xl font-extrabold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
      </div>

      {/* Dashboard */}
      <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto flex w-fit items-center gap-6 rounded-2xl bg-ink/90 px-5 py-2.5 text-white shadow-xl">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/55">Heat {heat}</div>
          <div ref={(el) => { hud.current.time = el }} className="font-mono text-xl font-bold tabular">0.00 s</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/55">Speed</div>
          <div ref={(el) => { hud.current.speed = el }} className="font-mono text-xl font-bold tabular">0 mph</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/55">Cones (+{CONE_PENALTY_S} s each)</div>
          <div ref={(el) => { hud.current.cones = el }} className="font-mono text-xl font-bold tabular text-mint">0</div>
        </div>
        <div className="w-32">
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/55">Lap</div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
            <div ref={(el) => { hud.current.progress = el }} className="h-full rounded-full bg-leaf" style={{ width: 0 }} />
          </div>
        </div>
      </div>

      <div ref={(el) => { hud.current.grass = el }} className="pointer-events-none absolute inset-x-0 top-24 mx-auto hidden w-fit rounded-lg bg-sun px-3 py-1 font-mono text-xs font-bold text-ink">
        Off the track: the grass slows you down
      </div>

      {ghostCars.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl bg-white/90 px-3 py-2 text-xs shadow ring-1 ring-black/10">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink/50">Ghost cars</div>
          {ghostCars.map((g, i) => (
            <div key={g.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: GHOST_COLORS[i % GHOST_COLORS.length] }} />
              {g.playerName} · heat {g.heat} · {g.totalS.toFixed(2)} s
            </div>
          ))}
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <span className="rounded-lg bg-white/90 px-2.5 py-1.5 font-mono text-[11px] text-ink/70 shadow ring-1 ring-black/10">↑ / W go · ↓ / S brake · ← → / A D steer</span>
        <button type="button" onClick={onExit} className="flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-ink shadow ring-1 ring-black/10 hover:bg-white">
          <LogOut className="size-3.5" /> Leave race
        </button>
      </div>

      {result && (
        <div className="absolute inset-0 grid place-items-center bg-ink/40 backdrop-blur-[2px]">
          <div className="w-[min(420px,90%)] animate-pop rounded-2xl bg-white p-6 text-center shadow-2xl">
            <Flag className="mx-auto size-8 text-forest" />
            <div className="mt-2 font-display text-2xl font-extrabold">Lap complete!</div>
            <div className="mt-3 font-mono text-4xl font-bold text-forest">{(result.driveS + result.conesHit * CONE_PENALTY_S).toFixed(2)} s</div>
            <div className="mt-1 font-mono text-xs text-ink/60">
              {result.driveS.toFixed(2)} s driving + {result.conesHit} cone{result.conesHit === 1 ? '' : 's'} × {CONE_PENALTY_S} s
            </div>
            <button type="button" onClick={onExit} className="btn-press mt-5 rounded-xl bg-forest px-6 py-2.5 font-display text-sm font-bold text-white hover:bg-forest-dark">
              See the standings
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** A Set view of knocked cones that the cone renderer reads each frame. */
function useKnocked(stateRef: { current: DriveState }): ReadonlySet<number> {
  return useMemo(
    () =>
      ({
        has: (i: number) => stateRef.current.conesHit.includes(i),
      }) as ReadonlySet<number>,
    [stateRef],
  )
}

const STEP = 1 / 120

function Driver({
  params,
  startAt,
  inputRef,
  stateRef,
  hudRef,
  onDone,
}: {
  params: CarParams
  startAt: number
  inputRef: { current: DriveInput }
  stateRef: { current: DriveState }
  hudRef: { current: Record<string, HTMLElement | null> }
  onDone(lap: FinishedLap): void
}) {
  const track = getTrack()
  const acc = useRef(0)
  const trace = useRef<number[]>([])
  const nextSample = useRef(0)
  const reported = useRef(false)

  useFrame((_, dt) => {
    const h = hudRef.current
    const untilGo = (startAt - Date.now()) / 1000
    if (h.countdown) h.countdown.style.display = untilGo > -1 ? 'flex' : 'none'
    if (untilGo > 0) {
      const lit = untilGo > 3 ? 0 : 3 - Math.ceil(untilGo) + 1
      for (let i = 0; i < 3; i++) {
        const lamp = h[`lamp${i}`]
        if (lamp) lamp.style.background = i < lit ? '#d33a2c' : 'rgba(255,255,255,0.15)'
      }
      if (h.countText) h.countText.textContent = untilGo > 3 ? 'Get ready…' : String(Math.ceil(untilGo))
      return
    }
    if (untilGo > -1) {
      for (let i = 0; i < 3; i++) {
        const lamp = h[`lamp${i}`]
        if (lamp) lamp.style.background = '#74a85f'
      }
      if (h.countText) h.countText.textContent = 'GO!'
    }

    let s = stateRef.current
    if (!s.finished) {
      acc.current += Math.min(dt, 0.1)
      while (acc.current >= STEP && !s.finished) {
        s = stepDrive(s, inputRef.current, params, track, STEP)
        acc.current -= STEP
        if (s.timeS >= nextSample.current) {
          pushTrace(trace.current, s)
          nextSample.current += TRACE_DT
        }
      }
      stateRef.current = s
    }
    if (s.finished && !reported.current) {
      reported.current = true
      pushTrace(trace.current, s)
      onDone({ driveS: Math.round(s.timeS * 100) / 100, conesHit: s.conesHit.length, trace: trace.current })
    }

    if (h.time) h.time.textContent = `${s.timeS.toFixed(2)} s`
    if (h.speed) h.speed.textContent = `${Math.round(Math.abs(s.v) * MS_TO_MPH)} mph`
    if (h.cones) h.cones.textContent = String(s.conesHit.length)
    if (h.progress) h.progress.style.width = `${Math.max(0, Math.min(100, (s.progress / track.x.length) * 100))}%`
    if (h.grass) h.grass.style.display = s.offTrack && !s.finished ? 'block' : 'none'
  })
  return null
}

/** Every lap of a heat driving together, for the post-race replay. */
export function ReplayView({ design, laps, night, onExit }: { design: FsaeObject[]; laps: LapObject[]; night: boolean; onExit(): void }) {
  const look = lookOf(getMechanical(design))
  const sorted = useMemo(() => [...laps].sort((a, b) => a.totalS - b.totalS), [laps])
  const [follow, setFollow] = useState(0)
  const t = useRef(0)
  const knocked = useMemo(() => new Set<number>(), [])
  const longest = Math.max(...sorted.map((l) => l.trace.length / 3)) * TRACE_DT
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl ring-1 ring-line">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 55, near: 0.2, far: 800 }}>
        <TrackScene night={night} knocked={knocked} />
        <ReplayClock tRef={t} loop={longest + 2} />
        {sorted.map((l, i) => (
          <TrackCar key={l.id} get={() => tracePose(l.trace, t.current)} look={look} body={i === 0 ? '#2c5b3c' : GHOST_COLORS[i % GHOST_COLORS.length]} night={night} />
        ))}
        {sorted[follow] && <ChaseCamera get={() => tracePose(sorted[follow].trace, t.current)} distance={9} height={4} />}
      </Canvas>
      <div className="absolute left-3 top-3 rounded-xl bg-white/95 p-3 shadow ring-1 ring-black/10">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Replay · camera follows</div>
        <div className="mt-1 space-y-1">
          {sorted.map((l, i) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setFollow(i)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs ${follow === i ? 'bg-ink text-white' : 'hover:bg-paper'}`}
            >
              <span className="font-mono font-bold">{i + 1}.</span>
              <span className="size-2.5 rounded-full" style={{ background: i === 0 ? '#2c5b3c' : GHOST_COLORS[i % GHOST_COLORS.length] }} />
              <span className="flex-1 font-semibold">{l.playerName}</span>
              <span className="font-mono">{l.totalS.toFixed(2)} s</span>
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={onExit} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-ink shadow ring-1 ring-black/10 hover:bg-white">
        <LogOut className="size-3.5" /> Back to Race Day
      </button>
    </div>
  )
}

function ReplayClock({ tRef, loop }: { tRef: { current: number }; loop: number }) {
  useFrame((_, dt) => {
    tRef.current = (tRef.current + Math.min(dt, 0.1)) % loop
  })
  return null
}
