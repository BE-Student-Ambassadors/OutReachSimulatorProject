import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Rocket,
  Sparkles,
  Umbrella,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { count, money } from '../../../core/format'
import type { WorldProps } from '../../../core/scenario'
import { BUDGET } from '../config'
import { designCost } from '../cost'
import { assignRocketRoles, extractRolePrefs, ROCKET_ROLES } from '../roles'
import { evaluateRocketDesign, type RocketResult, type RocketRun } from '../sim/engine'
import type { RocketObject, RocketRoleId } from '../types'
import { GyroStation, PayloadMotorStation, PayloadTesterStation } from './PayloadStations'
import { RocketScene } from './RocketScene'
import { MaterialStation, RocketTesterStation, WeightDistStation } from './RocketStations'
import { RoleTierModal } from './RoleTierModal'

type StepId = RocketRoleId | 'range'

const STEPS: {
  id: StepId
  stepNum: number
  shortLabel: string
  subTeam: 'payload' | 'rocket' | 'mission'
  focusMode: 'payload-closeup' | 'rocket-closeup' | 'overview'
}[] = [
  { id: 'payload-gyro', stepNum: 1, shortLabel: 'Gyroscope', subTeam: 'payload', focusMode: 'payload-closeup' },
  { id: 'payload-motor', stepNum: 2, shortLabel: 'Motor', subTeam: 'payload', focusMode: 'payload-closeup' },
  { id: 'payload-tester', stepNum: 3, shortLabel: 'Drop Test', subTeam: 'payload', focusMode: 'payload-closeup' },
  { id: 'rocket-mass', stepNum: 4, shortLabel: 'Weights', subTeam: 'rocket', focusMode: 'rocket-closeup' },
  { id: 'rocket-material', stepNum: 5, shortLabel: 'Material', subTeam: 'rocket', focusMode: 'rocket-closeup' },
  { id: 'rocket-tester', stepNum: 6, shortLabel: 'Launch Test', subTeam: 'rocket', focusMode: 'rocket-closeup' },
  { id: 'range', stepNum: 7, shortLabel: 'Full Mission', subTeam: 'mission', focusMode: 'overview' },
]

const TOOL_TO_ROLE: Record<string, RocketRoleId> = {
  gyro: 'payload-gyro',
  payloadMotor: 'payload-motor',
  payloadTest: 'payload-tester',
  weightDist: 'rocket-mass',
  airframe: 'rocket-material',
  launchSetup: 'rocket-tester',
}

