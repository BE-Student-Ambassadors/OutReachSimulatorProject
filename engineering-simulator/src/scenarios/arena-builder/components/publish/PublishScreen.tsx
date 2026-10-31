import {
  Code2,
  Gamepad2,
  MapPin,
  Play,
  RotateCcw,
  Scale,
  Trophy,
} from 'lucide-react'
import { ABILITY_SPECS, WEAPON_SPECS } from '../../data/heroCatalog'
import { BOSS_ATTACK_SPECS } from '../../data/bossCatalog'
import { ARENA_COLS, ARENA_ROWS, TILE_SPECS } from '../../data/arenaCatalog'
import type { ActiveTab, TeamGameProject } from '../../types/project'

interface PublishScreenProps {
  project: TeamGameProject
  onPlayFinalGame(): void
  onNavigate(tab: ActiveTab): void
  onRestartProject(): void
}

export function PublishScreen({
  project,
  onPlayFinalGame,
  onNavigate,
  onRestartProject,
}: PublishScreenProps) {
  const { hero, boss, arena, playtestHistory } = project
  const weaponSpec = WEAPON_SPECS[hero.weapon]
  const abilitySpec = ABILITY_SPECS[hero.ability]
  const attackSpec = BOSS_ATTACK_SPECS[boss.behavior.attackType]

  const totalRuns = playtestHistory.length
  const victories = playtestHistory.filter((r) => r.winner === 'player').length

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-y-auto p-6 text-[#0b1d2e]">
      {/* Published Hero Banner */}
      <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[#003c6c]/5 to-purple-500/10 p-8 shadow-sm text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-amber-800 border border-amber-500/40">
          <Trophy className="size-4 text-amber-600" />
          Game Published & Demo Ready
        </div>

        <h1 className="mt-3 font-sans text-4xl font-black text-[#003c6c]">
          {project.gameTitle}
        </h1>
        <p className="mt-1 text-base font-semibold text-[#5a6a85]">
          A 2D Arena Boss Fight Engineered by <span className="text-[#003c6c] font-black">{project.studioName}</span>
        </p>

        {/* Big Action Buttons */}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onPlayFinalGame}
            className="inline-flex items-center gap-2.5 rounded-2xl bg-[#008542] px-8 py-3.5 text-sm font-black text-white hover:bg-[#006e36] shadow-lg transition active:translate-y-0.5 cursor-pointer"
          >
            <Play className="size-5 fill-current" />
            <span>Play Final Game</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            Edit Studio & Roles
          </button>

          <button
            type="button"
            onClick={onRestartProject}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-300 bg-red-50/50 px-5 py-3.5 text-xs font-bold text-red-700 hover:bg-red-100 shadow-xs cursor-pointer"
          >
            <RotateCcw className="size-4" />
            Restart Activity
          </button>
        </div>
      </div>

      {/* 3 Showcase Pillars (Hero, Boss, Arena) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Hero Card */}
        <div className="rounded-2xl border border-cyan-500/30 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-cyan-100 pb-2.5">
              <span className="text-xs font-bold text-cyan-800 flex items-center gap-1.5">
                <Gamepad2 className="size-4" />
                Hero Specifications
              </span>
              <span className="rounded bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-800">
                {weaponSpec.name}
              </span>
            </div>

            <div className="mt-3">
              <div className="font-sans text-xl font-black text-[#003c6c]">{hero.name}</div>
              <div className="text-xs text-[#5a6a85] mt-0.5">Special Ability: {abilitySpec.name}</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-[#75787b]">HEALTH</span>
                <div className="font-bold text-[#003c6c]">{hero.maxHealth} HP</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-[#75787b]">SPEED</span>
                <div className="font-bold text-[#003c6c]">{hero.moveSpeed} px/s</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-[#75787b]">DAMAGE</span>
                <div className="font-bold text-[#003c6c]">
                  {Math.round(hero.attackDamage * weaponSpec.damageMultiplier)} dmg
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-[#75787b]">COOLDOWN</span>
                <div className="font-bold text-[#003c6c]">
                  {(hero.attackCooldown * weaponSpec.cooldownModifier).toFixed(2)}s
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('gameplay')}
            className="mt-4 text-left text-xs font-semibold text-cyan-700 hover:underline cursor-pointer"
          >
            Adjust Hero →
          </button>
        </div>

        {/* Boss Card */}
        <div className="rounded-2xl border border-red-500/30 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-red-100 pb-2.5">
              <span className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                <Code2 className="size-4" />
                Boss AI Profile
              </span>
              <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                {attackSpec.name}
              </span>
            </div>

            <div className="mt-3">
              <div className="font-sans text-xl font-black text-[#003c6c]">{boss.name}</div>
              <div className="text-xs text-[#5a6a85] mt-0.5">Pattern: {attackSpec.shape} attack</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-[#75787b]">HEALTH</span>
                <div className="font-bold text-red-600">{boss.maxHealth} HP</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-[#75787b]">STRIKE DMG</span>
                <div className="font-bold text-red-600">{boss.attackDamage} dmg</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-[#75787b]">WINDUP</span>
                <div className="font-bold text-[#003c6c]">{boss.behavior.attackWindup.toFixed(2)}s</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-[#75787b]">RECOVERY</span>
                <div className="font-bold text-emerald-700">{boss.behavior.recoveryDuration.toFixed(2)}s</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('programming')}
            className="mt-4 text-left text-xs font-semibold text-red-700 hover:underline cursor-pointer"
          >
            Adjust Boss AI →
          </button>
        </div>

        {/* Arena Minimap Preview Card */}
        <div className="rounded-2xl border border-emerald-500/30 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <MapPin className="size-4" />
                Battleground Minimap
              </span>
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                16x12 Arena
              </span>
            </div>

            {/* Minimap Grid */}
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-1.5 flex items-center justify-center">
              <div
                className="grid gap-[1px]"
                style={{
                  gridTemplateColumns: `repeat(${ARENA_COLS}, 11px)`,
                  gridTemplateRows: `repeat(${ARENA_ROWS}, 11px)`,
                }}
              >
                {arena.tiles.map((row, r) =>
                  row.map((tile, c) => {
                    const isPlayer = arena.playerSpawn.col === c && arena.playerSpawn.row === r
                    const isBoss = arena.bossSpawn.col === c && arena.bossSpawn.row === r
                    const spec = TILE_SPECS[tile]

                    return (
                      <div
                        key={`${c}-${r}`}
                        className="rounded-[1px]"
                        style={{
                          backgroundColor: isPlayer ? '#06b6d4' : isBoss ? '#ef4444' : spec.color,
                        }}
                      />
                    )
                  }),
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('arena')}
            className="mt-4 text-left text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
          >
            Edit Battlefield Map →
          </button>
        </div>
      </div>

      {/* Playtest Performance Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-base font-bold text-[#003c6c] flex items-center gap-2">
          <Scale className="size-4 text-purple-600" />
          Studio Playtest Records & QA Certifications
        </h2>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-[#75787b]">Total Duels Run</span>
            <div className="mt-1 font-mono text-2xl font-black text-[#003c6c]">{totalRuns}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-[#75787b]">Player Victories</span>
            <div className="mt-1 font-mono text-2xl font-black text-emerald-600">{victories}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-[#75787b]">Win Rate</span>
            <div className="mt-1 font-mono text-2xl font-black text-purple-600">
              {totalRuns > 0 ? `${Math.round((victories / totalRuns) * 100)}%` : '0%'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
