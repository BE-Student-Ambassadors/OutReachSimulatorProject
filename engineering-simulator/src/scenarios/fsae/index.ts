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
  for (const p of r.power) {
    if (p.open) out.push(`The ${p.label.toLowerCase()} wire was cut and not closed again: nothing reached it.`)
    else if (p.loose) out.push(`The ${p.label.toLowerCase()} splice sits next to moving parts and its crimp shook loose on the lap: ${p.volts} V on average.`)
  }
  const off = r.power.filter((p) => p.state !== 'ok' && !p.open)
  if (off.length) out.push(`Out of range on the lap: ${off.map((p) => `${p.label} ${p.volts} V (${p.lo}–${p.hi})`).join(', ')}.`)
  const loose = r.power.filter((p) => !p.tied)
  if (loose.length) out.push(`Wiring not tied down at inspection: ${loose.map((p) => p.label.toLowerCase()).join(', ')}.`)
  const d = r.driverless
  if (!d.finished) out.push(`Driverless lap: did not finish. ${d.dnf}`)
  else {
    out.push(
      `Driverless lap: ${d.lapS.toFixed(2)} s, ${d.conesHit} cone${d.conesHit === 1 ? '' : 's'} hit. Fastest ${count(d.topMph)} mph, slowest ${count(d.slowestMph)} mph.` +
        ` Closest planned gap between the car and a cone: ${d.minGapM.toFixed(2)} m.`,
    )
    if (d.sightLimitedShare > 0.02)
      out.push(`For ${Math.round(d.sightLimitedShare * 100)}% of the driverless lap the car went slower than its tires allowed, to be able to stop within what its sensors could see (${Math.round(d.sightM)} m on open stretches).`)
    if (d.colorHits)
      out.push(
        d.colorBy === 'none'
          ? `Nothing on the car could tell yellow cones from orange ones: the car mixed up the edges of the course ${d.colorHits} times.`
          : `The LiDAR read ${Math.round((d.ruleAccuracy ?? 0) * 100)}% of cone colors right; the car steered toward the wrong edge ${d.colorHits} times.`,
      )
    out.push(
      d.planner === 3
        ? 'The path planner’s code cleared all 3 graph courses: it drove a full racing line and held it steadily.'
        : d.planner === 2
          ? 'The path planner’s code cleared 2 of 3 graph courses: it cut only some of the corners, used less of the tires’ grip and wobbled a little.'
          : 'The path planner’s code cleared 1 of 3 graph courses: it crawled down the middle of the course and wobbled.',
    )
    if (d.rebootHits) out.push(`The driverless computer was under-powered and rebooted on the lap: ${d.rebootHits} cones hit while it was restarting.`)
    if (!d.wheel) out.push('No wheel-speed sensor was working: the car estimated how far it had gone from the motor alone.')
  }
  out.push(r.fundsPass ? `The car cost ${money(r.cost)}; the team had ${money(r.funds)}.` : `The car cost ${money(r.cost)} but the team only had ${money(r.funds)}.`)
  return out
}

export const fsaeScenario: Scenario<FsaeObject, FsaeResult> = {
  id: 'fsae',
  title: 'Formula SAE',
  discipline: 'Mechanical + Electrical + Software + Business',
  tagline: 'A team of four builds a race car: frame and wings, the wiring harness, a self-driving line, and a paint job sponsors will pay for. Then everyone races it.',
  intro: {
    heading: 'BUILD A RACE CAR',
    paragraphs: [
      'Formula SAE is a real competition where university engineering students design, build and race their own small race car. Yours is a single-seat electric car: a welded steel-tube frame, a battery-powered motor driving the rear wheels, wings that use the air to press the tires onto the road, and a computer with sensors that lets it drive itself.',
      'Your team of four has one car to finish. The mechanical engineer welds the frame, picks the wings and sizes the car. The electrical engineer gets the right voltage to the motor and the self-driving computer and fits the sensors. The software engineer programs the path the car drives by itself. The business lead wins sponsor deals, because the school’s money won’t cover the whole car.',
      `To compete, the car must pass four tests: lap the autocross course (a twisty course marked with cones) in ${REQUIRED.maxLapS} s or less; drive itself around in ${REQUIRED.maxDriverlessS} s or less, hitting no more than ${REQUIRED.maxConesHit} cones; pass wiring inspection; and be paid for.`,
      'Then everyone on the team gets to drive it on Race Day.',
    ],
  },
  instructions: [
    'Open your job’s tab at the top. Each station has a Guide button explaining what the job is, the steps, and what every option means.',
    'Work through the checklist under the tabs. It ticks itself off as you go.',
    'Open Test & Race Day and run a Competition Test any time. It checks all four requirements and lists what happened.',
    'Change things and test again. There’s no single right car; very different designs can pass.',
    'When the car is ready, start a race heat and drive the car you built.',
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
      label: 'Driverless lap',
      passLabel: 'Drives itself',
      target: `≤ ${REQUIRED.maxDriverlessS} s, ≤ ${REQUIRED.maxConesHit} cones`,
      status: (r) => (r ? { value: r.driverless.finished ? `${r.driverless.lapS.toFixed(1)} s · ${r.driverless.conesHit} cones` : 'DNF', pass: r.driverlessPass } : { value: null, pass: null }),
    },
    {
      id: 'power',
      label: 'Wiring passes inspection',
      passLabel: 'Wired right',
      target: 'Both wires in range, tied down',
      status: (r) => (r ? { value: `${r.powerReady} of ${r.power.length}`, pass: r.powerPass } : { value: null, pass: null }),
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
    { label: 'Driverless lap', value: r.driverless.finished ? `${r.driverless.lapS.toFixed(2)} s` : 'DNF' },
  ],
  summary: (r) => `${r.lapS.toFixed(2)} s · driverless ${r.driverless.finished ? `${r.driverless.lapS.toFixed(1)} s, ${r.driverless.conesHit} cones` : 'DNF'} · ${r.powerReady}/${r.power.length} wired`,
  World: FsaeWorld,
  Properties: FsaeProperties,
  CardArt: FsaeArt,
}
