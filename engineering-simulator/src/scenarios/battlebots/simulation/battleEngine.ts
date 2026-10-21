import { type PlayerInput, createDefaultPlayerInput } from './playerInput';
import * as THREE from 'three';
import { getBossById } from '../data/bosses';
import { calculateEngineeringStats } from './engineering';
import {
  type AutonomousStrategy,
  type BattleAnalysisReport,
  type BattleEventLog,
  type BehaviorRule,
  type BossDossier,
  type BossId,
  type CombatantTelemetry,
  type EngineeringStats,
  type RobotConfiguration,
  type SparkBurst,
  type CombatImpactEvent,
  type ImpactSeverity,
  type DamageSeverity,
  type AttackClassification,
  type WedgeTelemetry,
  type WedgeCondition,
} from '../types/robot';

import {
  type BoxCollider2D,
  type WeaponContactZone,
  getRobotCollisionModel,
  testOBBOBB,
  testWeaponChassisContact,
} from './collisionGeometry';

export const ARENA_HALF_SIZE = 5.6; // 11.2m x 11.2m enclosed combat arena

// ============================================================================
// GAMEPLAY COMBAT IMPACT TUNING CONSTANTS
// Physics quantities (mass, energy, momentum) provide the authentic foundation,
// while these explicit gameplay multipliers amplify readable displacement & rotation.
// ============================================================================
export const WEAPON_IMPACT_RESPONSE_SCALE = 2.6; // Multiplier amplifying kinetic weapon knockback and recoil
export const CHASSIS_RAM_RESPONSE_SCALE = 1.85;  // Multiplier amplifying high-speed ram impulses
export const ANGULAR_IMPULSE_SCALE = 2.4;        // Multiplier amplifying off-center torque and yaw response
export const SEPARATION_BUFFER_METERS = 0.35;    // Instant displacement buffer on weapon strike to prevent immediate overlap

export interface LiveBattleSimulation {
  playerInput?: PlayerInput;
  isManual?: boolean;
  timeSec: number;
  maxDurationSec: number;
  isFinished: boolean;
  winner: 'player' | 'bull' | 'boss' | null;
  winReason: string;
  strategy: AutonomousStrategy;
  bossId: BossId;
  bossDossier: BossDossier;
  playerConfig: RobotConfiguration;
  playerStats: EngineeringStats;
  bossStats: EngineeringStats;

  player: CombatantTelemetry;
  boss: CombatantTelemetry;
  // Bull alias for backward compatibility with existing telemetry / UI
  bull: CombatantTelemetry;

  events: BattleEventLog[];
  sparks: SparkBurst[];
  nextEventId: number;
  nextSparkId: number;

  // Combat tracking
  contactCooldownSec: number;
  grabTimerSec: number;
  bossStunTimerSec: number;
  playerStunTimerSec: number;
  bossChargeCooldownSec: number;
  bossChargeActiveSec: number;
  bossRepositionTimerSec: number;
  weaponAtSpeedAnnounced: boolean;
  tempWarningAnnounced: boolean;
  powerLimitAnnounced: boolean;
  softwareRules?: BehaviorRule[];
  electricalLimiterA?: number;
  coolingTempReductionC?: number;

  // Post-battle counters
  impactsDelivered: number;
  lateralImpactsTaken: number;
  flipsInflicted: number;
  playerPushTimeSec: number;
  bossPushTimeSec: number;
  bullPushTimeSec: number;
  peakMotorTempC: number;
  cameraImpactShake: number;

  // Authoritative Impact Pipeline
  lastImpactEvent?: CombatImpactEvent | null;
  recentImpactEvents: CombatImpactEvent[];
  nextImpactEventId: number;
  contactActive: boolean;
  lastImpactTimeSec: number;
  sustainedWeaponContactSec: number;
  lastAttackerSeparationSec: number;

  // Bull Wedge Dynamics (Section 2 & 17)
  wedgePhase: 'none' | 'initial' | 'riding' | 'disengaging';
  wedgeTimerSec: number;
  lastWedgeTelemetry?: WedgeTelemetry | null;

  // Bull Pushing Fatigue & Attack Patterns (Gameplay Balance)
  bullPushSustainedSec: number;
  bullAttackPattern: 'direct' | 'angled' | 'shove' | 'stalk';
  bullPatternTimerSec: number;

  // Hitbox Developer Debug Data
  debugHitboxes?: {
    playerChassis: BoxCollider2D;
    bossChassis: BoxCollider2D;
    playerWeapon: WeaponContactZone;
    bossWeapon: WeaponContactZone;
    contactPoint: [number, number] | null;
    contactNormal: [number, number] | null;
    hasContact: boolean;
  };
}

export function getWedgeCondition(frontArmorPct: number): WedgeCondition {
  if (frontArmorPct >= 75) return 'healthy';
  if (frontArmorPct >= 45) return 'damaged';
  if (frontArmorPct >= 20) return 'heavily-damaged';
  return 'critical';
}

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function compressKineticDamageEnergy(rawEnergyJ: number): number {
  if (rawEnergyJ <= 0) return 0;
  if (rawEnergyJ <= 800) {
    return rawEnergyJ;
  }
  // Smooth logarithmic saturation above 800 J with characteristic scale 700 J
  return 800 + 700 * Math.log(1 + (rawEnergyJ - 800) / 700);
}

export function createCombatImpactEvent(
  sim: LiveBattleSimulation,
  point: [number, number],
  normal: [number, number],
  relativeVelocity: number,
  impulse: number,
  type: 'chassis' | 'weapon' | 'wall',
  sourceRobot: 'player' | 'boss' | 'wall',
  targetRobot: 'player' | 'boss',
  weaponEnergyJ = 0,
  targetDeltaV?: number,
  targetDeltaOmega?: number,
  tractionBreakDurationSec?: number,
  hitSector?: 'front' | 'corner' | 'side' | 'rear',
  rawDamage?: number,
  armorMitigation?: number,
  finalDamage?: number,
  extra?: {
    damageSeverity?: DamageSeverity;
    attackClassification?: AttackClassification;
    attackType?: string;
    weaponRpmBefore?: number;
    weaponEnergyBefore?: number;
    weaponRpmAfter?: number;
    weaponEnergyAfter?: number;
    armorAbsorbed?: number;
    componentDamage?: number;
    targetHealthBefore?: number;
    targetHealthAfter?: number;
    attackerReactionImpulse?: number;
    attackerDeltaV?: number;
    attackerDeltaOmega?: number;
  }
): CombatImpactEvent {
  let severityScore = (impulse / 190) * 0.45 + (relativeVelocity / 8.5) * 0.25;
  if (type === 'weapon' && weaponEnergyJ > 0) {
    severityScore += Math.min(0.65, (weaponEnergyJ / 2400) * 0.55);
  }
  if (type === 'wall') {
    severityScore = Math.min(1.0, (relativeVelocity / 6.0) * 0.7 + (impulse / 160) * 0.3);
  }

  const severity01 = THREE.MathUtils.clamp(severityScore, 0, 1);
  let severity: ImpactSeverity = 'tiny';
  let hitstopMs = 0;

  if (severity01 >= 0.75) {
    severity = 'major';
    hitstopMs = type === 'weapon' ? 60 : 40;
  } else if (severity01 >= 0.44) {
    severity = 'heavy';
    hitstopMs = type === 'weapon' ? 30 : 18;
  } else if (severity01 >= 0.16) {
    severity = 'normal';
    hitstopMs = type === 'weapon' ? 12 : 0;
  } else {
    severity = 'tiny';
    hitstopMs = 0;
  }

  // Derive DamageSeverity (decoupled from physical ImpactSeverity)
  let damageSeverity: DamageSeverity = extra?.damageSeverity ?? 'minimal';
  if (!extra?.damageSeverity) {
    const fd = finalDamage ?? 0;
    if (fd >= 22) damageSeverity = 'critical';
    else if (fd >= 14) damageSeverity = 'severe';
    else if (fd >= 7) damageSeverity = 'high';
    else if (fd >= 2.5) damageSeverity = 'moderate';
    else damageSeverity = 'minimal';
  }

  // Derive AttackClassification
  let attackClassification: AttackClassification = extra?.attackClassification ?? 'NEW_STRIKE';
  if (!extra?.attackClassification) {
    if (type === 'wall') {
      attackClassification = 'WALL_IMPACT';
    } else if (type === 'chassis' && relativeVelocity < 0.95) {
      attackClassification = 'SUSTAINED_CONTACT';
    } else {
      attackClassification = 'NEW_STRIKE';
    }
  }

  const event: CombatImpactEvent = {
    id: sim.nextImpactEventId++,
    timeSec: Number(sim.timeSec.toFixed(2)),
    point,
    normal,
    relativeVelocity: Number(relativeVelocity.toFixed(2)),
    impulse: Number(impulse.toFixed(1)),
    severity,
    severity01: Number(severity01.toFixed(3)),
    damageSeverity,
    attackClassification,
    attackType: extra?.attackType ?? type,
    type,
    sourceRobot,
    targetRobot,
    weaponEnergyJ: weaponEnergyJ > 0 ? Math.round(weaponEnergyJ) : undefined,
    hitstopMs,
    targetDeltaV: targetDeltaV !== undefined ? Number(targetDeltaV.toFixed(2)) : undefined,
    targetDeltaOmega: targetDeltaOmega !== undefined ? Number(targetDeltaOmega.toFixed(2)) : undefined,
    attackerReactionImpulse: extra?.attackerReactionImpulse !== undefined ? Number(extra.attackerReactionImpulse.toFixed(1)) : undefined,
    attackerDeltaV: extra?.attackerDeltaV !== undefined ? Number(extra.attackerDeltaV.toFixed(2)) : undefined,
    attackerDeltaOmega: extra?.attackerDeltaOmega !== undefined ? Number(extra.attackerDeltaOmega.toFixed(2)) : undefined,
    weaponRpmBefore: extra?.weaponRpmBefore !== undefined ? Number(extra.weaponRpmBefore.toFixed(1)) : undefined,
    weaponEnergyBefore: extra?.weaponEnergyBefore !== undefined ? Math.round(extra.weaponEnergyBefore) : undefined,
    weaponRpmAfter: extra?.weaponRpmAfter !== undefined ? Number(extra.weaponRpmAfter.toFixed(1)) : undefined,
    weaponEnergyAfter: extra?.weaponEnergyAfter !== undefined ? Math.round(extra.weaponEnergyAfter) : undefined,
    tractionBreakDurationSec: tractionBreakDurationSec !== undefined ? Number(tractionBreakDurationSec.toFixed(3)) : undefined,
    hitSector,
    rawDamage: rawDamage !== undefined ? Number(rawDamage.toFixed(1)) : undefined,
    armorMitigation: armorMitigation !== undefined ? Number(armorMitigation.toFixed(2)) : undefined,
    armorAbsorbed: extra?.armorAbsorbed !== undefined ? Number(extra.armorAbsorbed.toFixed(1)) : undefined,
    componentDamage: extra?.componentDamage !== undefined ? Number(extra.componentDamage.toFixed(1)) : undefined,
    finalDamage: finalDamage !== undefined ? Number(finalDamage.toFixed(1)) : undefined,
    targetHealthBefore: extra?.targetHealthBefore !== undefined ? Number(extra.targetHealthBefore.toFixed(1)) : undefined,
    targetHealthAfter: extra?.targetHealthAfter !== undefined ? Number(extra.targetHealthAfter.toFixed(1)) : undefined,
  };

  if (severity !== 'tiny' || !sim.lastImpactEvent || sim.timeSec - sim.lastImpactEvent.timeSec > 0.25) {
    sim.lastImpactEvent = event;
  }
  sim.recentImpactEvents.unshift(event);
  if (sim.recentImpactEvents.length > 10) {
    sim.recentImpactEvents.pop();
  }

  // 1. White emissive flash on struck bot
  const target = targetRobot === 'player' ? sim.player : sim.boss;
  if (severity === 'major') {
    target.impactFlashIntensity = 1.0;
  } else if (severity === 'heavy') {
    target.impactFlashIntensity = Math.max(target.impactFlashIntensity, 0.75);
  } else if (severity === 'normal') {
    target.impactFlashIntensity = Math.max(target.impactFlashIntensity, 0.35);
  }

  // 2. Camera impact shake
  const shakeContribution = severity === 'major' ? 0.95 : severity === 'heavy' ? 0.50 : severity === 'normal' ? 0.18 : 0;
  sim.cameraImpactShake = Math.min(1.0, Math.max(sim.cameraImpactShake, shakeContribution));

  // 3. Directional spark burst ejected from contact point
  const sparkCount = severity === 'major' ? 16 : severity === 'heavy' ? 9 : severity === 'normal' ? 4 : 0;
  if (sparkCount > 0) {
    const sparkColor =
      type === 'wall'
        ? '#38bdf8'
        : type === 'weapon'
        ? (severity === 'major' ? '#ffffff' : '#fde047')
        : '#fbbf24';

    const baseNx = normal[0];
    const baseNz = normal[1];

    for (let i = 0; i < sparkCount; i++) {
      const spreadAngle = (Math.random() - 0.5) * 1.1;
      const cosA = Math.cos(spreadAngle);
      const sinA = Math.sin(spreadAngle);
      const dirX = baseNx * cosA - baseNz * sinA;
      const dirZ = baseNx * sinA + baseNz * cosA;
      const speed = (2.2 + Math.random() * 4.5) * (0.6 + severity01 * 0.8);

      sim.sparks.push({
        id: sim.nextSparkId++,
        x: point[0] + (Math.random() - 0.5) * 0.08,
        y: 0.25 + Math.random() * 0.15,
        z: point[1] + (Math.random() - 0.5) * 0.08,
        color: sparkColor,
        intensity: 1.2 + severity01 * 2.2,
        age: 0,
        vx: dirX * speed,
        vy: 1.2 + Math.random() * 2.0,
        vz: dirZ * speed,
        maxAge: 0.25 + Math.random() * 0.15,
      });
    }

    if (severity === 'major') {
      for (let d = 0; d < 3; d++) {
        const spreadAngle = (Math.random() - 0.5) * 1.4;
        const dirX = baseNx * Math.cos(spreadAngle) - baseNz * Math.sin(spreadAngle);
        const dirZ = baseNx * Math.sin(spreadAngle) + baseNz * Math.cos(spreadAngle);
        sim.sparks.push({
          id: sim.nextSparkId++,
          x: point[0],
          y: 0.3,
          z: point[1],
          color: '#64748b',
          intensity: 1.0,
          age: 0,
          vx: dirX * (1.8 + Math.random() * 2.5),
          vy: 2.2 + Math.random() * 1.5,
          vz: dirZ * (1.8 + Math.random() * 2.5),
          maxAge: 0.42,
          isDebris: true,
        });
      }
    }
  }

  return event;
}

function applyCombatDamage(
  sim: LiveBattleSimulation,
  targetBot: CombatantTelemetry,
  isPlayerBot: boolean,
  rawDamage: number,
  sector: 'front' | 'corner' | 'side' | 'rear',
  isKineticStrike: boolean
): {
  finalHullDmg: number;
  finalArmorDmg: number;
  effectiveMitigation: number;
  armorAbsorbed: number;
  componentDmg: number;
  damageSeverity: DamageSeverity;
  targetHealthBefore: number;
  targetHealthAfter: number;
} {
  const stats = isPlayerBot ? sim.playerStats : sim.bossStats;
  const targetHealthBefore = targetBot.hullIntegrityPct;
  const effectiveArmor =
    sector === 'front' || sector === 'corner'
      ? stats.frontArmorScore
      : sector === 'side'
      ? stats.sideArmorScore
      : stats.rearArmorScore;

  // Progressive wedge durability degradation (Wedge Condition)
  const currentCondition = getWedgeCondition(targetBot.frontArmorPct);
  let mitigationMult = 1.0;
  if (currentCondition === 'healthy') {
    mitigationMult = 1.0;
  } else if (currentCondition === 'damaged') {
    mitigationMult = 0.88;
  } else if (currentCondition === 'heavily-damaged') {
    mitigationMult = 0.72;
  } else {
    // critical
    mitigationMult = 0.55;
  }

  const effectiveMitigation = Math.max(0.40, (effectiveArmor / 65) * mitigationMult);

  let finalArmorDmg = 0;
  let finalHullDmg = 0;
  let armorAbsorbed = 0;
  let componentDmg = 0;

  if (sector === 'front' || sector === 'corner') {
    const isCorner = sector === 'corner';
    const armorWearMult = isCorner ? 1.15 : 1.05;
    finalArmorDmg = (rawDamage * armorWearMult) / effectiveMitigation;
    targetBot.frontArmorPct = Math.max(0, targetBot.frontArmorPct - finalArmorDmg);

    // Armor absorbs damage first while intact
    const armorHealthFrac = Math.min(1.0, targetBot.frontArmorPct / 100);
    const armorAbsorbedRatio = 0.65 + armorHealthFrac * 0.15;
    armorAbsorbed = rawDamage * armorAbsorbedRatio;
    const passThroughRatio = (1.0 - armorAbsorbedRatio) * (isCorner ? 1.15 : 0.85);

    if (targetBot.frontArmorPct < 35 || isKineticStrike) {
      const weaponDmg = (rawDamage * 0.35) / effectiveMitigation;
      targetBot.weaponHealthPct = Math.max(0, targetBot.weaponHealthPct - weaponDmg);
      componentDmg = weaponDmg;
    }

    finalHullDmg = (rawDamage * passThroughRatio) / effectiveMitigation;
    targetBot.hullIntegrityPct = Math.max(0, targetBot.hullIntegrityPct - finalHullDmg);

    // Update wedge condition & physical deformation
    targetBot.wedgeCondition = getWedgeCondition(targetBot.frontArmorPct);
    const lostArmor = 100 - targetBot.frontArmorPct;
    targetBot.wedgeDeformationMm = Math.min(35, lostArmor * 0.35);
  } else if (sector === 'side') {
    finalArmorDmg = (rawDamage * 1.25) / effectiveMitigation;
    targetBot.sideArmorPct = Math.max(0, targetBot.sideArmorPct - finalArmorDmg);

    const armorHealthFrac = Math.min(1.0, targetBot.sideArmorPct / 100);
    const armorAbsorbedRatio = 0.50 + armorHealthFrac * 0.15;
    armorAbsorbed = rawDamage * armorAbsorbedRatio;
    const passThroughRatio = (1.0 - armorAbsorbedRatio) * 1.10;

    const driveMult = !stats.wheelsProtected ? 0.85 : 0.25;
    const driveDmg = (rawDamage * driveMult) / effectiveMitigation;
    targetBot.leftDriveHealthPct = Math.max(0, targetBot.leftDriveHealthPct - driveDmg);
    targetBot.rightDriveHealthPct = Math.max(0, targetBot.rightDriveHealthPct - driveDmg);
    componentDmg = driveDmg;

    finalHullDmg = (rawDamage * passThroughRatio) / effectiveMitigation;
    targetBot.hullIntegrityPct = Math.max(0, targetBot.hullIntegrityPct - finalHullDmg);
  } else {
    // rear
    finalArmorDmg = (rawDamage * 1.40) / effectiveMitigation;
    targetBot.rearArmorPct = Math.max(0, targetBot.rearArmorPct - finalArmorDmg);

    const armorHealthFrac = Math.min(1.0, targetBot.rearArmorPct / 100);
    const armorAbsorbedRatio = 0.40 + armorHealthFrac * 0.15;
    armorAbsorbed = rawDamage * armorAbsorbedRatio;
    const passThroughRatio = (1.0 - armorAbsorbedRatio) * 1.25;

    const elecDmg = (rawDamage * 0.50) / effectiveMitigation;
    targetBot.batteryPct = Math.max(0, targetBot.batteryPct - elecDmg * 0.20);
    targetBot.electricalHealthPct = Math.max(0, targetBot.electricalHealthPct - elecDmg);
    componentDmg = elecDmg;

    finalHullDmg = (rawDamage * passThroughRatio) / effectiveMitigation;
    targetBot.hullIntegrityPct = Math.max(0, targetBot.hullIntegrityPct - finalHullDmg);
  }

  let damageSeverity: DamageSeverity = 'minimal';
  if (finalHullDmg >= 22 || finalArmorDmg >= 45) {
    damageSeverity = 'critical';
  } else if (finalHullDmg >= 14 || finalArmorDmg >= 28) {
    damageSeverity = 'severe';
  } else if (finalHullDmg >= 7 || finalArmorDmg >= 16) {
    damageSeverity = 'high';
  } else if (finalHullDmg >= 2.5 || finalArmorDmg >= 7) {
    damageSeverity = 'moderate';
  } else {
    damageSeverity = 'minimal';
  }

  return {
    finalHullDmg,
    finalArmorDmg,
    effectiveMitigation,
    armorAbsorbed,
    componentDmg,
    damageSeverity,
    targetHealthBefore,
    targetHealthAfter: targetBot.hullIntegrityPct,
  };
}

