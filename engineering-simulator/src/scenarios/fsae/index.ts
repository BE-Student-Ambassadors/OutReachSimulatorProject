import { count, money } from '../../core/format'
import type { Scenario } from '../../core/scenario'
import { FsaeArt } from './CardArt'
import { REQUIRED, SEED_FUNDS, VARIANTS } from './config'
import { designCost } from './cost'
import { FsaeProperties } from './FsaeProperties'
import { MS_TO_MPH } from './sim/car'
import { FsaeRun, REPORT_SPEED_MS, type FsaeResult } from './sim/engine'
import type { FsaeObject, FsaeVariantId } from './types'
import { FsaeWorld } from './world/FsaeWorld'

const mph = Math.round(REPORT_SPEED_MS * MS_TO_MPH)

/** Facts about the test. Never advice. */
function observations(r: FsaeResult): string[] {
  const out: string[] = []
  out.push(
    `Autocross lap: ${r.lapS.toFixed(2)} s. Fastest point ${count(r.topMph)} mph on ${r.topPlace}; slowest ${count(r.slowestMph)} mph at ${r.slowestPlace}.`,
  )
  out.push(
    `Aero at ${mph} mph: ${count(r.downforceN)} N of downforce (${Math.round(r.aero.balance * 100)}% on the front axle) and ${count(r.dragN)} N of drag.` +
      (r.aero.handling === 'understeer' ? ' The front tires had less grip than the rears (understeer).' : r.aero.handling === 'oversteer' ? ' The rear tires had less grip than the fronts (oversteer).' : ''),
  )
  if (r.aero.bottoming) out.push(`At ${r.rideHeightMm} mm ride height the floor scraped the ground over bumps.`)
  if (r.jointsWelded < r.jointsTotal) out.push(`${r.jointsTotal - r.jointsWelded} of ${r.jointsTotal} frame joints were not welded; the frame flexed in corners.`)
  else if (r.weldQualityPct < 100) out.push(`All frame joints were welded; average weld quality ${r.weldQualityPct}%.`)
  if (r.motorState === 'high') out.push(`The motor received ${r.motorVolts} V (rated 38–42 V). The motor controller limited it to ${Math.round(r.powerKw)} kW.`)
  else if (r.motorState === 'low') out.push(`The motor received ${r.motorVolts} V (rated 38–42 V) and made ${Math.round(r.powerKw)} kW.`)
  if (r.pumpState === 'low') out.push('The cooling pump ran below its rated voltage; the motor ran hot and its power was trimmed.')
  const off = r.power.filter((p) => p.state !== 'ok')
  if (off.length) out.push(`Out of range: ${off.map((p) => `${p.label} ${p.volts} V (${p.lo}–${p.hi})`).join(', ')}.`)
  const d = r.driverless
  if (!d.modelReady) out.push('The driverless computer had no trained model, so it could not recognise any cones.')
  else {
    out.push(
      `Driverless lap: the car missed ${d.missed} of ${d.gates} cones` +
        (d.phantom ? ` and swerved for ${d.phantom} things that were not cones.` : '.') +
        ` Model accuracy on the test pictures: ${r.accuracyPct}%.`,
    )
  }
  if (r.variant === 'night') out.push(`At night the cameras saw ${r.visibilityPct}% as clearly as in daylight.`)
  out.push(r.fundsPass ? `The car cost ${money(r.cost)}; the team had ${money(r.funds)}.` : `The car cost ${money(r.cost)} but the team only had ${money(r.funds)}.`)
  return out
}

export const fsaeScenario: Scenario<FsaeObject, FsaeResult> = {
  id: 'fsae',
  title: 'Formula SAE',
  discipline: 'Mechanical + Electrical + Software + Business',
  tagline: 'A team of four builds a race car: frame and wings, wiring, a self-driving model, and sponsors to pay for it all. Then everyone races it.',
  intro: {
    heading: 'BUILD A RACE CAR',
    paragraphs: [
      'Formula SAE is a competition where university students design, build and race their own small race car.',
      'Your team of four has one car to finish. The mechanical engineer welds the frame and shapes the wings. The electrical engineer gets the right voltage to every part. The software engineer trains the self-driving computer. The business lead finds sponsors, because the school’s money won’t cover the whole car.',
      `To compete, the car must lap the autocross course in ${REQUIRED.maxLapS} s or less, hit no more than ${REQUIRED.maxConesHit} cones on its driverless lap, have every electrical part in its rated range, and be paid for.`,
      'Then everyone on the team gets to drive it on Race Day.',
    ],
  },
  instructions: [
    'Pick a job. The checklist at the top ticks itself off as you work.',
    'Run a Competition Test from the Test & Race Day tab.',
    'Start a race heat and drive the car you built.',
  ],
  budget: SEED_FUNDS,
  minimalShell: true,
  runLabel: 'Competition Test',
  variants: [
    { id: 'standard', label: VARIANTS.standard.label, blurb: VARIANTS.standard.blurb },
    { id: 'night', label: VARIANTS.night.label, blurb: VARIANTS.night.blurb },
  ],
  tools: [],
  requirements: [
    {
      id: 'lap',
      label: 'Autocross lap time',
      passLabel: 'Fast enough',
      target: `≤ ${REQUIRED.maxLapS} s`,
      status: (r) => (r ? { value: `${r.lapS.toFixed(2)} s`, pass: r.lapPass } : { value: null, pass: null }),
    },
    {
      id: 'cones',
      label: 'Driverless cones hit',
      passLabel: 'Drives itself',
      target: `≤ ${REQUIRED.maxConesHit}`,
      status: (r) => (r ? { value: r.driverless.modelReady ? String(r.driverless.missed) : 'No model', pass: r.conesPass } : { value: null, pass: null }),
    },
    {
      id: 'power',
      label: 'Power systems in range',
      passLabel: 'Wired right',
      target: '5 of 5',
      status: (r) => (r ? { value: `${r.powerInRange} of 5`, pass: r.powerPass } : { value: null, pass: null }),
    },
    {
      id: 'funds',
      label: 'Car is paid for',
      passLabel: 'Fully funded',
      target: 'cost ≤ money raised',
      status: (r, cost) => (r ? { value: `${money(cost)} / ${money(r.funds)}`, pass: cost <= r.funds } : { value: null, pass: null }),
    },
  ],
  initialDesign: () => [],
  cost: designCost,
  // Nothing is ever removed from the shared design (teammates' copies merge object by object).
  remove: (design) => design,
  createRun: (design, variantId) => new FsaeRun(design, (variantId as FsaeVariantId) ?? 'standard'),
  observations,
  stats: (r) => [
    { label: 'Lap time', value: `${r.lapS.toFixed(2)} s` },
    { label: 'Top speed on course', value: `${count(r.topMph)} mph` },
    { label: `Downforce at ${mph} mph`, value: `${count(r.downforceN)} N` },
    { label: `Drag at ${mph} mph`, value: `${count(r.dragN)} N` },
    { label: 'Front share of downforce', value: `${Math.round(r.aero.balance * 100)}%` },
    { label: 'Motor power', value: `${Math.round(r.powerKw)} kW` },
    { label: 'Car + driver mass', value: `${Math.round(r.massKg)} kg` },
    { label: 'Model accuracy', value: `${r.accuracyPct}%` },
  ],
  summary: (r) => `${r.lapS.toFixed(2)} s · ${r.driverless.missed} cones · ${r.powerInRange}/5 V`,
  World: FsaeWorld,
  Properties: FsaeProperties,
  CardArt: FsaeArt,
}
