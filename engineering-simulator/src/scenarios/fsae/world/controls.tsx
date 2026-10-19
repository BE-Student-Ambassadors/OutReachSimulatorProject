import { Check, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const snap = (v: number, step: number) => Math.round(v / step) * step
const fmt = (v: number, step: number) => (step < 1 ? v.toFixed(step < 0.1 ? 2 : 1) : String(Math.round(v)))

/**
 * A slider that previews while dragging and commits once on release, so a drag is one
 * undo step and one write to the team's shared design.
 */
export function CommitSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  ends,
  onPreview,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  disabled?: boolean
  /** Words for the two ends of the range, e.g. ['Tucked in', 'All the way out']. */
  ends?: [string, string]
  onPreview?(v: number | null): void
  onCommit(v: number): void
}) {
  const [local, setLocal] = useState<number | null>(null)
  const shown = local ?? value
  // Arrow keys repeat: wait for a short pause before saving, so holding a key is one write.
  const keyTimer = useRef(0)
  useEffect(() => () => clearTimeout(keyTimer.current), [])
  const finish = () => {
    clearTimeout(keyTimer.current)
    if (local !== null && local !== value) onCommit(local)
    setLocal(null)
    onPreview?.(null)
  }
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-ink/80">{label}</span>
        <span className="font-mono text-[13px] font-semibold tabular text-ink">
          {fmt(shown, step)} <span className="text-ink/50">{unit}</span>
        </span>
      </span>
      <input
        type="range"
        className="mt-1 w-full accent-forest disabled:opacity-40"
        min={min}
        max={max}
        step={step}
        value={shown}
        disabled={disabled}
        onChange={(e) => {
          const v = Number(e.target.value)
          setLocal(v)
          onPreview?.(v)
        }}
        onPointerUp={finish}
        onKeyUp={() => {
          clearTimeout(keyTimer.current)
          keyTimer.current = window.setTimeout(finish, 600)
        }}
        onBlur={finish}
      />
      {ends && (
        <span className="flex justify-between font-mono text-[10px] uppercase tracking-wide text-ink/40">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </span>
      )}
    </label>
  )
}

/**
 * A potentiometer dial. Drag up/down (or scroll, or use the buttons) to turn it.
 * Previews while turning and commits when released.
 */
export function Knob({
  value,
  min,
  max,
  step,
  unit,
  color,
  disabled,
  size = 76,
  onPreview,
  onCommit,
}: {
  value: number
  min: number
  max: number
  step: number
  unit: string
  color: string
  disabled?: boolean
  size?: number
  onPreview?(v: number | null): void
  onCommit(v: number): void
}) {
  const [local, setLocal] = useState<number | null>(null)
  const drag = useRef<{ y: number; v: number } | null>(null)
  const shown = local ?? value
  const frac = (shown - min) / (max - min)
  const angle = -135 + 270 * frac
  const latest = useRef({ local, value, onCommit, onPreview })
  useEffect(() => {
    latest.current = { local, value, onCommit, onPreview }
  })

  const set = (v: number) => {
    const next = clamp(snap(v, step), min, max)
    setLocal(next)
    onPreview?.(next)
    return next
  }
  const commitNow = (v: number) => {
    setLocal(null)
    onPreview?.(null)
    if (v !== value) onCommit(v)
  }

  // Wheel turns preview immediately and commit after a short pause.
  const wheelTimer = useRef(0)
  useEffect(() => () => clearTimeout(wheelTimer.current), [])

  const r = size / 2
  const arc = (a0: number, a1: number, rad: number) => {
    const p = (a: number) => [r + rad * Math.sin((a * Math.PI) / 180), r - rad * Math.cos((a * Math.PI) / 180)]
    const [x0, y0] = p(a0)
    const [x1, y1] = p(a1)
    return `M ${x0} ${y0} A ${rad} ${rad} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
  }

  return (
    <div className={`flex items-center gap-2 ${disabled ? 'opacity-40' : ''}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label="Turn down"
        onClick={() => commitNow(clamp(snap(value - step, step), min, max))}
        className="grid size-7 place-items-center rounded-lg bg-paper ring-1 ring-line hover:bg-white"
      >
        <Minus className="size-3.5" />
      </button>
      <svg
        width={size}
        height={size}
        className={`touch-none ${disabled ? '' : 'cursor-ns-resize'}`}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={shown}
        onPointerDown={(e) => {
          if (disabled) return
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          drag.current = { y: e.clientY, v: shown }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          // 160 px of drag sweeps the whole range.
          set(drag.current.v + ((drag.current.y - e.clientY) / 160) * (max - min))
        }}
        onPointerUp={() => {
          if (!drag.current) return
          drag.current = null
          const { local: l, value: v } = latest.current
          commitNow(l ?? v)
        }}
        onWheel={(e) => {
          if (disabled) return
          const next = set(shown + (e.deltaY < 0 ? step : -step))
          clearTimeout(wheelTimer.current)
          wheelTimer.current = window.setTimeout(() => commitNow(next), 450)
        }}
      >
        <path d={arc(-135, 135, r - 5)} stroke="#e1dfd3" strokeWidth={6} fill="none" strokeLinecap="round" />
        {frac > 0.004 && <path d={arc(-135, angle, r - 5)} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" />}
        <circle cx={r} cy={r} r={r - 13} fill="#fbfaf5" stroke="#1b2a20" strokeOpacity={0.15} />
        {Array.from({ length: 11 }, (_, i) => {
          const a = ((-135 + 27 * i) * Math.PI) / 180
          return <line key={i} x1={r + (r - 15) * Math.sin(a)} y1={r - (r - 15) * Math.cos(a)} x2={r + (r - 19) * Math.sin(a)} y2={r - (r - 19) * Math.cos(a)} stroke="#1b2a20" strokeOpacity={0.3} />
        })}
        <g transform={`rotate(${angle} ${r} ${r})`}>
          <rect x={r - 2} y={14} width={4} height={r - 16} rx={2} fill="#1b2a20" />
        </g>
      </svg>
      <button
        type="button"
        disabled={disabled}
        aria-label="Turn up"
        onClick={() => commitNow(clamp(snap(value + step, step), min, max))}
        className="grid size-7 place-items-center rounded-lg bg-paper ring-1 ring-line hover:bg-white"
      >
        <Plus className="size-3.5" />
      </button>
      <span className="min-w-[64px] font-mono text-base font-bold tabular text-ink">
        {fmt(shown, step)} {unit}
      </span>
    </div>
  )
}

export function Section({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
      <h3 className="mb-2 flex items-center gap-2 font-display text-[15px] font-bold text-ink">
        <span className={`grid size-5 place-items-center rounded-full font-mono text-[11px] ${done ? 'bg-forest text-white' : 'bg-paper text-ink/60 ring-1 ring-line'}`}>
          {done ? <Check className="size-3" strokeWidth={3} /> : n}
        </span>
        {title}
      </h3>
      {children}
    </section>
  )
}

export function Readout({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'good' | 'bad' | 'warn' }) {
  const color = tone === 'good' ? 'text-forest' : tone === 'bad' ? 'text-rust' : tone === 'warn' ? 'text-[#a77c17]' : 'text-ink'
  return (
    <div className="rounded-xl bg-paper px-2.5 py-1.5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink/50">{label}</div>
      <div className={`font-mono text-[15px] font-bold tabular ${color}`}>{value}</div>
    </div>
  )
}
