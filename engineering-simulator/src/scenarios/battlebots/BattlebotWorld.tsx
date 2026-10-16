import type { WorldProps } from '../../core/scenario'
import { BattlebotApp } from './BattlebotApp'
import type { BattlebotObject, BattlebotResult } from './index'

export function BattlebotWorld(_: WorldProps<BattlebotObject, BattlebotResult>) {
  void _
  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      <BattlebotApp />
    </div>
  )
}
