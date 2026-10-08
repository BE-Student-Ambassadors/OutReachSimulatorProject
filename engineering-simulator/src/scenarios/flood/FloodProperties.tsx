import { Crosshair } from 'lucide-react'
import { count, money } from '../../core/format'
import type { PropertiesProps } from '../../core/scenario'
import { CELL_FT, GAL_PER_CELL_INCH, POND_SIZE, RAIN_GARDEN_SIZE, SIM } from './config'
import { objectCost, pipeLengthFt } from './cost'
import { pathLengthCells } from './geometry'
import { campus } from './sim/engine'
import type { FloodObject, Size2, Size3 } from './types'
import { floodUi, useFloodUi } from './world/uiStore'

/** One tick of the simulation is one minute of storm. */
const gpm = (cellInPerTick: number) => `${count(cellInPerTick * GAL_PER_CELL_INCH)} gal/min`
const gal = (cellIn: number) => `${count(cellIn * GAL_PER_CELL_INCH)} gal`

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-ink/60">{k}</span>
      <span className="font-mono text-sm font-medium text-ink">{v}</span>
    </div>
  )
}

function SizePicker<S extends string>({ value, options, disabled, onChange }: { value: S; options: S[]; disabled: boolean; onChange(s: S): void }) {
  return (
    <div className="my-2 grid grid-flow-col gap-1 rounded-lg bg-paper p-1 ring-1 ring-black/5">
      {options.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          className={`rounded-md py-1.5 text-sm font-semibold capitalize transition ${
            value === s ? 'bg-forest text-white shadow-sm' : 'text-ink/70 hover:bg-white'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

function nodeName(design: FloodObject[], id: string) {
  const outlet = campus.outlets.find((o) => o.id === id)
  if (outlet) return outlet.name
  const o = design.find((d) => d.id === id)
  if (!o) return '—'
  const same = design.filter((d) => d.kind === o.kind)
  const n = same.indexOf(o) + 1
  return o.kind === 'pond' ? `Pond ${n}` : `Drain ${n}`
}

export function FloodProperties({ object: o, design, locked, onChange }: PropertiesProps<FloodObject>) {
  const { aimingPump } = useFloodUi()
  const cost = objectCost(o, design)
  const rows: [string, string][] = []
  let picker: React.ReactNode = null

  switch (o.kind) {
    case 'drain': {
      const out = design.filter((d) => d.kind === 'pipe' && d.from === o.id).length
      rows.push(['Collection radius', `${SIM.drain.radius * CELL_FT} ft`], ['Intake rate', gpm(SIM.drain.rate)])
      rows.push(['Outgoing pipes', out ? String(out) : 'none'])
      if (!out) rows.push(['Sump storage', gal(SIM.drain.sump)])
      break
    }
    case 'pipe':
      picker = <SizePicker<Size3> value={o.size} options={['small', 'medium', 'large']} disabled={locked} onChange={(size) => onChange({ ...o, size })} />
      rows.push(
        ['From', nodeName(design, o.from)],
        ['To', nodeName(design, o.to)],
        ['Length', `${count(pipeLengthFt(design, o.from, o.to))} ft`],
        ['Capacity', gpm(SIM.pipeCapacity[o.size])],
      )
      break
    case 'channel':
      rows.push(['Length', `${count(pathLengthCells(o.points) * CELL_FT)} ft`], ['Depth', `${SIM.channel.depthIn} in`])
      break
    case 'pond': {
      const s = POND_SIZE[o.size]
      picker = <SizePicker<Size3> value={o.size} options={['small', 'medium', 'large']} disabled={locked} onChange={(size) => onChange({ ...o, size })} />
      rows.push(['Footprint', `${s * CELL_FT} × ${s * CELL_FT} ft`], ['Depth', `${SIM.pondDepthIn / 12} ft`], ['Capacity', gal(s * s * SIM.pondDepthIn)])
      break
    }
    case 'rainGarden':
      rows.push(
        ['Footprint', `${RAIN_GARDEN_SIZE * CELL_FT} × ${RAIN_GARDEN_SIZE * CELL_FT} ft`],
        ['Soak-in rate', gpm(SIM.infiltration.rainGarden * RAIN_GARDEN_SIZE * RAIN_GARDEN_SIZE)],
      )
      break
    case 'permeable':
      rows.push(['Area', `${count(o.cells.length * CELL_FT * CELL_FT)} sq ft`], ['Soak-in rate', gpm(SIM.infiltration.permeable * o.cells.length)])
      break
    case 'pump': {
      picker = <SizePicker<Size2> value={o.size} options={['small', 'large']} disabled={locked} onChange={(size) => onChange({ ...o, size })} />
      const aimed = o.out.x !== o.x || o.out.y !== o.y
      rows.push(['Pump rate', gpm(SIM.pump.rate[o.size])], ['Discharge', aimed ? `(${o.out.x}, ${o.out.y})` : 'not set'])
      break
    }
    case 'barrier':
      rows.push(['Length', `${count(pathLengthCells(o.points) * CELL_FT)} ft`], ['Height', '2 ft'])
      break
    case 'tree':
      rows.push(['Canopy radius', `${SIM.tree.radius * CELL_FT} ft`])
      break
  }

  return (
    <div>
      {picker}
      <div className="divide-y divide-black/5">
        {rows.map(([k, v]) => (
          <Row key={k} k={k} v={v} />
        ))}
        <div className="flex items-baseline justify-between gap-3 pt-2">
          <span className="text-sm font-semibold text-ink">Cost</span>
          <span className="font-mono text-base font-semibold text-ink">{money(cost)}</span>
        </div>
      </div>
      {o.kind === 'pump' && (
        <button
          type="button"
          disabled={locked}
          onClick={() => floodUi.set({ aimingPump: aimingPump === o.id ? null : o.id })}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition ${
            aimingPump === o.id ? 'bg-forest text-white ring-forest' : 'bg-white text-ink ring-black/10 hover:bg-paper'
          } disabled:opacity-40`}
        >
          <Crosshair className="size-4" />
          {aimingPump === o.id ? 'Click the map…' : 'Choose discharge point'}
        </button>
      )}
    </div>
  )
}
