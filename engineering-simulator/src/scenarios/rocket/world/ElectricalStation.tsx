import { Check, CircuitBoard, Eraser, PackageOpen } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CIRCUITS, getElectrical, upsert } from '../config'
import { adjacent, boardFor, boardStatus, cellCol, cellRow, pinAt } from '../sim/board'
import type { CircuitId, ElectricalObject, RocketObject } from '../types'

const CELL = 58
const PAD = 22

type Paths = Partial<Record<CircuitId, number[]>>

/**
 * Electrical: the breadboard. Drag from a pin to draw its wire hole by hole; drag back over a wire
 * to shorten it; running a wire through another one cuts that one. A finished board connects every
 * circuit and uses every hole.
 */
export function ElectricalStation({
  design,
  locked,
  onCommit,
  newSeed,
}: {
  design: RocketObject[]
  locked: boolean
  onCommit(next: RocketObject[]): void
  newSeed(): number
}) {
  const el = getElectrical(design)
  if (!el) {
    return (
      <div className="grid h-full place-items-center">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-line">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#fbf3df] text-[#b07a10]">
            <PackageOpen className="size-8" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold">Electronics kit</h2>
          <p className="mt-2 text-sm text-ink/65">
            A breadboard, a battery, the flight computer and four modules, plus a bag of jumper wire. Every component
            plugs into the board; your job is to wire them together.
          </p>
          <button
            type="button"
            disabled={locked}
            onClick={() => onCommit(upsert(design, { id: 'station:electrical', kind: 'electrical', seed: newSeed(), paths: {}, updatedAt: 1 }))}
            className="btn-press mt-5 rounded-xl bg-forest px-6 py-3 font-display font-bold text-white disabled:opacity-50"
          >
            Open the kit
          </button>
        </div>
      </div>
    )
  }
  return <Breadboard key={el.seed} el={el} design={design} locked={locked} onCommit={onCommit} />
}

