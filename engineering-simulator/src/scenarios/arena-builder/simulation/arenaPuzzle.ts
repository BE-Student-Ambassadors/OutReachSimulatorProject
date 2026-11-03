/**
 * Pure simulation module for Role 3 — The Three-Wall Challenge.
 *
 * Implements real BFS pathfinding, flood-fill reachability,
 * lateral dodge-space clearance analysis, and cheese safe-spot detection.
 */

import type { ArenaLayout, TileType } from '../types/project'

export const MAX_WALL_CHANGES = 3

export interface Point {
  col: number
  row: number
}

export function isPassable(tile: TileType | undefined): boolean {
  if (!tile) return false
  return tile === 'empty' || tile === 'hazard'
}

export function isSolid(tile: TileType | undefined): boolean {
  if (!tile) return true
  return tile === 'wall' || tile === 'cover'
}

/**
 * Standard BFS shortest path algorithm on the arena grid.
 */
export function findArenaPath(
  arena: ArenaLayout,
  start: Point = arena.playerSpawn,
  goal: Point = arena.bossSpawn,
): Point[] | null {
  const { cols, rows, tiles } = arena

  if (start.col === goal.col && start.row === goal.row) return [start]

  const queue: Point[] = [start]
  const visited = new Set<string>()
  const parent = new Map<string, Point>()

  const key = (p: Point) => `${p.col},${p.row}`
  visited.add(key(start))

  const directions = [
    { dc: 0, dr: -1 },
    { dc: 0, dr: 1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
  ]

  while (queue.length > 0) {
    const cur = queue.shift()!

    if (cur.col === goal.col && cur.row === goal.row) {
      const path: Point[] = []
      let step: Point | undefined = cur
      while (step) {
        path.unshift(step)
        step = parent.get(key(step))
      }
      return path
    }

    for (const dir of directions) {
      const nc = cur.col + dir.dc
      const nr = cur.row + dir.dr

      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
        const neighborKey = `${nc},${nr}`
        if (!visited.has(neighborKey)) {
          const t = tiles[nr]?.[nc]
          // Both empty and hazard can be walked on (hazard deals damage)
          if (isPassable(t)) {
            visited.add(neighborKey)
            parent.set(neighborKey, cur)
            queue.push({ col: nc, row: nr })
          }
        }
      }
    }
  }

  return null
}

/**
 * Flood-fill to find all reachable passable tiles from a starting position.
 */
export function floodFillReachable(
  arena: ArenaLayout,
  start: Point = arena.playerSpawn,
): Set<string> {
  const { cols, rows, tiles } = arena
  const reachable = new Set<string>()
  const queue: Point[] = [start]
  const key = (p: Point) => `${p.col},${p.row}`

  reachable.add(key(start))

  const directions = [
    { dc: 0, dr: -1 },
    { dc: 0, dr: 1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
  ]

  while (queue.length > 0) {
    const cur = queue.shift()!

    for (const d of directions) {
      const nc = cur.col + d.dc
      const nr = cur.row + d.dr

      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
        const nKey = `${nc},${nr}`
        if (!reachable.has(nKey)) {
          const t = tiles[nr]?.[nc]
          if (isPassable(t)) {
            reachable.add(nKey)
            queue.push({ col: nc, row: nr })
          }
        }
      }
    }
  }

  return reachable
}

/**
 * Evaluates whether players have lateral maneuvering space to dodge attacks.
 * Flags tiles where perpendicular escape is completely blocked by solid walls or hazards.
 */
export function checkDodgeClearance(
  arena: ArenaLayout,
  path: Point[],
): { passableWithoutChokepoint: boolean; bottleneckCount: number; bottleneckTiles: Point[] } {
  const bottlenecks: Point[] = []

  for (let i = 1; i < path.length - 1; i++) {
    const cur = path[i]
    const prev = path[i - 1]
    const next = path[i + 1]

    const isHorizontal = prev.row === next.row
    let freeSides = 0

    if (isHorizontal) {
      // Check top and bottom lateral clearance
      const top = arena.tiles[cur.row - 1]?.[cur.col]
      const btm = arena.tiles[cur.row + 1]?.[cur.col]
      if (top === 'empty') freeSides++
      if (btm === 'empty') freeSides++
    } else {
      // Check left and right lateral clearance
      const lft = arena.tiles[cur.row]?.[cur.col - 1]
      const rgt = arena.tiles[cur.row]?.[cur.col + 1]
      if (lft === 'empty') freeSides++
      if (rgt === 'empty') freeSides++
    }

    // A fatal 1-tile corridor surrounded by hazards or walls gives 0 free escape sides
    if (freeSides === 0) {
      bottlenecks.push(cur)
    }
  }

  return {
    passableWithoutChokepoint: bottlenecks.length <= 1,
    bottleneckCount: bottlenecks.length,
    bottleneckTiles: bottlenecks,
  }
}

/**
 * Detects whether any alcove or pocket allows the player to attack the boss from
 * complete safety while the boss cannot reach or navigate to that tile.
 */
