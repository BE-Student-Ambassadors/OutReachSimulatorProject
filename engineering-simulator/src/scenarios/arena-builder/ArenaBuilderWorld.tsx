import { useEffect, useMemo, useRef } from 'react'
import type { DesignObject, WorldProps } from '../../core/scenario'
import { ArenaBuilderApp } from './ArenaBuilderApp'
import { createInitialGameProject, normalizeGameProject } from './data/initialProject'
import type { ArenaBuilderObject, ArenaBuilderResult } from './index'
import {
  hasProject,
  projectFromDesign,
  withPart,
  withProject,
  type ArenaPartKey,
} from './teamSync'
import type { TeamGameProject } from './types/project'

const SOLO_KEY = 'besa_arena_builder_project'

export function ArenaBuilderWorld({
  design,
  locked,
  onCommit,
  sync,
}: WorldProps<ArenaBuilderObject, ArenaBuilderResult>) {
  const project = useMemo(() => projectFromDesign(design), [design])
  const latest = useRef<DesignObject[]>(design)

  useEffect(() => {
    latest.current = design
  }, [design])

  const commit = (next: DesignObject[]) => {
    latest.current = next
    onCommit(next as ArenaBuilderObject[], null)
  }

  // Solo persistence
  const solo = !sync
  useEffect(() => {
    if (!solo || hasProject(latest.current)) return
    try {
      const rawSaved = localStorage.getItem(SOLO_KEY)
      if (rawSaved) {
        const parsed = JSON.parse(rawSaved) as unknown
        if (parsed && typeof parsed === 'object') {
          const normalized = normalizeGameProject(parsed as Partial<TeamGameProject>)
          commit(withProject(latest.current, normalized))
        }
      }
    } catch {
      // storage unavailable
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solo])

  useEffect(() => {
    if (!solo || !hasProject(design)) return
    try {
      localStorage.setItem(SOLO_KEY, JSON.stringify(project))
    } catch {
      // storage unavailable
    }
  }, [solo, design, project])

  const updatePart = <K extends ArenaPartKey>(part: K, data: unknown) => {
    if (locked) return
    commit(withPart(latest.current, part, data))
  }

  const resetProject = () => {
    if (locked) return
    commit(withProject(latest.current, createInitialGameProject()))
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      <ArenaBuilderApp
        project={project}
        onUpdatePart={updatePart}
        onResetProject={resetProject}
      />
    </div>
  )
}