function addEvent(
  sim: LiveBattleSimulation,
  text: string,
  type: BattleEventLog['type'] = 'info'
): void {
  const recent = sim.events[0];
  if (recent && recent.text === text && sim.timeSec - recent.timeSec < 1.4) {
    return;
  }
  sim.events.unshift({
    id: sim.nextEventId++,
    timeSec: Number(sim.timeSec.toFixed(1)),
    text,
    type,
  });
  if (sim.events.length > 20) {
    sim.events.pop();
  }
}

export function createBattleSimulation(
  playerConfig: RobotConfiguration,
  strategy: AutonomousStrategy = 'control',
  bossId: BossId = 'bull',
  softwareRules?: BehaviorRule[],
  electricalLimiterA = 0,
  coolingTempReductionC = 0,
  isManual = false
): LiveBattleSimulation {
  const playerStats = calculateEngineeringStats(playerConfig);
  const bossDossier = getBossById(bossId);
  const bossStats = bossDossier.stats;

  const initialPlayer: CombatantTelemetry = {
    x: 0,
    z: 3.8,
    headingRad: Math.PI, // Facing North (-z) toward Boss
    vx: 0,
    vz: 0,
    pitchRad: 0,
    rollRad: 0,
    isFlipped: false,
    flipTimerSec: 0,
    batteryPct: 100,
    motorTempC: 38,
    weaponSpinPct: playerStats.weaponSpinUpSec === 0 ? 100 : 0,
    weaponActuationPhase: 0,
    isGrabbing: false,
    hullIntegrityPct: 100,
    frontArmorPct: 100,
    sideArmorPct: 100,
    rearArmorPct: 100,
    leftDriveHealthPct: 100,
    rightDriveHealthPct: 100,
    weaponHealthPct: 100,
    electricalHealthPct: 100,
    angularVelocityRad: 0,
    skidVx: 0,
    skidVz: 0,
    tractionBreakTimerSec: 0,
    impactFlashIntensity: 0,
    wedgeCondition: 'healthy',
    wedgeDeformationMm: 0,
    aiStateLabel: 'SENSE',
  };

  const initialBoss: CombatantTelemetry = {
    x: 0,
    z: -3.8,
    headingRad: 0, // Facing South (+z) toward Player
    vx: 0,
    vz: 0,
    pitchRad: 0,
    rollRad: 0,
    isFlipped: false,
    flipTimerSec: 0,
    batteryPct: 100,
    motorTempC: bossStats.expectedMotorTempC > 80 ? 46 : 40,
    weaponSpinPct: bossStats.weaponSpinUpSec === 0 ? 100 : 80,
    weaponActuationPhase: 0,
    isGrabbing: false,
    hullIntegrityPct: 100,
    frontArmorPct: 100,
    sideArmorPct: 100,
    rearArmorPct: 100,
    leftDriveHealthPct: 100,
    rightDriveHealthPct: 100,
    weaponHealthPct: 100,
    electricalHealthPct: 100,
    angularVelocityRad: 0,
    skidVx: 0,
    skidVz: 0,
    tractionBreakTimerSec: 0,
    impactFlashIntensity: 0,
    wedgeCondition: 'healthy',
    wedgeDeformationMm: 0,
    aiStateLabel: 'SENSE',
  };

  const sim: LiveBattleSimulation = {
    isManual,
    playerInput: createDefaultPlayerInput(),
    timeSec: 0,
    maxDurationSec: 75, // 75 seconds for deep tactical 30-90s combat
    isFinished: false,
    winner: null,
    winReason: '',
    strategy,
    bossId,
    bossDossier,
    playerConfig,
    playerStats,
    bossStats,
    player: initialPlayer,
    boss: initialBoss,
    bull: initialBoss, // Alias
    events: [],
    sparks: [],
    nextEventId: 1,
    nextSparkId: 1,
    contactCooldownSec: 0,
    grabTimerSec: 0,
    bossStunTimerSec: 0,
    playerStunTimerSec: 0,
    bossChargeCooldownSec: bossId === 'bull' ? 1.2 : 2.5,
    bossChargeActiveSec: 0,
    bossRepositionTimerSec: 0,
    bullPushSustainedSec: 0,
    bullAttackPattern: 'direct',
    bullPatternTimerSec: 3.5,
    weaponAtSpeedAnnounced: false,
    tempWarningAnnounced: false,
    powerLimitAnnounced: false,
    impactsDelivered: 0,
    lateralImpactsTaken: 0,
    flipsInflicted: 0,
    playerPushTimeSec: 0,
    bossPushTimeSec: 0,
    bullPushTimeSec: 0,
    peakMotorTempC: 38,
    cameraImpactShake: 0,
    recentImpactEvents: [],
    nextImpactEventId: 1,
    contactActive: false,
    lastImpactTimeSec: -99,
    sustainedWeaponContactSec: 0,
    lastAttackerSeparationSec: 1.0,
    wedgePhase: 'none',
    wedgeTimerSec: 0,
    lastWedgeTelemetry: null,
    softwareRules,
    electricalLimiterA,
    coolingTempReductionC,
    debugHitboxes: {
      playerChassis: getRobotCollisionModel(initialPlayer.x, initialPlayer.z, initialPlayer.headingRad, playerConfig, null).chassis,
      bossChassis: getRobotCollisionModel(initialBoss.x, initialBoss.z, initialBoss.headingRad, bossDossier.config, bossId).chassis,
      playerWeapon: getRobotCollisionModel(initialPlayer.x, initialPlayer.z, initialPlayer.headingRad, playerConfig, null).weapon,
      bossWeapon: getRobotCollisionModel(initialBoss.x, initialBoss.z, initialBoss.headingRad, bossDossier.config, bossId).weapon,
      contactPoint: null,
      contactNormal: null,
      hasContact: false,
    },
  };

  addEvent(sim, `AUTONOMOUS STRATEGY LOCKED: ${strategy.toUpperCase()}`, 'info');
  addEvent(sim, `CHALLENGING TIER ${bossDossier.tier}: ${bossDossier.name}`, 'info');
  if (playerStats.powerLimited) {
    addEvent(sim, 'BATTERY POWER LIMITED', 'warning');
    sim.powerLimitAnnounced = true;
  }

  return sim;
}

/**
 * Authoritative physical simulation step:
 * Uses 4 sub-steps per frame to resolve non-penetration, continuous capsule/OBB contact,
 * mass-weighted momentum transfer, and angular impulse deflection.
 */
