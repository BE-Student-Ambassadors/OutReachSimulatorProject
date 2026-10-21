import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Play, Wind } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { count, money } from '../../../core/format'
import { play, useLoop } from '../../../shared/audio/sfx'
import { COSTS, DIMS, FRONT_WING_BY_ID, FRONT_WINGS, getMechanical, JOINTS, upsert, type FrontWingSpec } from '../config'
import { mulberry32 } from '../sim/autonomy'
import { aeroFor, aeroForces, MS_TO_MPH } from '../sim/car'
import { REPORT_SPEED_MS } from '../sim/engine'
import type { FsaeObject, MechanicalObject } from '../types'
import { CarModel } from './CarModel'
import { lookOf, type CarLook } from './look'
import { CommitSlider, Readout, Section } from './controls'
import { WeldBench } from './WeldBench'
import type { Fixture } from '../sim/weld'
import { WorldErrorBoundary } from '../../../shell/WorldErrorBoundary'

const TUNNEL_SECONDS = 5

/** Set or clear one previewed value (a cleared key must disappear, not become undefined). */
function withPreview<K extends keyof CarLook>(p: Partial<CarLook>, key: K, v: CarLook[K] | null): Partial<CarLook> {
  const next = { ...p }
  if (v === null) delete next[key]
  else next[key] = v
  return next
}

const tunnelKey = (m: MechanicalObject) => [m.frontWing, m.rearWing, m.wheelbaseMm, m.trackMm, m.rideHeightMm].join('|')

