/** BESA Engineering Lab mark: a green tile with the BESA monogram. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label="BESA" role="img">
      <rect width="40" height="40" rx="10" fill="#2c5b3c" />
      <rect x="6" y="27.5" width="28" height="2.2" rx="1.1" fill="#74a85f" />
      <text
        x="20"
        y="23.5"
        textAnchor="middle"
        fontFamily="'Bricolage Grotesque Variable', 'Instrument Sans Variable', system-ui, sans-serif"
        fontWeight="800"
        fontSize="13"
        letterSpacing="0.3"
        fill="#f4f3ec"
      >
        BESA
      </text>
    </svg>
  )
}
