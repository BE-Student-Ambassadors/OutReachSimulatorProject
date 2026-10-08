import { Bug, CloudRain, Layers, Lock, RotateCcw, Trash2, Undo2, Zap } from 'lucide-react'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { money } from '../core/format'
import { designReducer, initDesignState } from '../core/history'
import type { AnyScenario, DesignObject, SimRun } from '../core/scenario'
import { RequirementsPanel } from './RequirementsPanel'
import { ResultsModal } from './ResultsModal'
import { Toolbox } from './Toolbox'

type Status = 'editing' | 'running' | 'results'

/** How long a test plays on screen, in seconds. */
const RUN_SECONDS = 18

interface LogEntry {
  n: number
  variant: string
  pass: boolean
  summary: string
  cost: number
}

export function Sandbox({ scenario, onExit }: { scenario: AnyScenario; onExit?(): void }) {
  const [state, dispatch] = useReducer(designReducer<DesignObject>, scenario, (s) => initDesignState(s.initialDesign()))
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [debug, setDebug] = useState(() => new URLSearchParams(location.search).has('debug'))
  const [status, setStatus] = useState<Status>('editing')
  const [run, setRun] = useState<SimRun<unknown> | null>(null)
  const [variant, setVariant] = useState(scenario.variants[0])
  const [result, setResult] = useState<unknown>(null)
  const [resultCost, setResultCost] = useState(0)
  const [resultDesign, setResultDesign] = useState<DesignObject[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [passed, setPassed] = useState(false)
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null)
  const [overlay, setOverlay] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const locked = status !== 'editing'
  const cost = scenario.cost(state.design)
  const over = cost > scenario.budget
  const World = scenario.World
  const Properties = scenario.Properties
  const selected = state.design.find((o) => o.id === state.selectedId) ?? null
  const selectedTool = selected ? scenario.tools.find((t) => t.id === selected.kind) : null

  const commit = useCallback((design: DesignObject[], selectId?: string | null) => {
    dispatch({ type: 'commit', design, selectId })
    setOverlay(false)
  }, [])
  const undo = useCallback(() => !locked && dispatch({ type: 'undo' }), [locked])
  const deleteSelected = useCallback(() => {
    if (locked || !state.selectedId) return
    commit(scenario.remove(state.design, state.selectedId), null)
  }, [locked, state.design, state.selectedId, scenario, commit])

  const startRun = (variantId: string) => {
    if (status !== 'editing') return
    const v = scenario.variants.find((x) => x.id === variantId) ?? scenario.variants[0]
    setActiveTool(null)
    setOverlay(false)
    dispatch({ type: 'select', id: null })
    setVariant(v)
    pending.current = { variant: v, cost, passed }
    setResultCost(cost)
    setResultDesign(state.design)
    setRun(scenario.createRun(state.design, v.id))
    setStatus('running')
  }

  // Values the end-of-test callback needs, captured when the test starts.
  const pending = useRef({ variant: scenario.variants[0], cost: 0, passed: false })

  const finishRun = useCallback(
    (r: unknown) => {
      const { variant: v, cost: c, passed: wasPassed } = pending.current
      const pass = scenario.requirements.every((q) => q.status(r, c).pass)
      setResult(r)
      setLog((l) => [...l, { n: l.length + 1, variant: v.label, pass, summary: scenario.summary(r), cost: c }].slice(-8))
      const firstPass = pass && !wasPassed && v.id === scenario.variants[0].id
      if (firstPass) setPassed(true)
      setJustUnlocked(firstPass ? (scenario.variants.find((x) => x.requiresPass)?.label ?? null) : null)
      setStatus('results')
    },
    [scenario],
  )

  // Step the simulation in real time. React only hears about it when the test ends.
  useEffect(() => {
    if (status !== 'running' || !run) return
    const tps = run.totalTicks / RUN_SECONDS
    let acc = 0
    let last = performance.now()
    let raf = 0
    let finishTimer = 0
    const frame = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000) * tps
      last = now
      while (acc >= 1 && !run.done) {
        run.step()
        acc -= 1
      }
      if (!run.done) raf = requestAnimationFrame(frame)
      else finishTimer = window.setTimeout(() => finishRun(run.result()), 900)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(finishTimer)
    }
  }, [status, run, finishRun])

  const closeResults = (showOverlay = false) => {
    setStatus('editing')
    setRun(null)
    setOverlay(showOverlay)
  }

  // Dev-only hook so browser automation can load a reference design.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __setDesign?: (d: DesignObject[]) => void }
    w.__setDesign = (d) => dispatch({ type: 'commit', design: d, selectId: null })
  }, [])

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
        setConfirmReset(false)
        dispatch({ type: 'select', id: null })
      } else if (e.key === 'D' && e.shiftKey) {
        setDebug((d) => !d)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, deleteSelected])

  const advanced = scenario.variants.find((v) => v.requiresPass)
  const budgetPct = Math.min(100, (cost / scenario.budget) * 100)
  const showResults = status === 'results' && result !== null && run

  return (
    <div className="relative flex h-full flex-col bg-paper">
      {/* Top bar */}
      <header className="flex h-[60px] shrink-0 items-center gap-5 border-b border-line bg-white px-5">
        <button
          type="button"
          onClick={() => {
            if (locked) return
            if (state.design.length && !confirm('Leave this challenge? Your design will be cleared.')) return
            onExit?.()
          }}
          className="flex items-center gap-2.5 text-left"
          title="Back to challenges"
        >
          <SequoiaMark />
          <span className="leading-none">
            <span className="block font-display text-[17px] font-bold tracking-tight text-forest">Sequoia Engineering Lab</span>
            <span className="block pt-0.5 text-xs text-ink/55">
              {scenario.title} · {scenario.discipline}
            </span>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-5">
          <div className="w-64">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-ink/60">Project cost</span>
              <span className={`font-mono text-sm font-semibold tabular ${over ? 'text-rust' : 'text-ink'}`}>
                {money(cost)} <span className="font-normal text-ink/45">/ {money(scenario.budget)}</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper ring-1 ring-line">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${over ? 'bg-rust' : budgetPct > 85 ? 'bg-sun' : 'bg-leaf'}`}
                style={{ width: `${over ? 100 : budgetPct}%` }}
              />
            </div>
            {over && <div className="mt-0.5 text-right text-[11px] font-bold uppercase tracking-wide text-rust">Over budget ✕</div>}
          </div>
          <StatusPill status={status} variantLabel={variant.label} run={run} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Toolbox tools={scenario.tools} activeTool={activeTool} disabled={locked} onPick={setActiveTool} />

        <main className="relative min-w-0 flex-1 p-3">
          <World
            design={state.design}
            activeTool={activeTool}
            selectedId={state.selectedId}
            locked={locked}
            debug={debug}
            run={run}
            lastResult={result}
            showOverlay={overlay}
            onCommit={commit}
            onSelect={(id: string | null) => dispatch({ type: 'select', id })}
            onToolDone={() => setActiveTool(null)}
          />
          {overlay && !!result && (
            <div className="pointer-events-none absolute left-6 top-6 rounded-xl bg-white/95 px-3 py-2 shadow ring-1 ring-black/10">
              <div className="font-display text-sm font-semibold">Deepest water, last test</div>
              <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-ink/70">
                <span className="h-2.5 w-28 rounded-full bg-gradient-to-r from-[#fde68a] via-[#fb923c] to-[#7f1d1d]" />
                ¼″ → 5″+
              </div>
            </div>
          )}
        </main>

        <aside className="flex w-[288px] shrink-0 flex-col overflow-y-auto border-l border-line bg-white">
          <RequirementsPanel requirements={scenario.requirements} result={result} cost={cost} />

          <section className="px-4 pt-5">
            <h2 className="font-display text-[15px] font-semibold text-ink">Selected</h2>
            {selected && selectedTool ? (
              <div className="mt-2 rounded-xl border border-line p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg text-white" style={{ backgroundColor: selectedTool.accent }}>
                    <selectedTool.icon className="size-4" />
                  </span>
                  <span className="font-display text-[15px] font-semibold">{selectedTool.label}</span>
                </div>
                <p className="mb-1 text-xs text-ink/60">{selectedTool.summary}</p>
                <Properties
                  object={selected}
                  design={state.design}
                  locked={locked}
                  onChange={(next: DesignObject) => commit(state.design.map((o) => (o.id === next.id ? next : o)), next.id)}
                />
                <button
                  type="button"
                  disabled={locked}
                  onClick={deleteSelected}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-rust ring-1 ring-rust/30 transition hover:bg-[#fbeee6] disabled:opacity-40"
                >
                  <Trash2 className="size-4" /> Remove
                </button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-ink/50">Click something you placed to inspect or change it.</p>
            )}
          </section>

          {log.length > 0 && (
            <section className="px-4 pb-4 pt-5">
              <h2 className="font-display text-[15px] font-semibold text-ink">Test log</h2>
              <ol className="mt-2 space-y-1">
                {[...log].reverse().map((e) => (
                  <li key={e.n} className="flex items-center gap-2 rounded-lg bg-paper px-2.5 py-1.5 font-mono text-[11.5px]">
                    <span className="text-ink/45">#{e.n}</span>
                    <span className={`size-2 rounded-full ${e.pass ? 'bg-forest' : 'bg-rust'}`} />
                    <span className="flex-1 truncate">{e.summary}</span>
                    <span className="text-ink/60">{money(e.cost / 1000)}k</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>

      {/* Bottom bar */}
      <footer className="flex h-[68px] shrink-0 items-center gap-2 border-t border-line bg-white px-5">
        <BarButton icon={Undo2} label="Undo" onClick={undo} disabled={locked || state.past.length === 0} />
        <BarButton icon={RotateCcw} label="Reset" onClick={() => !locked && state.design.length && setConfirmReset(true)} disabled={locked || !state.design.length} />
        <BarButton icon={Trash2} label="Delete selected" onClick={deleteSelected} disabled={locked || !state.selectedId} />
        {scenario.overlayLabel && (
          <BarButton icon={Layers} label={scenario.overlayLabel} onClick={() => setOverlay((o) => !o)} disabled={locked || !result} active={overlay} />
        )}
        <button
          type="button"
          onClick={() => setDebug((d) => !d)}
          title="Debug view (Shift+D)"
          className={`grid size-9 place-items-center rounded-lg transition ${debug ? 'bg-[#f3e8f7] text-[#86198f]' : 'text-ink/25 hover:text-ink/50'}`}
        >
          <Bug className="size-4" />
        </button>

        <div className="ml-auto flex items-center gap-3">
          {advanced && (
            <button
              type="button"
              disabled={locked || !passed}
              onClick={() => startRun(advanced.id)}
              title={passed ? advanced.blurb : 'Pass the storm test first'}
              style={{ ['--edge' as string]: '#a77c17' }}
              className="btn-press flex items-center gap-2 rounded-xl bg-sun px-4 py-2.5 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink/35 disabled:shadow-none"
            >
              {passed ? <Zap className="size-4" /> : <Lock className="size-4" />}
              {advanced.label}
              {passed && <span className="font-mono text-[11px] font-medium opacity-70">{advanced.blurb}</span>}
            </button>
          )}
          <button
            type="button"
            disabled={locked}
            onClick={() => startRun(scenario.variants[0].id)}
            className="btn-press flex items-center gap-2.5 rounded-xl bg-forest px-7 py-3 font-display text-[15px] font-bold uppercase tracking-wide text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CloudRain className="size-5" strokeWidth={2.4} />
            {scenario.runLabel}
          </button>
        </div>
      </footer>

      {showResults && (
        <ResultsModal
          scenario={scenario}
          result={result}
          cost={resultCost}
          variantLabel={variant.label}
          stats={scenario.stats(result, resultDesign)}
          observations={scenario.observations(result)}
          justUnlocked={justUnlocked}
          canShowOverlay={!!scenario.overlayLabel}
          onClose={() => closeResults(false)}
          onShowOverlay={() => closeResults(true)}
        />
      )}

      {confirmReset && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-ink/30 p-6">
          <div className="w-full max-w-sm animate-pop rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="font-display text-xl font-bold">Reset the campus?</h2>
            <p className="mt-1 text-sm text-ink/70">This removes everything you have placed. Your test log stays.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-line hover:bg-paper" onClick={() => setConfirmReset(false)}>
                Keep design
              </button>
              <button
                type="button"
                autoFocus
                style={{ ['--edge' as string]: '#7d2e10' }}
                className="btn-press rounded-xl bg-rust px-4 py-2 text-sm font-bold text-white"
                onClick={() => {
                  dispatch({ type: 'reset', design: scenario.initialDesign() })
                  setActiveTool(null)
                  setOverlay(false)
                  setConfirmReset(false)
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ status, variantLabel, run }: { status: Status; variantLabel: string; run: SimRun<unknown> | null }) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (status !== 'running' || !run) return
    let raf = 0
    const tick = () => {
      if (bar.current) bar.current.style.width = `${run.progress * 100}%`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status, run])

  if (status === 'running')
    return (
      <div className="w-44">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-forest">
          <span className="size-2 animate-pulse rounded-full bg-forest" /> {variantLabel} running
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-mint">
          <div ref={bar} className="h-full rounded-full bg-forest" style={{ width: 0 }} />
        </div>
      </div>
    )
  return (
    <span className="flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-forest">
      <span className="size-2 rounded-full bg-leaf" />
      {status === 'results' ? 'Reviewing results' : 'Design mode'}
    </span>
  )
}

function BarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: typeof Undo2
  label: string
  onClick(): void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? 'bg-forest text-white' : 'text-ink ring-1 ring-line hover:bg-paper'
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

/** Simple stacked-tier sequoia mark. */
export function SequoiaMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#2c5b3c" />
      <path d="M20 6 L27 16 H23.5 L29 24 H24.5 L30 31 H10 L15.5 24 H11 L16.5 16 H13 Z" fill="#f4f3ec" />
      <rect x="18.3" y="30" width="3.4" height="5" rx="1" fill="#f4f3ec" />
    </svg>
  )
}
