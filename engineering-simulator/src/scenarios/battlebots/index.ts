import { Swords } from 'lucide-react'
import type { Scenario, SimRun } from '../../core/scenario'
import { BattlebotWorld } from './BattlebotWorld'
import { BattlebotProperties } from './BattlebotProperties'
import { BattlebotCardArt } from './CardArt'

export interface BattlebotObject {
  id: string
  kind: string
}

export interface BattlebotResult {
  won: boolean
}

class BattlebotSimRun implements SimRun<BattlebotResult> {
  readonly totalTicks = 1
  readonly intensity = 0.5
  readonly done = true
  readonly progress = 1
  step() {
    return false
  }
  result(): BattlebotResult {
    return { won: true }
  }
}

export const battlebotScenario: Scenario<BattlebotObject, BattlebotResult> = {
  id: 'battlebots',
  title: 'Battlebot Incubator',
  discipline: 'Robotics + Mechanical Engineering',
  tagline: 'Engineer a combat robot under a 30.0 lb limit, scout the boss, test subsystems, and enter the arena.',
  intro: {
    heading: 'Battlebot Incubator V2',
    paragraphs: [
      'Welcome to the combat robotics workshop! Your mission is to build an autonomous combat robot under a strict 30.0 lb weight constraint.',
      'Scout "The Bull" boss robot, make engineering tradeoffs between weapon power, armor, traction, and drive speed.',
      'Test your weapon recoil and drivetrain in the Test Lab, then watch your robot fight autonomously in the 3D arena.',
    ],
  },
  instructions: [
    'Choose your weapon type and build the chassis, armor, and drivetrain around it.',
    'Keep your robot under the 30.0 lb weight limit (overweight robots cannot enter the arena).',
    'Use the Test Lab to evaluate weapon recoil, gyro stability, and top speed.',
    'Enter the arena and watch your robot fight The Bull autonomously!',
  ],
  budget: 30, // 30.0 lbs constraint
  minimalShell: true,
  runLabel: 'Enter Arena',
  variants: [
    { id: 'standard', label: 'The Bull Boss Battle', blurb: '30 lb autonomous combat arena' },
  ],
  tools: [
    {
      id: 'robot',
      label: 'Combat Robot',
      icon: Swords,
      accent: '#22d3ee',
      priceLabel: '30.0 lb max',
      summary: 'Design weapon, armor thickness, drivetrain, chassis, and battery.',
      placement: 'point',
    },
  ],
  requirements: [
    {
      id: 'weight',
      label: 'Weight Limit',
      passLabel: 'Legal Combat Weight',
      target: '≤ 30.0 lb',
      status: () => ({ value: '30.0 lb', pass: true }),
    },
  ],
  initialDesign: () => [],
  cost: () => 0,
  remove: (d) => d,
  createRun: () => new BattlebotSimRun(),
  observations: () => ['Evaluate your battle telemetry and refine your robot in the workshop.'],
  stats: () => [
    { label: 'Weight Limit', value: '30.0 lb' },
    { label: 'Boss Combatant', value: 'The Bull' },
  ],
  summary: () => 'Autonomous Combat Arena',
  World: BattlebotWorld,
  Properties: BattlebotProperties,
  CardArt: BattlebotCardArt,
}
