import { describe, expect, test } from 'vitest'
import { placeLate, planTeams, type Chooser } from './teams'

const make = (spec: [string, string?][], prefix = 'p'): Chooser[] =>
  spec.map(([a, b], i) => ({ id: `${prefix}${i}`, choices: [a, b].filter(Boolean) as string[] }))
const many = (n: number, a: string, b?: string, prefix = a) => make(Array.from({ length: n }, () => [a, b] as [string, string?]), prefix)

const GAMES = ['traffic', 'quake', 'robot', 'water']

function check(players: Chooser[], teams: ReturnType<typeof planTeams>) {
  const ids = teams.flatMap((t) => t.members)
  expect(new Set(ids).size).toBe(players.length) // everyone placed exactly once
  expect(ids.length).toBe(players.length)
  expect(teams.map((t) => t.station)).toEqual(teams.map((_, i) => i + 1)) // stations 1..n
}

describe('planTeams', () => {
  test('balanced interest: everyone gets their 1st choice, teams near target size', () => {
    const players = [...many(8, 'traffic', 'quake'), ...many(8, 'quake', 'robot'), ...many(8, 'robot', 'water'), ...many(8, 'water', 'traffic')]
    const teams = planTeams(players, GAMES, 4, 1)
    check(players, teams)
    for (const t of teams) {
      expect(t.members.every((id) => id.startsWith(t.gameId))).toBe(true)
      expect(t.members.length).toBe(4)
    }
  })

  test('a lone pick is moved to their 2nd choice instead of playing alone', () => {
    const players = [...many(1, 'water', 'traffic', 'w'), ...many(6, 'traffic', 'quake', 't'), ...many(4, 'quake', 'water', 'q')]
    const teams = planTeams(players, GAMES, 4, 2)
    check(players, teams)
    expect(teams.some((t) => t.gameId === 'water')).toBe(false)
    expect(teams.find((t) => t.members.includes('w0'))!.gameId).toBe('traffic')
    expect(teams.every((t) => t.members.length >= 3)).toBe(true)
  })

  test('teams are the target size; extras join a team (pairs plus a three)', () => {
    const sizes = (n: number, size: number) => planTeams(many(n, 'traffic'), ['traffic'], size, 3).map((t) => t.members.length).sort()
    expect(sizes(5, 2)).toEqual([2, 3])
    expect(sizes(7, 2)).toEqual([2, 2, 3])
    expect(sizes(8, 2)).toEqual([2, 2, 2, 2])
    expect(sizes(3, 2)).toEqual([3])
    expect(sizes(5, 4)).toEqual([5])
    expect(sizes(5, 3)).toEqual([2, 3])
    expect(sizes(4, 1)).toEqual([1, 1, 1, 1])
    // Only one student in the whole class: a team of one.
    expect(sizes(1, 2)).toEqual([1])
  })

  test('class sizes for the outreach demo: 3 games, teams of 2 (3 for an odd one out), nobody alone', () => {
    const three = ['fsae', 'rocket', 'battlebots']
    let seed = 7
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    for (const n of [6, 16, 35]) {
      for (let trial = 0; trial < 200; trial++) {
        const players = Array.from({ length: n }, (_, i) => ({ id: `s${i}`, choices: rand() < 0.1 ? [] : [three[Math.floor(rand() * 3)], three[Math.floor(rand() * 3)]] }))
        const teams = planTeams(players, three, 2, trial)
        check(players, teams)
        for (const t of teams) {
          expect(t.members.length, `${n} students`).toBeGreaterThanOrEqual(2)
          expect(t.members.length, `${n} students`).toBeLessThanOrEqual(3)
        }
        // At most one team of 3 per game: the odd one out.
        for (const g of three) expect(teams.filter((t) => t.gameId === g && t.members.length === 3).length).toBeLessThanOrEqual(1)
      }
    }
    // Everyone wants the same game: it is played by many teams at once, each at its own station.
    const teams = planTeams(many(16, 'rocket'), three, 2, 1)
    expect(teams).toHaveLength(8)
    expect(teams.every((t) => t.gameId === 'rocket' && t.members.length === 2)).toBe(true)
    expect(teams.map((t) => t.station)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  test('an overloaded challenge sends some students to their 2nd choice', () => {
    const players = [...many(20, 'traffic', 'quake', 't'), ...many(4, 'quake', 'traffic', 'q')]
    const teams = planTeams(players, ['traffic', 'quake'], 4, 4)
    check(players, teams)
    const size = (g: string) => teams.filter((t) => t.gameId === g).reduce((n, t) => n + t.members.length, 0)
    expect(size('traffic')).toBeLessThan(20)
    expect(size('quake')).toBeGreaterThan(4)
    // ...and most students still get their 1st choice.
    const firstChoice = players.filter((p) => teams.find((t) => t.members.includes(p.id))!.gameId === p.choices[0]).length
    expect(firstChoice / players.length).toBeGreaterThan(0.6)
  })

  test('students who did not choose fill a challenge without ending up alone; tiny events still work', () => {
    const players = [...many(5, 'traffic', undefined, 't'), ...make([[''], ['']], 'x').map((p) => ({ ...p, choices: [] }))]
    const teams = planTeams(players, GAMES, 2, 5)
    check(players, teams)
    expect(teams.every((t) => t.members.length >= 2)).toBe(true)
    expect(planTeams(make([['quake']]), GAMES, 4, 6)).toEqual([{ gameId: 'quake', station: 1, members: ['p0'] }])
    expect(planTeams([], GAMES, 4)).toEqual([])
  })

  test('choices for games not offered are ignored', () => {
    const players = many(6, 'flood', 'traffic')
    const teams = planTeams(players, ['traffic', 'quake'], 3, 7)
    check(players, teams)
    expect(teams.every((t) => t.gameId === 'traffic')).toBe(true)
  })
})

test('randomized classes: everyone placed once, teams within one of the target size, nobody alone', () => {
  let seed = 42
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  for (let trial = 0; trial < 1000; trial++) {
    const nGames = 2 + Math.floor(rand() * 3)
    const games = GAMES.slice(0, nGames)
    const teamSize = 1 + Math.floor(rand() * 6)
    const n = 1 + Math.floor(rand() * 45)
    // Skewed popularity: game 0 is the favourite.
    const pick = () => games[Math.min(nGames - 1, Math.floor(rand() ** 2 * nGames))]
    const players = Array.from({ length: n }, (_, i) => ({ id: `s${i}`, choices: rand() < 0.1 ? [] : [pick(), pick()] }))
    const teams = planTeams(players, games, teamSize, trial)
    check(players, teams)
    for (const t of teams) {
      expect(t.members.length).toBeGreaterThanOrEqual(n >= teamSize ? Math.max(1, Math.min(2, teamSize - 1)) : 1)
      expect(t.members.length).toBeLessThanOrEqual(teamSize + 1)
    }
    // Within a challenge, team sizes differ by at most one.
    for (const g of games) {
      const sizes = teams.filter((t) => t.gameId === g).map((t) => t.members.length)
      if (sizes.length) expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    }
  }
})

describe('placeLate', () => {
  const teams = [
    { id: 'a', gameId: 'traffic', size: 4 },
    { id: 'b', gameId: 'traffic', size: 3 },
    { id: 'c', gameId: 'quake', size: 2 },
  ]
  const games = ['traffic', 'quake', 'robot']
  test('smallest team with room in the 1st choice, then 2nd, then anywhere', () => {
    expect(placeLate(['traffic'], teams, 4, games)).toEqual({ groupId: 'b' })
    expect(placeLate(['robot', 'quake'], teams, 4, games)).toEqual({ groupId: 'c' })
    expect(placeLate([], teams, 4, games)).toEqual({ groupId: 'c' })
  })
  test('a team takes one more than the target (a pair becomes a three); past that a new team starts', () => {
    expect(placeLate(['traffic'], teams, 3, games)).toEqual({ groupId: 'b' })
    expect(placeLate(['traffic'], teams, 2, games)).toEqual({ newTeam: 'traffic' })
    expect(placeLate(['traffic', 'quake'], teams, 2, games)).toEqual({ groupId: 'c' })
    // No picks and everything full: start a team in the least-played challenge.
    expect(placeLate([], teams, 1, games)).toEqual({ newTeam: 'robot' })
    expect(placeLate([], [], 4, [])).toBe(null)
  })
})
