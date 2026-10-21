import { SPONSOR_BY_ID } from '../config'
import type { FlyerMotif, FlyerSpec, SponsorId } from '../types'
import { FLYER_H, FLYER_W } from './paintStore'

function wrap(text: string, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max && line) {
      out.push(line)
      line = word
    } else line = (line + ' ' + word).trim()
  }
  if (line) out.push(line)
  return out.slice(0, 4)
}

function Motif({ motif, color, light }: { motif: FlyerMotif; color: string; light: string }) {
  switch (motif) {
    case 'car':
      return (
        <g>
          <path d="M-85 22 L-78 4 L-30 -4 L-12 -26 L18 -26 L30 -4 L80 2 L88 22 Z" fill={color} stroke={light} strokeWidth={3} />
          <rect x={-100} y={-22} width={26} height={10} rx={2} fill={color} />
          <rect x={-90} y={-14} width={6} height={20} fill={color} />
          <path d="M-8 -22 L12 -22 L20 -6 L-14 -6 Z" fill={light} />
          {[-52, 52].map((x) => (
            <g key={x}>
              <circle cx={x} cy={26} r={20} fill="#1b1d1c" stroke={light} strokeWidth={3} />
              <circle cx={x} cy={26} r={7} fill={light} />
            </g>
          ))}
        </g>
      )
    case 'flag':
      return (
        <g>
          <rect x={-62} y={-60} width={6} height={120} rx={3} fill={color} />
          {Array.from({ length: 20 }, (_, i) => {
            const c = i % 5
            const r = Math.floor(i / 5)
            return <rect key={i} x={-56 + c * 22} y={-58 + r * 18} width={22} height={18} fill={(c + r) % 2 ? light : color} stroke={color} strokeWidth={1} />
          })}
        </g>
      )
    case 'bolt':
      return <path d="M14 -70 L-40 8 L-4 8 L-18 70 L42 -14 L6 -14 Z" fill={color} stroke={light} strokeWidth={4} strokeLinejoin="round" />
    case 'stars':
      return (
        <g fill={color}>
          {[
            [0, -10, 34],
            [-60, -40, 14],
            [58, -30, 18],
            [-40, 40, 12],
            [50, 44, 10],
          ].map(([x, y, r], i) => (
            <path key={i} transform={`translate(${x} ${y}) scale(${r / 30})`} d="M0 -30 L8 -9 L30 -9 L12 4 L19 26 L0 13 L-19 26 L-12 4 L-30 -9 L-8 -9 Z" />
          ))}
        </g>
      )
    case 'food':
      return (
        <g>
          <path d="M0 60 L-58 -46 Q0 -76 58 -46 Z" fill="#e3a14a" stroke={color} strokeWidth={4} strokeLinejoin="round" />
          <path d="M-50 -38 Q0 -62 50 -38" fill="none" stroke="#c9822e" strokeWidth={10} />
          {[
            [-14, -20],
            [16, -10],
            [-2, 16],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={9} fill="#c23b22" />
          ))}
        </g>
      )
    case 'sun':
      return (
        <g stroke={color} strokeWidth={6} strokeLinecap="round">
          <circle r={34} fill={color} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2
            return <line key={i} x1={Math.cos(a) * 46} y1={Math.sin(a) * 46} x2={Math.cos(a) * 64} y2={Math.sin(a) * 64} />
          })}
        </g>
      )
    case 'tools':
      return (
        <g fill={color}>
          <rect x={-6} y={-60} width={12} height={110} rx={4} transform="rotate(35)" />
          <rect x={-34} y={-66} width={56} height={22} rx={5} transform="rotate(35)" />
          <rect x={-6} y={-60} width={12} height={110} rx={4} transform="rotate(-35)" fill={light} stroke={color} strokeWidth={3} />
        </g>
      )
    case 'money':
      return (
        <g>
          {[-30, 0, 30].map((x, i) => (
            <g key={i} transform={`translate(${x} ${i * -8})`}>
              <circle r={30} fill={color} stroke={light} strokeWidth={4} />
              <text y={11} textAnchor="middle" fontSize={32} fontWeight={800} fill={light} fontFamily="Bricolage Grotesque Variable">
                $
              </text>
            </g>
          ))}
        </g>
      )
  }
}

/** The generated flyer, drawn from its spec. Paint goes on top of this. */
export function FlyerArt({ spec, sponsorId }: { spec: FlyerSpec; sponsorId: SponsorId }) {
  const [bg, accent, ink] = spec.palette
  const sponsor = SPONSOR_BY_ID[sponsorId]
  const head = wrap(spec.headline, spec.layout === 'banner' ? 22 : 15)
  const motifY = spec.layout === 'poster' ? 130 : spec.layout === 'banner' ? 270 : 175
  return (
    <svg viewBox={`0 0 ${FLYER_W} ${FLYER_H}`} width={FLYER_W} height={FLYER_H} className="block">
      <rect width={FLYER_W} height={FLYER_H} fill={bg} />
      {spec.layout === 'banner' && <rect y={0} width={FLYER_W} height={150} fill={accent} />}
      {spec.layout === 'badge' && <circle cx={150} cy={175} r={120} fill="none" stroke={accent} strokeWidth={10} strokeDasharray="4 10" />}
      <g transform={`translate(150 ${motifY})`}>
        <Motif motif={spec.motif} color={accent} light={bg} />
      </g>
      <g fontFamily="Bricolage Grotesque Variable" fontWeight={800} textAnchor="middle" fill={spec.layout === 'banner' ? bg : ink}>
        {head.map((l, i) => (
          <text key={i} x={150} y={(spec.layout === 'poster' ? 245 : spec.layout === 'banner' ? 50 : 320) + i * 30} fontSize={spec.layout === 'badge' ? 22 : 27}>
            {l}
          </text>
        ))}
      </g>
      <text x={150} y={spec.layout === 'badge' ? 50 : 360} textAnchor="middle" fontFamily="Instrument Sans Variable" fontSize={13} fill={ink} opacity={0.85}>
        {spec.tagline}
      </text>
      <rect x={70} y={372} width={160} height={20} rx={10} fill={accent} />
      <text x={150} y={386} textAnchor="middle" fontFamily="Instrument Sans Variable" fontWeight={700} fontSize={11} fill={bg}>
        {sponsor.name}
      </text>
    </svg>
  )
}
