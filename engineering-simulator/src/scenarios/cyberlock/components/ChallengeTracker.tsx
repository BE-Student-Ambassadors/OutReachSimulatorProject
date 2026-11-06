import { useState, useEffect } from 'react'
import {
  Shield,
  KeyRound,
  FileCode,
  CheckCircle2,
  Lightbulb,
  Clock,
  Settings,
  Flame,
  type LucideIcon,
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
}: ChallengeTrackerProps) {
  const [elapsed, setElapsed] = useState(0)

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

  const stages: { id: ChallengeStage; label: string; icon: LucideIcon }[] = [
    { id: 'challenge1', label: '1. Gain Access', icon: KeyRound },
    { id: 'challenge2', label: '2. Find Flaw', icon: Shield },
    { id: 'challenge3', label: '3. Decode', icon: FileCode },
  ]

  return (
    <div className="w-full bg-[#002b4d] text-white border-b border-[#003c6c] px-4 py-2.5 sm:px-6 shadow-md select-none font-sans">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        {/* Left: Mission Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#fdc700] uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded border border-white/20">
              {serial}
            </span>
            <span className="text-xs font-semibold text-slate-200 hidden md:inline">
              {teamName}
            </span>
          </div>

          <div className="h-4 w-px bg-white/20" />

          {/* Timer */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
            <Clock className="size-3.5 text-[#f29813]" />
            <span>{formatTime(elapsed)}</span>
          </div>
        </div>

        {/* Center: Stage Stepper */}
        <div className="flex items-center gap-1.5 sm:gap-3 text-xs">
          {stages.map((st) => {
            const isCompleted = completedStages.includes(st.id)
            const isCurrent = currentStage === st.id
            const Icon = st.icon

            return (
              <div
                key={st.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition ${
                  isCompleted
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold'
                    : isCurrent
                    ? 'bg-[#f29813]/25 text-[#fdc700] border border-[#f29813]/60 font-bold ring-1 ring-[#f29813]/30'
                    : 'bg-white/5 text-slate-400 border border-white/10 opacity-70'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                ) : (
                  <Icon className="size-3.5" />
                )}
                <span className="text-[11px] whitespace-nowrap">{st.label}</span>
              </div>
            )
          })}
        </div>

        {/* Right: Score & Hint Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Score pill */}
          <div className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 font-mono text-xs font-bold text-white border border-white/15">
            <Flame className="size-3.5 text-[#f29813]" />
            <span>{score} pts</span>
          </div>

          {/* Hint Trigger Button */}
          <button
            type="button"
            onClick={onOpenHints}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f29813] hover:bg-[#d98207] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition active:translate-y-0.5 cursor-pointer"
          >
            <Lightbulb className="size-3.5" />
            <span>Hints</span>
            {hintsUsedCount > 0 && (
              <span className="ml-0.5 rounded-full bg-black/40 px-1.5 py-0.2 text-[10px] font-mono">
                {hintsUsedCount}
              </span>
            )}
          </button>

          {/* Ambassador settings gear */}
          <button
            type="button"
            onClick={onOpenFacilitator}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Facilitator settings"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
