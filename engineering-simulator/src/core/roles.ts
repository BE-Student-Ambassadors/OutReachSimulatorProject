import type { DesignObject } from './scenario'

/**
 * Splitting a scenario's jobs among however many people are on the team. Pure and
 * deterministic, so every device in a group computes the same split from the same roster
 * and picks, with nothing extra to sync.
 *
 * - Fewer people than jobs: every job has exactly one person and everyone gets one or more
 *   (3 people, 4 jobs: one person picks up a second job).
 * - More people than jobs: everyone gets exactly one job and some jobs are shared.
 * - Within that, the split gives the most people jobs they picked (1st choice = 100 pts,
 *   2nd = 45, anything else = 1).
 */

export interface Teammate {
  id: string
  name: string
}

export interface RolePick {
  playerId: string
  playerName: string
  /** Ranked job picks, best first (up to 2). May be empty. */
  choices: string[]
}

/** Who does each job. */
export type RoleSplit<R extends string> = Record<R, Teammate[]>

/** A player's ranked job picks, kept in the shared design so the whole team sees them. */
export interface RolePrefObject<R extends string = string> extends DesignObject {
  kind: 'rolePref'
  playerId: string
  playerName: string
  choices: R[]
  updatedAt: number
}

/** Above this many search steps the best split found so far is used (only very large teams get here). */
const SEARCH_LIMIT = 200_000

export function divideRoles<R extends string>(roleIds: readonly R[], players: RolePick[]): RoleSplit<R> {
  const split = Object.fromEntries(roleIds.map((r) => [r, [] as Teammate[]])) as RoleSplit<R>
  const people = [...players].sort((a, b) => (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0))
  const n = people.length
  const R = roleIds.length
  if (!n || !R) return split

  const score = (p: number, r: number) => {
    const k = people[p].choices.indexOf(roleIds[r])
    return k === 0 ? 100 : k === 1 ? 45 : 1
  }
  // The larger side "picks" from the smaller side, so each picker takes exactly one target
  // and every target ends up with an even share (floor or ceil) of the pickers.
  const jobsPick = n <= R
  const pickers = jobsPick ? R : n
  const targets = jobsPick ? n : R
  const pairScore = (picker: number, target: number) => (jobsPick ? score(target, picker) : score(picker, target))
  const lo = Math.floor(pickers / targets)
  const hi = Math.ceil(pickers / targets)
  const extra = pickers - lo * targets // how many targets take `hi`

  // Try each picker's best targets first, so the first complete split is already good.
  const order = Array.from({ length: pickers }, (_, i) =>
    Array.from({ length: targets }, (_, t) => t).sort((a, b) => pairScore(i, b) - pairScore(i, a) || a - b),
  )
  const bestLeft: number[] = Array(pickers + 1).fill(0)
  for (let i = pickers - 1; i >= 0; i--) bestLeft[i] = bestLeft[i + 1] + pairScore(i, order[i][0])

  const load: number[] = Array(targets).fill(0)
  const pick: number[] = Array(pickers).fill(0)
  let best = -1
  let bestPick: number[] = []
  let atHi = 0
  let steps = 0
  const search = (i: number, running: number) => {
    if (running + bestLeft[i] <= best) return
    if (i === pickers) {
      best = running
      bestPick = [...pick]
      return
    }
    for (const t of order[i]) {
      if (steps++ > SEARCH_LIMIT && best >= 0) return
      if (load[t] >= hi) continue
      const toHi = hi > lo && load[t] === lo
      if (toHi && atHi >= extra) continue
      load[t]++
      if (toHi) atHi++
      pick[i] = t
      search(i + 1, running + pairScore(i, t))
      load[t]--
      if (toHi) atHi--
    }
  }
  search(0, 0)

  bestPick.forEach((t, i) => {
    const [p, r] = jobsPick ? [t, i] : [i, t]
    split[roleIds[r]].push({ id: people[p].playerId, name: people[p].playerName })
  })
  return split
}

/** The jobs one player has, in the scenario's job order. */
export function rolesOf<R extends string>(split: RoleSplit<R>, playerId: string): R[] {
  return (Object.keys(split) as R[]).filter((r) => split[r].some((t) => t.id === playerId))
}

/**
 * Everyone on the team with their picks (from `rolePref` objects in the design). Teammates who
 * haven't picked yet still count; they just have no preferences. Solo play is a team of one.
 */
export function teamPicks<R extends string>(design: DesignObject[], roleIds: readonly R[], roster: Teammate[]): RolePick[] {
  const prefs = new Map<string, RolePrefObject>()
  for (const o of design) if (o.kind === 'rolePref') prefs.set((o as RolePrefObject).playerId, o as RolePrefObject)
  return roster.map((t) => ({
    playerId: t.id,
    playerName: t.name,
    choices: (prefs.get(t.id)?.choices ?? []).filter((c): c is R => roleIds.includes(c as R)).slice(0, 2),
  }))
}

/** The team roster for a scenario: the group in multiplayer, or just this player when solo. */
export function teamRoster(sync: { me: string; meName?: string; teammates?: Teammate[] } | undefined): Teammate[] {
  if (!sync) return [{ id: 'solo', name: 'You' }]
  const mates = sync.teammates ?? []
  return mates.some((t) => t.id === sync.me) ? mates : [...mates, { id: sync.me, name: sync.meName ?? 'You' }]
}

/** Tap a job to add it as your next pick; tap a picked job to drop it. Keeps the top two. */
export function togglePick<R extends string>(choices: R[], role: R): R[] {
  return choices.includes(role) ? choices.filter((c) => c !== role) : [...choices, role].slice(-2)
}

/** "You", "Ana", "Ana & You", "Ana, Ben & Cy" */
export function namesLabel(people: Teammate[], me: string): string {
  const names = people.map((p) => (p.id === me ? 'You' : p.name))
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}
