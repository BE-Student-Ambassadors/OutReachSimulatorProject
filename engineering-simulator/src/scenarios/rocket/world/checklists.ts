import { money } from '../../../core/format'
import { BLUEPRINT, CATEGORY_LABELS, CIRCUITS, getBusiness, getElectrical, getMechanical, getSoftware, LISTING_BY_ID, SHIPPING_SECONDS } from '../config'
import { boardStatus } from '../sim/board'
import { fundsRaised, totalFunds } from '../sim/business'
import { partsSpent, resolveBuild } from '../sim/build'
import { compile, starterProgram } from '../sim/rocketScript'
import type { PartCategory, RocketObject, RocketRoleId } from '../types'
import { getPaint } from './paintStore'

export interface CheckStep {
  label: string
  done: boolean
  /** Short live status, e.g. "3 / 5". */
  detail?: string
}

/** The steps each station works through (guidance only: what to do, never how to make it work). */
export function checklist(tab: RocketRoleId | 'launch', design: RocketObject[], now: number, launched: boolean): CheckStep[] {
  switch (tab) {
    case 'electrical': {
      const el = getElectrical(design)
      const st = boardStatus(el)
      return [
        { label: 'Open the electronics kit', done: !!el },
        { label: 'Connect every circuit', done: st.connectedCount === CIRCUITS.length, detail: `${st.connectedCount} / ${CIRCUITS.length}` },
        { label: 'Use every hole on the breadboard', done: st.fill === 1, detail: `${Math.round(st.fill * 100)}%` },
      ]
    }
    case 'mechanical': {
      const mech = getMechanical(design)
      const live = mech.orders.filter((o) => !o.returned)
      const cats = Object.keys(CATEGORY_LABELS) as PartCategory[]
      const bought = cats.filter((c) => live.some((o) => LISTING_BY_ID[o.listingId]?.category === c)).length
      const arrived = cats.filter((c) => live.some((o) => LISTING_BY_ID[o.listingId]?.category === c && now - o.orderedAt >= SHIPPING_SECONDS * 1000)).length
      const filled = resolveBuild(mech).filled
      const spent = partsSpent(mech)
      const funds = totalFunds(getBusiness(design))
      return [
        { label: 'Buy one of each part on SurplusBay', done: bought === cats.length, detail: `${bought} / ${cats.length}` },
        { label: 'Wait for the parcels', done: arrived === cats.length, detail: `${arrived} arrived` },
        { label: 'Build the rocket on the blueprint', done: filled === BLUEPRINT.length, detail: `${filled} / ${BLUEPRINT.length}` },
        { label: 'Stay within the team’s money', done: live.length > 0 && spent <= funds, detail: `${money(spent)} / ${money(funds)}` },
      ]
    }
    case 'software': {
      const sw = getSoftware(design)
      const compiled = sw ? compile(sw.source) : null
      const start = sw ? starterProgram(sw.seed).settings : null
      const s = compiled?.ok ? compiled.program.settings : null
      const tuned = !!(s && start && (s.throttle !== start.throttle || s.burn_time !== start.burn || s.deploy_altitude !== start.deploy))
      return [
        { label: 'Plug the flight computer into the laptop', done: !!sw?.pluggedIn },
        { label: 'Fix the code until it has no problems', done: !!compiled?.ok, detail: compiled && !compiled.ok ? `${compiled.errors.length} left` : undefined },
        { label: 'Tune the flight numbers', done: tuned },
        { label: 'Upload the program to the rocket', done: !!sw?.uploadedSource && sw.uploadedSource === sw.source && !!compiled?.ok },
      ]
    }
    case 'business': {
      const biz = getBusiness(design)
      const deals = biz?.deals ?? []
      const paid = deals.filter((d) => d.stage === 'paid').length
      return [
        { label: 'Open a sponsor email', done: deals.length > 0 },
        { label: 'Make a deal', done: deals.some((d) => d.stage === 'design' || d.stage === 'paid') },
        { label: 'Describe a flyer and generate it', done: deals.some((d) => !!d.flyer) },
        { label: 'Decorate it in the paint editor', done: deals.some((d) => d.stage === 'paid' || getPaint(d.sponsorId).history.length > 0) },
        { label: 'Send it in and get paid', done: paid > 0, detail: paid ? `${money(fundsRaised(biz))} raised` : undefined },
      ]
    }
    case 'launch': {
      const st = boardStatus(getElectrical(design))
      const filled = resolveBuild(getMechanical(design)).filled
      const sw = getSoftware(design)
      return [
        { label: 'Breadboard wired', done: st.connectedCount === CIRCUITS.length, detail: `${st.connectedCount} / ${CIRCUITS.length}` },
        { label: 'Rocket built', done: filled === BLUEPRINT.length, detail: `${filled} / ${BLUEPRINT.length}` },
        { label: 'Program uploaded', done: !!sw?.uploadedSource },
        { label: 'Launch, read the results, improve', done: launched },
      ]
    }
  }
}
