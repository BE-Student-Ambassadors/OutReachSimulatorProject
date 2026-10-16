import type { WorldProps } from '../../core/scenario'
import { BattlebotApp } from './BattlebotApp'

export function BattlebotWorld(_props: WorldProps<any, any>) {
  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      <BattlebotApp />
    </div>
  )
}
