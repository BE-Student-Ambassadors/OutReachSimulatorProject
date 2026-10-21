import { Check, Circle, Flag, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { money } from '../../../core/format'
import { namesLabel, rolesOf, teamRoster, togglePick, type RoleSplit } from '../../../core/roles'
import type { WorldProps } from '../../../core/scenario'
import { play, usePlayOnIncrease } from '../../../shared/audio/sfx'
import { CONE_PENALTY_S, heatStartTime, upsert } from '../config'
import { designCost, designFunds } from '../cost'
import { ROLE_BY_ID, roleChecklist, ROLES, roleSplit, teamChecklist, type CheckItem } from '../roles'
import { carParams, type CarParams } from '../sim/car'
import type { FsaeResult, FsaeRun } from '../sim/engine'
import type { FsaeObject, FsaeRoleId, LapObject, RaceCallObject, RolePrefObject } from '../types'
import { BusinessStation } from './BusinessStation'
import { ElectricalStation } from './ElectricalStation'
import { MechanicalStation } from './MechanicalStation'
import { usePaintVersion } from './paintStore'
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
  // The four jobs are split among however many people are on the team.
  const split = roleSplit(design, teamRoster(sync))
  const myRoles = rolesOf(split, me)
  const myPicks = design.find((o): o is RolePrefObject => o.kind === 'rolePref' && o.playerId === me)?.choices ?? []
  // The station tab follows this player's first job until they open another one.
  const [picked, setPicked] = useState<Tab | null>(null)
  const tab: Tab = picked ?? myRoles[0] ?? 'mechanical'
  const [pickerOpen, setPickerOpen] = useState(false)
  // Ask a new teammate for their picks once the team's design has loaded (not again after a refresh).
  const hasPicks = myPicks.length > 0
  const askedForPicks = useRef(false)
  useEffect(() => {
    if (!multiplayer || hasPicks || askedForPicks.current) return
    const t = window.setTimeout(() => {
      askedForPicks.current = true
      setPickerOpen(true)
    }, 1500)
    return () => clearTimeout(t)
  }, [multiplayer, hasPicks])
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

  const togglePref = (role: FsaeRoleId) => {
    if (locked) return
    const prev = design.find((o): o is RolePrefObject => o.kind === 'rolePref' && o.playerId === me)
    commit(upsert(design, { id: `rolePref:${me}`, kind: 'rolePref', playerId: me, playerName: meName, choices: togglePick(myPicks, role), updatedAt: prev?.updatedAt ?? 0 }))
    setPicked(null)
  }

  const fsaeRun = run as FsaeRun | null
  // Flyer paint is kept on this device; re-render so the business checklist sees it.
  usePaintVersion()
  usePlayOnIncrease(ROLES.reduce((n, r) => n + roleChecklist(design, r.id).filter((i) => i.done).length, 0) + teamChecklist(design, lastResult).filter((i) => i.done).length)
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
          setPicked('race')
        }}
      />
    )
  } else if (fsaeRun) {
    body = <TestRunView key={fsaeRun.variant} run={fsaeRun} design={design} />
  } else if (replay !== null) {
    const heatLaps = laps.filter((l) => l.heat === replay)
    body = <ReplayView design={design} laps={heatLaps} night={heatLaps[0]?.night ?? false} onExit={() => setReplay(null)} />
  } else if (tab === 'mechanical') body = <MechanicalStation design={design} locked={locked} onCommit={commit} />
  else if (tab === 'electrical') body = <ElectricalStation design={design} locked={locked} fallbackSeed={softwareSeed} onCommit={commit} />
  else if (tab === 'software') body = <SoftwareStation design={design} locked={locked} fallbackSeed={softwareSeed} onCommit={commit} />
  else if (tab === 'business') body = <BusinessStation design={design} locked={locked} fallbackSeed={softwareSeed} onCommit={commit} />
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
              const holders = split[r.id]
              const mine = holders.some((h) => h.id === me)
              const others = namesLabel(holders.filter((h) => h.id !== me), me)
              const active = tab === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    play('click')
                    setPicked(r.id)
                  }}
                  className={`flex items-center gap-2 rounded-t-xl border-x border-t px-3 py-2 text-left transition ${active ? 'border-line bg-paper' : 'border-transparent hover:bg-paper/60'}`}
                >
                  <span className="size-2.5 rounded-full" style={{ background: r.accent }} />
                  <span className="leading-tight">
                    <span className="block font-display text-[14px] font-bold text-ink">
                      {r.short}
                      {mine && multiplayer && <span className="ml-1 font-mono text-[10px] font-semibold text-forest">(you)</span>}
                    </span>
                    <span className="block font-mono text-[10px] text-ink/50">
                      {done}/{list.length} done{multiplayer && others ? ` · ${others}` : ''}
                    </span>
                  </span>
                  {done === list.length && <Check className="size-4 text-forest" strokeWidth={3} />}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => {
                play('click')
                setPicked('race')
              }}
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
                  <Users className="size-3.5" /> {myRoles.length ? `${myRoles.length > 1 ? 'Jobs' : 'Job'}: ${myRoles.map((r) => ROLE_BY_ID[r].short).join(' + ')}` : 'Pick your job'}
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

      {pickerOpen && showChrome && (
        <RolePicker split={split} me={me} picks={myPicks} teamSize={teamRoster(sync).length} onToggle={togglePref} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}

function RolePicker({
  split,
  me,
  picks,
  teamSize,
  onToggle,
  onClose,
}: {
  split: RoleSplit<FsaeRoleId>
  me: string
  picks: FsaeRoleId[]
  teamSize: number
  onToggle(role: FsaeRoleId): void
  onClose(): void
}) {
  const mine = rolesOf(split, me)
  const jobsLine =
    teamSize < ROLES.length
      ? `${teamSize} ${teamSize === 1 ? 'person' : 'people'}, four jobs: ${teamSize === 1 ? 'you do them all' : 'some of you take two'}.`
      : teamSize > ROLES.length
        ? `${teamSize} people, four jobs: some jobs are shared.`
        : 'Four people, four jobs: one each.'
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[760px] animate-pop rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-forest">Formula SAE team · {jobsLine}</div>
            <h2 className="font-display text-2xl font-bold">Pick your top two jobs</h2>
            <p className="text-sm text-ink/60">Tap your 1st choice, then your 2nd. The jobs are split across the team from everyone’s picks. You can still open every station and help out.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink/50 hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {ROLES.map((r) => {
            const rank = picks.indexOf(r.id)
            const who = namesLabel(split[r.id], me)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onToggle(r.id)}
                className={`rounded-xl p-4 text-left ring-1 transition hover:-translate-y-0.5 ${rank >= 0 ? 'bg-mint ring-2 ring-forest' : 'bg-paper ring-line hover:bg-white'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: r.accent }} />
                  <span className="font-display text-lg font-bold">{r.title}</span>
                  {rank >= 0 && <span className="ml-auto rounded-full bg-forest px-2 py-0.5 font-mono text-[10px] font-bold text-white">{rank === 0 ? '1st' : '2nd'}</span>}
                </div>
                <p className="mt-1 text-sm text-ink/70">{r.summary}</p>
                <div className="mt-2 font-mono text-[11px] text-ink/55">Assigned to: {who || 'nobody yet'}</div>
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm">
            {mine.length ? (
              <>
                {mine.length > 1 ? 'Your jobs' : 'Your job'}: <strong className="text-forest">{mine.map((r) => ROLE_BY_ID[r].title).join(' + ')}</strong>
              </>
            ) : null}
          </span>
          <button type="button" onClick={onClose} className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
