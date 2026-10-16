import {
  Activity,
  ArrowLeft,
  BatteryCharging,
  Flame,
  Gauge,
  Play,
  ShieldAlert,
  Swords,
  Zap,
} from 'lucide-react';
import React from 'react';
import { soundEngine } from '../../audio/soundEngine';
import { type EngineeringStats, type RobotConfiguration, type TestLabType } from '../../types/robot';
import { type ActiveTestVisualState } from '../three/WorkshopStage3D';

interface TestLabOverlayProps {
  config: RobotConfiguration;
  stats: EngineeringStats;
  activeTest: ActiveTestVisualState;
  completedTest: TestLabType | null;
  onStartTest: (test: TestLabType) => void;
  onReturnToCustomization: () => void;
  onEnterArena: () => void;
}

const TEST_DEFINITIONS: {
  id: TestLabType;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'speed',
    label: 'SPEED TEST',
    subtitle: '0–10 mph launch & top velocity',
    icon: <Gauge className="w-4 h-4" />,
  },
  {
    id: 'push',
    label: 'PUSH TEST',
    subtitle: 'Dynamometer force & wheel grip',
    icon: <Zap className="w-4 h-4" />,
  },
  {
    id: 'weapon',
    label: 'WEAPON TEST',
    subtitle: 'Kinetic output, spin-up & recoil',
    icon: <Flame className="w-4 h-4" />,
  },
  {
    id: 'stability',
    label: 'STABILITY TEST',
    subtitle: 'High-G slalom & tipping moment',
    icon: <ShieldAlert className="w-4 h-4" />,
  },
  {
    id: 'power',
    label: 'POWER TEST',
    subtitle: 'Full-load runtime & motor heat',
    icon: <BatteryCharging className="w-4 h-4" />,
  },
];

