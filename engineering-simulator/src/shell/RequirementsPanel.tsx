import { Check, X } from 'lucide-react'
import type { Requirement } from '../core/scenario'

interface Props<R> {
  requirements: Requirement<R>[]
  result: R | null
  cost: number
}

export function RequirementsPanel<R>({ requirements, result, cost }: Props<R>) {
  return (
    <section className="px-4 pt-4">
      <h2 className="font-display text-[15px] font-semibold text-ink">Engineering requirements</h2>
      <p className="mb-2.5 text-xs text-ink/55">Meet all three to pass</p>
      <div className="space-y-2">
        {requirements.map((req) => {
          const s = req.status(result, cost)
          return (
            <div
              key={req.id}
              className={`rounded-xl border px-3 py-2.5 transition-colors ${
                s.pass === null ? 'border-line bg-paper/60' : s.pass ? 'border-leaf/50 bg-mint' : 'border-rust/30 bg-[#fbeee6]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{req.label}</span>
                <span className="font-mono text-xs text-ink/60">{req.target}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className="text-xs text-ink/50">{req.id === 'budget' ? 'Current' : 'Last test'}</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-lg font-semibold text-ink tabular">{s.value ?? '—'}</span>
                  {s.pass === true && (
                    <span className="grid size-5 place-items-center rounded-full bg-forest text-white">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                  {s.pass === false && (
                    <span className="grid size-5 place-items-center rounded-full bg-rust text-white">
                      <X className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
