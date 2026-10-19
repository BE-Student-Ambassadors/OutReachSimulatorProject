import {
  Compass,
  Cpu,
  Flame,
  Rocket,
  Scale,
  Shield,
  ShieldCheck,
  Umbrella,
  Wind,
} from 'lucide-react'
import { count, money, uid } from '../../core/format'
import type { Scenario, ToolDef } from '../../core/scenario'
import { RocketArt } from './CardArt'
import {
  AIRFRAME_MATERIALS,
  BUDGET,
  CHUTE_SPECS,
  IMPULSE_CLASSES,
  PAYLOAD_MOTORS,
  PROGRAM_SPECS,
  REQUIRED,
  STATION_COSTS,
  VARIANTS,
} from './config'
import { designCost } from './cost'
import { RocketProperties } from './RocketProperties'
import { RocketRun, type RocketResult } from './sim/engine'
import type { RocketObject, RocketProgramId, RocketVariantId } from './types'
import { RocketWorld } from './world/RocketWorld'

const tools: ToolDef[] = [
  {
    id: 'gyro',
    label: '1. Gyroscope Rig',
    icon: Compass,
    accent: '#0284c7',
    priceLabel: money(STATION_COSTS.gyroCalibration),
    summary: 'Payload Role 1: 3-axis timing calibrator that holds payload orientation during descent.',
    placement: 'point',
  },
  {
    id: 'payloadMotor',
    label: '2. Payload Motor',
    icon: Cpu,
    accent: '#d97706',
    priceLabel: `from ${money(PAYLOAD_MOTORS['micro-gimbal'].cost)}`,
    summary: 'Payload Role 2: Reaction wheel motor providing torque to counter descent spin.',
    placement: 'point',
  },
  {
    id: 'payloadTest',
    label: '3. Payload Drop Rig',
    icon: Umbrella,
    accent: '#b45309',
    priceLabel: `from ${money(CHUTE_SPECS['drogue-small'].cost)}`,
    summary: 'Payload Role 3: Drop test altitude, wind lead angle, and parachute deployment rig.',
    placement: 'point',
  },
  {
    id: 'weightDist',
    label: '4. Rocket Weights',
    icon: Scale,
    accent: '#2c5b3c',
    priceLabel: 'Included',
    summary: 'Rocket Role 4: Internal bay arrangement determining Center of Gravity (CG) stability.',
    placement: 'point',
  },
  {
    id: 'airframe',
    label: '5. Airframe Material',
    icon: Shield,
    accent: '#7c5cbf',
    priceLabel: `from ${money(AIRFRAME_MATERIALS.cardboard.cost)}`,
    summary: 'Rocket Role 5: Airframe structural composite, nose cone shape, and fin geometry.',
    placement: 'point',
  },
  {
    id: 'launchSetup',
    label: '6. Flight Launch Pad',
    icon: Rocket,
    accent: '#b8461b',
    priceLabel: `from ${money(IMPULSE_CLASSES['l-class'].cost)}`,
    summary: 'Rocket Role 6: Solid rocket motor impulse class, rail angle, and nose ballast trim.',
    placement: 'point',
  },
  {
    id: 'program:reefing',
    label: PROGRAM_SPECS.reefing.label,
    icon: Umbrella,
    accent: '#3f7d46',
    priceLabel: money(PROGRAM_SPECS.reefing.cost),
    summary: PROGRAM_SPECS.reefing.summary,
    placement: 'program',
  },
  {
    id: 'program:carbonFins',
    label: PROGRAM_SPECS.carbonFins.label,
    icon: ShieldCheck,
    accent: '#3f7d46',
    priceLabel: money(PROGRAM_SPECS.carbonFins.cost),
    summary: PROGRAM_SPECS.carbonFins.summary,
    placement: 'program',
  },
  {
    id: 'program:windSonde',
    label: PROGRAM_SPECS.windSonde.label,
    icon: Wind,
    accent: '#3f7d46',
    priceLabel: money(PROGRAM_SPECS.windSonde.cost),
    summary: PROGRAM_SPECS.windSonde.summary,
    placement: 'program',
  },
]

/**
 * Strictly factual observations about the flight and payload drop test.
 * Never prescribes a solution.
 */
