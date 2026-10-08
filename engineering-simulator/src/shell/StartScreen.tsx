import { ArrowRight } from 'lucide-react'
import type { AnyScenario } from '../core/scenario'
import { SequoiaMark } from './Sandbox'

export function StartScreen({ scenarios, onStart }: { scenarios: AnyScenario[]; onStart(s: AnyScenario): void }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-paper px-6">
      <Contours />
      <div className="relative flex flex-col items-center text-center">
        <SequoiaMark size={56} />
        <h1 className="mt-5 font-display text-[clamp(40px,6vw,72px)] font-extrabold leading-[0.95] tracking-tight text-forest">
          Sequoia Engineering Lab
        </h1>
        <p className="mt-3 font-display text-xl text-ink/70">Can your team engineer a solution?</p>
      </div>

      <div className="relative mt-10 flex flex-wrap justify-center gap-5">
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onStart(s)}
            className="group w-[min(420px,90vw)] overflow-hidden rounded-2xl bg-white text-left shadow-[0_12px_40px_-12px_rgba(27,42,32,0.35)] ring-1 ring-black/5 transition hover:-translate-y-0.5"
          >
            <div className="relative h-36 overflow-hidden bg-forest">
              <StormArt />
              <span className="absolute left-4 top-4 rounded-full bg-white/15 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-white">
                Challenge 1
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

function StormArt() {
  return (
    <svg viewBox="0 0 420 144" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <pattern id="rain" width="14" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
          <line x1="7" y1="0" x2="7" y2="10" stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="420" height="144" fill="url(#rain)" />
      {/* Simple campus skyline with rising water */}
      <path d="M0 112 H60 V86 H130 V112 H170 V72 H250 V112 H290 V94 H360 V112 H420 V144 H0 Z" fill="#f4f3ec" opacity="0.95" />
      <path d="M0 120 Q 52 114 105 120 T 210 120 T 315 120 T 420 120 V144 H0 Z" fill="#9fd3e6" opacity="0.9" />
      <path d="M0 128 Q 52 122 105 128 T 210 128 T 315 128 T 420 128 V144 H0 Z" fill="#5fa8c9" />
    </svg>
  )
}
