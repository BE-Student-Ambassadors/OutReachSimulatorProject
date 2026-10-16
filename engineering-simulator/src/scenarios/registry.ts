import type { AnyScenario } from '../core/scenario'
import { battlebotScenario } from './battlebots'
import { floodScenario } from './flood'
import { rocketScenario } from './rocket'
import { trafficScenario } from './traffic'

/** Scenarios shown on the start screen. Add new modules here. */
export const scenarios: AnyScenario[] = [
  floodScenario,
  trafficScenario,
  rocketScenario,
  battlebotScenario,
]