function observations(r: RocketResult): string[] {
  const out: string[] = []
  const t = r.telemetry

  // Rocket observations
  if (r.mode !== 'payload-only') {
    if (r.rocketOutcome === 'pad-stall') {
      out.push(`The rocket reached only ${count(r.apogeeFt)} ft because the motor nozzle was not positioned at the tail end of the bay stack.`)
    } else if (r.rocketOutcome === 'unstable-tumble') {
      out.push(
        `The rocket tumbled after leaving the launch rail (stability margin was ${t.stabilityCalibers} calibers; CG at ${t.cgCalibers} cal vs CP at ${t.cpCalibers} cal).`,
      )
    } else if (r.rocketOutcome === 'structural-shred') {
      out.push(
        t.weakestPart === 'fins'
          ? `The fins fluttered and tore off at ${count(t.breakupSpeedMph)} mph, ${count(t.breakupAltFt)} ft up, and the rocket broke apart behind them. The motor was still burning and would have pushed it to ${count(t.peakSpeedMph)} mph.`
          : `The airframe tore apart at ${count(t.breakupSpeedMph)} mph, ${count(t.breakupAltFt)} ft up. The motor was still burning and would have pushed it to ${count(t.peakSpeedMph)} mph.`,
      )
    } else {
      out.push(
        `The rocket reached an apogee of ${count(r.apogeeFt)} ft (${count(r.apogeeErrorFt)} ft from the 10,000 ft target), topping out at ${count(t.peakSpeedMph)} mph of its ${count(t.maxSafeSpeedMph)} mph safe speed.`,
      )
    }
  }

  // Payload observations
  if (r.mode !== 'rocket-only') {
    if (r.payloadOutcome === 'splatter') {
      out.push(
        `The payload impacted the ground at ${t.landingSpeedFps} ft/s and shattered into pieces (motor mass: ${t.payloadMotorMassKg} kg, parachute opened at ${count(t.chuteDeployAltFt)} ft).`,
      )
    } else if (r.payloadOutcome === 'spin-motor-weak') {
      out.push(
        `The payload spun out of control during descent (reaction motor produced ${t.payloadMotorTorqueNm} N·m of torque) and landed ${count(r.landingDistFt)} ft from the target pad.`,
      )
    } else if (r.payloadOutcome === 'spin-gyro-uncalibrated') {
      out.push(
        `The payload spun out of control during descent (gyroscope calibration averaged ${t.gyroCalibrationPct}%) and landed ${count(r.landingDistFt)} ft from the target pad.`,
      )
    } else {
      out.push(
        `The payload touched down intact at ${t.landingSpeedFps} ft/s, ${count(r.landingDistFt)} ft from the center of the target pad.`,
      )
    }
  }

  return out
}

