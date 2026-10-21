import type { RoleSplit } from '../../core/roles'
import type { DesignObject } from '../../core/scenario'
import { createInitialTeamProject } from './data/teamData'
import type { TeamRobotProject, TeamRole } from './types/robot'

/**
 * The team's robot project as design objects, so the shell can sync it across a group like any
 * other scenario's design. Each discipline is its own object: teammates working on different
 * disciplines at the same time merge cleanly (the newer `updatedAt` wins per object).
 */

export const PART_KEYS = ['mechanical', 'electrical', 'software', 'projectLead'] as const
export type PartKey = (typeof PART_KEYS)[number]

export const TEAM_ROLES: TeamRole[] = ['mechanical', 'electrical', 'software', 'project-lead']

export interface BattlebotPartObject extends DesignObject {
  id: `bb:${PartKey}`
  kind: 'bbPart'
  part: PartKey
  data: unknown
  updatedAt: number
}

const INITIAL = createInitialTeamProject()

/** The project from the design; disciplines nobody has touched yet use the starting setup. */
export function projectFromDesign(design: DesignObject[]): TeamRobotProject {
  const project = { ...INITIAL }
  for (const o of design) {
    if (o.kind !== 'bbPart') continue
    const p = o as BattlebotPartObject
    if ((PART_KEYS as readonly string[]).includes(p.part)) (project as Record<PartKey, unknown>)[p.part] = p.data
  }
  if (project.projectLead.teamName) project.teamName = project.projectLead.teamName
  return project
}

export function hasProject(design: DesignObject[]): boolean {
  return design.some((o) => o.kind === 'bbPart')
}

/** Firestore rejects `undefined` fields; a JSON round trip drops them (the configs are plain data). */
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function withPart<K extends PartKey>(design: DesignObject[], part: K, data: TeamRobotProject[K]): DesignObject[] {
  const id = `bb:${part}` as const
  const prev = design.find((o) => o.id === id) as BattlebotPartObject | undefined
  const obj: BattlebotPartObject = { id, kind: 'bbPart', part, data: plain(data), updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1) }
  return prev ? design.map((o) => (o.id === id ? obj : o)) : [...design, obj]
}

/** Every discipline set to `project` (a reset, or loading a saved solo project). */
export function withProject(design: DesignObject[], project: TeamRobotProject): DesignObject[] {
  return PART_KEYS.reduce((d, k) => withPart(d, k, project[k]), design)
}

/** Multiplayer only: who does which job, and this player's picks. */
export interface BattlebotTeam {
  me: string
  size: number
  split: RoleSplit<TeamRole>
  myRoles: TeamRole[]
  picks: TeamRole[]
  onTogglePick(role: TeamRole): void
}
