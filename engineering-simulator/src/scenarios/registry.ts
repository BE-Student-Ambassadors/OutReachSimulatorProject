import type { AnyScenario } from '../core/scenario'
import { battlebotScenario } from './battlebots'
import { floodScenario } from './flood'
import { fsaeScenario } from './fsae'
import { rocketScenario } from './rocket'

/** Scenarios shown on the start screen. Add new modules here. */
export const scenarios: AnyScenario[] = [
  floodScenario,
  fsaeScenario,
  rocketScenario,
  battlebotScenario,
]
