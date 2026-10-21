import { AlertTriangle, Briefcase, CheckCircle2, Circle, Code2, Download, Rocket, Users, Video, Wrench, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { count, money } from '../../../core/format'
import { namesLabel, rolesOf, teamRoster } from '../../../core/roles'
import type { WorldProps } from '../../../core/scenario'
import { play, useLoop, usePlayOnIncrease } from '../../../shared/audio/sfx'
import { BLUEPRINT, CIRCUITS, getElectrical, getMechanical, getSoftware, REQUIRED } from '../config'
import { designCost, designFunds } from '../cost'
import { assignRocketRoles, extractRolePrefs, ROCKET_ROLES } from '../roles'
import { boardStatus } from '../sim/board'
import { readLines } from '../sim/power'
import { resolveBuild } from '../sim/build'
import { MS_TO_MPH, M_TO_FT, SMASH_FPS, type RocketResult, type RocketRun } from '../sim/engine'
import type { RocketObject, RocketRoleId } from '../types'
import { BusinessStation } from './BusinessStation'
import { checklist } from './checklists'
import { droneStart } from './drone'
import { createLink, useDroneKeys, useMouseLook } from './droneLink'
import { DroneOsd } from './DroneView'
import { canRecord, nextLaunch, startRecording, useClips } from './footage'
import { ElectricalStation } from './ElectricalStation'
import { lookFor } from './look'
import { MechanicalStation } from './MechanicalStation'
import { usePaintVersion } from './paintStore'
import { RocketScene } from './RocketScene'
import { RoleTierModal } from './RoleTierModal'
import { SoftwareStation } from './SoftwareStation'
import { useNow } from './useNow'

type TabId = RocketRoleId | 'launch'

const ROLE_ICONS: Record<RocketRoleId, LucideIcon> = { electrical: Zap, mechanical: Wrench, software: Code2, business: Briefcase }

/** Only called from event handlers (opening the kit, plugging in), so each team gets its own puzzle and code. */
const newSeed = () => Math.floor(Math.random() * 2 ** 31)

export function RocketWorld({ design, locked, run, lastResult, onCommit, sync, onStartRun }: WorldProps<RocketObject, RocketResult>) {
  const [picked, setPicked] = useState<TabId | null>(null)
  const [showRoles, setShowRoles] = useState(false)
  usePaintVersion()

  const myId = sync?.me ?? 'solo'
  const myName = sync?.meName ?? 'You'
  const teammates = sync?.teammates
  const roster = teamRoster(sync)
  const assignments = assignRocketRoles(extractRolePrefs(design, roster))
  const myRoles = rolesOf(assignments, myId)
  const tab: TabId = picked ?? myRoles[0] ?? 'electrical'

  const funds = designFunds(design)
  const spent = designCost(design)
  const now = useNow(getMechanical(design).orders.length > 0, 1000)
  const steps = checklist(tab, design, now, !!lastResult)
  const rocketRun = (run as RocketRun | null) ?? null
  const look = lookFor(resolveBuild(getMechanical(design)))
  useFlightSound(rocketRun)
  usePlayOnIncrease(
    (['electrical', 'mechanical', 'software', 'business', 'launch'] as TabId[]).reduce((n, id) => n + checklist(id, design, now, !!lastResult).filter((s) => s.done).length, 0),
  )

  if (rocketRun) {
    // Each teammate gets their own drone, starting from a different spot around the pad.
    const ids = [...new Set([myId, ...(teammates ?? []).map((t) => t.id)])].sort()
    return <LaunchView key={runKey(rocketRun)} look={look} run={rocketRun} droneSlot={Math.max(0, ids.indexOf(myId))} />
  }

  const tabs: { id: TabId; label: string; icon: LucideIcon; accent: string; who?: string | null }[] = [
    ...ROCKET_ROLES.map((r) => ({ id: r.id, label: r.shortTitle, icon: ROLE_ICONS[r.id], accent: r.accent, who: namesLabel(assignments[r.id], myId) })),
    { id: 'launch', label: 'Launch Pad', icon: Rocket, accent: '#1b2a20' },
  ]
  const commit = (next: RocketObject[]) => onCommit(next, null)

  return (
    <div className="relative flex h-full w-full flex-col bg-paper">
      {/* Station tabs, team money and roles */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line bg-white px-3 py-2">
        {tabs.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                play('click')
                setPicked(t.id)
              }}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-left transition ${active ? 'bg-ink text-white' : 'hover:bg-paper'}`}
            >
              <span className="grid size-7 place-items-center rounded-lg text-white" style={{ backgroundColor: active ? '#ffffff22' : t.accent }}>
                <t.icon className="size-4" />
              </span>
              <span className="leading-tight">
                <span className="block font-display text-sm font-bold">{t.label}</span>
                {t.id !== 'launch' && (
                  <span className={`block text-[11px] ${active ? 'text-white/65' : 'text-ink/50'}`}>{t.who || 'open seat'}</span>
                )}
              </span>
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-[11px] text-ink/55">Team money</div>
            <div className="font-mono text-sm font-semibold">
              <span className={spent > funds ? 'text-rust' : 'text-ink'}>{money(spent)}</span>
              <span className="text-ink/45"> spent / {money(funds)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowRoles(true)}
            className="flex items-center gap-1.5 rounded-xl bg-paper px-3 py-2 font-display text-xs font-bold ring-1 ring-line hover:bg-mint hover:text-forest"
          >
            <Users className="size-3.5" /> Roles
          </button>
        </div>
      </div>

      {/* What to do at this station */}
      <ol className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1 border-b border-line bg-mint/50 px-4 py-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center">
            {i > 0 && <span className="mx-1.5 h-px w-4 bg-forest/25" />}
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.done ? 'bg-forest text-white' : 'bg-white text-ink/75 ring-1 ring-line'}`}>
              {s.done ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5 text-ink/30" />}
              <span>
                {i + 1}. {s.label}
              </span>
              {s.detail && <span className={`font-mono text-[11px] ${s.done ? 'text-white/75' : 'text-ink/45'}`}>{s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>

      <div className="min-h-0 flex-1 p-3">
        {tab === 'electrical' && <ElectricalStation design={design} locked={locked} onCommit={commit} newSeed={newSeed} />}
        {tab === 'mechanical' && <MechanicalStation design={design} locked={locked} onCommit={commit} funds={funds} spent={spent} />}
        {tab === 'software' && <SoftwareStation design={design} locked={locked} onCommit={commit} newSeed={newSeed} lastResult={lastResult} />}
        {tab === 'business' && <BusinessStation design={design} locked={locked} onCommit={commit} newSeed={newSeed} />}
        {tab === 'launch' && <LaunchPad design={design} locked={locked} lastResult={lastResult} funds={funds} spent={spent} onLaunch={() => onStartRun?.('standard')} />}
      </div>

      {showRoles && (
        <RoleTierModal
          design={design}
          myId={myId}
          myName={myName}
          roster={roster}
          locked={locked}
          onCommit={commit}
          onGoTo={(id) => setPicked(id)}
          onClose={() => setShowRoles(false)}
        />
      )}
    </div>
  )
}

function LaunchPad({
  design,
  locked,
  lastResult,
  funds,
  spent,
  onLaunch,
}: {
  design: RocketObject[]
  locked: boolean
  lastResult: RocketResult | null
  funds: number
  spent: number
  onLaunch(): void
}) {
  const st = boardStatus(getElectrical(design))
  const leads = Object.values(readLines(getElectrical(design)))
  const leadsOk = leads.filter((r) => r.state === 'ok').length
  const build = resolveBuild(getMechanical(design))
  const sw = getSoftware(design)
  const row = (label: string, value: string, ok: boolean) => (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2 text-sm">
      <span className="text-ink/70">{label}</span>
      <span className={`font-mono text-xs font-semibold ${ok ? 'text-forest' : 'text-ink/60'}`}>{value}</span>
    </div>
  )
  return (
    <div className="relative h-full overflow-hidden rounded-2xl ring-1 ring-line">
      <RocketScene look={lookFor(build)} run={null} />
      <div className="absolute left-4 top-4 w-[340px] rounded-2xl bg-white/95 p-4 shadow-xl ring-1 ring-line backdrop-blur">
        <h2 className="font-display text-xl font-bold">Launch Pad</h2>
        <p className="mt-0.5 text-xs text-ink/60">
          Goal: reach {count(REQUIRED.targetApogeeFt)} ± {REQUIRED.apogeeToleranceFt} ft, land at {REQUIRED.maxLandingFps} ft/s or slower, and spend no more than the team has.
        </p>
        <div className="mt-3 space-y-1.5">
          {row('Circuits connected', `${st.connectedCount} / ${CIRCUITS.length}`, st.connectedCount === CIRCUITS.length)}
          {row('Battery leads in range', `${leadsOk} / ${leads.length}`, leadsOk === leads.length)}
          {row('Blueprint slots filled', `${build.filled} / ${BLUEPRINT.length}`, build.filled === BLUEPRINT.length)}
          {row('Flight program', sw?.uploadedSource ? (sw.uploadedSource === sw.source ? 'uploaded' : 'uploaded (older version)') : 'none uploaded', !!sw?.uploadedSource)}
          {row('Money spent', `${money(spent)} of ${money(funds)}`, spent <= funds)}
        </div>
        <button
          type="button"
          disabled={locked}
          onClick={onLaunch}
          className="btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-forest py-3.5 font-display text-base font-bold uppercase tracking-wide text-white disabled:opacity-50"
        >
          <Rocket className="size-5" /> Launch
        </button>
        <p className="mt-1.5 text-center text-[11px] text-ink/50">Anyone on the team can launch. Every launch is a test.</p>
        {lastResult && (
          <div className="mt-3 border-t border-line pt-3 text-xs text-ink/70">
            <div className="mb-1 font-semibold text-ink">Last launch</div>
            <div className="grid grid-cols-2 gap-1 font-mono">
              <span>Apogee</span>
              <span className="text-right">{count(lastResult.apogeeFt)} ft</span>
              <span>Top speed</span>
              <span className="text-right">{count(lastResult.outcome === 'breakup' ? lastResult.breakupSpeedMph : lastResult.peakSpeedMph)} mph</span>
              <span>Landing</span>
              <span className="text-right">{lastResult.landingFps ? `${lastResult.landingFps} ft/s` : '—'}</span>
            </div>
          </div>
        )}
      </div>
      <FootagePanel />
    </div>
  )
}

const runKeys = new WeakMap<RocketRun, number>()
let runCount = 0
/** A fresh drone (and launch number) for every launch, even back-to-back ones. */
function runKey(run: RocketRun): number {
  if (!runKeys.has(run)) runKeys.set(run, ++runCount)
  return runKeys.get(run)!
}

/** The launch on screen: everyone flies an FPV drone (or watches the tracking camera) and can record. */
function LaunchView({ look, run, droneSlot }: { look: ReturnType<typeof lookFor>; run: RocketRun; droneSlot: number }) {
  const linkRef = useRef(createLink(droneStart(droneSlot)))
  const [launch] = useState(nextLaunch)
  const [flying, setFlying] = useState(true)
  // Once the flight is over the cursor goes back to the student (for the results).
  const [finished, setFinished] = useState(false)
  const [recording, setRecording] = useState(false)
  const [saved, setSaved] = useState(false)
  const recordable = canRecord()

  const stopRecording = () => {
    const l = linkRef.current
    if (!l.recording) return
    l.recording.stop()
    l.recording = null
    setRecording(false)
    setSaved(true)
  }
  const toggleRecording = () => {
    const l = linkRef.current
    if (l.recording) return stopRecording()
    if (!l.canvas || run.done) return
    l.recording = startRecording(l.canvas, launch)
    if (l.recording) {
      play('beep')
      setRecording(true)
      setSaved(false)
    }
  }
  const mouse = useMouseLook(linkRef, flying && !finished)
  useDroneKeys(linkRef, { onRecord: toggleRecording, onCamera: () => setFlying((f) => !f), onMouseLook: mouse.toggle })

  // The clip ends with the flight (or when this view closes).
  const stopRef = useRef(stopRecording)
  useEffect(() => {
    stopRef.current = stopRecording
  })
  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (run.done) {
        stopRef.current()
        setFinished(true)
      } else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      stopRef.current()
    }
  }, [run])
  // Ctrl is the mouse-look key, and Ctrl+W closes the tab (pages can't block it): ask first.
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (run.done) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [run])
  const drone = useLoop('motor', flying)
  useEffect(() => {
    if (!flying) return
    let raf = 0
    const tick = () => {
      const s = linkRef.current.state
      drone.current.set(0.25 + Math.min(0.75, Math.hypot(s.vx, s.vy, s.vz) / 26))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [flying, linkRef, drone])

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      // Clicking the picture (not a button) turns on mouse look.
      onClick={(e) => e.target instanceof HTMLCanvasElement && mouse.lock()}
    >
      <RocketScene look={look} run={run} drone={{ linkRef, active: flying }} />
      <DroneOsd
        linkRef={linkRef}
        run={run}
        active={flying}
        recording={recording}
        canRecord={recordable}
        mouseLook={mouse.locked}
        onRecord={toggleRecording}
        onCamera={() => setFlying((f) => !f)}
      />
      <FlightHud run={run} />
      {saved && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 -translate-x-1/2 animate-pop rounded-xl bg-ink/85 px-4 py-2 text-sm font-semibold text-white">
          Clip saved. Watch it on the Launch Pad tab.
        </div>
      )}
    </div>
  )
}

