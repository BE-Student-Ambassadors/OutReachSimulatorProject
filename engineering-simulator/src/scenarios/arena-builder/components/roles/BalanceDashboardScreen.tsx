import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FlaskConical,
  History,
  Lightbulb,
  Play,
  RotateCcw,
  Scale,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import {
  computeBalanceTelemetry,
  generatePlaytestObservations,
} from '../../simulation/balanceMath'
import type { BalanceSettings, BossConfig, HeroConfig, PlaytestResult } from '../../types/project'

interface BalanceDashboardScreenProps {
  hero: HeroConfig
  boss: BossConfig
  balance: BalanceSettings
  onUpdateBalance(balance: BalanceSettings): void
  onResetBalance(): void
  playtestHistory: PlaytestResult[]
  onOpenPlaytest(): void
  onMarkComplete(): void
  isComplete: boolean
  onNextRole(): void
}

const HYPOTHESIS_OPTIONS = [
  {
    id: 'hypo-boss-damage',
    label: 'Boss damage is too lethal (hero collapses in ~3-4 strikes).',
    recommendation: 'Reduce boss strike damage or increase hero maximum health.',
    paramKey: 'bossDamage',
  },
  {
    id: 'hypo-boss-windup',
    label: 'Boss attack windup is too fast, leaving no time to react and dodge.',
    recommendation: 'Increase boss attack windup to 0.8s+ so players can read telegraphs.',
    paramKey: 'attackWindup',
  },
  {
    id: 'hypo-boss-recovery',
    label: 'Boss recovery window is too short to safely counter-attack.',
    recommendation: 'Lengthen recovery duration to 1.0s+ so players have openings to punish.',
    paramKey: 'recoveryDuration',
  },
  {
    id: 'hypo-hero-damage',
    label: 'Hero damage is too weak to pressure the boss effectively.',
    recommendation: 'Increase hero attack damage to make attacks impactful.',
    paramKey: 'heroDamage',
  },
]

