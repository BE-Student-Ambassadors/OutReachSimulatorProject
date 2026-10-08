import { createCampus } from './campus'
import { CELL_FT, COST, POND_SIZE } from './config'
import { pathLengthCells } from './geometry'
import type { FloodObject, Pt } from './types'

const campus = createCampus()

/** Position (cell units) of anything a pipe can connect to: a drain, a pond, or an outlet. */
export function nodePosition(design: FloodObject[], id: string): Pt | null {
  const outlet = campus.outlets.find((o) => o.id === id)
  if (outlet) return { x: outlet.x + 0.5, y: outlet.y + 0.5 }
  const o = design.find((d) => d.id === id)
  if (o?.kind === 'drain') return { x: o.x + 0.5, y: o.y + 0.5 }
  if (o?.kind === 'pond') return { x: o.x + POND_SIZE[o.size] / 2, y: o.y + POND_SIZE[o.size] / 2 }
  return null
}

export function pipeLengthFt(design: FloodObject[], from: string, to: string) {
  const a = nodePosition(design, from)
  const b = nodePosition(design, to)
  if (!a || !b) return 0
  return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) * CELL_FT
}

export function objectCost(o: FloodObject, design: FloodObject[]): number {
  switch (o.kind) {
    case 'drain':
      return COST.drain
    case 'pipe':
      return Math.round(pipeLengthFt(design, o.from, o.to) * COST.pipePerFt[o.size])
    case 'channel':
      return Math.round(Math.max(1, pathLengthCells(o.points)) * CELL_FT * COST.channelPerFt)
    case 'pond':
      return COST.pond[o.size]
    case 'rainGarden':
      return COST.rainGarden
    case 'permeable':
      return o.cells.length * COST.permeablePerCell
    case 'pump':
      return COST.pump[o.size]
    case 'barrier':
      return Math.round(Math.max(1, pathLengthCells(o.points)) * CELL_FT * COST.barrierPerFt)
    case 'tree':
      return COST.tree
  }
}

export const designCost = (design: FloodObject[]) => design.reduce((sum, o) => sum + objectCost(o, design), 0)
