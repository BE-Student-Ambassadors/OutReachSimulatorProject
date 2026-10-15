import { ArrowRight } from 'lucide-react'
import type { AnyScenario } from '../core/scenario'
import { BrandMark } from './BrandMark'

export function StartScreen({ scenarios, onStart, onJoin, onHost }: { scenarios: AnyScenario[]; onStart(s: AnyScenario): void; onJoin?(): void; onHost?(): void }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-paper px-6">
      <Contours />
      <div className="relative flex flex-col items-center text-center">
        <BrandMark size={56} />
        <h1 className="mt-5 font-display text-[clamp(40px,6vw,72px)] font-extrabold leading-[0.95] tracking-tight text-forest">
          BESA Engineering Lab
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/50">Baskin Engineering Student Ambassadors</p>
        <p className="mt-3 font-display text-xl text-ink/70">Can your team engineer a solution?</p>
        {onJoin && (
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={onJoin}
              className="btn-press rounded-xl bg-forest px-7 py-3 font-display text-base font-bold uppercase tracking-wide text-white hover:bg-forest-dark"
            >
              Join a game
            </button>
            {onHost && (
              <button type="button" onClick={onHost} className="rounded-xl px-5 py-3 text-sm font-semibold text-ink ring-1 ring-line hover:bg-white">
                Host a game
              </button>
            )}
          </div>
        )}
      </div>

      {onJoin && <p className="relative mt-10 text-sm font-semibold uppercase tracking-wider text-ink/45">Or practice on your own</p>}
      <div className="relative mt-4 flex flex-wrap justify-center gap-5">
        {scenarios.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onStart(s)}
            className="group w-[min(420px,90vw)] overflow-hidden rounded-2xl bg-white text-left shadow-[0_12px_40px_-12px_rgba(27,42,32,0.35)] ring-1 ring-black/5 transition hover:-translate-y-0.5"
          >
            <div className="relative h-36 overflow-hidden bg-forest">
              {s.CardArt && <s.CardArt />}
              <span className="absolute left-4 top-4 rounded-full bg-white/15 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-white">
                Challenge {i + 1}
              </span>
            </div>
            <div className="p-5">
              <div className="font-mono text-xs uppercase tracking-wider text-leaf">{s.discipline}</div>
              <div className="mt-1 font-display text-[28px] font-bold leading-tight text-ink">{s.title}</div>
              <p className="mt-1.5 text-[15px] text-ink/70">{s.tagline}</p>
              <span className="btn-press mt-5 inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-white group-hover:bg-forest-dark">
                Start challenge <ArrowRight className="size-4" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Faint topographic lines behind the title. */
function Contours() {
  const lines = Array.from({ length: 14 }, (_, i) => i)
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {lines.map((i) => (
        <path
          key={i}
          d={`M -50 ${120 + i * 48} C 250 ${60 + i * 52}, 450 ${220 + i * 40}, 700 ${140 + i * 50} S 1100 ${80 + i * 55}, 1260 ${160 + i * 46}`}
          fill="none"
          stroke="#74a85f"
          strokeWidth={i % 4 === 0 ? 1.6 : 0.8}
        />
      ))}
    </svg>
  )
}
