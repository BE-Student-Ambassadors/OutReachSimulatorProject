import {
  AIRFRAME_MATERIALS,
  CHUTE_SPECS,
  FIN_PROFILES,
  getAirframe,
  getGyroConfig,
  getLaunchSetup,
  getPayloadMotor,
  getPayloadTestRig,
  IMPULSE_CLASSES,
  NOSE_CONES,
  PAYLOAD_MOTORS,
  PROGRAM_SPECS,
  STATION_COSTS,
} from './config'
import type { RocketObject } from './types'

export function designCost(design: RocketObject[]): number {
  // Base cost is 0 when nothing has been customized yet, or sums the configured sub-team hardware
  const hasRealEdits = design.some((o) => o.kind !== 'rolePref')
  if (!hasRealEdits) return 0

  const gyro = getGyroConfig(design)
  const motor = getPayloadMotor(design)
  const testRig = getPayloadTestRig(design)
  const airframe = getAirframe(design)
  const launch = getLaunchSetup(design)

  const avgGyro = (gyro.rollScore + gyro.pitchScore + gyro.yawScore) / 3
  const gyroCost = avgGyro > 40 ? STATION_COSTS.gyroCalibration : 0

  const motorCost = PAYLOAD_MOTORS[motor.motorId].cost
  const chuteCost = CHUTE_SPECS[testRig.chuteSize].cost

  const matCost = AIRFRAME_MATERIALS[airframe.materialId].cost
  const noseCost = NOSE_CONES[airframe.noseConeId].cost
  const finCost = FIN_PROFILES[airframe.finProfileId].cost
  const impulseCost = IMPULSE_CLASSES[launch.impulseId].cost

  let progCost = 0
  for (const o of design) {
    if (o.kind === 'program') {
      progCost += PROGRAM_SPECS[o.program].cost
    }
  }

  return gyroCost + motorCost + chuteCost + matCost + noseCost + finCost + impulseCost + progCost
}
