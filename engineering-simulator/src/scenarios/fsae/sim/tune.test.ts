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
  untouchedSw: S.untouchedSoftware,
  easyOnly: S.easyOnly,
  twoCourses: S.twoCourses,
  skippedMed: S.skippedMedium,
  rearWheel: S.rearWheelSensor,
  lidarOnly: S.lidarOnly,
  broke: S.brokeTeam,
  hotMotor: S.hotMotor,
  hotCrimp: S.hotCrimp,
  looseCrimp: S.looseCrimp,
  untidy: S.untidy,
}

/** Prints a balancing table. Run with: TUNE=1 npx vitest run fsae/sim/tune */
test.skipIf(!process.env.TUNE)('fsae tune', () => {
  for (const [name, make] of Object.entries(designs)) {
    const d = make()
    const r = evaluate(d)
    const n = evaluate(d, 'night')
    const pass = (x: typeof r) => (x.lapPass && x.driverlessPass && x.powerPass && x.fundsPass ? 'PASS' : 'fail')
    const dl = (x: typeof r) =>
      x.driverless.finished ? `${x.driverless.lapS.toFixed(1).padStart(5)}s ${String(x.driverless.conesHit).padStart(2)}c (col ${x.driverless.colorHits} sight ${Math.round(x.driverless.sightLimitedShare * 100)}%)` : 'DNF'.padEnd(26)
    process.stderr.write(
      `${name.padEnd(11)} lap ${r.lapS.toFixed(2).padStart(6)}s ${r.powerKw.toFixed(0)}kW ${r.aero.handling.padEnd(10)} wire ${r.powerReady}/${r.power.length} | DL ${dl(r)} gap ${r.driverless.minGapM.toFixed(2)} | $${r.cost}/${r.funds} ${pass(r)} | night DL ${dl(n)} ${pass(n)}\n`,
    )
  }
})
