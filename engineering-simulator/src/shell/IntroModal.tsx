import { CloudLightning } from 'lucide-react'
import { useState } from 'react'
import type { AnyScenario } from '../core/scenario'

const SEEN_KEY = 'sel-instructions-seen'

function seenInstructions() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/** Story card, then (first launch only) five short instructions. */
export function IntroModal({ scenario, onDone }: { scenario: AnyScenario; onDone(): void }) {
  const [step, setStep] = useState<'story' | 'how'>('story')
  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* private mode: just show it again next time */
    }
    onDone()
  }

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-ink/45 p-6 backdrop-blur-[3px]">
      <div className="w-full max-w-[540px] animate-pop overflow-hidden rounded-2xl bg-white shadow-2xl">
        {step === 'story' ? (
          <>
            <div className="flex items-center gap-3 bg-rust px-6 py-4 text-white">
              <CloudLightning className="size-7" />
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">{scenario.intro.heading}</h2>
            </div>
            <div className="space-y-3 px-6 py-5 text-[16px] leading-relaxed text-ink/85">
              {scenario.intro.paragraphs.map((p: string) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="flex justify-end px-6 pb-5">
              <button
                type="button"
                autoFocus
                onClick={() => (seenInstructions() ? finish() : setStep('how'))}
                className="btn-press rounded-xl bg-forest px-6 py-3 font-display text-sm font-bold uppercase tracking-wide text-white hover:bg-forest-dark"
              >
                {seenInstructions() ? 'Start engineering' : 'Continue'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 pt-5">
              <div className="font-mono text-xs uppercase tracking-wider text-ink/50">How it works</div>
            </div>
            <ol className="space-y-2.5 px-6 py-4">
              {scenario.instructions.map((t: string, i: number) => (
                <li key={t} className="flex items-center gap-3 text-[16px] text-ink">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mint font-mono text-sm font-semibold text-forest">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
            <div className="flex justify-end px-6 pb-5">
              <button
                type="button"
                autoFocus
                onClick={finish}
                className="btn-press rounded-xl bg-forest px-6 py-3 font-display text-sm font-bold uppercase tracking-wide text-white hover:bg-forest-dark"
              >
                Start engineering
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
