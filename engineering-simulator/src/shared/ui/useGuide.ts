import { useState } from 'react'

export type GuidePageId = 'challenge' | 'station'
type Page = GuidePageId

const key = (scenarioId: string) => `guide-seen:${scenarioId}`

function loadSeen(scenarioId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key(scenarioId)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/**
 * Guide state for one scenario. It opens by itself the first time a player reaches a station
 * (on "The challenge" if they haven't read that yet), and `show` opens it any time.
 */
export function useGuide(scenarioId: string, stationId: string, enabled: boolean) {
  const [seen, setSeen] = useState(() => loadSeen(scenarioId))
  const [manual, setManual] = useState<Page | null>(null)
  const auto: Page | null = !enabled ? null : !seen.has('challenge') ? 'challenge' : !seen.has(stationId) ? 'station' : null
  const page = enabled ? (manual ?? auto) : null
  const close = () => {
    const next = new Set(seen).add('challenge').add(stationId)
    try {
      localStorage.setItem(key(scenarioId), JSON.stringify([...next]))
    } catch {
      /* private mode: it opens again next visit */
    }
    setSeen(next)
    setManual(null)
  }
  return { page, show: (p: Page = 'station') => setManual(p), close }
}
