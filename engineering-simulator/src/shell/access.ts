/**
 * Solo practice is locked behind an access code, so the challenges stay with the visit
 * unless BESA hands the code out. Live games need no code (they need a running session,
 * and only instructors can start one).
 *
 * Codes come from VITE_ACCESS_CODES (comma-separated, set in the Vercel project) and default
 * to ACCESS_CODE_DEFAULT. Changing the codes and redeploying locks out every browser that
 * unlocked with an old one. This is a front-end lock: it keeps casual visitors out, not a
 * determined one.
 *
 * Unlock by typing the code on the start screen or with a link: `?access=CODE`.
 */

const ACCESS_CODE_DEFAULT = 'BESALAB'
const STORAGE_KEY = 'besa-access-code'

/** Case, spaces and dashes don't matter: "besa-lab" works for BESALAB. */
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')

const validCodes = (import.meta.env.VITE_ACCESS_CODES ?? ACCESS_CODE_DEFAULT).split(',').map(normalizeCode).filter(Boolean)

export const isAccessCode = (code: string) => validCodes.includes(normalizeCode(code))

export function hasAccess(): boolean {
  try {
    return isAccessCode(localStorage.getItem(STORAGE_KEY) ?? '')
  } catch {
    return false
  }
}

/** Remembers a valid code in this browser. Returns whether it was valid. */
export function unlock(code: string): boolean {
  if (!isAccessCode(code)) return false
  try {
    localStorage.setItem(STORAGE_KEY, normalizeCode(code))
  } catch {
    /* private mode: unlocked for this visit only */
  }
  return true
}

/**
 * Reads `?access=CODE` from the address bar, unlocks if it is right, and removes it from the
 * URL so the code isn't left on screen. Returns whether solo practice is unlocked.
 */
export function unlockFromUrl(): boolean {
  const q = new URLSearchParams(location.search)
  const code = q.get('access')
  if (code === null) return hasAccess()
  q.delete('access')
  const rest = q.toString()
  history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`)
  return unlock(code) || hasAccess()
}
