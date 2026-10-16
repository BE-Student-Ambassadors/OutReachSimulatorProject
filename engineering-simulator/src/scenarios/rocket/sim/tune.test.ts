import { test } from 'vitest'
import { designCost } from '../cost'
import { evaluateRocketDesign } from './engine'
import {
  emptyDesign,
  heavyMotorSplatterDesign,
  overBudgetDesign,
  strategyA,
  strategyB,
  strategyC,
  strategyCrosswind,
  uncalibratedGyroSpinDesign,
  weakMotorSpinDesign,
} from './strategies'

declare const process: { env: Record<string, string | undefined> }

test('Rocket Team balancing table', () => {
  if (!process.env.TUNE) return
  const cases = [
    ['Empty / Default', emptyDesign],
    ['Strategy A (Fiberglass)', strategyA],
    ['Strategy B (Carbon + M)', strategyB],
    ['Strategy C (Aluminum + O)', strategyC],
    ['Strategy D (Crosswind)', strategyCrosswind],
    ['Heavy Motor (Splatter)', heavyMotorSplatterDesign],
    ['Weak Motor (Spin-Out)', weakMotorSpinDesign],
    ['Bad Gyro (Spin-Out)', uncalibratedGyroSpinDesign],
    ['Over Budget Everything', overBudgetDesign],
  ] as const

  const rows = cases.map(([name, d]) => {
    const std = evaluateRocketDesign([...d], 'standard')
    const wind = evaluateRocketDesign([...d], 'crosswind')
    return {
      Design: name,
      Cost: `$${(designCost([...d]) / 1000).toFixed(0)}k`,
      Apogee: `${std.apogeeFt} ft (${std.rocketOutcome})`,
      Payload: `${std.landingDistFt} ft (${std.payloadOutcome})`,
      PassStd: std.rocketPassed && std.payloadPassed ? 'PASS' : 'FAIL',
      PassWind: wind.rocketPassed && wind.payloadPassed ? 'PASS' : 'FAIL',
    }
  })
  console.table(rows)
})
