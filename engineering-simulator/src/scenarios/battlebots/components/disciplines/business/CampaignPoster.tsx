import React from 'react';
import {
  Zap,
  Award,
  Crosshair,
  Building2,
  Flame,
} from 'lucide-react';
import {
  type ChassisId,
  type WeaponId,
  type WheelsId,
  type ArmorId,
  type TeamRobotProject,
} from '../../../types/robot';
import { type AdCampaignEvaluation } from '../../../data/teamData';

export type PosterTemplate =
  | 'hero-poster'
  | 'diagonal-action'
  | 'tech-blueprint'
  | 'arena-showdown'
  | 'clean-sponsor';

interface CampaignPosterProps {
  project: TeamRobotProject;
  promptText: string;
  evaluation: AdCampaignEvaluation | null;
  selectedTemplate?: PosterTemplate;
  onSelectTemplate?: (template: PosterTemplate) => void;
  stats?: {
    weaponEnergyJ: number;
    topSpeedMph: number;
    totalWeightLb: number;
    frontArmorScore?: number;
  };
}

/**
 * Procedural Vector 2D Robot Art representing the student team's actual robot build.
 * No emojis used! Clean, stylized, multi-layered mechanical vector illustration.
 */
export const RobotIllustration2D: React.FC<{
  chassisId: ChassisId;
  weaponId: WeaponId;
  wheelsId: WheelsId;
  armorId: ArmorId;
  accentColor: string;
  className?: string;
  showSparks?: boolean;
}> = ({
  chassisId,
  weaponId,
  wheelsId,
  armorId,
  accentColor,
  className = 'w-72 h-72',
  showSparks = true,
}) => {
  const stroke = '#0f172a'; // slate-900
  const metalBody = armorId === 'titanium' ? '#94a3b8' : armorId === 'polycarbonate' ? '#f1f5f9' : '#334155';
  const armorHighlight = armorId === 'titanium' ? '#60a5fa' : armorId === 'polycarbonate' ? '#e2e8f0' : '#475569';
  const treadColor = '#090d16';

  const isWide = chassisId.includes('wide');
  const isLow = chassisId.includes('low-profile');

  return (
    <svg viewBox="0 0 320 280" className={className} aria-label="BattleBot combat illustration">
      <defs>
        {/* Glow & Spark Filters */}
        <filter id="glow-sparks" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={armorHighlight} />
          <stop offset="100%" stopColor={metalBody} />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={accentColor} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* 1. Ground Drop Shadow */}
      <ellipse cx="160" cy="242" rx={isWide ? '135' : '110'} ry="22" fill="#000000" opacity="0.38" />

      {/* 2. Wheels / Tracks (Left & Right) */}
      {wheelsId.includes('track') ? (
        // Continuous Track Pods
        <>
          <rect x={isWide ? '20' : '45'} y="105" width="45" height="125" rx="20" fill={treadColor} stroke={stroke} strokeWidth="3" />
          <line x1={isWide ? '20' : '45'} y1="130" x2={isWide ? '65' : '90'} y2="130" stroke="#475569" strokeWidth="2.5" />
          <line x1={isWide ? '20' : '45'} y1="165" x2={isWide ? '65' : '90'} y2="165" stroke="#475569" strokeWidth="2.5" />
          <line x1={isWide ? '20' : '45'} y1="200" x2={isWide ? '65' : '90'} y2="200" stroke="#475569" strokeWidth="2.5" />

          <rect x={isWide ? '255' : '230'} y="105" width="45" height="125" rx="20" fill={treadColor} stroke={stroke} strokeWidth="3" />
          <line x1={isWide ? '255' : '230'} y1="130" x2={isWide ? '300' : '275'} y2="130" stroke="#475569" strokeWidth="2.5" />
          <line x1={isWide ? '255' : '230'} y1="165" x2={isWide ? '300' : '275'} y2="165" stroke="#475569" strokeWidth="2.5" />
          <line x1={isWide ? '255' : '230'} y1="200" x2={isWide ? '300' : '275'} y2="200" stroke="#475569" strokeWidth="2.5" />
        </>
      ) : (
        // High-Traction Solid Combat Wheels
        <>
          <rect x={isWide ? '24' : '48'} y="115" width="38" height="110" rx="12" fill={treadColor} stroke={stroke} strokeWidth="3" />
          <line x1={isWide ? '24' : '48'} y1="140" x2={isWide ? '62' : '86'} y2="140" stroke="#475569" strokeWidth="2" />
          <line x1={isWide ? '24' : '48'} y1="170" x2={isWide ? '62' : '86'} y2="170" stroke="#475569" strokeWidth="2" />
          <line x1={isWide ? '24' : '48'} y1="200" x2={isWide ? '62' : '86'} y2="200" stroke="#475569" strokeWidth="2" />
          <circle cx={isWide ? '43' : '67'} cy="170" r="7" fill={accentColor} />

          <rect x={isWide ? '258' : '234'} y="115" width="38" height="110" rx="12" fill={treadColor} stroke={stroke} strokeWidth="3" />
          <line x1={isWide ? '258' : '234'} y1="140" x2={isWide ? '296' : '272'} y2="140" stroke="#475569" strokeWidth="2" />
          <line x1={isWide ? '258' : '234'} y1="170" x2={isWide ? '296' : '272'} y2="170" stroke="#475569" strokeWidth="2" />
          <line x1={isWide ? '258' : '234'} y1="200" x2={isWide ? '296' : '272'} y2="200" stroke="#475569" strokeWidth="2" />
          <circle cx={isWide ? '277' : '253'} cy="170" r="7" fill={accentColor} />
        </>
      )}

      {/* 3. Main Chassis Frame & Armor Shell */}
      {isLow ? (
        // Low-Profile Wedge Body
        <polygon
          points={isWide ? '55,225 75,120 245,120 265,225' : '80,225 100,120 220,120 240,225'}
          fill="url(#bodyGrad)"
          stroke={stroke}
          strokeWidth="3.5"
        />
      ) : (
        // Monocoque / Wide Armor Tub
        <rect
          x={isWide ? '55' : '78'}
          y="108"
          width={isWide ? '210' : '164'}
          height="124"
          rx="14"
          fill="url(#bodyGrad)"
          stroke={stroke}
          strokeWidth="3.5"
        />
      )}

      {/* 4. Team Color Accents & Hazard Stripes */}
      <rect
        x={isWide ? '75' : '98'}
        y="122"
        width={isWide ? '170' : '124'}
        height="12"
        rx="3"
        fill={accentColor}
        stroke={stroke}
        strokeWidth="1.5"
      />
      {/* Carbon Deck Plate Inset */}
      <rect
        x={isWide ? '82' : '102'}
        y="142"
        width={isWide ? '156' : '116'}
        height="76"
        rx="6"
        fill="#0f172a"
        stroke="#475569"
        strokeWidth="1.5"
      />

      {/* Electronics Bay Viewport / Fastener Rivets */}
      <circle cx={isWide ? '95' : '114'} cy="155" r="3" fill="#cbd5e1" stroke={stroke} strokeWidth="1" />
      <circle cx={isWide ? '225' : '206'} cy="155" r="3" fill="#cbd5e1" stroke={stroke} strokeWidth="1" />
      <circle cx={isWide ? '95' : '114'} cy="204" r="3" fill="#cbd5e1" stroke={stroke} strokeWidth="1" />
      <circle cx={isWide ? '225' : '206'} cy="204" r="3" fill="#cbd5e1" stroke={stroke} strokeWidth="1" />

      {/* Front Wedge Ramp or Armored Brow */}
      <polygon
        points="110,232 210,232 195,212 125,212"
        fill="#1e293b"
        stroke={stroke}
        strokeWidth="2"
      />

      {/* 5. Active Weapon Subsystem */}
      {weaponId.includes('horizontal') ? (
        // Horizontal Bar Spinner
        <g>
          {/* Central Bearing Hub */}
          <circle cx="160" cy="180" r="18" fill="#475569" stroke={stroke} strokeWidth="3" />
          {/* Heavy Spinning Steel Bar */}
          <rect x="25" y="172" width="270" height="16" rx="4" fill="#0f172a" stroke={stroke} strokeWidth="3" />
          {/* Hardened AR500 Impact Teeth */}
          <rect x="20" y="166" width="24" height="28" rx="3" fill="#e11d48" stroke={stroke} strokeWidth="2" />
          <rect x="276" y="166" width="24" height="28" rx="3" fill="#e11d48" stroke={stroke} strokeWidth="2" />
          <circle cx="160" cy="180" r="6" fill="#f8fafc" />

          {/* Kinetic Spark Flashes */}
          {showSparks && (
            <g filter="url(#glow-sparks)">
              <polygon points="20,165 6,152 16,178" fill="#fbbf24" />
              <polygon points="300,195 315,182 298,208" fill="#f59e0b" />
              <circle cx="28" cy="162" r="3" fill="#ffffff" />
              <circle cx="292" cy="198" r="3" fill="#ffffff" />
            </g>
          )}
        </g>
      ) : weaponId.includes('flipper') || weaponId.includes('wedge') ? (
        // Pneumatic Flipper Arm / Wedge
        <g>
          <polygon
            points="115,225 205,225 185,110 135,110"
            fill="url(#accentGrad)"
            stroke={stroke}
            strokeWidth="3"
          />
          <line x1="135" y1="110" x2="160" y2="225" stroke="#64748b" strokeWidth="2" />
          <line x1="185" y1="110" x2="160" y2="225" stroke="#64748b" strokeWidth="2" />
          {/* Titanium Tip Lip */}
          <polygon points="128,110 192,110 188,102 132,102" fill="#e2e8f0" stroke={stroke} strokeWidth="1.5" />
        </g>
      ) : (
        // Vertical Drum / Kinetic Flywheel Disc
        <g>
          {/* Center Upright Tower Bulkheads */}
          <rect x="135" y="60" width="10" height="70" rx="2" fill="#475569" stroke={stroke} strokeWidth="2" />
          <rect x="175" y="60" width="10" height="70" rx="2" fill="#475569" stroke={stroke} strokeWidth="2" />

          {/* Vertical Spinning Flywheel Disc */}
          <circle cx="160" cy="78" r="42" fill="#0f172a" stroke={stroke} strokeWidth="3.5" />
          <circle cx="160" cy="78" r="26" fill="#64748b" stroke={stroke} strokeWidth="2" />

          {/* Dual Impact Teeth */}
          <polygon points="160,36 178,24 172,42" fill="#e11d48" stroke={stroke} strokeWidth="2" />
          <polygon points="160,120 142,132 148,114" fill="#e11d48" stroke={stroke} strokeWidth="2" />
          <circle cx="160" cy="78" r="8" fill="#f8fafc" stroke={stroke} strokeWidth="2" />

          {/* Kinetic Spark Shower */}
          {showSparks && (
            <g filter="url(#glow-sparks)">
              <polygon points="175,20 192,8 184,30" fill="#fbbf24" />
              <polygon points="186,34 205,30 195,44" fill="#f59e0b" />
              <circle cx="180" cy="24" r="3.5" fill="#ffffff" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
};

export const CampaignPoster: React.FC<CampaignPosterProps> = ({
  project,
  promptText,
  evaluation,
  selectedTemplate,
  onSelectTemplate,
  stats = {
    weaponEnergyJ: 3200,
    topSpeedMph: 14.5,
    totalWeightLb: 29.4,
    armorRating: 88,
  },
}) => {
  const teamName = project.teamName || 'TITAN ROBOTICS';
  const mech = project.mechanical;
  const lead = project.projectLead;
  const accentColor = mech.accentColor || '#06b6d4';

  // Automatically detect template from prompt text keywords if not explicitly overridden
  const detectedTemplate = React.useMemo<PosterTemplate>(() => {
    if (selectedTemplate) return selectedTemplate;
    const t = promptText.toLowerCase();
    if (
      t.includes('blueprint') ||
      t.includes('tech') ||
      t.includes('precision') ||
      t.includes('engineering') ||
      t.includes('spec') ||
      t.includes('cad')
    ) {
      return 'tech-blueprint';
    }
    if (
      t.includes('arena') ||
      t.includes('showdown') ||
      t.includes('cage') ||
      t.includes('bull') ||
      t.includes('vs') ||
      t.includes('sparks')
    ) {
      return 'arena-showdown';
    }
    if (
      t.includes('speed') ||
      t.includes('fast') ||
      t.includes('strike') ||
      t.includes('destroy') ||
      t.includes('power') ||
      t.includes('aggressive') ||
      t.includes('kinetic')
    ) {
      return 'diagonal-action';
    }
    if (
      t.includes('sponsor') ||
      t.includes('corporate') ||
      t.includes('partner') ||
      t.includes('invest') ||
      t.includes('commercial') ||
      t.includes('clean')
    ) {
      return 'clean-sponsor';
    }
    return 'hero-poster';
  }, [promptText, selectedTemplate]);

  const activeTemplate = selectedTemplate || detectedTemplate;

  // Headline derivation
  const headline =
    evaluation?.headline ||
    (promptText.trim().length > 10
      ? promptText.slice(0, 48).toUpperCase()
      : 'ENGINEERED FOR SUPREMACY');

  const sponsorTier = evaluation?.tier || lead.sponsorTier || 'Bronze';
  const fundingAmount = evaluation?.fundingUsd || lead.sponsorshipUsd || 400;

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Template Selector Pills Bar */}
      <div className="flex flex-wrap items-center justify-between w-full max-w-2xl px-1 text-xs gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
          Visual Style Template:
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'hero-poster', label: 'Hero Poster', icon: Award },
              { id: 'diagonal-action', label: 'Diagonal Action', icon: Zap },
              { id: 'tech-blueprint', label: 'Tech Blueprint', icon: Crosshair },
              { id: 'arena-showdown', label: 'Arena Showdown', icon: Flame },
              { id: 'clean-sponsor', label: 'Clean Sponsor', icon: Building2 },
            ] as const
          ).map((tmpl) => {
            const isSelected = activeTemplate === tmpl.id;
            const Icon = tmpl.icon;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => onSelectTemplate?.(tmpl.id)}
                className={`cursor-pointer px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{tmpl.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================
          PROCEDURAL POSTER CANVAS (High-Impact Poster Collateral)
         ======================================================== */}
      <div className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-700 select-none aspect-[16/11] min-h-[460px] flex flex-col justify-between p-6">
        {/* --------------------------------------------------------
            TEMPLATE 1: HERO POSTER (Monumental Centered Composition)
           -------------------------------------------------------- */}
        {activeTemplate === 'hero-poster' && (
          <>
            {/* Deep Charcoal Metallic Background with Spot Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-[#0b101b] to-black" />
            <div
              className="absolute inset-0 opacity-25 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle at 50% 45%, ${accentColor} 0%, transparent 65%)`,
              }}
            />

            {/* Poster Header */}
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-black block">
                  BESA SANCTIONED COMBAT ROBOTICS
                </span>
                <h1 className="font-display font-black text-3xl md:text-4xl text-white tracking-tight uppercase drop-shadow-md">
                  {teamName}
                </h1>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 border border-amber-400 text-amber-300">
                ★ {sponsorTier.toUpperCase()} PARTNER
              </span>
            </div>

            {/* Center Robot Hero Visual */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-1">
              <RobotIllustration2D
                chassisId={mech.chassisId}
                weaponId={mech.weaponId}
                wheelsId={mech.wheelsId}
                armorId={mech.armorId}
                accentColor={accentColor}
                className="w-80 h-64 drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]"
              />
              <div className="mt-1 font-display font-extrabold text-lg md:text-xl text-center text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-white to-slate-300 tracking-wide uppercase px-4 max-w-xl">
                "{headline}"
              </div>
            </div>

            {/* Footer Metrics & Corporate Sponsors */}
            <div className="relative z-10 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-4 text-slate-300">
                <span>
                  MASS: <strong className="text-white">{stats.totalWeightLb} LB</strong>
                </span>
                <span>
                  SPEED: <strong className="text-cyan-400">{stats.topSpeedMph.toFixed(1)} MPH</strong>
                </span>
                <span>
                  IMPACT: <strong className="text-amber-400">{stats.weaponEnergyJ} J</strong>
                </span>
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-sans">
                FUNDING COMMITTED: <strong className="text-emerald-400">+${fundingAmount}</strong>
              </div>
            </div>
          </>
        )}

        {/* --------------------------------------------------------
            TEMPLATE 2: DIAGONAL ACTION (High-Speed Combat Slash)
           -------------------------------------------------------- */}
        {activeTemplate === 'diagonal-action' && (
          <>
            {/* Split Angled Background */}
            <div className="absolute inset-0 bg-[#090d16]" />
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background: `linear-gradient(135deg, ${accentColor} 0%, transparent 55%)`,
              }}
            />
            {/* Speed Slash Lines */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, #ffffff 0, #ffffff 1px, transparent 0, transparent 24px)',
              }}
            />

            {/* Action Header */}
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <span className="text-[11px] font-mono tracking-widest text-amber-400 uppercase font-black">
                  HIGH VELOCITY IMPACT DIVISION
                </span>
                <h1 className="font-display font-black text-3xl md:text-4xl text-white italic tracking-tight uppercase">
                  {teamName} // COMBAT
                </h1>
              </div>
              <div className="text-right font-mono">
                <span className="text-[10px] text-slate-400 block uppercase">IMPACT ENERGY</span>
                <span className="text-xl font-black text-amber-400">{stats.weaponEnergyJ} J</span>
              </div>
            </div>

            {/* Dynamic Angled Robot */}
            <div className="relative z-10 flex-1 flex items-center justify-center -rotate-2 scale-105">
              <RobotIllustration2D
                chassisId={mech.chassisId}
                weaponId={mech.weaponId}
                wheelsId={mech.wheelsId}
                armorId={mech.armorId}
                accentColor={accentColor}
                className="w-84 h-68 drop-shadow-[0_20px_40px_rgba(0,0,0,0.9)]"
              />
            </div>

            {/* Punchy Banner Strip */}
            <div className="relative z-10 bg-gradient-to-r from-amber-500 to-rose-600 text-slate-950 font-black font-display px-4 py-2 rounded-xl text-center uppercase tracking-wider text-sm shadow-lg">
              "{headline}"
            </div>
          </>
        )}

        {/* --------------------------------------------------------
            TEMPLATE 3: TECH BLUEPRINT (Precision Engineering CAD)
           -------------------------------------------------------- */}
        {activeTemplate === 'tech-blueprint' && (
          <>
            {/* Blueprint Grid Background */}
            <div className="absolute inset-0 bg-[#041a2e]" />
            <div
              className="absolute inset-0 opacity-25 pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(to right, #0284c7 1px, transparent 1px), linear-gradient(to bottom, #0284c7 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Blueprint CAD Header */}
            <div className="relative z-10 flex justify-between items-start pb-2 border-b border-cyan-500/30">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400 uppercase font-bold">
                  <span>SPECIFICATION SHEET // DWG NO. 2026-BESA</span>
                  <span>•</span>
                  <span>REV C</span>
                </div>
                <h1 className="font-display font-black text-2xl md:text-3xl text-white tracking-wide uppercase">
                  {teamName}
                </h1>
              </div>
              <div className="text-right text-[10px] font-mono text-cyan-300">
                <span>CLASS: 30.0 LB COMBAT</span>
                <br />
                <span>CHASSIS: {mech.chassisId.toUpperCase()}</span>
              </div>
            </div>

            {/* Blueprint Robot with Target Callouts */}
            <div className="relative z-10 flex-1 flex items-center justify-center my-2">
              <RobotIllustration2D
                chassisId={mech.chassisId}
                weaponId={mech.weaponId}
                wheelsId={mech.wheelsId}
                armorId={mech.armorId}
                accentColor="#38bdf8"
                className="w-80 h-64 filter contrast-125"
                showSparks={false}
              />
            </div>

            {/* Engineering Callout Matrix */}
            <div className="relative z-10 grid grid-cols-4 gap-2 pt-2 border-t border-cyan-500/30 text-center font-mono text-xs">
              <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30">
                <span className="text-[9px] text-cyan-400 block">WEAPON</span>
                <strong className="text-white text-xs">{mech.weaponId.toUpperCase()}</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30">
                <span className="text-[9px] text-cyan-400 block">TOP SPEED</span>
                <strong className="text-cyan-300 text-xs">{stats.topSpeedMph.toFixed(1)} MPH</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30">
                <span className="text-[9px] text-cyan-400 block">ARMOR MAT</span>
                <strong className="text-white text-xs">{mech.armorId.toUpperCase()}</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30">
                <span className="text-[9px] text-cyan-400 block">TOTAL MASS</span>
                <strong className="text-cyan-300 text-xs">{stats.totalWeightLb} LB</strong>
              </div>
            </div>
          </>
        )}

        {/* --------------------------------------------------------
            TEMPLATE 4: ARENA SHOWDOWN (Cinematic Stadium Cage Match)
           -------------------------------------------------------- */}
        {activeTemplate === 'arena-showdown' && (
          <>
            {/* Dark Arena Lighting */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#120707] via-[#1a0a0a] to-[#0a0000]" />
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 50% 20%, #ef4444 0%, transparent 60%)',
              }}
            />

            {/* Stadium Event Header */}
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-rose-400 uppercase font-bold flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                  ARENA MAIN EVENT • CONTENDER
                </span>
                <h1 className="font-display font-black text-3xl md:text-4xl text-white tracking-tight uppercase">
                  {teamName}
                </h1>
              </div>
              <span className="px-3 py-1 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 font-mono text-xs font-bold">
                VS THE BULL
              </span>
            </div>

            {/* Center Robot with Arena Sparks */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
              <RobotIllustration2D
                chassisId={mech.chassisId}
                weaponId={mech.weaponId}
                wheelsId={mech.wheelsId}
                armorId={mech.armorId}
                accentColor={accentColor}
                className="w-80 h-64 drop-shadow-[0_20px_35px_rgba(239,68,68,0.3)]"
                showSparks={true}
              />
              <div className="text-amber-300 font-display font-black text-lg uppercase tracking-wider text-center drop-shadow">
                "{headline}"
              </div>
            </div>

            {/* Bottom Matchup Strip */}
            <div className="relative z-10 pt-2 border-t border-rose-900/60 flex items-center justify-between text-xs font-mono text-slate-300">
              <span>WEIGHT: 30.0 LB COMBAT CLASS</span>
              <span className="text-rose-400 font-bold uppercase">
                SPONSOR FUNDED: +${fundingAmount}
              </span>
            </div>
          </>
        )}

        {/* --------------------------------------------------------
            TEMPLATE 5: CLEAN SPONSOR (Corporate Livery & Partners)
           -------------------------------------------------------- */}
        {activeTemplate === 'clean-sponsor' && (
          <>
            {/* Crisp Silicon Valley Executive Livery */}
            <div className="absolute inset-0 bg-slate-900" />
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500" />

            {/* Corporate Header */}
            <div className="relative z-10 flex justify-between items-start mt-1">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-bold block">
                  CORPORATE PARTNERSHIP CAMPAIGN
                </span>
                <h1 className="font-display font-black text-2xl md:text-3xl text-white tracking-tight uppercase">
                  {teamName}
                </h1>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 font-mono text-xs font-bold">
                {sponsorTier.toUpperCase()} SPONSOR (+${fundingAmount})
              </div>
            </div>

            {/* Clean Centered Robot */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
              <RobotIllustration2D
                chassisId={mech.chassisId}
                weaponId={mech.weaponId}
                wheelsId={mech.wheelsId}
                armorId={mech.armorId}
                accentColor={accentColor}
                className="w-72 h-56"
                showSparks={false}
              />
              <p className="text-slate-200 font-sans font-semibold text-sm text-center max-w-lg mt-1 italic">
                "{headline}"
              </p>
            </div>

            {/* Official Sponsor Logos Bar */}
            <div className="relative z-10 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold tracking-wider">TITAN DYNAMICS</span>
                <span>•</span>
                <span className="text-white font-bold tracking-wider">APEX POWER</span>
                <span>•</span>
                <span className="text-white font-bold tracking-wider">VORTEX LABS</span>
              </div>
              <span className="text-emerald-400 font-bold">SANCTIONED ENTRY</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
