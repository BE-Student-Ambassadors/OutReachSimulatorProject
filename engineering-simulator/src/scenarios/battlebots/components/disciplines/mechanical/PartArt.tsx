import React from 'react';
import { type ComponentCategory } from '../../../types/robot';

interface PartArtProps {
  category: ComponentCategory;
  partId?: string;
  className?: string;
}

/**
 * Visual technical silhouette & schematic art for BattleBot components,
 * rendered at high fidelity on neutral/blueprint backgrounds.
 * Each of the 19 streamlined catalog items has an unmistakable physical silhouette.
 */
export const PartArt: React.FC<PartArtProps> = ({
  category,
  partId = '',
  className = 'w-24 h-24',
}) => {
  const stroke = '#334155'; // slate-700
  const metalFill = '#cbd5e1'; // slate-300
  const darkPlate = '#1e293b'; // slate-800
  const cyanAccent = '#0284c7'; // sky-600

  switch (category) {
    // ==========================================
    // 1. CHASSIS SILHOUETTES
    // ==========================================
    case 'chassis': {
      if (partId.includes('wide')) {
        return (
          <svg viewBox="0 0 96 64" className={className} aria-label="Wide stance chassis">
            {/* Outrigger wide frame */}
            <rect x="6" y="16" width="84" height="32" rx="6" fill={metalFill} stroke={stroke} strokeWidth="2" />
            {/* Side sponsons */}
            <rect x="8" y="12" width="16" height="40" rx="3" fill="#94a3b8" stroke={stroke} strokeWidth="1.5" />
            <rect x="72" y="12" width="16" height="40" rx="3" fill="#94a3b8" stroke={stroke} strokeWidth="1.5" />
            {/* Center equipment bay */}
            <rect x="28" y="20" width="40" height="24" rx="3" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
            {/* Cross reinforcement beams */}
            <line x1="28" y1="20" x2="68" y2="44" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />
            <line x1="28" y1="44" x2="68" y2="20" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />
            {/* Axle bosses */}
            <circle cx="16" cy="18" r="3" fill={darkPlate} />
            <circle cx="16" cy="46" r="3" fill={darkPlate} />
            <circle cx="80" cy="18" r="3" fill={darkPlate} />
            <circle cx="80" cy="46" r="3" fill={darkPlate} />
          </svg>
        );
      }
      if (partId.includes('low-profile')) {
        return (
          <svg viewBox="0 0 96 64" className={className} aria-label="Low-profile sloped chassis">
            {/* Raked aerodynamic low-slung chassis */}
            <path d="M 6 42 L 28 18 L 86 18 L 92 42 L 84 48 L 12 48 Z" fill={metalFill} stroke={stroke} strokeWidth="2" />
            <polygon points="32,22 82,22 86,38 28,38" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
            {/* Forward titanium scraping lip */}
            <polygon points="6,42 16,42 14,48 6,48" fill="#0284c7" stroke={stroke} strokeWidth="1.5" />
            {/* Low-CG ballast bays */}
            <rect x="36" y="26" width="18" height="8" rx="2" fill="#94a3b8" />
            <rect x="58" y="26" width="18" height="8" rx="2" fill="#94a3b8" />
            <circle cx="22" cy="42" r="3" fill={darkPlate} />
            <circle cx="78" cy="42" r="3" fill={darkPlate} />
          </svg>
        );
      }
      // Compact monocoque
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Compact monocoque chassis">
          <rect x="10" y="10" width="44" height="44" rx="6" fill={metalFill} stroke={stroke} strokeWidth="2" />
          <rect x="18" y="18" width="28" height="28" rx="4" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
          {/* Internal diagonal stiffening ribs */}
          <line x1="18" y1="18" x2="46" y2="46" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="18" y1="46" x2="46" y2="18" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2" />
          {/* Corner mounting standoffs */}
          <circle cx="15" cy="15" r="3" fill={darkPlate} />
          <circle cx="49" cy="15" r="3" fill={darkPlate} />
          <circle cx="15" cy="49" r="3" fill={darkPlate} />
          <circle cx="49" cy="49" r="3" fill={darkPlate} />
        </svg>
      );
    }

    // ==========================================
    // 2. DRIVE SYSTEM SILHOUETTES
    // ==========================================
    case 'drive': {
      if (partId.includes('speed')) {
        return (
          <svg viewBox="0 0 72 64" className={className} aria-label="High-speed brushless drive">
            {/* Top high-RPM motor */}
            <rect x="6" y="10" width="30" height="18" rx="4" fill="#0284c7" stroke={stroke} strokeWidth="1.5" />
            {/* Visible copper stator windings */}
            <rect x="12" y="14" width="18" height="10" rx="1" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
            <line x1="36" y1="19" x2="52" y2="19" stroke={stroke} strokeWidth="3" />
            {/* Slim high-speed pinion */}
            <circle cx="56" cy="19" r="4.5" fill="#f1f5f9" stroke={stroke} strokeWidth="1.5" />
            {/* Bottom high-RPM motor */}
            <rect x="6" y="36" width="30" height="18" rx="4" fill="#0284c7" stroke={stroke} strokeWidth="1.5" />
            <rect x="12" y="40" width="18" height="10" rx="1" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
            <line x1="36" y1="45" x2="52" y2="45" stroke={stroke} strokeWidth="3" />
            <circle cx="56" cy="45" r="4.5" fill="#f1f5f9" stroke={stroke} strokeWidth="1.5" />
            {/* Speed lines */}
            <path d="M 64 15 L 68 19 L 64 23" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
            <path d="M 64 41 L 68 45 L 64 49" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      }
      if (partId.includes('torque')) {
        return (
          <svg viewBox="0 0 72 64" className={className} aria-label="High-torque planetary drive">
            {/* Top planetary gearbox with heavy ribbed casing */}
            <rect x="6" y="10" width="22" height="20" rx="3" fill={darkPlate} stroke={stroke} strokeWidth="1.5" />
            <rect x="28" y="8" width="20" height="24" rx="4" fill="#64748b" stroke={stroke} strokeWidth="2" />
            {/* Planetary gear ring rivets */}
            <circle cx="38" cy="12" r="1.5" fill="#f8fafc" />
            <circle cx="38" cy="28" r="1.5" fill="#f8fafc" />
            <line x1="48" y1="20" x2="62" y2="20" stroke={stroke} strokeWidth="4.5" />
            {/* Heavy-duty steel output hub */}
            <circle cx="64" cy="20" r="5" fill="#0f172a" stroke={stroke} strokeWidth="1.5" />

            {/* Bottom planetary gearbox */}
            <rect x="6" y="36" width="22" height="20" rx="3" fill={darkPlate} stroke={stroke} strokeWidth="1.5" />
            <rect x="28" y="34" width="20" height="24" rx="4" fill="#64748b" stroke={stroke} strokeWidth="2" />
            <circle cx="38" cy="38" r="1.5" fill="#f8fafc" />
            <circle cx="38" cy="54" r="1.5" fill="#f8fafc" />
            <line x1="48" y1="46" x2="62" y2="46" stroke={stroke} strokeWidth="4.5" />
            <circle cx="64" cy="46" r="5" fill="#0f172a" stroke={stroke} strokeWidth="1.5" />
          </svg>
        );
      }
      // Balanced Drive
      return (
        <svg viewBox="0 0 72 64" className={className} aria-label="Balanced spur drive">
          <rect x="8" y="12" width="28" height="18" rx="3" fill={darkPlate} stroke={stroke} strokeWidth="1.5" />
          <rect x="36" y="15" width="12" height="12" rx="2" fill="#f59e0b" stroke={stroke} strokeWidth="1" />
          <line x1="48" y1="21" x2="60" y2="21" stroke={stroke} strokeWidth="3" />
          <circle cx="62" cy="21" r="4" fill="#94a3b8" />

          <rect x="8" y="34" width="28" height="18" rx="3" fill={darkPlate} stroke={stroke} strokeWidth="1.5" />
          <rect x="36" y="37" width="12" height="12" rx="2" fill="#f59e0b" stroke={stroke} strokeWidth="1" />
          <line x1="48" y1="43" x2="60" y2="43" stroke={stroke} strokeWidth="3" />
          <circle cx="62" cy="43" r="4" fill="#94a3b8" />

          <path d="M 8 18 Q 2 28 2 32 Q 2 36 8 46" fill="none" stroke="#ef4444" strokeWidth="2" />
        </svg>
      );
    }

    // ==========================================
    // 3. WHEELS & TRACTION SILHOUETTES
    // ==========================================
    case 'wheels': {
      if (partId.includes('small')) {
        return (
          <svg viewBox="0 0 64 64" className={className} aria-label="Small lightweight wheels">
            {/* Low-profile mini wheel pair */}
            <circle cx="20" cy="32" r="16" fill="#0f172a" stroke={stroke} strokeWidth="2" />
            <circle cx="20" cy="32" r="11" fill={metalFill} stroke={stroke} strokeWidth="1.5" />
            <circle cx="20" cy="32" r="4" fill="#f8fafc" stroke={stroke} strokeWidth="1" />
            {/* Lightening holes */}
            <circle cx="20" cy="25" r="2" fill="#64748b" />
            <circle cx="20" cy="39" r="2" fill="#64748b" />

            <circle cx="44" cy="32" r="16" fill="#0f172a" stroke={stroke} strokeWidth="2" />
            <circle cx="44" cy="32" r="11" fill={metalFill} stroke={stroke} strokeWidth="1.5" />
            <circle cx="44" cy="32" r="4" fill="#f8fafc" stroke={stroke} strokeWidth="1" />
            <circle cx="44" cy="25" r="2" fill="#64748b" />
            <circle cx="44" cy="39" r="2" fill="#64748b" />
          </svg>
        );
      }
      if (partId.includes('large')) {
        return (
          <svg viewBox="0 0 64 64" className={className} aria-label="Large tall spoked wheel">
            {/* Oversized large wheel with spokes */}
            <circle cx="32" cy="32" r="26" fill="#0f172a" stroke={stroke} strokeWidth="2.5" />
            <circle cx="32" cy="32" r="20" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
            {/* Aluminum spokes */}
            <line x1="32" y1="12" x2="32" y2="52" stroke={stroke} strokeWidth="2" />
            <line x1="12" y1="32" x2="52" y2="32" stroke={stroke} strokeWidth="2" />
            <line x1="18" y1="18" x2="46" y2="46" stroke={stroke} strokeWidth="2" />
            <line x1="18" y1="46" x2="46" y2="18" stroke={stroke} strokeWidth="2" />
            {/* Center billet hub */}
            <circle cx="32" cy="32" r="8" fill={metalFill} stroke={stroke} strokeWidth="2" />
            <circle cx="32" cy="32" r="3.5" fill={darkPlate} />
          </svg>
        );
      }
      // High-Traction Wheels (aggressive rubber chevron tread)
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="High-traction rubber wheels">
          <rect x="8" y="10" width="18" height="44" rx="4" fill="#0f172a" stroke={stroke} strokeWidth="2" />
          {/* Deep chevron siping */}
          <path d="M 8 18 L 17 22 L 8 26" fill="none" stroke="#64748b" strokeWidth="2" />
          <path d="M 8 28 L 17 32 L 8 36" fill="none" stroke="#64748b" strokeWidth="2" />
          <path d="M 8 38 L 17 42 L 8 46" fill="none" stroke="#64748b" strokeWidth="2" />

          {/* Center axle connector */}
          <rect x="26" y="27" width="12" height="10" fill="#94a3b8" stroke={stroke} strokeWidth="1.5" />
          <circle cx="32" cy="32" r="3" fill="#f8fafc" />

          {/* Right tire */}
          <rect x="38" y="10" width="18" height="44" rx="4" fill="#0f172a" stroke={stroke} strokeWidth="2" />
          <path d="M 56 18 L 47 22 L 56 26" fill="none" stroke="#64748b" strokeWidth="2" />
          <path d="M 56 28 L 47 32 L 56 36" fill="none" stroke="#64748b" strokeWidth="2" />
          <path d="M 56 38 L 47 42 L 56 46" fill="none" stroke="#64748b" strokeWidth="2" />
        </svg>
      );
    }

    // ==========================================
    // 4. ARMOR PLATING SILHOUETTES
    // ==========================================
    case 'armor': {
      if (partId.includes('polycarbonate')) {
        return (
          <svg viewBox="0 0 64 64" className={className} aria-label="Translucent polycarbonate armor">
            {/* Translucent cyan tinted polymer plate */}
            <polygon points="12,14 52,14 46,50 18,50" fill="#bae6fd" stroke="#0284c7" strokeWidth="2" />
            <polygon points="16,18 48,18 43,46 21,46" fill="#e0f2fe" opacity="0.8" />
            {/* Hex mounting bolts */}
            <circle cx="18" cy="20" r="2.5" fill="#0284c7" />
            <circle cx="46" cy="20" r="2.5" fill="#0284c7" />
            <circle cx="22" cy="44" r="2.5" fill="#0284c7" />
            <circle cx="42" cy="44" r="2.5" fill="#0284c7" />
            {/* Impact flex reflection highlight */}
            <line x1="24" y1="22" x2="38" y2="42" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      }
      if (partId.includes('steel')) {
        return (
          <svg viewBox="0 0 64 64" className={className} aria-label="Hardened Hardox steel armor">
            {/* Heavy dark charcoal AR400 plate */}
            <polygon points="10,12 54,12 48,52 16,52" fill={darkPlate} stroke={stroke} strokeWidth="2.5" />
            {/* Welded reinforcement ribs */}
            <polygon points="18,18 46,18 42,46 22,46" fill="#334155" stroke="#475569" strokeWidth="1.5" />
            <line x1="32" y1="12" x2="32" y2="52" stroke="#64748b" strokeWidth="2.5" />
            {/* Industrial mounting studs */}
            <circle cx="16" cy="18" r="3" fill="#94a3b8" stroke={stroke} strokeWidth="1" />
            <circle cx="48" cy="18" r="3" fill="#94a3b8" stroke={stroke} strokeWidth="1" />
            <circle cx="20" cy="46" r="3" fill="#94a3b8" stroke={stroke} strokeWidth="1" />
            <circle cx="44" cy="46" r="3" fill="#94a3b8" stroke={stroke} strokeWidth="1" />
          </svg>
        );
      }
      // Aluminum Armor (balanced aerospace plate)
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="6061-T6 aluminum armor plate">
          <polygon points="12,14 52,14 46,50 18,50" fill={metalFill} stroke={stroke} strokeWidth="2" />
          <polygon points="16,18 48,18 43,46 21,46" fill="#f1f5f9" opacity="0.6" stroke="#94a3b8" strokeWidth="1" />
          {/* Beveled edge and flush counterbore rivets */}
          <circle cx="18" cy="20" r="2.5" fill={stroke} />
          <circle cx="46" cy="20" r="2.5" fill={stroke} />
          <circle cx="22" cy="44" r="2.5" fill={stroke} />
          <circle cx="42" cy="44" r="2.5" fill={stroke} />
          <line x1="32" y1="18" x2="32" y2="46" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
      );
    }

    // ==========================================
    // 5. WEAPON SILHOUETTES
    // ==========================================
    case 'weapon': {
      if (partId.includes('horizontal')) {
        return (
          <svg viewBox="0 0 72 64" className={className} aria-label="Horizontal bar spinner">
            {/* Rotating center hub */}
            <circle cx="36" cy="32" r="10" fill={metalFill} stroke={stroke} strokeWidth="2" />
            {/* Heavy kinetic strike bar */}
            <rect x="4" y="27" width="64" height="10" rx="3" fill={darkPlate} stroke={stroke} strokeWidth="2" />
            {/* Asymmetric Hardox strike teeth */}
            <polygon points="4,24 14,27 14,37 4,37" fill="#e11d48" stroke={stroke} strokeWidth="1.5" />
            <polygon points="68,40 58,37 58,27 68,27" fill="#e11d48" stroke={stroke} strokeWidth="1.5" />
            {/* Center spindle lock */}
            <circle cx="36" cy="32" r="4" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
          </svg>
        );
      }
      if (partId.includes('lifter')) {
        return (
          <svg viewBox="0 0 64 64" className={className} aria-label="4-bar articulated lifter fork">
            {/* Base mounting clevis */}
            <rect x="18" y="44" width="28" height="10" rx="2" fill={darkPlate} stroke={stroke} strokeWidth="1.5" />
            {/* Twin titanium lifting arms */}
            <line x1="22" y1="44" x2="16" y2="18" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
            <line x1="42" y1="44" x2="48" y2="18" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
            {/* Articulated lifting fork plate */}
            <polygon points="12,18 52,18 46,12 18,12" fill={cyanAccent} stroke={stroke} strokeWidth="1.5" />
            {/* Linear actuator cylinder in center */}
            <rect x="28" y="28" width="8" height="18" rx="2" fill="#f59e0b" stroke={stroke} strokeWidth="1.5" />
            <line x1="32" y1="20" x2="32" y2="28" stroke="#cbd5e1" strokeWidth="3" />
            {/* Pivot pins */}
            <circle cx="22" cy="44" r="2.5" fill="#f8fafc" />
            <circle cx="42" cy="44" r="2.5" fill="#f8fafc" />
            <circle cx="16" cy="18" r="2.5" fill="#f8fafc" />
            <circle cx="48" cy="18" r="2.5" fill="#f8fafc" />
          </svg>
        );
      }
      if (partId.includes('wedge')) {
        return (
          <svg viewBox="0 0 64 64" className={className} aria-label="Hardox deflection wedge">
            {/* Sloped deflection plow */}
            <polygon points="6,48 58,48 48,16 16,16" fill={metalFill} stroke={stroke} strokeWidth="2" />
            {/* Ground scraping piano-hinge lip */}
            <polygon points="6,48 58,48 56,52 8,52" fill="#0f172a" stroke={stroke} strokeWidth="1.5" />
            {/* Deflection ridge reinforcement */}
            <line x1="32" y1="16" x2="32" y2="48" stroke="#0284c7" strokeWidth="2.5" />
            <line x1="16" y1="16" x2="6" y2="48" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="48" y1="16" x2="58" y2="48" stroke="#94a3b8" strokeWidth="1.5" />
          </svg>
        );
      }
      // Vertical Spinner (flywheel / disc)
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Vertical kinetic disc spinner">
          <circle cx="32" cy="32" r="24" fill={darkPlate} stroke={stroke} strokeWidth="2" />
          <circle cx="32" cy="32" r="14" fill={metalFill} stroke={stroke} strokeWidth="1.5" />
          {/* Dual carbide strike teeth */}
          <polygon points="32,8 44,2 39,12" fill="#e11d48" stroke={stroke} strokeWidth="1" />
          <polygon points="32,56 20,62 25,52" fill="#e11d48" stroke={stroke} strokeWidth="1" />
          {/* Spindle bearing and pulley */}
          <circle cx="32" cy="32" r="5" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
          <circle cx="32" cy="32" r="2" fill={darkPlate} />
        </svg>
      );
    }

    // ==========================================
    // 6. UTILITY SILHOUETTES
    // ==========================================
    case 'utility': {
      if (partId.includes('wheel-guard')) {
        return (
          <svg viewBox="0 0 64 64" className={className} aria-label="Wheel guard shrouds">
            {/* Left wheel guard shroud */}
            <path d="M 8 20 C 8 12, 24 12, 24 20 L 24 44 C 24 52, 8 52, 8 44 Z" fill={metalFill} stroke={stroke} strokeWidth="2" />
            <line x1="16" y1="16" x2="16" y2="48" stroke="#0284c7" strokeWidth="2" />
            {/* Right wheel guard shroud */}
            <path d="M 40 20 C 40 12, 56 12, 56 20 L 56 44 C 56 52, 40 52, 40 44 Z" fill={metalFill} stroke={stroke} strokeWidth="2" />
            <line x1="48" y1="16" x2="48" y2="48" stroke="#0284c7" strokeWidth="2" />
            {/* Cross chassis tie rod */}
            <rect x="24" y="30" width="16" height="4" fill={darkPlate} />
          </svg>
        );
      }
      if (partId.includes('traction-module')) {
        return (
          <svg viewBox="0 0 64 64" className={className} aria-label="Neodymium magnetic traction module">
            {/* Magnetic bracket housing */}
            <rect x="10" y="24" width="44" height="16" rx="3" fill={darkPlate} stroke={stroke} strokeWidth="2" />
            {/* Dual N52 magnet bars */}
            <rect x="14" y="28" width="16" height="8" rx="1.5" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
            <rect x="34" y="28" width="16" height="8" rx="1.5" fill="#0284c7" stroke="#075985" strokeWidth="1" />
            <text x="22" y="35" fontSize="6" fontWeight="bold" fill="#ffffff" textAnchor="middle">N</text>
            <text x="42" y="35" fontSize="6" fontWeight="bold" fill="#ffffff" textAnchor="middle">S</text>
            {/* Downforce magnetic flux lines */}
            <path d="M 22 43 Q 32 49 42 43" fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="2 2" />
            <path d="M 18 43 Q 32 55 46 43" fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="2 2" />
          </svg>
        );
      }
      // Self-Righting Bar (srimech roll hoop)
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Self-righting roll hoop">
          {/* Base mounting clevis */}
          <rect x="22" y="44" width="20" height="12" rx="3" fill={darkPlate} stroke={stroke} strokeWidth="2" />
          {/* High roll arch */}
          <path d="M 26 44 C 26 14, 38 14, 38 44" fill="none" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 26 44 C 26 16, 38 16, 38 44" fill="none" stroke={cyanAccent} strokeWidth="2.5" strokeLinecap="round" />
          {/* Pivot bushing */}
          <circle cx="32" cy="50" r="3" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    }

    default:
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Standard component">
          <circle cx="32" cy="32" r="22" fill={metalFill} stroke={stroke} strokeWidth="2" />
          <circle cx="32" cy="32" r="8" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
  }
};
