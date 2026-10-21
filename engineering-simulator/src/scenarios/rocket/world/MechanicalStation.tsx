import { PackageCheck, Search, ShoppingCart, Star, Truck, Undo2, Wrench, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { money, uid } from '../../../core/format'
import {
  BLUEPRINT,
  CATEGORY_LABELS,
  getMechanical,
  KIT_PARTS,
  LISTING_BY_ID,
  LISTINGS,
  RESTOCKING_FEE,
  SHIPPING_SECONDS,
  upsert,
  type PartListing,
} from '../config'
import { benchItem, itemTakes, type BenchItem } from '../sim/build'
import type { KitPartId, MechanicalObject, PartCategory, RocketObject, SlotId } from '../types'
import { PartArt } from './PartArt'
import { useNow } from './useNow'
import { play } from '../../../shared/audio/sfx'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as PartCategory[]
const KIT_IDS = Object.keys(KIT_PARTS) as KitPartId[]

function arrivedAt(orderedAt: number) {
  return orderedAt + SHIPPING_SECONDS * 1000
}

/**
 * Mechanical: buy parts on SurplusBay (a made-up online marketplace) with the team's money, wait
 * for the parcels, then build the rocket on the blueprint by dragging parts into its slots.
 */
export function MechanicalStation({
  design,
  locked,
  onCommit,
  funds,
  spent,
}: {
  design: RocketObject[]
  locked: boolean
  onCommit(next: RocketObject[]): void
  funds: number
  spent: number
}) {
  const mech = getMechanical(design)
  const [view, setView] = useState<'shop' | 'bench'>('shop')
  // Ticks while the team has orders, so parcels arrive on screen.
  const now = useNow(mech.orders.some((o) => !o.returned))
  const arrived = mech.orders.filter((o) => !o.returned && arrivedAt(o.orderedAt) <= now)
  const shipping = mech.orders.filter((o) => !o.returned && arrivedAt(o.orderedAt) > now)

  const save = (next: MechanicalObject) => onCommit(upsert(design, { ...next, updatedAt: mech.updatedAt + 1 }))

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <Tab active={view === 'shop'} onClick={() => setView('shop')} icon={ShoppingCart} label="SurplusBay" />
        <Tab
          active={view === 'bench'}
          onClick={() => setView('bench')}
          icon={Wrench}
          label="Workbench"
          badge={arrived.filter((o) => !Object.values(mech.placements).includes(o.id)).length || undefined}
        />
        {shipping.length > 0 && (
          <span className="ml-2 flex items-center gap-1.5 rounded-full bg-[#fbf3df] px-3 py-1 text-xs font-semibold text-[#8a5d00]">
            <Truck className="size-3.5" /> {shipping.length} parcel{shipping.length > 1 ? 's' : ''} on the way
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {view === 'shop' ? (
          <Shop mech={mech} locked={locked} funds={funds} spent={spent} onSave={save} />
        ) : (
          <Bench mech={mech} locked={locked} now={now} arrived={arrived.map((o) => o.id)} shipping={shipping} onSave={save} />
        )}
      </div>
    </div>
  )
}

function Tab({ active, onClick, icon: Icon, label, badge }: { active: boolean; onClick(): void; icon: typeof Wrench; label: string; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-xl px-4 py-2 font-display text-sm font-bold transition ${active ? 'bg-ink text-white' : 'bg-white text-ink/70 ring-1 ring-line hover:text-ink'}`}
    >
      <Icon className="size-4" /> {label}
      {badge !== undefined && <span className="grid size-5 place-items-center rounded-full bg-rust font-mono text-[11px] text-white">{badge}</span>}
    </button>
  )
}

// ---------------------------------------------------------------- shop

function Shop({ mech, locked, funds, spent, onSave }: { mech: MechanicalObject; locked: boolean; funds: number; spent: number; onSave(m: MechanicalObject): void }) {
  const [cat, setCat] = useState<PartCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [justBought, setJustBought] = useState<string | null>(null)
  const left = funds - spent
  const owned = (c: PartCategory) => mech.orders.some((o) => !o.returned && LISTING_BY_ID[o.listingId]?.category === c)

  const shown = LISTINGS.filter((l) => (cat === 'all' || l.category === cat) && (!query || l.title.toLowerCase().includes(query.toLowerCase())))
  const open = openId ? LISTING_BY_ID[openId] : null

  const buy = (l: PartListing) => {
    if (locked) return
    play('coin')
    onSave({ ...mech, orders: [...mech.orders, { id: uid('order'), listingId: l.id, orderedAt: Date.now(), returned: false }] })
    setJustBought(l.id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      {/* Fake browser chrome */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-paper px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-3 rounded-full bg-[#e0a093]" />
          <span className="size-3 rounded-full bg-[#e8cf8a]" />
          <span className="size-3 rounded-full bg-[#a9cf9a]" />
        </div>
        <span className="font-display text-lg font-extrabold tracking-tight">
          <span className="text-rust">Surplus</span>
          <span className="text-forest">Bay</span>
        </span>
        <label className="flex flex-1 items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-line">
          <Search className="size-4 text-ink/40" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rocket parts" className="w-full bg-transparent text-sm outline-none" />
        </label>
        <div className="text-right leading-tight">
          <div className="text-[11px] text-ink/55">Team money left</div>
          <div className={`font-mono text-sm font-bold ${left < 0 ? 'text-rust' : 'text-forest'}`}>{money(left)}</div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="w-52 shrink-0 space-y-1 overflow-y-auto border-r border-line p-3">
          <CatButton active={cat === 'all'} onClick={() => setCat('all')} label="All parts" />
          {CATEGORIES.map((c) => (
            <CatButton key={c} active={cat === c} onClick={() => setCat(c)} label={CATEGORY_LABELS[c]} done={owned(c)} />
          ))}
          <div className="mt-4 rounded-xl bg-paper p-3 text-xs text-ink/65">
            <div className="mb-1 font-semibold text-ink">Already in the team's box</div>
            {KIT_IDS.map((k) => (
              <div key={k}>• {KIT_PARTS[k].label}</div>
            ))}
          </div>
        </nav>

        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3 overflow-y-auto p-4">
          {shown.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setOpenId(l.id)}
              className={`flex flex-col rounded-xl p-3 text-left ring-1 transition hover:shadow-md ${openId === l.id ? 'ring-2 ring-forest' : 'ring-line'}`}
            >
              <div className="grid h-24 place-items-center rounded-lg bg-paper">
                <PartArt takes={l.category} listingId={l.id} className="size-16" />
              </div>
              <div className="mt-2 line-clamp-2 min-h-[2.5em] text-sm font-semibold leading-tight">{l.title}</div>
              <div className="mt-1 text-[11px] text-ink/55">{l.condition}</div>
              <div className="mt-auto flex items-end justify-between pt-2">
                <span className="font-mono text-lg font-bold">{money(l.price)}</span>
                <span className="flex items-center gap-0.5 text-[11px] text-ink/55">
                  <Star className="size-3 fill-sun text-sun" /> {l.rating}%
                </span>
              </div>
            </button>
          ))}
        </div>

        {open && (
          <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-line p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink/65">{CATEGORY_LABELS[open.category]}</span>
              <button type="button" onClick={() => setOpenId(null)} className="text-ink/40 hover:text-ink">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-2 grid h-36 place-items-center rounded-xl bg-paper">
              <PartArt takes={open.category} listingId={open.id} className="size-24" />
            </div>
            <h3 className="mt-3 font-display text-lg font-bold leading-snug">{open.title}</h3>
            <div className="mt-1 text-xs text-ink/60">
              Condition: <strong>{open.condition}</strong> · Seller {open.seller} ({open.rating}% positive)
            </div>
            <div className="mt-3 rounded-xl bg-paper p-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink/50">Item specifics</div>
              <ul className="space-y-0.5 text-sm">
                {open.specs.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-sm italic text-ink/65">“{open.sellerNote}”</p>
            <div className="mt-auto pt-4">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-2xl font-bold">{money(open.price)}</span>
                <span className="text-xs text-ink/55">Free shipping · arrives in {SHIPPING_SECONDS} s</span>
              </div>
              {open.price > left && <div className="mt-1 text-xs font-semibold text-rust">This costs more than the team has left.</div>}
              <button
                type="button"
                disabled={locked}
                onClick={() => buy(open)}
                className="btn-press mt-2 w-full rounded-xl bg-forest py-3 font-display font-bold text-white disabled:opacity-50"
              >
                Buy It Now
              </button>
              {justBought === open.id && <div className="mt-2 text-center text-xs font-semibold text-forest">Ordered! It ships to the workbench.</div>}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function CatButton({ active, onClick, label, done }: { active: boolean; onClick(): void; label: string; done?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold ${active ? 'bg-mint text-forest' : 'text-ink/70 hover:bg-paper'}`}
    >
      {label}
      {done && <PackageCheck className="size-4 text-forest" />}
    </button>
  )
}

// ---------------------------------------------------------------- workbench

function Bench({
  mech,
  locked,
  now,
  arrived,
  shipping,
  onSave,
}: {
  mech: MechanicalObject
  locked: boolean
  now: number
  arrived: string[]
  shipping: MechanicalObject['orders']
  onSave(m: MechanicalObject): void
}) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const placed = new Set(Object.values(mech.placements))
  const loose = [...KIT_IDS, ...arrived].filter((id) => !placed.has(id))

  const place = (slot: SlotId, itemId: string) => {
    const placements = { ...mech.placements }
    for (const [s, v] of Object.entries(placements) as [SlotId, string][]) if (v === itemId) delete placements[s]
    placements[slot] = itemId
    play('place')
    onSave({ ...mech, placements })
  }
  const unplace = (slot: SlotId) => {
    const placements = { ...mech.placements }
    delete placements[slot]
    play('remove')
    onSave({ ...mech, placements })
  }
  const giveBack = (orderId: string) => {
    play('remove')
    onSave({ ...mech, orders: mech.orders.map((o) => (o.id === orderId ? { ...o, returned: true } : o)) })
  }

  const startDrag = (e: ReactPointerEvent, id: string) => {
    if (locked || e.button !== 0) return
    e.preventDefault()
    setDrag({ id, x: e.clientX, y: e.clientY })
  }

  // The drop handler always sees the latest design.
  const placeRef = useRef(place)
  useEffect(() => {
    placeRef.current = place
  })
  const dragId = drag?.id ?? null
  useEffect(() => {
    if (!dragId) return
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
    const up = (e: PointerEvent) => {
      const slot = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-slot]')?.getAttribute('data-slot') as SlotId | null
      if (slot) placeRef.current(slot, dragId)
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragId])

  const dragItem = drag ? benchItem(mech, drag.id) : null

  return (
    <div className="flex h-full min-h-0 gap-4">
      <Blueprint mech={mech} locked={locked} dragging={!!drag} onStartDrag={startDrag} onRemove={unplace} />

      <aside className="flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h3 className="font-display text-sm font-bold">On your bench</h3>
          <p className="text-xs text-ink/55">Drag a part onto the blueprint.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {loose.map((id) => {
              const item = benchItem(mech, id)
              if (!item) return null
              return (
                <div key={id} className="group relative">
                  <div
                    onPointerDown={(e) => startDrag(e, id)}
                    className={`flex cursor-grab touch-none flex-col items-center rounded-xl bg-paper p-2 text-center ring-1 ring-line hover:ring-forest ${drag?.id === id ? 'opacity-30' : ''}`}
                  >
                    <PartArt takes={itemTakes(item)} listingId={item.kind === 'part' ? item.listing.id : undefined} className="size-12" />
                    <span className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight">{itemName(item)}</span>
                  </div>
                  {item.kind === 'part' && (
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => giveBack(id)}
                      title={`Send back for a refund (the shop keeps ${money(RESTOCKING_FEE)})`}
                      className="absolute right-1 top-1 hidden rounded-md bg-white p-1 text-ink/50 shadow ring-1 ring-line hover:text-rust group-hover:block"
                    >
                      <Undo2 className="size-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
            {loose.length === 0 && <p className="col-span-2 text-xs text-ink/45">Nothing loose on the bench.</p>}
          </div>
        </section>

        {shipping.length > 0 && (
          <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold">
              <Truck className="size-4" /> On the way
            </h3>
            <ul className="mt-2 space-y-2">
              {shipping.map((o) => {
                const l = LISTING_BY_ID[o.listingId]
                const pct = Math.min(100, ((now - o.orderedAt) / (SHIPPING_SECONDS * 1000)) * 100)
                return (
                  <li key={o.id} className="text-xs">
                    <div className="flex justify-between">
                      <span className="truncate pr-2">{l.title}</span>
                      <span className="font-mono text-ink/55">{Math.max(0, Math.ceil((arrivedAt(o.orderedAt) - now) / 1000))} s</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full bg-sun transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </aside>

      {drag && dragItem && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-2 shadow-2xl ring-2 ring-forest" style={{ left: drag.x, top: drag.y }}>
          <PartArt takes={itemTakes(dragItem)} listingId={dragItem.kind === 'part' ? dragItem.listing.id : undefined} className="size-12" />
        </div>
      )}
    </div>
  )
}

function itemName(item: BenchItem) {
  return item.kind === 'kit' ? item.label : item.listing.title
}

/** The blueprint: a green engineering drawing with one drop zone per part, nose to tail. */
function Blueprint({
  mech,
  locked,
  dragging,
  onStartDrag,
  onRemove,
}: {
  mech: MechanicalObject
  locked: boolean
  dragging: boolean
  onStartDrag(e: ReactPointerEvent, id: string): void
  onRemove(slot: SlotId): void
}) {
  const slot = (id: SlotId, className: string) => {
    const spec = BLUEPRINT.find((b) => b.id === id)!
    const itemId = mech.placements[id]
    const item = itemId ? benchItem(mech, itemId) : null
    return (
      <div
        data-slot={id}
        className={`relative flex items-center gap-2 rounded-lg border-2 px-2 transition ${
          item ? 'border-white/70 bg-white/95 text-ink' : `border-dashed border-white/50 text-white/80 ${dragging ? 'bg-white/15' : ''}`
        } ${className}`}
      >
        {item ? (
          <>
            <div onPointerDown={(e) => onStartDrag(e, itemId!)} className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2">
              <PartArt takes={itemTakes(item)} listingId={item.kind === 'part' ? item.listing.id : undefined} className="size-9 shrink-0" />
              <span className="truncate text-xs font-semibold">{itemName(item)}</span>
            </div>
            {!locked && (
              <button type="button" onClick={() => onRemove(id)} className="text-ink/40 hover:text-rust" title="Take it off">
                <X className="size-3.5" />
              </button>
            )}
          </>
        ) : (
          <span className="w-full text-center font-mono text-[11px] font-semibold uppercase tracking-wider">{spec.label}</span>
        )}
      </div>
    )
  }

  return (
    <div
      className="relative flex min-w-0 flex-1 items-center justify-center overflow-auto rounded-3xl p-6"
      style={{
        backgroundColor: '#1d4029',
        backgroundImage: 'linear-gradient(#ffffff14 1px, transparent 1px), linear-gradient(90deg, #ffffff14 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="absolute left-5 top-4 font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Blueprint · Rocket assembly · Nose ▲</div>
      <div className="relative flex w-[420px] flex-col items-center">
        {/* Nose */}
        <svg viewBox="0 0 200 70" className="h-[62px] w-[200px]">
          <path d="M40 70 Q60 10 100 2 Q140 10 160 70" fill="none" stroke="#ffffffaa" strokeWidth={2} strokeDasharray="6 4" />
        </svg>
        {slot('nose', '-mt-9 mb-1 h-11 w-[170px]')}
        {/* Body tube outline with its internal parts */}
        <div className="relative w-[230px] rounded-md border-2 border-white/60 px-3 py-3">
          <div className="flex flex-col gap-2">
            {slot('parachute', 'h-12')}
            {slot('shockCord', 'h-12')}
            {slot('avionics', 'h-12')}
            {slot('motor', 'h-14')}
          </div>
          <div className="absolute -right-[188px] top-1/2 w-[172px] -translate-y-1/2">
            <div className="mb-1 text-center font-mono text-[10px] uppercase tracking-wider text-white/60">← outer tube</div>
            {slot('body', 'h-14')}
          </div>
        </div>
        {/* Fins */}
        <svg viewBox="0 0 300 40" className="-mt-12 h-[40px] w-[300px]">
          <path d="M35 0 L5 40 L35 40 Z M265 0 L295 40 L265 40 Z" fill="none" stroke="#ffffffaa" strokeWidth={2} strokeDasharray="6 4" />
        </svg>
        {slot('fins', 'mt-3 h-12 w-[230px]')}
        <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Tail ▼</div>
      </div>
    </div>
  )
}
