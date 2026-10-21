import { useEffect, useRef, useState } from 'react'
import { NO_INPUT, type DroneInput, type DroneState } from './drone'
import type { Recording } from './footage'

/** What the drone rig (inside the 3D canvas) and the goggles overlay share, updated every frame. */
export interface DroneLink {
  state: DroneState
  keys: DroneInput
  /** Mouse movement (pixels) not yet applied; the rig turns it into heading and camera tilt. */
  look: { dx: number; dy: number }
  canvas: HTMLCanvasElement | null
  /** Where the rocket is in the picture: x, y in 0..1 from the top-left; onScreen false when out of frame. */
  rocket: { x: number; y: number; onScreen: boolean; distFt: number }
  recording: Recording | null
}

export function createLink(start: DroneState): DroneLink {
  return { state: start, keys: { ...NO_INPUT }, look: { dx: 0, dy: 0 }, canvas: null, rocket: { x: 0.5, y: 0.5, onScreen: false, distFt: 0 }, recording: null }
}

const DRONE_KEYS = ['w', 'a', 's', 'd', ' ', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'r', 'c']

export interface DroneKeyActions {
  onRecord(): void
  onCamera(): void
  /** Ctrl: lock the camera to the mouse, or free the cursor. */
  onMouseLook(): void
}

/**
 * WASD moves (relative to where the camera faces), Space lifts (let go and the drone falls),
 * Shift boosts, arrows turn and tilt the camera when not using the mouse. R records, C swaps
 * to the tracking camera, Ctrl locks the camera to the mouse.
 *
 * Ctrl toggles when it is released, and only if no other key was pressed while it was down, so
 * Ctrl+W (close tab, which no page can block) can't be hit by a quick Ctrl-then-W.
 */
export function useDroneKeys(link: { current: DroneLink }, handlers: DroneKeyActions) {
  const actions = useRef(handlers)
  useEffect(() => {
    actions.current = handlers
  })
  useEffect(() => {
    const held = new Set<string>()
    let ctrlAlone = false
    const apply = () => {
      const has = (k: string) => held.has(k)
      const axis = (pos: string, neg: string) => (has(pos) ? 1 : 0) - (has(neg) ? 1 : 0)
      link.current.keys = {
        forward: axis('w', 's'),
        strafe: axis('d', 'a'),
        lift: has(' ') ? 1 : 0,
        yaw: axis('arrowright', 'arrowleft'),
        tilt: axis('arrowup', 'arrowdown'),
        boost: has('shift'),
      }
    }
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'control') {
        ctrlAlone = !e.repeat || ctrlAlone
        return
      }
      ctrlAlone = false
      if (!DRONE_KEYS.includes(k) || e.ctrlKey || e.metaKey) return
      e.preventDefault()
      // A just-clicked button (REC, camera) keeps focus; Space would press it again.
      if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
      if (!e.repeat && k === 'r') actions.current.onRecord()
      if (!e.repeat && k === 'c') actions.current.onCamera()
      held.add(k)
      apply()
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'control') {
        if (ctrlAlone) actions.current.onMouseLook()
        ctrlAlone = false
      }
      held.delete(k)
      apply()
    }
    const blur = () => {
      held.clear()
      ctrlAlone = false
      apply()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [link])
}

/**
 * Mouse look, like "shift lock" in games, on by default: the cursor is hidden and locked to the
 * view, and moving the mouse turns the drone and tilts its camera.
 *
 * Browsers only allow the lock right after a click or key press. Pressing Launch counts, so the
 * launcher locks straight away; teammates' screens lock on their first click or key. Ctrl (or Esc)
 * frees the cursor and keeps it free until Ctrl again or a click on the view. When `enabled`
 * turns false (tracking camera, or the flight is over) the cursor is always given back.
 */
