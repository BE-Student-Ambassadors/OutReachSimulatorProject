import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { Clock, LogOut, Play, Plus, Shuffle, Square, UserX, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AnyScenario } from '../../core/scenario'
import { assignGroups, createSession, MAX_GROUPS, movePlayer, placeLateJoiners, removePlayer, setSessionState, updateSession } from '../api'
import { auth, db } from '../firebase'
import { isOnline, useAuthUser, useEvents, useGroups, useNow, usePlayers, useSession } from '../hooks'
import type { Group, Player, Session } from '../types'
import { Card, Countdown, PrimaryButton, Screen, SecondaryButton } from './common'

const SAVED = 'sel-host-session'
const read = () => {
  try {
    return sessionStorage.getItem(SAVED)
  } catch {
    return null
  }
}
const write = (sid: string | null) => {
  try {
    if (sid) sessionStorage.setItem(SAVED, sid)
    else sessionStorage.removeItem(SAVED)
  } catch {
    /* ignore */
  }
}

/** Instructor: sign in with Google, set up a game, run the lobby, watch the groups live. */
export function HostFlow({ scenarios, onExit }: { scenarios: AnyScenario[]; onExit(): void }) {
  const user = useAuthUser()
  const [sid, setSid] = useState<string | null>(read)
  const [error, setError] = useState<string | null>(null)

  if (user === undefined) return <Screen onBack={onExit}><Card>Loading…</Card></Screen>
  if (!user || user.isAnonymous)
    return (
      <Screen onBack={onExit}>
        <Card>
          <h1 className="font-display text-3xl font-extrabold text-forest">Host a game</h1>
          <p className="mt-1 text-ink/65">Instructors sign in with a UCSC Google account (or one on the instructor list).</p>
          {error && <p className="mt-4 rounded-lg bg-[#fbeee6] px-3 py-2 text-sm font-medium text-rust">{error}</p>}
          <PrimaryButton
            className="mt-6 w-full"
            onClick={() =>
              signInWithPopup(auth, new GoogleAuthProvider()).catch((e: { code?: string }) =>
                setError(e.code === 'auth/popup-closed-by-user' ? null : 'Sign-in did not finish. Please try again.'),
              )
            }
          >
            Sign in with Google
          </PrimaryButton>
        </Card>
      </Screen>
    )

  const hostName = user.displayName ?? user.email ?? 'Instructor'
  const exit = () => {
    write(null)
    setSid(null)
    onExit()
  }
  if (!sid)
    return (
      <Setup
        scenarios={scenarios}
        hostName={hostName}
        email={user.email}
        onBack={onExit}
        onCreate={async (gameId, groupCount) => {
          const s = await createSession(db, { uid: user.uid, name: hostName }, { gameId, groupCount })
          write(s.id)
          setSid(s.id)
        }}
      />
    )
  return <HostSession sid={sid} scenarios={scenarios} onDone={exit} onNew={() => (write(null), setSid(null))} />
}

