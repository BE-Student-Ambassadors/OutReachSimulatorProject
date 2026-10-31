import {
  CheckCircle2,
  Code2,
  Gamepad2,
  Layers,
  MapPin,
  Play,
  RotateCcw,
  Scale,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useState } from 'react'
import { gameAudio } from '../audio/gameAudio'
import type { ActiveTab, TeamGameProject } from '../types/project'

interface ArenaBuilderShellProps {
  project: TeamGameProject
  activeTab: ActiveTab
  onSelectTab(tab: ActiveTab): void
  onResetProject(): void
  devMode: boolean
  onToggleDevMode(): void
}

export function ArenaBuilderShell({
  project,
  activeTab,
  onSelectTab,
  onResetProject,
  devMode,
  onToggleDevMode,
}: ArenaBuilderShellProps) {
  const [muted, setMuted] = useState(() => gameAudio.isMuted())
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const toggleSound = () => {
    const next = !muted
    setMuted(next)
    gameAudio.setMuted(next)
    try {
      localStorage.setItem('besa-sound-muted', next ? '1' : '0')
    } catch {
      // storage unavailable
    }
  }

  const roleTabs: Array<{ id: ActiveTab; label: string; icon: typeof Gamepad2; complete?: boolean }> = [
    { id: 'studio', label: 'Studio Studio', icon: Layers },
    { id: 'gameplay', label: '1. Hero Design', icon: Gamepad2, complete: project.roleCompletion.gameplay },
    { id: 'programming', label: '2. Boss AI', icon: Code2, complete: project.roleCompletion.programming },
    { id: 'arena', label: '3. Arena Design', icon: MapPin, complete: project.roleCompletion.arena },
    { id: 'balance', label: '4. Balance Lab', icon: Scale, complete: project.roleCompletion.balance },
    { id: 'playtest', label: 'Playtest Combat', icon: Play },
    { id: 'publish', label: 'Publish Game', icon: Trophy, complete: project.published },
  ]

  const totalRolesDone = [
    project.roleCompletion.gameplay,
    project.roleCompletion.programming,
    project.roleCompletion.arena,
    project.roleCompletion.balance,
  ].filter(Boolean).length

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#002b4d]/20 bg-[#003c6c] px-4 text-white shadow-md select-none">
      {/* Studio Branding & Titles */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#f29813] text-white shadow-xs font-black">
            <Gamepad2 className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#fdc700]">Arena Builder</span>
              {devMode && (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-300 border border-emerald-400/30">
                  DEV MODE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-white leading-tight">
              <span>{project.gameTitle || 'Untitled Game'}</span>
              <span className="text-white/40">·</span>
              <span className="text-xs font-normal text-white/70">{project.studioName || 'Game Studio'}</span>
            </div>
          </div>
        </div>

        {/* Global Progress Pill */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/90">
          <Sparkles className="size-3 text-[#fdc700]" />
          <span>{totalRolesDone}/4 Roles Ready</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 overflow-x-auto py-1">
        {roleTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white text-[#003c6c] shadow-xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
              {tab.complete && (
                <CheckCircle2 className={`size-3 ${isActive ? 'text-emerald-600' : 'text-emerald-400'}`} />
              )}
            </button>
          )
        })}
      </nav>

      {/* Global Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleDevMode}
          title={devMode ? 'Disable Dev Mode' : 'Enable Dev Mode (?dev=true)'}
          className={`rounded-lg px-2 py-1 text-xs font-bold transition cursor-pointer border ${
            devMode
              ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200'
              : 'border-white/20 bg-white/5 text-white/60 hover:text-white'
          }`}
        >
          Dev
        </button>

        <button
          type="button"
          onClick={toggleSound}
          title={muted ? 'Unmute' : 'Mute'}
          className="flex size-8 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white cursor-pointer"
        >
          {muted ? <VolumeX className="size-4 text-red-300" /> : <Volume2 className="size-4 text-emerald-300" />}
        </button>

        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          title="Reset Entire Project"
          className="flex size-8 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/20 text-red-200 transition hover:bg-red-500/40 hover:text-white cursor-pointer"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      {/* Global Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-[#0b1d2e] shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-sans text-lg font-bold text-[#003c6c] flex items-center gap-2">
              <RotateCcw className="size-5 text-red-600" />
              Reset Game Project?
            </h3>
            <p className="mt-2 text-sm text-[#475569]">
              This will restore the entire studio, hero, boss behavior, arena layout, and balance history back to starter defaults.
            </p>
            <p className="mt-1 text-xs font-semibold text-red-600">
              This action cannot be undone. Other scenarios (like BattleBot) will not be affected.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false)
                  onResetProject()
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 shadow-xs cursor-pointer"
              >
                Confirm Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
