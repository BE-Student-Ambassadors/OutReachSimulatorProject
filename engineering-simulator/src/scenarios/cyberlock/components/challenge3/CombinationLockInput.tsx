import { useState, useRef } from 'react'
import {
  Lock,
  Unlock,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'
import { play } from '../../../../shared/audio/sfx'
import { cyberlockApi } from '../../client/apiClient'

interface CombinationLockInputProps {
  sessionId: string
  serial: string
  onUnlockSuccess: (combination: string) => void
  devMode?: boolean
  devCombination?: string
}

export function CombinationLockInput({
  sessionId,
  serial,
  onUnlockSuccess,
  devMode,
  devCombination,
}: CombinationLockInputProps) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unlockedCode, setUnlockedCode] = useState<string | null>(null)

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const handleChange = (index: number, value: string) => {
    // Only accept numeric digit
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = char
    setDigits(next)
    setError(null)

    if (char) {
      play('tick')
      // Auto advance to next input
      if (index < 3) {
        inputRefs[index + 1].current?.focus()
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus()
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length !== 4) {
      setError('Please enter all 4 digits of the combination.')
      return
    }

    setLoading(true)
    setError(null)
    play('click')

    try {
      const res = await cyberlockApi.verifyCombination(sessionId, code)
      if (!res.success) {
        setError(res.message || 'Combination is incorrect. Check your decoding table.')
        play('buzz')
        setLoading(false)
        return
      }

      setUnlockedCode(code)
      play('sparkle')
      setTimeout(() => {
        play('success')
        onUnlockSuccess(code)
      }, 1200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify combination.')
      play('fail')
      setLoading(false)
    }
  }

  const handleClear = () => {
    setDigits(['', '', '', ''])
    setError(null)
    inputRefs[0].current?.focus()
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-xl font-sans text-center">
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex flex-col items-center">
          <div
            className={`size-14 rounded-2xl flex items-center justify-center transition-all ${
              unlockedCode
                ? 'bg-emerald-500 text-slate-950 shadow-lg scale-110'
                : 'bg-slate-800 text-amber-400 border border-slate-700'
            }`}
          >
            {unlockedCode ? <Unlock className="size-7" /> : <Lock className="size-7" />}
          </div>

          <h2 className="mt-3 text-lg sm:text-xl font-black text-slate-100">
            {unlockedCode ? 'Vault Combination Recovered!' : 'Enter Decoded 4-Digit Combination'}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Physical Lockbox Target: <strong className="text-amber-400">{serial}</strong>
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/60 bg-red-950/80 p-3.5 text-xs text-red-200 text-left flex items-start gap-2.5 animate-fadeIn font-mono">
            <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-400">Lock Mechanism Rejection</p>
              <p className="mt-0.5 text-slate-300">{error}</p>
            </div>
          </div>
        )}

        {unlockedCode ? (
          <div className="bg-emerald-950/80 border border-emerald-500/80 rounded-2xl p-6 text-center space-y-3 animate-fadeIn">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-300 font-bold block">
              ACCESS CODE CONFIRMED
            </span>
            <div className="font-mono text-5xl font-black tracking-widest text-[#fdc700] py-1">
              {unlockedCode}
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              Enter this 4-digit code on the physical dials of your 3D-printed lockbox to claim your team's prize!
            </p>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-6">
            {/* 4 Digit Slots */}
            <div className="flex justify-center gap-3 sm:gap-4">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-14 h-16 sm:w-16 sm:h-20 text-center font-mono text-3xl sm:text-4xl font-black rounded-2xl bg-slate-950 border-2 border-slate-700 text-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40 focus:outline-none transition shadow-inner"
                />
              ))}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleClear}
                className="px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition cursor-pointer"
                title="Clear inputs"
              >
                <RotateCcw className="size-4" />
              </button>

              <button
                type="submit"
                disabled={loading || digits.join('').length !== 4}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-[#f29813] hover:from-amber-400 hover:to-amber-500 px-6 py-3 font-sans text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg transition-all active:translate-y-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{loading ? 'Verifying...' : 'Verify Combination'}</span>
                <ArrowRight className="size-4" />
              </button>
            </div>

            {devMode && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    const code = devCombination || '4826'
                    setDigits(code.split('').slice(0, 4))
                    play('sparkle')
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold transition cursor-pointer"
                >
                  🛠 Dev: Auto-Fill Combination ({devCombination || '4826'})
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
