import { Check, Compass, Cpu, Play, RotateCcw, Umbrella } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getGyroConfig, getPayloadMotor, getPayloadTestRig, REQUIRED } from '../config'
import type { GyroConfigObject, PayloadMotorId, RocketObject } from '../types'

type AxisKey = 'rollScore' | 'pitchScore' | 'yawScore'

const AXES: { key: AxisKey; label: string; color: string; speed: number }[] = [
  { key: 'rollScore', label: 'Roll', color: '#0284c7', speed: 2.1 },
  { key: 'pitchScore', label: 'Pitch', color: '#d97706', speed: 2.6 },
  { key: 'yawScore', label: 'Yaw', color: '#16a34a', speed: 3.1 },
]

function upsertObject(design: RocketObject[], nextObj: RocketObject): RocketObject[] {
  const exists = design.some((o) => o.id === nextObj.id)
  return exists ? design.map((o) => (o.id === nextObj.id ? nextObj : o)) : [...design, nextObj]
}

/**
 * Step 1 (Payload Sub-Team): Minimalist Gyroscope Timing Game.
 */
export function GyroStation({
  design,
  locked,
  onCommit,
}: {
  design: RocketObject[]
  locked: boolean
  onCommit(next: RocketObject[]): void
}) {
  const gyro = getGyroConfig(design)
  const [activeAxisIdx, setActiveAxisIdx] = useState(0)
  const needleRef = useRef<SVGGElement>(null)
  const angleRef = useRef(0)

  const currentAxis = AXES[activeAxisIdx]
  const avgScore = Math.round((gyro.rollScore + gyro.pitchScore + gyro.yawScore) / 3)
  const calibrated = avgScore >= REQUIRED.minGyroCalibrationPct

  useEffect(() => {
    if (locked) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      angleRef.current = (angleRef.current + dt * currentAxis.speed * 180) % 360
      if (needleRef.current) {
        needleRef.current.setAttribute('transform', `rotate(${angleRef.current} 100 100)`)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [currentAxis.speed, locked])

  const lockAxisNow = () => {
    if (locked) return
    const raw = angleRef.current % 360
    const distDeg = Math.min(raw, 360 - raw)
    const score = Math.max(15, Math.min(100, Math.round(100 - distDeg * 1.1)))
    const updated: GyroConfigObject = {
      ...gyro,
      [currentAxis.key]: score,
      updatedAt: gyro.updatedAt + 1,
    }
    onCommit(upsertObject(design, updated))
    if (score >= 75) {
      setActiveAxisIdx((i) => (i + 1) % AXES.length)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-[#0284c7] text-white">
            <Compass className="size-5" />
          </span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink/45">
              Payload · Step 1 of 3
            </div>
            <h2 className="font-display text-lg font-extrabold text-ink">Calibrate the Gyroscope</h2>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${
            calibrated ? 'bg-mint text-forest' : 'bg-[#fbeee6] text-rust'
          }`}
        >
          {calibrated ? 'Calibrated ✓' : 'Needs Calibration'}
        </span>
      </div>

      <p className="text-sm text-ink/65">
        Click <strong>Lock {currentAxis.label}</strong> right as the needle sweeps through the{' '}
        <span className="font-semibold text-forest">green zone</span> at the top.
      </p>

      {/* Clean Centered Timing Dial */}
      <div className="flex flex-col items-center rounded-2xl bg-paper py-4 ring-1 ring-line">
        <svg viewBox="0 0 200 200" className="size-40">
          <circle cx="100" cy="100" r="78" fill="#ffffff" stroke="#e2ddd3" strokeWidth="14" />
          <path
            d="M 65 30 A 78 78 0 0 1 135 30"
            fill="none"
            stroke="#16a34a"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <g ref={needleRef} transform="rotate(0 100 100)">
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="22"
              stroke={currentAxis.color}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="100" cy="26" r="6" fill={currentAxis.color} />
          </g>
          <circle cx="100" cy="100" r="12" fill="#1e293b" />
        </svg>

        {/* 3 Minimalist Axis Pills */}
        <div className="mt-2 flex items-center gap-2">
          {AXES.map((ax, idx) => {
            const val = gyro[ax.key]
            const ok = val >= REQUIRED.minGyroCalibrationPct
            const active = idx === activeAxisIdx
            return (
              <button
                key={ax.key}
                type="button"
                onClick={() => setActiveAxisIdx(idx)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                  active
                    ? 'bg-ink text-white'
                    : ok
                      ? 'bg-mint text-forest'
                      : 'bg-white text-ink/60 ring-1 ring-line'
                }`}
              >
                {ok && <Check className="size-3.5" />}
                {ax.label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          disabled={locked}
          onClick={lockAxisNow}
          className="btn-press mt-4 w-56 rounded-xl bg-forest py-3 font-display text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-forest-dark disabled:opacity-40"
        >
          Lock {currentAxis.label} Axis
        </button>

        {calibrated && (
          <button
            type="button"
            disabled={locked}
            onClick={() =>
              onCommit(
                upsertObject(design, {
                  id: 'station:payload-gyro',
                  kind: 'gyro',
                  rollScore: 25,
                  pitchScore: 30,
                  yawScore: 20,
                  updatedAt: gyro.updatedAt + 1,
                }),
              )
            }
            className="mt-2 flex items-center gap-1 text-xs text-ink/45 hover:text-rust"
          >
            <RotateCcw className="size-3" /> Uncalibrate (to test spin-out)
          </button>
        )}
      </div>
    </div>
  )
}

const MOTOR_CHOICES: {
  id: PayloadMotorId
  title: string
  tag: string
  desc: string
}[] = [
  {
    id: 'micro-gimbal',
    title: 'Featherweight Micro Motor',
    tag: '0.6 kg · Very Light',
    desc: 'Tiny camera motor. Very light, but struggles to stop spinning in the air.',
  },
  {
    id: 'aero-torque',
    title: 'Balanced Aerospace Servo',
    tag: '2.7 kg · Medium Weight',
    desc: 'Flight-rated reaction motor with steady torque and manageable weight.',
  },
  {
    id: 'heavy-iron',
    title: 'Mega Cast-Iron Thruster',
    tag: '9.8 kg · Super Heavy',
    desc: 'Industrial cast-iron motor. Extremely powerful, but weighs a ton.',
  },
]

/**
 * Step 2 (Payload Sub-Team): Minimalist 3-Card Motor Picker.
 */
export function PayloadMotorStation({
  design,
  locked,
  onCommit,
}: {
  design: RocketObject[]
  locked: boolean
  onCommit(next: RocketObject[]): void
}) {
  const motorObj = getPayloadMotor(design)

  const pickMotor = (motorId: PayloadMotorId) => {
    if (locked) return
    onCommit(
      upsertObject(design, {
        id: 'station:payload-motor',
        kind: 'payloadMotor',
        motorId,
        updatedAt: motorObj.updatedAt + 1,
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-[#d97706] text-white">
          <Cpu className="size-5" />
        </span>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink/45">
            Payload · Step 2 of 3
          </div>
          <h2 className="font-display text-lg font-extrabold text-ink">Choose the Payload Motor</h2>
        </div>
      </div>

      <p className="text-sm text-ink/65">
        Pick the motor that stabilizes the payload during its drop. Watch out for weight!
      </p>

      <div className="space-y-2.5">
        {MOTOR_CHOICES.map((m) => {
          const active = motorObj.motorId === m.id
          return (
            <button
              key={m.id}
              type="button"
              disabled={locked}
              onClick={() => pickMotor(m.id)}
              className={`w-full rounded-2xl p-3.5 text-left transition ${
                active
                  ? 'bg-mint ring-2 ring-forest'
                  : 'bg-paper ring-1 ring-line hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-base font-bold text-ink">{m.title}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-xs font-semibold text-ink/70 ring-1 ring-line">
                  {m.tag}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink/65">{m.desc}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Step 3 (Payload Sub-Team): Minimalist Drop Test Setup & Launch Button.
 */
export function PayloadTesterStation({
  design,
  locked,
  onCommit,
  onRunSubTest,
}: {
  design: RocketObject[]
  locked: boolean
  onCommit(next: RocketObject[]): void
  onRunSubTest?(variantId: 'payload-drop'): void
}) {
  const rig = getPayloadTestRig(design)

  const updateRig = (patch: Partial<typeof rig>) => {
    if (locked) return
    onCommit(
      upsertObject(design, {
        ...rig,
        ...patch,
        chuteSize: 'main-standard',
        armedChuteAltFt: 1200,
        updatedAt: rig.updatedAt + 1,
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-[#b45309] text-white">
          <Umbrella className="size-5" />
        </span>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink/45">
            Payload · Step 3 of 3
          </div>
          <h2 className="font-display text-lg font-extrabold text-ink">Design & Run the Drop Test</h2>
        </div>
      </div>

      <p className="text-sm text-ink/65">
        Choose the drop height and target alignment, then drop the payload and deploy the parachute!
      </p>

      {/* Question 1: Drop Height */}
      <div className="rounded-2xl bg-paper p-3.5 ring-1 ring-line">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">
          1. Drop Height
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { alt: 1400, label: 'Low (1,400 ft)', sub: 'Too low to slow down' },
            { alt: 4000, label: 'High (4,000 ft)', sub: 'Full test altitude' },
          ].map((opt) => {
            const active = Math.abs(rig.dropAltitudeFt - opt.alt) < 500
            return (
              <button
                key={opt.alt}
                type="button"
                disabled={locked}
                onClick={() => updateRig({ dropAltitudeFt: opt.alt })}
                className={`rounded-xl p-2.5 text-left transition ${
                  active ? 'bg-mint ring-2 ring-forest' : 'bg-white ring-1 ring-line'
                }`}
              >
                <div className="font-display text-sm font-bold text-ink">{opt.label}</div>
                <div className="text-[11px] text-ink/55">{opt.sub}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Question 2: Target Alignment */}
      <div className="rounded-2xl bg-paper p-3.5 ring-1 ring-line">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">
          2. Aim Drop Zone for Breeze
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { lead: 0, label: 'Straight Over Pad', sub: 'Drifts with the wind' },
            { lead: 8, label: 'Upwind Lead (8°)', sub: 'Drifts onto bullseye' },
          ].map((opt) => {
            const active = Math.abs(rig.windLeadDeg - opt.lead) <= 3
            return (
              <button
                key={opt.lead}
                type="button"
                disabled={locked}
                onClick={() => updateRig({ windLeadDeg: opt.lead })}
                className={`rounded-xl p-2.5 text-left transition ${
                  active ? 'bg-mint ring-2 ring-forest' : 'bg-white ring-1 ring-line'
                }`}
              >
                <div className="font-display text-sm font-bold text-ink">{opt.label}</div>
                <div className="text-[11px] text-ink/55">{opt.sub}</div>
              </button>
            )
          })}
        </div>
      </div>

      {onRunSubTest && (
        <button
          type="button"
          disabled={locked}
          onClick={() => onRunSubTest('payload-drop')}
          className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b45309] py-3.5 font-display text-base font-extrabold uppercase tracking-wide text-white shadow-lg hover:opacity-95 disabled:opacity-40"
        >
          <Play className="size-4.5" /> Drop Payload from Sky
        </button>
      )}
    </div>
  )
}
