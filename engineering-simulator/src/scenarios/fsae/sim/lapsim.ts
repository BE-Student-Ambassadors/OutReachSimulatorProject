import { CAR } from '../config'
import { agility, G, type CarParams } from './car'
import type { Track } from './track'

export interface LapProfile {
  /** Speed at each track sample, m/s. */
  v: number[]
  /** Time at which the car reaches each sample, s (t[0] = 0). */
  t: number[]
  lapS: number
  topMs: number
  topAt: number
  slowestMs: number
  slowestAt: number
}

/** Grip-limited cornering speed at curvature k, m/s (downforce adds grip as speed rises). */
export function cornerSpeed(p: CarParams, k: number, cap: number): number {
  const ak = Math.abs(k)
  if (ak < 1e-4) return cap
  const mu = p.mu * agility(p.wheelbaseNorm, 1 / ak)
  // m v² k = mu (m g + cl v²)  →  v² = mu m g / (m k − mu cl)
  const denom = p.massKg * ak - mu * p.aero.cl
  if (denom <= 0) return cap
  return Math.min(cap, Math.sqrt((mu * p.massKg * G) / denom))
}

/** A flying lap (the car crosses the line already at speed): solves the speed profile in three passes. */
export function lapProfile(p: CarParams, track: Track, cap = 60): LapProfile {
  const n = track.x.length
  const ds = track.length / n
  const m = p.massKg
  const vmax = track.k.map((k) => cornerSpeed(p, k, cap))
  const v = [...vmax]

  const lateralShare = (vi: number, i: number) => {
    const avail = p.mu * (m * G + p.aero.cl * vi * vi)
    const used = m * vi * vi * Math.abs(track.k[i])
    return Math.max(0, 1 - (used / avail) ** 2)
  }

  // Two laps around so the speed carried across the line settles.
  for (let lap = 0; lap < 2; lap++) {
    for (let s = 0; s < n; s++) {
      const i = s
      const j = (s + 1) % n
      const vi = Math.max(1, v[i])
      const grip = p.mu * (m * G + p.aero.cl * vi * vi) * Math.sqrt(lateralShare(vi, i))
      const drive = Math.min(p.powerW / vi, grip)
      const a = (drive - p.aero.cd * vi * vi - CAR.rollingCoef * m * G) / m
      v[j] = Math.min(vmax[j], Math.sqrt(Math.max(1, vi * vi + 2 * a * ds)))
    }
  }
  for (let lap = 0; lap < 2; lap++) {
    for (let s = n - 1; s >= 0; s--) {
      const i = s
      const j = (s + 1) % n
      const vj = v[j]
      const grip = p.mu * (m * G + p.aero.cl * vj * vj) * Math.sqrt(lateralShare(vj, j))
      const decel = (grip + p.aero.cd * vj * vj) / m
      v[i] = Math.min(v[i], Math.sqrt(vj * vj + 2 * decel * ds))
    }
  }

  const t = [0]
  for (let i = 1; i <= n; i++) t.push(t[i - 1] + (2 * ds) / (v[i - 1] + v[i % n]))
  let topAt = 0
  let slowestAt = 0
  for (let i = 0; i < n; i++) {
    if (v[i] > v[topAt]) topAt = i
    if (v[i] < v[slowestAt]) slowestAt = i
  }
  return { v, t, lapS: t[n], topMs: v[topAt], topAt, slowestMs: v[slowestAt], slowestAt }
}
