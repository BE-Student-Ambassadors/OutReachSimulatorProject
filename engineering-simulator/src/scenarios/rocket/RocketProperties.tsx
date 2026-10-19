import type { PropertiesProps } from '../../core/scenario'
import type { RocketObject } from './types'

/** The rocket stations are full-screen workspaces, so the shell's properties panel has nothing to show. */
export function RocketProperties(props: PropertiesProps<RocketObject>) {
  void props
  return null
}
