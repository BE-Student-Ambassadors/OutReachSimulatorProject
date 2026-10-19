/**
 * The autocross course: a closed loop in the ground plane (x east, z south, meters).
 * Pure geometry, shared by the lap-time simulation, the driverless test and the 3D track.
 */

/** Control points the centerline passes through, in driving order (starts on the main straight). */
const CONTROL: [number, number][] = [
  [-60, 0],
  [0, 0],
  [60, 0],
  [110, 0],
  [138, 10],
  [150, 36],
  [140, 62],
  [114, 70],
  [92, 62],
  [74, 72],
  [56, 62],
  [38, 72],
  [14, 78],
  [8, 92],
  [-14, 108],
  [-40, 100],
  [-46, 76],
  [-38, 58],
  [-60, 40],
  [-86, 40],
  [-104, 22],
  [-94, 4],
]

export const TRACK_WIDTH = 8
/** Spacing between samples along the centerline, meters. */
export const DS = 1
/** Distance between cones along each edge, meters. */
const CONE_SPACING = 7

export interface Track {
  /** Centerline samples, evenly spaced DS apart; the loop closes back to index 0. */
  x: number[]
  z: number[]
  /** Unit heading (direction of travel) at each sample. */
  tx: number[]
  tz: number[]
  /** Signed curvature 1/m (positive = turning left when viewed from above with z south). */
  k: number[]
  length: number
  cones: Cone[]
  /** Short labels for notable spots, by sample index. */
  places: { name: string; i: number }[]
}

export interface Cone {
  x: number
  z: number
  side: 'left' | 'right'
  /** Centerline sample this cone sits beside. */
  i: number
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

function build(): Track {
  // Dense polyline through the control points.
  const n = CONTROL.length
  const dense: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const p0 = CONTROL[(i - 1 + n) % n]
    const p1 = CONTROL[i]
    const p2 = CONTROL[(i + 1) % n]
    const p3 = CONTROL[(i + 2) % n]
    for (let s = 0; s < 40; s++) {
      const t = s / 40
      dense.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)])
    }
  }
  // Resample evenly by arc length.
  const cum = [0]
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1]
    const b = dense[i % dense.length]
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = cum[cum.length - 1]
  const count = Math.round(total / DS)
  const step = total / count
  const x: number[] = []
  const z: number[] = []
  let j = 0
  for (let s = 0; s < count; s++) {
    const d = s * step
    while (cum[j + 1] < d) j++
    const a = dense[j]
    const b = dense[(j + 1) % dense.length]
    const f = (d - cum[j]) / (cum[j + 1] - cum[j] || 1)
    x.push(a[0] + (b[0] - a[0]) * f)
    z.push(a[1] + (b[1] - a[1]) * f)
  }
  const tx: number[] = []
  const tz: number[] = []
  const heading: number[] = []
  for (let i = 0; i < count; i++) {
    const nx = x[(i + 1) % count] - x[(i - 1 + count) % count]
    const nz = z[(i + 1) % count] - z[(i - 1 + count) % count]
    const len = Math.hypot(nx, nz) || 1
    tx.push(nx / len)
    tz.push(nz / len)
    heading.push(Math.atan2(nz, nx))
  }
  // Curvature from the change of heading over a few meters, then lightly smoothed.
  const raw: number[] = []
  const w = 3
  for (let i = 0; i < count; i++) {
    let dh = heading[(i + w) % count] - heading[(i - w + count) % count]
    while (dh > Math.PI) dh -= 2 * Math.PI
    while (dh < -Math.PI) dh += 2 * Math.PI
    raw.push(dh / (2 * w * step))
  }
  const k = raw.map((_, i) => {
    let s = 0
    for (let d = -2; d <= 2; d++) s += raw[(i + d + count) % count]
    return s / 5
  })

  const cones: Cone[] = []
  const every = Math.round(CONE_SPACING / step)
  const half = TRACK_WIDTH / 2 + 0.3
  for (let i = 0; i < count; i += every) {
    // Left of travel direction in a z-south world is (tz, -tx).
    cones.push({ x: x[i] + tz[i] * half, z: z[i] - tx[i] * half, side: 'left', i })
    cones.push({ x: x[i] - tz[i] * half, z: z[i] + tx[i] * half, side: 'right', i })
  }

  const nearest = (px: number, pz: number) => {
    let best = 0
    let bd = Infinity
    for (let i = 0; i < count; i++) {
      const d = (x[i] - px) ** 2 + (z[i] - pz) ** 2
      if (d < bd) {
        bd = d
        best = i
      }
    }
    return best
  }
  const places = [
    { name: 'the main straight', i: nearest(60, 0) },
    { name: 'Turn 1', i: nearest(150, 36) },
    { name: 'the slalom', i: nearest(74, 74) },
    { name: 'the hairpin', i: nearest(-14, 108) },
    { name: 'the chicane', i: nearest(-52, 42) },
    { name: 'the last corner', i: nearest(-104, 22) },
  ]

  return { x, z, tx, tz, k, length: total, cones, places }
}

let cached: Track | null = null
export function getTrack(): Track {
  if (!cached) cached = build()
  return cached
}

/** Name of the notable spot closest (along the track) to sample i. */
export function placeName(track: Track, i: number): string {
  let best = track.places[0]
  let bd = Infinity
  const n = track.x.length
  for (const p of track.places) {
    const d = Math.min(Math.abs(p.i - i), n - Math.abs(p.i - i))
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return best.name
}
