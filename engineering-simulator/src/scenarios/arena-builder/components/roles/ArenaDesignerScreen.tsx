import {
  ArrowRight,
  CheckCircle2,
  Compass,
  HelpCircle,
  RotateCcw,
  Shield,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { gameAudio } from '../../audio/gameAudio'
import {
  ARENA_COLS,
  ARENA_ROWS,
  createFlawedStarterArenaLayout,
  TILE_SPECS,
} from '../../data/arenaCatalog'
import {
  MAX_WALL_CHANGES,
  validateArenaPuzzle,
} from '../../simulation/arenaPuzzle'
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
  const [activeTab, setActiveTab] = useState<'puzzle' | 'creative'>('puzzle')

  // Diagnostic Overlays
  const [showPath, setShowPath] = useState(true)
  const [showDodgeHeatmap, setShowDodgeHeatmap] = useState(true)
  const [showCheeseOverlay, setShowCheeseOverlay] = useState(true)

  // Creative Mode Tool
  const [activeTool, setActiveTool] = useState<PaletteTool>('wall')

  // Hints
  const [showHints, setShowHints] = useState(false)
  const [activeHintIndex, setActiveHintIndex] = useState(0)

  const originalFlawedLayout = useMemo(() => createFlawedStarterArenaLayout(), [])

  // Live validation
  const validation = useMemo(() => {
    return validateArenaPuzzle(arena, originalFlawedLayout)
  }, [arena, originalFlawedLayout])

  const hints = [
    'Simply knocking down the center wall creates a narrow 1-tile corridor flanked by hazards. Check the Dodge Space Heatmap and Cheese Spot detector.',
    'A 1-tile wide funnel gives zero space to evade boss cleaves. Also, notice the blind alcove at col 12, row 2: it traps the boss while the player shoots for free.',
    'Within your 3 wall edits: carve a 2-tile wide flank route where open floor already exists (e.g. rows 3-4), and place 1 wall to seal the cheese alcove at (12, 2).',
  ]

  // Puzzle interaction: click a tile to toggle wall / floor
  const handlePuzzleTileClick = (r: number, c: number) => {
    // Outer perimeter walls cannot be edited
    if (r === 0 || r === arena.rows - 1 || c === 0 || c === arena.cols - 1) return

    const currentTile = arena.tiles[r]?.[c] ?? 'empty'
    const newTiles = arena.tiles.map((rowArr) => [...rowArr])

    if (currentTile === 'wall') {
      newTiles[r][c] = 'empty'
      gameAudio.play('hit_player')
    } else {
      newTiles[r][c] = 'wall'
      gameAudio.play('hit_boss')
    }

    const updated: ArenaLayout = {
      ...arena,
      tiles: newTiles,
    }
    const val = validateArenaPuzzle(updated, originalFlawedLayout)
    updated.wallEditsCount = val.wallEditsCount
    updated.spatialPuzzleSolved = val.solved

    onUpdateArena(updated)

    if (val.solved) {
      gameAudio.play('victory')
      if (!isComplete) {
        onMarkComplete()
      }
    }
  }

  // Creative mode painting
  const handleCreativeTileClick = (r: number, c: number) => {
    if (r === 0 || r === arena.rows - 1 || c === 0 || c === arena.cols - 1) return

    if (activeTool === 'player_spawn') {
      onUpdateArena({ ...arena, playerSpawn: { col: c, row: r } })
      return
    }
    if (activeTool === 'boss_spawn') {
      onUpdateArena({ ...arena, bossSpawn: { col: c, row: r } })
      return
    }

    const tileVal: TileType = activeTool === 'eraser' ? 'empty' : activeTool
    const newTiles = arena.tiles.map((rowArr) => [...rowArr])
    newTiles[r][c] = tileVal
    onUpdateArena({ ...arena, tiles: newTiles })
  }

  const isSolved = validation.solved || arena.spatialPuzzleSolved

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-y-auto p-6 text-[#0b1d2e]">
      {/* Role Header Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-bold text-emerald-800">
            <Sparkles className="size-3 text-emerald-600" />
            Role 3: Level Designer
          </div>
          <h1 className="mt-1 font-sans text-2xl font-black text-[#003c6c]">The Three-Wall Challenge</h1>
          <p className="mt-1 text-sm text-[#5a6a85]">
            Hero and Boss are partitioned by arena walls. Optimize the spatial geometry in 3 or fewer wall modifications
            while ensuring dodge space, avoidable hazards, and zero cheese safe spots!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetArena}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Reset Puzzle
          </button>

          <button
            type="button"
            onClick={onMarkComplete}
            disabled={!isSolved}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer ${
              isSolved
                ? isComplete
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-[#003c6c] text-white hover:bg-[#002b4d]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="size-4" />
            <span>{isComplete ? 'Arena Layout Verified ✓' : 'Validate & Mark Complete'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('puzzle')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'puzzle'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <Compass className="size-3.5" />
          <span>1. The Three-Wall Challenge (Spatial Puzzle)</span>
          {isSolved && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
              Optimal ✓
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('creative')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'creative'
              ? 'bg-[#003c6c] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-[#475569] hover:bg-slate-50'
          }`}
        >
          <Shield className="size-3.5" />
          <span>2. Free Palette Painter (Full Arena Sandbox)</span>
        </button>
      </div>

      {/* Hints Banner */}
      {showHints && (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
            <span>HINT {activeHintIndex + 1} OF 3</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveHintIndex(idx)}
                  className={`h-2 w-6 rounded-full transition-colors ${
                    activeHintIndex === idx ? 'bg-amber-400' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="mt-2 text-sm text-amber-200/90">{hints[activeHintIndex]}</p>
        </div>
      )}

      {/* Main Grid Editor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Interactive 16x12 Arena Grid */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {activeTab === 'puzzle' ? 'Click wall/floor tile to modify (Budget: max 3)' : 'Click to Paint Tiles'}
              </span>

              {activeTab === 'puzzle' && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPath}
                      onChange={(e) => setShowPath(e.target.checked)}
                      className="h-3.5 w-3.5 accent-sky-500"
                    />
                    Path (BFS)
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDodgeHeatmap}
                      onChange={(e) => setShowDodgeHeatmap(e.target.checked)}
                      className="h-3.5 w-3.5 accent-rose-500"
                    />
                    Dodge Chokepoints
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCheeseOverlay}
                      onChange={(e) => setShowCheeseOverlay(e.target.checked)}
                      className="h-3.5 w-3.5 accent-amber-500"
                    />
                    Cheese Alcoves
                  </label>
                </div>
              )}
            </div>

            {/* Grid Container */}
            <div
              className="grid aspect-[16/12] w-full gap-1 rounded-xl border border-slate-800 bg-slate-950 p-2 select-none"
              style={{
                gridTemplateColumns: `repeat(${ARENA_COLS}, minmax(0, 1fr))`,
              }}
            >
              {arena.tiles.map((row, r) =>
                row.map((tile, c) => {
                  const isPlayerSpawn = arena.playerSpawn.row === r && arena.playerSpawn.col === c
                  const isBossSpawn = arena.bossSpawn.row === r && arena.bossSpawn.col === c
                  const isPerimeter = r === 0 || r === ARENA_ROWS - 1 || c === 0 || c === ARENA_COLS - 1

                  const isPathStep = Boolean(showPath && validation.path?.some((p) => p.row === r && p.col === c))
                  const isBottleneck = Boolean(
                    showDodgeHeatmap && validation.bottlenecks?.some((p) => p.row === r && p.col === c),
                  )
                  const isCheeseSpot = Boolean(
                    showCheeseOverlay && validation.cheeseSpots?.some((p) => p.row === r && p.col === c),
                  )

                  const spec = TILE_SPECS[tile]

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      disabled={isPerimeter}
                      onClick={() =>
                        activeTab === 'puzzle' ? handlePuzzleTileClick(r, c) : handleCreativeTileClick(r, c)
                      }
                      className={`relative flex items-center justify-center rounded transition-all ${
                        isPerimeter ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:ring-2 hover:ring-sky-400'
                      }`}
                      style={{
                        backgroundColor: spec.color,
                        border: `1px solid ${spec.borderColor}`,
                      }}
                    >
                      {/* Path step marker */}
                      {isPathStep && !isPlayerSpawn && !isBossSpawn && (
                        <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-sm" />
                      )}

                      {/* Bottleneck warning indicator */}
                      {isBottleneck && (
                        <div className="absolute inset-0 flex items-center justify-center bg-rose-500/40 text-[9px] font-bold text-rose-200">
                          !
                        </div>
                      )}

                      {/* Cheese alcove indicator */}
                      {isCheeseSpot && (
                        <div className="absolute inset-0 flex items-center justify-center bg-amber-500/40 text-[9px] font-bold text-amber-200">
                          CHEESE
                        </div>
                      )}

                      {/* Spawns */}
                      {isPlayerSpawn && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-black text-white shadow">
                          H
                        </div>
                      )}
                      {isBossSpawn && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow">
                          B
                        </div>
                      )}
                    </button>
                  )
                }),
              )}
            </div>

            {/* Creative Palette Bar */}
            {activeTab === 'creative' && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
                <span className="text-xs font-semibold text-slate-400">Tool:</span>
                {(
                  [
                    { id: 'wall', label: 'Wall' },
                    { id: 'cover', label: 'Cover' },
                    { id: 'hazard', label: 'Hazard' },
                    { id: 'eraser', label: 'Floor (Eraser)' },
                    { id: 'player_spawn', label: 'Move Hero' },
                    { id: 'boss_spawn', label: 'Move Boss' },
                  ] as const
                ).map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    className={`rounded px-3 py-1 text-xs font-medium transition ${
                      activeTool === tool.id ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Constraints & Diagnostic Telemetry */}
        <div className="flex flex-col gap-4 lg:col-span-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Spatial Constraints Audit
              </span>
              <button
                onClick={() => setShowHints(!showHints)}
                className="flex items-center gap-1 text-xs text-amber-400 hover:underline"
              >
                <HelpCircle className="h-3 w-3" />
                Hints
              </button>
            </div>

            {/* Modifications Budget Meter */}
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Wall Modifications Budget</span>
                <span
                  className={`font-mono font-bold ${
                    validation.wallEditsCount <= MAX_WALL_CHANGES ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {validation.wallEditsCount} / {MAX_WALL_CHANGES} used
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    validation.wallEditsCount <= MAX_WALL_CHANGES ? 'bg-sky-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, (validation.wallEditsCount / MAX_WALL_CHANGES) * 100)}%` }}
                />
              </div>
            </div>

            {/* Four Real Engineering Checks */}
            <div className="mt-4 space-y-2.5">
              <div
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs ${
                  validation.isReachable ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
                }`}
              >
                <span>1. Hero ⟷ Boss Reachability</span>
                <span className="font-bold">{validation.isReachable ? 'CONNECTED' : 'BLOCKED'}</span>
              </div>

              <div
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs ${
                  !validation.budgetExceeded ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
                }`}
              >
                <span>2. Budget Enforcement (&le; 3 changes)</span>
                <span className="font-bold">{!validation.budgetExceeded ? 'PASS' : 'EXCEEDED'}</span>
              </div>

              <div
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs ${
                  validation.dodgeClearancePassed ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
                }`}
              >
                <span>3. Lateral Dodge Maneuver Room</span>
                <span className="font-bold">{validation.dodgeClearancePassed ? 'CLEAR' : 'CHOKEPOINT'}</span>
              </div>

              <div
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs ${
                  validation.hazardAvoidablePassed ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
                }`}
              >
                <span>4. Hazard Transit Isolation</span>
                <span className="font-bold">{validation.hazardAvoidablePassed ? 'PASS' : 'FORCED LAVA'}</span>
              </div>

              <div
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs ${
                  validation.noCheeseSafeSpotPassed ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
                }`}
              >
                <span>5. No Cheese Safe-Spots</span>
                <span className="font-bold">{validation.noCheeseSafeSpotPassed ? 'SEALED' : 'EXPLOITABLE'}</span>
              </div>
            </div>

            {/* Validation Message Box */}
            <div
              className={`mt-4 rounded-xl border p-3.5 text-xs leading-relaxed ${
                validation.solved ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200' : 'border-slate-800 bg-slate-950 text-slate-300'
              }`}
            >
              {validation.feedback}
            </div>
          </div>

          {/* Educational Takeaway */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
            <span className="font-bold text-slate-300">Engineering Takeaway: </span>
            Level design is an optimization problem between player freedom, spatial chokepoints, and AI navigation.
            Fixing one corridor can accidentally create fatal bottlenecks or exploitable safe spots.
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-4">
        <div className="text-xs text-[#5a6a85]">
          {isComplete ? (
            <span className="font-bold text-emerald-700">✓ Role 3: Level Designer Complete</span>
          ) : (
            <span>Satisfy all spatial constraints within 3 wall changes.</span>
          )}
        </div>

        <button
          type="button"
          onClick={onNextRole}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003c6c] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#002b4d] cursor-pointer"
        >
          <span>Next: QA Tester</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
