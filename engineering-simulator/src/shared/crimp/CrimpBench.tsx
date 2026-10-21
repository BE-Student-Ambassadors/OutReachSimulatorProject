import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { play } from '../audio/sfx'
import { CRIMP, scoreCrimp, type CrimpDie, type CrimpReport } from './crimp'

type Phase = 'die' | 'strip' | 'squeeze' | 'done'

const PX_PER_MM = 14
/** Full handle travel takes this long when held, seconds. */
const SQUEEZE_S = 1.7

/**
 * Crimping one end of a cut wire, in three skills: pick the die for the wire's size, strip the
 * right length of insulation, and squeeze the crimper just far enough.
 */
export function CrimpBench({
  awg,
  wireColor,
  endLabel,
  locked,
  onDone,
}: {
  awg: number
  wireColor: string
  endLabel: string
  locked: boolean
  onDone(r: CrimpReport): void
}) {
  const [phase, setPhase] = useState<Phase>('die')
  const [die, setDie] = useState<CrimpDie['id'] | null>(null)
  const [strip, setStrip] = useState(0)
  const [squeeze, setSqueeze] = useState(0)
  const [report, setReport] = useState<CrimpReport | null>(null)

  const restart = () => {
    setPhase('die')
    setDie(null)
    setStrip(0)
    setSqueeze(0)
    setReport(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 pr-7">
        <span className="font-display text-sm font-bold text-white">Crimp the {endLabel.toLowerCase()} end</span>
        <span className="font-mono text-[11px] text-white/60">
          Wire: {awg} AWG · connector barrel {CRIMP.stripTargetMm} mm long
        </span>
      </div>
      <Steps phase={phase} />

      {phase === 'die' && (
        <div className="rounded-xl bg-black/25 p-3">
          <p className="text-xs text-white/70">The crimper takes three dies. Each one is shaped for a range of wire sizes (AWG: a smaller number is a thicker wire).</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {CRIMP.dies.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={locked}
                onClick={() => {
                  play('thunk')
                  setDie(d.id)
                  setPhase('strip')
                }}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 p-3 ring-1 ring-white/15 transition hover:bg-white/10 disabled:opacity-40"
              >
                <DieArt color={d.color} />
                <span className="text-xs font-bold text-white">{d.label}</span>
                <span className="font-mono text-[10px] text-white/60">
                  {d.awg[0]}–{d.awg[1]} AWG
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'strip' && (
        <Stripper
          wireColor={wireColor}
          locked={locked}
          onStrip={(mm) => {
            play('rip')
            setStrip(mm)
            setPhase('squeeze')
          }}
        />
      )}

      {phase === 'squeeze' && die && (
        <Squeezer
          die={CRIMP.dies.find((d) => d.id === die)!}
          wireColor={wireColor}
          strip={strip}
          locked={locked}
          onRelease={(s) => {
            setSqueeze(s)
            const r = scoreCrimp({ die, stripMm: strip, squeeze: s }, awg)
            setReport(r)
            setPhase('done')
            play(r.quality >= 0.85 ? 'chime' : 'thunk')
          }}
        />
      )}

      {phase === 'done' && report && (
        <div className="rounded-xl bg-black/25 p-3">
          <div className="flex items-center gap-3">
            <CrimpSection quality={report.quality} squeeze={squeeze} />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-white/50">Crimp quality</div>
              <div className={`font-mono text-2xl font-bold ${report.quality >= 0.85 ? 'text-[#9fe0b2]' : report.quality >= 0.6 ? 'text-sun' : 'text-[#f08a5d]'}`}>{Math.round(report.quality * 100)}%</div>
            </div>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-white/75">
            {report.facts.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={restart} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/20 hover:bg-white/10">
              <RotateCcw className="size-3.5" /> Cut it off and redo
            </button>
            <button type="button" disabled={locked} onClick={() => onDone(report)} className="btn-press flex-1 rounded-lg bg-[#9fe0b2] px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-40">
              Keep this crimp
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Steps({ phase }: { phase: Phase }) {
  const order: Phase[] = ['die', 'strip', 'squeeze', 'done']
  const at = order.indexOf(phase)
  return (
    <div className="flex gap-1.5">
      {['Pick a die', 'Strip', 'Squeeze', 'Check'].map((l, i) => (
        <span key={l} className={`flex-1 rounded-full px-2 py-1 text-center font-mono text-[10px] font-bold ${i < at ? 'bg-[#9fe0b2]/25 text-[#9fe0b2]' : i === at ? 'bg-white text-ink' : 'bg-white/5 text-white/40'}`}>
          {l}
        </span>
      ))}
    </div>
  )
}

function DieArt({ color }: { color: string }) {
  return (
    <svg width="54" height="34" viewBox="0 0 54 34">
      <rect x="2" y="4" width="50" height="26" rx="4" fill="#3a3f3c" />
      <path d="M14 17 a6 6 0 0 1 12 0 a6 6 0 0 0 12 0" fill="none" stroke={color} strokeWidth="4" />
      <circle cx="44" cy="10" r="3" fill={color} />
    </svg>
  )
}

/** Drag the wire end into the stripper; how far it goes past the blades is what gets stripped. */
function Stripper({ wireColor, locked, onStrip }: { wireColor: string; locked: boolean; onStrip(mm: number): void }) {
  const svg = useRef<SVGSVGElement>(null)
  const [mm, setMm] = useState(0)
  const drag = useRef<{ x: number; mm: number } | null>(null)
  const W = 420
  const BLADE = 250
  const toLocal = (e: ReactPointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    return ((e.clientX - r.left) / r.width) * W
  }
  const tip = BLADE + mm * PX_PER_MM
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <p className="text-xs text-white/70">Drag the wire to the right, into the stripper. Whatever passes the blades is stripped bare when you let go.</p>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} 120`}
        className={`mt-2 w-full touch-none select-none ${locked ? '' : 'cursor-ew-resize'}`}
        onPointerDown={(e) => {
          if (locked) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { x: toLocal(e), mm }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const next = Math.max(0, Math.min(CRIMP.stripMaxMm, drag.current.mm + (toLocal(e) - drag.current.x) / PX_PER_MM))
          if (Math.floor(next) !== Math.floor(mm)) play('tick')
          setMm(next)
        }}
        onPointerUp={() => {
          if (!drag.current) return
          drag.current = null
          if (mm > 0.3) onStrip(Math.round(mm * 10) / 10)
        }}
      >
        {/* Ruler from the blades */}
        <rect x={BLADE} y={84} width={CRIMP.stripMaxMm * PX_PER_MM} height={22} fill="#e9e4d6" rx={2} />
        {Array.from({ length: CRIMP.stripMaxMm + 1 }, (_, i) => (
          <g key={i}>
            <line x1={BLADE + i * PX_PER_MM} x2={BLADE + i * PX_PER_MM} y1={84} y2={i % 5 === 0 ? 98 : 91} stroke="#1b2a20" strokeWidth={1} />
            {i % 2 === 0 && (
              <text x={BLADE + i * PX_PER_MM} y={105} fontSize={8} textAnchor="middle" fontFamily="IBM Plex Mono" fill="#1b2a20">
                {i}
              </text>
            )}
          </g>
        ))}
        <text x={BLADE - 4} y={100} fontSize={9} textAnchor="end" fontFamily="IBM Plex Mono" fill="#ffffffaa">
          mm
        </text>
        {/* Wire */}
        <rect x={0} y={38} width={tip} height={18} rx={4} fill={wireColor} />
        <rect x={0} y={41} width={tip} height={3} fill="#ffffff44" />
        {/* Stripper jaws */}
        <path d={`M${BLADE - 8} 6 h40 v26 h-40 z`} fill="#3a3f3c" />
        <path d={`M${BLADE - 8} 62 h40 v26 h-40 z`} fill="#3a3f3c" />
        <polygon points={`${BLADE},32 ${BLADE + 6},32 ${BLADE + 3},40`} fill="#d4d8d6" />
        <polygon points={`${BLADE},62 ${BLADE + 6},62 ${BLADE + 3},54`} fill="#d4d8d6" />
        <rect x={BLADE + 32} y={6} width={150} height={26} rx={6} fill="#c23b22" opacity={0.9} />
        <rect x={BLADE + 32} y={62} width={150} height={22} rx={6} fill="#c23b22" opacity={0.9} />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-xs text-white/75">
        <span>Past the blades</span>
        <span className="font-bold text-white">{mm.toFixed(1)} mm</span>
      </div>
    </div>
  )
}

/** Hold to close the crimper's handles; let go to stop. */
function Squeezer({ die, wireColor, strip, locked, onRelease }: { die: CrimpDie; wireColor: string; strip: number; locked: boolean; onRelease(s: number): void }) {
  const [s, setS] = useState(0)
  const holding = useRef<{ start: number; clicks: number } | null>(null)
  const raf = useRef(0)
  const sRef = useRef(0)
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const tick = (now: number) => {
    const h = holding.current
    if (!h) return
    const t = (now - h.start) / 1000
    // Handles close fast at first, then stiffen as the barrel forms.
    const v = Math.min(1.08, 1 - (1 - Math.min(1, t / SQUEEZE_S)) ** 1.6 + Math.max(0, t - SQUEEZE_S) * 0.12)
    const clicks = Math.floor(v * 12)
    if (clicks > h.clicks) {
      h.clicks = clicks
      play('tick')
    }
    sRef.current = v
    setS(v)
    raf.current = requestAnimationFrame(tick)
  }
  const start = (at: number) => {
    if (locked || holding.current) return
    holding.current = { start: at, clicks: 0 }
    raf.current = requestAnimationFrame(tick)
  }
  const stop = () => {
    if (!holding.current) return
    holding.current = null
    cancelAnimationFrame(raf.current)
    if (sRef.current > 0.02) onRelease(Math.round(sRef.current * 100) / 100)
  }

  const open = 1 - Math.min(1, s)
  const crushed = s > CRIMP.crush
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <p className="text-xs text-white/70">
        {strip} mm stripped, sitting in the {die.label.toLowerCase()}. Hold the button (or the space bar) to close the handles; let go to stop.
      </p>
      <div className="mt-2 flex items-center gap-4">
        <svg viewBox="0 0 220 150" className="w-[220px]">
          {/* Handles pivot at the jaw */}
          <g transform="translate(70 70)">
            <g transform={`rotate(${-6 - 20 * open})`}>
              <rect x={0} y={-10} width={140} height={14} rx={7} fill="#c23b22" />
              <rect x={-40} y={-14} width={46} height={16} rx={3} fill="#3a3f3c" />
            </g>
            <g transform={`rotate(${6 + 20 * open})`}>
              <rect x={0} y={-4} width={140} height={14} rx={7} fill="#c23b22" />
              <rect x={-40} y={-2} width={46} height={16} rx={3} fill="#3a3f3c" />
            </g>
            <circle r={6} fill="#9aa3ad" />
          </g>
          {/* Connector barrel in the jaw, squashing as the handles close */}
          <rect x={4} y={70 - 9 * (1 - Math.min(1, s) * 0.55)} width={30} height={18 * (1 - Math.min(1, s) * 0.55)} rx={4} fill={crushed ? '#8e7d62' : '#d4d8d6'} stroke={die.color} strokeWidth={2} />
          <rect x={-30} y={66} width={36} height={8} fill={wireColor} />
        </svg>
        <div className="flex-1">
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/50">Handle travel</div>
          <div className="relative mt-1 h-4 overflow-hidden rounded-full bg-white/10">
            <div className="absolute inset-y-0 bg-white/15" style={{ left: `${CRIMP.squeezeLo * 100}%`, width: `${(CRIMP.squeezeHi - CRIMP.squeezeLo) * 100}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-sun transition-none" style={{ width: `${Math.min(100, s * 100)}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-[#f08a5d]" style={{ left: `${CRIMP.crush * 100}%` }} />
          </div>
          <div className="mt-0.5 flex justify-between font-mono text-[9px] text-white/45">
            <span>open</span>
            <span>full stroke</span>
            <span>stop</span>
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-white">{Math.round(s * 100)}%</div>
        </div>
      </div>
      <button
        type="button"
        disabled={locked}
        onPointerDown={(e) => start(e.timeStamp)}
        onPointerUp={stop}
        onPointerLeave={stop}
        onKeyDown={(e) => {
          if (e.key === ' ' && !e.repeat) {
            e.preventDefault()
            start(e.timeStamp)
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ') stop()
        }}
        className="btn-press mt-2 w-full select-none rounded-xl bg-white px-3 py-2.5 font-display text-sm font-bold text-ink disabled:opacity-40"
      >
        Hold to squeeze
      </button>
    </div>
  )
}

/** Cross-section of the finished crimp: round and full when good. */
function CrimpSection({ quality, squeeze }: { quality: number; squeeze: number }) {
  const squash = Math.min(1, squeeze)
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <ellipse cx="32" cy="32" rx={26} ry={26 - 12 * squash} fill="#d4d8d6" stroke="#9aa3ad" strokeWidth="3" />
      {Array.from({ length: 19 }, (_, i) => {
        const a = (i / 19) * Math.PI * 2
        const r = i === 0 ? 0 : i < 7 ? 7 : 13
        return <circle key={i} cx={32 + r * Math.cos(a) * (0.6 + 0.4 * quality)} cy={32 + r * Math.sin(a) * (1 - 0.45 * squash)} r={4} fill="#c8743a" />
      })}
    </svg>
  )
}
