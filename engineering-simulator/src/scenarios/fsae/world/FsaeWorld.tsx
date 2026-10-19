import { Check, Circle, Flag, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { money } from '../../../core/format'
import type { WorldProps } from '../../../core/scenario'
import { CONE_PENALTY_S, heatStartTime, upsert } from '../config'
import { designCost, designFunds } from '../cost'
import { getClaims, ROLE_BY_ID, roleChecklist, ROLES, teamChecklist, type CheckItem } from '../roles'
import { carParams, type CarParams } from '../sim/car'
import type { FsaeResult, FsaeRun } from '../sim/engine'
import type { ClaimObject, FsaeObject, FsaeRoleId, LapObject, RaceCallObject } from '../types'
import { BusinessStation } from './BusinessStation'
import { ElectricalStation } from './ElectricalStation'
import { MechanicalStation } from './MechanicalStation'
import { RaceDayStation } from './RaceDayStation'
import { RaceView, ReplayView, type FinishedLap } from './RaceView'
import { SoftwareStation } from './SoftwareStation'
import { TestRunView } from './TestRunView'

type Tab = FsaeRoleId | 'race'

/** Keyframes used by the stations (kept here so the scenario doesn't touch global CSS). */
const KEYFRAMES = `
@keyframes fsae-flow { from { background-position: 0 0 } to { background-position: 9px 0 } }
@keyframes fsae-spin { to { transform: rotate(360deg) } }
@keyframes fsae-pulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.15) } }
@keyframes fsae-blink { 50% { opacity: 0 } }
@keyframes fsae-zoom { 0% { transform: translateX(0) } 45% { transform: translateX(240px) } 46% { transform: translateX(-240px) } 100% { transform: translateX(0) } }
`

/** Solo players get their own picture set and equations each visit. */
const SOLO_SEED = Math.floor(Math.random() * 1_000_000_000) + 1

function hashSeed(ids: string[]): number {
  let h = 2166136261
  for (const c of [...ids].sort().join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0) || 1
}

export function FsaeWorld({ design, locked, run, lastResult, onCommit, sync, onStartRun }: WorldProps<FsaeObject, FsaeResult>) {
  const me = sync?.me ?? 'solo'
  const meName = sync?.meName ?? 'You'
  const multiplayer = !!sync
  const claims = getClaims(design)
  const myRole = (Object.entries(claims).find(([, c]) => c?.playerId === me)?.[0] ?? null) as FsaeRoleId | null
  const [tab, setTab] = useState<Tab>(() => myRole ?? 'mechanical')
  const [pickerOpen, setPickerOpen] = useState(() => multiplayer && !myRole)
  // The car's numbers are frozen when the heat starts.
  const [racing, setRacing] = useState<{ call: RaceCallObject; params: CarParams } | null>(null)
  const [replay, setReplay] = useState<number | null>(null)
  const handledHeat = useRef(0)
  const latestDesign = useRef(design)
  useEffect(() => {
    latestDesign.current = design
  })

  const softwareSeed = useMemo(() => (sync?.teammates?.length ? hashSeed(sync.teammates.map((t) => t.id)) : SOLO_SEED), [sync])
  const commit = (next: FsaeObject[]) => onCommit(next, null)

  // A teammate (or this player) called a heat: join it if its start time hasn't long passed.
  const call = design.find((o): o is RaceCallObject => o.kind === 'raceCall') ?? null
  useEffect(() => {
    if (!call) return
    const t = window.setTimeout(() => {
      if (call.heat > handledHeat.current && Date.now() < call.startAt + 3000) {
        handledHeat.current = call.heat
        setReplay(null)
        setRacing({ call, params: carParams(latestDesign.current) })
      } else handledHeat.current = Math.max(handledHeat.current, call.heat)
    }, 0)
    return () => clearTimeout(t)
  }, [call])

  const laps = design.filter((o): o is LapObject => o.kind === 'lap')

  const startHeat = (night: boolean) => {
    if (locked) return
    const heat = Math.max(call?.heat ?? 0, ...laps.map((l) => l.heat)) + 1
    commit(upsert(design, { id: 'race:call', kind: 'raceCall', heat, night, startAt: heatStartTime(), byName: meName, updatedAt: 0 }))
  }

  const finishLap = (heat: number, night: boolean, lap: FinishedLap) => {
    const obj: LapObject = {
      id: `lap:${me}:${heat}`,
      kind: 'lap',
      playerId: me,
      playerName: meName,
      heat,
      night,
      driveS: lap.driveS,
      conesHit: lap.conesHit,
      totalS: Math.round((lap.driveS + lap.conesHit * CONE_PENALTY_S) * 100) / 100,
      trace: lap.trace,
      updatedAt: 0,
    }
    commit(upsert(design, obj))
  }

  const claim = (role: FsaeRoleId | null) => {
    let next = design
    for (const r of ROLES) {
      const c = claims[r.id]
      if (c?.playerId === me && r.id !== role) next = upsert(next, { ...c, playerId: null, playerName: null })
    }
    if (role) {
      const obj: ClaimObject = { id: `claim:${role}`, kind: 'claim', role, playerId: me, playerName: meName, updatedAt: claims[role]?.updatedAt ?? 0 }
      next = upsert(next, obj)
      setTab(role)
    }
    commit(next)
    setPickerOpen(false)
  }

  const fsaeRun = run as FsaeRun | null
  const items: CheckItem[] = tab === 'race' ? teamChecklist(design, lastResult) : roleChecklist(design, tab)
  const cost = designCost(design)
  const funds = designFunds(design)

  let body
  if (racing) {
    const { call: heat, params } = racing
    const ghosts = laps.filter((l) => l.heat < heat.heat).sort((a, b) => b.heat - a.heat || a.totalS - b.totalS)
    // One ghost per driver: their most recent earlier lap.
    const seen = new Set<string>()
    const latest = ghosts.filter((g) => (seen.has(g.playerId) ? false : (seen.add(g.playerId), true)))
    body = (
      <RaceView
        key={heat.heat}
        design={design}
        params={params}
        startAt={heat.startAt}
        night={heat.night}
        heat={heat.heat}
        ghosts={latest}
        onFinish={(lap) => finishLap(heat.heat, heat.night, lap)}
        onExit={() => {
          setRacing(null)
          setTab('race')
        }}
      />
    )
  } else if (fsaeRun) {
    body = <TestRunView key={fsaeRun.variant} run={fsaeRun} design={design} />
  } else if (replay !== null) {
    const heatLaps = laps.filter((l) => l.heat === replay)
    body = <ReplayView design={design} laps={heatLaps} night={heatLaps[0]?.night ?? false} onExit={() => setReplay(null)} />
  } else if (tab === 'mechanical') body = <MechanicalStation design={design} locked={locked} onCommit={commit} />
  else if (tab === 'electrical') body = <ElectricalStation design={design} locked={locked} onCommit={commit} />
  else if (tab === 'software') body = <SoftwareStation design={design} locked={locked} fallbackSeed={softwareSeed} onCommit={commit} />
  else if (tab === 'business') body = <BusinessStation design={design} locked={locked} onCommit={commit} />
  else
    body = (
      <RaceDayStation
        design={design}
        lastResult={lastResult}
        locked={locked}
        onStartRun={onStartRun}
        onStartHeat={startHeat}
        onReplay={(h) => setReplay(h)}
      />
    )

  const showChrome = !racing && !fsaeRun && replay === null

  return (
    <div className="relative flex h-full flex-col bg-paper">
      <style>{KEYFRAMES}</style>
      {showChrome && (
        <div className="shrink-0 border-b border-line bg-white px-3 pt-2">
          <div className="flex items-center gap-1.5">
            {ROLES.map((r) => {
              const list = roleChecklist(design, r.id)
              const done = list.filter((i) => i.done).length
              const holder = claims[r.id]
              const active = tab === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setTab(r.id)}
                  className={`flex items-center gap-2 rounded-t-xl border-x border-t px-3 py-2 text-left transition ${active ? 'border-line bg-paper' : 'border-transparent hover:bg-paper/60'}`}
                >
                  <span className="size-2.5 rounded-full" style={{ background: r.accent }} />
                  <span className="leading-tight">
                    <span className="block font-display text-[14px] font-bold text-ink">
                      {r.short}
                      {holder?.playerId === me && multiplayer && <span className="ml-1 font-mono text-[10px] font-semibold text-forest">(you)</span>}
                    </span>
                    <span className="block font-mono text-[10px] text-ink/50">
                      {done}/{list.length} done{multiplayer && holder?.playerName && holder.playerId !== me ? ` · ${holder.playerName}` : ''}
                    </span>
                  </span>
                  {done === list.length && <Check className="size-4 text-forest" strokeWidth={3} />}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setTab('race')}
              className={`flex items-center gap-2 rounded-t-xl border-x border-t px-3 py-2 transition ${tab === 'race' ? 'border-line bg-paper' : 'border-transparent hover:bg-paper/60'}`}
            >
              <Flag className="size-4 text-forest" />
              <span className="font-display text-[14px] font-bold text-ink">Test & Race Day</span>
            </button>
            <div className="ml-auto flex items-center gap-2 pb-1">
              <span className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${funds >= cost ? 'bg-mint text-forest' : 'bg-[#fbeee6] text-rust'}`}>
                Money {money(funds)} · Car {money(cost)}
              </span>
              {multiplayer && (
                <button type="button" onClick={() => setPickerOpen(true)} className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-xs font-bold ring-1 ring-line hover:bg-mint">
                  <Users className="size-3.5" /> {myRole ? `Job: ${ROLE_BY_ID[myRole].short}` : 'Pick your job'}
                </button>
              )}
            </div>
          </div>
          <div className="-mx-3 flex flex-wrap items-center gap-1.5 border-t border-line bg-paper px-3 py-2">
            <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink/45">{tab === 'race' ? 'Team checklist' : `${ROLE_BY_ID[tab].short} checklist`}</span>
            {items.map((it) => (
              <span
                key={`${it.key}:${it.done}`}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${it.done ? 'animate-pop bg-forest text-white ring-forest' : 'bg-white text-ink/75 ring-line'}`}
              >
                {it.done ? <Check className="size-3.5" strokeWidth={3} /> : <Circle className="size-3 text-ink/30" />}
                {it.label}
                {it.progress && <span className={`font-mono text-[10px] ${it.done ? 'text-white/75' : 'text-ink/45'}`}>{it.progress}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 p-3">{body}</div>

      {pickerOpen && showChrome && <RolePicker claims={claims} me={me} onPick={claim} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}

function RolePicker({ claims, me, onPick, onClose }: { claims: Record<FsaeRoleId, ClaimObject | null>; me: string; onPick(role: FsaeRoleId | null): void; onClose(): void }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[760px] animate-pop rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-forest">Formula SAE team</div>
            <h2 className="font-display text-2xl font-bold">Pick your job</h2>
            <p className="text-sm text-ink/60">Four jobs, one car. You can still open every station and help out.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink/50 hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {ROLES.map((r) => {
            const c = claims[r.id]
            const mine = c?.playerId === me
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onPick(r.id)}
                className={`rounded-xl p-4 text-left ring-1 transition hover:-translate-y-0.5 ${mine ? 'bg-mint ring-2 ring-forest' : 'bg-paper ring-line hover:bg-white'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: r.accent }} />
                  <span className="font-display text-lg font-bold">{r.title}</span>
                </div>
                <p className="mt-1 text-sm text-ink/70">{r.summary}</p>
                <div className="mt-2 font-mono text-[11px] text-ink/55">{mine ? 'Your job' : c?.playerName ? `Taken by ${c.playerName} (tap to swap in)` : 'Open'}</div>
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => onPick(null)} className="rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-line hover:bg-paper">
            No job, I’ll help everyone
          </button>
        </div>
      </div>
    </div>
  )
}