function Setup({ scenarios, hostName, email, onCreate, onBack }: { scenarios: AnyScenario[]; hostName: string; email: string | null; onCreate(gameId: string, groups: number): Promise<void>; onBack(): void }) {
  const [gameId, setGameId] = useState(scenarios[0].id)
  const [groups, setGroups] = useState(4)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Screen onBack={onBack}>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-forest">New game</h1>
            <p className="mt-1 text-sm text-ink/60">
              Signed in as {hostName}
              {email ? ` (${email})` : ''}
            </p>
          </div>
          <button type="button" className="flex items-center gap-1 text-xs font-semibold text-ink/50 hover:text-ink" onClick={() => void signOut(auth)}>
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
        <div className="mt-6 space-y-3">
          <div className="text-sm font-semibold">Challenge</div>
          {scenarios.map((s) => (
            <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 ring-1 ${gameId === s.id ? 'bg-mint ring-2 ring-forest' : 'ring-line hover:bg-paper'}`}>
              <input type="radio" name="game" className="accent-forest" checked={gameId === s.id} onChange={() => setGameId(s.id)} />
              <span>
                <span className="block font-display font-bold">{s.title}</span>
                <span className="block text-xs text-ink/60">{s.discipline}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm font-semibold">Number of teams</span>
          <Stepper value={groups} min={1} max={MAX_GROUPS} onChange={setGroups} />
        </div>
        {error && <p className="mt-4 rounded-lg bg-[#fbeee6] px-3 py-2 text-sm font-medium text-rust">{error}</p>}
        <PrimaryButton
          className="mt-6 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              await onCreate(gameId, groups)
            } catch (e) {
              const code = (e as { code?: string }).code
              setError(code === 'permission-denied' ? 'This account is not allowed to host games. Ask an admin to add your email to the instructor list.' : 'Could not create the game. Check your connection and try again.')
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Creating…' : 'Create game'}
        </PrimaryButton>
      </Card>
    </Screen>
  )
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange(v: number): void }) {
  return (
    <div className="flex items-center gap-2">
      <SecondaryButton className="size-9 !p-0" disabled={value <= min} onClick={() => onChange(value - 1)}>−</SecondaryButton>
      <span className="w-8 text-center font-mono text-lg font-semibold">{value}</span>
      <SecondaryButton className="size-9 !p-0" disabled={value >= max} onClick={() => onChange(value + 1)}>+</SecondaryButton>
    </div>
  )
}

const TIMERS = [10, 15, 20, 0]

function HostSession({ sid, scenarios, onDone, onNew }: { sid: string; scenarios: AnyScenario[]; onDone(): void; onNew(): void }) {
  const session = useSession(sid)
  const players = usePlayers(sid)
  const groups = useGroups(sid)
  const now = useNow()
  const [minutes, setMinutes] = useState(15)
  const scenario = scenarios.find((s) => s.id === session?.gameId)

  // While playing, put late joiners on the smallest team, and end the round when time is up.
  const unassigned = players.filter((p) => !p.groupId).length
  useEffect(() => {
    if (session?.state === 'playing' && unassigned > 0 && groups.length) void placeLateJoiners(db, sid, players, groups)
  }, [session?.state, unassigned, groups, players, sid])
  useEffect(() => {
    if (session?.state === 'playing' && session.endsAt && now > session.endsAt + 3000) void setSessionState(db, sid, 'ended')
  }, [session?.state, session?.endsAt, now, sid])

  if (!session) return <Screen onBack={onDone}><Card>Loading game…</Card></Screen>
  const joinUrl = `${location.origin}/?join=${session.code}`

  return (
    <Screen wide onBack={onDone}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-ink/50">{scenario?.title ?? session.gameId}</div>
          <h1 className="font-display text-3xl font-extrabold text-forest">
            {session.state === 'lobby' ? 'Waiting for players' : session.state === 'playing' ? 'Game in progress' : 'Game over'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {session.state === 'playing' && (
            <>
              <span className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow ring-1 ring-black/5">
                <Clock className="size-4 text-ink/50" />
                <Countdown endsAt={session.endsAt} className="text-2xl" />
              </span>
              {session.endsAt && (
                <SecondaryButton onClick={() => void updateSession(db, sid, { endsAt: Math.max(session.endsAt!, Date.now()) + 5 * 60_000 })}>
                  <Plus className="size-4" /> 5 min
                </SecondaryButton>
              )}
              <SecondaryButton onClick={() => confirm('End the game for everyone?') && void setSessionState(db, sid, 'ended')}>
                <Square className="size-4" /> End game
              </SecondaryButton>
            </>
          )}
          {session.state === 'ended' && <PrimaryButton onClick={onNew}>New game</PrimaryButton>}
        </div>
      </div>

      {session.state !== 'ended' && (
        <Card className="mt-6 flex flex-wrap items-center gap-6">
          <div>
            <div className="text-sm font-semibold text-ink/60">Join at {location.host} with code</div>
            <div className="font-mono text-6xl font-bold tracking-[0.15em] text-ink">{session.code}</div>
          </div>
          <div className="ml-auto text-right text-sm text-ink/60">
            <div className="font-mono text-xs">{joinUrl}</div>
            <div className="mt-1 font-display text-2xl font-bold text-ink">
              {players.length} player{players.length === 1 ? '' : 's'}
            </div>
          </div>
        </Card>
      )}

      {session.state === 'lobby' && (
        <Lobby session={session} players={players} groups={groups} minutes={minutes} setMinutes={setMinutes} />
      )}
      {session.state !== 'lobby' && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupCard key={g.id} sid={sid} group={g} players={players.filter((p) => p.groupId === g.id)} since={session.createdAt} now={now} />
          ))}
        </div>
      )}
    </Screen>
  )
}

function Lobby({ session, players, groups, minutes, setMinutes }: { session: Session; players: Player[]; groups: Group[]; minutes: number; setMinutes(m: number): void }) {
  const sid = session.id
  const [teams, setTeams] = useState(session.groupCount)
  const now = useNow(5000)
  const grouped = groups.length > 0 && players.every((p) => p.groupId)
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Teams</h2>
          <div className="flex items-center gap-3">
            <Stepper value={teams} min={1} max={MAX_GROUPS} onChange={setTeams} />
            <SecondaryButton disabled={!players.length} onClick={() => void assignGroups(db, sid, teams)}>
              <Shuffle className="size-4" /> {groups.length ? 'Reshuffle' : 'Make teams'}
            </SecondaryButton>
          </div>
        </div>
        {groups.length === 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {players.map((p) => (
              <PlayerChip key={p.id} sid={sid} p={p} now={now} />
            ))}
            {!players.length && <p className="text-ink/55">Players appear here as they join.</p>}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id} className="rounded-xl p-3 ring-1 ring-line">
                <div className="mb-2 flex items-center gap-2 font-display font-bold" style={{ color: g.color }}>
                  <Users className="size-4" /> {g.name}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {players.filter((p) => p.groupId === g.id).map((p) => (
                    <PlayerChip key={p.id} sid={sid} p={p} now={now} groups={groups} />
                  ))}
                </div>
              </div>
            ))}
            {players.some((p) => !p.groupId) && (
              <div className="rounded-xl bg-paper p-3 ring-1 ring-line sm:col-span-2">
                <div className="mb-2 text-sm font-semibold text-ink/60">Not on a team yet</div>
                <div className="flex flex-wrap gap-1.5">
                  {players.filter((p) => !p.groupId).map((p) => (
                    <PlayerChip key={p.id} sid={sid} p={p} now={now} groups={groups} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="font-display text-xl font-bold">Start</h2>
        <div className="mt-3 text-sm font-semibold text-ink/60">Round length</div>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-lg bg-paper p-1 ring-1 ring-black/5">
          {TIMERS.map((m) => (
            <button key={m} type="button" onClick={() => setMinutes(m)} className={`rounded-md py-1.5 text-sm font-semibold ${minutes === m ? 'bg-forest text-white' : 'text-ink/70 hover:bg-white'}`}>
              {m ? `${m}m` : 'None'}
            </button>
          ))}
        </div>
        <PrimaryButton
          className="mt-5 w-full"
          disabled={!grouped}
          onClick={() => void setSessionState(db, sid, 'playing', { endsAt: minutes ? Date.now() + minutes * 60_000 : null })}
        >
          <Play className="size-4" /> Start game
        </PrimaryButton>
        {!grouped && <p className="mt-2 text-xs text-ink/55">Make teams first. Students who join later are added to the smallest team.</p>}
      </Card>
    </div>
  )
}

function PlayerChip({ sid, p, now, groups }: { sid: string; p: Player; now: number; groups?: Group[] }) {
  return (
    <span className="group/chip flex items-center gap-1.5 rounded-full bg-white py-1 pl-2.5 pr-1 text-sm ring-1 ring-line">
      <span className={`size-2 rounded-full ${isOnline(p.lastSeen, now) ? 'bg-leaf' : 'bg-line'}`} />
      {p.name}
      {groups && groups.length > 1 && (
        <select
          aria-label={`Move ${p.name}`}
          value={p.groupId ?? ''}
          onChange={(e) => void movePlayer(db, sid, p.id, e.target.value || null)}
          className="ml-1 rounded bg-paper px-1 text-xs text-ink/60"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name.replace('Team ', '')}
            </option>
          ))}
        </select>
      )}
      <button type="button" title={`Remove ${p.name}`} className="rounded-full p-0.5 text-ink/30 hover:bg-[#fbeee6] hover:text-rust" onClick={() => confirm(`Remove ${p.name}?`) && void removePlayer(db, sid, p.id)}>
        <UserX className="size-3.5" />
      </button>
    </span>
  )
}

interface ResultPayload {
  variantId: string
  pass: boolean
  summary: string
  cost: number
}

function GroupCard({ sid, group, players, since, now }: { sid: string; group: Group; players: Player[]; since: number; now: number }) {
  const events = useEvents<ResultPayload>(sid, group.id, since, 100)
  const results = events.filter((e) => e.type === 'result')
  const latest = results[results.length - 1]
  const passes = results.filter((r) => r.payload.pass)
  return (
    <Card className="!p-4">
      <div className="flex items-center justify-between">
        <div className="font-display text-lg font-bold" style={{ color: group.color }}>
          {group.name}
        </div>
        {passes.length > 0 && <span className="rounded-full bg-forest px-2 py-0.5 text-xs font-bold text-white">Passed ✓</span>}
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {players.map((p) => (
          <span key={p.id} className="flex items-center gap-1 text-xs text-ink/70">
            <span className={`size-1.5 rounded-full ${isOnline(p.lastSeen, now) ? 'bg-leaf' : 'bg-line'}`} />
            {p.name}
          </span>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm">
        {latest ? (
          <>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Latest test</span>
              <span className={`text-xs font-bold ${latest.payload.pass ? 'text-forest' : 'text-rust'}`}>{latest.payload.pass ? 'PASSED' : 'NOT YET'}</span>
            </div>
            <div className="mt-0.5 font-mono text-xs text-ink/70">
              {latest.payload.summary} · ${Math.round(latest.payload.cost / 1000)}k · by {latest.byName}
            </div>
          </>
        ) : (
          <span className="text-ink/50">No tests yet</span>
        )}
      </div>
      <div className="mt-2 text-xs text-ink/50">{results.length} test{results.length === 1 ? '' : 's'} run</div>
    </Card>
  )
}
