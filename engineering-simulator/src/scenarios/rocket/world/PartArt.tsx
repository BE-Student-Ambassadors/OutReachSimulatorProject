import type { KitPartId, PartCategory } from '../types'

const COLORS: Record<string, string> = {
  'nose-blunt': '#dcd6c8',
  'nose-ogive': '#ffffff',
  'nose-vk': '#b8461b',
  'body-cardboard': '#c9a26b',
  'body-phenolic': '#7a4e2d',
  'body-fiberglass': '#f3f1ea',
  'fins-balsa': '#e3c48f',
  'fins-plywood': '#b88a55',
  'fins-g10': '#2c5b3c',
  'motor-mini': '#8a8f88',
  'motor-standard': '#5d635e',
  'motor-pro': '#2a2f2b',
  'chute-bag': '#2d2f33',
  'chute-nylon': '#e0662a',
  'chute-ripstop': '#d33a2c',
}

/** Small product photo for a part listing or kit part. */
export function PartArt({ takes, listingId, className = 'size-14' }: { takes: PartCategory | KitPartId; listingId?: string; className?: string }) {
  const c = (listingId && COLORS[listingId]) || '#c9c3b3'
  const stroke = '#1b2a20'
  return (
    <svg viewBox="0 0 64 64" className={className}>
      {takes === 'nose' && (
        <path
          d={listingId === 'nose-blunt' ? 'M18 52 L18 34 Q32 6 46 34 L46 52 Z' : 'M20 54 L20 44 Q24 18 32 6 Q40 18 44 44 L44 54 Z'}
          fill={c}
          stroke={stroke}
          strokeWidth={2}
        />
      )}
      {takes === 'body' && (
        <g>
          <rect x={22} y={6} width={20} height={52} rx={3} fill={c} stroke={stroke} strokeWidth={2} />
          <ellipse cx={32} cy={8} rx={10} ry={3} fill="#00000022" />
          {listingId === 'body-phenolic' && <path d="M24 44 q3 2 0 5" stroke={stroke} strokeWidth={1.5} fill="none" />}
        </g>
      )}
      {takes === 'fins' && (
        <g fill={c} stroke={stroke} strokeWidth={2}>
          <path d="M8 50 L8 26 L22 40 L22 50 Z" transform={listingId === 'fins-balsa' ? 'rotate(-6 15 40)' : undefined} />
          <path d="M26 50 L26 22 L40 38 L40 50 Z" />
          <path d="M44 50 L44 26 L58 40 L58 50 Z" />
        </g>
      )}
      {takes === 'motor' && (
        <g stroke={stroke} strokeWidth={2}>
          <rect x={22} y={8} width={20} height={36} rx={3} fill={c} />
          <path d="M24 44 L40 44 L44 58 L20 58 Z" fill="#18181b" />
          <rect x={22} y={16} width={20} height={4} fill="#d9a52b" stroke="none" />
        </g>
      )}
      {takes === 'parachute' && (
        <g stroke={stroke} strokeWidth={2}>
          <path d="M6 30 Q32 -4 58 30 Z" fill={c} />
          <path d="M6 30 L32 56 M58 30 L32 56 M24 30 L32 56 M40 30 L32 56" fill="none" strokeWidth={1.2} />
        </g>
      )}
      {takes === 'kit:shock-cord' && (
        <path d="M10 14 q8 -8 16 0 t16 0 t12 4 M10 30 q8 -8 16 0 t16 0 t12 4 M10 46 q8 -8 16 0 t16 0 t12 4" fill="none" stroke="#d99a1e" strokeWidth={4} strokeLinecap="round" />
      )}
      {takes === 'kit:avionics-bay' && (
        <g stroke={stroke} strokeWidth={2}>
          <rect x={14} y={10} width={36} height={44} rx={4} fill="#e9e4d6" />
          <rect x={20} y={18} width={24} height={14} rx={2} fill="#2c5b3c" />
          <rect x={20} y={38} width={10} height={8} fill="#c23b22" />
        </g>
      )}
    </svg>
  )
}
