import { test } from 'vitest'
import { designCost } from '../cost'
import { runMorning } from './engine'
import * as S from './strategies'

declare const process: { env: Record<string, string | undefined>; stderr: { write(s: string): void } }

const designs = {
  empty: () => [],
  A: S.strategyA,
  B: S.strategyB,
  C: S.strategyC,
  D: S.strategyD,
  all: S.strategyEverything,
  random: S.randomish,
}

/** Prints a balancing table. Run with: TUNE=1 npx vitest run traffic/sim/tune */
test.skipIf(!process.env.TUNE)('traffic tune', () => {
  for (const [name, make] of Object.entries(designs)) {
    const d = make()
    const t0 = performance.now()
    const r = runMorning(d)
    const ms = performance.now() - t0
    const rain = runMorning(d, 'rainy')
    process.stderr.write(
      `${name.padEnd(7)} $${String(designCost(d)).padStart(7)}  onTime ${r.onTimePct.toFixed(1).padStart(5)}%  unsafe ${String(r.unsafe).padStart(4)}  queue ${String(r.maxMainQueue).padStart(3)} (${r.mainQueueMin.toFixed(1)} min)  wait ${r.avgDropWaitMin.toFixed(1)}m  busLate ${r.busLateMin.map((b) => b.toFixed(0)).join(',')}  | rain ${rain.onTimePct.toFixed(1)}% ${rain.unsafe}  [${Math.round(ms)}ms] top: ${r.unsafeSpots.slice(0, 2).map((s) => `${s.name}:${s.students}`).join('; ')}\n`,
    )
  }
})
