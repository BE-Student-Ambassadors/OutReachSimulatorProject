import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { ArrowLeft, ArrowUp, Cable, Check, ChevronRight, Circle, Cpu, Scissors, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { money } from '../../../core/format'
import { play, useLoop } from '../../../shared/audio/sfx'
import { LabelLayer, LabelProjector, type LabelEls, type PinnedLabel } from '../../../shared/three/Labels'
import { WorldErrorBoundary } from '../../../shell/WorldErrorBoundary'
import {
  COSTS,
  CUT_MARGIN,
  DIALS,
  emptyLine,
  getElectrical,
  getMechanical,
  HARNESS,
  POWER_PATH_BY_ID,
  POWER_PATHS,
  ROUTE_BOARDS,
  SENSOR_MOUNTS,
  SENSORS,
  upsert,
} from '../config'
import { lineBoard, lineProgress, sensorBoard, sensorStatus, zoneAt } from '../sim/harness'
import { readAll, type PathReading } from '../sim/power'
import type { ElectricalObject, FsaeObject, LineWork, PowerPartType, PowerPathId, SensorId } from '../types'
import { Knob } from '../../../shared/ui/Knob'
import { CrimpBench } from '../../../shared/crimp/CrimpBench'
import { harnessPoint, HOME_GOAL, PART_SPOT, SENSOR_DOT, SENSOR_GOAL, WIRE_LOOK, wireGoal, ZONE_TINT, type CameraGoal, type Job } from './harnessGeo'
import { CameraFly, HarnessScene } from './HarnessScene'
import { lookOf } from './look'
import { RoutePlate } from './RouteBoard'

type Overlay = { kind: 'crimp'; end: 0 | 1 } | { kind: 'route' } | null

const PART_INFO: Record<PowerPartType, { label: string; blurb: string; color: string; cost: number }> = {
  resistor: { label: 'Power resistor', blurb: 'Drops voltage: V = I × R. The dial sets R (ohms). It turns the dropped power into heat: P = I² × R.', color: '#b8461b', cost: COSTS.resistor },
  booster: { label: 'Voltage booster', blurb: 'A small circuit board that raises voltage. The dial sets how many volts it adds.', color: '#2c5b3c', cost: COSTS.booster },
}

const END_LABEL = ['Power side', 'Part side'] as const

export function ElectricalStation({ design, locked, fallbackSeed, onCommit }: { design: FsaeObject[]; locked: boolean; fallbackSeed: number; onCommit(next: FsaeObject[]): void }) {
  const existing = design.some((o) => o.kind === 'electrical')
  const elec: ElectricalObject = existing ? getElectrical(design) : { ...getElectrical(design), seed: fallbackSeed }
  const look = lookOf(getMechanical(design))
  const [job, setJob] = useState<Job | null>(null)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [hoverT, setHoverT] = useState<number | null>(null)
  const [dialPreview, setDialPreview] = useState<number | null>(null)
  const [mountPreview, setMountPreview] = useState<string | null>(null)
  const [goal, setGoal] = useState<CameraGoal>(HOME_GOAL)

  const save = (next: ElectricalObject) => onCommit(upsert(design, next))
  const setLine = (path: PowerPathId, line: LineWork) => {
    const before = lineProgress(elec, path)
    const next = { ...elec, lines: { ...elec.lines, [path]: line } }
    const after = lineProgress(next, path)
    if (after.inRange && !before.inRange) play('chime')
    if (after.done && !before.done) play('success')
    save(next)
  }

  // Live dial: the whole car reacts while the knob turns, before anything is saved.
  const shown: ElectricalObject =
    job && job !== 'sensors' && dialPreview !== null && elec.lines[job].part
      ? { ...elec, lines: { ...elec.lines, [job]: { ...elec.lines[job], part: { ...elec.lines[job].part!, value: dialPreview } } } }
      : elec
  const readings = readAll(shown)
  const progress = Object.fromEntries(POWER_PATHS.map((p) => [p.id, lineProgress(elec, p.id)])) as Record<PowerPathId, ReturnType<typeof lineProgress>>
  const sensors = sensorStatus(elec)
  const done = Object.fromEntries(POWER_PATHS.map((p) => [p.id, progress[p.id].done])) as Record<PowerPathId, boolean>

  // Sound: the motor whines while you work on it.
  const whine = useLoop('whine', job === 'motor')
  useEffect(() => {
    whine.current.set(Math.min(1, readings.motor.level * 0.45))
  })
  // A part pushed over its range buzzes once.
  const highCount = Object.values(readings).filter((r) => r.state === 'high').length
  const lastHigh = useRef(highCount)
  useEffect(() => {
    if (highCount > lastHigh.current) play('buzz')
    lastHigh.current = highCount
  }, [highCount])

  const open = (j: Job | null) => {
    play(j ? 'whoosh' : 'click')
    setJob(j)
    setOverlay(null)
    setHoverT(null)
    setDialPreview(null)
    setMountPreview(null)
    setGoal(j === null ? HOME_GOAL : j === 'sensors' ? SENSOR_GOAL : wireGoal(j, look))
  }

  const labels: PinnedLabel[] = useMemo(
    () =>
      job === null
        ? [
            ...POWER_PATHS.map((p) => ({ key: p.id, pos: harnessPoint([PART_SPOT[p.id][0], PART_SPOT[p.id][1] + 0.2, PART_SPOT[p.id][2]], look).toArray() as [number, number, number], text: p.label, tone: 'place' as const })),
            { key: 'sensors', pos: harnessPoint([0.95, 0.62, 0], look).toArray() as [number, number, number], text: 'Self-driving sensors', tone: 'place' as const },
          ]
        : [],
    [job, look],
  )
  const labelEls = useRef<LabelEls>(new Map())

  const cutting = !!job && job !== 'sensors' && elec.lines[job].cutAt === null

  return (
    <div className="flex h-full min-h-0 gap-3">
      <aside className="flex w-[350px] shrink-0 flex-col gap-2.5 overflow-y-auto overscroll-contain pb-2 pr-1">
        {job === null && <Overview elec={elec} progress={progress} sensors={sensors} readings={readings} onOpen={open} />}
        {job && job !== 'sensors' && (
          <WireJob
            path={job}
            elec={elec}
            reading={readings[job]}
            hoverT={hoverT}
            dialPreview={dialPreview}
            locked={locked}
            onBack={() => open(null)}
            onLine={(l) => setLine(job, l)}
            onDialPreview={setDialPreview}
            onOverlay={setOverlay}
          />
        )}
        {job === 'sensors' && (
          <SensorJob
            elec={elec}
            locked={locked}
            onBack={() => open(null)}
            onPreview={setMountPreview}
            onMount={(sensor, id) => {
              play(id ? 'place' : 'remove')
              save({ ...elec, mounts: { ...elec.mounts, [sensor]: id } })
            }}
            onRoute={() => setOverlay({ kind: 'route' })}
          />
        )}
      </aside>

      <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl bg-[#e9ebe4] ring-1 ring-line" onContextMenu={(e) => e.preventDefault()}>
        <WorldErrorBoundary>
          <Canvas shadows="percentage" dpr={[1, 1.75]} camera={{ position: HOME_GOAL.pos.toArray(), fov: 38, near: 0.02 }}>
            <HarnessScene
              look={look}
              elec={shown}
              readings={readings}
              job={job}
              cutting={cutting && overlay === null}
              hoverT={hoverT}
              done={done}
              sensorsWorking={{ lidar: sensors.lidar.working, camera: sensors.camera.working, wheel: sensors.wheel.working }}
              mountPreview={mountPreview}
              locked={locked}
              onPickJob={open}
              onHoverCut={setHoverT}
              onCut={(t) => {
                if (!job || job === 'sensors') return
                play('rip')
                setHoverT(null)
                setLine(job, { ...emptyLine(), cutAt: Math.round(t * 1000) / 1000 })
              }}
              onPickMount={(id) => {
                const m = SENSOR_MOUNTS.find((x) => x.id === id)!
                play('place')
                save({ ...elec, mounts: { ...elec.mounts, [m.sensor]: id } })
              }}
            />
            <CameraFly goal={goal} />
            <OrbitControls makeDefault enablePan={false} minDistance={0.25} maxDistance={8} maxPolarAngle={1.5} target={HOME_GOAL.target.toArray()} />
            <LabelProjector labels={labels} els={labelEls} />
          </Canvas>
        </WorldErrorBoundary>
        <LabelLayer labels={labels} els={labelEls} />

        <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-white/95 px-3 py-1.5 shadow ring-1 ring-black/10">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Wiring harness</div>
          <div className="font-display text-sm font-bold text-ink">{job === null ? 'Click a glowing part to work on it' : job === 'sensors' ? 'Self-driving sensors' : POWER_PATH_BY_ID[job].label}</div>
        </div>
        <span className="absolute right-3 top-3 rounded-lg bg-white/90 px-2 py-1 font-mono text-[10px] text-ink/55 ring-1 ring-black/5">drag to look around · scroll to zoom</span>

        {cutting && overlay === null && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto flex w-fit items-center gap-2 rounded-xl bg-ink/90 px-4 py-2 text-sm font-semibold text-white shadow-xl">
            <Scissors className="size-4 text-sun" />
            {hoverT === null
              ? 'Move along the wire to choose where to cut it'
              : hoverT < CUT_MARGIN || hoverT > 1 - CUT_MARGIN
                ? 'Too close to the connector: no room to crimp'
                : `Click to cut here · ${zoneAt(job as PowerPathId, hoverT).label}`}
          </div>
        )}

        {overlay && (
          <div className="absolute bottom-3 right-3 top-12 flex w-[480px] max-w-[calc(100%-24px)] flex-col overflow-y-auto rounded-2xl bg-ink/95 p-4 shadow-2xl ring-1 ring-black/30 backdrop-blur">
            <button type="button" onClick={() => setOverlay(null)} aria-label="Close" className="absolute right-3 top-3 text-white/60 hover:text-white">
              <X className="size-5" />
            </button>
            {overlay.kind === 'crimp' && job && job !== 'sensors' && (
              <CrimpBench
                key={`${job}-${overlay.end}`}
                awg={HARNESS[job].awg}
                wireColor={WIRE_LOOK[job].color}
                endLabel={END_LABEL[overlay.end]}
                locked={locked}
                onDone={(r) => {
                  const line = elec.lines[job]
                  const crimps = [...line.crimps] as LineWork['crimps']
                  crimps[overlay.end] = r.quality
                  setLine(job, { ...line, crimps })
                  const other = (1 - overlay.end) as 0 | 1
                  setOverlay(crimps[other] === null ? { kind: 'crimp', end: other } : null)
                }}
              />
            )}
            {overlay.kind === 'route' && job && job !== 'sensors' && elec.lines[job].cutAt !== null && (
              <RoutePlate
                board={lineBoard(elec.seed, job, zoneAt(job, elec.lines[job].cutAt!).zone)}
                routes={elec.lines[job].routes}
                locked={locked}
                title={`Tie down the ${POWER_PATH_BY_ID[job].label.toLowerCase()} splice`}
                onCommit={(routes) => setLine(job, { ...elec.lines[job], routes })}
              />
            )}
            {overlay.kind === 'route' && job === 'sensors' && (
              <RoutePlate
                board={sensorBoard(elec.seed)}
                routes={elec.sensorRoutes}
                locked={locked}
                title="Run the sensor cables to the computer"
                onCommit={(sensorRoutes) => save({ ...elec, sensorRoutes })}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- overview

function Overview({
  elec,
  progress,
  sensors,
  readings,
  onOpen,
}: {
  elec: ElectricalObject
  progress: Record<PowerPathId, ReturnType<typeof lineProgress>>
  sensors: ReturnType<typeof sensorStatus>
  readings: Record<PowerPathId, PathReading>
  onOpen(j: Job): void
}) {
  const mounted = SENSORS.filter((s) => elec.mounts[s.id]).length
  return (
    <>
      <div className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
        <h3 className="font-display text-[15px] font-bold">The car’s wiring harness</h3>
        <p className="mt-1 text-xs text-ink/65">
          Two wires carry power to two parts, and each part is rated for a range of voltage. To change what a part receives, cut its wire, crimp the two ends, splice in a part, and tie
          the wiring down neatly.
        </p>
      </div>
      {POWER_PATHS.map((p) => {
        const pr = progress[p.id]
        const r = readings[p.id]
        return (
          <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="group rounded-2xl bg-white p-3 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink/30">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-6 rounded-full" style={{ background: WIRE_LOOK[p.id].color }} />
              <span className="font-display text-[14px] font-bold">{p.label}</span>
              {pr.done && <Check className="size-4 text-forest" strokeWidth={3} />}
              <span className={`ml-auto font-mono text-[13px] font-bold ${r.state === 'ok' ? 'text-forest' : r.state === 'high' ? 'text-rust' : 'text-[#a77c17]'}`}>{r.volts.toFixed(1)} V</span>
              <ChevronRight className="size-4 text-ink/30 group-hover:text-ink" />
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < pr.steps ? 'bg-forest' : 'bg-paper ring-1 ring-line'}`} />
              ))}
              <span className="ml-1.5 font-mono text-[10px] text-ink/50">rated {p.lo}–{p.hi} V</span>
            </div>
          </button>
        )
      })}
      <button type="button" onClick={() => onOpen('sensors')} className="group rounded-2xl bg-white p-3 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink/30">
        <div className="flex items-center gap-2">
          <Cpu className="size-4 text-[#7c4dbd]" />
          <span className="font-display text-[14px] font-bold">Self-driving sensors</span>
          {mounted === SENSORS.length && sensors.boardComplete && <Check className="size-4 text-forest" strokeWidth={3} />}
          <span className="ml-auto font-mono text-[11px] text-ink/55">{mounted} / {SENSORS.length} mounted</span>
          <ChevronRight className="size-4 text-ink/30 group-hover:text-ink" />
        </div>
        <p className="mt-1 text-xs text-ink/60">The car comes with a LiDAR on the front wing, wired to the driverless computer. It also needs a camera and a wheel-speed sensor.</p>
      </button>
    </>
  )
}

// ---------------------------------------------------------------- one wire

function Step({ n, title, done, active, children }: { n: number; title: string; done: boolean; active: boolean; children?: ReactNode }) {
  return (
    <section className={`rounded-2xl p-3 ring-1 transition ${active ? 'bg-white ring-ink/25 shadow-sm' : 'bg-white/60 ring-line'}`}>
      <h4 className="flex items-center gap-2 font-display text-[14px] font-bold text-ink">
        <span className={`grid size-5 place-items-center rounded-full font-mono text-[11px] ${done ? 'bg-forest text-white' : 'bg-paper text-ink/60 ring-1 ring-line'}`}>
          {done ? <Check className="size-3" strokeWidth={3} /> : n}
        </span>
        <span className={done || active ? '' : 'text-ink/50'}>{title}</span>
      </h4>
      {(active || done) && children && <div className="mt-2">{children}</div>}
    </section>
  )
}

function WireJob({
  path,
  elec,
  reading,
  hoverT,
  dialPreview,
  locked,
  onBack,
  onLine,
  onDialPreview,
  onOverlay,
}: {
  path: PowerPathId
  elec: ElectricalObject
  reading: PathReading
  hoverT: number | null
  dialPreview: number | null
  locked: boolean
  onBack(): void
  onLine(l: LineWork): void
  onDialPreview(v: number | null): void
  onOverlay(o: Overlay): void
}) {
  const spec = POWER_PATH_BY_ID[path]
  const line = elec.lines[path]
  const pr = lineProgress(elec, path)
  const crimped = pr.crimped === 2
  const hoverZone = hoverT !== null ? zoneAt(path, hoverT) : null
  const value = dialPreview ?? line.part?.value ?? 0

  return (
    <>
      <button type="button" onClick={onBack} className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink/70 hover:bg-white">
        <ArrowLeft className="size-3.5" /> Whole car
      </button>
      <div className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full" style={{ background: WIRE_LOOK[path].color }} />
          <h3 className="font-display text-[16px] font-bold">{spec.label}</h3>
        </div>
        <p className="mt-1 text-xs text-ink/65">{spec.summary}</p>
        <Multimeter reading={reading} />
        <p className="mt-1.5 text-[11px] leading-snug text-ink/65">{statusLine(reading)}</p>
        <div className="mt-1.5 font-mono text-[10px] text-ink/45">
          Source: {spec.sourceLabel} · draws {spec.amps} A · {HARNESS[path].awg} AWG wire
        </div>
      </div>

      <Step n={1} title="Cut the wire" done={pr.cut} active={!pr.cut}>
        {pr.cut && pr.zone ? (
          <div className="space-y-1.5 text-xs">
            <ZoneChip zone={pr.zone.zone} label={pr.zone.label} />
            <div className="font-mono text-[11px] text-ink/55">
              Cut {Math.round(line.cutAt! * 100)}% of the way along · tie-down plate {ROUTE_BOARDS[pr.zone.zone].cols}×{ROUTE_BOARDS[pr.zone.zone].rows} holes, {ROUTE_BOARDS[pr.zone.zone].wires} wires
            </div>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                play('undo')
                onLine(emptyLine())
              }}
              className="flex items-center gap-1 text-[11px] font-semibold text-ink/60 underline disabled:opacity-40"
            >
              <Undo2 className="size-3" /> Replace this stretch with fresh wire
            </button>
          </div>
        ) : (
          <div className="space-y-2 text-xs text-ink/70">
            <p>The wire is tinted by what it runs past. Hover it in the 3D view to read each stretch, then click to cut.</p>
            <div className="space-y-1">
              {HARNESS[path].zones.map((z) => (
                <ZoneChip key={z.from} zone={z.zone} label={z.label} active={hoverZone?.from === z.from} />
              ))}
            </div>
            <p className="font-mono text-[10px] text-ink/50">
              Tie-down plate around the splice: clear stretch {ROUTE_BOARDS.clear.cols}×{ROUTE_BOARDS.clear.rows} holes, {ROUTE_BOARDS.clear.wires} wires; hot or moving stretch {ROUTE_BOARDS.hot.cols}×
              {ROUTE_BOARDS.hot.rows}, {ROUTE_BOARDS.hot.wires} wires.
            </p>
          </div>
        )}
      </Step>

      <Step n={2} title="Crimp both ends" done={crimped} active={pr.cut && !crimped}>
        <div className="grid grid-cols-2 gap-1.5">
          {([0, 1] as const).map((end) => {
            const q = line.crimps[end]
            return (
              <button
                key={end}
                type="button"
                disabled={locked || !pr.cut}
                onClick={() => {
                  play('select')
                  onOverlay({ kind: 'crimp', end })
                }}
                className="rounded-xl bg-paper px-2.5 py-2 text-left ring-1 ring-line hover:bg-mint disabled:opacity-40"
              >
                <div className="text-[11px] font-semibold text-ink/70">{END_LABEL[end]}</div>
                <div className={`font-mono text-sm font-bold ${q === null ? 'text-ink/40' : q >= 0.85 ? 'text-forest' : q >= 0.6 ? 'text-[#a77c17]' : 'text-rust'}`}>
                  {q === null ? 'not crimped' : `${Math.round(q * 100)}%`}
                </div>
                <div className="text-[10px] text-ink/45">{q === null ? 'Click to crimp' : 'Click to redo'}</div>
              </button>
            )
          })}
        </div>
      </Step>

      <Step n={3} title="Splice in a part and set its dial" done={!!line.part} active={crimped && !line.part}>
        <div className="grid grid-cols-2 gap-1.5">
          {(['resistor', 'booster'] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={locked || !crimped}
              onClick={() => {
                play('place')
                onDialPreview(null)
                onLine({ ...line, part: line.part?.type === t ? line.part : { type: t, value: DIALS[t].start } })
              }}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 ring-1 transition disabled:opacity-40 ${line.part?.type === t ? 'bg-mint ring-2 ring-forest' : 'bg-paper ring-line hover:bg-white'}`}
            >
              <PartSymbol type={t} size={36} />
              <span className="text-xs font-bold">{PART_INFO[t].label}</span>
              <span className="font-mono text-[10px] text-ink/55">{money(PART_INFO[t].cost)}</span>
            </button>
          ))}
        </div>
        {line.part && (
          <div className="mt-2.5">
            <p className="text-[11px] text-ink/65">{PART_INFO[line.part.type].blurb}</p>
            <div className="mt-2 flex justify-center">
              <Knob
                key={`${path}-${line.part.type}`}
                value={line.part.value}
                {...DIALS[line.part.type]}
                color={PART_INFO[line.part.type].color}
                disabled={locked}
                onPreview={onDialPreview}
                onCommit={(v) => onLine({ ...line, part: { ...line.part!, value: v } })}
              />
            </div>
            <p className="mt-2 rounded-lg bg-paper px-2.5 py-1.5 text-center font-mono text-[11.5px] text-ink/80">
              {line.part.type === 'resistor' ? (
                <>
                  {spec.amps} A × {value.toFixed(1)} Ω = {(spec.amps * value).toFixed(1)} V dropped
                  <br />
                  <span className="text-ink/50">
                    heat: {spec.amps}² A² × {value.toFixed(1)} Ω = {Math.round(spec.amps * spec.amps * value)} W
                  </span>
                </>
              ) : (
                <>+{value.toFixed(1)} V added</>
              )}
              <br />
              <span className="text-ink/50">crimped connections: −{reading.crimpDrop.toFixed(1)} V</span>
            </p>
          </div>
        )}
      </Step>

      <Step n={4} title={`Voltage in its rated range (${spec.lo}–${spec.hi} V)`} done={pr.inRange} active={!!line.part && !pr.inRange}>
        <p className="text-[11px] text-ink/65">{line.part ? `${reading.volts.toFixed(1)} V at the part.` : ''}</p>
      </Step>

      <Step n={5} title="Route and tie down the splice" done={pr.routed} active={!!line.part && !pr.routed}>
        <button
          type="button"
          disabled={locked || !line.part}
          onClick={() => {
            play('select')
            onOverlay({ kind: 'route' })
          }}
          className="btn-press flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          <Cable className="size-3.5" /> {pr.routed ? 'Open the tie-down plate' : 'Route the wiring'}
        </button>
      </Step>

      {pr.done && (
        <div className="flex items-center gap-2 rounded-2xl bg-mint px-3 py-2.5 text-sm font-bold text-forest ring-1 ring-forest/30">
          <Check className="size-4" strokeWidth={3} /> {spec.label}: every step done
        </div>
      )}
    </>
  )
}

function ZoneChip({ zone, label, active }: { zone: 'hot' | 'moving' | 'clear'; label: string; active?: boolean }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg px-2 py-1 text-[11px] ${active ? 'bg-paper ring-1 ring-ink/30' : ''}`}>
      <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: ZONE_TINT[zone] }} />
      <span className="text-ink/75">{label}</span>
    </div>
  )
}

/** A meter with the rated range marked and the needle at the reading. */
function Multimeter({ reading }: { reading: PathReading }) {
  const { spec, volts, state } = reading
  const max = Math.max(spec.hi * 1.6, spec.sourceV * 1.1)
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <div className="mt-2 rounded-xl bg-ink px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">At the part</span>
        <span className={`font-mono text-xl font-bold tabular ${state === 'ok' ? 'text-[#9fe0b2]' : state === 'high' ? 'text-[#f08a5d]' : 'text-sun'}`}>{volts.toFixed(1)} V</span>
      </div>
      <div className="relative mt-1.5 h-2.5 rounded-full bg-white/10">
        <div className="absolute inset-y-0 rounded-full bg-leaf/60" style={{ left: pct(spec.lo), width: `calc(${pct(spec.hi)} - ${pct(spec.lo)})` }} />
        <div className="absolute -top-0.5 h-3.5 w-1 -translate-x-1/2 rounded-full bg-white transition-[left] duration-150" style={{ left: pct(volts) }} />
      </div>
    </div>
  )
}

function statusLine(r: PathReading): string {
  const { spec, state } = r
  const range = `rated ${spec.lo}–${spec.hi} V`
  if (r.open) return 'The wire is open: nothing reaches the part until both ends are crimped and a part joins them.'
  if (state === 'ok') return `In range (${range}).`
  switch (spec.id) {
    case 'motor':
      return state === 'high' ? `Too much (${range}). The motor controller is cutting power to protect the motor.` : `Too little (${range}). Less voltage, less power.`
    case 'computer':
      return state === 'high' ? `Too much (${range}). The computer is running hot.` : `Too little (${range}). The computer keeps restarting.`
  }
}

export function PartSymbol({ type, size }: { type: PowerPartType; size: number }) {
  if (type === 'booster')
    return (
      <span className="grid place-items-center rounded-md bg-forest text-white" style={{ width: size, height: size * 0.62 }}>
        <ArrowUp style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={3} />
      </span>
    )
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 44 22">
      <path d="M0 11 H8 L11 3 L16 19 L21 3 L26 19 L31 3 L34 11 H44" fill="none" stroke="#b8461b" strokeWidth={2.4} strokeLinejoin="round" />
    </svg>
  )
}

// ---------------------------------------------------------------- sensors

function SensorJob({
  elec,
  locked,
  onBack,
  onPreview,
  onMount,
  onRoute,
}: {
  elec: ElectricalObject
  locked: boolean
  onBack(): void
  onPreview(id: string | null): void
  onMount(sensor: SensorId, id: string | null): void
  onRoute(): void
}) {
  const st = sensorStatus(elec)
  const mounted = SENSORS.filter((s) => elec.mounts[s.id]).length
  return (
    <>
      <button type="button" onClick={onBack} className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink/70 hover:bg-white">
        <ArrowLeft className="size-3.5" /> Whole car
      </button>
      <div className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
        <h3 className="font-display text-[16px] font-bold">Self-driving sensors</h3>
        <p className="mt-1 text-xs text-ink/65">The LiDAR comes mounted on the front wing pylon and already wired. Choose where the camera and wheel-speed sensor go (the dots on the car), then run their cables to the computer. Where a sensor sits changes what it can see.</p>
      </div>
      {SENSORS.map((s, i) => (
        <Step key={s.id} n={i + 1} title={`Mount the ${s.label}`} done={!!elec.mounts[s.id]} active={!elec.mounts[s.id]}>
          <p className="text-[11px] text-ink/65">
            {s.summary} <span className="font-mono">{money(s.cost)}</span>
          </p>
          <div className="mt-2 space-y-1.5">
            {SENSOR_MOUNTS.filter((m) => m.sensor === s.id).map((m) => {
              const on = elec.mounts[s.id] === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={locked}
                  onPointerEnter={() => onPreview(m.id)}
                  onPointerLeave={() => onPreview(null)}
                  onClick={() => onMount(s.id, on ? null : m.id)}
                  className={`w-full rounded-xl p-2 text-left ring-1 transition disabled:opacity-50 ${on ? 'bg-mint ring-2 ring-forest' : 'bg-paper ring-line hover:bg-white'}`}
                >
                  <div className="flex items-center gap-1.5">
                    {on ? <Check className="size-3.5 text-forest" strokeWidth={3} /> : <Circle className="size-3 text-ink/30" />}
                    <span className="size-2.5 rounded-full" style={{ background: SENSOR_DOT[s.id] }} />
                    <span className="text-xs font-bold">{m.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-ink/55">{m.bracket ? `+${money(m.bracket)} bracket` : 'no bracket'}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 pl-5 text-[11px] leading-snug text-ink/65">
                    {m.facts.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>
        </Step>
      ))}
      <Step n={SENSORS.length + 1} title="Run the sensor cables to the computer" done={st.boardComplete} active={mounted > 0 && !st.boardComplete}>
        <div className="mb-2 flex gap-1.5">
          {SENSORS.map((s) => (
            <span key={s.id} className={`flex-1 rounded-lg px-2 py-1 text-center text-[10px] font-semibold ${st[s.id].working ? 'bg-mint text-forest' : 'bg-paper text-ink/50'}`}>
              {s.label}: {st[s.id].working ? 'working' : !st[s.id].mount ? 'not mounted' : 'not wired'}
            </span>
          ))}
        </div>
        <button type="button" disabled={locked} onClick={onRoute} className="btn-press flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
          <Cable className="size-3.5" /> Route the sensor cables
        </button>
      </Step>
    </>
  )
}
