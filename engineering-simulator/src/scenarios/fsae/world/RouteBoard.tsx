import { Check, Eraser } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { play } from '../../../shared/audio/sfx'
import { adjacent, boardStatus, cellCol, cellRow, pinAt, type RouteBoard } from '../sim/routing'

const CELL = 62
const PAD = 26

type Routes = Record<string, number[]>

/**
 * Routing plate: drag from a connector to lay its wire hole by hole along the plate; drag back
 * over a wire to shorten it; running a wire through another one pulls that one back. A neat job
 * connects every wire and uses every tie point.
 */
export function RoutePlate({
  board,
  routes,
  locked,
  title,
  onCommit,
}: {
  board: RouteBoard
  routes: Routes
  locked: boolean
  title: string
  onCommit(next: Routes): void
}) {
  const [draft, setDraft] = useState<{ id: string; routes: Routes } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const shown = draft?.routes ?? routes
  const status = boardStatus(board, shown)
  const { rows, cols } = board
  const W = cols * CELL + PAD * 2
  const H = rows * CELL + PAD * 2

  const cellAt = (e: ReactPointerEvent): number | null => {
    const r = svg.current?.getBoundingClientRect()
    if (!r) return null
    const sx = ((e.clientX - r.left) / r.width) * W - PAD
    const sy = ((e.clientY - r.top) / r.height) * H - PAD
    const c = Math.floor(sx / CELL)
    const row = Math.floor(sy / CELL)
    if (c < 0 || row < 0 || c >= cols || row >= rows) return null
    return row * cols + c
  }

  const ownerOf = (rs: Routes, cell: number): string | null => {
    for (const w of board.wires) if (rs[w.id]?.includes(cell)) return w.id
    return null
  }

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (locked || e.button !== 0) return
    const cell = cellAt(e)
    if (cell === null) return
    const pin = pinAt(board, cell)
    const next: Routes = { ...routes }
    let id: string
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
    play('select')
    setDraft({ id, routes: next })
  }

  const extend = (rs: Routes, id: string, cell: number): boolean => {
    const path = rs[id] ?? []
    const head = path[path.length - 1]
    const back = path.indexOf(cell)
    if (back >= 0) {
      rs[id] = path.slice(0, back + 1)
      return true
    }
    if (!adjacent(head, cell, cols)) return false
    const [a, b] = board.pins[id]
    if (path.length > 1 && (head === a || head === b)) return false
    const pin = pinAt(board, cell)
    if (pin && pin !== id) return false
    const owner = ownerOf(rs, cell)
    if (owner && owner !== id) {
      const other = rs[owner]!
      rs[owner] = other.slice(0, other.indexOf(cell))
    }
    rs[id] = [...path, cell]
    return true
  }

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!draft) return
    const cell = cellAt(e)
    if (cell === null) return
    const id = draft.id
    const path = draft.routes[id] ?? []
    const head = path[path.length - 1]
    if (cell === head) return
    const rs: Routes = { ...draft.routes }
    if (path.includes(cell)) extend(rs, id, cell)
    else {
      // A fast drag can skip holes: walk there one hole at a time (straight lines only).
      const [hr, hc, tr, tc] = [cellRow(head, cols), cellCol(head, cols), cellRow(cell, cols), cellCol(cell, cols)]
      if (hr !== tr && hc !== tc && !adjacent(head, cell, cols)) return
      const steps = Math.abs(tr - hr) + Math.abs(tc - hc)
      for (let i = 1; i <= steps; i++) {
        const next = (hr + Math.sign(tr - hr) * i) * cols + hc + Math.sign(tc - hc) * i
        if (!extend(rs, id, next)) break
      }
    }
    play('tick')
    setDraft({ id, routes: rs })
  }

  const onUp = () => {
    if (!draft) return
    const cleaned: Routes = {}
    for (const w of board.wires) {
      const p = draft.routes[w.id]
      if (p && p.length > 1) cleaned[w.id] = p
    }
    setDraft(null)
    if (JSON.stringify(cleaned) === JSON.stringify(routes)) return
    const before = boardStatus(board, routes)
    const after = boardStatus(board, cleaned)
    play(after.complete && !before.complete ? 'success' : after.connectedCount > before.connectedCount ? 'chime' : 'place')
    onCommit(cleaned)
  }

  const center = (cell: number) => [PAD + cellCol(cell, cols) * CELL + CELL / 2, PAD + cellRow(cell, cols) * CELL + CELL / 2] as const

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 flex w-full flex-wrap items-baseline justify-between gap-x-3 pr-7">
        <span className="font-display text-sm font-bold text-white">{title}</span>
        <span className="font-mono text-[11px] text-white/60">
          {status.connectedCount}/{board.wires.length} connected · {Math.round(status.fill * 100)}% of tie points used
        </span>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[460px] touch-none select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <defs>
          <linearGradient id="plate" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#d9dcd8" />
            <stop offset="0.5" stopColor="#c3c7c2" />
            <stop offset="1" stopColor="#b2b6b0" />
          </linearGradient>
        </defs>
        <rect x={4} y={4} width={W - 8} height={H - 8} rx={14} fill="url(#plate)" stroke="#8e938d" strokeWidth={2} />
        {/* Brushed-metal streaks */}
        {Array.from({ length: 14 }, (_, i) => (
          <line key={i} x1={10} x2={W - 10} y1={12 + (i * (H - 24)) / 13} y2={12 + (i * (H - 24)) / 13} stroke="#ffffff" strokeOpacity={0.12} />
        ))}
        {[
          [14, 14],
          [W - 14, 14],
          [14, H - 14],
          [W - 14, H - 14],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={5} fill="#8e938d" stroke="#6b706a" />
        ))}
        {Array.from({ length: rows * cols }, (_, cell) => {
          const [x, y] = center(cell)
          return <circle key={cell} cx={x} cy={y} r={7} fill="#6b706a" stroke="#ffffff55" />
        })}
        {board.wires.map((w) => {
          const p = shown[w.id]
          if (!p || p.length < 2) return null
          const pts = p.map((cell) => center(cell).join(',')).join(' ')
          const done = status.connected[w.id]
          return (
            <g key={w.id}>
              <polyline points={pts} fill="none" stroke="#00000033" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" transform="translate(0 3)" />
              <polyline points={pts} fill="none" stroke={w.color} strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={pts} fill="none" stroke="#ffffff44" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" transform="translate(-2 -3)" />
              {/* Zip ties on finished wires */}
              {done &&
                p.slice(1, -1).map((cell, i) =>
                  i % 2 === 0 ? (
                    <rect key={cell} x={center(cell)[0] - 3} y={center(cell)[1] - 12} width={6} height={24} rx={2} fill="#1c1f1d" opacity={0.85} />
                  ) : null,
                )}
            </g>
          )
        })}
        {board.wires.map((w) =>
          board.pins[w.id].map((cell, i) => {
            const [x, y] = center(cell)
            const done = status.connected[w.id]
            const label = w.pins[i]
            return (
              <g key={`${w.id}${i}`}>
                <rect x={x - 27} y={y - 17} width={54} height={34} rx={7} fill="#1b2a20" stroke={w.color} strokeWidth={4} />
                <text x={x} y={y + 4} textAnchor="middle" fontFamily="IBM Plex Mono" fontWeight={700} fontSize={label.length > 6 ? 9 : 10.5} fill="#fff">
                  {label}
                </text>
                {done && <circle cx={x + 24} cy={y - 14} r={6} fill="#74a85f" stroke="#fff" strokeWidth={2} />}
              </g>
            )
          }),
        )}
      </svg>
      <div className="mt-2 flex w-full items-center justify-between">
        {status.complete ? (
          <span className="flex items-center gap-1.5 rounded-lg bg-mint px-2.5 py-1 text-xs font-bold text-forest">
            <Check className="size-3.5" strokeWidth={3} /> Every wire tied down, every tie point used
          </span>
        ) : (
          <span className="text-xs text-white/60">Drag from a connector. Wires can’t cross.</span>
        )}
        <button
          type="button"
          disabled={locked || Object.keys(routes).length === 0}
          onClick={() => onCommit({})}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-white/75 ring-1 ring-white/20 hover:bg-white/10 disabled:opacity-40"
        >
          <Eraser className="size-3.5" /> Pull out every wire
        </button>
      </div>
    </div>
  )
}
