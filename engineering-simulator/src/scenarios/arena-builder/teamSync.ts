import type { DesignObject } from '../../core/scenario'
import { normalizeGameProject } from './data/initialProject'
import type { TeamGameProject } from './types/project'

export const ARENA_PART_KEYS = ['hero', 'boss', 'arena', 'balance', 'qa', 'meta'] as const
export type ArenaPartKey = (typeof ARENA_PART_KEYS)[number]

export interface ArenaBuilderPartObject extends DesignObject {
  id: `ab:${ArenaPartKey}`
  kind: 'abPart'
  part: ArenaPartKey
  data: unknown
  updatedAt: number
}

export function projectFromDesign(design: DesignObject[]): TeamGameProject {
  const raw: Partial<TeamGameProject> = {}

  for (const o of design) {
    if (o.kind !== 'abPart') continue
    const p = o as ArenaBuilderPartObject
    if (p.part === 'hero') raw.hero = p.data as TeamGameProject['hero']
    else if (p.part === 'boss') raw.boss = p.data as TeamGameProject['boss']
    else if (p.part === 'arena') raw.arena = p.data as TeamGameProject['arena']
    else if (p.part === 'balance') raw.balance = p.data as TeamGameProject['balance']
    else if (p.part === 'qa') raw.qa = p.data as TeamGameProject['qa']
    else if (p.part === 'meta') {
      const meta = (p.data ?? {}) as Partial<TeamGameProject>
      if (meta.studioName) raw.studioName = meta.studioName
      if (meta.gameTitle) raw.gameTitle = meta.gameTitle
      if (meta.roleCompletion) raw.roleCompletion = meta.roleCompletion
      if (meta.playtestHistory) raw.playtestHistory = meta.playtestHistory
      if (typeof meta.published === 'boolean') raw.published = meta.published
      if (meta.activeBugChallengeId) raw.activeBugChallengeId = meta.activeBugChallengeId
      if (meta.activeViewMode) raw.activeViewMode = meta.activeViewMode
    }
  }

  return normalizeGameProject(raw)
}

export function hasProject(design: DesignObject[]): boolean {
  return design.some((o) => o.kind === 'abPart')
}

const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function withPart<K extends ArenaPartKey>(
  design: DesignObject[],
  part: K,
  data: unknown,
): DesignObject[] {
  const id = `ab:${part}` as const
  const prev = design.find((o) => o.id === id) as ArenaBuilderPartObject | undefined
  const obj: ArenaBuilderPartObject = {
    id,
    kind: 'abPart',
    part,
    data: plain(data),
    updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1),
  }
  return prev ? design.map((o) => (o.id === id ? obj : o)) : [...design, obj]
}

export function withProject(design: DesignObject[], project: TeamGameProject): DesignObject[] {
  let cur = withPart(design, 'hero', project.hero)
  cur = withPart(cur, 'boss', project.boss)
  cur = withPart(cur, 'arena', project.arena)
  cur = withPart(cur, 'balance', project.balance)
  cur = withPart(cur, 'qa', project.qa)
  cur = withPart(cur, 'meta', {
    studioName: project.studioName,
    gameTitle: project.gameTitle,
    roleCompletion: project.roleCompletion,
    playtestHistory: project.playtestHistory,
    published: project.published,
    activeViewMode: project.activeViewMode,
  })
  return cur
}
