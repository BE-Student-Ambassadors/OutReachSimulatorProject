import { PANEL_MIN_TOYS, PANEL_MIN_WORDS, SEED_FUNDS, SPONSOR_BY_ID } from '../config'
import type { BusinessObject, SponsorId, StoryPanel } from '../types'

export const words = (s: string) => s.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []

export function panelDone(p: StoryPanel): boolean {
  return p.toys.length >= PANEL_MIN_TOYS && words(p.caption).length >= PANEL_MIN_WORDS
}

export function panelsDone(biz: BusinessObject): number {
  return biz.panels.filter(panelDone).length
}

export interface Interest {
  /** 0..1 */
  score: number
  /** Words and toys from the story that caught this sponsor's attention. */
  hooks: string[]
}

/**
 * How interested a sponsor is in the team's story, 0..1. Half comes from how complete and
 * detailed the story is, half from how much it speaks to what this sponsor cares about.
 * Each part tops out, so no single trick maxes it.
 */
export function sponsorInterest(biz: BusinessObject, id: SponsorId): Interest {
  const sp = SPONSOR_BY_ID[id]
  const all = biz.panels.flatMap((p) => words(p.caption))
  const toys = biz.panels.flatMap((p) => p.toys.map((t) => t.toy))
  const part = (v: number, full: number) => Math.max(0, Math.min(1, v / full))

  const effort = 0.6 * part(panelsDone(biz), 4) + 0.25 * part(all.length, 40) + 0.15 * part(new Set(toys).size, 6)

  const hitWords = [...new Set(all.filter((w) => sp.keywords.some((k) => w === k || (k.length > 3 && w.startsWith(k)))))]
  const hitToys = [...new Set(toys.filter((t) => sp.toys.includes(t)))]
  const fit = 0.65 * part(hitWords.length, 3) + 0.35 * part(hitToys.length, 2)

  return { score: Math.round((0.5 * effort + 0.5 * fit) * 100) / 100, hooks: [...hitWords, ...hitToys] }
}

/** What a sponsor offers for a given interest: nothing below a little interest, the full amount at 1. */
export function offerFor(id: SponsorId, interest: number): number {
  const sp = SPONSOR_BY_ID[id]
  if (interest < 0.2) return 0
  return Math.round((sp.maxOffer * Math.min(1, (interest - 0.1) / 0.8)) / 50) * 50
}

export function fundsRaised(biz: BusinessObject): number {
  return biz.deals.reduce((s, d) => s + (d.accepted ? d.offer : 0), 0)
}

export function totalFunds(biz: BusinessObject): number {
  return SEED_FUNDS + fundsRaised(biz)
}
