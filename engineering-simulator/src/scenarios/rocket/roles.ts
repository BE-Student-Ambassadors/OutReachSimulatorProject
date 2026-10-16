import type { RocketObject, RocketRoleId, RolePrefObject, SubTeamId } from './types'

export interface RocketRoleDef {
  id: RocketRoleId
  subTeam: SubTeamId
  subTeamLabel: string
  roleNumber: number
  title: string
  shortTitle: string
  summary: string
  accent: string
}

export const ROCKET_ROLES: RocketRoleDef[] = [
  {
    id: 'payload-gyro',
    subTeam: 'payload',
    subTeamLabel: 'Payload Sub-Team',
    roleNumber: 1,
    title: 'Gyroscope Engineer',
    shortTitle: '1. Gyroscope',
    summary: 'Calibrate the 3-axis reaction wheel gyroscope by locking each axis at the right timing window.',
    accent: '#0284c7',
  },
  {
    id: 'payload-motor',
    subTeam: 'payload',
    subTeamLabel: 'Payload Sub-Team',
    roleNumber: 2,
    title: 'Payload Motor Engineer',
    shortTitle: '2. Payload Motor',
    summary: 'Select the stabilization motor. Too heavy splatters on landing; too weak spins out of control.',
    accent: '#d97706',
  },
  {
    id: 'payload-tester',
    subTeam: 'payload',
    subTeamLabel: 'Payload Sub-Team',
    roleNumber: 3,
    title: 'Payload Drop Tester',
    shortTitle: '3. Payload Tester',
    summary: 'Design the drop-test rig, trigger the parachute during the drop, and guide the payload to the bullseye.',
    accent: '#b45309',
  },
  {
    id: 'rocket-mass',
    subTeam: 'rocket',
    subTeamLabel: 'Rocket Sub-Team',
    roleNumber: 4,
    title: 'Weight Distribution Engineer',
    shortTitle: '4. Weight Order',
    summary: 'Drag and order internal rocket bays so Center of Gravity (CG) sits safely ahead of Center of Pressure (CP).',
    accent: '#2c5b3c',
  },
  {
    id: 'rocket-material',
    subTeam: 'rocket',
    subTeamLabel: 'Rocket Sub-Team',
    roleNumber: 5,
    title: 'Airframe & Materials Engineer',
    shortTitle: '5. Airframe Material',
    summary: 'Choose the airframe tube material, nose cone shape, and fin profile to survive Max-Q and reduce drag.',
    accent: '#7c5cbf',
  },
  {
    id: 'rocket-tester',
    subTeam: 'rocket',
    subTeamLabel: 'Rocket Sub-Team',
    roleNumber: 6,
    title: 'Rocket Flight Tester',
    shortTitle: '6. Flight Tester',
    summary: 'Set launch rail angle, motor impulse class, and ballast trim to hit the 10,000 ft IREC apogee window.',
    accent: '#b8461b',
  },
]

export const ALL_ROLE_IDS: RocketRoleId[] = ROCKET_ROLES.map((r) => r.id)

export interface PlayerRolePref {
  playerId: string
  playerName: string
  /** Ranked role preferences (up to 2: [1stChoice, 2ndChoice]). */
  choices: RocketRoleId[]
}

export interface RoleAssignment {
  roleId: RocketRoleId
  subTeam: SubTeamId
  playerId: string | null
  playerName: string | null
  /** 1 if assigned their 1st choice, 2 if assigned their 2nd choice, 0 if unassigned/fallback. */
  choiceRank: 1 | 2 | 0
}

/**
 * Pure, deterministic role assignment from a team's 1st & 2nd role preference tier list.
 * Maximizes total preference satisfaction across the 6 roles (1st choice = +100 pts, 2nd choice = +45 pts,
 * fallback = +1 pt) so a student who puts Tester 1st and Gyroscope 2nd gets Tester if free, or seamlessly
 * falls back to Gyroscope if a teammate with no flexible 2nd choice took Tester.
 */
export function assignRocketRoles(players: PlayerRolePref[]): RoleAssignment[] {
  const capped = players.slice(0, ROCKET_ROLES.length)
  if (capped.length === 0) {
    return ROCKET_ROLES.map((r) => ({
      roleId: r.id,
      subTeam: r.subTeam,
      playerId: null,
      playerName: null,
      choiceRank: 0,
    }))
  }

  // With at most 6 players and 6 roles (6! = 720 permutations), we can find the exact global optimum!
  const roles = ALL_ROLE_IDS
  let bestScore = -1
  let bestMap: (number | null)[] = Array(roles.length).fill(null)

  const usedPlayer = new Array(capped.length).fill(false)
  const currentMap: (number | null)[] = Array(roles.length).fill(null)

  function scoreFor(playerIdx: number, roleId: RocketRoleId): number {
    const c = capped[playerIdx].choices
    if (c[0] === roleId) return 100
    if (c[1] === roleId) return 45
    return 1
  }

  // Assign each player in `capped` to a distinct role index 0..5
  const playerRoleIdx: number[] = new Array(capped.length).fill(-1)
  const roleTaken: boolean[] = new Array(roles.length).fill(false)

  function search(pIdx: number, runningScore: number) {
    if (pIdx === capped.length) {
      if (runningScore > bestScore) {
        bestScore = runningScore
        currentMap.fill(null)
        for (let i = 0; i < capped.length; i++) {
          currentMap[playerRoleIdx[i]] = i
        }
        bestMap = [...currentMap]
      }
      return
    }
    // Pruning: even if all remaining players get 100, can we beat bestScore?
    if (runningScore + (capped.length - pIdx) * 100 <= bestScore) return

    for (let rIdx = 0; rIdx < roles.length; rIdx++) {
      if (roleTaken[rIdx]) continue
      roleTaken[rIdx] = true
      playerRoleIdx[pIdx] = rIdx
      search(pIdx + 1, runningScore + scoreFor(pIdx, roles[rIdx]))
      roleTaken[rIdx] = false
    }
  }

  void usedPlayer
  search(0, 0)

  return ROCKET_ROLES.map((r, rIdx) => {
    const pIdx = bestMap[rIdx]
    if (pIdx === null || pIdx === undefined) {
      return {
        roleId: r.id,
        subTeam: r.subTeam,
        playerId: null,
        playerName: null,
        choiceRank: 0,
      }
    }
    const p = capped[pIdx]
    const choiceRank: 1 | 2 | 0 = p.choices[0] === r.id ? 1 : p.choices[1] === r.id ? 2 : 0
    return {
      roleId: r.id,
      subTeam: r.subTeam,
      playerId: p.playerId,
      playerName: p.playerName,
      choiceRank,
    }
  })
}

export function extractRolePrefs(
  design: RocketObject[],
  teammates?: { id: string; name: string }[],
): PlayerRolePref[] {
  const prefObjs = design.filter((o): o is RolePrefObject => o.kind === 'rolePref')
  const byId = new Map<string, PlayerRolePref>()
  for (const p of prefObjs) {
    byId.set(p.playerId, {
      playerId: p.playerId,
      playerName: p.playerName,
      choices: p.choices.filter((c) => ALL_ROLE_IDS.includes(c)).slice(0, 2),
    })
  }
  if (teammates && teammates.length > 0) {
    return teammates.map((t) => byId.get(t.id) ?? { playerId: t.id, playerName: t.name, choices: [] })
  }
  return [...byId.values()]
}
