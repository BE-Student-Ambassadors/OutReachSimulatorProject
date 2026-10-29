import { ArrowRight, Sparkles, Users } from 'lucide-react'
import type { AnyScenario } from '../core/scenario'
import { play } from '../shared/audio/sfx'
import { BaskinLogo } from './BrandMark'

export function StartScreen({
  scenarios,
  onStart,
  onJoin,
  onHost,
}: {
  scenarios: AnyScenario[]
  onStart(s: AnyScenario): void
  onJoin?(): void
  onHost?(): void
}) {
  return (
    <div className="min-h-full flex flex-col bg-[#f4f6fa] text-[#0b1d2e] antialiased">
      {/* Top Institutional Bar */}
      <header className="border-b border-[#002b4d]/20 bg-[#003c6c] px-4 py-3 sm:px-6 lg:px-8 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <BaskinLogo height={32} inverted />
            <div className="h-5 w-px bg-white/20 hidden sm:block" />
            <span className="font-mono text-xs font-semibold tracking-wider uppercase text-[#fdc700] hidden sm:inline-block">
              BE Lab
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {onJoin && (
              <button
                type="button"
                onClick={onJoin}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#f29813] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition hover:bg-[#d98207] active:translate-y-0.5 cursor-pointer"
              >
                <Users className="size-3.5" />
                Join Live Room
              </button>
            )}
            {onHost && (
              <button
                type="button"
                onClick={onHost}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-white/20 active:translate-y-0.5 cursor-pointer"
              >
                Host
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Compact Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#003c6c] via-[#00335c] to-[#002b4d] px-4 py-10 text-center text-white sm:px-6">
        <HeroGrid />
        <div className="relative mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#f29813]/40 bg-[#f29813]/15 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-[#fdc700]">
            <Sparkles className="size-3 text-[#f29813]" />
            BE Interactive Lab
          </div>

          <h1 className="mt-3 font-sans text-3xl font-black tracking-tight sm:text-5xl text-white">
            BE Engineering Lab
          </h1>

          <p className="mx-auto mt-2 max-w-xl text-sm sm:text-base font-normal text-slate-200">
            Choose a challenge below to design, simulate, and optimize real engineering systems.
          </p>
        </div>
      </section>

      {/* Main Challenge Grid */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {scenarios.map((s, i) => (
            <div
              key={s.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[#d8e0ea] bg-white shadow-xs transition-all duration-200 hover:border-[#f29813] hover:shadow-xl hover:-translate-y-1"
            >
              {/* Card visual banner */}
              <div className="relative h-40 w-full overflow-hidden bg-[#002b4d]">
                {s.CardArt && <s.CardArt />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                <span className="absolute left-3 top-3 rounded-md bg-[#003c6c]/90 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#fdc700] backdrop-blur-xs border border-white/20">
                  Track 0{i + 1}
                </span>
                <span className="absolute bottom-2.5 right-3 rounded bg-black/50 px-2 py-0.5 font-mono text-[11px] font-semibold text-white backdrop-blur-xs">
                  ${(s.budget / 1000).toFixed(0)}k budget
                </span>
              </div>

              {/* Card content */}
              <div className="flex flex-1 flex-col p-5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#003c6c]">
                  {s.discipline}
                </span>
                <h2 className="mt-1 font-sans text-xl font-black text-[#0b1d2e] group-hover:text-[#003c6c] transition-colors">
                  {s.title}
                </h2>
                <p className="mt-1.5 text-xs text-[#75787b] leading-relaxed flex-1 line-clamp-2">
                  {s.tagline}
                </p>

                <div className="mt-4 pt-3 border-t border-[#f4f6fa]">
                  <button
                    type="button"
                    onClick={() => {
                      play('start')
                      onStart(s)
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#003c6c] px-4 py-2.5 font-sans text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:bg-[#f29813] hover:text-white cursor-pointer active:translate-y-0.5"
                  >
                    <span>Start Challenge</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Outreach Disclaimer */}
        <div className="mt-8 rounded-xl border border-[#d8e0ea] bg-white px-4 py-2.5 text-center text-xs text-[#75787b]">
          <span className="font-bold text-[#003c6c]">Disclaimer:</span> This is a fun educational activity and is not representative of real collegiate engineering competitions or actual tournament specifications.
        </div>
      </main>

      {/* Clean Institutional Footer */}
      <footer className="mt-auto border-t border-[#d8e0ea] bg-white py-5 text-[#75787b]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <div className="flex items-center gap-3">
            <BaskinLogo height={28} />
            <span className="text-xs text-[#75787b]">
              BE Lab · Baskin School of Engineering · UC Santa Cruz
            </span>
          </div>

          <a
            href="https://engineering.ucsc.edu/"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-[#003c6c] hover:underline"
          >
            engineering.ucsc.edu
          </a>
        </div>
      </footer>
    </div>
  )
}

/** Subtle engineering blueprint grid for hero background */
function HeroGrid() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-10"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      aria-hidden
    >
      <defs>
        <pattern id="baskin-grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#13a5dc" strokeWidth="0.8" />
          <circle cx="0" cy="0" r="1.5" fill="#f29813" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#baskin-grid)" />
    </svg>
  )
}
