import type { BossAttackType, BossStateId } from '../types/project'

export interface BossStateSpec {
  id: BossStateId
  name: string
  color: string
  description: string
  badgeText: string
}

export const BOSS_STATES: Record<BossStateId, BossStateSpec> = {
  IDLE: {
    id: 'IDLE',
    name: 'Idle / Guard',
    color: '#64748b',
    description: 'Scanning the battlefield for the hero.',
    badgeText: 'Scanning',
  },
  DETECT: {
    id: 'DETECT',
    name: 'Detect Target',
    color: '#eab308',
    description: 'Hero detected within detection range. Locks on.',
    badgeText: 'Alerted',
  },
  CHASE: {
    id: 'CHASE',
    name: 'Chase Target',
    color: '#f97316',
    description: 'Closing the distance towards the hero at chase speed.',
    badgeText: 'Pursuing',
  },
  WINDUP: {
    id: 'WINDUP',
    name: 'Attack Windup',
    color: '#ef4444',
    description: 'Telegraphs attack zone. Hero has time to dodge or reposition.',
    badgeText: 'Telegraphing',
  },
  ATTACK: {
    id: 'ATTACK',
    name: 'Execute Attack',
    color: '#dc2626',
    description: 'Unleashes damage hitbox in the telegraphed zone.',
    badgeText: 'Striking',
  },
  RECOVER: {
    id: 'RECOVER',
    name: 'Recovery Window',
    color: '#10b981',
    description: 'Vulnerable and immobile. Optimal moment for the hero to attack!',
    badgeText: 'Exhausted',
  },
  RETREAT: {
    id: 'RETREAT',
    name: 'Tactical Retreat',
    color: '#8b5cf6',
    description: 'Health dropped below retreat threshold; retreats to safety.',
    badgeText: 'Backing Off',
  },
  REPOSITION: {
    id: 'REPOSITION',
    name: 'Reposition',
    color: '#06b6d4',
    description: 'Circles the hero to find a clear attack angle.',
    badgeText: 'Flanking',
  },
}

export interface BossAttackSpec {
  id: BossAttackType
  name: string
  description: string
  shape: 'arc' | 'circle' | 'projectiles'
  hitboxRadius: number
  color: string
}

export const BOSS_ATTACK_SPECS: Record<BossAttackType, BossAttackSpec> = {
  heavy_cleave: {
    id: 'heavy_cleave',
    name: 'Titan Cleave',
    description: 'Wide 130° frontal arc slice (~100px range). Heavy damage in front of boss.',
    shape: 'arc',
    hitboxRadius: 100,
    color: '#ef4444',
  },
  slam_shockwave: {
    id: 'slam_shockwave',
    name: 'Earthquake Slam',
    description: '360° circular shockwave (~120px radius). Knocks hero back if caught inside.',
    shape: 'circle',
    hitboxRadius: 120,
    color: '#f59e0b',
  },
  fireball_spray: {
    id: 'fireball_spray',
    name: 'Energy Salvo',
    description: 'Launches 3 spreading plasma fireballs in a forward cone.',
    shape: 'projectiles',
    hitboxRadius: 350,
    color: '#ec4899',
  },
}

export interface DebuggingChallenge {
  id: string
  title: string
  difficulty: 'Easy' | 'Moderate'
  symptom: string
  description: string
  hints: string[]
  buggyConfig: {
    attackRange: number
    detectionRange: number
    recoveryDuration: number
    attackWindup: number
  }
  isResolved: (config: {
    attackRange: number
    detectionRange: number
    recoveryDuration: number
    attackWindup: number
  }) => boolean
}

export const DEBUG_CHALLENGES: DebuggingChallenge[] = [
  {
    id: 'zero_recovery',
    title: 'The Relentless Loop Glitch',
    difficulty: 'Easy',
    symptom: 'Boss immediately attacks without any recovery window, making the fight unfair and nearly impossible.',
    description: 'Game testers reported that the boss never rests after striking. Inspect the Recovery Duration block.',
    hints: [
      'Look at the Recovery Duration setting in the boss behavior.',
      'A fair boss should rest for at least 0.5s after attacking so players can counter-attack.',
      'Increase Recovery Duration to 0.6s or higher.',
    ],
    buggyConfig: {
      attackRange: 80,
      detectionRange: 350,
      recoveryDuration: 0.1,
      attackWindup: 0.7,
    },
    isResolved: (cfg) => cfg.recoveryDuration >= 0.5,
  },
  {
    id: 'phantom_reach',
    title: 'The Phantom Reach Bug',
    difficulty: 'Moderate',
    symptom: 'Boss attacks from across the room before detecting the hero, or attacks out of range.',
    description: 'The boss attack trigger fires when the hero is too far away. Attack Range should not exceed Detection Range.',
    hints: [
      'Compare Attack Range with Detection Range.',
      'How can a boss attack a hero that it has not even detected yet?',
      'Ensure Attack Range is smaller than Detection Range, and within reasonable melee/cleave distance (<= 140px).',
    ],
    buggyConfig: {
      attackRange: 380,
      detectionRange: 200,
      recoveryDuration: 0.9,
      attackWindup: 0.7,
    },
    isResolved: (cfg) => cfg.attackRange <= 140 && cfg.attackRange < cfg.detectionRange,
  },
]
