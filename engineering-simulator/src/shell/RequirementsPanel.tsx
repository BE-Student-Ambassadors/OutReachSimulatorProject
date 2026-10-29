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
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-[15px] font-bold text-[#003c6c]">Design Requirements</h2>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#75787b]">
          3 Criteria
        </span>
      </div>
      <p className="mb-3 text-xs text-[#75787b]">All constraints must pass simultaneously</p>
      <div className="space-y-2">
        {requirements.map((req) => {
          const s = req.status(result, cost)
          const passed = s.pass === true
          const failed = s.pass === false
          const pending = s.pass === null

          return (
            <div
              key={req.id}
              className={`rounded-xl border p-3 transition-colors ${
                pending
                  ? 'border-[#d8e0ea] bg-[#f8fafc]'
                  : passed
                    ? 'border-emerald-300 bg-emerald-50/70'
                    : 'border-red-200 bg-red-50/70'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-sm font-bold text-[#0b1d2e]">{req.label}</span>
                <span className="font-mono text-xs font-medium text-[#75787b]">Target: {req.target}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-[#75787b]">{req.id === 'budget' ? 'Current total' : 'Last simulation'}</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-base font-bold text-[#0b1d2e] tabular">{s.value ?? '—'}</span>
                  {passed && (
                    <span className="grid size-5 place-items-center rounded-full bg-[#003c6c] text-white">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                  {failed && (
                    <span className="grid size-5 place-items-center rounded-full bg-[#dc2626] text-white">
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
