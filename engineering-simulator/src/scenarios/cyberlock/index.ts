import { ShieldAlert } from 'lucide-react'
import type { Scenario, SimRun } from '../../core/scenario'
import { CyberlockCardArt } from './CardArt'
import { CyberlockWorld } from './CyberlockWorld'

export interface CyberlockObject {
  id: string
  kind: string
}

export interface CyberlockResult {
  unlocked: boolean
}

class CyberlockSimRun implements SimRun<CyberlockResult> {
  readonly totalTicks = 1
  readonly intensity = 0.5
  readonly done = true
  readonly progress = 1
  step() {
    return false
  }
  result(): CyberlockResult {
    return { unlocked: true }
  }
}

function DummyProperties() {
  return null
}

export const cyberlockScenario: Scenario<CyberlockObject, CyberlockResult> = {
  id: 'cyberlock',
  title: 'CyberLock: Operation Vaultbreak',
  discipline: 'Cybersecurity + Systems Engineering',
  tagline:
    'Investigate VaultTech systems, uncover predictable credentials, exploit broken access controls, and decode the 4-digit code for your physical lockbox.',
  intro: {
    heading: 'CyberLock: Operation Vaultbreak',
    paragraphs: [
      'Welcome to the BESA Cybersecurity CTF challenge!',
      'Your team has received a physical 3D-printed lockbox with a 4-digit combination lock and a unique serial number.',
      'Investigate VaultTech’s company directory, discover predictable credentials, exploit Insecure Direct Object References (IDOR), and decode raw hexadecimal bytes to unlock your physical lockbox and claim your prize.',
    ],
  },
  instructions: [
    'Enter your physical lockbox serial number (e.g. BESA-0005) to initialize your team’s investigation.',
    'Investigate public staff profiles and press releases to discover internal portal credentials.',
    'Find your lockbox internal record ID in the shipping manifest and exploit IDOR via the address bar.',
    'Decode the hexadecimal ASCII byte stream to recover your physical 4-digit combination!',
  ],
  budget: 500, // Points budget / max score
  minimalShell: true,
  runLabel: 'Inspect Telemetry',
  variants: [
    { id: 'standard', label: 'Field Lockbox CTF', blurb: '3-stage cybersecurity investigation' },
  ],
  tools: [
    {
      id: 'terminal',
      label: 'Security Terminal',
      icon: ShieldAlert,
      accent: '#f29813',
      priceLabel: 'CTF Mission',
      summary: 'Investigate vulnerabilities, exploit access controls, and decode lock combinations.',
      placement: 'point',
    },
  ],
  requirements: [
    {
      id: 'credentials',
      label: 'Portal Access',
      passLabel: 'Access Granted',
      target: 'Authenticated',
      status: () => ({ value: 'Authenticated', pass: true }),
    },
    {
      id: 'idor',
      label: 'Access Control',
      passLabel: 'Vulnerability Discovered',
      target: 'Record Retrieved',
      status: () => ({ value: 'IDOR Exploited', pass: true }),
    },
    {
      id: 'combination',
      label: 'Vault Combination',
      passLabel: 'Combination Verified',
      target: '4-Digit Code',
      status: () => ({ value: 'Code Unlocked', pass: true }),
    },
  ],
  initialDesign: () => [],
  cost: () => 0,
  remove: (d) => d,
  createRun: () => new CyberlockSimRun(),
  observations: () => ['Review your cybersecurity telemetry and verify your physical lockbox.'],
  stats: () => [
    { label: 'Investigation Time', value: '15 min' },
    { label: 'Security Track', value: 'OWASP Top 10' },
  ],
  summary: () => 'Physical Lockbox Cybersecurity CTF',
  World: CyberlockWorld,
  Properties: DummyProperties,
  CardArt: CyberlockCardArt,
}
