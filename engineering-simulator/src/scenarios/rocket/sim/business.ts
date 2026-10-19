import { PAYOUT_MAX_SHARE, PAYOUT_MIN_SHARE, SEED_FUNDS, SPONSOR_BY_ID } from '../config'
import type { BusinessObject, FlyerLayout, FlyerMotif, FlyerSpec, SponsorId } from '../types'
import { mulberry32, pick } from './rng'

// ---------------------------------------------------------------- negotiation

/** The most a sponsor will pay this team (varies a little per game). Hidden from students. */
export function sponsorCeiling(seed: number, id: SponsorId): number {
  const rand = mulberry32(seed ^ hash(id))
  return SPONSOR_BY_ID[id].ceiling + Math.floor(rand() * 11) - 5
}

export type CounterReply =
  | { kind: 'accepted'; amount: number }
  | { kind: 'final-offer'; amount: number }
  | { kind: 'walked-away' }

/** How a sponsor answers a counter-offer. Asking a little over their limit gets a final offer; asking far over ends the talks. */
export function counterReply(seed: number, id: SponsorId, ask: number): CounterReply {
  const ceiling = sponsorCeiling(seed, id)
  if (ask <= ceiling) return { kind: 'accepted', amount: Math.round(ask) }
  if (ask <= ceiling * 1.6) return { kind: 'final-offer', amount: ceiling - 5 }
  return { kind: 'walked-away' }
}

// ---------------------------------------------------------------- effort → payout

export interface EffortStats {
  strokes: number
  colorsUsed: number
  stickers: number
  texts: number
  /** Share of the flyer covered by paint, 0..1. */
  coverage: number
  promptWords: number
}

/** 0..1. More work on the flyer scores higher; each kind of effort tops out so no single trick maxes it. */
export function effortScore(s: EffortStats): number {
  const part = (v: number, full: number) => Math.max(0, Math.min(1, v / full))
  return (
    0.25 * part(s.strokes, 25) +
    0.15 * part(s.colorsUsed - 1, 4) +
    0.15 * part(s.stickers, 5) +
    0.15 * part(s.texts, 2) +
    0.15 * part(s.coverage, 0.2) +
    0.15 * part(s.promptWords, 12)
  )
}

export function payoutFor(agreed: number, effort: number): number {
  return Math.round(agreed * (PAYOUT_MIN_SHARE + (PAYOUT_MAX_SHARE - PAYOUT_MIN_SHARE) * Math.max(0, Math.min(1, effort))))
}

export function fundsRaised(biz: BusinessObject | null): number {
  return biz ? biz.deals.reduce((sum, d) => sum + (d.stage === 'paid' ? d.payout : 0), 0) : 0
}

export function totalFunds(biz: BusinessObject | null): number {
  return SEED_FUNDS + fundsRaised(biz)
}

// ---------------------------------------------------------------- vibe design

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const COLOR_WORDS: [RegExp, string][] = [
  [/\bred\b|crimson|scarlet/, '#d33a2c'],
  [/orange|tangerine/, '#ef7d22'],
  [/yellow|lemon/, '#f2c230'],
  [/gold|golden/, '#d4a017'],
  [/lime|neon green/, '#8fd14f'],
  [/green|forest|leaf/, '#2f7a46'],
  [/teal|turquoise|aqua/, '#1f9e93'],
  [/navy|midnight/, '#1a2350'],
  [/blue|sky/, '#2f6fd6'],
  [/purple|violet|lavender/, '#7b4cc0'],
  [/pink|magenta|rose/, '#e0559a'],
  [/brown|chocolate|wood/, '#7a4e2d'],
  [/black|dark/, '#16181d'],
  [/white|clean|minimal/, '#fbfaf5'],
  [/silver|gray|grey|metal/, '#9aa3ad'],
]

