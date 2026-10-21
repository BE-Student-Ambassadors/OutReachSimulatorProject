import { CAR, coursesCleared, DRIVERLESS, LIDAR_COLOR_RULE, PLANNER_BY_CLEARED, PLANNER_LINE, POWER_PATH_BY_ID, SCAN } from '../config'
import type { ColorRule, ElectricalObject, ScanFeatureId, SoftwareObject } from '../types'
import { G, type CarParams } from './car'
import { sensorStatus } from './harness'
import { cornerSpeed } from './lapsim'
import { readPath, type PowerState } from './power'
import { mulberry32 } from './rng'
import { getTrack, TRACK_WIDTH, type Track } from './track'

export { mulberry32 }

// ---------------------------------------------------------------- the racing line

/** Track sample that station s sits at. */
export const stationSample = (s: number, n: number) => Math.round((s * n) / DRIVERLESS.stations) % n

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

const clampOff = (o: number) => Math.max(-DRIVERLESS.maxOffsetM, Math.min(DRIVERLESS.maxOffsetM, o))

/** The line's offset at every track sample: a smooth loop through the station offsets. */
export function offsetsAlong(offsets: number[], n: number): number[] {
  const m = offsets.length
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const f = (i * m) / n
    const s = Math.floor(f)
    const o = (k: number) => clampOff(offsets[((k % m) + m) % m] ?? 0)
    out.push(clampOff(catmull(o(s - 1), o(s), o(s + 1), o(s + 2), f - s)))
  }
  return out
}

export interface LinePath {
  x: number[]
  z: number[]
  /** Sideways offset from the middle of the course, m (+ = left). */
  off: number[]
  /** Curvature, 1/m. */
  k: number[]
  /** Distance from sample i to i+1, m. */
  ds: number[]
  length: number
}

/** Where the drawn line actually goes on the ground, with its own curvature. */
export function linePath(offsets: number[], track: Track = getTrack()): LinePath {
  const n = track.x.length
  const off = offsetsAlong(offsets, n)
  // Left of travel in a z-south world is (tz, -tx), as for the cones.
  const x = off.map((o, i) => track.x[i] + track.tz[i] * o)
  const z = off.map((o, i) => track.z[i] - track.tx[i] * o)
  const ds = x.map((_, i) => Math.hypot(x[(i + 1) % n] - x[i], z[(i + 1) % n] - z[i]))
  const heading = x.map((_, i) => Math.atan2(z[(i + 1) % n] - z[(i - 1 + n) % n], x[(i + 1) % n] - x[(i - 1 + n) % n]))
  const w = 3
  const raw = heading.map((_, i) => {
    let dh = heading[(i + w) % n] - heading[(i - w + n) % n]
    while (dh > Math.PI) dh -= 2 * Math.PI
    while (dh < -Math.PI) dh += 2 * Math.PI
    let arc = 0
    for (let d = -w; d < w; d++) arc += ds[(i + d + n) % n]
    return dh / Math.max(0.5, arc)
  })
  const k = raw.map((_, i) => {
    let s = 0
    for (let d = -2; d <= 2; d++) s += raw[(i + d + n) % n]
    return s / 5
  })
  return { x, z, off, k, ds, length: ds.reduce((a, b) => a + b, 0) }
}

export interface SpeedPlan {
  /** Speed at each sample, m/s. */
  v: number[]
  /** Time the car reaches each sample, s (t[0] = 0, t[n] = lap time). */
  t: number[]
  lapS: number
  /** Share of the tires' full grip being used sideways at each sample, 0..1. */
  demand: number[]
}

/**
 * Speeds along the line for a car allowed `gripUse` of its tires' grip, never faster than
 * `cap` (what the sensors let the planner see), from a standing start.
 */
