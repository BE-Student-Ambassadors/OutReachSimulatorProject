import { CAR, TRACE_DT } from '../config'
import { agility, G, type CarParams } from './car'
import { TRACK_WIDTH, type Track } from './track'

/**
 * Race Day driving: an arcade car on the autocross course using the team's real numbers
 * (power, mass, grip, downforce, drag). Pure, so it can be tested without a browser.
 */

export interface DriveInput {
  throttle: number
  brake: number
  /** -1 = full right, +1 = full left. */
  steer: number
}

export interface DriveState {
  x: number
  z: number
  /** Heading in radians; forward is (cos h, sin h) in (x, z). */
  h: number
  /** m/s; negative when reversing. */
  v: number
  steer: number
  /** Nearest centerline sample. */
  idx: number
  /** Samples driven forward along the course since the start (can drop when going backwards). */
  progress: number
  /** Signed distance from the centerline, meters (positive = left). */
  offset: number
  offTrack: boolean
  /** Indices into track.cones that have been knocked over. */
  conesHit: number[]
  /** True once a lateral grip limit is exceeded this step (for tire squeal / skid marks). */
  sliding: boolean
  timeS: number
  finished: boolean
}

export function startState(track: Track): DriveState {
  // Line up a few meters behind the start line.
  const back = 6
  const n = track.x.length
  const i = n - back
  return {
    x: track.x[i],
    z: track.z[i],
    h: Math.atan2(track.tz[i], track.tx[i]),
    v: 0,
    steer: 0,
    idx: i,
    progress: -back,
    offset: 0,
    offTrack: false,
    conesHit: [],
    sliding: false,
    timeS: 0,
    finished: false,
  }
}

const GRASS_DRAG = 0.22
const GRASS_GRIP = 0.6
const MAX_REVERSE = 4

export function stepDrive(s: DriveState, input: DriveInput, p: CarParams, track: Track, dt: number): DriveState {
  if (s.finished) return s
  const n = track.x.length
  const m = p.massKg
  let { v, h, steer } = s

  // Steering: smoothed, and less lock at speed so the car stays drivable on a keyboard.
  steer += (input.steer - steer) * Math.min(1, dt * 7)
  const maxAngle = 0.5 / (1 + Math.abs(v) / 14)
  const angle = steer * maxAngle

  const grass = s.offTrack
  const muNow = p.mu * (grass ? GRASS_GRIP : 1)
  const vAbs = Math.abs(v)
  const gripN = muNow * (m * G + p.aero.cl * v * v)

  // Longitudinal forces.
  let force = 0
  if (input.throttle > 0) force += Math.min(p.powerW / Math.max(2, vAbs), gripN) * input.throttle
  if (input.brake > 0) {
    if (v > 0.3) force -= gripN * input.brake
    else force -= Math.min(p.powerW / Math.max(2, vAbs), gripN) * 0.35 * input.brake // reverse gear
  }
  const resist = p.aero.cd * v * v + (CAR.rollingCoef + (grass ? GRASS_DRAG : 0)) * m * G
  force -= Math.sign(v) * resist
  let nextV = v + (force / m) * dt
  // Braking or resistance never flips the car into reverse by itself.
  if (v > 0 && nextV < 0 && input.brake > 0 && v > 0.3) nextV = 0
  if (Math.abs(nextV) < 0.05 && input.throttle === 0 && input.brake === 0) nextV = 0
  nextV = Math.max(-MAX_REVERSE, nextV)
  v = nextV

  // Lateral: the yaw rate the wheels ask for, limited by grip.
  let yaw = (-v * Math.tan(angle)) / p.wheelbaseM
  const radius = Math.abs(v / (yaw || 1e-6))
  const latMax = (gripN / m) * agility(p.wheelbaseNorm, radius)
  const latWanted = Math.abs(v * yaw)
  let sliding = false
  if (latWanted > latMax && vAbs > 1) {
    yaw *= latMax / latWanted
    sliding = true
    // Sliding tires scrub speed.
    v -= Math.sign(v) * Math.min(Math.abs(v), (latWanted - latMax) * 0.12 * dt)
  }
  h += yaw * dt

  const x = s.x + Math.cos(h) * v * dt
  const z = s.z + Math.sin(h) * v * dt

  // Where on the course are we? Search near the last sample.
  let idx = s.idx
  let best = Infinity
  for (let d = -25; d <= 25; d++) {
    const i = (s.idx + d + n) % n
    const dd = (track.x[i] - x) ** 2 + (track.z[i] - z) ** 2
    if (dd < best) {
      best = dd
      idx = i
    }
  }
  let step = idx - s.idx
  if (step > n / 2) step -= n
  if (step < -n / 2) step += n
  const progress = s.progress + step
  const offset = (x - track.x[idx]) * track.tz[idx] - (z - track.z[idx]) * track.tx[idx]
  const offTrack = Math.abs(offset) > TRACK_WIDTH / 2 + 0.4

  // Cones: anything within reach of the car's body gets knocked over.
  let conesHit = s.conesHit
  for (let c = 0; c < track.cones.length; c++) {
    const cone = track.cones[c]
    let di = Math.abs(cone.i - idx)
    di = Math.min(di, n - di)
    if (di > 10 || conesHit.includes(c)) continue
    if ((cone.x - x) ** 2 + (cone.z - z) ** 2 < 1.1 * 1.1) conesHit = [...conesHit, c]
  }

  let nx = x
  let nz = z
  // Far off course: the marshals put the car back on the track.
  if (Math.abs(offset) > 16) {
    nx = track.x[idx]
    nz = track.z[idx]
    h = Math.atan2(track.tz[idx], track.tx[idx])
    v = 0
  }

  const timeS = s.timeS + dt
  const finished = progress >= n
  return { x: nx, z: nz, h, v, steer, idx, progress, offset, offTrack, conesHit, sliding, timeS, finished }
}

/** Ghost playback: position at time t from a recorded trace. */
export function tracePose(trace: number[], t: number): { x: number; z: number; h: number; done: boolean } {
  const frames = trace.length / 3
  if (frames === 0) return { x: 0, z: 0, h: 0, done: true }
  const f = t / TRACE_DT
  const i = Math.floor(f)
  if (i >= frames - 1) {
    const k = (frames - 1) * 3
    return { x: trace[k], z: trace[k + 1], h: trace[k + 2], done: true }
  }
  const a = f - i
  const k = i * 3
  let dh = trace[k + 5] - trace[k + 2]
  while (dh > Math.PI) dh -= 2 * Math.PI
  while (dh < -Math.PI) dh += 2 * Math.PI
  return {
    x: trace[k] + (trace[k + 3] - trace[k]) * a,
    z: trace[k + 1] + (trace[k + 4] - trace[k + 1]) * a,
    h: trace[k + 2] + dh * a,
    done: false,
  }
}

/** Append one pose to a trace (rounded so the shared document stays small). */
export function pushTrace(trace: number[], s: DriveState) {
  trace.push(Math.round(s.x * 10) / 10, Math.round(s.z * 10) / 10, Math.round(s.h * 100) / 100)
}
