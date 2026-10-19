import { describe, expect, test } from 'vitest'
import { carParams } from './car'
import { cornerSpeed } from './lapsim'
import { startState, stepDrive, type DriveState } from './race'
import * as S from './strategies'
import { getTrack, type Track } from './track'

/** A simple autopilot: aim at a point ahead, ease off when the road ahead bends. */
function autopilot(s: DriveState, track: Track, design = S.balanced()) {
  const p = carParams(design)
  const n = track.x.length
  const ahead = (s.idx + 8) % n
  const want = Math.atan2(track.z[ahead] - s.z, track.x[ahead] - s.x)
  let err = want - s.h
  while (err > Math.PI) err -= 2 * Math.PI
  while (err < -Math.PI) err += 2 * Math.PI
  let limit = 60
  for (let d = 0; d < 40; d += 2) limit = Math.min(limit, cornerSpeed(p, track.k[(s.idx + d) % n], 60) * 0.85 + d * 0.35)
  return { throttle: s.v < limit ? 1 : 0, brake: s.v > limit + 1.5 ? 1 : 0, steer: Math.max(-1, Math.min(1, -err * 3)) }
}

function drive(design = S.balanced()) {
  const track = getTrack()
  const p = carParams(design)
  let s = startState(track)
  let maxOff = 0
  for (let i = 0; i < 120 * 60 && !s.finished; i++) {
    s = stepDrive(s, autopilot(s, track, design), p, track, 1 / 60)
    maxOff = Math.max(maxOff, Math.abs(s.offset))
  }
  return { s, maxOff }
}

describe('race driving', () => {
  test('an autopilot finishes a lap on the course in a sensible time', () => {
    const { s, maxOff } = drive()
    expect(s.finished).toBe(true)
    expect(s.timeS).toBeGreaterThan(30)
    expect(s.timeS).toBeLessThan(60)
    expect(maxOff).toBeLessThan(6)
    process.stderr.write(`autopilot lap ${s.timeS.toFixed(2)} s, cones ${s.conesHit.length}, max offset ${maxOff.toFixed(1)} m\n`)
  })

  test('a weaker car is slower around the same lap', () => {
    expect(drive(S.hotMotor()).s.timeS).toBeGreaterThan(drive(S.balanced()).s.timeS)
  })

  test('the car stops when nothing is pressed and drives straight with no steering', () => {
    const track = getTrack()
    const p = carParams(S.balanced())
    let s = startState(track)
    for (let i = 0; i < 60; i++) s = stepDrive(s, { throttle: 1, brake: 0, steer: 0 }, p, track, 1 / 60)
    const h0 = s.h
    expect(s.v).toBeGreaterThan(3)
    for (let i = 0; i < 600; i++) s = stepDrive(s, { throttle: 0, brake: 1, steer: 0 }, p, track, 1 / 60)
    expect(s.v).toBeLessThanOrEqual(0)
    expect(s.h).toBeCloseTo(h0, 5)
  })
})
declare const process: { stderr: { write(s: string): void } }
