import { Rocket } from 'lucide-react'
import { count, money } from '../../core/format'
import type { Scenario } from '../../core/scenario'
import { RocketArt } from './CardArt'
import { REQUIRED, SEED_FUNDS, VARIANTS } from './config'
import { designCost } from './cost'
import { RocketProperties } from './RocketProperties'
import { RocketRun, type RocketResult } from './sim/engine'
import type { RocketObject, RocketVariantId } from './types'
import { RocketWorld } from './world/RocketWorld'

const IGNITION_FACTS: Record<RocketResult['ignitionBlocks'][number], string> = {
  'no-body': 'There was no body tube in its slot on the blueprint, so nothing held the rocket together.',
  'no-avionics': 'The avionics bay was not in its slot, so the flight computer was not mounted in the rocket.',
  'no-program': 'The flight computer had no working program uploaded.',
  'no-power': 'The power circuit was not connected, so the flight computer never turned on.',
  'no-ignite-command': 'The launch program never ran an IGNITE command.',
  'no-igniter': 'The igniter circuit was not connected, so the motor never got the signal to light.',
  'no-motor': 'There was no motor in the motor mount.',
}

/** Factual observations about a launch. Never advice. */
function observations(r: RocketResult): string[] {
  const out: string[] = []
  if (r.outcome === 'no-ignition') {
    out.push('The motor never lit and the rocket stayed on the pad.')
    r.ignitionBlocks.forEach((b) => out.push(IGNITION_FACTS[b]))
  } else if (r.outcome === 'no-liftoff') {
    out.push(`The motor fired for ${r.burnSeconds} s, but its thrust was only ${r.thrustToWeight}× the rocket's ${r.massKg} kg weight, so it never left the pad.`)
  } else if (r.outcome === 'breakup') {
    out.push(
      `The ${r.weakestPart} ${r.weakestPart === 'fins' ? 'are' : 'is'} rated to ${count(r.maxSafeMph)} mph. The rocket passed that speed ${count(r.breakupAltFt)} ft up and tore apart.`,
    )
  } else {
    out.push(
      `The rocket reached ${count(r.apogeeFt)} ft (${count(r.apogeeErrorFt)} ft from the ${count(REQUIRED.targetApogeeFt)} ft target), with a top speed of ${count(r.peakSpeedMph)} of its ${count(r.maxSafeMph)} mph rated speed.`,
    )
    out.push(`The motor burned for ${r.burnSeconds} s${r.fuelRanOut ? ' and ran out of fuel' : ''}. Liftoff mass was ${r.massKg} kg.`)
    if (r.tumbled) out.push('With no fin set in the fin slot, the rocket tumbled end over end as it climbed.')
    if (r.corkscrew) out.push('The warped fin spun the rocket in a corkscrew as it climbed.')
    if (r.noNose) out.push('With no nose cone in its slot, the open front of the tube pushed against a lot of air.')
    if (!r.sawFalling) out.push('The flight computer never detected the rocket falling (the "ON falling" block needs the altimeter circuit).')
    if (r.chute === 'no-charge') out.push('The program called DEPLOY, but the ejection charge circuit was not connected.')
    if (r.chute === 'no-parachute') out.push('The ejection charge fired, but there was no parachute in the parachute slot.')
    if (r.chute === 'separated') out.push('The parachute came out, but nothing tied it to the rocket: the shock cord was not in its slot.')
    if (r.chute === 'torn') out.push(`The parachute opened at ${count(r.deploySpeedMph ?? 0)} mph, ${count(r.deployAltFt ?? 0)} ft up, faster than its rated opening speed, and ripped.`)
    if (r.chute === 'open') out.push(`The parachute opened ${count(r.deployAltFt ?? 0)} ft up while falling at ${count(r.deploySpeedMph ?? 0)} mph.`)
    out.push(`It touched down at ${r.landingFps} ft/s, ${count(r.driftFt)} ft downwind of the pad.`)
  }
  if (!r.hasTelemetry) out.push('No radio data reached the ground station during the flight.')
  out.push(`The team spent ${money(r.spent)} of ${money(r.funds)}.`)
  return out
}

