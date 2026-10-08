import { useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import * as THREE from 'three'
import { REQUIRED } from '../config'
import type { FloodRun } from '../sim/engine'

/**
 * DOM labels pinned to 3D positions. The DOM lives outside the Canvas; a projector
 * inside the Canvas moves the elements each frame (no nested React roots).
 */
export interface LabelSpec {
  key: string
  pos: [number, number, number]
  text: string
  kind: 'building' | 'outlet'
  building?: number
}

export type LabelEls = Map<string, HTMLDivElement>

export function LabelLayer({ labels, els }: { labels: LabelSpec[]; els: RefObject<LabelEls> }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {labels.map((l) => (
        <div
          key={l.key}
          ref={(el) => {
            if (el) els.current.set(l.key, el)
            else els.current.delete(l.key)
          }}
          className="absolute left-0 top-0 flex flex-col items-center gap-1 whitespace-nowrap will-change-transform"
          style={{ visibility: 'hidden' }}
        >
          {l.kind === 'building' ? (
            <>
              <span className="rounded-md bg-white/95 px-2 py-0.5 font-display text-[13px] font-semibold text-ink shadow-sm ring-1 ring-black/10">
                {l.text}
              </span>
              <span data-badge className="hidden rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white" />
            </>
          ) : (
            <span className="rounded bg-forest px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-white shadow">
              {l.text}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

const v = new THREE.Vector3()

export function LabelProjector({ labels, els, run }: { labels: LabelSpec[]; els: RefObject<LabelEls>; run: FloodRun | null }) {
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
      if (l.building !== undefined) {
        const badge = el.querySelector<HTMLSpanElement>('[data-badge]')
        if (!badge) continue
        const depth = run ? run.buildingNow[l.building] : 0
        if (run && depth > 0.6) {
          const text = `${depth.toFixed(1)}″ water`
          if (badge.textContent !== text) badge.textContent = text
          badge.style.display = 'block'
          badge.style.background = depth > REQUIRED.maxFloodIn ? '#b8461b' : '#c08a12'
        } else badge.style.display = 'none'
      }
    }
  })
  return null
}
