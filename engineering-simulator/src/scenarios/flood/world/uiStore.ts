import { useSyncExternalStore } from 'react'

/** Small store for World-only interaction state that the properties panel can trigger. */
interface UiState {
  /** A pump waiting for the student to click its discharge point. */
  aimingPump: string | null
}

let state: UiState = { aimingPump: null }
const listeners = new Set<() => void>()

export const floodUi = {
  get: () => state,
  set(patch: Partial<UiState>) {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export const useFloodUi = () => useSyncExternalStore(floodUi.subscribe, floodUi.get)