export function BalanceDashboardScreen({
  hero,
  boss,
  balance,
  onUpdateBalance,
  onResetBalance,
  playtestHistory,
  onOpenPlaytest,
  onMarkComplete,
  isComplete,
  onNextRole,
}: BalanceDashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<'investigation' | 'telemetry'>('investigation')

  const telemetry = computeBalanceTelemetry(hero, boss)
  const baseline = balance.baselineCase ?? {
    id: 'baseline-test-01',
    fightDurationSeconds: 14,
    playerHitsLanded: 2,
    bossHitsLanded: 6,
    playerHealthRemaining: 0,
    bossHealthRemaining: 85,
    issueReported: 'The boss attacks relentlessly without pause and the hero collapses in 14 seconds before being able to dodge.',
  }
  const latestRun = playtestHistory.length > 0 ? playtestHistory[playtestHistory.length - 1] : null
  const observations = latestRun ? generatePlaytestObservations(latestRun, hero, boss) : []

  const updateSetting = <K extends keyof BalanceSettings>(key: K, val: BalanceSettings[K]) => {
    onUpdateBalance({ ...balance, [key]: val })
  }

  // Verification requirements:
  // 1. Has selected a hypothesis
  // 2. Has completed at least one real playtest after the baseline
  // 3. Has filled or selected a reflection
  const hasHypothesis = Boolean(balance.selectedHypothesis)
  const hasCompletedPlaytest = playtestHistory.length > 0
  const hasReflection = Boolean(balance.reflection?.trim())

  const canComplete = hasHypothesis && hasCompletedPlaytest && hasReflection

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-y-auto p-6 text-[#0b1d2e]">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-50/70 via-white to-slate-50 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-600/10 px-3 py-1 text-xs font-bold text-purple-800">
            <Sparkles className="size-3 text-purple-600" />
            Role 4: Producer & Balance QA
          </div>
          <h1 className="mt-1 font-sans text-2xl font-black text-[#003c6c]">Game Balance Investigation Lab</h1>
          <p className="mt-1 text-sm text-[#5a6a85]">
            Investigate an initial failing playtest case. Form a balance hypothesis, test adjustments in real combat, compare Before vs After metrics, and document your findings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetBalance}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Reset Balance
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
            <span>{isComplete ? 'QA Approved ✓' : 'Approve QA Review'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('investigation')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'investigation'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <FlaskConical className="size-3.5" />
          <span>1. Balance Investigation & Testing</span>
          {canComplete && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] text-emerald-300">
              Completed ✓
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'telemetry'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <Scale className="size-3.5" />
          <span>2. Full Combat History Log</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-600">
            {playtestHistory.length} Runs
          </span>
        </button>
      </div>

      {activeTab === 'investigation' && (
        <div className="flex flex-col gap-6">
          {/* Step 1: Clearly Labeled Baseline Playtest Report (The Problem) */}
          <div className="rounded-2xl border border-red-300 bg-red-50/50 p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-red-200 pb-2.5">
              <div>
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-red-800">
                  YOUR PROBLEM: FAILING BASELINE PLAYTEST REPORT
                </span>
                <h3 className="font-sans text-base font-black text-red-950 mt-0.5">
                  Pre-Tuning Telemetry Case (Baseline Test #01)
                </h3>
              </div>
              <span className="rounded-full bg-red-200 px-2.5 py-0.5 font-mono text-[10px] font-bold text-red-800">
                Deliberate Baseline Example
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
              <div className="rounded-xl bg-white/80 p-3 border border-red-200 text-center">
                <span className="text-[10px] uppercase text-slate-500">Outcome</span>
                <div className="font-black text-red-600 mt-0.5">DEFEAT</div>
              </div>
              <div className="rounded-xl bg-white/80 p-3 border border-red-200 text-center">
                <span className="text-[10px] uppercase text-slate-500">Duration</span>
                <div className="font-black text-[#003c6c] mt-0.5">{baseline.fightDurationSeconds}s</div>
              </div>
              <div className="rounded-xl bg-white/80 p-3 border border-red-200 text-center">
                <span className="text-[10px] uppercase text-slate-500">Hits (Hero / Boss)</span>
                <div className="font-black text-slate-700 mt-0.5">
                  {baseline.playerHitsLanded} / {baseline.bossHitsLanded}
                </div>
              </div>
              <div className="rounded-xl bg-white/80 p-3 border border-red-200 text-center">
                <span className="text-[10px] uppercase text-slate-500">Hero Remaining</span>
                <div className="font-black text-red-600 mt-0.5">{baseline.playerHealthRemaining} HP</div>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-red-200 bg-white p-3 text-xs text-red-950">
              <span className="font-bold">Playtester Feedback: </span>
              &ldquo;{baseline.issueReported}&rdquo;
            </div>
          </div>

          {/* Step 2: Form a Balance Hypothesis */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#75787b]">
              YOUR TOOLS & HYPOTHESIS
            </span>
            <h2 className="font-sans text-base font-bold text-[#003c6c] mt-0.5 flex items-center gap-2">
              <Lightbulb className="size-4 text-purple-600" />
              Identify the Root Cause & State Your Hypothesis
            </h2>
            <p className="mt-1 text-xs text-[#5a6a85]">
              Game balance is not guessing—it begins with an educated hypothesis about what makes combat feel unfair.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {HYPOTHESIS_OPTIONS.map((hypo) => {
                const isSelected = balance.selectedHypothesis === hypo.id
                return (
                  <div
                    key={hypo.id}
                    onClick={() => {
                      updateSetting('selectedHypothesis', hypo.id)
                      updateSetting('testedParameter', hypo.paramKey)
                    }}
                    className={`rounded-xl border p-3.5 transition cursor-pointer ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-600/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#003c6c]">{hypo.label}</span>
                      {isSelected && <CheckCircle2 className="size-4 text-purple-600 shrink-0" />}
                    </div>
                    <div className="mt-1.5 text-[11px] text-[#5a6a85] font-mono">
                      Target action: {hypo.recommendation}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Step 3: Test Solution & Compare Results */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#75787b]">
                  TEST YOUR SOLUTION & COMPARE RESULTS
                </span>
                <h3 className="font-sans text-base font-bold text-[#003c6c]">
                  Before (Baseline) vs After (Empirical Playtest) Comparison
                </h3>
              </div>
              <button
                type="button"
                onClick={onOpenPlaytest}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#008542] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#006e36] shadow-md cursor-pointer transition active:translate-y-0.5"
              >
                <Play className="size-4 fill-current" />
                <span>Launch Test Duel</span>
              </button>
            </div>

            {/* Comparison Cards */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* BEFORE */}
              <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
                <span className="font-mono text-xs font-bold uppercase text-red-800">
                  BEFORE (Baseline Test #01)
                </span>
                <div className="mt-3 space-y-2 text-xs font-mono">
                  <div className="flex justify-between border-b border-red-100 pb-1">
                    <span className="text-slate-500">Outcome:</span>
                    <span className="font-bold text-red-600">DEFEAT</span>
                  </div>
                  <div className="flex justify-between border-b border-red-100 pb-1">
                    <span className="text-slate-500">Duration:</span>
                    <span className="font-bold text-slate-800">14.0s (Too fast)</span>
                  </div>
                  <div className="flex justify-between border-b border-red-100 pb-1">
                    <span className="text-slate-500">Hits Landed:</span>
                    <span className="font-bold text-slate-800">2 strikes</span>
                  </div>
                  <div className="flex justify-between border-b border-red-100 pb-1">
                    <span className="text-slate-500">Hits Taken:</span>
                    <span className="font-bold text-red-600">6 strikes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dodges:</span>
                    <span className="font-bold text-slate-800">0 dodges</span>
                  </div>
                </div>
              </div>

              {/* AFTER */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase text-emerald-800">
                    AFTER (Run #{latestRun ? latestRun.attemptNumber : 'None'})
                  </span>
                  {latestRun && (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Empirical Data
                    </span>
                  )}
                </div>

                {latestRun ? (
                  <div className="mt-3 space-y-2 text-xs font-mono">
                    <div className="flex justify-between border-b border-emerald-100 pb-1">
                      <span className="text-slate-500">Outcome:</span>
                      <span className={`font-bold ${latestRun.winner === 'player' ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {latestRun.winner === 'player' ? 'VICTORY' : 'DEFEAT'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-emerald-100 pb-1">
                      <span className="text-slate-500">Duration:</span>
                      <span className="font-bold text-slate-800">{latestRun.durationSeconds}s</span>
                    </div>
                    <div className="flex justify-between border-b border-emerald-100 pb-1">
                      <span className="text-slate-500">Hits Landed:</span>
                      <span className="font-bold text-emerald-700">{latestRun.hitsLanded} strikes</span>
                    </div>
                    <div className="flex justify-between border-b border-emerald-100 pb-1">
                      <span className="text-slate-500">Hits Taken:</span>
                      <span className="font-bold text-slate-800">{latestRun.hitsReceived} strikes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Dodges:</span>
                      <span className="font-bold text-purple-700">{latestRun.attacksDodged} dodges</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 text-center text-xs text-[#75787b] italic">
                    Launch a test duel to collect your first empirical &ldquo;After&rdquo; playtest dataset.
                  </div>
                )}
              </div>
            </div>

            {/* Step 4: Producer Reflection */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#003c6c] flex items-center gap-1.5">
                <FileText className="size-4" />
                Producer QA Reflection
              </label>
              <p className="mt-0.5 text-xs text-[#5a6a85]">
                How did your changes alter the fight? Did the player have readable dodge windows? (Winning is not required; creating a fair, readable fight is!).
              </p>
              <textarea
                value={balance.reflection || ''}
                onChange={(e) => updateSetting('reflection', e.target.value)}
                placeholder="e.g. By extending boss recovery to 0.9s and attack windup to 0.7s, the player was able to evade 3 telegraphed strikes and fight extended to 34s, giving real opportunities to punish."
                rows={3}
                className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-xs text-[#0b1d2e] outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Full History & Telemetry Log */}
      {activeTab === 'telemetry' && (
        <div className="flex flex-col gap-6">
          {/* Mathematical Model */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <span className="text-[10px] font-bold uppercase text-[#75787b]">Hero Hits To Win</span>
              <p className="font-mono text-xl font-bold text-[#003c6c]">{telemetry.hitsToDefeatBoss}</p>
              <span className="text-[10px] text-[#5a6a85]">Effective Dmg: {telemetry.effectiveHeroDamage}</span>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <span className="text-[10px] font-bold uppercase text-[#75787b]">Boss Hits To Defeat Hero</span>
              <p className="font-mono text-xl font-bold text-red-600">{telemetry.hitsToDefeatHero}</p>
              <span className="text-[10px] text-[#5a6a85]">Boss Strike: {boss.attackDamage}</span>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <span className="text-[10px] font-bold uppercase text-[#75787b]">Boss Recovery Rating</span>
              <p className="font-mono text-sm font-bold text-purple-700">{telemetry.bossRecoveryRating}</p>
              <span className="text-[10px] text-[#5a6a85]">Punish window rating</span>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <span className="text-[10px] font-bold uppercase text-[#75787b]">Expected Fight Duration</span>
              <p className="font-mono text-xl font-bold text-emerald-700">{telemetry.expectedDurationEstimate}</p>
              <span className="text-[10px] text-[#5a6a85]">Mathematical estimate</span>
            </div>
          </div>

          {/* Observations from latest run */}
          {observations.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-[#003c6c] mb-2">
                Factual Post-Test Observations
              </h3>
              <ul className="space-y-1.5 text-xs text-[#475569]">
                {observations.map((obs, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono text-emerald-600 font-bold">•</span>
                    <span>{obs}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-sans text-base font-bold text-[#003c6c] flex items-center gap-2">
                <History className="size-4 text-[#f29813]" />
                Historical Combat Telemetry
              </h2>
              <span className="text-xs text-[#75787b]">{playtestHistory.length} attempts recorded</span>
            </div>

          {playtestHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-[#75787b]">
                  <tr>
                    <th className="py-2.5 px-3">Run</th>
                    <th className="py-2.5 px-3">Outcome</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Damage Dealt</th>
                    <th className="py-2.5 px-3">Damage Taken</th>
                    <th className="py-2.5 px-3">Hits (L / R)</th>
                    <th className="py-2.5 px-3">Dodges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {playtestHistory.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-[#003c6c]">#{run.attemptNumber}</td>
                      <td className="py-2 px-3">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${run.winner === 'player' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {run.winner === 'player' ? 'Victory' : 'Defeat'}
                        </span>
                      </td>
                      <td className="py-2 px-3">{run.durationSeconds}s</td>
                      <td className="py-2 px-3 text-emerald-700">{run.heroDamageDealt}</td>
                      <td className="py-2 px-3 text-red-600">{run.bossDamageDealt}</td>
                      <td className="py-2 px-3">{run.hitsLanded} / {run.hitsReceived}</td>
                      <td className="py-2 px-3 text-purple-700">{run.attacksDodged}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[#75787b]">No playtests recorded yet.</div>
          )}
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-xs text-[#75787b]">
          {!canComplete
            ? 'Action required: Select a hypothesis, run a test duel, and write your QA reflection.'
            : 'Balance investigation completed.'}
        </span>
        <button
          type="button"
          onClick={onNextRole}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003c6c] px-4 py-2 text-xs font-bold text-white hover:bg-[#002b4d] shadow-xs cursor-pointer"
        >
          <span>Enter Live Playtest</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
