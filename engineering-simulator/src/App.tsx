import { useState } from 'react'
import type { AnyScenario } from './core/scenario'
import { HostFlow } from './multiplayer/ui/HostFlow'
import { StudentFlow } from './multiplayer/ui/StudentFlow'
import { scenarios } from './scenarios/registry'
import { IntroModal } from './shell/IntroModal'
import { Sandbox } from './shell/Sandbox'
import { StartScreen } from './shell/StartScreen'

type Mode = { kind: 'start' } | { kind: 'solo'; scenario: AnyScenario; intro: boolean } | { kind: 'join'; code: string } | { kind: 'host' }

/**
 * URL shortcuts: `?play` / `?play=traffic` opens a solo challenge, `?join=123456` opens the join
 * form with the code filled in, `?host` opens the instructor screen.
 */
function initialMode(): Mode {
  const q = new URLSearchParams(location.search)
  if (q.has('join')) return { kind: 'join', code: (q.get('join') ?? '').replace(/\D/g, '').slice(0, 6) }
  if (q.has('host')) return { kind: 'host' }
  const play = q.get('play')
  if (play !== null) return { kind: 'solo', scenario: scenarios.find((s) => s.id === play) ?? scenarios[0], intro: false }
  return { kind: 'start' }
}

export default function App() {
  const [mode, setMode] = useState<Mode>(initialMode)
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
          onStart={(s) => setMode({ kind: 'solo', scenario: s, intro: true })}
          onJoin={() => setMode({ kind: 'join', code: '' })}
          onHost={() => setMode({ kind: 'host' })}
        />
      )
  }
}
