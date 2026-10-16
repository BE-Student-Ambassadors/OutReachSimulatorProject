import { Activity, BatteryCharging, Cpu, Gauge, Shield, Thermometer, X } from 'lucide-react';
import React from 'react';
import { ARMOR_CATALOG, ARMOR_THICKNESS_OPTIONS, BATTERY_CATALOG, CHASSIS_CATALOG, DRIVE_CATALOG, UTILITY_CATALOG, WEAPON_CATALOG, WHEELS_CATALOG } from '../../data/components';
import { type EngineeringStats, type RobotConfiguration } from '../../types/robot';

interface EngineeringDetailsDrawerProps {
  config: RobotConfiguration;
  stats: EngineeringStats;
  onClose: () => void;
}

export const EngineeringDetailsDrawer: React.FC<EngineeringDetailsDrawerProps> = ({
  config,
  stats,
  onClose,
}) => {
  const chassis = CHASSIS_CATALOG[config.chassisId];
  const drive = DRIVE_CATALOG[config.driveId];
  const wheels = WHEELS_CATALOG[config.wheelsId];
  const armor = ARMOR_CATALOG[config.armorId];
  const thick = ARMOR_THICKNESS_OPTIONS[config.armorThickness];
  const battery = BATTERY_CATALOG[config.batteryId];
  const weapon =
    config.weaponId === 'custom-weapon' && config.customWeapon
      ? {
          name: config.customWeapon.name,
          weightLb: config.customWeapon.mass,
          engineeringDetail: {
            materialOrSpec: `Custom Procedural (${config.customWeapon.visualDescription})`,
            technicalNote: config.customWeapon.description,
          },
        }
      : WEAPON_CATALOG[config.weaponId === 'custom-weapon' ? 'wedge' : config.weaponId];

  const utility =
    config.utilityId === 'custom-utility' && config.customUtility
      ? {
          name: config.customUtility.name,
          weightLb: config.customUtility.mass,
          engineeringDetail: {
            materialOrSpec: `Custom Utility (${config.customUtility.visualDescription})`,
            technicalNote: config.customUtility.description,
          },
        }
      : UTILITY_CATALOG[config.utilityId === 'custom-utility' ? 'none' : config.utilityId];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="holo-panel h-full w-full max-w-xl border-l border-cyan-500/35 p-6 overflow-y-auto flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <div>
                <h2 className="font-display text-xl font-extrabold text-white tracking-wide">
                  ENGINEERING TELEMETRY & SPECIFICATIONS
                </h2>
                <p className="text-xs text-slate-400">
                  Full physical calculations, material alloys, and subsystem dynamics
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 1. Mobility, Traction & Dynamics */}
          <div className="mb-5">
            <h3 className="text-xs font-mono-num uppercase tracking-widest text-cyan-300 font-bold mb-2.5 flex items-center gap-1.5">
              <Gauge className="w-4 h-4" /> MOBILITY, TRACTION & MASS DISTRIBUTION
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400">TOP SPEED</div>
                <div className="font-mono-num text-base font-bold text-white mt-0.5">
                  {stats.topSpeedMph} MPH
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  0–10 mph in {stats.zeroToTenSec}s
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400">PUSHING FORCE</div>
                <div className="font-mono-num text-base font-bold text-white mt-0.5">
                  {stats.pushingForceN} N
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Torque: {stats.driveTorqueNm} N·m
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400">FLOOR TRACTION</div>
                <div className="font-mono-num text-base font-bold text-white mt-0.5">
                  {stats.tractionLabel} (μ = {stats.tractionCoeff})
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {stats.wheelSlipLikely ? 'Slip-limited' : 'Grip-matched'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400">TURNING AGILITY</div>
                <div className="font-mono-num text-base font-bold text-white mt-0.5">
                  {stats.turningRateDegPerSec}°/sec
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{stats.turningLabel} YAW</div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400">CENTER OF MASS</div>
                <div className="font-mono-num text-base font-bold text-white mt-0.5">
                  {stats.centerOfMassLabel} ({stats.centerOfMassInches}&quot;)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Clearance: {stats.groundClearanceInches.toFixed(2)}&quot;
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400">STABILITY</div>
                <div className="font-mono-num text-base font-bold text-white mt-0.5">
                  {stats.stabilityLabel} ({stats.stabilityScore}/100)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Self-Right: {stats.selfRightingLabel}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Weapon, Electrical Power & Thermal */}
          <div className="mb-5">
            <h3 className="text-xs font-mono-num uppercase tracking-widest text-amber-300 font-bold mb-2.5 flex items-center gap-1.5">
              <BatteryCharging className="w-4 h-4" /> WEAPON KINETICS, POWER BUS & THERMAL LOAD
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400">WEAPON ENERGY</div>
                <div className="font-mono-num text-base font-bold text-amber-300 mt-0.5">
                  {stats.weaponEnergyJ.toLocaleString()} J
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Spin-up: {stats.weaponSpinUpSec} sec
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400">WEAPON RECOIL</div>
                <div className="font-mono-num text-base font-bold text-white mt-0.5">
                  {stats.weaponRecoilLabel}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Control Rating: {stats.weaponControlScore}/100
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400">PEAK POWER BUS</div>
                <div
                  className={`font-mono-num text-base font-bold mt-0.5 ${
                    stats.powerLimited ? 'text-red-400' : 'text-emerald-300'
                  }`}
                >
                  {stats.peakPowerDemandKw} / {stats.batteryPeakSupplyKw} kW
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {stats.powerLimited ? 'Voltage Sag Active' : 'Sufficient Headroom'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400">EST. RUNTIME</div>
                <div className="font-mono-num text-base font-bold text-white mt-0.5">
                  {stats.runtimeFormatted}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Capacity: {stats.batteryCapacityWh} Wh
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400 flex items-center gap-1">
                  <Thermometer className="w-3 h-3" /> MOTOR TEMP
                </div>
                <div
                  className={`font-mono-num text-base font-bold mt-0.5 ${
                    stats.thermalRisk ? 'text-amber-400' : 'text-white'
                  }`}
                >
                  {stats.expectedMotorTempC}°C
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {stats.thermalRisk ? 'High Thermal Load' : 'Nominal Range'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                <div className="text-[10px] font-mono-num text-slate-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> ARMOR (F / S / R)
                </div>
                <div className="font-mono-num text-base font-bold text-white mt-0.5">
                  {stats.frontArmorScore} / {stats.sideArmorScore} / {stats.rearArmorScore}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {thick.thicknessMm}mm {armor.name}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Installed Subsystem Hardware Breakdown */}
          <div>
            <h3 className="text-xs font-mono-num uppercase tracking-widest text-slate-300 font-bold mb-2.5 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" /> INSTALLED SUBSYSTEM SPECIFICATIONS
            </h3>
            <div className="space-y-2">
              {[
                { cat: 'CHASSIS', item: chassis, weight: chassis.weightLb },
                { cat: 'DRIVE', item: drive, weight: drive.weightLb },
                { cat: 'WHEELS', item: wheels, weight: wheels.weightLb },
                {
                  cat: `ARMOR (${thick.label})`,
                  item: armor,
                  weight: stats.armorWeightLb,
                },
                { cat: 'WEAPON', item: weapon, weight: weapon.weightLb },
                { cat: 'POWER', item: battery, weight: battery.weightLb },
                { cat: 'UTILITY', item: utility, weight: utility.weightLb },
              ].map(({ cat, item, weight }) => (
                <div
                  key={cat}
                  className="rounded-xl bg-slate-900/75 border border-slate-800/90 px-3.5 py-2.5 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono-num uppercase px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {cat}
                      </span>
                      <span className="font-display font-bold text-sm text-white">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-xs text-cyan-200/90 font-mono-num mt-1">
                      {item.engineeringDetail.materialOrSpec}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {item.engineeringDetail.technicalNote}
                    </div>
                  </div>
                  <div className="font-mono-num text-sm font-bold text-slate-200 shrink-0">
                    {weight.toFixed(1)} LB
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
