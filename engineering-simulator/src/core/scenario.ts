import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * The contract between the shared shell (layout, toolbox, budget, undo, run
 * controls, results) and a scenario module. The shell never imports anything
 * scenario-specific; everything it needs comes through this interface.
 */

/** How a tool is put onto the world. The World component interprets it. */
export type PlacementMode = 'point' | 'footprint' | 'path' | 'paint'

export interface ToolDef {
  id: string
  label: string
  icon: LucideIcon
  /** Tailwind-friendly hex color used for the tool tile and placed objects. */
  accent: string
  /** Short price text for the toolbox, e.g. "$5,000" or "$60 / ft". */
  priceLabel: string
  /** One factual line about what it does. Never a hint about where to put it. */
  summary: string
  placement: PlacementMode
}

/** Every placed object has an id and a kind (the tool id that made it). */
export interface DesignObject {
  id: string
  kind: string
}

export interface RequirementStatus {
  /** Display value, or null when there is no data yet (e.g. before the first test). */
  value: string | null
  pass: boolean | null
}

export interface Requirement<R> {
  id: string
  label: string
  /** e.g. "≤ 2.0 in" */
  target: string
  status(result: R | null, cost: number): RequirementStatus
}

export interface WorldProps<O extends DesignObject> {
  design: O[]
  activeTool: string | null
  selectedId: string | null
  locked: boolean
  debug: boolean
  /** Commit a new design (one undo step). */
  onCommit(next: O[], selectId?: string | null): void
  onSelect(id: string | null): void
}

export interface Scenario<O extends DesignObject, R> {
  id: string
  title: string
  discipline: string
  tagline: string
  intro: { heading: string; paragraphs: string[] }
  instructions: string[]
  budget: number
  runLabel: string
  tools: ToolDef[]
  requirements: Requirement<R>[]
  initialDesign(): O[]
  cost(design: O[]): number
  World: ComponentType<WorldProps<O>>
}

// Scenarios are heterogeneous; the shell treats their object/result types opaquely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyScenario = Scenario<any, any>
