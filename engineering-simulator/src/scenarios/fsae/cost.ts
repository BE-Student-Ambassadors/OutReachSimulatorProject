import { COSTS, DIMS, getBusiness, getElectrical, getMechanical } from './config'
import { totalFunds } from './sim/business'
import { partCount } from './sim/power'
import type { FsaeObject } from './types'

export interface CostLine {
  label: string
  amount: number
}

export function costLines(design: FsaeObject[]): CostLine[] {
  const mech = getMechanical(design)
  const elec = getElectrical(design)
  const resistors = partCount(elec, 'resistor')
  const boosters = partCount(elec, 'booster')
  const lines: CostLine[] = [
    { label: 'Base car (motor, battery, tires, frame tubing)', amount: COSTS.baseCar },
    { label: 'Front wing', amount: COSTS.frontWing },
    { label: 'Rear wing', amount: COSTS.rearWing },
    { label: 'Longer wheelbase', amount: COSTS.perMmWheelbase * (mech.wheelbaseMm - DIMS.wheelbase.min) },
    { label: 'Wider track', amount: COSTS.perMmTrack * (mech.trackMm - DIMS.track.min) },
  ]
  if (resistors) lines.push({ label: `Resistors × ${resistors}`, amount: COSTS.resistor * resistors })
  if (boosters) lines.push({ label: `Voltage boosters × ${boosters}`, amount: COSTS.booster * boosters })
  return lines.filter((l) => l.amount > 0)
}

export function designCost(design: FsaeObject[]): number {
  return costLines(design).reduce((s, l) => s + l.amount, 0)
}

/** Starting money plus everything sponsors have signed for. */
export function designFunds(design: FsaeObject[]): number {
  return totalFunds(getBusiness(design))
}
