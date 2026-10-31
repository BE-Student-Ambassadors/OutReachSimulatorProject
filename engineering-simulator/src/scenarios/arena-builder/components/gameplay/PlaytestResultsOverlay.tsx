import {
  Code2,
  Gamepad2,
  MapPin,
  RotateCcw,
  Scale,
  ShieldAlert,
  Trophy,
} from 'lucide-react'
import { generatePlaytestObservations } from '../../simulation/balanceMath'
import type { ActiveTab, BossConfig, HeroConfig, PlaytestResult } from '../../types/project'

interface PlaytestResultsOverlayProps {
  result: PlaytestResult
  hero: HeroConfig
  boss: BossConfig
  onRetry(): void
  onNavigate(tab: ActiveTab): void
  onPublish(): void
}

export function PlaytestResultsOverlay({
  result,
  hero,
  boss,
  onRetry,
  onNavigate,
  onPublish,
}: PlaytestResultsOverlayProps) {
  const isVictory = result.winner === 'player'
  const observations = generatePlaytestObservations(result, hero, boss)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-slate-950 p-6 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Banner */}
        <div className="text-center">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-black uppercase tracking-widest ${
              isVictory ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
            }`}
          >
            {isVictory ? <Trophy className="size-4" /> : <ShieldAlert className="size-4" />}
            {isVictory ? 'Victory! Boss Defeated' : 'Defeat! Hero Knocked Out'}
          </div>

          <h2 className="mt-2 font-sans text-3xl font-black">
            {isVictory ? 'Combat Simulation Passed' : 'Combat Simulation Ended'}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Fight Duration: <span className="font-mono text-white font-bold">{result.durationSeconds}s</span> · Attempt #{result.attemptNumber}
          </p>
        </div>

        {/* Telemetry Stats Grid */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-400">Damage Dealt</span>
            <div className="mt-1 font-mono text-xl font-black text-emerald-400">
              {result.heroDamageDealt}
            </div>
            <div className="text-[10px] text-slate-500">{result.hitsLanded} hits landed</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-400">Damage Taken</span>
            <div className="mt-1 font-mono text-xl font-black text-red-400">
              {result.bossDamageDealt}
            </div>
            <div className="text-[10px] text-slate-500">{result.hitsReceived} hits taken</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-400">Attacks Dodged</span>
            <div className="mt-1 font-mono text-xl font-black text-purple-400">
              {result.attacksDodged}
            </div>
            <div className="text-[10px] text-slate-500">evaded telegraphs</div>
          </div>
        </div>

        {/* Factual Post-Test Observations */}
        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-cyan-400">
            Empirical Match Observations
          </h3>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
            {observations.map((obs, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>{obs}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons: Iteration Loop */}
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 text-xs font-bold text-white hover:bg-cyan-500 shadow-md cursor-pointer transition active:translate-y-0.5"
            >
              <RotateCcw className="size-4" />
              <span>Retry Duel</span>
            </button>

            <button
              type="button"
              onClick={onPublish}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 shadow-md cursor-pointer transition active:translate-y-0.5"
            >
              <Trophy className="size-4" />
              <span>Publish Finished Game</span>
            </button>
          </div>

          {/* Quick jump to edit any role */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => onNavigate('gameplay')}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-2 text-[10px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <Gamepad2 className="size-3.5 text-cyan-400" />
              <span>Edit Hero</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('programming')}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-2 text-[10px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <Code2 className="size-3.5 text-amber-400" />
              <span>Edit Boss AI</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('arena')}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-2 text-[10px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <MapPin className="size-3.5 text-emerald-400" />
              <span>Edit Arena</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('balance')}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-2 text-[10px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <Scale className="size-3.5 text-purple-400" />
              <span>Balance Lab</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
