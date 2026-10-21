import { describe, expect, test } from 'vitest'
import { fire, makeLevel, makeLevels, newTerm, parseFunction, termsText, type GraphLevel } from './graph'

const f = (src: string) => {
  const p = parseFunction(src)
  if (!p.ok) throw new Error(p.error)
  return p.f
}

describe('the function parser', () => {
  test('reads ordinary math, including 2x-style multiplication', () => {
    expect(f('2x + 1')(3)).toBe(7)
    expect(f('x^2 - 3x')(4)).toBe(4)
    expect(f('-x^2')(3)).toBe(-9)
    expect(f('2(x+1)')(1)).toBe(4)
    expect(f('3sin(x)')(Math.PI / 2)).toBeCloseTo(3)
    expect(f('sin x')(Math.PI / 2)).toBeCloseTo(1)
    expect(f('0.5x·2')(3)).toBeCloseTo(3)
    expect(f('2^-x')(1)).toBeCloseTo(0.5)
    expect(f('sqrt(abs(x))')(-9)).toBe(3)
    expect(f('e^(-(x/2)^2)')(0)).toBe(1)
    expect(f('pi x')(1)).toBeCloseTo(Math.PI)
  })

  test('explains mistakes instead of crashing', () => {
    for (const bad of ['', 'y + 1', '2x +', '(x + 1', 'x)', '3 $ x']) {
      const p = parseFunction(bad)
      expect(p.ok).toBe(false)
      if (!p.ok) expect(p.error.length).toBeGreaterThan(5)
    }
  })

  test('helper text with negative numbers reads naturally and means the same thing', () => {
    const terms = [
      { kind: 'line' as const, p: [-0.17] },
      { kind: 'wave' as const, p: [1.3, 0.55, -0.6] },
      { kind: 'bump' as const, p: [-1.67, -2, 1.3] },
    ]
    const text = termsText(terms)
    expect(text).toBe('-0.17x + 1.3sin(0.55x - 0.6) - 1.67e^(-((x + 2)/1.3)^2)')
    const manual = (x: number) => -0.17 * x + 1.3 * Math.sin(0.55 * x - 0.6) - 1.67 * Math.exp(-(((x + 2) / 1.3) ** 2))
    for (const x of [-9, -2, 0, 3.3, 8]) expect(f(text)(x)).toBeCloseTo(manual(x), 9)
  })

  test('helper terms produce text the parser reads', () => {
    const terms = [newTerm('line'), newTerm('parabola'), newTerm('wave'), newTerm('bump')]
    expect(parseFunction(termsText(terms)).ok).toBe(true)
  })
})

describe('firing', () => {
  const open: GraphLevel = { id: 'easy', start: { x: -9, y: 0 }, target: { x: 8, y: 0, r: 0.6 }, blobs: [], proof: '0' }

  test('the path is slid to start at the car', () => {
    expect(fire(open, f('5')).outcome).toBe('target')
    expect(fire(open, f('x + 100')).end.y).not.toBe(0)
  })

  test('a discontinuous function breaks; a steep continuous one does not', () => {
    // Jumps that stay on screen: a step from −1 to 1, a step partway along.
    expect(fire(open, f('abs(x)/x')).outcome).toBe('broken')
    const step = fire(open, f('2abs(x - 3)/(x - 3)'))
    expect(step.outcome).toBe('broken')
    expect(step.end.x).toBeCloseTo(3, 1)
    expect(fire(open, f('sqrt(x)')).outcome).toBe('broken') // not defined left of 0
    // These shoot off the screen before they reach their break.
    expect(fire(open, f('1/x')).outcome).toBe('off')
    const steep = fire({ ...open, target: { x: 8, y: 0, r: 0.6 } }, f('0.0001x^7'))
    expect(steep.outcome).not.toBe('broken')
  })

  test('obstacles and the edge of the screen stop the path', () => {
    const blocked = { ...open, blobs: [{ x: 0, y: 0, r: 1 }] }
    const s = fire(blocked, f('0'))
    expect(s.outcome).toBe('blob')
    expect(s.end.x).toBeCloseTo(-1, 1)
    expect(fire(open, f('x')).outcome).toBe('off')
  })
})

describe('the three courses', () => {
  test('every course for many teams can be cleared, and never by a straight line', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const level of makeLevels(seed)) {
        expect(fire(level, f(level.proof)).outcome).toBe('target')
        const slope = (level.target.y - level.start.y) / (level.target.x - level.start.x)
        expect(fire(level, f(`${slope}x`)).outcome).not.toBe('target')
      }
    }
  })

  test('courses get harder: more obstacles each level', () => {
    const [e, m, h] = makeLevels(5)
    expect(e.blobs.length).toBeLessThan(m.blobs.length)
    expect(m.blobs.length).toBeLessThan(h.blobs.length)
  })

  test('the same team always gets the same courses', () => {
    expect(makeLevel('hard', 9)).toEqual(makeLevel('hard', 9))
    expect(makeLevel('hard', 9)).not.toEqual(makeLevel('hard', 10))
  })
})