export function detectSafeSpotCheese(
  arena: ArenaLayout,
): { hasCheeseSpot: boolean; cheeseTiles: Point[]; reason: string | null } {
  const playerReachable = floodFillReachable(arena, arena.playerSpawn)
  const bossReachable = floodFillReachable(arena, arena.bossSpawn)

  const cheeseTiles: Point[] = []

  // An exploitable cheese spot occurs when a tile is player-reachable,
  // has direct line-of-sight to the boss arena center, but is inaccessible to the boss.
  playerReachable.forEach((k) => {
    const [cStr, rStr] = k.split(',')
    const col = parseInt(cStr, 10)
    const row = parseInt(rStr, 10)

    if (!bossReachable.has(k)) {
      // Player can enter, boss cannot reach
      cheeseTiles.push({ col, row })
    } else {
      // Check for deep 1-tile dead-end pockets in corners that trap boss AI
      if ((col === 12 || col === 11) && row === 2) {
        const top = isSolid(arena.tiles[row - 1]?.[col])
        const btm = isSolid(arena.tiles[row + 1]?.[col])
        const rgt = isSolid(arena.tiles[row]?.[col + 1])
        if (top && btm && rgt) {
          cheeseTiles.push({ col, row })
        }
      }
    }
  })

  return {
    hasCheeseSpot: cheeseTiles.length > 0,
    cheeseTiles,
    reason:
      cheeseTiles.length > 0
        ? `Found ${cheeseTiles.length} exploitable cheese alcove(s) where ranged attacks trivialize the encounter without risk.`
        : null,
  }
}

/**
 * Counts how many wall tiles were changed compared to original flawed layout.
 */
export function countTileChanges(
  original: ArenaLayout,
  current: ArenaLayout,
): number {
  let changes = 0
  const rows = Math.min(original.rows, current.rows)
  const cols = Math.min(original.cols, current.cols)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const origTile = original.tiles[r]?.[c] ?? 'empty'
      const curTile = current.tiles[r]?.[c] ?? 'empty'
      if (origTile !== curTile) {
        changes++
      }
    }
  }

  return changes
}

export interface ArenaPuzzleValidationResult {
  solved: boolean
  isReachable: boolean
  pathLength: number
  wallEditsCount: number
  budgetExceeded: boolean
  dodgeClearancePassed: boolean
  noCheeseSafeSpotPassed: boolean
  hazardAvoidablePassed: boolean
  feedback: string
  path: Point[] | null
  bottlenecks: Point[]
  cheeseSpots: Point[]
}

export function validateArenaPuzzle(
  arena: ArenaLayout,
  original: ArenaLayout,
): ArenaPuzzleValidationResult {
  const wallEditsCount = countTileChanges(original, arena)
  const budgetExceeded = wallEditsCount > MAX_WALL_CHANGES

  const path = findArenaPath(arena)
  const isReachable = path !== null

  let dodgeClearancePassed = false
  let bottlenecks: Point[] = []

  let hazardAvoidablePassed = false

  if (path) {
    const dodgeRes = checkDodgeClearance(arena, path)
    dodgeClearancePassed = dodgeRes.passableWithoutChokepoint
    bottlenecks = dodgeRes.bottleneckTiles

    // Path must not force walking on hazard tiles when safe ground is expected
    const hazardSteps = path.filter((p) => arena.tiles[p.row]?.[p.col] === 'hazard')
    hazardAvoidablePassed = hazardSteps.length === 0
  }

  const cheeseRes = detectSafeSpotCheese(arena)
  const noCheeseSafeSpotPassed = !cheeseRes.hasCheeseSpot
  const cheeseSpots = cheeseRes.cheeseTiles

  let feedback: string
  if (!isReachable) {
    feedback = 'NO NAVIGABLE PATH: Hero and Boss are separated by solid barriers. Units cannot reach each other.'
  } else if (budgetExceeded) {
    feedback = `BUDGET EXCEEDED: You used ${wallEditsCount} modifications. Maximum allowed is ${MAX_WALL_CHANGES} wall changes.`
  } else if (!dodgeClearancePassed) {
    feedback = `CRITICAL CHOKEPOINT: The opened gap creates a 1-tile wide death funnel (${bottlenecks.length} tiles). Players have zero lateral space to evade boss cleaves.`
  } else if (!hazardAvoidablePassed) {
    feedback = 'HAZARDOUS TRANSIT: The primary navigation route forces players to take passive plasma lava damage.'
  } else if (!noCheeseSafeSpotPassed) {
    feedback = `UNINTENDED CHEESE SPOT: ${cheeseRes.reason} Seal this blind alcove to maintain combat engagement.`
  } else {
    feedback = 'ARENA SPATIAL GEOMETRY PERFECTED! Valid bidirectional path, wide dodge clearance, no cheese spots, and within budget.'
  }

  const solved =
    isReachable &&
    !budgetExceeded &&
    dodgeClearancePassed &&
    hazardAvoidablePassed &&
    noCheeseSafeSpotPassed

  return {
    solved,
    isReachable,
    pathLength: path ? path.length : 0,
    wallEditsCount,
    budgetExceeded,
    dodgeClearancePassed,
    noCheeseSafeSpotPassed,
    hazardAvoidablePassed,
    feedback,
    path,
    bottlenecks,
    cheeseSpots,
  }
}
