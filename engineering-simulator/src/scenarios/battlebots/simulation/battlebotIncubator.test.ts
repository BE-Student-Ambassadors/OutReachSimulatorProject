import { describe, expect, it } from 'vitest';
import { BOSS_LADDER } from '../data/bosses';
import { INITIAL_ROBOT_CONFIG } from '../data/components';
import { inventorAI } from '../services/inventorAI';
import { type BossId, type RobotConfiguration } from '../types/robot';
import {
  ARENA_HALF_SIZE,
  createBattleSimulation,
  runFullBattleHeadless,
  stepBattleSimulation,
} from './battleEngine';
import {
  type BoxCollider2D,
  getRobotCollisionModel,
  testOBBOBB,
  testWeaponChassisContact,
} from './collisionGeometry';
import { calculateEngineeringStats, computeInstallConsequences } from './engineering';

describe('BATTLEBOT INCUBATOR — Engineering & Autonomous Battle Validation', () => {
  it('calculates real-unit engineering metrics and updates when components change', () => {
    const baseStats = calculateEngineeringStats(INITIAL_ROBOT_CONFIG);
    expect(baseStats.totalWeightLb).toBeLessThanOrEqual(30.0);
    expect(baseStats.isOverweight).toBe(false);
    expect(baseStats.topSpeedMph).toBeGreaterThan(8);
    expect(baseStats.pushingForceN).toBeGreaterThan(50);

    // Equip Vertical Spinner and verify consequence delta
    const spinnerConfig: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      weaponId: 'vertical-spinner',
    };
    const spinnerStats = calculateEngineeringStats(spinnerConfig);
    expect(spinnerStats.totalWeightLb).toBeGreaterThan(baseStats.totalWeightLb);
    expect(spinnerStats.weaponEnergyJ).toBeGreaterThan(3000);
    expect(spinnerStats.runtimeSeconds).toBeLessThan(baseStats.runtimeSeconds);

    const deltas = computeInstallConsequences(baseStats, spinnerStats);
    expect(deltas.some((d) => d.label === 'WEIGHT')).toBe(true);
    expect(deltas.some((d) => d.label === 'WEAPON ENERGY')).toBe(true);
  });

  it('correctly detects overweight robots exceeding the 30.0 LB limit', () => {
    const heavyConfig: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      chassisId: 'wide',
      driveId: 'torque',
      wheelsId: 'tracks',
      armorId: 'steel',
      armorThickness: 'thick',
      weaponId: 'horizontal-spinner',
      batteryId: 'large',
      utilityId: 'weapon-guard',
    };
    const stats = calculateEngineeringStats(heavyConfig);
    expect(stats.totalWeightLb).toBeGreaterThan(30.0);
    expect(stats.isOverweight).toBe(true);
    expect(stats.overweightLb).toBeGreaterThan(0);
    expect(stats.warnings.some((w) => w.id === 'overweight')).toBe(true);
  });

  it('validates that 5 substantially different legal robot archetypes can defeat The Bull', () => {
    // 1. SPINNER BOT (Under 30 LB, high kinetic energy + balanced power/stability)
    const spinnerBot: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'UPPERCUT V1',
      chassisId: 'long',
      driveId: 'balanced',
      wheelsId: 'high-traction',
      armorId: 'polycarbonate',
      armorThickness: 'medium',
      weaponId: 'vertical-spinner',
      batteryId: 'large',
      utilityId: 'wheel-guards',
    };
    const spinnerStats = calculateEngineeringStats(spinnerBot);
    expect(spinnerStats.isOverweight).toBe(false);
    const spinnerBattle = runFullBattleHeadless(spinnerBot, 'aggressive');
    expect(spinnerBattle.winner).toBe('player');

    // 2. LIFTER BOT (Under 30 LB, low ground clearance + agile flanking/flipping)
    const lifterBot: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'FORKLIFT ZERO',
      chassisId: 'low-profile',
      driveId: 'speed',
      wheelsId: 'small',
      armorId: 'titanium',
      armorThickness: 'medium',
      weaponId: 'lifter',
      batteryId: 'medium',
      utilityId: 'wheel-guards',
    };
    const lifterStats = calculateEngineeringStats(lifterBot);
    expect(lifterStats.isOverweight).toBe(false);
    const lifterBattle = runFullBattleHeadless(lifterBot, 'aggressive');
    expect(lifterBattle.winner).toBe('player');
    expect(lifterBattle.flipsInflicted).toBeGreaterThanOrEqual(1);

    // 3. WEDGE BOT (Under 30 LB, ground-scraping low CoM deflection + strong pushing)
    const wedgeBot: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'ANVIL WEDGE',
      chassisId: 'low-profile',
      driveId: 'torque',
      wheelsId: 'high-traction',
      armorId: 'titanium',
      armorThickness: 'medium',
      weaponId: 'wedge',
      batteryId: 'medium',
      utilityId: 'traction-module',
    };
    const wedgeStats = calculateEngineeringStats(wedgeBot);
    expect(wedgeStats.isOverweight).toBe(false);
    const wedgeBattle = runFullBattleHeadless(wedgeBot, 'aggressive');
    expect(wedgeBattle.winner).toBe('player');

    // 4. HIGH-TRACTION PUSH BOT (Under 30 LB, Torque Drive + Tracks + Wide Stance)
    const pushBot: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'BULLDOZER PRIME',
      chassisId: 'wide',
      driveId: 'torque',
      wheelsId: 'tracks',
      armorId: 'aluminum',
      armorThickness: 'medium',
      weaponId: 'wedge',
      batteryId: 'medium',
      utilityId: 'traction-module',
    };
    const pushStats = calculateEngineeringStats(pushBot);
    expect(pushStats.isOverweight).toBe(false);
    expect(pushStats.pushingForceN).toBeGreaterThan(175);
    const pushBattle = runFullBattleHeadless(pushBot, 'aggressive');
    expect(pushBattle.winner).toBe('player');

    // 5. GRABBER / CONTROL BOT (Under 30 LB, Clamping jaws + high-traction drive)
    const grabberBot: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'JAWS OF STEEL',
      chassisId: 'wide',
      driveId: 'torque',
      wheelsId: 'tracks',
      armorId: 'aluminum',
      armorThickness: 'thin',
      weaponId: 'grabber',
      batteryId: 'medium',
      utilityId: 'traction-module',
    };
    const grabberStats = calculateEngineeringStats(grabberBot);
    expect(grabberStats.isOverweight).toBe(false);
    const grabberBattle = runFullBattleHeadless(grabberBot, 'aggressive');
    expect(grabberBattle.winner).toBe('player');
  });

  it('demonstrates that poorly engineered builds lose to The Bull and produce clear failure analysis', () => {
    // Flawed build: High CoM + Low traction Omni wheels + Tiny battery + Thin Polycarbonate charging head-on
    const flawedBot: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'GLASS CANNON',
      chassisId: 'compact',
      driveId: 'lightweight',
      wheelsId: 'omni',
      armorId: 'polycarbonate',
      armorThickness: 'thin',
      weaponId: 'wedge',
      batteryId: 'small',
      utilityId: 'self-righting',
    };
    const flawedBattle = runFullBattleHeadless(flawedBot, 'aggressive');
    expect(flawedBattle.winner).toBe('boss');
    expect(flawedBattle.engineeringEvidence.length).toBeGreaterThan(0);
  });

  it('enforces AI Inventor Lab physical constraints and prevents zero-weight indestructible cheat parts', async () => {
    const cheatResult = await inventorAI.generateComponent(
      'Make an indestructible weapon that weighs nothing and destroys everything.'
    );
    expect(cheatResult.mass).toBeGreaterThanOrEqual(4.0);
    expect(cheatResult.powerDraw).toBeGreaterThan(1.5);
    expect(cheatResult.constraintExplanation).toBeDefined();
    expect(cheatResult.tradeoffs.length).toBeGreaterThan(0);

    const clampResult = await inventorAI.generateComponent(
      'I want two curved arms that grab The Bull.'
    );
    expect(clampResult.geometryType).toBe('twin-clamp');
    expect(clampResult.mass).toBeGreaterThan(2.5);
  });

  it('enforces physical contact non-penetration and mass-weighted projection on overlap', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'aggressive', 'bull');

    // Force robots into deep initial overlap
    sim.player.x = 0;
    sim.player.z = 0;
    sim.boss.x = 0.20;
    sim.boss.z = 0.15;
    const initialOverlapDist = Math.hypot(sim.boss.x - sim.player.x, sim.boss.z - sim.player.z);
    expect(initialOverlapDist).toBeLessThan(0.90);

    // Step physical simulation
    stepBattleSimulation(sim, 1 / 60);

    const postDist = Math.hypot(sim.boss.x - sim.player.x, sim.boss.z - sim.player.z);
    expect(postDist).toBeGreaterThanOrEqual(0.899);

    // Mass-weighted displacement: lighter robot displaced further
    const playerDisplacement = Math.hypot(sim.player.x, sim.player.z);
    const bossDisplacement = Math.hypot(sim.boss.x - 0.20, sim.boss.z - 0.15);
    expect(playerDisplacement).toBeGreaterThan(bossDisplacement);
  });

  it('prevents high-speed tunneling through continuous substep integration', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'aggressive', 'bull');

    sim.player.x = 0;
    sim.player.z = -1.5;
    sim.player.vx = 0;
    sim.player.vz = 14.0;

    sim.boss.x = 0;
    sim.boss.z = 1.5;
    sim.boss.vx = 0;
    sim.boss.vz = -14.0;

    for (let f = 0; f < 10; f++) {
      stepBattleSimulation(sim, 1 / 60);
      const dist = Math.hypot(sim.boss.x - sim.player.x, sim.boss.z - sim.player.z);
      expect(dist).toBeGreaterThanOrEqual(0.89);
    }
  });

  it('enforces arena wall boundaries as solid impenetrable physical boundaries', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'aggressive', 'bull');

    sim.player.x = ARENA_HALF_SIZE + 5.0;
    sim.player.vx = 25.0;
    sim.boss.z = -ARENA_HALF_SIZE - 5.0;
    sim.boss.vz = -25.0;

    stepBattleSimulation(sim, 1 / 60);

    const rPlayer = 0.45;
    const rBoss = 0.45;
    expect(sim.player.x).toBeLessThanOrEqual(ARENA_HALF_SIZE - rPlayer + 0.001);
    expect(sim.player.x).toBeGreaterThanOrEqual(-ARENA_HALF_SIZE + rPlayer - 0.001);
    expect(sim.boss.z).toBeGreaterThanOrEqual(-ARENA_HALF_SIZE + rBoss - 0.001);
    expect(sim.boss.z).toBeLessThanOrEqual(ARENA_HALF_SIZE - rBoss + 0.001);
  });

  it('validates boss ladder structure, progression order, and engineering lessons across all 5 tiers', () => {
    expect(BOSS_LADDER.length).toBe(5);
    const expectedIds: BossId[] = ['bull', 'scorpion', 'cyclone', 'spider', 'titan'];
    expect(BOSS_LADDER.map((b) => b.id)).toEqual(expectedIds);

    for (let i = 0; i < BOSS_LADDER.length; i++) {
      const boss = BOSS_LADDER[i];
      expect(boss.tier).toBe(i + 1);
      expect(boss.name).toBeTruthy();
      expect(boss.engineeringLesson).toBeTruthy();
      expect(boss.strengths.length).toBeGreaterThan(0);
      expect(boss.vulnerabilities.length).toBeGreaterThan(0);
      expect(boss.stats.totalWeightLb).toBeGreaterThan(20);
      expect(boss.stats.frontArmorScore).toBeGreaterThan(0);
    }
  });

  it('validates multi-boss balance: every boss in the ladder has an exploitable vulnerability and can be defeated by a targeted legal build under 30.0 lbs', () => {
    // 01 THE BULL: Defeated by Vertical Spinner Uppercut (flips heavy pusher)
    const bullCounter: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'UPPERCUT PRIME',
      chassisId: 'long',
      driveId: 'balanced',
      wheelsId: 'high-traction',
      armorId: 'polycarbonate',
      armorThickness: 'medium',
      weaponId: 'vertical-spinner',
      batteryId: 'large',
      utilityId: 'wheel-guards',
    };
    expect(calculateEngineeringStats(bullCounter).isOverweight).toBe(false);
    const bullRes = runFullBattleHeadless(bullCounter, 'aggressive', 'bull');
    expect(bullRes.winner).toBe('player');

    // 02 THE SCORPION: Articulated grabber/lifter — countered by low ground clearance torque wedge with self-righting
    const scorpionCounter: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'SCORPION TAMER',
      chassisId: 'low-profile',
      driveId: 'torque',
      wheelsId: 'high-traction',
      armorId: 'titanium',
      armorThickness: 'medium',
      weaponId: 'wedge',
      batteryId: 'medium',
      utilityId: 'self-righting',
    };
    expect(calculateEngineeringStats(scorpionCounter).isOverweight).toBe(false);
    const scorpionRes = runFullBattleHeadless(scorpionCounter, 'aggressive', 'scorpion');
    expect(scorpionRes.winner).toBe('player');

    // 03 THE CYCLONE: 7500 J Kinetic ring spinner — countered by high-inertia steel armor wedge deflector
    const cycloneCounter: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'CYCLONE ANVIL',
      chassisId: 'compact',
      driveId: 'torque',
      wheelsId: 'high-traction',
      armorId: 'steel',
      armorThickness: 'medium',
      weaponId: 'wedge',
      batteryId: 'medium',
      utilityId: 'traction-module',
    };
    expect(calculateEngineeringStats(cycloneCounter).isOverweight).toBe(false);
    const cycloneRes = runFullBattleHeadless(cycloneCounter, 'aggressive', 'cyclone');
    expect(cycloneRes.winner).toBe('player');

    // 04 THE SPIDER: Omni-directional flanker — countered by high-traction torque pusher that exploits Spider's weak 68 N traction
    const spiderCounter: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'ARACHNID CRUSHER',
      chassisId: 'wide',
      driveId: 'torque',
      wheelsId: 'high-traction',
      armorId: 'aluminum',
      armorThickness: 'medium',
      weaponId: 'wedge',
      batteryId: 'medium',
      utilityId: 'traction-module',
    };
    expect(calculateEngineeringStats(spiderCounter).isOverweight).toBe(false);
    const spiderRes = runFullBattleHeadless(spiderCounter, 'aggressive', 'spider');
    expect(spiderRes.winner).toBe('player');

    // 05 THE TITAN: Heavy dreadnought — countered by high-efficiency low-profile agile lifter undercutting chassis
    const titanCounter: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'TITAN BUSTER',
      chassisId: 'low-profile',
      driveId: 'speed',
      wheelsId: 'small',
      armorId: 'titanium',
      armorThickness: 'medium',
      weaponId: 'lifter',
      batteryId: 'large',
      utilityId: 'extra-cooling',
    };
    expect(calculateEngineeringStats(titanCounter).isOverweight).toBe(false);
    const titanRes = runFullBattleHeadless(titanCounter, 'aggressive', 'titan');
    expect(titanRes.winner).toBe('player');
  });

  it('demonstrates that a single build cannot blindly counter all bosses (educational redesign requirement)', () => {
    const fragileSpinner: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'GLASS SPINNER',
      chassisId: 'compact',
      driveId: 'speed',
      wheelsId: 'small',
      armorId: 'polycarbonate',
      armorThickness: 'thin',
      weaponId: 'vertical-spinner',
      batteryId: 'small',
      utilityId: 'none',
    };

    const cycloneFight = runFullBattleHeadless(fragileSpinner, 'aggressive', 'cyclone');
    expect(cycloneFight.winner).toBe('boss');
    expect(cycloneFight.bossDossier?.id).toBe('cyclone');
    expect(cycloneFight.engineeringEvidence.length).toBeGreaterThan(0);
  });

  it('validates 2D Oriented Bounding Box (OBB) Separating Axis Theorem (SAT) collision math under rotations', () => {
    // Box A at origin, unrotated: halfExtents [0.5, 0.5]
    const boxA: BoxCollider2D = {
      center: [0, 0],
      halfExtents: [0.5, 0.5],
      rotationRad: 0,
      uX: [1, 0],
      uZ: [0, 1],
    };

    // Box B shifted right by 0.8m, overlapping along X axis
    const boxB: BoxCollider2D = {
      center: [0.8, 0],
      halfExtents: [0.5, 0.5],
      rotationRad: 0,
      uX: [1, 0],
      uZ: [0, 1],
    };

    const resAligned = testOBBOBB(boxA, boxB);
    expect(resAligned.overlap).toBe(true);
    expect(resAligned.penetration).toBeCloseTo(0.2, 2);
    expect(resAligned.normal[0]).toBeGreaterThan(0.9); // Normal points from A to B (+X)

    // Box B separated far to the right (no overlap)
    const boxBSeparated: BoxCollider2D = {
      ...boxB,
      center: [1.2, 0],
    };
    expect(testOBBOBB(boxA, boxBSeparated).overlap).toBe(false);

    // Box C rotated 45 degrees where corner penetrates Box A's edge
    const angle45 = Math.PI / 4;
    const cos45 = Math.cos(angle45);
    const sin45 = Math.sin(angle45);
    const boxCRotated: BoxCollider2D = {
      center: [0.85, 0],
      halfExtents: [0.5, 0.5],
      rotationRad: angle45,
      uX: [cos45, -sin45],
      uZ: [sin45, cos45],
    };
    const resRotated = testOBBOBB(boxA, boxCRotated);
    expect(resRotated.overlap).toBe(true);
    expect(resRotated.penetration).toBeGreaterThan(0);
  });

  it('verifies weapon contact regions extend beyond chassis dimensions according to visual specs', () => {
    // Compare player with Horizontal Spinner vs chassis boundaries
    const horizSpinnerConfig: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      chassisId: 'compact',
      weaponId: 'horizontal-spinner',
    };
    const model = getRobotCollisionModel(0, 0, 0, horizSpinnerConfig, null);

    // Weapon reach must extend forward beyond the front edge of the chassis
    const chassisFrontZ = model.chassis.center[1] + model.chassis.halfExtents[1];
    const weaponFrontZ = model.weapon.center[1] + model.weapon.halfExtents[1];
    expect(weaponFrontZ).toBeGreaterThan(chassisFrontZ);
    expect(model.weapon.reachDistance).toBeGreaterThan(model.chassis.halfExtents[1]);

    // An opponent placed in front intersects the weapon contact zone before intersecting the chassis
    const opponentBox: BoxCollider2D = {
      center: [0, weaponFrontZ - 0.05],
      halfExtents: [0.3, 0.3],
      rotationRad: 0,
      uX: [1, 0],
      uZ: [0, 1],
    };

    const weaponContact = testWeaponChassisContact(model.weapon, opponentBox);
    const chassisContact = testOBBOBB(model.chassis, opponentBox);

    expect(weaponContact.hit).toBe(true);
    expect(chassisContact.overlap).toBe(false);
  });

  it('resolves sustained pushing at low velocity without bounce-back cycles', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'aggressive', 'bull');

    // Place player and boss in direct frontal contact at low speed
    sim.player.x = 0;
    sim.player.z = 0.55;
    sim.player.headingRad = Math.PI; // Facing North (-Z)
    sim.player.vx = 0;
    sim.player.vz = -0.2;

    sim.boss.x = 0;
    sim.boss.z = -0.55;
    sim.boss.headingRad = 0; // Facing South (+Z)
    sim.boss.vx = 0;
    sim.boss.vz = 0.2;

    // Run 5 frames of simulation
    for (let f = 0; f < 5; f++) {
      stepBattleSimulation(sim, 1 / 60);
      // Verify velocity along normal does not violently bounce backwards (e.g. vz > +2 m/s or < -2 m/s)
      expect(Math.abs(sim.player.vz)).toBeLessThan(1.8);
      expect(Math.abs(sim.boss.vz)).toBeLessThan(1.8);
    }
  });

  it('provides a balanced learning curve against The Bull where beginner builds survive to teach engineering lessons', () => {
    // Beginner starter build fights The Bull
    const starterBattle = runFullBattleHeadless(INITIAL_ROBOT_CONFIG, 'aggressive', 'bull');
    // Beginner build should survive long enough for educational observation (at least 8s)
    expect(starterBattle.durationSec).toBeGreaterThanOrEqual(8.0);

    // Dedicated counter builds defeat The Bull
    const lifterCounter: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      name: 'FLIPPER COUNTER',
      chassisId: 'low-profile',
      driveId: 'torque',
      wheelsId: 'high-traction',
      armorId: 'titanium',
      armorThickness: 'medium',
      weaponId: 'lifter',
      batteryId: 'medium',
      utilityId: 'traction-module',
    };
    const counterBattle = runFullBattleHeadless(lifterCounter, 'aggressive', 'bull');
    expect(counterBattle.winner).toBe('player');
  });

  // =========================================================================
  // CANONICAL ROBOT ORIENTATION & KINEMATICS VERIFICATION SUITE
  // =========================================================================

  it('verifies robot at yaw 0 has the expected forward vector [0, 1] facing South (+Z)', () => {
    const heading = 0;
    const fwdX = Math.sin(heading);
    const fwdZ = Math.cos(heading);
    expect(fwdX).toBeCloseTo(0, 5);
    expect(fwdZ).toBeCloseTo(1, 5);

    // Verify derived collision model matches canonical forward vector
    const model = getRobotCollisionModel(0, 0, heading, INITIAL_ROBOT_CONFIG, null);
    expect(model.chassis.uZ[0]).toBeCloseTo(0, 5);
    expect(model.chassis.uZ[1]).toBeCloseTo(1, 5);
  });

  it('verifies yaw 90°, 180°, and 270° produce the expected cardinal directions (+X, -Z, -X)', () => {
    // 90 deg (pi/2) -> East (+X)
    const fwd90 = [Math.sin(Math.PI / 2), Math.cos(Math.PI / 2)];
    expect(fwd90[0]).toBeCloseTo(1, 5);
    expect(fwd90[1]).toBeCloseTo(0, 5);

    // 180 deg (pi) -> North (-Z)
    const fwd180 = [Math.sin(Math.PI), Math.cos(Math.PI)];
    expect(fwd180[0]).toBeCloseTo(0, 5);
    expect(fwd180[1]).toBeCloseTo(-1, 5);

    // 270 deg (-pi/2) -> West (-X)
    const fwd270 = [Math.sin(-Math.PI / 2), Math.cos(-Math.PI / 2)];
    expect(fwd270[0]).toBeCloseTo(-1, 5);
    expect(fwd270[1]).toBeCloseTo(0, 5);
  });

  it('verifies autonomous robot facing an opponent accelerates toward it', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'aggressive', 'bull');
    // Player at (0, 2.0) facing North (-Z) directly at Boss at (0, -2.0)
    sim.player.x = 0;
    sim.player.z = 2.0;
    sim.player.headingRad = Math.PI; // Forward = [0, -1]
    sim.player.vx = 0;
    sim.player.vz = 0;

    // Boss at (0, -2.0) facing South (+Z) directly at Player at (0, 2.0)
    sim.boss.x = 0;
    sim.boss.z = -2.0;
    sim.boss.headingRad = 0; // Forward = [0, 1]
    sim.boss.vx = 0;
    sim.boss.vz = 0;

    // Execute 1 frame of simulation
    stepBattleSimulation(sim, 1 / 60);

    // Player must accelerate toward Boss along -Z (vz < 0)
    expect(sim.player.vz).toBeLessThan(-0.1);
    expect(Math.abs(sim.player.vx)).toBeLessThan(0.05);

    // Boss must accelerate toward Player along +Z (vz > 0)
    expect(sim.boss.vz).toBeGreaterThan(0.1);
    expect(Math.abs(sim.boss.vx)).toBeLessThan(0.05);
  });

  it('verifies front weapon contact region lies in front of chassis across various yaw orientations', () => {
    const testAngles = [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2];
    for (const yaw of testAngles) {
      const model = getRobotCollisionModel(2.5, -1.5, yaw, INITIAL_ROBOT_CONFIG, null);
      const fwd = [Math.sin(yaw), Math.cos(yaw)];
      const deltaW = [
        model.weapon.center[0] - model.chassis.center[0],
        model.weapon.center[1] - model.chassis.center[1],
      ];
      // Weapon center must project positively along forward vector beyond chassis half-length
      const projForward = deltaW[0] * fwd[0] + deltaW[1] * fwd[1];
      expect(projForward).toBeGreaterThan(model.chassis.halfExtents[1]);
    }
  });

  it('verifies rear of robot does not trigger a front-weapon strike', () => {
    // Player facing North (heading = Math.PI) at arena origin (0, 0)
    const playerModel = getRobotCollisionModel(0, 0, Math.PI, INITIAL_ROBOT_CONFIG, null);

    // Place an obstacle directly behind the player at (0, 1.2) (South, behind the robot)
    const rearObstacle: BoxCollider2D = {
      center: [0, 1.2],
      halfExtents: [0.35, 0.35],
      rotationRad: 0,
      uX: [1, 0],
      uZ: [0, 1],
    };

    const weaponContact = testWeaponChassisContact(playerModel.weapon, rearObstacle);
    // Weapon is on the front (North, -Z), obstacle is at the rear (South, +Z)
    expect(weaponContact.hit).toBe(false);
  });

  it('verifies The Bull charges opponent front-first with horns/plow leading', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'aggressive', 'bull');
    sim.player.x = 0;
    sim.player.z = 1.3;
    sim.player.headingRad = Math.PI;

    sim.boss.x = 0;
    sim.boss.z = -1.3;
    sim.boss.headingRad = 0; // Facing South (+Z) directly at player
    sim.bossChargeCooldownSec = 0;
    sim.bossChargeActiveSec = 0;

    // Advance 1 frame to trigger Bull charging attack
    stepBattleSimulation(sim, 1 / 60);

    // Verify Bull initiates charge attack
    expect(sim.bossChargeActiveSec).toBeGreaterThan(0);
    // Velocity must be positive along Z (heading straight toward Player at +Z)
    expect(sim.boss.vz).toBeGreaterThan(0.2);

    // Verify Bull's horns/plow weapon contact zone is physically situated in front of its chassis
    const bullModel = getRobotCollisionModel(sim.boss.x, sim.boss.z, sim.boss.headingRad, sim.bossDossier.config, 'bull');
    expect(bullModel.weapon.center[1]).toBeGreaterThan(bullModel.chassis.center[1]);
    expect(bullModel.weapon.reachDistance).toBeGreaterThan(bullModel.chassis.halfExtents[1]);
  });

  describe('DETERMINISTIC 8-DIRECTION AUTONOMOUS ORIENTATION VALIDATION', () => {
    // 4 Cardinal directions + 4 Diagonals
    const DIRECTIONS = [
      { name: 'North', playerPos: [0, 2.5] as [number, number], oppPos: [0, -2.5] as [number, number], yaw: Math.PI },
      { name: 'South', playerPos: [0, -2.5] as [number, number], oppPos: [0, 2.5] as [number, number], yaw: 0 },
      { name: 'East',  playerPos: [-2.5, 0] as [number, number], oppPos: [2.5, 0] as [number, number], yaw: Math.PI / 2 },
      { name: 'West',  playerPos: [2.5, 0] as [number, number], oppPos: [-2.5, 0] as [number, number], yaw: -Math.PI / 2 },
      { name: 'Northeast', playerPos: [-1.8, 1.8] as [number, number], oppPos: [1.8, -1.8] as [number, number], yaw: (3 * Math.PI) / 4 },
      { name: 'Northwest', playerPos: [1.8, 1.8] as [number, number], oppPos: [-1.8, -1.8] as [number, number], yaw: -(3 * Math.PI) / 4 },
      { name: 'Southeast', playerPos: [-1.8, -1.8] as [number, number], oppPos: [1.8, 1.8] as [number, number], yaw: Math.PI / 4 },
      { name: 'Southwest', playerPos: [1.8, -1.8] as [number, number], oppPos: [-1.8, 1.8] as [number, number], yaw: -Math.PI / 4 },
    ];

    it('verifies PLAYER facing opponent maintains heading, has ~0° steering error, and closes distance in all 8 directions', () => {
      // Test with both standard wedge and vertical spinner (where needsSpinUp applies)
      const testConfigs = [
        { label: 'Wedge Bot', config: INITIAL_ROBOT_CONFIG },
        { label: 'Spinner Bot', config: { ...INITIAL_ROBOT_CONFIG, weaponId: 'vertical-spinner' as const } },
      ];

      for (const { label, config } of testConfigs) {
        for (const dir of DIRECTIONS) {
          const sim = createBattleSimulation(config, 'aggressive', 'bull');
          sim.player.x = dir.playerPos[0];
          sim.player.z = dir.playerPos[1];
          sim.player.headingRad = dir.yaw;
          sim.player.vx = 0;
          sim.player.vz = 0;

          sim.boss.x = dir.oppPos[0];
          sim.boss.z = dir.oppPos[1];
          sim.boss.headingRad = 0; // Boss orientation arbitrary for player test
          sim.boss.vx = 0;
          sim.boss.vz = 0;

          const initialDist = Math.hypot(dir.oppPos[0] - dir.playerPos[0], dir.oppPos[1] - dir.playerPos[1]);

          // Execute first simulation step
          stepBattleSimulation(sim, 1 / 60);

          // 1. Heading error should be approximately 0°: robot does NOT turn around
          const yawChange = Math.abs(sim.player.headingRad - dir.yaw);
          expect(yawChange, `${label} facing ${dir.name} turned unexpectedly`).toBeLessThan(0.05);

          // 2. Velocity dot product with unit vector to opponent should be positive
          const toOppX = (dir.oppPos[0] - sim.player.x) / initialDist;
          const toOppZ = (dir.oppPos[1] - sim.player.z) / initialDist;
          const velocityTowardOpp = sim.player.vx * toOppX + sim.player.vz * toOppZ;
          expect(velocityTowardOpp, `${label} facing ${dir.name} velocity not moving toward opponent`).toBeGreaterThan(0.05);

          // 3. Distance to opponent should strictly decrease
          const newDist = Math.hypot(sim.boss.x - sim.player.x, sim.boss.z - sim.player.z);
          expect(newDist, `${label} facing ${dir.name} distance did not decrease`).toBeLessThan(initialDist);
        }
      }
    });

    it('verifies ALL BOSSES facing opponent maintain heading, have ~0° steering error, and close distance in all 8 directions', () => {
      const bossIds: BossId[] = ['bull', 'scorpion', 'cyclone', 'spider', 'titan'];

      for (const bossId of bossIds) {
        for (const dir of DIRECTIONS) {
          const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'aggressive', bossId);
          // Set Boss at dir.playerPos facing dir.yaw toward Player at dir.oppPos
          sim.boss.x = dir.playerPos[0];
          sim.boss.z = dir.playerPos[1];
          sim.boss.headingRad = dir.yaw;
          sim.boss.vx = 0;
          sim.boss.vz = 0;
          sim.bossChargeCooldownSec = 0;
          sim.bossChargeActiveSec = 0;

          sim.player.x = dir.oppPos[0];
          sim.player.z = dir.oppPos[1];
          sim.player.headingRad = 0;
          sim.player.vx = 0;
          sim.player.vz = 0;

          const initialDist = Math.hypot(dir.oppPos[0] - dir.playerPos[0], dir.oppPos[1] - dir.playerPos[1]);

          // Execute first simulation step
          stepBattleSimulation(sim, 1 / 60);

          // 1. Heading error should be approximately 0°: boss does NOT turn around
          const yawChange = Math.abs(sim.boss.headingRad - dir.yaw);
          expect(yawChange, `Boss ${bossId} facing ${dir.name} turned unexpectedly`).toBeLessThan(0.05);

          // 2. Velocity dot product with unit vector to opponent should be positive
          const toOppX = (dir.oppPos[0] - sim.boss.x) / initialDist;
          const toOppZ = (dir.oppPos[1] - sim.boss.z) / initialDist;
          const velocityTowardOpp = sim.boss.vx * toOppX + sim.boss.vz * toOppZ;
          expect(velocityTowardOpp, `Boss ${bossId} facing ${dir.name} velocity not moving toward opponent`).toBeGreaterThan(0.05);

          // 3. Distance to opponent should strictly decrease
          const newDist = Math.hypot(sim.boss.x - sim.player.x, sim.boss.z - sim.player.z);
          expect(newDist, `Boss ${bossId} facing ${dir.name} distance did not decrease`).toBeLessThan(initialDist);
        }
      }
    });
  });
});

