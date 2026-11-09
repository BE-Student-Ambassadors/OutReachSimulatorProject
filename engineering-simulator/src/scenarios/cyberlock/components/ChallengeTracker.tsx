import { useState, useEffect } from 'react'
import {
  Lightbulb,
  Clock,
  Settings,
  Target,
  X,
  CheckCircle2,
  Lock,
  RotateCcw,
} from 'lucide-react'
import { play } from '../../../shared/audio/sfx'
import type { ChallengeStage } from '../types'

interface ChallengeTrackerProps {
  currentStage: ChallengeStage
  completedStages: ChallengeStage[]
  serial: string
  teamName: string
  startTime: number
  score: number
  hintsUsedCount: number
  onOpenHints: () => void
  onOpenFacilitator: () => void
  onSelectStage?: (stage: ChallengeStage) => void
  onResetGame?: () => void
}

const OBJECTIVES: Record<ChallengeStage, string> = {
  onboarding: 'Initialize team lockbox session.',
  challenge1: 'Find a way into the employee portal.',
  challenge2: 'Access the restricted record linked to your lockbox.',
  challenge3: 'Decode the data to recover your 4-digit code.',
  success: 'Enter the code on your physical lockbox.',
}

const STAGES: { id: ChallengeStage; step: number; shortLabel: string; title: string }[] = [
  { id: 'challenge1', step: 1, shortLabel: '1. Access', title: 'Stage 1: Gain Access (Staff Directory & Portal)' },
  { id: 'challenge2', step: 2, shortLabel: '2. Find Flaw', title: 'Stage 2: Find Flaw (Intranet & Restricted Vault)' },
  { id: 'challenge3', step: 3, shortLabel: '3. Decode', title: 'Stage 3: Decode (Hex ASCII Combination Lock)' },
]