export function stepBattleSimulation(
  sim: LiveBattleSimulation,
  rawDt: number,
  playerInput?: PlayerInput
): void {
  if (sim.isFinished) return;
  if (playerInput) {
    sim.playerInput = playerInput;
    sim.isManual = true;
  }
  const dt = Math.min(rawDt, 0.04);
  sim.timeSec += dt;

  const { player, boss, playerStats, bossStats, strategy, bossId, playerConfig } = sim;

  // Decay shake, cooldowns & sparks
  sim.cameraImpactShake = Math.max(0, sim.cameraImpactShake - dt * 2.8);
  sim.contactCooldownSec = Math.max(0, sim.contactCooldownSec - dt);
  sim.bossStunTimerSec = Math.max(0, sim.bossStunTimerSec - dt);
  sim.playerStunTimerSec = Math.max(0, sim.playerStunTimerSec - dt);
  sim.bossChargeCooldownSec = Math.max(0, sim.bossChargeCooldownSec - dt);
  sim.bossChargeActiveSec = Math.max(0, sim.bossChargeActiveSec - dt);
  sim.bossRepositionTimerSec = Math.max(0, sim.bossRepositionTimerSec - dt);
  if (sim.wedgeTimerSec > 0) {
    sim.wedgeTimerSec = Math.max(0, sim.wedgeTimerSec - dt);
    if (sim.wedgeTimerSec <= 0 && sim.wedgePhase === 'riding') {
      sim.wedgePhase = 'none';
    }
  }

  for (let i = sim.sparks.length - 1; i >= 0; i--) {
    sim.sparks[i].age += dt;
    if (sim.sparks[i].age > 0.45) {
      sim.sparks.splice(i, 1);
    }
  }

  // Weapon actuation visual phases
  if (player.weaponActuationPhase > 0) {
    player.weaponActuationPhase = Math.max(0, player.weaponActuationPhase - dt * 2.1);
  }
  if (boss.weaponActuationPhase > 0) {
    boss.weaponActuationPhase = Math.max(0, boss.weaponActuationPhase - dt * 2.1);
  }

  // Suspended pitch and roll decay (visible hops, tips, landings)
  if (!player.isFlipped) {
    player.pitchRad *= Math.pow(0.08, dt * 1.5);
    player.rollRad *= Math.pow(0.08, dt * 1.5);
  }
  if (!boss.isFlipped) {
    boss.pitchRad *= Math.pow(0.08, dt * 1.5);
    boss.rollRad *= Math.pow(0.08, dt * 1.5);
  }

  // Decay impact flash intensities (~45ms)
  player.impactFlashIntensity = Math.max(0, player.impactFlashIntensity - dt * 22);
  boss.impactFlashIntensity = Math.max(0, boss.impactFlashIntensity - dt * 22);

  // Apply angular velocity to headings and damp with wheel traction
  player.headingRad = normalizeAngle(player.headingRad + player.angularVelocityRad * dt);
  boss.headingRad = normalizeAngle(boss.headingRad + boss.angularVelocityRad * dt);

  // Angular velocity damping: during traction break, tires have minimal grip so spin persists!
  const pSpinDecay = player.tractionBreakTimerSec > 0 ? 0.85 : (2.4 + 3.6 * playerStats.tractionCoeff);
  const bSpinDecay = boss.tractionBreakTimerSec > 0 ? 0.85 : (2.4 + 3.6 * bossStats.tractionCoeff);
  player.angularVelocityRad *= Math.pow(0.15, dt * (pSpinDecay / 4));
  boss.angularVelocityRad *= Math.pow(0.15, dt * (bSpinDecay / 4));

  // Damp lateral skid velocities (traction break)
  if (player.tractionBreakTimerSec > 0) {
    player.tractionBreakTimerSec = Math.max(0, player.tractionBreakTimerSec - dt);
    const skidDecay = (1.5 + 3.0 * playerStats.tractionCoeff) * dt;
    player.skidVx *= Math.max(0, 1 - skidDecay);
    player.skidVz *= Math.max(0, 1 - skidDecay);
    player.vx += player.skidVx * dt * 2.5;
    player.vz += player.skidVz * dt * 2.5;
  }
  if (boss.tractionBreakTimerSec > 0) {
    boss.tractionBreakTimerSec = Math.max(0, boss.tractionBreakTimerSec - dt);
    const skidDecay = (1.5 + 3.0 * bossStats.tractionCoeff) * dt;
    boss.skidVx *= Math.max(0, 1 - skidDecay);
    boss.skidVz *= Math.max(0, 1 - skidDecay);
    boss.vx += boss.skidVx * dt * 2.5;
    boss.vz += boss.skidVz * dt * 2.5;
  }

  // 1. WEAPON SPIN-UP & BATTERY / THERMAL
  if (sim.isManual) {
    const input = sim.playerInput || createDefaultPlayerInput();
    const isSpinner = playerStats.weaponSpinUpSec > 0;
    const isActiveNonSpinner = !isSpinner && playerConfig.weaponId !== 'wedge';

    if (player.weaponHealthPct > 20 && !player.isFlipped && player.batteryPct > 2) {
      if (isSpinner) {
        if (input.weaponActive) {
          const spinRate = 100 / Math.max(0.35, playerStats.weaponSpinUpSec);
          const powerFactor = playerStats.powerLimited ? 0.78 : 1.0;
          const limiterFactor =
            sim.electricalLimiterA && sim.electricalLimiterA > 0
              ? sim.electricalLimiterA === 100
                ? 0.65
                : sim.electricalLimiterA === 120
                ? 0.8
                : 0.92
              : 1.0;
          const simultaneousFactor = (playerStats.powerLimited && input.throttle !== 0) ? 0.85 : 1.0;
          player.weaponSpinPct = Math.min(
            100,
            player.weaponSpinPct + spinRate * powerFactor * limiterFactor * simultaneousFactor * dt
          );
          if (player.weaponSpinPct >= 95 && !sim.weaponAtSpeedAnnounced && playerStats.weaponEnergyJ >= 1200) {
            addEvent(sim, 'WEAPON AT FULL POWER', 'info');
            sim.weaponAtSpeedAnnounced = true;
          }
        } else {
          player.weaponSpinPct = Math.max(0, player.weaponSpinPct - dt * 32);
          sim.weaponAtSpeedAnnounced = false;
        }
      } else if (isActiveNonSpinner) {
        if (input.weaponActive && player.weaponActuationPhase <= 0.05) {
          player.weaponActuationPhase = 1.0;
          addEvent(sim, 'WEAPON ACTUATED', 'info');
        }
      } else {
        player.weaponSpinPct = 0;
      }
    } else {
      player.weaponSpinPct = Math.max(0, player.weaponSpinPct - dt * 55);
    }
  } else {
    if (player.weaponHealthPct > 20 && !player.isFlipped && player.batteryPct > 2) {
      if (playerStats.weaponSpinUpSec > 0) {
        const spinRate = 100 / Math.max(0.35, playerStats.weaponSpinUpSec);
        const powerFactor = playerStats.powerLimited ? 0.78 : 1.0;
        const limiterFactor =
          sim.electricalLimiterA && sim.electricalLimiterA > 0
            ? sim.electricalLimiterA === 100
              ? 0.65
              : sim.electricalLimiterA === 120
              ? 0.8
              : 0.92
            : 1.0;
        player.weaponSpinPct = Math.min(100, player.weaponSpinPct + spinRate * powerFactor * limiterFactor * dt);
        if (player.weaponSpinPct >= 95 && !sim.weaponAtSpeedAnnounced && playerStats.weaponEnergyJ >= 1200) {
          addEvent(sim, 'WEAPON AT SPEED', 'info');
          sim.weaponAtSpeedAnnounced = true;
        }
      } else {
        player.weaponSpinPct = 100;
      }
    } else {
      player.weaponSpinPct = Math.max(0, player.weaponSpinPct - dt * 60);
    }
  }

  // Boss weapon spin
  if (boss.weaponHealthPct > 20 && !boss.isFlipped && boss.batteryPct > 2) {
    if (bossStats.weaponSpinUpSec > 0) {
      const spinRate = 100 / Math.max(0.35, bossStats.weaponSpinUpSec);
      boss.weaponSpinPct = Math.min(100, boss.weaponSpinPct + spinRate * dt);
    } else {
      boss.weaponSpinPct = 100;
    }
  } else {
    boss.weaponSpinPct = Math.max(0, boss.weaponSpinPct - dt * 60);
  }

  // Battery drain & motor temperature
  if (sim.isManual) {
    const input = sim.playerInput || createDefaultPlayerInput();
    const isDriving = input.throttle !== 0 || input.steering !== 0;
    const isWeaponPowering = input.weaponActive && player.weaponHealthPct > 20;

    let loadFactor = 0.25;
    if (isDriving) loadFactor += 0.45 * Math.abs(input.throttle || input.steering);
    if (isWeaponPowering) loadFactor += 0.55;
    if (playerStats.powerLimited && isDriving && isWeaponPowering) loadFactor += 0.22;

    const playerDrainPerSec = (100 / Math.max(55, playerStats.runtimeSeconds * 0.72)) * loadFactor;
    player.batteryPct = Math.max(0, player.batteryPct - playerDrainPerSec * dt);

    const coolingBonus = sim.coolingTempReductionC || 0;
    const extraLoadHeat = (isDriving ? 6 : 0) + (playerStats.powerLimited && isDriving && isWeaponPowering ? 8 : 0);
    const targetTemp = Math.max(38, playerStats.expectedMotorTempC - coolingBonus + extraLoadHeat);
    player.motorTempC += (targetTemp - player.motorTempC) * dt * 0.16;
    if (player.motorTempC > sim.peakMotorTempC) {
      sim.peakMotorTempC = Math.round(player.motorTempC);
    }
    if (player.motorTempC >= 84 && !sim.tempWarningAnnounced) {
      addEvent(sim, 'DRIVE MOTOR HOT', 'warning');
      sim.tempWarningAnnounced = true;
    }
  } else {
    const strategyDrainFactor = strategy === 'aggressive' ? 1.18 : strategy === 'defensive' ? 0.86 : 1.0;
    const playerDrainPerSec = (100 / Math.max(55, playerStats.runtimeSeconds * 0.72)) * strategyDrainFactor;
    player.batteryPct = Math.max(0, player.batteryPct - playerDrainPerSec * dt);

    const coolingBonus = sim.coolingTempReductionC || 0;
    const targetTemp = Math.max(38, playerStats.expectedMotorTempC - coolingBonus + (strategy === 'aggressive' ? 5 : 0));
    player.motorTempC += (targetTemp - player.motorTempC) * dt * 0.14;
    if (player.motorTempC > sim.peakMotorTempC) {
      sim.peakMotorTempC = Math.round(player.motorTempC);
    }
    if (player.motorTempC >= 84 && !sim.tempWarningAnnounced) {
      addEvent(sim, 'DRIVE MOTOR HOT', 'warning');
      sim.tempWarningAnnounced = true;
    }
  }

  const bossDrainRate = (100 / Math.max(70, bossStats.runtimeSeconds)) * (bossId === 'cyclone' ? 1.35 : 1.0);
  boss.batteryPct = Math.max(0, boss.batteryPct - bossDrainRate * dt);

  // Boss motor temperature
  const bossTargetTemp = bossStats.expectedMotorTempC + (boss.batteryPct < 50 ? 8 : 0);
  boss.motorTempC += (bossTargetTemp - boss.motorTempC) * dt * 0.12;

  // 2. FLIPPED / SELF-RIGHTING RECOVERY
  if (player.isFlipped) {
    player.flipTimerSec += dt;
    player.aiStateLabel = 'RECOVER';
    if (playerStats.selfRightingLabel === 'RELIABLE' && player.flipTimerSec >= 1.4 && player.batteryPct > 5) {
      player.isFlipped = false;
      player.flipTimerSec = 0;
      player.weaponActuationPhase = 1.0;
      addEvent(sim, 'SELF-RIGHTING RECOVERY COMPLETE', 'info');
    } else if (playerStats.selfRightingLabel === 'POSSIBLE' && player.flipTimerSec >= 2.2) {
      player.isFlipped = false;
      player.flipTimerSec = 0;
      addEvent(sim, 'INVERTED DRIVE RECOVERY', 'info');
    } else if (player.flipTimerSec >= 4.5) {
      finishBattle(sim, 'boss', 'Player robot was flipped inverted and unable to self-right.');
      return;
    }
  }

  if (boss.isFlipped) {
    boss.flipTimerSec += dt;
    boss.aiStateLabel = 'RECOVER';
    if (bossStats.selfRightingLabel === 'RELIABLE' && boss.flipTimerSec >= 1.5) {
      boss.isFlipped = false;
      boss.flipTimerSec = 0;
      boss.weaponActuationPhase = 1.0;
      addEvent(sim, `${sim.bossDossier.name} RECOVERED FROM FLIP`, 'info');
    } else if (bossStats.selfRightingLabel === 'POSSIBLE' && boss.flipTimerSec >= 2.6) {
      boss.isFlipped = false;
      boss.flipTimerSec = 0;
    } else if (bossStats.selfRightingLabel === 'UNABLE' && boss.flipTimerSec >= 3.2) {
      finishBattle(sim, 'player', `${sim.bossDossier.name} was overturned and immobilized!`);
      return;
    }
  }

  // 3. RELATIVE GEOMETRY
  const dx = boss.x - player.x;
  const dz = boss.z - player.z;
  const dist = Math.max(0.001, Math.hypot(dx, dz));
  const anglePlayerToBoss = Math.atan2(dx, dz);
  const angleBossToPlayer = Math.atan2(-dx, -dz);

  // 4. DRIVE DECISIONS (MANUAL KEYBOARD OR AUTONOMOUS FALLBACK)
  if (sim.isManual) {
    const input = sim.playerInput || createDefaultPlayerInput();
    const leftHealth = player.leftDriveHealthPct / 100;
    const rightHealth = player.rightDriveHealthPct / 100;
    const avgHealth = (leftHealth + rightHealth) * 0.5;

    const thermalThrottle = player.motorTempC > 90 ? 0.72 : player.motorTempC > 80 ? 0.88 : 1.0;
    const batteryThrottle = player.batteryPct < 8 ? 0.5 : player.batteryPct < 20 ? 0.8 : 1.0;
    const simultaneousFactor =
      playerStats.powerLimited && input.weaponActive && player.weaponSpinPct < 90 ? 0.85 : 1.0;

    const playerMaxSpeed =
      (playerStats.topSpeedMph / 14.0) * 3.1 * avgHealth * thermalThrottle * batteryThrottle * simultaneousFactor;
    const playerTurnRate =
      THREE.MathUtils.degToRad(playerStats.turningRateDegPerSec) * 1.55 * Math.max(0.3, avgHealth);

    if (!player.isFlipped && sim.playerStunTimerSec <= 0) {
      if (sim.grabTimerSec > 0 && player.isGrabbing) {
        player.aiStateLabel = 'PUSH';
      } else {
        // Post-impact traction break dampens driver steering & throttle authority
        // Holding W cannot erase recoil momentum while skidding backward (pAuthority clamped to 0.05)
        // BUT preserve reverse escape authority (0.75) and lateral steering authority (0.65) to escape pins/skids
        const isReversing = input.throttle < 0;
        const vFwd = player.vx * Math.sin(player.headingRad) + player.vz * Math.cos(player.headingRad);
        const isRecoilingBackward = vFwd < -0.22;
        let pAuthority = 1.0;
        if (player.tractionBreakTimerSec > 0) {
          if (isReversing) {
            pAuthority = 0.75;
          } else if (isRecoilingBackward) {
            pAuthority = 0.05;
          } else {
            pAuthority = 0.22;
          }
        }
        const pSteerAuthority = player.tractionBreakTimerSec > 0 ? 0.65 : 1.0;

        // A. Differential Steering: Turn left (negative) or right (positive)
        // Turning right increases headingRad (clockwise), turning left decreases it
        const steerDir = input.throttle < 0 ? 1 : -1;
        const turnDelta = input.steering * steerDir * playerTurnRate * dt * pSteerAuthority;

        // Motor damage asymmetry pulls robot toward the damaged side when driving
        const drivePull = (rightHealth - leftHealth) * 0.55 * playerTurnRate * dt * Math.sign(input.throttle || 0);

        player.headingRad = normalizeAngle(player.headingRad + turnDelta + drivePull);

        // B. Forward / Reverse Linear Speed
        const desiredPlayerSpeed = input.throttle * playerMaxSpeed;
        const targetVx = Math.sin(player.headingRad) * desiredPlayerSpeed;
        const targetVz = Math.cos(player.headingRad) * desiredPlayerSpeed;

        const accelRate = 7.5 * Math.max(0.4, playerStats.accelerationMphPerSec / 8.5) * pAuthority;

        if (input.throttle !== 0) {
          player.vx += (targetVx - player.vx) * Math.min(1, accelRate * dt);
          player.vz += (targetVz - player.vz) * Math.min(1, accelRate * dt);
          player.aiStateLabel = input.throttle > 0 ? 'ENGAGE' : 'EVADE';
        } else if (input.steering !== 0) {
          const pointTurnBrake = 12.0 * dt * pAuthority;
          player.vx += (0 - player.vx) * Math.min(1, pointTurnBrake);
          player.vz += (0 - player.vz) * Math.min(1, pointTurnBrake);
          player.aiStateLabel = 'FLANK';
        } else {
          const decelRate = 9.0 * Math.max(0.45, playerStats.tractionCoeff) * pAuthority;
          player.vx += (0 - player.vx) * Math.min(1, decelRate * dt);
          player.vz += (0 - player.vz) * Math.min(1, decelRate * dt);
          player.aiStateLabel = 'SENSE';
        }

        // When skidding during traction break, smooth slide friction gradually absorbs sliding velocity
        if (player.tractionBreakTimerSec > 0) {
          const slideFriction = 0.9 + 1.8 * playerStats.tractionCoeff;
          player.vx *= Math.pow(0.38, dt * slideFriction);
          player.vz *= Math.pow(0.38, dt * slideFriction);
        }
      }
    } else {
      player.vx *= Math.pow(0.15, dt);
      player.vz *= Math.pow(0.15, dt);
      if (player.isFlipped) player.aiStateLabel = 'RECOVER';
      else if (sim.playerStunTimerSec > 0) player.aiStateLabel = 'RECOVER';
    }
  } else {
    // Autonomous Player Controller (Fallback / Headless simulation)
    const playerDriveHealth = (player.leftDriveHealthPct + player.rightDriveHealthPct) * 0.005;
    const thermalThrottle = player.motorTempC > 90 ? 0.74 : 1.0;
    const batteryThrottle = player.batteryPct < 10 ? 0.55 : player.batteryPct < 22 ? 0.82 : 1.0;
    const playerMaxSpeed =
      (playerStats.topSpeedMph / 14.0) * 3.1 * playerDriveHealth * thermalThrottle * batteryThrottle;
    const playerTurnRate =
      THREE.MathUtils.degToRad(playerStats.turningRateDegPerSec) * 1.55 * Math.max(0.35, playerDriveHealth);

    let desiredPlayerHeading: number;
    let desiredPlayerSpeed: number;

    const needsSpinUp =
      playerStats.weaponSpinUpSec >= 1.2 &&
      player.weaponSpinPct < (strategy === 'aggressive' ? 50 : 82) &&
      player.weaponHealthPct > 25;

    if (!player.isFlipped && sim.playerStunTimerSec <= 0) {
      if (sim.grabTimerSec > 0 && player.isGrabbing) {
        const wallTargetHeading = Math.atan2(Math.sign(player.x || 1), Math.sign(player.z || 1));
        desiredPlayerHeading = wallTargetHeading;
        desiredPlayerSpeed = playerMaxSpeed * 0.92;
        player.aiStateLabel = 'PUSH';
      } else if (sim.softwareRules && sim.softwareRules.length > 0) {
        let matchedAction: string | null = null;
        const angleDiffToBoss = Math.abs(normalizeAngle(anglePlayerToBoss - player.headingRad));

        for (const rule of sim.softwareRules) {
          let match = false;
          if (rule.sensor === 'robot_tilt') {
            match = rule.conditionValue === 'flipped' ? player.isFlipped : !player.isFlipped;
          } else if (rule.sensor === 'weapon_ready') {
            match = rule.conditionValue === 'yes' ? player.weaponSpinPct >= 80 : player.weaponSpinPct < 80;
          } else if (rule.sensor === 'opponent_distance') {
            match =
              rule.conditionValue === 'close'
                ? dist < 1.5
                : rule.conditionValue === 'medium'
                ? dist >= 1.5 && dist <= 2.8
                : dist > 2.8;
          } else if (rule.sensor === 'opponent_angle') {
            match =
              rule.conditionValue === 'front'
                ? angleDiffToBoss < 0.45
                : rule.conditionValue === 'flank'
                ? angleDiffToBoss >= 0.45 && angleDiffToBoss <= 1.8
                : angleDiffToBoss > 1.8;
          } else if (rule.sensor === 'front_contact') {
            match = rule.conditionValue === 'contact' ? sim.contactCooldownSec > 0 : sim.contactCooldownSec <= 0;
          }

          if (match) {
            matchedAction = rule.action;
            break;
          }
        }

        if (matchedAction === 'full_charge') {
          desiredPlayerHeading = anglePlayerToBoss;
          desiredPlayerSpeed = playerMaxSpeed * 1.12;
          player.aiStateLabel = 'ENGAGE';
        } else if (matchedAction === 'approach') {
          desiredPlayerHeading = anglePlayerToBoss;
          desiredPlayerSpeed = playerMaxSpeed * 0.88;
          player.aiStateLabel = 'APPROACH';
        } else if (matchedAction === 'flank_target') {
          desiredPlayerHeading = normalizeAngle(anglePlayerToBoss + 0.65 * Math.sign(dx || 1));
          desiredPlayerSpeed = playerMaxSpeed * 0.95;
          player.aiStateLabel = 'FLANK';
        } else if (matchedAction === 'back_away') {
          desiredPlayerHeading = anglePlayerToBoss;
          desiredPlayerSpeed = -playerMaxSpeed * 0.75;
          player.aiStateLabel = 'EVADE';
        } else if (matchedAction === 'turn_toward') {
          desiredPlayerHeading = anglePlayerToBoss;
          desiredPlayerSpeed = playerMaxSpeed * 0.2;
          player.aiStateLabel = 'SENSE';
        } else {
          desiredPlayerHeading = anglePlayerToBoss;
          desiredPlayerSpeed = playerMaxSpeed * 0.88;
          player.aiStateLabel = 'APPROACH';
        }
      } else if (needsSpinUp) {
        desiredPlayerHeading = anglePlayerToBoss;
        desiredPlayerSpeed = playerMaxSpeed * 0.65;
        player.aiStateLabel = 'APPROACH';
      } else if (strategy === 'control') {
        if (dist > 2.2) {
          desiredPlayerHeading = anglePlayerToBoss;
          desiredPlayerSpeed = playerMaxSpeed * 0.88;
          player.aiStateLabel = 'APPROACH';
        } else {
          desiredPlayerHeading = normalizeAngle(anglePlayerToBoss + 0.55 * Math.sign(dx || 1));
          desiredPlayerSpeed = playerMaxSpeed * 0.95;
          player.aiStateLabel = 'FLANK';
        }
      } else if (strategy === 'defensive') {
        desiredPlayerHeading = anglePlayerToBoss;
        desiredPlayerSpeed = playerMaxSpeed * 0.85;
        player.aiStateLabel = dist < 1.6 ? 'ENGAGE' : 'APPROACH';
      } else {
        desiredPlayerHeading = anglePlayerToBoss;
        desiredPlayerSpeed = playerMaxSpeed * 1.05;
        player.aiStateLabel = dist < 1.4 ? 'ENGAGE' : 'APPROACH';
      }

      const vFwdAuto = player.vx * Math.sin(player.headingRad) + player.vz * Math.cos(player.headingRad);
      const isRecoilingAuto = vFwdAuto < -0.22;
      const pAuthority = player.tractionBreakTimerSec > 0 ? (isRecoilingAuto ? 0.06 : 0.35) : 1.0;
      const headingDiff = normalizeAngle(desiredPlayerHeading - player.headingRad);
      const maxTurn = playerTurnRate * dt * (player.tractionBreakTimerSec > 0 ? 0.45 : 1.0);
      player.headingRad = normalizeAngle(player.headingRad + Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), maxTurn));

      const alignFactor = Math.max(0, Math.cos(headingDiff));
      const targetVx = Math.sin(player.headingRad) * desiredPlayerSpeed * alignFactor;
      const targetVz = Math.cos(player.headingRad) * desiredPlayerSpeed * alignFactor;

      player.vx += (targetVx - player.vx) * Math.min(1, 7.5 * dt * pAuthority);
      player.vz += (targetVz - player.vz) * Math.min(1, 7.5 * dt * pAuthority);

      if (player.tractionBreakTimerSec > 0) {
        const slideFriction = 0.9 + 1.8 * playerStats.tractionCoeff;
        player.vx *= Math.pow(0.38, dt * slideFriction);
        player.vz *= Math.pow(0.38, dt * slideFriction);
      }
    } else {
      player.vx *= Math.pow(0.15, dt);
      player.vz *= Math.pow(0.15, dt);
    }
  }

  // Boss Controller (Archetype-specific AI)
  const bossDriveHealth = (boss.leftDriveHealthPct + boss.rightDriveHealthPct) * 0.005;
  const bossThermalThrottle = boss.motorTempC > 90 ? 0.76 : 1.0;
  const bossMaxSpeed = (bossStats.topSpeedMph / 14.0) * 3.0 * bossDriveHealth * bossThermalThrottle;
  const bossTurnRate = THREE.MathUtils.degToRad(bossStats.turningRateDegPerSec) * 1.4 * Math.max(0.3, bossDriveHealth);

  if (!boss.isFlipped && sim.bossStunTimerSec <= 0 && !player.isGrabbing) {
    let desiredBossHeading = angleBossToPlayer;
    let desiredBossSpeed = bossMaxSpeed;

    switch (bossId) {
      case 'bull': {
        const headingDiff = normalizeAngle(angleBossToPlayer - boss.headingRad);
        const nearWall = Math.abs(boss.x) > ARENA_HALF_SIZE - 1.2 || Math.abs(boss.z) > ARENA_HALF_SIZE - 1.2;

        // Periodic Attack Pattern Selection (direct, angled, shove, stalk)
        sim.bullPatternTimerSec -= dt;
        if (sim.bullPatternTimerSec <= 0) {
          sim.bullPatternTimerSec = 3.5 + Math.random() * 2.0;
          const patterns: ('direct' | 'angled' | 'shove' | 'stalk')[] = ['direct', 'angled', 'shove', 'stalk'];
          sim.bullAttackPattern = patterns[Math.floor(Math.random() * patterns.length)];
        }

        if (sim.bossRepositionTimerSec > 0) {
          // DISENGAGE / REPOSITION / MISSED-CHARGE BRAKING RECOVERY
          boss.aiStateLabel = 'REPOSITION';
          if (nearWall) {
            // Maneuver back toward center of arena
            const centerAngle = Math.atan2(-boss.x, -boss.z);
            desiredBossHeading = centerAngle;
            desiredBossSpeed = bossMaxSpeed * 0.90;
          } else {
            // Forward momentum carries Bull while braking and turning back
            desiredBossHeading = angleBossToPlayer;
            desiredBossSpeed = -bossMaxSpeed * 0.65;
          }
        } else if (dist < 1.6 && sim.bossChargeActiveSec <= 0) {
          // Too close and not in an active charge: disengage immediately to break the pushing match and create charge distance!
          sim.bossRepositionTimerSec = 0.9 + Math.random() * 0.4;
          boss.aiStateLabel = 'REPOSITION';
          desiredBossHeading = angleBossToPlayer;
          desiredBossSpeed = -bossMaxSpeed * 0.85;
        } else if (sim.bossChargeActiveSec > 0) {
          // Active high-speed charge!
          boss.aiStateLabel = 'CHARGE';
          desiredBossSpeed = bossMaxSpeed * 1.35;

          // Charge Commitment: in final 2.8m, commit straight forward on heading!
          if (dist < 2.8) {
            desiredBossHeading = boss.headingRad;
          } else {
            desiredBossHeading = angleBossToPlayer;
          }

          // Check if player dodged or Bull overshot past the player
          const bFwdX = Math.sin(boss.headingRad);
          const bFwdZ = Math.cos(boss.headingRad);
          const relFwd = (player.x - boss.x) * bFwdX + (player.z - boss.z) * bFwdZ;
          const isPlayerPassed = relFwd < -0.3; // Player is behind Bull's plow line!
          const isDodgedLaterally = Math.abs(headingDiff) > 0.48 && dist < 3.5;

          if (isPlayerPassed || isDodgedLaterally) {
            // MISSED CHARGE! Bull overshoots and enters an exposed recovery braking window (~1.35s)
            sim.bossChargeActiveSec = 0;
            sim.bossRepositionTimerSec = 1.35;
            boss.aiStateLabel = 'REPOSITION';
            addEvent(sim, 'BULL MISSED CHARGE — OVERLOAD BRAKING WINDOW!', 'info');
          }
        } else if (sim.bossChargeCooldownSec <= 0 && dist >= 2.0 && dist <= 5.5) {
          // Ready to initiate attack pattern
          if (sim.bullAttackPattern === 'stalk' && dist > 2.8) {
            // Stalk / circle player to look for an opening
            desiredBossHeading = normalizeAngle(angleBossToPlayer + 0.75 * Math.sign(dx || 1));
            desiredBossSpeed = bossMaxSpeed * 0.75;
            boss.aiStateLabel = 'APPROACH';
          } else if (Math.abs(headingDiff) < 0.32) {
            // Aligned and launching charge!
            const chargeDuration = sim.bullAttackPattern === 'shove' ? 0.75 : 1.25;
            sim.bossChargeActiveSec = chargeDuration;
            sim.bossChargeCooldownSec = 2.4;
            const targetOffset = sim.bullAttackPattern === 'angled' ? 0.38 * Math.sign(dx || 1) : 0;
            desiredBossHeading = normalizeAngle(angleBossToPlayer + targetOffset);
            desiredBossSpeed = bossMaxSpeed * 1.35;
            boss.aiStateLabel = 'CHARGE';
          } else {
            // ACQUIRE: Turn in place to aim bronze horns at player
            desiredBossHeading = angleBossToPlayer;
            desiredBossSpeed = bossMaxSpeed * 0.30;
            boss.aiStateLabel = 'ACQUIRE';
          }
        } else {
          // Maneuver to optimal charge distance
          desiredBossHeading = angleBossToPlayer;
          if (dist < 2.0) {
            desiredBossSpeed = -bossMaxSpeed * 0.75;
            boss.aiStateLabel = 'REPOSITION';
          } else {
            desiredBossSpeed = bossMaxSpeed * 0.85;
            boss.aiStateLabel = 'APPROACH';
          }
        }
        break;
      }
      case 'scorpion': {
        // Approaches with pincers, seeks to pin or lift
        if (dist < 1.3) {
          boss.weaponActuationPhase = 1.0;
          boss.aiStateLabel = 'ENGAGE';
        } else {
          boss.aiStateLabel = 'APPROACH';
        }
        desiredBossSpeed = bossMaxSpeed * 0.95;
        break;
      }
      case 'cyclone': {
        // High speed perimeter weapon engagement — approaches with front ring
        desiredBossHeading = angleBossToPlayer;
        desiredBossSpeed = bossMaxSpeed * 1.05;
        boss.aiStateLabel = 'ENGAGE';
        break;
      }
      case 'spider': {
        // Approaches directly from open space, lateral strafes when close
        if (dist > 2.0) {
          desiredBossHeading = angleBossToPlayer;
          desiredBossSpeed = bossMaxSpeed * 1.0;
          boss.aiStateLabel = 'APPROACH';
        } else {
          const flankSide = Math.sign(dx || 1);
          desiredBossHeading = normalizeAngle(angleBossToPlayer + flankSide * 0.65);
          desiredBossSpeed = bossMaxSpeed * 1.05;
          boss.aiStateLabel = 'FLANK';
        }
        break;
      }
      case 'titan': {
        // Dual-mode: relentless push + kinetic drum
        desiredBossHeading = angleBossToPlayer;
        desiredBossSpeed = bossMaxSpeed * 1.05;
        boss.aiStateLabel = dist < 1.5 ? 'ENGAGE' : 'APPROACH';
        break;
      }
    }

    const bAuthority = boss.tractionBreakTimerSec > 0 ? 0.08 : 1.0;
    const bSteerAuthority = boss.tractionBreakTimerSec > 0 ? 0.12 : 1.0;

    const bossHeadingDiff = normalizeAngle(desiredBossHeading - boss.headingRad);
    const chargeSteerMult = sim.bossChargeActiveSec > 0 ? (dist < 2.8 ? 0.06 : 0.25) : 1.0;
    const maxBossTurn = bossTurnRate * dt * chargeSteerMult * bSteerAuthority;
    boss.headingRad = normalizeAngle(boss.headingRad + Math.sign(bossHeadingDiff) * Math.min(Math.abs(bossHeadingDiff), maxBossTurn));

    const alignFactor = Math.max(0, Math.cos(bossHeadingDiff));
    const bTargetVx = Math.sin(boss.headingRad) * desiredBossSpeed * alignFactor;
    const bTargetVz = Math.cos(boss.headingRad) * desiredBossSpeed * alignFactor;

    boss.vx += (bTargetVx - boss.vx) * Math.min(1, 6.8 * dt * bAuthority);
    boss.vz += (bTargetVz - boss.vz) * Math.min(1, 6.8 * dt * bAuthority);

    if (boss.tractionBreakTimerSec > 0) {
      const slideFriction = 0.9 + 1.8 * bossStats.tractionCoeff;
      boss.vx *= Math.pow(0.38, dt * slideFriction);
      boss.vz *= Math.pow(0.38, dt * slideFriction);
    }
  } else if (!player.isGrabbing) {
    boss.vx *= Math.pow(0.15, dt);
    boss.vz *= Math.pow(0.15, dt);
  }

  // 5. SUB-STEPPED CONTINUOUS RIGID-BODY SOLVER (Dynamic 4 to 8 Substeps)
  // Ensures non-penetration, continuous OBB contact, mass-weighted momentum transfer,
  // sustained pushing without elastic bounce, and angular impulse deflection.
  const relSpeed = Math.hypot(player.vx - boss.vx, player.vz - boss.vz);
  const SUBSTEPS = relSpeed > 7.0 ? 8 : relSpeed > 4.0 ? 6 : 4;
  const subDt = dt / SUBSTEPS;

  const m1 = Math.max(12, playerStats.totalWeightLb);
  const m2 = Math.max(12, bossStats.totalWeightLb);
  const w1 = m2 / (m1 + m2); // Player displacement weight
  const w2 = m1 / (m1 + m2); // Boss displacement weight

  for (let s = 0; s < SUBSTEPS; s++) {
    // A. Sub-integrate positions
    player.x += player.vx * subDt;
    player.z += player.vz * subDt;

    if (sim.grabTimerSec > 0 && player.isGrabbing) {
      sim.grabTimerSec = Math.max(0, sim.grabTimerSec - subDt);
      const holdDist = 1.05;
      boss.x = player.x + Math.sin(player.headingRad) * holdDist;
      boss.z = player.z + Math.cos(player.headingRad) * holdDist;
      boss.vx = player.vx;
      boss.vz = player.vz;
      sim.playerPushTimeSec += subDt;

      // Hazard wall crush
      if (Math.abs(boss.x) > ARENA_HALF_SIZE - 0.38 || Math.abs(boss.z) > ARENA_HALF_SIZE - 0.38) {
        boss.hullIntegrityPct = Math.max(0, boss.hullIntegrityPct - 26 * subDt);
        boss.sideArmorPct = Math.max(0, boss.sideArmorPct - 32 * subDt);
      }
      if (sim.grabTimerSec <= 0) {
        player.isGrabbing = false;
        sim.bossStunTimerSec = 0.45;
        sim.contactCooldownSec = 0.38;
      }
    } else {
      boss.x += boss.vx * subDt;
      boss.z += boss.vz * subDt;
    }

    // B. Arena Perimeter Boundary Collisions (Walls as solid immovable physical bodies)
    const playerModel = getRobotCollisionModel(player.x, player.z, player.headingRad, playerConfig, null);
    const bossModel = getRobotCollisionModel(boss.x, boss.z, boss.headingRad, sim.bossDossier.config, bossId);

    const clampArenaBoundary = (bot: CombatantTelemetry, isPlayerBot: boolean, halfWidth: number, halfLength: number) => {
      const boundLimitX = ARENA_HALF_SIZE - halfWidth;
      const boundLimitZ = ARENA_HALF_SIZE - halfLength;
      let collided = false;
      let wallNx = 0;
      let wallNz = 0;
      let impactSpeed = 0;

      if (bot.x > boundLimitX) {
        impactSpeed = Math.max(impactSpeed, Math.abs(bot.vx));
        bot.x = boundLimitX;
        bot.vx = -Math.abs(bot.vx) * 0.52;
        collided = true;
        wallNx = -1;
      } else if (bot.x < -boundLimitX) {
        impactSpeed = Math.max(impactSpeed, Math.abs(bot.vx));
        bot.x = -boundLimitX;
        bot.vx = Math.abs(bot.vx) * 0.52;
        collided = true;
        wallNx = 1;
      }

      if (bot.z > boundLimitZ) {
        impactSpeed = Math.max(impactSpeed, Math.abs(bot.vz));
        bot.z = boundLimitZ;
        bot.vz = -Math.abs(bot.vz) * 0.52;
        collided = true;
        wallNz = -1;
      } else if (bot.z < -boundLimitZ) {
        impactSpeed = Math.max(impactSpeed, Math.abs(bot.vz));
        bot.z = -boundLimitZ;
        bot.vz = Math.abs(bot.vz) * 0.52;
        collided = true;
        wallNz = 1;
      }

      if (collided) {
        // Wall rebound angular deflection and traction break on strong hit
        bot.angularVelocityRad += (wallNz * bot.vx - wallNx * bot.vz) * 1.8;
        if (impactSpeed > 1.4) {
          bot.tractionBreakTimerSec = Math.max(bot.tractionBreakTimerSec, 0.22);
        }

        // Authoritative wall collision impulse & event
        if (impactSpeed > 0.75 && sim.timeSec - sim.lastImpactTimeSec > 0.16) {
          const botMass = isPlayerBot ? m1 : m2;
          const wallImpulse = botMass * impactSpeed * 1.32;
          createCombatImpactEvent(
            sim,
            [bot.x + wallNx * 0.15, bot.z + wallNz * 0.15],
            [wallNx, wallNz],
            impactSpeed,
            wallImpulse,
            'wall',
            'wall',
            isPlayerBot ? 'player' : 'boss',
            0,
            impactSpeed * 0.52,
            0,
            0.22,
            'front',
            undefined,
            undefined,
            undefined,
            {
              damageSeverity: impactSpeed > 2.0 ? 'moderate' : 'minimal',
              attackClassification: 'WALL_IMPACT',
              attackType: 'wall',
            }
          );
          sim.lastImpactTimeSec = sim.timeSec;
        }

        // Damage from high-energy wall smash
        if (impactSpeed > 2.0) {
          const wallDmg = 3.5 + (impactSpeed - 2.0) * 5.5;
          bot.hullIntegrityPct = Math.max(0, bot.hullIntegrityPct - wallDmg * subDt * 3.5);
          bot.frontArmorPct = Math.max(0, bot.frontArmorPct - wallDmg * subDt * 2.5);
        }

        if (!isPlayerBot) {
          if (sim.bossChargeActiveSec > 0) {
            // Charging boss smashed into arena wall!
            sim.bossChargeActiveSec = 0;
            sim.bossStunTimerSec = 0.85;
            addEvent(sim, `${sim.bossDossier.name} RAMMED ARENA WALL!`, 'info');
          }
          if (impactSpeed > 1.4 || sim.bossStunTimerSec > 0) {
            const wallDmg = 5.5 + impactSpeed * 3.0;
            boss.hullIntegrityPct = Math.max(0, boss.hullIntegrityPct - wallDmg * subDt * 4);
            sim.bossStunTimerSec = Math.max(sim.bossStunTimerSec, 0.45);
          }
        }
      }
    };

    clampArenaBoundary(player, true, playerModel.chassis.halfExtents[0], playerModel.chassis.halfExtents[1]);
    clampArenaBoundary(boss, false, bossModel.chassis.halfExtents[0], bossModel.chassis.halfExtents[1]);

    // C. Physical OBB & Weapon Contact Resolution
    const chassisTest = testOBBOBB(playerModel.chassis, bossModel.chassis);
    const playerWeaponHit = player.weaponHealthPct > 15
      ? testWeaponChassisContact(playerModel.weapon, bossModel.chassis)
      : { hit: false, contactPoint: [0, 0] as [number, number] };
    const bossWeaponHit = boss.weaponHealthPct > 15
      ? testWeaponChassisContact(bossModel.weapon, playerModel.chassis)
      : { hit: false, contactPoint: [0, 0] as [number, number] };
    const weaponClash = (player.weaponHealthPct > 15 && boss.weaponHealthPct > 15)
      ? testOBBOBB(
          {
            center: playerModel.weapon.center,
            halfExtents: playerModel.weapon.halfExtents,
            rotationRad: playerModel.weapon.rotationRad,
            uX: playerModel.weapon.uX,
            uZ: playerModel.weapon.uZ,
          },
          {
            center: bossModel.weapon.center,
            halfExtents: bossModel.weapon.halfExtents,
            rotationRad: bossModel.weapon.rotationRad,
            uX: bossModel.weapon.uX,
            uZ: bossModel.weapon.uZ,
          }
        )
      : { overlap: false, penetration: 0, normal: [0, 0] as [number, number], contactPoint: [0, 0] as [number, number] };

    // Record authoritative contact state for debug hitboxes
    sim.debugHitboxes = {
      playerChassis: playerModel.chassis,
      bossChassis: bossModel.chassis,
      playerWeapon: playerModel.weapon,
      bossWeapon: bossModel.weapon,
      contactPoint: chassisTest.overlap
        ? chassisTest.contactPoint
        : weaponClash.overlap
        ? weaponClash.contactPoint
        : playerWeaponHit.hit
        ? playerWeaponHit.contactPoint
        : bossWeaponHit.hit
        ? bossWeaponHit.contactPoint
        : null,
      contactNormal: chassisTest.overlap ? chassisTest.normal : null,
      hasContact: chassisTest.overlap || playerWeaponHit.hit || bossWeaponHit.hit || weaponClash.overlap,
    };

    // Bull Front Wedge Dynamics Check (Sections 1-13)
    let handledByBullWedge = false;
    if (bossId === 'bull') {
      const bFwdX = Math.sin(boss.headingRad);
      const bFwdZ = Math.cos(boss.headingRad);
      const bRightX = Math.cos(boss.headingRad);
      const bRightZ = -Math.sin(boss.headingRad);

      const contactX = chassisTest.overlap
        ? chassisTest.contactPoint[0]
        : bossWeaponHit.hit
        ? bossWeaponHit.contactPoint[0]
        : (player.x + boss.x) * 0.5;
      const contactZ = chassisTest.overlap
        ? chassisTest.contactPoint[1]
        : bossWeaponHit.hit
        ? bossWeaponHit.contactPoint[1]
        : (player.z + boss.z) * 0.5;

      const toContactFwd = (contactX - boss.x) * bFwdX + (contactZ - boss.z) * bFwdZ;
      const toContactLat = (contactX - boss.x) * bRightX + (contactZ - boss.z) * bRightZ;

      const isBullFrontWedgeContact =
        bossWeaponHit.hit || (chassisTest.overlap && toContactFwd > 0.15 && Math.abs(toContactLat) < 1.15);

      const vPlayerApproach = -(player.vx * bFwdX + player.vz * bFwdZ);
      const vBullFwd = boss.vx * bFwdX + boss.vz * bFwdZ;
      const vClose = vBullFwd + vPlayerApproach;
      const isDynamicWedgeImpact = vClose > 0.65 || (sim.bossChargeActiveSec > 0 && vClose > 0.35) || Math.abs(vPlayerApproach) > 1.2;

      if (
        sim.wedgePhase === 'riding' ||
        (sim.contactCooldownSec <= 0 && isBullFrontWedgeContact && isDynamicWedgeImpact)
      ) {
        handledByBullWedge = resolveBullWedgeInteraction(
          sim,
          chassisTest,
          playerWeaponHit,
          bossWeaponHit,
          weaponClash,
          subDt
        );
      }
    }

    // Position Projection (Strict Non-Penetration Constraint for non-riding contacts)
    if (!handledByBullWedge && chassisTest.overlap && sim.wedgePhase !== 'riding') {
      const nx = chassisTest.normal[0];
      const nz = chassisTest.normal[1];
      const penetration = chassisTest.penetration;
      player.x -= nx * penetration * w1;
      player.z -= nz * penetration * w1;
      boss.x += nx * penetration * w2;
      boss.z += nz * penetration * w2;
    }

    // 1. High-Level Combat Weapon Engagement (Evaluated on weapon contact before recoil deflection)
    if (!handledByBullWedge && sim.contactCooldownSec <= 0 && (playerWeaponHit.hit || bossWeaponHit.hit || weaponClash.overlap)) {
      const impactNx = chassisTest.overlap
        ? chassisTest.normal[0]
        : (boss.x - player.x) / Math.max(0.001, Math.hypot(boss.x - player.x, boss.z - player.z));
      const impactNz = chassisTest.overlap
        ? chassisTest.normal[1]
        : (boss.z - player.z) / Math.max(0.001, Math.hypot(boss.x - player.x, boss.z - player.z));
      resolveEngagementImpact(sim, impactNx, impactNz, playerWeaponHit.hit, bossWeaponHit.hit, weaponClash.overlap, dt);
    }

    // 2. Chassis Contact & Sustained Pushing Physics
    if (!handledByBullWedge && chassisTest.overlap) {
      const nx = chassisTest.normal[0];
      const nz = chassisTest.normal[1];

      // Relative velocity along collision normal (pointing from Player to Boss)
      const vRel = (player.vx - boss.vx) * nx + (player.vz - boss.vz) * nz;

      if (vRel > 0.55) {
        // High-speed collision: Semi-elastic impulse deflection amplified by CHASSIS_RAM_RESPONSE_SCALE
        const restitution = 0.32;
        const baseImpulse = ((1 + restitution) * vRel) / (1 / m1 + 1 / m2);
        const impulse = baseImpulse * CHASSIS_RAM_RESPONSE_SCALE;

        player.vx -= (nx * impulse) / m1;
        player.vz -= (nz * impulse) / m1;
        boss.vx += (nx * impulse) / m2;
        boss.vz += (nz * impulse) / m2;

        // Contact offset vectors from bot centers
        const r1x = chassisTest.contactPoint[0] - player.x;
        const r1z = chassisTest.contactPoint[1] - player.z;
        const r2x = chassisTest.contactPoint[0] - boss.x;
        const r2z = chassisTest.contactPoint[1] - boss.z;

        // Moment of Inertia for rectangular chassis: I = 1/12 * m * (w^2 + l^2)
        const pW = playerModel.chassis.halfExtents[0] * 2;
        const pL = playerModel.chassis.halfExtents[1] * 2;
        const I1 = (1 / 12) * m1 * (pW * pW + pL * pL);

        const bW = bossModel.chassis.halfExtents[0] * 2;
        const bL = bossModel.chassis.halfExtents[1] * 2;
        const I2 = (1 / 12) * m2 * (bW * bW + bL * bL);

        // Torque impulse tau = rx * Jz - rz * Jx amplified by ANGULAR_IMPULSE_SCALE
        const tauPlayer = (r1x * (-nz * impulse) - r1z * (-nx * impulse)) * ANGULAR_IMPULSE_SCALE;
        const deltaOmegaPlayer = THREE.MathUtils.clamp(tauPlayer / I1, -28, 28);
        player.angularVelocityRad += deltaOmegaPlayer;

        const tauBoss = (r2x * (nz * impulse) - r2z * (nx * impulse)) * ANGULAR_IMPULSE_SCALE;
        const deltaOmegaBoss = THREE.MathUtils.clamp(tauBoss / I2, -28, 28);
        boss.angularVelocityRad += deltaOmegaBoss;

        // Traction break on chassis collision
        const tBreakDuration = Math.min(0.42, 0.16 + (impulse / 95) * 0.22);
        player.tractionBreakTimerSec = Math.max(player.tractionBreakTimerSec, tBreakDuration);
        player.skidVx = (-nx * impulse) / m1;
        player.skidVz = (-nz * impulse) / m1;

        boss.tractionBreakTimerSec = Math.max(boss.tractionBreakTimerSec, tBreakDuration);
        boss.skidVx = (nx * impulse) / m2;
        boss.skidVz = (nz * impulse) / m2;

        // High-speed chassis ramming damage (applied on initial impact with nonlinear compression)
        let ramDmg = 0;
        let hitSector: 'front' | 'corner' | 'side' | 'rear' = 'front';
        let ramResult: ReturnType<typeof applyCombatDamage> | undefined;
        if (vRel > 1.8 && (!sim.contactActive || sim.timeSec - sim.lastImpactTimeSec > 0.20)) {
          ramDmg = 2.0 + Math.min(5.0, (vRel - 1.8) * 1.3);
          const pFwd = r1x * Math.sin(player.headingRad) + r1z * Math.cos(player.headingRad);
          const pSide = r1x * Math.cos(player.headingRad) - r1z * Math.sin(player.headingRad);
          hitSector = Math.abs(pSide) >= Math.abs(pFwd) ? 'side' : pFwd > 0 ? 'front' : 'rear';
          ramResult = applyCombatDamage(sim, player, true, ramDmg, hitSector, false);
          applyCombatDamage(sim, boss, false, ramDmg * 0.6, 'front', false);
        }

        // Authoritative impact event on first contact or after cooldown
        if (!sim.contactActive || sim.timeSec - sim.lastImpactTimeSec > 0.22) {
          createCombatImpactEvent(
            sim,
            chassisTest.contactPoint,
            chassisTest.normal,
            vRel,
            impulse,
            'chassis',
            m1 > m2 ? 'player' : 'boss',
            m1 > m2 ? 'boss' : 'player',
            0,
            impulse / (m1 > m2 ? m2 : m1),
            Math.abs(m1 > m2 ? deltaOmegaBoss : deltaOmegaPlayer),
            tBreakDuration,
            hitSector,
            ramDmg > 0 ? ramDmg : undefined,
            ramResult?.effectiveMitigation,
            ramResult?.finalHullDmg,
            {
              damageSeverity: ramResult?.damageSeverity ?? 'minimal',
              attackClassification: vRel > 1.8 ? 'NEW_STRIKE' : 'SUSTAINED_CONTACT',
              attackType: 'ram',
              armorAbsorbed: ramResult?.armorAbsorbed,
              componentDamage: ramResult?.componentDmg,
              targetHealthBefore: ramResult?.targetHealthBefore,
              targetHealthAfter: ramResult?.targetHealthAfter,
            }
          );
          sim.lastImpactTimeSec = sim.timeSec;
        }
        sim.contactActive = true;
      } else if (vRel >= 0 && sim.contactCooldownSec <= 0 && player.tractionBreakTimerSec <= 0 && boss.tractionBreakTimerSec <= 0) {
        sim.contactActive = true;
        // Sustained pushing contact (at low relative speed, ONLY when moving toward each other and neither is recovering from an impact!)
        const pFwdX = Math.sin(player.headingRad);
        const pFwdZ = Math.cos(player.headingRad);
        const bFwdX = Math.sin(boss.headingRad);
        const bFwdZ = Math.cos(boss.headingRad);

        // Drive force projected along contact normal
        const pPushDir = pFwdX * nx + pFwdZ * nz;
        const bPushDir = bFwdX * (-nx) + bFwdZ * (-nz);

        // Pushing fatigue tracking (wheel slip & motor thermal load on sustained push)
        if (bossId === 'bull' && bPushDir > 0.45) {
          sim.bullPushSustainedSec += subDt;
        } else {
          sim.bullPushSustainedSec = Math.max(0, sim.bullPushSustainedSec - subDt * 1.5);
        }

        // After 1.5s of sustained pushing, wheel slip and high motor load drop pushing force down to 45% by 3.5s
        const pushFatigueFactor = Math.max(0.45, 1.0 - Math.max(0, sim.bullPushSustainedSec - 1.5) * 0.28);

        // Progressive wedge condition modifies front plow leverage bonus
        const bWedgeCond = getWedgeCondition(boss.frontArmorPct);
        const wedgeLeverageBonus =
          bWedgeCond === 'healthy' ? 1.25 :
          bWedgeCond === 'damaged' ? 1.10 :
          bWedgeCond === 'heavily-damaged' ? 0.95 : 0.70;

        const bossDriveHealth = (boss.leftDriveHealthPct + boss.rightDriveHealthPct) * 0.005;
        const pDriveForce = playerStats.pushingForceN * Math.max(0, pPushDir);
        let bDriveForce = bossStats.pushingForceN * Math.max(0, bPushDir) * bossDriveHealth;
        // The Bull bronze wedge leverage bonus during active charge or front plow contact
        if (bossId === 'bull' && (sim.bossChargeActiveSec > 0 || bPushDir > 0.6)) {
          bDriveForce *= wedgeLeverageBonus;
        }
        bDriveForce *= pushFatigueFactor;

        const netPushForce = pDriveForce - bDriveForce; // > 0 moves along +normal (player pushes boss)
        const aPush = netPushForce / (m1 + m2);

        // Current normal velocities
        const v1n = player.vx * nx + player.vz * nz;
        const v2n = boss.vx * nx + boss.vz * nz;
        const commonVn = (m1 * v1n + m2 * v2n) / (m1 + m2);
        const targetVn = THREE.MathUtils.clamp(commonVn + aPush * subDt, -1.8, 1.8);

        // Resolve velocities without bouncing apart
        player.vx = player.vx - v1n * nx + targetVn * nx;
        player.vz = player.vz - v1n * nz + targetVn * nz;
        boss.vx = boss.vx - v2n * nx + targetVn * nx;
        boss.vz = boss.vz - v2n * nz + targetVn * nz;

        if (netPushForce > 20) {
          sim.playerPushTimeSec += subDt;
        } else if (netPushForce < -20) {
          sim.bossPushTimeSec += subDt;
          sim.bullPushTimeSec += subDt;
          if (bossId === 'bull') {
            sim.bullPushSustainedSec += subDt;
          }
        }
      }
    }
  }

  // Bull Sustained Pushing Fatigue Tracker
  const bPushingContact = sim.contactActive && (sim.bossChargeActiveSec > 0 || sim.bossPushTimeSec > 0 || sim.bullPushTimeSec > 0);
  if (bossId === 'bull' && bPushingContact) {
    sim.bullPushSustainedSec += dt;
  } else if (!sim.contactActive) {
    sim.bullPushSustainedSec = Math.max(0, sim.bullPushSustainedSec - dt * 1.5);
  }

  // 6. CHECK KNOCKOUT / WIN CONDITIONS
  const bossDriveAvg = (boss.leftDriveHealthPct + boss.rightDriveHealthPct) * 0.5;
  const playerDriveAvg = (player.leftDriveHealthPct + player.rightDriveHealthPct) * 0.5;

  if (boss.hullIntegrityPct <= 0 || bossDriveAvg <= 8) {
    finishBattle(
      sim,
      'player',
      bossDriveAvg <= 8
        ? `${sim.bossDossier.name}'s drivetrain was disabled and immobilized!`
        : `${sim.bossDossier.name}'s structural armor was breached and destroyed!`
    );
    return;
  }

  if (player.hullIntegrityPct <= 0 || playerDriveAvg <= 8 || player.batteryPct <= 0.5) {
    const reason =
      player.batteryPct <= 0.5
        ? 'Your battery depleted completely before the match ended.'
        : playerDriveAvg <= 8
        ? 'Your drive wheels/motors were disabled, leaving your robot immobilized.'
        : `Repeated impacts from ${sim.bossDossier.name} overwhelmed your chassis armor.`;
    finishBattle(sim, 'boss', reason);
    return;
  }

  // Judges decision on 36s time expiration
  if (sim.timeSec >= sim.maxDurationSec) {
    const playerScore =
      (100 - boss.hullIntegrityPct) * 1.5 +
      (100 - bossDriveAvg) * 1.2 +
      sim.flipsInflicted * 25 +
      sim.impactsDelivered * 8 +
      sim.playerPushTimeSec * 10;
    const bossScore =
      (100 - player.hullIntegrityPct) * 1.1 +
      (100 - playerDriveAvg) * 1.0 +
      sim.bossPushTimeSec * 4;

    if (playerScore >= bossScore) {
      finishBattle(sim, 'player', 'Time expired — Your robot won the Arena Control & Damage decision!');
    } else {
      finishBattle(sim, 'boss', `Time expired — ${sim.bossDossier.name} controlled the arena and dealt greater damage.`);
    }
  }
}

