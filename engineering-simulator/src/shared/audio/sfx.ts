import { useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * Game sound effects for every challenge, synthesized with the Web Audio API: no audio files,
 * so they work offline and add nothing to download. One mute switch (remembered per browser)
 * covers every sound.
 *
 * - `play(name)` fires a one-shot effect.
 * - `loop(kind)` starts a continuous sound (an engine, rain, a rocket's rumble). Call
 *   `set(level)` with 0..1 as it changes and `stop()` when done.
 *
 * Browsers only allow sound after the first click or key press; everything before that is
 * silently skipped.
 */

export type SfxName =
  | 'click'
  | 'tick'
  | 'select'
  | 'place'
  | 'remove'
  | 'undo'
  | 'start'
  | 'success'
  | 'fail'
  | 'beep'
  | 'go'
  | 'coin'
  | 'thunk'
  | 'pop'
  | 'rip'
  | 'boom'
  | 'crash'
  | 'chime'
  | 'buzz'
  | 'whoosh'
  | 'thunder'
  | 'sparkle'

export type LoopKind = 'engine' | 'motor' | 'whine' | 'rain' | 'rumble' | 'wind' | 'sizzle' | 'grind'

export interface Loop {
  /** 0 = silent, 1 = full (pitch and volume follow it). */
  set(level: number): void
  stop(): void
}

const MUTE_KEY = 'besa-sound-muted'
const MASTER_VOLUME = 0.7

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let muted = readMuted()
const listeners = new Set<() => void>()
const lastPlayed = new Map<SfxName, number>()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/** The audio context and the master output every sound connects to (null where audio isn't available). */
export function audioOut(): { ctx: AudioContext; out: AudioNode } | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
    master = ctx.createGain()
    master.gain.value = muted ? 0 : MASTER_VOLUME
    master.connect(ctx.destination)
    // Contexts made before the first gesture start suspended: wake on the next one.
    const wake = () => void ctx?.resume().catch(() => {})
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return { ctx, out: master! }
}

let recordTap: MediaStreamAudioDestinationNode | null = null

/** Everything the game plays, as a stream a screen recording can include (null where unavailable). */
export function audioStream(): MediaStream | null {
  const a = audioOut()
  if (!a) return null
  if (!recordTap) {
    recordTap = a.ctx.createMediaStreamDestination()
    a.out.connect(recordTap)
  }
  return recordTap.stream
}

// ---------------------------------------------------------------- mute

export const isMuted = () => muted

export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0')
  } catch {
    /* private mode: muted for this visit only */
  }
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : MASTER_VOLUME, ctx.currentTime, 0.02)
  listeners.forEach((l) => l())
}

export const toggleMuted = () => setMuted(!muted)

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** React: the current mute state, re-rendering when it changes anywhere. */
export const useMuted = () => useSyncExternalStore(subscribe, isMuted, isMuted)

// ---------------------------------------------------------------- building blocks

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

interface ToneOpts {
  type?: OscillatorType
  from: number
  to?: number
  at?: number
  dur: number
  vol: number
  /** Seconds to reach full volume. */
  attack?: number
}

function tone(c: AudioContext, out: AudioNode, o: ToneOpts) {
  const t = c.currentTime + (o.at ?? 0)
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.from, t)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(o.vol, t + (o.attack ?? 0.005))
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
  osc.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + o.dur + 0.02)
}

interface NoiseOpts {
  at?: number
  dur: number
  vol: number
  filter: BiquadFilterType
  freq: number
  toFreq?: number
  q?: number
  attack?: number
}

function burst(c: AudioContext, out: AudioNode, o: NoiseOpts) {
  const t = c.currentTime + (o.at ?? 0)
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  const f = c.createBiquadFilter()
  f.type = o.filter
  f.frequency.setValueAtTime(o.freq, t)
  if (o.toFreq) f.frequency.exponentialRampToValueAtTime(o.toFreq, t + o.dur)
  f.Q.value = o.q ?? 1
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(o.vol, t + (o.attack ?? 0.005))
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
  src.connect(f).connect(g).connect(out)
  src.start(t, Math.random())
  src.stop(t + o.dur + 0.05)
}

