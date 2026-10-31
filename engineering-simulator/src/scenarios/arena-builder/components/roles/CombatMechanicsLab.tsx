import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Eye,
  RotateCcw,
  Sword,
  Target,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { gameAudio } from '../../audio/gameAudio'
import type { HeroConfig } from '../../types/project'

interface CombatMechanicsLabProps {
  hero: HeroConfig
  onUpdateHitbox(reach: number, arcDegrees: number, validated: boolean): void
}

export function CombatMechanicsLab({ hero, onUpdateHitbox }: CombatMechanicsLabProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Lab internal state
  const [showHitboxOverlay, setShowHitboxOverlay] = useState(true)
  const [movingDummy, setMovingDummy] = useState(false)
  const [hitsLanded, setHitsLanded] = useState(0)
  const [missesCount, setMissesCount] = useState(0)
  const [lastHitFeedback, setLastHitFeedback] = useState<string | null>(null)

  // Hero position inside testing room (400x300 canvas)
  const heroPos = useRef({ x: 120, y: 150, facing: 0 })
  const dummyPos = useRef({ x: 195, y: 150, radius: 18, hp: 100, maxHp: 100, dir: 1 })
  const movingDummyPos = useRef({ x: 290, y: 100, radius: 16, hp: 80, maxHp: 80, dir: 1 })
  const swingEffect = useRef<{ active: boolean; timer: number; reach: number; arc: number } | null>(null)
  const floaters = useRef<Array<{ id: number; x: number; y: number; text: string; color: string; life: number }>>([])
  const nextFloaterId = useRef(1)

  // Validation criteria:
  // 1. Reach >= 55px (so it doesn't fail basic melee distance)
  // 2. Reach <= 95px (so it doesn't hit enemies across the screen)
  // 3. Arc >= 70° (so it's not a pixel-thin needle)
  // 4. Arc <= 150° (not a 360 degree aura)
  // 5. Must have landed at least 3 hits on the dummy in the lab
  const reach = hero.attackReach ?? 70
  const arcDegrees = hero.attackArcDegrees ?? 110

  const isGeometrySensible =
    reach >= 55 &&
    reach <= 95 &&
    arcDegrees >= 70 &&
    arcDegrees <= 150

  const isValidated = Boolean(hero.hitboxValidated) || (isGeometrySensible && hitsLanded >= 3)

  // Execute test swing
  const performTestSwing = () => {
    gameAudio.play('slash')
    const swingReach = hero.attackReach ?? 70
    const swingArcDegrees = hero.attackArcDegrees ?? 110
    const arcRad = (swingArcDegrees * Math.PI) / 180

    swingEffect.current = { active: true, timer: 0.18, reach: swingReach, arc: arcRad }

    // Check stationary dummy hit
    const dx = dummyPos.current.x - heroPos.current.x
    const dy = dummyPos.current.y - heroPos.current.y
    const dist = Math.hypot(dx, dy)
    const angleToDummy = Math.atan2(dy, dx)
    let diff = Math.abs(angleToDummy - heroPos.current.facing)
    while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI)

    const isHit = dist <= swingReach + dummyPos.current.radius && diff <= arcRad / 2

    if (isHit) {
      gameAudio.play('hit_boss')
      const nextHits = hitsLanded + 1
      setHitsLanded(nextHits)
      setLastHitFeedback(`HIT! Connected at ${Math.round(dist)}px distance.`)

      floaters.current.push({
        id: nextFloaterId.current++,
        x: dummyPos.current.x,
        y: dummyPos.current.y - 15,
        text: `-${hero.attackDamage}`,
        color: '#22d3ee',
        life: 0.8,
      })

      if (isGeometrySensible && nextHits >= 3 && !hero.hitboxValidated) {
        onUpdateHitbox(hero.attackReach, hero.attackArcDegrees, true)
      }
    } else {
      setMissesCount((m) => m + 1)
      const reason = dist > reach + dummyPos.current.radius ? `Whiff! Distance (${Math.round(dist)}px) exceeds reach (${reach}px).` : 'Whiff! Dummy outside hitbox arc angle.'
      setLastHitFeedback(reason)

      floaters.current.push({
        id: nextFloaterId.current++,
        x: dummyPos.current.x,
        y: dummyPos.current.y - 15,
        text: 'MISS',
        color: '#ef4444',
        life: 0.8,
      })
    }
  }

  // Keyboard controls in the lab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        performTestSwing()
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        heroPos.current.x = Math.min(260, heroPos.current.x + 8)
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        heroPos.current.x = Math.max(50, heroPos.current.x - 8)
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        heroPos.current.y = Math.max(50, heroPos.current.y - 8)
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        heroPos.current.y = Math.min(250, heroPos.current.y + 8)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero.attackReach, hero.attackArcDegrees, hitsLanded, isGeometrySensible])

  // Canvas render loop
  useEffect(() => {
    let animId: number
    let lastTime = performance.now()

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000
      lastTime = currentTime

      // Update moving dummy
      if (movingDummy) {
        movingDummyPos.current.y += movingDummyPos.current.dir * 45 * dt
        if (movingDummyPos.current.y > 220) movingDummyPos.current.dir = -1
        if (movingDummyPos.current.y < 80) movingDummyPos.current.dir = 1
      }

      // Update swing timer
      if (swingEffect.current && swingEffect.current.active) {
        swingEffect.current.timer -= dt
        if (swingEffect.current.timer <= 0) {
          swingEffect.current.active = false
        }
      }

      // Update floaters
      floaters.current = floaters.current
        .map((f) => ({ ...f, y: f.y - 30 * dt, life: f.life - dt }))
        .filter((f) => f.life > 0)

      // Draw canvas
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          renderLabRoom(ctx, heroPos.current, dummyPos.current, movingDummyPos.current, movingDummy, hero, showHitboxOverlay, swingEffect.current, floaters.current)
        }
      }

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [movingDummy, hero, showHitboxOverlay])

  const restoreBrokenDefect = () => {
    onUpdateHitbox(32, 35, false)
    setHitsLanded(0)
    setMissesCount(0)
    setLastHitFeedback('Reset to broken starter configuration: reach is only 32px (too short).')
  }

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-white p-6 shadow-sm flex flex-col gap-5">
      {/* Problem Header */}
      <div className="flex flex-col gap-2 border-b border-cyan-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-0.5 text-xs font-bold text-cyan-800">
            <Crosshair className="size-3.5 text-cyan-600" />
            Hands-on Combat Mechanics Lab
          </div>
          <h2 className="mt-1 font-sans text-lg font-black text-[#003c6c]">
            Investigate & Repair the Hero&rsquo;s Broken Attack Hitbox
          </h2>
          <p className="mt-0.5 text-xs text-[#5a6a85]">
            Playtesters reported that the hero&rsquo;s melee attacks constantly miss even when standing right in front of targets! Diagnose the collision geometry on the training dummy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isValidated ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Hitbox Validated & Repaired
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-300">
              <AlertTriangle className="size-4 text-amber-600" />
              Repair Required ({hitsLanded}/3 Hits)
            </span>
          )}

          <button
            type="button"
            onClick={restoreBrokenDefect}
            title="Reset to broken starter defect"
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="size-3" />
            Load Broken Hitbox
          </button>
        </div>
      </div>

      {/* Main Lab Area: Interactive Canvas Room + Geometry Tooling */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: 2D Canvas Testing Room */}
        <div className="flex-1 flex flex-col items-center">
          <div className="relative rounded-2xl border-2 border-slate-800 bg-slate-950 p-2 shadow-inner">
            <canvas
              ref={canvasRef}
              width={420}
              height={260}
              className="rounded-xl bg-[#090d16]"
            />

            {/* In-room controls overlay */}
            <div className="absolute top-4 left-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowHitboxOverlay((s) => !s)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase transition cursor-pointer border ${
                  showHitboxOverlay
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                <Eye className="size-3" />
                {showHitboxOverlay ? 'Hitbox Overlay: ON' : 'Hitbox Overlay: OFF'}
              </button>

              <button
                type="button"
                onClick={() => setMovingDummy((m) => !m)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase transition cursor-pointer border ${
                  movingDummy
                    ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                <Target className="size-3" />
                {movingDummy ? 'Moving Dummy: ON' : 'Moving Dummy: OFF'}
              </button>
            </div>

            <div className="absolute bottom-4 right-4">
              <button
                type="button"
                onClick={performTestSwing}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 shadow-md cursor-pointer transition active:translate-y-0.5"
              >
                <Sword className="size-3.5" />
                <span>Test Attack (Space)</span>
              </button>
            </div>
          </div>

          <div className="mt-2 flex w-full max-w-[420px] items-center justify-between text-[11px] font-mono text-[#5a6a85]">
            <span>Controls: <kbd className="rounded bg-slate-100 px-1 border">WASD</kbd> Move · <kbd className="rounded bg-slate-100 px-1 border">Space</kbd> Attack</span>
            <span>Target Dummy: 75px away</span>
          </div>

          {/* Test Feedback Bar */}
          {lastHitFeedback && (
            <div className="mt-2 w-full max-w-[420px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-[#0b1d2e] font-mono">
              <span className="font-bold text-[#003c6c]">Test Result: </span>
              {lastHitFeedback}
            </div>
          )}
        </div>

        {/* Right: Hitbox Geometry Controls */}
        <div className="w-full lg:w-80 flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-4">
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-[#003c6c] flex items-center gap-1.5">
              <Crosshair className="size-4 text-cyan-600" />
              Hitbox Geometry Controls
            </h3>
            <p className="text-xs text-[#5a6a85]">
              Adjust the reach and coverage arc of the weapon hitbox. Watch the green/cyan collision sector update live on the dummy!
            </p>

            {/* Reach Slider */}
            <div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-[#475569]">Attack Reach (Radius)</span>
                <span className="font-mono text-cyan-700">{hero.attackReach ?? 70} px</span>
              </div>
              <input
                type="range"
                min={30}
                max={110}
                step={2}
                value={hero.attackReach ?? 70}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  onUpdateHitbox(val, hero.attackArcDegrees ?? 110, false)
                }}
                className="mt-1.5 w-full accent-cyan-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#75787b]">
                <span>30px (Too short!)</span>
                <span>Balanced: 70–85px</span>
                <span>110px (Oversized)</span>
              </div>
            </div>

            {/* Arc Slider */}
            <div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-[#475569]">Hitbox Arc (Coverage Angle)</span>
                <span className="font-mono text-cyan-700">{hero.attackArcDegrees ?? 110}°</span>
              </div>
              <input
                type="range"
                min={30}
                max={160}
                step={5}
                value={hero.attackArcDegrees ?? 110}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  onUpdateHitbox(hero.attackReach ?? 70, val, false)
                }}
                className="mt-1.5 w-full accent-cyan-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#75787b]">
                <span>30° (Needle-thin)</span>
                <span>Balanced: 110–130°</span>
                <span>160° (Wide sweep)</span>
              </div>
            </div>

            {/* Educational insight box */}
            <div className="rounded-lg border border-cyan-200 bg-cyan-50/70 p-3 text-[11px] text-cyan-950 leading-relaxed">
              <span className="font-bold">Game Dev Takeaway: </span>
              A <strong>hitbox</strong> is the geometric trigger volume where an attack inflicts damage. If reach is shorter than the character sprite&rsquo;s weapon or too narrow, attacks &ldquo;whiff&rdquo; unfairly. If it&rsquo;s too huge, attacks connect without visual contact.
            </div>
          </div>

          {/* Validation Status */}
          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#475569]">Validation Checklist</span>
              <span className="font-mono font-bold text-[#003c6c]">{hitsLanded}/3 Verified Hits ({missesCount} misses)</span>
            </div>
            <ul className="mt-1.5 space-y-1 text-[11px] text-[#5a6a85]">
              <li className={`flex items-center gap-1.5 ${hero.attackReach >= 55 ? 'text-emerald-700 font-semibold' : 'text-amber-700'}`}>
                {hero.attackReach >= 55 ? '✓' : '•'} Reach connects with target dummy (≥ 55px)
              </li>
              <li className={`flex items-center gap-1.5 ${hero.attackReach <= 95 ? 'text-emerald-700 font-semibold' : 'text-amber-700'}`}>
                {hero.attackReach <= 95 ? '✓' : '•'} Reach does not exceed reasonable range (≤ 95px)
              </li>
              <li className={`flex items-center gap-1.5 ${hero.attackArcDegrees >= 70 ? 'text-emerald-700 font-semibold' : 'text-amber-700'}`}>
                {hero.attackArcDegrees >= 70 ? '✓' : '•'} Hitbox arc is sufficiently wide (≥ 70°)
              </li>
              <li className={`flex items-center gap-1.5 ${hitsLanded >= 3 ? 'text-emerald-700 font-semibold' : 'text-amber-700'}`}>
                {hitsLanded >= 3 ? '✓' : '•'} Land 3 successful test attacks on the dummy
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function renderLabRoom(
  ctx: CanvasRenderingContext2D,
  hero: { x: number; y: number; facing: number },
  dummy: { x: number; y: number; radius: number },
  movingDummy: { x: number; y: number; radius: number },
  hasMovingDummy: boolean,
  heroConfig: HeroConfig,
  showHitboxOverlay: boolean,
  swing: { active: boolean; timer: number; reach: number; arc: number } | null,
  floaters: Array<{ x: number; y: number; text: string; color: string; life: number }>,
) {
  ctx.clearRect(0, 0, 420, 260)

  // 1. Grid Floor
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1
  for (let x = 0; x < 420; x += 30) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 260)
    ctx.stroke()
  }
  for (let y = 0; y < 260; y += 30) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(420, y)
    ctx.stroke()
  }

  // 2. Range Ring from Hero
  if (showHitboxOverlay) {
    ctx.save()
    ctx.translate(hero.x, hero.y)
    ctx.beginPath()
    const arcDeg = heroConfig.attackArcDegrees ?? 110
    const reachPx = heroConfig.attackReach ?? 70
    const halfArc = ((arcDeg / 2) * Math.PI) / 180
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, reachPx, hero.facing - halfArc, hero.facing + halfArc)
    ctx.closePath()
    ctx.fillStyle = 'rgba(6, 182, 212, 0.15)'
    ctx.fill()
    ctx.strokeStyle = '#06b6d4'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  // 3. Active Swing Arc
  if (swing && swing.active) {
    ctx.save()
    ctx.translate(hero.x, hero.y)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, swing.reach, hero.facing - swing.arc / 2, hero.facing + swing.arc / 2)
    ctx.closePath()
    ctx.fillStyle = 'rgba(34, 211, 238, 0.45)'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.restore()
  }

  // 4. Hero
  ctx.save()
  ctx.translate(hero.x, hero.y)
  ctx.beginPath()
  ctx.arc(0, 0, 15, 0, Math.PI * 2)
  ctx.fillStyle = '#06b6d4'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.stroke()

  // Facing line
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(Math.cos(hero.facing) * 22, Math.sin(hero.facing) * 22)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()

  // 5. Stationary Training Dummy
  ctx.save()
  ctx.translate(dummy.x, dummy.y)
  ctx.beginPath()
  ctx.arc(0, 0, dummy.radius, 0, Math.PI * 2)
  ctx.fillStyle = '#f59e0b'
  ctx.fill()
  ctx.strokeStyle = '#fbbf24'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#000000'
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('DUMMY', 0, 3)
  ctx.restore()

  // 6. Optional Moving Dummy
  if (hasMovingDummy) {
    ctx.save()
    ctx.translate(movingDummy.x, movingDummy.y)
    ctx.beginPath()
    ctx.arc(0, 0, movingDummy.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#a855f7'
    ctx.fill()
    ctx.strokeStyle = '#c084fc'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('PATROL', 0, 3)
    ctx.restore()
  }

  // 7. Floaters
  for (const f of floaters) {
    ctx.save()
    ctx.font = 'bold 12px monospace'
    ctx.fillStyle = f.color
    ctx.textAlign = 'center'
    ctx.globalAlpha = Math.max(0, f.life)
    ctx.fillText(f.text, f.x, f.y)
    ctx.restore()
  }
}