export function planSpeeds(p: CarParams, path: LinePath, gripUse: number, cap: number[]): SpeedPlan {
  const n = path.k.length
  const m = p.massKg
  const scaled: CarParams = { ...p, mu: p.mu * gripUse }
  const vmax = path.k.map((k, i) => Math.min(cap[i], cornerSpeed(scaled, k, 40)))
  const v = [...vmax]
  const lateralLeft = (vi: number, i: number) => {
    const avail = scaled.mu * (m * G + p.aero.cl * vi * vi)
    const used = m * vi * vi * Math.abs(path.k[i])
    return Math.max(0, 1 - (used / avail) ** 2)
  }
  // Standing start: accelerate from rest.
  v[0] = Math.min(v[0], 1)
  for (let i = 0; i < n - 1; i++) {
    const vi = Math.max(1, v[i])
    const grip = scaled.mu * (m * G + p.aero.cl * vi * vi) * Math.sqrt(lateralLeft(vi, i))
    const drive = Math.min(p.powerW / vi, grip)
    const a = (drive - p.aero.cd * vi * vi - CAR.rollingCoef * m * G) / m
    v[i + 1] = Math.min(vmax[i + 1], Math.sqrt(Math.max(1, vi * vi + 2 * a * path.ds[i])))
  }
  for (let i = n - 2; i >= 0; i--) {
    const vj = v[i + 1]
    const grip = scaled.mu * (m * G + p.aero.cl * vj * vj) * Math.sqrt(lateralLeft(vj, i + 1))
    const decel = (grip + p.aero.cd * vj * vj) / m
    v[i] = Math.min(v[i], Math.sqrt(vj * vj + 2 * decel * path.ds[i]))
  }
  const t = [0]
  for (let i = 1; i <= n; i++) t.push(t[i - 1] + (2 * path.ds[i - 1]) / (Math.max(0.5, v[i - 1]) + Math.max(0.5, v[i % n])))
  const demand = v.map((vi, i) => (m * vi * vi * Math.abs(path.k[i])) / (p.mu * (m * G + p.aero.cl * vi * vi)))
  return { v, t, lapS: t[n], demand }
}

// ---------------------------------------------------------------- LiDAR scans of cones

export type ConeColor = 'yellow' | 'orange'

export interface Scan {
  /** Return strength of each beam that crossed the cone, bottom to top, 0..100. */
  beams: number[]
  distM: number
  color: ConeColor
}

