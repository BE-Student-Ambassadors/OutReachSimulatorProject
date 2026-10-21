/**
 * The driverless computer's path planner, as a game (in the spirit of Graphwar): the car sits
 * at a start point, a target waits on the far side, and obstacles ("blobs") sit in between. The
 * software engineer writes a function y = f(x); the car's path follows it from left to right.
 * The path is slid up or down so it starts at the car. It has to be continuous: it stops where
 * the function breaks, where it touches an obstacle, or where it leaves the screen.
 *
 * Pure TypeScript (no eval): expressions are parsed here, and every level is checked solvable
 * before it is handed out.
 */
import { mulberry32 } from './rng'

// ---------------------------------------------------------------- the field

/** The screen, in graph units. */
export const FIELD = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 } as const

export interface Point {
  x: number
  y: number
}
export interface Circle extends Point {
  r: number
}

export type GraphLevelId = 'easy' | 'medium' | 'hard'
export const GRAPH_LEVELS: { id: GraphLevelId; label: string; course: string }[] = [
  { id: 'easy', label: 'Easy', course: 'Parking lot' },
  { id: 'medium', label: 'Medium', course: 'Skidpad' },
  { id: 'hard', label: 'Hard', course: 'Autocross' },
]

export interface GraphLevel {
  id: GraphLevelId
  start: Point
  target: Circle
  blobs: Circle[]
  /** A helper-built function that clears the level (proof it can be solved; never shown). */
  proof: string
}

// ---------------------------------------------------------------- expressions

type Fn = (x: number) => number
export type Parsed = { ok: true; f: Fn } | { ok: false; error: string }

const FUNCS: Record<string, Fn> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  abs: Math.abs,
  sqrt: Math.sqrt,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
}
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E }

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string }

function tokenize(src: string): Tok[] | string {
  const out: Tok[] = []
  const s = src.replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi').toLowerCase()
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === ' ') i++
    else if (/[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+|^\d+\.?/.exec(s.slice(i))!
      out.push({ t: 'num', v: parseFloat(m[0]) })
      i += m[0].length
    } else if (/[a-z]/.test(c)) {
      const m = /^[a-z]+/.exec(s.slice(i))!
      // Split runs like "xsin" or "pix" into known names.
      let w = m[0]
      while (w) {
        const name = ['sqrt', 'sin', 'cos', 'tan', 'abs', 'exp', 'log', 'ln', 'pi', 'e', 'x'].find((n) => w.startsWith(n))
        if (!name) return `“${w}” isn’t something the planner knows. Use x, numbers, + − × ÷ ^ and sin, cos, tan, sqrt, abs, exp, ln.`
        out.push({ t: 'id', v: name })
        w = w.slice(name.length)
      }
      i += m[0].length
    } else if ('+-*/^()'.includes(c)) {
      out.push({ t: 'op', v: c })
      i++
    } else return `“${c}” can’t be used in a function.`
  }
  return out
}

