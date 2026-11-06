import {
  Lightbulb,
  X,
  Unlock,
  AlertTriangle,
} from 'lucide-react'
import { play } from '../../../shared/audio/sfx'
import { CHALLENGE_HINTS } from '../data/hints'
import type { ChallengeStage } from '../types'

interface HintModalProps {
  currentStage: ChallengeStage
  revealedHints: string[]
  onRevealHint: (hintId: string) => void
  onClose: () => void
}

export function HintModal({
  currentStage,
  revealedHints,
  onRevealHint,
  onClose,
}: HintModalProps) {
  const challengeKey =
    currentStage === 'challenge1'
      ? 'challenge1'
      : currentStage === 'challenge2'
      ? 'challenge2'
      : 'challenge3'

  const hints = CHALLENGE_HINTS[challengeKey] || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans animate-fadeIn">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#002b4d] text-white">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-[#f29813]/20 text-[#fdc700] border border-[#f29813]/30">
              <Lightbulb className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Investigation Hints</h2>
              <p className="text-xs text-slate-300">
                Progressive hints for {currentStage === 'challenge1' ? 'Stage 1: Gain Access' : currentStage === 'challenge2' ? 'Stage 2: Find Flaw' : 'Stage 3: Decode Combination'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Penalty Warning Notice */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200/60 flex items-center gap-2.5 text-xs text-amber-800">
          <AlertTriangle className="size-4 text-amber-600 shrink-0" />
          <span>
            <strong>Scoring Note:</strong> Each unlocked hint deducts 25 points from your mission score. Try investigating with your team first before unlocking!
          </span>
        </div>

        {/* Hints List */}
        <div className="p-6 overflow-y-auto space-y-4">
          {hints.map((hint, idx) => {
            const isRevealed = revealedHints.includes(hint.id)
            // Progressive unlock: Level 1 always available; Level 2 needs Level 1 revealed; Level 3 needs Level 2 revealed
            const previousRevealed = idx === 0 || revealedHints.includes(hints[idx - 1].id)

            return (
              <div
                key={hint.id}
                className={`rounded-xl border p-4 transition-all ${
                  isRevealed
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : previousRevealed
                    ? 'border-slate-200 bg-white hover:border-amber-300'
                    : 'border-slate-100 bg-slate-50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold uppercase px-2 py-0.5 rounded ${
                        isRevealed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      Hint {hint.level}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800">
                      {isRevealed ? hint.title : `Hint Level ${hint.level}`}
                    </h3>
                  </div>

                  {isRevealed && (
                    <span className="text-[11px] font-mono text-emerald-700 font-semibold flex items-center gap-1">
                      <Unlock className="size-3" /> Unlocked (-25 pts)
                    </span>
                  )}
                </div>

                {isRevealed ? (
                  <p className="text-xs text-slate-700 leading-relaxed mt-2 bg-white/80 p-3 rounded-lg border border-emerald-100">
                    {hint.content}
                  </p>
                ) : (
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500 italic">
                      {previousRevealed
                        ? 'Click to reveal this clue (-25 points)'
                        : `Unlock Hint ${hint.level - 1} first to view this hint.`}
                    </p>

                    <button
                      type="button"
                      disabled={!previousRevealed}
                      onClick={() => {
                        play('pop')
                        onRevealHint(hint.id)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#003c6c] hover:bg-[#f29813] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Lightbulb className="size-3.5" />
                      <span>Reveal (-25 pts)</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-200 hover:bg-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            Close Hints
          </button>
        </div>
      </div>
    </div>
  )
}
