import {
  AlertTriangle,
  ArrowRight,
  Bug,
  CheckCircle2,
  Cpu,
  FlaskConical,
  HelpCircle,
  RotateCcw,
  Scale,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { gameAudio } from '../../audio/gameAudio'
import { computeBalanceTelemetry } from '../../simulation/balanceMath'
import {
  runQaExperiment,
  runQaRegressionSuite,
  type ExperimentParams,
  type RegressionTestItem,
} from '../../simulation/qaInvestigationPuzzle'
import type {
  BalanceSettings,
  BossConfig,
  HeroConfig,
  PlaytestResult,
  QaExperimentRun,
  QaSettings,
} from '../../types/project'

interface BalanceDashboardScreenProps {
  hero: HeroConfig
  boss: BossConfig
  balance: BalanceSettings
  qa: QaSettings
  onUpdateBalance(balance: BalanceSettings): void
  onUpdateQa(qa: QaSettings): void
  onResetBalance(): void
  playtestHistory: PlaytestResult[]
  onOpenPlaytest(): void
  onMarkComplete(): void
  isComplete: boolean
  onNextRole(): void
}

export function BalanceDashboardScreen({
  hero,
  boss,
  qa,
  onUpdateQa,
  onResetBalance,
  onMarkComplete,
  isComplete,
  onNextRole,
}: BalanceDashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<'puzzle' | 'creative'>('puzzle')

  // Experiment parameters for the test chamber
  const [heroAction, setHeroAction] = useState<ExperimentParams['heroAction']>('shield')
  const [bossAction, setBossAction] = useState<ExperimentParams['bossAction']>('ground_slam')
  const [environment, setEnvironment] = useState<ExperimentParams['environment']>('near_wall')

  const [isRunningExperiment, setIsRunningExperiment] = useState(false)
  const [, setLatestRun] = useState<QaExperimentRun | null>(null)

  // Hypothesis selections
  const [hypHero, setHypHero] = useState<string>('')
  const [hypBoss, setHypBoss] = useState<string>('')
  const [hypEnv, setHypEnv] = useState<string>('')

  // Patch selection
  const [selectedPatch, setSelectedPatch] = useState<QaSettings['selectedPhysicsPatch']>(qa.selectedPhysicsPatch || null)
  const [regressionResults, setRegressionResults] = useState<{ allPassed: boolean; tests: RegressionTestItem[]; feedback: string } | null>(null)

  // Hints
  const [showHints, setShowHints] = useState(false)
  const [activeHintIndex, setActiveHintIndex] = useState(0)

  const budget = qa.experimentBudgetRemaining ?? 6
  const testedRuns = qa.testedRuns ?? []
  const hasReproduced = testedRuns.some((r) => r.bugTriggered)

  const hints = [
    'The bug report mentions massive damage spikes during boss melee attacks near obstacles. Look at how physical knockback interacts with solid boundaries.',
    'Test Shield Guard against Ground Slam in an open arena vs against a wall. Notice the difference in knockback velocity and shield re-triggering.',
    'The defect is caused by wall rebound velocity resetting the shield collision on the same frame. Select the wall-bounce immunity patch to prevent multi-hit loops without disabling walls.',
  ]

  // Run experimental test
  const handleRunExperiment = () => {
    if (budget <= 0) return

    setIsRunningExperiment(true)
    gameAudio.play('boss_windup')

    setTimeout(() => {
      const run = runQaExperiment({ heroAction, bossAction, environment }, selectedPatch)
      setLatestRun(run)
      setIsRunningExperiment(false)

      const nextRuns = [run, ...testedRuns]
      const nextBudget = budget - 1
      const isBug = run.bugTriggered

      if (isBug) {
        gameAudio.play('hit_player')
      } else {
        gameAudio.play('hit_boss')
      }

      onUpdateQa({
        ...qa,
        experimentBudgetRemaining: nextBudget,
        testedRuns: nextRuns,
        bugReproduced: hasReproduced || isBug,
      })
    }, 350)
  }

  // Run Regression Suite
  const handleRunRegression = () => {
    const res = runQaRegressionSuite(selectedPatch ?? null)
    setRegressionResults(res)

    const fullHypothesis = `${hypHero}_${hypBoss}_${hypEnv}`
    const updatedQa: QaSettings = {
      ...qa,
      selectedRootCause: fullHypothesis,
      selectedPhysicsPatch: selectedPatch,
      intermittentBugSolved: res.allPassed,
      bugFixed: res.allPassed,
      projectileWallRule: 'stop_despawn', // restores wall blocking
    }

    onUpdateQa(updatedQa)

    if (res.allPassed) {
      gameAudio.play('victory')
      if (!isComplete) {
        onMarkComplete()
      }
    } else {
      gameAudio.play('hit_player')
    }
  }

  const isSolved = qa.intermittentBugSolved || isComplete

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-y-auto p-6 text-[#0b1d2e]">
      {/* Role Header Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-rose-500/20 bg-gradient-to-r from-rose-50/70 via-white to-slate-50 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-600/10 px-3 py-1 text-xs font-bold text-rose-800">
            <Sparkles className="size-3 text-rose-600" />
            Role 4: QA Tester & Producer
          </div>
          <h1 className="mt-1 font-sans text-2xl font-black text-[#003c6c]">The Intermittent Bug</h1>
          <p className="mt-1 text-sm text-[#5a6a85]">
            Playtesters report sporadic 400% lethal damage spikes and physics glitches. You have a limited budget of 6 experiments.
            Systematically isolate the 3-factor trigger, formulate your hypothesis, and verify the physics engine repair!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetBalance}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Reset Investigation
          </button>

          <button
            type="button"
            onClick={onMarkComplete}
            disabled={!isSolved}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer ${
              isSolved
                ? isComplete
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-[#003c6c] text-white hover:bg-[#002b4d]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="size-4" />
            <span>{isComplete ? 'Bug Resolved ✓' : 'Validate & Mark Complete'}</span>
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
          <Bug className="size-3.5" />
          <span>1. The Intermittent Bug (Investigation Lab)</span>
          {isSolved && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
              Fixed ✓
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
          <Scale className="size-3.5" />
          <span>2. Telemetry & Combat Balance Dashboard</span>
        </button>
      </div>

      {/* Hints Accordion */}
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

      {/* View 1: Deductive Investigation Lab */}
      {activeTab === 'puzzle' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Test Chamber & Experiment Runner */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    Experimental Combat Test Chamber
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Isolate variable combinations to reproduce the defect.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-bold ${
                      budget > 0 ? 'bg-sky-500/20 text-sky-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    Budget: {budget} / 6 Runs
                  </span>
                  <button
                    onClick={() => setShowHints(!showHints)}
                    className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-amber-400" />
                    Hints
                  </button>
                </div>
              </div>

              {/* Three Variable Selectors */}
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                {/* Hero Action */}
                <div>
                  <span className="font-semibold text-slate-400">Hero Action:</span>
                  <select
                    value={heroAction}
                    onChange={(e) => setHeroAction(e.target.value as ExperimentParams['heroAction'])}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-slate-200"
                  >
                    <option value="normal">Normal Movement</option>
                    <option value="dash">Dash (I-frames)</option>
                    <option value="shield">Shield Guard</option>
                    <option value="heavy_attack">Heavy Attack</option>
                  </select>
                </div>

                {/* Boss Attack */}
                <div>
                  <span className="font-semibold text-slate-400">Boss Attack:</span>
                  <select
                    value={bossAction}
                    onChange={(e) => setBossAction(e.target.value as ExperimentParams['bossAction'])}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-slate-200"
                  >
                    <option value="ranged_orb">Energy Orb (Ranged)</option>
                    <option value="ground_slam">Ground Slam (Knockback)</option>
                    <option value="cleave">Cleave Arc</option>
                    <option value="idle">Idle / Recovery</option>
                  </select>
                </div>

                {/* Environment */}
                <div>
                  <span className="font-semibold text-slate-400">Environment:</span>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as ExperimentParams['environment'])}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-slate-200"
                  >
                    <option value="open">Open Arena Floor</option>
                    <option value="near_wall">Near Wall Barrier (&lt;35px)</option>
                    <option value="hazard">Inside Hazard Zone</option>
                  </select>
                </div>
              </div>

              {/* Run Experiment Button */}
              <button
                onClick={handleRunExperiment}
                disabled={budget <= 0 || isRunningExperiment}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-rose-500 hover:to-amber-500 disabled:opacity-50"
              >
                <FlaskConical className="h-4 w-4" />
                {isRunningExperiment
                  ? 'Executing Simulation...'
                  : budget > 0
                    ? `Execute Test Run (${budget} remaining)`
                    : 'Budget Exhausted (Reset to retry)'}
              </button>
            </div>

            {/* Experiment History & Telemetry Log */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Telemetry Recorder ({testedRuns.length} runs logged)
                </span>
                {hasReproduced && (
                  <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-400">
                    BUG REPRODUCED!
                  </span>
                )}
              </div>

              <div className="mt-3 h-44 overflow-y-auto space-y-2 font-mono text-xs">
                {testedRuns.length > 0 ? (
                  testedRuns.map((run, idx) => (
                    <div
                      key={run.id || idx}
                      className={`rounded border p-2.5 ${
                        run.bugTriggered
                          ? 'border-rose-500/50 bg-rose-950/30 text-rose-200 font-bold'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span>
                          Run #{testedRuns.length - idx}: {run.heroAction.toUpperCase()} + {run.bossAction.toUpperCase()} @ {run.environment.toUpperCase()}
                        </span>
                        <span className={run.bugTriggered ? 'text-rose-400' : 'text-slate-500'}>
                          {run.bugTriggered ? 'GLITCH DETECTED (112 dmg)' : `Normal (${run.damageDealt} dmg)`}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] leading-relaxed">{run.log}</div>
                    </div>
                  ))
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    No experiments logged yet. Configure test conditions and execute a test run.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Hypothesis Isolation & Engine Patch Verification */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-md">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Root Cause Hypothesis
              </span>
              <p className="mt-1 text-xs text-slate-400">
                Identify the exact 3 conditions that cause the collision loop:
              </p>

              <div className="mt-3 space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-300">Required Hero Action:</span>
                  <select
                    value={hypHero}
                    onChange={(e) => setHypHero(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-1.5 text-slate-200"
                  >
                    <option value="">-- Select Action --</option>
                    <option value="normal">Normal Movement</option>
                    <option value="dash">Dash Ability</option>
                    <option value="shield">Shield Guard Barrier</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-300">Required Boss Attack:</span>
                  <select
                    value={hypBoss}
                    onChange={(e) => setHypBoss(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-1.5 text-slate-200"
                  >
                    <option value="">-- Select Attack --</option>
                    <option value="ranged">Energy Orb (Ranged)</option>
                    <option value="slam">Ground Slam (Knockback)</option>
                    <option value="cleave">Cleave Arc</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-300">Required Position:</span>
                  <select
                    value={hypEnv}
                    onChange={(e) => setHypEnv(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-1.5 text-slate-200"
                  >
                    <option value="">-- Select Position --</option>
                    <option value="open">Open Floor</option>
                    <option value="wall">Near Wall Barrier (&lt;35px)</option>
                    <option value="hazard">Hazard Pool</option>
                  </select>
                </div>
              </div>

              {/* Patch Selection */}
              <div className="mt-5 border-t border-slate-800 pt-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Physics Engine Patch
                </span>
                <div className="mt-2 space-y-2 text-xs">
                  {[
                    {
                      id: 'patch_disable_wall',
                      title: 'Patch A: Disable Wall Collisions in Combat',
                      desc: 'Crude fix: allows walking through solid walls.',
                    },
                    {
                      id: 'patch_remove_shield',
                      title: 'Patch B: Remove Shield Ability',
                      desc: 'Deletes the shield ability entirely from combat.',
                    },
                    {
                      id: 'patch_wall_iframe',
                      title: 'Patch C: Wall-Bounce Rebound Immunity (0.15s)',
                      desc: 'Surgical fix: preserves wall physics, prevents re-triggering damage.',
                    },
                  ].map((patchOpt) => (
                    <label
                      key={patchOpt.id}
                      className={`flex flex-col rounded-lg border p-2.5 cursor-pointer transition ${
                        selectedPatch === patchOpt.id
                          ? 'border-indigo-500 bg-indigo-950/40 text-slate-200'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="patch"
                          value={patchOpt.id}
                          checked={selectedPatch === patchOpt.id}
                          onChange={() => setSelectedPatch(patchOpt.id as QaSettings['selectedPhysicsPatch'])}
                          className="accent-indigo-500"
                        />
                        <span className="font-semibold">{patchOpt.title}</span>
                      </div>
                      <span className="mt-1 text-[11px] text-slate-500 pl-5">{patchOpt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Run Regression Suite Button */}
              <button
                onClick={handleRunRegression}
                disabled={!selectedPatch}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-emerald-500 hover:to-sky-500 disabled:opacity-50"
              >
                <Cpu className="h-4 w-4" />
                Run 5-Stage Regression Verification
              </button>
            </div>

            {/* Regression Results Card */}
            {regressionResults && (
              <div
                className={`rounded-xl border p-4 shadow-lg ${
                  regressionResults.allPassed
                    ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-200'
                    : 'border-rose-500/50 bg-rose-950/20 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {regressionResults.allPassed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-400" />
                  )}
                  <span className="font-bold text-sm">
                    {regressionResults.allPassed ? 'ALL REGRESSION TESTS PASSED' : 'REGRESSION DETECTED'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  {regressionResults.tests.map((t) => (
                    <div key={t.id} className="flex items-center justify-between">
                      <span className="text-slate-300">{t.name}</span>
                      <span className={`font-mono font-bold ${t.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-xs leading-relaxed">{regressionResults.feedback}</p>
              </div>
            )}

            {/* Educational Takeaway */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
              <span className="font-bold text-slate-300">Engineering Takeaway: </span>
              Heisenbugs occur when multiple interacting systems (physics knockback, wall bounce inversion, and hitbox
              re-triggering) collide under specific edge conditions. Quick hacks that break other systems fail regression;
              surgical fixes solve the root cause.
            </div>
          </div>
        </div>
      )}

      {/* View 2: Telemetry & Combat Balance Dashboard */}
      {activeTab === 'creative' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="font-sans text-base font-bold text-[#003c6c]">Combat Telemetry & Time-To-Kill</h3>
            <p className="mt-0.5 text-xs text-[#5a6a85]">
              Empirical balance predictions based on current Hero and Boss parameters.
            </p>

            {(() => {
              const tel = computeBalanceTelemetry(hero, boss)
              return (
                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-xs text-[#5a6a85]">Hits to Defeat Boss</span>
                    <div className="mt-1 font-mono text-2xl font-black text-[#003c6c]">{tel.hitsToDefeatBoss}</div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-xs text-[#5a6a85]">Hits to Defeat Hero</span>
                    <div className="mt-1 font-mono text-2xl font-black text-[#003c6c]">{tel.hitsToDefeatHero}</div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-xs text-[#5a6a85]">Hero Est. DPS</span>
                    <div className="mt-1 font-mono text-2xl font-black text-[#003c6c]">{tel.heroDpsEstimated}</div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-xs text-[#5a6a85]">Expected Match Duration</span>
                    <div className="mt-1 font-mono text-xl font-bold text-[#003c6c]">{tel.expectedDurationEstimate}</div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-4">
        <div className="text-xs text-[#5a6a85]">
          {isComplete ? (
            <span className="font-bold text-emerald-700">✓ Role 4: QA Tester Complete</span>
          ) : (
            <span>Isolate the intermittent defect and verify the engine patch.</span>
          )}
        </div>

        <button
          type="button"
          onClick={onNextRole}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003c6c] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#002b4d] cursor-pointer"
        >
          <span>Team Integration Screen</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
