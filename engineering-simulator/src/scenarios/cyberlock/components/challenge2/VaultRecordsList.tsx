import { useState } from 'react'
import {
  Lock,
  Eye,
  ShieldAlert,
} from 'lucide-react'
import { play } from '../../../../shared/audio/sfx'

interface VaultRecordsListProps {
  onNavigateUrl: (url: string) => void
  targetRecordId: string
}

export function VaultRecordsList({ onNavigateUrl, targetRecordId }: VaultRecordsListProps) {
  const [deniedModal, setDeniedModal] = useState<string | null>(null)

  const records = [
    {
      id: '1001',
      title: 'Storage Bay Environmental Telemetry',
      category: 'Facility Operations',
      classification: 'Standard (Clearance Level 1)',
      restricted: false,
      timestamp: '2026-11-06 08:30 PST',
    },
    {
      id: '1002',
      title: 'Robotics Calibration & Maintenance Log',
      category: 'Robotics Kinematics',
      classification: 'Standard (Clearance Level 1)',
      restricted: false,
      timestamp: '2026-11-05 14:12 PST',
    },
    {
      id: targetRecordId,
      title: `Classified Vault Asset Register (Record #${targetRecordId})`,
      category: 'Physical Security & Logistics',
      classification: 'RESTRICTED (Clearance Level 3 Required)',
      restricted: true,
      timestamp: '2026-11-06 09:44 PST',
    },
  ]

  const handleOpenRecord = (record: (typeof records)[0]) => {
    if (record.restricted) {
      play('fail')
      setDeniedModal(record.id)
    } else {
      play('click')
      onNavigateUrl(`/vault/${record.id}`)
    }
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            Internal Vault Database Records
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Database repository indexing active facility telemetry, robotic calibrations, and vault containment records.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {records.map((r) => (
          <div
            key={r.id}
            className={`rounded-xl border p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              r.restricted
                ? 'bg-slate-900/60 border-slate-800'
                : 'bg-slate-900 border-slate-700/80 hover:border-slate-600'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-400">
                  Record #{r.id}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    r.restricted
                      ? 'bg-red-950/80 text-red-400 border border-red-900/50'
                      : 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/50'
                  }`}
                >
                  {r.restricted ? 'Restricted' : 'Accessible'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-200">{r.title}</h3>
              <p className="text-xs text-slate-400">
                {r.category} · {r.timestamp}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenRecord(r)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition cursor-pointer ${
                r.restricted
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs'
              }`}
            >
              {r.restricted ? (
                <>
                  <Lock className="size-3.5 text-red-400" />
                  <span>Restricted</span>
                </>
              ) : (
                <>
                  <Eye className="size-3.5" />
                  <span>View Record</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Permission Denied UI Modal */}
      {deniedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-red-800/80 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-400">
              <ShieldAlert className="size-6 shrink-0" />
              <div>
                <h3 className="font-bold text-base text-slate-100">
                  403 Forbidden — Access Denied
                </h3>
                <span className="font-mono text-xs text-red-400">
                  Error Code: ERR_INSUFFICIENT_CLEARANCE
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 text-xs font-mono text-slate-300 space-y-2">
              <p>
                User: <span className="text-amber-400">amorgan</span> (Clearance Level 1)
              </p>
              <p>
                Requested Object: <span className="text-red-400">Record #{deniedModal}</span>
              </p>
              <p className="text-red-300 pt-2 border-t border-slate-800">
                The portal directory interface blocks Level 1 staff from clicking restricted vault records. Level 3 clearance is required to view confidential asset codes from this list.
              </p>
            </div>

            <p className="text-xs text-slate-400 italic">
              Notice: Standard records such as #1001 or #1002 can be inspected normally. Pay attention to how the application identifies records in the browser.
            </p>

            <button
              type="button"
              onClick={() => setDeniedModal(null)}
              className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-200 transition cursor-pointer"
            >
              Dismiss Warning
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
