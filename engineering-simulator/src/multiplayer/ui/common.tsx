import type { ReactNode } from 'react'
import { BaskinLogo } from '../../shell/BrandMark'
import { usingEmulators } from '../firebase'
import { useNow } from '../hooks'

/** Full-page layout for the multiplayer screens (join, lobby, host dashboard). */
export function Screen({ children, wide = false, onBack }: { children: ReactNode; wide?: boolean; onBack?(): void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#f4f6fa] text-[#0b1d2e] antialiased">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#d8e0ea] bg-white px-5 shadow-xs">
        <button type="button" onClick={onBack} className="flex items-center gap-3 text-left transition hover:opacity-90 cursor-pointer" title="Back to challenges">
          <BaskinLogo height={28} />
          <div className="h-5 w-px bg-slate-200 hidden sm:block" />
          <div className="flex flex-col text-left leading-tight">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#003c6c]">
              UC Santa Cruz
            </span>
            <span className="font-sans text-[14px] font-black tracking-tight text-[#003c6c]">
              BE Lab
            </span>
          </div>
        </button>
        {usingEmulators && <span className="ml-auto rounded-full bg-[#fdc700]/20 border border-[#fdc700]/40 px-2.5 py-1 font-mono text-[11px] font-bold text-[#003c6c]">local emulator</span>}
      </header>
      <main className={`mx-auto w-full flex-1 px-6 py-8 ${wide ? 'max-w-6xl' : 'max-w-xl'}`}>{children}</main>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#d8e0ea] bg-white p-6 shadow-sm transition hover:shadow-md ${className}`}>
      {children}
    </div>
  )
}

export function PrimaryButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`btn-press flex items-center justify-center gap-2 rounded-xl bg-[#003c6c] px-6 py-3 font-sans text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#f29813] disabled:cursor-not-allowed disabled:opacity-50 ${rest.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`flex items-center justify-center gap-2 rounded-xl border border-[#d8e0ea] px-4 py-2.5 text-sm font-bold text-[#003c6c] transition hover:bg-[#f4f6fa] hover:border-[#003c6c]/40 disabled:opacity-40 ${rest.className ?? ''}`}
    >
      {children}
    </button>
  )
}

/** mm:ss until `endsAt`, or null if no timer. */
export function Countdown({ endsAt, className = '' }: { endsAt: number | null; className?: string }) {
  const now = useNow()
  if (!endsAt) return null
  const left = Math.max(0, Math.round((endsAt - now) / 1000))
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')
  return (
    <span className={`font-mono font-bold tabular ${left <= 60 ? 'text-red-600' : 'text-[#003c6c]'} ${className}`}>
      {left === 0 ? "Time's up" : `${mm}:${ss}`}
    </span>
  )
}
