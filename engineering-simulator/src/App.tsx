import { useState } from 'react'
import type { AnyScenario } from './core/scenario'
import { scenarios } from './scenarios/registry'
import { IntroModal } from './shell/IntroModal'
import { Sandbox } from './shell/Sandbox'
import { StartScreen } from './shell/StartScreen'

export default function App() {
  // `?play` skips straight into the first scenario; `?play=traffic` picks one by id.
  const [scenario, setScenario] = useState<AnyScenario | null>(() => {
    const play = new URLSearchParams(location.search).get('play')
    if (play === null) return null
    return scenarios.find((s) => s.id === play) ?? scenarios[0]
  })
  const [intro, setIntro] = useState(false)

  if (!scenario)
    return (
      <StartScreen
        scenarios={scenarios}
        onStart={(s) => {
          setScenario(s)
          setIntro(true)
        }}
      />
    )

  return (
    <div className="relative h-full">
      <Sandbox key={scenario.id} scenario={scenario} onExit={() => setScenario(null)} />
      {intro && <IntroModal scenario={scenario} onDone={() => setIntro(false)} />}
    </div>
  )
}
