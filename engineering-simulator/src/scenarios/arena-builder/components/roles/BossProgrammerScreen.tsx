import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  HelpCircle,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { gameAudio } from '../../audio/gameAudio'
import { BOSS_ATTACK_SPECS } from '../../data/bossCatalog'
import {
  BOSS_GRAPH_SCENARIOS,
  simulateBossGraphScenario,
  validateBossGraph,
  type BossGraphValidationResult,
  type ScenarioRunResult,
} from '../../simulation/bossGraphPuzzle'
import type {
  BossAttackType,
  BossBehavior,
  BossConfig,
  BossGraphEdge,
} from '../../types/project'

interface BossProgrammerScreenProps {
  boss: BossConfig
  onUpdateBoss(boss: BossConfig): void
  onResetBoss(): void
  onMarkComplete(): void
  isComplete: boolean
  onNextRole(): void
}

const DEFAULT_GRAPH_EDGES: BossGraphEdge[] = [
  { id: 'e1', from: 'CHASE', to: 'TELEGRAPH_SLAM', condition: 'Target In Range <= 80', enabled: true },
  { id: 'e2', from: 'CHASE', to: 'TELEGRAPH_BEAM', condition: 'Target In Range <= 250', enabled: true },
  { id: 'e3', from: 'TELEGRAPH_SLAM', to: 'ATTACK', condition: 'Target Angle <= 45', enabled: true },
  { id: 'e4', from: 'TELEGRAPH_BEAM', to: 'ATTACK', condition: 'Timer Expired', enabled: true },
  { id: 'e5', from: 'ATTACK', to: 'RECOVER', condition: 'Always', enabled: true },
  { id: 'e6', from: 'RECOVER', to: 'CHASE', condition: 'Always', enabled: true },
  { id: 'e7', from: 'RECOVER', to: 'RETREAT_SHIELD', condition: 'Health < 30%', enabled: false },
]

