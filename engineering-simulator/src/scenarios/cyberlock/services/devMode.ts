/**
 * CyberLock Dev Mode Utilities
 * Allows instructors, facilitators, and developers to test all stages,
 * jump between puzzles, inspect modals, and auto-solve steps.
 */

export function isCyberlockDevMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('dev') === 'true' || searchParams.get('dev') === '1' || searchParams.has('dev')) {
      return true
    }
    if (window.location.hash) {
      const hashQuery = window.location.hash.split('?')[1]
      if (hashQuery) {
        const hp = new URLSearchParams(hashQuery)
        if (hp.get('dev') === 'true' || hp.get('dev') === '1' || hp.has('dev')) {
          return true
        }
      }
      if (window.location.hash.includes('dev=true')) return true
    }
    if (localStorage.getItem('cyberlock_dev_mode') === 'true') {
      return true
    }
  } catch {
    // ignore
  }
  return false
}

export function setCyberlockDevModeStored(enabled: boolean) {
  if (typeof window === 'undefined') return
  try {
    if (enabled) {
      localStorage.setItem('cyberlock_dev_mode', 'true')
    } else {
      localStorage.removeItem('cyberlock_dev_mode')
    }
  } catch {
    // ignore
  }
}

export interface DevPresetLockbox {
  serial: string
  recordId: string
  combination: string
  label: string
}

export const DEV_LOCKBOX_PRESETS: DevPresetLockbox[] = [
  { serial: 'BESA-0427', recordId: '1003', combination: '4826', label: 'Vault DTI Special' },
  { serial: 'BESA-0001', recordId: '1003', combination: '4826', label: 'Vault Alpha' },
  { serial: 'BESA-0002', recordId: '1014', combination: '1937', label: 'Vault Bravo' },
  { serial: 'BESA-0003', recordId: '1027', combination: '6504', label: 'Vault Charlie' },
  { serial: 'BESA-0004', recordId: '1038', combination: '2719', label: 'Vault Delta' },
]
