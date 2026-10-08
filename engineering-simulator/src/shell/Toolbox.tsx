import type { ToolDef } from '../core/scenario'

interface Props {
  tools: ToolDef[]
  activeTool: string | null
  disabled: boolean
  onPick(id: string | null): void
}

export function Toolbox({ tools, activeTool, disabled, onPick }: Props) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/5 bg-slate-900/60">
      <h2 className="px-4 pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Engineering Toolbox</h2>
      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        {tools.map((t) => {
          const active = t.id === activeTool
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              title={t.summary}
              onClick={() => onPick(active ? null : t.id)}
              className={`group flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition ${
                active
                  ? 'border-sky-400/70 bg-sky-400/10 shadow-[0_0_0_1px_rgba(56,189,248,0.4)]'
                  : 'border-white/5 bg-slate-800/50 hover:border-white/15 hover:bg-slate-800'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-md"
                style={{ backgroundColor: `${t.accent}22`, color: t.accent }}
              >
                <Icon className="size-5" strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight text-slate-100">{t.label}</span>
                <span className="block text-xs text-slate-400 tabular">{t.priceLabel}</span>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
