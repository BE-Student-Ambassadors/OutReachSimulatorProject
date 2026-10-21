/**
 * FPV drone flight for filming launches. Plain TypeScript (no React or Three) so it can be
 * tested on its own. Units are launch-scene units (see sceneScale.ts); y is up.
 *
 * Arcade controls: move with WASD relative to where the camera faces, hold lift (Space) to stay
 * up. Without lift the drone falls with gravity and settles on the ground.
 */

export interface DroneInput {
  /** -1..1: back / forward. */
  forward: number
  /** -1..1: left / right. */
  strafe: number
  /** -1..1: turn left / right. */
  yaw: number
  /** 0..1: rotor lift. Full lift climbs; none and the drone falls. */
  lift: number
  /** -1..1: tilt the camera down / up. */
  tilt: number
  boost: boolean
}

export interface DroneState {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** Heading, radians (0 = looking toward -z, positive turns left). */
  yaw: number
  /** Camera uptilt, radians. */
  camTilt: number
  /** Body lean for the view, radians: forward pitch and sideways bank. */
  lean: number
  bank: number
}

export const DRONE = {
  maxSpeed: 16,
  boostSpeed: 26,
  /**
   * Fastest climb with full lift: most of the way to the rocket's peak climb on screen
   * (about 65–77 units/s), so it can chase the rocket but falls a little behind.
   */
  climbSpeed: 58,
  /** Upward push with lift, units/s² (strong, so short taps hop and a hold rockets up). */
  thrust: 75,
  /** Downward pull without lift, units/s², and the fastest it falls. */
  gravity: 38,
  maxFall: 60,
  /** How quickly the drone reaches the speed the controls ask for, per second. */
  response: 3.2,
  yawRate: 2.0,
  tiltRate: 0.9,
  minTilt: -0.5,
  maxTilt: 1.35,
  minY: 0.8,
  maxY: 300,
  /** How far from the pad it may fly (the radio range). */
  maxRange: 320,
  /** Mouse look: radians per pixel of mouse movement. */
  mouseSensitivity: 0.0024,
} as const

export const NO_INPUT: DroneInput = { forward: 0, strafe: 0, yaw: 0, lift: 0, tilt: 0, boost: false }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Where each teammate's drone starts: spread around the pad, sitting on the ground, facing it. */
export function droneStart(slot: number): DroneState {
  const a = 0.35 + slot * 1.25
  const r = 30
  const x = Math.sin(a) * r
  const z = Math.cos(a) * r
  return { x, y: DRONE.minY, z, vx: 0, vy: 0, vz: 0, yaw: Math.atan2(x, z), camTilt: 0.25, lean: 0, bank: 0 }
}

export function stepDrone(s: DroneState, input: DroneInput, dt: number): DroneState {
  const yaw = s.yaw - input.yaw * DRONE.yawRate * dt
  const camTilt = clamp(s.camTilt + input.tilt * DRONE.tiltRate * dt, DRONE.minTilt, DRONE.maxTilt)
  const top = input.boost ? DRONE.boostSpeed : DRONE.maxSpeed
  // Forward is where the drone faces; right is 90° clockwise from it.
  const fx = -Math.sin(yaw)
  const fz = -Math.cos(yaw)
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
  // Sitting on the ground with no lift, the drone can't fly sideways.
  const grounded = s.y <= DRONE.minY + 1e-3 && input.lift <= 0
  const drive = grounded ? 0 : 1
  const wantX = (fx * input.forward + rx * input.strafe) * top * drive
  const wantZ = (fz * input.forward + rz * input.strafe) * top * drive
  const k = 1 - Math.exp(-DRONE.response * (grounded ? 3 : 1) * dt)
  let vx = s.vx + (wantX - s.vx) * k
  let vz = s.vz + (wantZ - s.vz) * k
  let vy =
    input.lift > 0
      ? Math.min(Math.max(s.vy, input.lift * DRONE.climbSpeed), s.vy + DRONE.thrust * dt)
      : Math.max(-DRONE.maxFall, s.vy - DRONE.gravity * dt)
  let x = s.x + vx * dt
  let y = s.y + vy * dt
  let z = s.z + vz * dt
  if (y < DRONE.minY) {
    y = DRONE.minY
    vy = Math.max(0, vy)
  }
  if (y > DRONE.maxY) {
    y = DRONE.maxY
    vy = Math.min(0, vy)
  }
  const range = Math.hypot(x, z)
  if (range > DRONE.maxRange) {
    x *= DRONE.maxRange / range
    z *= DRONE.maxRange / range
    vx *= 0.5
    vz *= 0.5
  }
  // The body leans into the motion it is speeding up into, like a real quad.
  const along = (vx * fx + vz * fz) / DRONE.boostSpeed
  const side = (vx * rx + vz * rz) / DRONE.boostSpeed
  const lean = s.lean + (clamp(along, -1, 1) * 0.35 - s.lean) * k
  const bank = s.bank + (clamp(side, -1, 1) * 0.45 + input.yaw * 0.12 - s.bank) * k
  return { x, y, z, vx, vy, vz, yaw, camTilt, lean, bank }
}

/** Mouse look: moving the mouse sideways turns the drone, up and down tilts the camera. */
export function lookDrone(s: DroneState, dx: number, dy: number): DroneState {
  if (!dx && !dy) return s
  return {
    ...s,
    yaw: s.yaw - dx * DRONE.mouseSensitivity,
    camTilt: clamp(s.camTilt - dy * DRONE.mouseSensitivity, DRONE.minTilt, DRONE.maxTilt),
  }
}

/** Ground speed, scene units per second. */
export const droneSpeed = (s: DroneState) => Math.hypot(s.vx, s.vy, s.vz)
