/** Start-screen card illustration: a street with a line of cars and a bus. */
export function TrafficArt() {
  const cars = ['#f4f3ec', '#e1b12c', '#c0392b', '#9fd3e6', '#f4f3ec', '#74a85f', '#e1b12c', '#f4f3ec']
  return (
    <svg viewBox="0 0 420 144" className="absolute inset-0 h-full w-full" aria-hidden>
      <path d="M0 96 H60 V70 H130 V96 H170 V58 H250 V96 H290 V78 H360 V96 H420 V100 H0 Z" fill="#f4f3ec" opacity="0.18" />
      <rect y="100" width="420" height="44" fill="#3a4a40" />
      <g stroke="#f4f3ec" strokeWidth="2" strokeDasharray="14 12" opacity="0.6">
        <line x1="0" y1="122" x2="420" y2="122" />
      </g>
      {cars.map((c, i) => (
        <g key={i} transform={`translate(${18 + i * 40} 106)`}>
          <rect width="30" height="12" rx="3" fill={c} />
          <rect x="6" y="-6" width="16" height="8" rx="2" fill={c} opacity="0.85" />
          <rect x="-2" y="3" width="3" height="5" fill="#e5341b" />
        </g>
      ))}
      <g transform="translate(340 92)">
        <rect width="66" height="24" rx="4" fill="#f2b81c" />
        {[0, 1, 2, 3, 4].map((k) => (
          <rect key={k} x={6 + k * 12} y="5" width="8" height="7" rx="1" fill="#2f3a33" />
        ))}
      </g>
      <g transform="translate(205 128)" fill="#f4f3ec">
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <rect key={k} x={k * 9} y="0" width="5" height="14" />
        ))}
      </g>
    </svg>
  )
}
