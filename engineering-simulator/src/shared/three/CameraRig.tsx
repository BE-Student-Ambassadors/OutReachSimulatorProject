import { CameraControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Compass, Minus, Plus, RotateCcw, RotateCw } from 'lucide-react'
import { useEffect, type RefObject } from 'react'
import { goHome, type CameraHome } from './camera'

export function CameraRig({ controlsRef, home, maxDistance }: { controlsRef: RefObject<CameraControls | null>; home: CameraHome; maxDistance: number }) {
  const { size } = useThree()
  useEffect(() => {
    const c = controlsRef.current
    if (c && size.width > 0 && size.height > 0) goHome(c, home, false, size.width / size.height)
  }, [controlsRef, home, size.width, size.height])
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    c.mouseButtons.left = 0 // ACTION.NONE
    c.mouseButtons.right = 1 // ACTION.ROTATE
    c.mouseButtons.middle = 2 // ACTION.TRUCK
    c.mouseButtons.wheel = 16 // ACTION.DOLLY
    c.setBoundary(home.bounds)
  }, [controlsRef, home])
  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={maxDistance * 0.15}
      maxDistance={maxDistance}
      minPolarAngle={0.15}
      maxPolarAngle={1.2}
      dollySpeed={0.6}
      azimuthRotateSpeed={0.5}
      polarRotateSpeed={0.5}
      smoothTime={0.2}
    />
  )
}

export function ViewButtons({ controlsRef, home, zoomStep }: { controlsRef: RefObject<CameraControls | null>; home: CameraHome; zoomStep: number }) {
  const btn = 'grid size-9 place-items-center rounded-lg bg-white/95 text-ink shadow ring-1 ring-black/10 transition hover:bg-white active:scale-95'
  const c = () => controlsRef.current
  return (
    <div className="absolute right-3 top-3 flex items-center gap-1.5">
      <button type="button" title="Rotate left" className={btn} onClick={() => c()?.rotate(-Math.PI / 6, 0, true)}>
        <RotateCcw className="size-4" />
      </button>
      <button type="button" title="Rotate right" className={btn} onClick={() => c()?.rotate(Math.PI / 6, 0, true)}>
        <RotateCw className="size-4" />
      </button>
      <button type="button" title="Zoom in" className={btn} onClick={() => c()?.dolly(zoomStep, true)}>
        <Plus className="size-4" />
      </button>
      <button type="button" title="Zoom out" className={btn} onClick={() => c()?.dolly(-zoomStep, true)}>
        <Minus className="size-4" />
      </button>
      <button
        type="button"
        title="Reset view"
        className={btn}
        onClick={() => {
          const cc = c()
          if (cc) goHome(cc, home, true)
        }}
      >
        <Compass className="size-4" />
      </button>
      <span className="ml-1 font-mono text-[10px] leading-tight text-ink/55">
        right-drag
        <br />
        to rotate
      </span>
    </div>
  )
}
