import { getBusiness, getMechanical } from './config'
import { totalFunds } from './sim/business'
import { partsSpent } from './sim/build'
import type { RocketObject } from './types'

/** Money spent on parts. */
export function designCost(design: RocketObject[]): number {
  return partsSpent(getMechanical(design))
}

/** Starting money plus everything sponsors have paid. */
export function designFunds(design: RocketObject[]): number {
  return totalFunds(getBusiness(design))
}
