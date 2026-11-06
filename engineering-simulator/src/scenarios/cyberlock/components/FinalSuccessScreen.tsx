import {
  Trophy,
  CheckCircle2,
  RotateCcw,
  Unlock,
  KeyRound,
  FileCode,
  ShieldAlert,
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

  return (
    <div className="min-h-full py-8 px-4 sm:px-6 max-w-5xl mx-auto space-y-6 font-sans animate-fadeIn">
      {/* Hero Victory Card */}
      <div className="bg-gradient-to-br from-[#002b4d] via-[#003c6c] to-[#0b1d2e] rounded-3xl p-6 sm:p-10 text-white shadow-2xl border border-white/20 text-center relative overflow-hidden">
        {/* Subtle decorative background sparkles */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f29813]/25 border border-[#f29813]/40 px-3.5 py-1 text-xs font-mono font-bold uppercase tracking-wider text-[#fdc700] mb-3">
          <Trophy className="size-3.5 text-[#f29813]" />
          Operation Vaultbreak Accomplished
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          MISSION COMPLETE — VAULT UNLOCKED
        </h1>

        <p className="mt-3 text-sm sm:text-base text-slate-200 max-w-2xl mx-auto leading-relaxed">
          Outstanding work, <strong>{teamName}</strong>! You successfully investigated VaultTech’s
          systems, exploited critical access flaws, and decoded the 4-digit combination for lockbox{' '}
          <strong className="text-[#fdc700] font-mono">{serial}</strong>.
        </p>

        {/* Big Code Highlight */}
        <div className="my-6 inline-block bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-8 py-3.5">
          <span className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-0.5">
            Recovered Physical Combination
          </span>
          <span className="font-mono text-4xl sm:text-5xl font-black tracking-widest text-[#fdc700]">
            {finalCombination}
          </span>
        </div>

        {/* Physical Lockbox Bonus Verification */}
        <div className="max-w-md mx-auto pt-2">
          {physicalLockOpened ? (
            <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 p-3 text-xs text-emerald-300 font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span>Physical Lockbox Verified & Opened! (+50 Bonus Points)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePhysicalUnlock}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#f29813] hover:bg-[#d98207] px-5 py-3 font-sans text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg transition-all active:translate-y-0.5 cursor-pointer"
            >
              <Unlock className="size-4" />
              <span>I Opened the Physical Lockbox! (+50 pts)</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-xs">
          <span className="text-[11px] font-mono uppercase text-slate-500 block mb-1">
            Total Score
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#003c6c] font-mono">
            {scoreState.total} pts
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-xs">
          <span className="text-[11px] font-mono uppercase text-slate-500 block mb-1">
            Completion Time
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 font-mono">
            {formatTime(elapsedSeconds)}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-xs">
          <span className="text-[11px] font-mono uppercase text-slate-500 block mb-1">
            Hints Revealed
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 font-mono">
            {scoreState.hintsUsed.length} / 9
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-xs">
          <span className="text-[11px] font-mono uppercase text-slate-500 block mb-1">
            Challenges Solved
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
            3 / 3
          </div>
        </div>
      </div>

      {/* Cybersecurity Concepts Learned */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#003c6c]">
            Cybersecurity Engineering Debrief
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-[#0b1d2e] mt-1">
            Key Vulnerabilities & Defenses
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            During this challenge, your team walked through real-world attack vectors and learned how secure systems are designed:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-[#003c6c] font-bold text-sm">
              <KeyRound className="size-4 text-[#f29813]" />
              <h3>1. Weak Authentication & OSINT</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Vulnerability:</strong> Passwords based on personal trivia (robot name and joining year) were easily discovered from public company profiles.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Engineering Defense:</strong> Require multi-factor authentication (MFA) and implement high-entropy passphrases or passkeys that cannot be guessed from public data.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-[#003c6c] font-bold text-sm">
              <ShieldAlert className="size-4 text-[#f29813]" />
              <h3>2. Broken Access Control (IDOR)</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Vulnerability:</strong> The UI prevented standard users from clicking restricted records, but the backend API accepted direct URL requests (<code className="font-mono">/vault/:id</code>) without verifying user authorization.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Engineering Defense:</strong> Enforce authorization checks on the server for every single object request. Never rely on hiding buttons in the browser.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-[#003c6c] font-bold text-sm">
              <FileCode className="size-4 text-[#f29813]" />
              <h3>3. Encoding vs. Encryption</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Vulnerability:</strong> The database stored access codes in hexadecimal ASCII format. Hex is a data encoding format, not encryption.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Engineering Defense:</strong> Use industry-standard cryptographic algorithms (such as AES-GCM or RSA) with secret keys to ensure confidentiality.
            </p>
          </div>
        </div>

        {/* Inspirational Callout */}
        <div className="rounded-xl bg-gradient-to-r from-[#003c6c]/10 to-[#f29813]/10 border border-[#003c6c]/20 p-4 sm:p-5 text-center">
          <p className="font-sans text-xs sm:text-sm font-semibold text-[#003c6c] italic">
            "Cybersecurity engineers don’t just find vulnerabilities. They help design systems that protect information, verify access, and prevent attacks."
          </p>
          <span className="block mt-1 text-[11px] font-mono text-slate-500">
            UC Santa Cruz · Baskin Engineering Student Ambassadors (BESA)
          </span>
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
          className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-6 py-3 font-sans text-xs font-bold uppercase tracking-wider text-white transition active:translate-y-0.5 cursor-pointer shadow-md"
        >
          <RotateCcw className="size-4" />
          <span>Reset Challenge / Play Again</span>
        </button>
      </div>
    </div>
  )
}
