import type { AnyScenario } from '../core/scenario'
import { floodScenario } from './flood'
import { trafficScenario } from './traffic'

/** Scenarios shown on the start screen. Add new modules here. */
export const scenarios: AnyScenario[] = [floodScenario, trafficScenario]
