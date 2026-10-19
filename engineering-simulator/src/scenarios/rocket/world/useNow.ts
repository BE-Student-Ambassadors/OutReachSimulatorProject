import { useEffect, useState } from 'react'

/** Wall-clock time that ticks while `active` (e.g. parcels in transit). */
export function useNow(active: boolean, ms = 500): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [active, ms])
  return now
}
