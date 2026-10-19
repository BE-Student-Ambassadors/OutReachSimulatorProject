import { Play, Rocket, Scale, Shield } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AIRFRAME_MATERIALS,
  FIN_PROFILES,
  getAirframe,
  getLaunchSetup,
  getWeightDist,
  ROCKET_BAYS,
} from '../config'
import { evaluateRocketDesign, rocketBayMassKg, speedForPressureMph } from '../sim/engine'
import type {
  AirframeMaterialId,
  FinProfileId,
  ImpulseClassId,
  NoseConeId,
  RocketBayId,
  RocketObject,
} from '../types'

function upsertObject(design: RocketObject[], nextObj: RocketObject): RocketObject[] {
  const exists = design.some((o) => o.id === nextObj.id)
  return exists ? design.map((o) => (o.id === nextObj.id ? nextObj : o)) : [...design, nextObj]
}

/** Bay height inside the rocket grows with mass, so heavy parts look heavy. */
const bayHeightPx = (massKg: number) => Math.round(24 + massKg * 2.8)

const ROCKET_BODY_W = 146

/**
 * Step 4 (Rocket Sub-Team): drag the internal bays into order inside the rocket body.
 * A side list ranks the same parts from heaviest to lightest.
 */
export function WeightDistStation({
  design,
  locked,
  onCommit,
}: {
  design: RocketObject[]
  locked: boolean
  onCommit(next: RocketObject[]): void
}) {
  const weightDist = getWeightDist(design)
  // While dragging, the order is previewed locally and only committed on release.
  const [drag, setDrag] = useState<{ id: RocketBayId; order: RocketBayId[] } | null>(null)
  const [hovered, setHovered] = useState<RocketBayId | null>(null)
  const bayEls = useRef(new Map<RocketBayId, HTMLElement>())

  const order = drag?.order ?? weightDist.bayOrder

  const evalSnap = evaluateRocketDesign(design, 'rocket-launch')
  const { stabilityCalibers, nozzleAtTail } = evalSnap.telemetry
  const stable = stabilityCalibers >= 1.2 && stabilityCalibers <= 3.2 && nozzleAtTail

  const massOf = (id: RocketBayId) => rocketBayMassKg(design, id)
  const byMass = [...weightDist.bayOrder].sort((a, b) => massOf(b) - massOf(a))
  const rankOf = (id: RocketBayId) => byMass.indexOf(id) + 1
  const heaviestKg = massOf(byMass[0])

  const commitOrder = (nextOrder: RocketBayId[]) => {
    if (locked || nextOrder.every((id, i) => id === weightDist.bayOrder[i])) return
    onCommit(
      upsertObject(design, {
        id: 'station:rocket-mass',
        kind: 'weightDist',
        bayOrder: nextOrder,
        updatedAt: weightDist.updatedAt + 1,
      }),
    )
  }

  const moveBy = (id: RocketBayId, delta: number) => {
    const from = order.indexOf(id)
    const to = from + delta
    if (to < 0 || to >= order.length) return
    const next = [...order]
    next.splice(from, 1)
    next.splice(to, 0, id)
    commitOrder(next)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, id: RocketBayId) => {
    if (locked || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ id, order: [...weightDist.bayOrder] })
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return
    const others = drag.order.filter((id) => id !== drag.id)
    // The dragged bay lands below every other bay whose midpoint the pointer has passed.
    const slot = others.filter((id) => {
      const r = bayEls.current.get(id)?.getBoundingClientRect()
      return r ? e.clientY > r.top + r.height / 2 : false
    }).length
    const next = [...others]
    next.splice(slot, 0, drag.id)
    if (next.some((id, i) => id !== drag.order[i])) setDrag({ ...drag, order: next })
  }

  const endDrag = () => {
    if (!drag) return
    commitOrder(drag.order)
    setDrag(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-forest text-white">
            <Scale className="size-5" />
          </span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink/45">
              Rocket · Step 1 of 3
            </div>
            <h2 className="font-display text-lg font-extrabold text-ink">Order the Rocket Weights</h2>
          </div>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-xs font-bold ${
            stable ? 'bg-mint text-forest' : 'bg-[#fbeee6] text-rust'
          }`}
        >
          {stable ? 'Balanced ✓' : !nozzleAtTail ? 'Engine Not at Tail' : 'Unstable'}
        </span>
      </div>

      <p className="text-sm text-ink/65">
        Drag the parts inside the rocket to change their order from nose to tail. Bigger blocks are
        heavier, and the <strong>#</strong> badge ranks them from heaviest (#1) to lightest.
      </p>

      <div className="flex items-start gap-3 rounded-2xl bg-paper p-3 ring-1 ring-line">
        {/* The rocket: nose cone, draggable bay stack, fins + nozzle */}
        <div className="flex shrink-0 flex-col items-center" style={{ width: ROCKET_BODY_W + 36 }}>
          <span className="mb-1 font-mono text-[9px] font-bold uppercase tracking-widest text-ink/40">
            ▲ Nose
          </span>
          <svg width={ROCKET_BODY_W} height={36} viewBox="0 0 150 44" preserveAspectRatio="none" className="-mb-px block">
            <path
              d="M75 2 C 105 10, 146 30, 148 44 L 2 44 C 4 30, 45 10, 75 2 Z"
              fill="white"
              stroke="var(--color-line)"
              strokeWidth={2}
            />
          </svg>

          <div
            className="relative flex flex-col gap-1 rounded-b-md border-2 border-t-0 border-line bg-white p-1"
            style={{ width: ROCKET_BODY_W }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={() => setDrag(null)}
          >
            {order.map((bayId) => {
              const spec = ROCKET_BAYS[bayId]
              const mass = massOf(bayId)
              const dragging = drag?.id === bayId
              return (
                <div
                  key={bayId}
                  ref={(el) => {
                    if (el) bayEls.current.set(bayId, el)
                    else bayEls.current.delete(bayId)
                  }}
                  role="button"
                  tabIndex={locked ? -1 : 0}
                  aria-label={`${spec.label}, ${mass.toFixed(1)} kilograms. Use arrow keys to move.`}
                  onPointerDown={(e) => onPointerDown(e, bayId)}
                  onPointerEnter={() => setHovered(bayId)}
                  onPointerLeave={() => setHovered((h) => (h === bayId ? null : h))}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') moveBy(bayId, -1)
                    else if (e.key === 'ArrowDown') moveBy(bayId, 1)
                    else return
                    e.preventDefault()
                  }}
                  title={spec.description}
                  className={`relative flex touch-none select-none items-center gap-1 overflow-hidden rounded-md px-1.5 text-white outline-none transition-[box-shadow,transform] focus-visible:ring-2 focus-visible:ring-forest ${
                    locked ? 'cursor-default' : dragging ? 'cursor-grabbing' : 'cursor-grab'
                  } ${dragging ? 'z-10 scale-[1.04] shadow-lg ring-2 ring-ink' : ''} ${
                    hovered === bayId && !dragging ? 'ring-2 ring-ink/40' : ''
                  }`}
                  style={{ height: bayHeightPx(mass), backgroundColor: spec.color }}
                >
                  <span className="grid size-4.5 shrink-0 place-items-center rounded-full bg-white/90 font-mono text-[10px] font-bold text-ink">
                    {rankOf(bayId)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-display text-[12px] font-bold leading-tight">
                    {spec.shortLabel}
                  </span>
                  <span className="font-mono text-[10px] font-semibold opacity-90">
                    {mass.toFixed(1)}
                  </span>
                </div>
              )
            })}
            {/* Fins hug the bottom of the body tube */}
            <svg
              width={ROCKET_BODY_W + 36}
              height={56}
              viewBox={`0 0 ${ROCKET_BODY_W + 36} 56`}
              className="pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2"
            >
              <path d="M18 0 L0 52 L18 44 Z" fill="var(--color-forest)" />
              <path d={`M${ROCKET_BODY_W + 18} 0 L${ROCKET_BODY_W + 36} 52 L${ROCKET_BODY_W + 18} 44 Z`} fill="var(--color-forest)" />
            </svg>
          </div>
          <svg width={60} height={16} viewBox="0 0 60 16" className="block">
            <path d="M14 0 L46 0 L54 14 L6 14 Z" fill="var(--color-ink)" opacity={0.75} />
          </svg>
          <span className="mt-1 font-mono text-[9px] font-bold uppercase tracking-widest text-ink/40">
            ▼ Tail
          </span>
        </div>

        {/* Heaviest → lightest ranking of the same parts */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink/45">
            Heaviest → Lightest
          </div>
          <ol className="space-y-1.5">
            {byMass.map((bayId, i) => {
              const spec = ROCKET_BAYS[bayId]
              const mass = massOf(bayId)
              return (
                <li
                  key={bayId}
                  onPointerEnter={() => setHovered(bayId)}
                  onPointerLeave={() => setHovered((h) => (h === bayId ? null : h))}
                  className={`rounded-lg px-1.5 py-1 transition ${
                    hovered === bayId || drag?.id === bayId ? 'bg-white ring-1 ring-line' : ''
                  }`}
                >
                  <div className="flex items-baseline gap-1.5 text-[11px]">
                    <span className="font-mono font-bold text-ink/45">#{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                      {spec.shortLabel}
                    </span>
                    <span className="font-mono font-semibold text-ink/70">{mass.toFixed(1)} kg</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-line/70">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(mass / heaviestKg) * 100}%`, backgroundColor: spec.color }}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
          <p className="mt-2 text-[10px] leading-snug text-ink/50">
            Payload includes the payload motor. Ballast includes any trim weight.
          </p>
        </div>
      </div>
    </div>
  )
}

