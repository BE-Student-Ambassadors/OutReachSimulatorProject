import { ArrowUp, Battery, MousePointerClick, Trash2 } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { money } from '../../../core/format'
import { COSTS, DIALS, getElectrical, POWER_PATHS, upsert } from '../config'
import { readPath, type PathReading } from '../sim/power'
import type { ElectricalObject, FsaeObject, PowerPart, PowerPartType, PowerPathId } from '../types'
import { Knob } from './controls'

type SlotRef = { path: PowerPathId; slot: 0 | 1 }

const PART_INFO: Record<PowerPartType, { label: string; blurb: string; color: string; cost: number }> = {
  resistor: { label: 'Resistor', blurb: 'Drops voltage: V = I × R. The dial sets R (ohms).', color: '#b8461b', cost: COSTS.resistor },
  booster: { label: 'Voltage booster', blurb: 'Adds voltage. The dial sets how many volts.', color: '#2c5b3c', cost: COSTS.booster },
}

export function ElectricalStation({ design, locked, onCommit }: { design: FsaeObject[]; locked: boolean; onCommit(next: FsaeObject[]): void }) {
  const elec = getElectrical(design)
  const [armed, setArmed] = useState<PowerPartType | null>(null)
  const [selected, setSelected] = useState<SlotRef | null>(null)
  // Live dial value while turning, so the whole schematic reacts before the value is saved.
  const [dialPreview, setDialPreview] = useState<number | null>(null)

  const shown: ElectricalObject =
    selected && dialPreview !== null && elec.slots[selected.path][selected.slot]
      ? withPart(elec, selected, { ...elec.slots[selected.path][selected.slot]!, value: dialPreview })
      : elec

  const save = (next: ElectricalObject) => onCommit(upsert(design, next))

  const place = (ref: SlotRef, type: PowerPartType) => {
    if (locked) return
    save(withPart(elec, ref, { type, value: DIALS[type].start }))
    setSelected(ref)
    setArmed(null)
  }

  const sel = selected ? elec.slots[selected.path][selected.slot] : null
  const selSpec = selected ? POWER_PATHS.find((p) => p.id === selected.path)! : null
  const allOk = POWER_PATHS.every((s) => readPath(elec, s).state === 'ok')

  return (
    <div className="flex h-full min-h-0 gap-3">
      <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl bg-[#fbfaf5] p-3 ring-1 ring-line">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h3 className="font-display text-lg font-bold text-ink">Car wiring</h3>
          <span className="font-mono text-[11px] text-ink/50">Each line: power source → two slots → part</span>
        </div>
        <div className="space-y-2">
          {POWER_PATHS.map((spec) => (
            <PathRow
              key={spec.id}
              reading={readPath(shown, spec)}
              parts={shown.slots[spec.id]}
              armed={armed}
              selected={selected}
              locked={locked}
              onSlot={(slot) => {
                const ref = { path: spec.id, slot }
                if (armed) place(ref, armed)
                else if (elec.slots[spec.id][slot]) setSelected(ref)
              }}
              onDropPart={(slot, type) => place({ path: spec.id, slot }, type)}
            />
          ))}
        </div>
      </div>

      <div className="flex w-[300px] shrink-0 flex-col gap-2.5 overflow-y-auto">
        <div className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
          <h3 className="font-display text-[15px] font-bold">Parts bin</h3>
          <p className="mt-0.5 text-xs text-ink/60">Drag a part onto a slot, or click it and then click a slot.</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {(['resistor', 'booster'] as const).map((t) => (
              <button
                key={t}
                type="button"
                draggable={!locked}
                disabled={locked}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/fsae-part', t)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => setArmed((a) => (a === t ? null : t))}
                className={`flex cursor-grab flex-col items-center gap-1 rounded-xl px-2 py-2.5 ring-1 transition disabled:opacity-40 ${
                  armed === t ? 'bg-mint ring-2 ring-forest' : 'bg-paper ring-line hover:bg-white'
                }`}
              >
                <PartSymbol type={t} size={44} />
                <span className="text-xs font-bold">{PART_INFO[t].label}</span>
                <span className="font-mono text-[11px] text-ink/55">{money(PART_INFO[t].cost)}</span>
              </button>
            ))}
          </div>
          {armed && (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-mint px-2 py-1 text-xs font-semibold text-forest">
              <MousePointerClick className="size-3.5" /> Click a slot to place the {PART_INFO[armed].label.toLowerCase()}.
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
          {sel && selected && selSpec ? (
            <>
              <div className="flex items-center gap-2">
                <PartSymbol type={sel.type} size={30} />
                <div>
                  <div className="font-display text-[15px] font-bold">{PART_INFO[sel.type].label}</div>
                  <div className="text-xs text-ink/60">on the {selSpec.label.toLowerCase()} line</div>
                </div>
              </div>
              <p className="mt-2 text-xs text-ink/65">{PART_INFO[sel.type].blurb}</p>
              <div className="mt-3 flex justify-center">
                <Knob
                  key={`${selected.path}-${selected.slot}`}
                  value={sel.value}
                  {...DIALS[sel.type]}
                  color={PART_INFO[sel.type].color}
                  disabled={locked}
                  onPreview={setDialPreview}
                  onCommit={(v) => save(withPart(elec, selected, { ...sel, value: v }))}
                />
              </div>
              {sel.type === 'resistor' && (
                <p className="mt-3 rounded-lg bg-paper px-2.5 py-1.5 text-center font-mono text-[12px] text-ink/80">
                  {selSpec.amps} A × {(dialPreview ?? sel.value).toFixed(1)} Ω = {(selSpec.amps * (dialPreview ?? sel.value)).toFixed(1)} V dropped
                  <br />
                  <span className="text-ink/50">
                    heat: {selSpec.amps} A² × {(dialPreview ?? sel.value).toFixed(1)} Ω = {Math.round(selSpec.amps * selSpec.amps * (dialPreview ?? sel.value))} W
                  </span>
                </p>
              )}
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  save(withPart(elec, selected, null))
                  setSelected(null)
                }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rust ring-1 ring-rust/30 hover:bg-[#fbeee6] disabled:opacity-40"
              >
                <Trash2 className="size-3.5" /> Remove part
              </button>
            </>
          ) : (
            <p className="text-xs text-ink/55">Click a part on the wiring to turn its dial.</p>
          )}
        </div>

        <div className={`rounded-2xl p-3 text-xs ring-1 ${allOk ? 'bg-mint text-forest ring-forest/30' : 'bg-white text-ink/65 ring-line'}`}>
          {allOk ? 'Every part is getting voltage inside its rated range.' : 'Rated range = the voltage a part is designed to run on. Each meter shows its range in green.'}
        </div>
      </div>
    </div>
  )
}

function withPart(elec: ElectricalObject, ref: SlotRef, part: PowerPart | null): ElectricalObject {
  const pair = [...elec.slots[ref.path]] as [PowerPart | null, PowerPart | null]
  pair[ref.slot] = part
  return { ...elec, slots: { ...elec.slots, [ref.path]: pair } }
}

function PathRow({
  reading,
  parts,
  armed,
  selected,
  locked,
  onSlot,
  onDropPart,
}: {
  reading: PathReading
  parts: [PowerPart | null, PowerPart | null]
  armed: PowerPartType | null
  selected: SlotRef | null
  locked: boolean
  onSlot(slot: 0 | 1): void
  onDropPart(slot: 0 | 1, type: PowerPartType): void
}) {
  const { spec, volts, state } = reading
  const flow = volts > 0 ? Math.max(0.25, 2.2 - volts / 25) : 0
  return (
    <div className={`flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 ring-1 ${state === 'ok' ? 'ring-forest/35' : 'ring-line'}`}>
      <div className="w-[104px] shrink-0">
        <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-ink">
          <Battery className="size-3.5 text-ink/60" /> {spec.sourceV} V
        </div>
        <div className="text-[10px] leading-tight text-ink/50">{spec.sourceLabel}</div>
      </div>
      <Wire flow={flow} />
      {([0, 1] as const).map((slot) => (
        <div key={slot} className="contents">
          <Slot
            part={parts[slot]}
            delta={reading.partDeltas[slot]}
            armed={!!armed && !locked}
            active={selected?.path === spec.id && selected.slot === slot}
            onClick={() => onSlot(slot)}
            onDrop={(e) => {
              const t = e.dataTransfer.getData('text/fsae-part') as PowerPartType
              if (t === 'resistor' || t === 'booster') onDropPart(slot, t)
            }}
          />
          <Wire flow={flow} />
        </div>
      ))}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ComponentArt id={spec.id} reading={reading} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-display text-[14px] font-bold">{spec.label}</span>
            <span className={`font-mono text-[15px] font-bold tabular ${state === 'ok' ? 'text-forest' : state === 'high' ? 'text-rust' : 'text-[#a77c17]'}`}>{volts.toFixed(1)} V</span>
          </div>
          <Meter reading={reading} />
          <div className="mt-0.5 text-[11px] leading-snug text-ink/65">{statusLine(reading)}</div>
        </div>
      </div>
    </div>
  )
}

function statusLine({ spec, state }: PathReading): string {
  const range = `rated ${spec.lo}–${spec.hi} V`
  if (state === 'ok') return `In range (${range}).`
  switch (spec.id) {
    case 'motor':
      return state === 'high' ? `Too much (${range}). The motor controller is cutting power to protect the motor.` : `Too little (${range}). Less voltage, less power.`
    case 'pump':
      return state === 'high' ? `Too much (${range}). The pump is racing.` : `Too little (${range}). Coolant flows slowly and the motor runs hot.`
    case 'headlights':
      return state === 'high' ? `Too much (${range}). Super duper bright!` : `Too little (${range}). The lights are dim.`
    case 'brake':
      return state === 'high' ? `Too much (${range}). Very, very red.` : `Too little (${range}). Hard to see from behind.`
    case 'computer':
      return state === 'high' ? `Too much (${range}). The computer is running hot.` : `Too little (${range}). The computer keeps restarting.`
  }
}

function Wire({ flow }: { flow: number }) {
  return (
    <div className="relative h-[3px] w-5 shrink-0 overflow-hidden rounded-full bg-ink/25">
      {flow > 0 && (
        <div
          className="absolute inset-0"
          style={{
            background: 'repeating-linear-gradient(90deg, #d99a1e 0 4px, transparent 4px 9px)',
            animation: `fsae-flow ${flow}s linear infinite`,
          }}
        />
      )}
    </div>
  )
}

function Slot({ part, delta, armed, active, onClick, onDrop }: { part: PowerPart | null; delta: number; armed: boolean; active: boolean; onClick(): void; onDrop(e: DragEvent): void }) {
  const [over, setOver] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onDrop(e)
      }}
      className={`flex h-[58px] w-[68px] shrink-0 flex-col items-center justify-center rounded-lg transition ${
        part
          ? `bg-paper ring-1 ${active ? 'ring-2 ring-ink' : 'ring-line hover:ring-ink/40'}`
          : `border-2 border-dashed ${over || armed ? 'border-forest bg-mint' : 'border-line'}`
      }`}
    >
      {part ? (
        <>
          <PartSymbol type={part.type} size={26} />
          <span className="font-mono text-[10px] font-bold text-ink">
            {part.value.toFixed(1)} {part.type === 'resistor' ? 'Ω' : 'V'}
          </span>
          <span className={`font-mono text-[10px] ${delta < 0 ? 'text-rust' : 'text-forest'}`}>
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)} V
          </span>
        </>
      ) : (
        <span className="font-mono text-[10px] text-ink/40">empty</span>
      )}
    </button>
  )
}

