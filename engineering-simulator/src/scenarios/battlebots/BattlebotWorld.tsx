import { useEffect, useMemo, useRef } from 'react'
import { divideRoles, rolesOf, teamPicks, teamRoster, togglePick, type RolePrefObject } from '../../core/roles'
import type { DesignObject, WorldProps } from '../../core/scenario'
import { BattlebotApp } from './BattlebotApp'
import type { BattlebotObject, BattlebotResult } from './index'
import { hasProject, projectFromDesign, TEAM_ROLES, withPart, withProject, type BattlebotTeam, type PartKey } from './teamSync'
import { createInitialTeamProject } from './data/teamData'
import type { TeamRobotProject, TeamRole } from './types/robot'

const SOLO_KEY = 'besa_team_battlebot_project'

/**
 * The team's robot project lives in the shared design, so in multiplayer every teammate sees
 * (and builds) the same robot. Solo play keeps it in this browser between visits.
 */
export function BattlebotWorld({ design, locked, onCommit, sync }: WorldProps<BattlebotObject, BattlebotResult>) {
  const project = useMemo(() => projectFromDesign(design), [design])
  // Several updates can land in one tick (e.g. two disciplines at once): build each on the last.
  const latest = useRef<DesignObject[]>(design)
  useEffect(() => {
    latest.current = design
  }, [design])
  const commit = (next: DesignObject[]) => {
    latest.current = next
    onCommit(next as BattlebotObject[], null)
  }

  // Solo: pick up where this browser left off, and remember progress.
  const solo = !sync
  useEffect(() => {
    if (!solo || hasProject(latest.current)) return
    try {
      const saved = JSON.parse(localStorage.getItem(SOLO_KEY) ?? 'null') as TeamRobotProject | null
      if (saved?.mechanical && saved.electrical && saved.software && saved.projectLead) commit(withProject(latest.current, saved))
    } catch {
      // nothing saved, or storage unavailable
    }
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solo])
  useEffect(() => {
    if (!solo || !hasProject(design)) return
    try {
      localStorage.setItem(SOLO_KEY, JSON.stringify(project))
    } catch {
      // storage unavailable
    }
  }, [solo, design, project])

  const updatePart = <K extends PartKey>(part: K, data: TeamRobotProject[K]) => {
    if (locked) return
    commit(withPart(latest.current, part, data))
  }
  const reset = () => {
    if (locked) return
    commit(withProject(latest.current, createInitialTeamProject()))
  }

  // Multiplayer: the four jobs are split among however many people are on the team.
  let team: BattlebotTeam | undefined
  if (sync) {
    const me = sync.me
    const roster = teamRoster(sync)
    const split = divideRoles(TEAM_ROLES, teamPicks(design, TEAM_ROLES, roster))
    const prev = design.find((o): o is RolePrefObject<TeamRole> => o.kind === 'rolePref' && (o as RolePrefObject).playerId === me)
    const picks = prev?.choices ?? []
    team = {
      me,
      size: roster.length,
      split,
      myRoles: rolesOf(split, me),
      picks,
      onTogglePick: (role) => {
        if (locked) return
        const obj: RolePrefObject<TeamRole> = {
          id: `rolePref:${me}`,
          kind: 'rolePref',
          playerId: me,
          playerName: sync.meName ?? 'You',
          choices: togglePick(picks, role),
          updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1),
        }
        const cur = latest.current
        commit(cur.some((o) => o.id === obj.id) ? cur.map((o) => (o.id === obj.id ? obj : o)) : [...cur, obj])
      },
    }
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      <BattlebotApp project={project} onUpdatePart={updatePart} onResetProject={reset} team={team} />
    </div>
  )
}
