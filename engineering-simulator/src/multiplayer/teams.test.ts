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

  test('a lone pick plays as a team of one instead of being moved', () => {
    const players = [...many(1, 'water', 'traffic', 'w'), ...many(6, 'traffic', 'quake', 't'), ...many(4, 'quake', 'water', 'q')]
    const teams = planTeams(players, GAMES, 4, 2)
    check(players, teams)
    expect(teams.find((t) => t.gameId === 'water')!.members).toEqual(['w0'])
    // Everyone got their 1st choice.
    for (const p of players) expect(teams.find((t) => t.members.includes(p.id))!.gameId).toBe(p.choices[0])
  })

  test('teams never go over the maximum and are as few and as even as possible', () => {
    const teams = planTeams(many(5, 'traffic'), ['traffic'], 4, 3)
    expect(teams.map((t) => t.members.length).sort()).toEqual([2, 3])
    expect(planTeams(many(3, 'traffic'), ['traffic'], 4, 3).map((t) => t.members.length)).toEqual([3])
    expect(planTeams(many(4, 'traffic'), ['traffic'], 1, 3).map((t) => t.members.length)).toEqual([1, 1, 1, 1])
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

  test('students who did not choose fill the emptiest challenge; tiny events still work', () => {
    const players = [...many(5, 'traffic', undefined, 't'), ...make([[''], ['']], 'x').map((p) => ({ ...p, choices: [] }))]
    const teams = planTeams(players, GAMES, 4, 5)
    check(players, teams)
    expect(teams.find((t) => t.members.includes('x0'))!.gameId).not.toBe('traffic')
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

test('randomized classes: everyone placed once, every team has 1 to max students', () => {
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
      expect(t.members.length).toBeGreaterThanOrEqual(1)
      expect(t.members.length).toBeLessThanOrEqual(teamSize)
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
  test('full teams are never pushed over the maximum: a new team starts instead', () => {
    expect(placeLate(['traffic'], teams, 3, games)).toEqual({ newTeam: 'traffic' })
    expect(placeLate(['traffic', 'quake'], teams, 3, games)).toEqual({ groupId: 'c' })
    // No picks and everything full: start a team in the least-played challenge.
    expect(placeLate([], teams, 2, games)).toEqual({ newTeam: 'robot' })
    expect(placeLate([], [], 4, [])).toBe(null)
  })
})
