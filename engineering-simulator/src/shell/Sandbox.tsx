import { Bug, CloudRain, Layers, Lock, RotateCcw, Trash2, Undo2, Volume2, VolumeX, Zap } from 'lucide-react'
import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { money } from '../core/format'
import { designReducer, initDesignState } from '../core/history'
import type { AnyScenario, DesignObject, GroupSync, SimRun } from '../core/scenario'
import { play, toggleMuted, useMuted } from '../shared/audio/sfx'
import { BrandMark } from './BrandMark'
import { RequirementsPanel } from './RequirementsPanel'
import { ResultsModal } from './ResultsModal'
import { Toolbox } from './Toolbox'
import { WorldErrorBoundary } from './WorldErrorBoundary'

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

interface SandboxProps {
  scenario: AnyScenario
  onExit?(): void
  /** Multiplayer: keep this design in sync with the group and play teammates' tests. */
  sync?: GroupSync
  /** Multiplayer: team name, members, timer, shown in the top bar. */
  headerExtra?: ReactNode
  /** Multiplayer: the round isn't running (lobby, time up, ended) — view only. */
  frozen?: boolean
}

export function Sandbox({ scenario, onExit, sync, headerExtra, frozen = false }: SandboxProps) {
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

  const locked = status !== 'editing' || frozen
  const cost = scenario.cost(state.design)
  const over = cost > scenario.budget
  const World = scenario.World
  const Properties = scenario.Properties
  const selected = state.design.find((o) => o.id === state.selectedId) ?? null
  const selectedTool = selected ? scenario.tools.find((t) => t.id === selected.kind) : null

  // Toolbox scenarios get a sound for every placement; station-style scenarios play their own.
  const designLength = useRef(state.design.length)
  useEffect(() => {
    designLength.current = state.design.length
  })
  const commit = useCallback(
    (design: DesignObject[], selectId?: string | null) => {
      if (!scenario.minimalShell) play(design.length > designLength.current ? 'place' : design.length < designLength.current ? 'remove' : 'tick')
      dispatch({ type: 'commit', design, selectId })
      setOverlay(false)
    },
    [scenario],
  )
  const undo = useCallback(() => {
    if (locked || state.past.length === 0) return
    play('undo')
    dispatch({ type: 'undo' })
  }, [locked, state.past.length])
  const deleteSelected = useCallback(() => {
    if (locked || !state.selectedId) return
    commit(scenario.remove(state.design, state.selectedId), null)
  }, [locked, state.design, state.selectedId, scenario, commit])

  const startRun = (variantId: string, design: DesignObject[] = state.design, byTeammate = false) => {
    if (statusRef.current === 'running') return
    if (!byTeammate && (status !== 'editing' || frozen)) return
    const v = scenario.variants.find((x) => x.id === variantId) ?? scenario.variants[0]
    const c = scenario.cost(design)
    setActiveTool(null)
    setOverlay(false)
    dispatch({ type: 'select', id: null })
    setVariant(v)
    pending.current = { variant: v, cost: c, passed, mine: !byTeammate }
    setResultCost(c)
    setResultDesign(design)
    setRun(scenario.createRun(design, v.id))
    play('start')
    setStatus('running')
    statusRef.current = 'running'
    if (sync && !byTeammate) sync.announceRun(v.id, design)
  }

  // Values the end-of-test callback needs, captured when the test starts.
  const pending = useRef({ variant: scenario.variants[0], cost: 0, passed: false, mine: true })
  const statusRef = useRef<Status>('editing')
  useEffect(() => {
    statusRef.current = status
  }, [status])

  // ---- multiplayer sync: apply teammates' edits, push ours, play teammates' tests
  const fromRemote = useRef(false)
  const hydrated = useRef(!sync)
  const appliedRev = useRef(0)
  useEffect(() => {
    if (!sync) return
    return sync.onRemoteDesign((d) => {
      const first = !hydrated.current
      hydrated.current = true
      if (!d || d.rev <= appliedRev.current) return
      appliedRev.current = d.rev
      // Our own writes echo back; only apply other people's (or the first load).
      if (d.updatedBy === sync.me && !first) return
      fromRemote.current = true
      dispatch({ type: 'replace', design: d.design })
    })
  }, [sync])
  useEffect(() => {
    if (!sync || !hydrated.current) return
    if (fromRemote.current) {
      fromRemote.current = false
      return
    }
    sync.push(state.design)
  }, [state.design, sync])
  const startRunRef = useRef(startRun)
  useEffect(() => {
    startRunRef.current = startRun
  })
  useEffect(() => {
    if (!sync) return
    return sync.onTeammateRun((r) => {
      if (statusRef.current === 'running') return
      fromRemote.current = true
      dispatch({ type: 'replace', design: r.design })
      setStatus('editing')
      startRunRef.current(r.variantId, r.design, true)
    })
  }, [sync])

  const finishRun = useCallback(
    (r: unknown) => {
      const { variant: v, cost: c, passed: wasPassed, mine } = pending.current
      const pass = scenario.requirements.every((q) => q.status(r, c).pass)
      if (mine) sync?.reportResult({ variantId: v.id, pass, summary: scenario.summary(r), cost: c })
      play(pass ? 'success' : 'fail')
      setResult(r)
      setLog((l) => [...l, { n: l.length + 1, variant: v.label, pass, summary: scenario.summary(r), cost: c }].slice(-8))
      const firstPass = pass && !wasPassed && v.id === scenario.variants[0].id
      if (firstPass) setPassed(true)
      setJustUnlocked(firstPass ? (scenario.variants.find((x) => x.requiresPass)?.label ?? null) : null)
      setStatus('results')
    },
    [scenario, sync],
  )

  // Step the simulation in real time. React only hears about it when the test ends.
  // Browsers pause animation frames in background tabs, so a 1 s timer keeps the test
  // advancing there too (otherwise a hidden tab would never finish or report its result).
  useEffect(() => {
    if (status !== 'running' || !run) return
    const runSeconds = run.durationSeconds ?? RUN_SECONDS
    const settleMs = runSeconds <= 3.5 ? 120 : 900
    const tps = run.totalTicks / runSeconds
    let acc = 0
    let last = performance.now()
    let raf = 0
    let finishTimer = 0
    let finished = false
    const advance = (now: number, maxDt: number) => {
      acc += Math.min(maxDt, (now - last) / 1000) * tps
      last = now
      while (acc >= 1 && !run.done) {
        run.step()
        acc -= 1
      }
      if (run.done && !finished) {
        finished = true
        finishTimer = window.setTimeout(() => finishRun(run.result()), document.hidden ? 0 : settleMs)
      }
    }
    const frame = (now: number) => {
      advance(now, 0.1)
      if (!run.done) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    const background = window.setInterval(() => {
      if (document.hidden && !run.done) advance(performance.now(), 1.5)
    }, 1000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(background)
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
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return
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
            if (sync ? !confirm('Leave this game? You can rejoin with the same code.') : state.design.length && !confirm('Leave this challenge? Your design will be cleared.')) return
            onExit?.()
          }}
          className="flex items-center gap-2.5 text-left"
          title="Back to challenges"
        >
          <BrandMark />
          <span className="leading-none">
            <span className="block font-display text-[17px] font-bold tracking-tight text-forest">BESA Engineering Lab</span>
            <span className="block pt-0.5 text-xs text-ink/55">
              {scenario.title} · {scenario.discipline}
            </span>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-5">
          {headerExtra}
          {!scenario.minimalShell && (
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
          )}
          <SoundToggle />
          <StatusPill status={status} variantLabel={variant.label} run={run} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {!scenario.minimalShell && (
          <Toolbox
            tools={scenario.tools}
            activeTool={activeTool}
            disabled={locked}
            onPick={(id) => {
              if (id) play('select')
              setActiveTool(id)
            }}
            isProgramOn={(id) => scenario.programs?.isOn(state.design, id) ?? false}
            onToggleProgram={(id) => scenario.programs && !locked && commit(scenario.programs.toggle(state.design, id), null)}
          />
        )}

        <main className={`relative min-w-0 flex-1 ${scenario.minimalShell ? 'p-0' : 'p-3'}`}>
          <WorldErrorBoundary>
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
              sync={sync}
              onStartRun={(vid: string) => startRun(vid)}
            />
          </WorldErrorBoundary>
          {overlay && !!result && scenario.overlayLegend && (
            <div className="pointer-events-none absolute left-6 top-6 rounded-xl bg-white/95 px-3 py-2 shadow ring-1 ring-black/10">
              <div className="font-display text-sm font-semibold">{scenario.overlayLegend.title}</div>
              <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-ink/70">
                <span className="h-2.5 w-28 rounded-full" style={{ background: `linear-gradient(to right, ${scenario.overlayLegend.colors.join(', ')})` }} />
                {scenario.overlayLegend.range}
              </div>
            </div>
          )}
        </main>

        {!scenario.minimalShell && (
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
        )}
      </div>

      {/* Bottom bar */}
      {!scenario.minimalShell && (
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
                title={passed ? advanced.blurb : `Pass the ${scenario.variants[0].label.toLowerCase()} first`}
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
      )}

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
                  play('remove')
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

function SoundToggle() {
  const muted = useMuted()
  return (
    <button
      type="button"
      onClick={() => {
        toggleMuted()
        play('click')
      }}
      title={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      className={`grid size-9 place-items-center rounded-full ring-1 transition ${muted ? 'text-ink/40 ring-line hover:text-ink' : 'bg-mint text-forest ring-forest/20 hover:bg-white'}`}
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  )
}

function StatusPill({ status, variantLabel, run }: { status: Status; variantLabel: string; run: SimRun<unknown> | null }) {
  const bar = useRef<HTMLDivElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (status !== 'running' || !run) return
    let raf = 0
    const tick = () => {
      if (bar.current) bar.current.style.width = `${run.progress * 100}%`
      if (clock.current && run.clockLabel) clock.current.textContent = run.clockLabel()
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
          <span ref={clock} className="ml-auto font-mono text-ink/70" />
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
