export function RocketArt() {
  return (
    <svg viewBox="0 0 360 150" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="irecSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#143326" />
          <stop offset="65%" stopColor="#2c5b3c" />
          <stop offset="100%" stopColor="#d9c6a5" />
        </linearGradient>
      </defs>
      <rect width="360" height="150" fill="url(#irecSky)" />
      {/* Desert Mesas */}
      <polygon points="0,150 0,115 55,98 95,115 140,150" fill="#a87d59" opacity="0.65" />
      <polygon points="210,150 245,104 305,104 360,130 360,150" fill="#946b49" opacity="0.6" />
      <rect x="0" y="132" width="360" height="18" fill="#c9b18c" />

      {/* Bullseye Landing Target Pad on Right */}
      <ellipse cx="268" cy="139" rx="28" ry="6" fill="#ffffff" />
      <ellipse cx="268" cy="139" rx="18" ry="3.8" fill="#dc2626" />
      <ellipse cx="268" cy="139" rx="7" ry="1.8" fill="#ffffff" />

      {/* Descending Payload + Parachute on Right */}
      <path d="M 244 48 Q 268 18 292 48 Z" fill="#f97316" />
      <line x1="248" y1="48" x2="263" y2="72" stroke="#f8fafc" strokeWidth="1.5" />
      <line x1="288" y1="48" x2="273" y2="72" stroke="#f8fafc" strokeWidth="1.5" />
      <rect x="261" y="72" width="14" height="14" rx="2" fill="#f59e0b" stroke="#1e293b" strokeWidth="1.5" />

      {/* Ascending Rocket + Exhaust Plume on Left */}
      <path d="M 98 135 Q 100 95 104 64" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.5" fill="none" />
      <g transform="translate(104, 52) rotate(6)">
        <polygon points="0,-24 -7,-8 7,-8" fill="#1e293b" />
        <rect x="-7" y="-8" width="14" height="36" fill="#f8fafc" />
        <rect x="-7" y="4" width="14" height="6" fill="#b8461b" />
        <polygon points="-7,16 -15,28 -7,28" fill="#b8461b" />
        <polygon points="7,16 15,28 7,28" fill="#b8461b" />
        <polygon points="-5,28 0,46 5,28" fill="#fb923c" />
      </g>
    </svg>
  )
}
