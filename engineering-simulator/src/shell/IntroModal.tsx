import { Award, ChevronRight, Compass } from 'lucide-react'
import { useState } from 'react'
import type { AnyScenario } from '../core/scenario'

/** "How it works" is shown once per scenario. */
const seenKey = (scenarioId: string) => `sel-instructions-seen:${scenarioId}`

function seenInstructions(scenarioId: string) {
  try {
    return localStorage.getItem(seenKey(scenarioId)) === '1'
  } catch {
    return false
  }
}

/** Mission briefing and engineering workflow instructions. */
export function IntroModal({ scenario, onDone }: { scenario: AnyScenario; onDone(): void }) {
  const [step, setStep] = useState<'story' | 'how'>('story')
  const finish = () => {
    try {
      localStorage.setItem(seenKey(scenario.id), '1')
    } catch {
      /* private mode: just show it again next time */
    }
    onDone()
  }

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-[#0b1d2e]/60 p-6 backdrop-blur-xs">
      <div className="w-full max-w-[560px] animate-pop overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#d8e0ea]">
        {step === 'story' ? (
          <>
            <div className="bg-gradient-to-r from-[#003c6c] to-[#002b4d] px-6 py-5 text-white">
              <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-[#fdc700]">
                <Compass className="size-3.5 text-[#f29813]" />
                UC Santa Cruz · Engineering Mission Brief
              </div>
              <h2 className="mt-2 font-sans text-2xl font-black uppercase tracking-wide text-white">
                {scenario.intro.heading}
              </h2>
            </div>
            <div className="space-y-3.5 px-6 py-5 text-[15px] leading-relaxed text-[#0b1d2e]/85">
              {scenario.intro.paragraphs.map((p: string) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-[#f4f6fa] px-6 py-4 bg-[#f8fafc]">
              <span className="font-mono text-xs text-[#75787b]">
                Discipline: <strong className="text-[#003c6c]">{scenario.discipline}</strong>
              </span>
              <button
                type="button"
                autoFocus
                onClick={() => (seenInstructions(scenario.id) ? finish() : setStep('how'))}
                className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[#003c6c] px-6 py-2.5 font-sans text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#f29813]"
              >
                <span>{seenInstructions(scenario.id) ? 'Start Engineering' : 'Next: How It Works'}</span>
                <ChevronRight className="size-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-gradient-to-r from-[#003c6c] to-[#002b4d] px-6 py-5 text-white">
              <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-[#fdc700]">
                <Award className="size-3.5 text-[#f29813]" />
                Engineering Workflow
              </div>
              <h2 className="mt-1 font-sans text-2xl font-black text-white">How The Simulation Works</h2>
            </div>
            <ol className="space-y-3 px-6 py-5">
              {scenario.instructions.map((t: string, i: number) => (
                <li key={t} className="flex items-start gap-3 text-[15px] text-[#0b1d2e]">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#003c6c] font-mono text-xs font-bold text-white shadow-xs">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 leading-normal">{t}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between border-t border-[#f4f6fa] px-6 py-4 bg-[#f8fafc]">
              <button
                type="button"
                onClick={() => setStep('story')}
                className="text-xs font-semibold text-[#75787b] hover:text-[#003c6c]"
              >
                ← Back to Mission
              </button>
              <button
                type="button"
                autoFocus
                onClick={finish}
                className="btn-press rounded-xl bg-[#003c6c] px-6 py-2.5 font-sans text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#f29813]"
              >
                Launch Simulation Sandbox
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
