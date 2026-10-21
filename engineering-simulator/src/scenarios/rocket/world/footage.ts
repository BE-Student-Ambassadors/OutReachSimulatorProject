import { useSyncExternalStore } from 'react'
import { audioStream } from '../../../shared/audio/sfx'

/**
 * Drone footage recorded during launches. Clips live in this browser tab only (as video blobs)
 * until the page is closed; students can play them back or download them.
 */

export interface Clip {
  id: string
  /** Which launch this was, counting from 1 in this visit. */
  launch: number
  url: string
  seconds: number
  bytes: number
  /** Share of recorded frames with the rocket on screen, 0..100. */
  inFramePct: number
  mime: string
}

const MAX_CLIPS = 6
let clips: Clip[] = []
let launches = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const useClips = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => clips,
  )

/** Call once per launch; returns its number. */
export const nextLaunch = () => ++launches

function addClip(c: Clip) {
  const next = [c, ...clips]
  // Oldest clips are dropped (and their memory freed) beyond the limit.
  next.slice(MAX_CLIPS).forEach((old) => URL.revokeObjectURL(old.url))
  clips = next.slice(0, MAX_CLIPS)
  emit()
}

export const canRecord = () => typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype

const pickMime = () => ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''

export interface Recording {
  /** Count one frame for the "rocket in frame" figure. */
  frame(rocketInFrame: boolean): void
  /** Stops and saves the clip. */
  stop(): void
  readonly startedAt: number
}

/** Starts recording the canvas (with the game's sound). Null if this browser can't record. */
export function startRecording(canvas: HTMLCanvasElement, launch: number): Recording | null {
  if (!canRecord()) return null
  const stream = canvas.captureStream(30)
  const audio = audioStream()
  audio?.getAudioTracks().forEach((t) => stream.addTrack(t))
  let rec: MediaRecorder
  const mime = pickMime()
  try {
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined)
  } catch {
    return null
  }
  const chunks: Blob[] = []
  const startedAt = performance.now()
  let frames = 0
  let inFrame = 0
  let stopped = false
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  rec.onstop = () => {
    // Only the video track belongs to this recording; the audio track is shared.
    stream.getVideoTracks().forEach((t) => t.stop())
    const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' })
    if (!blob.size) return
    addClip({
      id: `clip-${launch}-${Math.round(startedAt)}`,
      launch,
      url: URL.createObjectURL(blob),
      seconds: Math.round((performance.now() - startedAt) / 100) / 10,
      bytes: blob.size,
      inFramePct: frames ? Math.round((inFrame / frames) * 100) : 0,
      mime: blob.type,
    })
  }
  rec.start(250)
  return {
    startedAt,
    frame(seen) {
      frames++
      if (seen) inFrame++
    },
    stop() {
      if (stopped) return
      stopped = true
      if (rec.state !== 'inactive') rec.stop()
    },
  }
}
