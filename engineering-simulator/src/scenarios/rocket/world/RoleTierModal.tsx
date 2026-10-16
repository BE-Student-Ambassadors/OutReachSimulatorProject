import { CheckCircle2, Sparkles, Users, X } from 'lucide-react'
import { assignRocketRoles, extractRolePrefs, ROCKET_ROLES } from '../roles'
import type { RocketObject, RocketRoleId, RolePrefObject } from '../types'

export function RoleTierModal({
  design,
  myId,
  myName,
  teammates,
  locked,
  onCommit,
  onSelectRoleTab,
  onClose,
}: {
  design: RocketObject[]
  myId: string
  myName: string
  teammates?: { id: string; name: string }[]
  locked: boolean
  onCommit(next: RocketObject[]): void
  onSelectRoleTab(roleId: RocketRoleId): void
  onClose(): void
}) {
  const allPlayers = extractRolePrefs(
    design,
    teammates && teammates.length > 0 ? teammates : [{ id: myId, name: myName }],
  )
  const myPref = allPlayers.find((p) => p.playerId === myId) ?? {
    playerId: myId,
    playerName: myName,
    choices: [],
  }
  const assignments = assignRocketRoles(allPlayers)
  const myAssigned = assignments.find((a) => a.playerId === myId)

  const toggleRoleChoice = (roleId: RocketRoleId) => {
    if (locked) return
    const cur = myPref.choices
    const nextChoices = cur.includes(roleId)
      ? cur.filter((c) => c !== roleId)
      : [...cur, roleId].slice(0, 2)

    const prevObj = design.find((o): o is RolePrefObject => o.id === `rolePref:${myId}`)
    const prefObj: RolePrefObject = {
      id: `rolePref:${myId}`,
      kind: 'rolePref',
      playerId: myId,
      playerName: myName,
      choices: nextChoices,
      updatedAt: (prevObj?.updatedAt ?? 0) + 1,
    }
    const nextDesign = prevObj
      ? design.map((o) => (o.id === prefObj.id ? prefObj : o))
      : [...design, prefObj]
    onCommit(nextDesign)
  }

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-ink/45 p-4 backdrop-blur-xs">
      <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-line">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-forest">
              <Users className="size-4" /> 6-Player Team · 2 Sub-Teams (Payload & Rocket)
            </div>
            <h2 className="mt-0.5 font-display text-2xl font-extrabold text-ink">
              Role Preference Tier List (Pick Top 2)
            </h2>
            <p className="text-xs text-ink/65">
              Tap your <strong>1st choice</strong> role (e.g. Tester) and your <strong>2nd choice</strong> backup role.
              The team matcher assigns all 6 roles across both sub-teams.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-ink/50 hover:bg-paper hover:text-ink"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Sub-Teams Grid */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(['payload', 'rocket'] as const).map((subTeam) => {
            const subRoles = ROCKET_ROLES.filter((r) => r.subTeam === subTeam)
            return (
              <div key={subTeam} className="rounded-xl bg-paper p-3 ring-1 ring-line">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display text-sm font-extrabold uppercase tracking-wide text-forest">
                    {subTeam === 'payload' ? 'Sub-Team 1: Payload (3 Roles)' : 'Sub-Team 2: Rocket (3 Roles)'}
                  </span>
                  <span className="font-mono text-[11px] text-ink/55">
                    {subTeam === 'payload' ? 'Gyro · Motor · Drop Test' : 'Mass · Airframe · Flight Test'}
                  </span>
                </div>

                <div className="space-y-2">
                  {subRoles.map((role) => {
                    const myRank = myPref.choices.indexOf(role.id) // 0 = 1st, 1 = 2nd, -1 = not picked
                    const assigned = assignments.find((a) => a.roleId === role.id)
                    const isMine = assigned?.playerId === myId
                    return (
                      <div
                        key={role.id}
                        className={`rounded-xl bg-white p-3 transition ${
                          myRank >= 0
                            ? 'ring-2 ring-forest'
                            : isMine
                              ? 'ring-2 ring-[#0284c7]'
                              : 'ring-1 ring-line'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-block size-2.5 rounded-full"
                                style={{ backgroundColor: role.accent }}
                              />
                              <span className="font-display text-sm font-bold text-ink">
                                {role.title}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] leading-snug text-ink/65">
                              {role.summary}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => toggleRoleChoice(role.id)}
                            className={`shrink-0 rounded-lg px-2.5 py-1 font-display text-xs font-bold transition ${
                              myRank === 0
                                ? 'bg-forest text-white shadow'
                                : myRank === 1
                                  ? 'bg-[#0284c7] text-white shadow'
                                  : 'bg-paper text-ink/75 ring-1 ring-line hover:bg-mint'
                            }`}
                          >
                            {myRank === 0
                              ? '★ 1st Choice'
                              : myRank === 1
                                ? '✦ 2nd Choice'
                                : myPref.choices.length === 0
                                  ? 'Pick 1st'
                                  : myPref.choices.length === 1
                                    ? 'Pick 2nd'
                                    : 'Swap'}
                          </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between border-t border-line/70 pt-1.5 text-[11px]">
                          <span className="text-ink/60">
                            Assigned:{' '}
                            <strong className={assigned?.playerName ? 'text-ink' : 'text-ink/40'}>
                              {assigned?.playerName ?? 'Open slot'}
                            </strong>
                            {assigned?.choiceRank === 1 && (
                              <span className="ml-1.5 rounded bg-mint px-1.5 py-0.5 font-mono text-[10px] font-bold text-forest">
                                1st Pick ✓
                              </span>
                            )}
                            {assigned?.choiceRank === 2 && (
                              <span className="ml-1.5 rounded bg-[#e0f2fe] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#0369a1]">
                                2nd Pick ✓
                              </span>
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              onSelectRoleTab(role.id)
                              onClose()
                            }}
                            className="font-semibold text-forest hover:underline"
                          >
                            Open Station →
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Summary */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mint/60 px-4 py-3 ring-1 ring-forest/20">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="size-4 text-forest" />
            {myAssigned ? (
              <span>
                Your matched role:{' '}
                <strong className="font-display text-sm text-forest">
                  {ROCKET_ROLES.find((r) => r.id === myAssigned.roleId)?.title}
                </strong>{' '}
                ({myAssigned.subTeam === 'payload' ? 'Payload Sub-Team' : 'Rocket Sub-Team'})
              </span>
            ) : (
              <span>Select up to 2 roles above to set your preference tier list!</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {myAssigned && (
              <button
                type="button"
                onClick={() => {
                  onSelectRoleTab(myAssigned.roleId)
                  onClose()
                }}
                className="btn-press flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-white"
              >
                <CheckCircle2 className="size-4" /> Go to My Role Station
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-ink ring-1 ring-line hover:bg-paper"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
