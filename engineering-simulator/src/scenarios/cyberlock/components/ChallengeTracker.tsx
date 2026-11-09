import { useState, useEffect } from 'react'
import {
  Lightbulb,
  Clock,
  Settings,
  Target,
  X,
} from 'lucide-react'
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
  devMode?: boolean
  onToggleDevMode?: () => void
}

const OBJECTIVES: Record<ChallengeStage, string> = {
  onboarding: 'Initialize team lockbox session.',
  challenge1: 'Find a way into the employee portal.',
  challenge2: 'Access the restricted record linked to your lockbox.',
  challenge3: 'Decode the data to recover your 4-digit code.',
  success: 'Enter the code on your physical lockbox.',
}

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
  devMode,
  onToggleDevMode,
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

  const stageNumber =
    currentStage === 'challenge1'
      ? '1/3'
      : currentStage === 'challenge2'
      ? '2/3'
      : currentStage === 'challenge3'
      ? '3/3'
      : 'Complete'

  return (
    <header className="w-full bg-[#002b4d] text-white border-b border-[#003c6c] px-4 py-2 sm:px-6 shadow-sm select-none font-sans">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Left: Stage & Serial */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="rounded-lg bg-[#f29813] px-2.5 py-1 text-xs font-black uppercase tracking-wider text-slate-950">
            Stage {stageNumber}
          </span>
          <span className="font-mono text-xs font-bold text-[#fdc700] bg-white/10 px-2 py-0.5 rounded border border-white/20">
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
                  className="w-full mt-1 pt-2 border-t border-slate-800 text-left text-[#fdc700] hover:underline font-mono text-[11px]"
                >
                  ⚙ Facilitator Panel
                </button>
                {onToggleDevMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false)
                      onToggleDevMode()
                    }}
                    className="w-full mt-1 pt-1.5 border-t border-slate-800 text-left text-amber-400 hover:underline font-mono text-[11px]"
                  >
                    🛠 {devMode ? 'Disable Dev Mode' : 'Enable Dev Mode'}
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
