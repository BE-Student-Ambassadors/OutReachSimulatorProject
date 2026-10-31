import type { ArenaLayout, TileType } from '../types/project'

export const ARENA_COLS = 16
export const ARENA_ROWS = 12
export const TILE_SIZE = 48 // px per tile (16 * 48 = 768px wide, 12 * 48 = 576px high)

export interface TileSpec {
  type: TileType
  name: string
  description: string
  blocksMovement: boolean
  blocksProjectiles: boolean
  dealsDamage: boolean
  color: string
  borderColor: string
}

export const TILE_SPECS: Record<TileType, TileSpec> = {
  empty: {
    type: 'empty',
    name: 'Arena Floor',
    description: 'Walkable floor tile for open combat and movement.',
    blocksMovement: false,
    blocksProjectiles: false,
    dealsDamage: false,
    color: '#1e293b', // slate-800
    borderColor: '#334155',
  },
  wall: {
    type: 'wall',
    name: 'Reinforced Wall',
    description: 'Impassable barrier. Blocks both character movement and projectile attacks.',
    blocksMovement: true,
    blocksProjectiles: true,
    dealsDamage: false,
    color: '#090d16',
    borderColor: '#475569',
  },
  cover: {
    type: 'cover',
    name: 'Half-Cover Barrier',
    description: 'Tactical cover pillar. Blocks blaster shots, but players and boss can walk around it.',
    blocksMovement: true,
    blocksProjectiles: true,
    dealsDamage: false,
    color: '#1e3a8a', // blue-900
    borderColor: '#3b82f6',
  },
  hazard: {
    type: 'hazard',
    name: 'Plasma Lava Floor',
    description: 'Hazardous environmental tile. Deals 8 damage/sec to any unit standing on it.',
    blocksMovement: false,
    blocksProjectiles: false,
    dealsDamage: true,
    color: '#7f1d1d', // red-900
    borderColor: '#ef4444',
  },
}

export function createEmptyArenaLayout(): ArenaLayout {
  const tiles: TileType[][] = []
  for (let r = 0; r < ARENA_ROWS; r++) {
    const row: TileType[] = []
    for (let c = 0; c < ARENA_COLS; c++) {
      if (r === 0 || r === ARENA_ROWS - 1 || c === 0 || c === ARENA_COLS - 1) {
        row.push('wall')
      } else {
        row.push('empty')
      }
    }
    tiles.push(row)
  }
  return {
    cols: ARENA_COLS,
    rows: ARENA_ROWS,
    tiles,
    playerSpawn: { col: 2, row: 6 },
    bossSpawn: { col: 13, row: 6 },
    hasTestedWalk: false,
  }
}

/**
 * Deliberately flawed starter arena layout for the Level Design challenge:
 * - A wall barrier that blocks direct pathing across the center
 * - A hazardous lava tile right next to the player spawn
 * Students must investigate, remove the impassable block, relocate/rebalance hazards, and test.
 */
export function createFlawedStarterArenaLayout(): ArenaLayout {
  const layout = createEmptyArenaLayout()
  const { tiles } = layout

  // Deliberate flaw 1: Hazardous tiles adjacent to player spawn (spawn is at col: 3, row: 6)
  tiles[6][4] = 'hazard'
  tiles[5][3] = 'hazard'

  // Deliberate flaw 2: Blocked vertical wall completely dividing the arena
  for (let r = 1; r <= 10; r++) {
    tiles[r][8] = 'wall'
  }

  // Tactical cover
  tiles[3][5] = 'cover'
  tiles[8][5] = 'cover'
  tiles[3][11] = 'cover'
  tiles[8][11] = 'cover'

  // Corner hazards
  tiles[2][12] = 'hazard'
  tiles[9][12] = 'hazard'

  return layout
}

/** Clean balanced starter arena */
export function createStarterArenaLayout(): ArenaLayout {
  const layout = createEmptyArenaLayout()
  const { tiles } = layout

  // Tactical pillars (cover)
  tiles[3][6] = 'cover'
  tiles[3][9] = 'cover'
  tiles[8][6] = 'cover'
  tiles[8][9] = 'cover'

  // Outer hazard zones
  tiles[2][2] = 'hazard'
  tiles[2][3] = 'hazard'
  tiles[9][12] = 'hazard'
  tiles[9][13] = 'hazard'

  // Barrier walls creating tactical chokepoints with clear routes around
  tiles[5][7] = 'wall'
  tiles[6][8] = 'wall'

  return layout
}
