import { IDEAL_BAY_ORDER } from '../config'
import type { RocketObject } from '../types'

/**
 * Reference strategies for Rocket Team (IREC Challenge):
 * - Empty / Default: Uncalibrated gyro, weak motor, scrambled rocket bay order -> fails both sub-teams
 * - Strategy A (Standard Composite IREC): S-Glass Fiberglass + Ogive + Trapezoidal + N-Class + Aero-Torque Motor + Calibrated Gyro
 * - Strategy B (Ultralight Carbon Precision): Carbon Fiber + Von Karman + Clipped Delta + M-Class + Ballast Trim + Carbon-Twin Motor
 * - Strategy C (Heavy-Duty Aluminum + O-Class): 6061 Aluminum + Conical + Clipped Delta + O-Class + Reefing + Aero-Torque Motor
 * - Strategy D (Crosswind Finals Winner): Strategy A + Carbon-Twin Motor + Wind Sonde + Reefing + 82° Rail + 15° Wind Lead
 * - Failure Fixtures:
 *   - heavyMotorSplatter: Uses 9.8 kg Heavy-Iron motor -> comedic splatter!
 *   - weakMotorSpin: Uses 0.6 kg Micro-Gimbal motor -> spins out of control!
 *   - uncalibratedGyroSpin: Uses uncalibrated gyro (30%) -> spins out of control!
 *   - unstableRocketWeights: Places heavy motor/fuel at the top -> CG behind CP, unstable tumble!
 *   - overBudgetEverything: All top-end components + all programs -> exceeds $120k budget!
 */

export const emptyDesign: RocketObject[] = []

/** Strategy A: Balanced S-Glass Fiberglass IREC standard build ($84k) */
export const strategyA: RocketObject[] = [
  { id: 'station:payload-gyro', kind: 'gyro', rollScore: 88, pitchScore: 90, yawScore: 86, updatedAt: 1 },
  { id: 'station:payload-motor', kind: 'payloadMotor', motorId: 'aero-torque', updatedAt: 1 },
  {
    id: 'station:payload-tester',
    kind: 'payloadTest',
    dropAltitudeFt: 4000,
    armedChuteAltFt: 1200,
    windLeadDeg: 8,
    chuteSize: 'main-standard',
    updatedAt: 1,
  },
  { id: 'station:rocket-mass', kind: 'weightDist', bayOrder: [...IDEAL_BAY_ORDER], updatedAt: 1 },
  {
    id: 'station:rocket-material',
    kind: 'airframe',
    materialId: 'fiberglass',
    noseConeId: 'ogive',
    finProfileId: 'trapezoidal',
    updatedAt: 1,
  },
  {
    id: 'station:rocket-tester',
    kind: 'launchSetup',
    railAngleDeg: 86,
    impulseId: 'n-class',
    ballastTrimKg: 0.5,
    updatedAt: 1,
  },
]

/** Strategy B: Ultralight Carbon Fiber + M-Class efficient build ($105k) */
export const strategyB: RocketObject[] = [
  { id: 'station:payload-gyro', kind: 'gyro', rollScore: 92, pitchScore: 85, yawScore: 89, updatedAt: 1 },
  { id: 'station:payload-motor', kind: 'payloadMotor', motorId: 'aero-torque', updatedAt: 1 },
  {
    id: 'station:payload-tester',
    kind: 'payloadTest',
    dropAltitudeFt: 3500,
    armedChuteAltFt: 1150,
    windLeadDeg: 7,
    chuteSize: 'main-standard',
    updatedAt: 1,
  },
  { id: 'station:rocket-mass', kind: 'weightDist', bayOrder: [...IDEAL_BAY_ORDER], updatedAt: 1 },
  {
    id: 'station:rocket-material',
    kind: 'airframe',
    materialId: 'carbon',
    noseConeId: 'von-karman',
    finProfileId: 'clipped-delta',
    updatedAt: 1,
  },
  {
    id: 'station:rocket-tester',
    kind: 'launchSetup',
    railAngleDeg: 86,
    impulseId: 'm-class',
    ballastTrimKg: 0.0,
    updatedAt: 1,
  },
]

