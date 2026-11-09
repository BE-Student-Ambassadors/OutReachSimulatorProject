import { useState } from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Shield,
  FileCode,
  CheckCircle2,
  XCircle,
  Scale,
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
  const [step, setStep] = useState<'ethics' | 'setup'>('ethics')
  const [serial, setSerial] = useState('BESA-0001')
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
      {step === 'ethics' ? (
        /* STEP 1: Ethical vs Non-Ethical Hacking Rules of Engagement */
        <div className="w-full max-w-2xl bg-white border border-[#d8e0ea] rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#002b4d] via-[#003c6c] to-[#0b1d2e] p-6 text-white text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f29813]/20 border border-[#f29813]/40 px-3 py-0.5 text-xs font-mono font-bold uppercase tracking-wider text-[#fdc700] mb-2">
              <Scale className="size-3.5 text-[#f29813]" />
              Rules of Engagement · Cybersecurity Ethics
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Ethical vs. Non-Ethical Hacking
            </h1>

            <p className="mt-2 text-sm text-slate-200 leading-relaxed max-w-lg mx-auto">
              In cybersecurity, technical capability must always be paired with ethical responsibility.
              What separates a defender from a criminal is <strong>permission</strong>, <strong>intent</strong>, and <strong>accountability</strong>.
            </p>
          </div>

          {/* Side-by-Side Comparison Grid */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* White Hat (Ethical) */}
              <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-50/40 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="inline-flex items-center gap-1.5 text-emerald-800 font-bold text-sm">
                      <ShieldCheck className="size-5 text-emerald-600" />
                      <span>Ethical Hacking</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                      White Hat
                    </span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                      <span>
                        <strong>Explicit Permission:</strong> Always authorized under written contracts and strict rules of engagement.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                      <span>
                        <strong>Protective Mission:</strong> Identifies security flaws to help organizations patch and defend systems.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                      <span>
                        <strong>Responsible Disclosure:</strong> Reports findings privately to system owners without public data leaks.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                      <span>
                        <strong>Career Path:</strong> High-impact, respected profession (Penetration Tester, Security Analyst, Bug Bounty Hunter).
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Black Hat (Non-Ethical) */}
              <div className="rounded-xl border-2 border-rose-500/30 bg-rose-50/40 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="inline-flex items-center gap-1.5 text-rose-800 font-bold text-sm">
                      <ShieldAlert className="size-5 text-rose-600" />
                      <span>Malicious Hacking</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                      Black Hat
                    </span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-700">
                    <li className="flex items-start gap-2">
                      <XCircle className="size-4 shrink-0 text-rose-500 mt-0.5" />
                      <span>
                        <strong>Zero Consent:</strong> Trespasses and infiltrates networks or devices without owner knowledge.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="size-4 shrink-0 text-rose-500 mt-0.5" />
                      <span>
                        <strong>Malicious Intent:</strong> Steals private credentials, deploys ransomware, extorts money, or defaces websites.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="size-4 shrink-0 text-rose-500 mt-0.5" />
                      <span>
                        <strong>Exploitation & Leaks:</strong> Sells confidential records on dark-web forums or causes disruption.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="size-4 shrink-0 text-rose-500 mt-0.5" />
                      <span>
                        <strong>Criminal Prosecution:</strong> Severe federal felonies under the CFAA, prison sentences, and criminal record.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Mission Role Callout */}
            <div className="rounded-xl border border-[#003c6c]/20 bg-[#f4f7fb] p-3.5 flex items-center gap-3">
              <div className="size-9 rounded-lg bg-[#003c6c] text-[#fdc700] flex items-center justify-center shrink-0">
                <Lock className="size-5" />
              </div>
              <div className="text-xs text-slate-700 leading-relaxed">
                <p className="font-bold text-[#002b4d]">Your Role Today: Authorized White Hat Analysts</p>
                <p className="text-slate-600">
                  You are authorized to investigate VaultTech's simulated environment. Your goal is to uncover security oversights and recover your team's lockbox code.
                </p>
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="pt-3 border-t border-[#d8e0ea] flex items-center justify-between">
              <button
                type="button"
                onClick={onOpenFacilitator}
                className="text-xs font-mono text-slate-500 hover:text-[#003c6c] hover:underline cursor-pointer"
              >
                Facilitator Mode
              </button>

              <button
                type="button"
                onClick={() => {
                  play('click')
                  setStep('setup')
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#003c6c] hover:bg-[#f29813] px-5 py-2.5 font-sans text-xs font-bold uppercase tracking-wider text-white shadow-sm transition active:translate-y-0.5 cursor-pointer"
              >
                <span>Accept Rules & Continue</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: Lockbox Setup & Mission Launch */
        <div className="w-full max-w-2xl bg-white border border-[#d8e0ea] rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
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

          {/* Form */}
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
                  placeholder="e.g. BESA-0001"
                  required
                  className="w-full rounded-xl border border-[#d8e0ea] bg-white px-3 py-2 font-mono text-sm font-bold text-[#0b1d2e] focus:border-[#f29813] focus:outline-none uppercase"
                />
              </div>
            </div>

            {/* Quick serial chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-mono text-[#75787b] mr-1">Serials:</span>
              {['BESA-0001', 'BESA-0002', 'BESA-0003', 'BESA-0004', 'BESA-0005'].map((s) => (
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

            {/* Footer Navigation */}
            <div className="pt-3 border-t border-[#d8e0ea] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  play('click')
                  setStep('ethics')
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#003c6c] cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                <span>Review Ethics Briefing</span>
              </button>

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
      )}
    </div>
  )
}
