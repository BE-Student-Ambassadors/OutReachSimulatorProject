/**
 * Core type definitions for CyberLock — Operation Vaultbreak
 */

export type ChallengeStage = 'onboarding' | 'challenge1' | 'challenge2' | 'challenge3' | 'success'

export interface LockboxConfig {
  serial: string // e.g. "BESA-0427"
  recordId: string // e.g. "1003"
  combination: string // 4 digits, e.g. "4826"
  label?: string
}

export interface VaultRecord {
  id: string
  title: string
  classification: 'Public' | 'Internal' | 'Restricted'
  isRestricted: boolean
  accessAllowedInUI: boolean
  content: string
  serial?: string
  hexPayload?: string
  encodingFormat?: string
  timestamp: string
}

export interface ShippingManifestEntry {
  serial: string
  recordId: string
  assetName: string
  destination: string
  status: 'In Transit' | 'Dispatched' | 'Delivered' | 'Quarantined'
  classification: 'Standard' | 'Restricted' | 'Classified'
  dispatchDate: string
}

export interface EmployeeProfile {
  id: string
  username: string
  name: string
  role: string
  department: string
  email: string
  location: string
  bio: string
  joinedYear: number
  keyProjects: string[]
  securityHintQuestion: string
  securityHintAnswer: string
}

export interface HintItem {
  id: string
  challenge: 'challenge1' | 'challenge2' | 'challenge3'
  level: 1 | 2 | 3
  title: string
  content: string
  pointsDeducted: number
}

export interface ScoreState {
  c1Points: number // default 100
  c2Points: number // default 200
  c3Points: number // default 150
  physicalLockBonus: number // default 50
  hintsUsed: string[] // IDs of revealed hints
  hintPenalties: number // 25 per hint
  total: number
}

export interface SessionData {
  sessionId: string
  serial: string
  teamName: string
  currentStage: ChallengeStage
  completedStages: ChallengeStage[]
  revealedHints: string[]
  startTime: number
  completionTime: number | null
  targetRecordId: string
  physicalLockOpened: boolean
}