/** Parses a function of x: + − × ÷ ^, parentheses, 2x-style multiplication, sin cos tan sqrt abs exp ln log, pi, e. */
export function parseFunction(src: string): Parsed {
  if (!src.trim()) return { ok: false, error: 'Type a function of x.' }
  const toks = tokenize(src)
  if (typeof toks === 'string') return { ok: false, error: toks }
  let p = 0
  const peek = () => toks[p]
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v
  // Something that can start a value: a number, a name, or "(" (for 2x, 3(x+1), x sin(x)).
  const startsValue = () => !!peek() && (peek()!.t !== 'op' || peek()!.v === '(')

  const expr = (): Fn => {
    let left = term()
    while (isOp('+') || isOp('-')) {
      const op = toks[p++].v
      const a = left
      const b = term()
      left = op === '+' ? (x) => a(x) + b(x) : (x) => a(x) - b(x)
    }
    return left
  }
  const term = (): Fn => {
    let left = unary()
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = toks[p++].v
        const a = left
        const b = unary()
        left = op === '*' ? (x) => a(x) * b(x) : (x) => a(x) / b(x)
      } else if (startsValue()) {
        const a = left
        const b = power()
        left = (x) => a(x) * b(x)
      } else return left
    }
  }
  const unary = (): Fn => {
    if (isOp('-')) {
      p++
      const a = unary()
      return (x) => -a(x)
    }
    if (isOp('+')) {
      p++
      return unary()
    }
    return power()
  }
  const power = (): Fn => {
    const base = atom()
    if (isOp('^')) {
      p++
      const ex = unary()
      return (x) => Math.pow(base(x), ex(x))
    }
    return base
  }
  const atom = (): Fn => {
    const tk = toks[p++]
    if (!tk) throw new Error('The function ends too early.')
    if (tk.t === 'num') return () => tk.v
    if (tk.t === 'op' && tk.v === '(') {
      const inner = expr()
      if (!isOp(')')) throw new Error('A “(” is missing its “)”.')
      p++
      return inner
    }
    if (tk.t === 'id') {
      if (tk.v === 'x') return (x) => x
      if (tk.v in CONSTS) return () => CONSTS[tk.v]
      const fn = FUNCS[tk.v]
      // sin x, sin(x) and sin 2x all work.
      const arg = isOp('(') ? atom() : power()
      return (x) => fn(arg(x))
    }
    throw new Error(`“${tk.v}” is in an odd place.`)
  }
  try {
    const f = expr()
    if (p < toks.length) return { ok: false, error: toks[p].v === ')' ? 'There’s a “)” without its “(”.' : `“${toks[p].v}” is in an odd place.` }
    return { ok: true, f }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// ---------------------------------------------------------------- the function helper

export type TermKind = 'line' | 'parabola' | 'wave' | 'bump'

export interface Term {
  kind: TermKind
  /** The numbers the student plays with, in the order of TERM_SPECS[kind].params. */
  p: number[]
}

export const TERM_SPECS: Record<TermKind, { label: string; shape: string; params: { name: string; min: number; max: number; step: number; start: number }[] }> = {
  line: { label: 'Line', shape: 'a·x', params: [{ name: 'a', min: -3, max: 3, step: 0.05, start: 0.5 }] },
  parabola: {
    label: 'Parabola',
    shape: 'a·(x − h)²',
    params: [
      { name: 'a', min: -1, max: 1, step: 0.01, start: 0.1 },
      { name: 'h', min: -10, max: 10, step: 0.1, start: 0 },
    ],
  },
  wave: {
    label: 'Wave',
    shape: 'A·sin(B·x + C)',
    params: [
      { name: 'A', min: 0, max: 5, step: 0.05, start: 2 },
      { name: 'B', min: 0.1, max: 3, step: 0.05, start: 0.6 },
      { name: 'C', min: -3.14, max: 3.14, step: 0.02, start: 0 },
    ],
  },
  bump: {
    label: 'Bump',
    shape: 'A·e^(−((x − h)/w)²)',
    params: [
      { name: 'A', min: -6, max: 6, step: 0.05, start: 3 },
      { name: 'h', min: -10, max: 10, step: 0.1, start: 0 },
      { name: 'w', min: 0.5, max: 5, step: 0.05, start: 2 },
    ],
  },
}

export const newTerm = (kind: TermKind): Term => ({ kind, p: TERM_SPECS[kind].params.map((q) => q.start) })

const num = (v: number) => {
  const r = Math.round(v * 100) / 100
  return r < 0 ? `(${r})` : `${r}`
}
const minus = (h: number) => {
  const r = Math.round(h * 100) / 100
  return r === 0 ? 'x' : r > 0 ? `(x - ${r})` : `(x + ${-r})`
}

/** One helper term as text the parser reads. */
export function termText(t: Term): string {
  const [a, b, c] = t.p
  switch (t.kind) {
    case 'line':
      return `${num(a)}x`
    case 'parabola':
      return `${num(a)}${minus(b)}^2`
    case 'wave':
      return `${num(a)}sin(${num(b)}x + ${num(c)})`
    case 'bump':
      return `${num(a)}e^(-(${minus(b)}/${num(c)})^2)`
  }
}

/** The helper's terms summed, written the way a person would ("+ (-2)x" becomes "- 2x"). */
export const termsText = (ts: Term[]) =>
  ts.length
    ? ts
        .map(termText)
        .join(' + ')
        .replace(/^\(-([\d.]+)\)/, '-$1')
        .replace(/\+ \(-([\d.]+)\)/g, '- $1')
    : '0'

// ---------------------------------------------------------------- firing

export type ShotOutcome = 'target' | 'blob' | 'off' | 'broken' | 'short'

export interface Shot {
  outcome: ShotOutcome
  /** The path as drawn, start to where it stopped. */
  points: Point[]
  /** Where it stopped. */
  end: Point
  blob: number | null
  /** At the target's x: how far above (+) or below (−) the target the path passed. */
  missBy: number | null
}

const STEP = 0.01
/** A jump bigger than this inside a sliver too thin to see is a break, not a steep stretch. */
const JUMP = 0.25

const finite = (v: number) => Number.isFinite(v)

/** Is f continuous between a and b? Narrows in on any jump to tell steep from broken. */
function continuous(f: Fn, a: number, b: number): boolean {
  let lo = a
  let hi = b
  let fl = f(lo)
  let fh = f(hi)
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2
    const fm = f(mid)
    if (!finite(fm)) return false
    if (Math.abs(fm - fl) >= Math.abs(fh - fm)) {
      hi = mid
      fh = fm
    } else {
      lo = mid
      fl = fm
    }
  }
  return Math.abs(fh - fl) < JUMP
}

