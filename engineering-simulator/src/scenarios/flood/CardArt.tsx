/** Start-screen card illustration: rain over a campus skyline with rising water. */
export function StormArt() {
  return (
    <svg viewBox="0 0 420 144" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <pattern id="rain" width="14" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
          <line x1="7" y1="0" x2="7" y2="10" stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="420" height="144" fill="url(#rain)" />
      {/* Simple campus skyline with rising water */}
      <path d="M0 112 H60 V86 H130 V112 H170 V72 H250 V112 H290 V94 H360 V112 H420 V144 H0 Z" fill="#f4f3ec" opacity="0.95" />
      <path d="M0 120 Q 52 114 105 120 T 210 120 T 315 120 T 420 120 V144 H0 Z" fill="#9fd3e6" opacity="0.9" />
      <path d="M0 128 Q 52 122 105 128 T 210 128 T 315 128 T 420 128 V144 H0 Z" fill="#5fa8c9" />
    </svg>
  )
}
