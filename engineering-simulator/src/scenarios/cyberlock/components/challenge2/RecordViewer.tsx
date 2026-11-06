import { useState, useEffect } from 'react'
import {
  ShieldAlert,
  ArrowLeft,
  Database,
  Unlock,
  Terminal,
  FileCode,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { play } from '../../../../shared/audio/sfx'
import { cyberlockApi } from '../../client/apiClient'
import type { VaultRecord } from '../../types'

interface RecordViewerProps {
  recordId: string
  sessionId: string
  onCapturePayload: (record: VaultRecord) => void
  onBack: () => void
}

export function RecordViewer({
  recordId,
  sessionId,
  onCapturePayload,
  onBack,
}: RecordViewerProps) {
  const [record, setRecord] = useState<VaultRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function fetchRecord() {
      setLoading(true)
      setError(null)
      try {
        const res = await cyberlockApi.getRecord(recordId, sessionId)
        if (!active) return
        if (res.success && res.record) {
          setRecord(res.record)
          if (res.record.isRestricted && res.record.hexPayload) {
            play('chime')
          }
        } else {
          setError(res.error || `Record #${recordId} could not be retrieved.`)
          play('fail')
        }
      } catch (err: unknown) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Error fetching record.')
        play('fail')
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchRecord()
    return () => {
      active = false
    }
  }, [recordId, sessionId])

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto font-sans animate-fadeIn">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => {
          play('click')
          onBack()
        }}
        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 hover:text-amber-300 mb-4 transition cursor-pointer"
      >
        <ArrowLeft className="size-3.5" /> Back to Dashboard
      </button>

      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 font-mono text-xs">
          <Terminal className="size-8 mx-auto mb-2 text-amber-400 animate-pulse" />
          Querying backend database endpoint for record #{recordId}...
        </div>
      ) : error ? (
        <div className="bg-slate-900 border border-red-800/80 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2.5 text-red-400">
            <ShieldAlert className="size-6 shrink-0" />
            <h2 className="text-lg font-bold text-slate-100">
              Database Query Failed
            </h2>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-red-300">
            {error}
          </div>

          <p className="text-xs text-slate-400">
            Check the Shipping Manifest for the correct Record ID matching your assigned lockbox serial.
          </p>
        </div>
      ) : record ? (
        <div className="space-y-6">
          {/* Header Card */}
          <div
            className={`rounded-2xl border p-6 ${
              record.isRestricted
                ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border-amber-500/60 shadow-xl'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Database className="size-5 text-amber-400" />
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-100">
                    {record.title}
                  </h1>
                  <span className="font-mono text-xs text-slate-400">
                    Record Identifier: #{record.id}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                    record.isRestricted
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {record.classification}
                </span>
              </div>
            </div>

            {/* If Restricted (IDOR breakthrough) */}
            {record.isRestricted && record.hexPayload ? (
              <div className="mt-5 space-y-5">
                {/* Vulnerability notice banner */}
                <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-xs font-mono text-amber-300 flex items-start gap-3">
                  <Unlock className="size-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-200 block text-sm mb-0.5">
                      VULNERABILITY EXPLOITED: Broken Access Control (IDOR)
                    </strong>
                    <p className="text-slate-300 font-sans text-xs">
                      The application UI restricted Level 1 users from viewing this record, but the
                      backend endpoint <code className="text-amber-300 font-mono">/vault/{record.id}</code>{' '}
                      failed to verify your authorization on direct URL requests! The database
                      returned the classified record.
                    </p>
                  </div>
                </div>

                {/* Recovered Data Box */}
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                      <FileCode className="size-4 text-amber-400" />
                      Recovered Vault Asset Payload
                    </span>
                    <span className="text-[11px] font-mono text-amber-400">
                      Encoding: {record.encodingFormat}
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 text-center">
                    <span className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Raw Hexadecimal Data Stream:
                    </span>
                    <div className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-[#fdc700] select-all py-1">
                      {record.hexPayload}
                    </div>
                    <span className="block text-[11px] font-mono text-slate-400 mt-1">
                      (Space-separated hexadecimal bytes)
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 whitespace-pre-line font-mono bg-slate-900/60 p-3.5 rounded-lg border border-slate-800">
                    {record.content}
                  </div>
                </div>

                {/* Action button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      play('start')
                      onCapturePayload(record)
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-[#f29813] hover:from-amber-400 hover:to-amber-500 px-6 py-3 font-sans text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg transition-all active:translate-y-0.5 cursor-pointer"
                  >
                    <Sparkles className="size-4" />
                    <span>Proceed to Stage 3: Decode Combination (+200 pts)</span>
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Standard record content */
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {record.content}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Last Updated: {record.timestamp} · Clearance Verification: Passed
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
