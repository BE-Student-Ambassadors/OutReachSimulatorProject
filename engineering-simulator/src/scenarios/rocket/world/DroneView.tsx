import { useFrame, useThree } from '@react-three/fiber'
import { Camera, Circle, Gamepad2, Video } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { count } from '../../../core/format'
import type { RocketRun } from '../sim/engine'
import { droneSpeed, lookDrone, stepDrone } from './drone'
import { gamepadInput, merge, type DroneLink } from './droneLink'
import { ALT_SCALE, DIST_SCALE, rocketScenePos } from './sceneScale'

/**
 * FPV drones for watching (and recording) a launch. Every teammate's screen plays the launch,
 * and each student flies their own drone on their own laptop.
 *
 * DroneRig lives inside the 3D canvas: it flies the drone and puts the camera on it.
 * DroneOsd is the goggles overlay on top. They share one DroneLink (droneLink.ts), updated
 * every frame without React re-renders.
 */

const FPV_FOV = 100
const TRACKING_FOV = 42
/** Scene units → feet, horizontally and vertically (the launch scene squashes altitude harder). */
const FT_PER_UNIT_H = 1 / DIST_SCALE
const FT_PER_UNIT_V = 1 / ALT_SCALE
/**
 * Drone speed on the same footing as the rocket's HUD: the climb replays at about half real
 * speed with altitude at 8 ft per unit, so 1 scene unit/s ≈ 8 ft × 0.55 ≈ 3 mph.
 */
const MPH_PER_UNIT = 3

// ---------------------------------------------------------------- the rig (inside the canvas)

/** Rocket position in the launch scene, matching how RocketScene draws it. */
function rocketPoint(run: RocketRun, out: THREE.Vector3) {
  const f = run.frame
  const [x, y, z] = rocketScenePos(f.rocketPos)
  return out.set(x, f.phase === 'landed' ? 0.6 : y, z)
}

/** Sets the lens; returns the camera. */
function lens(camera: THREE.Camera, fov: number) {
  const cam = camera as THREE.PerspectiveCamera
  if (cam.fov !== fov) {
    cam.fov = fov
    cam.updateProjectionMatrix()
  }
  return cam
}

export function DroneRig({ linkRef, run, active }: { linkRef: { current: DroneLink }; run: RocketRun; active: boolean }) {
  const get = useThree((s) => s.get)
  const target = useMemo(() => new THREE.Vector3(), [])
  const projected = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    linkRef.current.canvas = get().gl.domElement
    // Leave the normal lens behind for the tracking camera and the Launch Pad.
    return () => void lens(get().camera, TRACKING_FOV)
  }, [get, linkRef])

  useFrame((state, dt) => {
    const l = linkRef.current
    // Wide FPV lens while flying, the normal lens for the tracking camera.
    const camera = lens(state.camera, active ? FPV_FOV : TRACKING_FOV)
    if (active) {
      // Small fixed steps, so the drone keeps real time (like the rocket) even at a low frame rate.
      const input = merge(l.keys, gamepadInput())
      let st = lookDrone(l.state, l.look.dx, l.look.dy)
      for (let left = Math.min(dt, 0.25); left > 1e-6; left -= 1 / 60) st = stepDrone(st, input, Math.min(left, 1 / 60))
      l.state = st
    }
    l.look.dx = 0
    l.look.dy = 0
    const s = l.state

    if (active) {
      // Props make the picture buzz a little, more when flying fast.
      const t = state.clock.elapsedTime
      const buzz = 0.0012 + 0.0025 * Math.min(1, droneSpeed(s) / 26)
      camera.position.set(s.x, s.y, s.z)
      camera.rotation.order = 'YXZ'
      camera.rotation.set(s.camTilt - s.lean + Math.sin(t * 87) * buzz, s.yaw, -s.bank + Math.cos(t * 73) * buzz)
    }

    // Where the rocket is in the picture (for the lock box and "in frame" figure).
    rocketPoint(run, target)
    projected.copy(target).project(camera)
    const inFront = projected.z < 1
    const onScreen = inFront && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1
    const dx = (target.x - camera.position.x) * FT_PER_UNIT_H
    const dy = (target.y - camera.position.y) * FT_PER_UNIT_V
    const dz = (target.z - camera.position.z) * FT_PER_UNIT_H
    // Behind the camera, projection flips: mirror it so the edge arrow still points the right way.
    const px = inFront ? projected.x : -projected.x
    const py = inFront ? projected.y : -projected.y
    l.rocket = { x: (px + 1) / 2, y: (1 - py) / 2, onScreen, distFt: Math.hypot(dx, dy, dz) }
    l.recording?.frame(onScreen)
  })
  return null
}

// ---------------------------------------------------------------- goggles overlay

