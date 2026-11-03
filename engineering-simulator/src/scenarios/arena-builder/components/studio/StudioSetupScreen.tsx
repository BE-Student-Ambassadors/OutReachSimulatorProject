import {
  ArrowRight,
  Bug,
  CheckCircle2,
  Code2,
  Compass,
  Play,
  Sparkles,
  Sword,
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
      puzzleTitle: 'The Unwinnable Duel',
      mission: 'Restore Combat Parity',
      problem: 'Swift Striker dominates 100% of duels, but both classes fail against different monsters.',
      description: 'Analyze frame data, vulnerability windows (endlag), and poise armor to restore competitive symmetry.',
      icon: Sword,
      accent: 'border-cyan-500/30 bg-cyan-50/50',
      badgeColor: 'bg-cyan-100 text-cyan-800',
      complete: project.roleCompletion.gameplay,
    },
    {
      id: 'programming' as const,
      roleName: 'Role 2: Gameplay Programmer',
      puzzleTitle: 'The Broken Boss',
      mission: 'Stabilize AI Decision Graph',
      problem: 'Boss behaves properly in simple frontal tests, but stalls in real combat scenarios.',
      description: 'Repair state machine transitions, line-of-sight checks, and phase-2 triggers to pass multi-scenario regression.',
      icon: Code2,
      accent: 'border-indigo-500/30 bg-indigo-50/50',
      badgeColor: 'bg-indigo-100 text-indigo-800',
      complete: project.roleCompletion.programming,
    },
    {
      id: 'arena' as const,
      roleName: 'Role 3: Level Designer',
      puzzleTitle: 'The Three-Wall Challenge',
      mission: 'Spatial Arena Optimization',
      problem: 'Zero navigation exists, but removing central walls creates fatal funnels and cheese safe-spots.',
      description: 'Satisfy pathfinding, dodge space, hazard isolation, and cheese-free combat within 3 wall edits.',
      icon: Compass,
      accent: 'border-emerald-500/30 bg-emerald-50/50',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      complete: project.roleCompletion.arena,
    },
    {
      id: 'balance' as const,
      roleName: 'Role 4: QA Tester & Producer',
      puzzleTitle: 'The Intermittent Bug',
      mission: 'Isolate Multi-Factor Glitch',
      problem: 'Sporadic 400% lethal damage spike occurs in ~10% of matches. Root cause unknown.',
      description: 'Use a 6-run experiment budget to isolate the 3-condition trigger, formulate hypothesis, and verify engine patch.',
      icon: Bug,
      accent: 'border-purple-500/30 bg-purple-50/50',
      badgeColor: 'bg-purple-100 text-purple-800',
      complete: project.roleCompletion.balance,
    },
  ]

  const allPuzzlesSolved =
    project.roleCompletion.gameplay &&
    project.roleCompletion.programming &&
    project.roleCompletion.arena &&
    project.roleCompletion.balance

  const readyForCombat = devMode || allPuzzlesSolved

  const completedCount = [
    project.roleCompletion.gameplay,
    project.roleCompletion.programming,
    project.roleCompletion.arena,
    project.roleCompletion.balance,
  ].filter(Boolean).length

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-6 overflow-y-auto p-6 text-[#0b1d2e]">
      {/* Studio Header Card */}
      <div className="rounded-2xl border border-[#d8e0ea] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#003c6c]/10 px-3 py-1 text-xs font-bold text-[#003c6c]">
              <Sparkles className="size-3 text-[#003c6c]" />
              Engineering Studio Mission
            </div>
            <h1 className="mt-2 font-sans text-2xl font-black tracking-tight text-[#003c6c] md:text-3xl">
              Slugs Game Studio: Four Development Brain Teasers
            </h1>
            <p className="mt-1 text-sm text-[#5a6a85]">
              Your studio inherited a partially completed 2D action game with four critical engineering defects.
              Divide the problems across the four roles, experiment in isolated test chambers, and integrate the final release build!
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5a6a85]">Studio Readiness:</span>
              <span className="font-mono text-sm font-black text-[#003c6c]">{completedCount} / 4 Solved</span>
            </div>
            <button
              type="button"
              onClick={onOpenPlaytest}
              disabled={!readyForCombat}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer ${
                readyForCombat
                  ? 'bg-[#003c6c] text-white hover:bg-[#002b4d]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Play className="size-4" />
              <span>Launch Release Playtest</span>
            </button>
          </div>
        </div>

        {/* Studio Meta Customization Inputs */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-[#5a6a85]">Studio Name</label>
            <input
              type="text"
              value={project.studioName}
              onChange={(e) => onUpdateStudio(e.target.value, project.gameTitle)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#0b1d2e] focus:border-[#003c6c] focus:outline-hidden"
              placeholder="e.g. Slugs Game Studio"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#5a6a85]">Release Title</label>
            <input
              type="text"
              value={project.gameTitle}
              onChange={(e) => onUpdateStudio(project.studioName, e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#0b1d2e] focus:border-[#003c6c] focus:outline-hidden"
              placeholder="e.g. Cyber Colosseum"
            />
          </div>
        </div>
      </div>

      {/* Four Engineering Challenge Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {roles.map((r, idx) => {
          const Icon = r.icon
          return (
            <div
              key={r.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition hover:shadow-md ${
                r.complete ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#5a6a85]">
                    {r.roleName}
                  </span>
                  {r.complete ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="size-3 text-emerald-600" />
                      Repaired ✓
                    </span>
                  ) : (
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
                      Defect Active
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-start gap-3">
                  <div className="rounded-xl bg-[#003c6c]/10 p-2.5 text-[#003c6c]">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-sans text-lg font-black text-[#003c6c]">{r.puzzleTitle}</h3>
                    <p className="mt-1 text-xs font-medium text-rose-700">Problem: {r.problem}</p>
                    <p className="mt-1.5 text-xs text-[#5a6a85] leading-relaxed">{r.description}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-bold text-[#003c6c]">{r.mission}</span>
                <button
                  type="button"
                  onClick={() => onSelectTab(r.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#003c6c] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#002b4d] cursor-pointer"
                >
                  <span>{r.complete ? 'Review Challenge' : `Start Challenge ${idx + 1}`}</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Integration Readiness Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-sans text-base font-bold text-[#003c6c]">Game Integration & Launch Gate</h3>
            <p className="mt-1 text-xs text-[#5a6a85]">
              {allPuzzlesSolved
                ? 'All four engineering puzzles have been verified! The combined system is ready for release playtesting.'
                : 'Solve each development challenge with your team. Once all four are verified, launch the final integrated combat game.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenPlaytest}
            disabled={!readyForCombat}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer ${
              readyForCombat
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Play className="size-4" />
            <span>{allPuzzlesSolved ? 'Launch Release Playtest' : 'Integration Gate Locked'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
