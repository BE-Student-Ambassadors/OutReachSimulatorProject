/**
 * Remembers which live game this browser is in, so a refresh (or closing and reopening
 * the tab) drops the student or host straight back into it. localStorage survives tab
 * closes; it can be unavailable (private mode), so every access is guarded.
 */
type Role = 'student' | 'host'
const key = (role: Role) => `sel-${role}-session`

export function savedGame(role: Role): string | null {
  try {
    return localStorage.getItem(key(role))
  } catch {
    return null
  }
}

export function saveGame(role: Role, sid: string | null) {
  try {
    if (sid) localStorage.setItem(key(role), sid)
    else localStorage.removeItem(key(role))
  } catch {
    /* private mode: the student can rejoin with the code */
  }
}
