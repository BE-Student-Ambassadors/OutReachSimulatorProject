import * as THREE from 'three';
import { calculateBullStats, calculateEngineeringStats } from './engineering';
import { type AutonomousStrategy, type BattleAnalysisReport, type BattleEventLog, type CombatantTelemetry, type EngineeringStats, type RobotConfiguration, type SparkBurst } from '../types/robot';

export const ARENA_HALF_SIZE = 3.6; // 7.2m x 7.2m enclosed combat arena

export interface LiveBattleSimulation {
  timeSec: number;
  maxDurationSec: number;
  isFinished: boolean;
  winner: 'player' | 'bull' | null;
  winReason: string;
  strategy: AutonomousStrategy;
  playerConfig: RobotConfiguration;
  playerStats: EngineeringStats;
  bullStats: EngineeringStats;

  player: CombatantTelemetry;
  bull: CombatantTelemetry;

  events: BattleEventLog[];
  sparks: SparkBurst[];
  nextEventId: number;
  nextSparkId: number;

  // Internal combat tracking for telemetry & post-battle analysis
  contactCooldownSec: number;
  grabTimerSec: number;
  bullStunTimerSec: number;
  playerStunTimerSec: number;
  bullChargeCooldownSec: number;
  bullChargeActiveSec: number;
  weaponAtSpeedAnnounced: boolean;
  tempWarningAnnounced: boolean;
  powerLimitAnnounced: boolean;

  // Post-battle counters
  impactsDelivered: number;
  lateralImpactsTaken: number;
  flipsInflicted: number;
  playerPushTimeSec: number;
  bullPushTimeSec: number;
  peakMotorTempC: number;
  cameraImpactShake: number;
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
  // Prevent duplicate identical event spam within 1.5s
  const recent = sim.events[0];
  if (recent && recent.text === text && sim.timeSec - recent.timeSec < 1.6) {
    return;
  }
  sim.events.unshift({
    id: sim.nextEventId++,
    timeSec: Number(sim.timeSec.toFixed(1)),
    text,
    type,
  });
  if (sim.events.length > 18) {
    sim.events.pop();
  }
}

