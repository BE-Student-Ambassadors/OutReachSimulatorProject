import { describe, expect, test } from 'vitest'
import { DRONE, droneStart, lookDrone, NO_INPUT, stepDrone, type DroneInput, type DroneState } from './drone'

const fly = (s: DroneState, input: Partial<DroneInput>, seconds: number) => {
  let d = s
  for (let t = 0; t < seconds; t += 1 / 60) d = stepDrone(d, { ...NO_INPUT, ...input }, 1 / 60)
  return d
}

describe('FPV drone', () => {
  test('starts away from the pad, facing it', () => {
    const d = droneStart(0)
    expect(Math.hypot(d.x, d.z)).toBeGreaterThan(20)
    // Forward points back toward the pad.
    const fx = -Math.sin(d.yaw)
    const fz = -Math.cos(d.yaw)
    expect(fx * -d.x + fz * -d.z).toBeGreaterThan(0)
  })

  test('teammates start in different places', () => {
    const a = droneStart(0)
    const b = droneStart(1)
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(10)
  })

  test('starts on the ground; holding lift takes off and climbs', () => {
    const s = droneStart(0)
    expect(s.y).toBe(DRONE.minY)
    expect(fly(s, {}, 2).y).toBe(DRONE.minY)
    expect(fly(s, { lift: 1 }, 2).y).toBeGreaterThan(8)
  })

  test('full lift climbs nearly as fast as the rocket, but not faster', () => {
    const d = fly(droneStart(0), { lift: 1 }, 2)
    expect(d.vy).toBeGreaterThan(50)
    expect(d.vy).toBeLessThanOrEqual(DRONE.climbSpeed)
    expect(DRONE.climbSpeed).toBeLessThan(65)
  })

  test('without lift it falls with gravity and lands', () => {
    const up = fly(droneStart(0), { lift: 1 }, 3)
    const falling = fly(up, {}, 3.5)
    expect(falling.vy).toBeLessThan(-3)
    expect(falling.y).toBeLessThan(up.y)
    const landed = fly(up, {}, 12)
    expect(landed.y).toBe(DRONE.minY)
    expect(Math.hypot(landed.vx, landed.vz)).toBeLessThan(0.5)
  })

  test('cannot drive along the ground without lift', () => {
    const s = droneStart(1)
    const d = fly(s, { forward: 1 }, 2)
    expect(Math.hypot(d.x - s.x, d.z - s.z)).toBeLessThan(0.2)
  })

  test('forward flies toward the pad from the start', () => {
    const s = droneStart(2)
    const d = fly(s, { forward: 1, lift: 1 }, 1)
    expect(Math.hypot(d.x, d.z)).toBeLessThan(Math.hypot(s.x, s.z))
  })

  test('boost is faster, but tops out', () => {
    const plain = fly(droneStart(0), { forward: 1, lift: 0.4 }, 4)
    const boost = fly(droneStart(0), { forward: 1, lift: 0.4, boost: true }, 4)
    expect(Math.hypot(boost.vx, boost.vz)).toBeGreaterThan(Math.hypot(plain.vx, plain.vz))
    expect(Math.hypot(boost.vx, boost.vz)).toBeLessThanOrEqual(DRONE.boostSpeed + 1e-6)
  })

  test('stays above the ground, under the ceiling and inside radio range', () => {
    expect(fly(droneStart(0), {}, 3).y).toBeGreaterThanOrEqual(DRONE.minY)
    expect(fly(droneStart(0), { lift: 1 }, 40).y).toBeLessThanOrEqual(DRONE.maxY)
    const far = fly(droneStart(0), { forward: -1, lift: 0.5, boost: true }, 40)
    expect(Math.hypot(far.x, far.z)).toBeLessThanOrEqual(DRONE.maxRange + 1e-6)
  })

  test('camera tilt is limited', () => {
    expect(fly(droneStart(0), { tilt: 1 }, 10).camTilt).toBeCloseTo(DRONE.maxTilt)
    expect(fly(droneStart(0), { tilt: -1 }, 10).camTilt).toBeCloseTo(DRONE.minTilt)
  })

  test('mouse look turns the drone and tilts the camera, within limits', () => {
    const d = droneStart(0)
    const right = lookDrone(d, 100, 0)
    expect(right.yaw).toBeLessThan(d.yaw)
    expect(lookDrone(d, 0, -100).camTilt).toBeGreaterThan(d.camTilt)
    expect(lookDrone(d, 0, -1e6).camTilt).toBe(DRONE.maxTilt)
    expect(lookDrone(d, 0, 1e6).camTilt).toBe(DRONE.minTilt)
    // Looking doesn't move the drone.
    expect([right.x, right.y, right.z]).toEqual([d.x, d.y, d.z])
  })
})
