import { Sandbox } from './shell/Sandbox'
import { scenarios } from './scenarios/registry'

export default function App() {
  return <Sandbox scenario={scenarios[0]} />
}
