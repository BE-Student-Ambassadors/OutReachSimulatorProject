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
    case 'rocket':
      return (
        <g>
          <path d="M0 -70 Q22 -40 22 10 L22 40 L-22 40 L-22 10 Q-22 -40 0 -70 Z" fill={light} stroke={color} strokeWidth={4} />
          <circle cx={0} cy={-10} r={10} fill={color} />
          <path d="M-22 20 L-42 50 L-22 44 Z M22 20 L42 50 L22 44 Z" fill={color} />
          <path d="M-12 42 Q0 90 12 42 Z" fill="#ef7d22" />
        </g>
      )
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
    case 'mountains':
      return <path d="M-90 50 L-35 -40 L0 10 L35 -60 L95 50 Z" fill={color} stroke={light} strokeWidth={3} />
    case 'food':
      return (
        <g>
          <path d="M-60 -5 Q0 -75 60 -5 Z" fill="#e3a14a" stroke={color} strokeWidth={3} />
          <rect x={-64} y={-4} width={128} height={12} rx={4} fill="#5a8f3c" />
          <rect x={-62} y={8} width={124} height={16} rx={5} fill="#7a3b1e" />
          <path d="M-60 26 L60 26 Q60 46 0 46 Q-60 46 -60 26 Z" fill="#e3a14a" stroke={color} strokeWidth={3} />
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
    case 'wave':
      return <path d="M-95 20 Q-60 -40 -20 10 T60 0 T100 -10 L100 50 L-95 50 Z" fill={color} stroke={light} strokeWidth={3} />
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
