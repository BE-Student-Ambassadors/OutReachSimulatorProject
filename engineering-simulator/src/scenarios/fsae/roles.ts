import { divideRoles, teamPicks, type RoleSplit, type Teammate } from '../../core/roles'
import { getBusiness, getElectrical, getMechanical, getSoftware, JOINTS, POWER_PATHS, SENSORS } from './config'
import { designCost, designFunds } from './cost'
import type { FsaeResult } from './sim/engine'
import { lineProgress, sensorStatus } from './sim/harness'
import type { FsaeObject, FsaeRoleId, LapObject } from './types'
import { getPaint } from './world/paintStore'

export interface RoleDef {
  id: FsaeRoleId
  title: string
  short: string
  /** What the job is, in one line. */
  summary: string
  accent: string
}

export const ROLES: RoleDef[] = [
  { id: 'mechanical', title: 'Mechanical Engineer', short: 'Mechanical', summary: 'Weld the frame, choose the wings, size the car and test it in the wind tunnel.', accent: '#b8461b' },
  { id: 'electrical', title: 'Electrical Engineer', short: 'Electrical', summary: 'Splice parts into the car’s wiring harness to get every part its rated voltage, then mount and wire the self-driving sensors.', accent: '#d99a1e' },
  { id: 'software', title: 'Software Engineer', short: 'Software', summary: 'Program the self-driving car’s path planner: write math functions that steer a path past obstacles to the target, on three courses from easy to hard.', accent: '#7c4dbd' },
  { id: 'business', title: 'Business Lead', short: 'Business', summary: 'Read sponsor emails, make deals, then design a flyer for each sponsor. Better flyers earn more money for the car.', accent: '#2c5b3c' },
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
        { key: 'wings', label: 'Choose the front wing and set the rear wing', done: m.touchedWings },
        { key: 'size', label: 'Set the car’s size and ride height', done: m.touchedSize },
        { key: 'tunnel', label: 'Test the car in the wind tunnel', done: m.tunnelRuns > 0 },
      ]
    }
    case 'electrical': {
      const e = getElectrical(design)
      const sensors = sensorStatus(e)
      const mounted = SENSORS.filter((x) => e.mounts[x.id]).length
      return [
        ...POWER_PATHS.map((p) => {
          const pr = lineProgress(e, p.id)
          return { key: p.id, label: p.label, done: pr.done, progress: `${pr.steps} / 5` }
        }),
        { key: 'mount', label: 'Mount the self-driving sensors', done: mounted === SENSORS.length, progress: `${mounted} / ${SENSORS.length}` },
        { key: 'sensorWires', label: 'Wire the sensors to the computer', done: sensors.boardComplete },
      ]
    }
    case 'software': {
      const sw = getSoftware(design)
      return [
        { key: 'easy', label: 'Clear the Easy course', done: sw.levels.easy.cleared },
        { key: 'medium', label: 'Clear the Medium course', done: sw.levels.medium.cleared },
        { key: 'hard', label: 'Clear the Hard course', done: sw.levels.hard.cleared },
      ]
    }
    case 'business': {
      const { deals } = getBusiness(design)
      const cost = designCost(design)
      const funds = designFunds(design)
      const paid = deals.filter((d) => d.stage === 'paid').length
      return [
        { key: 'open', label: 'Open a sponsor email', done: deals.length > 0 },
        { key: 'deal', label: 'Make a deal', done: deals.some((d) => d.stage === 'design' || d.stage === 'paid') },
        { key: 'flyer', label: 'Describe a flyer and generate it', done: deals.some((d) => !!d.flyer) },
        { key: 'decorate', label: 'Decorate it in the paint editor', done: deals.some((d) => d.stage === 'paid' || getPaint(d.sponsorId).history.length > 0) },
        { key: 'send', label: 'Send flyers in and get paid', done: paid > 0, progress: paid ? `${paid} paid` : undefined },
        { key: 'funds', label: 'Raise enough to pay for the car', done: funds >= cost, progress: `$${Math.round(funds / 100) / 10}k / $${Math.round(cost / 100) / 10}k` },
      ]
    }
  }
}

export function teamChecklist(design: FsaeObject[], lastResult: FsaeResult | null): CheckItem[] {
  const laps = design.filter((o): o is LapObject => o.kind === 'lap')
  const passed = !!lastResult && lastResult.lapPass && lastResult.driverlessPass && lastResult.powerPass && lastResult.fundsPass
  return [
    { key: 'test', label: 'Run a Competition Test', done: !!lastResult },
    { key: 'pass', label: 'Meet every requirement', done: passed },
    { key: 'race', label: 'Drive on Race Day', done: laps.length > 0, progress: laps.length ? `${new Set(laps.map((l) => l.playerId)).size} drivers` : undefined },
  ]
}

export const ROLE_IDS: FsaeRoleId[] = ROLES.map((r) => r.id)

/**
 * Who does each job: the four jobs split among everyone on the team from their 1st/2nd picks
 * (see core/roles). Fewer than four people and someone takes two jobs; more and jobs are shared.
 */
export function roleSplit(design: FsaeObject[], roster: Teammate[]): RoleSplit<FsaeRoleId> {
  return divideRoles(ROLE_IDS, teamPicks(design, ROLE_IDS, roster))
}
