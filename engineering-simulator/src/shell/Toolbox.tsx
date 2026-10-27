import type { ToolDef } from '../core/scenario'

interface Props {
  tools: ToolDef[]
  activeTool: string | null
  disabled: boolean
  onPick(id: string | null): void
  /** Program cards (no map placement): on/off state and toggle. */
  isProgramOn?(id: string): boolean
  onToggleProgram?(id: string): void
}

/**
 * Press a tool to arm it, then click the map — or press and drag it straight onto the map.
 * (The World finishes the placement where the pointer is released.)
 */
export function Toolbox({ tools, activeTool, disabled, onPick, isProgramOn, onToggleProgram }: Props) {
  const placeable = tools.filter((t) => t.placement !== 'program')
  const programs = tools.filter((t) => t.placement === 'program')
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[#d8e0ea] bg-white">
      <div className="border-b border-[#f4f6fa] px-4 pb-3 pt-4">
        <h2 className="font-sans text-[15px] font-bold text-[#003c6c]">Components & Tools</h2>
        <p className="text-xs text-[#75787b]">Click to select, drag to place</p>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {placeable.map((t) => {
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
              className={`group flex w-full touch-none items-center gap-2.5 rounded-xl p-2 text-left transition-all ${
                active
                  ? 'bg-[#e0f2fe] ring-2 ring-[#003c6c] shadow-xs'
                  : 'hover:bg-[#f4f6fa] border border-transparent hover:border-[#d8e0ea]'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-lg text-white shadow-xs"
                style={{ backgroundColor: t.accent || '#003c6c' }}
              >
                <Icon className="size-4.5" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold leading-tight text-[#0b1d2e]">{t.label}</span>
                <span className="block font-mono text-[11px] text-[#75787b]">{t.priceLabel}</span>
              </span>
              {active && <span className="size-2 rounded-full bg-[#f29813] shrink-0" />}
            </button>
          )
        })}

        {programs.length > 0 && (
          <div className="pt-3">
            <div className="px-2 pb-1.5 pt-2">
              <h3 className="font-sans text-[12px] font-bold uppercase tracking-wider text-[#003c6c]">Programs & Policies</h3>
              <p className="text-[11px] text-[#75787b]">Toggle operational parameters</p>
            </div>
            <div className="space-y-1">
              {programs.map((t) => {
                const on = isProgramOn?.(t.id) ?? false
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={disabled}
                    title={t.summary}
                    aria-pressed={on}
                    onClick={() => onToggleProgram?.(t.id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition ${
                      on
                        ? 'bg-[#e0f2fe] ring-2 ring-[#003c6c]'
                        : 'border border-[#d8e0ea] bg-white hover:bg-[#f4f6fa]'
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
                        on ? 'bg-[#003c6c] text-white' : 'bg-[#f4f6fa] text-[#75787b]'
                      }`}
                    >
                      <Icon className="size-4" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold leading-tight text-[#0b1d2e]">{t.label}</span>
                      <span className="block font-mono text-[11px] text-[#75787b]">{t.priceLabel}</span>
                    </span>
                    <span
                      className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition ${
                        on ? 'bg-[#003c6c]' : 'bg-[#d0d0ce]'
                      }`}
                    >
                      <span className={`block size-4 rounded-full bg-white shadow-xs transition ${on ? 'translate-x-4' : ''}`} />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
