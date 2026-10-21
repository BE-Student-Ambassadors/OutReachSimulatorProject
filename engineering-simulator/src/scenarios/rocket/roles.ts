import { divideRoles, teamPicks, type RolePick, type RoleSplit, type Teammate } from '../../core/roles'
import type { RocketObject, RocketRoleId } from './types'

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
    summary: 'Wire both breadboards without crossing wires, then splice a resistor into each battery lead.',
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

/**
 * Splits the four jobs among the whole team from everyone's 1st and 2nd picks (see core/roles):
 * fewer than four people and someone takes two jobs; more than four and jobs are shared.
 */
export function assignRocketRoles(players: RolePick[]): RoleSplit<RocketRoleId> {
  return divideRoles(ALL_ROLE_IDS, players)
}

/** Everyone on the team (or just this player when solo) with their picks from the design. */
export function extractRolePrefs(design: RocketObject[], roster: Teammate[]): RolePick[] {
  return teamPicks(design, ALL_ROLE_IDS, roster)
}
