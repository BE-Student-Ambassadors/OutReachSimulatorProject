/**
 * Start-screen card illustration for Arena Game Builder.
 *
 * Visual Concept:
 * An energetic, colorful 2D arcade video game scene inside an active game-development editor.
 * Features a fantasy/sci-fi hero with an energy slash, an imposing horned boss with a telegraphed
 * danger zone, tiled arena floor with molten hazard pools, tactical cover blocks, health bars,
 * and game development cues (editor grid, collision hitboxes, state machine labels, and path nodes).
 */
export function ArenaBuilderCardArt() {
  return (
    <svg
      viewBox="0 0 420 144"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        {/* Background Atmosphere Gradient (Crisp White Canvas) */}
        <linearGradient id="abBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>

        {/* Game Dev Editor Grid Pattern on White */}
        <pattern id="abDevGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e7ff" strokeWidth="0.75" strokeOpacity="0.8" />
          <circle cx="0" cy="0" r="0.75" fill="#a5b4fc" opacity="0.6" />
        </pattern>

        {/* Molten Lava Hazard Pattern/Gradient */}
        <linearGradient id="abLavaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#facc15" />
        </linearGradient>

        {/* Hero Slash Energy Glow */}
        <linearGradient id="abSlashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>

        {/* Boss Energy Core Glow */}
        <radialGradient id="abBossCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#a855f7" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#581c87" stopOpacity="0" />
        </radialGradient>

        {/* Soft Ambient Radiant Floor Glow */}
        <radialGradient id="abStageAmbient" cx="50%" cy="65%" r="65%">
          <stop offset="0%" stopColor="#ede9fe" stopOpacity="0.75" />
          <stop offset="50%" stopColor="#e0f2fe" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 1. Editor Canvas Background & Grid (Clean White Canvas) */}
      <rect width="420" height="144" fill="#ffffff" />
      <rect width="420" height="144" fill="url(#abStageAmbient)" />
      <rect width="420" height="144" fill="url(#abDevGrid)" />

      {/* Editor Top Coordinate Bar */}
      <line x1="0" y1="14" x2="420" y2="14" stroke="#cbd5e1" strokeWidth="0.8" />
      <text x="12" y="10" fill="#6366f1" fontSize="7" fontFamily="monospace" fontWeight="bold">
        STUDIO LEVEL EDITOR • 16x12 GRID • VIEWPORT: ACTIVE
      </text>

      {/* 2. Tiled Arena Floor (Isometric / Orthographic Game Tiles) */}
      <g opacity="0.95">
        {/* Outer floor tile grid lines on white */}
        {[36, 56, 76, 96, 116, 136].map((y) => (
          <line key={`h-${y}`} x1="30" y1={y} x2="390" y2={y} stroke="#c7d2fe" strokeWidth="0.8" strokeOpacity="0.7" />
        ))}
        {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390].map((x) => (
          <line key={`v-${x}`} x1={x} y1="36" x2={x} y2="136" stroke="#c7d2fe" strokeWidth="0.8" strokeOpacity="0.7" />
        ))}

        {/* Highlighted Game Floor Tiles */}
        <rect x="60" y="76" width="30" height="20" fill="#241d45" stroke="#4f46e5" strokeWidth="0.75" />
        <rect x="90" y="76" width="30" height="20" fill="#292150" stroke="#4f46e5" strokeWidth="0.75" />
        <rect x="120" y="76" width="30" height="20" fill="#241d45" stroke="#4f46e5" strokeWidth="0.75" />
        <rect x="90" y="96" width="30" height="20" fill="#241d45" stroke="#4f46e5" strokeWidth="0.75" />

        {/* Molten Lava Hazard Zone (Center-Bottom) */}
        <rect x="180" y="96" width="60" height="20" rx="3" fill="url(#abLavaGrad)" opacity="0.85" />
        <rect x="182" y="98" width="56" height="16" rx="2" fill="#ef4444" opacity="0.6" />
        {/* Bubbling Lava Details */}
        <circle cx="195" cy="106" r="3" fill="#fef08a" />
        <circle cx="208" cy="103" r="2" fill="#fff" />
        <circle cx="225" cy="107" r="2.5" fill="#fef08a" />
        <text x="186" y="93" fill="#c2410c" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
          [HAZARD TILE]
        </text>

        {/* Tactical Cover Block (Pillar with 3D Face & Editor Gizmo) */}
        <g transform="translate(150, 48)">
          {/* Shadow */}
          <rect x="2" y="24" width="26" height="6" rx="2" fill="#000000" opacity="0.5" />
          {/* Front Face */}
          <rect x="2" y="10" width="24" height="16" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          {/* Top Face */}
          <polygon points="2,10 8,3 32,3 26,10" fill="#334155" stroke="#475569" strokeWidth="1" />
          {/* Right Bevel */}
          <polygon points="26,10 32,3 32,19 26,26" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
          {/* Neon Cyber Accent */}
          <line x1="4" y1="18" x2="24" y2="18" stroke="#06b6d4" strokeWidth="1.5" />
          {/* Editor Transform Gizmo on top of Block */}
          <line x1="17" y1="3" x2="17" y2="-7" stroke="#22c55e" strokeWidth="1.5" markerEnd="url(#arrow)" />
          <line x1="17" y1="3" x2="27" y2="3" stroke="#ef4444" strokeWidth="1.5" />
          <circle cx="17" cy="3" r="1.5" fill="#facc15" />
        </g>

        {/* Second Cover Pillar on Right */}
        <g transform="translate(245, 54)">
          <rect x="2" y="22" width="24" height="6" rx="2" fill="#000000" opacity="0.4" />
          <rect x="2" y="8" width="22" height="16" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <polygon points="2,8 7,2 29,2 24,8" fill="#334155" stroke="#475569" strokeWidth="1" />
          <polygon points="24,8 29,2 29,18 24,24" fill="#0f172a" />
          <line x1="4" y1="16" x2="22" y2="16" stroke="#8b5cf6" strokeWidth="1.5" />
        </g>

        {/* Floating Star / Collectible Gem */}
        <g transform="translate(210, 44)">
          {/* Floor Shadow */}
          <ellipse cx="0" cy="22" rx="6" ry="2" fill="#000000" opacity="0.4" />
          {/* Diamond Gem */}
          <polygon points="0,-8 7,0 0,8 -7,0" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
          <polygon points="0,-6 5,0 0,6 -5,0" fill="#fef08a" />
          {/* Sparkles */}
          <circle cx="-9" cy="-6" r="1" fill="#fff" />
          <circle cx="8" cy="-5" r="1" fill="#fff" />
        </g>
      </g>

      {/* 3. BFS Dynamic Path Preview (Connecting Player Spawn to Combat Zone) */}
      <g opacity="0.8">
        <path
          d="M 100 88 L 135 88 L 150 96 L 175 84 L 210 78 L 240 84 L 275 88"
          fill="none"
          stroke="#06b6d4"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        {/* Path Waypoint Nodes */}
        <circle cx="100" cy="88" r="3" fill="#22d3ee" stroke="#083344" strokeWidth="1" />
        <circle cx="150" cy="96" r="2.5" fill="#22d3ee" />
        <circle cx="210" cy="78" r="2.5" fill="#22d3ee" />
        <circle cx="275" cy="88" r="3" fill="#22d3ee" stroke="#083344" strokeWidth="1" />
      </g>

      {/* 4. Boss Attack Telegraph Zone (Dashed Red Threat Arc) */}
      <g transform="translate(295, 78)">
        {/* Telegraph Danger Sector extending towards Hero */}
        <path
          d="M 0 0 L -85 -36 A 92 92 0 0 0 -85 36 Z"
          fill="#ef4444"
          fillOpacity="0.18"
          stroke="#ef4444"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        {/* Warning Indicator */}
        <text x="-65" y="3" fill="#dc2626" fontSize="7.5" fontFamily="sans-serif" fontWeight="900" opacity="0.95">
          ⚠ DANGER ZONE
        </text>
      </g>

      {/* 5. Playable Hero (Sci-Fi / Fantasy Character with Plasma Blade) */}
      <g transform="translate(95, 82)">
        {/* Spawn Ring Marker */}
        <ellipse cx="0" cy="18" rx="18" ry="6" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
        <text x="-16" y="27" fill="#0284c7" fontSize="5.5" fontFamily="monospace" fontWeight="bold">
          P1 SPAWN
        </text>

        {/* Character Floor Shadow */}
        <ellipse cx="0" cy="15" rx="11" ry="4" fill="#000000" opacity="0.6" />

        {/* Flowing Violet Cape */}
        <path d="M -5 -2 Q -16 6 -13 16 Q -5 13 -2 12 Z" fill="#7c3aed" />
        <path d="M -5 -2 Q -14 6 -11 15 Q -5 12 -2 12 Z" fill="#9333ea" />

        {/* Legs & Boots */}
        <rect x="-6" y="8" width="4" height="7" rx="1.5" fill="#0f172a" />
        <rect x="2" y="8" width="4" height="7" rx="1.5" fill="#0f172a" />

        {/* Torso & Armor Plate */}
        <rect x="-7" y="-5" width="14" height="14" rx="3" fill="#0284c7" stroke="#0369a1" strokeWidth="1" />
        {/* Glowing Chest Core */}
        <circle cx="0" cy="2" r="2.5" fill="#38bdf8" />
        <circle cx="0" cy="2" r="1" fill="#ffffff" />
        {/* Gold Belt Buckle */}
        <rect x="-4" y="6" width="8" height="2" fill="#facc15" />

        {/* Helmet / Head */}
        <circle cx="0" cy="-12" r="7.5" fill="#0f172a" stroke="#0284c7" strokeWidth="1" />
        {/* Visor (Glowing Cyan) */}
        <rect x="1" y="-14" width="6.5" height="3.5" rx="1.5" fill="#22d3ee" />
        <rect x="2" y="-13.5" width="4.5" height="1.5" rx="0.5" fill="#ffffff" />
        {/* Helmet Plume */}
        <path d="M -4 -18 Q -1 -22 4 -18 Q 0 -16 -2 -14 Z" fill="#f43f5e" />

        {/* Extended Sword Arm & Glowing Plasma Blade */}
        <line x1="4" y1="2" x2="16" y2="-4" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" />
        {/* Blade Core & Glow */}
        <line x1="16" y1="-4" x2="38" y2="-18" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
        <line x1="16" y1="-4" x2="38" y2="-18" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        {/* Crossguard */}
        <line x1="13" y1="-7" x2="18" y2="0" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />

        {/* Glowing Slash Wave Arc Erupting from Strike */}
        <path
          d="M 32 -26 Q 52 -10 38 12"
          fill="none"
          stroke="url(#abSlashGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d="M 34 -22 Q 48 -10 38 8"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Hero Health Bar */}
        <g transform="translate(-16, -26)">
          <rect width="32" height="4" rx="1.5" fill="#090d16" stroke="#334155" strokeWidth="0.8" />
          <rect x="0.8" y="0.8" width="24" height="2.4" rx="1" fill="#22c55e" />
          <text x="0" y="-2" fill="#15803d" fontSize="5.5" fontFamily="monospace" fontWeight="bold">
            HERO HP: 120
          </text>
        </g>

        {/* Game Dev Hitbox Boundary Wireframe */}
        <rect
          x="-14"
          y="-20"
          width="28"
          height="38"
          fill="none"
          stroke="#22c55e"
          strokeWidth="1"
          strokeDasharray="2.5 2"
          opacity="0.85"
        />
        {/* Corner registration brackets */}
        <path d="M -16 -16 L -16 -20 L -12 -20" stroke="#22c55e" strokeWidth="1.2" fill="none" />
        <path d="M 12 -20 L 16 -20 L 16 -16" stroke="#22c55e" strokeWidth="1.2" fill="none" />
        <path d="M -16 14 L -16 18 L -12 18" stroke="#22c55e" strokeWidth="1.2" fill="none" />
        <path d="M 12 18 L 16 18 L 16 14" stroke="#22c55e" strokeWidth="1.2" fill="none" />
        {/* Editor Tag Badge */}
        <rect x="-18" y="-35" width="36" height="7" rx="2" fill="#15803d" />
        <text x="-15" y="-30" fill="#ffffff" fontSize="5" fontFamily="monospace" fontWeight="bold">
          TAG: HERO[P1]
        </text>
      </g>

      {/* 6. Combat Impact Sparks & Floating Numbers */}
      <g transform="translate(170, 70)">
        {/* Energy Clash Star */}
        <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill="#fef08a" />
        <circle cx="0" cy="0" r="2" fill="#ffffff" />
        {/* Floating Arcade Combat Text */}
        <text x="4" y="-7" fill="#fbbf24" fontSize="7.5" fontFamily="sans-serif" fontWeight="900" stroke="#000" strokeWidth="0.5">
          HIT! 24
        </text>
      </g>

      {/* 7. Boss Enemy (Towering Chitinous Horned Titan Monster) */}
      <g transform="translate(325, 78)">
        {/* Boss Floor Shadow */}
        <ellipse cx="0" cy="22" rx="28" ry="8" fill="#000000" opacity="0.6" />

        {/* Massive Spiked Shoulders / Torso */}
        <path
          d="M -24 4 L -20 -14 L -10 -22 L 10 -22 L 20 -14 L 24 4 L 16 18 L -16 18 Z"
          fill="#2e1065"
          stroke="#581c87"
          strokeWidth="1.5"
        />

        {/* Chitin Armor Plates */}
        <polygon points="-16,-12 -8,-20 8,-20 16,-12 12,6 -12,6" fill="#4c1d95" stroke="#6d28d9" strokeWidth="1" />
        <polygon points="-12,6 0,-6 12,6 0,16" fill="#3b0764" />

        {/* Pulsing Boss Heart Core */}
        <circle cx="0" cy="5" r="9" fill="url(#abBossCoreGlow)" />
        <circle cx="0" cy="5" r="4.5" fill="#f43f5e" />
        <circle cx="0" cy="5" r="2" fill="#ffffff" />

        {/* Swept-Back Demon Horns */}
        <path d="M -9 -20 Q -18 -32 -26 -28 Q -20 -22 -12 -18 Z" fill="#9333ea" stroke="#c084fc" strokeWidth="1" />
        <path d="M 9 -20 Q 18 -32 26 -28 Q 20 -22 12 -18 Z" fill="#9333ea" stroke="#c084fc" strokeWidth="1" />

        {/* Boss Head & Glowing Eyes */}
        <polygon points="-7,-18 0,-24 7,-18 5,-12 -5,-12" fill="#1e1b4b" stroke="#7c3aed" strokeWidth="1" />
        {/* Piercing Red/Amber Eyes */}
        <circle cx="-3" cy="-15" r="1.8" fill="#fbbf24" />
        <circle cx="3" cy="-15" r="1.8" fill="#fbbf24" />
        <circle cx="-3" cy="-15" r="0.8" fill="#ffffff" />
        <circle cx="3" cy="-15" r="0.8" fill="#ffffff" />

        {/* Raised Weapon / Attack Arm */}
        <path d="M -18 -6 L -30 -16 L -26 -22 L -14 -12 Z" fill="#4c1d95" />
        {/* Boss Cleaver Blade */}
        <path d="M -30 -16 L -42 -32 L -34 -34 L -24 -20 Z" fill="#701a75" stroke="#ec4899" strokeWidth="1" />
        <line x1="-40" y1="-30" x2="-26" y2="-18" stroke="#f43f5e" strokeWidth="1.5" />

        {/* Boss Health Bar Above */}
        <g transform="translate(-40, -42)">
          <rect width="80" height="6" rx="2" fill="#090d16" stroke="#475569" strokeWidth="0.8" />
          <rect x="1" y="1" width="58" height="4" rx="1" fill="#dc2626" />
          {/* Segment Lines */}
          <line x1="20" y1="1" x2="20" y2="5" stroke="#7f1d1d" strokeWidth="1" />
          <line x1="40" y1="1" x2="40" y2="5" stroke="#7f1d1d" strokeWidth="1" />
          <text x="0" y="-2" fill="#b91c1c" fontSize="5.5" fontFamily="monospace" fontWeight="bold">
            BOSS: GOLIATH PRIME [260 HP]
          </text>
        </g>

        {/* Boss Hitbox Boundary Wireframe */}
        <rect
          x="-32"
          y="-32"
          width="64"
          height="56"
          fill="none"
          stroke="#ec4899"
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.85"
        />
        {/* Corner registration brackets */}
        <path d="M -35 -27 L -35 -32 L -30 -32" stroke="#ec4899" strokeWidth="1.2" fill="none" />
        <path d="M 30 -32 L 35 -32 L 35 -27" stroke="#ec4899" strokeWidth="1.2" fill="none" />
        <path d="M -35 19 L -35 24 L -30 24" stroke="#ec4899" strokeWidth="1.2" fill="none" />
        <path d="M 30 24 L 35 24 L 35 19" stroke="#ec4899" strokeWidth="1.2" fill="none" />
        {/* Editor Tag Badge */}
        <rect x="-32" y="27" width="64" height="7" rx="2" fill="#831843" />
        <text x="-28" y="32" fill="#fbcfe8" fontSize="5" fontFamily="monospace" fontWeight="bold">
          AI FSM: [STATE: WINDUP]
        </text>
      </g>
    </svg>
  )
}
