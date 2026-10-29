import { BookOpen, X } from 'lucide-react'
import { play } from '../audio/sfx'
import type { GuidePageId } from './useGuide'

/**
 * The in-game guide: what the challenge is about (the real-world context) and, for each
 * station, what the job is, the steps, and what every option means. It explains the system,
 * never what to change to pass.
 */

export interface GuideSection {
  heading: string
  body?: string[]
  /** Numbered steps. */
  steps?: string[]
  /** Words and options, each with what it means. */
  terms?: { term: string; meaning: string }[]
}

export interface GuidePage {
  title: string
  /** One or two sentences at the top. */
  lead: string
  sections: GuideSection[]
}

type Page = GuidePageId

export function GuideButton({ onClick }: { onClick(): void }) {
  return (
    <button
      type="button"
      onClick={() => {
        play('click')
        onClick()
      }}
      className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-xs font-bold ring-1 ring-line hover:bg-mint hover:text-forest"
    >
      <BookOpen className="size-3.5" /> Guide
    </button>
  )
}

export function GuideModal({
  page,
  challenge,
  station,
  stationLabel,
  onPage,
  onClose,
}: {
  page: Page
  challenge: GuidePage
  station: GuidePage
  stationLabel: string
  onPage(p: Page): void
  onClose(): void
}) {
  const g = page === 'challenge' ? challenge : station
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-[760px] animate-pop flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-5 pt-4">
          {(
            [
              ['challenge', 'The challenge'],
              ['station', `${stationLabel} guide`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onPage(id)}
              className={`-mb-px rounded-t-lg border-x border-t px-3 py-2 font-display text-sm font-bold ${page === id ? 'border-line bg-white text-forest' : 'border-transparent text-ink/50 hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
          <button type="button" onClick={onClose} aria-label="Close" className="mb-2 ml-auto text-ink/50 hover:text-ink">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">{g.title}</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-ink/75">{g.lead}</p>
          </div>
          {g.sections.map((s) => (
            <section key={s.heading}>
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-forest">{s.heading}</h3>
              {s.body?.map((p) => (
                <p key={p} className="mt-1.5 text-sm leading-relaxed text-ink/80">
                  {p}
                </p>
              ))}
              {s.steps && (
                <ol className="mt-2 space-y-1.5">
                  {s.steps.map((t, i) => (
                    <li key={t} className="flex items-start gap-2.5 text-sm leading-snug text-ink/85">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-forest font-mono text-[10px] font-bold text-white">{i + 1}</span>
                      <span className="pt-px">{t}</span>
                    </li>
                  ))}
                </ol>
              )}
              {s.terms && (
                <dl className="mt-2 grid grid-cols-[minmax(120px,max-content)_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-paper p-3 ring-1 ring-line">
                  {s.terms.map((t) => (
                    <div key={t.term} className="contents">
                      <dt className="text-sm font-bold text-ink">{t.term}</dt>
                      <dd className="text-sm leading-snug text-ink/75">{t.meaning}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-paper px-5 py-3">
          <span className="text-xs text-ink/55">Reopen this any time with the Guide button at the top.</span>
          <button type="button" onClick={onClose} className="rounded-xl bg-forest px-5 py-2 text-sm font-bold text-white hover:bg-forest-dark">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
