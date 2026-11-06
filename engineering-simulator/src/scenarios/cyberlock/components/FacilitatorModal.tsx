import { useState } from 'react'
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { play } from '../../../shared/audio/sfx'
import { cyberlockApi } from '../client/apiClient'
import type { ChallengeStage, LockboxConfig } from '../types'

interface FacilitatorModalProps {
  onClose: () => void
  onJumpStage: (stage: ChallengeStage) => void
  onResetSession: () => void
}

export function FacilitatorModal({
  onClose,
  onJumpStage,
  onResetSession,
}: FacilitatorModalProps) {
  const [token, setToken] = useState('besa-facilitator-2026')
  const [authenticated, setAuthenticated] = useState(false)
  const [lockboxes, setLockboxes] = useState<LockboxConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealedSerials, setRevealedSerials] = useState<Record<string, boolean>>({})

  // Form for adding a new lockbox
  const [newSerial, setNewSerial] = useState('')
  const [newRecordId, setNewRecordId] = useState('')
  const [newCombination, setNewCombination] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    play('click')

    try {
      const res = await cyberlockApi.adminGetLockboxes(token)
      if (res.success && res.lockboxes) {
        setLockboxes(res.lockboxes)
        setAuthenticated(true)
        play('chime')
      } else {
        setError(res.error || 'Invalid facilitator authorization key.')
        play('fail')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authorization failed.')
      play('fail')
    } finally {
      setLoading(false)
    }
  }

  const loadLockboxes = async () => {
    setLoading(true)
    try {
      const res = await cyberlockApi.adminGetLockboxes(token)
      if (res.success && res.lockboxes) {
        setLockboxes(res.lockboxes)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddLockbox = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormMsg(null)
    play('click')

    const res = await cyberlockApi.adminSaveLockbox(token, {
      serial: newSerial.trim().toUpperCase(),
      recordId: newRecordId.trim(),
      combination: newCombination.trim(),
      label: newLabel.trim() || undefined,
    })

    if (res.success) {
      play('place')
      setFormMsg({ type: 'success', text: `Lockbox ${newSerial.toUpperCase()} added successfully!` })
      setNewSerial('')
      setNewRecordId('')
      setNewCombination('')
      setNewLabel('')
      loadLockboxes()
    } else {
      play('fail')
      setFormMsg({ type: 'error', text: res.error || 'Failed to save lockbox.' })
    }
  }

  const handleDelete = async (serial: string) => {
    if (!confirm(`Delete configuration for lockbox ${serial}?`)) return
    play('remove')
    await cyberlockApi.adminDeleteLockbox(token, serial)
    loadLockboxes()
  }

  const toggleReveal = (serial: string) => {
    play('tick')
    setRevealedSerials((prev) => ({ ...prev, [serial]: !prev[serial] }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-sans animate-fadeIn">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#002b4d] text-white">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-[#f29813]/20 text-[#fdc700] border border-[#f29813]/30">
              <KeyRound className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">BESA Facilitator Controls</h2>
              <p className="text-xs text-slate-300">
                Staff administration, lock emergency reveals, and challenge testing
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {!authenticated ? (
            /* Admin Auth Form */
            <form onSubmit={handleLogin} className="space-y-4 max-w-md mx-auto py-6">
              <div className="text-center space-y-1">
                <Lock className="size-8 mx-auto text-[#003c6c]" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Facilitator Key Required
                </h3>
                <p className="text-xs text-slate-500">
                  Enter the workshop administrator key to inspect physical lockbox combinations.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Facilitator Token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="besa-facilitator-2026"
                  required
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#003c6c] focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Default workshop dev key: <code className="font-mono">besa-facilitator-2026</code>
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#003c6c] hover:bg-[#f29813] py-2.5 text-xs font-bold uppercase tracking-wider text-white transition cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Unlock Facilitator Panel'}
              </button>
            </form>
          ) : (
            /* Facilitator Dashboard */
            <div className="space-y-6">
              {/* Quick Jump Shortcuts */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#003c6c] block mb-2">
                  Dry-Run Shortcuts (Skip to Stage)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      play('click')
                      onJumpStage('challenge1')
                      onClose()
                    }}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:border-[#003c6c] text-xs font-semibold text-slate-700 transition cursor-pointer text-center"
                  >
                    1. Gain Access
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      play('click')
                      onJumpStage('challenge2')
                      onClose()
                    }}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:border-[#003c6c] text-xs font-semibold text-slate-700 transition cursor-pointer text-center"
                  >
                    2. Find Vulnerability
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      play('click')
                      onJumpStage('challenge3')
                      onClose()
                    }}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:border-[#003c6c] text-xs font-semibold text-slate-700 transition cursor-pointer text-center"
                  >
                    3. Decode
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      play('click')
                      onJumpStage('success')
                      onClose()
                    }}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:border-emerald-600 text-xs font-semibold text-emerald-700 transition cursor-pointer text-center"
                  >
                    Success Debrief
                  </button>
                </div>
              </div>

              {/* Physical Lockboxes Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm text-slate-900">
                    Configured Physical Lockboxes ({lockboxes.length})
                  </h3>
                  <button
                    type="button"
                    onClick={loadLockboxes}
                    className="text-xs text-[#003c6c] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="size-3" /> Refresh
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 text-[10px] uppercase">
                      <tr>
                        <th className="px-3 py-2">Serial</th>
                        <th className="px-3 py-2">Record ID</th>
                        <th className="px-3 py-2">4-Digit Code</th>
                        <th className="px-3 py-2">Label</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lockboxes.map((lb) => {
                        const isRevealed = revealedSerials[lb.serial]

                        return (
                          <tr key={lb.serial} className="hover:bg-slate-50 transition">
                            <td className="px-3 py-2 font-bold text-[#003c6c]">{lb.serial}</td>
                            <td className="px-3 py-2 text-slate-700">#{lb.recordId}</td>
                            <td className="px-3 py-2">
                              {isRevealed ? (
                                <span className="font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  {lb.combination}
                                </span>
                              ) : (
                                <span className="text-slate-400">••••</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-sans text-slate-600">
                              {lb.label || 'Lockbox'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleReveal(lb.serial)}
                                  className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
                                  title={isRevealed ? 'Hide Code' : 'Reveal Code for Malfunctioning Lock'}
                                >
                                  {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(lb.serial)}
                                  className="p-1 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                                  title="Delete Lockbox"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add New Lockbox Form */}
              <form onSubmit={handleAddLockbox} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#003c6c] block">
                  Add New Lockbox
                </span>

                {formMsg && (
                  <div
                    className={`rounded-lg p-2.5 text-xs flex items-center gap-2 ${
                      formMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {formMsg.type === 'success' ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 text-red-600" />
                    )}
                    <span>{formMsg.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[10px] font-mono text-slate-600 block mb-0.5">Serial</label>
                    <input
                      type="text"
                      placeholder="BESA-0005"
                      value={newSerial}
                      onChange={(e) => setNewSerial(e.target.value.toUpperCase())}
                      required
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-600 block mb-0.5">Record ID</label>
                    <input
                      type="text"
                      placeholder="1045"
                      value={newRecordId}
                      onChange={(e) => setNewRecordId(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-600 block mb-0.5">4-Digit Code</label>
                    <input
                      type="text"
                      placeholder="3821"
                      maxLength={4}
                      value={newCombination}
                      onChange={(e) => setNewCombination(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-600 block mb-0.5">Label (Optional)</label>
                    <input
                      type="text"
                      placeholder="Lockbox Echo"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#003c6c] hover:bg-[#f29813] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Save Lockbox</span>
                  </button>
                </div>
              </form>

              {/* Reset Session Option */}
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Reset current student progress on this browser:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Clear current student session and restart?')) {
                      onResetSession()
                      onClose()
                    }
                  }}
                  className="rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 transition cursor-pointer"
                >
                  Reset Team Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
