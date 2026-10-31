import { Sparkles } from 'lucide-react'
import type { AbilityType, HeroConfig, WeaponType } from '../../types/project'

interface DevCombatControlsProps {
  hero: HeroConfig
  onSwapWeapon(weapon: WeaponType): void
  onSwapAbility(ability: AbilityType): void
  onInstantDefeatBoss(): void
  onRestart(): void
  godMode: boolean
  onToggleGodMode(): void
  showHitboxes: boolean
  onToggleHitboxes(): void
}

export function DevCombatControls({
  hero,
  onSwapWeapon,
  onSwapAbility,
  onInstantDefeatBoss,
  onRestart,
  godMode,
  onToggleGodMode,
  showHitboxes,
  onToggleHitboxes,
}: DevCombatControlsProps) {
  return (
    <div className="absolute top-20 right-4 z-40 w-56 rounded-2xl border border-emerald-500/40 bg-slate-950/90 p-3.5 text-white shadow-2xl backdrop-blur-md text-xs select-none">
      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
        <span className="font-mono text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
          <Sparkles className="size-3" />
          Dev Sandbox Mode
        </span>
        <button
          type="button"
          onClick={onRestart}
          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
        >
          Reset Duel
        </button>
      </div>

      {/* Quick Weapon Swap */}
      <div className="mt-2.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase">Weapon Loadout</span>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {(['sword', 'blaster', 'hammer'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onSwapWeapon(w)}
              className={`rounded-lg py-1 text-[10px] font-bold uppercase transition cursor-pointer border ${
                hero.weapon === w
                  ? 'border-cyan-400 bg-cyan-500/30 text-cyan-200'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Ability Swap */}
      <div className="mt-2.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase">Special Ability</span>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {(['dash', 'shield', 'heal'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onSwapAbility(a)}
              className={`rounded-lg py-1 text-[10px] font-bold uppercase transition cursor-pointer border ${
                hero.ability === a
                  ? 'border-purple-400 bg-purple-500/30 text-purple-200'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="mt-3 flex flex-col gap-1.5 border-t border-slate-800 pt-2.5">
        <button
          type="button"
          onClick={onToggleGodMode}
          className={`flex items-center justify-between rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer border ${
            godMode
              ? 'border-amber-400 bg-amber-500/20 text-amber-300'
              : 'border-slate-800 bg-slate-900 text-slate-400'
          }`}
        >
          <span>Invincible (God Mode)</span>
          <span className="font-mono text-[10px]">{godMode ? 'ON' : 'OFF'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleHitboxes}
          className={`flex items-center justify-between rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer border ${
            showHitboxes
              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
              : 'border-slate-800 bg-slate-900 text-slate-400'
          }`}
        >
          <span>Show Hitboxes</span>
          <span className="font-mono text-[10px]">{showHitboxes ? 'ON' : 'OFF'}</span>
        </button>

        <button
          type="button"
          onClick={onInstantDefeatBoss}
          className="rounded-lg bg-red-600/30 border border-red-500/40 py-1 text-[11px] font-bold text-red-200 hover:bg-red-600/50 cursor-pointer"
        >
          Instant Defeat Boss
        </button>
      </div>
    </div>
  )
}