/** This browser's drone recordings, newest first. */
function FootagePanel() {
  const clips = useClips()
  const [playing, setPlaying] = useState<string | null>(null)
  if (!clips.length)
    return (
      <div className="absolute bottom-4 right-4 w-[300px] rounded-2xl bg-white/95 p-3.5 text-xs text-ink/65 shadow-xl ring-1 ring-line backdrop-blur">
        <div className="mb-1 flex items-center gap-1.5 font-display text-sm font-bold text-ink">
          <Video className="size-4" /> Drone footage
        </div>
        At launch, everyone on the team flies their own FPV drone. Press R (or the REC button) to record the flight.
      </div>
    )
  const open = clips.find((c) => c.id === playing) ?? clips[0]
  return (
    <div className="absolute bottom-4 right-4 w-[340px] rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-line backdrop-blur">
      <div className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold">
        <Video className="size-4" /> Drone footage
      </div>
      <video key={open.id} src={open.url} controls className="aspect-video w-full rounded-lg bg-ink" />
      <div className="mt-2 max-h-[132px] space-y-1 overflow-y-auto">
        {clips.map((c) => (
          <div key={c.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${c.id === open.id ? 'bg-mint' : 'hover:bg-paper'}`}>
            <button type="button" onClick={() => setPlaying(c.id)} className="flex-1 text-left">
              <span className="font-semibold">Launch {c.launch}</span>
              <span className="ml-2 font-mono text-ink/55">
                {c.seconds.toFixed(1)} s · rocket in frame {c.inFramePct}%
              </span>
            </button>
            <a href={c.url} download={`rocket-launch-${c.launch}.${c.mime.includes('mp4') ? 'mp4' : 'webm'}`} title="Download" className="text-ink/50 hover:text-forest">
              <Download className="size-4" />
            </a>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-ink/45">Clips stay in this browser until you close the page.</p>
    </div>
  )
}

const CHUTE_TEXT: Record<RocketResult['chute'], string> = {
  'not-deployed': 'packed',
  open: 'open',
  torn: 'ripped',
  separated: 'came loose',
  'no-parachute': 'none in the bay',
  'no-charge': 'charge not wired',
}

/**
 * The launch, heard: a countdown beep, ignition and a rumble that follows the motor, the
 * parachute popping (or ripping), and the landing or the breakup.
 */
function useFlightSound(run: RocketRun | null) {
  const rumble = useLoop('rumble', !!run)
  useEffect(() => {
    if (!run) return
    let raf = 0
    let prev = { t: -6, thrust: false, chute: 0, shredded: false, phase: 'pad' as string }
    const tick = () => {
      const f = run.frame
      // Countdown: a beep each second for the last five.
      if (f.tSec < 0 && f.tSec > -6 && Math.ceil(prev.t) !== Math.ceil(f.tSec)) play('beep')
      if (!prev.thrust && f.rocketThrusting) play('whoosh')
      if (f.rocketShredded && !prev.shredded) play('boom')
      if (prev.chute === 0 && f.chute > 0) play('pop')
      if (prev.chute >= 0 && f.chute < 0) play('rip')
      if (prev.phase !== 'landed' && f.phase === 'landed') play(f.splatterProgress > 0 || run.result().landingFps > SMASH_FPS ? 'crash' : 'thunk')
      rumble.current.set(f.rocketThrusting ? 1 : f.rocketShredded ? Math.max(0, 0.5 - f.breakupProgress) : 0)
      prev = { t: f.tSec, thrust: f.rocketThrusting, chute: f.chute, shredded: f.rocketShredded, phase: f.phase }
      if (!run.done) raf = requestAnimationFrame(tick)
      else rumble.current.set(0)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, rumble])
}

function FlightHud({ run }: { run: RocketRun }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      setTick((t) => (t + 1) % 1e6)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [run])

  const f = run.frame
  const r = run.result()
  const telemetry = r.hasTelemetry
  const speedMph = Math.round((f.hudSpeedFps / M_TO_FT) * MS_TO_MPH)
  const stressPct = Math.min(100, Math.max(0, f.structuralStress * 100))
  const chuteNow = f.chute > 0 ? 'open' : f.chute < 0 ? r.chute : 'not-deployed'
  const callout = (tone: 'bad' | 'good', text: string) => (
    <div className={`animate-pop flex items-center gap-2 rounded-2xl px-5 py-2.5 font-display text-base font-extrabold text-white shadow-2xl ring-4 ring-white ${tone === 'bad' ? 'bg-rust' : 'bg-forest'}`}>
      {tone === 'bad' && <AlertTriangle className="size-5" />}
      {text}
    </div>
  )

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-ink/90 px-5 py-3 text-white shadow-xl backdrop-blur">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/60">Clock</div>
          <div className="font-mono text-xl font-bold tabular">{f.tSec < 0 ? `T−${Math.ceil(-f.tSec)}` : `T+${f.tSec.toFixed(1)}`}</div>
        </div>
        {telemetry ? (
          <>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-white/60">Altitude</div>
              <div className="font-mono text-xl font-bold tabular">
                {count(f.hudAltitudeFt)} <span className="text-xs font-normal">ft</span>
              </div>
            </div>
            <div className="w-44">
              <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-white/60">
                <span>Speed</span>
                {r.maxSafeMph > 0 && <span>safe {count(r.maxSafeMph)}</span>}
              </div>
              <div className="font-mono text-xl font-semibold tabular">
                {count(f.rocketShredded ? r.breakupSpeedMph : speedMph)} <span className="text-xs font-normal">mph</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className={`h-full rounded-full ${f.rocketShredded || stressPct >= 100 ? 'bg-rust' : stressPct > 85 ? 'bg-sun' : 'bg-leaf'}`}
                  style={{ width: `${f.rocketShredded ? 100 : stressPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-white/60">Parachute</div>
              <div className={`font-mono text-sm font-bold ${chuteNow === 'open' ? 'text-leaf' : chuteNow === 'not-deployed' ? 'text-white/80' : 'text-[#f2a093]'}`}>{CHUTE_TEXT[chuteNow]}</div>
            </div>
          </>
        ) : (
          <div className="font-mono text-sm text-[#f2c230]">No radio signal: live altitude and speed unavailable</div>
        )}
      </div>

      {f.lastLog && telemetry && <div className="rounded-lg bg-ink/75 px-3 py-1 font-mono text-xs text-[#8fd19e]">flight computer › {f.lastLog}</div>}

      {f.tSec > 0.4 && r.outcome === 'no-ignition' && callout('bad', 'NO IGNITION')}
      {f.tSec > 0.4 && r.outcome === 'no-liftoff' && callout('bad', `MOTOR LIT, ROCKET STAYED ON THE PAD`)}
      {f.rocketShredded && callout('bad', `${r.weakestPart === 'fins' ? 'FINS RIPPED OFF' : 'BODY TUBE TORE APART'} AT ${count(r.breakupSpeedMph)} MPH`)}
      {!f.rocketShredded && r.tumbled && f.phase === 'ascent' && f.tSec > 0.4 && callout('bad', 'TUMBLING')}
      {f.chute < 0 && f.phase === 'descent' && callout('bad', r.chute === 'torn' ? `PARACHUTE RIPPED (opened at ${count(r.deploySpeedMph ?? 0)} mph)` : 'PARACHUTE CAME LOOSE')}
      {f.phase === 'landed' &&
        (r.landingFps <= REQUIRED.maxLandingFps ? callout('good', `TOUCHDOWN AT ${r.landingFps} FT/S`) : callout('bad', `HIT THE GROUND AT ${r.landingFps} FT/S`))}
    </div>
  )
}
