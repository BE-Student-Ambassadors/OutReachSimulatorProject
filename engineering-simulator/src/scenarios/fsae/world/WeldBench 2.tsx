import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Check, Flame, RotateCcw, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import * as THREE from 'three'
import { play, useLoop, type Loop } from '../../../shared/audio/sfx'
import { WorldErrorBoundary } from '../../../shell/WorldErrorBoundary'
import { JOINTS } from '../config'
import { mulberry32 } from '../sim/autonomy'
import {
  arcHeat,
  cellY,
  GRITS,
  letGo,
  liftTorch,
  LOOKS_TEXT,
  moveLoose,
  SHOP,
  SHOP_BY_ID,
  clampUp,
  tryItem,
  LUMPY,
  MM_PER_UNIT,
  newBead,
  onMetal,
  sand,
  scoreWeld,
  SEAM_CELLS,
  shiftMm,
  spotKind,
  startFinish,
  startFixture,
  trackTorch,
  TUBE_LEN,
  weldFacts,
  type Bead,
  type Finish,
  type Fixture,
  type Grit,
  type ShopItemId,
  type WeldReport,
} from '../sim/weld'

/**
 * The welding bench: a close-up of one frame joint and the checklist a welder works through.
 * Line the tubes up, clamp them, weld the seam under the helmet in one smooth stroke (the bead
 * shows as it goes down, but the arc's glare hides the work right at the torch), pick a grit
 * and sand the bead down. The joint's strength is only revealed at the end.
 *
 * Everything is modeled with the seam running up and down (see sim/weld.ts). Sideways joints
 * turn the whole close-up a quarter turn, and turn the pointer back the other way.
 */

type Phase = 'fit' | 'clamp' | 'weld' | 'inspect' | 'grit' | 'sand' | 'done'
const STEP_OF: Record<Phase, number> = { fit: 0, clamp: 1, weld: 2, inspect: 2, grit: 3, sand: 4, done: 5 }

/** Where the camera looks (the seam sits right of center, clear of the checklist). */
const LOOK_AT = new THREE.Vector3(-0.55, 0, 0)
const CAM_END = new THREE.Vector3(0.05, 0.9, 8.6)
const CAM_START = new THREE.Vector3(0.4, 2.2, 15)

const Z_AXIS = new THREE.Vector3(0, 0, 1)
/** A sideways seam: the bench model turned a quarter turn (its seam's top end points right). */
const SIDEWAYS_TURN = -Math.PI / 2

const GRIT_COLOR: Record<Grit, string> = { 24: '#5e4126', 60: '#80542a', 120: '#a5763f', 320: '#c9a66c' }

/** What the pointer is over, in bench units. */
interface BenchPoint {
  x: number
  y: number
  z: number
  onTube: boolean
  /** 0 = fixed tube (x < 0), 1 = loose tube. */
  side: 0 | 1
  /** Where the pointer meets the plane through the tubes' axis (for dragging). */
  px: number
  py: number
}

interface Handlers {
  down(p: BenchPoint): void
  move(p: BenchPoint): void
  up(): void
  leave(): void
}

/** Live pointer + tool state shared with the 3D scene, read every frame. */
interface Rig {
  p: THREE.Vector3
  n: THREE.Vector3
  x: number
  y: number
  onTube: boolean
  over: boolean
  held: boolean
  /** Sparks per second right now. */
  emit: number
  /** 0..1 how hard the sanding disc is biting. */
  sandLevel: number
}

function hitCylinder(ray: THREE.Ray, axisY: number): { t: number; p: THREE.Vector3 } | null {
  const oy = ray.origin.y - axisY
  const oz = ray.origin.z
  const { y: dy, z: dz } = ray.direction
  const a = dy * dy + dz * dz
  const b = 2 * (oy * dy + oz * dz)
  const c = oy * oy + oz * oz - 1
  const disc = b * b - 4 * a * c
  if (a < 1e-9 || disc < 0) return null
  const t = (-b - Math.sqrt(disc)) / (2 * a)
  if (t < 0) return null
  return { t, p: ray.at(t, new THREE.Vector3()) }
}

function pickBench(ray: THREE.Ray, gapU: number, offU: number): BenchPoint {
  const tp = -ray.origin.z / ray.direction.z
  const plane = ray.at(tp, new THREE.Vector3())
  const fixed = hitCylinder(ray, 0)
  const loose = hitCylinder(ray, offU)
  const cands = [fixed && fixed.p.x <= 0 ? { ...fixed, side: 0 as const } : null, loose && loose.p.x > 0 ? { ...loose, side: 1 as const } : null].filter(
    (h): h is NonNullable<typeof h> => h !== null,
  )
  const best = cands.sort((a, b) => a.t - b.t)[0]
  if (!best || Math.abs(best.p.x) > TUBE_LEN + gapU / 2) return { x: plane.x, y: plane.y, z: 1.05, onTube: false, side: plane.x > 0 ? 1 : 0, px: plane.x, py: plane.y }
  return { x: best.p.x, y: best.p.y, z: best.p.z, onTube: true, side: best.side, px: plane.x, py: plane.y }
}

