import { ArrowLeftRight, X } from 'lucide-react';
import React, { useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import { ARMOR_CATALOG, BATTERY_CATALOG, CHASSIS_CATALOG, DRIVE_CATALOG, UTILITY_CATALOG, WEAPON_CATALOG, WHEELS_CATALOG } from '../../data/components';
import { calculateEngineeringStats } from '../../simulation/engineering';
import { type ArmorId, type BatteryId, type ChassisId, type ComponentCardSpec, type ComponentCategory, type DriveId, type RobotConfiguration, type UtilityId, type WeaponId, type WheelsId } from '../../types/robot';

interface CompareModalProps {
  category: ComponentCategory;
  currentConfig: RobotConfiguration;
  initialPartAId?: string;
  onClose: () => void;
  onEquipPart: (category: ComponentCategory, id: string) => void;
}

function getCatalogForCategory(cat: ComponentCategory): ComponentCardSpec[] {
  switch (cat) {
    case 'chassis':
      return Object.values(CHASSIS_CATALOG);
    case 'drive':
      return Object.values(DRIVE_CATALOG);
    case 'wheels':
      return Object.values(WHEELS_CATALOG);
    case 'armor':
      return Object.values(ARMOR_CATALOG);
    case 'weapon':
      return Object.values(WEAPON_CATALOG);
    case 'power':
      return Object.values(BATTERY_CATALOG);
    case 'utility':
      return Object.values(UTILITY_CATALOG);
  }
}

function applyPartToConfig(
  base: RobotConfiguration,
  cat: ComponentCategory,
  id: string
): RobotConfiguration {
  switch (cat) {
    case 'chassis':
      return { ...base, chassisId: id as ChassisId };
    case 'drive':
      return { ...base, driveId: id as DriveId };
    case 'wheels':
      return { ...base, wheelsId: id as WheelsId };
    case 'armor':
      return { ...base, armorId: id as ArmorId };
    case 'weapon':
      return { ...base, weaponId: id as WeaponId };
    case 'power':
      return { ...base, batteryId: id as BatteryId };
    case 'utility':
      return { ...base, utilityId: id as UtilityId };
  }
}

export const CompareModal: React.FC<CompareModalProps> = ({
  category,
  currentConfig,
  initialPartAId,
  onClose,
  onEquipPart,
}) => {
  const items = getCatalogForCategory(category);
  const [partAId, setPartAId] = useState<string>(initialPartAId || items[0]?.id || '');
  const [partBId, setPartBId] = useState<string>(
    items.find((i) => i.id !== (initialPartAId || items[0]?.id))?.id || items[1]?.id || items[0]?.id || ''
  );

  const partA = items.find((i) => i.id === partAId) || items[0];
  const partB = items.find((i) => i.id === partBId) || items[1] || items[0];

  const statsA = calculateEngineeringStats(applyPartToConfig(currentConfig, category, partA.id));
  const statsB = calculateEngineeringStats(applyPartToConfig(currentConfig, category, partB.id));

  const rows = [
    {
      label: 'Component Mass',
      valA: `${partA.weightLb.toFixed(1)} LB`,
      valB: `${partB.weightLb.toFixed(1)} LB`,
      pctA: Math.min(100, (partA.weightLb / 8.6) * 100),
      pctB: Math.min(100, (partB.weightLb / 8.6) * 100),
    },
    {
      label: 'Total Robot Weight',
      valA: `${statsA.totalWeightLb.toFixed(1)} / 30.0 LB`,
      valB: `${statsB.totalWeightLb.toFixed(1)} / 30.0 LB`,
      pctA: Math.min(100, (statsA.totalWeightLb / 30) * 100),
      pctB: Math.min(100, (statsB.totalWeightLb / 30) * 100),
    },
    {
      label: 'Weapon Energy',
      valA: `${statsA.weaponEnergyJ.toLocaleString()} J`,
      valB: `${statsB.weaponEnergyJ.toLocaleString()} J`,
      pctA: Math.min(100, (statsA.weaponEnergyJ / 4200) * 100),
      pctB: Math.min(100, (statsB.weaponEnergyJ / 4200) * 100),
    },
    {
      label: 'Spin-Up / Cycle Time',
      valA: `${statsA.weaponSpinUpSec.toFixed(1)} sec`,
      valB: `${statsB.weaponSpinUpSec.toFixed(1)} sec`,
      pctA: Math.min(100, (statsA.weaponSpinUpSec / 3.5) * 100),
      pctB: Math.min(100, (statsB.weaponSpinUpSec / 3.5) * 100),
    },
    {
      label: 'Control / Leverage',
      valA: `${statsA.weaponControlScore} / 100`,
      valB: `${statsB.weaponControlScore} / 100`,
      pctA: statsA.weaponControlScore,
      pctB: statsB.weaponControlScore,
    },
    {
      label: 'Peak Power Demand',
      valA: `${statsA.peakPowerDemandKw.toFixed(2)} kW`,
      valB: `${statsB.peakPowerDemandKw.toFixed(2)} kW`,
      pctA: Math.min(100, (statsA.peakPowerDemandKw / 4.5) * 100),
      pctB: Math.min(100, (statsB.peakPowerDemandKw / 4.5) * 100),
    },
    {
      label: 'Pushing Force',
      valA: `${statsA.pushingForceN} N`,
      valB: `${statsB.pushingForceN} N`,
      pctA: Math.min(100, (statsA.pushingForceN / 220) * 100),
      pctB: Math.min(100, (statsB.pushingForceN / 220) * 100),
    },
    {
      label: 'Chassis Stability',
      valA: `${statsA.stabilityLabel} (${statsA.stabilityScore})`,
      valB: `${statsB.stabilityLabel} (${statsB.stabilityScore})`,
      pctA: statsA.stabilityScore,
      pctB: statsB.stabilityScore,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="holo-panel holo-glow-cyan w-full max-w-4xl rounded-2xl border border-cyan-500/35 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-display text-xl font-extrabold text-white tracking-wide">
                ENGINEERING TRADEOFF COMPARISON — {category.toUpperCase()}
              </h2>
              <p className="text-xs text-slate-400">
                Neither component is strictly &ldquo;better&rdquo; — compare how each affects mass,
                power, and stability on your current robot.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { selected: partA, setId: setPartAId, accent: 'cyan' },
            { selected: partB, setId: setPartBId, accent: 'amber' },
          ].map(({ selected, setId, accent }, idx) => (
            <div
              key={idx}
              className={`rounded-xl p-4 border ${
                accent === 'cyan'
                  ? 'bg-cyan-950/20 border-cyan-500/40'
                  : 'bg-amber-950/20 border-amber-500/40'
              }`}
            >
              <div className="flex flex-wrap gap-1.5 mb-3">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      soundEngine.playClick();
                      setId(item.id);
                    }}
                    className={`cursor-pointer px-2.5 py-1 rounded-md text-xs font-mono-num font-semibold transition-all ${
                      selected.id === item.id
                        ? accent === 'cyan'
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-amber-400 text-slate-950'
                        : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-display text-lg font-extrabold text-white">{selected.name}</h3>
                <span className="font-mono-num text-sm font-bold text-cyan-300">
                  {selected.weightLb.toFixed(1)} LB
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">{selected.subtitle}</p>

              <div className="space-y-1 text-xs mb-4">
                {selected.pros.map((p, i) => (
                  <div key={i} className="text-emerald-300">
                    + {p}
                  </div>
                ))}
                {selected.cons.map((c, i) => (
                  <div key={i} className="text-amber-300">
                    - {c}
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  onEquipPart(category, selected.id);
                  onClose();
                }}
                className={`cursor-pointer w-full py-2 rounded-lg font-display font-bold text-xs tracking-wider uppercase ${
                  accent === 'cyan'
                    ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                EQUIP {selected.name}
              </button>
            </div>
          ))}
        </div>

        {/* Side-by-side metric bars */}
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.label}
              className="rounded-xl bg-slate-900/80 border border-slate-800/90 px-4 py-2.5"
            >
              <div className="flex items-center justify-between text-xs font-mono-num mb-1.5">
                <span className="text-cyan-300 font-semibold">{r.valA}</span>
                <span className="text-slate-400 uppercase tracking-wider">{r.label}</span>
                <span className="text-amber-300 font-semibold">{r.valB}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden flex justify-end">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${r.pctA}%` }}
                  />
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${r.pctB}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
