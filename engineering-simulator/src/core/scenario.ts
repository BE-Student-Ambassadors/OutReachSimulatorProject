import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * The contract between the shared shell (layout, toolbox, budget, undo, run
 * controls, results) and a scenario module. The shell never imports anything
 * scenario-specific; everything it needs comes through this interface.
 */

/** How a tool is put onto the world. The World component interprets it. */
export type PlacementMode = 'point' | 'footprint' | 'path' | 'paint' | 'link'

export interface ToolDef {
  id: string
  label: string
  icon: LucideIcon
  /** Hex color used for the tool tile and placed objects. */
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
  /** Short name for the success checklist, e.g. "Buildings Protected". */
  passLabel: string
  /** e.g. "≤ 2.0 in" */
  target: string
  status(result: R | null, cost: number): RequirementStatus
}

/** A running test. The shell steps it; the World renders it. */
export interface SimRun<R> {
  step(): boolean
  readonly done: boolean
  /** 0..1 */
  readonly progress: number
  /** 0..1, how intense the event currently is (drives sky/rain/shake effects). */
  readonly intensity: number
  readonly totalTicks: number
  result(): R
}

export interface Variant {
  id: string
  label: string
  /** One line shown under the button, e.g. "+50% rainfall". */
  blurb: string
  /** Locked until the team has passed the first variant. */
  requiresPass?: boolean
}

export interface Stat {
  label: string
  value: string
}

export interface WorldProps<O extends DesignObject, R> {
  design: O[]
  activeTool: string | null
  selectedId: string | null
  locked: boolean
  debug: boolean
  /** The live test, if one is running or just finished. */
  run: SimRun<R> | null
  /** Most recent completed result (for diagnostic overlays). */
  lastResult: R | null
  showOverlay: boolean
  /** Commit a new design (one undo step). */
  onCommit(next: O[], selectId?: string | null): void
  onSelect(id: string | null): void
  /** The active tool finished its placement. */
  onToolDone(): void
}

export interface PropertiesProps<O extends DesignObject> {
  object: O
  design: O[]
  locked: boolean
  onChange(next: O): void
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
  variants: Variant[]
  tools: ToolDef[]
  requirements: Requirement<R>[]
  initialDesign(): O[]
  cost(design: O[]): number
  /** Remove an object and anything that depends on it. */
  remove(design: O[], id: string): O[]
  createRun(design: O[], variantId: string): SimRun<R>
  /** Factual observations about a result. Never advice. */
  observations(result: R): string[]
  stats(result: R, design: O[]): Stat[]
  /** Short numeric summary for the test log, e.g. "1.2 in · 91%". */
  summary(result: R): string
  World: ComponentType<WorldProps<O, R>>
  Properties: ComponentType<PropertiesProps<O>>
  overlayLabel?: string
}

// Scenarios are heterogeneous; the shell treats their object/result types opaquely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyScenario = Scenario<any, any>
