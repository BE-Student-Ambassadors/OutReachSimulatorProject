import { useState } from 'react'
import {
  ShieldAlert,
  AlertCircle,
  ArrowRight,
  KeyRound,
  Shield,
  FileCode,
} from 'lucide-react'
import { play } from '../../../shared/audio/sfx'
import { cyberlockApi } from '../client/apiClient'
import type { SessionData } from '../types'

interface MissionBriefingProps {
  onStartSession: (session: SessionData) => void
  onOpenFacilitator: () => void
  devMode?: boolean
  onToggleDevMode?: () => void
}

export function MissionBriefing({
  onStartSession,
  onOpenFacilitator,
  devMode,
  onToggleDevMode,
}: MissionBriefingProps) {
  const [serial, setSerial] = useState('BESA-0427')
  const [teamName, setTeamName] = useState('Team Slug')
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
        setError(res.error || 'Unrecognized serial number. Check your physical lockbox.')
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
    <div className="min-h-full flex flex-col justify-center items-center py-6 px-4 font-sans">
      <div className="w-full max-w-xl bg-white border border-[#d8e0ea] rounded-2xl shadow-xl overflow-hidden">
        {/* Compact Hero Header */}
        <div className="bg-gradient-to-r from-[#002b4d] via-[#003c6c] to-[#0b1d2e] p-6 text-white text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f29813]/20 border border-[#f29813]/40 px-3 py-0.5 text-xs font-mono font-bold uppercase tracking-wider text-[#fdc700] mb-2">
            <ShieldAlert className="size-3.5 text-[#f29813]" />
            BESA Challenge · Track 05
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Operation Vaultbreak
          </h1>

          <p className="mt-2 text-sm text-slate-200 leading-relaxed max-w-md mx-auto">
            Your lockbox contains a secret prize. Hack into VaultTech's simulated system to recover its 4-digit code.
          </p>

          {/* 3 Compact Stage Indicators */}
          <div className="mt-4 grid grid-cols-3 gap-2 max-w-sm mx-auto text-xs font-semibold">
            <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/10 border border-white/15 text-slate-200">
              <KeyRound className="size-3.5 text-[#fdc700]" />
              <span>1. Gain Access</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/10 border border-white/15 text-slate-200">
              <Shield className="size-3.5 text-[#fdc700]" />
              <span>2. Find Flaw</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/10 border border-white/15 text-slate-200">
              <FileCode className="size-3.5 text-[#fdc700]" />
              <span>3. Decode</span>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleStart} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="teamName" className="block text-xs font-bold uppercase tracking-wider text-[#003c6c] mb-1">
                Team Name
              </label>
              <input
                id="teamName"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team Name"
                className="w-full rounded-xl border border-[#d8e0ea] bg-white px-3 py-2 text-sm text-[#0b1d2e] focus:border-[#003c6c] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="lockboxSerial" className="block text-xs font-bold uppercase tracking-wider text-[#003c6c] mb-1">
                Lockbox Serial <span className="text-red-500">*</span>
              </label>
              <input
                id="lockboxSerial"
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value.toUpperCase())}
                placeholder="e.g. BESA-0427"
                required
                className="w-full rounded-xl border border-[#d8e0ea] bg-white px-3 py-2 font-mono text-sm font-bold text-[#0b1d2e] focus:border-[#f29813] focus:outline-none uppercase"
              />
            </div>
          </div>

          {/* Quick serial chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-mono text-[#75787b] mr-1">Serials:</span>
            {['BESA-0427', 'BESA-0001', 'BESA-0002', 'BESA-0003', 'BESA-0004'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSerial(s)
                  play('click')
                }}
                className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition border cursor-pointer ${
                  serial === s
                    ? 'bg-[#003c6c] text-white border-[#003c6c]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-[#d8e0ea] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenFacilitator}
                className="text-xs font-mono text-slate-500 hover:text-[#003c6c] hover:underline cursor-pointer"
              >
                Facilitator Mode
              </button>
              {onToggleDevMode && (
                <button
                  type="button"
                  onClick={onToggleDevMode}
                  className="text-xs font-mono text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                >
                  {devMode ? 'Exit Dev' : 'Dev Mode'}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#003c6c] hover:bg-[#f29813] px-5 py-2.5 font-sans text-xs font-bold uppercase tracking-wider text-white shadow-sm transition active:translate-y-0.5 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Starting...' : 'Start Mission'}</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
