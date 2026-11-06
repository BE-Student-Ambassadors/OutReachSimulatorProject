import { FileCode } from 'lucide-react'
import { HexPrimer } from './HexPrimer'
import { AsciiTableTool } from './AsciiTableTool'
import { CombinationLockInput } from './CombinationLockInput'
import type { VaultRecord } from '../../types'

interface DecoderWorkspaceProps {
  recoveredRecord: VaultRecord | null
  serial: string
  sessionId: string
  onUnlockSuccess: (combination: string) => void
}

export function DecoderWorkspace({
  recoveredRecord,
  serial,
  sessionId,
  onUnlockSuccess,
}: DecoderWorkspaceProps) {
  const hexPayload = recoveredRecord?.hexPayload || '34 38 32 36'

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Top Banner with Recovered Hex Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-xs font-semibold uppercase mb-1.5">
              <FileCode className="size-3.5" />
              Recovered Payload Stream
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              Stage 3: Hexadecimal ASCII Decoder
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Lockbox Serial: <strong className="text-amber-400 font-mono">{serial}</strong>{' '}
              · Internal Record #{recoveredRecord?.id || '1003'}
            </p>
          </div>

          <div className="w-full sm:w-auto bg-slate-950 border border-amber-500/40 rounded-xl px-5 py-3 text-center sm:text-right shadow-inner">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-0.5">
              Raw Hex Sequence
            </span>
            <div className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-[#fdc700] select-all">
              {hexPayload}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-300 leading-relaxed max-w-3xl">
          The restricted database dumped a sequence of 4 hexadecimal byte values. Each 2-digit hex
          number represents an ASCII character code. Use the interactive decoder tools below to
          translate the bytes into your 4-digit physical lockbox combination!
        </p>
      </div>

      {/* Main Grid: Left side Decoder Tools, Right side Lock Input */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Primer & ASCII Table (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <HexPrimer />
          <AsciiTableTool />
        </div>

        {/* Right Column: Combination Lock Input (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <CombinationLockInput
            sessionId={sessionId}
            serial={serial}
            onUnlockSuccess={onUnlockSuccess}
          />
        </div>
      </div>
    </div>
  )
}