export const TestLabOverlay: React.FC<TestLabOverlayProps> = ({
  stats,
  activeTest,
  completedTest,
  onStartTest,
  onReturnToCustomization,
  onEnterArena,
}) => {
  const shownTest = activeTest.isRunning ? activeTest.testType : completedTest;

  const renderTestResultCard = (test: TestLabType) => {
    const isRunning = activeTest.isRunning && activeTest.testType === test;
    const prog = isRunning ? activeTest.progress : 1.0;

    if (test === 'speed') {
      const liveSpeed = (stats.topSpeedMph * Math.min(1, prog * 1.4)).toFixed(1);
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                0–10 MPH ACCELERATION
              </div>
              <div className="font-mono-num text-xl font-extrabold text-cyan-300 mt-0.5">
                {stats.zeroToTenSec.toFixed(2)} sec
              </div>
            </div>
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase">TOP SPEED</div>
              <div className="font-mono-num text-xl font-extrabold text-white mt-0.5">
                {liveSpeed} MPH
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-300 bg-slate-900/80 border border-slate-800 rounded-lg p-3">
            {stats.topSpeedMph >= 15
              ? '✓ High closing velocity observed on the test rollers.'
              : stats.topSpeedMph <= 11.5
              ? '⚠ Moderate top speed — total mass and gearing prioritize torque over sprint speed.'
              : '✓ Balanced acceleration and top speed across the test track.'}
          </div>
        </div>
      );
    }

    if (test === 'push') {
      const liveForce = Math.round(stats.pushingForceN * Math.min(1, prog * 1.35));
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                MAX PUSHING FORCE
              </div>
              <div className="font-mono-num text-xl font-extrabold text-amber-300 mt-0.5">
                {liveForce} N
              </div>
            </div>
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                FLOOR TRACTION (μ)
              </div>
              <div className="font-mono-num text-xl font-extrabold text-white mt-0.5">
                {stats.tractionLabel} ({stats.tractionCoeff})
              </div>
            </div>
          </div>
          <div
            className={`text-xs rounded-lg p-3 border ${
              stats.wheelSlipLikely || stats.tractionLabel === 'LOW'
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                : 'bg-emerald-950/25 border-emerald-500/35 text-emerald-200'
            }`}
          >
            {stats.wheelSlipLikely
              ? '⚠ Visible wheel slip detected against the dynamometer — motor torque exceeds available tire traction.'
              : stats.pushingForceN >= 165
              ? '✓ High drawbar pull maintained with zero wheel slip against the load cell.'
              : 'ℹ Moderate pushing force recorded before drivetrain stall equilibrium.'}
          </div>
        </div>
      );
    }

    if (test === 'weapon') {
      const liveEnergy = Math.round(stats.weaponEnergyJ * Math.min(1, prog * 1.4));
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase">PEAK ENERGY</div>
              <div className="font-mono-num text-lg font-extrabold text-amber-300 mt-0.5">
                {liveEnergy.toLocaleString()} J
              </div>
            </div>
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase">SPIN-UP</div>
              <div className="font-mono-num text-lg font-extrabold text-white mt-0.5">
                {stats.weaponSpinUpSec.toFixed(1)} sec
              </div>
            </div>
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                PEAK BATTERY DRAW
              </div>
              <div className="font-mono-num text-lg font-extrabold text-cyan-300 mt-0.5">
                {stats.peakPowerDemandKw.toFixed(2)} kW
              </div>
            </div>
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                CHASSIS RECOIL
              </div>
              <div className="font-mono-num text-lg font-extrabold text-white mt-0.5">
                {stats.weaponRecoilLabel}
              </div>
            </div>
          </div>
          <div
            className={`text-xs rounded-lg p-3 border ${
              stats.weaponRecoilScore >= 60
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-200'
            }`}
          >
            {stats.weaponRecoilScore >= 60
              ? '⚠ Significant chassis reaction during weapon impact.'
              : stats.weaponControlScore >= 75
              ? '✓ Controlled actuation cycle with minimal chassis pitch disturbance.'
              : '✓ Clean energy transfer with manageable frame recoil.'}
          </div>
        </div>
      );
    }

    if (test === 'stability') {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                STABILITY RATING
              </div>
              <div className="font-mono-num text-xl font-extrabold text-cyan-300 mt-0.5">
                {stats.stabilityLabel}
              </div>
            </div>
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                CENTER OF MASS
              </div>
              <div className="font-mono-num text-xl font-extrabold text-white mt-0.5">
                {stats.centerOfMassLabel} ({stats.centerOfMassInches}&quot;)
              </div>
            </div>
          </div>
          <div
            className={`text-xs rounded-lg p-3 border ${
              stats.stabilityScore < 50 || stats.centerOfMassLabel === 'HIGH'
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                : 'bg-emerald-950/25 border-emerald-500/35 text-emerald-200'
            }`}
          >
            {stats.stabilityScore < 50 || stats.centerOfMassLabel === 'HIGH'
              ? '⚠ Elevated body roll observed during rapid turning and simulated lateral impulse.'
              : '✓ Chassis remained planted through high-rate lateral slalom maneuvers.'}
          </div>
        </div>
      );
    }

    // Power test
    const liveTemp = Math.round(36 + (stats.expectedMotorTempC - 36) * prog);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
            <div className="text-[10px] font-mono-num text-slate-400 uppercase">RUNTIME</div>
            <div className="font-mono-num text-base font-extrabold text-cyan-300 mt-0.5">
              {stats.runtimeFormatted}
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
            <div className="text-[10px] font-mono-num text-slate-400 uppercase">PEAK POWER</div>
            <div
              className={`font-mono-num text-base font-extrabold mt-0.5 ${
                stats.powerLimited ? 'text-red-400' : 'text-white'
              }`}
            >
              {stats.peakPowerDemandKw} / {stats.batteryPeakSupplyKw} kW
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
            <div className="text-[10px] font-mono-num text-slate-400 uppercase">MOTOR TEMP</div>
            <div
              className={`font-mono-num text-base font-extrabold mt-0.5 ${
                liveTemp >= 85 ? 'text-amber-400' : 'text-white'
              }`}
            >
              {liveTemp}°C
            </div>
          </div>
        </div>
        <div
          className={`text-xs rounded-lg p-3 border ${
            stats.powerLimited || stats.thermalRisk
              ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              : 'bg-emerald-950/25 border-emerald-500/35 text-emerald-200'
          }`}
        >
          {stats.powerLimited
            ? '⚠ Peak demand exceeds battery peak output — voltage sag limits spin-up & surge power.'
            : stats.thermalRisk
            ? `⚠ Motor windings reached ${stats.expectedMotorTempC}°C under continuous load.`
            : '✓ Battery bus voltage and motor temperatures remained within continuous combat limits.'}
        </div>
      </div>
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-5">
      {/* Top Bar */}
      <div className="pointer-events-auto flex items-center justify-between gap-4">
        <button
          onClick={() => {
            soundEngine.playClick();
            onReturnToCustomization();
          }}
          className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl holo-panel border border-slate-700 hover:border-cyan-400/50 text-sm font-display font-bold text-slate-200"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-400" />
          BACK TO CUSTOMIZATION
        </button>

        <div className="holo-panel holo-glow-amber rounded-xl border border-amber-500/40 px-5 py-2 text-center">
          <div className="text-[10px] font-mono-num uppercase tracking-widest text-amber-300">
            DIAGNOSTIC DYNAMOMETER BAY
          </div>
          <div className="font-display text-lg font-extrabold text-white">
            ENGINEERING TEST STAND
          </div>
        </div>

        <button
          onClick={() => {
            if (!stats.isOverweight) {
              soundEngine.playArenaHorn();
              onEnterArena();
            } else {
              soundEngine.playWarning();
            }
          }}
          disabled={stats.isOverweight}
          className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-extrabold text-sm tracking-wide transition-all ${
            stats.isOverweight
              ? 'bg-red-950/60 border border-red-500/50 text-red-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/20'
          }`}
        >
          <Swords className="w-4 h-4" />
          {stats.isOverweight ? `OVERWEIGHT (+${stats.overweightLb} LB)` : 'ENTER ARENA'}
        </button>
      </div>

      {/* Middle Right: Live Test Report Card */}
      <div className="flex justify-end my-auto">
        {shownTest && (
          <div className="pointer-events-auto holo-panel holo-glow-cyan w-full max-w-sm rounded-2xl border border-cyan-500/40 p-5 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3.5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="font-display font-extrabold text-sm tracking-wider uppercase text-white">
                  {activeTest.isRunning
                    ? `RUNNING ${shownTest.toUpperCase()} TEST...`
                    : `${shownTest.toUpperCase()} TEST COMPLETE`}
                </span>
              </div>
              <span className="font-mono-num text-xs text-cyan-300">
                {activeTest.isRunning
                  ? `${Math.round(activeTest.progress * 100)}%`
                  : '100%'}
              </span>
            </div>

            {renderTestResultCard(shownTest)}
          </div>
        )}
      </div>

      {/* Bottom Dock: 5 Selectable Engineering Tests */}
      <div className="pointer-events-auto holo-panel rounded-2xl border border-slate-800/90 p-3.5 max-w-5xl w-full mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {TEST_DEFINITIONS.map((t) => {
            const isSelected = shownTest === t.id;
            const isRunningThis = activeTest.isRunning && activeTest.testType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onStartTest(t.id)}
                className={`cursor-pointer rounded-xl p-3 text-left transition-all border flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/15'
                    : 'bg-slate-900/85 hover:bg-slate-800/90 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-cyan-400">{t.icon}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono-num uppercase px-2 py-0.5 rounded bg-slate-950/90 text-cyan-300">
                    <Play className="w-2.5 h-2.5 fill-current" />
                    {isRunningThis ? 'ACTIVE' : 'RUN'}
                  </span>
                </div>
                <div className="font-display font-extrabold text-xs sm:text-sm tracking-wide text-white">
                  {t.label}
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{t.subtitle}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
