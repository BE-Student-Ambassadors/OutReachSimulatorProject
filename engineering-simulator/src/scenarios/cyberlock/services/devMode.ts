/**
 * CyberLock Dev Mode Utilities
 * Strictly accessible via `?dev=true` in the URL query parameter.
 */

export function isCyberlockDevMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('dev') === 'true' || searchParams.get('dev') === '1') {
      return true
    }
    if (window.location.hash) {
      const hashQuery = window.location.hash.split('?')[1]
      if (hashQuery) {
        const hp = new URLSearchParams(hashQuery)
        if (hp.get('dev') === 'true' || hp.get('dev') === '1') {
          return true
        }
      }
    }
  } catch {
    // ignore
  }
  return false
}

export interface DevPresetLockbox {
  serial: string
  recordId: string
  combination: string
  label: string
}

export const DEV_LOCKBOX_PRESETS: DevPresetLockbox[] = [
  { serial: 'BESA-0001', recordId: '1003', combination: '4826', label: 'Vault Alpha' },
  { serial: 'BESA-0002', recordId: '1014', combination: '1937', label: 'Vault Bravo' },
  { serial: 'BESA-0003', recordId: '1027', combination: '6504', label: 'Vault Charlie' },
  { serial: 'BESA-0004', recordId: '1038', combination: '2719', label: 'Vault Delta' },
  { serial: 'BESA-0005', recordId: '1003', combination: '4826', label: 'Vault Echo' },
]
