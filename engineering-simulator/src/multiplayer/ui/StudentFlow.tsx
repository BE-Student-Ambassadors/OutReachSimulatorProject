import { signInAnonymously } from 'firebase/auth'
import { onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { LogIn, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AnyScenario, DesignObject, GroupSync } from '../../core/scenario'
import { Sandbox } from '../../shell/Sandbox'
import { eventsCol, joinSession, JoinError, postEvent, setChoices, sharedRef, touchPresence, writeShared } from '../api'
import { auth, db } from '../firebase'
import { isOnline, useAuthUser, useGroups, useNow, usePlayers, useSession } from '../hooks'
import { saveGame, savedGame } from '../saved'
import { Card, Countdown, PrimaryButton, Screen } from './common'

/** Student entry: type the code, type a name, wait in the lobby, then play with your group. */
export function StudentFlow({ scenarios, initialCode, onExit }: { scenarios: AnyScenario[]; initialCode: string; onExit(): void }) {
  const [sid, setSid] = useState<string | null>(() => savedGame('student'))
  const leave = () => {
    saveGame('student', null)
    setSid(null)
    onExit()
  }
  if (!sid)
    return (
      <JoinForm
        initialCode={initialCode}
        onBack={onExit}
        onJoined={(id) => {
          saveGame('student', id)
          setSid(id)
        }}
      />
    )
  return <StudentSession sid={sid} scenarios={scenarios} onLeave={leave} />
}

function JoinForm({ initialCode, onJoined, onBack }: { initialCode: string; onJoined(sid: string): void; onBack(): void }) {
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const user = auth.currentUser ?? (await signInAnonymously(auth)).user
      onJoined(await joinSession(db, user.uid, code, name))
    } catch (e) {
      setError(e instanceof JoinError ? e.message : 'Could not join. Check your internet connection and try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Screen onBack={onBack}>
      <Card>
        <h1 className="font-display text-3xl font-extrabold text-forest">Join a game</h1>
        <p className="mt-1 text-ink/65">Type the code on the big screen.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!busy) void submit()
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold">Game code</span>
            <input
              inputMode="numeric"
              autoFocus={!initialCode}
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="mt-1 w-full rounded-xl border border-line bg-paper px-4 py-3 text-center font-mono text-3xl font-semibold tracking-[0.3em] outline-none focus:border-forest focus:ring-2 focus:ring-forest/30"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Your name</span>
            <input
              autoFocus={!!initialCode}
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
              className="mt-1 w-full rounded-xl border border-line bg-paper px-4 py-3 text-lg outline-none focus:border-forest focus:ring-2 focus:ring-forest/30"
            />
          </label>
          {error && <p className="rounded-lg bg-[#fbeee6] px-3 py-2 text-sm font-medium text-rust">{error}</p>}
          <PrimaryButton type="submit" disabled={busy || code.length !== 6 || !name.trim()} className="w-full">
            <LogIn className="size-4" /> {busy ? 'Joining…' : 'Join'}
          </PrimaryButton>
        </form>
      </Card>
    </Screen>
  )
}

function StudentSession({ sid, scenarios, onLeave }: { sid: string; scenarios: AnyScenario[]; onLeave(): void }) {
  const user = useAuthUser()
  const session = useSession(sid)
  const players = usePlayers(sid)
  const groups = useGroups(sid)
  const now = useNow(5000)
  const me = user ? players.find((p) => p.id === user.uid) : undefined
  const group = me?.groupId ? groups.find((g) => g.id === me.groupId) : undefined
  const teammates = group ? players.filter((p) => p.groupId === group.id) : []
  // The team's challenge decides what this student plays.
  const scenario = scenarios.find((s) => s.id === group?.gameId)
  const offered = scenarios.filter((s) => session?.gameIds.includes(s.id))

  // Presence: check in every 30 s so the host can see who is online.
  useEffect(() => {
    if (!user || !me) return
    const t = setInterval(() => void touchPresence(db, sid, user.uid).catch(() => {}), 30_000)
    return () => clearInterval(t)
  }, [user, me, sid])

  if (session === null)
    return (
      <Screen onBack={onLeave}>
        <Card>
          <h1 className="font-display text-2xl font-bold">This game is no longer available</h1>
          <PrimaryButton className="mt-4" onClick={onLeave}>Back</PrimaryButton>
        </Card>
      </Screen>
    )
  if (user === undefined || !session || !players.length) return <Screen onBack={onLeave}><Card>Connecting…</Card></Screen>
  if (!me)
    return (
      <Screen onBack={onLeave}>
        <Card>
          <h1 className="font-display text-2xl font-bold">You are not in this game</h1>
          <p className="mt-1 text-ink/65">The host may have removed you. Join again with the code.</p>
          <PrimaryButton className="mt-4" onClick={onLeave}>Back</PrimaryButton>
        </Card>
      </Screen>
    )

  const timeUp = !!session.endsAt && now > session.endsAt
  if (session.state === 'playing' && group && scenario)
    return (
      <GroupPlay
        key={`${sid}:${group.id}`}
        sid={sid}
        gid={group.id}
        uid={user!.uid}
        name={me.name}
        teammates={teammates.map((p) => ({ id: p.id, name: p.name }))}
        scenario={scenario}
        frozen={timeUp}
        onLeave={onLeave}
        header={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: group.color }}>
              <Users className="size-3.5" /> {group.name} · Station {group.station}
            </span>
            <span className="max-w-48 truncate text-xs text-ink/60" title={teammates.map((p) => p.name).join(', ')}>
              {teammates.map((p) => p.name).join(', ')}
            </span>
            <Countdown endsAt={session.endsAt} className="text-lg" />
          </div>
        }
      />
    )

  return (
    <Screen onBack={onLeave}>
      <Card className="text-center">
        {session.state === 'ended' ? (
          <>
            <h1 className="font-display text-3xl font-extrabold text-forest">Game over</h1>
            <p className="mt-2 text-ink/70">Thanks for engineering with us, {me.name}!</p>
          </>
        ) : (
          <>
            <div className="font-mono text-xs uppercase tracking-wider text-ink/50">Game {session.code}</div>
            <h1 className="mt-1 font-display text-3xl font-extrabold text-forest">You're in, {me.name}!</h1>
            {group ? (
              <div className="mt-5">
                <p className="text-sm font-semibold uppercase tracking-wider text-ink/50">{scenario?.title}</p>
                <div className="mt-1 font-display text-5xl font-extrabold text-ink">Go to Station {group.station}</div>
                <span className="mt-4 inline-block rounded-full px-4 py-1.5 font-display text-lg font-bold text-white" style={{ backgroundColor: group.color }}>
                  {group.name}
                </span>
                <p className="mt-4 text-sm text-ink/60">Your team</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {teammates.map((p) => (
                    <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-sm ring-1 ring-line">
                      <span className={`size-2 rounded-full ${isOnline(p.lastSeen, now) ? 'bg-leaf' : 'bg-line'}`} />
                      {p.name}
                    </span>
                  ))}
                </div>
                <p className="mt-6 text-sm text-ink/50">The challenge starts when the host is ready.</p>
              </div>
            ) : offered.length > 1 ? (
              <Picks sid={sid} uid={user!.uid} offered={offered} choices={me.choices ?? []} />
            ) : (
              <p className="mt-4 text-ink/65">Waiting for the host to make teams…</p>
            )}
            <p className="mt-6 text-sm text-ink/50">
              {players.length} player{players.length === 1 ? '' : 's'} joined
            </p>
          </>
        )}
      </Card>
    </Screen>
  )
}

