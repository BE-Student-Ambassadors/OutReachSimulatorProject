import type { ReactNode } from 'react'
import { BrandMark } from '../../shell/BrandMark'
import { usingEmulators } from '../firebase'
import { useNow } from '../hooks'

/** Full-page layout for the multiplayer screens (join, lobby, host dashboard). */
export function Screen({ children, wide = false, onBack }: { children: ReactNode; wide?: boolean; onBack?(): void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-paper">
      <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-white px-5">
        <button type="button" onClick={onBack} className="flex items-center gap-2.5" title="Back">
          <BrandMark />
          <span className="font-display text-[17px] font-bold tracking-tight text-forest">BESA Engineering Lab</span>
        </button>
        {usingEmulators && <span className="ml-auto rounded-full bg-sun/20 px-2.5 py-1 font-mono text-[11px] font-semibold text-ink">local emulator</span>}
      </header>
      <main className={`mx-auto w-full flex-1 px-6 py-8 ${wide ? 'max-w-6xl' : 'max-w-xl'}`}>{children}</main>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-6 shadow-[0_8px_30px_-12px_rgba(27,42,32,0.25)] ring-1 ring-black/5 ${className}`}>{children}</div>
}

export function PrimaryButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`btn-press flex items-center justify-center gap-2 rounded-xl bg-forest px-6 py-3 font-display text-sm font-bold uppercase tracking-wide text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-50 ${rest.className ?? ''}`}
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
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line hover:bg-paper disabled:opacity-40 ${rest.className ?? ''}`}
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
    <span className={`font-mono font-semibold tabular ${left <= 60 ? 'text-rust' : 'text-ink'} ${className}`}>
      {left === 0 ? "Time's up" : `${mm}:${ss}`}
    </span>
  )
}
