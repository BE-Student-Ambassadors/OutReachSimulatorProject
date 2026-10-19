import { FEATURES, getBusiness, getElectrical, getMechanical, getSoftware, JOINTS, POWER_PATHS, STORY_BEATS } from './config'
import { designCost, designFunds } from './cost'
import { trained } from './sim/autonomy'
import { panelsDone } from './sim/business'
import type { FsaeResult } from './sim/engine'
import { readPath } from './sim/power'
import type { ClaimObject, FsaeObject, FsaeRoleId, LapObject } from './types'

export interface RoleDef {
  id: FsaeRoleId
  title: string
  short: string
  /** What the job is, in one line. */
  summary: string
  accent: string
}

export const ROLES: RoleDef[] = [
  { id: 'mechanical', title: 'Mechanical Engineer', short: 'Mechanical', summary: 'Weld the frame, slide the wings, size the car and test it in the wind tunnel.', accent: '#b8461b' },
  { id: 'electrical', title: 'Electrical Engineer', short: 'Electrical', summary: 'Get the right voltage to the motor, lights, pump and computer.', accent: '#d99a1e' },
  { id: 'software', title: 'Software Engineer', short: 'Software', summary: 'Collect training data and solve for the weights of the self-driving model.', accent: '#7c4dbd' },
  { id: 'business', title: 'Business Lead', short: 'Business', summary: 'Tell the team’s story with the toy car and win sponsors to pay for the car.', accent: '#2c5b3c' },
]

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<FsaeRoleId, RoleDef>

export interface CheckItem {
  key: string
  label: string
  done: boolean
  /** Optional progress text, e.g. "5 / 8". */
  progress?: string
}

export function roleChecklist(design: FsaeObject[], role: FsaeRoleId): CheckItem[] {
  switch (role) {
    case 'mechanical': {
      const m = getMechanical(design)
      const welded = m.welds.filter((q) => q >= 0).length
      return [
        { key: 'weld', label: 'Weld every frame joint', done: welded === JOINTS.length, progress: `${welded} / ${JOINTS.length}` },
        { key: 'wings', label: 'Slide the wings in or out', done: m.touchedWings },
        { key: 'size', label: 'Set the car’s size and ride height', done: m.touchedSize },
        { key: 'tunnel', label: 'Test the car in the wind tunnel', done: m.tunnelRuns > 0 },
      ]
    }
    case 'electrical': {
      const e = getElectrical(design)
      return POWER_PATHS.map((s) => {
        const r = readPath(e, s)
        return { key: s.id, label: `${s.label}: ${s.lo}–${s.hi} V`, done: r.state === 'ok', progress: `${r.volts} V` }
      })
    }
    case 'software': {
      const sw = getSoftware(design)
      const solved = sw.weights.filter((w) => typeof w === 'number').length
      return [
        { key: 'data', label: 'Collect the 4 training datasets', done: sw.roundsDone >= FEATURES.length, progress: `${Math.min(sw.roundsDone, FEATURES.length)} / ${FEATURES.length}` },
        { key: 'weights', label: 'Solve for every weight', done: solved === FEATURES.length, progress: `${solved} / ${FEATURES.length}` },
        { key: 'validate', label: 'Run a validation test', done: sw.validatedAccuracy !== null && trained(sw) },
      ]
    }
    case 'business': {
      const b = getBusiness(design)
      const done = panelsDone(b)
      const cost = designCost(design)
      const funds = designFunds(design)
      return [
        { key: 'story', label: 'Build all 4 story panels', done: done === STORY_BEATS.length, progress: `${done} / ${STORY_BEATS.length}` },
        { key: 'pitch', label: 'Pitch to at least 3 sponsors', done: b.deals.length >= 3, progress: `${b.deals.length} / 3` },
        { key: 'funds', label: 'Raise enough to pay for the car', done: funds >= cost, progress: `$${Math.round(funds / 100) / 10}k / $${Math.round(cost / 100) / 10}k` },
      ]
    }
  }
}

export function teamChecklist(design: FsaeObject[], lastResult: FsaeResult | null): CheckItem[] {
  const laps = design.filter((o): o is LapObject => o.kind === 'lap')
  const passed = !!lastResult && lastResult.lapPass && lastResult.conesPass && lastResult.powerPass && lastResult.fundsPass
  return [
    { key: 'test', label: 'Run a Competition Test', done: !!lastResult },
    { key: 'pass', label: 'Meet every requirement', done: passed },
    { key: 'race', label: 'Drive on Race Day', done: laps.length > 0, progress: laps.length ? `${new Set(laps.map((l) => l.playerId)).size} drivers` : undefined },
  ]
}

export function getClaims(design: FsaeObject[]): Record<FsaeRoleId, ClaimObject | null> {
  const out = { mechanical: null, electrical: null, software: null, business: null } as Record<FsaeRoleId, ClaimObject | null>
  for (const o of design) if (o.kind === 'claim' && o.playerId) out[o.role] = o
  return out
}
