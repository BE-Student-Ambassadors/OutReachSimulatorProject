import { Check, Flag, Moon, Play, Sun, Video, X } from 'lucide-react'
import { useState } from 'react'
import { money } from '../../../core/format'
import { REQUIRED, SEED_FUNDS } from '../config'
import { costLines, designCost, designFunds } from '../cost'
import type { FsaeResult } from '../sim/engine'
import type { FsaeObject, LapObject } from '../types'

export function RaceDayStation({
  design,
  lastResult,
  locked,
  onStartRun,
  onStartHeat,
  onReplay,
}: {
  design: FsaeObject[]
  lastResult: FsaeResult | null
  locked: boolean
  onStartRun?(variant: 'standard' | 'night'): void
  onStartHeat(night: boolean): void
  onReplay(heat: number): void
}) {
  const [night, setNight] = useState(false)
  const laps = design.filter((o): o is LapObject => o.kind === 'lap')
  const heats = [...new Set(laps.map((l) => l.heat))].sort((a, b) => b - a)
  const cost = designCost(design)
  const funds = designFunds(design)
  const r = lastResult

  const rows = [
    { label: 'Autocross lap', target: `≤ ${REQUIRED.maxLapS} s`, value: r ? `${r.lapS.toFixed(2)} s` : '—', pass: r?.lapPass ?? null },
    {
      label: 'Driverless lap',
      target: `≤ ${REQUIRED.maxDriverlessS} s, ≤ ${REQUIRED.maxConesHit} cones`,
      value: r ? (r.driverless.finished ? `${r.driverless.lapS.toFixed(1)} s · ${r.driverless.conesHit} cones` : 'DNF') : '—',
      pass: r?.driverlessPass ?? null,
    },
    { label: 'Wiring passes inspection', target: '5 of 5 in range, tied down', value: r ? `${r.powerReady} of 5` : '—', pass: r?.powerPass ?? null },
    { label: 'Paid for', target: 'cost ≤ money raised', value: `${money(cost)} / ${money(funds)}`, pass: cost <= funds },
  ]

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-3">
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h3 className="font-display text-lg font-bold">Competition requirements</h3>
          <p className="text-xs text-ink/60">
            {r ? `From the last ${r.variant === 'night' ? 'night' : 'competition'} test.` : 'Run a test to measure the car. The test plays on every teammate’s screen.'}
          </p>
          <div className="mt-3 space-y-1.5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-white ${row.pass === null ? 'bg-ink/20' : row.pass ? 'bg-forest' : 'bg-rust'}`}>
                  {row.pass === null ? null : row.pass ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{row.label}</div>
                  <div className="font-mono text-[11px] text-ink/50">Required {row.target}</div>
                </div>
                <span className="font-mono text-[15px] font-bold tabular">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-2">
            <button
              type="button"
              disabled={locked || !onStartRun}
              onClick={() => onStartRun?.('standard')}
              className="btn-press flex items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 font-display text-sm font-bold uppercase tracking-wide text-white hover:bg-forest-dark disabled:opacity-50"
            >
              <Play className="size-4" /> Competition test
            </button>
            <button
              type="button"
              disabled={locked || !onStartRun}
              onClick={() => onStartRun?.('night')}
              style={{ ['--edge' as string]: '#0b100d' }}
              className="btn-press flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 font-display text-sm font-bold text-white hover:bg-ink/85 disabled:opacity-50"
            >
              <Moon className="size-4" /> Night test
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h3 className="font-display text-[15px] font-bold">What the car costs</h3>
          <div className="mt-2 space-y-0.5 font-mono text-[12px]">
            {costLines(design).map((l) => (
              <div key={l.label} className="flex justify-between gap-3 text-ink/75">
                <span className="truncate">{l.label}</span>
                <span>{money(l.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-line pt-1 font-bold text-ink">
              <span>Total</span>
              <span>{money(cost)}</span>
            </div>
            <div className="flex justify-between pt-2 text-ink/75">
              <span>Starting money</span>
              <span>{money(SEED_FUNDS)}</span>
            </div>
            <div className="flex justify-between text-ink/75">
              <span>Sponsors</span>
              <span>{money(funds - SEED_FUNDS)}</span>
            </div>
            <div className={`flex justify-between border-t border-line pt-1 font-bold ${funds >= cost ? 'text-forest' : 'text-rust'}`}>
              <span>{funds >= cost ? 'Left over' : 'Short by'}</span>
              <span>{money(Math.abs(funds - cost))}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-ink text-white ring-1 ring-line">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Flag className="size-5 text-mint" />
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">Race Day</h3>
            <p className="text-xs text-white/60">Everyone drives the same car. Fastest lap wins. Each cone hit adds 2 s.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="flex rounded-xl bg-white/10 p-1">
            {[false, true].map((n) => (
              <button
                key={String(n)}
                type="button"
                onClick={() => setNight(n)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${night === n ? 'bg-white text-ink' : 'text-white/70 hover:text-white'}`}
              >
                {n ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
                {n ? 'Night' : 'Day'}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={locked}
            onClick={() => onStartHeat(night)}
            style={{ ['--edge' as string]: '#3b5a2f' }}
            className="btn-press flex flex-1 items-center justify-center gap-2 rounded-xl bg-leaf px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-ink hover:bg-mint disabled:opacity-40"
          >
            <Flag className="size-4" /> Start a race heat
          </button>
        </div>
        <p className="px-4 pb-2 text-[11px] text-white/50">Starting a heat counts everyone on the team down together. Teammates’ earlier laps race with you as ghost cars.</p>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {heats.length === 0 && <div className="rounded-xl bg-white/5 px-3 py-6 text-center text-sm text-white/55">No laps yet. Start a heat when the car is ready.</div>}
          {heats.map((h) => {
            const list = laps.filter((l) => l.heat === h).sort((a, b) => a.totalS - b.totalS)
            return (
              <div key={h} className="rounded-xl bg-white/5 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-white/55">Heat {h}</span>
                  <button type="button" onClick={() => onReplay(h)} className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold hover:bg-white/20">
                    <Video className="size-3.5" /> Replay
                  </button>
                </div>
                {list.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <span className={`w-6 font-mono font-bold ${i === 0 ? 'text-sun' : 'text-white/60'}`}>{i + 1}.</span>
                    <span className="flex-1 truncate font-semibold">{l.playerName}</span>
                    <span className="font-mono text-[11px] text-white/50">
                      {l.driveS.toFixed(2)} + {l.conesHit}×2
                    </span>
                    <span className="w-16 text-right font-mono font-bold">{l.totalS.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