export function MechanicalStation({ design, locked, onCommit }: { design: FsaeObject[]; locked: boolean; onCommit(next: FsaeObject[]): void }) {
  const mech = getMechanical(design)
  const [preview, setPreview] = useState<Partial<CarLook>>({})
  const look: CarLook = { ...lookOf(mech), ...preview }
  const [view, setView] = useState<'frame' | 'body'>(() => (mech.welds.every((q) => q >= 0) ? 'body' : 'frame'))
  // Clicking a joint flies the camera in to it (`zoomJoint`); on arrival the welding bench opens.
  const [zoomJoint, setZoomJoint] = useState<number | null>(null)
  const [closeUp, setCloseUp] = useState(false)
  const [benchJoint, setBenchJoint] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  /** Each joint's fit-up and clamps from its last weld, so re-welding skips straight to the torch. */
  const [fitUps, setFitUps] = useState<Record<number, Fixture>>({})
  const [lastWeld, setLastWeld] = useState<{ joint: number; label: string; q: number } | null>(null)
  const [tunnel, setTunnel] = useState<{ running: boolean; key: string | null }>({ running: false, key: null })

  const save = (patch: Partial<MechanicalObject>) => onCommit(upsert(design, { ...mech, ...patch }))
  const wind = useLoop('wind', tunnel.running)
  const latest = useRef({ mech, save })
  useEffect(() => {
    latest.current = { mech, save }
  })

  const openJoint = (i: number) => {
    if (locked || closeUp) return
    document.body.style.cursor = ''
    play('whoosh')
    setLastWeld(null)
    setCloseUp(true)
    setZoomJoint(i)
  }
  const closeBench = () => {
    setBenchJoint(null)
    setZoomJoint(null)
  }

  const runTunnel = () => {
    if (locked || tunnel.running) return
    setView('body')
    setTunnel({ running: true, key: null })
  }
  useEffect(() => {
    if (!tunnel.running) return
    wind.current.set(1)
    const t = window.setTimeout(() => {
      const { mech: m, save: s } = latest.current
      setTunnel({ running: false, key: tunnelKey(m) })
      s({ tunnelRuns: m.tunnelRuns + 1 })
    }, TUNNEL_SECONDS * 1000)
    return () => clearTimeout(t)
  }, [tunnel.running, wind])

  const welded = mech.welds.filter((q) => q >= 0).length
  const aero = aeroFor({ ...mech, ...preview })
  const forces = aeroForces(aero, REPORT_SPEED_MS)
  const measured = tunnel.key !== null
  const stale = measured && tunnel.key !== tunnelKey({ ...mech, ...preview } as MechanicalObject)
  const sizeCost = COSTS.perMmWheelbase * (look.wheelbaseMm - DIMS.wheelbase.min) + COSTS.perMmTrack * (look.trackMm - DIMS.track.min)

  return (
    <div className="flex h-full min-h-0 gap-3">
      <div className="flex w-[360px] shrink-0 flex-col gap-2.5 overflow-y-auto overscroll-contain pb-2 pr-1">
        <Section n={1} title="Weld the frame" done={welded === JOINTS.length}>
          <p className="text-xs text-ink/65">
            Click a glowing joint on the frame to weld it. Every joint goes through the welding checklist: line up, clamp, weld, sand.
          </p>
          <div className="mt-2 grid grid-cols-8 gap-1">
            {mech.welds.map((q, i) => (
              <span
                key={i}
                title={JOINTS[i].label}
                className={`h-2.5 rounded-full ${q < 0 ? 'bg-paper ring-1 ring-line' : q >= 0.95 ? 'bg-forest' : 'bg-sun'}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-ink/55">
            <span>
              {welded} / {JOINTS.length} welded
            </span>
            <span>{mech.welds.filter((q) => q >= 0.95).length} solid</span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink/55">
            Average strength: {welded ? Math.round((mech.welds.reduce((s, q) => s + Math.max(0, q), 0) / welded) * 100) : 0}%
          </div>
          {lastWeld && (
            <p className={`mt-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${lastWeld.q >= 0.95 ? 'bg-mint text-forest' : 'bg-[#fbf3dc] text-[#7a5a10]'}`}>
              {JOINTS[lastWeld.joint].label}: {lastWeld.label} ({Math.round(lastWeld.q * 100)}%)
            </p>
          )}
          {welded < JOINTS.length && view === 'body' && (
            <button type="button" onClick={() => setView('frame')} className="mt-2 text-xs font-semibold text-forest underline">
              Show the bare frame
            </button>
          )}
        </Section>

        <Section n={2} title="Choose the wings" done={mech.touchedWings}>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-ink/80">Front wing design</div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {FRONT_WINGS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      play('place')
                      save({ frontWing: w.id, touchedWings: true })
                    }}
                    onPointerEnter={() => setPreview((p) => withPreview(p, 'frontWing', w.id))}
                    onPointerLeave={() => setPreview((p) => withPreview(p, 'frontWing', null))}
                    className={`rounded-xl p-2 text-left ring-1 transition disabled:opacity-50 ${mech.frontWing === w.id ? 'bg-mint ring-2 ring-forest' : 'bg-paper ring-line hover:bg-white'}`}
                  >
                    <WingProfile wing={w} />
                    <div className="mt-1 font-display text-[13px] font-bold leading-tight">{w.label}</div>
                    <div className="text-[11px] leading-snug text-ink/60">{w.blurb}</div>
                    <div className="mt-1 font-mono text-[10px] text-ink/55">
                      {money(w.cost)} · {w.kg} kg
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <CommitSlider
              label="Rear wing"
              value={mech.rearWing}
              min={0}
              max={100}
              step={1}
              unit="% out"
              ends={['Tucked in', 'All the way out']}
              disabled={locked}
              onPreview={(v) => setPreview((p) => withPreview(p, 'rearWing', v))}
              onCommit={(v) => save({ rearWing: v, touchedWings: true })}
            />
          </div>
        </Section>

        <Section n={3} title="Size the car" done={mech.touchedSize}>
          <div className="space-y-3">
            <CommitSlider
              label="Wheelbase (front to rear axle)"
              value={mech.wheelbaseMm}
              {...DIMS.wheelbase}
              unit="mm"
              disabled={locked}
              onPreview={(v) => setPreview((p) => withPreview(p, 'wheelbaseMm', v))}
              onCommit={(v) => save({ wheelbaseMm: v, touchedSize: true })}
            />
            <CommitSlider
              label="Track width (left to right wheel)"
              value={mech.trackMm}
              {...DIMS.track}
              unit="mm"
              disabled={locked}
              onPreview={(v) => setPreview((p) => withPreview(p, 'trackMm', v))}
              onCommit={(v) => save({ trackMm: v, touchedSize: true })}
            />
            <CommitSlider
              label="Ride height (floor to ground)"
              value={mech.rideHeightMm}
              {...DIMS.rideHeight}
              unit="mm"
              disabled={locked}
              onPreview={(v) => setPreview((p) => withPreview(p, 'rideHeightMm', v))}
              onCommit={(v) => save({ rideHeightMm: v, touchedSize: true })}
            />
            <p className="font-mono text-[11px] text-ink/55">Extra tubing for size: {money(sizeCost)}</p>
          </div>
        </Section>

        <Section n={4} title="Wind tunnel" done={mech.tunnelRuns > 0}>
          <button
            type="button"
            disabled={locked || tunnel.running}
            onClick={runTunnel}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-2.5 font-display text-sm font-bold text-white hover:bg-forest-dark disabled:opacity-50"
          >
            {tunnel.running ? <Wind className="size-4 animate-pulse" /> : <Play className="size-4" />}
            {tunnel.running ? 'Air flowing…' : 'Run the wind tunnel'}
          </button>
          {measured && (
            <div className="mt-2.5">
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink/50">At {Math.round(REPORT_SPEED_MS * MS_TO_MPH)} mph</div>
              <div className="grid grid-cols-2 gap-1.5">
                <Readout label="Downforce" value={`${count(forces.downforce)} N`} />
                <Readout label="Drag" value={`${count(forces.drag)} N`} />
                <Readout label="On front axle" value={`${Math.round(aero.balance * 100)} %`} tone={aero.handling === 'neutral' ? 'good' : 'warn'} />
                <Readout label="Floor" value={aero.bottoming ? 'Scraping' : 'Clear'} tone={aero.bottoming ? 'bad' : 'ink'} />
              </div>
              <p className="mt-1.5 text-xs text-ink/70">
                {aero.handling === 'understeer'
                  ? 'Most of the downforce is on the rear: the front tires have less grip than the rear (understeer, the car runs wide in corners).'
                  : aero.handling === 'oversteer'
                    ? 'Most of the downforce is on the front: the rear tires have less grip than the front (oversteer, the back slides out in corners).'
                    : 'Front and rear grip are close to even.'}
              </p>
              {stale && <p className="mt-1 text-xs font-semibold text-[#a77c17]">Settings changed since this run.</p>}
            </div>
          )}
        </Section>
      </div>

      <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl bg-[#e9ebe4] ring-1 ring-line" onContextMenu={(e) => e.preventDefault()}>
        <WorldErrorBoundary>
          <Canvas shadows="percentage" dpr={[1, 1.75]} camera={{ position: [3.4, 2.2, 3.6], fov: 38 }}>
            <Garage />
            <CarModel
              look={look}
              frame={view === 'frame'}
              welds={mech.welds}
              activeJoint={zoomJoint}
              headlights={0.6}
              onJointDown={openJoint}
            />
            <JointZoom joint={zoomJoint} look={look} onArrive={setBenchJoint} onHome={() => setCloseUp(false)} />
            {tunnel.running && <AirFlow look={look} />}
            {(tunnel.running || measured) && view === 'body' && <ForceArrows look={look} front={forces.front} rear={forces.downforce - forces.front} drag={forces.drag} />}
            <OrbitControls makeDefault enabled={!closeUp} enablePan={false} minDistance={closeUp ? 0.1 : 2.5} maxDistance={9} maxPolarAngle={1.45} target={[0, 0.4, 0]} />
          </Canvas>
        </WorldErrorBoundary>

        <div className="absolute left-3 top-3 flex gap-1 rounded-xl bg-white/95 p-1 shadow ring-1 ring-black/10">
          {(['frame', 'body'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view === v ? 'bg-ink text-white' : 'text-ink/70 hover:bg-paper'}`}
            >
              {v === 'frame' ? 'Frame' : 'Bodywork'}
            </button>
          ))}
        </div>
        <span className="absolute right-3 top-3 rounded-lg bg-white/90 px-2 py-1 font-mono text-[10px] text-ink/55 ring-1 ring-black/5">drag to look around</span>

        {benchJoint !== null && (
          <WeldBench
            key={`${benchJoint}-${attempt}`}
            joint={benchJoint}
            seed={benchJoint * 31 + attempt + mech.welds.filter((q) => q >= 0).length}
            prepared={fitUps[benchJoint] ?? null}
            onSave={(r, fit) => {
              const { mech: m, save: s } = latest.current
              s({ welds: m.welds.map((w, i) => (i === benchJoint ? r.quality : w)) })
              setLastWeld({ joint: benchJoint, label: r.label, q: r.quality })
              setFitUps((f) => ({ ...f, [benchJoint]: fit }))
            }}
            onRedo={() => setAttempt((a) => a + 1)}
            onClose={closeBench}
          />
        )}
        {tunnel.running && (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 mx-auto w-fit rounded-xl bg-ink/85 px-4 py-2 font-mono text-xs font-bold text-mint">
            Wind tunnel: air at {Math.round(REPORT_SPEED_MS * MS_TO_MPH)} mph
          </div>
        )}
      </div>
    </div>
  )
}