/**
 * Physical multi-outcome Bull Wedge dynamics solver.
 * Handles:
 * 1. LIFTED WEAPON COUNTER (Outcome C): Active spinning weapon strikes Bull plow/deck while lifted
 * 2. SIDE DEFLECTION (Outcome D): Angled/glancing engagement slides player off wedge with yaw torque
 * 3. RIDE OVER / PASS BEHIND BULL (Outcome B): Tangential velocity carries forward momentum up/across Bull
 * 4. FLIP / KNOCKBACK (Outcome A): Overwhelming Bull charge overturns high-CoM/low-stability robot
 * 5. NORMAL SEPARATION: Stable robot pushed backward onto wheels without flipping
 */
function resolveBullWedgeInteraction(
  sim: LiveBattleSimulation,
  chassisTest: { overlap: boolean; normal: [number, number]; penetration: number; contactPoint: [number, number] },
  playerWeaponHit: { hit: boolean; contactPoint: [number, number] },
  bossWeaponHit: { hit: boolean; contactPoint: [number, number] },
  weaponClash: { overlap: boolean; normal: [number, number]; penetration: number; contactPoint: [number, number] },
  subDt: number
): boolean {
  const { player, boss, playerStats, bossStats } = sim;

  // Bull orientation unit vectors
  const fBx = Math.sin(boss.headingRad);
  const fBz = Math.cos(boss.headingRad);
  const rBx = Math.cos(boss.headingRad);
  const rBz = -Math.sin(boss.headingRad);

  // Player orientation unit vectors
  const fPx = Math.sin(player.headingRad);
  const fPz = Math.cos(player.headingRad);

  // Contact location in world space
  const cx = chassisTest.overlap
    ? chassisTest.contactPoint[0]
    : weaponClash.overlap
    ? weaponClash.contactPoint[0]
    : playerWeaponHit.hit
    ? playerWeaponHit.contactPoint[0]
    : bossWeaponHit.hit
    ? bossWeaponHit.contactPoint[0]
    : (player.x + boss.x) * 0.5;
  const cz = chassisTest.overlap
    ? chassisTest.contactPoint[1]
    : weaponClash.overlap
    ? weaponClash.contactPoint[1]
    : playerWeaponHit.hit
    ? playerWeaponHit.contactPoint[1]
    : bossWeaponHit.hit
    ? bossWeaponHit.contactPoint[1]
    : (player.z + boss.z) * 0.5;

  const dx = cx - boss.x;
  const dz = cz - boss.z;
  const latOffset = dx * rBx + dz * rBz;
  const latOffsetNorm = THREE.MathUtils.clamp(latOffset / 1.135, -1, 1);

  // Approach angle (0 = head-on, PI = rear-on)
  const angleDiff = Math.abs(normalizeAngle(player.headingRad - (boss.headingRad + Math.PI)));
  const angleDeg = (angleDiff * 180) / Math.PI;

  // Speeds & momentum
  const vBullFwd = boss.vx * fBx + boss.vz * fBz;
  const vPlayerApproach = -(player.vx * fBx + player.vz * fBz);
  const vPlayerFwd = player.vx * fPx + player.vz * fPz;
  const vClose = Math.max(0, vBullFwd + vPlayerApproach);
  const vTangent = vPlayerApproach;
  const vLateral = (player.vx - boss.vx) * rBx + (player.vz - boss.vz) * rBz;

  const m1 = Math.max(12, playerStats.totalWeightLb);
  const m2 = Math.max(12, bossStats.totalWeightLb);
  const pPlayer = m1 * Math.max(0, vPlayerApproach);
  const pBull = m2 * Math.max(0, vBullFwd);

  const weaponSpin = player.weaponSpinPct;
  const isSpinner = playerStats.weaponTypeCategory === 'spinner-vert' || playerStats.weaponTypeCategory === 'spinner-horiz';
  const weaponActive = (weaponSpin >= 20 && isSpinner) || player.weaponActuationPhase > 0 || (sim.playerInput?.weaponActive ?? false);

  // =========================================================================
  // CONTINUED RIDING PHASE:
  // Robot is already climbing/sliding along Bull's wedge/top deck
  // =========================================================================
  if (sim.wedgePhase === 'riding') {
    sim.wedgeTimerSec -= subDt;

    // Check if player's active spinning weapon clips Bull's top deck while riding
    if (weaponActive && player.weaponHealthPct > 15 && isSpinner && weaponSpin >= 20) {
      return triggerLiftedWeaponCounter();
    }

    // Advance player across Bull along -fB (toward Bull's rear)
    const rideSpeed = Math.max(2.4, vTangent);
    player.x -= fBx * rideSpeed * subDt;
    player.z -= fBz * rideSpeed * subDt;

    // Bull is weighed down and halted by player's mass riding over its deck
    boss.vx = 0;
    boss.vz = 0;
    sim.bossStunTimerSec = Math.max(sim.bossStunTimerSec, 0.45);

    // Settle pitch smoothly as robot balances across Bull's top deck
    player.pitchRad = Math.max(0.08, player.pitchRad - subDt * 1.6);

    // Check if player's center has passed Bull's rear edge
    const relToBullFwd = (player.x - boss.x) * fBx + (player.z - boss.z) * fBz;
    if (relToBullFwd < -0.15 || sim.wedgeTimerSec <= 0) {
      // Player clears the rear of Bull and lands behind!
      sim.wedgePhase = 'none';
      sim.contactCooldownSec = 0.45;
      player.pitchRad = 0.05; // Gentle landing bounce
      player.tractionBreakTimerSec = 0.16;
      addEvent(sim, 'RAMPED OVER THE BULL — CLEAN LANDING BEHIND!', 'info');

      sim.lastWedgeTelemetry = {
        relativeClosingSpeed: vClose,
        playerFwdSpeed: vPlayerFwd,
        bullFwdSpeed: vBullFwd,
        contactAngleDeg: angleDeg,
        contactPoint: [cx, cz],
        contactLateralOffset: latOffset,
        tangentialSpeed: vTangent,
        normalSpeed: vClose,
        playerPitchRad: player.pitchRad,
        playerOmega: player.angularVelocityRad,
        playerStability: playerStats.stabilityScore,
        playerCoM: playerStats.centerOfMassLabel,
        weaponActive,
        weaponRpmPct: weaponSpin,
        outcome: 'RIDE_OVER',
      };
    }
    return true;
  }

  // =========================================================================
  // INITIAL WEDGE CONTACT RESOLUTION:
  // =========================================================================

  function triggerLiftedWeaponCounter(): boolean {
    if (playerStats.weaponTypeCategory === 'hammer') {
      sim.impactsDelivered++;
      const rawHammerDmg = 14 + (playerStats.weaponEnergyJ / 260);
      const hitDmgResult = applyCombatDamage(sim, boss, false, rawHammerDmg, 'rear', true);

      sim.bossStunTimerSec = 0.75;
      sim.bossRepositionTimerSec = 1.25;
      sim.bossChargeActiveSec = 0;
      boss.tractionBreakTimerSec = 0.45;
      boss.pitchRad = 0.35;

      const shoveSpeed = 3.2;
      boss.vx -= fBx * shoveSpeed;
      boss.vz -= fBz * shoveSpeed;

      player.pitchRad = 0.04;
      player.isFlipped = false;

      createCombatImpactEvent(
        sim,
        [cx, cz],
        [fBx, fBz],
        shoveSpeed,
        140,
        'weapon',
        'player',
        'boss',
        playerStats.weaponEnergyJ,
        shoveSpeed,
        0,
        0.45,
        'rear',
        rawHammerDmg,
        hitDmgResult.effectiveMitigation,
        hitDmgResult.finalHullDmg,
        {
          damageSeverity: hitDmgResult.damageSeverity,
          attackClassification: 'NEW_STRIKE',
          attackType: 'hammer',
          armorAbsorbed: hitDmgResult.armorAbsorbed,
          componentDamage: hitDmgResult.componentDmg,
          targetHealthBefore: hitDmgResult.targetHealthBefore,
          targetHealthAfter: hitDmgResult.targetHealthAfter,
        }
      );

      addEvent(sim, `HAMMER CRUSHED ${sim.bossDossier.name.toUpperCase()} TOP DECK!`, 'impact');
      sim.contactCooldownSec = 0.65;
      sim.wedgePhase = 'none';
      return true;
    }

    const rpmBefore = weaponSpin;
    const spinFrac = Math.pow(weaponSpin / 100, 2);
    const rawKineticEnergyJ = Math.max(400, playerStats.weaponEnergyJ * spinFrac);
    sim.impactsDelivered++;

    const compressedE = compressKineticDamageEnergy(rawKineticEnergyJ);
    const rawKineticDmg = 5.0 + compressedE / 90;
    const hitDmgResult = applyCombatDamage(sim, boss, false, rawKineticDmg, 'front', true);

    const baseImpulse = Math.sqrt(2 * ((m1 * m2) / (m1 + m2)) * rawKineticEnergyJ);
    const impulse = baseImpulse * WEAPON_IMPACT_RESPONSE_SCALE;

    const knockbackSpeed = THREE.MathUtils.clamp(
      (3.2 + (rawKineticEnergyJ / 750) * 2.2) * WEAPON_IMPACT_RESPONSE_SCALE * (24 / m2),
      3.2,
      14.0
    );
    boss.vx -= fBx * knockbackSpeed;
    boss.vz -= fBz * knockbackSpeed;
    sim.bossStunTimerSec = 0.65;
    sim.bossRepositionTimerSec = 1.25;
    sim.bossChargeActiveSec = 0;

    const recoilRatio = playerStats.weaponRecoilScore / 100;
    const targetImpulseMag = m2 * knockbackSpeed;
    const attackerReactionImpulse = targetImpulseMag * (recoilRatio * 0.45 + 0.55);
    const playerRecoilSpeed = THREE.MathUtils.clamp(attackerReactionImpulse / m1, 2.0, 9.0);
    player.vx += fBx * playerRecoilSpeed;
    player.vz += fBz * playerRecoilSpeed;

    // Reset pitch back onto wheels!
    player.pitchRad = 0.04;
    player.isFlipped = false;

    // Angular yaw torque
    const sgn = latOffset !== 0 ? Math.sign(latOffset) : 1;
    player.angularVelocityRad += THREE.MathUtils.clamp(-sgn * 18, -28, 28);
    boss.angularVelocityRad += THREE.MathUtils.clamp(sgn * 22, -28, 28);

    player.tractionBreakTimerSec = 0.35;
    boss.tractionBreakTimerSec = 0.45;
    player.skidVx = player.vx * 0.65;
    player.skidVz = player.vz * 0.65;
    boss.skidVx = boss.vx * 0.65;
    boss.skidVz = boss.vz * 0.65;

    // Weapon RPM drain
    player.weaponSpinPct = Math.max(6, Math.min(22, player.weaponSpinPct * 0.18));
    const rpmAfter = player.weaponSpinPct;
    const energyAfter = playerStats.weaponEnergyJ * Math.pow(player.weaponSpinPct / 100, 2);

    createCombatImpactEvent(
      sim,
      [cx, cz],
      [fBx, fBz],
      knockbackSpeed + playerRecoilSpeed,
      impulse,
      'weapon',
      'player',
      'boss',
      rawKineticEnergyJ,
      knockbackSpeed,
      Math.abs(boss.angularVelocityRad),
      0.45,
      'front',
      rawKineticDmg,
      hitDmgResult.effectiveMitigation,
      hitDmgResult.finalHullDmg,
      {
        damageSeverity: hitDmgResult.damageSeverity,
        attackClassification: 'NEW_STRIKE',
        attackType: playerStats.weaponTypeCategory,
        weaponRpmBefore: rpmBefore,
        weaponEnergyBefore: rawKineticEnergyJ,
        weaponRpmAfter: rpmAfter,
        weaponEnergyAfter: energyAfter,
        armorAbsorbed: hitDmgResult.armorAbsorbed,
        componentDamage: hitDmgResult.componentDmg,
        targetHealthBefore: hitDmgResult.targetHealthBefore,
        targetHealthAfter: hitDmgResult.targetHealthAfter,
        attackerReactionImpulse,
        attackerDeltaV: playerRecoilSpeed,
        attackerDeltaOmega: Math.abs(player.angularVelocityRad),
      }
    );

    addEvent(sim, 'LIFTED WEAPON COUNTER — SPINNER STRUCK BULL UPPER DECK!', 'impact');
    sim.contactCooldownSec = 0.65;
    sim.wedgePhase = 'none';

    sim.lastWedgeTelemetry = {
      relativeClosingSpeed: vClose,
      playerFwdSpeed: vPlayerFwd,
      bullFwdSpeed: vBullFwd,
      contactAngleDeg: angleDeg,
      contactPoint: [cx, cz],
      contactLateralOffset: latOffset,
      tangentialSpeed: vTangent,
      normalSpeed: vClose,
      playerPitchRad: player.pitchRad,
      playerOmega: player.angularVelocityRad,
      playerStability: playerStats.stabilityScore,
      playerCoM: playerStats.centerOfMassLabel,
      weaponActive,
      weaponRpmPct: weaponSpin,
      outcome: 'WEAPON_COUNTER',
    };
    return true;
  }

  // 1. OUTCOME C: LIFTED WEAPON COUNTER
  // If player is facing Bull with an active spinning/actuated weapon,
  // as the wedge lifts the player, the weapon cuts directly into Bull's plow/deck!
  if (weaponActive && player.weaponHealthPct > 15 && (isSpinner ? weaponSpin >= 20 : true) && angleDiff < 1.35) {
    return triggerLiftedWeaponCounter();
  }

  // 2. OUTCOME D: SIDE DEFLECTION
  // Angled or off-center engagement where the wedge face normal deflects the robot sideways
  const isAngled = angleDiff > 0.48; // > ~28 deg
  const isOffCenter = Math.abs(latOffsetNorm) > 0.40; // > 40% of Bull width
  if (isAngled || isOffCenter) {
    const sLat = latOffset !== 0 ? Math.sign(latOffset) : (vLateral !== 0 ? Math.sign(vLateral) : 1);

    // Lateral deflection velocity
    const lateralSpeed = 2.4 + Math.abs(vLateral) * 0.65 + vClose * 0.35;
    player.vx = rBx * sLat * lateralSpeed - fBx * Math.max(0.8, vPlayerApproach * 0.60);
    player.vz = rBz * sLat * lateralSpeed - fBz * Math.max(0.8, vPlayerApproach * 0.60);

    boss.vx -= rBx * sLat * 0.65;
    boss.vz -= rBz * sLat * 0.65;

    // Strong yaw rotation on both bots
    player.angularVelocityRad += sLat * THREE.MathUtils.clamp(12 + vClose * 2.2, 10, 28);
    boss.angularVelocityRad -= sLat * THREE.MathUtils.clamp(6 + vClose * 1.5, 5, 20);

    // Mild pitch and roll (lifted wheel, NOT a flip)
    player.pitchRad = 0.22 + Math.min(0.12, vClose * 0.02);
    player.rollRad = -sLat * 0.28;

    player.tractionBreakTimerSec = 0.26;
    boss.tractionBreakTimerSec = 0.20;
    player.skidVx = player.vx * 0.65;
    player.skidVz = player.vz * 0.65;
    boss.skidVx = boss.vx * 0.65;
    boss.skidVz = boss.vz * 0.65;

    applyCombatDamage(sim, player, true, 4.0 + vClose * 1.1, 'side', false);
    applyCombatDamage(sim, boss, false, 2.0, 'front', false);

    createCombatImpactEvent(
      sim,
      [cx, cz],
      [fBx, fBz],
      vClose,
      65 + vClose * 15,
      'chassis',
      'boss',
      'player',
      0,
      lateralSpeed,
      Math.abs(player.angularVelocityRad),
      0.26
    );

    addEvent(sim, 'DEFLECTED OFF WEDGE — GLANCING IMPACT', 'warning');
    sim.bossRepositionTimerSec = 0.9;
    sim.bossChargeActiveSec = 0;
    boss.aiStateLabel = 'REPOSITION';
    sim.wedgePhase = 'none';

    sim.lastWedgeTelemetry = {
      relativeClosingSpeed: vClose,
      playerFwdSpeed: vPlayerFwd,
      bullFwdSpeed: vBullFwd,
      contactAngleDeg: angleDeg,
      contactPoint: [cx, cz],
      contactLateralOffset: latOffset,
      tangentialSpeed: vTangent,
      normalSpeed: vClose,
      playerPitchRad: player.pitchRad,
      playerOmega: player.angularVelocityRad,
      playerStability: playerStats.stabilityScore,
      playerCoM: playerStats.centerOfMassLabel,
      weaponActive,
      weaponRpmPct: weaponSpin,
      outcome: 'SIDE_DEFLECTION',
    };
    return true;
  }

  // 3. OUTCOME B: RIDE OVER / PASS BEHIND BULL
  // Player has strong forward approach speed and momentum; wedge acts as ramp
  const hasStrongApproachSpeed = vPlayerApproach >= 1.5;
  const hasStrongMomentum = pPlayer >= pBull * 0.45 || (vPlayerApproach >= 1.8 && vBullFwd < 2.2);
  const isCentered = angleDiff <= 0.55 && Math.abs(latOffsetNorm) <= 0.55;
  const isStableEnough = (playerStats.centerOfMassLabel !== 'HIGH' && playerStats.stabilityScore >= 34) || vPlayerApproach >= 2.6;

  if (hasStrongApproachSpeed && hasStrongMomentum && isCentered && isStableEnough) {
    const rampSpeed = Math.max(2.6, vTangent * 0.92);
    // Tangential velocity carried up and across wedge along -fB
    player.vx = -fBx * rampSpeed + rBx * (vLateral * 0.4);
    player.vz = -fBz * rampSpeed + rBz * (vLateral * 0.4);

    boss.vx -= fBx * Math.min(2.0, (pPlayer / m2) * 0.85);
    boss.vz -= fBz * Math.min(2.0, (pPlayer / m2) * 0.85);

    player.pitchRad = 0.38 + Math.min(0.12, vClose * 0.02);

    // Translate slightly onto front deck
    player.x -= fBx * 0.32;
    player.z -= fBz * 0.32;

    sim.wedgePhase = 'riding';
    sim.wedgeTimerSec = 0.40;
    player.skidVx = player.vx * 0.5;
    player.skidVz = player.vz * 0.5;

    createCombatImpactEvent(
      sim,
      [cx, cz],
      [fBx, fBz],
      vClose,
      45 + vClose * 10,
      'chassis',
      'player',
      'boss',
      0,
      rampSpeed,
      Math.abs(player.angularVelocityRad),
      0.16
    );

    addEvent(sim, 'ROBOT RIDING UP THE BULL WEDGE!', 'info');

    sim.lastWedgeTelemetry = {
      relativeClosingSpeed: vClose,
      playerFwdSpeed: vPlayerFwd,
      bullFwdSpeed: vBullFwd,
      contactAngleDeg: angleDeg,
      contactPoint: [cx, cz],
      contactLateralOffset: latOffset,
      tangentialSpeed: vTangent,
      normalSpeed: vClose,
      playerPitchRad: player.pitchRad,
      playerOmega: player.angularVelocityRad,
      playerStability: playerStats.stabilityScore,
      playerCoM: playerStats.centerOfMassLabel,
      weaponActive,
      weaponRpmPct: weaponSpin,
      outcome: 'RIDE_OVER',
    };
    return true;
  }

  // 4. OUTCOME A: FLIP vs NORMAL SEPARATION
  // Bull dominates momentum, gets underneath player
  const bullDominatedMomentum = pBull > pPlayer * 1.45 && (vBullFwd >= 2.0 || sim.bossChargeActiveSec > 0 || vClose >= 3.0);
  const playerLowApproach = vPlayerApproach < 1.1;
  const isVulnerableStability =
    playerStats.stabilityScore < 36 ||
    (playerStats.centerOfMassLabel === 'HIGH' && vClose >= 3.0) ||
    (playerStats.stabilityScore < 48 && vClose >= 4.2);

  if (bullDominatedMomentum && playerLowApproach && isVulnerableStability) {
    // FLIP OUTCOME
    player.pitchRad = 0.72 + Math.min(0.20, vClose * 0.03);
    player.isFlipped = true;
    sim.flipsInflicted++;

    const vKnock = THREE.MathUtils.clamp(3.4 + vClose * 0.85, 3.2, 9.5);
    player.vx = fBx * vKnock + rBx * (latOffsetNorm * 2.0);
    player.vz = fBz * vKnock + rBz * (latOffsetNorm * 2.0);

    player.tractionBreakTimerSec = 0.50;
    player.skidVx = player.vx * 0.7;
    player.skidVz = player.vz * 0.7;

    sim.bossRepositionTimerSec = 1.1;
    sim.bossChargeActiveSec = 0;
    boss.aiStateLabel = 'REPOSITION';

    createCombatImpactEvent(
      sim,
      [cx, cz],
      [fBx, fBz],
      vClose,
      m1 * vKnock,
      'chassis',
      'boss',
      'player',
      0,
      vKnock,
      Math.abs(player.angularVelocityRad),
      0.50
    );

    addEvent(sim, `${sim.bossDossier.name.toUpperCase()} WEDGE CHARGE OVERTURNED ROBOT!`, 'critical');
    sim.wedgePhase = 'none';

    sim.lastWedgeTelemetry = {
      relativeClosingSpeed: vClose,
      playerFwdSpeed: vPlayerFwd,
      bullFwdSpeed: vBullFwd,
      contactAngleDeg: angleDeg,
      contactPoint: [cx, cz],
      contactLateralOffset: latOffset,
      tangentialSpeed: vTangent,
      normalSpeed: vClose,
      playerPitchRad: player.pitchRad,
      playerOmega: player.angularVelocityRad,
      playerStability: playerStats.stabilityScore,
      playerCoM: playerStats.centerOfMassLabel,
      weaponActive,
      weaponRpmPct: weaponSpin,
      outcome: 'FLIP',
    };
    return true;
  }

  // 5. NORMAL SEPARATION (Player stable or low-energy contact, pushed back onto wheels)
  const vPush = 1.8 + vClose * 0.45;
  player.vx = fBx * vPush;
  player.vz = fBz * vPush;
  boss.vx -= fBx * 0.8;
  boss.vz -= fBz * 0.8;

  sim.bullPushSustainedSec += subDt * 2.0;

  player.pitchRad = 0.44 + Math.min(0.12, vClose * 0.02);
  player.isFlipped = false; // Guarantees staying on wheels!
  player.tractionBreakTimerSec = 0.28;
  player.skidVx = player.vx * 0.65;
  player.skidVz = player.vz * 0.65;
  boss.skidVx = boss.vx * 0.65;
  boss.skidVz = boss.vz * 0.65;

  sim.bossRepositionTimerSec = 1.0;
  sim.bossChargeActiveSec = 0;
  boss.aiStateLabel = 'REPOSITION';

  createCombatImpactEvent(
    sim,
    [cx, cz],
    [fBx, fBz],
    vClose,
    75 + vClose * 12,
    'chassis',
    'boss',
    'player',
    0,
    vPush,
    Math.abs(player.angularVelocityRad),
    0.28
  );

  addEvent(sim, `${sim.bossDossier.name.toUpperCase()} WEDGE PUSHED ROBOT BACKWARD`, 'warning');
  sim.wedgePhase = 'none';

  sim.lastWedgeTelemetry = {
    relativeClosingSpeed: vClose,
    playerFwdSpeed: vPlayerFwd,
    bullFwdSpeed: vBullFwd,
    contactAngleDeg: angleDeg,
    contactPoint: [cx, cz],
    contactLateralOffset: latOffset,
    tangentialSpeed: vTangent,
    normalSpeed: vClose,
    playerPitchRad: player.pitchRad,
    playerOmega: player.angularVelocityRad,
    playerStability: playerStats.stabilityScore,
    playerCoM: playerStats.centerOfMassLabel,
    weaponActive,
    weaponRpmPct: weaponSpin,
    outcome: 'NORMAL_SEPARATION',
  };
  return true;
}