export function ChallengeTracker({
  currentStage,
  completedStages,
  serial,
  teamName,
  startTime,
  score,
  hintsUsedCount,
  onOpenHints,
  onOpenFacilitator,
  onSelectStage,
  onResetGame,
}: ChallengeTrackerProps) {
  const [elapsed, setElapsed] = useState(0)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [startTime])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Determine which stages have been accessed/unlocked
  const isStageUnlocked = (stageId: ChallengeStage): boolean => {
    if (stageId === 'challenge1') return true
    if (stageId === 'challenge2') {
      return (
        completedStages.includes('challenge1') ||
        currentStage === 'challenge2' ||
        currentStage === 'challenge3' ||
        currentStage === 'success'
      )
    }
    if (stageId === 'challenge3') {
      return (
        completedStages.includes('challenge2') ||
        currentStage === 'challenge3' ||
        currentStage === 'success'
      )
    }
    if (stageId === 'success') {
      return completedStages.includes('challenge3') || currentStage === 'success'
    }
    return false
  }

  return (
    <header className="w-full bg-[#002b4d] text-white border-b border-[#003c6c] px-4 py-2 sm:px-6 shadow-sm select-none font-sans">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Left: Interactive Stage Navigation & Serial */}
        <div className="flex items-center gap-2 shrink-0">
          <nav aria-label="Stages" className="inline-flex items-center rounded-xl bg-black/30 p-1 border border-white/10 shadow-inner">
            {STAGES.map((s) => {
              const isActive = currentStage === s.id
              const isCompleted = completedStages.includes(s.id)
              const isUnlocked = isStageUnlocked(s.id)

              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => {
                    if (isUnlocked) {
                      play('click')
                      onSelectStage?.(s.id)
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#f29813] text-slate-950 shadow-md font-black scale-100 cursor-default'
                      : !isUnlocked
                      ? 'text-slate-500/50 cursor-not-allowed opacity-60'
                      : isCompleted
                      ? 'text-emerald-400 hover:text-white hover:bg-white/10 cursor-pointer'
                      : 'text-slate-200 hover:text-white hover:bg-white/10 cursor-pointer'
                  }`}
                  title={
                    !isUnlocked
                      ? `Complete Stage ${s.step - 1} to unlock`
                      : s.title
                  }
                >
                  {isActive ? (
                    <span className="size-1.5 rounded-full shrink-0 bg-slate-950" />
                  ) : !isUnlocked ? (
                    <Lock className="size-3 text-slate-500/70 shrink-0" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                  ) : (
                    <span className="size-1.5 rounded-full shrink-0 bg-amber-400" />
                  )}
                  <span className="hidden sm:inline">{s.shortLabel}</span>
                  <span className="sm:hidden">{s.step}</span>
                </button>
              )
            })}

            {/* Debrief tab if unlocked or currently on victory screen */}
            {(completedStages.includes('challenge3') || currentStage === 'success') && (
              <button
                type="button"
                onClick={() => {
                  play('click')
                  onSelectStage?.('success')
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentStage === 'success'
                    ? 'bg-[#f29813] text-slate-950 shadow-md font-black'
                    : 'text-[#fdc700] hover:text-white hover:bg-white/10'
                }`}
                title="Mission Complete Debrief"
              >
                <span>★ Debrief</span>
              </button>
            )}
          </nav>

          <span className="font-mono text-xs font-bold text-[#fdc700] bg-white/10 px-2.5 py-1 rounded-lg border border-white/20">
            {serial}
          </span>
        </div>

        {/* Center: Prominent Objective */}
        <div className="flex-1 flex items-center justify-center min-w-0 px-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-medium text-slate-100 max-w-full border border-white/15">
            <Target className="size-3.5 text-[#f29813] shrink-0" />
            <span className="truncate font-semibold tracking-wide text-white">
              {OBJECTIVES[currentStage]}
            </span>
          </div>
        </div>

        {/* Right: Timer, Hint, Secondary Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Timer */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <Clock className="size-3.5 text-[#fdc700]" />
            <span>{formatTime(elapsed)}</span>
          </div>

          {/* Hint Button */}
          <button
            type="button"
            onClick={onOpenHints}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f29813] hover:bg-[#d98207] px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-950 transition active:translate-y-0.5 cursor-pointer shadow-xs"
          >
            <Lightbulb className="size-3.5" />
            <span>Hints</span>
            {hintsUsedCount > 0 && (
              <span className="rounded-full bg-slate-950 text-[#fdc700] px-1.5 py-0.2 text-[10px] font-mono">
                {hintsUsedCount}
              </span>
            )}
          </button>

          {/* Reset Game Button */}
          {onResetGame && (
            <button
              type="button"
              onClick={() => {
                play('click')
                onResetGame()
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-rose-500/20 hover:text-rose-200 hover:border-rose-400/40 border border-white/15 px-2.5 py-1 text-xs font-semibold text-slate-300 transition active:translate-y-0.5 cursor-pointer"
              title="Reset Mission"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          {/* Compact Info & Facilitator Menu Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="More details"
            >
              <Settings className="size-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl bg-slate-900 border border-slate-700 p-3 shadow-xl z-50 text-xs font-sans animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-bold text-slate-200">{teamName}</span>
                  <button
                    type="button"
                    onClick={() => setShowMenu(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="py-2.5 space-y-1.5 text-slate-300 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span>Solved:</span>
                    <span className="text-emerald-400 font-bold">{completedStages.length} / 3</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Score:</span>
                    <span className="text-[#fdc700] font-bold">{score} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hints Used:</span>
                    <span>{hintsUsedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Box Serial:</span>
                    <span className="text-slate-100">{serial}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onOpenFacilitator()
                  }}
                  className="w-full mt-1 pt-2 border-t border-slate-800 text-left text-[#fdc700] hover:underline font-mono text-[11px] cursor-pointer"
                >
                  ⚙ Facilitator Panel
                </button>
                {onResetGame && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false)
                      play('click')
                      onResetGame()
                    }}
                    className="w-full mt-1.5 pt-2 border-t border-slate-800 text-left text-rose-400 hover:text-rose-300 hover:underline font-mono text-[11px] flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="size-3" />
                    <span>Reset Game</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
