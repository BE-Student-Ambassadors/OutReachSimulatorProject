/** Draws the static campus (ground, paving, buildings, markings) once into a canvas. */
import { COURTYARD, FIELD, SURF, type Campus } from '../campus'

export const CELL_PX = 16

type RGB = [number, number, number]
const SURFACE_RGB: Record<number, RGB> = {
  [SURF.asphalt]: [62, 68, 82],
  [SURF.concrete]: [196, 191, 179],
  [SURF.grass]: [104, 164, 92],
  [SURF.field]: [88, 160, 82],
  [SURF.building]: [120, 120, 120],
  [SURF.creek]: [58, 120, 170],
}

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) & 0xffff) / 0xffff
}

export function renderTerrain(canvas: HTMLCanvasElement, campus: Campus) {
  const { w, h, elevation, surface } = campus
  const W = w * CELL_PX
  const H = h * CELL_PX
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  let emin = Infinity
  let emax = -Infinity
  for (const e of elevation) {
    emin = Math.min(emin, e)
    emax = Math.max(emax, e)
  }
  const elevAt = (cx: number, cy: number) => {
    const x = Math.max(0, Math.min(w - 1, cx))
    const y = Math.max(0, Math.min(h - 1, cy))
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const x1 = Math.min(w - 1, x0 + 1)
    const y1 = Math.min(h - 1, y0 + 1)
    const fx = x - x0
    const fy = y - y0
    const a = elevation[y0 * w + x0] * (1 - fx) + elevation[y0 * w + x1] * fx
    const b = elevation[y1 * w + x0] * (1 - fx) + elevation[y1 * w + x1] * fx
    return a * (1 - fy) + b * fy
  }

  // Ground pixels: surface color, lighter on high ground, hill-shaded, with texture noise.
  const img = ctx.createImageData(W, H)
  const d = img.data
  for (let py = 0; py < H; py++) {
    const gy = py / CELL_PX - 0.5
    const cy = Math.floor(py / CELL_PX)
    for (let px = 0; px < W; px++) {
      const gx = px / CELL_PX - 0.5
      const cx = Math.floor(px / CELL_PX)
      const s = surface[cy * w + cx]
      const e = elevAt(gx, gy)
      const slopeX = elevAt(gx + 0.5, gy) - elevAt(gx - 0.5, gy)
      const slopeY = elevAt(gx, gy + 0.5) - elevAt(gx, gy - 0.5)
      const shade = Math.max(-0.05, Math.min(0.05, -(slopeX + slopeY) * 0.8))
      const height = (e - emin) / (emax - emin)
      const n = hash(px, py)
      const grain = s === SURF.grass || s === SURF.field ? (n - 0.5) * 0.14 : (n - 0.5) * 0.06
      let k = 0.9 + 0.16 * height + shade + grain
      if (s === SURF.field) k += Math.floor((px / CELL_PX - FIELD.x) / 2) % 2 === 0 ? 0.04 : -0.02
      const [r, g, b] = SURFACE_RGB[s]
      const i = (py * W + px) * 4
      d[i] = Math.min(255, r * k)
      d[i + 1] = Math.min(255, g * k)
      d[i + 2] = Math.min(255, b * k)
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  ctx.save()
  ctx.scale(CELL_PX, CELL_PX)
  ctx.lineWidth = 1 / CELL_PX

  drawContours(ctx, campus, emin, emax)
  drawRoads(ctx, campus)
  drawParking(ctx, campus)
  drawCourtyard(ctx)
  drawField(ctx)
  drawCreek(ctx)
  // Building footprints: a dark pad under each 3D building.
  ctx.fillStyle = 'rgba(40,44,38,0.55)'
  for (const b of campus.buildings) ctx.fillRect(b.x - 0.15, b.y - 0.15, b.w + 0.3, b.h + 0.3)
  ctx.restore()
  return canvas
}

/** Faint topo lines every 0.5 ft (stronger every 2 ft) so students can read the slope. */
function drawContours(ctx: CanvasRenderingContext2D, campus: Campus, emin: number, emax: number) {
  const { w, h, elevation } = campus
  const at = (x: number, y: number) => elevation[y * w + x]
  for (let level = Math.ceil(emin * 2) / 2; level < emax; level += 0.5) {
    const major = Math.abs(level / 2 - Math.round(level / 2)) < 1e-6
    ctx.strokeStyle = major ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.09)'
    ctx.lineWidth = (major ? 1.4 : 1) / 16
    ctx.beginPath()
    for (let y = 0; y < h - 1; y++)
      for (let x = 0; x < w - 1; x++) {
        const v = [at(x, y), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1)]
        const corners: [number, number][] = [
          [x + 0.5, y + 0.5],
          [x + 1.5, y + 0.5],
          [x + 1.5, y + 1.5],
          [x + 0.5, y + 1.5],
        ]
        const pts: [number, number][] = []
        for (let i = 0; i < 4; i++) {
          const a = v[i]
          const b = v[(i + 1) % 4]
          if ((a < level) !== (b < level)) {
            const t = (level - a) / (b - a)
            const [ax, ay] = corners[i]
            const [bx, by] = corners[(i + 1) % 4]
            pts.push([ax + (bx - ax) * t, ay + (by - ay) * t])
          }
        }
        if (pts.length >= 2) {
          ctx.moveTo(pts[0][0], pts[0][1])
          ctx.lineTo(pts[1][0], pts[1][1])
          if (pts.length === 4) {
            ctx.moveTo(pts[2][0], pts[2][1])
            ctx.lineTo(pts[3][0], pts[3][1])
          }
        }
      }
    ctx.stroke()
  }
}

