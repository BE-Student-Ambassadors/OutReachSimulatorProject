import type { RocketObject, RocketRoleId, RolePrefObject } from './types'

export interface RocketRoleDef {
  id: RocketRoleId
  title: string
  shortTitle: string
  summary: string
  accent: string
}

export const ROCKET_ROLES: RocketRoleDef[] = [
  {
    id: 'electrical',
    title: 'Electrical Engineer',
    shortTitle: 'Electrical',
    summary: 'Wire every circuit on the breadboard without crossing wires, using every hole.',
    accent: '#d99a1e',
  },
  {
    id: 'mechanical',
    title: 'Mechanical Engineer',
    shortTitle: 'Mechanical',
    summary: 'Buy rocket parts online on a tiny budget, then build the rocket from the blueprint.',
    accent: '#b8461b',
  },
  {
    id: 'software',
    title: 'Software Engineer',
    shortTitle: 'Software',
    summary: 'Connect the flight computer, debug its program and tune the numbers that fly the rocket.',
    accent: '#7c4dbd',
  },
  {
    id: 'business',
    title: 'Business Lead',
    shortTitle: 'Business',
    summary: 'Win sponsor deals and design their flyers. Better flyers bring in more money.',
    accent: '#2c5b3c',
  },
]

export const ALL_ROLE_IDS: RocketRoleId[] = ROCKET_ROLES.map((r) => r.id)

export interface PlayerRolePref {
  playerId: string
  playerName: string
  /** Ranked role preferences (up to 2: [1st choice, 2nd choice]). */
  choices: RocketRoleId[]
}

export interface RoleAssignment {
  roleId: RocketRoleId
  playerId: string | null
  playerName: string | null
  /** 1 if assigned their 1st choice, 2 if their 2nd, 0 if unassigned or a fallback. */
  choiceRank: 1 | 2 | 0
}

/**
 * Deterministic role assignment from each player's 1st and 2nd picks. Tries every assignment
 * (4 roles, so at most 24) and keeps the one that gives the most people a role they picked
 * (1st choice = 100 pts, 2nd = 45, anything else = 1).
 */
export function assignRocketRoles(players: PlayerRolePref[]): RoleAssignment[] {
  const capped = players.slice(0, ALL_ROLE_IDS.length)
  const score = (p: number, roleIdx: number) => {
    const c = capped[p].choices
    const role = ALL_ROLE_IDS[roleIdx]
    return c[0] === role ? 100 : c[1] === role ? 45 : 1
  }

  let best = -1
  let bestRoleOf: number[] = []
  const roleOf: number[] = []
  const taken = ALL_ROLE_IDS.map(() => false)
  const search = (p: number, running: number) => {
    if (p === capped.length) {
      if (running > best) {
        best = running
        bestRoleOf = [...roleOf]
      }
      return
    }
    for (let r = 0; r < ALL_ROLE_IDS.length; r++) {
      if (taken[r]) continue
      taken[r] = true
      roleOf[p] = r
      search(p + 1, running + score(p, r))
      taken[r] = false
    }
  }
  search(0, 0)

  return ROCKET_ROLES.map((role, rIdx) => {
    const p = bestRoleOf.indexOf(rIdx)
    if (p < 0) return { roleId: role.id, playerId: null, playerName: null, choiceRank: 0 }
    const pref = capped[p]
    const choiceRank: 1 | 2 | 0 = pref.choices[0] === role.id ? 1 : pref.choices[1] === role.id ? 2 : 0
    return { roleId: role.id, playerId: pref.playerId, playerName: pref.playerName, choiceRank }
  })
}

export function extractRolePrefs(design: RocketObject[], teammates?: { id: string; name: string }[]): PlayerRolePref[] {
  const byId = new Map<string, PlayerRolePref>()
  for (const p of design.filter((o): o is RolePrefObject => o.kind === 'rolePref')) {
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
