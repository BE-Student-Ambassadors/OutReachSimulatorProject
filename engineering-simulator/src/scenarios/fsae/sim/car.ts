import { CAR, DIMS, FRONT_WING_BY_ID, getElectrical, getMechanical, POWER_PATH_BY_ID } from '../config'
import type { FsaeObject, MechanicalObject } from '../types'
import { readPath, type PowerState } from './power'

export const G = 9.81
/** Air density × ½ is folded into the cl/cd coefficients; this converts m/s to mph for display. */
export const MS_TO_MPH = 2.237

export interface Aero {
  /** Downforce coefficients, N per (m/s)². */
  clFront: number
  clRear: number
  clFloor: number
  cl: number
  cd: number
  /** Front share of total downforce, 0..1. */
  balance: number
  handling: 'understeer' | 'neutral' | 'oversteer'
  bottoming: boolean
}

export interface CarParams {
  massKg: number
  /** Tire friction including frame stiffness, track width and balance. */
  mu: number
  aero: Aero
  powerW: number
  motorVolts: number
  motorState: PowerState
  /** 0..1 average weld quality (unwelded joints count as 0). */
  stiffness: number
  jointsWelded: number
  /** 0..1, how far the wheelbase is from short to long. */
  wheelbaseNorm: number
  wheelbaseM: number
  trackM: number
}

export function aeroFor(mech: MechanicalObject): Aero {
  const wing = FRONT_WING_BY_ID[mech.frontWing]
  const clFront = wing.cl
  const clRear = CAR.clRearBase + CAR.clRearPerPct * mech.rearWing
  const h = mech.rideHeightMm
  const floorShare = Math.max(0, Math.min(1, (CAR.floorNoneMm - h) / (CAR.floorNoneMm - CAR.floorFullMm)))
  const bottoming = h < CAR.bottomOutMm
  const clFloor = CAR.clFloorMax * floorShare * (bottoming ? 0.45 : 1)
  const cl = clFront + clRear + clFloor
  // The floor's downforce sits a little ahead of the middle of the car.
  const balance = (clFront + 0.55 * clFloor) / cl
  const cd = CAR.cdBase + wing.cd + CAR.cdRearPerPct * mech.rearWing + CAR.cdPerMmTrack * (mech.trackMm - DIMS.track.min)
  const handling = balance < CAR.balanceLow ? 'understeer' : balance > CAR.balanceHigh ? 'oversteer' : 'neutral'
  return { clFront, clRear, clFloor, cl, cd, balance, handling, bottoming }
}

/** Downforce and drag (N) at a speed (m/s). */
export function aeroForces(aero: Aero, v: number) {
  return { downforce: aero.cl * v * v, front: aero.clFront * v * v + 0.55 * aero.clFloor * v * v, drag: aero.cd * v * v }
}

export function motorPower(volts: number): { powerW: number; state: PowerState } {
  const spec = POWER_PATH_BY_ID.motor
  const mid = (spec.lo + spec.hi) / 2
  let powerW: number
  let state: PowerState
  if (volts > spec.hi + 1e-6) {
    powerW = CAR.protectPowerW
    state = 'high'
  } else if (volts < spec.lo - 1e-6) {
    powerW = CAR.ratedPowerW * (volts / mid) ** 2
    state = 'low'
  } else {
    powerW = CAR.ratedPowerW * (volts / mid)
    state = 'ok'
  }
  return { powerW, state }
}

export function carParams(design: FsaeObject[]): CarParams {
  const mech = getMechanical(design)
  const elec = getElectrical(design)
  const aero = aeroFor(mech)

  const welded = mech.welds.filter((q) => q >= 0)
  const stiffness = mech.welds.reduce((s, q) => s + Math.max(0, q), 0) / mech.welds.length

  const massKg =
    CAR.baseMassKg +
    FRONT_WING_BY_ID[mech.frontWing].kg +
    CAR.rearWingKg +
    CAR.kgPerMmTrack * (mech.trackMm - DIMS.track.min) +
    CAR.kgPerMmWheelbase * (mech.wheelbaseMm - DIMS.wheelbase.min)

  let mu = CAR.tireMu * (0.8 + 0.2 * stiffness)
  mu *= 1 + 0.08 * ((mech.trackMm - DIMS.track.min) / (DIMS.track.max - DIMS.track.min))
  const off = aero.balance < CAR.balanceLow ? CAR.balanceLow - aero.balance : aero.balance > CAR.balanceHigh ? aero.balance - CAR.balanceHigh : 0
  mu *= 1 - Math.min(0.25, off * 1.4)
  if (aero.bottoming) mu *= 0.94

  const motor = readPath(elec, POWER_PATH_BY_ID.motor, true)
  const { powerW, state } = motorPower(motor.volts)

  return {
    massKg,
    mu,
    aero,
    powerW,
    motorVolts: motor.volts,
    motorState: state,
    stiffness,
    jointsWelded: welded.length,
    wheelbaseNorm: (mech.wheelbaseMm - DIMS.wheelbase.min) / (DIMS.wheelbase.max - DIMS.wheelbase.min),
    wheelbaseM: mech.wheelbaseMm / 1000,
    trackM: mech.trackMm / 1000,
  }
}

/**
 * Grip multiplier for a corner of radius r: a short car turns in better in tight corners,
 * a long car is steadier in fast sweepers.
 */
export function agility(wheelbaseNorm: number, radius: number): number {
  const tight = 1.03 - 0.07 * wheelbaseNorm
  const fast = 0.98 + 0.05 * wheelbaseNorm
  if (radius <= 12) return tight
  if (radius >= 35) return fast
  const f = (radius - 12) / 23
  return tight + (fast - tight) * f
}

/** Top speed on a long straight, m/s (power = drag + rolling resistance). */
export function topSpeed(p: CarParams): number {
  let lo = 0
  let hi = 120
  for (let i = 0; i < 50; i++) {
    const v = (lo + hi) / 2
    const need = (p.aero.cd * v * v + CAR.rollingCoef * p.massKg * G) * v
    if (need > p.powerW) hi = v
    else lo = v
  }
  return lo
}
