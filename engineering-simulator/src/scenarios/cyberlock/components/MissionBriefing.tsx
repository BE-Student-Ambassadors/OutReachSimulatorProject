import { useState } from 'react'
import {
  ShieldAlert,
  KeyRound,
  Clock,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Cpu,
  Lock,
} from 'lucide-react'
import { play } from '../../../shared/audio/sfx'
import { cyberlockApi } from '../client/apiClient'
import type { SessionData } from '../types'

interface MissionBriefingProps {
  onStartSession: (session: SessionData) => void
  onOpenFacilitator: () => void
}

export function MissionBriefing({ onStartSession, onOpenFacilitator }: MissionBriefingProps) {
  const [serial, setSerial] = useState('BESA-0427')
  const [teamName, setTeamName] = useState('Team Banana Slug')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanSerial = serial.trim().toUpperCase()
    if (!cleanSerial) {
      setError('Please enter your lockbox serial number.')
      return
    }

    setLoading(true)
    setError(null)
    play('click')

    try {
      const res = await cyberlockApi.startSession(cleanSerial, teamName)
      if (!res.success || !res.sessionId || !res.targetRecordId) {
        setError(res.error || 'Failed to initialize session. Please check your serial number.')
        play('fail')
        setLoading(false)
        return
      }

      play('start')

      const session: SessionData = {
        sessionId: res.sessionId,
        serial: cleanSerial,
        teamName: teamName.trim() || 'Team Vaultbreak',
        currentStage: 'challenge1',
        completedStages: [],
        revealedHints: [],
        startTime: Date.now(),
        completionTime: null,
        targetRecordId: res.targetRecordId,
        physicalLockOpened: false,
      }

      onStartSession(session)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      play('fail')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col justify-center items-center py-8 px-4 sm:px-6 font-sans">
      <div className="w-full max-w-3xl bg-white border border-[#d8e0ea] rounded-2xl shadow-xl overflow-hidden">
        {/* Banner */}
        <div className="relative bg-gradient-to-r from-[#002b4d] via-[#003c6c] to-[#0b1d2e] p-6 sm:p-8 text-white">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#f29813]/40 bg-[#f29813]/20 px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider text-[#fdc700]">
            <Sparkles className="size-3 text-[#f29813]" />
            BESA Challenge · Track 05
          </div>

          <h1 className="mt-3 text-2xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
            <ShieldAlert className="size-8 sm:size-10 text-[#f29813]" />
            Operation Vaultbreak
          </h1>

          <p className="mt-2 text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl">
            VaultTech has discovered a critical security vulnerability in its internal systems. Your
            team has been recruited as cybersecurity investigators to demonstrate how the
            vulnerability exposes sensitive records and recover the 4-digit code for your physical lockbox.
          </p>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-white/15 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-slate-200">
              <Clock className="size-4 text-[#fdc700]" />
              <span>Est: 15 Mins</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Cpu className="size-4 text-[#fdc700]" />
              <span>Diff: Beginner+</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <KeyRound className="size-4 text-[#fdc700]" />
              <span>Target: 4-Digit Code</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Lock className="size-4 text-[#fdc700]" />
              <span>3 Challenges</span>
            </div>
          </div>
        </div>

        {/* Mission Roadmap */}
        <div className="bg-[#f8fafc] px-6 py-4 border-b border-[#d8e0ea]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#003c6c] mb-2">
            Investigation Stages
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <span className="font-mono font-bold text-[#f29813] block">Stage 1: Gain Access</span>
              <p className="text-slate-600 mt-0.5">
                Investigate public staff profiles & company news to uncover internal credentials.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <span className="font-mono font-bold text-[#003c6c] block">Stage 2: Find Flaw</span>
              <p className="text-slate-600 mt-0.5">
                Exploit Broken Access Control (IDOR) to access your team’s classified vault record.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <span className="font-mono font-bold text-emerald-600 block">Stage 3: Decode</span>
              <p className="text-slate-600 mt-0.5">
                Decode raw hexadecimal ASCII bytes into the 4-digit code to physically open your lockbox!
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleStart} className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Initialization Error</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="teamName" className="block text-xs font-bold uppercase tracking-wider text-[#003c6c]">
                Team Name
              </label>
              <input
                id="teamName"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Team Blue"
                className="mt-1.5 w-full rounded-xl border border-[#d8e0ea] bg-white px-3.5 py-2.5 text-sm text-[#0b1d2e] focus:border-[#003c6c] focus:ring-1 focus:ring-[#003c6c] focus:outline-none transition"
              />
              <span className="mt-1 block text-[11px] text-[#75787b]">
                Appears on your mission completion debrief.
              </span>
            </div>

            <div>
              <label htmlFor="lockboxSerial" className="block text-xs font-bold uppercase tracking-wider text-[#003c6c]">
                Lockbox Serial Number <span className="text-red-500">*</span>
              </label>
              <input
                id="lockboxSerial"
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value.toUpperCase())}
                placeholder="e.g. BESA-0427"
                required
                className="mt-1.5 w-full rounded-xl border border-[#d8e0ea] bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-[#0b1d2e] focus:border-[#f29813] focus:ring-1 focus:ring-[#f29813] focus:outline-none transition uppercase"
              />
              <span className="mt-1 block text-[11px] text-[#75787b]">
                Look at the sticker on your 3D-printed physical box.
              </span>
            </div>
          </div>

          {/* Quick serial selectors for workshop testing */}
          <div>
            <span className="text-[11px] font-mono text-[#75787b] block mb-1.5">
              Available Workshop Lockboxes:
            </span>
            <div className="flex flex-wrap gap-2">
              {['BESA-0427', 'BESA-0001', 'BESA-0002', 'BESA-0003', 'BESA-0004'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSerial(s)
                    play('click')
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition border cursor-pointer ${
                    serial === s
                      ? 'bg-[#003c6c] text-white border-[#003c6c]'
                      : 'bg-white text-slate-700 border-[#d8e0ea] hover:bg-slate-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#d8e0ea] flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={onOpenFacilitator}
              className="text-xs font-mono text-[#003c6c] hover:underline cursor-pointer"
            >
              Ambassador / Facilitator Mode
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#003c6c] hover:bg-[#f29813] px-6 py-3 font-sans text-sm font-bold uppercase tracking-wider text-white shadow-md transition-all active:translate-y-0.5 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Initializing...' : 'Start Mission'}</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
