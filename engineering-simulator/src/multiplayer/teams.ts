/**
 * Turn students' ranked challenge choices into teams. Pure and deterministic given a
 * seed, so it's unit-tested without Firebase.
 *
 * 1. Everyone starts in their 1st choice (students with no choice fill the emptiest challenge).
 * 2. A challenge too small for a real team first pulls in students who ranked it 2nd;
 *    if it still can't reach the minimum, it closes and its students move to their 2nd choice.
 * 3. A challenge far above its fair share sends students who ranked a less-full challenge 2nd
 *    (then step 2 runs again, so this never leaves a lone student).
 * 4. Each challenge's students are split evenly into teams near the target size, and teams get
 *    station numbers 1, 2, 3… in challenge order, so students know which table to go to.
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

export function minTeamSize(teamSize: number) {
  return Math.max(2, Math.ceil(teamSize / 2))
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

  const min = minTeamSize(teamSize)
  const open = new Set(games)

  // 2. Rescue or close challenges that are too small for a team
  const fixSmall = () => {
    for (let pass = 0; pass < games.length; pass++) {
      const small = [...open].filter((g) => count(g) > 0 && count(g) < min).sort((a, b) => count(b) - count(a))[0]
      if (!small) break
      // Pull in students who ranked it 2nd, from the challenge with the most to spare.
      const donors = shuffled.filter((p) => choice(p, 1) === small && at.get(p.id) !== small && count(at.get(p.id)!) > min)
      for (const p of donors) {
        if (count(small) >= min) break
        if (count(at.get(p.id)!) > min) at.set(p.id, small)
      }
      if (count(small) >= min) continue
      // Still too small: close it, but only if another active challenge can take its students.
      const others = [...open].filter((g) => g !== small && count(g) > 0)
      if (!others.length) break
      open.delete(small)
      for (const p of members(small)) {
        const second = choice(p, 1)
        at.set(p.id, second && others.includes(second) ? second : emptiest(others))
      }
    }
  }
  fixSmall()

  // 3. Ease overloaded challenges toward a fair share, using 2nd choices only.
  const active = [...open].filter((g) => count(g) > 0)
  const fair = Math.ceil(players.length / Math.max(1, open.size))
  const cap = fair + teamSize
  for (const g of active) {
    for (const p of members(g)) {
      if (count(g) <= cap) break
      const second = choice(p, 1)
      if (second && open.has(second) && count(second) < count(g) - 1 && count(second) < cap) at.set(p.id, second)
    }
  }

  // Easing can leave a challenge with a lone student; clean up again.
  fixSmall()

  // 4. Teams near the target size, spread evenly; stations in challenge order.
  const teams: PlannedTeam[] = []
  let station = 1
  for (const g of games) {
    const list = members(g).map((p) => p.id)
    if (!list.length) continue
    // Near the target size, but never so many teams that one falls below the minimum.
    const n = Math.max(1, Math.min(Math.round(list.length / teamSize), Math.floor(list.length / min)))
    const split: string[][] = Array.from({ length: n }, () => [])
    list.forEach((id, i) => split[i % n].push(id))
    for (const m of split) teams.push({ gameId: g, station: station++, members: m })
  }
  return teams
}

/** Where a student who joins mid-game should go: smallest team in their 1st choice, then 2nd, then anywhere. */
export function placeLate(choices: string[], teams: { id: string; gameId: string; size: number }[]): string | null {
  for (const c of choices) {
    const options = teams.filter((t) => t.gameId === c).sort((a, b) => a.size - b.size)
    if (options.length) return options[0].id
  }
  const any = [...teams].sort((a, b) => a.size - b.size)
  return any[0]?.id ?? null
}
