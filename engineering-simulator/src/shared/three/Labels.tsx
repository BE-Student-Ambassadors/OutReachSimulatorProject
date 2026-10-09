import { useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import * as THREE from 'three'

/**
 * DOM labels pinned to 3D positions, without drei <Html> (which breaks under React 19
 * StrictMode). The DOM layer sits outside the Canvas; a projector inside the Canvas
 * moves each element every frame.
 */
export interface PinnedLabel {
  key: string
  pos: [number, number, number]
  text: string
  tone: 'street' | 'place' | 'tag'
}

export type LabelEls = Map<string, HTMLDivElement>

const TONE: Record<PinnedLabel['tone'], string> = {
  street: 'rounded bg-ink/70 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-white',
  place: 'rounded-md bg-white/95 px-2 py-0.5 font-display text-[13px] font-semibold text-ink shadow-sm ring-1 ring-black/10',
  tag: 'rounded bg-forest px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-white shadow',
}

export function LabelLayer({ labels, els }: { labels: PinnedLabel[]; els: RefObject<LabelEls> }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {labels.map((l) => (
        <div
          key={l.key}
          ref={(el) => {
            if (el) els.current.set(l.key, el)
            else els.current.delete(l.key)
          }}
          className="absolute left-0 top-0 whitespace-nowrap will-change-transform"
          style={{ visibility: 'hidden' }}
        >
          <span className={TONE[l.tone]}>{l.text}</span>
        </div>
      ))}
    </div>
  )
}

const v = new THREE.Vector3()

/** Moves any DOM elements registered in `els` to follow their 3D anchor points. */
export function LabelProjector({ labels, els }: { labels: { key: string; pos: [number, number, number] }[]; els: RefObject<LabelEls> }) {
  const { camera, size } = useThree()
  useFrame(() => {
    for (const l of labels) {
      const el = els.current.get(l.key)
      if (!el) continue
      v.set(...l.pos).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      el.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) continue
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
      el.style.zIndex = String(Math.round((1 - v.z) * 1000))
    }
  })
  return null
}
