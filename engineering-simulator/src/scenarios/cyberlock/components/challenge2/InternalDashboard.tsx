import {
  Database,
  Truck,
  User,
  Shield,
  Terminal,
  Activity,
} from 'lucide-react'
import { ShippingManifest } from './ShippingManifest'
import { VaultRecordsList } from './VaultRecordsList'
import { RecordViewer } from './RecordViewer'
import { play } from '../../../../shared/audio/sfx'
import type { VaultRecord } from '../../types'

interface InternalDashboardProps {
  url: string
  onNavigateUrl: (url: string) => void
  targetSerial: string
  targetRecordId: string
  sessionId: string
  onCapturePayload: (record: VaultRecord) => void
  devMode?: boolean
}

export function InternalDashboard({
  url,
  onNavigateUrl,
  targetSerial,
  targetRecordId,
  sessionId,
  onCapturePayload,
  devMode,
}: InternalDashboardProps) {
  // Check if current URL is a specific vault record, e.g. /vault/1001 or /vault/1003
  const vaultMatch = url.match(/\/vault\/([0-9a-zA-Z_-]+)/)
  const activeRecordId = vaultMatch ? vaultMatch[1] : null

  // Determine active tab
  let currentTab = 'records'
  if (url.includes('/manifest')) currentTab = 'manifest'
  else if (url.includes('/logs')) currentTab = 'logs'
  else if (url.includes('/account')) currentTab = 'account'

  const navLinks = [
    { id: 'records', label: 'Vault Records', url: '/portal', icon: Database },
    { id: 'manifest', label: 'Shipping Manifest', url: '/manifest', icon: Truck },
    { id: 'logs', label: 'System Logs', url: '/logs', icon: Activity },
    { id: 'account', label: 'Account & Clearance', url: '/account', icon: User },
  ]

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Intranet Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Shield className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              VaultTech Operations Network
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-semibold border border-slate-700">
                INTRANET v4.2
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              Node: <span className="text-emerald-400">sec4-gate-02.internal</span>
            </p>
          </div>
        </div>

        {/* User profile badge & dev helper */}
        <div className="flex items-center gap-2">
          {devMode && activeRecordId !== targetRecordId && (
            <button
              type="button"
              onClick={() => {
                play('sparkle')
                onNavigateUrl(`/vault/${targetRecordId}`)
              }}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold transition cursor-pointer"
              title={`Direct navigate to assigned record #${targetRecordId}`}
            >
              🛠 Dev: Go to /vault/{targetRecordId}
            </button>
          )}

          <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <div className="size-7 rounded-lg bg-[#003c6c] flex items-center justify-center font-bold text-xs text-white">
              AM
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-200 block leading-tight">
                Alex Morgan
              </span>
              <span className="text-[10px] font-mono text-amber-400 block leading-tight">
                Clearance: Level 1 (Standard)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-4 sm:px-6 flex items-center gap-2 overflow-x-auto">
        {navLinks.map((tab) => {
          const Icon = tab.icon
          const isActive = !activeRecordId && currentTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                play('click')
                onNavigateUrl(tab.url)
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-amber-500 text-amber-400 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
        {activeRecordId ? (
          <RecordViewer
            recordId={activeRecordId}
            sessionId={sessionId}
            onCapturePayload={onCapturePayload}
            onBack={() => onNavigateUrl('/portal')}
          />
        ) : currentTab === 'manifest' ? (
          <ShippingManifest targetSerial={targetSerial} />
        ) : currentTab === 'logs' ? (
          /* System Logs Tab */
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Terminal className="size-4 text-amber-400" />
                Security Gateway Event Log
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time connection stream and authorization checkpoint telemetry.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs space-y-2 text-slate-300">
              <div className="text-slate-500">[08:30:15] GET /vault/1001 HTTP/1.1 - 200 OK (telemetry_env)</div>
              <div className="text-slate-500">[08:44:02] GET /vault/1002 HTTP/1.1 - 200 OK (calibration_bench)</div>
              <div className="text-amber-400/90">[09:12:33] NOTICE: REST API object mapper resolves database requests directly via /vault/:id parameter</div>
              <div className="text-slate-500">[09:20:11] LOGISTICS: Shipping dispatch verified for DTI outreach batch ({targetSerial})</div>
              <div className="text-emerald-400">[09:40:00] AUTH_SESSION: User 'amorgan' logged in from internal gateway</div>
            </div>
          </div>
        ) : currentTab === 'account' ? (
          /* Account Settings Tab */
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-xl space-y-4">
            <h2 className="text-base font-bold text-slate-100">User Account Profile</h2>
            <div className="space-y-2 text-xs font-mono text-slate-300">
              <p>Name: <span className="text-slate-100">Alex Morgan</span></p>
              <p>Username: <span className="text-slate-100">amorgan</span></p>
              <p>Department: <span className="text-slate-100">IT Administration & Infrastructure</span></p>
              <p>Security Role: <span className="text-amber-400">Clearance Level 1 (Standard Staff)</span></p>
              <p className="pt-2 text-slate-400 font-sans border-t border-slate-800">
                Policy Note: Clearance Level 1 is restricted from browsing confidential lockbox assets in the UI directory.
              </p>
            </div>
          </div>
        ) : (
          /* Default: Vault Records List */
          <VaultRecordsList
            onNavigateUrl={onNavigateUrl}
            targetRecordId={targetRecordId}
          />
        )}
      </div>
    </div>
  )
}
