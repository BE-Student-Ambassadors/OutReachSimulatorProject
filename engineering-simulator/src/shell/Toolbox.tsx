import type { ToolDef } from '../core/scenario'

interface Props {
  tools: ToolDef[]
  activeTool: string | null
  disabled: boolean
  onPick(id: string | null): void
}

/**
 * Press a tool to arm it, then click the map — or press and drag it straight onto the map.
 * (The World finishes the placement where the pointer is released.)
 */
export function Toolbox({ tools, activeTool, disabled, onPick }: Props) {
  return (
    <aside className="flex w-54.5 shrink-0 flex-col border-r border-line bg-white">
      <div className="px-4 pb-2 pt-4">
        <h2 className="font-display text-[15px] font-semibold text-ink">Toolbox</h2>
        <p className="text-xs text-ink/55">Drag onto the campus</p>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-2.5 pb-3">
        {tools.map((t) => {
          const active = t.id === activeTool
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              title={t.summary}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                onPick(active ? null : t.id)
              }}
              className={`group flex w-full touch-none items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition ${
                active ? 'bg-mint ring-2 ring-forest' : 'hover:bg-paper'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg text-white shadow-sm"
                style={{ backgroundColor: t.accent }}
              >
                <Icon className="size-4.5" strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold leading-tight text-ink">{t.label}</span>
                <span className="block font-mono text-[11px] text-ink/55">{t.priceLabel}</span>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