/** Side view of a front wing design: its elements as curved blades. */
function WingProfile({ wing }: { wing: FrontWingSpec }) {
  const blades: string[] =
    wing.id === 'flat'
      ? ['M6 20 L58 18']
      : wing.id === 'single'
        ? ['M6 20 Q30 23 58 12']
        : wing.id === 'dual'
          ? ['M6 21 Q26 24 46 18', 'M40 13 Q50 12 58 4']
          : ['M6 22 Q24 25 42 20', 'M36 15 Q44 13 50 7', 'M47 8 Q52 4 56 -2']
  return (
    <svg viewBox="0 -4 64 30" className="h-7 w-full">
      <line x1="0" y1="26" x2="64" y2="26" stroke="#c9cbc2" strokeWidth="1" strokeDasharray="3 3" />
      {blades.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={i === 0 ? '#1b2a20' : '#2c5b3c'} strokeWidth={3} strokeLinecap="round" />
      ))}
    </svg>
  )
}

function Garage() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#c8cbbf', 1.1]} />
      <directionalLight position={[4, 7, 3]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[7, 48]} />
        <meshStandardMaterial color="#d7d9d1" />
      </mesh>
      <gridHelper args={[14, 28, '#b9bcb2', '#c9cbc2']} position={[0, 0.002, 0]} />
    </>
  )
}