export function useMouseLook(link: { current: DroneLink }, enabled: boolean) {
  const [locked, setLocked] = useState(false)
  const want = useRef(true)
  const on = useRef(enabled)
  // True while this code (not Esc) is giving the cursor back.
  const freeing = useRef(false)
  useEffect(() => {
    on.current = enabled
    if (!enabled && document.pointerLockElement) {
      freeing.current = true
      document.exitPointerLock()
    }
  }, [enabled])

  useEffect(() => {
    // The link object stays the same for the whole launch; only its fields change.
    const l = link.current
    const change = () => {
      const now = !!l.canvas && document.pointerLockElement === l.canvas
      // Unlocked without Ctrl or the flight ending: the student pressed Esc, so stay free.
      if (!now && !freeing.current) want.current = false
      freeing.current = false
      setLocked(now)
    }
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== l.canvas) return
      l.look.dx += e.movementX
      l.look.dy += e.movementY
    }
    const gesture = (e: Event) => {
      if (e instanceof KeyboardEvent && (e.key === 'Control' || e.key === 'Escape')) return
      if (want.current && on.current) requestLock(l)
    }
    // The 3D view takes a moment to appear after Launch. Chrome honors the Launch click for
    // about 5 seconds, so keep asking until the lock takes (or that window has passed).
    let tries = 0
    const early = window.setInterval(() => {
      if (want.current && on.current) requestLock(l)
      if (++tries > 40 || document.pointerLockElement) clearInterval(early)
    }, 100)
    document.addEventListener('pointerlockchange', change)
    document.addEventListener('mousemove', move)
    window.addEventListener('keydown', gesture)
    window.addEventListener('pointerdown', gesture)
    return () => {
      clearInterval(early)
      document.removeEventListener('pointerlockchange', change)
      document.removeEventListener('mousemove', move)
      window.removeEventListener('keydown', gesture)
      window.removeEventListener('pointerdown', gesture)
      if (l.canvas && document.pointerLockElement === l.canvas) document.exitPointerLock()
    }
  }, [link])

  /** Ctrl: lock, or give the cursor back. */
  const toggle = () => {
    const l = link.current
    if (l.canvas && document.pointerLockElement === l.canvas) {
      want.current = false
      freeing.current = true
      document.exitPointerLock()
    } else {
      want.current = true
      if (on.current) requestLock(l)
    }
  }
  /** A click on the view: lock again. */
  const lock = () => {
    want.current = true
    if (on.current) requestLock(link.current)
  }
  return { locked, lock, toggle }
}

/** Asks for the lock. Refused without a recent click or key press (or within a second of Esc); the next gesture retries. */
function requestLock(l: DroneLink) {
  if (!l.canvas || document.pointerLockElement === l.canvas) return
  void Promise.resolve(l.canvas.requestPointerLock()).catch(() => {})
}

const dead = (v: number) => (Math.abs(v) < 0.12 ? 0 : v)

/**
 * A game controller, if one is plugged in: left stick moves, right stick looks, A or the left
 * trigger lifts, right trigger boosts.
 */
export function gamepadInput(): DroneInput | null {
  const pad = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p?.connected) : null
  if (!pad) return null
  const ax = (i: number) => dead(pad.axes[i] ?? 0)
  return {
    forward: -ax(1),
    strafe: ax(0),
    yaw: ax(2),
    tilt: -ax(3),
    lift: Math.max(pad.buttons[0]?.pressed ? 1 : 0, pad.buttons[6]?.value ?? 0),
    boost: (pad.buttons[7]?.value ?? 0) > 0.4,
  }
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))

export const merge = (a: DroneInput, b: DroneInput | null): DroneInput =>
  b
    ? {
        forward: clamp1(a.forward + b.forward),
        strafe: clamp1(a.strafe + b.strafe),
        yaw: clamp1(a.yaw + b.yaw),
        tilt: clamp1(a.tilt + b.tilt),
        lift: Math.max(a.lift, b.lift),
        boost: a.boost || b.boost,
      }
    : a
