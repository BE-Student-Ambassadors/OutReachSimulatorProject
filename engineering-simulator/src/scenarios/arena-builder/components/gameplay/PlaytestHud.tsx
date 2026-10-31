import { Shield } from 'lucide-react'
import { ABILITY_SPECS, WEAPON_SPECS } from '../../data/heroCatalog'
import { BOSS_STATES } from '../../data/bossCatalog'
import type { BossConfig, HeroConfig } from '../../types/project'
import type { CombatSimulation } from '../../simulation/combatEngine'

interface PlaytestHudProps {
  hero: HeroConfig
  boss: BossConfig
  sim: CombatSimulation
  onTogglePause(): void
  isPaused: boolean
}

export function PlaytestHud({ hero, boss, sim, onTogglePause, isPaused }: PlaytestHudProps) {
  const heroHpPct = Math.max(0, Math.min(100, (sim.heroHp / hero.maxHealth) * 100))
  const bossHpPct = Math.max(0, Math.min(100, (sim.bossHp / boss.maxHealth) * 100))

  const weaponSpec = WEAPON_SPECS[hero.weapon]
  const abilitySpec = ABILITY_SPECS[hero.ability]
  const bossStateSpec = BOSS_STATES[sim.bossFsmState]

  const abilityCdPct = Math.max(0, Math.min(1, sim.heroAbilityCooldownTimer / abilitySpec.cooldownSeconds))

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 select-none">
      {/* Top Bar: Boss Health & Boss FSM State */}
      <div className="flex flex-col items-center">
        <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-white shadow-xl backdrop-blur-md">
          <div className="flex w-full items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-red-400 uppercase tracking-wider">{boss.name}</span>
              <span
                className="rounded-full px-2 py-0.2 font-mono text-[10px] font-bold uppercase tracking-wider border border-white/10"
                style={{ backgroundColor: `${bossStateSpec.color}33`, color: bossStateSpec.color }}
              >
                [{bossStateSpec.badgeText}]
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-slate-300">
                {Math.ceil(sim.bossHp)} / {boss.maxHealth} HP
              </span>
              <button
                type="button"
                onClick={onTogglePause}
                className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/80 hover:bg-white/20 hover:text-white cursor-pointer"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            </div>
          </div>

          {/* Boss HP Bar */}
          <div className="mt-2 h-3.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-700">
            <div
              className={`h-full transition-all duration-150 rounded-full ${
                sim.bossIsVulnerable
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-gradient-to-r from-red-600 to-rose-400'
              }`}
              style={{ width: `${bossHpPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Center Paused Banner */}
      {isPaused && (
        <div className="pointer-events-auto self-center rounded-xl border border-white/20 bg-slate-950/90 p-6 text-center text-white shadow-2xl backdrop-blur-md">
          <h2 className="font-sans text-xl font-black">Combat Paused</h2>
          <p className="mt-1 text-xs text-slate-400">Press Esc or Resume to continue the fight.</p>
          <button
            type="button"
            onClick={onTogglePause}
            className="mt-4 rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-500 cursor-pointer shadow-md"
          >
            Resume Battle
          </button>
        </div>
      )}

      {/* Bottom Bar: Hero Health, Ability Cooldown, Controls Help */}
      <div className="flex items-end justify-between">
        {/* Hero Card */}
        <div className="pointer-events-auto flex items-center gap-3.5 rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-white shadow-xl backdrop-blur-md">
          <div className="flex size-12 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-black text-sm">
            HERO
          </div>

          <div className="flex flex-col gap-1 w-48">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-cyan-300">{hero.name}</span>
              <span className="font-mono text-slate-300">
                {Math.ceil(sim.heroHp)} / {hero.maxHealth}
              </span>
            </div>

            {/* Health Bar */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-100 rounded-full"
                style={{ width: `${heroHpPct}%` }}
              />
            </div>

            {/* Active Buffs */}
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
              <span>{weaponSpec.name}</span>
              {sim.heroShieldActive && <span className="text-sky-300 font-bold">[SHIELD ACTIVE]</span>}
              {sim.heroDashing && <span className="text-purple-300 font-bold">[DASHING]</span>}
            </div>
          </div>

          {/* Ability Icon & Cooldown */}
          <div className="relative flex size-10 items-center justify-center rounded-xl border border-purple-500/40 bg-purple-950/60 text-purple-300">
            <Shield className="size-5" />
            {abilityCdPct > 0 && (
              <div
                className="absolute inset-0 rounded-xl bg-slate-950/80 flex items-center justify-center font-mono text-[11px] font-bold text-white"
              >
                {sim.heroAbilityCooldownTimer.toFixed(1)}s
              </div>
            )}
          </div>
        </div>

        {/* Controls Reminder Box */}
        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2 text-[11px] font-mono text-slate-300 backdrop-blur-xs">
          <span><kbd className="rounded bg-white/10 px-1 py-0.5">WASD</kbd> Move</span>
          <span className="text-white/20">·</span>
          <span><kbd className="rounded bg-white/10 px-1 py-0.5">Space</kbd> Attack</span>
          <span className="text-white/20">·</span>
          <span><kbd className="rounded bg-white/10 px-1 py-0.5">Shift</kbd> {abilitySpec.name}</span>
        </div>
      </div>
    </div>
  )
}
