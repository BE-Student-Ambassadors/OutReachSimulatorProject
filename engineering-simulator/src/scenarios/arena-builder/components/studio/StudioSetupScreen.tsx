import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Gamepad2,
  MapPin,
  Play,
  Scale,
  Sparkles,
  Trophy,
} from 'lucide-react'
import type { ActiveTab, TeamGameProject } from '../../types/project'

interface StudioSetupScreenProps {
  project: TeamGameProject
  onUpdateStudio(studioName: string, gameTitle: string): void
  onSelectTab(tab: ActiveTab): void
  onOpenPlaytest(): void
  devMode: boolean
}

export function StudioSetupScreen({
  project,
  onUpdateStudio,
  onSelectTab,
  onOpenPlaytest,
  devMode,
}: StudioSetupScreenProps) {
  const roles = [
    {
      id: 'gameplay' as const,
      roleName: 'Role 1: Gameplay Designer',
      mission: 'Create the Hero',
      description: 'Tune movement speed, health, attack damage, and pick a signature weapon and special ability under a fixed power budget.',
      icon: Gamepad2,
      accent: 'border-cyan-500/30 bg-cyan-50/50',
      badgeColor: 'bg-cyan-100 text-cyan-800',
      complete: project.roleCompletion.gameplay,
    },
    {
      id: 'programming' as const,
      roleName: 'Role 2: Programmer',
      mission: 'Program Boss Behavior',
      description: 'Assemble finite-state machine logic blocks to program boss detection, chase speed, attack windups, and vulnerability windows.',
      icon: Code2,
      accent: 'border-amber-500/30 bg-amber-50/50',
      badgeColor: 'bg-amber-100 text-amber-800',
      complete: project.roleCompletion.programming,
    },
    {
      id: 'arena' as const,
      roleName: 'Role 3: Arena Designer',
      mission: 'Build the Battlefield',
      description: 'Place tactical walls, protective cover, and hazardous plasma floors on the grid. Ensure reachability between spawns.',
      icon: MapPin,
      accent: 'border-emerald-500/30 bg-emerald-50/50',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      complete: project.roleCompletion.arena,
    },
    {
      id: 'balance' as const,
      roleName: 'Role 4: Producer & Balance Tester',
      mission: 'Balance & Playtest',
      description: 'Set combat duration goals, examine time-to-kill metrics, review combat telemetry, and iterate until the boss fight is challenging yet fair.',
      icon: Scale,
      accent: 'border-purple-500/30 bg-purple-50/50',
      badgeColor: 'bg-purple-100 text-purple-800',
      complete: project.roleCompletion.balance,
    },
  ]

  const readyForCombat =
    devMode ||
    (project.roleCompletion.gameplay &&
      project.roleCompletion.programming &&
      project.roleCompletion.arena)

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-6 overflow-y-auto p-6 text-[#0b1d2e]">
      {/* Studio Header Card */}
      <div className="rounded-2xl border border-[#d8e0ea] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#003c6c]/10 px-3 py-1 text-xs font-bold text-[#003c6c]">
              <Sparkles className="size-3 text-[#f29813]" />
              Game Development Studio Workshop
            </div>
            <h1 className="mt-2 font-sans text-2xl font-black text-[#003c6c]">
              Design a Boss Fight That Is Challenging, But Fair.
            </h1>
            <p className="mt-1 text-sm text-[#5a6a85]">
              Four game developers unite to create a custom 2D arena game. Collaborate across roles, playtest in real time, and publish your studio’s creation.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onOpenPlaytest}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition cursor-pointer ${
                readyForCombat
                  ? 'bg-[#008542] text-white hover:bg-[#006e36] active:translate-y-0.5'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Play className="size-4 fill-current" />
              <span>{readyForCombat ? 'Enter Playtest Arena' : 'Configure Roles to Playtest'}</span>
            </button>

            {project.playtestHistory.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectTab('publish')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#f29813] bg-[#f29813]/10 px-4 py-3 text-sm font-bold text-[#f29813] hover:bg-[#f29813]/20 transition cursor-pointer"
              >
                <Trophy className="size-4" />
                <span>Showcase</span>
              </button>
            )}
          </div>
        </div>

        {/* Studio & Game Title Inputs */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-[#edf2f7] pt-5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#75787b]">
              Studio Name
            </label>
            <input
              type="text"
              value={project.studioName}
              onChange={(e) => onUpdateStudio(e.target.value, project.gameTitle)}
              placeholder="e.g. Slugs Game Studio"
              maxLength={32}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] bg-white px-3.5 py-2 text-sm font-bold text-[#0b1d2e] outline-none focus:border-[#003c6c] focus:ring-2 focus:ring-[#003c6c]/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#75787b]">
              Game Title
            </label>
            <input
              type="text"
              value={project.gameTitle}
              onChange={(e) => onUpdateStudio(project.studioName, e.target.value)}
              placeholder="e.g. Cyber Colosseum"
              maxLength={32}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] bg-white px-3.5 py-2 text-sm font-bold text-[#0b1d2e] outline-none focus:border-[#003c6c] focus:ring-2 focus:ring-[#003c6c]/20"
            />
          </div>
        </div>
      </div>

      {/* The 4 Collaborative Roles Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-sans text-base font-bold text-[#003c6c]">Studio Roles & Workspaces</h2>
          <span className="text-xs text-[#75787b]">Tap any role to open its workstation</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {roles.map((r) => {
            const Icon = r.icon
            return (
              <div
                key={r.id}
                onClick={() => onSelectTab(r.id)}
                className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition hover:shadow-md cursor-pointer ${
                  r.accent
                } ${r.complete ? 'ring-2 ring-emerald-500/40' : ''}`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-xs">
                        <Icon className="size-5 text-[#003c6c]" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#75787b]">{r.roleName}</span>
                        <h3 className="font-sans text-base font-black text-[#003c6c]">{r.mission}</h3>
                      </div>
                    </div>

                    {r.complete ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="size-3.5" />
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                        In Progress
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-[#475569] leading-relaxed">{r.description}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3">
                  <span className="text-xs font-semibold text-[#003c6c] group-hover:underline">Open Workspace</span>
                  <ArrowRight className="size-4 text-[#003c6c] transition group-hover:translate-x-1" />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Studio Educational Notice */}
      <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-white/60 p-4 text-xs text-[#5a6a85] flex items-center justify-between">
        <div>
          <span className="font-bold text-[#003c6c]">Core Design Rule: </span>
          Decisions made in every role propagate directly into the shared playable game engine. A slow hero, a wide boss cleave, and narrow wall chokepoints create emergent tactical combat!
        </div>
        <div className="hidden sm:block font-mono text-[11px] text-[#75787b]">
          DESIGN → BUILD → TEST → OBSERVE → IMPROVE
        </div>
      </div>
    </div>
  )
}
