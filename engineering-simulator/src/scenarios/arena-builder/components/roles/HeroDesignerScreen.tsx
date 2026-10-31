import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Crosshair,
  Heart,
  RotateCcw,
  Shield,
  Sparkles,
  Sword,
  Target,
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
  const [activeSubTab, setActiveSubTab] = useState<'mechanics' | 'attributes'>('mechanics')
  const [showBonusChallenge, setShowBonusChallenge] = useState(false)

  const budget = calculateHeroPower(hero)
  const validation = isHeroConfigValid(hero)
  const canComplete = validation.valid && hero.hitboxValidated

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
          <h1 className="mt-1 font-sans text-2xl font-black text-[#003c6c]">Hero Combat Mechanics Studio</h1>
          <p className="mt-1 text-sm text-[#5a6a85]">
            Diagnose and repair the hero’s broken attack hitbox in the testing room, then balance character stats under the studio power budget.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetHero}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Reset Hero
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
            <span>{isComplete ? 'Mechanics Approved ✓' : 'Approve Hero Build'}</span>
          </button>
        </div>
      </div>

      {/* Structured Game Dev Navigation Pills */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('mechanics')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'mechanics'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <Crosshair className="size-3.5" />
          <span>1. Combat Mechanics Lab</span>
          {hero.hitboxValidated && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] text-emerald-300">
              Repaired ✓
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('attributes')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'attributes'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <Zap className="size-3.5" />
          <span>2. Attributes & Power Budget</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-600">
            {budget.totalPowerUsed}/100
          </span>
        </button>
      </div>

      {/* View 1: Combat Mechanics Lab (Problem -> Investigate -> Experiment -> Test -> Validate) */}
      {activeSubTab === 'mechanics' && (
        <div className="flex flex-col gap-6">
          <CombatMechanicsLab
            hero={hero}
            onUpdateHitbox={(reach, arcDegrees, validated) => {
              onUpdateHero({
                ...hero,
                attackReach: reach,
                attackArcDegrees: arcDegrees,
                hitboxValidated: validated,
              })
            }}
          />

          {/* Optional Advanced Challenge */}
          <div className="rounded-xl border border-dashed border-cyan-300 bg-cyan-50/40 p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#003c6c] flex items-center gap-1.5">
                <Target className="size-4 text-cyan-600" />
                Optional Advanced Challenge: Test Second Weapon Against Moving Target
              </span>
              <button
                type="button"
                onClick={() => setShowBonusChallenge((b) => !b)}
                className="text-cyan-700 font-semibold underline cursor-pointer"
              >
                {showBonusChallenge ? 'Hide' : 'Expand Challenge'}
              </button>
            </div>
            {showBonusChallenge && (
              <p className="mt-2 text-[#475569] leading-relaxed">
                Toggle on the &ldquo;Moving Dummy&rdquo; patrol inside the testing room above. Switch your weapon to the Titan Maul (Hammer) or Pulse Rifle (Blaster) under the Attributes tab and verify how directional timing and projectile flight speed interact with moving opponents!
              </p>
            )}
          </div>
        </div>
      )}

      {/* View 2: Attributes, Weapons & Power Budget */}
      {activeSubTab === 'attributes' && (
        <div className="flex flex-col gap-6">
          {/* Power Budget HUD Meter */}
          <div
            className={`rounded-2xl border p-5 transition shadow-sm ${
              budget.isOverBudget
                ? 'border-red-500/40 bg-red-50/60'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#75787b]">Power Budget</span>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-mono text-3xl font-black ${
                      budget.isOverBudget ? 'text-red-600' : 'text-[#003c6c]'
                    }`}
                  >
                    {budget.totalPowerUsed}
                  </span>
                  <span className="font-mono text-sm text-[#75787b]">/ {TOTAL_HERO_POWER_BUDGET} pts available</span>
                </div>
              </div>

              <div className="text-xs font-semibold text-right">
                {budget.isOverBudget ? (
                  <span className="inline-flex items-center gap-1 font-bold text-red-600">
                    <AlertTriangle className="size-4" />
                    Over budget by {Math.abs(budget.remainingPower)} pts! Reduce some attributes.
                  </span>
                ) : (
                  <span className="text-emerald-700">
                    {budget.remainingPower} pts remaining for upgrades
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  budget.isOverBudget ? 'bg-red-500' : 'bg-gradient-to-r from-cyan-500 to-[#003c6c]'
                }`}
                style={{ width: `${Math.min(100, (budget.totalPowerUsed / TOTAL_HERO_POWER_BUDGET) * 100)}%` }}
              />
            </div>
          </div>

          {/* Attributes & Gear Columns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left: Core Attributes */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-5">
              <h2 className="font-sans text-base font-bold text-[#003c6c] flex items-center gap-2">
                <Zap className="size-4 text-[#f29813]" />
                Core Hero Attributes
              </h2>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#75787b]">
                  Hero Codename
                </label>
                <input
                  type="text"
                  value={hero.name}
                  onChange={(e) => updateStat('name', e.target.value)}
                  placeholder="e.g. Vanguard, Swiftblade"
                  maxLength={20}
                  className="mt-1 w-full rounded-lg border border-[#cbd5e1] bg-white px-3.5 py-2 text-sm font-bold text-[#0b1d2e] outline-none focus:border-[#003c6c] focus:ring-2 focus:ring-[#003c6c]/20"
                />
              </div>

              {/* Stat Sliders */}
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[#475569] flex items-center gap-1.5">
                      <Zap className="size-3.5 text-cyan-600" />
                      {HERO_STAT_BOUNDS.moveSpeed.label}
                    </span>
                    <span className="font-mono text-[#003c6c]">
                      {hero.moveSpeed} {HERO_STAT_BOUNDS.moveSpeed.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={HERO_STAT_BOUNDS.moveSpeed.min}
                    max={HERO_STAT_BOUNDS.moveSpeed.max}
                    step={HERO_STAT_BOUNDS.moveSpeed.step}
                    value={hero.moveSpeed}
                    onChange={(e) => updateStat('moveSpeed', Number(e.target.value))}
                    className="mt-1.5 w-full accent-cyan-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[#475569] flex items-center gap-1.5">
                      <Heart className="size-3.5 text-red-500" />
                      {HERO_STAT_BOUNDS.maxHealth.label}
                    </span>
                    <span className="font-mono text-[#003c6c]">
                      {hero.maxHealth} {HERO_STAT_BOUNDS.maxHealth.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={HERO_STAT_BOUNDS.maxHealth.min}
                    max={HERO_STAT_BOUNDS.maxHealth.max}
                    step={HERO_STAT_BOUNDS.maxHealth.step}
                    value={hero.maxHealth}
                    onChange={(e) => updateStat('maxHealth', Number(e.target.value))}
                    className="mt-1.5 w-full accent-red-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[#475569] flex items-center gap-1.5">
                      <Sword className="size-3.5 text-amber-500" />
                      {HERO_STAT_BOUNDS.attackDamage.label}
                    </span>
                    <span className="font-mono text-[#003c6c]">
                      {hero.attackDamage} {HERO_STAT_BOUNDS.attackDamage.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={HERO_STAT_BOUNDS.attackDamage.min}
                    max={HERO_STAT_BOUNDS.attackDamage.max}
                    step={HERO_STAT_BOUNDS.attackDamage.step}
                    value={hero.attackDamage}
                    onChange={(e) => updateStat('attackDamage', Number(e.target.value))}
                    className="mt-1.5 w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[#475569] flex items-center gap-1.5">
                      <Timer className="size-3.5 text-purple-500" />
                      {HERO_STAT_BOUNDS.attackCooldown.label}
                    </span>
                    <span className="font-mono text-[#003c6c]">
                      {hero.attackCooldown.toFixed(2)} {HERO_STAT_BOUNDS.attackCooldown.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={HERO_STAT_BOUNDS.attackCooldown.min}
                    max={HERO_STAT_BOUNDS.attackCooldown.max}
                    step={HERO_STAT_BOUNDS.attackCooldown.step}
                    value={hero.attackCooldown}
                    onChange={(e) => updateStat('attackCooldown', Number(e.target.value))}
                    className="mt-1.5 w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Right: Weapons & Abilities */}
            <div className="flex flex-col gap-6">
              {/* Weapons */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-sans text-base font-bold text-[#003c6c] flex items-center gap-2">
                  <Sword className="size-4 text-cyan-600" />
                  Signature Weapon Selection
                </h2>
                <div className="mt-4 flex flex-col gap-2.5">
                  {weapons.map((wKey) => {
                    const spec = WEAPON_SPECS[wKey]
                    const isSelected = hero.weapon === wKey
                    return (
                      <div
                        key={wKey}
                        onClick={() => updateStat('weapon', wKey)}
                        className={`rounded-xl border p-3.5 transition cursor-pointer ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-50/50 ring-2 ring-cyan-500/30'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#003c6c]">{spec.name}</span>
                          <span className="font-mono text-xs font-bold text-cyan-700">
                            {Math.round(hero.attackDamage * spec.damageMultiplier)} dmg
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#5a6a85]">{spec.description}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Abilities */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-sans text-base font-bold text-[#003c6c] flex items-center gap-2">
                  <Shield className="size-4 text-purple-600" />
                  Special Tactical Ability
                </h2>
                <div className="mt-4 flex flex-col gap-2.5">
                  {abilities.map((aKey) => {
                    const spec = ABILITY_SPECS[aKey]
                    const isSelected = hero.ability === aKey
                    return (
                      <div
                        key={aKey}
                        onClick={() => updateStat('ability', aKey)}
                        className={`rounded-xl border p-3.5 transition cursor-pointer ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50/50 ring-2 ring-purple-500/30'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#003c6c]">{spec.name}</span>
                          <span className="font-mono text-xs font-bold text-purple-700">{spec.cooldownSeconds}s cooldown</span>
                        </div>
                        <p className="mt-1 text-xs text-[#5a6a85]">{spec.description}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-xs text-[#75787b]">
          {!hero.hitboxValidated
            ? 'Action required: Complete Combat Mechanics Lab to repair and validate attack hitbox.'
            : !validation.valid
              ? validation.reason
              : 'Hero build & combat mechanics are fully validated.'}
        </span>
        <button
          type="button"
          onClick={onNextRole}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003c6c] px-4 py-2 text-xs font-bold text-white hover:bg-[#002b4d] shadow-xs cursor-pointer"
        >
          <span>Next: Program Boss AI</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