export const rocketScenario: Scenario<RocketObject, RocketResult> = {
  id: 'rocket',
  title: 'Rocket Team (IREC)',
  discipline: 'Aerospace + Mechanical + Mechatronics Engineering',
  tagline: '6-engineer team split into Payload & Rocket sub-teams. Hit 10,000 ft and land the payload on target.',
  intro: {
    heading: 'IREC Launch & Payload Recovery',
    paragraphs: [
      'Your 6-person aerospace team is competing at the International Rocketry Engineering Competition (IREC).',
      'Your team splits into two 3-person sub-teams: the Payload Sub-Team (Gyroscope Calibration, Reaction Motor Selection, and Drop Test Rig) and the Rocket Sub-Team (Internal Weight Distribution, Airframe Materials, and Launch Pad Setup).',
      'If the payload motor is too heavy, the payload will splatter into pieces on impact; if the motor is too weak or the gyroscope is uncalibrated, it will spin out of control.',
      'Reach the 10,000 ft target apogee and land your payload intact on the target bullseye within budget.',
    ],
  },
  instructions: [
    'Open Role Picks to rank your 1st & 2nd choice role across Payload and Rocket.',
    'Payload Sub-Team: calibrate the gyroscope, pick the motor, and run the Drop Test.',
    'Rocket Sub-Team: order internal bay weights, pick airframe materials, and test launch.',
    `Stay within your ${money(BUDGET)} team budget.`,
    'Press LAUNCH IREC MISSION to test both sub-teams together.',
  ],
  budget: BUDGET,
  minimalShell: true,
  runLabel: 'Launch IREC Mission',
  variants: [
    { id: 'standard', label: VARIANTS.standard.label, blurb: VARIANTS.standard.blurb },
    { id: 'payload-drop', label: VARIANTS['payload-drop'].label, blurb: VARIANTS['payload-drop'].blurb },
    { id: 'rocket-launch', label: VARIANTS['rocket-launch'].label, blurb: VARIANTS['rocket-launch'].blurb },
    { id: 'crosswind', label: VARIANTS.crosswind.label, blurb: VARIANTS.crosswind.blurb, requiresPass: true },
  ],
  tools,
  requirements: [
    {
      id: 'apogee',
      label: 'Rocket Apogee (10,000 ft)',
      passLabel: 'Apogee Target Reached',
      target: `10,000 ± ${REQUIRED.maxApogeeErrorFt} ft`,
      status: (r) =>
        r
          ? {
              value: `${count(r.apogeeFt)} ft`,
              pass: r.rocketPassed,
            }
          : { value: null, pass: null },
    },
    {
      id: 'payload',
      label: 'Payload Target Landing',
      passLabel: 'Payload Intact on Target',
      target: `Intact, ≤ ${REQUIRED.maxLandingDistFt} ft`,
      status: (r) =>
        r
          ? {
              value: r.payloadIntact
                ? `${count(r.landingDistFt)} ft`
                : r.payloadOutcome === 'splatter'
                  ? 'SPLATTERED'
                  : 'SPUN OUT',
              pass: r.payloadPassed,
            }
          : { value: null, pass: null },
    },
    {
      id: 'budget',
      label: 'Project Cost',
      passLabel: 'Within Budget',
      target: `≤ ${money(BUDGET)}`,
      status: (_r, cost) => ({ value: money(cost), pass: cost <= BUDGET }),
    },
  ],
  initialDesign: () => [],
  cost: designCost,
  remove: (design, id) => design.filter((o) => o.id !== id),
  programs: {
    isOn: (design, toolId) =>
      design.some((o) => o.kind === 'program' && `program:${o.program}` === toolId),
    toggle: (design, toolId) => {
      const program = toolId.replace('program:', '') as RocketProgramId
      const on = design.some((o) => o.kind === 'program' && o.program === program)
      return on
        ? design.filter((o) => !(o.kind === 'program' && o.program === program))
        : [...design, { id: uid('program'), kind: 'program', program, updatedAt: Date.now() }]
    },
  },
  createRun: (design, variantId) => new RocketRun(design, (variantId as RocketVariantId) ?? 'standard'),
  observations,
  stats: (r, design) => [
    { label: 'Total cost', value: money(designCost(design)) },
    { label: 'Rocket apogee', value: `${count(r.apogeeFt)} ft` },
    { label: 'Stability margin', value: `${r.telemetry.stabilityCalibers} cal` },
    { label: 'Peak dynamic pressure', value: `${r.telemetry.peakDynamicPressureKpa} / ${r.telemetry.structuralLimitKpa} kPa` },
    {
      label: 'Top / safe speed',
      value: `${count(r.rocketOutcome === 'structural-shred' ? r.telemetry.breakupSpeedMph : r.telemetry.peakSpeedMph)} / ${count(r.telemetry.maxSafeSpeedMph)} mph`,
    },
    { label: 'Gyroscope calibration', value: `${r.telemetry.gyroCalibrationPct}%` },
    { label: 'Payload motor', value: `${r.telemetry.payloadMotorMassKg} kg · ${r.telemetry.payloadMotorTorqueNm} N·m` },
    { label: 'Landing speed', value: `${r.telemetry.landingSpeedFps} ft/s` },
    { label: 'Target pad distance', value: `${count(r.landingDistFt)} ft` },
  ],
  summary: (r) =>
    `${count(r.apogeeFt)} ft · ${
      r.payloadIntact
        ? `${r.landingDistFt} ft pad`
        : r.payloadOutcome === 'splatter'
          ? 'SPLAT'
          : 'SPIN-OUT'
    }`,
  World: RocketWorld,
  Properties: RocketProperties,
  CardArt: RocketArt,
  overlayLabel: 'Target ring',
  overlayLegend: {
    title: 'IREC Payload Landing Zone (≤ 50 ft radius)',
    colors: ['#dc2626', '#f97316', '#22c55e'],
    range: 'Bullseye → 50 ft boundary',
  },
}

export { Flame }
