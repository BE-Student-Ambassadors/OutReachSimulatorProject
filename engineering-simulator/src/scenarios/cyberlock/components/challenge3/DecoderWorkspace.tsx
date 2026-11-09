import { FileCode } from 'lucide-react'
import { HexPrimer } from './HexPrimer'
import { AsciiTableTool } from './AsciiTableTool'
import { CombinationLockInput } from './CombinationLockInput'
import { hexAsciiToCombination } from '../../server/cyberlockService'
import type { VaultRecord } from '../../types'

interface DecoderWorkspaceProps {
  recoveredRecord: VaultRecord | null
  serial: string
  sessionId: string
  onUnlockSuccess: (combination: string) => void
  devMode?: boolean
}

export function DecoderWorkspace({
  recoveredRecord,
  serial,
  sessionId,
  onUnlockSuccess,
  devMode,
}: DecoderWorkspaceProps) {
  const hexPayload = recoveredRecord?.hexPayload || '34 38 32 36'
  const devCombination = hexAsciiToCombination(hexPayload)

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5 font-sans">
      {/* Top Banner with Recovered Hex Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-semibold uppercase mb-1">
              <FileCode className="size-3" />
              <span>Target: {serial}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-100">
              Decode Lockbox Combination
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Convert the 4 hexadecimal bytes below into ASCII characters.
            </p>
          </div>

          <div className="w-full sm:w-auto bg-slate-950 border border-amber-500/40 rounded-xl px-5 py-2.5 text-center sm:text-right shadow-inner">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-0.5">
              Recovered Hex Payload
            </span>
            <div className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-[#fdc700] select-all">
              {hexPayload}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left side Decoder Tools, Right side Lock Input */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Primer & ASCII Table (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <HexPrimer />
          <AsciiTableTool />
        </div>

        {/* Right Column: Combination Lock Input (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <CombinationLockInput
            sessionId={sessionId}
            serial={serial}
            onUnlockSuccess={onUnlockSuccess}
            devMode={devMode}
            devCombination={devCombination}
          />
        </div>
      </div>
    </div>
  )
}
