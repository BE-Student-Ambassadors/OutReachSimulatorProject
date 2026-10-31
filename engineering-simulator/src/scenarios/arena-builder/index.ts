import { Gamepad2 } from 'lucide-react'
import type { Scenario, SimRun } from '../../core/scenario'
import { ArenaBuilderCardArt } from './CardArt'
import { ArenaBuilderWorld } from './ArenaBuilderWorld'

export interface ArenaBuilderObject {
  id: string
  kind: string
}

export interface ArenaBuilderResult {
  won: boolean
}

class ArenaBuilderSimRun implements SimRun<ArenaBuilderResult> {
  readonly totalTicks = 1
  readonly intensity = 0.5
  readonly done = true
  readonly progress = 1
  step() {
    return false
  }
  result(): ArenaBuilderResult {
    return { won: true }
  }
}

function DummyProperties() {
  return null
}

export const arenaBuilderScenario: Scenario<ArenaBuilderObject, ArenaBuilderResult> = {
  id: 'arena-builder',
  title: 'Arena Game Builder',
  discipline: 'Game Design + Software Engineering',
  tagline: 'Collaborate as a 4-person game studio: design a hero, program boss AI, build an arena, balance combat, and publish a playable game.',
  intro: {
    heading: 'BESA Arena Game Builder',
    paragraphs: [
      'Welcome to the game development studio! Your team will build a complete top-down 2D boss battle.',
      'Four collaborative roles: Gameplay Designer (creates the hero under a power budget), Programmer (assembles boss state machine AI), Arena Designer (builds the battlefield layout), and Producer (balances combat and tests fairness).',
      'Experiment through rapid playtesting, observe empirical telemetry, and publish your finished game!',
    ],
  },
  instructions: [
    'Design your hero with a weapon and ability within the 100 pt power budget.',
    'Program the boss finite-state machine with readable windups and vulnerability recovery.',
    'Construct the battlefield grid and ensure paths connect between spawns.',
    'Enter the arena, battle the boss, inspect combat metrics, and publish your game!',
  ],
  budget: 100,
  minimalShell: true,
  runLabel: 'Playtest Combat',
  variants: [
    { id: 'standard', label: 'Custom Boss Battle', blurb: 'Collaborative 2D arena game design' },
  ],
  tools: [
    {
      id: 'game',
      label: 'Game Studio',
      icon: Gamepad2,
      accent: '#8b5cf6',
      priceLabel: '100 pts max',
      summary: 'Design hero, boss behavior, arena layout, and balance combat.',
      placement: 'point',
    },
  ],
  requirements: [
    {
      id: 'powerBudget',
      label: 'Hero Power Budget',
      passLabel: 'Budget Balanced',
      target: '≤ 100 pts',
      status: () => ({ value: '100 pts max', pass: true }),
    },
    {
      id: 'bossAi',
      label: 'Boss AI Cycle',
      passLabel: 'AI FSM Valid',
      target: 'No deadlocks',
      status: () => ({ value: 'Passed', pass: true }),
    },
    {
      id: 'arenaReachability',
      label: 'Arena Reachability',
      passLabel: 'Path Clear',
      target: 'Reachable',
      status: () => ({ value: 'Clear', pass: true }),
    },
  ],
  initialDesign: () => [],
  cost: () => 0,
  remove: (d) => d,
  createRun: () => new ArenaBuilderSimRun(),
  observations: () => ['Review your combat telemetry and refine your game design in the studio.'],
  stats: () => [
    { label: 'Power Budget', value: '100 pts' },
    { label: 'Arena Size', value: '16 × 12' },
  ],
  summary: () => 'Playable 2D Boss Battle',
  World: ArenaBuilderWorld,
  Properties: DummyProperties,
  CardArt: ArenaBuilderCardArt,
}
