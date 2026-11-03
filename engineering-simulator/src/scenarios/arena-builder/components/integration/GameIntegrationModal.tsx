import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Code2,
  Compass,
  Play,
  Sparkles,
  Sword,
  X,
} from 'lucide-react'
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

  const heroReady = project.roleCompletion.gameplay && Boolean(project.hero.duelMysterySolved || project.hero.hitboxValidated)
  const bossReady = project.roleCompletion.programming && Boolean(project.boss.behavior.behaviorGraphValidated || project.boss.behavior.bugResolved)
  const arenaReady = project.roleCompletion.arena && Boolean(project.arena.spatialPuzzleSolved || project.arena.hasTestedWalk)
  const qaReady = project.roleCompletion.balance && Boolean(project.qa.intermittentBugSolved || project.qa.bugFixed)

  const allReady = devMode || (heroReady && bossReady && arenaReady && qaReady)

  const items = [
    {
      role: 'gameplay' as const,
      label: 'Role 1: Gameplay Designer',
      title: 'The Unwinnable Duel',
      ready: heroReady,
      icon: Sword,
      detail: heroReady
        ? 'Combat parity restored: endlag and poise armor tuned'
        : 'Severe endlag or infinite stun-lock breaking combat parity',
    },
    {
      role: 'programming' as const,
      label: 'Role 2: Gameplay Programmer',
      title: 'The Broken Boss',
      ready: bossReady,
      icon: Code2,
      detail: bossReady
        ? 'Behavior graph verified across all combat scenarios & regression'
        : 'Boss AI stalls on roll-behind or shoots solid stone walls',
    },
    {
      role: 'arena' as const,
      label: 'Role 3: Level Designer',
      title: 'The Three-Wall Challenge',
      ready: arenaReady,
      icon: Compass,
      detail: arenaReady
        ? 'Arena navigable, dodge corridors clear, zero cheese safe spots'
        : 'Arena impassable or contains fatal chokepoints/cheese alcoves',
    },
    {
      role: 'balance' as const,
      label: 'Role 4: QA Tester & Producer',
      title: 'The Intermittent Bug',
      ready: qaReady,
      icon: Bug,
      detail: qaReady
        ? 'Wall-bounce rebound immunity verified across regression suite'
        : 'Multi-factor collision defect causes 400% damage spikes',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#003c6c]/10 text-[#003c6c]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="font-sans text-xl font-black text-[#003c6c]">Team Integration Verification</h2>
              <p className="text-xs text-[#5a6a85]">Auditing four engineering puzzle solutions before launch</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Audit Checklist */}
        <div className="space-y-3 overflow-y-auto p-6">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.role}
                className={`flex items-center justify-between rounded-2xl border p-4 transition ${
                  item.ready
                    ? 'border-emerald-200 bg-emerald-50/50 text-[#0b1d2e]'
                    : 'border-rose-200 bg-rose-50/50 text-rose-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                      item.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-sm font-bold text-[#003c6c]">{item.title}</span>
                      <span className="text-[11px] text-[#5a6a85]">({item.label})</span>
                    </div>
                    <p className={`mt-0.5 text-xs ${item.ready ? 'text-emerald-800' : 'text-rose-700 font-medium'}`}>
                      {item.detail}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.ready ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      Repaired
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onNavigate(item.role)
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
                    >
                      <AlertTriangle className="size-3.5" />
                      <span>Investigate</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Launch Gate Action */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-6">
          <div className="text-xs text-[#5a6a85]">
            {allReady ? (
              <span className="font-bold text-emerald-700">✓ All 4 studio repairs verified! Build ready for release.</span>
            ) : (
              <span>All 4 problems must be repaired before the release playtest can run.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
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
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                allReady ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed opacity-60'
              }`}
            >
              <Play className="size-4" />
              <span>Launch Release Game</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
