import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Play,
  RotateCcw,
  Shield,
  Swords,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { gameAudio } from '../../audio/gameAudio'
import {
  DUEL_OPPONENTS,
  simulateDuelMatch,
  validateDuelMystery,
  type DuelSimulationResult,
  type DuelValidationResult,
} from '../../simulation/duelPuzzle'
import type { HeroConfig } from '../../types/project'

interface CombatMechanicsLabProps {
  hero: HeroConfig
  onUpdateTuning(params: {
    heavyEndlag: number
    heavyPoiseStartup: boolean
    heavyDashCancelWindow: boolean
    swiftRecoveryGap: number
    solved: boolean
  }): void
  onResetPuzzle(): void
}

export function CombatMechanicsLab({ hero, onUpdateTuning, onResetPuzzle }: CombatMechanicsLabProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Puzzle tuning parameters
  const heavyEndlag = hero.heavyEndlag ?? 1.2
  const heavyPoiseStartup = hero.heavyPoiseStartup ?? false
  const heavyDashCancelWindow = hero.heavyDashCancelWindow ?? false
  const swiftRecoveryGap = hero.swiftRecoveryGap ?? 0.05

  const [selectedMatchup, setSelectedMatchup] = useState<'scout' | 'sentinel' | 'mirror'>('scout')
  const [activeHintIndex, setActiveHintIndex] = useState(0)
  const [showHints, setShowHints] = useState(false)
  const [validationResult, setValidationResult] = useState<DuelValidationResult | null>(() => {
    return hero.duelMysterySolved ? validateDuelMystery(hero) : null
  })

  const [activeSim, setActiveSim] = useState<DuelSimulationResult | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [playbackProgress, setPlaybackProgress] = useState(1)

  const hints = [
    'Analyze the combat replay log when Heavy Colossus fights Agile Scout. What state is the Heavy in when taking the most damage?',
    "Heavy Colossus is trapped in a 1.2s 'endlag' (recovery window) after each blow, and gets staggered during startup without Poise. Try tuning endlag down to ~0.45s and enabling Poise Armor.",
    'Swift Striker attacks every 0.05s, which feels like infinite stun-lock, but it immediately folds against Iron Sentinel. Tune Swift recovery gap to ~0.25s so neither archetype is broken.',
  ]

  // Run single matchup simulation with visual animation
  const runLiveMatch = (opponentKey: 'scout' | 'sentinel' | 'mirror') => {
    const opp = DUEL_OPPONENTS[opponentKey]
    const playstyle = opponentKey === 'sentinel' ? 'swift' : 'heavy'
    const res = simulateDuelMatch(playstyle, opp, {
      heavyEndlag,
      heavyPoiseStartup,
      heavyDashCancelWindow,
      swiftRecoveryGap,
    })

    setActiveSim(res)
    setIsSimulating(true)
    setPlaybackProgress(0)
    gameAudio.play('slash')
  }

  // Animation playback loop
  useEffect(() => {
    if (!isSimulating) return
    let animId: number
    const startTime = performance.now()
    const duration = 2000 // 2 seconds visualization

    const frame = (now: number) => {
      const elapsed = now - startTime
      const p = Math.min(1, elapsed / duration)
      setPlaybackProgress(p)

      if (p < 1) {
        animId = requestAnimationFrame(frame)
      } else {
        setIsSimulating(false)
        gameAudio.play('hit_player')
      }
    }

    animId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animId)
  }, [isSimulating])

  // Canvas visual rendering for the combat ring
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    // Background
    ctx.fillStyle = '#0b0f19'
    ctx.fillRect(0, 0, w, h)

    // Duel Ring Grid & Markings
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Octagon ring boundary
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 3
    ctx.strokeRect(30, 20, w - 60, h - 40)

    // Current Opponent Specs
    const opp = DUEL_OPPONENTS[selectedMatchup]
    const playstyle = selectedMatchup === 'sentinel' ? 'swift' : 'heavy'

    // Fighter positions
    const pX = 140 + Math.sin(playbackProgress * Math.PI * 4) * 15
    const pY = h / 2
    const oX = w - 140 - Math.sin(playbackProgress * Math.PI * 4) * 15
    const oY = h / 2

    // 1. Draw Player Character
    ctx.save()
    ctx.translate(pX, pY)

    // Poise aura
    if (heavyPoiseStartup && playstyle === 'heavy') {
      ctx.beginPath()
      ctx.arc(0, 0, 26, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Body
    ctx.beginPath()
    ctx.arc(0, 0, playstyle === 'heavy' ? 20 : 14, 0, Math.PI * 2)
    ctx.fillStyle = playstyle === 'heavy' ? '#38bdf8' : '#34d399'
    ctx.fill()
    ctx.strokeStyle = '#f8fafc'
    ctx.lineWidth = 2
    ctx.stroke()

    // Weapon representation
    ctx.fillStyle = '#fbbf24'
    if (playstyle === 'heavy') {
      ctx.fillRect(14, -8, 22, 16) // Hammer head
    } else {
      ctx.fillRect(10, -2, 18, 4) // Rapier blade
    }
    ctx.restore()

    // Player Label & HP
    ctx.fillStyle = '#94a3b8'
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${playstyle.toUpperCase()} (HERO)`, pX, pY - 32)

    // 2. Draw Opponent
    ctx.save()
    ctx.translate(oX, oY)

    ctx.beginPath()
    ctx.arc(0, 0, opp.archetype === 'iron_sentinel' ? 24 : opp.archetype === 'agile_scout' ? 14 : 18, 0, Math.PI * 2)
    ctx.fillStyle = opp.archetype === 'iron_sentinel' ? '#64748b' : opp.archetype === 'agile_scout' ? '#f43f5e' : '#a855f7'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.restore()

    ctx.fillStyle = '#94a3b8'
    ctx.fillText(opp.name.toUpperCase(), oX, oY - 36)

    // Slash VFX during animation
    if (isSimulating && playbackProgress < 0.9) {
      ctx.strokeStyle = '#fef08a'
      ctx.lineWidth = 3
      ctx.beginPath()
      const midX = (pX + oX) / 2 + (Math.random() - 0.5) * 40
      const midY = (pY + oY) / 2 + (Math.random() - 0.5) * 40
      ctx.arc(midX, midY, 20 + Math.random() * 15, 0, Math.PI)
      ctx.stroke()
    }
  }, [playbackProgress, selectedMatchup, heavyEndlag, heavyPoiseStartup, isSimulating])

  // Run comprehensive 3-scenario validation
  const handleValidatePuzzle = () => {
    const updatedHero: HeroConfig = {
      ...hero,
      heavyEndlag,
      heavyPoiseStartup,
      heavyDashCancelWindow,
      swiftRecoveryGap,
    }
    const result = validateDuelMystery(updatedHero)
    setValidationResult(result)

    onUpdateTuning({
      heavyEndlag,
      heavyPoiseStartup,
      heavyDashCancelWindow,
      swiftRecoveryGap,
      solved: result.solved,
    })

    if (result.solved) {
      gameAudio.play('victory')
    } else {
      gameAudio.play('hit_boss')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Challenge Header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg backdrop-blur">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-xs font-semibold text-sky-400">
                ROLE 1 — GAMEPLAY DESIGNER
              </span>
              <span className="text-xs text-slate-400">Combat Rhythm & Frame Data Mystery</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-100">The Unwinnable Duel</h2>
            <p className="mt-1 text-sm text-slate-300">
              Playtesters report that Swift Striker dominates duels 100% of the time, yet both playstyles fail
              miserably against different enemy types. Investigate recovery windows, endlag, and poise armor to
              restore combat parity without breaking damage scaling.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHints(!showHints)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              <HelpCircle className="h-4 w-4 text-amber-400" />
              {showHints ? 'Hide Hints' : 'Hints (3)'}
            </button>

            <button
              onClick={onResetPuzzle}
              className="flex items-center gap-1.5 rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-900/50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Lab
            </button>
          </div>
        </div>

        {/* Progressive Hints Accordion */}
        {showHints && (
          <div className="mt-4 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
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
      </div>

      {/* Main Duel Simulation Arena */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: 2D Combat Canvas & Matchup Selector */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Combat Ring Simulation
              </span>
              <div className="flex gap-1.5">
                {(['scout', 'sentinel', 'mirror'] as const).map((key) => {
                  const opp = DUEL_OPPONENTS[key]
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedMatchup(key)
                        setActiveSim(null)
                      }}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                        selectedMatchup === key
                          ? 'bg-sky-600 text-white shadow'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {opp.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
              <canvas ref={canvasRef} width={520} height={280} className="h-full w-full object-contain" />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Testing Matchup:{' '}
                <span className="font-semibold text-slate-200">
                  {selectedMatchup === 'sentinel' ? 'Swift Striker' : 'Heavy Colossus'} vs{' '}
                  {DUEL_OPPONENTS[selectedMatchup].name}
                </span>
              </div>
              <button
                onClick={() => runLiveMatch(selectedMatchup)}
                disabled={isSimulating}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-sky-500 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {isSimulating ? 'Simulating...' : 'Simulate Matchup'}
              </button>
            </div>
          </div>

          {/* Telemetry & Replay Frame Inspector */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Combat Frame Log & Replay Telemetry
              </span>
              {activeSim && (
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${
                    activeSim.winner === 'player' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  RESULT: {activeSim.winner === 'player' ? 'HERO VICTORY' : 'OPPONENT DEFEAT'} ({activeSim.duration}s)
                </span>
              )}
            </div>

            <div className="h-28 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-xs text-slate-300">
              {activeSim ? (
                activeSim.log.map((line, idx) => (
                  <div
                    key={idx}
                    className={`py-0.5 ${
                      line.includes('CRITICAL') || line.includes('interrupted')
                        ? 'text-rose-400'
                        : line.includes('Poise') || line.includes('absorbed')
                          ? 'text-amber-300'
                          : line.includes('staggered')
                            ? 'text-emerald-300'
                            : 'text-slate-400'
                    }`}
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">
                  Select a matchup and click &quot;Simulate Matchup&quot; to inspect frame data and combat telemetry.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Tactical Tuning Levers & Validation Suite */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-md">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Combat Action Economy Levers
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Do not adjust damage numbers. Alter the vulnerability windows and poise armor to balance action pacing.
            </p>

            <div className="mt-5 space-y-4">
              {/* Heavy Endlag Slider */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Heavy Strike Endlag (Recovery)</span>
                  <span className="font-mono text-sky-400">{heavyEndlag.toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={1.4}
                  step={0.05}
                  value={heavyEndlag}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    onUpdateTuning({
                      heavyEndlag: val,
                      heavyPoiseStartup,
                      heavyDashCancelWindow,
                      swiftRecoveryGap,
                      solved: false,
                    })
                  }}
                  className="mt-1.5 w-full accent-sky-500"
                />
                <span className="text-[10px] text-slate-500">
                  Defect: 1.2s leaves hero helpless against fast counter-strikes. Sweet spot: ~0.45s.
                </span>
              </div>

              {/* Swift Recovery Gap Slider */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Swift Flurry Recovery Gap</span>
                  <span className="font-mono text-emerald-400">{swiftRecoveryGap.toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min={0.02}
                  max={0.5}
                  step={0.02}
                  value={swiftRecoveryGap}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    onUpdateTuning({
                      heavyEndlag,
                      heavyPoiseStartup,
                      heavyDashCancelWindow,
                      swiftRecoveryGap: val,
                      solved: false,
                    })
                  }}
                  className="mt-1.5 w-full accent-emerald-500"
                />
                <span className="text-[10px] text-slate-500">
                  Defect: 0.05s is an oppressive infinite loop. Balance requires giving opponents reaction space (~0.25s).
                </span>
              </div>

              {/* Poise Armor Toggle */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-400" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">Heavy Poise Armor (Startup)</div>
                      <div className="text-[10px] text-slate-400">Prevents light hit interruption during windup</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={heavyPoiseStartup}
                    onChange={(e) => {
                      onUpdateTuning({
                        heavyEndlag,
                        heavyPoiseStartup: e.target.checked,
                        heavyDashCancelWindow,
                        swiftRecoveryGap,
                        solved: false,
                      })
                    }}
                    className="h-4 w-4 accent-amber-500"
                  />
                </div>
              </div>

              {/* Dash-Cancel Window Toggle */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-400" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">Dash-Cancel Window</div>
                      <div className="text-[10px] text-slate-400">Allows dodging out of endlag upon counter-attack</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={heavyDashCancelWindow}
                    onChange={(e) => {
                      onUpdateTuning({
                        heavyEndlag,
                        heavyPoiseStartup,
                        heavyDashCancelWindow: e.target.checked,
                        swiftRecoveryGap,
                        solved: false,
                      })
                    }}
                    className="h-4 w-4 accent-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Validation Trigger Button */}
            <button
              onClick={handleValidatePuzzle}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-sky-500 hover:to-indigo-500"
            >
              <Swords className="h-4 w-4" />
              Run 3-Scenario Balance Verification
            </button>
          </div>

          {/* Validation Feedback Card */}
          {validationResult && (
            <div
              className={`rounded-xl border p-4 shadow-lg ${
                validationResult.solved
                  ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-200'
                  : 'border-rose-500/50 bg-rose-950/20 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {validationResult.solved ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                )}
                <span className="font-bold text-sm">
                  {validationResult.solved ? 'COMBAT PARITY RESTORED' : 'BALANCE AUDIT FAILED'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div
                  className={`rounded p-1.5 ${
                    validationResult.heavyVsScoutPassed ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'
                  }`}
                >
                  Heavy vs Scout: {validationResult.heavyVsScoutPassed ? 'PASS' : 'FAIL'}
                </div>
                <div
                  className={`rounded p-1.5 ${
                    validationResult.swiftVsSentinelPassed ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'
                  }`}
                >
                  Swift vs Sentinel: {validationResult.swiftVsSentinelPassed ? 'PASS' : 'FAIL'}
                </div>
                <div
                  className={`rounded p-1.5 ${
                    validationResult.mirrorMatchBalanced ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'
                  }`}
                >
                  Duel Symmetry: {validationResult.mirrorMatchBalanced ? 'PASS' : 'FAIL'}
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed">{validationResult.feedback}</p>
            </div>
          )}

          {/* Educational Takeaway */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
            <span className="font-bold text-slate-300">Engineering Takeaway: </span>
            Action game design is governed by frame data (startup, active, and endlag). When an attack has excessive
            recovery without poise, fast opponents get free turns. Meaningful balance comes from tuning vulnerability
            windows, not just buffing damage.
          </div>
        </div>
      </div>
    </div>
  )
}
