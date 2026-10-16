/** Start-screen card illustration for Battlebot Incubator: combat arena with crossed sparks and bot silhouettes. */
export function BattlebotCardArt() {
  return (
    <svg viewBox="0 0 420 144" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="arenaGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#0891b2" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <pattern id="arenaGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#0891b2" strokeWidth="0.5" strokeOpacity="0.25" />
        </pattern>
      </defs>

      {/* Dark combat floor with laser grid */}
      <rect width="420" height="144" fill="#030712" />
      <rect width="420" height="144" fill="url(#arenaGrid)" />
      <circle cx="210" cy="72" r="64" fill="url(#arenaGlow)" />
      <circle cx="210" cy="72" r="42" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="6 4" strokeOpacity="0.6" />
      <circle cx="210" cy="72" r="16" fill="none" stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.8" />

      {/* Combat Sparks */}
      <path d="M 200 68 L 210 50 L 214 66 L 228 72 L 214 78 L 210 94 L 200 76 L 186 72 Z" fill="#fef08a" opacity="0.9" />
      <circle cx="210" cy="72" r="3" fill="#ffffff" />

      {/* Left Robot (Spinner Silhouette) */}
      <rect x="90" y="60" width="36" height="24" rx="4" fill="#06b6d4" opacity="0.8" />
      <circle cx="128" cy="72" r="14" fill="#38bdf8" opacity="0.9" />
      <line x1="86" y1="58" x2="128" y2="58" stroke="#0284c7" strokeWidth="3" />
      <line x1="86" y1="86" x2="128" y2="86" stroke="#0284c7" strokeWidth="3" />

      {/* Right Robot (The Bull Silhouette) */}
      <rect x="294" y="58" width="40" height="28" rx="3" fill="#ef4444" opacity="0.8" />
      <path d="M 294 62 L 274 72 L 294 82 Z" fill="#b91c1c" />
      <line x1="300" y1="54" x2="336" y2="54" stroke="#7f1d1d" strokeWidth="4" />
      <line x1="300" y1="90" x2="336" y2="90" stroke="#7f1d1d" strokeWidth="4" />
    </svg>
  )
}
