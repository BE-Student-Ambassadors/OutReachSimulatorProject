import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  Eraser,
  Eye,
  Flame,
  Footprints,
  MapPin,
  RotateCcw,
  Shield,
  Sparkles,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  ARENA_COLS,
  ARENA_ROWS,
  createFlawedStarterArenaLayout,
  createStarterArenaLayout,
  TILE_SPECS,
} from '../../data/arenaCatalog'
import { validateArenaLayout } from '../../simulation/arenaValidation'
import type { ArenaLayout, TileType } from '../../types/project'

interface ArenaDesignerScreenProps {
  arena: ArenaLayout
  onUpdateArena(arena: ArenaLayout): void
  onResetArena(): void
  onMarkComplete(): void
  isComplete: boolean
  onNextRole(): void
}

type PaletteTool = TileType | 'player_spawn' | 'boss_spawn' | 'eraser'

export function ArenaDesignerScreen({
  arena,
  onUpdateArena,
  onResetArena,
  onMarkComplete,
  isComplete,
  onNextRole,
}: ArenaDesignerScreenProps) {
  const [activeTool, setActiveTool] = useState<PaletteTool>('wall')
  const [isMouseDown, setIsMouseDown] = useState(false)

  // Level Design Investigation Tools
  const [showPathPreview, setShowPathPreview] = useState(true)
  const [showSpawnSafety, setShowSpawnSafety] = useState(true)
  const [showDodgeSpace, setShowDodgeSpace] = useState(false)
  const [testWalkMode, setTestWalkMode] = useState(false)
  const [testHeroPos, setTestHeroPos] = useState({
    col: arena.playerSpawn?.col ?? 3,
    row: arena.playerSpawn?.row ?? 6,
  })
  const [walkStepsTaken, setWalkStepsTaken] = useState(0)

  const validation = validateArenaLayout(arena)

  const pCol = arena.playerSpawn?.col ?? 3
  const pRow = arena.playerSpawn?.row ?? 6
  const bCol = arena.bossSpawn?.col ?? 12
  const bRow = arena.bossSpawn?.row ?? 6

  // Compute BFS path coordinates for Path Preview
  const bfsPathCoords = new Set<string>()
  if (validation.isReachable) {
    const queue: Array<{ c: number; r: number; path: Array<{ c: number; r: number }> }> = [
      { c: pCol, r: pRow, path: [{ c: pCol, r: pRow }] },
    ]
    const visited = new Set<string>()
    visited.add(`${pCol},${pRow}`)

    while (queue.length > 0) {
      const cur = queue.shift()!
      if (cur.c === bCol && cur.r === bRow) {
        cur.path.forEach((pt) => bfsPathCoords.add(`${pt.c},${pt.r}`))
        break
      }

      const dirs = [
        { dc: 0, dr: -1 },
        { dc: 0, dr: 1 },
        { dc: -1, dr: 0 },
        { dc: 1, dr: 0 },
      ]
      for (const d of dirs) {
        const nc = cur.c + d.dc
        const nr = cur.r + d.dr
        if (nc >= 0 && nc < arena.cols && nr >= 0 && nr < arena.rows) {
          const key = `${nc},${nr}`
          const t = arena.tiles[nr]?.[nc]
          if (!visited.has(key) && t !== 'wall' && t !== 'cover') {
            visited.add(key)
            queue.push({ c: nc, r: nr, path: [...cur.path, { c: nc, r: nr }] })
          }
        }
      }
    }
  }

  // Count obstacles to verify students haven't just deleted everything
  let obstacleCount = 0
  for (let r = 1; r < arena.rows - 1; r++) {
    for (let c = 1; c < arena.cols - 1; c++) {
      if (arena.tiles[r][c] === 'wall' || arena.tiles[r][c] === 'cover') obstacleCount++
    }
  }
  const hasTacticalObstacles = obstacleCount >= 2

  // Validation criteria
  const isArenaValidAndTested =
    validation.valid &&
    hasTacticalObstacles &&
    (arena.hasTestedWalk || walkStepsTaken >= 5)

  // Handle Interactive Walk Test in Arena
  useEffect(() => {
    if (!testWalkMode) return

    const handleKeyDown = (e: KeyboardEvent) => {
      let dc = 0
      let dr = 0
      if (e.code === 'KeyW' || e.code === 'ArrowUp') dr = -1
      else if (e.code === 'KeyS' || e.code === 'ArrowDown') dr = 1
      else if (e.code === 'KeyA' || e.code === 'ArrowLeft') dc = -1
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') dc = 1

      if (dc !== 0 || dr !== 0) {
        e.preventDefault()
        const nc = testHeroPos.col + dc
        const nr = testHeroPos.row + dr

        if (nc >= 0 && nc < arena.cols && nr >= 0 && nr < arena.rows) {
          const targetTile = arena.tiles[nr]?.[nc]
          if (targetTile !== 'wall' && targetTile !== 'cover') {
            setTestHeroPos({ col: nc, row: nr })
            const nextSteps = walkStepsTaken + 1
            setWalkStepsTaken(nextSteps)
            if (nextSteps >= 5 && !arena.hasTestedWalk) {
              onUpdateArena({ ...arena, hasTestedWalk: true })
            }
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [testWalkMode, testHeroPos, arena, walkStepsTaken, onUpdateArena])

  const handleCellClick = (c: number, r: number) => {
    if (testWalkMode) return
    // Outer perimeter remains walls
    if (r === 0 || r === ARENA_ROWS - 1 || c === 0 || c === ARENA_COLS - 1) return

    if (activeTool === 'player_spawn') {
      onUpdateArena({ ...arena, playerSpawn: { col: c, row: r } })
      setTestHeroPos({ col: c, row: r })
      return
    }

    if (activeTool === 'boss_spawn') {
      onUpdateArena({ ...arena, bossSpawn: { col: c, row: r } })
      return
    }

    const tileType: TileType = activeTool === 'eraser' ? 'empty' : activeTool
    const newTiles = arena.tiles.map((rowArr, rowIndex) =>
      rowIndex === r ? rowArr.map((cell, colIndex) => (colIndex === c ? tileType : cell)) : rowArr,
    )

    onUpdateArena({ ...arena, tiles: newTiles })
  }

  const handleCellMouseEnter = (c: number, r: number) => {
    if (isMouseDown && !testWalkMode && activeTool !== 'player_spawn' && activeTool !== 'boss_spawn') {
      handleCellClick(c, r)
    }
  }

  const loadFlawedStarter = () => {
    onUpdateArena(createFlawedStarterArenaLayout())
    setWalkStepsTaken(0)
    setTestWalkMode(false)
  }

  return (
    <div
      className="mx-auto flex h-full max-w-6xl flex-col gap-6 overflow-y-auto p-6 text-[#0b1d2e]"
      onMouseUp={() => setIsMouseDown(false)}
    >
      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-bold text-emerald-800">
            <Sparkles className="size-3 text-emerald-600" />
            Role 3: Arena Designer
          </div>
          <h1 className="mt-1 font-sans text-2xl font-black text-[#003c6c]">Battlefield Level Design Studio</h1>
          <p className="mt-1 text-sm text-[#5a6a85]">
            Redesign the studio’s flawed starter battlefield. Clear blocked corridors, remove hazardous spawn traps, preserve tactical cover, and walk-test navigation!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetArena}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
            title="Reset to clean balanced starter layout"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>

          <button
            type="button"
            onClick={loadFlawedStarter}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            Load Broken Arena
          </button>

          <button
            type="button"
            onClick={onMarkComplete}
            disabled={!isArenaValidAndTested}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer ${
              isArenaValidAndTested
                ? isComplete
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-[#003c6c] text-white hover:bg-[#002b4d]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="size-4" />
            <span>{isComplete ? 'Arena Approved ✓' : 'Approve Arena Design'}</span>
          </button>
        </div>
      </div>

      {/* Problem Briefing Card */}
      <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4 shadow-sm">
        <span className="font-mono text-[10px] font-black uppercase tracking-wider text-amber-800">
          YOUR PROBLEM: INHERITED FLAWED LEVEL DESIGN
        </span>
        <h3 className="font-sans text-sm font-bold text-amber-950 mt-0.5">
          Level Design Audit: The boss is trapped behind an impassable wall and spawn points face hazard damage.
        </h3>
        <p className="mt-1 text-xs text-amber-900/80">
          The starter arena layout has two major defects: an unbroken solid wall dividing the center (blocking all navigation between spawns), and a lava pool right next to the hero spawn. Use your investigative tools below to repair the arena.
        </p>
      </div>

      {/* Investigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#75787b]">
            Design Tools:
          </span>

          <button
            type="button"
            onClick={() => setShowPathPreview((p) => !p)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${
              showPathPreview
                ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            <Compass className="size-3.5 text-emerald-600" />
            <span>Path Preview: {showPathPreview ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSpawnSafety((s) => !s)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${
              showSpawnSafety
                ? 'border-cyan-600 bg-cyan-50 text-cyan-900'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            <Shield className="size-3.5 text-cyan-600" />
            <span>Spawn Safety: {showSpawnSafety ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDodgeSpace((d) => !d)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${
              showDodgeSpace
                ? 'border-purple-600 bg-purple-50 text-purple-900'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            <Eye className="size-3.5 text-purple-600" />
            <span>Dodge Space: {showDodgeSpace ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Test Walk Button */}
        <button
          type="button"
          onClick={() => {
            const next = !testWalkMode
            setTestWalkMode(next)
            if (next) {
              setTestHeroPos({ col: arena.playerSpawn.col, row: arena.playerSpawn.row })
            }
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer border shadow-sm ${
            testWalkMode
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-[#003c6c] bg-[#003c6c] text-white hover:bg-[#002b4d]'
          }`}
        >
          <Footprints className="size-4" />
          <span>{testWalkMode ? 'Exit Test Walk' : 'Test Arena (Walk Mode)'}</span>
        </button>
      </div>

      {/* Main Work Area: Palette + Canvas Grid */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left Palette */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-[#75787b]">
              Object Palette
            </span>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setActiveTool('wall')}
                disabled={testWalkMode}
                className={`flex items-center gap-2.5 rounded-xl p-2.5 text-xs font-bold transition cursor-pointer border ${
                  activeTool === 'wall' && !testWalkMode
                    ? 'border-[#003c6c] bg-[#003c6c]/10 text-[#003c6c]'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-[#475569]'
                }`}
              >
                <div className="size-5 rounded border border-slate-500 bg-[#090d16]" />
                <div className="text-left">
                  <div>Wall Barrier</div>
                  <div className="text-[10px] font-normal text-[#75787b]">Blocks movement & shots</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('cover')}
                disabled={testWalkMode}
                className={`flex items-center gap-2.5 rounded-xl p-2.5 text-xs font-bold transition cursor-pointer border ${
                  activeTool === 'cover' && !testWalkMode
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-[#475569]'
                }`}
              >
                <div className="size-5 rounded border border-blue-400 bg-[#1e3a8a] flex items-center justify-center">
                  <Shield className="size-3 text-blue-300" />
                </div>
                <div className="text-left">
                  <div>Tactical Cover</div>
                  <div className="text-[10px] font-normal text-[#75787b]">Blocks blaster shots</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('hazard')}
                disabled={testWalkMode}
                className={`flex items-center gap-2.5 rounded-xl p-2.5 text-xs font-bold transition cursor-pointer border ${
                  activeTool === 'hazard' && !testWalkMode
                    ? 'border-red-600 bg-red-50 text-red-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-[#475569]'
                }`}
              >
                <div className="size-5 rounded border border-red-500 bg-[#7f1d1d] flex items-center justify-center">
                  <Flame className="size-3 text-red-300" />
                </div>
                <div className="text-left">
                  <div>Plasma Hazard</div>
                  <div className="text-[10px] font-normal text-[#75787b]">Deals 8 dmg/s</div>
                </div>
              </button>

              <div className="my-1 border-t border-slate-200" />

              <button
                type="button"
                onClick={() => setActiveTool('player_spawn')}
                disabled={testWalkMode}
                className={`flex items-center gap-2.5 rounded-xl p-2.5 text-xs font-bold transition cursor-pointer border ${
                  activeTool === 'player_spawn' && !testWalkMode
                    ? 'border-cyan-600 bg-cyan-50 text-cyan-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-[#475569]'
                }`}
              >
                <div className="size-5 rounded-full border border-cyan-400 bg-cyan-500 flex items-center justify-center text-white">
                  <User className="size-3" />
                </div>
                <div className="text-left">
                  <div>Hero Spawn (P)</div>
                  <div className="text-[10px] font-normal text-[#75787b]">Relocate spawn tile</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('boss_spawn')}
                disabled={testWalkMode}
                className={`flex items-center gap-2.5 rounded-xl p-2.5 text-xs font-bold transition cursor-pointer border ${
                  activeTool === 'boss_spawn' && !testWalkMode
                    ? 'border-red-600 bg-red-50 text-red-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-[#475569]'
                }`}
              >
                <div className="size-5 rounded-full border border-red-400 bg-red-600 flex items-center justify-center text-white">
                  <MapPin className="size-3" />
                </div>
                <div className="text-left">
                  <div>Boss Spawn (B)</div>
                  <div className="text-[10px] font-normal text-[#75787b]">Relocate spawn tile</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('eraser')}
                disabled={testWalkMode}
                className={`flex items-center gap-2.5 rounded-xl p-2.5 text-xs font-bold transition cursor-pointer border ${
                  activeTool === 'eraser' && !testWalkMode
                    ? 'border-slate-700 bg-slate-100 text-slate-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-[#475569]'
                }`}
              >
                <div className="size-5 rounded border border-slate-400 bg-slate-200 flex items-center justify-center">
                  <Eraser className="size-3 text-slate-700" />
                </div>
                <div className="text-left">
                  <div>Eraser</div>
                  <div className="text-[10px] font-normal text-[#75787b]">Clear to empty floor</div>
                </div>
              </button>
            </div>

            {/* Presets */}
            <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => onUpdateArena(createStarterArenaLayout())}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw className="size-3" />
                Clean Starter Preset
              </button>
            </div>
          </div>
        </div>

        {/* Right Canvas: Interactive Grid View */}
        <div className="flex-1 flex flex-col gap-4">
          <div
            className="rounded-2xl border border-slate-200 bg-slate-900 p-4 shadow-inner flex flex-col items-center justify-center select-none"
            onMouseDown={() => setIsMouseDown(true)}
          >
            {testWalkMode && (
              <div className="mb-2 text-xs font-mono text-amber-300 font-bold animate-pulse">
                WALK TEST ACTIVE: Use WASD or Arrow Keys to navigate the hero! ({walkStepsTaken} steps taken)
              </div>
            )}

            <div
              className="grid gap-[2px] bg-slate-950 p-2 rounded-xl"
              style={{
                gridTemplateColumns: `repeat(${ARENA_COLS}, minmax(32px, 44px))`,
                gridTemplateRows: `repeat(${ARENA_ROWS}, minmax(32px, 44px))`,
              }}
            >
              {arena.tiles.map((row, r) =>
                row.map((tile, c) => {
                  const isPlayerSpawn = arena.playerSpawn.col === c && arena.playerSpawn.row === r
                  const isBossSpawn = arena.bossSpawn.col === c && arena.bossSpawn.row === r
                  const isBorder = r === 0 || r === ARENA_ROWS - 1 || c === 0 || c === ARENA_COLS - 1
                  const spec = TILE_SPECS[tile]

                  const isPathCell = showPathPreview && bfsPathCoords.has(`${c},${r}`)
                  const isTestHeroHere = testWalkMode && testHeroPos.col === c && testHeroPos.row === r

                  // Dodge space: count walkable neighbors
                  const isDodgeCell = showDodgeSpace && tile === 'empty'

                  return (
                    <div
                      key={`${c}-${r}`}
                      onClick={() => handleCellClick(c, r)}
                      onMouseEnter={() => handleCellMouseEnter(c, r)}
                      className={`relative flex items-center justify-center aspect-square rounded transition duration-75 cursor-pointer border ${
                        isBorder ? 'cursor-not-allowed opacity-90' : 'hover:ring-2 hover:ring-white/40'
                      }`}
                      style={{
                        backgroundColor: isPathCell ? '#064e3b' : spec.color,
                        borderColor: isPathCell ? '#10b981' : spec.borderColor,
                      }}
                      title={`[${c}, ${r}] ${spec.name}`}
                    >
                      {/* Walk Mode Hero */}
                      {isTestHeroHere && (
                        <div className="z-20 flex size-7 items-center justify-center rounded-full bg-cyan-400 text-slate-950 font-black text-xs shadow-lg border-2 border-white animate-bounce">
                          ★
                        </div>
                      )}

                      {/* Spawns */}
                      {isPlayerSpawn && !isTestHeroHere && (
                        <div className="z-10 flex size-6 items-center justify-center rounded-full bg-cyan-500 text-white font-black text-xs shadow-md border-2 border-white">
                          P
                        </div>
                      )}
                      {isBossSpawn && (
                        <div className="z-10 flex size-6 items-center justify-center rounded-full bg-red-600 text-white font-black text-xs shadow-md border-2 border-white">
                          B
                        </div>
                      )}

                      {/* Dodge space dot */}
                      {isDodgeCell && !isPlayerSpawn && !isBossSpawn && !isTestHeroHere && (
                        <div className="size-1.5 rounded-full bg-purple-400/40" />
                      )}

                      {/* Tile icons */}
                      {!isPlayerSpawn && !isBossSpawn && !isTestHeroHere && tile === 'cover' && (
                        <Shield className="size-3.5 text-blue-300 opacity-60" />
                      )}
                      {!isPlayerSpawn && !isBossSpawn && !isTestHeroHere && tile === 'hazard' && (
                        <Flame className="size-3.5 text-red-400 opacity-80" />
                      )}
                    </div>
                  )
                }),
              )}
            </div>
          </div>

          {/* Validation & Level Design Checklist */}
          <div
            className={`rounded-xl border p-4 text-xs transition ${
              isArenaValidAndTested
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : 'border-amber-300 bg-amber-50 text-amber-950'
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                {isArenaValidAndTested ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-600" />
                )}
                <span>{isArenaValidAndTested ? 'Battlefield Layout Verified' : 'Level Design Defects Active'}</span>
              </span>
              <span className="font-mono text-[11px]">
                Walk Distance: {validation.pathDistance > 0 ? `${validation.pathDistance} tiles` : 'Blocked!'}
              </span>
            </div>

            <ul className="mt-2 space-y-1 text-[11px]">
              <li className={`flex items-center gap-1.5 ${validation.isReachable ? 'text-emerald-700 font-semibold' : 'text-amber-800 font-bold'}`}>
                {validation.isReachable ? '✓' : '•'} Unobstructed path between Player and Boss spawns
              </li>
              <li className={`flex items-center gap-1.5 ${validation.playerSpawnValid && validation.bossSpawnValid ? 'text-emerald-700 font-semibold' : 'text-amber-800 font-bold'}`}>
                {validation.playerSpawnValid && validation.bossSpawnValid ? '✓' : '•'} Spawns are placed on safe, walkable tiles (no hazard traps)
              </li>
              <li className={`flex items-center gap-1.5 ${hasTacticalObstacles ? 'text-emerald-700 font-semibold' : 'text-amber-800'}`}>
                {hasTacticalObstacles ? '✓' : '•'} Preserves tactical cover pillars/walls (don&rsquo;t wipe everything empty)
              </li>
              <li className={`flex items-center gap-1.5 ${walkStepsTaken >= 5 ? 'text-emerald-700 font-semibold' : 'text-amber-800'}`}>
                {walkStepsTaken >= 5 ? '✓' : '•'} Walk test completed ({walkStepsTaken}/5 steps verified in Test Walk)
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-xs text-[#75787b]">
          {!isArenaValidAndTested
            ? 'Action required: Remove impassable walls, verify spawn safety, and test-walk the arena.'
            : 'Arena level design validated and ready.'}
        </span>
        <button
          type="button"
          onClick={onNextRole}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003c6c] px-4 py-2 text-xs font-bold text-white hover:bg-[#002b4d] shadow-xs cursor-pointer"
        >
          <span>Next: Balance Lab & QA Investigation</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