function drawRoads(ctx: CanvasRenderingContext2D, campus: Campus) {
  ctx.save()
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)'
  ctx.lineWidth = 0.18
  ctx.setLineDash([1.2, 0.9])
  ctx.beginPath()
  ctx.moveTo(4, 2)
  ctx.lineTo(campus.w, 2)
  ctx.moveTo(2, 4)
  ctx.lineTo(2, campus.h)
  ctx.stroke()
  ctx.restore()
}

function drawParking(ctx: CanvasRenderingContext2D, campus: Campus) {
  const p = campus.parking
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 0.12
  // Three rows of stalls with drive aisles between them.
  const rows: [number, number][] = [
    [p.y + 0.4, p.y + 3.4],
    [p.y + 6, p.y + 8.6],
    [p.y + 8.6, p.y + 11.2],
  ]
  ctx.beginPath()
  for (const [y0, y1] of rows)
    for (let x = p.x + 1; x <= p.x + p.w - 1; x += 2) {
      ctx.moveTo(x, y0)
      ctx.lineTo(x, y1)
    }
  ctx.moveTo(p.x + 1, p.y + 8.6)
  ctx.lineTo(p.x + p.w - 1, p.y + 8.6)
  ctx.stroke()
  ctx.restore()
}

function drawCourtyard(ctx: CanvasRenderingContext2D) {
  const c = COURTYARD
  ctx.save()
  ctx.strokeStyle = 'rgba(80,70,60,0.12)'
  ctx.lineWidth = 0.06
  ctx.beginPath()
  for (let x = c.x; x <= c.x + c.w; x += 2) {
    ctx.moveTo(x, c.y)
    ctx.lineTo(x, c.y + c.h)
  }
  for (let y = c.y; y <= c.y + c.h; y += 2) {
    ctx.moveTo(c.x, y)
    ctx.lineTo(c.x + c.w, y)
  }
  ctx.stroke()
  ctx.restore()
}

function drawField(ctx: CanvasRenderingContext2D) {
  const f = FIELD
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 0.15
  ctx.strokeRect(f.x + 1.5, f.y + 1.5, f.w - 3, f.h - 3)
  ctx.beginPath()
  ctx.moveTo(f.x + f.w / 2, f.y + 1.5)
  ctx.lineTo(f.x + f.w / 2, f.y + f.h - 1.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(f.x + f.w / 2, f.y + f.h / 2, 2.6, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeRect(f.x + 1.5, f.y + f.h / 2 - 3, 2.5, 6)
  ctx.strokeRect(f.x + f.w - 4, f.y + f.h / 2 - 3, 2.5, 6)
  ctx.restore()
}

function drawCreek(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.5)'
  ctx.lineWidth = 0.1
  for (let y = 41; y < 60; y += 1.6) {
    ctx.beginPath()
    ctx.moveTo(94.3, y)
    ctx.quadraticCurveTo(95, y + 0.4, 95.7, y)
    ctx.stroke()
  }
  ctx.restore()
}