export function PartSymbol({ type, size }: { type: PowerPartType; size: number }) {
  if (type === 'booster')
    return (
      <span className="grid place-items-center rounded-md bg-forest text-white" style={{ width: size, height: size * 0.62 }}>
        <ArrowUp style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={3} />
      </span>
    )
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 44 22">
      <path d="M0 11 H8 L11 3 L16 19 L21 3 L26 19 L31 3 L34 11 H44" fill="none" stroke="#b8461b" strokeWidth={2.4} strokeLinejoin="round" />
    </svg>
  )
}

function Meter({ reading }: { reading: PathReading }) {
  const { spec, volts } = reading
  const max = Math.max(spec.hi * 1.6, spec.sourceV * 1.1)
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <div className="relative mt-1 h-2.5 rounded-full bg-paper ring-1 ring-line">
      <div className="absolute inset-y-0 rounded-full bg-leaf/45" style={{ left: pct(spec.lo), width: `calc(${pct(spec.hi)} - ${pct(spec.lo)})` }} />
      <div className="absolute -top-0.5 h-3.5 w-1 -translate-x-1/2 rounded-full bg-ink transition-[left] duration-150" style={{ left: pct(volts) }} />
    </div>
  )
}

/** Little animated picture of each part: it speeds up, glows or flickers with its voltage. */
function ComponentArt({ id, reading }: { id: PowerPathId; reading: PathReading }) {
  const { level, state } = reading
  const box = 'relative grid size-[54px] shrink-0 place-items-center overflow-visible rounded-xl bg-paper ring-1 ring-line'
  if (id === 'motor' || id === 'pump') {
    const spin = level > 0 ? Math.max(0.12, 1.4 / level) : 0
    return (
      <div className={box} style={state === 'high' ? { boxShadow: '0 0 0 3px #f3c2a8, 0 0 18px #e0723c' } : undefined}>
        <svg width="40" height="40" viewBox="0 0 40 40" style={spin ? { animation: `fsae-spin ${spin}s linear infinite` } : undefined}>
          <circle cx="20" cy="20" r="17" fill={id === 'motor' ? '#3a3f3c' : '#5d7d68'} />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <rect key={a} x="18.5" y="5" width="3" height="13" rx="1.5" fill="#e1dfd3" transform={`rotate(${a} 20 20)`} />
          ))}
          <circle cx="20" cy="20" r="4" fill="#d99a1e" />
        </svg>
        {state === 'high' && <span className="absolute -right-2 -top-2 rounded bg-rust px-1 font-mono text-[9px] font-bold text-white">HOT</span>}
      </div>
    )
  }
  if (id === 'headlights' || id === 'brake') {
    const color = id === 'brake' ? '#ff3b2a' : '#fff1b0'
    const glow = Math.max(0, Math.min(3.2, level ** 3))
    const superBright = state === 'high'
    return (
      <div className={box}>
        {glow > 0.05 && (
          <span
            className="pointer-events-none absolute rounded-full"
            style={{
              width: 40 + glow * 30,
              height: 40 + glow * 30,
              background: `radial-gradient(circle, ${color} 0%, ${color}aa 30%, transparent 70%)`,
              opacity: Math.min(1, 0.25 + glow * 0.35),
              animation: superBright ? 'fsae-pulse 0.9s ease-in-out infinite' : undefined,
              zIndex: superBright ? 5 : 0,
            }}
          />
        )}
        <svg width="34" height="34" viewBox="0 0 34 34" className="relative">
          <circle cx="17" cy="17" r="12" fill={id === 'brake' ? '#7a1610' : '#d8d2b0'} />
          <circle cx="17" cy="17" r={4 + Math.min(1, glow) * 7} fill={color} opacity={0.25 + Math.min(1, glow) * 0.75} />
        </svg>
        {superBright && id === 'headlights' && (
          <span className="absolute -bottom-2 z-10 whitespace-nowrap rounded bg-sun px-1 font-mono text-[9px] font-bold text-ink">✨ SUPER BRIGHT</span>
        )}
      </div>
    )
  }
  // Driverless computer
  const rebooting = state === 'low' && reading.volts > 0
  return (
    <div className={box}>
      <svg width="42" height="34" viewBox="0 0 42 34">
        <rect x="1" y="1" width="40" height="27" rx="3" fill="#1b2a20" />
        <rect x="4" y="4" width="34" height="21" rx="1.5" fill={state === 'ok' || state === 'high' ? '#163323' : '#0c0f0d'} />
        {(state === 'ok' || state === 'high') && (
          <text x="21" y="18" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#9fe0b2">
            READY
          </text>
        )}
        {rebooting && (
          <text x="21" y="18" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#e1b12c" style={{ animation: 'fsae-blink 0.6s steps(2) infinite' }}>
            BOOTING
          </text>
        )}
        <rect x="16" y="29" width="10" height="4" fill="#1b2a20" />
      </svg>
      {state === 'high' && <span className="absolute -right-2 -top-2 rounded bg-rust px-1 font-mono text-[9px] font-bold text-white">HOT</span>}
    </div>
  )
}
