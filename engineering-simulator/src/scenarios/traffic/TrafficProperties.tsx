import { money } from '../../core/format'
import type { PropertiesProps } from '../../core/scenario'
import { objectCost } from './cost'
import type { TrafficObject } from './types'

/** Minimal for now: cost only. Phase 3 adds per-kind details and the signal split. */
export function TrafficProperties({ object }: PropertiesProps<TrafficObject>) {
  return (
    <div className="flex items-baseline justify-between gap-3 pt-2">
      <span className="text-sm font-semibold text-ink">Cost</span>
      <span className="font-mono text-base font-semibold text-ink">{money(objectCost(object))}</span>
    </div>
  )
}
