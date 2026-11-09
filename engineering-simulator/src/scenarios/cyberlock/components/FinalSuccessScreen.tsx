import { useState } from 'react'
import {
  Trophy,
  CheckCircle2,
  RotateCcw,
  Unlock,
  KeyRound,
  FileCode,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { play } from '../../../shared/audio/sfx'
import type { ScoreState } from '../types'

interface FinalSuccessScreenProps {
  serial: string
  teamName: string
  elapsedSeconds: number
  scoreState: ScoreState
  finalCombination: string
  onVerifyPhysicalLock: () => void
  physicalLockOpened: boolean
  onRestart: () => void
}

export function FinalSuccessScreen({
  serial,
  teamName,
  elapsedSeconds,
  scoreState,
  finalCombination,
  onVerifyPhysicalLock,
  physicalLockOpened,
  onRestart,
}: FinalSuccessScreenProps) {
  const [expandedConcept, setExpandedConcept] = useState<number | null>(null)

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}m ${s}s`
  }

  const handlePhysicalUnlock = () => {
    if (!physicalLockOpened) {
      play('sparkle')
      onVerifyPhysicalLock()
    }
  }

  const toggleConcept = (idx: number) => {
    play('tick')
    setExpandedConcept((curr) => (curr === idx ? null : idx))
  }

  return (
    <div className="min-h-full py-8 px-4 sm:px-6 max-w-4xl mx-auto space-y-6 font-sans animate-fadeIn">
      {/* Hero Victory Card */}
      <div className="bg-gradient-to-br from-[#002b4d] via-[#003c6c] to-[#0b1d2e] rounded-3xl p-6 sm:p-10 text-white shadow-xl border border-white/20 text-center relative overflow-hidden">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f29813]/25 border border-[#f29813]/40 px-3.5 py-1 text-xs font-mono font-bold uppercase tracking-wider text-[#fdc700] mb-3">
          <Trophy className="size-3.5 text-[#f29813]" />
          Operation Vaultbreak Complete
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          VAULT UNLOCKED!
        </h1>

        <p className="mt-2 text-sm sm:text-base text-slate-200 max-w-xl mx-auto">
          Great work, <strong>{teamName}</strong>. You cracked VaultTech's system for lockbox{' '}
          <strong className="text-[#fdc700] font-mono">{serial}</strong>.
        </p>

        {/* Big Code Highlight */}
        <div className="my-5 inline-block bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-8 py-3">
          <span className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-0.5">
            Your 4-Digit Lockbox Code
          </span>
          <span className="font-mono text-4xl sm:text-5xl font-black tracking-widest text-[#fdc700]">
            {finalCombination}
          </span>
        </div>

        {/* Physical Lockbox Bonus Verification */}
        <div className="max-w-xs mx-auto">
          {physicalLockOpened ? (
            <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 p-2.5 text-xs text-emerald-300 font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span>Physical Lockbox Opened! (+50 pts)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePhysicalUnlock}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#f29813] hover:bg-[#d98207] px-5 py-2.5 font-sans text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md transition-all active:translate-y-0.5 cursor-pointer"
            >
              <Unlock className="size-4" />
              <span>I Opened the Physical Lockbox! (+50 pts)</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-mono uppercase text-slate-500 block mb-0.5">
            Total Score
          </span>
          <div className="text-2xl font-black text-[#003c6c] font-mono">
            {scoreState.total} pts
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-mono uppercase text-slate-500 block mb-0.5">
            Time Taken
          </span>
          <div className="text-2xl font-black text-slate-800 font-mono">
            {formatTime(elapsedSeconds)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-mono uppercase text-slate-500 block mb-0.5">
            Hints Used
          </span>
          <div className="text-2xl font-black text-slate-800 font-mono">
            {scoreState.hintsUsed.length}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-mono uppercase text-slate-500 block mb-0.5">
            Stages Solved
          </span>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            3 / 3
          </div>
        </div>
      </div>

      {/* Cybersecurity Concepts Learned - Compact Visual Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-[#0b1d2e]">
            Key Takeaways
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            The security principles behind today's mission:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Weak Passwords */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between transition hover:border-slate-300">
            <div>
              <div className="flex items-center gap-2 text-[#003c6c] font-bold text-sm mb-1.5">
                <KeyRound className="size-4 text-[#f29813] shrink-0" />
                <h3>Weak Passwords</h3>
              </div>
              <p className="text-xs text-slate-600 leading-snug">
                Public information can make passwords predictable.
              </p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => toggleConcept(1)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#003c6c] hover:underline cursor-pointer"
              >
                <span>{expandedConcept === 1 ? 'Hide details' : 'Learn more'}</span>
                {expandedConcept === 1 ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>

              {expandedConcept === 1 && (
                <div className="mt-2 text-[11px] text-slate-600 space-y-1.5 leading-relaxed bg-white rounded-lg p-2.5 border border-slate-200 animate-fadeIn">
                  <p>
                    <strong>Vulnerability:</strong> Passwords based on hobbies or dates are easily guessed using public profiles (OSINT).
                  </p>
                  <p>
                    <strong>Defense:</strong> Use long, high-entropy passphrases or passkeys and require multi-factor authentication (MFA).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Broken Access Control */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between transition hover:border-slate-300">
            <div>
              <div className="flex items-center gap-2 text-[#003c6c] font-bold text-sm mb-1.5">
                <ShieldAlert className="size-4 text-[#f29813] shrink-0" />
                <h3>Broken Access Control</h3>
              </div>
              <p className="text-xs text-slate-600 leading-snug">
                Websites must verify permissions for every request.
              </p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => toggleConcept(2)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#003c6c] hover:underline cursor-pointer"
              >
                <span>{expandedConcept === 2 ? 'Hide details' : 'Learn more'}</span>
                {expandedConcept === 2 ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>

              {expandedConcept === 2 && (
                <div className="mt-2 text-[11px] text-slate-600 space-y-1.5 leading-relaxed bg-white rounded-lg p-2.5 border border-slate-200 animate-fadeIn">
                  <p>
                    <strong>Vulnerability:</strong> Hiding a button in the UI doesn't protect the server if direct URLs like <code className="font-mono bg-slate-100 px-1 rounded">/vault/:id</code> are left open.
                  </p>
                  <p>
                    <strong>Defense:</strong> Check user authorization on the backend for every incoming request.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Encoding vs. Encryption */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between transition hover:border-slate-300">
            <div>
              <div className="flex items-center gap-2 text-[#003c6c] font-bold text-sm mb-1.5">
                <FileCode className="size-4 text-[#f29813] shrink-0" />
                <h3>Encoding vs. Encryption</h3>
              </div>
              <p className="text-xs text-slate-600 leading-snug">
                Encoded information is not necessarily secure.
              </p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => toggleConcept(3)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#003c6c] hover:underline cursor-pointer"
              >
                <span>{expandedConcept === 3 ? 'Hide details' : 'Learn more'}</span>
                {expandedConcept === 3 ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>

              {expandedConcept === 3 && (
                <div className="mt-2 text-[11px] text-slate-600 space-y-1.5 leading-relaxed bg-white rounded-lg p-2.5 border border-slate-200 animate-fadeIn">
                  <p>
                    <strong>Vulnerability:</strong> Hex and ASCII are standard representations that anyone can decode without a key.
                  </p>
                  <p>
                    <strong>Defense:</strong> True security requires cryptographic algorithms (like AES) protected by secret keys.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action footer */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={() => {
            play('click')
            onRestart()
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-2.5 font-sans text-xs font-bold uppercase tracking-wider text-white transition active:translate-y-0.5 cursor-pointer shadow-sm"
        >
          <RotateCcw className="size-3.5" />
          <span>Play Again</span>
        </button>
      </div>
    </div>
  )
}
