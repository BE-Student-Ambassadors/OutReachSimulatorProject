/**
 * Turn students' ranked challenge choices into teams. Pure and deterministic given a
 * seed, so it's unit-tested without Firebase.
 *
 * The host's team size is a maximum: a team can have anywhere from 1 student up to it
 * (each scenario splits its jobs among however many people a team has).
 *
 * 1. Everyone starts in their 1st choice (students with no choice fill the emptiest challenge).
 * 2. A challenge far above its fair share sends students who ranked a less-full challenge 2nd.
 * 3. Each challenge's students are split into as few teams as fit under the maximum, with sizes
 *    as even as possible, and teams get station numbers 1, 2, 3… in challenge order, so students
 *    know which table to go to.
 */

export interface Chooser {
  id: string
  /** Ranked choices, best first (game ids). May be empty. */
  choices: string[]
}

export interface PlannedTeam {
  gameId: string
  station: number
  members: string[]
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function planTeams(players: Chooser[], gameIds: string[], teamSize: number, seed = Date.now()): PlannedTeam[] {
  const games = gameIds.filter((g, i) => gameIds.indexOf(g) === i)
  if (!games.length || !players.length) return []
  const max = Math.max(1, Math.floor(teamSize))
  const rand = rng(seed)
  const shuffled = [...players].sort(() => rand() - 0.5)
  const at = new Map<string, string>() // player -> game
  const members = (g: string) => shuffled.filter((p) => at.get(p.id) === g)
  const count = (g: string) => members(g).length
  // Only choices for offered games count; an unavailable 1st choice promotes the 2nd.
  const choice = (p: Chooser, k: number) => p.choices.filter((c) => games.includes(c))[k] ?? null
  const emptiest = (pool: string[]) => [...pool].sort((a, b) => count(a) - count(b) || games.indexOf(a) - games.indexOf(b))[0]

  // 1. First choices
  for (const p of shuffled) {
    const c = choice(p, 0)
    if (c) at.set(p.id, c)
  }
  for (const p of shuffled) if (!at.has(p.id)) at.set(p.id, emptiest(games))

  // 2. Ease overloaded challenges toward a fair share, using 2nd choices only.
  const fair = Math.ceil(players.length / games.length)
  const cap = fair + max
  for (const g of games) {
    for (const p of members(g)) {
      if (count(g) <= cap) break
      const second = choice(p, 1)
      if (second && count(second) < count(g) - 1 && count(second) < cap) at.set(p.id, second)
    }
  }

  // 3. As few teams as fit under the maximum, sizes spread evenly; stations in challenge order.
  const teams: PlannedTeam[] = []
  let station = 1
  for (const g of games) {
    const list = members(g).map((p) => p.id)
    if (!list.length) continue
    const n = Math.ceil(list.length / max)
    const split: string[][] = Array.from({ length: n }, () => [])
    list.forEach((id, i) => split[i % n].push(id))
    for (const m of split) teams.push({ gameId: g, station: station++, members: m })
  }
  return teams
}

export type LatePlacement = { groupId: string } | { newTeam: string } | null

/**
 * Where a student who joins mid-game should go, never pushing a team past the maximum:
 * the smallest team with room in their 1st choice, then their 2nd, then (with no picks) any
 * team with room. If every fitting team is full, a new team starts for their top pick (or the
 * least-played challenge).
 */
export function placeLate(choices: string[], teams: { id: string; gameId: string; size: number }[], teamSize: number, gameIds: string[]): LatePlacement {
  const roomy = teams.filter((t) => t.size < teamSize).sort((a, b) => a.size - b.size)
  for (const c of choices) {
    const t = roomy.find((x) => x.gameId === c)
    if (t) return { groupId: t.id }
  }
  if (choices.length) return { newTeam: choices[0] }
  if (roomy.length) return { groupId: roomy[0].id }
  const played = (g: string) => teams.filter((t) => t.gameId === g).reduce((n, t) => n + t.size, 0)
  const game = [...gameIds].sort((a, b) => played(a) - played(b))[0]
  return game ? { newTeam: game } : null
}
