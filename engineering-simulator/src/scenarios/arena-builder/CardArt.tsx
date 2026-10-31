/** Start-screen card illustration for Arena Game Builder: retro arcade grid, hero and boss silhouettes, combat energy sparks. */
export function ArenaBuilderCardArt() {
  return (
    <svg viewBox="0 0 420 144" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="arenaCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <pattern id="arcadeGrid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#6366f1" strokeWidth="0.5" strokeOpacity="0.25" />
        </pattern>
      </defs>

      {/* Cyber Arcade Floor */}
      <rect width="420" height="144" fill="#090d16" />
      <rect width="420" height="144" fill="url(#arcadeGrid)" />
      <circle cx="210" cy="72" r="70" fill="url(#arenaCoreGlow)" />

      {/* Combat Ring */}
      <circle cx="210" cy="72" r="48" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="6 4" strokeOpacity="0.6" />
      <circle cx="210" cy="72" r="24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.5" />

      {/* Hero Silhouette (Left) */}
      <circle cx="120" cy="72" r="14" fill="#06b6d4" opacity="0.9" />
      {/* Hero Plasma Blade */}
      <line x1="128" y1="64" x2="152" y2="44" stroke="#22d3ee" strokeWidth="3.5" strokeLinecap="round" />
      {/* Blade Glow */}
      <line x1="128" y1="64" x2="152" y2="44" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />

      {/* Boss Silhouette (Right) */}
      <circle cx="300" cy="72" r="22" fill="#1e1b4b" stroke="#ef4444" strokeWidth="2.5" />
      <circle cx="294" cy="70" r="5" fill="#ef4444" />
      {/* Boss Horns / Plating */}
      <path d="M 288 52 L 298 42 L 304 50 Z" fill="#b91c1c" />
      <path d="M 312 52 L 322 42 L 316 50 Z" fill="#b91c1c" />

      {/* Boss Telegraph Zone in Center */}
      <path d="M 278 72 L 220 54 L 220 90 Z" fill="#ef4444" fillOpacity="0.25" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" />

      {/* Combat Clash Sparks */}
      <path d="M 205 68 L 212 54 L 216 66 L 228 72 L 216 78 L 212 90 L 205 76 L 192 72 Z" fill="#fef08a" opacity="0.9" />
      <circle cx="212" cy="72" r="3" fill="#ffffff" />
    </svg>
  )
}