export function BossProgrammerScreen({
  boss,
  onUpdateBoss,
  onResetBoss,
  onMarkComplete,
  isComplete,
  onNextRole,
}: BossProgrammerScreenProps) {
  const [activeTab, setActiveTab] = useState<'puzzle' | 'creative'>('puzzle')

  const edges: BossGraphEdge[] = boss.behavior.graphEdges && boss.behavior.graphEdges.length > 0
    ? boss.behavior.graphEdges
    : DEFAULT_GRAPH_EDGES

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('s1_frontal')
  const [activeScenarioResult, setActiveScenarioResult] = useState<ScenarioRunResult | null>(null)
  const [isRunningScenario, setIsRunningScenario] = useState(false)
  const [validationResult, setValidationResult] = useState<BossGraphValidationResult | null>(() => {
    return isComplete ? validateBossGraph(edges) : null
  })

  const [showHints, setShowHints] = useState(false)
  const [activeHintIndex, setActiveHintIndex] = useState(0)

  const hints = [
    'Run Scenario 1 and Scenario 2. Notice that the boss passes Scenario 1, but freezes in telegraph when the player dodges behind in Scenario 2. Inspect the exit conditions from TELEGRAPH_SLAM.',
    'In Scenario 3, the boss commits to TELEGRAPH_BEAM despite solid stone blocking line-of-sight. Change the beam condition to require "Target In Range <= 250 AND LineOfSight == true".',
    'In Scenario 4, the boss never activates Retreat Shield when critically low on health. Enable the edge from RECOVER -> RETREAT_SHIELD on condition "Health < 30%".',
  ]

  const updateEdge = (edgeId: string, updates: Partial<BossGraphEdge>) => {
    const nextEdges = edges.map((e) => (e.id === edgeId ? { ...e, ...updates } : e))
    onUpdateBoss({
      ...boss,
      behavior: {
        ...boss.behavior,
        graphEdges: nextEdges,
      },
    })
  }

  const runScenario = (scenarioId: string) => {
    const scen = BOSS_GRAPH_SCENARIOS.find((s) => s.id === scenarioId)!
    setIsRunningScenario(true)
    gameAudio.play('boss_windup')

    setTimeout(() => {
      const res = simulateBossGraphScenario(scen, edges)
      setActiveScenarioResult(res)
      setIsRunningScenario(false)
      if (res.success) {
        gameAudio.play('hit_boss')
      } else {
        gameAudio.play('hit_player')
      }
    }, 400)
  }

  const handleValidateGraph = () => {
    const res = validateBossGraph(edges)
    setValidationResult(res)

    onUpdateBoss({
      ...boss,
      behavior: {
        ...boss.behavior,
        graphEdges: edges,
        behaviorGraphValidated: res.solved,
        bugResolved: res.solved,
      },
    })

    if (res.solved) {
      gameAudio.play('victory')
      if (!isComplete) {
        onMarkComplete()
      }
    } else {
      gameAudio.play('hit_player')
    }
  }

  const updateStat = <K extends keyof BossBehavior>(key: K, val: BossBehavior[K]) => {
    onUpdateBoss({
      ...boss,
      behavior: {
        ...boss.behavior,
        [key]: val,
      },
    })
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-y-auto p-6 text-[#0b1d2e]">
      {/* Role Header Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-50/70 via-white to-slate-50 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-bold text-indigo-800">
            <Sparkles className="size-3 text-indigo-600" />
            Role 2: Gameplay Programmer
          </div>
          <h1 className="mt-1 font-sans text-2xl font-black text-[#003c6c]">The Broken Boss</h1>
          <p className="mt-1 text-sm text-[#5a6a85]">
            The boss AI behaves correctly in simple situations, but breaks down during real combat.
            Inspect decision transitions, repair logic edges across multiple scenarios, and pass an unseen regression test!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetBoss}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Reset Puzzle
          </button>

          <button
            type="button"
            onClick={onMarkComplete}
            disabled={!validationResult?.solved && !boss.behavior.behaviorGraphValidated}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer ${
              validationResult?.solved || boss.behavior.behaviorGraphValidated
                ? isComplete
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-[#003c6c] text-white hover:bg-[#002b4d]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="size-4" />
            <span>{isComplete ? 'Boss Graph Verified ✓' : 'Validate & Mark Complete'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('puzzle')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'puzzle'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <GitBranch className="size-3.5" />
          <span>1. Behavior Graph Debugger (Challenge)</span>
          {(validationResult?.solved || boss.behavior.behaviorGraphValidated) && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
              Verified ✓
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('creative')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'creative'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <Sliders className="size-3.5" />
          <span>2. Creative Boss Studio (Stats & Attacks)</span>
        </button>
      </div>

      {/* Hints Banner */}
      {showHints && (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
            <span>HINT {activeHintIndex + 1} OF 3</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveHintIndex(idx)}
                  className={`h-2 w-6 rounded-full transition-colors ${
                    activeHintIndex === idx ? 'bg-amber-400' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="mt-2 text-sm text-amber-200/90">{hints[activeHintIndex]}</p>
        </div>
      )}

      {/* View 1: Behavior Graph Puzzle */}
      {activeTab === 'puzzle' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Interactive Graph Edge & Condition Editor */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    Behavior Graph State Transitions
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Configure condition triggers and enabled edges between AI behavior states.
                  </p>
                </div>
                <button
                  onClick={() => setShowHints(!showHints)}
                  className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-amber-400" />
                  Hints
                </button>
              </div>

              {/* Edge List */}
              <div className="mt-4 space-y-3">
                {edges.map((edge) => (
                  <div
                    key={edge.id}
                    className={`rounded-lg border p-3.5 transition-all ${
                      edge.enabled
                        ? 'border-indigo-500/40 bg-slate-950 text-slate-200'
                        : 'border-slate-800 bg-slate-950/50 text-slate-500 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-indigo-900/60 px-2 py-0.5 font-mono text-xs font-bold text-indigo-300">
                          {edge.from}
                        </span>
                        <span className="text-xs text-slate-500">➔</span>
                        <span className="rounded bg-indigo-900/60 px-2 py-0.5 font-mono text-xs font-bold text-indigo-300">
                          {edge.to}
                        </span>
                      </div>

                      <label className="flex items-center gap-2 text-xs">
                        <span>Enabled</span>
                        <input
                          type="checkbox"
                          checked={edge.enabled}
                          onChange={(e) => updateEdge(edge.id, { enabled: e.target.checked })}
                          className="h-4 w-4 accent-indigo-500"
                        />
                      </label>
                    </div>

                    {/* Condition Selector */}
                    <div className="mt-2.5 flex items-center gap-2 text-xs">
                      <span className="text-slate-400">Condition:</span>
                      {edge.id === 'e2' ? (
                        <select
                          value={edge.condition}
                          onChange={(e) => updateEdge(edge.id, { condition: e.target.value })}
                          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-indigo-200"
                        >
                          <option value="Target In Range <= 250">Target In Range &lt;= 250 (Ignores Walls!)</option>
                          <option value="Target In Range <= 250 AND LineOfSight == true">
                            Target In Range &lt;= 250 AND LineOfSight == true (Correct)
                          </option>
                        </select>
                      ) : edge.id === 'e3' ? (
                        <select
                          value={edge.condition}
                          onChange={(e) => updateEdge(edge.id, { condition: e.target.value })}
                          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-indigo-200"
                        >
                          <option value="Target Angle <= 45">Target Angle &lt;= 45 (Stalls if player rolls behind!)</option>
                          <option value="Timer Expired">Timer Expired (Fallback even if player rolls behind)</option>
                        </select>
                      ) : edge.id === 'e7' ? (
                        <span className="font-mono text-amber-300">Health &lt; 30% (Phase 2 Enrage)</span>
                      ) : (
                        <span className="font-mono text-slate-400">{edge.condition}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Validation Button */}
              <button
                onClick={handleValidateGraph}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-indigo-500 hover:to-blue-500"
              >
                <GitBranch className="h-4 w-4" />
                Run Full Suite & Regression Verification
              </button>
            </div>
          </div>

          {/* Right: Scenario Test Harness & Results */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-md">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Scenario Test Harness
              </span>

              {/* Scenario Selector Pills */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {BOSS_GRAPH_SCENARIOS.filter((s) => s.id !== 's5_regression').map((scen) => {
                  const isSelected = selectedScenarioId === scen.id
                  return (
                    <button
                      key={scen.id}
                      onClick={() => {
                        setSelectedScenarioId(scen.id)
                        setActiveScenarioResult(null)
                      }}
                      className={`rounded-lg border p-2.5 text-left text-xs transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200 shadow'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-semibold text-slate-200">{scen.name.split(':')[0]}</div>
                      <div className="truncate text-[10px] text-slate-400">{scen.name.split(':')[1]}</div>
                    </button>
                  )
                })}
              </div>

              {/* Selected Scenario Details & Run Button */}
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3.5">
                {(() => {
                  const currentScen = BOSS_GRAPH_SCENARIOS.find((s) => s.id === selectedScenarioId)!
                  return (
                    <div>
                      <div className="text-xs font-bold text-slate-200">{currentScen.name}</div>
                      <p className="mt-1 text-xs text-slate-400">{currentScen.description}</p>
                      <button
                        onClick={() => runScenario(selectedScenarioId)}
                        disabled={isRunningScenario}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
                      >
                        <Play className="h-3.5 w-3.5" />
                        {isRunningScenario ? 'Running Simulation...' : 'Run Scenario Simulation'}
                      </button>
                    </div>
                  )
                })()}
              </div>

              {/* Execution Step Log */}
              <div className="mt-4">
                <span className="text-xs font-semibold text-slate-400">Execution Timeline & Step Telemetry</span>
                <div className="mt-1.5 h-36 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-xs text-slate-300">
                  {activeScenarioResult ? (
                    <div>
                      <div
                        className={`mb-2 font-bold ${
                          activeScenarioResult.success ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        STATUS: {activeScenarioResult.success ? 'PASSED ✓' : 'FAILED ✗'}
                        {activeScenarioResult.failureReason && ` — ${activeScenarioResult.failureReason}`}
                      </div>
                      {activeScenarioResult.executionTimeline.map((step, idx) => (
                        <div key={idx} className="py-0.5 text-[11px] text-slate-400">
                          [{step.time}s] State: <span className="text-indigo-300 font-semibold">{step.state}</span> — {step.note}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-500">
                      Select a scenario and click &quot;Run Scenario Simulation&quot; to inspect state transitions.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Validation Feedback */}
            {validationResult && (
              <div
                className={`rounded-xl border p-4 shadow-lg ${
                  validationResult.solved
                    ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-200'
                    : 'border-rose-500/50 bg-rose-950/20 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {validationResult.solved ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-400" />
                  )}
                  <span className="font-bold text-sm">
                    {validationResult.solved ? 'GRAPH VERIFIED & REGRESSION PASSED' : 'VERIFICATION FAILED'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                  <div
                    className={`rounded p-1.5 ${
                      validationResult.visibleScenariosPassed ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'
                    }`}
                  >
                    4 Scenarios: {validationResult.visibleScenariosPassed ? '4/4 PASS' : 'FAIL'}
                  </div>
                  <div
                    className={`rounded p-1.5 ${
                      validationResult.regressionPassed ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'
                    }`}
                  >
                    Regression Test: {validationResult.regressionPassed ? 'PASS' : 'FAIL'}
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed">{validationResult.feedback}</p>
              </div>
            )}

            {/* Engineering Takeaway */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
              <span className="font-bold text-slate-300">Engineering Takeaway: </span>
              State machines fail when missing fallback exits (e.g. timeout on roll-behind), ignoring environmental
              line-of-sight checks, or having priority inversions on phase changes. True debugging requires multi-scenario
              regression testing.
            </div>
          </div>
        </div>
      )}

      {/* View 2: Creative Boss Studio */}
      {activeTab === 'creative' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#003c6c]">Boss Health</span>
                <span className="font-mono text-base font-bold text-[#003c6c]">{boss.maxHealth} HP</span>
              </div>
              <input
                type="range"
                min={150}
                max={400}
                step={10}
                value={boss.maxHealth}
                onChange={(e) => onUpdateBoss({ ...boss, maxHealth: Number(e.target.value) })}
                className="mt-4 w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#003c6c]">Attack Damage</span>
                <span className="font-mono text-base font-bold text-[#003c6c]">{boss.attackDamage} dmg</span>
              </div>
              <input
                type="range"
                min={15}
                max={45}
                step={1}
                value={boss.attackDamage}
                onChange={(e) => onUpdateBoss({ ...boss, attackDamage: Number(e.target.value) })}
                className="mt-4 w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#003c6c]">Chase Movement Speed</span>
                <span className="font-mono text-base font-bold text-[#003c6c]">{boss.behavior.chaseSpeed} px/s</span>
              </div>
              <input
                type="range"
                min={60}
                max={180}
                step={5}
                value={boss.behavior.chaseSpeed}
                onChange={(e) => updateStat('chaseSpeed', Number(e.target.value))}
                className="mt-4 w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#003c6c]">Recovery Duration (Vulnerability)</span>
                <span className="font-mono text-base font-bold text-[#003c6c]">{boss.behavior.recoveryDuration}s</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={2.0}
                step={0.1}
                value={boss.behavior.recoveryDuration}
                onChange={(e) => updateStat('recoveryDuration', Number(e.target.value))}
                className="mt-4 w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Attack Types */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="font-sans text-base font-bold text-[#003c6c]">Boss Attack Style</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {(['heavy_cleave', 'slam_shockwave', 'fireball_spray'] as BossAttackType[]).map((atkKey) => {
                const spec = BOSS_ATTACK_SPECS[atkKey]
                const isSelected = boss.behavior.attackType === atkKey
                return (
                  <button
                    key={atkKey}
                    type="button"
                    onClick={() => updateStat('attackType', atkKey)}
                    className={`flex flex-col rounded-xl border p-4 text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-[#003c6c] bg-[#003c6c]/5 shadow-xs ring-2 ring-[#003c6c]'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-[#003c6c]">{spec.name}</span>
                    <p className="mt-1 text-xs text-[#5a6a85]">{spec.description}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation Bar */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-4">
        <div className="text-xs text-[#5a6a85]">
          {isComplete ? (
            <span className="font-bold text-emerald-700">✓ Role 2: Gameplay Programmer Complete</span>
          ) : (
            <span>Repair the behavior graph to pass all scenarios.</span>
          )}
        </div>

        <button
          type="button"
          onClick={onNextRole}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003c6c] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#002b4d] cursor-pointer"
        >
          <span>Next: Level Designer</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
