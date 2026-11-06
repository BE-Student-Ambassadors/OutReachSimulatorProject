import { ShieldAlert, KeyRound } from 'lucide-react'

export function CyberlockCardArt() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[#001c33] via-[#002b4d] to-[#003c6c] flex items-center justify-center select-none">
      {/* Circuit / Matrix Grid lines in background */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern id="cyber-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#fdc700" strokeWidth="0.5" />
            <circle cx="0" cy="0" r="1" fill="#f29813" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cyber-grid)" />
      </svg>

      {/* Radial glow */}
      <div className="absolute size-40 rounded-full bg-[#f29813]/15 blur-2xl pointer-events-none" />

      {/* Central Cyber Lock Graphic */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative flex items-center justify-center size-20 rounded-2xl bg-gradient-to-br from-[#003c6c] to-[#0b1d2e] border border-[#f29813]/60 shadow-xl shadow-amber-500/10">
          <ShieldAlert className="size-10 text-[#f29813]" />
          <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-[#fdc700] flex items-center justify-center text-slate-950 font-bold">
            <KeyRound className="size-3.5" />
          </div>
        </div>

        <div className="mt-2 text-center">
          <span className="font-mono text-[10px] font-black tracking-widest uppercase text-[#fdc700]">
            VAULT PROTOCOL 05
          </span>
        </div>
      </div>
    </div>
  )
}
