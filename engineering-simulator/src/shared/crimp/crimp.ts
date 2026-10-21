/**
 * Crimping a connector onto a cut wire: pick the die for the wire size, strip the right length of
 * insulation, squeeze the handles just far enough. Shared by every scenario with a wiring harness.
 */

export interface CrimpDie {
  id: 'red' | 'gray' | 'yellow'
  label: string
  /** Wire sizes this die is made for, thinnest to thickest (AWG). */
  awg: [number, number]
  color: string
}

export const CRIMP = {
  dies: [
    { id: 'red', label: 'Red die', awg: [22, 18], color: '#c8281c' },
    { id: 'gray', label: 'Gray die', awg: [16, 14], color: '#8a8f8a' },
    { id: 'yellow', label: 'Yellow die', awg: [12, 10], color: '#e1b12c' },
  ] as CrimpDie[],
  /** Bare copper needed to fill the connector barrel, mm. */
  stripTargetMm: 6,
  stripToleranceMm: 1,
  stripMaxMm: 14,
  /** Squeeze where the crimp is fully formed (0..1 of the handle travel). Past `crush` the barrel is crushed. */
  squeezeLo: 0.8,
  squeezeHi: 0.93,
  crush: 0.98,
  /** Contact resistance of a perfect crimp, and the most a bad one adds, ohms. */
  goodOhms: 0.002,
  badOhms: 0.12,
  /** Hot connectors resist more. */
  hotFactor: 2.5,
  /** In a moving zone, a crimp weaker than this shakes loose on the lap. */
  looseBelow: 0.6,
} as const

export type DieFit = 'fit' | 'loose' | 'crushed'

/** A die is made for a range of wire sizes. A thinner wire sits loose in it; a thicker one gets crushed. */
export function dieFit(die: CrimpDie, awg: number): DieFit {
  const [thin, thick] = die.awg
  if (awg > thin) return 'loose'
  if (awg < thick) return 'crushed'
  return 'fit'
}

export interface CrimpInput {
  die: CrimpDie['id']
  /** Copper stripped bare, mm. */
  stripMm: number
  /** How far the handles were squeezed, 0..1 of their travel (past 1 = forced past the stop). */
  squeeze: number
}

export interface CrimpReport {
  quality: number
  /** What happened, as facts. */
  facts: string[]
}

const r1 = (n: number) => Math.round(n * 10) / 10

export function scoreCrimp(input: CrimpInput, awg: number): CrimpReport {
  const facts: string[] = []
  const die = CRIMP.dies.find((d) => d.id === input.die) ?? CRIMP.dies[0]
  const fit = dieFit(die, awg)
  let q = 1
  if (fit === 'loose') {
    q *= 0.4
    facts.push(`${die.label} (for ${die.awg[0]}–${die.awg[1]} AWG) on ${awg} AWG wire: the barrel closed around air and the wire can wiggle.`)
  } else if (fit === 'crushed') {
    q *= 0.45
    facts.push(`${die.label} (for ${die.awg[0]}–${die.awg[1]} AWG) on ${awg} AWG wire: the die squashed the barrel and cut some strands.`)
  } else facts.push(`${die.label} matches ${awg} AWG wire.`)

  const err = input.stripMm - CRIMP.stripTargetMm
  if (Math.abs(err) > CRIMP.stripToleranceMm) {
    q *= Math.max(0.25, 1 - 0.16 * (Math.abs(err) - CRIMP.stripToleranceMm))
    facts.push(
      err < 0
        ? `${r1(input.stripMm)} mm stripped: the copper stops short of the end of the ${CRIMP.stripTargetMm} mm barrel.`
        : `${r1(input.stripMm)} mm stripped: ${r1(err)} mm of bare copper sticks out past the barrel.`,
    )
  } else facts.push(`${r1(input.stripMm)} mm stripped: the copper fills the ${CRIMP.stripTargetMm} mm barrel.`)

  const s = input.squeeze
  const pct = Math.round(s * 100)
  if (s > CRIMP.crush) {
    q *= 0.5
    facts.push(`Handles forced past the stop: the barrel cracked.`)
  } else if (s > CRIMP.squeezeHi) {
    q *= 1 - ((s - CRIMP.squeezeHi) / (CRIMP.crush - CRIMP.squeezeHi)) * 0.3
    facts.push(`Squeezed to ${pct}% of the handle travel: the barrel is over-pressed.`)
  } else if (s < CRIMP.squeezeLo) {
    q *= 0.3 + 0.7 * (s / CRIMP.squeezeLo) ** 3
    facts.push(`Squeezed to ${pct}% of the handle travel: the barrel isn't fully closed.`)
  } else facts.push(`Squeezed to ${pct}% of the handle travel: the barrel is fully formed.`)

  return { quality: Math.round(q * 100) / 100, facts }
}

/** Resistance of a crimped connection, ohms. Hot connectors resist more. */
export function crimpOhms(q: number, hot: boolean): number {
  const r = CRIMP.goodOhms + CRIMP.badOhms * (1 - q) ** 2
  return hot ? r * CRIMP.hotFactor : r
}
