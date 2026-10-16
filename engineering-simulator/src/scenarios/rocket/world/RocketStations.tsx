import { ArrowDown, ArrowUp, GripVertical, Play, Rocket, Scale, Shield } from 'lucide-react'
import { useState } from 'react'
import { getAirframe, getLaunchSetup, getWeightDist, ROCKET_BAYS } from '../config'
import { evaluateRocketDesign } from '../sim/engine'
import type {
  AirframeMaterialId,
  FinProfileId,
  ImpulseClassId,
  NoseConeId,
  RocketObject,
} from '../types'

function upsertObject(design: RocketObject[], nextObj: RocketObject): RocketObject[] {
  const exists = design.some((o) => o.id === nextObj.id)
  return exists ? design.map((o) => (o.id === nextObj.id ? nextObj : o)) : [...design, nextObj]
}

/**
 * Step 4 (Rocket Sub-Team): Minimalist Drag-and-Drop Weight Ordering inside the Rocket.
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
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const evalSnap = evaluateRocketDesign(design, 'rocket-launch')
  const { stabilityCalibers, nozzleAtTail } = evalSnap.telemetry
  const stable = stabilityCalibers >= 1.2 && stabilityCalibers <= 3.2 && nozzleAtTail

  const swapBays = (fromIdx: number, toIdx: number) => {
    if (locked || fromIdx === toIdx || toIdx < 0 || toIdx >= weightDist.bayOrder.length) return
    const nextOrder = [...weightDist.bayOrder]
    const [moved] = nextOrder.splice(fromIdx, 1)
    nextOrder.splice(toIdx, 0, moved)
    onCommit(
      upsertObject(design, {
        id: 'station:rocket-mass',
        kind: 'weightDist',
        bayOrder: nextOrder,
        updatedAt: weightDist.updatedAt + 1,
      }),
    )
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
          className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${
            stable ? 'bg-mint text-forest' : 'bg-[#fbeee6] text-rust'
          }`}
        >
          {stable ? 'Balanced ✓' : !nozzleAtTail ? 'Engine Not at Tail' : 'Unstable'}
        </span>
      </div>

      <p className="text-sm text-ink/65">
        Drag parts from <strong>Nose (Top)</strong> to <strong>Tail (Bottom)</strong>. Put the nose
        weight & payload near the top and the fuel & engine nozzle at the bottom!
      </p>

      {/* Clean Vertical Rocket Stack */}
      <div className="space-y-1.5 rounded-2xl bg-paper p-3 ring-1 ring-line">
        <div className="text-center font-mono text-[10px] font-bold uppercase tracking-widest text-ink/40">
          ▲ Nose Cone (Top of Rocket)
        </div>

        {weightDist.bayOrder.map((bayId, idx) => {
          const spec = ROCKET_BAYS[bayId]
          return (
            <div
              key={bayId}
              draggable={!locked}
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null) swapBays(dragIdx, idx)
                setDragIdx(null)
              }}
              className={`flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 shadow-2xs ring-1 transition ${
                dragIdx === idx ? 'ring-2 ring-forest' : 'ring-line'
              }`}
            >
              <GripVertical className="size-4 shrink-0 cursor-grab text-ink/35" />
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: spec.color }}
              />
              <span className="flex-1 font-display text-sm font-bold text-ink">{spec.label}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={locked || idx === 0}
                  onClick={() => swapBays(idx, idx - 1)}
                  className="grid size-6 place-items-center rounded-lg bg-paper text-ink/70 hover:bg-mint disabled:opacity-25"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={locked || idx === weightDist.bayOrder.length - 1}
                  onClick={() => swapBays(idx, idx + 1)}
                  className="grid size-6 place-items-center rounded-lg bg-paper text-ink/70 hover:bg-mint disabled:opacity-25"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        <div className="text-center font-mono text-[10px] font-bold uppercase tracking-widest text-ink/40">
          ▼ Exhaust Tail (Bottom of Rocket)
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
