import type { AnyScenario } from '../core/scenario'
import { battlebotScenario } from './battlebots'
import { fsaeScenario } from './fsae'
import { rocketScenario } from './rocket'

/**
 * Scenarios shown on the start screen. Add new modules here.
 * Flooded Campus (`./flood`) is hidden for now; add `floodScenario` back to show it.
 */
export const scenarios: AnyScenario[] = [
  fsaeScenario,
  rocketScenario,
  battlebotScenario,
]