export function createBattleSimulation(
  playerConfig: RobotConfiguration,
  strategy: AutonomousStrategy
): LiveBattleSimulation {
  const playerStats = calculateEngineeringStats(playerConfig);
  const bullStats = calculateBullStats();

  const initialPlayer: CombatantTelemetry = {
    x: 0,
    z: 2.35,
    headingRad: Math.PI, // facing North (-z) toward The Bull
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

  const initialBull: CombatantTelemetry = {
    x: 0,
    z: -2.35,
    headingRad: 0, // facing South (+z) toward Player
    vx: 0,
    vz: 0,
    pitchRad: 0,
    rollRad: 0,
    isFlipped: false,
    flipTimerSec: 0,
    batteryPct: 100,
    motorTempC: 40,
    weaponSpinPct: 100,
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
    timeSec: 0,
    maxDurationSec: 36,
    isFinished: false,
    winner: null,
    winReason: '',
    strategy,
    playerConfig,
    playerStats,
    bullStats,
    player: initialPlayer,
    bull: initialBull,
    events: [],
    sparks: [],
    nextEventId: 1,
    nextSparkId: 1,
    contactCooldownSec: 0,
    grabTimerSec: 0,
    bullStunTimerSec: 0,
    playerStunTimerSec: 0,
    bullChargeCooldownSec: 1.2,
    bullChargeActiveSec: 0,
    weaponAtSpeedAnnounced: false,
    tempWarningAnnounced: false,
    powerLimitAnnounced: false,
    impactsDelivered: 0,
    lateralImpactsTaken: 0,
    flipsInflicted: 0,
    playerPushTimeSec: 0,
    bullPushTimeSec: 0,
    peakMotorTempC: 38,
    cameraImpactShake: 0,
  };

  addEvent(sim, `AUTONOMOUS STRATEGY LOCKED: ${strategy.toUpperCase()}`, 'info');
  if (playerStats.powerLimited) {
    addEvent(sim, 'BATTERY POWER LIMITED', 'warning');
    sim.powerLimitAnnounced = true;
  }

  return sim;
}

export function stepBattleSimulation(sim: LiveBattleSimulation, rawDt: number): void {
  if (sim.isFinished) return;
  const dt = Math.min(rawDt, 0.04);
  sim.timeSec += dt;

  const { player, bull, playerStats, bullStats, strategy } = sim;

  // Decay camera shake & age sparks
  sim.cameraImpactShake = Math.max(0, sim.cameraImpactShake - dt * 2.8);
  sim.contactCooldownSec = Math.max(0, sim.contactCooldownSec - dt);
  sim.bullStunTimerSec = Math.max(0, sim.bullStunTimerSec - dt);
  sim.playerStunTimerSec = Math.max(0, sim.playerStunTimerSec - dt);
  sim.bullChargeCooldownSec = Math.max(0, sim.bullChargeCooldownSec - dt);
  sim.bullChargeActiveSec = Math.max(0, sim.bullChargeActiveSec - dt);

  for (let i = sim.sparks.length - 1; i >= 0; i--) {
    sim.sparks[i].age += dt;
    if (sim.sparks[i].age > 0.45) {
      sim.sparks.splice(i, 1);
    }
  }

  // Decay weapon actuation visual phase
  if (player.weaponActuationPhase > 0) {
    player.weaponActuationPhase = Math.max(0, player.weaponActuationPhase - dt * 1.9);
  }
  player.pitchRad *= Math.pow(0.04, dt);
  player.rollRad *= Math.pow(0.04, dt);
  bull.pitchRad *= Math.pow(0.04, dt);
  bull.rollRad *= Math.pow(0.04, dt);

  // 1. WEAPON SPIN-UP & BATTERY / THERMAL TELEMETRY
  if (player.weaponHealthPct > 20 && !player.isFlipped && player.batteryPct > 2) {
    if (playerStats.weaponSpinUpSec > 0) {
      const spinRate = 100 / Math.max(0.35, playerStats.weaponSpinUpSec);
      const powerFactor = playerStats.powerLimited ? 0.78 : 1.0;
      player.weaponSpinPct = Math.min(100, player.weaponSpinPct + spinRate * powerFactor * dt);
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

  // Battery drain based on strategy & runtime
  const strategyDrainFactor =
    strategy === 'aggressive' ? 1.18 : strategy === 'defensive' ? 0.86 : 1.0;
  // Scale drain so a 180s runtime battery drains ~25-45% in a 35s match, while a tiny overworked battery can hit low levels
  const playerDrainPerSec = (100 / Math.max(55, playerStats.runtimeSeconds * 0.72)) * strategyDrainFactor;
  player.batteryPct = Math.max(0, player.batteryPct - playerDrainPerSec * dt);
  bull.batteryPct = Math.max(0, bull.batteryPct - 0.55 * dt);

  // Motor temperature progression
  const targetTemp =
    playerStats.expectedMotorTempC + (strategy === 'aggressive' ? 5 : 0);
  player.motorTempC += (targetTemp - player.motorTempC) * dt * 0.14;
  if (player.motorTempC > sim.peakMotorTempC) {
    sim.peakMotorTempC = Math.round(player.motorTempC);
  }
  if (player.motorTempC >= 84 && !sim.tempWarningAnnounced) {
    addEvent(sim, 'DRIVE MOTOR HOT', 'warning');
    sim.tempWarningAnnounced = true;
  }

  // 2. FLIPPED / SELF-RIGHTING LOGIC
  if (player.isFlipped) {
    player.flipTimerSec += dt;
    player.aiStateLabel = 'RECOVER';
    if (playerStats.selfRightingLabel === 'RELIABLE' && player.flipTimerSec >= 1.4 && player.batteryPct > 5) {
      player.isFlipped = false;
      player.flipTimerSec = 0;
      player.weaponActuationPhase = 1.0;
      addEvent(sim, 'SELF-RIGHTING RECOVERY COMPLETE', 'info');
    } else if (playerStats.selfRightingLabel === 'POSSIBLE' && player.flipTimerSec >= 2.2) {
      // Possible recovery via large wheels or vertical spinner gyro kick
      player.isFlipped = false;
      player.flipTimerSec = 0;
      addEvent(sim, 'INVERTED DRIVE RECOVERY', 'info');
    } else if (player.flipTimerSec >= 4.5) {
      finishBattle(sim, 'bull', 'Player robot was flipped inverted and unable to self-right.');
      return;
    }
  }

  if (bull.isFlipped) {
    bull.flipTimerSec += dt;
    bull.aiStateLabel = 'RECOVER';
    // The Bull has no self-righting mechanism; if flipped past 3.2s it is immobilized!
    if (bull.flipTimerSec >= 3.2) {
      finishBattle(sim, 'player', 'The Bull was flipped inverted and immobilized!');
      return;
    }
  }

  // 3. RELATIVE GEOMETRY BETWEEN PLAYER AND THE BULL
  const dx = bull.x - player.x;
  const dz = bull.z - player.z;
  const dist = Math.max(0.001, Math.hypot(dx, dz));
  const anglePlayerToBull = Math.atan2(dx, -dz);
  const angleBullToPlayer = Math.atan2(-dx, dz);

  // 4. PLAYER AUTONOMOUS CONTROLLER: SENSE -> DECIDE -> MOVE -> ENGAGE
  const playerDriveHealth = (player.leftDriveHealthPct + player.rightDriveHealthPct) * 0.005;
  const thermalThrottle = player.motorTempC > 90 ? 0.76 : 1.0;
  const batteryThrottle = player.batteryPct < 10 ? 0.55 : player.batteryPct < 22 ? 0.82 : 1.0;
  const playerMaxSpeedUnits =
    (playerStats.topSpeedMph / 14.0) * 3.1 * playerDriveHealth * thermalThrottle * batteryThrottle;
  const playerTurnRadPerSec =
    THREE.MathUtils.degToRad(playerStats.turningRateDegPerSec) *
    1.55 *
    Math.max(0.35, playerDriveHealth);

  let desiredPlayerHeading = anglePlayerToBull;
  let desiredPlayerSpeed = playerMaxSpeedUnits;

  const needsSpinUp =
    playerStats.weaponSpinUpSec >= 1.2 &&
    player.weaponSpinPct < (strategy === 'aggressive' ? 52 : 84) &&
    player.weaponHealthPct > 25;

  if (!player.isFlipped && sim.playerStunTimerSec <= 0) {
    if (sim.grabTimerSec > 0 && player.isGrabbing) {
      // Currently grabbing The Bull! Drive it forcefully toward nearest arena wall!
      player.aiStateLabel = 'PUSH';
      const wallTargetX = bull.x >= 0 ? ARENA_HALF_SIZE : -ARENA_HALF_SIZE;
      const wallTargetZ = bull.z >= 0 ? ARENA_HALF_SIZE : -ARENA_HALF_SIZE;
      desiredPlayerHeading = Math.atan2(wallTargetX - player.x, -(wallTargetZ - player.z));
      desiredPlayerSpeed = playerMaxSpeedUnits * 0.95;
    } else if (needsSpinUp && strategy !== 'aggressive') {
      // EVADE while spinning up weapon
      player.aiStateLabel = 'EVADE';
      desiredPlayerHeading = normalizeAngle(anglePlayerToBull + Math.PI * 0.68);
      desiredPlayerSpeed = playerMaxSpeedUnits * 0.92;
    } else if (strategy === 'control') {
      // CONTROL: Aim for a flanking offset to hit The Bull's side/rear before cutting in
      if (dist > 1.35) {
        player.aiStateLabel = 'FLANK';
        // Compute point offset perpendicular to The Bull's heading
        const bullRightX = Math.cos(bull.headingRad);
        const bullRightZ = Math.sin(bull.headingRad);
        const sideSign =
          (player.x - bull.x) * bullRightX + (player.z - bull.z) * bullRightZ >= 0 ? 1 : -1;
        const flankX = bull.x + bullRightX * sideSign * 1.45;
        const flankZ = bull.z + bullRightZ * sideSign * 1.45;
        desiredPlayerHeading = Math.atan2(flankX - player.x, -(flankZ - player.z));
        desiredPlayerSpeed = playerMaxSpeedUnits;
      } else {
        player.aiStateLabel = 'ENGAGE';
        desiredPlayerHeading = anglePlayerToBull;
        desiredPlayerSpeed = playerMaxSpeedUnits;
      }
    } else if (strategy === 'defensive') {
      // DEFENSIVE: Sidestep when The Bull is charging head-on, counterattack when Bull is recovering/turned
      const bullAimError = Math.abs(normalizeAngle(bull.headingRad - angleBullToPlayer));
      if (bullAimError < 0.42 && dist < 2.5 && sim.bullChargeActiveSec > 0) {
        player.aiStateLabel = 'EVADE';
        desiredPlayerHeading = normalizeAngle(anglePlayerToBull + Math.PI * 0.55);
        desiredPlayerSpeed = playerMaxSpeedUnits;
      } else {
        player.aiStateLabel = 'ENGAGE';
        desiredPlayerHeading = anglePlayerToBull;
        desiredPlayerSpeed = playerMaxSpeedUnits * 0.95;
      }
    } else {
      // AGGRESSIVE: Close distance directly and attack frequently
      player.aiStateLabel = dist < 1.5 ? 'ENGAGE' : 'APPROACH';
      desiredPlayerHeading = anglePlayerToBull;
      desiredPlayerSpeed = playerMaxSpeedUnits;
    }

    // Rotate player toward desired heading bounded by turningRateDegPerSec
    const headingDiff = normalizeAngle(desiredPlayerHeading - player.headingRad);
    const maxStepTurn = playerTurnRadPerSec * dt;
    player.headingRad = normalizeAngle(
      player.headingRad + Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), maxStepTurn)
    );

    const forwardAlignment = Math.max(0.2, Math.cos(headingDiff));
    const targetVx = Math.sin(player.headingRad) * desiredPlayerSpeed * forwardAlignment;
    const targetVz = -Math.cos(player.headingRad) * desiredPlayerSpeed * forwardAlignment;

    const accelRate = Math.min(14, Math.max(4.5, playerStats.accelerationMphPerSec * 0.85));
    player.vx += (targetVx - player.vx) * Math.min(1, accelRate * dt);
    player.vz += (targetVz - player.vz) * Math.min(1, accelRate * dt);
  } else {
    player.vx *= Math.pow(0.15, dt);
    player.vz *= Math.pow(0.15, dt);
  }

  // 5. THE BULL AUTONOMOUS CONTROLLER
  const bullDriveHealth = (bull.leftDriveHealthPct + bull.rightDriveHealthPct) * 0.005;
  const bullMaxSpeedUnits = (bullStats.topSpeedMph / 14.0) * 2.95 * bullDriveHealth;
  const bullTurnRadPerSec =
    THREE.MathUtils.degToRad(bullStats.turningRateDegPerSec) *
    1.35 *
    Math.max(0.28, bullDriveHealth);

  if (!bull.isFlipped && sim.bullStunTimerSec <= 0 && !player.isGrabbing) {
    const bullHeadingDiff = normalizeAngle(angleBullToPlayer - bull.headingRad);
    const maxBullTurn = bullTurnRadPerSec * dt;

    // When The Bull is mid-charge, it commits to its line (slower steering correction)
    const turnMultiplier = sim.bullChargeActiveSec > 0 ? 0.48 : 1.0;
    bull.headingRad = normalizeAngle(
      bull.headingRad +
        Math.sign(bullHeadingDiff) * Math.min(Math.abs(bullHeadingDiff), maxBullTurn * turnMultiplier)
    );

    // Trigger Bull charge if lined up
    if (
      Math.abs(bullHeadingDiff) < 0.32 &&
      dist < 3.4 &&
      sim.bullChargeCooldownSec <= 0 &&
      sim.bullChargeActiveSec <= 0
    ) {
      sim.bullChargeActiveSec = 1.35;
      sim.bullChargeCooldownSec = 3.2;
      bull.aiStateLabel = 'ENGAGE';
    } else if (sim.bullChargeActiveSec <= 0) {
      bull.aiStateLabel = Math.abs(bullHeadingDiff) > 0.45 ? 'SENSE' : 'APPROACH';
    }

    const chargeBoost = sim.bullChargeActiveSec > 0 ? 1.25 : 0.85;
    const alignFactor = sim.bullChargeActiveSec > 0 ? 0.95 : Math.max(0.15, Math.cos(bullHeadingDiff));
    const bTargetVx = Math.sin(bull.headingRad) * bullMaxSpeedUnits * chargeBoost * alignFactor;
    const bTargetVz = -Math.cos(bull.headingRad) * bullMaxSpeedUnits * chargeBoost * alignFactor;

    bull.vx += (bTargetVx - bull.vx) * Math.min(1, 6.5 * dt);
    bull.vz += (bTargetVz - bull.vz) * Math.min(1, 6.5 * dt);
  } else if (!player.isGrabbing) {
    bull.vx *= Math.pow(0.15, dt);
    bull.vz *= Math.pow(0.15, dt);
  }

  // 6. INTEGRATE POSITIONS & GRABBER PINNING
  player.x += player.vx * dt;
  player.z += player.vz * dt;

  if (sim.grabTimerSec > 0 && player.isGrabbing) {
    sim.grabTimerSec = Math.max(0, sim.grabTimerSec - dt);
    // Keep The Bull pinned right in front of the Grabber jaws!
    const holdDist = 1.02;
    bull.x = player.x + Math.sin(player.headingRad) * holdDist;
    bull.z = player.z - Math.cos(player.headingRad) * holdDist;
    bull.vx = player.vx;
    bull.vz = player.vz;
    bull.headingRad = normalizeAngle(bull.headingRad + dt * 1.4);
    sim.playerPushTimeSec += dt;

    // If Grabber slams The Bull into the arena wall, deal heavy structural + drive damage!
    if (
      Math.abs(bull.x) > ARENA_HALF_SIZE - 0.35 ||
      Math.abs(bull.z) > ARENA_HALF_SIZE - 0.35
    ) {
      bull.hullIntegrityPct = Math.max(0, bull.hullIntegrityPct - 24 * dt);
      bull.sideArmorPct = Math.max(0, bull.sideArmorPct - 32 * dt);
      bull.leftDriveHealthPct = Math.max(0, bull.leftDriveHealthPct - 28 * dt);
      bull.rightDriveHealthPct = Math.max(0, bull.rightDriveHealthPct - 24 * dt);
      if (Math.random() < 0.35) {
        sim.sparks.push({
          id: sim.nextSparkId++,
          x: bull.x,
          y: 0.35,
          z: bull.z,
          color: '#38bdf8',
          intensity: 1.4,
          age: 0,
        });
      }
    }

    if (sim.grabTimerSec <= 0) {
      player.isGrabbing = false;
      sim.bullStunTimerSec = 0.45;
      sim.contactCooldownSec = 0.4;
    }
  } else {
    bull.x += bull.vx * dt;
    bull.z += bull.vz * dt;
  }

  // 7. ARENA WALL BOUNDARY COLLISIONS
  const clampWall = (bot: CombatantTelemetry, isPlayer: boolean) => {
    let hitWall = false;
    if (bot.x > ARENA_HALF_SIZE) {
      bot.x = ARENA_HALF_SIZE;
      bot.vx = -bot.vx * 0.4;
      hitWall = true;
    } else if (bot.x < -ARENA_HALF_SIZE) {
      bot.x = -ARENA_HALF_SIZE;
      bot.vx = -bot.vx * 0.4;
      hitWall = true;
    }
    if (bot.z > ARENA_HALF_SIZE) {
      bot.z = ARENA_HALF_SIZE;
      bot.vz = -bot.vz * 0.4;
      hitWall = true;
    } else if (bot.z < -ARENA_HALF_SIZE) {
      bot.z = -ARENA_HALF_SIZE;
      bot.vz = -bot.vz * 0.4;
      hitWall = true;
    }

    if (hitWall) {
      const speedMag = Math.hypot(bot.vx, bot.vz);
      if (!isPlayer && (speedMag > 1.3 || sim.bullStunTimerSec > 0)) {
        // The Bull slammed into the arena wall hazard!
        const wallDmg = 6.5 + speedMag * 3.2;
        bull.hullIntegrityPct = Math.max(0, bull.hullIntegrityPct - wallDmg);
        bull.leftDriveHealthPct = Math.max(0, bull.leftDriveHealthPct - wallDmg * 0.85);
        bull.rightDriveHealthPct = Math.max(0, bull.rightDriveHealthPct - wallDmg * 0.75);
        sim.bullStunTimerSec = Math.max(sim.bullStunTimerSec, 0.55);
        addEvent(sim, 'THE BULL SLAMMED INTO ARENA WALL', 'impact');
      }
      if (isPlayer && playerStats.weaponTypeCategory === 'spinner-horiz' && player.weaponSpinPct > 50) {
        // Horizontal spinner vulnerability on wall contact
        const guardFactor = playerConfigHasWeaponGuard(sim.playerConfig) ? 0.5 : 1.0;
        player.weaponHealthPct = Math.max(0, player.weaponHealthPct - 10 * guardFactor);
        player.weaponSpinPct *= 0.6;
      }
    }
  };

  clampWall(player, true);
  clampWall(bull, false);

  // 8. ROBOT-TO-ROBOT COLLISION & ENGAGEMENT RESOLUTION
  const collisionRadius = 1.06;
  const newDx = bull.x - player.x;
  const newDz = bull.z - player.z;
  const currentDist = Math.hypot(newDx, newDz);

  if (currentDist < collisionRadius && !player.isFlipped && !bull.isFlipped) {
    // Separate overlapping hulls slightly
    const nx = newDx / Math.max(0.001, currentDist);
    const nz = newDz / Math.max(0.001, currentDist);
    const overlap = collisionRadius - currentDist;
    player.x -= nx * overlap * 0.45;
    player.z -= nz * overlap * 0.45;
    bull.x += nx * overlap * 0.55;
    bull.z += nz * overlap * 0.55;

    if (sim.contactCooldownSec <= 0) {
      resolveEngagementImpact(sim, nx, nz, dt);
    }
  }

  // 9. CHECK WIN / KNOCKOUT CONDITIONS
  const bullDriveAvg = (bull.leftDriveHealthPct + bull.rightDriveHealthPct) * 0.5;
  const playerDriveAvg = (player.leftDriveHealthPct + player.rightDriveHealthPct) * 0.5;

  if (bull.hullIntegrityPct <= 0 || bullDriveAvg <= 8) {
    finishBattle(
      sim,
      'player',
      bullDriveAvg <= 8
        ? "The Bull's drivetrain was disabled and immobilized!"
        : "The Bull's structural armor and critical systems were knocked out!"
    );
    return;
  }

  if (player.hullIntegrityPct <= 0 || playerDriveAvg <= 8 || player.batteryPct <= 0.5) {
    const reason =
      player.batteryPct <= 0.5
        ? 'Your battery depleted completely before the match ended.'
        : playerDriveAvg <= 8
        ? 'Your drive motors/wheels were disabled, leaving your robot immobilized.'
        : 'Repeated impacts overwhelmed your chassis armor and structural integrity.';
    finishBattle(sim, 'bull', reason);
    return;
  }

  // Judges / Arena Control Decision at maxDurationSec (36s)
  if (sim.timeSec >= sim.maxDurationSec) {
    const playerScore =
      (100 - bull.hullIntegrityPct) * 1.5 +
      (100 - bullDriveAvg) * 1.2 +
      sim.flipsInflicted * 25 +
      sim.impactsDelivered * 8 +
      sim.playerPushTimeSec * 10;
    const bullScore =
      (100 - player.hullIntegrityPct) * 1.1 +
      (100 - playerDriveAvg) * 1.0 +
      sim.bullPushTimeSec * 4;

    if (playerScore >= bullScore) {
      finishBattle(
        sim,
        'player',
        'Time expired — Your robot won the Arena Control & Damage decision!'
      );
    } else {
      finishBattle(
        sim,
        'bull',
        'Time expired — The Bull controlled the arena and dealt greater cumulative damage.'
      );
    }
  }
}

function playerConfigHasWeaponGuard(config: RobotConfiguration): boolean {
  return config.utilityId === 'weapon-guard';
}

function resolveEngagementImpact(
  sim: LiveBattleSimulation,
  nx: number,
  nz: number,
  dt: number
): void {
  const { player, bull, playerStats, bullStats, strategy } = sim;

  // Determine contact angles:
  // Is Player facing The Bull with its front weapon?
  const anglePlayerToBull = Math.atan2(nx, -nz);
  const playerAttackAngle = Math.abs(normalizeAngle(player.headingRad - anglePlayerToBull));
  const playerPresentingFront = playerAttackAngle < 0.65;
  const playerHitOnSide = playerAttackAngle >= 0.65 && playerAttackAngle <= 2.35;

  // Where on The Bull did the contact occur?
  const angleBullToPlayer = Math.atan2(-nx, nz);
  const bullHitAngle = Math.abs(normalizeAngle(bull.headingRad - angleBullToPlayer));
  const bullHitOnFront = bullHitAngle < 0.58;
  const bullHitOnSide = bullHitAngle >= 0.58 && bullHitAngle <= 2.25;
  // else bullHitOnRear!

  const bullEffectiveArmor = bullHitOnFront
    ? bullStats.frontArmorScore
    : bullHitOnSide
    ? bullStats.sideArmorScore
    : bullStats.rearArmorScore;

  const playerEffectiveArmor = playerPresentingFront
    ? playerStats.frontArmorScore
    : playerHitOnSide
    ? playerStats.sideArmorScore
    : playerStats.rearArmorScore;

  const wType = playerStats.weaponTypeCategory;
  player.weaponActuationPhase = 1.0;

  // Spawn sparks at midpoint
  const midX = (player.x + bull.x) * 0.5;
  const midZ = (player.z + bull.z) * 0.5;

  // =========================================================================
  // CASE A: PLAYER PRESENTS ACTIVE FRONT WEAPON / WEDGE / LIFTER / GRABBER
  // =========================================================================
  if (playerPresentingFront && player.weaponHealthPct > 15) {
    // 1. SPINNER ENGAGEMENT (Vertical / Horizontal / Custom Kinetic)
    if (wType === 'spinner-vert' || wType === 'spinner-horiz') {
      const spinFraction = Math.max(0.2, player.weaponSpinPct / 100);
      const deliveredEnergyJ = playerStats.weaponEnergyJ * spinFraction;

      sim.impactsDelivered++;
      sim.sparks.push({
        id: sim.nextSparkId++,
        x: midX,
        y: 0.35,
        z: midZ,
        color: '#fde047',
        intensity: 2.2,
        age: 0,
      });
      sim.cameraImpactShake = Math.min(1.0, deliveredEnergyJ / 2800);

      // Damage to The Bull scales strongly with delivered energy and whether hit is on side/rear vs front plow
      const armorMitigation = bullEffectiveArmor / 95;
      const rawBullDamage = (deliveredEnergyJ / 135) / Math.max(0.55, armorMitigation);
      bull.hullIntegrityPct = Math.max(0, bull.hullIntegrityPct - rawBullDamage);

      if (bullHitOnFront) {
        bull.frontArmorPct = Math.max(0, bull.frontArmorPct - rawBullDamage * 0.85);
        addEvent(sim, 'IMPACT — FRONT', 'impact');
      } else {
        bull.sideArmorPct = Math.max(0, bull.sideArmorPct - rawBullDamage * 1.45);
        bull.leftDriveHealthPct = Math.max(0, bull.leftDriveHealthPct - rawBullDamage * 1.15);
        bull.rightDriveHealthPct = Math.max(0, bull.rightDriveHealthPct - rawBullDamage * 0.95);
        addEvent(sim, 'IMPACT — SIDE', 'impact');
      }

      // Knockback & possible flip on The Bull (Vertical spinner uppercut!)
      const knockbackSpeed = 2.6 + (deliveredEnergyJ / 1600) * 1.8;
      bull.vx = nx * knockbackSpeed;
      bull.vz = nz * knockbackSpeed;
      bull.pitchRad = -0.38;
      sim.bullStunTimerSec = 0.65;

      if (
        wType === 'spinner-vert' &&
        deliveredEnergyJ >= 2200 &&
        (!bullHitOnFront || bull.frontArmorPct < 55)
      ) {
        if (deliveredEnergyJ >= 2900 || !bullHitOnFront) {
          bull.isFlipped = true;
          sim.flipsInflicted++;
          addEvent(sim, 'ROBOT FLIPPED — THE BULL INVERTED!', 'impact');
        }
      }

      // Recoil reaction on Player Bot!
      const recoilRatio = playerStats.weaponRecoilScore / 100;
      const playerRecoilSpeed = knockbackSpeed * recoilRatio * (bullHitOnFront ? 0.68 : 0.38);
      player.vx = -nx * playerRecoilSpeed;
      player.vz = -nz * playerRecoilSpeed;
      player.pitchRad = 0.32 * recoilRatio;
      player.rollRad = (wType === 'spinner-horiz' ? 0.36 : 0.18) * recoilRatio;
      player.weaponSpinPct = Math.max(15, player.weaponSpinPct * 0.32);
      sim.weaponAtSpeedAnnounced = false;

      // If player stability is CRITICAL/LOW and they hit The Bull's thick front plow at high recoil, they can self-destabilize!
      const weaponGuardBonus = playerConfigHasWeaponGuard(sim.playerConfig) ? 0.55 : 1.0;
      const selfWeaponWear = (bullHitOnFront ? 14 : 6) * recoilRatio * weaponGuardBonus;
      player.weaponHealthPct = Math.max(0, player.weaponHealthPct - selfWeaponWear);
      if (player.weaponHealthPct <= 15) {
        addEvent(sim, 'WEAPON DISABLED', 'critical');
      }

      if (playerStats.stabilityScore < 42 && bullHitOnFront && recoilRatio > 0.65) {
        player.hullIntegrityPct = Math.max(0, player.hullIntegrityPct - 12);
        sim.playerStunTimerSec = 0.65;
        if (playerStats.centerOfMassLabel === 'HIGH') {
          player.isFlipped = true;
          addEvent(sim, 'ROBOT FLIPPED FROM WEAPON RECOIL', 'critical');
        }
      }

      sim.contactCooldownSec = 0.55;
      return;
    }

    // 2. LIFTER ENGAGEMENT
    if (wType === 'lifter') {
      sim.impactsDelivered++;
      // Can the lifter get underneath The Bull?
      // Yes if hitting from side/rear, OR if low ground clearance / low CoM, OR if Control/Defensive timing!
      const getsUnderneath =
        !bullHitOnFront ||
        playerStats.groundClearanceInches <= 0.42 ||
        playerStats.centerOfMassLabel === 'LOW' ||
        strategy === 'control';

      if (getsUnderneath) {
        bull.pitchRad = -0.55;
        bull.vx = nx * 2.4;
        bull.vz = nz * 2.4;
        sim.bullStunTimerSec = 0.85;
        bull.hullIntegrityPct = Math.max(0, bull.hullIntegrityPct - 14);
        bull.leftDriveHealthPct = Math.max(0, bull.leftDriveHealthPct - 16);

        // Flip The Bull if side/rear lift OR second lift OR strong pushing follow-through!
        if (!bullHitOnFront || sim.impactsDelivered >= 2 || playerStats.pushingForceN >= 145) {
          bull.isFlipped = true;
          sim.flipsInflicted++;
          addEvent(sim, 'ROBOT FLIPPED — LIFTER OVERTURNED THE BULL!', 'impact');
        } else {
          addEvent(sim, 'LIFTER SCOOPED UNDER THE BULL', 'impact');
        }
      } else {
        // High-clearance frontal collision with The Bull's plow
        player.vx = -nx * 2.2;
        player.vz = -nz * 2.2;
        player.hullIntegrityPct = Math.max(0, player.hullIntegrityPct - 12);
        addEvent(sim, 'IMPACT — FRONT', 'warning');
      }
      sim.contactCooldownSec = 0.65;
      return;
    }

    // 3. HAMMER ENGAGEMENT (Strikes top deck, bypassing thick front plow!)
    if (wType === 'hammer') {
      sim.impactsDelivered++;
      sim.sparks.push({
        id: sim.nextSparkId++,
        x: midX,
        y: 0.45,
        z: midZ,
        color: '#38bdf8',
        intensity: 1.8,
        age: 0,
      });
      sim.cameraImpactShake = 0.55;

      // Top deck of The Bull has much thinner armor than its front plow!
      const overheadDmg = bullHitOnFront ? 22 : 30;
      bull.hullIntegrityPct = Math.max(0, bull.hullIntegrityPct - overheadDmg);
      bull.leftDriveHealthPct = Math.max(0, bull.leftDriveHealthPct - overheadDmg * 0.9);
      bull.rightDriveHealthPct = Math.max(0, bull.rightDriveHealthPct - overheadDmg * 0.85);
      sim.bullStunTimerSec = 0.6;
      addEvent(sim, 'OVERHEAD HAMMER STRIKE — TOP DECK HIT', 'impact');

      // Small recoil push separation
      bull.vx = nx * 1.6;
      bull.vz = nz * 1.6;
      player.vx = -nx * 1.1;
      player.vz = -nz * 1.1;
      sim.contactCooldownSec = 0.72;
      return;
    }

    // 4. GRABBER ENGAGEMENT
    if (wType === 'grabber') {
      sim.impactsDelivered++;
      if (!playerStats.wheelSlipLikely && playerStats.tractionCoeff >= 0.65) {
        player.isGrabbing = true;
        sim.grabTimerSec = 2.4;
        bull.hullIntegrityPct = Math.max(0, bull.hullIntegrityPct - 24);
        bull.leftDriveHealthPct = Math.max(0, bull.leftDriveHealthPct - 18);
        bull.rightDriveHealthPct = Math.max(0, bull.rightDriveHealthPct - 18);
        addEvent(sim, 'GRABBER CLAMPED THE BULL — DRAGGING TO WALL', 'impact');
      } else {
        // Grabbed briefly, but low traction means The Bull breaks free and shoves back
        bull.hullIntegrityPct = Math.max(0, bull.hullIntegrityPct - 8);
        player.vx = -nx * 2.1;
        player.vz = -nz * 2.1;
        player.hullIntegrityPct = Math.max(0, player.hullIntegrityPct - 11);
        addEvent(sim, 'LOW TRACTION — COULD NOT HOLD THE BULL', 'warning');
      }
      sim.contactCooldownSec = 0.65;
      return;
    }

    // 5. WEDGE OR PUSH BOT SHOVING CONTEST
    // Compare effective pushing advantage:
    // - Wedge low ground clearance + front deflection gives huge leverage against The Bull's charge
    // - Push Bot high pushingForceN (>165N) overpowers The Bull directly
    const wedgeUnderBonus =
      wType === 'wedge' && playerStats.groundClearanceInches <= 0.42 ? 32 : 14;
    const flankBonus = !bullHitOnFront ? 42 : 0;
    const playerEffectivePush =
      playerStats.pushingForceN + wedgeUnderBonus + flankBonus - (playerStats.wheelSlipLikely ? 28 : 0);
    const bullEffectivePush = bullStats.pushingForceN * (bull.leftDriveHealthPct / 100);

    sim.sparks.push({
      id: sim.nextSparkId++,
      x: midX,
      y: 0.2,
      z: midZ,
      color: '#f59e0b',
      intensity: 1.4,
      age: 0,
    });

    if (playerEffectivePush >= bullEffectivePush - 6) {
      // Player wins the wedge/push exchange! Shoves The Bull backward toward the arena wall!
      sim.impactsDelivered++;
      sim.playerPushTimeSec += 0.55;
      const shoveVel = 2.8 + (playerEffectivePush - bullEffectivePush) * 0.025;
      bull.vx = nx * shoveVel;
      bull.vz = nz * shoveVel;
      bull.pitchRad = -0.25;
      bull.hullIntegrityPct = Math.max(0, bull.hullIntegrityPct - (bullHitOnFront ? 11 : 19));
      bull.leftDriveHealthPct = Math.max(0, bull.leftDriveHealthPct - 12);
      bull.rightDriveHealthPct = Math.max(0, bull.rightDriveHealthPct - 11);
      sim.bullStunTimerSec = 0.5;
      addEvent(
        sim,
        !bullHitOnFront ? 'IMPACT — SIDE' : 'WEDGE DEFLECTED & DROVE BACK THE BULL',
        'impact'
      );
    } else {
      // Player lost the pushing contest (e.g. low traction / weak torque)
      sim.bullPushTimeSec += 0.55;
      player.vx = -nx * 2.9;
      player.vz = -nz * 2.9;
      const pushDmg = Math.max(8, 22 - playerEffectiveArmor * 0.12);
      player.hullIntegrityPct = Math.max(0, player.hullIntegrityPct - pushDmg);
      player.frontArmorPct = Math.max(0, player.frontArmorPct - pushDmg * 1.1);
      addEvent(sim, 'OUT-PUSHED BY THE BULL', 'warning');
    }
    sim.contactCooldownSec = 0.42;
    return;
  }

  // =========================================================================
  // CASE B: THE BULL RAMS PLAYER ON THE SIDE OR REAR (OR WITH WEAPON DOWN)
  // =========================================================================
  sim.bullPushTimeSec += 0.5;
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
  sim.cameraImpactShake = 0.7;

  const armorReduction = Math.max(0.45, playerEffectiveArmor / 78);
  const rawDamageToPlayer = (playerHitOnSide ? 24 : 18) / armorReduction;
  player.hullIntegrityPct = Math.max(0, player.hullIntegrityPct - rawDamageToPlayer);

  if (playerHitOnSide) {
    player.sideArmorPct = Math.max(0, player.sideArmorPct - rawDamageToPlayer * 1.3);
    if (!playerStats.wheelsProtected) {
      player.leftDriveHealthPct = Math.max(0, player.leftDriveHealthPct - rawDamageToPlayer * 1.25);
      if (player.leftDriveHealthPct < 55) {
        addEvent(sim, 'LEFT WHEEL DAMAGED', 'critical');
      }
    }
  } else {
    player.rearArmorPct = Math.max(0, player.rearArmorPct - rawDamageToPlayer * 1.2);
  }

  // Shove player away and check if high CoM / low stability causes player to flip!
  player.vx = -nx * 3.2;
  player.vz = -nz * 3.2;
  player.rollRad = playerHitOnSide ? 0.42 : 0.15;
  sim.playerStunTimerSec = 0.45;

  if (
    (playerStats.centerOfMassLabel === 'HIGH' || playerStats.stabilityScore < 48) &&
    sim.lateralImpactsTaken >= 2
  ) {
    player.isFlipped = true;
    addEvent(sim, 'ROBOT FLIPPED', 'critical');
  }

  sim.contactCooldownSec = 0.48;
  void dt;
}

function finishBattle(
  sim: LiveBattleSimulation,
  winner: 'player' | 'bull',
  reason: string
): void {
  sim.isFinished = true;
  sim.winner = winner;
  sim.winReason = reason;
  addEvent(
    sim,
    winner === 'player' ? 'BOSS DEFEATED!' : 'THE BULL WINS — MATCH TERMINATED',
    winner === 'player' ? 'info' : 'critical'
  );
}

export function generateBattleAnalysisReport(
  sim: LiveBattleSimulation
): BattleAnalysisReport {
  const { player, bull, playerStats, strategy } = sim;
  const winner = sim.winner ?? 'bull';

  const evidence: string[] = [];

  if (winner === 'player') {
    if (sim.flipsInflicted > 0) {
      evidence.push(
        `Your robot got underneath The Bull and overturned it (${sim.flipsInflicted} flip${sim.flipsInflicted > 1 ? 's' : ''}), exploiting its inability to self-right.`
      );
    }
    if (playerStats.weaponEnergyJ >= 1500 && sim.impactsDelivered > 0) {
      evidence.push(
        `Delivered ${sim.impactsDelivered} high-energy weapon impacts (${playerStats.weaponEnergyJ.toLocaleString()} J peak rating), rupturing The Bull's armor and drive pods.`
      );
    }
    if (sim.playerPushTimeSec > 1.2) {
      evidence.push(
        `Your drivetrain (${playerStats.pushingForceN} N pushing force, ${playerStats.tractionLabel} traction) controlled arena positioning and drove The Bull into the hazard walls.`
      );
    }
    if (evidence.length === 0) {
      evidence.push(
        `Your ${strategy.toUpperCase()} autonomous strategy and balanced subsystem durability outlasted The Bull's charges.`
      );
    }
  } else {
    // Detailed, non-prescriptive failure evidence
    if (sim.impactsDelivered > 0 && playerStats.weaponEnergyJ >= 1200) {
      evidence.push(
        `Your robot delivered ${sim.impactsDelivered} high-energy weapon impact${sim.impactsDelivered > 1 ? 's' : ''}, showing strong offensive potential.`
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
        `Exposed drive wheels sustained direct collision damage (Left drive at ${Math.round(player.leftDriveHealthPct)}%), reducing mobility and turning rate.`
      );
    }
    if (playerStats.wheelSlipLikely || playerStats.tractionLabel === 'LOW') {
      evidence.push(
        `Traction (${playerStats.tractionCoeff} μ) was insufficient to resist The Bull's 174 N pushing force, causing wheel slip during shoving engagements.`
      );
    }
    if (playerStats.powerLimited) {
      evidence.push(
        `Peak power demand (${playerStats.peakPowerDemandKw} kW) exceeded battery output (${playerStats.batteryPeakSupplyKw} kW), slowing weapon spin-up and acceleration.`
      );
    }
    if (sim.peakMotorTempC >= 85) {
      evidence.push(
        `High motor thermal load (${sim.peakMotorTempC}°C peak) triggered thermal throttling during sustained combat.`
      );
    }
    if (evidence.length === 0) {
      evidence.push(
        `The Bull's heavy frontal armor (122 pts) absorbed head-on engagement while its 174 N drivetrain controlled the center of the arena.`
      );
    }
  }

  return {
    winner,
    winReason: sim.winReason,
    durationSec: Number(sim.timeSec.toFixed(1)),
    strategyUsed: strategy,
    playerFinal: { ...player },
    bullFinal: { ...bull },
    playerStats,
    headlineSummary: sim.winReason,
    engineeringEvidence: evidence,
    majorEvents: sim.events.slice(0, 6).map((e) => `${e.timeSec.toFixed(1)}s — ${e.text}`),
    peakMotorTempC: sim.peakMotorTempC,
    impactsDelivered: sim.impactsDelivered,
    lateralImpactsTaken: sim.lateralImpactsTaken,
    flipsInflicted: sim.flipsInflicted,
    pushDominanceRatio:
      sim.playerPushTimeSec + sim.bullPushTimeSec > 0
        ? sim.playerPushTimeSec / (sim.playerPushTimeSec + sim.bullPushTimeSec)
        : 0.5,
  };
}

// Helper for running deterministic automated validation tests
export function runFullBattleHeadless(
  config: RobotConfiguration,
  strategy: AutonomousStrategy
): BattleAnalysisReport {
  const sim = createBattleSimulation(config, strategy);
  const dt = 1 / 60;
  let steps = 0;
  while (!sim.isFinished && steps < 60 * 45) {
    stepBattleSimulation(sim, dt);
    steps++;
  }
  return generateBattleAnalysisReport(sim);
}