export function WeldBench({
  joint,
  seed,
  prepared,
  onSave,
  onClose,
  onRedo,
}: {
  joint: number
  seed: number
  /** The fit-up and clamps from this joint's last weld: re-welding goes straight to the torch. */
  prepared?: Fixture | null
  onSave(r: WeldReport, fit: Fixture): void
  onClose(): void
  onRedo(): void
}) {
  const sideways = JOINTS[joint].seam === 'sideways'
  const turn = sideways ? SIDEWAYS_TURN : 0
  const [phase, setPhase] = useState<Phase>(prepared ? 'weld' : 'fit')
  const [fx, setFx] = useState<Fixture>(() => prepared ?? startFixture(seed))
  /** What happened to the loose tube last (let go, a shop item tried). */
  const [note, setNote] = useState<string | null>(null)
  const bead = useRef<Bead>(newBead())
  const finish = useRef<Finish | null>(null)
  const [version, setVersion] = useState(0)
  const [sanded, setSanded] = useState<Snapshot | null>(null)
  const [helmet, setHelmet] = useState(false)
  const [arc, setArc] = useState(false)
  const [struck, setStruck] = useState(false)
  const [grit, setGrit] = useState<Grit | null>(null)
  const [report, setReport] = useState<WeldReport | null>(null)
  const [hover, setHover] = useState<{ x: number; side: 0 | 1 } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [shown, setShown] = useState(false)
  const rig = useRef<Rig>({ p: new THREE.Vector3(), n: new THREE.Vector3(0, 0, 1), x: 0, y: 0, onTube: false, over: false, held: false, emit: 0, sandLevel: 0 })
  const drag = useRef<{ px: number; py: number; gap: number; off: number } | null>(null)
  const lastSand = useRef<{ x: number; y: number } | null>(null)
  const lastBump = useRef(0)

  const sizzle = useLoop('sizzle', arc)
  const grind = useLoop('grind', phase === 'sand')

  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [])

  const gapU = fx.gapMm / MM_PER_UNIT
  // Once the arc has burned, loose clamps let the tube pull out of line as the weld cools.
  const shifted = struck ? shiftMm(fx) * (fx.offsetMm < 0 ? -1 : 1) : 0
  const offU = (fx.offsetMm + shifted) / MM_PER_UNIT

  const setTip = (p: BenchPoint) => {
    const r = rig.current
    r.x = p.x
    r.y = p.y
    r.onTube = p.onTube
    r.over = true
    r.p.set(p.x, p.y, p.z)
    r.n.set(0, p.side === 1 ? p.y - offU : p.y, p.onTube ? p.z : 1).normalize()
  }

  const handlers = useRef<Handlers>({ down: () => {}, move: () => {}, up: () => {}, leave: () => {} })
  useEffect(() => {
    handlers.current = {
      down(p) {
        setTip(p)
        rig.current.held = true
        if (phase === 'fit' && p.onTube && p.side === 1) {
          drag.current = { px: p.px, py: p.py, gap: fx.gapMm, off: fx.offsetMm }
          setDragging(true)
          play('click')
        } else if (phase === 'clamp' && p.onTube) {
          const min = gapU / 2 + 0.35
          const x = Math.max(min, Math.min(TUBE_LEN - 0.4, Math.abs(p.x))) * (p.side === 1 ? 1 : -1)
          setFx((f) => ({ ...f, clamps: p.side === 0 ? [x, f.clamps[1]] : [f.clamps[0], x] }))
          play('thunk')
        } else if (phase === 'weld' && helmet) {
          liftTorch(bead.current)
          trackTorch(bead.current, p.y)
          setArc(true)
          if (p.onTube) setStruck(true)
        } else if (phase === 'sand' && grit !== null) {
          lastSand.current = { x: p.x, y: p.y }
        }
      },
      move(p) {
        setTip(p)
        const r = rig.current
        if (phase === 'fit' && drag.current) {
          const d = drag.current
          setFx((f) => moveLoose(f, Math.max(0, d.gap + (p.px - d.px) * MM_PER_UNIT), d.off + (p.py - d.py) * MM_PER_UNIT))
        } else if (phase === 'clamp') {
          setHover(p.onTube ? { x: p.x, side: p.side } : null)
        } else if (phase === 'weld' && r.held && helmet) {
          if (p.onTube) {
            trackTorch(bead.current, p.y)
            setStruck(true)
          } else liftTorch(bead.current)
        } else if (phase === 'sand' && r.held && grit !== null && finish.current) {
          const last = lastSand.current
          lastSand.current = { x: p.x, y: p.y }
          if (!last || !p.onTube) return
          const removed = sand(finish.current, grit, p.x, p.y, Math.hypot(p.x - last.x, p.y - last.y))
          r.sandLevel = Math.max(r.sandLevel, Math.min(1, removed * 6))
          const now = performance.now()
          if (now - lastBump.current > 60) {
            lastBump.current = now
            setVersion((v) => v + 1)
            setSanded(snapshot(finish.current))
          }
        }
      },
      up() {
        rig.current.held = false
        if (drag.current) {
          drag.current = null
          setDragging(false)
          // Let go by hand: see what the tube does on its own.
          const settled = letGo(fx)
          setFx(settled.f)
          setNote(settled.note)
        }
        if (arc) {
          liftTorch(bead.current)
          setArc(false)
        }
        lastSand.current = null
      },
      leave() {
        rig.current.over = false
        setHover(null)
      },
    }
  })

  // Arrow keys nudge the loose tube while lining up (0.1 mm a press).
  useEffect(() => {
    if (phase !== 'fit') return
    const onKey = (e: KeyboardEvent) => {
      // [gap, offset] change per key; on a sideways seam the loose tube hangs below the fixed one.
      const keys: Record<string, [number, number]> = sideways
        ? { ArrowUp: [-0.1, 0], ArrowDown: [0.1, 0], ArrowLeft: [0, -0.1], ArrowRight: [0, 0.1] }
        : { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }
      const d = keys[e.key]
      if (!d) return
      e.preventDefault()
      setFx((f) => {
        const settled = letGo(moveLoose(f, Math.max(0, f.gapMm + d[0]), f.offsetMm + d[1]))
        setNote(settled.note)
        return settled.f
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, sideways])

  const shopItem = (id: ShopItemId) => {
    const r = tryItem(fx, id)
    play(id === 'hammer' ? 'thunk' : 'place')
    setFx(r.f)
    setNote(r.note)
  }
  const redoFit = () => {
    play('click')
    setFx(startFixture(seed + 1))
    setNote(null)
    setPhase('fit')
  }

  const helmetDown = () => {
    play('whoosh')
    setPhase('weld')
    setHelmet(true)
  }
  const helmetUp = () => {
    play('whoosh')
    setHelmet(false)
    setArc(false)
    setVersion((v) => v + 1)
    if (bead.current.arcSeconds > 0) setPhase('inspect')
  }
  const chooseGrit = (g: Grit) => {
    play('select')
    setGrit(g)
    if (!finish.current) finish.current = startFinish(bead.current)
    setSanded(snapshot(finish.current))
    setPhase('sand')
  }
  const finishJoint = () => {
    if (!finish.current) return
    const r = scoreWeld(fx, bead.current, finish.current)
    setReport(r)
    setPhase('done')
    play(r.quality >= 0.95 ? 'chime' : 'buzz')
    onSave(r, fx)
  }

  const step = STEP_OF[phase]
  const stepState = (i: number) => (i < step ? 'done' : i === step ? 'now' : 'later')
  const sandedEnough = (sanded?.worn ?? 0) > 0.5
  const cursor =
    phase === 'fit' ? (dragging ? 'grabbing' : 'grab') : phase === 'clamp' ? 'copy' : phase === 'weld' && helmet ? 'none' : phase === 'sand' && grit !== null ? 'none' : 'default'

  return (
    <div
      className="absolute inset-0 z-10 overflow-hidden rounded-2xl bg-[#e9ebe4] transition duration-300 ease-out"
      style={{ opacity: shown ? 1 : 0, transform: shown ? 'scale(1)' : 'scale(1.06)' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Through the helmet's lens: everything goes green, and dark the instant the arc strikes. */}
      <div
        className="absolute inset-0"
        style={{
          cursor,
          filter: !helmet ? 'none' : arc ? 'sepia(1) hue-rotate(50deg) saturate(1.8) contrast(1.25)' : 'sepia(0.85) hue-rotate(50deg) saturate(1.5) brightness(0.55)',
          transition: `filter ${helmet ? 60 : 250}ms linear ${helmet && !arc ? '220ms' : '0ms'}`,
        }}
      >
        <WorldErrorBoundary>
          <Canvas dpr={[1, 1.75]} camera={{ position: CAM_START.toArray(), fov: 30 }}>
            <CameraIntro />
            <BenchLights dim={!helmet ? 1 : arc ? 0.06 : 0.2} />
            {!sideways && <Bench />}
            <group rotation={[0, 0, turn]}>
              <Tubes gapU={gapU} offU={offU} highlight={phase === 'fit'} dragging={dragging} />
              <ShopProps fixture={fx} gapU={gapU} offU={offU} />
              {fx.clamps.map((c, i) => c !== null && <ClampModel key={i} x={c} axisY={i === 1 ? offU : 0} />)}
              {phase === 'clamp' && hover && <ClampModel x={hover.x} axisY={hover.side === 1 ? offU : 0} ghost />}
              <BeadView beadRef={bead} finishRef={finish} live={arc} version={version} />
              {phase === 'weld' && helmet && <Torch rigRef={rig} beadRef={bead} fixture={fx} sizzleRef={sizzle} turn={turn} />}
              {phase === 'sand' && grit !== null && <Grinder rigRef={rig} grit={grit} grindRef={grind} />}
            </group>
            <Sparks rigRef={rig} turn={turn} />
            <PointerRig handlersRef={handlers} gapU={gapU} offU={offU} turn={turn} />
          </Canvas>
        </WorldErrorBoundary>
      </div>

      {/* The checklist */}
      <div className="absolute bottom-3 left-3 top-3 z-10 flex w-[262px] flex-col rounded-2xl bg-white/95 shadow-lg ring-1 ring-black/10">
        <div className="flex items-start justify-between gap-2 border-b border-line px-3 py-2.5">
          <div>
            <div className="flex items-center gap-1.5 font-display text-sm font-bold">
              <Flame className="size-4 text-rust" /> Welding checklist
            </div>
            <div className="font-mono text-[11px] text-ink/55">{JOINTS[joint].label}</div>
          </div>
          <button type="button" onClick={onClose} title="Back to the frame" className="grid size-7 place-items-center rounded-lg text-ink/60 hover:bg-paper">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain p-2.5">
          {report ? (
            <ResultCard report={report} onClose={onClose} onRedo={onRedo} />
          ) : (
            <>
              <Step n={1} title="Line up the tubes" state={stepState(0)}>
                <p>
                  Drag the loose tube ({sideways ? 'bottom' : 'right'}) so its end meets the fixed tube and lines up with it. This one won’t stay where you put it, and
                  there’s no jig for this joint: only what’s on the shop shelf below.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <Gauge label="Gap at the ends" value={fx.gapMm} />
                  <Gauge label="Out of line by" value={Math.abs(fx.offsetMm)} />
                </div>
                {note && <p className="mt-1.5 rounded-lg bg-white px-2 py-1 text-[11px] leading-snug text-ink/80 ring-1 ring-line">{note}</p>}
                <Btn onClick={() => (play('place'), setPhase('clamp'))}>Tubes lined up</Btn>
              </Step>
              <Step n={2} title="Clamp both tubes" state={stepState(1)}>
                <p>Click a spot on each tube to clamp it down. Click again to move a clamp. When the clamps are on, the tape and anything in the gap come out.</p>
                <p className="mt-1.5 font-mono text-[11px] text-ink/55">Clamps on: {fx.clamps.filter((c) => c !== null).length} / 2</p>
                <Btn disabled={fx.clamps.some((c) => c === null)} onClick={() => (play('place'), setFx(clampUp), setPhase('weld'))}>
                  Clamps are on
                </Btn>
              </Step>
              <Step n={3} title="Weld the seam" state={stepState(2)}>
                {phase === 'inspect' ? (
                  <>
                    <p>Helmet up. This is the bead you laid.</p>
                    <div className="mt-2 flex gap-1.5">
                      <Btn tone="quiet" onClick={helmetDown}>
                        Weld more
                      </Btn>
                      <Btn onClick={() => (play('place'), setPhase('grit'))}>Bead is done</Btn>
                    </div>
                  </>
                ) : (
                  <>
                    <p>Put the helmet down. Hold the mouse button at one end of the seam and pull the torch to the other end in one smooth, continuous stroke:</p>
                    <p className="mt-1.5 rounded-lg bg-white px-2 py-1.5 font-semibold text-ink ring-1 ring-line">
                      {sideways ? 'Straight across, left to right or right to left.' : 'Straight down or straight up.'}
                    </p>
                    <p className="mt-1.5">Don’t stop and don’t go back over the weld. The arc’s glare hides the spot right under the torch.</p>
                    <Btn onClick={helmetDown}>Helmet down</Btn>
                    {prepared && fx === prepared && (
                      <p className="mt-2 text-[11px] text-ink/60">
                        Same fit-up and clamps as last time.{' '}
                        <button type="button" onClick={redoFit} className="font-semibold text-forest underline">
                          Redo the fit-up
                        </button>
                      </p>
                    )}
                  </>
                )}
              </Step>
              <Step n={4} title="Choose a sanding grit" state={stepState(3)}>
                <p>A lower number is a coarser disc.</p>
                <GritPicker value={grit} onPick={chooseGrit} />
              </Step>
              <Step n={5} title="Sand the bead down" state={stepState(4)}>
                <p>Hold the mouse button and scrub the disc across the bead.</p>
                {sanded && <Profile snap={sanded} ends={sideways ? ['left', 'right'] : ['bottom', 'top']} />}
                <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink/50">Disc</div>
                <GritPicker value={grit} onPick={chooseGrit} compact />
                <Btn disabled={!sandedEnough} onClick={finishJoint}>
                  Finish the joint
                </Btn>
              </Step>
            </>
          )}
        </div>
      </div>

      {/* The shop shelf: odds and ends from around the shop, none made for this job. */}
      {phase === 'fit' && (
        <div className="absolute bottom-3 left-[286px] right-3 z-10 rounded-2xl bg-white/95 p-2 shadow-lg ring-1 ring-black/10">
          <div className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wider text-ink/50">Shop shelf · click a thing to try it on the joint, again to take it off</div>
          <div className="grid grid-cols-7 gap-1">
            {SHOP.map((item) => {
              const on = (item.id === 'angle' && fx.angle) || (item.id === 'tape' && fx.taped) || fx.spacer === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => shopItem(item.id)}
                  className={`btn-press rounded-lg px-1.5 py-1 text-left ring-1 ${on ? 'bg-mint ring-2 ring-forest' : 'bg-paper ring-line hover:bg-white'}`}
                >
                  <span className="block text-[11px] font-bold leading-tight text-ink">{item.name}</span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-ink/60">{item.blurb}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Helmet down={helmet} arc={arc} struck={struck} sideways={sideways} onLift={helmetUp} />
    </div>
  )
}

// ---------------------------------------------------------------- checklist UI

function Step({ n, title, state, children }: { n: number; title: string; state: 'done' | 'now' | 'later'; children: ReactNode }) {
  return (
    <div className={`rounded-xl px-2.5 py-2 ${state === 'now' ? 'bg-mint ring-1 ring-forest/30' : ''}`}>
      <div className={`flex items-center gap-2 text-[13px] font-semibold ${state === 'later' ? 'text-ink/40' : 'text-ink'}`}>
        <span
          className={`grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold ${
            state === 'done' ? 'bg-forest text-white' : state === 'now' ? 'bg-ink text-white' : 'bg-paper text-ink/50 ring-1 ring-line'
          }`}
        >
          {state === 'done' ? <Check className="size-3" /> : n}
        </span>
        {title}
      </div>
      {state === 'now' && <div className="mt-1.5 pl-7 text-xs leading-snug text-ink/70">{children}</div>}
    </div>
  )
}

function Btn({ children, onClick, disabled, tone = 'solid' }: { children: ReactNode; onClick(): void; disabled?: boolean; tone?: 'solid' | 'quiet' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`btn-press mt-2 w-full rounded-lg px-3 py-1.5 font-display text-[13px] font-bold disabled:opacity-40 ${
        tone === 'solid' ? 'bg-forest text-white hover:bg-forest-dark' : 'bg-white text-ink ring-1 ring-line hover:bg-paper'
      }`}
    >
      {children}
    </button>
  )
}

function Gauge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-2 py-1 ring-1 ring-line">
      <div className="text-[10px] leading-tight text-ink/55">{label}</div>
      <div className="font-mono text-[13px] font-semibold tabular text-ink">{value.toFixed(1)} mm</div>
    </div>
  )
}

function GritPicker({ value, onPick, compact }: { value: Grit | null; onPick(g: Grit): void; compact?: boolean }) {
  return (
    <div className={`grid gap-1 ${compact ? 'mt-1 grid-cols-4' : 'mt-2 grid-cols-2'}`}>
      {GRITS.map((g) => (
        <button
          key={g.grit}
          type="button"
          onClick={() => onPick(g.grit)}
          className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left ring-1 ${value === g.grit ? 'bg-white ring-2 ring-forest' : 'bg-white/70 ring-line hover:bg-white'}`}
        >
          <span className="size-3.5 shrink-0 rounded-full" style={{ background: GRIT_COLOR[g.grit] }} />
          <span className="leading-tight">
            <span className="block font-mono text-[11px] font-bold text-ink">{g.grit}</span>
            {!compact && <span className="block text-[10px] text-ink/55">{g.name}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Side view of the seam: how far the bead stands above the tube (and any cut below it). */
interface Snapshot {
  height: number[]
  dig: number[]
  worn: number
}
const snapshot = (f: Finish): Snapshot => ({ height: [...f.height], dig: [...f.dig], worn: f.worn.reduce((s, w) => s + w, 0) })

function Profile({ snap, ends }: { snap: Snapshot; ends: [string, string] }) {
  const W = 216
  const H = 58
  const base = 36
  const px = 11 // per mm
  const pts = snap.height.map((h, i) => [6 + (i / (SEAM_CELLS - 1)) * (W - 12), base - h * px + snap.dig[i] * px] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const high = Math.max(...snap.height)
  const dig = Math.max(...snap.dig)
  return (
    <div className="mt-2 rounded-lg bg-white p-1.5 ring-1 ring-line">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Seam profile, side view</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-0.5 w-full">
        <path d={`${line} L${W - 6} ${base} L6 ${base} Z`} fill="#d8d2bd" />
        <path d={line} fill="none" stroke="#1b2a20" strokeWidth={1.4} />
        <line x1={2} x2={W - 2} y1={base} y2={base} stroke="#74a85f" strokeWidth={1} strokeDasharray="3 2" />
        <text x={W - 4} y={base + 10} textAnchor="end" fontSize={8} fill="#6b756e">
          tube surface
        </text>
        <text x={4} y={H - 2} fontSize={8} fill="#6b756e">
          {ends[0]}
        </text>
        <text x={W - 4} y={H - 2} textAnchor="end" fontSize={8} fill="#6b756e" dy={-0.1}>
          {ends[1]}
        </text>
      </svg>
      <div className="font-mono text-[11px] text-ink/70">
        Highest point: {high.toFixed(1)} mm above the tube{dig > 0.05 ? ` · cut ${dig.toFixed(1)} mm into the tube` : ''}
      </div>
    </div>
  )
}

function ResultCard({ report, onClose, onRedo }: { report: WeldReport; onClose(): void; onRedo(): void }) {
  const solid = report.quality >= 0.95
  return (
    <div className="animate-rise space-y-2 p-1">
      <div className={`rounded-xl px-3 py-2.5 ${solid ? 'bg-mint' : 'bg-[#fbf3dc]'}`}>
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink/55">Joint strength</div>
        <div className="flex items-baseline justify-between">
          <span className={`font-display text-2xl font-bold ${solid ? 'text-forest' : 'text-[#7a5a10]'}`}>{Math.round(report.quality * 100)}%</span>
          <span className="text-xs font-semibold text-ink/70">{report.label}</span>
        </div>
      </div>
      <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-line">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink/55">Craftsmanship</div>
        <div className="text-xs leading-snug text-ink/80">{LOOKS_TEXT[report.looks]}</div>
      </div>
      <ul className="space-y-1 text-xs leading-snug text-ink/75">
        {weldFacts(report).map((f) => (
          <li key={f} className="flex gap-1.5">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink/40" />
            {f}
          </li>
        ))}
      </ul>
      <Btn onClick={onClose}>Back to the frame</Btn>
      <button type="button" onClick={onRedo} className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-semibold text-forest underline">
        <RotateCcw className="size-3.5" /> Grind it out and weld it again
      </button>
    </div>
  )
}

/** The welding helmet: drops over the screen; its lens darkens the instant the arc strikes. */
function Helmet({ down, arc, struck, sideways, onLift }: { down: boolean; arc: boolean; struck: boolean; sideways: boolean; onLift(): void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl">
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          transform: down ? 'translateY(0)' : 'translateY(-104%)',
          transition: 'transform 420ms cubic-bezier(0.25, 0.9, 0.3, 1.04)',
        }}
      >
        {/* Shell + lens: everything outside the lens is the inside of the helmet. */}
        <div
          className="absolute"
          style={{
            left: '30%',
            width: '58%',
            top: '16%',
            height: '68%',
            borderRadius: 22,
            border: '7px solid #262b27',
            boxShadow: '0 0 0 9999px #0b0e0c, inset 0 0 50px rgba(0,0,0,0.85)',
          }}
        />
        <div className="absolute inset-x-0 top-[5%] text-center font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
          {arc ? '' : struck ? 'arc off' : `one smooth stroke · ${sideways ? 'straight across' : 'straight down or straight up'} · hold the mouse button to strike the arc`}
        </div>
        <div className="absolute inset-x-0 bottom-[4.5%] flex justify-center">
          {!arc && (
            <button
              type="button"
              onClick={onLift}
              className="btn-press pointer-events-auto rounded-xl bg-white/95 px-4 py-2 font-display text-sm font-bold text-ink shadow-lg hover:bg-white"
            >
              Lift the helmet
            </button>
          )}
        </div>
        <div className="absolute bottom-[1.5%] left-[30%] font-mono text-[9px] uppercase tracking-[0.2em] text-white/25">auto-darkening lens · shade 11</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 3D

function PointerRig({ handlersRef, gapU, offU, turn }: { handlersRef: MutableRefObject<Handlers>; gapU: number; offU: number; turn: number }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const geo = useRef({ gapU, offU, turn })
  useEffect(() => {
    geo.current = { gapU, offU, turn }
  })
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const pick = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const local = ray.ray.clone()
      local.origin.applyAxisAngle(Z_AXIS, -geo.current.turn)
      local.direction.applyAxisAngle(Z_AXIS, -geo.current.turn)
      return pickBench(local, geo.current.gapU, geo.current.offU)
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      el.setPointerCapture(e.pointerId)
      handlersRef.current.down(pick(e))
    }
    const move = (e: PointerEvent) => handlersRef.current.move(pick(e))
    const up = (e: PointerEvent) => {
      if (e.button === 0) handlersRef.current.up()
    }
    const leave = () => handlersRef.current.leave()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl, camera, handlersRef])
  return null
}

/** The camera dollies in on the joint when the bench opens. */
function CameraIntro() {
  const camera = useThree((s) => s.camera)
  const t = useRef(0)
  useFrame((_, dt) => {
    if (t.current >= 1) return
    t.current = Math.min(1, t.current + dt / 0.9)
    const e = 1 - (1 - t.current) ** 3
    camera.position.lerpVectors(CAM_START, CAM_END, e)
    camera.lookAt(LOOK_AT)
  })
  return null
}

/** Shop lights; `dim` drops toward 0 under the helmet so only the arc lights the work. */
function BenchLights({ dim }: { dim: number }) {
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const level = useRef(1)
  const bg = useRef<THREE.Color>(null)
  const day = useMemo(() => new THREE.Color('#e9ebe4'), [])
  const dark = useMemo(() => new THREE.Color('#040504'), [])
  useFrame((_, dt) => {
    level.current += (dim - level.current) * (1 - Math.exp(-dt * 16))
    const l = level.current
    if (hemi.current) hemi.current.intensity = 1.15 * l
    if (sun.current) sun.current.intensity = 1.6 * l
    bg.current?.copy(dark).lerp(day, Math.min(1, l))
  })
  return (
    <>
      <color ref={bg} attach="background" args={['#e9ebe4']} />
      <hemisphereLight ref={hemi} args={['#ffffff', '#b9bcb2', 1.15]} />
      <directionalLight ref={sun} position={[3, 6, 8]} intensity={1.6} />
    </>
  )
}

const STEEL = { color: '#a9aea9', metalness: 0.5, roughness: 0.34 } as const

function Bench() {
  return (
    <group>
      <mesh position={[0, -1.56, -0.5]}>
        <boxGeometry args={[18, 0.14, 6]} />
        <meshStandardMaterial color="#6d726c" metalness={0.3} roughness={0.7} />
      </mesh>
    </group>
  )
}

function VBlock({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, y, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, -1.05, s * 0.55]} rotation={[s * 0.6, 0, 0]}>
          <boxGeometry args={[0.8, 0.5, 0.6]} />
          <meshStandardMaterial color="#2c5b3c" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, -1.3, 0]}>
        <boxGeometry args={[0.8, 0.4, 1.7]} />
        <meshStandardMaterial color="#2c5b3c" roughness={0.6} />
      </mesh>
    </group>
  )
}

function Tubes({ gapU, offU, highlight, dragging }: { gapU: number; offU: number; highlight: boolean; dragging: boolean }) {
  const [hot, setHot] = useState(false)
  const glow = highlight && (hot || dragging)
  const fixedX = -gapU / 2 - TUBE_LEN / 2
  const looseX = gapU / 2 + TUBE_LEN / 2
  return (
    <group>
      <mesh position={[fixedX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1, 1, TUBE_LEN, 48]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[looseX, offU, 0]} rotation={[0, 0, Math.PI / 2]} onPointerOver={() => setHot(true)} onPointerOut={() => setHot(false)}>
        <cylinderGeometry args={[1, 1, TUBE_LEN, 48]} />
        <meshStandardMaterial {...STEEL} emissive="#2c5b3c" emissiveIntensity={glow ? 0.35 : 0} />
      </mesh>
      {/* Dark rims at the tube ends: the seam line. */}
      <mesh position={[-gapU / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1, 0.014, 6, 64]} />
        <meshStandardMaterial color="#2a2d2b" />
      </mesh>
      <mesh position={[gapU / 2, offU, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1, 0.014, 6, 64]} />
        <meshStandardMaterial color="#2a2d2b" />
      </mesh>
      <VBlock x={-2.1} y={0} />
      <VBlock x={-4.4} y={0} />
      <VBlock x={2.1} y={offU} />
      <VBlock x={4.4} y={offU} />
    </group>
  )
}

/** Shop items in use on the joint: angle iron cradling the tubes, a spacer in the gap, tape round it. */
function ShopProps({ fixture, gapU, offU }: { fixture: Fixture; gapU: number; offU: number }) {
  const legDir = Math.SQRT1_2
  const spacer = fixture.spacer ? SHOP_BY_ID[fixture.spacer] : null
  const thick = spacer ? spacer.thickMm! / MM_PER_UNIT : 0
  return (
    <group>
      {fixture.angle && (
        // A 90° angle: both round tubes sit in its corner, so their centers land on one line.
        <group position={[0, -Math.SQRT2, 0]}>
          {[1, -1].map((s) => (
            <mesh key={s} position={[0, legDir * 0.55, s * legDir * 0.55]} rotation={[s * (Math.PI / 4), 0, 0]}>
              <boxGeometry args={[3.2, 0.08, 1.1]} />
              <meshStandardMaterial color="#6f6a60" metalness={0.5} roughness={0.6} />
            </mesh>
          ))}
        </group>
      )}
      {spacer && fixture.spacer === 'coin' && (
        <mesh position={[0, 0.9, 0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.95, 0.95, thick, 32]} />
          <meshStandardMaterial color="#b9bbb6" metalness={0.8} roughness={0.3} />
        </mesh>
      )}
      {spacer && fixture.spacer !== 'coin' && (
        // A rod standing up in the gap, poking out above the tubes.
        <mesh position={[0, 0.9, 0.55]}>
          <cylinderGeometry args={[thick / 2, thick / 2, 1.6, fixture.spacer === 'pencil' ? 6 : 12]} />
          <meshStandardMaterial
            color={fixture.spacer === 'pencil' ? '#d9a52b' : fixture.spacer === 'wire' ? '#b8743a' : '#8d918c'}
            metalness={fixture.spacer === 'pencil' ? 0 : 0.8}
            roughness={0.35}
          />
        </mesh>
      )}
      {fixture.taped && (
        <mesh position={[0, offU / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.035, 1.035, Math.max(0.9, gapU + 0.9), 40, 1, true]} />
          <meshStandardMaterial color="#a3a6a1" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

/** A toggle clamp pressing down on the top of a tube at `x`. */
function ClampModel({ x, axisY, ghost = false }: { x: number; axisY: number; ghost?: boolean }) {
  const m = (color: string, metal = 0.2) => <meshStandardMaterial color={color} metalness={metal} roughness={0.5} transparent={ghost} opacity={ghost ? 0.45 : 1} depthWrite={!ghost} />
  return (
    <group position={[x, axisY, 0]}>
      <mesh position={[0, 1.07, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.14, 24]} />
        {m('#2a2d2b')}
      </mesh>
      <mesh position={[0, 1.36, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.46, 10]} />
        {m('#9aa09a', 0.7)}
      </mesh>
      <mesh position={[0, 1.6, -0.85]}>
        <boxGeometry args={[0.2, 0.16, 1.9]} />
        {m('#2c5b3c')}
      </mesh>
      <mesh position={[0, 0.2, -1.75]}>
        <boxGeometry args={[0.24, 2.9, 0.24]} />
        {m('#3a3f3c')}
      </mesh>
      <mesh position={[0, 1.95, -1.45]} rotation={[-0.6, 0, 0]}>
        <boxGeometry args={[0.15, 0.15, 0.9]} />
        {m('#1b2a20')}
      </mesh>
    </group>
  )
}

const BEAD_COLOR = {
  cold: new THREE.Color('#8b8f89'),
  good: new THREE.Color('#c4bba3'),
  hot: new THREE.Color('#86663f'),
  burned: new THREE.Color('#231b16'),
} as const
const BRIGHT = new THREE.Color('#e2e5df')
const GROUND = new THREE.Color('#d3d6d0')
const SCRATCHED = new THREE.Color('#9fa39d')
const PER_CELL = 2

const PILED = new THREE.Color('#6f6c64')
const SPATTER_N = 160
const STRAY_N = 80

/**
 * The bead, the sanded patch around it, spatter balls and arc marks. While the arc burns it is
 * repainted every few frames, so the bead grows behind the torch.
 */
function BeadView({ beadRef, finishRef, live, version }: { beadRef: MutableRefObject<Bead>; finishRef: MutableRefObject<Finish | null>; live: boolean; version: number }) {
  const blobs = useRef<THREE.InstancedMesh>(null)
  const patch = useRef<THREE.InstancedMesh>(null)
  const spatter = useRef<THREE.InstancedMesh>(null)
  const marks = useRef<THREE.InstancedMesh>(null)
  const frame = useRef(0)

  const paint = () => {
    const b = beadRef.current
    const f = finishRef.current
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    const X = new THREE.Vector3()
    const T = new THREE.Vector3()
    const N = new THREE.Vector3()
    const zero = new THREE.Matrix4().makeScale(0, 0, 0)
    const onTube = (x: number, y: number, s: number, out: THREE.InstancedMesh, i: number) => {
      const yy = Math.max(-0.99, Math.min(0.99, y))
      m.makeScale(s, s, s * 0.6)
      m.setPosition(x, yy, Math.sqrt(1 - yy * yy))
      out.setMatrixAt(i, m)
    }
    for (let i = 0; i < SEAM_CELLS; i++) {
      const kind = spotKind(b.heat[i])
      const lumps = Math.min(b.lumps[i], 2)
      const h0 = f ? Math.max(0, f.height[i]) : null
      for (let k = 0; k < PER_CELL; k++) {
        const idx = i * PER_CELL + k
        const y = Math.max(-0.985, Math.min(0.985, cellY(i) + (k - 0.5) * (1 / SEAM_CELLS)))
        const z = Math.sqrt(1 - y * y)
        N.set(0, y, z)
        T.set(0, z, -y)
        if (kind === 'gap') {
          blobs.current?.setMatrixAt(idx, zero)
          continue
        }
        const heat = Math.min(b.heat[i], 3)
        // A clean stroke is an even bead; metal laid over metal heaps up in ugly, uneven blobs.
        const lumpy = 1 + 0.04 * Math.sin(i * 2.3 + k * 1.7) + lumps * 0.45 * Math.abs(Math.sin(i * 5.1 + k * 3.3))
        const width = (kind === 'cold' ? 0.075 : 0.1 + 0.035 * heat) * lumpy
        const startH = 0.5 + 0.45 * heat + 0.9 * lumps
        const hMm = h0 ?? startH
        const height = Math.max(0.006, (hMm / MM_PER_UNIT) * 1.9) * (kind === 'burned' ? 0.4 : 1) * (1 + lumps * 0.3 * Math.sin(i * 3.7 + k))
        X.set(width, lumps * 0.03 * Math.sin(i * 1.9 + k * 2.9), 0)
        m.makeBasis(X, T.clone().multiplyScalar((1 / SEAM_CELLS) * (2.2 - lumps * 0.4)), N.clone().multiplyScalar(height))
        m.setPosition(N.x + lumps * 0.03 * Math.sin(i * 4.3 + k), N.y, N.z)
        blobs.current?.setMatrixAt(idx, m)
        c.copy(BEAD_COLOR[kind]).lerp(PILED, Math.min(1, lumps / (LUMPY * 2)))
        if (f) c.lerp(BRIGHT, Math.min(1, (startH - hMm) / Math.max(0.2, startH)) * 0.9)
        blobs.current?.setColorAt(idx, c)
      }
      // The ground patch where the disc has worked.
      const worn = f?.worn[i] ?? 0
      if (patch.current) {
        if (worn > 0.03) {
          const y = cellY(i)
          const z = Math.sqrt(Math.max(0, 1 - y * y))
          N.set(0, y, z)
          T.set(0, z, -y)
          m.makeBasis(new THREE.Vector3(0.6, 0, 0), T.clone().multiplyScalar((1 / SEAM_CELLS) * 1.1), N.clone().multiplyScalar(0.004))
          m.setPosition(N.x * 1.002, N.y * 1.002, N.z * 1.002)
          patch.current.setMatrixAt(i, m)
          patch.current.setColorAt(i, f?.scratched ? SCRATCHED : GROUND)
        } else patch.current.setMatrixAt(i, zero)
      }
    }
    // Spatter balls stuck to the tube; sanding near the seam knocks them off.
    if (spatter.current) {
      for (let i = 0; i < SPATTER_N; i++) {
        const s = b.spatter[i]
        if (!s || (f && Math.abs(s.x) < 0.6 && (f.worn[Math.min(SEAM_CELLS - 1, Math.max(0, Math.floor(((s.y + 1) / 2) * SEAM_CELLS)))] ?? 0) > 0.2))
          spatter.current.setMatrixAt(i, zero)
        else onTube(s.x, s.y, 0.022 + 0.025 * Math.abs(Math.sin(i * 7.7)), spatter.current, i)
      }
      spatter.current.instanceMatrix.needsUpdate = true
    }
    if (marks.current) {
      for (let i = 0; i < STRAY_N; i++) {
        const s = b.stray[i]
        if (!s) marks.current.setMatrixAt(i, zero)
        else onTube(s.x, s.y, 0.03, marks.current, i)
      }
      marks.current.instanceMatrix.needsUpdate = true
    }
    for (const mesh of [blobs.current, patch.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }

  useLayoutEffect(() => paint(), [beadRef, finishRef, version]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    if (live && frame.current++ % 3 === 0) paint()
  })

  return (
    <group>
      <instancedMesh ref={patch} args={[undefined, undefined, SEAM_CELLS]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial metalness={0.75} roughness={0.25} />
      </instancedMesh>
      <instancedMesh ref={blobs} args={[undefined, undefined, SEAM_CELLS * PER_CELL]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial metalness={0.55} roughness={0.38} />
      </instancedMesh>
      <instancedMesh ref={spatter} args={[undefined, undefined, SPATTER_N]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#8a8780" metalness={0.5} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={marks} args={[undefined, undefined, STRAY_N]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshStandardMaterial color="#3f3c36" roughness={0.8} />
      </instancedMesh>
    </group>
  )
}

const Y_AXIS = new THREE.Vector3(0, 1, 0)
/** The gun comes in from the welder's upper right (`turn`: the bench model's quarter turn, if any). */
const toolDir = (n: THREE.Vector3, turn: number, out: THREE.Vector3) => out.copy(n).add(new THREE.Vector3(0.35, 0.45, 0).applyAxisAngle(Z_AXIS, -turn)).normalize()

/** A soft round glow: white in the middle, fading out to nothing. */
function glareTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  if (g) {
    const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    r.addColorStop(0, 'rgba(255,255,250,1)')
    r.addColorStop(0.35, 'rgba(255,250,232,0.97)')
    r.addColorStop(0.6, 'rgba(255,236,190,0.55)')
    r.addColorStop(1, 'rgba(255,220,160,0)')
    g.fillStyle = r
    g.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(canvas)
}

/** The MIG gun and its arc. While the button is held on the metal, the arc heats the seam. */
function Torch({ rigRef, beadRef, fixture, sizzleRef, turn }: { rigRef: MutableRefObject<Rig>; beadRef: MutableRefObject<Bead>; fixture: Fixture; sizzleRef: { current: Loop }; turn: number }) {
  const gun = useRef<THREE.Group>(null)
  const glow = useRef<THREE.Mesh>(null)
  const glare = useRef<THREE.Sprite>(null)
  const glareMap = useMemo(() => glareTexture(), [])
  useEffect(() => () => glareMap.dispose(), [glareMap])
  const light = useRef<THREE.PointLight>(null)
  const d = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const last = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => () => void (rigRef.current.emit = 0), [rigRef])
  useFrame((_, dt) => {
    const r = rigRef.current
    const live = r.held && r.onTube && onMetal(r.x, r.y)
    // Frame-rate independent: lay the heat along the path the torch moved since the last frame,
    // in 1/60 s steps (a slow laptop drawing 15 frames a second welds the same as a fast one).
    const from = last.current
    if (live) {
      const span = Math.min(dt, 0.25)
      const steps = Math.max(1, Math.ceil(span * 60))
      for (let k = 1; k <= steps; k++) {
        const a = from ? k / steps : 1
        arcHeat(beadRef.current, fixture, from ? from.x + (r.x - from.x) * a : r.x, from ? from.y + (r.y - from.y) * a : r.y, span / steps)
      }
      last.current = { x: r.x, y: r.y }
    } else last.current = null
    r.emit = live ? 140 : 0
    sizzleRef.current.set(live ? 0.75 + Math.random() * 0.25 : 0)
    toolDir(r.n, turn, d)
    if (gun.current) {
      gun.current.visible = r.over
      gun.current.position.copy(r.p).addScaledVector(d, 0.06)
      gun.current.quaternion.copy(q.setFromUnitVectors(Y_AXIS, d))
    }
    const flick = 0.8 + Math.random() * 0.4
    if (glow.current) {
      glow.current.visible = live
      glow.current.position.copy(r.p).addScaledVector(r.n, 0.03)
      glow.current.scale.setScalar(0.07 * flick)
    }
    // The arc is too bright to look at: its glare covers the puddle and the spot under the torch.
    if (glare.current) {
      glare.current.visible = live
      glare.current.position.copy(r.p).addScaledVector(r.n, 0.25)
      glare.current.scale.setScalar(1.15 * (0.92 + 0.16 * Math.random()))
    }
    if (light.current) {
      light.current.intensity = live ? 7 * flick : 0
      light.current.position.copy(r.p).addScaledVector(r.n, 0.35)
    }
  })
  return (
    <>
      <group ref={gun}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.12, 10]} />
          <meshStandardMaterial color="#b98a3c" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.13, 0.09, 0.5, 18]} />
          <meshStandardMaterial color="#8d918c" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.8, 18]} />
          <meshStandardMaterial color="#1f2421" roughness={0.6} />
        </mesh>
      </group>
      <mesh ref={glow}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color="#fffbea" toneMapped={false} />
      </mesh>
      <sprite ref={glare} renderOrder={10}>
        <spriteMaterial map={glareMap} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
      <pointLight ref={light} color="#ffe0b0" intensity={0} distance={4} decay={1.6} />
    </>
  )
}

/** A flap disc on an angle grinder, spinning against the work. */
function Grinder({ rigRef, grit, grindRef }: { rigRef: MutableRefObject<Rig>; grit: Grit; grindRef: { current: Loop } }) {
  const tool = useRef<THREE.Group>(null)
  const disc = useRef<THREE.Mesh>(null)
  const q = useMemo(() => new THREE.Quaternion(), [])
  useEffect(() => () => void (rigRef.current.emit = 0), [rigRef])
  useFrame((_, dt) => {
    const r = rigRef.current
    r.sandLevel *= Math.exp(-dt * 8)
    const biting = r.held && r.onTube && r.sandLevel > 0.02
    r.emit = biting ? 40 + 120 * r.sandLevel : 0
    grindRef.current.set(r.held ? 0.35 + 0.65 * r.sandLevel : 0.15)
    if (!tool.current) return
    tool.current.visible = r.over
    tool.current.position.copy(r.p).addScaledVector(r.n, 0.035)
    tool.current.quaternion.copy(q.setFromUnitVectors(Y_AXIS, r.n))
    if (disc.current) disc.current.rotation.y += dt * 40
  })
  return (
    <group ref={tool}>
      <mesh ref={disc}>
        <cylinderGeometry args={[0.32, 0.32, 0.05, 28]} />
        <meshStandardMaterial color={GRIT_COLOR[grit]} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.06, 16]} />
        <meshStandardMaterial color="#9aa09a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.36, 0.42, 0.36]} />
        <meshStandardMaterial color="#2c5b3c" roughness={0.5} />
      </mesh>
      <mesh position={[0.62, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.17, 0.9, 16]} />
        <meshStandardMaterial color="#1f2421" roughness={0.6} />
      </mesh>
    </group>
  )
}

/** Sparks thrown off the arc or the sanding disc (whatever `rig.emit` asks for). */
function Sparks({ rigRef, turn }: { rigRef: MutableRefObject<Rig>; turn: number }) {
  const N = 160
  const mesh = useRef<THREE.InstancedMesh>(null)
  const rand = useMemo(() => mulberry32(77), [])
  const partsRef = useRef<{ p: THREE.Vector3; v: THREE.Vector3; life: number }[] | null>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const owed = useRef(0)
  const next = useRef(0)
  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    dt = Math.min(dt, 1 / 30)
    const r = rigRef.current
    partsRef.current ??= Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 }))
    const parts = partsRef.current
    owed.current += r.emit * dt
    while (owed.current >= 1) {
      owed.current -= 1
      const s = parts[next.current]
      next.current = (next.current + 1) % N
      s.life = 0.5 + rand() * 0.6
      // The rig is in the bench model's frame; sparks fly (and fall) in the world.
      const n = r.n.clone().applyAxisAngle(Z_AXIS, turn)
      s.p.copy(r.p).addScaledVector(r.n, 0.04).applyAxisAngle(Z_AXIS, turn)
      s.v
        .copy(n)
        .multiplyScalar(1 + rand() * 2.5)
        .add(new THREE.Vector3((rand() - 0.5) * 4, rand() * 2.2, (rand() - 0.2) * 2.5))
    }
    parts.forEach((s, i) => {
      if (s.life > 0) {
        s.life -= dt
        s.v.y -= 9 * dt
        s.p.addScaledVector(s.v, dt)
        if (s.p.y < -1.48 && s.v.y < 0) {
          s.p.y = -1.48
          s.v.y *= -0.35
          s.v.x *= 0.6
          s.v.z *= 0.6
        }
      }
      dummy.position.copy(s.p)
      // Streaks: stretched along their motion.
      const speed = s.v.length()
      dummy.scale.set(0.012, 0.012 + Math.min(0.09, speed * 0.012), 0.012).multiplyScalar(s.life > 0 ? Math.min(1, s.life * 2.5) : 0)
      if (speed > 0.01) dummy.quaternion.setFromUnitVectors(Y_AXIS, s.v.clone().normalize())
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial color="#ffc861" toneMapped={false} />
    </instancedMesh>
  )
}
