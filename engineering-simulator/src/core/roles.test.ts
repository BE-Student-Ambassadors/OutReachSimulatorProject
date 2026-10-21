import { describe, expect, test } from 'vitest'
import { divideRoles, namesLabel, rolesOf, teamPicks, teamRoster, togglePick, type RolePick } from './roles'

const JOBS = ['mechanical', 'electrical', 'software', 'business'] as const
const people = (n: number, choices: (k: number) => string[] = () => []): RolePick[] =>
  Array.from({ length: n }, (_, k) => ({ playerId: `p${k}`, playerName: `P${k}`, choices: choices(k) }))

function check(split: ReturnType<typeof divideRoles<(typeof JOBS)[number]>>, players: RolePick[]) {
  const n = players.length
  // Every job is covered by at least one person.
  for (const j of JOBS) expect(split[j].length).toBeGreaterThanOrEqual(1)
  const loads = players.map((p) => rolesOf(split, p.playerId).length)
  if (n <= JOBS.length) {
    // One person per job; everyone has one or more, spread as evenly as possible.
    for (const j of JOBS) expect(split[j]).toHaveLength(1)
    expect(Math.min(...loads)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1)
  } else {
    // Everyone has exactly one job; shared jobs are spread evenly.
    expect(loads.every((l) => l === 1)).toBe(true)
    const sizes = JOBS.map((j) => split[j].length)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  }
}

describe('divideRoles', () => {
  test('every team size from 1 to 8 covers every job and splits the work evenly', () => {
    for (let n = 1; n <= 8; n++) {
      const players = people(n)
      check(divideRoles(JOBS, players), players)
    }
  })

  test('one person does every job', () => {
    const split = divideRoles(JOBS, people(1))
    expect(rolesOf(split, 'p0')).toEqual([...JOBS])
  })

  test('three people: one picks up an extra job, and it is one they wanted', () => {
    const players: RolePick[] = [
      { playerId: 'a', playerName: 'Ana', choices: ['mechanical', 'electrical'] },
      { playerId: 'b', playerName: 'Ben', choices: ['software'] },
      { playerId: 'c', playerName: 'Cy', choices: ['business'] },
    ]
    const split = divideRoles(JOBS, players)
    check(split, players)
    expect(rolesOf(split, 'a')).toEqual(['mechanical', 'electrical'])
    expect(rolesOf(split, 'b')).toEqual(['software'])
    expect(rolesOf(split, 'c')).toEqual(['business'])
  })

  test('two people get two jobs each', () => {
    const players = people(2, (k) => (k === 0 ? ['software', 'business'] : ['mechanical']))
    const split = divideRoles(JOBS, players)
    check(split, players)
    expect(rolesOf(split, 'p0')).toEqual(['software', 'business'])
    expect(rolesOf(split, 'p1')).toEqual(['mechanical', 'electrical'])
  })

  test('four people with distinct first picks all get them; collisions fall back to 2nd picks', () => {
    const distinct = people(4, (k) => [JOBS[k], JOBS[(k + 1) % 4]])
    const s1 = divideRoles(JOBS, distinct)
    distinct.forEach((p, k) => expect(rolesOf(s1, p.playerId)).toEqual([JOBS[k]]))

    const clash: RolePick[] = [
      { playerId: 'a', playerName: 'A', choices: ['software', 'electrical'] },
      { playerId: 'b', playerName: 'B', choices: ['software', 'business'] },
      { playerId: 'c', playerName: 'C', choices: ['mechanical'] },
      { playerId: 'd', playerName: 'D', choices: [] },
    ]
    const s2 = divideRoles(JOBS, clash)
    check(s2, clash)
    const got = (id: string) => rolesOf(s2, id)[0]
    expect(['software', 'electrical']).toContain(got('a'))
    expect(['software', 'business']).toContain(got('b'))
    expect(got('c')).toBe('mechanical')
  })

  test('six people: two jobs are shared, following picks', () => {
    const players = people(6, (k) => (k < 3 ? ['software'] : []))
    const split = divideRoles(JOBS, players)
    check(split, players)
    // At most two people share a job, so two of the three software fans get it.
    expect(split.software.filter((t) => ['p0', 'p1', 'p2'].includes(t.id))).toHaveLength(2)
  })

  test('every device computes the same split, whatever order the roster arrives in', () => {
    const players = people(3, (k) => [JOBS[k % 2]])
    const a = divideRoles(JOBS, players)
    const b = divideRoles(JOBS, [...players].reverse())
    expect(b).toEqual(a)
  })

  test('large classes still finish quickly and stay balanced', () => {
    const players = people(14, (k) => [JOBS[k % 3]])
    const t0 = performance.now()
    const split = divideRoles(JOBS, players)
    expect(performance.now() - t0).toBeLessThan(500)
    check(split, players)
  })

  test('nobody on the team: nobody assigned', () => {
    expect(divideRoles(JOBS, [])).toEqual({ mechanical: [], electrical: [], software: [], business: [] })
  })
})

describe('helpers', () => {
  test('teamPicks reads picks from the design, ignores unknown jobs, and includes teammates who have not picked', () => {
    const design = [
      { id: 'rolePref:a', kind: 'rolePref', playerId: 'a', playerName: 'Ana', choices: ['software', 'nope', 'business'], updatedAt: 1 },
      { id: 'rolePref:z', kind: 'rolePref', playerId: 'z', playerName: 'Gone', choices: ['software'], updatedAt: 1 },
    ]
    expect(teamPicks(design, JOBS, [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }])).toEqual([
      { playerId: 'a', playerName: 'Ana', choices: ['software', 'business'] },
      { playerId: 'b', playerName: 'Ben', choices: [] },
    ])
  })

  test('teamRoster: solo is a team of one; multiplayer always includes me', () => {
    expect(teamRoster(undefined)).toEqual([{ id: 'solo', name: 'You' }])
    expect(teamRoster({ me: 'a', meName: 'Ana', teammates: [{ id: 'b', name: 'Ben' }] })).toEqual([
      { id: 'b', name: 'Ben' },
      { id: 'a', name: 'Ana' },
    ])
  })

  test('togglePick keeps the latest two and drops a re-tapped job', () => {
    expect(togglePick([], 'a')).toEqual(['a'])
    expect(togglePick(['a', 'b'], 'c')).toEqual(['b', 'c'])
    expect(togglePick(['a', 'b'], 'a')).toEqual(['b'])
  })

  test('namesLabel', () => {
    expect(namesLabel([{ id: 'a', name: 'Ana' }], 'a')).toBe('You')
    expect(namesLabel([{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cy' }], 'b')).toBe('Ana, You & Cy')
    expect(namesLabel([], 'a')).toBe('')
  })
})
