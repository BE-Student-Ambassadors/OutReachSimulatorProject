import type { AnyScenario } from '../core/scenario'
import { arenaBuilderScenario } from './arena-builder'
import { battlebotScenario } from './battlebots'
import { cyberlockScenario } from './cyberlock'
import { fsaeScenario } from './fsae'
import { rocketScenario } from './rocket'

/**
 * Scenarios shown on the start screen. Add new modules here.
 * Flooded Campus (`./flood`) is hidden for now; add `floodScenario` back to show it.
 * Arena Game Builder and CyberLock are hidden in production builds (still available in `npm run dev`).
 */
const devOnlyScenarios: AnyScenario[] = import.meta.env.DEV
  ? [arenaBuilderScenario, cyberlockScenario]
  : []

export const scenarios: AnyScenario[] = [
  fsaeScenario,
  rocketScenario,
  battlebotScenario,
  ...devOnlyScenarios,
]
