import { useState, useEffect } from 'react'
import {
  ShieldAlert,
  ArrowLeft,
  Sparkles,
  ArrowRight,
  Terminal,
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
    <div className="p-3 sm:p-5 max-w-3xl mx-auto font-sans animate-fadeIn">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => {
          play('click')
          onBack()
        }}
        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 hover:text-amber-300 mb-3 transition cursor-pointer"
      >
        <ArrowLeft className="size-3.5" /> Back to Records
      </button>

      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 font-mono text-xs">
          <Terminal className="size-6 mx-auto mb-2 text-amber-400 animate-pulse" />
          Querying record #{recordId}...
        </div>
      ) : error ? (
        <div className="bg-slate-900 border border-red-800/80 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-400">
            <ShieldAlert className="size-5 shrink-0" />
            <h2 className="text-sm font-bold text-slate-100">Record Unavailable</h2>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-red-300">
            {error}
          </div>
        </div>
      ) : record ? (
        <div className="space-y-4">
          <div
            className={`rounded-xl border p-5 ${
              record.isRestricted
                ? 'bg-slate-900 border-amber-500/60 shadow-lg'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h1 className="text-base font-bold text-slate-100">{record.title}</h1>
                <span className="font-mono text-xs text-slate-400">Record #{record.id}</span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase ${
                  record.isRestricted
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {record.classification}
              </span>
            </div>

            {/* Restricted IDOR Record */}
            {record.isRestricted && record.hexPayload ? (
              <div className="mt-4 space-y-4">
                <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-5 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                    Recovered Hex Data
                  </span>
                  <div className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-[#fdc700] select-all py-1">
                    {record.hexPayload}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 block mt-1">
                    Target Lockbox: {record.serial}
                  </span>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      play('start')
                      onCapturePayload(record)
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 font-sans text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md transition active:translate-y-0.5 cursor-pointer"
                  >
                    <Sparkles className="size-4" />
                    <span>Capture Data & Decode (+200 pts)</span>
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Standard record content */
              <div className="mt-4 space-y-2">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {record.content}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  {record.timestamp} · Clearance Verified
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
