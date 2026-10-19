import { test } from 'vitest'
import { evaluate } from './engine'
import * as S from './strategies'

declare const process: { env: Record<string, string | undefined>; stderr: { write(s: string): void } }

const designs = {
  empty: S.empty,
  downforce: S.downforce,
  lowDrag: S.lowDrag,
  balanced: S.balanced,
  budget: S.budget,
  noElec: S.noElectrical,
  unbalanced: S.unbalanced,
  scraping: S.scraping,
  sloppyWeld: S.sloppyWelds,
  sloppyMath: S.sloppyMath,
  broke: S.brokeTeam,
  dimLights: S.dimLights,
  hotMotor: S.hotMotor,
}

/** Prints a balancing table. Run with: TUNE=1 npx vitest run fsae/sim/tune */
test.skipIf(!process.env.TUNE)('fsae tune', () => {
  for (const [name, make] of Object.entries(designs)) {
    const d = make()
    const r = evaluate(d)
    const n = evaluate(d, 'night')
    const pass = (x: typeof r) => (x.lapPass && x.conesPass && x.powerPass && x.fundsPass ? 'PASS' : 'fail')
    process.stderr.write(
      `${name.padEnd(11)} lap ${r.lapS.toFixed(2).padStart(6)}s top ${r.topMph.toFixed(0).padStart(3)} slow ${r.slowestMph.toFixed(0).padStart(3)} (${r.slowestPlace})  DF ${r.downforceN.toFixed(0).padStart(4)}N drag ${r.dragN.toFixed(0).padStart(4)}N bal ${(r.aero.balance * 100).toFixed(0)}% ${r.aero.handling.padEnd(10)} ${r.powerKw.toFixed(0)}kW  pwr ${r.powerInRange}/5  cones ${r.driverless.missed} ph ${r.driverless.phantom} acc ${r.accuracyPct}%  $${r.cost}/${r.funds}  ${pass(r)} | night lap ${n.lapS.toFixed(2)} cones ${n.driverless.missed} vis ${n.visibilityPct}% ${pass(n)}\n`,
    )
  }
})
