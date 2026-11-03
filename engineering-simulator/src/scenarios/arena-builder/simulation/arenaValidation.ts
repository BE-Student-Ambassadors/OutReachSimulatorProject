import type { ArenaLayout } from '../types/project'

export interface ArenaValidationResult {
  valid: boolean
  hasPlayerSpawn: boolean
  hasBossSpawn: boolean
  playerSpawnValid: boolean
  bossSpawnValid: boolean
  isReachable: boolean
  hazardPct: number
  isHazardExcessive: boolean
  issues: string[]
  walkableTilesCount: number
  pathDistance: number // in tiles
}

export function validateArenaLayout(layout: ArenaLayout): ArenaValidationResult {
  const issues: string[] = []
  const { cols, rows, tiles, playerSpawn, bossSpawn } = layout

  const totalTiles = cols * rows
  let wallTiles = 0
  let hazardTiles = 0
  let coverTiles = 0
  let emptyTiles = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = tiles[r]?.[c] ?? 'empty'
      if (t === 'wall') wallTiles++
      else if (t === 'hazard') hazardTiles++
      else if (t === 'cover') coverTiles++
      else emptyTiles++
    }
  }

  // Check spawns
  const hasPlayerSpawn = Boolean(playerSpawn && playerSpawn.col >= 0 && playerSpawn.col < cols && playerSpawn.row >= 0 && playerSpawn.row < rows)
  const hasBossSpawn = Boolean(bossSpawn && bossSpawn.col >= 0 && bossSpawn.col < cols && bossSpawn.row >= 0 && bossSpawn.row < rows)

  if (!hasPlayerSpawn) issues.push('Player spawn point is missing or outside arena bounds.')
  if (!hasBossSpawn) issues.push('Boss spawn point is missing or outside arena bounds.')

  const pTile = hasPlayerSpawn ? tiles[playerSpawn.row]?.[playerSpawn.col] : 'wall'
  const playerSpawnValid = hasPlayerSpawn && pTile !== 'wall' && pTile !== 'cover'

  const bTile = hasBossSpawn ? tiles[bossSpawn.row]?.[bossSpawn.col] : 'wall'
  const bossSpawnValid = hasBossSpawn && bTile !== 'wall' && bTile !== 'cover'

  if (hasPlayerSpawn && !playerSpawnValid) issues.push(`Player spawn is trapped inside a ${pTile} obstacle.`)
  if (hasBossSpawn && !bossSpawnValid) issues.push(`Boss spawn is trapped inside a ${bTile} obstacle.`)

  // Hazard density check (hazard / non-wall tiles)
  const nonWallTiles = totalTiles - wallTiles - coverTiles
  const hazardPct = nonWallTiles > 0 ? Math.round((hazardTiles / nonWallTiles) * 100) : 0
  const isHazardExcessive = hazardPct > 35

  if (isHazardExcessive) {
    issues.push(`Hazard density is ${hazardPct}% (> 35% limit). Combat area has too much environmental damage.`)
  }

  // BFS Reachability between Player Spawn and Boss Spawn
  let isReachable = false
  let pathDistance = -1

  if (playerSpawnValid && bossSpawnValid) {
    const queue: Array<{ col: number; row: number; dist: number }> = [
      { col: playerSpawn.col, row: playerSpawn.row, dist: 0 },
    ]
    const visited = new Set<string>()
    visited.add(`${playerSpawn.col},${playerSpawn.row}`)

    const dirs = [
      { dc: 0, dr: -1 },
      { dc: 0, dr: 1 },
      { dc: -1, dr: 0 },
      { dc: 1, dr: 0 },
    ]

    while (queue.length > 0) {
      const cur = queue.shift()!
      if (cur.col === bossSpawn.col && cur.row === bossSpawn.row) {
        isReachable = true
        pathDistance = cur.dist
        break
      }

      for (const d of dirs) {
        const nc = cur.col + d.dc
        const nr = cur.row + d.dr

        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
          const key = `${nc},${nr}`
          const nextTile = tiles[nr][nc]

          // Walkable if not wall or cover
          if (!visited.has(key) && nextTile !== 'wall' && nextTile !== 'cover') {
            visited.add(key)
            queue.push({ col: nc, row: nr, dist: cur.dist + 1 })
          }
        }
      }
    }

    if (!isReachable) {
      issues.push('Boss is unreachable! Walls or cover completely block all routes between spawns.')
    }
  }

  const valid = issues.length === 0

  return {
    valid,
    hasPlayerSpawn,
    hasBossSpawn,
    playerSpawnValid,
    bossSpawnValid,
    isReachable,
    hazardPct,
    isHazardExcessive,
    issues,
    walkableTilesCount: emptyTiles + hazardTiles,
    pathDistance,
  }
}