function resolveEngagementImpact(
  sim: LiveBattleSimulation,
  nx: number,
  nz: number,
  playerHit: boolean,
  bossHit: boolean,
  weaponClash: boolean,
  dt: number
): void {
  const { player, boss, playerStats, bossStats, strategy, bossId } = sim;

  const anglePlayerToBoss = Math.atan2(nx, nz);
  const playerAttackAngle = Math.abs(normalizeAngle(player.headingRad - anglePlayerToBoss));
  const playerPresentingFront = playerAttackAngle < 0.75;
  const playerHitOnSide = playerAttackAngle >= 0.72 && playerAttackAngle <= 2.35;

  const angleBossToPlayer = Math.atan2(-nx, -nz);
  const bossHitAngle = Math.abs(normalizeAngle(boss.headingRad - angleBossToPlayer));
  const bossHitOnFront = bossHitAngle < 0.75;
  const bossHitOnSide = bossHitAngle >= 0.65 && bossHitAngle <= 2.25;

  const wType = playerStats.weaponTypeCategory;
  player.weaponActuationPhase = 1.0;

  const midX = (player.x + boss.x) * 0.5;
  const midZ = (player.z + boss.z) * 0.5;

  const m1 = Math.max(12, playerStats.totalWeightLb);
  const m2 = Math.max(12, bossStats.totalWeightLb);
  const w1 = m2 / (m1 + m2);
  const w2 = m1 / (m1 + m2);

  // Rigid-body moments of inertia
  const playerModel = getRobotCollisionModel(player.x, player.z, player.headingRad, sim.playerConfig, null);
  const bossModel = getRobotCollisionModel(boss.x, boss.z, boss.headingRad, sim.bossDossier.config, bossId);
  const pW = playerModel.chassis.halfExtents[0] * 2;
  const pL = playerModel.chassis.halfExtents[1] * 2;
  const I1 = (1 / 12) * m1 * (pW * pW + pL * pL);
  const bW = bossModel.chassis.halfExtents[0] * 2;
  const bL = bossModel.chassis.halfExtents[1] * 2;
  const I2 = (1 / 12) * m2 * (bW * bW + bL * bL);

  const r1x = midX - player.x;
  const r1z = midZ - player.z;
  const r2x = midX - boss.x;
  const r2z = midZ - boss.z;

  const isKineticA = wType === 'spinner-vert' || wType === 'spinner-horiz';
  const isKineticB = bossStats.weaponTypeCategory === 'spinner-vert' || bossStats.weaponTypeCategory === 'spinner-horiz';
  const trueKineticClash = weaponClash && isKineticA && isKineticB;

  // 1. DIRECT WEAPON CLASH
  if (trueKineticClash) {
    sim.impactsDelivered++;
    const bossEnergy = bossStats.weaponEnergyJ * (boss.weaponSpinPct / 100);
    const playerEnergy = playerStats.weaponEnergyJ * (player.weaponSpinPct / 100);
    const clashEnergy = Math.max(bossEnergy, playerEnergy);

    // Apply instant separation buffer
    const sep = SEPARATION_BUFFER_METERS;
    player.x -= nx * sep * w1;
    player.z -= nz * sep * w1;
    boss.x += nx * sep * w2;
    boss.z += nz * sep * w2;

    const baseImpulseMag = Math.sqrt(2 * ((m1 * m2) / (m1 + m2)) * Math.max(800, clashEnergy));
    const impulseMag = baseImpulseMag * WEAPON_IMPACT_RESPONSE_SCALE;
    player.vx = -nx * (impulseMag / m1);
    player.vz = -nz * (impulseMag / m1);
    boss.vx = nx * (impulseMag / m2);
    boss.vz = nz * (impulseMag / m2);

    // Off-center rotational deflection with ANGULAR_IMPULSE_SCALE
    const tauPlayer = (r1x * (-nz * impulseMag) - r1z * (-nx * impulseMag)) * ANGULAR_IMPULSE_SCALE;
    const deltaOmegaPlayer = THREE.MathUtils.clamp(tauPlayer / I1, -34, 34);
    player.angularVelocityRad += deltaOmegaPlayer;

    const tauBoss = (r2x * (nz * impulseMag) - r2z * (nx * impulseMag)) * ANGULAR_IMPULSE_SCALE;
    const deltaOmegaBoss = THREE.MathUtils.clamp(tauBoss / I2, -34, 34);
    boss.angularVelocityRad += deltaOmegaBoss;

    const tBreak = 0.45;
    player.tractionBreakTimerSec = tBreak;
    boss.tractionBreakTimerSec = tBreak;
    player.skidVx = player.vx * 0.6;
    player.skidVz = player.vz * 0.6;
    boss.skidVx = boss.vx * 0.6;
    boss.skidVz = boss.vz * 0.6;

    sim.bossRepositionTimerSec = 1.0;
    sim.bossChargeActiveSec = 0;

    applyCombatDamage(sim, player, true, bossEnergy / 110, 'front', true);
    applyCombatDamage(sim, boss, false, playerEnergy / 110, 'front', true);

    player.weaponSpinPct = Math.max(8, player.weaponSpinPct * 0.22);
    boss.weaponSpinPct = Math.max(8, boss.weaponSpinPct * 0.22);

    createCombatImpactEvent(
      sim,
      [midX, midZ],
      [nx, nz],
      Math.hypot(player.vx - boss.vx, player.vz - boss.vz),
      impulseMag,
      'weapon',
      'player',
      'boss',
      clashEnergy,
      impulseMag / m2,
      Math.abs(deltaOmegaBoss),
      tBreak
    );

    addEvent(sim, 'WEAPONS CLASHED — HIGH-ENERGY DEFLECTION!', 'impact');
    sim.contactCooldownSec = 0.55;
    return;
  }

  // =========================================================================
  // CASE A: PLAYER PRESENTS ACTIVE FRONT WEAPON / WEDGE / LIFTER / GRABBER
  // =========================================================================
  if (playerPresentingFront && player.weaponHealthPct > 15 && (playerHit || weaponClash || !bossHit)) {
    // 1. SPINNER ENGAGEMENT
    if (wType === 'spinner-vert' || wType === 'spinner-horiz') {
      const vClose = (player.vx - boss.vx) * nx + (player.vz - boss.vz) * nz;
      const isGrinding = sim.sustainedWeaponContactSec > 0.15 && vClose < 0.75 && player.weaponSpinPct < 65;

      if (isGrinding) {
        sim.contactCooldownSec = 0.28;
        // Motor load / stall under continuous surface contact
        player.weaponSpinPct = Math.max(5, Math.min(20, player.weaponSpinPct - dt * 40));
        const grindDmg = 1.0;
        const hitDmgResult = applyCombatDamage(sim, boss, false, grindDmg, bossHitOnFront ? 'front' : 'side', false);

        // Small nudge to prevent glitchy interpenetration
        player.vx = -nx * 0.75;
        player.vz = -nz * 0.75;
        boss.vx = nx * 0.75;
        boss.vz = nz * 0.75;

        createCombatImpactEvent(
          sim,
          [midX, midZ],
          [nx, nz],
          Math.max(0.2, vClose),
          25,
          'weapon',
          'player',
          'boss',
          playerStats.weaponEnergyJ * Math.pow(player.weaponSpinPct / 100, 2),
          0.75,
          0,
          0.12,
          bossHitOnFront ? 'front' : 'side',
          grindDmg,
          hitDmgResult.effectiveMitigation,
          hitDmgResult.finalHullDmg,
          {
            damageSeverity: 'minimal',
            attackClassification: 'SUSTAINED_CONTACT',
            attackType: wType,
            weaponRpmBefore: player.weaponSpinPct,
            weaponEnergyBefore: playerStats.weaponEnergyJ * Math.pow(player.weaponSpinPct / 100, 2),
            weaponRpmAfter: player.weaponSpinPct,
            weaponEnergyAfter: playerStats.weaponEnergyJ * Math.pow(player.weaponSpinPct / 100, 2),
            armorAbsorbed: hitDmgResult.armorAbsorbed,
            componentDamage: hitDmgResult.componentDmg,
            targetHealthBefore: hitDmgResult.targetHealthBefore,
            targetHealthAfter: hitDmgResult.targetHealthAfter,
            attackerReactionImpulse: 25,
            attackerDeltaV: 0.75,
            attackerDeltaOmega: 0,
          }
        );
        return;
      }

      if (player.weaponSpinPct < 25) {
        sim.contactCooldownSec = 0.40;
        const scrapeRelSpeed = Math.hypot(player.vx - boss.vx, player.vz - boss.vz);
        if (scrapeRelSpeed > 0.8) {
          createCombatImpactEvent(sim, [midX, midZ], [nx, nz], scrapeRelSpeed, 25, 'chassis', 'player', 'boss', 0);
        }
        return;
      }

      // Genuine NEW_STRIKE!
      // Apply instant geometric separation buffer
      const sep = SEPARATION_BUFFER_METERS;
      player.x -= nx * sep * w1;
      player.z -= nz * sep * w1;
      boss.x += nx * sep * w2;
      boss.z += nz * sep * w2;

      const rpmBefore = player.weaponSpinPct;
      const spinFraction = Math.pow(player.weaponSpinPct / 100, 2);
      const rawKineticEnergyJ = playerStats.weaponEnergyJ * spinFraction;
      const energyBefore = rawKineticEnergyJ;
      sim.impactsDelivered++;

      // Bull local lateral contact coordinate to detect corner hits
      const rBx = Math.cos(boss.headingRad);
      const rBz = -Math.sin(boss.headingRad);
      const bossLatOffset = r2x * rBx + r2z * rBz;
      const isCornerHit = bossHitOnFront && Math.abs(bossLatOffset) > 0.32;
      const sector: 'front' | 'corner' | 'side' | 'rear' =
        isCornerHit ? 'corner' : bossHitOnFront ? 'front' : bossHitOnSide ? 'side' : 'rear';
      const recoilRatio = playerStats.weaponRecoilScore / 100;

      // Charge interruption on solid kinetic strike
      if (rawKineticEnergyJ > 800) {
        sim.bossChargeActiveSec = 0;
        sim.bossStunTimerSec = 0.65;
        boss.tractionBreakTimerSec = 0.45;
      }

      let knockbackSpeed: number;
      let deliveredEnergyJ: number;
      let hitDmgResult: {
        finalHullDmg: number;
        finalArmorDmg: number;
        effectiveMitigation: number;
        armorAbsorbed: number;
        componentDmg: number;
        damageSeverity: DamageSeverity;
        targetHealthBefore: number;
        targetHealthAfter: number;
      };

      if (bossHitOnFront) {
        // Front plow or corner hit: progressive armor wear and momentum transfer
        const isCorner = sector === 'corner';
        const deflectionFactor = isCorner ? 0.80 : (bossStats.frontArmorScore >= 100 ? 0.65 : 0.85);
        deliveredEnergyJ = rawKineticEnergyJ * deflectionFactor;
        const compressedE = compressKineticDamageEnergy(deliveredEnergyJ);
        const rawDmg = compressedE / 90;
        hitDmgResult = applyCombatDamage(sim, boss, false, rawDmg, sector, true);

        // Scaled physical knockback on Bull (~2 to 4 robot lengths)
        knockbackSpeed = THREE.MathUtils.clamp(
          (3.2 + (deliveredEnergyJ / 750) * 2.2) * WEAPON_IMPACT_RESPONSE_SCALE * (24 / m2),
          2.5,
          14.0
        );
        boss.vx = nx * knockbackSpeed;
        boss.vz = nz * knockbackSpeed;
        sim.bossStunTimerSec = Math.max(sim.bossStunTimerSec, isCorner ? 0.75 : 0.50);

        if (isCorner) {
          addEvent(sim, `CLIPPED ${sim.bossDossier.name.toUpperCase()} WEDGE CORNER — DEFLECTION YAW!`, 'impact');
        } else {
          addEvent(sim, `HIGH-ENERGY CLASH WITH ${sim.bossDossier.name.toUpperCase()} FRONT PLOW!`, 'warning');
        }
      } else {
        // Flank or Rear strike: catastrophic kinetic breach
        deliveredEnergyJ = rawKineticEnergyJ;
        const compressedE = compressKineticDamageEnergy(deliveredEnergyJ);
        const rawDmg = compressedE / 85;
        hitDmgResult = applyCombatDamage(sim, boss, false, rawDmg, sector, true);

        // Huge knockback on struck flank/rear (~3 to 5+ robot lengths)
        knockbackSpeed = THREE.MathUtils.clamp(
          (3.8 + (deliveredEnergyJ / 600) * 2.6) * WEAPON_IMPACT_RESPONSE_SCALE * (24 / m2),
          3.5,
          16.0
        );
        boss.vx = nx * knockbackSpeed;
        boss.vz = nz * knockbackSpeed;
        sim.bossStunTimerSec = 0.85;

        addEvent(sim, 'KINETIC BREACH — SIDE FLANK!', 'impact');
      }

      // Symmetrical attacker recoil impulse (J_attacker = -J_target)
      const targetImpulseMag = m2 * knockbackSpeed;
      const reactionFactor = wType === 'spinner-horiz' ? 0.90 : 0.78;
      const attackerReactionImpulse = targetImpulseMag * reactionFactor * (recoilRatio * 0.45 + 0.55);
      const playerRecoilSpeed = THREE.MathUtils.clamp(attackerReactionImpulse / m1, 1.8, 14.0);
      player.vx = -nx * playerRecoilSpeed;
      player.vz = -nz * playerRecoilSpeed;

      // Weapon RPM drain after hit
      const deliveredFraction = Math.min(0.92, deliveredEnergyJ / Math.max(1, rawKineticEnergyJ));
      const rpmRetainedFrac = Math.sqrt(Math.max(0.04, 1.0 - deliveredFraction * 0.90));
      player.weaponSpinPct = Math.max(5, Math.min(12, rpmBefore * rpmRetainedFrac));
      const rpmAfter = player.weaponSpinPct;
      const energyAfter = playerStats.weaponEnergyJ * Math.pow(player.weaponSpinPct / 100, 2);

      // Angular yaw torque on BOTH bots from off-center weapon contact
      const cornerTorqueMult = sector === 'corner' ? 1.6 : 1.0;
      const tauBoss = (r2x * (nz * targetImpulseMag) - r2z * (nx * targetImpulseMag)) * ANGULAR_IMPULSE_SCALE * cornerTorqueMult;
      const deltaOmegaBoss = THREE.MathUtils.clamp(tauBoss / I2, -36, 36);
      boss.angularVelocityRad += deltaOmegaBoss;

      const tauPlayer = (r1x * (-nz * attackerReactionImpulse) - r1z * (-nx * attackerReactionImpulse)) * ANGULAR_IMPULSE_SCALE;
      const deltaOmegaPlayer = THREE.MathUtils.clamp(tauPlayer / I1, -36, 36);
      player.angularVelocityRad += deltaOmegaPlayer;

      // Post-impact traction-break state: allows collision momentum to persist
      const tBreakBoss = Math.min(0.60, 0.25 + (rawKineticEnergyJ / 2600) * 0.35);
      boss.tractionBreakTimerSec = tBreakBoss;
      boss.skidVx = nx * knockbackSpeed * 0.65;
      boss.skidVz = nz * knockbackSpeed * 0.65;

      const tBreakPlayer = Math.min(0.55, 0.24 + (rawKineticEnergyJ / 3000) * 0.26);
      player.tractionBreakTimerSec = tBreakPlayer;
      player.skidVx = -nx * playerRecoilSpeed * 0.65;
      player.skidVz = -nz * playerRecoilSpeed * 0.65;

      // Vertical reaction (wheel lift, pitch kick, roll tilt)
      if (wType === 'spinner-vert') {
        boss.pitchRad = -0.65; // Uplifting vertical kick
        player.pitchRad = 0.35;
      } else {
        const rollSign = Math.sign(r2x * nz - r2z * nx || 1);
        boss.rollRad = rollSign * Math.min(0.65, 0.28 + (rawKineticEnergyJ / 2400) * 0.35);
        player.rollRad = -rollSign * 0.26;
      }

      // Bull AI rhythmic disengage/reposition after taking a hit
      sim.bossRepositionTimerSec = 1.0 + Math.random() * 0.4;
      sim.bossChargeActiveSec = 0;

      createCombatImpactEvent(
        sim,
        [midX, midZ],
        [nx, nz],
        knockbackSpeed + playerRecoilSpeed,
        targetImpulseMag,
        'weapon',
        'player',
        'boss',
        rawKineticEnergyJ,
        knockbackSpeed,
        Math.abs(deltaOmegaBoss),
        tBreakBoss,
        sector,
        deliveredEnergyJ / 85,
        hitDmgResult.effectiveMitigation,
        hitDmgResult.finalHullDmg,
        {
          damageSeverity: hitDmgResult.damageSeverity,
          attackClassification: 'NEW_STRIKE',
          attackType: wType,
          weaponRpmBefore: rpmBefore,
          weaponEnergyBefore: energyBefore,
          weaponRpmAfter: rpmAfter,
          weaponEnergyAfter: energyAfter,
          armorAbsorbed: hitDmgResult.armorAbsorbed,
          componentDamage: hitDmgResult.componentDmg,
          targetHealthBefore: hitDmgResult.targetHealthBefore,
          targetHealthAfter: hitDmgResult.targetHealthAfter,
          attackerReactionImpulse,
          attackerDeltaV: playerRecoilSpeed,
          attackerDeltaOmega: Math.abs(deltaOmegaPlayer),
        }
      );

      // Vertical spinner overturn check
      if (wType === 'spinner-vert' && (rawKineticEnergyJ >= 1400 || boss.frontArmorPct < 65)) {
        boss.isFlipped = true;
        sim.flipsInflicted++;
        addEvent(sim, `ROBOT FLIPPED — ${sim.bossDossier.name} INVERTED!`, 'impact');
      }

      sim.weaponAtSpeedAnnounced = false;
      sim.contactCooldownSec = 0.72;
      return;
    }

    // 2. HAMMER ENGAGEMENT (Overhead pneumatic spike bypasses frontal plow)
    if (wType === 'hammer') {
      sim.impactsDelivered++;
      const sep = SEPARATION_BUFFER_METERS * 0.8;
      player.x -= nx * sep * w1;
      player.z -= nz * sep * w1;
      boss.x += nx * sep * w2;
      boss.z += nz * sep * w2;

      // Overhead strike directly penetrates top armor / deck
      const rawHammerDmg = 14 + (playerStats.weaponEnergyJ / 260);
      const hitDmgResult = applyCombatDamage(sim, boss, false, rawHammerDmg, 'rear', true);

      // Disrupt Bull charge & stun
      sim.bossChargeActiveSec = 0;
      sim.bossStunTimerSec = 0.75;
      boss.tractionBreakTimerSec = 0.40;
      boss.pitchRad = 0.45; // Overhead blow drives Bull's front into the floor
      sim.bossRepositionTimerSec = 1.1;

      const shoveVel = 2.8 * WEAPON_IMPACT_RESPONSE_SCALE * 0.6;
      boss.vx = nx * shoveVel;
      boss.vz = nz * shoveVel;

      createCombatImpactEvent(
        sim,
        [midX, midZ],
        [nx, nz],
        shoveVel,
        140,
        'weapon',
        'player',
        'boss',
        playerStats.weaponEnergyJ,
        shoveVel,
        0,
        0.40,
        'rear',
        rawHammerDmg,
        hitDmgResult.effectiveMitigation,
        hitDmgResult.finalHullDmg,
        {
          damageSeverity: hitDmgResult.damageSeverity,
          attackClassification: 'NEW_STRIKE',
          attackType: 'hammer',
          armorAbsorbed: hitDmgResult.armorAbsorbed,
          componentDamage: hitDmgResult.componentDmg,
          targetHealthBefore: hitDmgResult.targetHealthBefore,
          targetHealthAfter: hitDmgResult.targetHealthAfter,
          attackerReactionImpulse: 95,
          attackerDeltaV: 1.2,
          attackerDeltaOmega: 0,
        }
      );

      addEvent(sim, `HAMMER CRUSHED ${sim.bossDossier.name.toUpperCase()} TOP DECK!`, 'impact');
      sim.contactCooldownSec = 0.68;
      return;
    }

    // 3. LIFTER ENGAGEMENT
    if (wType === 'lifter') {
      sim.impactsDelivered++;
      const sep = SEPARATION_BUFFER_METERS;
      player.x -= nx * sep * w1;
      player.z -= nz * sep * w1;
      boss.x += nx * sep * w2;
      boss.z += nz * sep * w2;

      const getsUnderneath =
        !bossHitOnFront ||
        playerStats.groundClearanceInches <= bossStats.groundClearanceInches + 0.05 ||
        strategy === 'control';

      if (getsUnderneath) {
        boss.pitchRad = -0.65;
        const shoveVel = 3.6 * WEAPON_IMPACT_RESPONSE_SCALE * 0.6;
        boss.vx = nx * shoveVel;
        boss.vz = nz * shoveVel;
        boss.tractionBreakTimerSec = 0.35;
        sim.bossStunTimerSec = 0.85;
        sim.bossRepositionTimerSec = 1.0;
        const hitDmgResult = applyCombatDamage(sim, boss, false, 8.5, bossHitOnFront ? 'front' : 'side', false);

        createCombatImpactEvent(
          sim,
          [midX, midZ],
          [nx, nz],
          shoveVel,
          115,
          'weapon',
          'player',
          'boss',
          0,
          shoveVel,
          0,
          0.35,
          bossHitOnFront ? 'front' : 'side',
          8.5,
          hitDmgResult.effectiveMitigation,
          hitDmgResult.finalHullDmg,
          {
            damageSeverity: hitDmgResult.damageSeverity,
            attackClassification: 'NEW_STRIKE',
            attackType: 'lifter',
            armorAbsorbed: hitDmgResult.armorAbsorbed,
            componentDamage: hitDmgResult.componentDmg,
            targetHealthBefore: hitDmgResult.targetHealthBefore,
            targetHealthAfter: hitDmgResult.targetHealthAfter,
          }
        );

        if (!bossHitOnFront || sim.impactsDelivered >= 2 || playerStats.pushingForceN >= 135) {
          boss.isFlipped = true;
          sim.flipsInflicted++;
          addEvent(sim, `ROBOT FLIPPED — LIFTER OVERTURNED ${sim.bossDossier.name}!`, 'impact');
        } else {
          addEvent(sim, 'LIFTER SCOOPED UNDER CHASSIS', 'impact');
        }
      } else {
        player.vx = -nx * 2.8;
        player.vz = -nz * 2.8;
        player.tractionBreakTimerSec = 0.25;
        createCombatImpactEvent(sim, [midX, midZ], [-nx, -nz], 2.8, 95, 'chassis', 'boss', 'player', 0);
        addEvent(sim, 'IMPACT — FRONT', 'warning');
      }
      sim.contactCooldownSec = 0.62;
      return;
    }

    // 4. WEDGE / PUSHER ENGAGEMENT
    if (wType === 'wedge') {
      const sep = SEPARATION_BUFFER_METERS;
      player.x -= nx * sep * w1;
      player.z -= nz * sep * w1;
      boss.x += nx * sep * w2;
      boss.z += nz * sep * w2;

      const playerEffectivePush = playerStats.pushingForceN + (!bossHitOnFront ? 35 : 10);
      const bossEffectivePush = bossStats.pushingForceN;

      if (playerEffectivePush >= bossEffectivePush - 5) {
        sim.impactsDelivered++;
        sim.playerPushTimeSec += 0.5;
        const shoveVel = (2.4 + (playerEffectivePush - bossEffectivePush) * 0.02) * WEAPON_IMPACT_RESPONSE_SCALE * 0.6;
        boss.vx = nx * shoveVel;
        boss.vz = nz * shoveVel;
        boss.pitchRad = -0.45;
        boss.tractionBreakTimerSec = 0.32;
        sim.bossRepositionTimerSec = 0.9;
        const hitDmgResult = applyCombatDamage(sim, boss, false, 6.0, bossHitOnFront ? 'front' : 'side', false);
        sim.bossStunTimerSec = 0.35;
        createCombatImpactEvent(
          sim,
          [midX, midZ],
          [nx, nz],
          shoveVel,
          95,
          'weapon',
          'player',
          'boss',
          0,
          shoveVel,
          0,
          0.32,
          bossHitOnFront ? 'front' : 'side',
          6.0,
          hitDmgResult.effectiveMitigation,
          hitDmgResult.finalHullDmg,
          {
            damageSeverity: hitDmgResult.damageSeverity,
            attackClassification: 'NEW_STRIKE',
            attackType: 'wedge',
            armorAbsorbed: hitDmgResult.armorAbsorbed,
            componentDamage: hitDmgResult.componentDmg,
            targetHealthBefore: hitDmgResult.targetHealthBefore,
            targetHealthAfter: hitDmgResult.targetHealthAfter,
          }
        );
        addEvent(sim, `WEDGE SHOVED ${sim.bossDossier.name.toUpperCase()} BACKWARD`, 'impact');
      } else {
        sim.bossPushTimeSec += 0.5;
        sim.bullPushTimeSec += 0.5;
        const shoveVel = 1.7;
        player.vx = -nx * shoveVel;
        player.vz = -nz * shoveVel;
        player.tractionBreakTimerSec = 0.20;
        applyCombatDamage(sim, player, true, 5.0, 'front', false);
        createCombatImpactEvent(sim, [midX, midZ], [-nx, -nz], shoveVel, 90, 'chassis', 'boss', 'player', 0);
        addEvent(sim, `OUT-PUSHED BY ${sim.bossDossier.name}`, 'warning');
      }
      sim.contactCooldownSec = 0.45;
      return;
    }

    // 5. GRABBER / CLAMP ENGAGEMENT
    if (wType === 'grabber') {
      sim.impactsDelivered++;
      player.isGrabbing = true;
      sim.grabTimerSec = 1.6;
      sim.bossStunTimerSec = 1.6;

      const playerEffectivePush = playerStats.pushingForceN + 35;
      const bossEffectivePush = bossStats.pushingForceN;

      if (playerEffectivePush >= bossEffectivePush - 20) {
        sim.playerPushTimeSec += 0.8;
        const shoveVel = 2.4 + (playerEffectivePush - bossEffectivePush) * 0.02;
        boss.vx = nx * shoveVel;
        boss.vz = nz * shoveVel;
        const clampDamage = bossHitOnFront ? 9 : 14;
        const hitDmgResult = applyCombatDamage(sim, boss, false, clampDamage, bossHitOnFront ? 'front' : 'side', false);
        createCombatImpactEvent(
          sim,
          [midX, midZ],
          [nx, nz],
          shoveVel,
          130,
          'weapon',
          'player',
          'boss',
          0,
          shoveVel,
          0,
          0.30,
          bossHitOnFront ? 'front' : 'side',
          clampDamage,
          hitDmgResult.effectiveMitigation,
          hitDmgResult.finalHullDmg,
          {
            damageSeverity: hitDmgResult.damageSeverity,
            attackClassification: 'NEW_STRIKE',
            attackType: 'grabber',
            armorAbsorbed: hitDmgResult.armorAbsorbed,
            componentDamage: hitDmgResult.componentDmg,
            targetHealthBefore: hitDmgResult.targetHealthBefore,
            targetHealthAfter: hitDmgResult.targetHealthAfter,
          }
        );
        addEvent(sim, `PINNED & CRUSHED ${sim.bossDossier.name}!`, 'impact');
      } else {
        sim.bossPushTimeSec += 0.4;
        player.vx = -nx * 1.8;
        player.vz = -nz * 1.8;
        applyCombatDamage(sim, boss, false, 5, 'front', false);
        createCombatImpactEvent(sim, [midX, midZ], [-nx, -nz], 1.8, 85, 'chassis', 'boss', 'player', 0);
        addEvent(sim, `CLAMP PIN BROKEN BY ${sim.bossDossier.name}`, 'warning');
      }
      sim.contactCooldownSec = 0.55;
      return;
    }
  }

  // =========================================================================
  // CASE B: BOSS DELIVERS STRIKE (OR PLAYER HIT ON SIDE/REAR)
  // =========================================================================
  sim.bossPushTimeSec += 0.45;
  sim.bullPushTimeSec += 0.45;

  // Separation buffer
  const sep = SEPARATION_BUFFER_METERS;
  player.x -= nx * sep * w1;
  player.z -= nz * sep * w1;
  boss.x += nx * sep * w2;
  boss.z += nz * sep * w2;

  const playerHitSector = playerHitOnSide ? 'side' : playerAttackAngle > 2.35 ? 'rear' : 'front';
  if (playerHitOnSide) {
    sim.lateralImpactsTaken++;
    addEvent(sim, 'IMPACT — SIDE', 'warning');
  } else {
    addEvent(sim, 'IMPACT — FRONT', 'warning');
  }

  // Nonlinear damage compression for boss attack
  const compressedBossEnergy = compressKineticDamageEnergy(bossStats.weaponEnergyJ);
  const rawBossDmg = compressedBossEnergy / 115 + (bossId === 'bull' ? 4.0 : 6.0);
  const hitDmgResult = applyCombatDamage(sim, player, true, rawBossDmg, playerHitSector, isKineticB);

  // Scaled Knockback on player & off-center torque
  const bossKnockback = THREE.MathUtils.clamp(
    (3.0 + (bossStats.weaponEnergyJ / 1600) * 2.0) * WEAPON_IMPACT_RESPONSE_SCALE * (24 / m1),
    2.5,
    13.0
  );
  player.vx = -nx * bossKnockback;
  player.vz = -nz * bossKnockback;
  sim.playerStunTimerSec = 0.45;

  const impulseMag = m1 * bossKnockback;

  // Bull reaction recoil (symmetrical reaction impulse J_attacker = -J_target * 0.42)
  const bossRecoilSpeed = (impulseMag * 0.42) / m2;
  boss.vx += nx * bossRecoilSpeed;
  boss.vz += nz * bossRecoilSpeed;
  boss.tractionBreakTimerSec = Math.max(boss.tractionBreakTimerSec, 0.35);

  const tauPlayer = (r1x * (-nz * impulseMag) - r1z * (-nx * impulseMag)) * ANGULAR_IMPULSE_SCALE;
  const deltaOmegaPlayer = THREE.MathUtils.clamp(tauPlayer / I1, -32, 32);
  player.angularVelocityRad += deltaOmegaPlayer;

  const tauBoss = (r2x * (nz * impulseMag * 0.4) - r2z * (nx * impulseMag * 0.4)) * ANGULAR_IMPULSE_SCALE;
  const deltaOmegaBoss = THREE.MathUtils.clamp(tauBoss / I2, -24, 24);
  boss.angularVelocityRad += deltaOmegaBoss;

  const tBreakPlayer = Math.min(0.55, 0.22 + (bossStats.weaponEnergyJ / 2600) * 0.28);
  player.tractionBreakTimerSec = tBreakPlayer;
  player.skidVx = -nx * bossKnockback * 0.6;
  player.skidVz = -nz * bossKnockback * 0.6;

  // Vertical reaction on player
  player.pitchRad = 0.45;
  if (playerHitOnSide) {
    player.rollRad = Math.sign(r1x * nz - r1z * nx || 1) * 0.42;
  }

  // Bull disengages/repositions after landing a strike
  sim.bossRepositionTimerSec = 1.0 + Math.random() * 0.4;
  sim.bossChargeActiveSec = 0;

  createCombatImpactEvent(
    sim,
    [midX, midZ],
    [-nx, -nz],
    bossKnockback + bossRecoilSpeed,
    impulseMag,
    'weapon',
    'boss',
    'player',
    bossStats.weaponEnergyJ,
    bossKnockback,
    Math.abs(deltaOmegaPlayer),
    tBreakPlayer,
    playerHitSector,
    rawBossDmg,
    hitDmgResult.effectiveMitigation,
    hitDmgResult.finalHullDmg,
    {
      damageSeverity: hitDmgResult.damageSeverity,
      attackClassification: 'NEW_STRIKE',
      attackType: bossStats.weaponTypeCategory,
      armorAbsorbed: hitDmgResult.armorAbsorbed,
      componentDamage: hitDmgResult.componentDmg,
      targetHealthBefore: hitDmgResult.targetHealthBefore,
      targetHealthAfter: hitDmgResult.targetHealthAfter,
      attackerReactionImpulse: impulseMag * 0.42,
      attackerDeltaV: bossRecoilSpeed,
      attackerDeltaOmega: Math.abs(deltaOmegaBoss),
    }
  );

  if ((playerStats.centerOfMassLabel === 'HIGH' || playerStats.stabilityScore < 40) && bossStats.weaponEnergyJ >= 1800 && sim.lateralImpactsTaken >= 2) {
    player.isFlipped = true;
    addEvent(sim, 'ROBOT FLIPPED', 'critical');
  }

  sim.contactCooldownSec = 0.52;
  void dt;
}