export function RocketWorld({
  design,
  activeTool,
  locked,
  run,
  showOverlay,
  onCommit,
  onSelect,
  onToolDone,
  sync,
  onStartRun,
}: WorldProps<RocketObject, RocketResult>) {
  const [selectedStep, setSelectedStep] = useState<StepId>('payload-gyro')
  const [showRoleModal, setShowRoleModal] = useState(false)

  const mappedFromTool = activeTool ? TOOL_TO_ROLE[activeTool] : undefined
  const activeStepId: StepId = mappedFromTool ?? selectedStep
  const activeStepIndex = STEPS.findIndex((s) => s.id === activeStepId)
  const currentStep = STEPS[activeStepIndex] ?? STEPS[0]

  const goToStep = (step: StepId) => {
    setSelectedStep(step)
    if (activeTool) onToolDone()
    if (step !== 'range') onSelect(`station:${step}`)
  }

  const myId = sync?.me ?? 'solo-engineer'
  const myName = sync?.meName ?? 'You'
  const teammates = sync?.teammates

  const rolePrefs = extractRolePrefs(design, teammates)
  const assignments = assignRocketRoles(rolePrefs)
  const myAssigned = assignments.find((a) => a.playerId === myId)

  const rocketRun = (run as RocketRun | null) ?? null
  const evalSnap = evaluateRocketDesign(design, 'standard')
  const totalCost = designCost(design)

  return (
    <div className="relative h-full w-full select-none overflow-hidden rounded-2xl">
      {/* 3D Canvas Stage with camera focus matching the active step */}
      <RocketScene
        design={design}
        run={rocketRun}
        showOverlay={showOverlay}
        focusMode={currentStep.focusMode}
      />

      {/* Step bar + step card share one column so the card always fits below the bar,
          however many lines the bar wraps to, and scrolls when the window is short. */}
      {!rocketRun && (
        <div className="pointer-events-none absolute inset-3 z-10 flex flex-col gap-2.5 sm:inset-4">
        {/* Minimalist Top Step-by-Step Progress Bar */}
        <div className="pointer-events-auto flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-md ring-1 ring-line backdrop-blur">
          <div className="flex flex-wrap items-center gap-1">
            {STEPS.map((s) => {
              const active = s.id === activeStepId
              const assigned = s.id !== 'range' ? assignments.find((a) => a.roleId === s.id) : undefined
              const isMine = assigned?.playerId === myId
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToStep(s.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
                    active
                      ? 'bg-ink text-white shadow-xs'
                      : isMine
                        ? 'bg-mint text-forest ring-1 ring-forest/30'
                        : 'text-ink/65 hover:bg-paper hover:text-ink'
                  }`}
                >
                  <span
                    className={`flex size-4 items-center justify-center rounded-full font-mono text-[10px] ${
                      active ? 'bg-white/20 text-white' : 'bg-paper text-ink/60'
                    }`}
                  >
                    {s.stepNum}
                  </span>
                  <span>{s.shortLabel}</span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowRoleModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-paper px-3 py-1.5 font-display text-xs font-bold text-ink ring-1 ring-line transition hover:bg-mint hover:text-forest"
          >
            <Users className="size-3.5" />
            {myAssigned
              ? `Role: ${ROCKET_ROLES.find((r) => r.id === myAssigned.roleId)?.shortTitle}`
              : 'Team Roles'}
          </button>
        </div>

        {/* Single Minimalist Step Card on the Left */}
        <div className="pointer-events-auto flex min-h-0 w-full max-w-[420px] flex-1 flex-col justify-between">
          <div className="min-h-0 overflow-y-auto overscroll-contain rounded-3xl bg-white/95 p-4 shadow-xl ring-1 ring-line backdrop-blur">
            {activeStepId === 'payload-gyro' && (
              <GyroStation
                design={design}
                locked={locked}
                onCommit={(next) => onCommit(next, 'station:payload-gyro')}
              />
            )}
            {activeStepId === 'payload-motor' && (
              <PayloadMotorStation
                design={design}
                locked={locked}
                onCommit={(next) => onCommit(next, 'station:payload-motor')}
              />
            )}
            {activeStepId === 'payload-tester' && (
              <PayloadTesterStation
                design={design}
                locked={locked}
                onCommit={(next) => onCommit(next, 'station:payload-tester')}
                onRunSubTest={onStartRun ? (vid) => onStartRun(vid) : undefined}
              />
            )}
            {activeStepId === 'rocket-mass' && (
              <WeightDistStation
                design={design}
                locked={locked}
                onCommit={(next) => onCommit(next, 'station:rocket-mass')}
              />
            )}
            {activeStepId === 'rocket-material' && (
              <MaterialStation
                design={design}
                locked={locked}
                onCommit={(next) => onCommit(next, 'station:rocket-material')}
              />
            )}
            {activeStepId === 'rocket-tester' && (
              <RocketTesterStation
                design={design}
                locked={locked}
                onCommit={(next) => onCommit(next, 'station:rocket-tester')}
                onRunSubTest={onStartRun ? (vid) => onStartRun(vid) : undefined}
              />
            )}
            {activeStepId === 'range' && (
              <div>
                <div className="mb-1 font-mono text-[11px] font-bold uppercase tracking-widest text-forest">
                  Step 7 of 7 · Final Check
                </div>
                <h3 className="font-display text-xl font-bold text-ink">Full IREC Mission Launch</h3>
                <p className="mt-1 text-xs text-ink/65">
                  Launch the rocket to 10,000 ft, deploy the payload at apogee, and land on the target pad.
                </p>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between rounded-2xl bg-paper px-3.5 py-2.5 text-xs">
                    <span className="font-semibold text-ink/75">Gyroscope Calibration</span>
                    <span className="font-mono font-bold text-ink">
                      {evalSnap.telemetry.gyroCalibrationPct}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-paper px-3.5 py-2.5 text-xs">
                    <span className="font-semibold text-ink/75">Rocket Stability</span>
                    <span className="font-mono font-bold text-ink">
                      {evalSnap.telemetry.stabilityCalibers} cal
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-paper px-3.5 py-2.5 text-xs">
                    <span className="font-semibold text-ink/75">Team Budget</span>
                    <span
                      className={`font-mono font-bold ${
                        totalCost <= BUDGET ? 'text-forest' : 'text-rust'
                      }`}
                    >
                      {money(totalCost)} / {money(BUDGET)}
                    </span>
                  </div>
                </div>

                {onStartRun && (
                  <div className="mt-5 space-y-2">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => onStartRun('standard')}
                      className="btn-press flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-forest px-5 py-3.5 font-display text-sm font-bold text-white shadow-lg hover:bg-forest-deep disabled:opacity-40"
                    >
                      <CheckCircle2 className="size-4" /> Launch Full IREC Mission
                    </button>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => onStartRun('payload-drop')}
                        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-paper px-3 py-2 font-display text-xs font-bold text-ink/80 ring-1 ring-line hover:bg-white"
                      >
                        <Umbrella className="size-3.5 text-[#b45309]" /> Drop Only
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => onStartRun('rocket-launch')}
                        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-paper px-3 py-2 font-display text-xs font-bold text-ink/80 ring-1 ring-line hover:bg-white"
                      >
                        <Rocket className="size-3.5 text-forest" /> Rocket Only
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step-by-Step Back / Next Navigation Footer */}
          <div className="mt-2.5 flex shrink-0 items-center justify-between rounded-2xl bg-white/95 px-3.5 py-2.5 shadow-md ring-1 ring-line backdrop-blur">
            <button
              type="button"
              disabled={activeStepIndex <= 0}
              onClick={() => goToStep(STEPS[Math.max(0, activeStepIndex - 1)].id)}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 font-display text-xs font-bold text-ink/75 transition hover:bg-paper disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowLeft className="size-3.5" /> Back
            </button>

            <span className="font-mono text-[11px] font-semibold text-ink/50">
              Step {currentStep.stepNum} of {STEPS.length}
            </span>

            {activeStepIndex < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => goToStep(STEPS[activeStepIndex + 1].id)}
                className="btn-press flex cursor-pointer items-center gap-1.5 rounded-xl bg-ink px-3.5 py-1.5 font-display text-xs font-bold text-white shadow-xs transition hover:bg-ink/85"
              >
                Next Step <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={locked || !onStartRun}
                onClick={() => onStartRun?.('standard')}
                className="btn-press flex cursor-pointer items-center gap-1.5 rounded-xl bg-forest px-3.5 py-1.5 font-display text-xs font-bold text-white shadow-xs transition hover:bg-forest-deep disabled:opacity-40"
              >
                Launch <Rocket className="size-3.5" />
              </button>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Live Flight & Payload Drop HUD during a Test Run */}
      {rocketRun && <LiveFlightHud run={rocketRun} />}

      {/* 6-Role Tier List Preference Modal */}
      {showRoleModal && (
        <RoleTierModal
          design={design}
          myId={myId}
          myName={myName}
          teammates={teammates}
          locked={locked}
          onCommit={(next) => onCommit(next, null)}
          onSelectRoleTab={(roleId) => {
            goToStep(roleId)
          }}
          onClose={() => setShowRoleModal(false)}
        />
      )}
    </div>
  )
}

function LiveFlightHud({ run }: { run: RocketRun }) {
  const [, setTick] = useState(0)
  const [manualTriggeredAlt, setManualTriggeredAlt] = useState<number | null>(null)

  useEffect(() => {
    let raf = 0
    const update = () => {
      setTick((t) => (t + 1) % 100000)
      if (!run.done) raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [run])

  const f = run.frame
  const r = run.result()
  const isPayloadPhase =
    f.phase === 'payload-freefall' || f.phase === 'payload-chute' || f.phase === 'impact'

  const spinningOut =
    isPayloadPhase &&
    (r.payloadOutcome === 'spin-motor-weak' || r.payloadOutcome === 'spin-gyro-uncalibrated')
  const splattered = f.phase === 'impact' && r.payloadOutcome === 'splatter'
  const landedBullseye = f.phase === 'impact' && r.payloadOutcome === 'target-landed'

  // Rocket phases read speed in mph against the airframe's safe speed.
  const speedMph = Math.round(f.hudSpeedFps / 1.467)
  const safeMph = r.telemetry.maxSafeSpeedMph
  const stressPct = Math.min(100, (speedMph / safeMph) * 100)
  const brokeUp = !isPayloadPhase && f.rocketShredded

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex flex-col items-center gap-3">
      {/* Minimalist Top Flight Telemetry Banner */}
      <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-ink/90 px-5 py-3 text-white shadow-xl backdrop-blur">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/60">Phase</div>
          <div className="font-display text-sm font-bold text-mint">
            {brokeUp
              ? 'Breakup'
              : f.phase === 'rocket-ascent'
              ? 'Rocket Ascent'
              : f.phase === 'apogee-sep'
                ? 'Apogee Separation'
                : f.phase === 'payload-freefall'
                  ? 'Payload Freefall'
                  : f.phase === 'payload-chute'
                    ? 'Canopy Descent'
                    : 'Ground Impact'}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/60">Altitude</div>
          <div className="font-mono text-xl font-bold tabular">
            {count(Math.round(f.hudAltitudeFt))} <span className="text-xs font-normal">ft</span>
          </div>
        </div>
        {isPayloadPhase ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-white/60">Speed</div>
            <div className="font-mono text-xl font-semibold tabular">
              {f.hudSpeedFps} <span className="text-xs font-normal">ft/s</span>
            </div>
          </div>
        ) : (
          <div className="w-44">
            <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider text-white/60">
              <span>{brokeUp ? 'At breakup' : 'Speed'}</span>
              <span>safe {count(safeMph)}</span>
            </div>
            <div className="font-mono text-xl font-semibold tabular">
              {count(brokeUp ? r.telemetry.breakupSpeedMph : speedMph)}{' '}
              <span className="text-xs font-normal">mph</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className={`h-full rounded-full transition-[width] duration-75 ${
                  brokeUp || stressPct >= 100 ? 'bg-rust' : stressPct > 85 ? 'bg-sun' : 'bg-leaf'
                }`}
                style={{ width: `${brokeUp ? 100 : stressPct}%` }}
              />
            </div>
          </div>
        )}
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/60">Parachute</div>
          <div className={`font-mono text-sm font-bold ${f.chuteOpen ? 'text-leaf' : 'text-sun'}`}>
            {f.chuteOpen
              ? `OPEN (${manualTriggeredAlt ?? r.telemetry.chuteDeployAltFt} ft)`
              : `ARMED @ ${r.telemetry.chuteDeployAltFt} ft`}
          </div>
        </div>
      </div>

      {/* Interactive Live Parachute Trigger Button during Payload Drop */}
      {f.canDeployChute && (
        <button
          type="button"
          onClick={() => {
            const alt = run.deployParachute()
            if (alt !== null) setManualTriggeredAlt(alt)
          }}
          className="pointer-events-auto animate-bounce cursor-pointer rounded-2xl bg-[#f97316] px-6 py-3 font-display text-base font-extrabold uppercase tracking-wide text-white shadow-2xl ring-4 ring-white hover:bg-[#ea580c]"
        >
          <Umbrella className="mr-2 inline size-5" />
          Deploy Parachute Now! ({count(Math.round(f.hudAltitudeFt))} ft)
        </button>
      )}

      {/* Dramatic Outcome Callouts */}
      {spinningOut && f.phase !== 'impact' && (
        <div className="flex items-center gap-2 rounded-xl bg-rust px-4 py-2 font-display text-sm font-bold text-white shadow-lg">
          <AlertTriangle className="size-4" />
          {r.payloadOutcome === 'spin-motor-weak'
            ? 'MOTOR TOO WEAK — PAYLOAD SPINNING OUT OF CONTROL!'
            : 'GYROSCOPE UNCALIBRATED — PAYLOAD SPINNING OUT OF CONTROL!'}
        </div>
      )}

      {splattered && (
        <div className="animate-pop rounded-2xl bg-rust px-6 py-3 text-center font-display text-lg font-extrabold text-white shadow-2xl ring-4 ring-white">
          💥 SPLAT! PAYLOAD SHATTERED INTO PIECES! ({r.telemetry.landingSpeedFps} ft/s impact)
        </div>
      )}

      {landedBullseye && (
        <div className="animate-pop flex items-center gap-2 rounded-2xl bg-forest px-6 py-3 font-display text-base font-extrabold text-white shadow-2xl ring-4 ring-white">
          <Sparkles className="size-5" /> ON-TARGET LANDING! ({r.landingDistFt} ft from center)
        </div>
      )}

      {!isPayloadPhase && r.rocketOutcome === 'unstable-tumble' && (
        <div className="flex items-center gap-2 rounded-xl bg-rust px-4 py-2 font-display text-sm font-bold text-white shadow-lg">
          <AlertTriangle className="size-4" />
          ROCKET UNSTABLE — HEAVY WEIGHTS ARE TOO FAR BACK!
        </div>
      )}

      {brokeUp && (
        <div className="animate-pop flex items-center gap-2 rounded-2xl bg-rust px-6 py-3 font-display text-base font-extrabold text-white shadow-2xl ring-4 ring-white">
          <AlertTriangle className="size-5" />
          {r.telemetry.weakestPart === 'fins' ? 'FINS RIPPED OFF' : 'AIRFRAME TORE APART'} AT{' '}
          {count(r.telemetry.breakupSpeedMph)} MPH · {count(r.telemetry.breakupAltFt)} FT
        </div>
      )}
      {!isPayloadPhase && !brokeUp && f.structuralStress > 0.9 && f.rocketThrusting && (
        <div className="flex items-center gap-2 rounded-xl bg-sun px-4 py-1.5 font-mono text-xs font-bold text-ink shadow-lg">
          <AlertTriangle className="size-3.5" />
          {count(speedMph)} of {count(safeMph)} mph safe speed
        </div>
      )}
    </div>
  )
}