/** Fire: follow y = f(x) + shift from the car to the right edge of the screen. */
export function fire(level: GraphLevel, f: Fn): Shot {
  const sx = level.start.x
  const f0 = f(sx)
  const points: Point[] = []
  const stop = (outcome: ShotOutcome, end: Point, blob: number | null = null, missBy: number | null = null): Shot => {
    points.push(end)
    return { outcome, points, end, blob, missBy }
  }
  if (!finite(f0)) return stop('broken', { ...level.start })
  const shift = level.start.y - f0
  const y = (x: number) => f(x) + shift
  const hits = (p: Point): ShotOutcome | number | null => {
    for (let i = 0; i < level.blobs.length; i++) {
      const b = level.blobs[i]
      if (Math.hypot(p.x - b.x, p.y - b.y) < b.r) return i
    }
    if (Math.hypot(p.x - level.target.x, p.y - level.target.y) < level.target.r) return 'target'
    if (p.y > FIELD.yMax || p.y < FIELD.yMin) return 'off'
    return null
  }
  let prev: Point = { ...level.start }
  let missBy: number | null = null
  points.push(prev)
  const n = Math.round((FIELD.xMax - sx) / STEP)
  for (let k = 1; k <= n; k++) {
    const x = sx + k * STEP
    const yx = y(x)
    if (!finite(yx) || (Math.abs(yx - prev.y) > JUMP && !continuous(y, prev.x, x))) return stop('broken', prev)
    // Steep stretches are checked in small pieces so nothing is skipped over.
    const pieces = Math.max(1, Math.ceil(Math.abs(yx - prev.y) / 0.04))
    for (let j = 1; j <= pieces; j++) {
      const q = { x: prev.x + ((x - prev.x) * j) / pieces, y: pieces === 1 ? yx : y(prev.x + ((x - prev.x) * j) / pieces) }
      const h = hits(q)
      if (h === 'target') return stop('target', q)
      if (h === 'off') return stop('off', { x: q.x, y: Math.max(FIELD.yMin, Math.min(FIELD.yMax, q.y)) })
      if (typeof h === 'number') return stop('blob', q, h)
    }
    if (missBy === null && x >= level.target.x) missBy = yx - level.target.y
    const cur = { x, y: yx }
    // Keep about one point per 0.05 across (plus steep bits) for drawing.
    if (k % 5 === 0 || Math.abs(yx - prev.y) > 0.2) points.push(cur)
    prev = cur
  }
  return stop('short', prev, null, missBy)
}

/** What the shot did, as a fact for the screen (never what to change). */
export function shotFact(s: Shot): string {
  const at = `x = ${(Math.abs(s.end.x) < 0.05 ? 0 : s.end.x).toFixed(1)}`
  switch (s.outcome) {
    case 'target':
      return 'The path reached the target.'
    case 'blob':
      return `The path ran into an obstacle at ${at}.`
    case 'off':
      return `The path left the screen at ${at}.`
    case 'broken':
      return `The path breaks at ${at}: the function isn’t continuous there, so the car can’t follow it.`
    case 'short':
      return s.missBy === null ? 'The path never reached the target.' : `The path passed the target ${Math.abs(s.missBy).toFixed(1)} ${s.missBy > 0 ? 'above' : 'below'} it.`
  }
}

// ---------------------------------------------------------------- levels

const LEVEL_SHAPE: Record<GraphLevelId, { blobs: number; r: [number, number]; gap: [number, number]; seed: number }> = {
  easy: { blobs: 2, r: [1.1, 1.5], gap: [0.7, 1.3], seed: 0xea5e },
  medium: { blobs: 4, r: [0.85, 1.25], gap: [0.55, 1.1], seed: 0x3ed1 },
  hard: { blobs: 7, r: [0.75, 1.1], gap: [0.45, 0.9], seed: 0x4a2d },
}