/** Rank a 1st and 2nd choice by clicking challenge cards (click again to undo). Saved live. */
function Picks({ sid, uid, offered, choices }: { sid: string; uid: string; offered: AnyScenario[]; choices: string[] }) {
  const toggle = (id: string) => {
    const next = choices.includes(id) ? choices.filter((c) => c !== id) : [...choices, id].slice(0, 2)
    void setChoices(db, sid, uid, next).catch(() => {})
  }
  const done = choices.length >= Math.min(2, offered.length)
  return (
    <div className="mt-5 text-left">
      <p className="text-center text-ink/70">
        {choices.length === 0 ? 'Which challenge sounds most fun? Tap your 1st choice.' : done ? 'Got it! Waiting for the host to make teams…' : 'Now tap your 2nd choice.'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {offered.map((s) => {
          const rank = choices.indexOf(s.id)
          const Art = s.CardArt
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={`relative overflow-hidden rounded-2xl bg-white text-left ring-1 transition ${rank >= 0 ? 'ring-4 ring-forest' : 'ring-line hover:-translate-y-0.5'}`}
            >
              <div className="relative h-20 overflow-hidden bg-forest">{Art && <Art />}</div>
              <div className="p-3">
                <div className="font-display text-lg font-bold leading-tight">{s.title}</div>
                <div className="text-xs text-ink/60">{s.tagline}</div>
              </div>
              {rank >= 0 && (
                <span className="absolute right-2 top-2 rounded-full bg-white px-2.5 py-1 font-display text-sm font-extrabold text-forest shadow">
                  {rank === 0 ? '1st' : '2nd'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Plays a scenario with the group's shared design and shared test runs. */
function GroupPlay(props: {
  sid: string
  gid: string
  uid: string
  name: string
  teammates: { id: string; name: string }[]
  scenario: AnyScenario
  frozen: boolean
  header: React.ReactNode
  onLeave(): void
}) {
  const { sid, gid, uid, name, teammates, scenario, frozen, header, onLeave } = props
  // Only replay teammates' tests that start after this device opened the game.
  const [joinedAt] = useState(() => Date.now() - 2000)
  const sync = useMemo<GroupSync>(
    () => ({
      me: uid,
      meName: name,
      teammates,
      onRemoteDesign: (cb) =>
        onSnapshot(sharedRef(db, sid, gid, 'design'), (s) => {
          const d = s.data()
          cb(d ? { design: d.data as DesignObject[], rev: d.rev as number, updatedBy: d.updatedBy as string } : null)
        }),
      push: (design) => void writeShared(db, sid, gid, 'design', design, uid).catch(() => {}),
      onTeammateRun: (cb) =>
        onSnapshot(query(eventsCol(db, sid, gid), where('at', '>=', joinedAt), orderBy('at')), (s) => {
          for (const ch of s.docChanges()) {
            if (ch.type !== 'added') continue
            const e = ch.doc.data()
            if (e.type === 'run' && e.by !== uid) cb({ id: ch.doc.id, variantId: e.payload.variantId, design: e.payload.design, byName: e.byName })
          }
        }),
      announceRun: (variantId, design) => void postEvent(db, sid, gid, 'run', { variantId, design }, { uid, name }).catch(() => {}),
      reportResult: (r) => void postEvent(db, sid, gid, 'result', r, { uid, name }).catch(() => {}),
    }),
    [sid, gid, uid, name, teammates, joinedAt],
  )
  return <Sandbox scenario={scenario} sync={sync} frozen={frozen} headerExtra={header} onExit={onLeave} />
}
