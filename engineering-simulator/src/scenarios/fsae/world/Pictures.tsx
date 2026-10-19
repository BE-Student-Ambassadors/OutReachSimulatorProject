/** Camera pictures for the software station: a traffic cone and things that look a bit like one. */

export type PicKind = 'cone' | 'barrel' | 'post' | 'hat' | 'toy'

const ORANGE = '#ef7d22'
const GRAY = '#8d9590'

export function ObjectPic({ kind, bg = 'asphalt', size = 150, seed = 0 }: { kind: PicKind; bg?: 'asphalt' | 'grass'; size?: number; seed?: number }) {
  const h = (size * 3) / 4
  const sky = bg === 'grass' ? '#cfe3c4' : '#d9dcd5'
  const ground = bg === 'grass' ? '#6f9a58' : '#4a524d'
  // Tiny shifts so a dataset doesn't look like 12 copies of one photo.
  const dx = ((seed * 37) % 17) - 8
  const s = 1 + (((seed * 53) % 11) - 5) / 60
  return (
    <svg width={size} height={h} viewBox="0 0 160 120" className="block rounded-lg">
      <rect width="160" height="120" fill={sky} />
      <rect y="78" width="160" height="42" fill={ground} />
      {bg === 'asphalt' && <rect y="96" width="160" height="2" fill="#f4f3ec" opacity="0.5" />}
      <g transform={`translate(${80 + dx} 92) scale(${s})`}>
        <ellipse cx="0" cy="2" rx="30" ry="5" fill="#000" opacity="0.18" />
        {kind === 'cone' && <Cone color={ORANGE} stripe />}
        {kind === 'post' && <Cone color={GRAY} stripe />}
        {kind === 'hat' && <Cone color={ORANGE} stripe={false} />}
        {kind === 'toy' && (
          <g transform="scale(0.38)">
            <Cone color={ORANGE} stripe />
          </g>
        )}
        {kind === 'barrel' && (
          <g>
            <rect x="-20" y="-62" width="40" height="62" rx="10" fill={ORANGE} />
            <rect x="-20" y="-40" width="40" height="9" fill="#f4f3ec" />
            <rect x="-24" y="-4" width="48" height="6" rx="2" fill="#2a2a2a" />
          </g>
        )}
      </g>
    </svg>
  )
}

function Cone({ color, stripe }: { color: string; stripe: boolean }) {
  return (
    <g>
      <path d="M -4 -66 L 4 -66 L 20 -4 L -20 -4 Z" fill={color} />
      {stripe && <path d="M -9.5 -42 L 9.5 -42 L 12.5 -30 L -12.5 -30 Z" fill="#f4f3ec" />}
      <rect x="-26" y="-6" width="52" height="7" rx="2" fill={color === GRAY ? '#5f6662' : '#c55f12'} />
    </g>
  )
}