function finishBattle(
  sim: LiveBattleSimulation,
  winner: 'player' | 'boss',
  reason: string
): void {
  sim.isFinished = true;
  sim.winner = winner;
  sim.winReason = reason;
  addEvent(
    sim,
    winner === 'player' ? `${sim.bossDossier.name} DEFEATED!` : `${sim.bossDossier.name} WINS — MATCH TERMINATED`,
    winner === 'player' ? 'info' : 'critical'
  );
}

export function generateBattleAnalysisReport(sim: LiveBattleSimulation): BattleAnalysisReport {
  const { player, boss, playerStats, strategy, bossDossier } = sim;
  const winner = sim.winner ?? 'boss';

  const evidence: string[] = [];

  if (winner === 'player') {
    if (sim.flipsInflicted > 0) {
      evidence.push(
        `Your robot got underneath ${bossDossier.name} and overturned it (${sim.flipsInflicted} flip${sim.flipsInflicted > 1 ? 's' : ''}), exploiting its stability threshold.`
      );
    }
    if (playerStats.weaponEnergyJ >= 1500 && sim.impactsDelivered > 0) {
      evidence.push(
        `Delivered ${sim.impactsDelivered} high-energy weapon impacts (${playerStats.weaponEnergyJ.toLocaleString()} J peak rating), rupturing ${bossDossier.name}'s armor and drive pods.`
      );
    }
    if (sim.playerPushTimeSec > 1.2) {
      evidence.push(
        `Your drivetrain (${playerStats.pushingForceN} N pushing force, ${playerStats.tractionLabel} traction) controlled arena positioning and drove ${bossDossier.name} into the hazard walls.`
      );
    }
    if (evidence.length === 0) {
      evidence.push(
        `Your ${strategy.toUpperCase()} autonomous strategy and balanced subsystem durability outlasted ${bossDossier.name}'s attacks.`
      );
    }
  } else {
    if (sim.impactsDelivered > 0 && playerStats.weaponEnergyJ >= 1200) {
      evidence.push(
        `Your robot delivered ${sim.impactsDelivered} high-energy weapon impacts, showing strong offensive potential before defeat.`
      );
    }
    if (player.isFlipped) {
      evidence.push(
        `Chassis stability (${playerStats.stabilityLabel}, CoM ${playerStats.centerOfMassLabel}) was exceeded during impact, leaving your robot inverted without active self-righting recovery.`
      );
    }
    if (sim.lateralImpactsTaken >= 2 || player.sideArmorPct < 45) {
      evidence.push(
        `Repeated lateral impacts (${sim.lateralImpactsTaken} side strikes) overwhelmed side protection (${Math.round(player.sideArmorPct)}% remaining).`
      );
    }
    if (player.leftDriveHealthPct < 55 && !playerStats.wheelsProtected) {
      evidence.push(
        `Exposed drive wheels sustained direct collision damage (Left drive at ${Math.round(player.leftDriveHealthPct)}%), reducing mobility.`
      );
    }
    if (playerStats.wheelSlipLikely || playerStats.tractionLabel === 'LOW') {
      evidence.push(
        `Traction (${playerStats.tractionCoeff} μ) was insufficient to resist ${bossDossier.name}'s pushing force, causing wheel slip during shoving engagements.`
      );
    }
    if (evidence.length === 0) {
      evidence.push(
        `${bossDossier.name}'s superior subsystem match-up controlled the arena and exploited weaknesses in your robot configuration.`
      );
    }
  }

  return {
    winner,
    winReason: sim.winReason,
    durationSec: Number(sim.timeSec.toFixed(1)),
    strategyUsed: strategy,
    playerFinal: { ...player },
    bullFinal: { ...boss },
    bossDossier,
    playerStats,
    headlineSummary: sim.winReason,
    engineeringEvidence: evidence,
    majorEvents: sim.events.slice(0, 6).map((e) => `${e.timeSec.toFixed(1)}s — ${e.text}`),
    peakMotorTempC: sim.peakMotorTempC,
    impactsDelivered: sim.impactsDelivered,
    lateralImpactsTaken: sim.lateralImpactsTaken,
    flipsInflicted: sim.flipsInflicted,
    pushDominanceRatio:
      sim.playerPushTimeSec + sim.bossPushTimeSec > 0
        ? sim.playerPushTimeSec / (sim.playerPushTimeSec + sim.bossPushTimeSec)
        : 0.5,
  };
}

export function runFullBattleHeadless(
  config: RobotConfiguration,
  strategy: AutonomousStrategy,
  bossId: BossId = 'bull'
): BattleAnalysisReport {
  const sim = createBattleSimulation(config, strategy, bossId);
  const dt = 1 / 60;
  let steps = 0;
  while (!sim.isFinished && steps < 60 * sim.maxDurationSec) {
    stepBattleSimulation(sim, dt);
    steps++;
  }
  return generateBattleAnalysisReport(sim);
}
