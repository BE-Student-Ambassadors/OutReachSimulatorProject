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
} from '../types/robot';

import {
  type BoxCollider2D,
  type WeaponContactZone,
  getRobotCollisionModel,
  testOBBOBB,
  testWeaponChassisContact,
} from './collisionGeometry';

export const ARENA_HALF_SIZE = 5.6; // 11.2m x 11.2m enclosed combat arena

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

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
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

  player.pitchRad *= Math.pow(0.04, dt);
  player.rollRad *= Math.pow(0.04, dt);
  boss.pitchRad *= Math.pow(0.04, dt);
  boss.rollRad *= Math.pow(0.04, dt);

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
        // A. Differential Steering: Turn left (negative) or right (positive)
        // Turning right increases headingRad (clockwise), turning left decreases it
        const steerDir = input.throttle < 0 ? 1 : -1;
        const turnDelta = input.steering * steerDir * playerTurnRate * dt;

        // Motor damage asymmetry pulls robot toward the damaged side when driving
        const drivePull = (rightHealth - leftHealth) * 0.55 * playerTurnRate * dt * Math.sign(input.throttle || 0);

        player.headingRad = normalizeAngle(player.headingRad + turnDelta + drivePull);

        // B. Forward / Reverse Linear Speed
        const desiredPlayerSpeed = input.throttle * playerMaxSpeed;
        const targetVx = Math.sin(player.headingRad) * desiredPlayerSpeed;
        const targetVz = Math.cos(player.headingRad) * desiredPlayerSpeed;

        const accelRate = 7.5 * Math.max(0.4, playerStats.accelerationMphPerSec / 8.5);

        if (input.throttle !== 0) {
          player.vx += (targetVx - player.vx) * Math.min(1, accelRate * dt);
          player.vz += (targetVz - player.vz) * Math.min(1, accelRate * dt);
          player.aiStateLabel = input.throttle > 0 ? 'ENGAGE' : 'EVADE';
        } else if (input.steering !== 0) {
          const pointTurnBrake = 12.0 * dt;
          player.vx += (0 - player.vx) * Math.min(1, pointTurnBrake);
          player.vz += (0 - player.vz) * Math.min(1, pointTurnBrake);
          player.aiStateLabel = 'FLANK';
        } else {
          const decelRate = 9.0 * Math.max(0.45, playerStats.tractionCoeff);
          player.vx += (0 - player.vx) * Math.min(1, decelRate * dt);
          player.vz += (0 - player.vz) * Math.min(1, decelRate * dt);
          player.aiStateLabel = 'SENSE';
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

      const headingDiff = normalizeAngle(desiredPlayerHeading - player.headingRad);
      const maxTurn = playerTurnRate * dt;
      player.headingRad = normalizeAngle(player.headingRad + Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), maxTurn));

      const alignFactor = Math.max(0, Math.cos(headingDiff));
      const targetVx = Math.sin(player.headingRad) * desiredPlayerSpeed * alignFactor;
      const targetVz = Math.cos(player.headingRad) * desiredPlayerSpeed * alignFactor;

      player.vx += (targetVx - player.vx) * Math.min(1, 7.5 * dt);
      player.vz += (targetVz - player.vz) * Math.min(1, 7.5 * dt);
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
        const playerNearWall = Math.abs(player.x) > ARENA_HALF_SIZE - 0.95 || Math.abs(player.z) > ARENA_HALF_SIZE - 0.95;

        // Wedge Orientation Lock: Rotate aggressively to present bronze plow directly (within +-0.25 rad)
        desiredBossHeading = angleBossToPlayer;

        // Charge trigger: initiate charge when aligned within 0.28 rad or when pinning player near perimeter wall
        if ((Math.abs(headingDiff) < 0.28 || playerNearWall) && dist < 5.0 && sim.bossChargeCooldownSec <= 0 && sim.bossChargeActiveSec <= 0) {
          sim.bossChargeActiveSec = 1.6;
          sim.bossChargeCooldownSec = 3.6;
          boss.aiStateLabel = playerNearWall ? 'PUSH' : 'ENGAGE';
        }

        // Charge Abort / Braking Recovery: If player evades and angle exceeds 0.45 rad, abort charge to avoid overshooting wall
        if (sim.bossChargeActiveSec > 0 && Math.abs(headingDiff) > 0.45 && dist > 1.6) {
          sim.bossChargeActiveSec = 0; // Abort charge and pivot back toward opponent
          desiredBossSpeed = bossMaxSpeed * 0.55;
          boss.aiStateLabel = 'APPROACH';
        } else {
          const chargeBoost = sim.bossChargeActiveSec > 0 ? (playerNearWall ? 1.25 : 1.18) : 0.92;
          desiredBossSpeed = bossMaxSpeed * chargeBoost;
          if (sim.bossChargeActiveSec <= 0) {
            boss.aiStateLabel = dist < 1.4 ? 'PUSH' : 'APPROACH';
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

    const bossHeadingDiff = normalizeAngle(desiredBossHeading - boss.headingRad);
    const maxBossTurn = bossTurnRate * dt * (sim.bossChargeActiveSec > 0 ? 0.45 : 1.0);
    boss.headingRad = normalizeAngle(boss.headingRad + Math.sign(bossHeadingDiff) * Math.min(Math.abs(bossHeadingDiff), maxBossTurn));

    const alignFactor = Math.max(0, Math.cos(bossHeadingDiff));
    const bTargetVx = Math.sin(boss.headingRad) * desiredBossSpeed * alignFactor;
    const bTargetVz = Math.cos(boss.headingRad) * desiredBossSpeed * alignFactor;

    boss.vx += (bTargetVx - boss.vx) * Math.min(1, 6.8 * dt);
    boss.vz += (bTargetVz - boss.vz) * Math.min(1, 6.8 * dt);
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

      if (bot.x > boundLimitX) {
        bot.x = boundLimitX;
        bot.vx = -Math.abs(bot.vx) * 0.35;
        collided = true;
        wallNx = -1;
      } else if (bot.x < -boundLimitX) {
        bot.x = -boundLimitX;
        bot.vx = Math.abs(bot.vx) * 0.35;
        collided = true;
        wallNx = 1;
      }

      if (bot.z > boundLimitZ) {
        bot.z = boundLimitZ;
        bot.vz = -Math.abs(bot.vz) * 0.35;
        collided = true;
        wallNz = -1;
      } else if (bot.z < -boundLimitZ) {
        bot.z = -boundLimitZ;
        bot.vz = Math.abs(bot.vz) * 0.35;
        collided = true;
        wallNz = 1;
      }

      if (collided) {
        const impactSpeed = Math.hypot(bot.vx, bot.vz);
        if (impactSpeed > 1.2 && Math.random() < 0.25) {
          sim.sparks.push({
            id: sim.nextSparkId++,
            x: bot.x + wallNx * 0.2,
            y: 0.3,
            z: bot.z + wallNz * 0.2,
            color: '#38bdf8',
            intensity: 1.5,
            age: 0,
          });
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

    // 1. High-Level Combat Weapon Engagement (Evaluated on weapon contact before recoil deflection)
    if (sim.contactCooldownSec <= 0 && (playerWeaponHit.hit || bossWeaponHit.hit || weaponClash.overlap)) {
      const impactNx = chassisTest.overlap
        ? chassisTest.normal[0]
        : (boss.x - player.x) / Math.max(0.001, Math.hypot(boss.x - player.x, boss.z - player.z));
      const impactNz = chassisTest.overlap
        ? chassisTest.normal[1]
        : (boss.z - player.z) / Math.max(0.001, Math.hypot(boss.x - player.x, boss.z - player.z));
      resolveEngagementImpact(sim, impactNx, impactNz, playerWeaponHit.hit, bossWeaponHit.hit, weaponClash.overlap, dt);
    }

    // 2. Chassis Contact & Sustained Pushing Physics
    if (chassisTest.overlap) {
      const nx = chassisTest.normal[0];
      const nz = chassisTest.normal[1];
      const penetration = chassisTest.penetration;

      // Position Projection (Strict Non-Penetration Constraint)
      player.x -= nx * penetration * w1;
      player.z -= nz * penetration * w1;
      boss.x += nx * penetration * w2;
      boss.z += nz * penetration * w2;

      // Relative velocity along collision normal (pointing from Player to Boss)
      const vRel = (player.vx - boss.vx) * nx + (player.vz - boss.vz) * nz;

      if (vRel > 0.8) {
        // High-speed collision: Semi-elastic impulse deflection
        const restitution = 0.20;
        const impulse = ((1 + restitution) * vRel) / (1 / m1 + 1 / m2);

        player.vx -= (nx * impulse) / m1;
        player.vz -= (nz * impulse) / m1;
        boss.vx += (nx * impulse) / m2;
        boss.vz += (nz * impulse) / m2;

        // Angular Torque Response on Off-Center Strikes
        const playerForwardX = Math.sin(player.headingRad);
        const playerForwardZ = Math.cos(player.headingRad);
        const cross1 = playerForwardX * nz - playerForwardZ * nx;
        player.headingRad = normalizeAngle(player.headingRad - cross1 * (impulse / m1) * 0.08);

        const bossForwardX = Math.sin(boss.headingRad);
        const bossForwardZ = Math.cos(boss.headingRad);
        const cross2 = bossForwardX * nz - bossForwardZ * nx;
        boss.headingRad = normalizeAngle(boss.headingRad + cross2 * (impulse / m2) * 0.08);
      } else {
        // Sustained pushing contact (at low relative speed, no bounce!)
        const pFwdX = Math.sin(player.headingRad);
        const pFwdZ = Math.cos(player.headingRad);
        const bFwdX = Math.sin(boss.headingRad);
        const bFwdZ = Math.cos(boss.headingRad);

        // Drive force projected along contact normal
        const pPushDir = pFwdX * nx + pFwdZ * nz;
        const bPushDir = bFwdX * (-nx) + bFwdZ * (-nz);

        const pDriveForce = playerStats.pushingForceN * Math.max(0, pPushDir);
        let bDriveForce = bossStats.pushingForceN * Math.max(0, bPushDir);
        // The Bull bronze wedge leverage bonus during active charge or front plow contact
        if (bossId === 'bull' && (sim.bossChargeActiveSec > 0 || bPushDir > 0.6)) {
          bDriveForce *= 1.25;
        }

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
        }
      }
    }
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

  // Angles of contact in Three.js coordinate system (forward is [sin, cos])
  const anglePlayerToBoss = Math.atan2(nx, nz);
  const playerAttackAngle = Math.abs(normalizeAngle(player.headingRad - anglePlayerToBoss));
  const playerPresentingFront = playerAttackAngle < 0.72 || playerHit;
  const playerHitOnSide = playerAttackAngle >= 0.72 && playerAttackAngle <= 2.35;

  const angleBossToPlayer = Math.atan2(-nx, -nz);
  const bossHitAngle = Math.abs(normalizeAngle(boss.headingRad - angleBossToPlayer));
  const bossHitOnFront = bossHitAngle < 0.75;
  const bossHitOnSide = bossHitAngle >= 0.65 && bossHitAngle <= 2.25;

  const bossEffectiveArmor = bossHitOnFront ? bossStats.frontArmorScore : bossHitOnSide ? bossStats.sideArmorScore : bossStats.rearArmorScore;
  const playerEffectiveArmor = playerPresentingFront ? playerStats.frontArmorScore : playerHitOnSide ? playerStats.sideArmorScore : playerStats.rearArmorScore;

  const wType = playerStats.weaponTypeCategory;
  player.weaponActuationPhase = 1.0;

  const midX = (player.x + boss.x) * 0.5;
  const midZ = (player.z + boss.z) * 0.5;

  const isKineticA = wType === 'spinner-vert' || wType === 'spinner-horiz';
  const isKineticB = bossStats.weaponTypeCategory === 'spinner-vert' || bossStats.weaponTypeCategory === 'spinner-horiz';
  const trueKineticClash = weaponClash && isKineticA && isKineticB;

  // Direct Weapon Clash (Both rotating kinetic weapons collided in mid-air)
  if (trueKineticClash) {
    sim.impactsDelivered++;
    sim.sparks.push({
      id: sim.nextSparkId++,
      x: midX,
      y: 0.35,
      z: midZ,
      color: '#facc15',
      intensity: 3.2,
      age: 0,
    });
    sim.cameraImpactShake = 0.85;

    // Both chassis absorb kinetic shock from opposing weapon energy
    const bossEnergy = bossStats.weaponEnergyJ * (boss.weaponSpinPct / 100);
    const playerEnergy = playerStats.weaponEnergyJ * (player.weaponSpinPct / 100);
    const shockDamageToPlayer = (bossEnergy / 125) / Math.max(0.4, playerEffectiveArmor / 65);
    const shockDamageToBoss = (playerEnergy / 125) / Math.max(0.4, bossEffectiveArmor / 65);

    player.hullIntegrityPct = Math.max(0, player.hullIntegrityPct - shockDamageToPlayer);
    boss.hullIntegrityPct = Math.max(0, boss.hullIntegrityPct - shockDamageToBoss);

    player.vx = -nx * 2.8;
    player.vz = -nz * 2.8;
    boss.vx = nx * 2.8;
    boss.vz = nz * 2.8;
    player.weaponSpinPct = Math.max(10, player.weaponSpinPct * 0.28);
    boss.weaponSpinPct = Math.max(10, boss.weaponSpinPct * 0.28);
    addEvent(sim, 'WEAPONS CLASHED — HIGH-ENERGY DEFLECTION!', 'impact');
    sim.contactCooldownSec = 0.45;
    return;
  }

  // =========================================================================
  // CASE A: PLAYER PRESENTS ACTIVE FRONT WEAPON / WEDGE / LIFTER / GRABBER
  // =========================================================================
  if (playerPresentingFront && player.weaponHealthPct > 15 && (playerHit || weaponClash || !bossHit)) {
    // 1. SPINNER ENGAGEMENT
    if (wType === 'spinner-vert' || wType === 'spinner-horiz') {
      // Kinetic strike requires minimum 28% spin. Below this, weapon is stalled or spinning down;
      // continuous contact or pushing delivers only low-energy chassis scraping without kinetic shock.
      if (player.weaponSpinPct < 28) {
        sim.contactCooldownSec = 0.45;
        const scrapeRelSpeed = Math.hypot(player.vx - boss.vx, player.vz - boss.vz);
        if (scrapeRelSpeed > 1.2) {
          sim.sparks.push({
            id: sim.nextSparkId++,
            x: midX,
            y: 0.25,
            z: midZ,
            color: '#fbbf24',
            intensity: 0.8,
            age: 0,
          });
        }
        return;
      }

      // Rotational Kinetic Energy: E = 0.5 * I * omega^2 (quadratic with rotational velocity)
      const spinFraction = Math.pow(player.weaponSpinPct / 100, 2);
      const rawKineticEnergyJ = playerStats.weaponEnergyJ * spinFraction;

      sim.impactsDelivered++;
      sim.sparks.push({
        id: sim.nextSparkId++,
        x: midX,
        y: 0.35,
        z: midZ,
        color: '#fde047',
        intensity: Math.min(3.5, 1.2 + rawKineticEnergyJ / 1400),
        age: 0,
      });
      sim.cameraImpactShake = Math.min(1.0, rawKineticEnergyJ / 2400);

      // Deflection & Armor calculation:
      // Front wedge / plow is hardened sloped AR400 armor specifically engineered to absorb & deflect spinners.
      // Hitting the front plow deflects substantial energy, transferring high recoil back into the spinner.
      // Striking unarmored sides or rear delivers 100% devastating kinetic breach!
      if (bossHitOnFront) {
        const deflectionFactor = bossStats.frontArmorScore >= 100 ? 0.32 : 0.50;
        const deliveredEnergyJ = rawKineticEnergyJ * deflectionFactor;
        const frontArmorDamage = (deliveredEnergyJ / 150);
        boss.frontArmorPct = Math.max(0, boss.frontArmorPct - frontArmorDamage * 1.05);
        boss.hullIntegrityPct = Math.max(0, boss.hullIntegrityPct - frontArmorDamage * 0.40);

        // Substantial recoil impulse thrown back onto Player Bot from striking immovable hardened wedge
        const playerRecoilSpeed = 3.2 + (rawKineticEnergyJ / 1100) * 1.5;
        player.vx = -nx * playerRecoilSpeed;
        player.vz = -nz * playerRecoilSpeed;
        player.pitchRad = 0.35;

        // Boss absorbs strike through heavy plow with minimal displacement
        boss.vx = nx * 1.2;
        boss.vz = nz * 1.2;
        sim.bossStunTimerSec = 0.30;

        // Striking the stationary hardened plow stalls the spinner bar down to near zero
        player.weaponSpinPct = Math.min(8, player.weaponSpinPct * 0.10);
        addEvent(sim, `DEFLECTED BY ${sim.bossDossier.name.toUpperCase()} FRONT PLOW!`, 'warning');
      } else {
        // Flank or Rear strike: catastrophic kinetic breach into unprotected chassis!
        const deliveredEnergyJ = rawKineticEnergyJ;
        const armorMitigation = bossEffectiveArmor / 65;
        const breachDamage = (deliveredEnergyJ / 115) / Math.max(0.5, armorMitigation);

        boss.hullIntegrityPct = Math.max(0, boss.hullIntegrityPct - breachDamage);
        boss.sideArmorPct = Math.max(0, boss.sideArmorPct - breachDamage * 1.35);
        boss.leftDriveHealthPct = Math.max(0, boss.leftDriveHealthPct - breachDamage * 1.1);
        boss.rightDriveHealthPct = Math.max(0, boss.rightDriveHealthPct - breachDamage * 1.1);

        const knockbackSpeed = 2.8 + (deliveredEnergyJ / 1300) * 2.2;
        boss.vx = nx * knockbackSpeed;
        boss.vz = nz * knockbackSpeed;
        boss.pitchRad = -0.42;
        sim.bossStunTimerSec = 0.75;

        // Recoil on Player
        const recoilRatio = playerStats.weaponRecoilScore / 100;
        const playerRecoilSpeed = knockbackSpeed * recoilRatio * 0.55;
        player.vx = -nx * (playerRecoilSpeed + 0.8);
        player.vz = -nz * (playerRecoilSpeed + 0.8);

        // Spinner discharges stored angular momentum on impact
        player.weaponSpinPct = Math.min(10, player.weaponSpinPct * 0.15);
        addEvent(sim, 'KINETIC BREACH — SIDE FLANK!', 'impact');
      }

      // Flip on vertical spinner hits: requires kinetic bite >= 1400 J or weakened front armor
      if (wType === 'spinner-vert' && (rawKineticEnergyJ >= 1400 || boss.frontArmorPct < 65)) {
        boss.isFlipped = true;
        sim.flipsInflicted++;
        addEvent(sim, `ROBOT FLIPPED — ${sim.bossDossier.name} INVERTED!`, 'impact');
      }

      sim.weaponAtSpeedAnnounced = false;
      sim.contactCooldownSec = 0.85;
      return;
    }

    // 2. LIFTER ENGAGEMENT
    if (wType === 'lifter') {
      sim.impactsDelivered++;
      const getsUnderneath =
        !bossHitOnFront ||
        playerStats.groundClearanceInches <= bossStats.groundClearanceInches + 0.05 ||
        strategy === 'control';

      if (getsUnderneath) {
        boss.pitchRad = -0.55;
        boss.vx = nx * 2.4;
        boss.vz = nz * 2.4;
        sim.bossStunTimerSec = 0.85;
        boss.hullIntegrityPct = Math.max(0, boss.hullIntegrityPct - 14);

        if (!bossHitOnFront || sim.impactsDelivered >= 2 || playerStats.pushingForceN >= 135) {
          boss.isFlipped = true;
          sim.flipsInflicted++;
          addEvent(sim, `ROBOT FLIPPED — LIFTER OVERTURNED ${sim.bossDossier.name}!`, 'impact');
        } else {
          addEvent(sim, 'LIFTER SCOOPED UNDER CHASSIS', 'impact');
        }
      } else {
        player.vx = -nx * 2.2;
        player.vz = -nz * 2.2;
        addEvent(sim, 'IMPACT — FRONT', 'warning');
      }
      sim.contactCooldownSec = 0.62;
      return;
    }

    // 3. WEDGE / PUSHER ENGAGEMENT
    if (wType === 'wedge') {
      const playerEffectivePush = playerStats.pushingForceN + (!bossHitOnFront ? 35 : 10);
      const bossEffectivePush = bossStats.pushingForceN;

      sim.sparks.push({
        id: sim.nextSparkId++,
        x: midX,
        y: 0.2,
        z: midZ,
        color: '#f59e0b',
        intensity: 1.4,
        age: 0,
      });

      if (playerEffectivePush >= bossEffectivePush - 5) {
        sim.impactsDelivered++;
        sim.playerPushTimeSec += 0.5;
        const shoveVel = 2.0 + (playerEffectivePush - bossEffectivePush) * 0.015;
        boss.vx = nx * shoveVel;
        boss.vz = nz * shoveVel;
        boss.hullIntegrityPct = Math.max(0, boss.hullIntegrityPct - 5);
        sim.bossStunTimerSec = 0.35;
        addEvent(sim, `WEDGE SHUVED ${sim.bossDossier.name} BACKWARD`, 'impact');
      } else {
        sim.bossPushTimeSec += 0.5;
        sim.bullPushTimeSec += 0.5;
        player.vx = -nx * 1.8;
        player.vz = -nz * 1.8;
        player.hullIntegrityPct = Math.max(0, player.hullIntegrityPct - 5);
        addEvent(sim, `OUT-PUSHED BY ${sim.bossDossier.name}`, 'warning');
      }
      sim.contactCooldownSec = 0.45;
      return;
    }

    // 4. GRABBER / CLAMP ENGAGEMENT
    if (wType === 'grabber') {
      sim.impactsDelivered++;
      player.isGrabbing = true;
      sim.grabTimerSec = 1.6;
      sim.bossStunTimerSec = 1.6;

      const playerEffectivePush = playerStats.pushingForceN + 35;
      const bossEffectivePush = bossStats.pushingForceN;

      sim.sparks.push({
        id: sim.nextSparkId++,
        x: midX,
        y: 0.25,
        z: midZ,
        color: '#38bdf8',
        intensity: 1.8,
        age: 0,
      });

      if (playerEffectivePush >= bossEffectivePush - 20) {
        sim.playerPushTimeSec += 0.8;
        const shoveVel = 2.4 + (playerEffectivePush - bossEffectivePush) * 0.02;
        boss.vx = nx * shoveVel;
        boss.vz = nz * shoveVel;
        const clampDamage = bossHitOnFront ? 14 : 24;
        boss.hullIntegrityPct = Math.max(0, boss.hullIntegrityPct - clampDamage);
        if (!bossHitOnFront) {
          boss.leftDriveHealthPct = Math.max(0, boss.leftDriveHealthPct - 15);
          boss.rightDriveHealthPct = Math.max(0, boss.rightDriveHealthPct - 15);
        }
        addEvent(sim, `PINNED & CRUSHED ${sim.bossDossier.name}!`, 'impact');
      } else {
        sim.bossPushTimeSec += 0.4;
        player.vx = -nx * 1.8;
        player.vz = -nz * 1.8;
        boss.hullIntegrityPct = Math.max(0, boss.hullIntegrityPct - 8);
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

  if (playerHitOnSide) {
    sim.lateralImpactsTaken++;
    addEvent(sim, 'IMPACT — SIDE', 'warning');
  } else {
    addEvent(sim, 'IMPACT — FRONT', 'warning');
  }

  sim.sparks.push({
    id: sim.nextSparkId++,
    x: midX,
    y: 0.3,
    z: midZ,
    color: '#ef4444',
    intensity: 2.0,
    age: 0,
  });

  const bossDamageScaling = (bossStats.weaponEnergyJ / 1400) + (bossId === 'cyclone' ? 14 : bossId === 'bull' ? 4.5 : 7);
  const armorReduction = Math.max(0.45, playerEffectiveArmor / 78);
  const rawDamageToPlayer = bossDamageScaling / armorReduction;

  player.hullIntegrityPct = Math.max(0, player.hullIntegrityPct - rawDamageToPlayer);

  if (playerHitOnSide) {
    player.sideArmorPct = Math.max(0, player.sideArmorPct - rawDamageToPlayer * 1.3);
    if (!playerStats.wheelsProtected) {
      player.leftDriveHealthPct = Math.max(0, player.leftDriveHealthPct - rawDamageToPlayer * 1.25);
    }
  }

  // Knockback on player
  const bossKnockback = 2.6 + (bossStats.weaponEnergyJ / 2200) * 1.5;
  player.vx = -nx * bossKnockback;
  player.vz = -nz * bossKnockback;
  sim.playerStunTimerSec = 0.45;

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
  while (!sim.isFinished && steps < 60 * 45) {
    stepBattleSimulation(sim, dt);
    steps++;
  }
  return generateBattleAnalysisReport(sim);
}
