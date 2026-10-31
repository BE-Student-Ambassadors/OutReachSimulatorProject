import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Gamepad2,
  MapPin,
  Play,
  Scale,
  Sparkles,
  X,
} from 'lucide-react'
import { isHeroConfigValid } from '../../simulation/powerBudget'
import { validateBossConfig } from '../../simulation/bossFsm'
import { validateArenaLayout } from '../../simulation/arenaValidation'
import type { ActiveTab, TeamGameProject } from '../../types/project'

interface GameIntegrationModalProps {
  project: TeamGameProject
  isOpen: boolean
  onClose(): void
  onLaunchPlaytest(): void
  onNavigate(tab: ActiveTab): void
  devMode: boolean
}

export function GameIntegrationModal({
  project,
  isOpen,
  onClose,
  onLaunchPlaytest,
  onNavigate,
  devMode,
}: GameIntegrationModalProps) {
  if (!isOpen) return null

  const heroValidation = isHeroConfigValid(project.hero)
  const bossValidation = validateBossConfig(project.boss)
  const arenaValidation = validateArenaLayout(project.arena)
  const producerReady = Boolean(project.balance.targetDurationCategory)

  const heroReady = heroValidation.valid && project.roleCompletion.gameplay
  const bossReady = bossValidation.valid && project.roleCompletion.programming
  const arenaReady = arenaValidation.valid && project.roleCompletion.arena

  const allReady = devMode || (heroReady && bossReady && arenaReady && producerReady)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-[#0b1d2e] shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#003c6c]">
              <Sparkles className="size-3 text-[#f29813]" />
              System Integration Check
            </div>
            <h2 className="mt-0.5 font-sans text-xl font-black text-[#003c6c]">
              Pre-Combat Readiness Audit
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-3 text-xs text-[#5a6a85]">
          Before entering the arena, ensure all roles have compiled valid configurations that the 2D combat engine can execute.
        </p>

        {/* 4 Roles Checklist */}
        <div className="mt-4 flex flex-col gap-2.5">
          {/* Hero */}
          <div
            onClick={() => {
              onClose()
              onNavigate('gameplay')
            }}
            className={`flex items-center justify-between rounded-xl border p-3 transition cursor-pointer ${
              heroReady ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Gamepad2 className={`size-4 ${heroReady ? 'text-emerald-600' : 'text-amber-600'}`} />
              <div>
                <span className="text-xs font-bold text-[#003c6c]">Role 1: Hero Designer</span>
                <div className="text-[11px] text-[#5a6a85]">
                  {project.hero.name} · {project.hero.weapon} · {project.hero.ability}
                </div>
              </div>
            </div>
            {heroReady ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 className="size-3" /> Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                <AlertTriangle className="size-3" /> Needs Attention
              </span>
            )}
          </div>

          {/* Boss */}
          <div
            onClick={() => {
              onClose()
              onNavigate('programming')
            }}
            className={`flex items-center justify-between rounded-xl border p-3 transition cursor-pointer ${
              bossReady ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Code2 className={`size-4 ${bossReady ? 'text-emerald-600' : 'text-amber-600'}`} />
              <div>
                <span className="text-xs font-bold text-[#003c6c]">Role 2: Boss Programmer</span>
                <div className="text-[11px] text-[#5a6a85]">
                  {project.boss.name} · {project.boss.behavior.attackType}
                </div>
              </div>
            </div>
            {bossReady ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 className="size-3" /> Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                <AlertTriangle className="size-3" /> Needs Attention
              </span>
            )}
          </div>

          {/* Arena */}
          <div
            onClick={() => {
              onClose()
              onNavigate('arena')
            }}
            className={`flex items-center justify-between rounded-xl border p-3 transition cursor-pointer ${
              arenaReady ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MapPin className={`size-4 ${arenaReady ? 'text-emerald-600' : 'text-amber-600'}`} />
              <div>
                <span className="text-xs font-bold text-[#003c6c]">Role 3: Arena Designer</span>
                <div className="text-[11px] text-[#5a6a85]">
                  16x12 Grid · Spawns Reachable
                </div>
              </div>
            </div>
            {arenaReady ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 className="size-3" /> Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                <AlertTriangle className="size-3" /> Needs Attention
              </span>
            )}
          </div>

          {/* Balance */}
          <div
            onClick={() => {
              onClose()
              onNavigate('balance')
            }}
            className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/50 p-3 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Scale className="size-4 text-purple-600" />
              <div>
                <span className="text-xs font-bold text-[#003c6c]">Role 4: Producer Balance</span>
                <div className="text-[11px] text-[#5a6a85]">
                  Target: {project.balance.targetDurationCategory} duration
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
              <CheckCircle2 className="size-3" /> Initialized
            </span>
          </div>
        </div>

        {/* Dev Mode Banner */}
        {devMode && (
          <div className="mt-3 rounded-lg border border-emerald-400 bg-emerald-50 p-2.5 text-[11px] text-emerald-900 font-semibold flex items-center justify-between">
            <span>Dev Mode is Active: Readiness check bypassed for testing.</span>
            <span className="rounded bg-emerald-600 text-white px-1.5 py-0.2 text-[10px]">DEV</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Back to Studio
          </button>

          <button
            type="button"
            onClick={() => {
              onClose()
              onLaunchPlaytest()
            }}
            disabled={!allReady}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold shadow-md transition cursor-pointer ${
              allReady
                ? 'bg-[#008542] text-white hover:bg-[#006e36] active:translate-y-0.5'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Play className="size-4 fill-current" />
            <span>Launch Playtest Arena</span>
          </button>
        </div>
      </div>
    </div>
  )
}
