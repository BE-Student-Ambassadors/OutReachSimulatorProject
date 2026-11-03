import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gameAudio } from '../../audio/gameAudio'
import { TILE_SIZE, TILE_SPECS } from '../../data/arenaCatalog'
import {
  CombatSimulation,
  type CombatInputs,
} from '../../simulation/combatEngine'
import type {
  AbilityType,
  ActiveTab,
  ArenaLayout,
  BossConfig,
  HeroConfig,
  PlaytestResult,
  QaSettings,
  WeaponType,
} from '../../types/project'
import { DevCombatControls } from './DevCombatControls'
import { PlaytestHud } from './PlaytestHud'
import { PlaytestResultsOverlay } from './PlaytestResultsOverlay'

interface PlayableArenaCanvasProps {
  hero: HeroConfig
  boss: BossConfig
  arena: ArenaLayout
  qa?: QaSettings
  attemptNumber: number
  onFinishCombat(result: PlaytestResult): void
  onNavigate(tab: ActiveTab): void
  devMode: boolean
}

export function PlayableArenaCanvas({
  hero,
  boss,
  arena,
  qa,
  attemptNumber,
  onFinishCombat,
  onNavigate,
  devMode,
}: PlayableArenaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const simRef = useRef<CombatSimulation | null>(null)

  const [overrideWeapon, setOverrideWeapon] = useState<WeaponType | null>(null)
  const [overrideAbility, setOverrideAbility] = useState<AbilityType | null>(null)

  const activeHero = useMemo<HeroConfig>(() => ({
    ...hero,
    ...(overrideWeapon ? { weapon: overrideWeapon } : {}),
    ...(overrideAbility ? { ability: overrideAbility } : {}),
  }), [hero, overrideWeapon, overrideAbility])
  const activeBoss = boss

  const [sessionKey, setSessionKey] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [godMode, setGodMode] = useState(false)
  const [showHitboxes, setShowHitboxes] = useState(false)
  const [latestResult, setLatestResult] = useState<PlaytestResult | null>(null)
  const [, setHudTick] = useState(0)

  // Simulation instance created/recreated when hero, boss, arena, qa, or sessionKey changes
  const sim = useMemo(() => {
    return new CombatSimulation(activeHero, activeBoss, arena, qa)
    // sessionKey triggers recreation on manual combat restart
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHero, activeBoss, arena, qa, sessionKey])

  // Synchronize simRef for the 60fps animation frame loop
  useEffect(() => {
    simRef.current = sim
  }, [sim])

  // Reset result and pause state when simulation changes
  const [prevSim, setPrevSim] = useState(sim)
  if (prevSim !== sim) {
    setPrevSim(sim)
    setLatestResult(null)
    setIsPaused(false)
  }

  const restartCombat = useCallback(() => {
    setSessionKey((k) => k + 1)
  }, [])

  // Track keyboard inputs
  const inputsRef = useRef<CombatInputs>({
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
    ability: false,
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code
      let handled = true

      if (code === 'KeyW' || code === 'ArrowUp') inputsRef.current.up = true
      else if (code === 'KeyS' || code === 'ArrowDown') inputsRef.current.down = true
      else if (code === 'KeyA' || code === 'ArrowLeft') inputsRef.current.left = true
      else if (code === 'KeyD' || code === 'ArrowRight') inputsRef.current.right = true
      else if (code === 'Space') inputsRef.current.attack = true
      else if (code === 'ShiftLeft' || code === 'ShiftRight') inputsRef.current.ability = true
      else if (code === 'Escape') {
        setIsPaused((p) => !p)
        handled = true
      } else {
        handled = false
      }

      if (handled) {
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code
      if (code === 'KeyW' || code === 'ArrowUp') inputsRef.current.up = false
      else if (code === 'KeyS' || code === 'ArrowDown') inputsRef.current.down = false
      else if (code === 'KeyA' || code === 'ArrowLeft') inputsRef.current.left = false
      else if (code === 'KeyD' || code === 'ArrowRight') inputsRef.current.right = false
      else if (code === 'Space') inputsRef.current.attack = false
      else if (code === 'ShiftLeft' || code === 'ShiftRight') inputsRef.current.ability = false
    }

    const handleBlur = () => {
      inputsRef.current = {
        up: false,
        down: false,
        left: false,
        right: false,
        attack: false,
        ability: false,
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Main 60fps Game Loop
  useEffect(() => {
    let animationFrameId: number
    let lastTime = performance.now()

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000
      lastTime = currentTime

      const canvas = canvasRef.current
      const currentSim = simRef.current

      if (canvas && currentSim) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          // Update simulation if not paused
          if (!isPaused && !currentSim.isGameOver) {
            // God Mode protection
            if (godMode) {
              currentSim.heroHp = activeHero.maxHealth
            }

            currentSim.update(dt, inputsRef.current)

            // Play audio events
            while (currentSim.soundEvents.length > 0) {
              const evt = currentSim.soundEvents.shift()!
              gameAudio.play(evt.type)
            }

            // Check game over
            if (currentSim.isGameOver && !latestResult) {
              const res = currentSim.generateResult(attemptNumber)
              setLatestResult(res)
              onFinishCombat(res)
            }
          }

          // Render game scene
          renderScene(ctx, currentSim, arena, showHitboxes)
          setHudTick((t) => t + 1)
        }
      }

      animationFrameId = requestAnimationFrame(loop)
    }

    animationFrameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animationFrameId)
  }, [isPaused, godMode, showHitboxes, activeHero, arena, attemptNumber, onFinishCombat, latestResult])

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-slate-950 overflow-hidden select-none">
      {/* 2D Combat Canvas */}
      <canvas
        ref={canvasRef}
        width={arena.cols * TILE_SIZE}
        height={arena.rows * TILE_SIZE}
        className="max-h-full max-w-full rounded-2xl shadow-2xl border border-slate-800"
        style={{
          aspectRatio: `${arena.cols} / ${arena.rows}`,
        }}
      />

      {/* Arcade Combat HUD */}
      {sim && (
        <PlaytestHud
          hero={activeHero}
          boss={activeBoss}
          sim={sim}
          onTogglePause={() => setIsPaused((p) => !p)}
          isPaused={isPaused}
        />
      )}

      {/* Developer Combat Sandbox Panel */}
      {devMode && (
        <DevCombatControls
          hero={activeHero}
          onSwapWeapon={(w: WeaponType) => setOverrideWeapon(w)}
          onSwapAbility={(a: AbilityType) => setOverrideAbility(a)}
          onInstantDefeatBoss={() => {
            sim.damageBoss(9999, 'DEV OBLITERATE')
          }}
          onRestart={restartCombat}
          godMode={godMode}
          onToggleGodMode={() => setGodMode((g) => !g)}
          showHitboxes={showHitboxes}
          onToggleHitboxes={() => setShowHitboxes((s) => !s)}
        />
      )}

      {/* Post-Combat Results Modal */}
      {latestResult && (
        <PlaytestResultsOverlay
          result={latestResult}
          hero={activeHero}
          boss={activeBoss}
          onRetry={restartCombat}
          onNavigate={onNavigate}
          onPublish={() => onNavigate('publish')}
        />
      )}
    </div>
  )
}

