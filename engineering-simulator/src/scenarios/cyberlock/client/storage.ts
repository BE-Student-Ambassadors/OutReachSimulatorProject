/**
 * CyberLock State Persistence
 *
 * Saves team progress, stage, score, and revealed hints.
 * Note: Never persists combinations or solution keys.
 */

import type { ScoreState, SessionData } from '../types'

const SESSION_KEY = 'besa_cyberlock_session_v1'
const SCORE_KEY = 'besa_cyberlock_score_v1'

export function loadSavedSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionData
  } catch {
    return null
  }
}

export function saveSession(session: SessionData): void {
  try {
    const json = JSON.stringify(session)
    sessionStorage.setItem(SESSION_KEY, json)
    localStorage.setItem(SESSION_KEY, json)
  } catch {
    // ignore quota errors
  }
}

export function clearSavedSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SCORE_KEY)
    localStorage.removeItem(SCORE_KEY)
  } catch {
    // ignore
  }
}

export function loadSavedScore(): ScoreState | null {
  try {
    const raw = sessionStorage.getItem(SCORE_KEY) || localStorage.getItem(SCORE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScoreState
  } catch {
    return null
  }
}

export function saveScore(score: ScoreState): void {
  try {
    const json = JSON.stringify(score)
    sessionStorage.setItem(SCORE_KEY, json)
    localStorage.setItem(SCORE_KEY, json)
  } catch {
    // ignore
  }
}
