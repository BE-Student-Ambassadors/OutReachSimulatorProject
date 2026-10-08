import { test } from 'vitest'
import { designCost } from '../cost'
import { campus, runStorm } from './engine'
import * as S from './strategies'

declare const process: { env: Record<string, string | undefined>; stderr: { write(s: string): void } }

const designs = {
  empty: () => [],
  A: S.strategyA,
  B: S.strategyB,
  C: S.strategyC,
  D: S.strategyD,
  all: S.strategyEverything,
  barrierA: S.barrierAroundA,
  BplusBar: S.strategyBWithBarrier,
  random: S.randomish,
}

/** Prints a balancing table. Run with: TUNE=1 npx vitest run tune */
test.skipIf(!process.env.TUNE)('tune', () => {
  for (const [name, make] of Object.entries(designs)) {
    const d = make()
    const r = runStorm(d)
    const adv = runStorm(d, 'advanced')
    process.stderr.write(
      `${name.padEnd(9)} $${String(designCost(d)).padStart(7)}  flood ${r.maxFloodIn.toFixed(2).padStart(6)} [${campus.buildings.map((b, i) => `${b.key}:${r.buildingFloodIn[i].toFixed(1)}`).join(' ')}]  managed ${r.runoffManagedPct.toFixed(1)}%  | adv flood ${adv.maxFloodIn.toFixed(1)} managed ${adv.runoffManagedPct.toFixed(1)}%  off S${Math.round(r.offsiteBy.south)} E${Math.round(r.offsiteBy.east)} ponds ${r.ponds.map((p) => p.fillPct.toFixed(0)).join('/')}\n`,
    )
  }
})
