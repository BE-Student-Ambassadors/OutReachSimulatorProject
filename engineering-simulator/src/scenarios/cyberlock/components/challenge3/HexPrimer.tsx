import { useState } from 'react'
import { Binary, ChevronDown, ChevronUp } from 'lucide-react'
import { play } from '../../../../shared/audio/sfx'

export function HexPrimer() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans text-xs">
      <button
        type="button"
        onClick={() => {
          play('tick')
          setIsOpen(!isOpen)
        }}
        className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition cursor-pointer"
      >
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
          <Binary className="size-4 shrink-0" />
          <span>Need a refresher on Hexadecimal & ASCII?</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
          <span>{isOpen ? 'Hide' : 'Show quick guide'}</span>
          {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-1 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-slate-300 animate-fadeIn">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-mono font-bold text-amber-300 block text-xs">
              1. Base-16 (Hex)
            </span>
            <p className="text-slate-400 text-[11px] leading-snug">
              Uses 16 symbols: <code className="text-amber-200">0–9</code> and{' '}
              <code className="text-amber-200">A–F</code> (10–15).
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-mono font-bold text-amber-300 block text-xs">
              2. Two Digits = One Byte
            </span>
            <p className="text-slate-400 text-[11px] leading-snug">
              Each byte is two hex digits, from <code className="text-amber-200">00</code> (0) to{' '}
              <code className="text-amber-200">FF</code> (255).
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-mono font-bold text-amber-300 block text-xs">
              3. ASCII Characters
            </span>
            <p className="text-slate-400 text-[11px] leading-snug">
              Digits <code className="text-amber-200">'0'–'9'</code> correspond to hex{' '}
              <code className="text-emerald-400">30–39</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
