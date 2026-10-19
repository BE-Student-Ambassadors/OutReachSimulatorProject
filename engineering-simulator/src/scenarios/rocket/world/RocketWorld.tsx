import { AlertTriangle, Briefcase, CheckCircle2, Circle, Code2, Rocket, Users, Wrench, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { count, money } from '../../../core/format'
import type { WorldProps } from '../../../core/scenario'
import { BLUEPRINT, CIRCUITS, getElectrical, getMechanical, getSoftware, REQUIRED } from '../config'
import { designCost, designFunds } from '../cost'
import { assignRocketRoles, extractRolePrefs, ROCKET_ROLES } from '../roles'
import { boardStatus } from '../sim/board'
import { resolveBuild } from '../sim/build'
import { MS_TO_MPH, M_TO_FT, type RocketResult, type RocketRun } from '../sim/engine'
import type { RocketObject, RocketRoleId } from '../types'
import { BusinessStation } from './BusinessStation'
import { checklist } from './checklists'
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
  const assignments = assignRocketRoles(extractRolePrefs(design, teammates))
  const myRole = assignments.find((a) => a.playerId === myId)?.roleId
  const tab: TabId = picked ?? myRole ?? 'electrical'

  const funds = designFunds(design)
  const spent = designCost(design)
  const now = useNow(getMechanical(design).orders.length > 0, 1000)
  const steps = checklist(tab, design, now, !!lastResult)
  const rocketRun = (run as RocketRun | null) ?? null
  const look = lookFor(resolveBuild(getMechanical(design)))

  if (rocketRun) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <RocketScene look={look} run={rocketRun} />
        <FlightHud run={rocketRun} />
      </div>
    )
  }

  const tabs: { id: TabId; label: string; icon: LucideIcon; accent: string; who?: string | null }[] = [
    ...ROCKET_ROLES.map((r) => ({ id: r.id, label: r.shortTitle, icon: ROLE_ICONS[r.id], accent: r.accent, who: assignments.find((a) => a.roleId === r.id)?.playerName })),
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
              onClick={() => setPicked(t.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-left transition ${active ? 'bg-ink text-white' : 'hover:bg-paper'}`}
            >
              <span className="grid size-7 place-items-center rounded-lg text-white" style={{ backgroundColor: active ? '#ffffff22' : t.accent }}>
                <t.icon className="size-4" />
              </span>
              <span className="leading-tight">
                <span className="block font-display text-sm font-bold">{t.label}</span>
                {t.id !== 'launch' && (
                  <span className={`block text-[11px] ${active ? 'text-white/65' : 'text-ink/50'}`}>{t.who ? (t.id === myRole ? `${t.who} (you)` : t.who) : 'open seat'}</span>
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
          teammates={teammates}
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