/** Where joint `i` sits on the car, meters (matches CarModel). */
function jointPoint(i: number, look: CarLook) {
  const j = JOINTS[i]
  return new THREE.Vector3(j.x * (look.wheelbaseMm / 1600), look.rideHeightMm / 1000 + 0.02 + j.y * 0.85, j.z * (look.trackMm / 1200))
}

type OrbitLike = { target: THREE.Vector3; update(): void }

/**
 * Flies the camera in to a joint (then calls `onArrive`) and, when `joint` goes back to null,
 * back out to where it was (then `onHome`).
 */
function JointZoom({ joint, look, onArrive, onHome }: { joint: number | null; look: CarLook; onArrive(i: number): void; onHome(): void }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null
  const home = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const fly = useRef<{ fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3; t: number; arrive: number | null } | null>(null)
  const latest = useRef({ look, onArrive, onHome })
  useEffect(() => {
    latest.current = { look, onArrive, onHome }
  })
  useEffect(() => {
    if (!controls) return
    if (joint !== null) {
      if (!home.current) home.current = { pos: camera.position.clone(), target: controls.target.clone() }
      const p = jointPoint(joint, latest.current.look)
      const dir = camera.position.clone().sub(p).normalize()
      fly.current = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos: p.clone().addScaledVector(dir, 0.45), toTarget: p, t: 0, arrive: joint }
    } else if (home.current) {
      fly.current = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos: home.current.pos, toTarget: home.current.target, t: 0, arrive: null }
      home.current = null
    }
  }, [joint, camera, controls])
  useFrame((_, dt) => {
    const f = fly.current
    if (!f || !controls) return
    f.t = Math.min(1, f.t + Math.min(dt, 1 / 30) / 0.75)
    const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2
    camera.position.lerpVectors(f.fromPos, f.toPos, e)
    controls.target.lerpVectors(f.fromTarget, f.toTarget, e)
    controls.update()
    if (f.t < 1) return
    fly.current = null
    if (f.arrive !== null) latest.current.onArrive(f.arrive)
    else latest.current.onHome()
  })
  return null
}

/**
 * Wind tunnel smoke: particles stream from the front of the car to the back. The body and
 * wings push air upward (that push is what presses the car down); the wake behind is rough.
 */
