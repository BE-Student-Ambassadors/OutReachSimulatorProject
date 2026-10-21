import { useSyncExternalStore } from 'react'
import type { EffortStats } from '../sim/business'
import type { SponsorId } from '../types'

/**
 * Paint layers for each sponsor's flyer. Kept on this device only (pictures are too big to sync);
 * the team sees the finished flyer's effort score and payout.
 */

export const FLYER_W = 300
export const FLYER_H = 400

export interface Stroke {
  color: string
  size: number
  erase: boolean
  points: [number, number][]
}
export interface Sticker {
  emoji: string
  x: number
  y: number
  size: number
}
export interface TextItem {
  text: string
  x: number
  y: number
  color: string
  size: number
}

export interface PaintState {
  strokes: Stroke[]
  stickers: Sticker[]
  texts: TextItem[]
  /** Order things were added in, for undo. */
  history: ('stroke' | 'sticker' | 'text')[]
  generations: number
}

const empty = (): PaintState => ({ strokes: [], stickers: [], texts: [], history: [], generations: 0 })
const store = new Map<SponsorId, PaintState>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version++
  listeners.forEach((l) => l())
}

export function getPaint(id: SponsorId): PaintState {
  let s = store.get(id)
  if (!s) {
    s = empty()
    store.set(id, s)
  }
  return s
}

export function updatePaint(id: SponsorId, fn: (s: PaintState) => PaintState) {
  store.set(id, fn(getPaint(id)))
  emit()
}

export function undoPaint(id: SponsorId) {
  updatePaint(id, (s) => {
    const last = s.history[s.history.length - 1]
    if (!last) return s
    const history = s.history.slice(0, -1)
    if (last === 'stroke') return { ...s, history, strokes: s.strokes.slice(0, -1) }
    if (last === 'sticker') return { ...s, history, stickers: s.stickers.slice(0, -1) }
    return { ...s, history, texts: s.texts.slice(0, -1) }
  })
}

export function usePaintVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
  )
}

export function paintStats(s: PaintState, prompt: string): EffortStats {
  const painted = s.strokes.filter((st) => !st.erase)
  let inked = 0
  for (const st of painted) {
    let len = st.size
    for (let i = 1; i < st.points.length; i++) {
      len += Math.hypot(st.points[i][0] - st.points[i - 1][0], st.points[i][1] - st.points[i - 1][1])
    }
    inked += len * st.size
  }
  return {
    strokes: painted.length,
    colorsUsed: new Set([...painted.map((st) => st.color), ...s.texts.map((t) => t.color)]).size,
    stickers: s.stickers.length,
    texts: s.texts.length,
    coverage: Math.min(1, inked / (FLYER_W * FLYER_H)),
    promptWords: prompt.trim() ? prompt.trim().split(/\s+/).length : 0,
  }
}
