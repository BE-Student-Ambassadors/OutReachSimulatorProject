import { Check, Eye, Trophy, Wrench, X, Zap } from 'lucide-react'
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

export function ResultsModal({
  scenario,
  result,
  cost,
  variantLabel,
  stats,
  observations,
  justUnlocked,
  canShowOverlay,
  onClose,
  onShowOverlay,
}: Props) {
  const rows = scenario.requirements.map((r) => ({ r, s: r.status(result, cost) }))
  const passed = rows.every(({ s }) => s.pass)

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[#0b1d2e]/50 p-4 backdrop-blur-xs">
      {passed && <Confetti />}
      <div className="relative max-h-full w-full max-w-[580px] animate-pop overflow-y-auto rounded-2xl bg-white shadow-2xl border border-[#d8e0ea]">
        {/* Header */}
        <div
          className={`px-6 pb-5 pt-6 ${
            passed
              ? 'bg-gradient-to-r from-[#003c6c] to-[#002b4d] text-white'
              : 'bg-gradient-to-r from-[#002b4d] to-[#0b1d2e] text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#fdc700]">
              {variantLabel} · Simulation Complete
            </span>
            {passed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f29813] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                <Trophy className="size-3" /> Requirements Met
              </span>
            )}
          </div>
          <h2 className="mt-2 font-sans text-2xl font-black leading-tight text-white">
            {passed ? 'Engineering Specifications Achieved!' : 'Iteration Needed: Constraints Unmet'}
          </h2>
          <p className="mt-1 text-sm text-slate-200">
            {passed
              ? `Your design satisfied all criteria for the ${variantLabel.toLowerCase()}.`
              : `One or more physical or budget parameters failed during the ${variantLabel.toLowerCase()}.`}
          </p>
        </div>

        {/* Requirements status list */}
        <div className="space-y-2.5 px-6 py-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#75787b]">Verification Checklist</div>
          {rows.map(({ r, s }) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                s.pass
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-red-200 bg-red-50/60'
              }`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-white ${
                  s.pass ? 'bg-[#003c6c]' : 'bg-[#dc2626]'
                }`}
              >
                {s.pass ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-sans text-sm font-bold text-[#0b1d2e]">{passed ? r.passLabel : r.label}</div>
                <div className="font-mono text-xs text-[#75787b]">Target: {r.target}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-base font-bold tabular text-[#0b1d2e]">{s.value}</div>
                <div className={`text-[11px] font-bold uppercase tracking-wide ${s.pass ? 'text-emerald-700' : 'text-red-600'}`}>
                  {s.pass ? 'Passed' : 'Failed'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Observations telemetry */}
        {(!passed || observations.length > 1) && (
          <div className="border-t border-[#f4f6fa] px-6 py-3">
            <h3 className="mb-2 font-sans text-xs font-bold uppercase tracking-wider text-[#003c6c]">
              Telemetry & Diagnostic Observations
            </h3>
            <ul className="space-y-1.5 text-sm text-[#0b1d2e]/85">
              {observations.map((o) => (
                <li key={o} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#f29813]" />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key stats summary */}
        {passed && (
          <div className="mx-6 mb-2 mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-[#d8e0ea] bg-[#f4f6fa] px-4 py-3">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-[#75787b]">{s.label}</span>
                <span className="font-mono text-xs font-bold text-[#003c6c]">{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Unlock notification */}
        {justUnlocked && (
          <div className="mx-6 mt-3 flex items-center gap-2.5 rounded-xl border border-[#f29813]/40 bg-[#f29813]/10 px-3.5 py-2.5 text-sm font-bold text-[#003c6c]">
            <Zap className="size-4 text-[#f29813]" />
            <span>Bonus Track Unlocked: {justUnlocked}</span>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center gap-2 border-t border-[#d8e0ea] px-6 pb-5 pt-4">
          {canShowOverlay && (
            <button
              type="button"
              onClick={onShowOverlay}
              className="flex items-center gap-2 rounded-xl border border-[#d8e0ea] px-4 py-2.5 text-sm font-bold text-[#003c6c] transition hover:bg-[#f4f6fa]"
            >
              <Eye className="size-4" /> View {scenario.overlayLabel?.toLowerCase() ?? 'overlay'}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="btn-press ml-auto flex items-center gap-2 rounded-xl bg-[#003c6c] px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#f29813]"
          >
            <Wrench className="size-4" /> {passed ? 'Optimize Design' : 'Refine & Re-engineer'}
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
        // Official UCSC Baskin Engineering color confetti: Navy, Orange, Gold, Cyan, White
        color: ['#003c6c', '#f29813', '#fdc700', '#13a5dc', '#ffffff'][i % 5],
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
