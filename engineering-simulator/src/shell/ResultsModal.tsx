import { Check, Eye, Wrench, X, Zap } from 'lucide-react'
import { useMemo } from 'react'
import type { AnyScenario, Stat } from '../core/scenario'

interface Props {
  scenario: AnyScenario
  result: unknown
  cost: number
  variantLabel: string
  stats: Stat[]
  observations: string[]
  justUnlocked: string | null
  canShowOverlay: boolean
  onClose(): void
  onShowOverlay(): void
}

export function ResultsModal({ scenario, result, cost, variantLabel, stats, observations, justUnlocked, canShowOverlay, onClose, onShowOverlay }: Props) {
  const rows = scenario.requirements.map((r) => ({ r, s: r.status(result, cost) }))
  const passed = rows.every(({ s }) => s.pass)

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-ink/35 p-4 backdrop-blur-[2px]">
      {passed && <Confetti />}
      <div className="relative max-h-full w-full max-w-[560px] animate-pop overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        <div className={`px-6 pb-4 pt-5 ${passed ? 'bg-forest text-white' : 'bg-paper text-ink'}`}>
          <div className={`font-mono text-xs uppercase tracking-wider ${passed ? 'text-white/70' : 'text-ink/55'}`}>
            {variantLabel} complete
          </div>
          <h2 className="mt-1 font-display text-[26px] font-bold leading-tight">
            {passed ? 'Engineering requirements met' : 'Design does not yet meet the requirements'}
          </h2>
          {passed && <p className="mt-1 text-white/85">Your design passed the {variantLabel.toLowerCase()}.</p>}
        </div>

        <div className="space-y-2 px-6 py-4">
          {rows.map(({ r, s }) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-white ${s.pass ? 'bg-forest' : 'bg-rust'}`}>
                {s.pass ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{passed ? r.passLabel : r.label}</div>
                <div className="font-mono text-xs text-ink/55">Required {r.target}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-semibold tabular">{s.value}</div>
                <div className={`text-[11px] font-bold uppercase tracking-wide ${s.pass ? 'text-forest' : 'text-rust'}`}>
                  {s.pass ? 'Passed' : 'Failed'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {(!passed || observations.length > 1) && (
          <div className="px-6 pb-2">
            <h3 className="mb-1.5 font-display text-sm font-semibold">What the sensors recorded</h3>
            <ul className="space-y-1 text-sm text-ink/80">
              {observations.map((o) => (
                <li key={o} className="flex gap-2">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink/40" />
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}

        {passed && (
          <div className="mx-6 mb-2 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-paper px-4 py-3">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-ink/60">{s.label}</span>
                <span className="font-mono text-xs font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {justUnlocked && (
          <div className="mx-6 mt-2 flex items-center gap-2 rounded-xl bg-sun/15 px-3 py-2 text-sm font-semibold text-ink ring-1 ring-sun/40">
            <Zap className="size-4 text-sun" /> {justUnlocked} unlocked
          </div>
        )}

        <div className="flex items-center gap-2 px-6 pb-5 pt-4">
          {canShowOverlay && (
            <button
              type="button"
              onClick={onShowOverlay}
              className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink ring-1 ring-line hover:bg-paper"
            >
              <Eye className="size-4" /> See flood map
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="btn-press ml-auto flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-dark"
          >
            <Wrench className="size-4" /> {passed ? 'Optimize design' : 'Modify design'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 10) * 0.08,
        dx: `${((i * 53) % 40) - 20}vw`,
        rot: `${(i * 97) % 720}deg`,
        color: ['#2c5b3c', '#74a85f', '#d9a52b', '#ffffff', '#b8d8a8'][i % 5],
        w: 6 + (i % 4) * 2,
      })),
    [],
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute -top-4 animate-confetti rounded-[2px]"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.w * 0.45,
              background: p.color,
              animationDelay: `${p.delay}s`,
              '--dx': p.dx,
              '--rot': p.rot,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
