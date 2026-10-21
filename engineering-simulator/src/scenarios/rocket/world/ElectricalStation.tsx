import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { ArrowLeft, Check, ChevronRight, CircuitBoard, Eraser, PackageOpen, Scissors, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { play } from '../../../shared/audio/sfx'
import { CrimpBench } from '../../../shared/crimp/CrimpBench'
import { CameraFly, type CameraGoal } from '../../../shared/three/CameraFly'
import { LabelLayer, LabelProjector, type LabelEls, type PinnedLabel } from '../../../shared/three/Labels'
import { Knob } from '../../../shared/ui/Knob'
import { WorldErrorBoundary } from '../../../shell/WorldErrorBoundary'
import { BOARD_BY_ID, BOARDS, CUT_MARGIN, emptyLine, getElectrical, LINE_BY_ID, LINES, lineOf, RESISTOR_DIAL, upsert } from '../config'
import { adjacent, boardFor, boardStatus, cellCol, cellRow, pinAt, type Board } from '../sim/board'
import { lineProgress, readLines, zoneAt, type LineReading } from '../sim/power'
import type { BoardId, CircuitId, ElectricalObject, LineId, LineWork, RocketObject, SpliceZone } from '../types'
import { BenchScene } from './BenchScene'
import { BOARD_AT, HOME_GOAL, jobGoal, sameJob, ZONE_TINT, type BenchJob } from './benchGeo'

const END_LABEL = ['Battery side', 'Part side'] as const

/**
 * Electrical: the electronics workbench. Two breadboards to wire (Flow-style: drag from a pin to
 * lay a wire hole by hole, wires can't cross, a finished board uses every hole) and two battery
 * leads to cut, crimp and splice a resistor into, all on a 3D rocket with its side cut away.
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
            Two breadboards, a 9 V battery, the flight computer and four modules, a bag of jumper wire, resistors and crimp connectors. Every component plugs into a board;
            your job is to wire them together and get the right voltage to each part.
          </p>
          <button
            type="button"
            disabled={locked}
            onClick={() => onCommit(upsert(design, { id: 'station:electrical', kind: 'electrical', seed: newSeed(), paths: {}, lines: {}, updatedAt: 1 }))}
            className="btn-press mt-5 rounded-xl bg-forest px-6 py-3 font-display font-bold text-white disabled:opacity-50"
          >
            Open the kit
          </button>
        </div>
      </div>
    )
  }
  return <Workbench el={el} design={design} locked={locked} onCommit={onCommit} />
}

type Overlay = { kind: 'crimp'; end: 0 | 1 } | { kind: 'board' } | null

function Workbench({ el, design, locked, onCommit }: { el: ElectricalObject; design: RocketObject[]; locked: boolean; onCommit(next: RocketObject[]): void }) {
  const [job, setJob] = useState<BenchJob | null>(null)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [hoverT, setHoverT] = useState<number | null>(null)
  const [dialPreview, setDialPreview] = useState<number | null>(null)
  const [goal, setGoal] = useState<CameraGoal>(HOME_GOAL)

  const save = (next: ElectricalObject) => onCommit(upsert(design, { ...next, updatedAt: next.updatedAt + 1 }))
  const setLine = (id: LineId, line: LineWork) => {
    const before = lineProgress(el, id)
    const next = { ...el, lines: { ...el.lines, [id]: line } }
    const after = lineProgress(next, id)
    if (after.inRange && !before.inRange) play('chime')
    if (after.done && !before.done) play('success')
    save(next)
  }

  // Live dial: the parts react while the knob turns, before anything is saved.
  const activeLine = job?.kind === 'line' ? job.id : null
  const shown: ElectricalObject =
    activeLine && dialPreview !== null && lineOf(el, activeLine).ohms !== null ? { ...el, lines: { ...el.lines, [activeLine]: { ...lineOf(el, activeLine), ohms: dialPreview } } } : el
  const readings = readLines(shown)
  const status = boardStatus(el)
  const progress = Object.fromEntries(LINES.map((l) => [l.id, lineProgress(el, l.id)])) as Record<LineId, ReturnType<typeof lineProgress>>
  const done = {
    boards: Object.fromEntries(BOARDS.map((b) => [b.id, status.boards[b.id].complete])) as Record<BoardId, boolean>,
    lines: Object.fromEntries(LINES.map((l) => [l.id, progress[l.id].done])) as Record<LineId, boolean>,
  }

  // A part pushed over its range buzzes once.
  const highCount = Object.values(readings).filter((r) => r.state === 'high').length
  const lastHigh = useRef(highCount)
  useEffect(() => {
    if (highCount > lastHigh.current) play('buzz')
    lastHigh.current = highCount
  }, [highCount])

  const open = (j: BenchJob | null) => {
    play(j ? 'whoosh' : 'click')
    setJob(j)
    setOverlay(j?.kind === 'board' ? { kind: 'board' } : null)
    setHoverT(null)
    setDialPreview(null)
    setGoal(j ? jobGoal(j) : HOME_GOAL)
  }

  const labels: PinnedLabel[] = useMemo(
    () =>
      job === null
        ? [
            ...LINES.map((l) => ({ key: l.id, pos: [l.partAt[0], l.partAt[1] + 0.15, l.partAt[2]] as [number, number, number], text: l.id === 'igniter' ? 'Igniter' : 'Flight computer', tone: 'place' as const })),
            { key: 'boards', pos: [BOARD_AT.sensor[0], BOARD_AT.sensor[1] + 0.22, 0.05] as [number, number, number], text: 'Breadboards', tone: 'place' as const },
            { key: 'battery', pos: [0.36, 0.1, 0.05] as [number, number, number], text: '9 V battery', tone: 'tag' as const },
          ]
        : [],
    [job],
  )
  const labelEls = useRef<LabelEls>(new Map())

  const cutting = !!activeLine && lineOf(el, activeLine).cutAt === null

  return (
    <div className="flex h-full min-h-0 gap-3">
      <aside className="flex w-[340px] shrink-0 flex-col gap-2.5 overflow-y-auto overscroll-contain pb-2 pr-1">
        {job === null && <Overview el={el} progress={progress} readings={readings} onOpen={open} locked={locked} onClearBoards={() => save({ ...el, paths: {} })} />}
        {job?.kind === 'board' && <BoardJob board={job.id} el={el} onBack={() => open(null)} onShow={() => setOverlay({ kind: 'board' })} />}
        {job?.kind === 'line' && (
          <LeadJob
            id={job.id}
            el={el}
            reading={readings[job.id]}
            hoverT={hoverT}
            dialPreview={dialPreview}
            locked={locked}
            onBack={() => open(null)}
            onLine={(l) => setLine(job.id, l)}
            onDialPreview={setDialPreview}
            onOverlay={setOverlay}
          />
        )}
      </aside>

      <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl bg-[#e9ebe4] ring-1 ring-line" onContextMenu={(e) => e.preventDefault()}>
        <WorldErrorBoundary>
          <Canvas shadows="percentage" dpr={[1, 1.75]} camera={{ position: HOME_GOAL.pos.toArray(), fov: 38, near: 0.02 }}>
            <BenchScene
              el={shown}
              readings={readings}
              job={job}
              cutting={cutting && overlay === null}
              hoverT={hoverT}
              done={done}
              locked={locked}
              onPick={(j) => {
                if (!sameJob(j, job)) open(j)
              }}
              onHoverCut={setHoverT}
              onCut={(t) => {
                if (!activeLine) return
                play('rip')
                setHoverT(null)
                setLine(activeLine, { ...emptyLine(), cutAt: Math.round(t * 1000) / 1000 })
              }}
            />
            <CameraFly goal={goal} />
            <OrbitControls makeDefault enablePan={false} minDistance={0.2} maxDistance={5} maxPolarAngle={1.5} target={HOME_GOAL.target.toArray()} />
            <LabelProjector labels={labels} els={labelEls} />
          </Canvas>
        </WorldErrorBoundary>
        <LabelLayer labels={labels} els={labelEls} />

        <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-white/95 px-3 py-1.5 shadow ring-1 ring-black/10">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Electronics workbench</div>
          <div className="font-display text-sm font-bold text-ink">
            {job === null ? 'Click a glowing part to work on it' : job.kind === 'board' ? BOARD_BY_ID[job.id].label : LINE_BY_ID[job.id].label}
          </div>
        </div>
        <span className="absolute right-3 top-3 rounded-lg bg-white/90 px-2 py-1 font-mono text-[10px] text-ink/55 ring-1 ring-black/5">drag to look around · scroll to zoom</span>

        {cutting && overlay === null && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto flex w-fit items-center gap-2 rounded-xl bg-ink/90 px-4 py-2 text-sm font-semibold text-white shadow-xl">
            <Scissors className="size-4 text-sun" />
            {hoverT === null
              ? 'Move along the wire to choose where to cut it'
              : hoverT < CUT_MARGIN || hoverT > 1 - CUT_MARGIN
                ? 'Too close to the end: no room to crimp'
                : `Click to cut here · ${zoneAt(activeLine!, hoverT).label}`}
          </div>
        )}

        {overlay && (
          <div className="absolute bottom-3 right-3 top-12 flex w-[480px] max-w-[calc(100%-24px)] flex-col overflow-y-auto rounded-2xl bg-ink/95 p-4 shadow-2xl ring-1 ring-black/30 backdrop-blur">
            <button type="button" onClick={() => setOverlay(null)} aria-label="Close" className="absolute right-3 top-3 text-white/60 hover:text-white">
              <X className="size-5" />
            </button>
            {overlay.kind === 'crimp' && activeLine && (
              <CrimpBench
                key={`${activeLine}-${overlay.end}`}
                awg={LINE_BY_ID[activeLine].awg}
                wireColor={LINE_BY_ID[activeLine].color}
                endLabel={END_LABEL[overlay.end]}
                locked={locked}
                onDone={(r) => {
                  const line = lineOf(el, activeLine)
                  const crimps = [...line.crimps] as LineWork['crimps']
                  crimps[overlay.end] = r.quality
                  setLine(activeLine, { ...line, crimps })
                  const other = (1 - overlay.end) as 0 | 1
                  setOverlay(crimps[other] === null ? { kind: 'crimp', end: other } : null)
                }}
              />
            )}
            {overlay.kind === 'board' && job?.kind === 'board' && (
              <Breadboard key={`${el.seed}-${job.id}`} board={boardFor(el.seed, job.id)} el={el} locked={locked} onCommit={(paths) => save({ ...el, paths })} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- overview

function Overview({
  el,
  progress,
  readings,
  locked,
  onOpen,
  onClearBoards,
}: {
  el: ElectricalObject
  progress: Record<LineId, ReturnType<typeof lineProgress>>
  readings: Record<LineId, LineReading>
  locked: boolean
  onOpen(j: BenchJob): void
  onClearBoards(): void
}) {
  const status = boardStatus(el)
  return (
    <>
      <div className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
        <h3 className="font-display text-[15px] font-bold">The rocket’s electronics</h3>
        <p className="mt-1 text-xs text-ink/65">
          Two breadboards on the avionics sled connect the flight computer to everything it controls. Two leads carry the 9 V battery to the flight computer and the igniter, and each
          part is rated for a range of voltage.
        </p>
      </div>
      <h4 className="px-1 font-mono text-[10px] uppercase tracking-wider text-ink/50">Breadboards</h4>
      {BOARDS.map((b) => {
        const st = status.boards[b.id]
        const circuits = boardFor(el.seed, b.id).circuits
        return (
          <button key={b.id} type="button" onClick={() => onOpen({ kind: 'board', id: b.id })} className="group rounded-2xl bg-white p-3 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink/30">
            <div className="flex items-center gap-2">
              <CircuitBoard className="size-4 text-ink/60" />
              <span className="font-display text-[14px] font-bold">{b.label}</span>
              {st.complete && <Check className="size-4 text-forest" strokeWidth={3} />}
              <span className="ml-auto font-mono text-[11px] text-ink/55">
                {st.connectedCount} / {circuits.length} · {Math.round(st.fill * 100)}%
              </span>
              <ChevronRight className="size-4 text-ink/30 group-hover:text-ink" />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {circuits.map((c) => (
                <span key={c.id} className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${st.connected[c.id] ? 'bg-mint text-forest' : 'bg-paper text-ink/55'}`}>
                  <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.label}
                </span>
              ))}
            </div>
          </button>
        )
      })}
      <h4 className="mt-1 px-1 font-mono text-[10px] uppercase tracking-wider text-ink/50">Battery leads</h4>
      {LINES.map((l) => {
        const pr = progress[l.id]
        const r = readings[l.id]
        return (
          <button key={l.id} type="button" onClick={() => onOpen({ kind: 'line', id: l.id })} className="group rounded-2xl bg-white p-3 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink/30">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-6 rounded-full" style={{ background: l.color }} />
              <span className="font-display text-[14px] font-bold">{l.label}</span>
              {pr.done && <Check className="size-4 text-forest" strokeWidth={3} />}
              <span className={`ml-auto font-mono text-[13px] font-bold ${r.state === 'ok' ? 'text-forest' : r.state === 'high' ? 'text-rust' : 'text-[#a77c17]'}`}>{r.volts.toFixed(1)} V</span>
              <ChevronRight className="size-4 text-ink/30 group-hover:text-ink" />
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < pr.steps ? 'bg-forest' : 'bg-paper ring-1 ring-line'}`} />
              ))}
              <span className="ml-1.5 font-mono text-[10px] text-ink/50">
                rated {l.lo}–{l.hi} V
              </span>
            </div>
          </button>
        )
      })}
      <button
        type="button"
        disabled={locked || Object.keys(el.paths).length === 0}
        onClick={onClearBoards}
        className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-ink/60 ring-1 ring-line hover:bg-white disabled:opacity-40"
      >
        <Eraser className="size-3.5" /> Pull every wire out of both breadboards
      </button>
    </>
  )
}

// ---------------------------------------------------------------- one breadboard

function BoardJob({ board, el, onBack, onShow }: { board: BoardId; el: ElectricalObject; onBack(): void; onShow(): void }) {
  const st = boardStatus(el).boards[board]
  const b = boardFor(el.seed, board)
  return (
    <>
      <BackButton onBack={onBack} />
      <div className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
        <h3 className="font-display text-[16px] font-bold">{BOARD_BY_ID[board].label}</h3>
        <p className="mt-1 text-xs text-ink/65">
          Drag from a pin to lay a wire hole by hole; drag back over a wire to shorten it. Running a wire through another one cuts that one. A finished board connects every circuit and
          uses every hole.
        </p>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-xs font-semibold text-ink/60">Holes used</span>
          <span className="font-mono text-sm font-semibold">{Math.round(st.fill * 100)}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper ring-1 ring-line">
          <div className="h-full rounded-full bg-leaf transition-[width]" style={{ width: `${st.fill * 100}%` }} />
        </div>
        {st.complete && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint px-3 py-2 text-sm font-bold text-forest">
            <Check className="size-4" /> Board complete
          </div>
        )}
        <button type="button" onClick={onShow} className="btn-press mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-xs font-bold text-white">
          <CircuitBoard className="size-3.5" /> Open the board
        </button>
      </div>
      <ul className="space-y-2">
        {b.circuits.map((c) => (
          <li key={c.id} className="rounded-2xl bg-white p-3 ring-1 ring-line">
            <div className="flex items-center gap-2">
              <span className="h-3 w-6 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="font-display text-sm font-bold">{c.label}</span>
              <span className="ml-auto font-mono text-[11px] text-ink/50">
                {c.pins[0]} ↔ {c.pins[1]}
              </span>
              {st.connected[c.id] && <Check className="size-4 text-forest" strokeWidth={3} />}
            </div>
            <p className="mt-1 text-xs text-ink/60">{c.summary}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

const CELL = 58
const PAD = 22

type Paths = ElectricalObject['paths']

/** One breadboard, Flow-style. Only this board's wires are edited; the other board's are kept. */
function Breadboard({ board, el, locked, onCommit }: { board: Board; el: ElectricalObject; locked: boolean; onCommit(paths: Paths): void }) {
  const [draft, setDraft] = useState<{ id: CircuitId; paths: Paths } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const paths = draft?.paths ?? el.paths
  const status = boardStatus({ ...el, paths }).boards[board.id]
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
    for (const c of board.circuits) if (ps[c.id]?.includes(cell)) return c.id
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
    play('select')
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
    const [a, b] = board.pins[id]!
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
    play('tick')
    setDraft({ id, paths: ps })
  }

  const onUp = () => {
    if (!draft) return
    const cleaned: Paths = {}
    for (const [id, p] of Object.entries(draft.paths) as [CircuitId, number[]][]) if (p && p.length > 1) cleaned[id] = p
    setDraft(null)
    if (JSON.stringify(cleaned) === JSON.stringify(el.paths)) return
    play('place')
    onCommit(cleaned)
  }

  const center = (cell: number) => [PAD + cellCol(cell, board.cols) * CELL + CELL / 2, PAD + cellRow(cell, board.cols) * CELL + CELL / 2] as const

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 pr-7">
        <span className="font-display text-sm font-bold text-white">{BOARD_BY_ID[board.id].label}</span>
        <span className="font-mono text-[11px] text-white/60">
          {status.connectedCount} / {board.circuits.length} connected · {Math.round(status.fill * 100)}% of holes
        </span>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none rounded-xl bg-[#e9e4d6]"
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
        {board.circuits.map((c) => {
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
        {board.circuits.map((c) =>
          board.pins[c.id]!.map((cell, i) => {
            const [x, y] = center(cell)
            return (
              <g key={`${c.id}${i}`}>
                <rect x={x - 25} y={y - 17} width={50} height={34} rx={7} fill="#1b2a20" stroke={c.color} strokeWidth={4} />
                <text x={x} y={y + 4} textAnchor="middle" fontFamily="IBM Plex Mono" fontWeight={700} fontSize={c.pins[i].length > 6 ? 9 : 10.5} fill="#fff">
                  {c.pins[i]}
                </text>
                {status.connected[c.id] && <circle cx={x + 22} cy={y - 14} r={6} fill="#74a85f" stroke="#fff" strokeWidth={2} />}
              </g>
            )
          }),
        )}
      </svg>
      {status.complete && (
        <div className="flex items-center gap-2 rounded-xl bg-[#9fe0b2]/20 px-3 py-2 text-sm font-bold text-[#9fe0b2]">
          <Check className="size-4" /> Board complete
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- one battery lead

function BackButton({ onBack }: { onBack(): void }) {
  return (
    <button type="button" onClick={onBack} className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink/70 hover:bg-white">
      <ArrowLeft className="size-3.5" /> Whole rocket
    </button>
  )
}

function Step({ n, title, done, active, children }: { n: number; title: string; done: boolean; active: boolean; children?: ReactNode }) {
  return (
    <section className={`rounded-2xl p-3 ring-1 transition ${active ? 'bg-white shadow-sm ring-ink/25' : 'bg-white/60 ring-line'}`}>
      <h4 className="flex items-center gap-2 font-display text-[14px] font-bold text-ink">
        <span className={`grid size-5 place-items-center rounded-full font-mono text-[11px] ${done ? 'bg-forest text-white' : 'bg-paper text-ink/60 ring-1 ring-line'}`}>
          {done ? <Check className="size-3" strokeWidth={3} /> : n}
        </span>
        <span className={done || active ? '' : 'text-ink/50'}>{title}</span>
      </h4>
      {(active || done) && children && <div className="mt-2">{children}</div>}
    </section>
  )
}

function LeadJob({
  id,
  el,
  reading,
  hoverT,
  dialPreview,
  locked,
  onBack,
  onLine,
  onDialPreview,
  onOverlay,
}: {
  id: LineId
  el: ElectricalObject
  reading: LineReading
  hoverT: number | null
  dialPreview: number | null
  locked: boolean
  onBack(): void
  onLine(l: LineWork): void
  onDialPreview(v: number | null): void
  onOverlay(o: Overlay): void
}) {
  const spec = LINE_BY_ID[id]
  const line = lineOf(el, id)
  const pr = lineProgress(el, id)
  const crimped = pr.crimped === 2
  const hoverZone = hoverT !== null ? zoneAt(id, hoverT) : null
  const ohms = dialPreview ?? line.ohms ?? 0

  return (
    <>
      <BackButton onBack={onBack} />
      <div className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full" style={{ background: spec.color }} />
          <h3 className="font-display text-[16px] font-bold">{spec.label}</h3>
        </div>
        <p className="mt-1 text-xs text-ink/65">{spec.summary}</p>
        <Multimeter reading={reading} />
        <p className="mt-1.5 text-[11px] leading-snug text-ink/65">{statusLine(reading)}</p>
        <div className="mt-1.5 font-mono text-[10px] text-ink/45">
          Source: {spec.sourceV} V battery · draws {spec.amps} A · {spec.awg} AWG wire
        </div>
      </div>

      <Step n={1} title="Cut the lead" done={pr.cut} active={!pr.cut}>
        {pr.cut && pr.zone ? (
          <div className="space-y-1.5 text-xs">
            <ZoneChip zone={pr.zone.zone} label={pr.zone.label} />
            <div className="font-mono text-[11px] text-ink/55">Cut {Math.round(line.cutAt! * 100)}% of the way along</div>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                play('undo')
                onLine(emptyLine())
              }}
              className="flex items-center gap-1 text-[11px] font-semibold text-ink/60 underline disabled:opacity-40"
            >
              <Undo2 className="size-3" /> Replace this lead with fresh wire
            </button>
          </div>
        ) : (
          <div className="space-y-2 text-xs text-ink/70">
            <p>The lead is tinted by what it runs past. Hover it in the 3D view to read each stretch, then click to cut.</p>
            <div className="space-y-1">
              {spec.zones.map((z) => (
                <ZoneChip key={z.from} zone={z.zone} label={z.label} active={hoverZone?.from === z.from} />
              ))}
            </div>
          </div>
        )}
      </Step>

      <Step n={2} title="Crimp both ends" done={crimped} active={pr.cut && !crimped}>
        <div className="grid grid-cols-2 gap-1.5">
          {([0, 1] as const).map((end) => {
            const q = line.crimps[end]
            return (
              <button
                key={end}
                type="button"
                disabled={locked || !pr.cut}
                onClick={() => {
                  play('select')
                  onOverlay({ kind: 'crimp', end })
                }}
                className="rounded-xl bg-paper px-2.5 py-2 text-left ring-1 ring-line hover:bg-mint disabled:opacity-40"
              >
                <div className="text-[11px] font-semibold text-ink/70">{END_LABEL[end]}</div>
                <div className={`font-mono text-sm font-bold ${q === null ? 'text-ink/40' : q >= 0.85 ? 'text-forest' : q >= 0.6 ? 'text-[#a77c17]' : 'text-rust'}`}>
                  {q === null ? 'not crimped' : `${Math.round(q * 100)}%`}
                </div>
                <div className="text-[10px] text-ink/45">{q === null ? 'Click to crimp' : 'Click to redo'}</div>
              </button>
            )
          })}
        </div>
      </Step>

      <Step n={3} title="Splice in a resistor and set its dial" done={line.ohms !== null} active={crimped && line.ohms === null}>
        {line.ohms === null ? (
          <button
            type="button"
            disabled={locked || !crimped}
            onClick={() => {
              play('place')
              onDialPreview(null)
              onLine({ ...line, ohms: RESISTOR_DIAL.start })
            }}
            className="flex w-full flex-col items-center gap-1 rounded-xl bg-paper px-2 py-2 ring-1 ring-line transition hover:bg-white disabled:opacity-40"
          >
            <ResistorSymbol />
            <span className="text-xs font-bold">Adjustable resistor</span>
            <span className="font-mono text-[10px] text-ink/55">from the kit</span>
          </button>
        ) : (
          <div>
            <p className="text-[11px] text-ink/65">Drops voltage: V = I × R. The dial sets R (ohms). It turns the dropped power into heat: P = I² × R.</p>
            <div className="mt-2 flex justify-center">
              <Knob key={id} value={line.ohms} {...RESISTOR_DIAL} color="#b8461b" disabled={locked} onPreview={onDialPreview} onCommit={(v) => onLine({ ...line, ohms: v })} />
            </div>
            <p className="mt-2 rounded-lg bg-paper px-2.5 py-1.5 text-center font-mono text-[11.5px] text-ink/80">
              {spec.amps} A × {ohms.toFixed(2)} Ω = {(spec.amps * ohms).toFixed(2)} V dropped
              <br />
              <span className="text-ink/50">
                heat: {spec.amps}² A² × {ohms.toFixed(2)} Ω = {(spec.amps * spec.amps * ohms).toFixed(1)} W
              </span>
              <br />
              <span className="text-ink/50">crimped connections: −{reading.crimpDrop.toFixed(1)} V</span>
            </p>
          </div>
        )}
      </Step>

      <Step n={4} title={`Voltage in its rated range (${spec.lo}–${spec.hi} V)`} done={pr.inRange} active={line.ohms !== null && !pr.inRange}>
        <p className="text-[11px] text-ink/65">{line.ohms !== null ? `${reading.volts.toFixed(1)} V at the part.` : ''}</p>
      </Step>

      {pr.done && (
        <div className="flex items-center gap-2 rounded-2xl bg-mint px-3 py-2.5 text-sm font-bold text-forest ring-1 ring-forest/30">
          <Check className="size-4" strokeWidth={3} /> {spec.label}: every step done
        </div>
      )}
    </>
  )
}

function ZoneChip({ zone, label, active }: { zone: SpliceZone; label: string; active?: boolean }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg px-2 py-1 text-[11px] ${active ? 'bg-paper ring-1 ring-ink/30' : ''}`}>
      <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: ZONE_TINT[zone] }} />
      <span className="text-ink/75">{label}</span>
    </div>
  )
}

/** A meter with the rated range marked and the needle at the reading. */
function Multimeter({ reading }: { reading: LineReading }) {
  const { spec, volts, state } = reading
  const max = Math.max(spec.hi * 1.6, spec.sourceV * 1.1)
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <div className="mt-2 rounded-xl bg-ink px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">At the part</span>
        <span className={`font-mono text-xl font-bold tabular ${state === 'ok' ? 'text-[#9fe0b2]' : state === 'high' ? 'text-[#f08a5d]' : 'text-sun'}`}>{volts.toFixed(1)} V</span>
      </div>
      <div className="relative mt-1.5 h-2.5 rounded-full bg-white/10">
        <div className="absolute inset-y-0 rounded-full bg-leaf/60" style={{ left: pct(spec.lo), width: `calc(${pct(spec.hi)} - ${pct(spec.lo)})` }} />
        <div className="absolute -top-0.5 h-3.5 w-1 -translate-x-1/2 rounded-full bg-white transition-[left] duration-150" style={{ left: pct(volts) }} />
      </div>
    </div>
  )
}

function statusLine(r: LineReading): string {
  const { spec, state } = r
  const range = `rated ${spec.lo}–${spec.hi} V`
  if (r.open) return 'The lead is open: nothing reaches the part until both ends are crimped and a resistor joins them.'
  if (state === 'ok') return `In range (${range}).`
  if (spec.id === 'computer')
    return state === 'high' ? `Too much (${range}). The flight computer is overheating and shuts itself off.` : `Too little (${range}). The flight computer keeps restarting.`
  return state === 'high' ? `Too much (${range}). The igniter wire glows white-hot.` : `Too little (${range}). The igniter only gets warm.`
}

function ResistorSymbol() {
  return (
    <svg width={40} height={20} viewBox="0 0 44 22">
      <path d="M0 11 H8 L11 3 L16 19 L21 3 L26 19 L31 3 L34 11 H44" fill="none" stroke="#b8461b" strokeWidth={2.4} strokeLinejoin="round" />
    </svg>
  )
}