const MOOD_PALETTES: [RegExp, [string, string, string]][] = [
  [/space|night|galaxy|cosmic/, ['#141a3a', '#f4c542', '#ffffff']],
  [/retro|vintage|old school|70s|80s/, ['#f3e3c3', '#d4572a', '#3b2a1a']],
  [/calm|soft|pastel|gentle/, ['#e9f1ea', '#9cc5a1', '#2e4a37']],
  [/bold|loud|exciting|epic|intense/, ['#16181d', '#ef3b2c', '#ffffff']],
  [/fun|happy|bright|playful|colorful/, ['#fff3c4', '#ef5da8', '#1f2a44']],
  [/elegant|fancy|classy|luxury/, ['#121212', '#d4a017', '#f5f0e1']],
  [/nature|earth|eco|outdoor/, ['#eaf2df', '#3f8f52', '#23361f']],
]

const MOTIF_WORDS: [RegExp, FlyerMotif][] = [
  [/rocket|launch|blast|liftoff|lift off/, 'rocket'],
  [/star|galaxy|space|night|planet|moon/, 'stars'],
  [/mountain|hike|peak|summit|outdoor/, 'mountains'],
  [/burger|food|pizza|fries|eat|hungry|lunch/, 'food'],
  [/sun|solar|energy|bright|light/, 'sun'],
  [/tool|hammer|build|wrench|hardware|diy/, 'tools'],
  [/money|bank|save|coin|cash|invest/, 'money'],
  [/ocean|wave|water|beach|surf|tide/, 'wave'],
]

const INDUSTRY_MOTIF: Record<SponsorId, FlyerMotif> = {
  ridgeline: 'tools',
  'byte-burger': 'food',
  'summit-solar': 'sun',
  tidewater: 'money',
  'pixel-print': 'stars',
}

const HEADLINES = [
  '{S} helps us reach new heights',
  'Launching dreams with {S}',
  'Powered by {S}',
  '{S}: proud rocket sponsor',
  'Shoot for the sky with {S}',
  'Built on {S}',
  '3… 2… 1… {S}!',
]

const TAGLINES = [
  'Proud sponsor of the high school rocket team',
  'Helping students build, test and launch',
  'Supporting young engineers in our town',
  'Ask us about the rocket team!',
]

/**
 * Turns a free-text description into a flyer: colors, picture and layout come from the words used,
 * a "quoted phrase" becomes the headline. Same prompt, same flyer; a new prompt reshuffles it.
 */
export function vibeFlyer(prompt: string, sponsorId: SponsorId): FlyerSpec {
  const text = prompt.toLowerCase()
  const sponsor = SPONSOR_BY_ID[sponsorId]
  const rand = mulberry32(hash(prompt + sponsorId))

  const named = COLOR_WORDS.filter(([re]) => re.test(text)).map(([, c]) => c)
  const mood = MOOD_PALETTES.find(([re]) => re.test(text))?.[1]
  let palette: [string, string, string]
  if (named.length >= 2) palette = [named[0], named[1], readableOn(named[0])]
  else if (named.length === 1 && mood) palette = [named[0], mood[1], readableOn(named[0])]
  else if (named.length === 1) palette = [named[0], sponsor.brandColor, readableOn(named[0])]
  else palette = mood ?? ['#fbfaf5', sponsor.brandColor, '#1b2a20']

  const motif = MOTIF_WORDS.find(([re]) => re.test(text))?.[1] ?? INDUSTRY_MOTIF[sponsorId]
  const layout: FlyerLayout = /banner|wide|sign|billboard/.test(text) ? 'banner' : /badge|sticker|round|circle|logo/.test(text) ? 'badge' : 'poster'

  const quoted = /["“]([^"”]{2,60})["”]/.exec(prompt)?.[1]
  const headline = quoted ?? pick(rand, HEADLINES).replace('{S}', sponsor.name)
  const tagline = pick(rand, TAGLINES)
  return { prompt, headline, tagline, palette, motif, layout }
}

/** Dark text on light backgrounds, light text on dark ones. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1b2a20' : '#ffffff'
}
