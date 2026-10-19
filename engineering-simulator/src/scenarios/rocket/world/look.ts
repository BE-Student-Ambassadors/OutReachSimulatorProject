import type { Build } from '../sim/build'

/** How the built rocket looks in 3D: each part's color and finish comes from the listing that was installed. */
export interface RocketLook {
  body: { color: string; metalness: number; roughness: number } | null
  nose: { color: string; blunt: boolean } | null
  fins: { color: string; warped: boolean } | null
  motor: boolean
  chute: { color: string; scale: number } | null
}

const BODY: Record<string, RocketLook['body']> = {
  'body-cardboard': { color: '#c9a26b', metalness: 0.02, roughness: 0.92 },
  'body-phenolic': { color: '#7a4e2d', metalness: 0.1, roughness: 0.5 },
  'body-fiberglass': { color: '#f3f1ea', metalness: 0.2, roughness: 0.28 },
}
const NOSE: Record<string, RocketLook['nose']> = {
  'nose-blunt': { color: '#dcd6c8', blunt: true },
  'nose-ogive': { color: '#ffffff', blunt: false },
  'nose-vk': { color: '#b8461b', blunt: false },
}
const FINS: Record<string, RocketLook['fins']> = {
  'fins-balsa': { color: '#e3c48f', warped: true },
  'fins-plywood': { color: '#b88a55', warped: false },
  'fins-g10': { color: '#2c5b3c', warped: false },
}
const CHUTE: Record<string, RocketLook['chute']> = {
  'chute-bag': { color: '#2d2f33', scale: 0.55 },
  'chute-nylon': { color: '#e0662a', scale: 0.9 },
  'chute-ripstop': { color: '#d33a2c', scale: 1.2 },
}

export function lookFor(build: Build): RocketLook {
  return {
    body: build.body ? BODY[build.body.id] : null,
    nose: build.nose ? NOSE[build.nose.id] : null,
    fins: build.fins ? FINS[build.fins.id] : null,
    motor: !!build.motor,
    chute: build.parachute ? CHUTE[build.parachute.id] : null,
  }
}