const notes = (c: AudioContext, out: AudioNode, freqs: number[], gap: number, dur: number, vol: number, type: OscillatorType = 'triangle') =>
  freqs.forEach((f, i) => tone(c, out, { type, from: f, at: i * gap, dur, vol }))

// ---------------------------------------------------------------- one-shot effects

const EFFECTS: Record<SfxName, (c: AudioContext, out: AudioNode) => void> = {
  click: (c, o) => tone(c, o, { from: 900, to: 500, dur: 0.05, vol: 0.12 }),
  tick: (c, o) => tone(c, o, { type: 'square', from: 1800, dur: 0.025, vol: 0.03 }),
  select: (c, o) => tone(c, o, { type: 'triangle', from: 520, to: 780, dur: 0.08, vol: 0.12 }),
  place: (c, o) => {
    tone(c, o, { type: 'triangle', from: 240, to: 110, dur: 0.12, vol: 0.22 })
    tone(c, o, { from: 660, to: 990, at: 0.03, dur: 0.09, vol: 0.07 })
  },
  remove: (c, o) => tone(c, o, { type: 'triangle', from: 420, to: 140, dur: 0.16, vol: 0.16 }),
  undo: (c, o) => tone(c, o, { type: 'sine', from: 700, to: 380, dur: 0.12, vol: 0.12 }),
  start: (c, o) => {
    burst(c, o, { filter: 'bandpass', freq: 400, toFreq: 2400, q: 0.8, dur: 0.45, vol: 0.18, attack: 0.2 })
    tone(c, o, { type: 'triangle', from: 330, to: 660, dur: 0.35, vol: 0.08, attack: 0.15 })
  },
  success: (c, o) => {
    notes(c, o, [523.25, 659.25, 783.99, 1046.5], 0.1, 0.5, 0.13)
    tone(c, o, { type: 'sine', from: 2093, at: 0.42, dur: 0.6, vol: 0.05 })
  },
  fail: (c, o) => notes(c, o, [392, 349.23, 293.66], 0.16, 0.4, 0.11, 'sawtooth'),
  beep: (c, o) => tone(c, o, { type: 'square', from: 440, dur: 0.18, vol: 0.09 }),
  go: (c, o) => {
    tone(c, o, { type: 'square', from: 880, dur: 0.5, vol: 0.1 })
    tone(c, o, { type: 'square', from: 1320, dur: 0.5, vol: 0.05 })
  },
  coin: (c, o) => {
    tone(c, o, { type: 'square', from: 988, dur: 0.08, vol: 0.08 })
    tone(c, o, { type: 'square', from: 1319, at: 0.07, dur: 0.35, vol: 0.08 })
  },
  thunk: (c, o) => {
    tone(c, o, { type: 'triangle', from: 180, to: 60, dur: 0.15, vol: 0.3 })
    burst(c, o, { filter: 'lowpass', freq: 900, dur: 0.08, vol: 0.2 })
  },
  pop: (c, o) => {
    burst(c, o, { filter: 'bandpass', freq: 1200, q: 2, dur: 0.07, vol: 0.4 })
    tone(c, o, { from: 300, to: 900, dur: 0.12, vol: 0.12 })
  },
  rip: (c, o) => burst(c, o, { filter: 'bandpass', freq: 2500, toFreq: 700, q: 3, dur: 0.45, vol: 0.3, attack: 0.02 }),
  boom: (c, o) => {
    burst(c, o, { filter: 'lowpass', freq: 1800, toFreq: 120, dur: 1.4, vol: 0.6, attack: 0.01 })
    tone(c, o, { from: 90, to: 30, dur: 1, vol: 0.4 })
  },
  crash: (c, o) => {
    burst(c, o, { filter: 'lowpass', freq: 2500, toFreq: 300, dur: 0.6, vol: 0.45 })
    tone(c, o, { type: 'triangle', from: 140, to: 40, dur: 0.4, vol: 0.35 })
    tone(c, o, { type: 'square', from: 1300, to: 400, at: 0.03, dur: 0.25, vol: 0.05 })
  },
  chime: (c, o) => notes(c, o, [880, 1318.5], 0.08, 0.35, 0.09, 'sine'),
  buzz: (c, o) => tone(c, o, { type: 'sawtooth', from: 150, to: 120, dur: 0.25, vol: 0.09 }),
  whoosh: (c, o) => burst(c, o, { filter: 'bandpass', freq: 600, toFreq: 2200, q: 1.2, dur: 0.35, vol: 0.14, attack: 0.12 }),
  thunder: (c, o) => {
    burst(c, o, { filter: 'lowpass', freq: 1200, toFreq: 80, dur: 2.4, vol: 0.5, attack: 0.03 })
    burst(c, o, { filter: 'lowpass', freq: 400, at: 0.25, dur: 1.8, vol: 0.35, attack: 0.2 })
  },
  sparkle: (c, o) => notes(c, o, [1318.5, 1760, 2349.3], 0.05, 0.25, 0.05, 'sine'),
}

