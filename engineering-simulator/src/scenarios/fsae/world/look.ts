import type { Track } from '../sim/track'
import type { FrontWingId, MechanicalObject } from '../types'

/** The bits of the mechanical design the 3D car is drawn from. */
export interface CarLook {
  frontWing: FrontWingId
  rearWing: number
  wheelbaseMm: number
  trackMm: number
  rideHeightMm: number
}

export const lookOf = (m: MechanicalObject): CarLook => ({
  frontWing: m.frontWing,
  rearWing: m.rearWing,
  wheelbaseMm: m.wheelbaseMm,
  trackMm: m.trackMm,
  rideHeightMm: m.rideHeightMm,
})

/** Body colors for teammates' cars in races and replays. */
export const GHOST_COLORS = ['#b8461b', '#7c4dbd', '#d99a1e', '#cf4f86', '#3a3f3c', '#74a85f']

export interface Pose {
  x: number
  z: number
  h: number
}

/** Interpolated pose at a fractional centerline sample. */
export function poseAt(track: Track, pos: number): Pose {
  const n = track.x.length
  const i = ((Math.floor(pos) % n) + n) % n
  const j = (i + 1) % n
  const f = pos - Math.floor(pos)
  return {
    x: track.x[i] + (track.x[j] - track.x[i]) * f,
    z: track.z[i] + (track.z[j] - track.z[i]) * f,
    h: Math.atan2(track.tz[i] + (track.tz[j] - track.tz[i]) * f, track.tx[i] + (track.tx[j] - track.tx[i]) * f),
  }
}
