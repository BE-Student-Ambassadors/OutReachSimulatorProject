import React, { useState } from 'react';
import { X, Compass } from 'lucide-react';
import {
  type ChassisId,
  type DriveId,
  type WheelsId,
  type ArmorId,
  type WeaponId,
  type UtilityId,
} from '../../../types/robot';

interface BlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  config: {
    chassisId: ChassisId;
    driveId: DriveId;
    wheelsId: WheelsId;
    armorId: ArmorId;
    weaponId: WeaponId;
    utilityId: UtilityId;
  };
}

type BlueprintView = 'top' | 'side' | 'exploded';

export const BlueprintModal: React.FC<BlueprintModalProps> = ({
  isOpen,
  onClose,
  teamName,
  config,
}) => {
  const [activeView, setActiveView] = useState<BlueprintView>('top');

  if (!isOpen) return null;

  // Geometry dimensions based on chassis choice
  const isWide = config.chassisId === 'wide';
  const isCompact = config.chassisId === 'compact';
  const isLong = config.chassisId === 'long';
  const isLow = config.chassisId === 'low-profile';

  const chassisWidth = isWide ? 260 : isCompact ? 180 : 210;
  const chassisLength = isLong ? 280 : isCompact ? 200 : 230;
  const chassisHeight = isLow ? 40 : 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-[#071326] border-2 border-cyan-500/50 rounded-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Technical Blueprint Header */}
        <div className="px-5 py-3.5 bg-[#0a1c38] border-b border-cyan-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono-num font-bold text-cyan-400 uppercase tracking-widest">
                  ENGINEERING BLUEPRINT • DRAWING NO. AGY-BB-2026
                </span>
                <span className="px-1.5 py-0.2 text-[9px] font-mono-num bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
                  REV 3.2
                </span>
              </div>
              <h3 className="font-display font-black text-lg text-white tracking-wide">
                SYSTEM ASSEMBLY SPECIFICATION — {teamName.toUpperCase()}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-[#071326] p-1 rounded-xl border border-cyan-500/30 text-xs font-mono-num">
              {(['top', 'side', 'exploded'] as BlueprintView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setActiveView(v)}
                  className={`px-3 py-1 rounded-lg uppercase font-bold transition-colors ${
                    activeView === v
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-cyan-300/70 hover:text-cyan-200'
                  }`}
                >
                  {v === 'top' ? 'Top View' : v === 'side' ? 'Side View' : 'Exploded'}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="cursor-pointer text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-cyan-950/60 transition-colors ml-2"
              title="Close blueprint"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Blueprint Canvas Body */}
        <div className="relative flex-1 p-6 overflow-auto bg-[#07152b] min-h-[420px] flex items-center justify-center select-none">
          {/* Blueprint Grid Background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage:
                'linear-gradient(to right, #00ffff 1px, transparent 1px), linear-gradient(to bottom, #00ffff 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }}
          />

          {/* Technical Drawing SVG */}
          <svg
            viewBox="0 0 800 460"
            className="w-full h-auto max-h-[440px] drop-shadow-[0_0_15px_rgba(6,182,212,0.15)] font-mono"
          >
            {/* Compass / Center Grid Lines */}
            <line x1="400" y1="20" x2="400" y2="440" stroke="#00ffff" strokeWidth="0.8" strokeDasharray="6,4" opacity="0.3" />
            <line x1="40" y1="230" x2="760" y2="230" stroke="#00ffff" strokeWidth="0.8" strokeDasharray="6,4" opacity="0.3" />

            {/* TOP VIEW */}
            {activeView === 'top' && (
              <g transform="translate(400, 230)">
                {/* 1. CHASSIS TUB */}
                <rect
                  x={-chassisWidth / 2}
                  y={-chassisLength / 2}
                  width={chassisWidth}
                  height={chassisLength}
                  rx="10"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                />
                <rect
                  x={-chassisWidth / 2 + 15}
                  y={-chassisLength / 2 + 15}
                  width={chassisWidth - 30}
                  height={chassisLength - 30}
                  rx="6"
                  fill="#0c2347"
                  stroke="#0284c7"
                  strokeWidth="1.2"
                  strokeDasharray="4,2"
                />

                {/* 2. DRIVE MOTORS (Left & Right) */}
                <rect x={-chassisWidth / 2 + 25} y="-35" width="45" height="70" rx="4" fill="#0369a1" stroke="#38bdf8" strokeWidth="1.5" />
                <circle cx={-chassisWidth / 2 + 47} cy="0" r="12" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                <rect x={chassisWidth / 2 - 70} y="-35" width="45" height="70" rx="4" fill="#0369a1" stroke="#38bdf8" strokeWidth="1.5" />
                <circle cx={chassisWidth / 2 - 47} cy="0" r="12" fill="none" stroke="#38bdf8" strokeWidth="1.5" />

                {/* 3. WHEELS (Tracks or 4 Wheels) */}
                {config.wheelsId === 'tracks' ? (
                  <>
                    <rect x={-chassisWidth / 2 - 40} y={-chassisLength / 2 - 5} width="35" height={chassisLength + 10} rx="12" fill="#0c254c" stroke="#38bdf8" strokeWidth="2" />
                    <rect x={chassisWidth / 2 + 5} y={-chassisLength / 2 - 5} width="35" height={chassisLength + 10} rx="12" fill="#0c254c" stroke="#38bdf8" strokeWidth="2" />
                  </>
                ) : (
                  <>
                    {/* Front Left */}
                    <rect x={-chassisWidth / 2 - (config.wheelsId === 'large' ? 38 : 28)} y={-chassisLength / 2 + 10} width={config.wheelsId === 'high-traction' ? 34 : 26} height={config.wheelsId === 'large' ? 75 : 55} rx="6" fill="#0c254c" stroke="#38bdf8" strokeWidth="1.8" />
                    {/* Rear Left */}
                    <rect x={-chassisWidth / 2 - (config.wheelsId === 'large' ? 38 : 28)} y={chassisLength / 2 - (config.wheelsId === 'large' ? 85 : 65)} width={config.wheelsId === 'high-traction' ? 34 : 26} height={config.wheelsId === 'large' ? 75 : 55} rx="6" fill="#0c254c" stroke="#38bdf8" strokeWidth="1.8" />
                    {/* Front Right */}
                    <rect x={chassisWidth / 2 + 5} y={-chassisLength / 2 + 10} width={config.wheelsId === 'high-traction' ? 34 : 26} height={config.wheelsId === 'large' ? 75 : 55} rx="6" fill="#0c254c" stroke="#38bdf8" strokeWidth="1.8" />
                    {/* Rear Right */}
                    <rect x={chassisWidth / 2 + 5} y={chassisLength / 2 - (config.wheelsId === 'large' ? 85 : 65)} width={config.wheelsId === 'high-traction' ? 34 : 26} height={config.wheelsId === 'large' ? 75 : 55} rx="6" fill="#0c254c" stroke="#38bdf8" strokeWidth="1.8" />
                  </>
                )}

                {/* 4. ARMOR PERIMETER PLATES */}
                <rect x={-chassisWidth / 2 - 6} y={-chassisLength / 2 + 2} width="6" height={chassisLength - 4} fill="#38bdf8" opacity="0.6" />
                <rect x={chassisWidth / 2} y={-chassisLength / 2 + 2} width="6" height={chassisLength - 4} fill="#38bdf8" opacity="0.6" />
                <rect x={-chassisWidth / 2} y={chassisLength / 2} width={chassisWidth} height="6" fill="#38bdf8" opacity="0.6" />

                {/* 5. WEAPON ASSEMBLY (Front Mounted: y is negative) */}
                {config.weaponId === 'vertical-spinner' ? (
                  <g transform={`translate(0, ${-chassisLength / 2 - 20})`}>
                    <rect x="-16" y="-35" width="32" height="70" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
                    <circle cx="0" cy="0" r="8" fill="#38bdf8" />
                    <line x1="-30" y1="0" x2="30" y2="0" stroke="#38bdf8" strokeWidth="3" />
                  </g>
                ) : config.weaponId === 'horizontal-spinner' ? (
                  <g transform={`translate(0, ${-chassisLength / 2 - 25})`}>
                    <rect x={-chassisWidth / 2 + 10} y="-12" width={chassisWidth - 20} height="24" rx="6" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
                    <circle cx="0" cy="0" r="10" fill="#38bdf8" />
                  </g>
                ) : config.weaponId === 'lifter' ? (
                  <g transform={`translate(0, ${-chassisLength / 2 - 15})`}>
                    <rect x="-45" y="-35" width="20" height="60" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
                    <rect x="25" y="-35" width="20" height="60" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
                  </g>
                ) : config.weaponId === 'hammer' ? (
                  <g transform="translate(0, -20)">
                    <rect x="-10" y="-120" width="20" height="130" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
                    <polygon points="-30,-125 30,-125 0,-155" fill="#38bdf8" />
                  </g>
                ) : config.weaponId === 'grabber' ? (
                  <g transform={`translate(0, ${-chassisLength / 2 - 20})`}>
                    <path d="M -40 20 L -60 -35 L -10 -40" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                    <path d="M 40 20 L 60 -35 L 10 -40" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                  </g>
                ) : (
                  // Wedge
                  <g transform={`translate(0, ${-chassisLength / 2 - 18})`}>
                    <polygon
                      points={`${-chassisWidth / 2 - 10},25 ${chassisWidth / 2 + 10},25 ${chassisWidth / 2 - 20},-20 ${-chassisWidth / 2 + 20},-20`}
                      fill="#0c2347"
                      stroke="#38bdf8"
                      strokeWidth="2.2"
                    />
                  </g>
                )}

                {/* Callout Annotations */}
                <g stroke="#00ffff" strokeWidth="1" strokeDasharray="3,2">
                  {/* Weapon Leader */}
                  <line x1="0" y1={-chassisLength / 2 - 35} x2="-140" y2="-170" />
                  <circle cx="0" cy={-chassisLength / 2 - 35} r="3" fill="#00ffff" />
                  <text x="-150" y="-172" fill="#00ffff" fontSize="11" textAnchor="end" fontWeight="bold">
                    [5] FRONT WEAPON BULKHEAD
                  </text>

                  {/* Chassis Leader */}
                  <line x1="40" y1="40" x2="160" y2="120" />
                  <circle cx="40" cy="40" r="3" fill="#00ffff" />
                  <text x="170" y="125" fill="#00ffff" fontSize="11" fontWeight="bold">
                    [1] CHASSIS STRUCTURAL FRAME
                  </text>

                  {/* Drive Leader */}
                  <line x1={-chassisWidth / 2 + 45} y1="0" x2="-180" y2="50" />
                  <circle cx={-chassisWidth / 2 + 45} cy="0" r="3" fill="#00ffff" />
                  <text x="-190" y="55" fill="#00ffff" fontSize="11" textAnchor="end" fontWeight="bold">
                    [2] INTERNAL DRIVE MOTORS
                  </text>

                  {/* Wheels Leader */}
                  <line x1={chassisWidth / 2 + 20} y1="60" x2="180" y2="20" />
                  <circle cx={chassisWidth / 2 + 20} cy="60" r="3" fill="#00ffff" />
                  <text x="190" y="24" fill="#00ffff" fontSize="11" fontWeight="bold">
                    [3] WHEEL AXLE HUBS
                  </text>
                </g>

                {/* Heading Arrow: FRONT */}
                <polygon points="0,-190 -8,-175 8,-175" fill="#38bdf8" />
                <text x="0" y="-195" fill="#38bdf8" fontSize="11" textAnchor="middle" fontWeight="bold">
                  ▲ FRONT
                </text>
              </g>
            )}

            {/* SIDE VIEW */}
            {activeView === 'side' && (
              <g transform="translate(400, 260)">
                {/* Ground Plane */}
                <line x1="-320" y1="50" x2="320" y2="50" stroke="#00ffff" strokeWidth="1.5" strokeDasharray="6,3" opacity="0.6" />
                <text x="310" y="65" fill="#38bdf8" fontSize="10" textAnchor="end">
                  GROUND PLANE
                </text>

                {/* 1. CHASSIS SIDE PROFILE */}
                <rect
                  x={-chassisLength / 2}
                  y={50 - chassisHeight - 20}
                  width={chassisLength}
                  height={chassisHeight}
                  rx="6"
                  fill="#0c2347"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                />

                {/* 2. WHEELS (Side Silhouette) */}
                <circle cx={-chassisLength / 2 + 35} cy="30" r={config.wheelsId === 'large' ? 36 : 24} fill="#0c254c" stroke="#38bdf8" strokeWidth="2" />
                <circle cx={chassisLength / 2 - 35} cy="30" r={config.wheelsId === 'large' ? 36 : 24} fill="#0c254c" stroke="#38bdf8" strokeWidth="2" />

                {/* 3. WEAPON (Left side is FRONT) */}
                {config.weaponId === 'vertical-spinner' ? (
                  <g transform={`translate(${-chassisLength / 2 - 25}, 15)`}>
                    <circle cx="0" cy="0" r="38" fill="none" stroke="#38bdf8" strokeWidth="3" />
                    <rect x="-10" y="-4" width="20" height="8" fill="#38bdf8" />
                  </g>
                ) : config.weaponId === 'hammer' ? (
                  <g transform={`translate(${-chassisLength / 4}, ${50 - chassisHeight - 20})`}>
                    <line x1="0" y1="0" x2="-40" y2="-90" stroke="#38bdf8" strokeWidth="4" />
                    <rect x="-65" y="-105" width="45" height="25" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
                  </g>
                ) : (
                  <polygon
                    points={`${-chassisLength / 2 - 40},48 ${-chassisLength / 2 + 10},${50 - chassisHeight - 25} ${-chassisLength / 2 + 10},48`}
                    fill="#0284c7"
                    stroke="#38bdf8"
                    strokeWidth="2"
                  />
                )}

                {/* Front Indicator */}
                <text x={-chassisLength / 2 - 60} y="30" fill="#38bdf8" fontSize="12" fontWeight="bold">
                  ◄ FRONT
                </text>
              </g>
            )}

            {/* EXPLODED VIEW */}
            {activeView === 'exploded' && (
              <g transform="translate(400, 230)">
                {/* 1. Base Chassis (Center) */}
                <rect x="-90" y="-35" width="180" height="70" rx="6" fill="#0c2347" stroke="#38bdf8" strokeWidth="2" />
                <text x="0" y="5" fill="#38bdf8" fontSize="10" textAnchor="middle" fontWeight="bold">
                  [1] CHASSIS FRAME
                </text>

                {/* 2. Drive Motors (Displaced Inward / Up) */}
                <line x1="-50" y1="-35" x2="-50" y2="-75" stroke="#00ffff" strokeDasharray="3,2" />
                <line x1="50" y1="-35" x2="50" y2="-75" stroke="#00ffff" strokeDasharray="3,2" />
                <rect x="-70" y="-105" width="40" height="30" rx="4" fill="#0369a1" stroke="#38bdf8" strokeWidth="1.5" />
                <rect x="30" y="-105" width="40" height="30" rx="4" fill="#0369a1" stroke="#38bdf8" strokeWidth="1.5" />
                <text x="0" y="-90" fill="#00ffff" fontSize="9" textAnchor="middle">
                  [2] DRIVE MOTORS (DROP IN)
                </text>

                {/* 3. Wheels (Displaced Outward Left & Right) */}
                <line x1="-90" y1="0" x2="-160" y2="0" stroke="#00ffff" strokeDasharray="3,2" />
                <circle cx="-185" cy="0" r="22" fill="#0c254c" stroke="#38bdf8" strokeWidth="2" />
                <text x="-185" y="35" fill="#00ffff" fontSize="9" textAnchor="middle">
                  [3] WHEEL HUBS
                </text>

                <line x1="90" y1="0" x2="160" y2="0" stroke="#00ffff" strokeDasharray="3,2" />
                <circle cx="185" cy="0" r="22" fill="#0c254c" stroke="#38bdf8" strokeWidth="2" />
                <text x="185" y="35" fill="#00ffff" fontSize="9" textAnchor="middle">
                  [3] WHEEL HUBS
                </text>

                {/* 4. Armor Plating (Displaced Downward) */}
                <line x1="0" y1="35" x2="0" y2="90" stroke="#00ffff" strokeDasharray="3,2" />
                <rect x="-110" y="95" width="220" height="15" rx="3" fill="#38bdf8" opacity="0.6" />
                <text x="0" y="125" fill="#00ffff" fontSize="9" textAnchor="middle">
                  [4] PERIMETER ARMOR PANELS
                </text>

                {/* 5. Front Weapon (Displaced Forward / Left) */}
                <line x1="-90" y1="-20" x2="-230" y2="-90" stroke="#00ffff" strokeDasharray="3,2" />
                <rect x="-260" y="-120" width="50" height="45" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
                <text x="-235" y="-60" fill="#00ffff" fontSize="9" textAnchor="middle">
                  [5] FRONT WEAPON
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Technical Title Block (Footer) */}
        <div className="px-5 py-3 bg-[#0a1c38] border-t border-cyan-500/40 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-num">
          <div className="flex items-center gap-4 text-slate-300">
            <div>
              <span className="text-[10px] text-cyan-400 block uppercase">CONFIGURATION:</span>
              <strong className="text-white uppercase">
                {config.chassisId} • {config.driveId} • {config.weaponId}
              </strong>
            </div>
            <div className="w-px h-6 bg-cyan-500/30" />
            <div>
              <span className="text-[10px] text-cyan-400 block uppercase">ARMOR / WHEELS:</span>
              <span className="text-slate-200 uppercase">
                {config.armorId} • {config.wheelsId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-cyan-400 italic">
              Follow assembly mounting sequence: Frame → Drive → Wheels → Armor → Weapon
            </span>
            <button
              onClick={onClose}
              className="cursor-pointer px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all"
            >
              CLOSE BLUEPRINT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
