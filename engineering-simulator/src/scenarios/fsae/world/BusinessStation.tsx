import { Battery, Bot, Check, Disc3, Flag, Handshake, Heart, Megaphone, Pizza, School, TrafficCone, Trophy, Users, Wrench, X } from 'lucide-react'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { money } from '../../../core/format'
import { getBusiness, SEED_FUNDS, SPONSORS, STORY_BEATS, TOYS, upsert, type SponsorSpec } from '../config'
import { designCost } from '../cost'
import { fundsRaised, offerFor, panelDone, sponsorInterest } from '../sim/business'
import type { BusinessObject, FsaeObject, SponsorDeal, StoryPanel, ToyId, ToyPlacement } from '../types'

const TOY_ICON: Record<Exclude<ToyId, 'car'>, { icon: ComponentType<{ className?: string; strokeWidth?: number }>; bg: string }> = {
  trophy: { icon: Trophy, bg: '#d9a52b' },
  cone: { icon: TrafficCone, bg: '#ef7d22' },
  flag: { icon: Flag, bg: '#1b2a20' },
  tire: { icon: Disc3, bg: '#3a3f3c' },
  battery: { icon: Battery, bg: '#74a85f' },
  robot: { icon: Bot, bg: '#7c4dbd' },
  school: { icon: School, bg: '#b8461b' },
  crowd: { icon: Users, bg: '#cf4f86' },
  pizza: { icon: Pizza, bg: '#e0a030' },
  wrench: { icon: Wrench, bg: '#6b7570' },
  heart: { icon: Heart, bg: '#d33a2c' },
}

export function ToyArt({ toy, size = 40, zoom = false }: { toy: ToyId; size?: number; zoom?: boolean }) {
  if (toy === 'car') {
    return (
      <svg width={size * 1.6} height={size * 0.8} viewBox="0 0 80 40" style={zoom ? { animation: 'fsae-zoom 0.9s ease-in' } : undefined}>
        <rect x="10" y="18" width="52" height="10" rx="4" fill="#2c5b3c" />
        <path d="M60 20 L76 25 L60 28 Z" fill="#2c5b3c" />
        <rect x="70" y="27" width="8" height="3" fill="#f4f3ec" />
        <rect x="2" y="8" width="12" height="3" fill="#f4f3ec" />
        <rect x="8" y="10" width="2" height="9" fill="#3a3f3c" />
        <circle cx="34" cy="16" r="5" fill="#f4f3ec" />
        <rect x="20" y="21" width="40" height="2" fill="#f4f3ec" />
        <circle cx="18" cy="30" r="7" fill="#1c1f1d" />
        <circle cx="18" cy="30" r="3" fill="#c9ccc8" />
        <circle cx="58" cy="30" r="6" fill="#1c1f1d" />
        <circle cx="58" cy="30" r="2.5" fill="#c9ccc8" />
      </svg>
    )
  }
  const t = TOY_ICON[toy]
  return (
    <span className="grid place-items-center rounded-full text-white shadow-md ring-2 ring-white" style={{ width: size, height: size, background: t.bg }}>
      <t.icon className="size-[55%]" strokeWidth={2.2} />
    </span>
  )
}

