import { Check, Cpu, Lock, Plus, Rocket, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { play } from '../../../shared/audio/sfx'
import { coursesCleared, getSoftware, upsert } from '../config'
import {
  FIELD,
  fire,
  GRAPH_LEVELS,
  makeLevel,
  newTerm,
  parseFunction,
  shotFact,
  TERM_SPECS,
  termsText,
  type Circle,
  type GraphLevel,
  type Point,
  type Shot,
  type Term,
  type TermKind,
} from '../sim/graph'
import type { FsaeObject, GraphLevelId, SoftwareObject } from '../types'

/**
 * The software station: the driverless computer's path planner as a graph game. Write a
 * function, fire, and see whether the car's path gets past the obstacles to the target.
 */

const MINT = '#9fe0b2'
const GOLD = '#e8c22a'
const RUST = '#e0703f'
const FLY_MS = 1300
const MAX_TERMS = 3

// Screen mapping: graph units → SVG pixels.
const W = 1000
const H = (W * (FIELD.yMax - FIELD.yMin)) / (FIELD.xMax - FIELD.xMin)
const sx = (x: number) => ((x - FIELD.xMin) / (FIELD.xMax - FIELD.xMin)) * W
const sy = (y: number) => ((FIELD.yMax - y) / (FIELD.yMax - FIELD.yMin)) * H
const U = W / (FIELD.xMax - FIELD.xMin)

type Mode = 'helper' | 'typed'
interface Fired {
  level: GraphLevelId
  shot: Shot
  started: number
}

export function SoftwareStation({ design, locked, fallbackSeed, onCommit }: { design: FsaeObject[]; locked: boolean; fallbackSeed: number; onCommit(next: FsaeObject[]): void }) {
  const existing = design.some((o) => o.kind === 'software')
  const sw: SoftwareObject = existing ? getSoftware(design) : { ...getSoftware(design), seed: fallbackSeed }
  const cleared = coursesCleared(sw)
  const levels = useMemo(() => Object.fromEntries(GRAPH_LEVELS.map((l) => [l.id, makeLevel(l.id, sw.seed)])) as Record<GraphLevelId, GraphLevel>, [sw.seed])

  const [levelId, setLevelId] = useState<GraphLevelId>(() => GRAPH_LEVELS[Math.min(2, cleared)].id)
  const [mode, setMode] = useState<Mode>('helper')
  const [terms, setTerms] = useState<Term[]>(() => [newTerm('line')])
  const [typed, setTyped] = useState('')
  const [fired, setFired] = useState<Fired | null>(null)
  const [trail, setTrail] = useState<Record<GraphLevelId, Shot[]>>({ easy: [], medium: [], hard: [] })
  const [progress, setProgress] = useState(1)

  const level = levels[levelId]
  const index = GRAPH_LEVELS.findIndex((l) => l.id === levelId)
  const unlocked = index <= cleared
  const expr = mode === 'helper' ? termsText(terms) : typed
  const parsed = parseFunction(expr)
  const flying = fired !== null && progress < 1

  // Animate the path being drawn after Fire.
  useEffect(() => {
    if (!fired) return
    let raf = 0
    const tick = () => {
      const p = Math.min(1, (performance.now() - fired.started) / FLY_MS)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else play(fired.shot.outcome === 'target' ? 'success' : 'fail')
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [fired])

  const shoot = () => {
    if (locked || flying || !unlocked || !parsed.ok) return
    const shot = fire(level, parsed.f)
    play('whoosh')
    setProgress(0)
    setFired({ level: levelId, shot, started: performance.now() })
    setTrail((t) => ({ ...t, [levelId]: [...t[levelId], shot].slice(-5) }))
    const prev = sw.levels[levelId]
    const won = shot.outcome === 'target'
    onCommit(
      upsert(design, {
        ...sw,
        levels: { ...sw.levels, [levelId]: { cleared: prev.cleared || won, shots: prev.shots + 1, solution: won ? expr : prev.solution } },
      }),
    )
  }

  const pick = (id: GraphLevelId) => {
    setLevelId(id)
    setFired(null)
    setProgress(1)
  }

  const current = fired?.level === levelId ? fired : null
  const shownFact = current && progress >= 1 ? shotFact(current.shot) : null
  const justWon = current?.shot.outcome === 'target' && progress >= 1
  const next = GRAPH_LEVELS[index + 1]

  return (
    <div className="flex h-full min-h-0 flex-col items-center">
      <div className="flex min-h-0 w-full flex-1 flex-col rounded-[22px] bg-[#1b2a20] p-3 shadow-2xl">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl bg-[#0f1c15] text-[#dcefe2]">
          {/* The graph */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
              <Cpu className="size-4 text-[#9fe0b2]" />
              <span className="font-mono text-[13px] font-bold tracking-wide text-[#9fe0b2]">Path planner</span>
              <span className="font-mono text-[11px] text-white/40">y = f(x) · the car follows the curve left to right</span>
              <div className="ml-auto flex gap-1 rounded-lg bg-white/5 p-1">
                {GRAPH_LEVELS.map((l, i) => {
                  const st = sw.levels[l.id]
                  const open = i <= cleared
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => pick(l.id)}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] font-bold ${levelId === l.id ? 'bg-[#9fe0b2] text-[#0f1c15]' : open ? 'text-white/75 hover:bg-white/10' : 'text-white/35 hover:bg-white/5'}`}
                    >
                      {st.cleared ? <Check className="size-3.5" /> : !open ? <Lock className="size-3" /> : null}
                      {l.label}
                      <span className="font-normal opacity-60">{l.course}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="relative min-h-0 flex-1 p-3">
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="size-full">
                <Grid />
                {level.blobs.map((b, i) => (
                  <Blob key={i} b={b} seed={i + index * 10} hit={current?.shot.outcome === 'blob' && current.shot.blob === i && progress >= 1} />
                ))}
                <Target t={level.target} hit={justWon} />
                {trail[levelId]
                  .filter((s) => s !== current?.shot)
                  .map((s, i) => (
                    <polyline key={i} points={pts(s.points)} fill="none" stroke={MINT} strokeOpacity={0.22} strokeWidth={2} strokeDasharray="6 5" />
                  ))}
                {current && <Flight shot={current.shot} progress={progress} />}
                <Car at={current ? along(current.shot.points, progress) : level.start} />
                {!unlocked && (
                  <g>
                    <rect width={W} height={H} fill="#0f1c15" fillOpacity={0.72} />
                    <text x={W / 2} y={H / 2} textAnchor="middle" fill="#dcefe2" fontSize={22} fontFamily="IBM Plex Mono, monospace">
                      Clear the {GRAPH_LEVELS[index - 1]?.label} course first
                    </text>
                  </g>
                )}
              </svg>
              {shownFact && (
                <div
                  className={`absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2 font-mono text-[12px] shadow-xl ring-1 ${justWon ? 'bg-[#16301f] text-[#9fe0b2] ring-[#9fe0b2]/40' : 'bg-[#2a1d16] text-[#f2b493] ring-[#e0703f]/40'}`}
                >
                  {shownFact}
                  {justWon && next && (
                    <button type="button" onClick={() => pick(next.id)} className="rounded-md bg-[#9fe0b2] px-2.5 py-1 font-bold text-[#0f1c15]">
                      Next: {next.label} →
                    </button>
                  )}
                  {justWon && !next && <span className="font-bold">All three courses cleared.</span>}
                </div>
              )}
            </div>
          </div>

          {/* The function helper */}
          <div className="flex w-[340px] shrink-0 flex-col border-l border-white/10 bg-[#13241a]">
            <div className="flex gap-1 p-2">
              {(['helper', 'typed'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    if (m === 'typed' && !typed) setTyped(termsText(terms))
                    setMode(m)
                  }}
                  className={`flex-1 rounded-lg py-2 font-mono text-[12px] font-bold ${mode === m ? 'bg-[#9fe0b2] text-[#0f1c15]' : 'text-white/60 hover:bg-white/5'}`}
                >
                  {m === 'helper' ? 'Function helper' : 'Type it yourself'}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 pb-3">
              {mode === 'helper' ? (
                <>
                  <p className="text-[11px] leading-snug text-white/55">Add pieces of a function and play with their numbers. They’re added together into one curve.</p>
                  {terms.map((t, i) => (
                    <TermCard
                      key={i}
                      term={t}
                      onChange={(nt) => setTerms((ts) => ts.map((o, j) => (j === i ? nt : o)))}
                      onRemove={terms.length > 1 ? () => setTerms((ts) => ts.filter((_, j) => j !== i)) : undefined}
                    />
                  ))}
                  {terms.length < MAX_TERMS && (
                    <div className="grid grid-cols-4 gap-1">
                      {(Object.keys(TERM_SPECS) as TermKind[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setTerms((ts) => [...ts, newTerm(k)])}
                          className="flex items-center justify-center gap-1 rounded-lg py-1.5 font-mono text-[11px] text-white/70 ring-1 ring-white/15 hover:bg-white/5"
                        >
                          <Plus className="size-3" />
                          {TERM_SPECS[k].label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[11px] leading-snug text-white/55">
                    Write any function of x. Use + − * / ^ and parentheses, numbers like 2x, and sin, cos, tan, sqrt, abs, exp, ln, pi.
                  </p>
                  <div className="flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-2 ring-1 ring-white/15 focus-within:ring-[#9fe0b2]">
                    <span className="font-mono text-[13px] text-white/50">y =</span>
                    <input
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && shoot()}
                      spellCheck={false}
                      placeholder="0.3x + 2sin(0.7x)"
                      className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-white outline-none placeholder:text-white/25"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['0.4x', '2sin(0.8x)', '-0.08x^2', '3e^(-(x/2)^2)', 'abs(x)/3'].map((ex) => (
                      <button key={ex} type="button" onClick={() => setTyped(ex)} className="rounded-md px-2 py-0.5 font-mono text-[11px] text-white/60 ring-1 ring-white/15 hover:bg-white/5">
                        {ex}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="rounded-lg bg-black/25 px-2.5 py-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-white/40">The car’s path</div>
                <div className="mt-0.5 break-words font-mono text-[12px] text-[#9fe0b2]">y = {expr || '…'}</div>
                {!parsed.ok && expr && <div className="mt-1 text-[11px] text-[#f2b493]">{parsed.error}</div>}
              </div>
              <p className="text-[11px] leading-snug text-white/45">
                Every path starts at the car: the curve slides up or down to begin there. The car can only follow a continuous curve; the path stops at an obstacle, a break in the
                function, or the edge of the screen.
              </p>
            </div>

            <div className="border-t border-white/10 p-3">
              <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-white/50">
                <span>
                  {GRAPH_LEVELS[index].label} course · {sw.levels[levelId].shots} shot{sw.levels[levelId].shots === 1 ? '' : 's'}
                </span>
                <span>Cleared {cleared} / 3</span>
              </div>
              <button
                type="button"
                disabled={locked || flying || !unlocked || !parsed.ok}
                onClick={shoot}
                className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-[#9fe0b2] px-4 py-3 font-display text-base font-bold text-[#0f1c15] hover:bg-[#b5ebc5] disabled:opacity-40"
              >
                <Rocket className="size-4" /> Fire
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="h-3 w-24 bg-[#1b2a20]" />
      <div className="h-2 w-48 rounded-t-lg bg-[#1b2a20]" />
    </div>
  )
}

// ---------------------------------------------------------------- helper UI

function TermCard({ term, onChange, onRemove }: { term: Term; onChange(t: Term): void; onRemove?: () => void }) {
  const spec = TERM_SPECS[term.kind]
  return (
    <div className="rounded-lg bg-black/25 p-2.5 ring-1 ring-white/10">
      <div className="flex items-center gap-2">
        <select
          value={term.kind}
          onChange={(e) => onChange(newTerm(e.target.value as TermKind))}
          className="rounded-md bg-[#0f1c15] px-1.5 py-1 font-mono text-[12px] font-bold text-[#9fe0b2] ring-1 ring-white/15 outline-none"
        >
          {(Object.keys(TERM_SPECS) as TermKind[]).map((k) => (
            <option key={k} value={k}>
              {TERM_SPECS[k].label}
            </option>
          ))}
        </select>
        <span className="font-mono text-[12px] text-white/60">{spec.shape}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} title="Remove" className="ml-auto grid size-6 place-items-center rounded-md text-white/40 hover:bg-white/10 hover:text-white">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="mt-2 space-y-1.5">
        {spec.params.map((q, i) => (
          <label key={q.name} className="flex items-center gap-2">
            <span className="w-4 font-mono text-[12px] font-bold text-white/70">{q.name}</span>
            <input
              type="range"
              min={q.min}
              max={q.max}
              step={q.step}
              value={term.p[i]}
              onChange={(e) => onChange({ ...term, p: term.p.map((v, j) => (j === i ? Number(e.target.value) : v)) })}
              className="min-w-0 flex-1 accent-[#9fe0b2]"
            />
            <input
              type="number"
              min={q.min}
              max={q.max}
              step={q.step}
              value={term.p[i]}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v)) onChange({ ...term, p: term.p.map((o, j) => (j === i ? v : o)) })
              }}
              className="w-16 rounded-md bg-[#0f1c15] px-1.5 py-0.5 text-right font-mono text-[12px] text-white ring-1 ring-white/15 outline-none focus:ring-[#9fe0b2]"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- graph drawing

const pts = (ps: Point[]) => ps.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')

/** The point a share `t` of the way along a path. */
function along(ps: Point[], t: number): Point {
  if (ps.length < 2) return ps[0]
  const seg = ps.slice(1).map((p, i) => Math.hypot(sx(p.x) - sx(ps[i].x), sy(p.y) - sy(ps[i].y)))
  let left = seg.reduce((a, b) => a + b, 0) * t
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i]) {
      const k = seg[i] ? left / seg[i] : 0
      return { x: ps[i].x + (ps[i + 1].x - ps[i].x) * k, y: ps[i].y + (ps[i + 1].y - ps[i].y) * k }
    }
    left -= seg[i]
  }
  return ps[ps.length - 1]
}

function Grid() {
  const xs = Array.from({ length: FIELD.xMax - FIELD.xMin + 1 }, (_, i) => FIELD.xMin + i)
  const ys = Array.from({ length: FIELD.yMax - FIELD.yMin + 1 }, (_, i) => FIELD.yMin + i)
  return (
    <g>
      <rect width={W} height={H} fill="#0b1711" />
      {xs.map((x) => (
        <line key={`x${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={H} stroke={MINT} strokeOpacity={x === 0 ? 0.35 : 0.07} strokeWidth={x === 0 ? 1.5 : 1} />
      ))}
      {ys.map((y) => (
        <line key={`y${y}`} y1={sy(y)} y2={sy(y)} x1={0} x2={W} stroke={MINT} strokeOpacity={y === 0 ? 0.35 : 0.07} strokeWidth={y === 0 ? 1.5 : 1} />
      ))}
      {xs
        .filter((x) => x % 2 === 0 && x !== 0 && x !== FIELD.xMin && x !== FIELD.xMax)
        .map((x) => (
          <text key={`tx${x}`} x={sx(x)} y={sy(0) + 16} textAnchor="middle" fontSize={12} fill={MINT} fillOpacity={0.4} fontFamily="IBM Plex Mono, monospace">
            {x}
          </text>
        ))}
      {ys
        .filter((y) => y % 2 === 0 && y !== 0 && y !== FIELD.yMin && y !== FIELD.yMax)
        .map((y) => (
          <text key={`ty${y}`} x={sx(0) + 6} y={sy(y) + 4} fontSize={12} fill={MINT} fillOpacity={0.4} fontFamily="IBM Plex Mono, monospace">
            {y}
          </text>
        ))}
    </g>
  )
}

/** An obstacle: a lumpy round shape, the same every time for a given seed. */
function Blob({ b, seed, hit }: { b: Circle; seed: number; hit: boolean }) {
  const d = useMemo(() => {
    const n = 28
    const a1 = 0.06 + ((seed * 37) % 7) / 100
    const ph = seed * 1.7
    return (
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        const r = b.r * U * (1 + a1 * Math.sin(3 * a + ph) + 0.04 * Math.sin(5 * a + ph * 2))
        return `${i ? 'L' : 'M'}${(sx(b.x) + r * Math.cos(a)).toFixed(1)} ${(sy(b.y) + r * Math.sin(a)).toFixed(1)}`
      }).join(' ') + 'Z'
    )
  }, [b, seed])
  return <path d={d} fill={hit ? '#4a2416' : '#33281f'} stroke={hit ? RUST : '#a88a5c'} strokeWidth={2} />
}

function Target({ t, hit }: { t: Circle; hit: boolean }) {
  return (
    <g>
      <circle cx={sx(t.x)} cy={sy(t.y)} r={t.r * U} fill={GOLD} fillOpacity={hit ? 0.4 : 0.15} stroke={GOLD} strokeWidth={2.5} />
      <circle cx={sx(t.x)} cy={sy(t.y)} r={t.r * U * 0.45} fill={GOLD} fillOpacity={0.6} />
      {hit && <circle cx={sx(t.x)} cy={sy(t.y)} r={t.r * U * 1.8} fill="none" stroke={GOLD} strokeOpacity={0.5} strokeWidth={2} />}
      <text x={sx(t.x)} y={sy(t.y) - t.r * U - 8} textAnchor="middle" fontSize={12} fill={GOLD} fontFamily="IBM Plex Mono, monospace">
        target
      </text>
    </g>
  )
}

function Car({ at }: { at: Point }) {
  return (
    <g transform={`translate(${sx(at.x)} ${sy(at.y)})`}>
      <rect x={-13} y={-7} width={26} height={14} rx={4} fill={MINT} />
      <rect x={2} y={-4.5} width={7} height={9} rx={2} fill="#0f1c15" />
      <circle cx={-8} cy={-8.5} r={3} fill="#0f1c15" stroke={MINT} strokeWidth={1.5} />
      <circle cx={-8} cy={8.5} r={3} fill="#0f1c15" stroke={MINT} strokeWidth={1.5} />
      <circle cx={8} cy={-8.5} r={3} fill="#0f1c15" stroke={MINT} strokeWidth={1.5} />
      <circle cx={8} cy={8.5} r={3} fill="#0f1c15" stroke={MINT} strokeWidth={1.5} />
    </g>
  )
}

/** The path drawing itself out after Fire, ending in a mark where it stopped. */
function Flight({ shot, progress }: { shot: Shot; progress: number }) {
  const done = progress >= 1
  const bad = shot.outcome !== 'target'
  const end = shot.end
  const ref = useRef<SVGPolylineElement>(null)
  return (
    <g>
      <polyline
        ref={ref}
        points={pts(shot.points)}
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - progress}
        fill="none"
        stroke={MINT}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {done && bad && (
        <g transform={`translate(${sx(end.x)} ${sy(end.y)})`} stroke={RUST} strokeWidth={3.5} strokeLinecap="round">
          <line x1={-8} y1={-8} x2={8} y2={8} />
          <line x1={-8} y1={8} x2={8} y2={-8} />
        </g>
      )}
    </g>
  )
}
