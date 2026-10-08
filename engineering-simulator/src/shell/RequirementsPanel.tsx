import { Check, X } from 'lucide-react'
import type { Requirement } from '../core/scenario'

interface Props<R> {
  requirements: Requirement<R>[]
  result: R | null
  cost: number
}

export function RequirementsPanel<R>({ requirements, result, cost }: Props<R>) {
  return (
    <section className="p-4">
      <h2 className="pb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Engineering Requirements</h2>
      <div className="space-y-2">
        {requirements.map((req) => {
          const s = req.status(result, cost)
          const tone =
            s.pass === null
              ? 'border-white/5 bg-slate-800/40'
              : s.pass
                ? 'border-emerald-400/30 bg-emerald-400/[0.07]'
                : 'border-rose-400/30 bg-rose-400/[0.07]'
          return (
            <div key={req.id} className={`rounded-lg border px-3 py-2.5 ${tone}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-slate-100">{req.label}</span>
                <span className="text-xs font-semibold text-slate-400 tabular">{req.target}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-slate-400">{req.id === 'budget' ? 'Current' : 'Last test'}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-lg font-bold text-white tabular">{s.value ?? '—'}</span>
                  {s.pass === true && <Check className="size-4 text-emerald-400" strokeWidth={3} />}
                  {s.pass === false && <X className="size-4 text-rose-400" strokeWidth={3} />}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