export function BusinessStation({ design, locked, onCommit }: { design: FsaeObject[]; locked: boolean; onCommit(next: FsaeObject[]): void }) {
  const biz = getBusiness(design)
  const [active, setActive] = useState(0)
  const [pitching, setPitching] = useState<SponsorSpec | null>(null)
  const save = (next: BusinessObject) => onCommit(upsert(design, next))
  const setPanel = (i: number, p: StoryPanel) => save({ ...biz, panels: biz.panels.map((x, j) => (j === i ? p : x)) })

  const cost = designCost(design)
  const raised = fundsRaised(biz)
  const funds = SEED_FUNDS + raised

  return (
    <div className="flex h-full min-h-0 gap-3">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-2xl bg-[#efe4cf] p-3 ring-1 ring-[#d9c8a6]">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h3 className="font-display text-lg font-bold text-ink">Your team’s story</h3>
          <span className="text-xs text-ink/60">Click a panel, add toys from the toy box, drag them around, write what happens.</span>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3">
          {biz.panels.map((p, i) => (
            <StoryPanelCard key={`${i}:${p.caption}`} index={i} panel={p} active={active === i} locked={locked} onFocus={() => setActive(i)} onChange={(np) => setPanel(i, np)} />
          ))}
        </div>
      </div>

      <div className="flex w-[300px] shrink-0 flex-col gap-2.5 overflow-y-auto overscroll-contain">
        <div className="rounded-2xl bg-white p-3 ring-1 ring-line">
          <h3 className="font-display text-[15px] font-bold">Toy box</h3>
          <p className="text-xs text-ink/60">Adds to panel {active + 1}: {STORY_BEATS[active].title}</p>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {TOYS.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                disabled={locked || biz.panels[active].toys.length >= 6}
                onClick={() => {
                  const p = biz.panels[active]
                  const n = p.toys.length
                  setPanel(active, { ...p, toys: [...p.toys, { toy: t.id, x: 0.2 + ((n * 0.27) % 0.65), y: 0.35 + (n % 2) * 0.3, flip: false }] })
                }}
                className="grid h-11 place-items-center rounded-lg bg-paper ring-1 ring-line transition hover:-translate-y-0.5 hover:bg-white disabled:opacity-40"
              >
                <ToyArt toy={t.id} size={t.id === 'car' ? 20 : 28} />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3 ring-1 ring-line">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-[15px] font-bold">Team money</h3>
            <span className={`font-mono text-sm font-bold ${funds >= cost ? 'text-forest' : 'text-rust'}`}>{money(funds)}</span>
          </div>
          <div className="mt-1 space-y-0.5 font-mono text-[11px] text-ink/65">
            <div className="flex justify-between">
              <span>School starting money</span>
              <span>{money(SEED_FUNDS)}</span>
            </div>
            <div className="flex justify-between">
              <span>From sponsors</span>
              <span>{money(raised)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-0.5 text-ink">
              <span>Car costs right now</span>
              <span>{money(cost)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3 ring-1 ring-line">
          <h3 className="font-display text-[15px] font-bold">Sponsors</h3>
          <div className="mt-2 space-y-2">
            {SPONSORS.map((s) => {
              const deal = biz.deals.find((d) => d.sponsorId === s.id)
              return (
                <div key={s.id} className="rounded-xl bg-paper p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: s.brandColor }} />
                    <span className="flex-1 font-display text-[14px] font-bold leading-tight">{s.name}</span>
                    <span className="font-mono text-[10px] text-ink/50">up to {money(s.maxOffer)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink/60">
                    {s.industry} · cares about {s.cares.toLowerCase()}
                  </div>
                  {deal?.accepted ? (
                    <div className="mt-1.5 flex items-center gap-1 rounded-lg bg-mint px-2 py-1 text-xs font-bold text-forest">
                      <Handshake className="size-3.5" /> Signed: {money(deal.offer)}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => setPitching(s)}
                      className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-xs font-bold text-ink ring-1 ring-line hover:bg-mint disabled:opacity-40"
                    >
                      <Megaphone className="size-3.5" /> {deal ? `Pitch again (last offer ${money(deal.offer)})` : 'Pitch your story'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {pitching && (
        <PitchModal
          biz={biz}
          sponsor={pitching}
          onClose={() => setPitching(null)}
          onDecide={(deal) => {
            save({ ...biz, deals: [...biz.deals.filter((d) => d.sponsorId !== deal.sponsorId), deal] })
            setPitching(null)
          }}
        />
      )}
    </div>
  )
}

function StoryPanelCard({ index, panel, active, locked, onFocus, onChange }: { index: number; panel: StoryPanel; active: boolean; locked: boolean; onFocus(): void; onChange(p: StoryPanel): void }) {
  const beat = STORY_BEATS[index]
  const scene = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ i: number; x: number; y: number; moved: boolean } | null>(null)
  const [caption, setCaption] = useState(panel.caption)
  const [zooming, setZooming] = useState<number | null>(null)
  const done = panelDone(panel)
  const toys: ToyPlacement[] = panel.toys.map((t, i) => (drag?.i === i ? { ...t, x: drag.x, y: drag.y } : t))

  return (
    <div
      onPointerDown={onFocus}
      className={`flex min-h-[220px] flex-col rounded-xl bg-white p-2.5 shadow-sm transition ${active ? 'ring-2 ring-forest' : 'ring-1 ring-[#d9c8a6]'}`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`grid size-5 place-items-center rounded-full font-mono text-[11px] font-bold ${done ? 'bg-forest text-white' : 'bg-paper text-ink/60 ring-1 ring-line'}`}>
          {done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
        </span>
        <span className="font-display text-[14px] font-bold">{beat.title}</span>
        <span className="truncate text-[11px] text-ink/50">{beat.prompt}</span>
      </div>
      <div
        ref={scene}
        className="relative min-h-[110px] flex-1 overflow-hidden rounded-lg"
        style={{ background: 'linear-gradient(#d8e7ef00, #00000000), repeating-linear-gradient(90deg, #d9b98a 0 46px, #d2b081 46px 92px)' }}
        onPointerMove={(e) => {
          if (!drag || !scene.current) return
          const r = scene.current.getBoundingClientRect()
          setDrag({ ...drag, moved: true, x: Math.max(0.05, Math.min(0.95, (e.clientX - r.left) / r.width)), y: Math.max(0.1, Math.min(0.9, (e.clientY - r.top) / r.height)) })
        }}
        onPointerUp={() => {
          if (!drag) return
          if (drag.moved) onChange({ ...panel, toys: panel.toys.map((t, i) => (i === drag.i ? { ...t, x: drag.x, y: drag.y } : t)) })
          else if (panel.toys[drag.i]?.toy === 'car') {
            // Tap the toy car and it zooms off and comes back.
            setZooming(drag.i)
            window.setTimeout(() => setZooming(null), 900)
          }
          setDrag(null)
        }}
      >
        {toys.length === 0 && <span className="absolute inset-0 grid place-items-center text-xs font-semibold text-[#7a6040]/70">Add toys from the toy box</span>}
        {toys.map((t, i) => (
          <div
            key={i}
            className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing"
            style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, transform: `translate(-50%, -50%) scaleX(${t.flip ? -1 : 1})` }}
            onPointerDown={(e) => {
              if (locked) return
              e.stopPropagation()
              onFocus()
              ;(e.currentTarget.parentElement as HTMLElement).setPointerCapture?.(e.pointerId)
              setDrag({ i, x: t.x, y: t.y, moved: false })
            }}
            onDoubleClick={() => !locked && onChange({ ...panel, toys: panel.toys.map((x, j) => (j === i ? { ...x, flip: !x.flip } : x)) })}
          >
            <ToyArt toy={t.toy} size={34} zoom={zooming === i} />
            {!locked && (
              <button
                type="button"
                aria-label="Remove toy"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onChange({ ...panel, toys: panel.toys.filter((_, j) => j !== i) })}
                className="absolute -right-2 -top-2 hidden size-4 place-items-center rounded-full bg-ink text-white group-hover:grid"
              >
                <X className="size-2.5" strokeWidth={3} />
              </button>
            )}
          </div>
        ))}
      </div>
      <textarea
        value={caption}
        disabled={locked}
        onChange={(e) => setCaption(e.target.value.slice(0, 160))}
        onBlur={() => caption !== panel.caption && onChange({ ...panel, caption })}
        onFocus={onFocus}
        rows={2}
        placeholder="Write what happens in this part of the story…"
        className="mt-1.5 w-full resize-none rounded-lg bg-paper px-2 py-1.5 text-[13px] text-ink ring-1 ring-line outline-none select-text focus:ring-forest"
      />
    </div>
  )
}

function PitchModal({ biz, sponsor, onClose, onDecide }: { biz: BusinessObject; sponsor: SponsorSpec; onClose(): void; onDecide(d: SponsorDeal): void }) {
  const [slide, setSlide] = useState(0)
  const slides = biz.panels.length
  useEffect(() => {
    if (slide >= slides) return
    const t = window.setTimeout(() => setSlide((s) => s + 1), 1300)
    return () => clearTimeout(t)
  }, [slide, slides])
  const interest = sponsorInterest(biz, sponsor.id)
  const offer = offerFor(sponsor.id, interest.score)
  const done = slide >= slides
  const panel = biz.panels[Math.min(slide, slides - 1)]
  const toyLabel = (id: string) => TOYS.find((t) => t.id === id)?.label.toLowerCase()

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-ink/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[560px] animate-pop overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 px-5 py-3" style={{ background: sponsor.brandColor }}>
          <Megaphone className="size-4 text-white" />
          <span className="font-display text-lg font-bold text-white">Pitching to {sponsor.name}</span>
          <button type="button" onClick={onClose} className="ml-auto text-white/80 hover:text-white" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {!done ? (
          <div className="p-5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink/50">
              Slide {slide + 1} of {slides}: {STORY_BEATS[slide].title}
            </div>
            <div className="relative mt-2 h-[170px] overflow-hidden rounded-xl" style={{ background: 'repeating-linear-gradient(90deg, #d9b98a 0 46px, #d2b081 46px 92px)' }}>
              {panel.toys.map((t, i) => (
                <div key={i} className="absolute animate-pop" style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, transform: `translate(-50%, -50%) scaleX(${t.flip ? -1 : 1})` }}>
                  <ToyArt toy={t.toy} size={40} />
                </div>
              ))}
            </div>
            <p className="mt-2 min-h-[40px] text-[15px] italic text-ink/80">{panel.caption ? `“${panel.caption}”` : '(no caption)'}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
              <div className="h-full bg-forest transition-[width] duration-1000" style={{ width: `${((slide + 1) / slides) * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink/50">{sponsor.name} is interested</div>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-paper ring-1 ring-line">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.round(interest.score * 100)}%`, background: sponsor.brandColor }} />
              </div>
              <span className="font-mono text-sm font-bold">{Math.round(interest.score * 100)}%</span>
            </div>
            <p className="mt-2 text-sm text-ink/75">
              {interest.hooks.length
                ? `They noticed: ${interest.hooks.map((h) => toyLabel(h) ?? `“${h}”`).join(', ')}.`
                : `Nothing in the story was about ${sponsor.cares.toLowerCase()}.`}
            </p>
            <div className="mt-4 rounded-xl bg-paper p-4 text-center">
              {offer > 0 ? (
                <>
                  <div className="font-mono text-xs uppercase tracking-wider text-ink/50">Their offer</div>
                  <div className="font-display text-4xl font-extrabold text-forest">{money(offer)}</div>
                </>
              ) : (
                <div className="font-display text-xl font-bold text-ink/70">“Not for us right now. Come back with more of your story.”</div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onDecide({ sponsorId: sponsor.id, offer, interest: interest.score, accepted: false })}
                className="rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-line hover:bg-paper"
              >
                {offer > 0 ? 'Not yet' : 'Close'}
              </button>
              {offer > 0 && (
                <button
                  type="button"
                  onClick={() => onDecide({ sponsorId: sponsor.id, offer, interest: interest.score, accepted: true })}
                  className="btn-press flex items-center gap-2 rounded-xl bg-forest px-5 py-2 text-sm font-bold text-white hover:bg-forest-dark"
                >
                  <Handshake className="size-4" /> Sign the deal
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