function Breadboard({ el, design, locked, onCommit }: { el: ElectricalObject; design: RocketObject[]; locked: boolean; onCommit(next: RocketObject[]): void }) {
  const board = boardFor(el.seed)
  const [draft, setDraft] = useState<{ id: CircuitId; paths: Paths } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const paths = draft?.paths ?? el.paths
  const status = boardStatus({ ...el, paths })
  const W = board.cols * CELL + PAD * 2
  const H = board.rows * CELL + PAD * 2

  const cellAt = (e: ReactPointerEvent): number | null => {
    const r = svg.current?.getBoundingClientRect()
    if (!r) return null
    const sx = ((e.clientX - r.left) / r.width) * W - PAD
    const sy = ((e.clientY - r.top) / r.height) * H - PAD
    const c = Math.floor(sx / CELL)
    const row = Math.floor(sy / CELL)
    if (c < 0 || row < 0 || c >= board.cols || row >= board.rows) return null
    return row * board.cols + c
  }

  const ownerOf = (ps: Paths, cell: number): CircuitId | null => {
    for (const c of CIRCUITS) if (ps[c.id]?.includes(cell)) return c.id
    return null
  }

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (locked || e.button !== 0) return
    const cell = cellAt(e)
    if (cell === null) return
    const pin = pinAt(board, cell)
    const next: Paths = { ...el.paths }
    let id: CircuitId
    if (pin) {
      id = pin
      next[pin] = [cell]
    } else {
      const owner = ownerOf(next, cell)
      if (!owner) return
      id = owner
      const p = next[owner]!
      next[owner] = p.slice(0, p.indexOf(cell) + 1)
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraft({ id, paths: next })
  }

  /** Extends (or shortens) one wire by a single hole, Flow-style. Returns false when the move is not allowed. */
  const extend = (ps: Paths, id: CircuitId, cell: number): boolean => {
    const path = ps[id] ?? []
    const head = path[path.length - 1]
    const back = path.indexOf(cell)
    if (back >= 0) {
      ps[id] = path.slice(0, back + 1)
      return true
    }
    if (!adjacent(head, cell, board.cols)) return false
    // A finished wire stops at its second pin.
    const [a, b] = board.pins[id]
    if (path.length > 1 && (head === a || head === b)) return false
    const pin = pinAt(board, cell)
    if (pin && pin !== id) return false
    const owner = ownerOf(ps, cell)
    if (owner && owner !== id) {
      const other = ps[owner]!
      ps[owner] = other.slice(0, other.indexOf(cell))
    }
    ps[id] = [...path, cell]
    return true
  }

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!draft) return
    const cell = cellAt(e)
    if (cell === null) return
    const id = draft.id
    const path = draft.paths[id] ?? []
    const head = path[path.length - 1]
    if (cell === head) return
    const ps: Paths = { ...draft.paths }
    if (path.includes(cell)) {
      extend(ps, id, cell)
    } else {
      // A fast drag can skip holes: walk there one hole at a time (straight lines only).
      const [hr, hc, tr, tc] = [cellRow(head, board.cols), cellCol(head, board.cols), cellRow(cell, board.cols), cellCol(cell, board.cols)]
      if (hr !== tr && hc !== tc && !adjacent(head, cell, board.cols)) return
      const steps = Math.abs(tr - hr) + Math.abs(tc - hc)
      for (let i = 1; i <= steps; i++) {
        const next = (hr + Math.sign(tr - hr) * i) * board.cols + hc + Math.sign(tc - hc) * i
        if (!extend(ps, id, next)) break
      }
    }
    setDraft({ id, paths: ps })
  }

  const onUp = () => {
    if (!draft) return
    const cleaned: Paths = {}
    for (const c of CIRCUITS) {
      const p = draft.paths[c.id]
      if (p && p.length > 1) cleaned[c.id] = p
    }
    setDraft(null)
    if (JSON.stringify(cleaned) !== JSON.stringify(el.paths)) onCommit(upsert(design, { ...el, paths: cleaned, updatedAt: el.updatedAt + 1 }))
  }

  const center = (cell: number) => [PAD + cellCol(cell, board.cols) * CELL + CELL / 2, PAD + cellRow(cell, board.cols) * CELL + CELL / 2] as const

  return (
    <div className="flex h-full min-h-0 gap-4">
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-3xl bg-[#e9e4d6] p-4 ring-1 ring-line">
        <div className="mb-2 flex w-full max-w-[640px] items-center justify-between">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-ink/70">
            <CircuitBoard className="size-4" /> Flight breadboard
          </div>
          <div className="font-mono text-xs text-ink/55">Drag from a pin to lay a wire</div>
        </div>
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="max-h-full w-full max-w-[640px] touch-none select-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <rect x={4} y={4} width={W - 8} height={H - 8} rx={16} fill="#fbfaf5" stroke="#d6d1c2" strokeWidth={2} />
          <line x1={PAD} y1={12} x2={W - PAD} y2={12} stroke="#c23b22" strokeWidth={2} opacity={0.5} />
          <line x1={PAD} y1={H - 12} x2={W - PAD} y2={H - 12} stroke="#1b2a20" strokeWidth={2} opacity={0.35} />
          {Array.from({ length: board.rows * board.cols }, (_, cell) => {
            const [x, y] = center(cell)
            return <rect key={cell} x={x - 4} y={y - 4} width={8} height={8} rx={1.5} fill="#cfc9b8" />
          })}
          {CIRCUITS.map((c) => {
            const p = paths[c.id]
            if (!p || p.length < 2) return null
            const pts = p.map((cell) => center(cell).join(',')).join(' ')
            return (
              <g key={c.id}>
                <polyline points={pts} fill="none" stroke="#00000022" strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" transform="translate(0 2)" />
                <polyline points={pts} fill="none" stroke={c.color} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pts} fill="none" stroke="#ffffff55" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" transform="translate(-2 -3)" />
              </g>
            )
          })}
          {CIRCUITS.map((c) =>
            board.pins[c.id].map((cell, i) => {
              const [x, y] = center(cell)
              const done = status.connected[c.id]
              return (
                <g key={`${c.id}${i}`}>
                  <rect x={x - 25} y={y - 17} width={50} height={34} rx={7} fill="#1b2a20" stroke={c.color} strokeWidth={4} />
                  <text x={x} y={y + 4} textAnchor="middle" fontFamily="IBM Plex Mono" fontWeight={700} fontSize={c.pins[i].length > 6 ? 9 : 10.5} fill="#fff">
                    {c.pins[i]}
                  </text>
                  {done && <circle cx={x + 22} cy={y - 14} r={6} fill="#74a85f" stroke="#fff" strokeWidth={2} />}
                </g>
              )
            }),
          )}
        </svg>
      </div>

      <aside className="flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-ink/60">Holes used</span>
            <span className="font-mono text-sm font-semibold">{Math.round(status.fill * 100)}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper ring-1 ring-line">
            <div className="h-full rounded-full bg-leaf transition-[width]" style={{ width: `${status.fill * 100}%` }} />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-ink/60">Circuits connected</span>
            <span className="font-mono text-sm font-semibold">
              {status.connectedCount} / {CIRCUITS.length}
            </span>
          </div>
          {status.complete && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint px-3 py-2 text-sm font-bold text-forest">
              <Check className="size-4" /> Board complete
            </div>
          )}
        </div>
        <ul className="space-y-2">
          {CIRCUITS.map((c) => (
            <li key={c.id} className="rounded-2xl bg-white p-3 ring-1 ring-line">
              <div className="flex items-center gap-2">
                <span className="h-3 w-6 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="font-display text-sm font-bold">{c.label}</span>
                <span className="ml-auto font-mono text-[11px] text-ink/50">
                  {c.pins[0]} ↔ {c.pins[1]}
                </span>
                {status.connected[c.id] && <Check className="size-4 text-forest" strokeWidth={3} />}
              </div>
              <p className="mt-1 text-xs text-ink/60">{c.summary}</p>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={locked || Object.keys(el.paths).length === 0}
          onClick={() => onCommit(upsert(design, { ...el, paths: {}, updatedAt: el.updatedAt + 1 }))}
          className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink/70 ring-1 ring-line hover:bg-white disabled:opacity-40"
        >
          <Eraser className="size-4" /> Pull out every wire
        </button>
      </aside>
    </div>
  )
}