/** Same effect again within this many ms is dropped (keeps bursts of events from stacking up). */
const MIN_GAP_MS: Partial<Record<SfxName, number>> = { tick: 30, thunk: 60, pop: 60, sparkle: 150 }

export function play(name: SfxName): void {
  if (muted) return
  const now = performance.now()
  if (now - (lastPlayed.get(name) ?? -1e9) < (MIN_GAP_MS[name] ?? 25)) return
  lastPlayed.set(name, now)
  const a = audioOut()
  if (!a || a.ctx.state !== 'running') return
  EFFECTS[name](a.ctx, a.out)
}

// ---------------------------------------------------------------- loops

const SILENT: Loop = { set() {}, stop() {} }

export function loop(kind: LoopKind): Loop {
  const a = audioOut()
  if (!a) return SILENT
  const { ctx: c, out } = a
  const g = c.createGain()
  g.gain.value = 0
  g.connect(out)
  const sources: AudioScheduledSourceNode[] = []
  const osc = (type: OscillatorType, freq: number, dest: AudioNode) => {
    const s = c.createOscillator()
    s.type = type
    s.frequency.value = freq
    s.connect(dest)
    s.start()
    sources.push(s)
    return s
  }
  const noiseSrc = (dest: AudioNode) => {
    const s = c.createBufferSource()
    s.buffer = noiseBuffer(c)
    s.loop = true
    s.connect(dest)
    s.start(0, Math.random())
    sources.push(s)
    return s
  }
  const filter = (type: BiquadFilterType, freq: number, q = 1) => {
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    f.connect(g)
    return f
  }
  const ramp = (p: AudioParam, v: number, tc = 0.06) => p.setTargetAtTime(v, c.currentTime, tc)

  let set: (level: number) => void
  switch (kind) {
    case 'engine':
    case 'motor': {
      // A buzzy motor note through a filter that opens as it revs.
      const lp = filter('lowpass', 600, 2)
      const base = kind === 'engine' ? 48 : 90
      const span = kind === 'engine' ? 210 : 260
      const o1 = osc('sawtooth', base, lp)
      const o2 = osc('square', base * 1.5, lp)
      const sub = c.createGain()
      sub.gain.value = 0.5
      sub.connect(lp)
      const o3 = osc('triangle', base / 2, sub)
      set = (l) => {
        const f = base + span * l
        ramp(o1.frequency, f)
        ramp(o2.frequency, f * 1.5)
        ramp(o3.frequency, f / 2)
        ramp(lp.frequency, 400 + 2200 * l)
        ramp(g.gain, l <= 0.001 ? 0 : 0.035 + 0.05 * l)
      }
      break
    }
    case 'whine': {
      const bp = filter('bandpass', 800, 4)
      const o1 = osc('sawtooth', 200, bp)
      set = (l) => {
        ramp(o1.frequency, 120 + 1300 * l, 0.2)
        ramp(bp.frequency, 200 + 1600 * l, 0.2)
        ramp(g.gain, l <= 0.02 ? 0 : 0.04 * l, 0.15)
      }
      break
    }
    case 'rain': {
      noiseSrc(filter('highpass', 1400, 0.5))
      noiseSrc(filter('bandpass', 500, 0.4))
      set = (l) => ramp(g.gain, 0.22 * Math.min(1, l), 0.3)
      break
    }
    case 'rumble': {
      const lp = filter('lowpass', 260, 0.7)
      noiseSrc(lp)
      osc('sine', 42, g)
      set = (l) => {
        ramp(g.gain, 0.6 * l, 0.08)
        ramp(lp.frequency, 160 + 500 * l, 0.1)
      }
      break
    }
    case 'wind': {
      const bp = filter('bandpass', 700, 0.8)
      noiseSrc(bp)
      // Gusts: a slow wobble on the filter.
      const depth = c.createGain()
      depth.gain.value = 250
      depth.connect(bp.frequency)
      osc('sine', 0.35, depth)
      set = (l) => ramp(g.gain, 0.22 * l, 0.25)
      break
    }
    case 'sizzle': {
      const hp = filter('highpass', 2600, 0.7)
      const crackle = c.createGain()
      crackle.gain.value = 0.6
      crackle.connect(hp)
      noiseSrc(crackle)
      // Crackle: the volume flutters quickly.
      const depth = c.createGain()
      depth.gain.value = 0.4
      depth.connect(crackle.gain)
      osc('square', 17, depth)
      set = (l) => ramp(g.gain, 0.16 * l, 0.03)
      break
    }
    case 'grind': {
      // A sanding disc: a rasp of bright noise over the motor's whine, both rising as it bites.
      const bp = filter('bandpass', 2600, 1.1)
      noiseSrc(bp)
      const hum = c.createGain()
      hum.gain.value = 0.18
      hum.connect(g)
      const motor = osc('sawtooth', 180, hum)
      set = (l) => {
        ramp(g.gain, l <= 0.01 ? 0 : 0.05 + 0.12 * l, 0.05)
        ramp(bp.frequency, 2000 + 2400 * l, 0.08)
        ramp(motor.frequency, 170 + 40 * l, 0.1)
      }
      break
    }
  }

  let stopped = false
  return {
    set: (l) => !stopped && set(Math.max(0, Math.min(1, l))),
    stop: () => {
      if (stopped) return
      stopped = true
      g.gain.setTargetAtTime(0, c.currentTime, 0.05)
      for (const s of sources) s.stop(c.currentTime + 0.4)
      window.setTimeout(() => g.disconnect(), 600)
    },
  }
}

/**
 * React: a loop that runs while `active` is true and stops when it turns false or the
 * component unmounts. Call `.current.set(level)` from animation frames.
 */
export function useLoop(kind: LoopKind, active = true): { current: Loop } {
  const ref = useRef<Loop>(SILENT)
  useEffect(() => {
    if (!active) return
    const l = loop(kind)
    ref.current = l
    return () => {
      l.stop()
      ref.current = SILENT
    }
  }, [kind, active])
  return ref
}

/** React: plays `name` whenever `count` goes up (never on the first render). */
export function usePlayOnIncrease(count: number, name: SfxName = 'sparkle') {
  const prev = useRef(count)
  useEffect(() => {
    if (count > prev.current) play(name)
    prev.current = count
  }, [count, name])
}
