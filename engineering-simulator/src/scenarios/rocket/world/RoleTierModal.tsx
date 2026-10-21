import { CheckCircle2, Users, X } from 'lucide-react'
import { namesLabel, rolesOf, togglePick, type Teammate } from '../../../core/roles'
import { assignRocketRoles, extractRolePrefs, ROCKET_ROLES } from '../roles'
import type { RocketObject, RocketRoleId, RolePrefObject } from '../types'

/** Each player ranks a 1st and 2nd choice; the four jobs are split among however many people the team has. */
export function RoleTierModal({
  design,
  myId,
  myName,
  roster,
  locked,
  onCommit,
  onGoTo,
  onClose,
}: {
  design: RocketObject[]
  myId: string
  myName: string
  roster: Teammate[]
  locked: boolean
  onCommit(next: RocketObject[]): void
  onGoTo(roleId: RocketRoleId): void
  onClose(): void
}) {
  const players = extractRolePrefs(design, roster)
  const mine = (players.find((p) => p.playerId === myId)?.choices ?? []) as RocketRoleId[]
  const assignments = assignRocketRoles(players)
  const myRoles = rolesOf(assignments, myId)
  const jobsLine =
    roster.length === 1
      ? '1 person, 4 jobs: you do them all.'
      : roster.length < ROCKET_ROLES.length
        ? `${roster.length} people, 4 jobs: some of you take two.`
        : roster.length > ROCKET_ROLES.length
          ? `${roster.length} people, 4 jobs: some jobs are shared.`
          : '4 people, 4 jobs: one each.'

  const toggle = (roleId: RocketRoleId) => {
    if (locked) return
    const choices = togglePick(mine, roleId)
    const prev = design.find((o): o is RolePrefObject => o.id === `rolePref:${myId}`)
    const obj: RolePrefObject = { id: `rolePref:${myId}`, kind: 'rolePref', playerId: myId, playerName: myName, choices, updatedAt: (prev?.updatedAt ?? 0) + 1 }
    onCommit(prev ? design.map((o) => (o.id === obj.id ? obj : o)) : [...design, obj])
  }

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-ink/45 p-4 backdrop-blur-xs">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-line">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-forest">
              <Users className="size-4" /> {jobsLine}
            </div>
            <h2 className="mt-0.5 font-display text-2xl font-extrabold">Pick your top two roles</h2>
            <p className="text-xs text-ink/60">Tap your 1st choice, then your 2nd. Everyone can still look at every station and help.</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-ink/50 hover:bg-paper hover:text-ink">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ROCKET_ROLES.map((role) => {
            const rank = mine.indexOf(role.id)
            const who = namesLabel(assignments[role.id], myId)
            return (
              <div key={role.id} className={`rounded-xl p-3 ${rank >= 0 ? 'ring-2 ring-forest' : 'ring-1 ring-line'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: role.accent }} />
                      <span className="font-display text-sm font-bold">{role.title}</span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-ink/65">{role.summary}</p>
                  </div>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => toggle(role.id)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 font-display text-xs font-bold ${rank === 0 ? 'bg-forest text-white' : rank === 1 ? 'bg-leaf text-white' : 'bg-paper text-ink/75 ring-1 ring-line hover:bg-mint'}`}
                  >
                    {rank === 0 ? '1st choice' : rank === 1 ? '2nd choice' : mine.length === 0 ? 'Pick 1st' : 'Pick 2nd'}
                  </button>
                </div>
                <div className="mt-2 border-t border-line pt-1.5 text-[11px] text-ink/60">
                  Assigned to: <strong className={who ? 'text-ink' : 'text-ink/40'}>{who || 'Open'}</strong>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-mint/60 px-4 py-3 ring-1 ring-forest/20">
          <span className="text-sm">
            {myRoles.length ? (
              <>
                {myRoles.length > 1 ? 'Your jobs' : 'Your job'}:{' '}
                <strong className="text-forest">{myRoles.map((id) => ROCKET_ROLES.find((r) => r.id === id)?.title).join(' + ')}</strong>
              </>
            ) : (
              'Pick up to two roles.'
            )}
          </span>
          {myRoles.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onGoTo(myRoles[0])
                onClose()
              }}
              className="btn-press flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 font-display text-xs font-bold text-white"
            >
              <CheckCircle2 className="size-4" /> Go to my station
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
