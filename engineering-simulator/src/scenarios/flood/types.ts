/** Objects students can place on the campus. Coordinates are in grid cells. */

export type Size3 = 'small' | 'medium' | 'large'
export type Size2 = 'small' | 'large'
export type Pt = { x: number; y: number }

export type DrainObj = { id: string; kind: 'drain'; x: number; y: number }
/** Connects a drain to another drain, a pond, or an outlet (by id). */
export type PipeObj = { id: string; kind: 'pipe'; from: string; to: string; size: Size3 }
export type ChannelObj = { id: string; kind: 'channel'; points: Pt[] }
export type PondObj = { id: string; kind: 'pond'; x: number; y: number; size: Size3 }
export type RainGardenObj = { id: string; kind: 'rainGarden'; x: number; y: number }
/** Cell indices converted to permeable pavement. */
export type PermeableObj = { id: string; kind: 'permeable'; cells: number[] }
export type PumpObj = { id: string; kind: 'pump'; x: number; y: number; size: Size2; out: Pt }
export type BarrierObj = { id: string; kind: 'barrier'; points: Pt[] }
export type TreeObj = { id: string; kind: 'tree'; x: number; y: number }

export type FloodObject =
  | DrainObj
  | PipeObj
  | ChannelObj
  | PondObj
  | RainGardenObj
  | PermeableObj
  | PumpObj
  | BarrierObj
  | TreeObj

export type FloodKind = FloodObject['kind']
