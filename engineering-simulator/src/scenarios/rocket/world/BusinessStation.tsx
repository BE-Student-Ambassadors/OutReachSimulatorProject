import { Brush, Eraser, Handshake, Inbox, Mail, Send, Sparkles, Sticker as StickerIcon, Type, Undo2, Wand2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { money } from '../../../core/format'
import { getBusiness, SPONSOR_BY_ID, SPONSORS, upsert } from '../config'
import { counterReply, effortScore, payoutFor, vibeFlyer } from '../sim/business'
import type { BusinessObject, Deal, RocketObject, SponsorId } from '../types'
import { FlyerArt } from './FlyerArt'
import { FLYER_H, FLYER_W, getPaint, paintStats, undoPaint, updatePaint, usePaintVersion, type Stroke } from './paintStore'

/**
 * Business: read sponsor emails, strike deals (accept or counter once), vibe-design a flyer from a
 * description, decorate it, and send it in. Sponsors pay more for flyers with more work in them.
 */
export function BusinessStation({
  design,
  locked,
  onCommit,
  newSeed,
}: {
  design: RocketObject[]
  locked: boolean
  onCommit(next: RocketObject[]): void
  newSeed(): number
}) {
  const biz = getBusiness(design)
  const [openId, setOpenId] = useState<SponsorId>(SPONSORS[0].id)
  const deal = biz?.deals.find((d) => d.sponsorId === openId) ?? null

  const save = (next: BusinessObject) => onCommit(upsert(design, { ...next, updatedAt: next.updatedAt + 1 }))
  const base = (): BusinessObject => biz ?? { id: 'station:business', kind: 'business', seed: newSeed(), deals: [], updatedAt: 0 }
  const saveDeal = (d: Deal) => {
    const b = base()
    save({ ...b, deals: b.deals.some((x) => x.sponsorId === d.sponsorId) ? b.deals.map((x) => (x.sponsorId === d.sponsorId ? d : x)) : [...b.deals, d] })
  }

  const openEmail = (id: SponsorId) => {
    setOpenId(id)
    if (locked || biz?.deals.some((d) => d.sponsorId === id)) return
    const s = SPONSOR_BY_ID[id]
    saveDeal({ sponsorId: id, stage: 'offer', agreed: 0, offer: s.opening, countered: false, flyer: null, effort: 0, payout: 0 })
  }

  return (
    <div className="flex h-full min-h-0 gap-3">
      <aside className="flex w-[270px] shrink-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 font-display text-sm font-bold">
          <Inbox className="size-4" /> Sponsor inbox
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {SPONSORS.map((s) => {
            const d = biz?.deals.find((x) => x.sponsorId === s.id)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => openEmail(s.id)}
                  className={`flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left ${openId === s.id && d ? 'bg-mint' : 'hover:bg-paper'}`}
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold text-white" style={{ backgroundColor: s.brandColor }}>
                    {s.name[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${d ? 'font-semibold' : 'font-bold'}`}>{s.name}</span>
                    <span className="block truncate text-xs text-ink/55">Sponsorship for your rocket team</span>
                  </span>
                  <StageChip deal={d ?? null} />
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto rounded-2xl bg-white p-5 ring-1 ring-line">
        {!deal ? (
          <div className="grid h-full place-items-center text-center text-ink/50">
            <div>
              <Mail className="mx-auto size-10" />
              <p className="mt-2 text-sm">Open a sponsor's email to read their offer.</p>
            </div>
          </div>
        ) : deal.stage === 'offer' || deal.stage === 'declined' ? (
          <Negotiate deal={deal} seed={biz!.seed} locked={locked} onSave={saveDeal} />
        ) : (
          <Studio deal={deal} locked={locked} onSave={saveDeal} />
        )}
      </div>
    </div>
  )
}

function StageChip({ deal }: { deal: Deal | null }) {
  if (!deal) return <span className="mt-1 size-2.5 rounded-full bg-rust" title="Unread" />
  const [label, cls] =
    deal.stage === 'paid'
      ? [`+${money(deal.payout)}`, 'bg-mint text-forest']
      : deal.stage === 'design'
        ? ['Flyer', 'bg-[#fbf3df] text-[#8a5d00]']
        : deal.stage === 'declined'
          ? ['No deal', 'bg-paper text-ink/45']
          : ['Offer', 'bg-paper text-ink/65']
  return <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${cls}`}>{label}</span>
}

function Negotiate({ deal, seed, locked, onSave }: { deal: Deal; seed: number; locked: boolean; onSave(d: Deal): void }) {
  const s = SPONSOR_BY_ID[deal.sponsorId]
  const [ask, setAsk] = useState(Math.round(deal.offer * 1.3))
  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-xs text-ink/50">From: {s.contact}, {s.name}</div>
      <h2 className="mt-1 font-display text-2xl font-bold">Sponsoring your rocket team</h2>
      <div className="mt-4 rounded-2xl bg-paper p-4 text-sm leading-relaxed">
        <p>Hi rocket team,</p>
        <p className="mt-2">{s.pitch}</p>
        <p className="mt-2">
          We can offer <strong>{money(s.opening)}</strong> for one flyer. The better the flyer, the more we'll pay on delivery.
        </p>
      </div>

      {deal.countered && deal.stage === 'offer' && (
        <div className="mt-3 rounded-2xl bg-[#fbf3df] p-4 text-sm">
          <strong>{s.contact.split(',')[0]}:</strong> That's more than we can do. Our final offer is <strong>{money(deal.offer)}</strong>.
        </div>
      )}
      {deal.stage === 'declined' && (
        <div className="mt-3 rounded-2xl bg-paper p-4 text-sm text-ink/70">
          <strong>{s.contact.split(',')[0]}:</strong> We're too far apart on price. Good luck with the launch!
        </div>
      )}

      {deal.stage === 'offer' && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <button
            type="button"
            disabled={locked}
            onClick={() => onSave({ ...deal, stage: 'design', agreed: deal.offer })}
            className="btn-press flex items-center gap-2 rounded-xl bg-forest px-5 py-3 font-display font-bold text-white disabled:opacity-50"
          >
            <Handshake className="size-4" /> Accept {money(deal.offer)}
          </button>
          {!deal.countered ? (
            <div className="flex items-end gap-2 rounded-xl p-2 ring-1 ring-line">
              <label className="text-xs text-ink/60">
                Counter-offer
                <div className="mt-1 flex items-center rounded-lg bg-paper px-2 ring-1 ring-line">
                  <span className="text-ink/50">$</span>
                  <input
                    type="number"
                    min={1}
                    value={ask}
                    onChange={(e) => setAsk(Math.max(1, Math.round(Number(e.target.value) || 0)))}
                    className="w-20 bg-transparent px-1 py-2 font-mono text-sm outline-none"
                  />
                </div>
              </label>
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  const reply = counterReply(seed, deal.sponsorId, ask)
                  if (reply.kind === 'accepted') onSave({ ...deal, countered: true, stage: 'design', agreed: reply.amount, offer: reply.amount })
                  else if (reply.kind === 'final-offer') onSave({ ...deal, countered: true, offer: reply.amount })
                  else onSave({ ...deal, countered: true, stage: 'declined' })
                }}
                className="rounded-lg bg-ink px-4 py-2.5 font-display text-sm font-bold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={locked}
              onClick={() => onSave({ ...deal, stage: 'declined' })}
              className="rounded-xl px-4 py-3 text-sm font-semibold text-ink/70 ring-1 ring-line hover:bg-paper"
            >
              Walk away
            </button>
          )}
        </div>
      )}
      {deal.stage === 'offer' && !deal.countered && <p className="mt-2 text-xs text-ink/50">You get one counter-offer per sponsor.</p>}
    </div>
  )
}

const COLORS = ['#1b2a20', '#ffffff', '#d33a2c', '#ef7d22', '#f2c230', '#2f7a46', '#8fd14f', '#7b4cc0', '#e0559a', '#7a4e2d']
const STICKERS = ['🚀', '⭐', '🔥', '🪐', '✨', '💥', '🌙', '🏆']
type Tool = 'brush' | 'eraser' | 'sticker' | 'text'

function Studio({ deal, locked, onSave }: { deal: Deal; locked: boolean; onSave(d: Deal): void }) {
  usePaintVersion()
  const s = SPONSOR_BY_ID[deal.sponsorId]
  const paint = getPaint(deal.sponsorId)
  const [prompt, setPrompt] = useState(deal.flyer?.prompt ?? '')
  const [tool, setTool] = useState<Tool>('brush')
  const [color, setColor] = useState(COLORS[2])
  const [size, setSize] = useState(8)
  const [sticker, setSticker] = useState(STICKERS[0])
  const [text, setText] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<Stroke | null>(null)
  const paid = deal.stage === 'paid'

  const stats = paintStats(paint, deal.flyer?.prompt ?? prompt)
  const effort = paid ? deal.effort : effortScore(stats)
  const estimate = paid ? deal.payout : payoutFor(deal.agreed, effort)

  // Redraw the paint layer whenever it changes.
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, FLYER_W, FLYER_H)
    const all = drawing.current ? [...paint.strokes, drawing.current] : paint.strokes
    for (const st of all) {
      ctx.globalCompositeOperation = st.erase ? 'destination-out' : 'source-over'
      ctx.strokeStyle = st.color
      ctx.lineWidth = st.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      st.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      if (st.points.length === 1) ctx.lineTo(st.points[0][0] + 0.1, st.points[0][1])
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  })

  const pos = (e: ReactPointerEvent): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * FLYER_W, ((e.clientY - r.top) / r.height) * FLYER_H]
  }

  const redrawNow = () => updatePaint(deal.sponsorId, (p) => ({ ...p }))

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (locked || paid || !deal.flyer) return
    const [x, y] = pos(e)
    if (tool === 'sticker') {
      updatePaint(deal.sponsorId, (p) => ({ ...p, stickers: [...p.stickers, { emoji: sticker, x, y, size: 26 + size * 1.5 }], history: [...p.history, 'sticker'] }))
      return
    }
    if (tool === 'text') {
      if (!text.trim()) return
      updatePaint(deal.sponsorId, (p) => ({ ...p, texts: [...p.texts, { text: text.trim(), x, y, color, size: 12 + size }], history: [...p.history, 'text'] }))
      setText('')
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = { color, size: tool === 'eraser' ? size * 2 : size, erase: tool === 'eraser', points: [[x, y]] }
    redrawNow()
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawing.current) return
    drawing.current.points.push(pos(e))
    redrawNow()
  }
  const onUp = () => {
    const st = drawing.current
    if (!st) return
    drawing.current = null
    updatePaint(deal.sponsorId, (p) => ({ ...p, strokes: [...p.strokes, st], history: [...p.history, 'stroke'] }))
  }

  const generate = () => {
    if (locked || !prompt.trim()) return
    updatePaint(deal.sponsorId, (p) => ({ ...p, generations: p.generations + 1 }))
    onSave({ ...deal, flyer: vibeFlyer(prompt.trim(), deal.sponsorId) })
  }

  return (
    <div className="flex gap-5">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-ink/50">Deal with {s.name}</div>
        <h2 className="font-display text-xl font-bold">{paid ? `Flyer delivered: ${money(deal.payout)} paid` : `Design their flyer (agreed ${money(deal.agreed)})`}</h2>

        {!paid && (
          <>
            <label className="mt-3 block text-sm font-semibold">
              Describe the flyer you want
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder={`e.g. a bold space poster with stars and a rocket, black and gold, that says "${s.name} takes us higher"`}
                className="mt-1 w-full resize-none rounded-xl bg-paper p-3 text-sm font-normal outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
              />
            </label>
            <button
              type="button"
              disabled={locked || !prompt.trim()}
              onClick={generate}
              className="btn-press mt-2 flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 font-display text-sm font-bold text-white disabled:opacity-40"
            >
              <Wand2 className="size-4" /> {deal.flyer ? 'Generate again' : 'Generate flyer'}
            </button>
            <p className="mt-1 text-xs text-ink/50">Colors, pictures (rocket, stars, sun, food…), layouts (poster, banner, badge) and "quoted words" all change the result.</p>
          </>
        )}

        {deal.flyer && !paid && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <ToolBtn active={tool === 'brush'} onClick={() => setTool('brush')} icon={Brush} label="Brush" />
              <ToolBtn active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={Eraser} label="Eraser" />
              <ToolBtn active={tool === 'sticker'} onClick={() => setTool('sticker')} icon={StickerIcon} label="Stickers" />
              <ToolBtn active={tool === 'text'} onClick={() => setTool('text')} icon={Type} label="Text" />
              <button type="button" onClick={() => undoPaint(deal.sponsorId)} disabled={!paint.history.length} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-line hover:bg-paper disabled:opacity-40">
                <Undo2 className="size-3.5" /> Undo
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`size-7 rounded-full ring-1 ring-line ${color === c ? 'outline outline-2 outline-offset-2 outline-forest' : ''}`} style={{ backgroundColor: c }} aria-label={c} />
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-ink/60">
              Size
              {[4, 8, 16].map((n) => (
                <button key={n} type="button" onClick={() => setSize(n)} className={`grid size-8 place-items-center rounded-lg ring-1 ${size === n ? 'bg-mint ring-forest' : 'ring-line'}`}>
                  <span className="rounded-full bg-ink" style={{ width: n / 1.4 + 2, height: n / 1.4 + 2 }} />
                </button>
              ))}
            </div>
            {tool === 'sticker' && (
              <div className="flex flex-wrap gap-1">
                {STICKERS.map((st) => (
                  <button key={st} type="button" onClick={() => setSticker(st)} className={`grid size-9 place-items-center rounded-lg text-xl ring-1 ${sticker === st ? 'bg-mint ring-forest' : 'ring-line'}`}>
                    {st}
                  </button>
                ))}
              </div>
            )}
            {tool === 'text' && (
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type, then click the flyer to place it"
                className="w-full rounded-lg bg-paper px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-forest"
              />
            )}
          </div>
        )}

        {deal.flyer && (
          <div className="mt-5 rounded-2xl bg-paper p-4 ring-1 ring-line">
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="size-4 text-sun" /> Flyer effort
              </span>
              <span className="font-mono text-sm font-bold">{Math.round(effort * 100)}%</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-line">
              <div className="h-full rounded-full bg-gradient-to-r from-sun to-leaf transition-[width]" style={{ width: `${effort * 100}%` }} />
            </div>
            <div className="mt-2 flex items-baseline justify-between text-sm">
              <span className="text-ink/60">{paid ? 'Paid' : 'Payment if you send it now'}</span>
              <span className="font-mono text-lg font-bold text-forest">{money(estimate)}</span>
            </div>
            {!paid && (
              <p className="mt-1 text-xs text-ink/55">
                Sponsors pay {money(payoutFor(deal.agreed, 0))}–{money(payoutFor(deal.agreed, 1))} depending on how much work went into the flyer: brush strokes,
                colors, stickers, text, and a detailed description.
              </p>
            )}
            {!paid && (
              <button
                type="button"
                disabled={locked}
                onClick={() => onSave({ ...deal, stage: 'paid', effort, payout: estimate })}
                className="btn-press mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3 font-display font-bold text-white disabled:opacity-50"
              >
                <Send className="size-4" /> Send flyer to {s.name}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0">
        {deal.flyer ? (
          <div
            className={`relative overflow-hidden rounded-lg shadow-xl ring-1 ring-black/10 ${paid ? '' : tool === 'text' || tool === 'sticker' ? 'cursor-copy' : 'cursor-crosshair'}`}
            style={{ width: FLYER_W, height: FLYER_H, touchAction: 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <FlyerArt spec={deal.flyer} sponsorId={deal.sponsorId} />
            <canvas ref={canvas} width={FLYER_W} height={FLYER_H} className="pointer-events-none absolute inset-0" />
            {paint.stickers.map((st, i) => (
              <span key={i} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none" style={{ left: st.x, top: st.y, fontSize: st.size }}>
                {st.emoji}
              </span>
            ))}
            {paint.texts.map((t, i) => (
              <span
                key={i}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-display font-extrabold"
                style={{ left: t.x, top: t.y, color: t.color, fontSize: t.size }}
              >
                {t.text}
              </span>
            ))}
          </div>
        ) : (
          <div className="grid place-items-center rounded-lg border-2 border-dashed border-line text-center text-sm text-ink/45" style={{ width: FLYER_W, height: FLYER_H }}>
            Your flyer appears here
          </div>
        )}
      </div>
    </div>
  )
}

function ToolBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick(): void; icon: typeof Brush; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${active ? 'bg-ink text-white ring-ink' : 'ring-line hover:bg-paper'}`}>
      <Icon className="size-3.5" /> {label}
    </button>
  )
}