function renderScene(
  ctx: CanvasRenderingContext2D,
  sim: CombatSimulation,
  arena: ArenaLayout,
  showHitboxes: boolean,
) {
  const width = arena.cols * TILE_SIZE
  const height = arena.rows * TILE_SIZE

  ctx.save()

  // Apply Screen Shake
  if (sim.screenShake > 0) {
    const rx = (Math.random() - 0.5) * sim.screenShake
    const ry = (Math.random() - 0.5) * sim.screenShake
    ctx.translate(rx, ry)
  }

  // 1. Clear background
  ctx.fillStyle = '#090d16'
  ctx.fillRect(0, 0, width, height)

  // 2. Render Arena Tiles
  for (let r = 0; r < arena.rows; r++) {
    for (let c = 0; c < arena.cols; c++) {
      const tile = arena.tiles[r]?.[c] ?? 'empty'
      const spec = TILE_SPECS[tile]
      const tx = c * TILE_SIZE
      const ty = r * TILE_SIZE

      ctx.fillStyle = spec.color
      ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE)

      ctx.strokeStyle = spec.borderColor
      ctx.lineWidth = 1
      ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE)

      // Inner details for special tiles
      if (tile === 'wall') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
        ctx.fillRect(tx + 4, ty + 4, TILE_SIZE - 8, TILE_SIZE - 8)
      } else if (tile === 'cover') {
        ctx.fillStyle = '#2563eb'
        ctx.fillRect(tx + 8, ty + 8, TILE_SIZE - 16, TILE_SIZE - 16)
        ctx.strokeStyle = '#60a5fa'
        ctx.strokeRect(tx + 8, ty + 8, TILE_SIZE - 16, TILE_SIZE - 16)
      } else if (tile === 'hazard') {
        // Glowing animated plasma hazard
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)'
        ctx.fillRect(tx + 2, ty + 2, TILE_SIZE - 4, TILE_SIZE - 4)
      }
    }
  }

  // 3. Render Boss Attack Telegraph Zone
  if (sim.bossTelegraph) {
    const tele = sim.bossTelegraph
    ctx.save()
    ctx.translate(tele.x, tele.y)

    if (tele.shape === 'circle') {
      ctx.beginPath()
      ctx.arc(0, 0, tele.radius * tele.progress, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
    } else if (tele.shape === 'arc') {
      const halfAngle = ((130 / 2) * Math.PI) / 180
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, tele.radius, tele.angle - halfAngle, tele.angle + halfAngle)
      ctx.closePath()
      ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + tele.progress * 0.25})`
      ctx.fill()
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.stroke()
    } else if (tele.shape === 'projectiles') {
      ;[-0.25, 0, 0.25].forEach((offset) => {
        const rayAngle = tele.angle + offset
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(rayAngle) * tele.radius, Math.sin(rayAngle) * tele.radius)
        ctx.strokeStyle = `rgba(236, 72, 153, ${0.4 + tele.progress * 0.5})`
        ctx.lineWidth = 3
        ctx.stroke()
      })
    }

    ctx.restore()
  }

  // 4. Render Projectiles
  for (const p of sim.projectiles) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur = 8
    ctx.fill()
    ctx.restore()
  }

  // 5. Render Hero
  ctx.save()
  ctx.translate(sim.heroX, sim.heroY)

  // Dash ghost trail or shield barrier
  if (sim.heroShieldActive) {
    ctx.beginPath()
    ctx.arc(0, 0, sim.heroRadius + 8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)'
    ctx.fill()
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 2.5
    ctx.stroke()
  }

  // Hero Body
  ctx.beginPath()
  ctx.arc(0, 0, sim.heroRadius, 0, Math.PI * 2)
  ctx.fillStyle = sim.heroHitFlashTimer > 0 ? '#ffffff' : '#06b6d4'
  ctx.fill()
  ctx.strokeStyle = '#22d3ee'
  ctx.lineWidth = 2
  ctx.stroke()

  // Facing Pointer / Visor
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(Math.cos(sim.heroFacingAngle) * (sim.heroRadius + 6), Math.sin(sim.heroFacingAngle) * (sim.heroRadius + 6))
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.restore()

  // 6. Render Boss
  ctx.save()
  ctx.translate(sim.bossX, sim.bossY)

  // Vulnerability Aura
  if (sim.bossIsVulnerable) {
    ctx.beginPath()
    ctx.arc(0, 0, sim.bossRadius + 6, 0, Math.PI * 2)
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 3
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Boss Body
  ctx.beginPath()
  ctx.arc(0, 0, sim.bossRadius, 0, Math.PI * 2)
  ctx.fillStyle = sim.bossHitFlashTimer > 0 ? '#ffffff' : '#1e1b4b'
  ctx.fill()
  ctx.strokeStyle = sim.bossIsVulnerable ? '#fbbf24' : '#ef4444'
  ctx.lineWidth = 3.5
  ctx.stroke()

  // Glowing Eye Core
  ctx.beginPath()
  ctx.arc(
    Math.cos(sim.bossFacingAngle) * 8,
    Math.sin(sim.bossFacingAngle) * 8,
    7,
    0,
    Math.PI * 2,
  )
  ctx.fillStyle = sim.bossIsVulnerable ? '#fbbf24' : '#ef4444'
  ctx.fill()

  // Detect State Alert Icon (!)
  if (sim.bossFsmState === 'DETECT') {
    ctx.fillStyle = '#eab308'
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('!', 0, -sim.bossRadius - 10)
  }

  ctx.restore()

  // 7. Render Particles
  for (const pt of sim.particles) {
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, Math.max(1, pt.radius * (pt.life / pt.maxLife)), 0, Math.PI * 2)
    ctx.fillStyle = pt.color
    ctx.fill()
  }

  // 8. Render Floating Text
  for (const fl of sim.floaters) {
    ctx.save()
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = fl.color
    ctx.globalAlpha = Math.max(0, fl.life / fl.maxLife)
    ctx.fillText(fl.text, fl.x, fl.y)
    ctx.restore()
  }

  // 9. Debug Hitboxes
  if (showHitboxes) {
    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(sim.heroX, sim.heroY, sim.heroRadius, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = '#f43f5e'
    ctx.beginPath()
    ctx.arc(sim.bossX, sim.bossY, sim.bossRadius, 0, Math.PI * 2)
    ctx.stroke()

    // Detection Circle
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)'
    ctx.beginPath()
    ctx.arc(sim.bossX, sim.bossY, sim.bossConfig.behavior.detectionRange, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()
}
