import { useEffect, useRef, useState } from 'react'
import type { WorldProps } from '../../core/scenario'
import { createCampus, SURF } from './campus'
import { GRID_H, GRID_W } from './config'
import { renderTerrain } from './render/terrain'
import type { FloodObject } from './types'

/** The campus never changes; design objects are layered on top of it. */
const campus = createCampus()
const SURFACE_NAME: Record<number, string> = Object.fromEntries(Object.entries(SURF).map(([k, v]) => [v, k]))

export function FloodWorld({ debug }: WorldProps<FloodObject>) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const terrainRef = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (terrainRef.current) renderTerrain(terrainRef.current, campus)
  }, [])

  // Fit the map into the available space while keeping the grid's aspect ratio.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const scale = Math.min(width / GRID_W, height / GRID_H)
      setBox({ w: Math.floor(GRID_W * scale), h: Math.floor(GRID_H * scale) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const toCell = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.floor(((e.clientX - r.left) / r.width) * GRID_W),
      y: Math.floor(((e.clientY - r.top) / r.height) * GRID_H),
    }
  }

  const hoverCell = hover && hover.x >= 0 && hover.y >= 0 && hover.x < GRID_W && hover.y < GRID_H ? hover : null
  const hoverIdx = hoverCell ? hoverCell.y * GRID_W + hoverCell.x : -1

  return (
    <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center">
      <div
        className="relative overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10"
        style={{ width: box.w, height: box.h }}
      >
        <canvas ref={terrainRef} className="absolute inset-0 h-full w-full" />
        <svg
          viewBox={`0 0 ${GRID_W} ${GRID_H}`}
          className="absolute inset-0 h-full w-full"
          onPointerMove={(e) => setHover(toCell(e))}
          onPointerLeave={() => setHover(null)}
        >
          {debug && <DebugGrid />}

          {campus.zones.map((z) => (
            <text
              key={z.name}
              x={z.x + z.w / 2}
              y={z.y + z.h - 1}
              textAnchor="middle"
              className="pointer-events-none fill-white/55 font-semibold uppercase"
              style={{ fontSize: 1.25, letterSpacing: 0.25 }}
            >
              {z.name}
            </text>
          ))}

          {campus.buildings.map((b) => (
            <g key={b.key} className="pointer-events-none">
              <rect
                x={b.x + b.w / 2 - 5}
                y={b.y + b.h / 2 - 1.25}
                width={10}
                height={2.5}
                rx={1.25}
                className="fill-slate-900/80"
              />
              <text
                x={b.x + b.w / 2}
                y={b.y + b.h / 2 + 0.55}
                textAnchor="middle"
                className="fill-white font-bold"
                style={{ fontSize: 1.5 }}
              >
                {b.name}
              </text>
            </g>
          ))}

          {campus.existingDrains.map((d) => (
            <g key={d.id} className="pointer-events-none">
              <rect x={d.x + 0.1} y={d.y + 0.1} width={0.8} height={0.8} rx={0.1} className="fill-slate-800 stroke-slate-400" strokeWidth={0.08} />
              <path d={`M${d.x + 0.3} ${d.y + 0.25}v0.5M${d.x + 0.5} ${d.y + 0.25}v0.5M${d.x + 0.7} ${d.y + 0.25}v0.5`} className="stroke-slate-400" strokeWidth={0.06} />
            </g>
          ))}

          {campus.outlets.map((o) => (
            <g key={o.id} className="pointer-events-none">
              <circle cx={o.x + 0.5} cy={o.y + 0.5} r={1.3} className="fill-sky-500/30 stroke-sky-300" strokeWidth={0.12} />
              <circle cx={o.x + 0.5} cy={o.y + 0.5} r={0.55} className="fill-sky-300" />
              <text
                x={o.x + 0.5 + (o.x < GRID_W / 2 ? 1.8 : -1.8)}
                y={o.y + 0.9}
                textAnchor={o.x < GRID_W / 2 ? 'start' : 'end'}
                className="fill-sky-100 font-semibold"
                style={{ fontSize: 1.1, paintOrder: 'stroke', stroke: 'rgba(15,23,42,0.8)', strokeWidth: 0.3 }}
              >
                {o.name}
              </text>
            </g>
          ))}
        </svg>

        {debug && hoverCell && (
          <div className="pointer-events-none absolute left-2 top-2 rounded bg-slate-950/85 px-2 py-1 font-mono text-[11px] text-slate-200">
            ({hoverCell.x}, {hoverCell.y}) · {SURFACE_NAME[campus.surface[hoverIdx]]} · elev{' '}
            {campus.elevation[hoverIdx].toFixed(2)} ft
            {campus.building[hoverIdx] >= 0 && ` · ${campus.buildings[campus.building[hoverIdx]].name}`}
          </div>
        )}
      </div>
    </div>
  )
}

function DebugGrid() {
  const lines = []
  for (let x = 0; x <= GRID_W; x++)
    lines.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={GRID_H} strokeWidth={x % 10 === 0 ? 0.08 : 0.03} />)
  for (let y = 0; y <= GRID_H; y++)
    lines.push(<line key={`y${y}`} x1={0} y1={y} x2={GRID_W} y2={y} strokeWidth={y % 10 === 0 ? 0.08 : 0.03} />)
  return <g className="pointer-events-none stroke-fuchsia-300/60">{lines}</g>
}