const MATERIAL_CHOICES: {
  materialId: AirframeMaterialId
  noseConeId: NoseConeId
  title: string
  tag: string
  desc: string
}[] = [
  {
    materialId: 'cardboard',
    noseConeId: 'blunt',
    title: 'Cardboard Tube',
    tag: 'Light · Weak',
    desc: 'Very light and cheap, but shreds apart under high-speed aerodynamic pressure.',
  },
  {
    materialId: 'fiberglass',
    noseConeId: 'ogive',
    title: 'S-Glass Composite Airframe',
    tag: 'Balanced · Strong',
    desc: 'Sleek composite shell with an ogive nose cone. Built for 10,000 ft flights.',
  },
  {
    materialId: 'steel',
    noseConeId: 'conical',
    title: 'Heavy Welded Steel Pipe',
    tag: 'Indestructible · Too Heavy',
    desc: 'Will never break in the air, but weighs far too much to reach 10,000 ft.',
  },
]

/**
 * Step 5 (Rocket Sub-Team): Minimalist Material & Fin Style Picker.
 */
export function MaterialStation({
  design,
  locked,
  onCommit,
}: {
  design: RocketObject[]
  locked: boolean
  onCommit(next: RocketObject[]): void
}) {
  const airframe = getAirframe(design)

  const updateAirframe = (patch: Partial<typeof airframe>) => {
    if (locked) return
    onCommit(
      upsertObject(design, {
        ...airframe,
        ...patch,
        updatedAt: airframe.updatedAt + 1,
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-[#7c5cbf] text-white">
          <Shield className="size-5" />
        </span>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink/45">
            Rocket · Step 2 of 3
          </div>
          <h2 className="font-display text-lg font-extrabold text-ink">Choose Rocket Material</h2>
        </div>
      </div>

      <p className="text-sm text-ink/65">
        Pick the body material and fin design. Watch the 3D rocket transform live!
      </p>

      <div className="space-y-2">
        {MATERIAL_CHOICES.map((m) => {
          const active = airframe.materialId === m.materialId
          return (
            <button
              key={m.materialId}
              type="button"
              disabled={locked}
              onClick={() =>
                updateAirframe({
                  materialId: m.materialId,
                  noseConeId: m.noseConeId,
                })
              }
              className={`w-full rounded-2xl p-3 text-left transition ${
                active ? 'bg-mint ring-2 ring-forest' : 'bg-paper ring-1 ring-line hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-ink">{m.title}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[11px] font-semibold text-ink/70 ring-1 ring-line">
                  {m.tag}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink/65">{m.desc}</p>
              <div className="mt-1.5 font-mono text-[11px] font-semibold text-ink/55">
                Body holds together up to{' '}
                {speedForPressureMph(AIRFRAME_MATERIALS[m.materialId].maxQLimitKpa).toLocaleString()} mph
              </div>
            </button>
          )
        })}
      </div>

      {/* Simple 2-Choice Fin Style */}
      <div className="rounded-2xl bg-paper p-3 ring-1 ring-line">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">Fin Shape</div>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: 'trapezoidal' as FinProfileId, label: 'Sleek Swept Fins' },
              { id: 'rectangular' as FinProfileId, label: 'High-Drag Box Fins' },
            ] as const
          ).map((f) => {
            const active =
              f.id === 'trapezoidal'
                ? airframe.finProfileId !== 'rectangular'
                : airframe.finProfileId === 'rectangular'
            return (
              <button
                key={f.id}
                type="button"
                disabled={locked}
                onClick={() => updateAirframe({ finProfileId: f.id })}
                className={`rounded-xl py-2 text-center font-display text-xs font-bold transition ${
                  active ? 'bg-forest text-white' : 'bg-white text-ink ring-1 ring-line'
                }`}
              >
                {f.label}
                <span className={`block font-mono text-[10px] font-semibold ${active ? 'text-white/75' : 'text-ink/50'}`}>
                  holds to {speedForPressureMph(FIN_PROFILES[f.id].flutterLimitKpa).toLocaleString()} mph
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const FUEL_CHOICES: {
  impulseId: ImpulseClassId
  railAngleDeg: number
  ballastTrimKg: number
  title: string
  tag: string
  desc: string
}[] = [
  {
    impulseId: 'l-class',
    railAngleDeg: 88,
    ballastTrimKg: 0,
    title: 'Light Fuel Load (65%)',
    tag: '~5,800 ft',
    desc: 'Under-filled propellant grain. Safe, but falls short of the 10,000 ft goal.',
  },
  {
    impulseId: 'n-class',
    railAngleDeg: 86,
    ballastTrimKg: 0.5,
    title: 'IREC Target Fuel Load (100%)',
    tag: '~10,000 ft',
    desc: 'Balanced N-class solid propellant load angled into the desert breeze.',
  },
  {
    impulseId: 'o-class',
    railAngleDeg: 89,
    ballastTrimKg: 0,
    title: 'Overloaded Booster (125%)',
    tag: '~14,000+ ft',
    desc: 'Massive thrust that overshoots the 10,000 ft target window.',
  },
]

/**
 * Step 6 (Rocket Sub-Team): Minimalist Fuel Load & Rocket Launch Test.
 */
export function RocketTesterStation({
  design,
  locked,
  onCommit,
  onRunSubTest,
}: {
  design: RocketObject[]
  locked: boolean
  onCommit(next: RocketObject[]): void
  onRunSubTest?(variantId: 'rocket-launch'): void
}) {
  const launch = getLaunchSetup(design)

  const pickFuel = (c: (typeof FUEL_CHOICES)[number]) => {
    if (locked) return
    onCommit(
      upsertObject(design, {
        id: 'station:rocket-tester',
        kind: 'launchSetup',
        impulseId: c.impulseId,
        railAngleDeg: c.railAngleDeg,
        ballastTrimKg: c.ballastTrimKg,
        updatedAt: launch.updatedAt + 1,
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-[#b8461b] text-white">
          <Rocket className="size-5" />
        </span>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink/45">
            Rocket · Step 3 of 3
          </div>
          <h2 className="font-display text-lg font-extrabold text-ink">
            Fuel & Launch to 10,000 ft
          </h2>
        </div>
      </div>

      <p className="text-sm text-ink/65">
        Pick the fuel load so your rocket reaches the <strong>10,000 ft</strong> IREC target altitude!
      </p>

      <div className="space-y-2.5">
        {FUEL_CHOICES.map((c) => {
          const active = launch.impulseId === c.impulseId
          return (
            <button
              key={c.impulseId}
              type="button"
              disabled={locked}
              onClick={() => pickFuel(c)}
              className={`w-full rounded-2xl p-3.5 text-left transition ${
                active ? 'bg-mint ring-2 ring-forest' : 'bg-paper ring-1 ring-line hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-ink">{c.title}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-xs font-semibold text-forest ring-1 ring-line">
                  {c.tag}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink/65">{c.desc}</p>
            </button>
          )
        })}
      </div>

      {onRunSubTest && (
        <button
          type="button"
          disabled={locked}
          onClick={() => onRunSubTest('rocket-launch')}
          className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b8461b] py-3.5 font-display text-base font-extrabold uppercase tracking-wide text-white shadow-lg hover:opacity-95 disabled:opacity-40"
        >
          <Play className="size-4.5" /> Test Launch Rocket
        </button>
      )}
    </div>
  )
}
