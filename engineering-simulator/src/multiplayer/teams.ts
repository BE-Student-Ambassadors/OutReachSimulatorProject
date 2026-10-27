/**
 * Turn students' ranked challenge choices into teams. Pure and deterministic given a
 * seed, so it's unit-tested without Firebase.
 *
 * The host's team size is a target: teams have that many students, and when a challenge's
 * count doesn't divide evenly the extra students join existing teams (size 2: pairs, plus a
 * team of 3 for an odd one out). Each scenario splits its jobs among however many people a
 * team has. Several teams can play the same challenge; each gets its own station.
 *
 * 1. Everyone starts in their 1st choice (students with no choice fill the emptiest challenge).
 * 2. A challenge far above its fair share sends students who ranked a less-full challenge 2nd.
 * 3. A challenge with too few students for one team sends them to their 2nd choice (or the
 *    nearest challenge that has a team), so nobody plays alone in a class big enough for teams.
 * 4. Each challenge's students are split into teams of the target size (one more where needed),
 *    and teams get station numbers 1, 2, 3… in challenge order, so students know which table to
 *    go to.
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
  const size = Math.max(1, Math.floor(teamSize))
  const max = size + 1
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

  // 3. Too few for a team: move to the 2nd choice, else to the fullest challenge (it has a team to join).
  if (players.length >= size) {
    for (const g of games) {
      const few = members(g)
      if (!few.length || few.length >= size) continue
      for (const p of few) {
        const second = choice(p, 1)
        const others = games.filter((x) => x !== g && count(x) > 0)
        const target = second && second !== g && count(second) > 0 ? second : [...others].sort((a, b) => count(b) - count(a))[0]
        if (target) at.set(p.id, target)
      }
    }
  }

  // 4. Teams of the target size; extra students join teams (never more than one extra each, so a
  //    count that can't absorb them makes one more, smaller team). Stations in challenge order.
  const teams: PlannedTeam[] = []
  let station = 1
  for (const g of games) {
    const list = members(g).map((p) => p.id)
    if (!list.length) continue
    let n = Math.max(1, Math.floor(list.length / size))
    if (list.length - n * size > n) n++
    const split: string[][] = Array.from({ length: n }, () => [])
    list.forEach((id, i) => split[i % n].push(id))
    for (const m of split) teams.push({ gameId: g, station: station++, members: m })
  }
  return teams
}

export type LatePlacement = { groupId: string } | { newTeam: string } | null

/**
 * Where a student who joins mid-game should go. A team has room up to one more than the target
 * size (a pair can become a three). The smallest team with room in their 1st choice, then their
 * 2nd, then (with no picks) any team with room. If every fitting team is full, a new team starts
 * for their top pick (or the least-played challenge), and the next late joiner fills it.
 */
export function placeLate(choices: string[], teams: { id: string; gameId: string; size: number }[], teamSize: number, gameIds: string[]): LatePlacement {
  const roomy = teams.filter((t) => t.size < teamSize + 1).sort((a, b) => a.size - b.size)
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
