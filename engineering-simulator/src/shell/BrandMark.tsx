interface BrandMarkProps {
  size?: number
  variant?: 'badge' | 'lockup' | 'official'
  inverted?: boolean
  className?: string
}

/** Official Baskin Engineering wordmark from brand guidelines */
export function BaskinLogo({
  height = 36,
  inverted = false,
  className = '',
}: {
  height?: number
  inverted?: boolean
  className?: string
}) {
  const src = inverted ? '/branding/baskin-logo-white.png' : '/branding/baskin-logo-color.png'
  return (
    <img
      src={src}
      alt="UC Santa Cruz Baskin Engineering"
      style={{ height: `${height}px`, width: 'auto' }}
      className={`object-contain select-none shrink-0 ${className}`}
      loading="eager"
    />
  )
}

/**
 * BE Lab Mark:
 * Supports official logo display or the compact BE square tile.
 */
export function BrandMark({ size = 36, variant = 'badge', inverted = false, className = '' }: BrandMarkProps) {
  if (variant === 'official') {
    return <BaskinLogo height={size} inverted={inverted} className={className} />
  }

  if (variant === 'lockup') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <BaskinLogo height={size} inverted={inverted} />
        <div className="h-6 w-px bg-current opacity-20" />
        <span className={`font-mono text-xs font-bold tracking-wider uppercase ${inverted ? 'text-white' : 'text-[#003c6c]'}`}>
          BE Lab
        </span>
      </div>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-label="BE Lab" role="img" className={`shrink-0 ${className}`}>
      {/* UCSC Navy base container */}
      <rect width="44" height="44" rx="10" fill={inverted ? '#ffffff' : '#003c6c'} />
      {/* Official Baskin Orange grounding accent bar */}
      <rect x="7" y="32" width="30" height="3" rx="1.5" fill="#f29813" />
      {/* Technical accent pip in UCSC Gold */}
      <circle cx="34" cy="11" r="2.5" fill="#fdc700" />
      <text
        x="22"
        y="25.5"
        textAnchor="middle"
        fontFamily="'Roboto', -apple-system, BlinkMacSystemFont, sans-serif"
        fontWeight="900"
        fontSize="16"
        letterSpacing="0.8px"
        fill={inverted ? '#003c6c' : '#ffffff'}
      >
        BE
      </text>
    </svg>
  )
}