export const rocketScenario: Scenario<RocketObject, RocketResult> = {
  id: 'rocket',
  title: 'Rocket Team',
  discipline: 'Electrical + Mechanical + Software + Business',
  tagline: '4 engineers, 1 rocket, almost no money. Wire it, build it, code it, fund it, then launch it.',
  intro: {
    heading: 'Build a rocket on a shoestring',
    paragraphs: [
      `Your team has ${money(SEED_FUNDS)} and a blueprint. Your rocket has to climb to ${count(REQUIRED.targetApogeeFt)} ft (± ${REQUIRED.apogeeToleranceFt}) and come back down gently enough to fly again.`,
      'Electrical wires the flight breadboard. Mechanical buys parts online and builds the rocket. Software debugs and tunes the flight program. Business wins sponsors to pay for it all.',
      'Every station needs the others. Launch as often as you like: each launch is a test that tells you what happened.',
    ],
  },
  instructions: [
    'Pick your role (Roles button). You can visit every station.',
    'Follow the checklist at the top of your station.',
    'Go to the Launch Pad and launch whenever you want to test.',
    `Reach ${count(REQUIRED.targetApogeeFt)} ft, land at ${REQUIRED.maxLandingFps} ft/s or slower, and spend no more than you raise.`,
  ],
  budget: SEED_FUNDS,
  minimalShell: true,
  runLabel: 'Launch',
  variants: [{ id: 'standard', label: VARIANTS.standard.label, blurb: VARIANTS.standard.blurb }],
  tools: [
    {
      id: 'rocket',
      label: 'Rocket',
      icon: Rocket,
      accent: '#2c5b3c',
      priceLabel: 'Varies',
      summary: 'Built from the four stations.',
      placement: 'point',
    },
  ],
  requirements: [
    {
      id: 'apogee',
      label: `Apogee (${count(REQUIRED.targetApogeeFt)} ft)`,
      passLabel: 'Apogee on target',
      target: `${count(REQUIRED.targetApogeeFt)} ± ${REQUIRED.apogeeToleranceFt} ft`,
      status: (r) => (r ? { value: `${count(r.apogeeFt)} ft`, pass: r.apogeePassed } : { value: null, pass: null }),
    },
    {
      id: 'recovery',
      label: 'Safe landing',
      passLabel: 'Landed safely',
      target: `≤ ${REQUIRED.maxLandingFps} ft/s`,
      status: (r) =>
        r
          ? { value: r.outcome === 'flight' ? `${r.landingFps} ft/s` : r.outcome === 'breakup' ? 'BROKE UP' : 'NO FLIGHT', pass: r.recoveryPassed }
          : { value: null, pass: null },
    },
    {
      id: 'budget',
      label: 'Money',
      passLabel: 'Within budget',
      target: 'Spent ≤ raised',
      status: (r, cost) => (r ? { value: `${money(r.spent)} / ${money(r.funds)}`, pass: r.budgetPassed } : { value: money(cost), pass: null }),
    },
  ],
  initialDesign: () => [],
  cost: designCost,
  remove: (design, id) => design.filter((o) => o.id !== id),
  createRun: (design, variantId) => new RocketRun(design, (variantId as RocketVariantId) ?? 'standard'),
  observations,
  stats: (r) => [
    { label: 'Apogee', value: `${count(r.apogeeFt)} ft` },
    { label: 'Top / rated speed', value: `${count(r.peakSpeedMph)} / ${count(r.maxSafeMph)} mph` },
    { label: 'Burn time', value: `${r.burnSeconds} s` },
    { label: 'Liftoff mass', value: `${r.massKg} kg` },
    { label: 'Parachute opened', value: r.deployAltFt !== null ? `${count(r.deployAltFt)} ft` : '—' },
    { label: 'Landing speed', value: `${r.landingFps} ft/s` },
    { label: 'Drift', value: `${count(r.driftFt)} ft` },
    { label: 'Money', value: `${money(r.spent)} / ${money(r.funds)}` },
  ],
  summary: (r) => (r.outcome === 'flight' ? `${count(r.apogeeFt)} ft · ${r.landingFps} ft/s` : r.outcome === 'breakup' ? `broke up ${count(r.breakupAltFt)} ft` : 'no liftoff'),
  World: RocketWorld,
  Properties: RocketProperties,
  CardArt: RocketArt,
}
