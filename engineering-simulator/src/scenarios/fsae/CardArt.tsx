/** Start-screen card illustration: a Formula SAE car crossing the finish line between cones. */
export function FsaeArt() {
  return (
    <svg viewBox="0 0 420 144" className="absolute inset-0 h-full w-full" aria-hidden>
      <rect y="96" width="420" height="48" fill="#3a4a40" />
      <g fill="#f4f3ec" opacity="0.85">
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={300 + (i % 2) * 7} y={96 + Math.floor(i / 2) * 12} width="7" height="12" />
        ))}
      </g>
      {[30, 90, 150, 360].map((x, i) => (
        <g key={x} transform={`translate(${x} ${i % 2 ? 128 : 94})`}>
          <path d="M-2 -18 L2 -18 L7 0 L-7 0 Z" fill={i % 2 ? '#ef7d22' : '#e8c22a'} />
          <rect x="-9" y="-1" width="18" height="3" rx="1" fill="#1b2a20" opacity="0.4" />
        </g>
      ))}
      <g transform="translate(150 78)">
        <rect x="18" y="26" width="112" height="16" rx="6" fill="#f4f3ec" />
        <path d="M126 28 L166 37 L126 42 Z" fill="#f4f3ec" />
        <rect x="150" y="38" width="22" height="5" fill="#74a85f" />
        <rect x="0" y="6" width="28" height="6" fill="#74a85f" />
        <rect x="12" y="10" width="4" height="18" fill="#1b2a20" />
        <circle cx="70" cy="22" r="9" fill="#e1b12c" />
        <rect x="44" y="31" width="80" height="3" fill="#2c5b3c" />
        <circle cx="34" cy="46" r="13" fill="#1b2a20" />
        <circle cx="34" cy="46" r="5" fill="#c9ccc8" />
        <circle cx="122" cy="47" r="11" fill="#1b2a20" />
        <circle cx="122" cy="47" r="4" fill="#c9ccc8" />
      </g>
      <g stroke="#f4f3ec" strokeWidth="2" opacity="0.5" strokeLinecap="round">
        <line x1="96" y1="98" x2="132" y2="98" />
        <line x1="80" y1="110" x2="128" y2="110" />
        <line x1="104" y1="122" x2="138" y2="122" />
      </g>
    </svg>
  )
}
