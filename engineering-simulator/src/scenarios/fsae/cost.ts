import { COSTS, DIMS, FRONT_WING_BY_ID, getBusiness, getElectrical, getMechanical, LIDAR, MOUNT_BY_ID, SENSORS } from './config'
import { totalFunds } from './sim/business'
import { partCount, spliceCount } from './sim/power'
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
  const splices = spliceCount(elec)
  const lines: CostLine[] = [
    { label: 'Base car (motor, battery, tires, frame tubing)', amount: COSTS.baseCar },
    { label: `Front wing (${FRONT_WING_BY_ID[mech.frontWing].label.toLowerCase()})`, amount: FRONT_WING_BY_ID[mech.frontWing].cost },
    { label: 'Rear wing', amount: COSTS.rearWing },
    { label: `${LIDAR.label} (comes on the ${MOUNT_BY_ID[LIDAR.mount].label.toLowerCase()})`, amount: LIDAR.cost + MOUNT_BY_ID[LIDAR.mount].bracket },
    { label: 'Longer wheelbase', amount: COSTS.perMmWheelbase * (mech.wheelbaseMm - DIMS.wheelbase.min) },
    { label: 'Wider track', amount: COSTS.perMmTrack * (mech.trackMm - DIMS.track.min) },
  ]
  if (resistors) lines.push({ label: `Resistors × ${resistors}`, amount: COSTS.resistor * resistors })
  if (boosters) lines.push({ label: `Voltage boosters × ${boosters}`, amount: COSTS.booster * boosters })
  if (splices) lines.push({ label: `Crimp connectors × ${splices * 2}`, amount: COSTS.crimpPair * splices })
  for (const s of SENSORS) {
    const mount = elec.mounts[s.id] ? MOUNT_BY_ID[elec.mounts[s.id]!] : null
    if (mount) lines.push({ label: `${s.label} (${mount.label.toLowerCase()})`, amount: s.cost + mount.bracket })
  }
  return lines.filter((l) => l.amount > 0)
}

export function designCost(design: FsaeObject[]): number {
  return costLines(design).reduce((s, l) => s + l.amount, 0)
}

/** Starting money plus everything sponsors are paying. */
export function designFunds(design: FsaeObject[]): number {
  return totalFunds(getBusiness(design))
}
