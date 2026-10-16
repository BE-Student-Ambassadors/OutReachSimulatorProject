import type { DesignObject } from '../../core/scenario'

export type SubTeamId = 'payload' | 'rocket'

export type RocketRoleId =
  | 'payload-gyro'
  | 'payload-motor'
  | 'payload-tester'
  | 'rocket-mass'
  | 'rocket-material'
  | 'rocket-tester'

export type PayloadMotorId = 'micro-gimbal' | 'light-servo' | 'aero-torque' | 'carbon-twin' | 'heavy-iron'

export type ChuteSizeId = 'drogue-small' | 'main-standard' | 'tandem-large'

export type RocketBayId =
  | 'nose-ballast'
  | 'payload-bay'
  | 'avionics-bay'
  | 'recovery-bay'
  | 'propellant-tank'
  | 'motor-nozzle'

export type AirframeMaterialId = 'cardboard' | 'aluminum' | 'fiberglass' | 'carbon' | 'steel'

export type NoseConeId = 'blunt' | 'conical' | 'ogive' | 'von-karman'

export type FinProfileId = 'rectangular' | 'trapezoidal' | 'clipped-delta'

export type ImpulseClassId = 'l-class' | 'm-class' | 'n-class' | 'o-class'

export type RocketProgramId = 'reefing' | 'carbonFins' | 'windSonde'

export type RocketVariantId = 'standard' | 'payload-drop' | 'rocket-launch' | 'crosswind'

/** Role 1 (Payload): Gyroscope calibration state across 3 axes (0..100 each). */
export interface GyroConfigObject extends DesignObject {
  id: 'station:payload-gyro'
  kind: 'gyro'
  rollScore: number
  pitchScore: number
  yawScore: number
  updatedAt: number
}

/** Role 2 (Payload): Reaction/stabilization motor selection. */
export interface PayloadMotorObject extends DesignObject {
  id: 'station:payload-motor'
  kind: 'payloadMotor'
  motorId: PayloadMotorId
  updatedAt: number
}

/** Role 3 (Payload): Payload drop test rig configuration. */
export interface PayloadTestRigObject extends DesignObject {
  id: 'station:payload-tester'
  kind: 'payloadTest'
  dropAltitudeFt: number
  armedChuteAltFt: number
  windLeadDeg: number
  chuteSize: ChuteSizeId
  updatedAt: number
}

/** Role 4 (Rocket): Internal bay weight ordering from nose (index 0) to tail (index 5). */
export interface WeightDistObject extends DesignObject {
  id: 'station:rocket-mass'
  kind: 'weightDist'
  /** Ordered from Nose (top, 0) to Tail (bottom, 5). */
  bayOrder: RocketBayId[]
  updatedAt: number
}

/** Role 5 (Rocket): Airframe material, nose cone shape, and fin geometry. */
export interface AirframeObject extends DesignObject {
  id: 'station:rocket-material'
  kind: 'airframe'
  materialId: AirframeMaterialId
  noseConeId: NoseConeId
  finProfileId: FinProfileId
  updatedAt: number
}

/** Role 6 (Rocket): Launch pad setup & motor impulse trim. */
export interface LaunchSetupObject extends DesignObject {
  id: 'station:rocket-tester'
  kind: 'launchSetup'
  railAngleDeg: number
  impulseId: ImpulseClassId
  ballastTrimKg: number
  updatedAt: number
}

/** Optional team-wide engineering program toggles in the left toolbox. */
export interface RocketProgramObject extends DesignObject {
  kind: 'program'
  program: RocketProgramId
  updatedAt: number
}

/** Player's 1st and 2nd role preference tier list (synced across the group). */
export interface RolePrefObject extends DesignObject {
  kind: 'rolePref'
  playerId: string
  playerName: string
  /** Up to 2 preferred roles, 1st choice first. */
  choices: RocketRoleId[]
  updatedAt: number
}

export type RocketObject =
  | GyroConfigObject
  | PayloadMotorObject
  | PayloadTestRigObject
  | WeightDistObject
  | AirframeObject
  | LaunchSetupObject
  | RocketProgramObject
  | RolePrefObject
