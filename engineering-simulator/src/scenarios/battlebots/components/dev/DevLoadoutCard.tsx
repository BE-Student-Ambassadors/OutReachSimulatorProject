import React from 'react';
import { Swords, Wrench, ShieldAlert } from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';
import {
  DEV_AVAILABLE_WEAPONS,
  formatWeaponOptionLabel,
  type DevRobotSource,
} from '../../services/devMode';
import type { WeaponId } from '../../types/robot';

interface DevLoadoutCardProps {
  robotSource: DevRobotSource;
  weaponId: WeaponId;
  onChangeRobotSource: (source: DevRobotSource) => void;
  onChangeWeapon: (weaponId: WeaponId) => void;
  totalWeightLb: number;
  isOverweight: boolean;
  onEnterArena?: () => void;
  variant?: 'card' | 'compact' | 'pre-fight';
  showEnterButton?: boolean;
}

export const DevLoadoutCard: React.FC<DevLoadoutCardProps> = ({
  robotSource,
  weaponId,
  onChangeRobotSource,
  onChangeWeapon,
  totalWeightLb,
  isOverweight,
  onEnterArena,
  variant = 'card',
  showEnterButton = true,
}) => {
  // Pre-fight inside Arena modal layout
  if (variant === 'pre-fight') {
    return (
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/50 shadow-lg text-left">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
              DEV LOADOUT
            </span>
          </div>
          <span
            className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border ${
              isOverweight
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
            }`}
          >
            DEV TEST: {totalWeightLb.toFixed(1)} LB {isOverweight ? '• OVERWEIGHT ALLOWED' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Robot Source Selector */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">
              ROBOT:
            </label>
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onChangeRobotSource('default');
                }}
                className={`cursor-pointer px-2 py-1.5 rounded-lg text-xs font-mono font-bold transition-all text-center ${
                  robotSource === 'default'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Default Test Robot
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onChangeRobotSource('current');
                }}
                className={`cursor-pointer px-2 py-1.5 rounded-lg text-xs font-mono font-bold transition-all text-center ${
                  robotSource === 'current'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Current Robot
              </button>
            </div>
          </div>

          {/* Weapon Selector */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">
              WEAPON:
            </label>
            <select
              value={weaponId}
              onChange={(e) => {
                soundEngine.playClick();
                onChangeWeapon(e.target.value as WeaponId);
              }}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
            >
              {DEV_AVAILABLE_WEAPONS.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {formatWeaponOptionLabel(spec)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Card variant (renders on Team Dashboard / Systems Integration)
  return (
    <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-amber-300 p-4 rounded-2xl shadow-xl text-left max-w-sm w-full animate-in fade-in zoom-in-95">
      {/* Header */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5 pb-2 border-b border-amber-200 font-mono">
        <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
          <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
          <span>DEV LOADOUT</span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
          Arena Testing
        </span>
      </div>

      <div className="space-y-2.5 mb-3 text-xs">
        {/* Robot Selection Toggle */}
        <div>
          <label className="block text-[11px] font-mono font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
            <Wrench className="w-3 h-3 text-slate-500" />
            <span>Robot:</span>
          </label>
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onChangeRobotSource('default');
              }}
              className={`cursor-pointer px-2 py-1.5 rounded-lg text-xs font-mono font-bold transition-all text-center ${
                robotSource === 'default'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Default Test Robot
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onChangeRobotSource('current');
              }}
              className={`cursor-pointer px-2 py-1.5 rounded-lg text-xs font-mono font-bold transition-all text-center ${
                robotSource === 'current'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Current Robot
            </button>
          </div>
        </div>

        {/* Weapon Selection Dropdown */}
        <div>
          <label className="block text-[11px] font-mono font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
            <span>Weapon:</span>
            <span className="text-[10px] font-normal text-slate-500 lowercase">from components.ts</span>
          </label>
          <select
            value={weaponId}
            onChange={(e) => {
              soundEngine.playClick();
              onChangeWeapon(e.target.value as WeaponId);
            }}
            className="cursor-pointer w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
          >
            {DEV_AVAILABLE_WEAPONS.map((spec) => (
              <option key={spec.id} value={spec.id}>
                {formatWeaponOptionLabel(spec)}
              </option>
            ))}
          </select>
        </div>

        {/* Weight Badge */}
        <div
          className={`px-3 py-1.5 rounded-xl border flex items-center justify-between font-mono text-xs ${
            isOverweight
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {isOverweight && <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />}
            <span className="text-slate-500 font-semibold">Weight:</span>
          </div>
          <span className="font-bold">
            DEV TEST: {totalWeightLb.toFixed(1)} LB {isOverweight ? '(OVERWEIGHT ALLOWED)' : ''}
          </span>
        </div>
      </div>

      {/* Enter Arena / Test Arena Action */}
      {showEnterButton && onEnterArena && (
        <button
          type="button"
          onClick={() => {
            soundEngine.playArenaHorn();
            onEnterArena();
          }}
          className="cursor-pointer w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-display font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 transition-all transform active:scale-98 flex items-center justify-center gap-1.5"
        >
          <Swords className="w-4 h-4" />
          <span>TEST ARENA →</span>
        </button>
      )}
    </div>
  );
};