/** A random path from the helper's own terms, harder levels bending more. */
function proofTerms(id: GraphLevelId, rand: () => number): Term[] {
  const pm = () => (rand() < 0.5 ? -1 : 1)
  const line: Term = { kind: 'line', p: [(rand() - 0.5) * 0.5] }
  const bump: Term = { kind: 'bump', p: [pm() * (2.2 + rand() * 1.6), (rand() - 0.5) * 6, 1.6 + rand() * 1.4] }
  const wave: Term = { kind: 'wave', p: [1.3 + rand() * 1.2, 0.45 + rand() * 0.35, (rand() - 0.5) * 6] }
  if (id === 'easy') return [line, bump]
  if (id === 'medium') return [line, wave]
  return [line, wave, { kind: 'bump', p: [pm() * (1.5 + rand()), (rand() - 0.5) * 8, 1.2 + rand()] }]
}

/** Builds the team's three courses. Each is checked: the proof path clears it, a straight line doesn't. */
export function makeLevel(id: GraphLevelId, seed: number): GraphLevel {
  const shape = LEVEL_SHAPE[id]
  for (let attempt = 0; attempt < 400; attempt++) {
    const rand = mulberry32((seed * 31 + attempt) ^ shape.seed)
    const start = { x: -9, y: (rand() - 0.5) * 6 }
    const terms = proofTerms(id, rand)
    const proof = termsText(terms)
    const parsed = parseFunction(proof)
    if (!parsed.ok) continue
    const shift = start.y - parsed.f(start.x)
    const path = (x: number) => parsed.f(x) + shift
    const tx = 7.5 + rand() * 1.5
    const ty = path(tx)
    // The whole proof path has to stay comfortably on screen.
    let onScreen = true
    for (let x = start.x; x <= tx; x += 0.1) if (Math.abs(path(x)) > FIELD.yMax - 0.8) onScreen = false
    if (!onScreen) continue
    const target = { x: tx, y: ty, r: 0.6 }
    const clearOfPath = (b: Circle, pad: number) => {
      for (let x = Math.max(start.x, b.x - b.r - pad); x <= Math.min(tx, b.x + b.r + pad); x += 0.05) if (Math.hypot(x - b.x, path(x) - b.y) < b.r + pad) return false
      return true
    }
    const clearOfEnds = (b: Circle) => Math.hypot(b.x - start.x, b.y - start.y) > b.r + 1.2 && Math.hypot(b.x - tx, b.y - ty) > b.r + 1
    const blobs: Circle[] = []
    // One obstacle sits on the straight line from the car to the target, where the path bends furthest from it.
    let far = { x: 0, d: 0 }
    for (let x = start.x + 2; x <= tx - 2; x += 0.1) {
      const straight = start.y + ((ty - start.y) * (x - start.x)) / (tx - start.x)
      const d = Math.abs(path(x) - straight)
      if (d > far.d) far = { x, d }
    }
    const r0 = shape.r[0] + rand() * (shape.r[1] - shape.r[0])
    const block = { x: far.x, y: start.y + ((ty - start.y) * (far.x - start.x)) / (tx - start.x), r: r0 }
    if (!clearOfPath(block, 0.35)) continue
    blobs.push(block)
    // The rest hug the path on one side or the other, leaving a corridor.
    for (let k = 1, tries = 0; blobs.length < shape.blobs && tries < 200; tries++) {
      const x = start.x + 2.2 + ((tx - start.x - 4.4) * (k - 0.5 + (rand() - 0.5) * 0.6)) / (shape.blobs - 1)
      const r = shape.r[0] + rand() * (shape.r[1] - shape.r[0])
      const gap = shape.gap[0] + rand() * (shape.gap[1] - shape.gap[0])
      const b = { x, y: path(x) + (rand() < 0.5 ? 1 : -1) * (r + gap), r }
      if (Math.abs(b.y) > FIELD.yMax - 0.3 || !clearOfPath(b, 0.3) || !clearOfEnds(b) || blobs.some((o) => Math.hypot(o.x - b.x, o.y - b.y) < (o.r + b.r) * 0.75)) continue
      blobs.push(b)
      k++
    }
    if (blobs.length < shape.blobs) continue
    const level: GraphLevel = { id, start, target, blobs, proof }
    if (fire(level, parsed.f).outcome !== 'target') continue
    const straight = parseFunction(`${(ty - start.y) / (tx - start.x)}x`)
    if (straight.ok && fire(level, straight.f).outcome === 'target') continue
    return level
  }
  throw new Error(`could not build the ${id} course`)
}

export const makeLevels = (seed: number) => GRAPH_LEVELS.map((l) => makeLevel(l.id, seed))