export function DroneOsd({
  linkRef,
  run,
  active,
  recording,
  canRecord,
  mouseLook,
  onRecord,
  onCamera,
}: {
  linkRef: { current: DroneLink }
  run: RocketRun
  active: boolean
  recording: boolean
  canRecord: boolean
  mouseLook: boolean
  onRecord(): void
  onCamera(): void
}) {
  const el = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const e = el.current
      const l = linkRef.current
      const s = l.state
      const r = l.rocket
      if (e.alt) e.alt.textContent = `${count(s.y * FT_PER_UNIT_V)} ft`
      if (e.spd) e.spd.textContent = `${count(droneSpeed(s) * MPH_PER_UNIT)} mph`
      if (e.dist) e.dist.textContent = `${count(r.distFt)} ft`
      if (e.tilt) e.tilt.textContent = `${Math.round((s.camTilt * 180) / Math.PI)}°`
      if (e.rec && l.recording) {
        const secs = Math.floor((performance.now() - l.recording.startedAt) / 1000)
        e.rec.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
      }
      if (e.lock) {
        e.lock.style.display = r.onScreen ? 'block' : 'none'
        e.lock.style.left = `${r.x * 100}%`
        e.lock.style.top = `${r.y * 100}%`
      }
      if (e.arrow) {
        e.arrow.style.display = r.onScreen ? 'none' : 'flex'
        // Pin the arrow to the edge of the picture, in the rocket's direction.
        const ax = r.x - 0.5
        const ay = r.y - 0.5
        const k = 0.44 / Math.max(Math.abs(ax), Math.abs(ay), 1e-6)
        e.arrow.style.left = `${(0.5 + ax * k) * 100}%`
        e.arrow.style.top = `${(0.5 + ay * k) * 100}%`
        e.arrow.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(ay, ax)}rad)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [linkRef, run])

  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-mono text-white">
      {active && (
        <>
          {/* Goggles: dark corners and faint scan lines */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,0.55) 100%)' }} />
          <div className="absolute inset-0 opacity-[0.07]" style={{ background: 'repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 3px)' }} />
          {/* Crosshair */}
          <div className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2">
            <span className="absolute left-0 top-1/2 h-px w-2 bg-white/80" />
            <span className="absolute right-0 top-1/2 h-px w-2 bg-white/80" />
            <span className="absolute left-1/2 top-0 h-2 w-px bg-white/80" />
            <span className="absolute bottom-0 left-1/2 h-2 w-px bg-white/80" />
          </div>
          {/* Lock box on the rocket, or an arrow toward it */}
          <div ref={(n) => { el.current.lock = n }} className="absolute size-16 -translate-x-1/2 -translate-y-1/2" style={{ display: 'none' }}>
            {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'left-0 bottom-0 border-l-2 border-b-2', 'right-0 bottom-0 border-r-2 border-b-2'].map((c) => (
              <span key={c} className={`absolute size-3 border-[#9ff0b4] ${c}`} />
            ))}
            <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-black/50 px-1 text-[10px] text-[#9ff0b4]">ROCKET</span>
          </div>
          <div ref={(n) => { el.current.arrow = n }} className="absolute items-center justify-center" style={{ display: 'none' }}>
            <svg width="34" height="20" viewBox="0 0 34 20">
              <path d="M2 10 H24 M18 3 L30 10 L18 17" fill="none" stroke="#ffd166" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {/* Telemetry, left side */}
          <div className="absolute left-5 top-1/2 -translate-y-1/2 space-y-2 text-[13px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {[
              ['ALT', 'alt'],
              ['SPD', 'spd'],
              ['TO ROCKET', 'dist'],
              ['CAM TILT', 'tilt'],
            ].map(([label, k]) => (
              <div key={k}>
                <div className="text-[10px] text-white/70">{label}</div>
                <div ref={(n) => { el.current[k] = n }} className="font-bold tabular" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recording control, top-left */}
      <div className="pointer-events-auto absolute left-4 top-4 flex items-center gap-2">
        {canRecord ? (
          <button
            type="button"
            onClick={onRecord}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold shadow ring-1 ${recording ? 'bg-[#c8281c] ring-white/40' : 'bg-black/55 ring-white/25 hover:bg-black/70'}`}
          >
            <Circle className={`size-3 ${recording ? 'animate-pulse fill-white' : 'fill-[#ff4d3d] text-[#ff4d3d]'}`} />
            {recording ? (
              <>
                REC <span ref={(n) => { el.current.rec = n }} className="tabular">0:00</span>
              </>
            ) : (
              'Record (R)'
            )}
          </button>
        ) : (
          <span className="rounded-lg bg-black/55 px-3 py-1.5 text-xs text-white/80">This browser can’t record video</span>
        )}
      </div>

      {active && (
        <div
          className={`absolute left-1/2 top-[27%] -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold ring-1 transition ${
            mouseLook ? 'bg-black/35 text-[#9ff0b4] ring-[#9ff0b4]/40' : 'bg-black/55 text-white ring-white/25'
          }`}
        >
          {mouseLook ? 'MOUSE LOOK · Ctrl to free the cursor' : 'Click the view or press Ctrl to look with the mouse'}
        </div>
      )}

      {/* Camera switch and controls, bottom */}
      <div className="pointer-events-auto absolute bottom-4 right-4">
        <button type="button" onClick={onCamera} className="flex items-center gap-2 rounded-lg bg-black/55 px-3 py-1.5 text-xs font-bold shadow ring-1 ring-white/25 hover:bg-black/70">
          {active ? <Video className="size-3.5" /> : <Camera className="size-3.5" />}
          {active ? 'Tracking camera (C)' : 'Fly your drone (C)'}
        </button>
      </div>
      {active && (
        <div className="absolute bottom-4 left-4 rounded-xl bg-black/55 px-3 py-2 text-[11px] leading-relaxed text-white/90 ring-1 ring-white/15">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/60">
            <Gamepad2 className="size-3.5" /> FPV drone
          </div>
          <div>
            <b>WASD</b> move · hold <b>Space</b> to stay up · <b>Shift</b> boost
          </div>
          <div>
            <b>Ctrl</b> {mouseLook ? 'free the cursor' : 'look with the mouse'} · <b>Arrows</b> turn and tilt
          </div>
        </div>
      )}
    </div>
  )
}
