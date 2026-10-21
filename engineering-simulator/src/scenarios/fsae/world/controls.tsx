import { Check } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { play } from '../../../shared/audio/sfx'

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
          if (v !== shown) play('tick')
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
