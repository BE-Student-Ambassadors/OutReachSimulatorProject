import { test } from 'vitest'
import { evaluateRocketDesign } from './engine'
import { defaultNumbers, emptyDesign, STRATEGY_PARTS, strategyMid, strategyPremium, strategyThrifty, teamDesign } from './strategies'

declare const process: { env: Record<string, string | undefined> }

test('Rocket Team balancing table', () => {
  if (!process.env.TUNE) return
  const { MID_PARTS, CHEAP_PARTS, PREMIUM_PARTS } = STRATEGY_PARTS
  const cases = [
    ['Empty', emptyDesign],
    ['Starting numbers (mid parts)', defaultNumbers],
    ['A: mid parts', strategyMid],
    ['B: thrifty parts', strategyThrifty],
    ['C: premium parts', strategyPremium],
    ['Cheap @ full throttle', teamDesign({ parts: CHEAP_PARTS, settings: { throttle: 100, burn_time: 4 } })],
    ['Mid, chute at 300 ft', teamDesign({ parts: MID_PARTS, settings: { throttle: 55, burn_time: 3, deploy_altitude: 300 } })],
    ['Premium, no sponsors', teamDesign({ parts: PREMIUM_PARTS, settings: { throttle: 50, burn_time: 2.5, deploy_altitude: 1000 } })],
  ] as const

  const rows = cases.map(([name, d]) => {
    const r = evaluateRocketDesign([...d])
    return {
      Design: name,
      Outcome: r.outcome,
      Apogee: `${r.apogeeFt} ft`,
      Peak: `${r.peakSpeedMph}/${r.maxSafeMph} mph`,
      Chute: `${r.chute}${r.deployAltFt ? ` @${r.deployAltFt}` : ''}`,
      Landing: `${r.landingFps} ft/s`,
      Money: `$${r.spent} / $${r.funds}`,
      Pass: r.apogeePassed && r.recoveryPassed && r.budgetPassed ? 'PASS' : 'FAIL',
    }
  })
  console.table(rows)
})
