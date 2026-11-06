import { Binary } from 'lucide-react'

export function HexPrimer() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 font-sans text-xs">
      <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
        <Binary className="size-4" />
        <h3>How Hexadecimal & ASCII Work</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300">
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <span className="font-mono font-bold text-amber-300 block text-xs">
            1. Base-16 System
          </span>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Unlike decimal (0–9), hexadecimal has 16 symbols: <code className="text-amber-200">0–9</code>{' '}
            followed by <code className="text-amber-200">A, B, C, D, E, F</code> (representing 10 to 15).
          </p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <span className="font-mono font-bold text-amber-300 block text-xs">
            2. Two Digits = One Byte
          </span>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            A single byte (8 bits) is represented by exactly two hexadecimal characters, ranging from{' '}
            <code className="text-amber-200">00</code> (0) to <code className="text-amber-200">FF</code> (255).
          </p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <span className="font-mono font-bold text-amber-300 block text-xs">
            3. ASCII Character Mapping
          </span>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            In ASCII, human-readable characters map to numbers. Numeric digits <code className="text-amber-200">'0'–'9'</code>{' '}
            start at hex <code className="text-emerald-400">30</code> through <code className="text-emerald-400">39</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