/** Strategy C: Heavy-Duty 6061 Aluminum + O-Class high-thrust build ($98k) */
export const strategyC: RocketObject[] = [
  { id: 'station:payload-gyro', kind: 'gyro', rollScore: 82, pitchScore: 84, yawScore: 80, updatedAt: 1 },
  { id: 'station:payload-motor', kind: 'payloadMotor', motorId: 'aero-torque', updatedAt: 1 },
  {
    id: 'station:payload-tester',
    kind: 'payloadTest',
    dropAltitudeFt: 4500,
    armedChuteAltFt: 1250,
    windLeadDeg: 9,
    chuteSize: 'main-standard',
    updatedAt: 1,
  },
  { id: 'station:rocket-mass', kind: 'weightDist', bayOrder: [...IDEAL_BAY_ORDER], updatedAt: 1 },
  {
    id: 'station:rocket-material',
    kind: 'airframe',
    materialId: 'aluminum',
    noseConeId: 'blunt',
    finProfileId: 'clipped-delta',
    updatedAt: 1,
  },
  {
    id: 'station:rocket-tester',
    kind: 'launchSetup',
    railAngleDeg: 85,
    impulseId: 'o-class',
    ballastTrimKg: 2.5,
    updatedAt: 1,
  },
  { id: 'prog:reefing', kind: 'program', program: 'reefing', updatedAt: 1 },
]

/** Strategy D: High-Wind Desert Crosswind Finals build ($109k) */
export const strategyCrosswind: RocketObject[] = [
  { id: 'station:payload-gyro', kind: 'gyro', rollScore: 94, pitchScore: 92, yawScore: 95, updatedAt: 1 },
  { id: 'station:payload-motor', kind: 'payloadMotor', motorId: 'carbon-twin', updatedAt: 1 },
  {
    id: 'station:payload-tester',
    kind: 'payloadTest',
    dropAltitudeFt: 4000,
    armedChuteAltFt: 1200,
    windLeadDeg: 14,
    chuteSize: 'main-standard',
    updatedAt: 1,
  },
  { id: 'station:rocket-mass', kind: 'weightDist', bayOrder: [...IDEAL_BAY_ORDER], updatedAt: 1 },
  {
    id: 'station:rocket-material',
    kind: 'airframe',
    materialId: 'fiberglass',
    noseConeId: 'ogive',
    finProfileId: 'trapezoidal',
    updatedAt: 1,
  },
  {
    id: 'station:rocket-tester',
    kind: 'launchSetup',
    railAngleDeg: 82,
    impulseId: 'n-class',
    ballastTrimKg: 0.0,
    updatedAt: 1,
  },
  { id: 'prog:reefing', kind: 'program', program: 'reefing', updatedAt: 1 },
  { id: 'prog:windSonde', kind: 'program', program: 'windSonde', updatedAt: 1 },
]

/** Failure Fixture 1: Motor too heavy -> Payload splatters into pieces! */
export const heavyMotorSplatterDesign: RocketObject[] = strategyA.map((o) =>
  o.kind === 'payloadMotor' ? { ...o, motorId: 'heavy-iron' } : o,
)

/** Failure Fixture 2: Motor too light/weak -> Payload spins out of control! */
export const weakMotorSpinDesign: RocketObject[] = strategyA.map((o) =>
  o.kind === 'payloadMotor' ? { ...o, motorId: 'micro-gimbal' } : o,
)

/** Failure Fixture 3: Gyroscope out of calibration -> Payload spins out of control! */
export const uncalibratedGyroSpinDesign: RocketObject[] = strategyA.map((o) =>
  o.kind === 'gyro' ? { ...o, rollScore: 30, pitchScore: 40, yawScore: 25 } : o,
)

/** Failure Fixture 4: Over-budget max spec build (> $120,000) */
export const overBudgetDesign: RocketObject[] = [
  { id: 'station:payload-gyro', kind: 'gyro', rollScore: 95, pitchScore: 95, yawScore: 95, updatedAt: 1 },
  { id: 'station:payload-motor', kind: 'payloadMotor', motorId: 'carbon-twin', updatedAt: 1 },
  {
    id: 'station:payload-tester',
    kind: 'payloadTest',
    dropAltitudeFt: 4000,
    armedChuteAltFt: 1200,
    windLeadDeg: 8,
    chuteSize: 'tandem-large',
    updatedAt: 1,
  },
  { id: 'station:rocket-mass', kind: 'weightDist', bayOrder: [...IDEAL_BAY_ORDER], updatedAt: 1 },
  {
    id: 'station:rocket-material',
    kind: 'airframe',
    materialId: 'carbon',
    noseConeId: 'von-karman',
    finProfileId: 'clipped-delta',
    updatedAt: 1,
  },
  {
    id: 'station:rocket-tester',
    kind: 'launchSetup',
    railAngleDeg: 86,
    impulseId: 'o-class',
    ballastTrimKg: 2.0,
    updatedAt: 1,
  },
  { id: 'prog:reefing', kind: 'program', program: 'reefing', updatedAt: 1 },
  { id: 'prog:carbonFins', kind: 'program', program: 'carbonFins', updatedAt: 1 },
  { id: 'prog:windSonde', kind: 'program', program: 'windSonde', updatedAt: 1 },
]
