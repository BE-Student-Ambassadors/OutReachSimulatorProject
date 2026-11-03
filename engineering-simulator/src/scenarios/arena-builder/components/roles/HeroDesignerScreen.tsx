import {
  ArrowRight,
  CheckCircle2,
  Crosshair,
  Heart,
  RotateCcw,
  Sparkles,
  Sword,
  Timer,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { ABILITY_SPECS, HERO_STAT_BOUNDS, TOTAL_HERO_POWER_BUDGET, WEAPON_SPECS } from '../../data/heroCatalog'
import { calculateHeroPower, isHeroConfigValid } from '../../simulation/powerBudget'
import type { AbilityType, HeroConfig, WeaponType } from '../../types/project'
import { CombatMechanicsLab } from './CombatMechanicsLab'

interface HeroDesignerScreenProps {
  hero: HeroConfig
  onUpdateHero(hero: HeroConfig): void
  onResetHero(): void
  onMarkComplete(): void
  isComplete: boolean
  onNextRole(): void
}

export function HeroDesignerScreen({
  hero,
  onUpdateHero,
  onResetHero,
  onMarkComplete,
  isComplete,
  onNextRole,
}: HeroDesignerScreenProps) {
  const [activeSubTab, setActiveSubTab] = useState<'puzzle' | 'creative'>('puzzle')

  const budget = calculateHeroPower(hero)
  const validation = isHeroConfigValid(hero)
  const isSolved = Boolean(hero.duelMysterySolved || hero.hitboxValidated)
  const canComplete = validation.valid && isSolved

  const updateStat = <K extends keyof HeroConfig>(key: K, val: HeroConfig[K]) => {
    onUpdateHero({ ...hero, [key]: val })
  }

  const weapons: WeaponType[] = ['sword', 'blaster', 'hammer']
  const abilities: AbilityType[] = ['dash', 'shield', 'heal']

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-y-auto p-6 text-[#0b1d2e]">
      {/* Role Header Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-50/70 via-white to-slate-50 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold text-cyan-800">
            <Sparkles className="size-3 text-cyan-600" />
            Role 1: Gameplay Designer
          </div>
          <h1 className="mt-1 font-sans text-2xl font-black text-[#003c6c]">The Unwinnable Duel</h1>
          <p className="mt-1 text-sm text-[#5a6a85]">
            Playtesters report Swift Striker dominates duels 100% of the time, yet both archetypes fail against different enemy types.
            Analyze frame data, recovery windows, and poise armor to restore combat parity!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetHero}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Reset Puzzle
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
            <span>{isComplete ? 'Combat Balanced ✓' : 'Validate & Mark Complete'}</span>
          </button>
        </div>
      </div>

      {/* Structured Navigation Pills: Puzzle vs Creative Studio */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('puzzle')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'puzzle'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <Crosshair className="size-3.5" />
          <span>1. The Unwinnable Duel (Challenge)</span>
          {isSolved && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
              Balanced ✓
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('creative')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'creative'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <Zap className="size-3.5" />
          <span>2. Creative Studio Mode (Attributes & Power Budget)</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-600">
            {budget.totalPowerUsed}/100
          </span>
        </button>
      </div>

      {/* View 1: The Unwinnable Duel Puzzle */}
      {activeSubTab === 'puzzle' && (
        <div className="flex flex-col gap-6">
          <CombatMechanicsLab
            hero={hero}
            onUpdateTuning={({ heavyEndlag, heavyPoiseStartup, heavyDashCancelWindow, swiftRecoveryGap, solved }) => {
              onUpdateHero({
                ...hero,
                heavyEndlag,
                heavyPoiseStartup,
                heavyDashCancelWindow,
                swiftRecoveryGap,
                duelMysterySolved: solved,
                hitboxValidated: solved,
              })
              if (solved && !isComplete) {
                onMarkComplete()
              }
            }}
            onResetPuzzle={onResetHero}
          />
        </div>
      )}

      {/* View 2: Creative Studio Mode (Preserved Hero Customization) */}
      {activeSubTab === 'creative' && (
        <div className="flex flex-col gap-6">
          {/* Power Budget HUD */}
          <div
            className={`rounded-2xl border p-5 shadow-xs transition ${
              budget.isOverBudget
                ? 'border-red-300 bg-red-50/70 text-red-950'
                : 'border-slate-200 bg-white text-[#0b1d2e]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#5a6a85]">
                  Power Budget Allocation
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-black">{budget.totalPowerUsed}</span>
                  <span className="text-sm text-[#5a6a85]">/ {TOTAL_HERO_POWER_BUDGET} pts</span>
                  {budget.isOverBudget && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                      OVER BUDGET by {budget.totalPowerUsed - TOTAL_HERO_POWER_BUDGET} pts
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-[#5a6a85]">
                <div>Base Hero Stats: {budget.speedPower + budget.healthPower + budget.damagePower + budget.cooldownPower} pts</div>
                <div>Weapon & Ability: {budget.weaponPower + budget.abilityPower} pts</div>
              </div>
            </div>

            {/* Visual Budget Progress Bar */}
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all duration-300 ${
                  budget.isOverBudget ? 'bg-red-500' : 'bg-gradient-to-r from-cyan-500 to-blue-600'
                }`}
                style={{ width: `${Math.min(100, (budget.totalPowerUsed / TOTAL_HERO_POWER_BUDGET) * 100)}%` }}
              />
            </div>
          </div>

          {/* Primary Attributes Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Health Slider */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="size-4 text-rose-500" />
                  <span className="text-sm font-bold text-[#003c6c]">Maximum Health</span>
                </div>
                <span className="font-mono text-base font-bold text-[#003c6c]">{hero.maxHealth} HP</span>
              </div>
              <input
                type="range"
                min={HERO_STAT_BOUNDS.maxHealth.min}
                max={HERO_STAT_BOUNDS.maxHealth.max}
                step={HERO_STAT_BOUNDS.maxHealth.step}
                value={hero.maxHealth}
                onChange={(e) => updateStat('maxHealth', Number(e.target.value))}
                className="mt-4 w-full accent-rose-500 cursor-pointer"
              />
              <div className="mt-2 flex justify-between text-[11px] text-[#5a6a85]">
                <span>{HERO_STAT_BOUNDS.maxHealth.min} (Fragile)</span>
                <span>{HERO_STAT_BOUNDS.maxHealth.max} (Tanky)</span>
              </div>
            </div>

            {/* Move Speed Slider */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-amber-500" />
                  <span className="text-sm font-bold text-[#003c6c]">Movement Speed</span>
                </div>
                <span className="font-mono text-base font-bold text-[#003c6c]">{hero.moveSpeed} px/s</span>
              </div>
              <input
                type="range"
                min={HERO_STAT_BOUNDS.moveSpeed.min}
                max={HERO_STAT_BOUNDS.moveSpeed.max}
                step={HERO_STAT_BOUNDS.moveSpeed.step}
                value={hero.moveSpeed}
                onChange={(e) => updateStat('moveSpeed', Number(e.target.value))}
                className="mt-4 w-full accent-amber-500 cursor-pointer"
              />
              <div className="mt-2 flex justify-between text-[11px] text-[#5a6a85]">
                <span>{HERO_STAT_BOUNDS.moveSpeed.min} (Heavy)</span>
                <span>{HERO_STAT_BOUNDS.moveSpeed.max} (Agile)</span>
              </div>
            </div>

            {/* Attack Damage Slider */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sword className="size-4 text-blue-500" />
                  <span className="text-sm font-bold text-[#003c6c]">Base Attack Damage</span>
                </div>
                <span className="font-mono text-base font-bold text-[#003c6c]">{hero.attackDamage} dmg</span>
              </div>
              <input
                type="range"
                min={HERO_STAT_BOUNDS.attackDamage.min}
                max={HERO_STAT_BOUNDS.attackDamage.max}
                step={HERO_STAT_BOUNDS.attackDamage.step}
                value={hero.attackDamage}
                onChange={(e) => updateStat('attackDamage', Number(e.target.value))}
                className="mt-4 w-full accent-blue-500 cursor-pointer"
              />
              <div className="mt-2 flex justify-between text-[11px] text-[#5a6a85]">
                <span>{HERO_STAT_BOUNDS.attackDamage.min} (Light)</span>
                <span>{HERO_STAT_BOUNDS.attackDamage.max} (Deadly)</span>
              </div>
            </div>

            {/* Attack Cooldown Slider */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="size-4 text-emerald-500" />
                  <span className="text-sm font-bold text-[#003c6c]">Attack Cooldown</span>
                </div>
                <span className="font-mono text-base font-bold text-[#003c6c]">{hero.attackCooldown}s</span>
              </div>
              <input
                type="range"
                min={HERO_STAT_BOUNDS.attackCooldown.min}
                max={HERO_STAT_BOUNDS.attackCooldown.max}
                step={HERO_STAT_BOUNDS.attackCooldown.step}
                value={hero.attackCooldown}
                onChange={(e) => updateStat('attackCooldown', Number(e.target.value))}
                className="mt-4 w-full accent-emerald-500 cursor-pointer"
              />
              <div className="mt-2 flex justify-between text-[11px] text-[#5a6a85]">
                <span>{HERO_STAT_BOUNDS.attackCooldown.min}s (Rapid)</span>
                <span>{HERO_STAT_BOUNDS.attackCooldown.max}s (Slow)</span>
              </div>
            </div>
          </div>

          {/* Weapon Archetype Selection */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="font-sans text-base font-bold text-[#003c6c]">Weapon Archetype</h3>
            <p className="mt-0.5 text-xs text-[#5a6a85]">
              Different weapons modify range, cooldown, and tactical engagement distance.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {weapons.map((wKey) => {
                const spec = WEAPON_SPECS[wKey]
                const isSelected = hero.weapon === wKey
                return (
                  <button
                    key={wKey}
                    type="button"
                    onClick={() => updateStat('weapon', wKey)}
                    className={`flex flex-col rounded-xl border p-4 text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-[#003c6c] bg-[#003c6c]/5 shadow-xs ring-2 ring-[#003c6c]'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#003c6c]">{spec.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                        {spec.damageMultiplier}x dmg
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#5a6a85]">{spec.description}</p>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-[#5a6a85]">
                      <span>Range: {spec.rangePx}px</span>
                      <span>{spec.rangeCategory}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Special Ability Selection */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="font-sans text-base font-bold text-[#003c6c]">Special Ability</h3>
            <p className="mt-0.5 text-xs text-[#5a6a85]">
              Activated using Shift key in combat. Provides tactical escape or defensive mitigation.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {abilities.map((aKey) => {
                const spec = ABILITY_SPECS[aKey]
                const isSelected = hero.ability === aKey
                return (
                  <button
                    key={aKey}
                    type="button"
                    onClick={() => updateStat('ability', aKey)}
                    className={`flex flex-col rounded-xl border p-4 text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-[#003c6c] bg-[#003c6c]/5 shadow-xs ring-2 ring-[#003c6c]'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#003c6c]">{spec.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                        {spec.cooldownSeconds}s cd
                      </span>
                    </div>
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
            <span className="font-bold text-emerald-700">✓ Role 1: Gameplay Designer Complete</span>
          ) : (
            <span>Solve &quot;The Unwinnable Duel&quot; to restore combat parity.</span>
          )}
        </div>

        <button
          type="button"
          onClick={onNextRole}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003c6c] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#002b4d] cursor-pointer"
        >
          <span>Next: Boss Programmer</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
