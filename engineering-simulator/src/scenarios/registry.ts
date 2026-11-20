import type { AnyScenario } from '../core/scenario'
import { arenaBuilderScenario } from './arena-builder'
import { battlebotScenario } from './battlebots'
import { cyberlockScenario } from './cyberlock'
import { floodScenario } from './flood'
import { fsaeScenario } from './fsae'
import { rocketScenario } from './rocket'

/**
 * Scenarios shown on the start screen.
 * All outreach challenges are available for both development and production.
 */
export const scenarios: AnyScenario[] = [
  fsaeScenario,
  rocketScenario,
  battlebotScenario,
  cyberlockScenario,
  arenaBuilderScenario,
  floodScenario,
]
