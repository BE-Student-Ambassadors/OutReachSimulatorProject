import { Bug, CloudLightning, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useReducer, useState } from 'react'
import { money } from '../core/format'
import { designReducer, initDesignState } from '../core/history'
import type { AnyScenario, DesignObject } from '../core/scenario'
import { RequirementsPanel } from './RequirementsPanel'
import { Toolbox } from './Toolbox'

type Status = 'editing' | 'running'

export function Sandbox({ scenario }: { scenario: AnyScenario }) {
  const [state, dispatch] = useReducer(designReducer<DesignObject>, scenario, (s) => initDesignState(s.initialDesign()))
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [debug, setDebug] = useState(() => new URLSearchParams(location.search).has('debug'))
  const [status] = useState<Status>('editing')
  const [result] = useState<unknown>(null)

  const locked = status === 'running'
  const cost = scenario.cost(state.design)
  const over = cost > scenario.budget
  const World = scenario.World

  const undo = useCallback(() => !locked && dispatch({ type: 'undo' }), [locked])
  const deleteSelected = useCallback(() => {
    if (locked || !state.selectedId) return
    dispatch({ type: 'commit', design: state.design.filter((o) => o.id !== state.selectedId), selectId: null })
  }, [locked, state.design, state.selectedId])
  const reset = () => {
    if (locked) return
    if (state.design.length && !confirm('Reset the campus? This removes everything you placed.')) return
    dispatch({ type: 'reset', design: scenario.initialDesign() })
    setActiveTool(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected()
      } else if (e.key === 'Escape') {
        setActiveTool(null)
        dispatch({ type: 'select', id: null })
      } else if (e.key === 'D' && e.shiftKey) {
        setDebug((d) => !d)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, deleteSelected])

  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/5 bg-slate-900/80 px-4">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-black tracking-[0.2em] text-white">SEQUOIA ENGINEERING LAB</span>
          <span className="text-sm text-slate-400">{scenario.title}</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Project Cost</div>
            <div className={`text-base font-bold tabular ${over ? 'text-rose-400' : 'text-white'}`}>
              {money(cost)} <span className="font-medium text-slate-400">/ {money(scenario.budget)}</span>
              {over && <span className="ml-2 text-xs font-bold text-rose-400">OVER BUDGET ✕</span>}
            </div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              locked ? 'bg-sky-500/15 text-sky-300' : 'bg-emerald-500/15 text-emerald-300'
            }`}
          >
            <span className={`size-2 rounded-full ${locked ? 'animate-pulse bg-sky-400' : 'bg-emerald-400'}`} />
            {locked ? 'Test running' : 'Design mode'}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Toolbox tools={scenario.tools} activeTool={activeTool} disabled={locked} onPick={setActiveTool} />
        <main className="min-w-0 flex-1 p-3">
          <World
            design={state.design}
            activeTool={activeTool}
            selectedId={state.selectedId}
            locked={locked}
            debug={debug}
            onCommit={(design: DesignObject[], selectId?: string | null) => dispatch({ type: 'commit', design, selectId })}
            onSelect={(id: string | null) => dispatch({ type: 'select', id })}
          />
        </main>
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-white/5 bg-slate-900/60">
          <RequirementsPanel requirements={scenario.requirements} result={result} cost={cost} />
        </aside>
      </div>

      {/* Bottom bar */}
      <footer className="flex h-16 shrink-0 items-center gap-2 border-t border-white/5 bg-slate-900/80 px-4">
        <BarButton icon={Undo2} label="Undo" onClick={undo} disabled={locked || state.past.length === 0} />
        <BarButton icon={RotateCcw} label="Reset" onClick={reset} disabled={locked} />
        <BarButton icon={Trash2} label="Delete Selected" onClick={deleteSelected} disabled={locked || !state.selectedId} />
        <BarButton icon={Bug} label="Debug" onClick={() => setDebug((d) => !d)} active={debug} subtle />
        <button
          type="button"
          disabled={locked}
          className="ml-auto flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 px-7 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-blue-900/50 transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CloudLightning className="size-5" strokeWidth={2.5} />
          {scenario.runLabel}
        </button>
      </footer>
    </div>
  )
}

function BarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  subtle,
}: {
  icon: typeof Undo2
  label: string
  onClick(): void
  disabled?: boolean
  active?: boolean
  subtle?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? 'border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200'
          : subtle
            ? 'border-transparent text-slate-500 hover:text-slate-300'
            : 'border-white/10 bg-slate-800/70 text-slate-200 hover:bg-slate-700'
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}