/** Scans of cones at random distances: yellow cones have a black stripe, orange cones a white one. */
export function makeScans(seed: number, count: number): Scan[] {
  const rand = mulberry32(seed)
  const out: Scan[] = []
  for (let i = 0; i < count; i++) {
    const color: ConeColor = i % 2 === 0 ? 'yellow' : 'orange'
    const distM = 2 + rand() * (SCAN.maxDistM - 2)
    const fall = 1 / (1 + distM / SCAN.falloffM)
    const surf = SCAN[color]
    const beams = Array.from({ length: SCAN.beams }, (_, b) => {
      const base = (SCAN.stripeBeams as readonly number[]).includes(b) ? surf.stripe : surf.body
      const noise = (rand() + rand() - 1) * SCAN.noise
      return Math.round(Math.max(1, Math.min(100, base * fall + noise)))
    })
    out.push({ beams, distM: Math.round(distM * 10) / 10, color })
  }
  // Shuffle so colors don't alternate.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Labeled scans from a daytime lap: the camera knew each cone's color. */
export const trainingScans = (seed: number) => makeScans(seed ^ 0x5ca7, SCAN.trainCount)
/** Fresh scans the rule is graded on (what the car sees on the test lap). */
export const testScans = (seed: number) => makeScans(seed ^ 0x7e57, SCAN.testCount)

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

export function scanFeature(scan: Scan, f: ScanFeatureId): number {
  const mid = scan.beams.filter((_, b) => (SCAN.stripeBeams as readonly number[]).includes(b))
  const ends = scan.beams.filter((_, b) => !(SCAN.stripeBeams as readonly number[]).includes(b))
  if (f === 'overall') return avg(scan.beams)
  if (f === 'middle') return avg(mid)
  return avg(mid) / Math.max(1, avg(ends))
}

export function classify(rule: ColorRule, scan: Scan): ConeColor {
  const above = scanFeature(scan, rule.feature) >= rule.threshold
  return above === rule.orangeAbove ? 'orange' : 'yellow'
}

export function ruleAccuracy(rule: ColorRule, scans: Scan[]): number {
  return scans.filter((s) => classify(rule, s) === s.color).length / scans.length
}

// ---------------------------------------------------------------- the driverless lap

export interface DriverlessResult {
  finished: boolean
  /** Why the car didn't finish, as a fact. */
  dnf: string | null
  lapS: number
  conesHit: number
  /** Indices into the track's cones, for the animation. */
  hitCones: number[]
  /** Hits from reading a cone's color wrong (the car steered toward the wrong edge). */
  colorHits: number
  /** Hits while the computer rebooted. */
  rebootHits: number
  topMph: number
  slowestMph: number
  /** Smallest gap planned between the side of the car and a cone, m (before steering error). */
  minGapM: number
  /** Farthest the car slid wide where a corner had less grip than planned, m, and where. */
  slideM: number
  slideAt: number
  /** Share of the lap where the car went slower than the tires allowed because of how far it could see. */
  sightLimitedShare: number
  /** How far it could see on open stretches, m. */
  sightM: number
  colorBy: 'camera' | 'lidar' | 'camera+lidar' | 'none'
  lidar: boolean
  camera: boolean
  wheel: boolean
  computerState: PowerState
  ruleAccuracy: number | null
  /** Graph courses the path planner's code cleared (0..3). */
  planner: number
  /** For the animation: offset and time at each track sample. */
  off: number[]
  t: number[]
  v: number[]
}

/**
 * How much less grip than planned each spot has, 0..1: a little everywhere, more in a few dusty
 * corners (repeatable per team).
 */
export function gripDips(seed: number, path: LinePath): number[] {
  const n = path.k.length
  const rand = mulberry32(seed ^ 0xd057)
  const phase = rand() * Math.PI * 2
  const dip = path.k.map((_, i) => DRIVERLESS.gripDipBase * (0.5 + 0.5 * Math.sin((i / 60) * Math.PI * 2 + phase)))
  // Dusty corners: the tightest stretches, picked at random.
  const corners = path.k
    .map((k, i) => ({ k: Math.abs(k), i }))
    .filter((c, _, all) => c.k > 1 / 30 && all.every((o) => Math.abs(o.i - c.i) > 3 || o.k <= c.k))
  for (let d = 0; d < DRIVERLESS.dustyCorners && corners.length; d++) {
    const c = corners.splice(Math.floor(rand() * corners.length), 1)[0]
    const amp = DRIVERLESS.gripDipDusty * (0.75 + 0.25 * rand())
    for (let j = -20; j <= 20; j++) {
      const i = (c.i + j + n) % n
      dip[i] += amp * Math.exp(-((j / 9) ** 2))
    }
  }
  return dip
}

/** Smooth, repeatable wobble along the lap, about −1.4..1.4. */
function wobble(seed: number, n: number): number[] {
  const rand = mulberry32(seed ^ 0x0b0b)
  const waves = Array.from({ length: 3 }, () => ({ len: 35 + rand() * 90, phase: rand() * Math.PI * 2, amp: 0.4 + rand() * 0.4 }))
  const raw = Array.from({ length: n }, (_, i) => waves.reduce((s, w) => s + w.amp * Math.sin((i / w.len) * Math.PI * 2 + w.phase), 0))
  const peak = Math.max(...raw.map(Math.abs)) || 1
  return raw.map((r) => (1.4 * r) / peak)
}

export function driverlessLap(sw: SoftwareObject, p: CarParams, elec: ElectricalObject, night: boolean): DriverlessResult {
  const track = getTrack()
  const n = track.x.length
  const sensors = sensorStatus(elec)
  const computer = readPath(elec, POWER_PATH_BY_ID.computer, true)
  const lidar = sensors.lidar.working ? sensors.lidar.mount! : null
  const camera = sensors.camera.working ? sensors.camera.mount! : null
  const wheel = sensors.wheel.working ? sensors.wheel.mount! : null
  // The path planner drives as well as the graph courses its code cleared.
  const cleared = coursesCleared(sw)
  const planner = PLANNER_BY_CLEARED[cleared]
  const path = linePath(PLANNER_LINE.map((o) => o * (planner?.line ?? 0)), track)
  const gripUse = planner?.gripUse ?? 0.6
  const rule = LIDAR_COLOR_RULE
  const accuracy = ruleAccuracy(rule, testScans(sw.seed))

  const base = {
    lidar: !!lidar,
    camera: !!camera,
    wheel: !!wheel,
    computerState: computer.state,
    ruleAccuracy: accuracy,
    planner: cleared,
    off: path.off,
  }
  const dnf = (why: string): DriverlessResult => ({
    ...base,
    finished: false,
    dnf: why,
    lapS: 0,
    conesHit: 0,
    hitCones: [],
    colorHits: 0,
    rebootHits: 0,
    topMph: 0,
    slowestMph: 0,
    minGapM: 0,
    slideM: 0,
    slideAt: 0,
    sightLimitedShare: 0,
    sightM: 0,
    colorBy: 'none',
    t: Array.from({ length: n + 1 }, (_, i) => i),
    v: Array.from({ length: n }, () => 0),
  })
  if (computer.volts < 1) return dnf('The driverless computer had no power.')
  if (!planner) return dnf('The driverless computer had no path-planning code: no graph course was cleared, so the car never left the start line.')
  if (!lidar && !camera) return dnf('No cone sensor was mounted and wired to the computer: the car could not see the course.')

  // How far ahead the car can see cones, and how far it can tell their colors.
  const camRange = camera ? (night ? camera.nightRangeM! : camera.rangeM!) : 0
  const tight = (i: number) => Math.abs(path.k[i]) > 1 / 25
  const lidarRange = (i: number) => (lidar ? (tight(i) ? lidar.tightRangeM! : lidar.rangeM!) : 0)
  // The LiDAR color rule only helps where it reads colors farther out than the camera.
  const ruleHelps = (i: number) => !!rule && !!lidar && lidarRange(i) > camRange + 3
  let ruleUsed = 0
  const cap = path.k.map((_, i) => {
    const geom = Math.max(lidarRange(i), camRange)
    let color = camRange
    if (ruleHelps(i)) {
      color = lidarRange(i)
      ruleUsed++
    }
    // With no way to read colors at all, the car drives on what it sees and guesses the edges.
    const see = camera || rule ? Math.min(geom, Math.max(color, 1)) : geom
    const blind = lidar ? lidar.blindM! : 0.5
    return Math.sqrt(2 * DRIVERLESS.planBrakeMs2 * Math.max(1, see - blind)) * (computer.state === 'high' ? DRIVERLESS.hotComputerPace : 1)
  })
  const free = planSpeeds(p, path, gripUse, path.k.map(() => 60))
  const plan = planSpeeds(p, path, gripUse, cap)
  const sightLimited = plan.v.filter((v, i) => v < free.v[i] - 0.3).length / n

  // Steering error: how well the car knows where it is...
  const odo = wheel ? wheel.odometryM! : DRIVERLESS.noWheelErrorM
  const shake = camera ? camera.shakeM! : 0
  const wob = wobble(sw.seed, n)
  // ...plus sliding wide wherever a corner had less grip than the plan used.
  const dips = gripDips(sw.seed, path)
  let slideM = 0
  let slideAt = 0
  const err = plan.demand.map((d, i) => {
    const wide = Math.min(4, DRIVERLESS.slideWideM * Math.max(0, d - (1 - dips[i])))
    if (wide > slideM) {
      slideM = wide
      slideAt = i
    }
    // Sliding wide is toward the outside of the corner (left turns have positive curvature).
    return (DRIVERLESS.baseErrorM + odo + shake) * planner.steady * wob[i] - Math.sign(path.k[i]) * wide
  })

  const hw = p.trackM / 2 + 0.1
  const coneAt = TRACK_WIDTH / 2 + 0.3 - DRIVERLESS.coneRadiusM
  const hit = new Set<number>()
  let minGap = Infinity
  track.cones.forEach((c, ci) => {
    const y = path.off[c.i] + err[c.i]
    const planned = c.side === 'left' ? coneAt - (path.off[c.i] + hw) : coneAt + (path.off[c.i] - hw)
    minGap = Math.min(minGap, planned)
    const gap = c.side === 'left' ? coneAt - (y + hw) : coneAt + (y - hw)
    if (gap < 0) hit.add(ci)
  })

  // Reading colors wrong, and computer reboots, each knock over a cone somewhere on the lap.
  let colorHits = 0
  let colorBy: DriverlessResult['colorBy'] = camera ? (ruleUsed ? 'camera+lidar' : 'camera') : ruleUsed ? 'lidar' : 'none'
  if (!camera && !rule) colorHits = DRIVERLESS.colorChecks
  else if (ruleUsed && accuracy !== null) colorHits = Math.round((1 - accuracy) * DRIVERLESS.colorChecks * Math.min(1, (ruleUsed / n) * 1.5))
  if (!camera && !ruleUsed) colorBy = 'none'
  const rebootHits = computer.state === 'low' ? DRIVERLESS.rebootHits : 0
  const extra = mulberry32(sw.seed ^ 0xc0e5)
  for (let k = 0, guard = 0; k < colorHits + rebootHits && guard < 2000; guard++) {
    const ci = Math.floor(extra() * track.cones.length)
    if (hit.has(ci)) continue
    hit.add(ci)
    k++
  }

  let top = 0
  let slow = Infinity
  for (const v of plan.v.slice(Math.round(n * 0.05))) {
    top = Math.max(top, v)
    slow = Math.min(slow, v)
  }
  return {
    ...base,
    finished: true,
    dnf: null,
    lapS: Math.round(plan.lapS * 100) / 100,
    conesHit: hit.size,
    hitCones: [...hit].sort((a, b) => track.cones[a].i - track.cones[b].i),
    colorHits,
    rebootHits,
    topMph: top * 2.237,
    slowestMph: slow * 2.237,
    minGapM: Math.round(minGap * 100) / 100,
    slideM: Math.round(slideM * 10) / 10,
    slideAt,
    sightLimitedShare: sightLimited,
    sightM: Math.max(lidar?.rangeM ?? 0, camRange),
    colorBy,
    t: plan.t,
    v: plan.v,
  }
}
