import { useState } from 'react'
import type { AnyScenario } from './core/scenario'
import { savedGame } from './multiplayer/saved'
import { HostFlow } from './multiplayer/ui/HostFlow'
import { StudentFlow } from './multiplayer/ui/StudentFlow'
import { scenarios } from './scenarios/registry'
import { unlock, unlockFromUrl } from './shell/access'
import { IntroModal } from './shell/IntroModal'
import { Sandbox } from './shell/Sandbox'
import { StartScreen } from './shell/StartScreen'

type Mode = { kind: 'start' } | { kind: 'solo'; scenario: AnyScenario; intro: boolean } | { kind: 'join'; code: string } | { kind: 'host' }

/** Read once, before the first render: `?access=CODE` unlocks solo practice (see shell/access). */
const unlockedAtStart = unlockFromUrl()

/**
 * URL shortcuts: `?play` / `?play=fsae` opens a solo challenge (once unlocked), `?join=123456`
 * opens the join form with the code filled in, `?host` opens the instructor screen.
 */
function initialMode(): Mode {
  const q = new URLSearchParams(location.search)
  if (q.has('join')) return { kind: 'join', code: (q.get('join') ?? '').replace(/\D/g, '').slice(0, 6) }
  if (q.has('host')) return { kind: 'host' }
  // A refresh (or reopened tab) goes straight back into a live game this browser is in.
  if (savedGame('student')) return { kind: 'join', code: '' }
  if (savedGame('host')) return { kind: 'host' }
  const play = q.get('play')
  if (play !== null && unlockedAtStart) return { kind: 'solo', scenario: scenarios.find((s) => s.id === play) ?? scenarios[0], intro: false }
  return { kind: 'start' }
}

export default function App() {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [unlocked, setUnlocked] = useState(unlockedAtStart)
  const home = () => {
    history.replaceState(null, '', location.pathname)
    setMode({ kind: 'start' })
  }

  switch (mode.kind) {
    case 'join':
      return <StudentFlow scenarios={scenarios} initialCode={mode.code} onExit={home} />
    case 'host':
      return <HostFlow scenarios={scenarios} onExit={home} />
    case 'solo':
      return (
        <div className="relative h-full">
          <Sandbox key={mode.scenario.id} scenario={mode.scenario} onExit={home} />
          {mode.intro && <IntroModal scenario={mode.scenario} onDone={() => setMode({ ...mode, intro: false })} />}
        </div>
      )
    default:
      return (
        <StartScreen
          scenarios={scenarios}
          unlocked={unlocked}
          onUnlock={(code) => {
            const ok = unlock(code)
            if (ok) setUnlocked(true)
            return ok
          }}
          onStart={(s) => setMode({ kind: 'solo', scenario: s, intro: true })}
          onJoin={() => setMode({ kind: 'join', code: '' })}
          onHost={() => setMode({ kind: 'host' })}
        />
      )
  }
}