function AirFlow({ look }: { look: CarLook }) {
  const N = 900
  const mesh = useRef<THREE.InstancedMesh>(null)
  const L = look.wheelbaseMm / 1000
  const T = look.trackMm / 1000
  const ride = look.rideHeightMm / 1000
  const f = FRONT_WING_BY_ID[look.frontWing].level
  const r = look.rearWing / 100
  const fwX = L / 2 + 0.7
  const rwX = -L / 2 - 0.28 - 0.12 * r
  const rwY = ride + 0.02 + 0.78 + 0.32 * r
  const rand = useMemo(() => mulberry32(2024), [])
  const parts = useMemo(() => Array.from({ length: N }, () => ({ x: 4 - rand() * 8, y0: 0.03 + rand() * 1.6, z0: (rand() - 0.5) * 2.2, s: 0.85 + rand() * 0.3, seed: rand() * 10 })), [rand])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const calm = useMemo(() => new THREE.Color('#9fd9b0'), [])
  const pushed = useMemo(() => new THREE.Color('#2c5b3c'), [])
  const rough = useMemo(() => new THREE.Color('#b8461b'), [])
  const t = useRef(0)

  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    t.current += dt
    const smooth = (a: number) => Math.max(0, Math.min(1, a))
    parts.forEach((p, i) => {
      p.x -= dt * 3.2 * p.s
      if (p.x < -4) {
        p.x = 4
        p.y0 = 0.03 + rand() * 1.6
        p.z0 = (rand() - 0.5) * 2.2
      }
      let y = p.y0
      let push = 0
      let wake = 0
      const inCar = Math.abs(p.z0) < 0.42
      // Over the nose and body.
      if (inCar && p.y0 < ride + 0.75) {
        const k = smooth((L / 2 + 0.7 - p.x) / 0.6) * smooth((p.x + L / 2 + 0.5) / 0.4 + 1)
        y = Math.max(y, p.y0 + (ride + 0.75 - p.y0) * k * 0.9)
      }
      // Front wing throws air up behind it.
      if (Math.abs(p.z0) < T / 2 + 0.05 && p.y0 < ride + 0.35 && p.x < fwX) {
        const k = smooth((fwX - p.x) / 0.35) * Math.exp(-Math.max(0, fwX - 0.35 - p.x) / 1.2)
        y += (0.08 + 0.4 * f) * k
        push = Math.max(push, f * k)
      }
      // Rear wing throws air up and leaves a rough wake.
      if (Math.abs(p.z0) < 0.5 && Math.abs(p.y0 - rwY) < 0.35 && p.x < rwX + 0.1) {
        const k = smooth((rwX + 0.1 - p.x) / 0.3)
        y += (0.12 + 0.6 * r) * k * Math.exp(-Math.max(0, rwX - 0.3 - p.x) / 2)
        push = Math.max(push, r * k)
      }
      if (p.x < -L / 2 - 0.2 && Math.abs(p.z0) < 0.7 && p.y0 < rwY + 0.3) {
        wake = smooth((-L / 2 - 0.2 - p.x) / 0.8) * (0.4 + 0.6 * r)
        y += Math.sin(t.current * 9 + p.seed) * 0.05 * wake
      }
      // Ground effect: air squeezed under a low floor speeds up.
      const under = inCar && p.y0 < ride + 0.02 && Math.abs(p.x) < L / 2
      dummy.position.set(p.x, Math.max(0.02, y), p.z0 + (wake ? Math.cos(t.current * 7 + p.seed) * 0.04 * wake : 0))
      dummy.scale.set(under ? 0.24 : 0.16, 0.01, 0.01)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      color.copy(calm).lerp(pushed, Math.min(1, push * 1.4)).lerp(rough, Math.min(1, wake * 0.8))
      m.setColorAt(i, color)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

function Arrow({ from, dir, length, color }: { from: [number, number, number]; dir: [number, number, number]; length: number; color: string }) {
  const { quat, mid, end } = useMemo(() => {
    const d = new THREE.Vector3(...dir).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)
    const o = new THREE.Vector3(...from)
    return { quat: q, mid: o.clone().addScaledVector(d, length / 2), end: o.clone().addScaledVector(d, length) }
  }, [from, dir, length])
  if (length < 0.02) return null
  return (
    <group>
      <mesh position={mid} quaternion={quat}>
        <cylinderGeometry args={[0.025, 0.025, length, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={end} quaternion={quat}>
        <coneGeometry args={[0.07, 0.16, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

/** Downforce on each axle (pointing down) and drag (pointing back), scaled to size. */
function ForceArrows({ look, front, rear, drag }: { look: CarLook; front: number; rear: number; drag: number }) {
  const L = look.wheelbaseMm / 1000
  const s = 1 / 900
  return (
    <group>
      <Arrow from={[L / 2, 1.0 + front * s, 0]} dir={[0, -1, 0]} length={front * s} color="#2c5b3c" />
      <Arrow from={[-L / 2, 1.0 + rear * s + 0.4, 0]} dir={[0, -1, 0]} length={rear * s} color="#2c5b3c" />
      <Arrow from={[-L / 2 - 0.7, 0.55, 0]} dir={[-1, 0, 0]} length={drag * s} color="#b8461b" />
    </group>
  )
}
