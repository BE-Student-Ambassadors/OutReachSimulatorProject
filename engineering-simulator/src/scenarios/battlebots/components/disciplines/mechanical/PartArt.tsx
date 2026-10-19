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
    case 'chassis': {
      if (partId.includes('wide')) {
        return (
          <svg viewBox="0 0 96 64" className={className} aria-label="Wide chassis frame">
            <rect x="8" y="14" width="80" height="36" rx="6" fill={metalFill} stroke={stroke} strokeWidth="2" />
            <rect x="24" y="20" width="48" height="24" rx="4" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
            <circle cx="14" cy="20" r="3" fill={stroke} />
            <circle cx="82" cy="20" r="3" fill={stroke} />
            <circle cx="14" cy="44" r="3" fill={stroke} />
            <circle cx="82" cy="44" r="3" fill={stroke} />
            <line x1="32" y1="20" x2="32" y2="44" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2" />
            <line x1="64" y1="20" x2="64" y2="44" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
        );
      }
      if (partId.includes('low-profile')) {
        return (
          <svg viewBox="0 0 96 64" className={className} aria-label="Low-profile chassis">
            <path d="M 8 38 L 24 18 L 84 18 L 90 38 L 82 46 L 14 46 Z" fill={metalFill} stroke={stroke} strokeWidth="2" />
            <polygon points="28,24 80,24 84,36 24,36" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
            <circle cx="20" cy="40" r="2.5" fill={stroke} />
            <circle cx="78" cy="40" r="2.5" fill={stroke} />
          </svg>
        );
      }
      // Compact monocoque
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Compact monocoque chassis">
          <rect x="10" y="12" width="44" height="40" rx="6" fill={metalFill} stroke={stroke} strokeWidth="2" />
          <rect x="18" y="20" width="28" height="24" rx="4" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
          <circle cx="15" cy="18" r="2.5" fill={stroke} />
          <circle cx="49" cy="18" r="2.5" fill={stroke} />
          <circle cx="15" cy="46" r="2.5" fill={stroke} />
          <circle cx="49" cy="46" r="2.5" fill={stroke} />
          <line x1="25" y1="20" x2="25" y2="44" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 2" />
          <line x1="39" y1="20" x2="39" y2="44" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
      );
    }

    case 'drive': {
      return (
        <svg viewBox="0 0 72 64" className={className} aria-label="Drive motor package">
          {/* Top motor unit */}
          <rect x="8" y="12" width="28" height="18" rx="3" fill={darkPlate} stroke={stroke} strokeWidth="1.5" />
          <rect x="36" y="16" width="10" height="10" rx="1.5" fill="#f59e0b" stroke={stroke} strokeWidth="1" />
          <line x1="46" y1="21" x2="58" y2="21" stroke={stroke} strokeWidth="3" />
          {/* Bottom motor unit */}
          <rect x="8" y="34" width="28" height="18" rx="3" fill={darkPlate} stroke={stroke} strokeWidth="1.5" />
          <rect x="36" y="38" width="10" height="10" rx="1.5" fill="#f59e0b" stroke={stroke} strokeWidth="1" />
          <line x1="46" y1="43" x2="58" y2="43" stroke={stroke} strokeWidth="3" />
          {/* Heavy wiring harness */}
          <path d="M 8 18 Q 2 27 2 32 Q 2 37 8 46" fill="none" stroke="#ef4444" strokeWidth="2" />
          <circle cx="62" cy="21" r="3.5" fill="#64748b" />
          <circle cx="62" cy="43" r="3.5" fill="#64748b" />
        </svg>
      );
    }

    case 'wheels': {
      if (partId.includes('track')) {
        return (
          <svg viewBox="0 0 72 64" className={className} aria-label="Continuous tracks">
            <rect x="6" y="16" width="60" height="32" rx="14" fill="#0f172a" stroke={stroke} strokeWidth="2" />
            <circle cx="20" cy="32" r="9" fill={metalFill} stroke={stroke} strokeWidth="1.5" />
            <circle cx="52" cy="32" r="9" fill={metalFill} stroke={stroke} strokeWidth="1.5" />
            <circle cx="36" cy="32" r="6" fill="#64748b" stroke={stroke} strokeWidth="1" />
            <line x1="12" y1="16" x2="12" y2="20" stroke="#94a3b8" strokeWidth="2" />
            <line x1="24" y1="16" x2="24" y2="20" stroke="#94a3b8" strokeWidth="2" />
            <line x1="36" y1="16" x2="36" y2="20" stroke="#94a3b8" strokeWidth="2" />
            <line x1="48" y1="16" x2="48" y2="20" stroke="#94a3b8" strokeWidth="2" />
            <line x1="60" y1="16" x2="60" y2="20" stroke="#94a3b8" strokeWidth="2" />
          </svg>
        );
      }
      if (partId.includes('omni')) {
        return (
          <svg viewBox="0 0 64 64" className={className} aria-label="Omni directional wheel">
            <circle cx="32" cy="32" r="24" fill={metalFill} stroke={stroke} strokeWidth="2" />
            <circle cx="32" cy="32" r="10" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
            {/* Rollers around rim */}
            <ellipse cx="32" cy="11" rx="5" ry="3" fill={darkPlate} stroke={stroke} strokeWidth="1" />
            <ellipse cx="32" cy="53" rx="5" ry="3" fill={darkPlate} stroke={stroke} strokeWidth="1" />
            <ellipse cx="11" cy="32" rx="3" ry="5" fill={darkPlate} stroke={stroke} strokeWidth="1" />
            <ellipse cx="53" cy="32" rx="3" ry="5" fill={darkPlate} stroke={stroke} strokeWidth="1" />
          </svg>
        );
      }
      // Standard / Colson traction wheels
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Combat traction wheels">
          <rect x="8" y="12" width="16" height="40" rx="4" fill="#0f172a" stroke={stroke} strokeWidth="2" />
          <line x1="8" y1="20" x2="24" y2="20" stroke="#475569" strokeWidth="2" />
          <line x1="8" y1="28" x2="24" y2="28" stroke="#475569" strokeWidth="2" />
          <line x1="8" y1="36" x2="24" y2="36" stroke="#475569" strokeWidth="2" />
          <line x1="8" y1="44" x2="24" y2="44" stroke="#475569" strokeWidth="2" />
          <rect x="24" y="27" width="16" height="10" fill="#94a3b8" stroke={stroke} strokeWidth="1.5" />
          <circle cx="32" cy="32" r="3" fill="#f8fafc" />
          <rect x="40" y="12" width="16" height="40" rx="4" fill="#0f172a" stroke={stroke} strokeWidth="2" />
          <line x1="40" y1="20" x2="56" y2="20" stroke="#475569" strokeWidth="2" />
          <line x1="40" y1="28" x2="56" y2="28" stroke="#475569" strokeWidth="2" />
          <line x1="40" y1="36" x2="56" y2="36" stroke="#475569" strokeWidth="2" />
          <line x1="40" y1="44" x2="56" y2="44" stroke="#475569" strokeWidth="2" />
        </svg>
      );
    }

    case 'armor': {
      if (partId.includes('titanium')) {
        return (
          <svg viewBox="0 0 64 64" className={className} aria-label="Grade 5 Titanium plate">
            <path d="M 10 18 L 32 8 L 54 18 L 48 52 L 32 58 L 16 52 Z" fill="#93c5fd" stroke={stroke} strokeWidth="2" />
            <path d="M 32 8 L 32 58 L 48 52 L 54 18 Z" fill="#60a5fa" opacity="0.6" />
            <circle cx="20" cy="22" r="2.5" fill={stroke} />
            <circle cx="44" cy="22" r="2.5" fill={stroke} />
            <circle cx="22" cy="46" r="2.5" fill={stroke} />
            <circle cx="42" cy="46" r="2.5" fill={stroke} />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Ballistic armor plate">
          <path d="M 12 16 L 32 8 L 52 16 L 46 52 L 32 58 L 18 52 Z" fill={metalFill} stroke={stroke} strokeWidth="2" />
          <path d="M 32 8 L 32 58 L 46 52 L 52 16 Z" fill="#94a3b8" opacity="0.7" />
          <circle cx="22" cy="22" r="2.5" fill={stroke} />
          <circle cx="42" cy="22" r="2.5" fill={stroke} />
          <circle cx="24" cy="44" r="2.5" fill={stroke} />
          <circle cx="40" cy="44" r="2.5" fill={stroke} />
        </svg>
      );
    }

    case 'weapon': {
      if (partId.includes('horizontal')) {
        return (
          <svg viewBox="0 0 72 64" className={className} aria-label="Horizontal bar spinner">
            <circle cx="36" cy="32" r="9" fill={metalFill} stroke={stroke} strokeWidth="2" />
            <rect x="6" y="27" width="60" height="10" rx="2" fill={darkPlate} stroke={stroke} strokeWidth="2" />
            <rect x="4" y="23" width="10" height="10" rx="1.5" fill="#e11d48" stroke={stroke} strokeWidth="1.5" />
            <rect x="58" y="31" width="10" height="10" rx="1.5" fill="#e11d48" stroke={stroke} strokeWidth="1.5" />
            <circle cx="36" cy="32" r="4" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
          </svg>
        );
      }
      if (partId.includes('flipper') || partId.includes('wedge') || partId.includes('lifter')) {
        return (
          <svg viewBox="0 0 64 64" className={className} aria-label="Pneumatic flipper wedge">
            <path d="M 8 50 L 56 50 L 48 20 L 16 20 Z" fill={metalFill} stroke={stroke} strokeWidth="2" />
            <path d="M 20 20 L 18 12 L 46 12 L 44 20 Z" fill={cyanAccent} stroke={stroke} strokeWidth="1.5" />
            <line x1="12" y1="50" x2="48" y2="24" stroke="#64748b" strokeWidth="2" />
            <circle cx="32" cy="38" r="4" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
          </svg>
        );
      }
      // Vertical drum / disc spinner
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Vertical kinetic flywheel">
          <circle cx="32" cy="32" r="24" fill={darkPlate} stroke={stroke} strokeWidth="2" />
          <circle cx="32" cy="32" r="14" fill={metalFill} stroke={stroke} strokeWidth="1.5" />
          <path d="M 32 8 L 42 2 L 39 12 Z" fill="#e11d48" stroke={stroke} strokeWidth="1" />
          <path d="M 32 56 L 22 62 L 25 52 Z" fill="#e11d48" stroke={stroke} strokeWidth="1" />
          <circle cx="32" cy="32" r="5" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    }

    case 'utility':
    default:
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Utility accessory">
          <circle cx="32" cy="32" r="22" fill={metalFill} stroke={stroke} strokeWidth="2" />
          <path d="M 22 22 L 42 42 M 42 22 L 22 42" stroke={cyanAccent} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="32" cy="32" r="6" fill="#f8fafc" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
  }
};
