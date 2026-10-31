import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Code2,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { BOSS_ATTACK_SPECS, BOSS_STATES, DEBUG_CHALLENGES } from '../../data/bossCatalog'
import {
  runBossAiSimulation,
  validateBossConfig,
  type BossSimulationReport,
} from '../../simulation/bossFsm'
import type { BossAttackType, BossBehavior, BossConfig, BossStateId } from '../../types/project'

interface BossProgrammerScreenProps {
  boss: BossConfig
  onUpdateBoss(boss: BossConfig): void
  onResetBoss(): void
  onMarkComplete(): void
  isComplete: boolean
  onNextRole(): void
}

export function BossProgrammerScreen({
  boss,
  onUpdateBoss,
  onResetBoss,
  onMarkComplete,
  isComplete,
  onNextRole,
}: BossProgrammerScreenProps) {
  const [activeChallengeId, setActiveChallengeId] = useState<'relentless_loop' | 'phantom_reach'>(
    boss.behavior.activeBugId || 'relentless_loop',
  )
  const [revealedHints, setRevealedHints] = useState<number>(0)
  const [simReport, setSimReport] = useState<BossSimulationReport | null>(null)
  const [activeFsmTab, setActiveFsmTab] = useState<'debugger' | 'parameters'>('debugger')

  const validation = validateBossConfig(boss)

  const updateBehavior = <K extends keyof BossBehavior>(key: K, val: BossBehavior[K]) => {
    onUpdateBoss({
      ...boss,
      behavior: {
        ...boss.behavior,
        [key]: val,
      },
    })
  }

  const runSimulation = () => {
    const report = runBossAiSimulation(boss.behavior)
    setSimReport(report)
    if (report.passed) {
      updateBehavior('bugResolved', true)
    }
  }

  const activeChallenge = DEBUG_CHALLENGES.find((c) => c.id === activeChallengeId)

  // Challenge resolution check
  const isChallengeResolved =
    activeChallengeId === 'relentless_loop'
      ? boss.behavior.stateAfterAttack === 'RECOVER' && boss.behavior.recoveryDuration >= 0.5
      : boss.behavior.attackRange <= 140 && boss.behavior.attackRange < boss.behavior.detectionRange

  const canComplete = validation.valid && (simReport ? simReport.passed : isChallengeResolved)

  const loadDefect = (challengeId: 'relentless_loop' | 'phantom_reach') => {
    setActiveChallengeId(challengeId)
    setRevealedHints(0)
    setSimReport(null)

    if (challengeId === 'relentless_loop') {
      onUpdateBoss({
        ...boss,
        behavior: {
          ...boss.behavior,
          stateAfterAttack: 'ATTACK', // Loop defect!
          recoveryDuration: 0.1,
          activeBugId: 'relentless_loop',
          bugResolved: false,
        },
      })
    } else {
      onUpdateBoss({
        ...boss,
        behavior: {
          ...boss.behavior,
          stateAfterAttack: 'RECOVER',
          attackRange: 380, // Phantom reach defect!
          detectionRange: 200,
          activeBugId: 'phantom_reach',
          bugResolved: false,
        },
      })
    }
  }

  const attacks: BossAttackType[] = ['heavy_cleave', 'slam_shockwave', 'fireball_spray']

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-y-auto p-6 text-[#0b1d2e]">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-50/70 via-white to-slate-50 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-600/10 px-3 py-1 text-xs font-bold text-amber-800">
            <Sparkles className="size-3 text-amber-600" />
            Role 2: Programmer
          </div>
          <h1 className="mt-1 font-sans text-2xl font-black text-[#003c6c]">Boss AI State Machine Debugger</h1>
          <p className="mt-1 text-sm text-[#5a6a85]">
            Investigate state machine logic bugs. Inspect state transitions, fix broken triggers, and test the AI simulation to prevent infinite loops.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetBoss}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Reset Boss AI
          </button>

          <button
            type="button"
            onClick={onMarkComplete}
            disabled={!canComplete}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer ${
              canComplete
                ? isComplete
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-[#003c6c] text-white hover:bg-[#002b4d]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="size-4" />
            <span>{isComplete ? 'Boss AI Approved ✓' : 'Approve Boss AI'}</span>
          </button>
        </div>
      </div>

      {/* Structured Game Dev Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveFsmTab('debugger')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeFsmTab === 'debugger'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <Code2 className="size-3.5" />
          <span>1. State Machine Debugger</span>
          {isChallengeResolved && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] text-emerald-300">
              Bug Resolved ✓
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveFsmTab('parameters')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeFsmTab === 'parameters'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <Sparkles className="size-3.5" />
          <span>2. Timing & Attack Patterns</span>
        </button>
      </div>

      {/* Tab 1: State Machine Debugger */}
      {activeFsmTab === 'debugger' && (
        <div className="flex flex-col gap-6">
          {/* Problem Briefing Box */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-amber-800">
                  YOUR PROBLEM
                </span>
                <h3 className="font-sans text-base font-black text-amber-950 mt-0.5">
                  {activeChallengeId === 'relentless_loop'
                    ? 'The Relentless Loop Glitch: Boss attacks continuously without entering recovery!'
                    : 'The Phantom Reach Bug: Boss attacks from across the arena before detecting player!'}
                </h3>
                <p className="mt-1 text-xs text-amber-900/80">
                  {activeChallengeId === 'relentless_loop'
                    ? 'Playtesters report that when the boss finishes an attack, it skips its vulnerable cooldown and immediately strikes again, giving players zero opportunity to punish!'
                    : 'Playtesters report that the boss triggers its attack animation when the hero is 380px away—even outside the boss’s 200px detection vision cone!'}
                </p>
              </div>

              {/* Challenge Switcher */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => loadDefect('relentless_loop')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${
                    activeChallengeId === 'relentless_loop'
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-amber-300 bg-white text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  Bug A: Relentless Loop
                </button>
                <button
                  type="button"
                  onClick={() => loadDefect('phantom_reach')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${
                    activeChallengeId === 'phantom_reach'
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-amber-300 bg-white text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  Bug B: Phantom Reach
                </button>
              </div>
            </div>
          </div>

          {/* Interactive State Machine Pipeline */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#75787b]">
                  YOUR TOOLS
                </span>
                <h2 className="font-sans text-base font-bold text-[#003c6c] flex items-center gap-2">
                  <Code2 className="size-4 text-amber-600" />
                  State Machine Transition Flow
                </h2>
              </div>
              <span className="text-xs text-[#75787b]">Click any transition block to inspect or edit logic</span>
            </div>

            {/* FSM Blocks Diagram */}
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { id: 'IDLE', name: '01. IDLE', arrow: 'IF Player In Range →' },
                { id: 'DETECT', name: '02. DETECT', arrow: 'Lock On (0.2s) →' },
                { id: 'CHASE', name: '03. CHASE', arrow: 'IF In Attack Range →' },
                { id: 'WINDUP', name: '04. WINDUP', arrow: 'Telegraph Timer →' },
                { id: 'ATTACK', name: '05. ATTACK', arrow: 'On Attack Done →' },
                { id: 'RECOVER', name: '06. RECOVER', arrow: 'Cooldown Done → CHASE' },
              ].map((st) => {
                const spec = BOSS_STATES[st.id as BossStateId]
                const isTargetState = st.id === 'ATTACK'
                return (
                  <div
                    key={st.id}
                    className={`flex flex-col justify-between rounded-xl border p-3 text-center transition ${
                      isTargetState && boss.behavior.stateAfterAttack !== 'RECOVER'
                        ? 'border-red-500 bg-red-50/80 ring-2 ring-red-400'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="size-2.5 rounded-full" style={{ backgroundColor: spec.color }} />
                        <span className="text-xs font-black text-[#003c6c]">{st.name}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-[#5a6a85] leading-tight">{spec.badgeText}</div>
                    </div>

                    <div className="mt-2 border-t border-black/5 pt-1.5 font-mono text-[9px] text-[#75787b]">
                      {st.arrow}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Interactive Logic Block Editor */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs font-bold text-[#003c6c] uppercase tracking-wider">
                Configurable Transition Logic
              </span>

              {activeChallengeId === 'relentless_loop' ? (
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-[#0b1d2e]">
                    <span className="font-mono bg-white px-2 py-1 rounded border font-bold">STATE: ATTACK</span>
                    <span className="mx-2">→ ON ATTACK COMPLETE → GO TO</span>
                    <select
                      value={boss.behavior.stateAfterAttack || 'RECOVER'}
                      onChange={(e) => updateBehavior('stateAfterAttack', e.target.value as BossStateId)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-[#003c6c] outline-none cursor-pointer focus:border-amber-500"
                    >
                      <option value="ATTACK">ATTACK (Bug: Infinite Loop!)</option>
                      <option value="CHASE">CHASE (Bug: Skips Recovery!)</option>
                      <option value="RECOVER">RECOVER (Correct: Vulnerable Window)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#475569] block">
                      Recovery Window Duration:
                    </label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <input
                        type="range"
                        min={0.1}
                        max={1.8}
                        step={0.1}
                        value={boss.behavior.recoveryDuration}
                        onChange={(e) => updateBehavior('recoveryDuration', Number(e.target.value))}
                        className="accent-amber-500 cursor-pointer"
                      />
                      <span className="font-mono text-xs font-bold text-[#003c6c]">
                        {boss.behavior.recoveryDuration.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="font-mono bg-white px-2 py-1 rounded border font-bold">TRIGGER: ATTACK WINDUP</span>
                    <span className="mx-2">→ IF Distance &le; Attack Range</span>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="range"
                        min={50}
                        max={400}
                        step={10}
                        value={boss.behavior.attackRange}
                        onChange={(e) => updateBehavior('attackRange', Number(e.target.value))}
                        className="accent-amber-500 cursor-pointer"
                      />
                      <span className="font-mono text-xs font-bold text-[#003c6c]">
                        {boss.behavior.attackRange} px
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-[#5a6a85]">
                    Current Detection Vision: <strong className="text-[#003c6c]">{boss.behavior.detectionRange}px</strong>
                    <div className="text-[11px] text-amber-700">Attack range must be within detection range (≤ 140px).</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Test Your Solution: Diagnostic Simulator & Live Event Log */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#75787b]">
                  TEST YOUR SOLUTION
                </span>
                <h3 className="font-sans text-base font-bold text-[#003c6c]">
                  Simulation Run & Transition Event Log
                </h3>
              </div>
              <button
                type="button"
                onClick={runSimulation}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 shadow-md cursor-pointer transition active:translate-y-0.5"
              >
                <Play className="size-3.5 fill-current" />
                Run AI Diagnostic
              </button>
            </div>

            {/* Diagnostic Results */}
            {simReport ? (
              <div className="mt-4 flex flex-col gap-3">
                <div
                  className={`rounded-xl border p-4 text-xs ${
                    simReport.passed
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                      : 'border-red-300 bg-red-50 text-red-950'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {simReport.passed ? (
                      <CheckCircle2 className="size-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="size-5 text-red-600" />
                    )}
                    <span>{simReport.passed ? 'AI Logic Verified & Passed!' : 'Logic Error Detected'}</span>
                  </div>
                  <p className="mt-1">{simReport.summary}</p>
                </div>

                {/* Event Log Output */}
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
                  <div className="text-[10px] font-bold uppercase text-slate-500 pb-1 border-b border-slate-800">
                    Live FSM Execution Event Stream
                  </div>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {simReport.eventLog.map((evt, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400">[{evt.timestamp}]</span>
                        <span className="text-cyan-400 font-bold">{evt.toState}:</span>
                        <span>{evt.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-[#75787b]">
                Click &ldquo;Run AI Diagnostic&rdquo; to execute the finite-state machine against dummy target distance and inspect the state stream.
              </div>
            )}

            {/* Progressive Hints */}
            {activeChallenge && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#475569]">
                    Hints ({revealedHints}/{activeChallenge.hints.length})
                  </span>
                  {revealedHints < activeChallenge.hints.length && (
                    <button
                      type="button"
                      onClick={() => setRevealedHints((h) => h + 1)}
                      className="inline-flex items-center gap-1 font-bold text-amber-600 hover:underline cursor-pointer"
                    >
                      <HelpCircle className="size-3.5" />
                      Reveal Next Hint
                    </button>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-[#5a6a85]">
                  {activeChallenge.hints.slice(0, revealedHints).map((hint, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Parameters & Tuning */}
      {activeFsmTab === 'parameters' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Sliders */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4">
            <h2 className="font-sans text-base font-bold text-[#003c6c]">AI Timing Parameters</h2>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#75787b]">
                Boss Name / Designation
              </label>
              <input
                type="text"
                value={boss.name}
                onChange={(e) => onUpdateBoss({ ...boss, name: e.target.value })}
                placeholder="e.g. Goliath Prime, Overlord X"
                maxLength={24}
                className="mt-1 w-full rounded-lg border border-[#cbd5e1] bg-white px-3.5 py-2 text-sm font-bold text-[#0b1d2e] outline-none focus:border-[#003c6c] focus:ring-2 focus:ring-[#003c6c]/20"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[#475569]">Detection Range (Vision)</span>
                  <span className="font-mono text-[#003c6c]">{boss.behavior.detectionRange} px</span>
                </div>
                <input
                  type="range"
                  min={150}
                  max={450}
                  step={25}
                  value={boss.behavior.detectionRange}
                  onChange={(e) => updateBehavior('detectionRange', Number(e.target.value))}
                  className="mt-1.5 w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[#475569]">Chase Speed</span>
                  <span className="font-mono text-[#003c6c]">{boss.behavior.chaseSpeed} px/s</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={180}
                  step={10}
                  value={boss.behavior.chaseSpeed}
                  onChange={(e) => updateBehavior('chaseSpeed', Number(e.target.value))}
                  className="mt-1.5 w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[#475569]">Attack Windup (Telegraph)</span>
                  <span className="font-mono text-[#003c6c]">{boss.behavior.attackWindup.toFixed(2)} s</span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={1.5}
                  step={0.05}
                  value={boss.behavior.attackWindup}
                  onChange={(e) => updateBehavior('attackWindup', Number(e.target.value))}
                  className="mt-1.5 w-full accent-red-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[#475569]">Tactical Retreat Threshold</span>
                  <span className="font-mono text-[#003c6c]">{boss.behavior.retreatThreshold}% HP</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={boss.behavior.retreatThreshold}
                  onChange={(e) => updateBehavior('retreatThreshold', Number(e.target.value))}
                  className="mt-1.5 w-full accent-purple-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Attack Selection */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-sans text-base font-bold text-[#003c6c]">Boss Attack Pattern</h2>
            <div className="mt-4 flex flex-col gap-2.5">
              {attacks.map((atkKey) => {
                const spec = BOSS_ATTACK_SPECS[atkKey]
                const isSelected = boss.behavior.attackType === atkKey
                return (
                  <div
                    key={atkKey}
                    onClick={() => updateBehavior('attackType', atkKey)}
                    className={`rounded-xl border p-3.5 transition cursor-pointer ${
                      isSelected
                        ? 'border-red-500 bg-red-50/50 ring-2 ring-red-500/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#003c6c]">{spec.name}</span>
                      <span className="font-mono text-xs font-bold text-red-600">
                        {boss.attackDamage} dmg
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#5a6a85]">{spec.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-xs text-[#75787b]">
          {!canComplete
            ? 'Action required: Resolve AI transition bug and verify simulation pass.'
            : 'Boss AI logic verified and ready.'}
        </span>
        <button
          type="button"
          onClick={onNextRole}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003c6c] px-4 py-2 text-xs font-bold text-white hover:bg-[#002b4d] shadow-xs cursor-pointer"
        >
          <span>Next: Build Battlefield Arena</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
