import { describe, expect, it } from 'vitest';
import { INITIAL_ROBOT_CONFIG } from '../data/components';
import { type RobotConfiguration } from '../types/robot';
import {
  createBattleSimulation,
  stepBattleSimulation,
  createCombatImpactEvent,
  ARENA_HALF_SIZE,
} from './battleEngine';

describe('BATTLEBOT COMBAT IMPACTS & GAME FEEL SYSTEM', () => {
  it('derives authoritative ImpactEvent severity and synchronized feedback values', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');

    // 1. Tiny bump (low velocity, low impulse)
    const tinyEvent = createCombatImpactEvent(
      sim,
      [0, 0],
      [0, 1],
      0.8,
      15,
      'chassis',
      'player',
      'boss',
      0
    );
    expect(tinyEvent.severity).toBe('tiny');
    expect(tinyEvent.hitstopMs).toBe(0);
    expect(sim.player.impactFlashIntensity).toBe(0);

    // 2. Normal collision
    const normalEvent = createCombatImpactEvent(
      sim,
      [0, 0],
      [0, 1],
      2.2,
      75,
      'chassis',
      'player',
      'boss',
      0
    );
    expect(normalEvent.severity).toBe('normal');
    expect(normalEvent.severity01).toBeGreaterThanOrEqual(0.16);
    expect(sim.boss.impactFlashIntensity).toBeGreaterThan(0.2);

    // 3. Heavy weapon impact
    const heavyEvent = createCombatImpactEvent(
      sim,
      [0, 0],
      [0, 1],
      4.2,
      130,
      'weapon',
      'player',
      'boss',
      1200
    );
    expect(heavyEvent.severity).toBe('heavy');
    expect(heavyEvent.hitstopMs).toBeGreaterThanOrEqual(15);
    expect(sim.boss.impactFlashIntensity).toBeGreaterThanOrEqual(0.7);

    // 4. Major weapon impact
    const majorEvent = createCombatImpactEvent(
      sim,
      [0, 0],
      [0, 1],
      6.5,
      190,
      'weapon',
      'player',
      'boss',
      2400
    );
    expect(majorEvent.severity).toBe('major');
    expect(majorEvent.hitstopMs).toBeGreaterThanOrEqual(40);
    expect(sim.boss.impactFlashIntensity).toBe(1.0);
    expect(sim.cameraImpactShake).toBeGreaterThanOrEqual(0.8);
    // Verified debris flecks generated for major impacts
    expect(sim.sparks.some((s) => s.isDebris)).toBe(true);
  });

  it('generates angular yaw rotation on off-center impacts and pure translation on centered impacts', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');

    // Center hit: both robots aligned along z-axis, contact at x=0
    sim.player.x = 0;
    sim.player.z = 1.0;
    sim.boss.x = 0;
    sim.boss.z = 1.6;
    sim.player.vx = 0;
    sim.player.vz = 2.5;
    sim.boss.vx = 0;
    sim.boss.vz = -2.5;

    stepBattleSimulation(sim, 0.02);
    // Head-on hit near centerline produces minimal/near-zero yaw rotation
    expect(Math.abs(sim.player.angularVelocityRad)).toBeLessThan(1.5);

    // Corner/off-center strike: offset robot along x-axis
    const simOffCenter = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');
    simOffCenter.player.x = -0.35; // corner offset
    simOffCenter.player.z = 1.0;
    simOffCenter.boss.x = 0.35;
    simOffCenter.boss.z = 1.5;
    simOffCenter.player.vx = 0;
    simOffCenter.player.vz = 3.5;
    simOffCenter.boss.vx = 0;
    simOffCenter.boss.vz = -3.5;

    stepBattleSimulation(simOffCenter, 0.02);
    // Off-center contact torque imparts noticeable angular yaw velocity
    expect(Math.abs(simOffCenter.player.angularVelocityRad)).toBeGreaterThan(0.5);
  });

  it('triggers traction break and skidding on strong lateral impacts', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');
    sim.bossStunTimerSec = 1.0;
    sim.playerStunTimerSec = 1.0;
    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.headingRad = 0;

    sim.boss.x = 0.55;
    sim.boss.z = 0;
    sim.boss.headingRad = -Math.PI / 2;
    sim.boss.vx = -4.5;
    sim.boss.vz = 0;

    stepBattleSimulation(sim, 0.02);
    expect(sim.player.tractionBreakTimerSec).toBeGreaterThan(0);
    expect(Math.abs(sim.player.skidVx)).toBeGreaterThan(0.4);
  });

  it('high-traction wheels recover grip faster than low-traction wheels', () => {
    const highTractionConfig: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      wheelsId: 'high-traction',
    };
    const lowTractionConfig: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      wheelsId: 'omni',
    };

    const simHigh = createBattleSimulation(highTractionConfig, 'control', 'bull');
    const simLow = createBattleSimulation(lowTractionConfig, 'control', 'bull');

    simHigh.player.tractionBreakTimerSec = 0.35;
    simHigh.player.skidVx = 2.0;
    simLow.player.tractionBreakTimerSec = 0.35;
    simLow.player.skidVx = 2.0;

    // Step 0.15s
    for (let i = 0; i < 8; i++) {
      stepBattleSimulation(simHigh, 0.02);
      stepBattleSimulation(simLow, 0.02);
    }

    // High traction wheels decay skid velocity faster
    expect(Math.abs(simHigh.player.skidVx)).toBeLessThan(Math.abs(simLow.player.skidVx));
  });

  it('produces physical weapon recoil on the attacking robot', () => {
    const spinnerConfig: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      weaponId: 'vertical-spinner',
    };
    const sim = createBattleSimulation(spinnerConfig, 'aggressive', 'bull');
    sim.player.weaponSpinPct = 95;
    sim.player.x = 0;
    sim.player.z = 0.6;
    sim.boss.x = 0;
    sim.boss.z = 0;
    sim.player.vx = 0;
    sim.player.vz = -2.0;

    stepBattleSimulation(sim, 0.02);

    // Striking boss front plow produces substantial backward recoil on player
    expect(sim.player.vz).toBeGreaterThan(1.0); // recoils in +z (backward)
  });

  it('executes wall collisions with physical rebound and damage at high speeds', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');
    sim.playerStunTimerSec = 1.0;
    sim.player.x = ARENA_HALF_SIZE - 0.45;
    sim.player.vx = 4.2; // flying into east wall

    const initialHull = sim.player.hullIntegrityPct;
    stepBattleSimulation(sim, 0.02);

    // Rebounds backward with reversed velocity
    expect(sim.player.vx).toBeLessThan(0);
    // High-speed wall impact applies structural damage
    expect(sim.player.hullIntegrityPct).toBeLessThan(initialHull);
    // Wall impact event was emitted
    expect(sim.recentImpactEvents.some((e) => e.type === 'wall')).toBe(true);
  });

  it('applies localized progressive damage based on struck sector', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');
    sim.bossStunTimerSec = 1.0;
    sim.playerStunTimerSec = 1.0;

    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.headingRad = 0; // facing +Z South

    sim.boss.x = 0.55;
    sim.boss.z = 0;
    sim.boss.headingRad = -Math.PI / 2; // facing -X into player's left flank
    sim.boss.vx = -4.5;
    sim.boss.vz = 0;

    const initSide = sim.player.sideArmorPct;
    stepBattleSimulation(sim, 0.02);

    // Side armor sustained damage while front armor remained intact
    expect(sim.player.sideArmorPct).toBeLessThan(initSide);
    expect(sim.player.frontArmorPct).toBe(100);
  });

  it('prevents repeated-contact damage and feedback spam across continuous touching frames', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');
    sim.player.x = 0;
    sim.player.z = 0.5;
    sim.boss.x = 0;
    sim.boss.z = 1.0;
    sim.player.vx = 0;
    sim.player.vz = 0.2;
    sim.boss.vx = 0;
    sim.boss.vz = -0.2;

    // First frame of pushing contact
    stepBattleSimulation(sim, 0.02);
    const initialEvents = sim.recentImpactEvents.length;

    // Sustained pushing contact over 10 consecutive ticks
    for (let i = 0; i < 10; i++) {
      stepBattleSimulation(sim, 0.02);
    }

    // Zero new impact events or flash spam while smoothly pushing
    expect(sim.recentImpactEvents.length).toBe(initialEvents);
  });

  it('ensures The Bull uses the exact same physical reaction, damage, and flash pipeline as the player', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');

    // Force high energy hit on Bull
    sim.player.weaponSpinPct = 90;
    createCombatImpactEvent(sim, [0, 0], [0, 1], 4.5, 150, 'weapon', 'player', 'boss', 1800);

    // Bull receives impact flash intensity just like player
    expect(sim.boss.impactFlashIntensity).toBeGreaterThanOrEqual(0.7);
    // Camera shake triggered
    expect(sim.cameraImpactShake).toBeGreaterThan(0.4);
  });

  it('produces dramatic linear separation and visible recoil on full-speed spinner hits', () => {
    const spinnerConfig: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      weaponId: 'horizontal-spinner',
    };
    const sim = createBattleSimulation(spinnerConfig, 'control', 'bull');
    sim.player.weaponSpinPct = 100;
    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.headingRad = 0; // facing +z
    sim.boss.x = 0;
    sim.boss.z = 0.55;
    sim.boss.headingRad = Math.PI; // facing -z

    const initialDistance = Math.hypot(sim.player.x - sim.boss.x, sim.player.z - sim.boss.z);

    // Initial impact frame
    stepBattleSimulation(sim, 0.02);

    // Immediate recoil on attacker and knockback on target
    expect(sim.player.vz).toBeLessThan(-2.0); // Recoil backwards
    expect(sim.boss.vz).toBeGreaterThan(4.0);  // Knockback forwards (+z)

    // Simulate 300ms (15 frames) of physical motion
    const bossStartZ = sim.boss.z;
    const playerStartZ = sim.player.z;
    for (let f = 0; f < 15; f++) {
      stepBattleSimulation(sim, 0.02);
    }

    const bossTravelDistance = Math.abs(sim.boss.z - bossStartZ);
    const playerRecoilDistance = Math.abs(sim.player.z - playerStartZ);
    const finalDistance = Math.hypot(sim.player.x - sim.boss.x, sim.player.z - sim.boss.z);

    // Target (The Bull) travels ~2 to 5 robot lengths (~1.5m to 4m+)
    expect(bossTravelDistance).toBeGreaterThanOrEqual(1.8);
    // Attacker (Player) recoils ~0.5 to 1.5 robot lengths (~0.5m to 1.5m)
    expect(playerRecoilDistance).toBeGreaterThanOrEqual(0.4);
    // Separation space opens up dramatically between the two robots
    expect(finalDistance).toBeGreaterThan(initialDistance + 1.2);
  });

  it('produces massive yaw rotation (30° to 180°+) and skidding on off-center corner strikes', () => {
    const spinnerConfig: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      weaponId: 'horizontal-spinner',
    };
    const sim = createBattleSimulation(spinnerConfig, 'control', 'bull');
    sim.player.weaponSpinPct = 100;
    sim.player.x = 0.28; // offset to strike Bull's front-right corner
    sim.player.z = 0;
    sim.player.headingRad = 0;
    sim.boss.x = 0;
    sim.boss.z = 0.55;
    sim.boss.headingRad = Math.PI;

    const initialHeading = sim.boss.headingRad;

    // Trigger corner strike
    stepBattleSimulation(sim, 0.02);

    // Substantial angular velocity imparted to Bull
    expect(Math.abs(sim.boss.angularVelocityRad)).toBeGreaterThan(4.0);
    // Traction break engaged
    expect(sim.boss.tractionBreakTimerSec).toBeGreaterThanOrEqual(0.25);

    // Simulate 300ms of spinning and sliding
    let maxHeadingDelta = 0;
    for (let f = 0; f < 15; f++) {
      stepBattleSimulation(sim, 0.02);
      const delta = Math.abs(sim.boss.headingRad - initialHeading);
      if (delta > maxHeadingDelta) maxHeadingDelta = delta;
    }

    // Bull rotates substantially: at least 35° (0.61 rad) and up to 180°+
    expect(maxHeadingDelta).toBeGreaterThanOrEqual(0.61);
  });

  it('physically lifts player front wheels and destabilizes steering when Bull charges with wedge', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');

    // Place Bull charging toward player at high speed
    sim.boss.x = 0;
    sim.boss.z = 1.0;
    sim.boss.headingRad = Math.PI; // Facing North (-z)
    sim.boss.vz = -4.2;
    sim.bossChargeActiveSec = 1.0;

    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.headingRad = 0; // Facing South (+z)
    sim.player.vz = 0.5;

    stepBattleSimulation(sim, 0.02);

    // Front wheels lift: pitch angle tilts up significantly (> 0.40 rad)
    expect(sim.player.pitchRad).toBeGreaterThanOrEqual(0.40);
    // Player traction is broken / front wheels in the air
    expect(sim.player.tractionBreakTimerSec).toBeGreaterThan(0.20);
  });

  it('drives The Bull through an active combat rhythm (charge, impact, disengage/reposition)', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');

    // Place close to trigger combat engagement
    sim.boss.x = 0;
    sim.boss.z = 0.6;
    sim.boss.vz = -3.0;
    sim.player.x = 0;
    sim.player.z = 0;

    stepBattleSimulation(sim, 0.02);

    // After collision, Bull transitions to REPOSITION
    expect(sim.boss.aiStateLabel).toBe('REPOSITION');
    expect(sim.bossRepositionTimerSec).toBeGreaterThan(0);

    // Bull reverses backward to create space
    const bossZBefore = sim.boss.z;
    for (let f = 0; f < 10; f++) {
      stepBattleSimulation(sim, 0.02);
    }
    // Bull backs away toward +Z
    expect(sim.boss.z).toBeGreaterThanOrEqual(bossZBefore);
  });

  it('populates authoritative live debug impact telemetry fields in CombatImpactEvent', () => {
    const spinnerConfig: RobotConfiguration = {
      ...INITIAL_ROBOT_CONFIG,
      weaponId: 'horizontal-spinner',
    };
    const sim = createBattleSimulation(spinnerConfig, 'control', 'bull');
    sim.player.weaponSpinPct = 100;
    sim.player.x = 0.2;
    sim.player.z = 0;
    sim.player.headingRad = 0;
    sim.boss.x = 0;
    sim.boss.z = 0.55;
    sim.boss.headingRad = Math.PI;

    stepBattleSimulation(sim, 0.02);

    const imp = sim.lastImpactEvent;
    expect(imp).toBeDefined();
    expect(imp?.targetDeltaV).toBeGreaterThan(0);
    expect(imp?.targetDeltaOmega).toBeGreaterThanOrEqual(0);
    expect(imp?.tractionBreakDurationSec).toBeGreaterThan(0);
    expect(imp?.severity).toMatch(/^(heavy|major)$/);
  });

  describe('THE BULL MULTI-OUTCOME WEDGE DYNAMICS (PROMPT SECTION 18)', () => {
    // TEST 1: Bull fast, player nearly stationary
    it('TEST 1: Bull fast, player nearly stationary gives Bull advantage with plausible lift/knockback', () => {
      const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');
      sim.boss.x = 0;
      sim.boss.z = 0.8;
      sim.boss.headingRad = Math.PI; // Facing -z into Player
      sim.boss.vz = -4.0;
      sim.bossChargeActiveSec = 1.0;

      sim.player.x = 0;
      sim.player.z = 0;
      sim.player.headingRad = 0;
      sim.player.vz = 0.1; // Nearly stationary

      stepBattleSimulation(sim, 0.02);

      expect(sim.lastWedgeTelemetry).toBeDefined();
      expect(sim.lastWedgeTelemetry?.outcome).toMatch(/^(FLIP|NORMAL_SEPARATION)$/);
      expect(sim.player.pitchRad).toBeGreaterThanOrEqual(0.40);
      expect(sim.player.vz).toBeLessThan(0); // Knocked backward along Bull's charge
    });

    // TEST 2: Player fast, Bull slower
    it('TEST 2: Player fast, Bull slower allows player momentum to climb and ramp across Bull to behind', () => {
      const stableConfig: RobotConfiguration = {
        ...INITIAL_ROBOT_CONFIG,
        chassisId: 'wide',
        wheelsId: 'high-traction',
        weaponId: 'wedge',
      };
      const sim = createBattleSimulation(stableConfig, 'control', 'bull');
      sim.player.x = 0;
      sim.player.z = 0;
      sim.player.headingRad = 0; // Facing +z into Bull
      sim.player.vz = 3.6; // High forward momentum

      sim.boss.x = 0;
      sim.boss.z = 0.7;
      sim.boss.headingRad = Math.PI; // Facing -z into Player
      sim.boss.vz = -0.6; // Slower

      stepBattleSimulation(sim, 0.02);

      expect(sim.lastWedgeTelemetry?.outcome).toBe('RIDE_OVER');
      expect(sim.wedgePhase).toBe('riding');
      expect(sim.player.pitchRad).toBeGreaterThan(0.30);
      expect(sim.player.isFlipped).toBe(false);

      // Simulate traversal across Bull's top deck
      for (let f = 0; f < 25; f++) {
        stepBattleSimulation(sim, 0.02);
      }

      // Player clears the rear of Bull and lands behind Bull
      expect(sim.player.z).toBeGreaterThan(sim.boss.z);
      expect(sim.player.isFlipped).toBe(false);
    });

    // TEST 3: Both moving fast head-on
    it('TEST 3: Both moving fast head-on produces large dynamic collision governed by momentum', () => {
      const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');
      sim.player.x = 0;
      sim.player.z = 0;
      sim.player.headingRad = 0;
      sim.player.vz = 3.2;

      sim.boss.x = 0;
      sim.boss.z = 0.7;
      sim.boss.headingRad = Math.PI;
      sim.boss.vz = -3.8;
      sim.bossChargeActiveSec = 1.0;

      stepBattleSimulation(sim, 0.02);

      expect(sim.lastWedgeTelemetry).toBeDefined();
      expect(sim.lastWedgeTelemetry!.relativeClosingSpeed).toBeGreaterThan(6.0);
      expect(sim.lastImpactEvent?.impulse).toBeGreaterThanOrEqual(45);
    });

    // TEST 4: Player hits wedge at ~30–45°
    it('TEST 4: Player hits wedge at an angle (30-45°) producing side deflection and pronounced yaw', () => {
      const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');
      sim.player.x = 0.25;
      sim.player.z = 0;
      sim.player.headingRad = 0.65; // ~37° angle
      sim.player.vx = 1.5;
      sim.player.vz = 2.4;

      sim.boss.x = 0;
      sim.boss.z = 0.7;
      sim.boss.headingRad = Math.PI;
      sim.boss.vz = -2.2;

      stepBattleSimulation(sim, 0.02);

      expect(sim.lastWedgeTelemetry?.outcome).toBe('SIDE_DEFLECTION');
      expect(Math.abs(sim.player.angularVelocityRad)).toBeGreaterThan(4.0);
      expect(Math.abs(sim.player.vx)).toBeGreaterThan(0.6);
      expect(sim.player.isFlipped).toBe(false);
    });

    // TEST 5: Player spinner active while Bull lifts player
    it('TEST 5: Player active spinner during wedge engagement triggers legitimate kinetic weapon counter', () => {
      const spinnerConfig: RobotConfiguration = {
        ...INITIAL_ROBOT_CONFIG,
        weaponId: 'horizontal-spinner',
      };
      const sim = createBattleSimulation(spinnerConfig, 'control', 'bull');
      sim.player.weaponSpinPct = 100;
      sim.player.x = 0;
      sim.player.z = 0;
      sim.player.headingRad = 0;
      sim.player.vz = 1.2;

      sim.boss.x = 0;
      sim.boss.z = 0.7;
      sim.boss.headingRad = Math.PI;
      sim.boss.vz = -3.0;

      stepBattleSimulation(sim, 0.02);

      expect(sim.lastWedgeTelemetry?.outcome).toBe('WEAPON_COUNTER');
      expect(sim.boss.hullIntegrityPct).toBeLessThan(100); // Bull takes direct kinetic damage
      expect(sim.boss.vz).toBeGreaterThan(2.0); // Bull knocked backward
      expect(sim.player.vz).toBeLessThan(0); // Player recoils backward
      expect(sim.player.isFlipped).toBe(false); // Player remains on wheels!
      expect(sim.lastImpactEvent?.type).toBe('weapon');
    });

    // TEST 6: Low/stable robot vs wedge
    it('TEST 6: Low/stable robot resists flipping against Bull charge', () => {
      const lowStableConfig: RobotConfiguration = {
        ...INITIAL_ROBOT_CONFIG,
        chassisId: 'wide',
        wheelsId: 'high-traction',
        weaponId: 'wedge',
      };
      const sim = createBattleSimulation(lowStableConfig, 'control', 'bull');
      expect(sim.playerStats.stabilityScore).toBeGreaterThanOrEqual(45);
      expect(sim.playerStats.centerOfMassLabel).not.toBe('HIGH');

      sim.player.x = 0;
      sim.player.z = 0;
      sim.player.headingRad = 0;
      sim.player.vz = 0.2;

      sim.boss.x = 0;
      sim.boss.z = 0.7;
      sim.boss.headingRad = Math.PI;
      sim.boss.vz = -3.4;

      stepBattleSimulation(sim, 0.02);

      expect(sim.player.isFlipped).toBe(false);
      expect(sim.lastWedgeTelemetry?.outcome).not.toBe('FLIP');
    });

    // TEST 7: Higher-CoM robot vs wedge
    it('TEST 7: Higher-CoM / lower-stability robot is susceptible to flip on Bull high-speed charge', () => {
      const highCoMConfig: RobotConfiguration = {
        ...INITIAL_ROBOT_CONFIG,
        chassisId: 'compact',
        wheelsId: 'large',
        armorThickness: 'thick',
        weaponId: 'hammer',
      };
      const sim = createBattleSimulation(highCoMConfig, 'control', 'bull');
      // Verify robot has higher CoM or lower stability threshold
      expect(sim.playerStats.stabilityScore < 45 || sim.playerStats.centerOfMassLabel === 'HIGH').toBe(true);

      sim.player.x = 0;
      sim.player.z = 0;
      sim.player.headingRad = 0;
      sim.player.vz = 0.2;

      sim.boss.x = 0;
      sim.boss.z = 0.7;
      sim.boss.headingRad = Math.PI;
      sim.boss.vz = -4.2;
      sim.bossChargeActiveSec = 1.0;

      stepBattleSimulation(sim, 0.02);

      expect(sim.lastWedgeTelemetry?.outcome).toBe('FLIP');
      expect(sim.player.isFlipped).toBe(true);
      expect(sim.flipsInflicted).toBeGreaterThan(0);
    });

    // TEST 8: Repeated sustained wedge contact
    it('TEST 8: Repeated sustained wedge contact does NOT repeatedly apply full pitch impulses or cause guaranteed flips', () => {
      const stableConfig: RobotConfiguration = {
        ...INITIAL_ROBOT_CONFIG,
        chassisId: 'wide',
        wheelsId: 'high-traction',
        weaponId: 'wedge',
      };
      const sim = createBattleSimulation(stableConfig, 'control', 'bull');
      sim.player.x = 0;
      sim.player.z = 0;
      sim.player.headingRad = 0;
      sim.player.vz = 0.5;

      sim.boss.x = 0;
      sim.boss.z = 0.65;
      sim.boss.headingRad = Math.PI;
      sim.boss.vz = -0.5;

      const pitchHistory: number[] = [];
      for (let f = 0; f < 20; f++) {
        stepBattleSimulation(sim, 0.02);
        pitchHistory.push(sim.player.pitchRad);
      }

      // Robot does NOT flip automatically from continuous frame accumulation
      expect(sim.player.isFlipped).toBe(false);

      // Pitch does not continuously grow to extreme values (> 1.2 rad)
      const maxPitch = Math.max(...pitchHistory);
      expect(maxPitch).toBeLessThan(1.0);
    });
  });

  describe('COMBAT BALANCE PASS — THE BULL FAIR & COMPETITIVE MATCHES', () => {
    it('progressively degrades wedge condition and increases pass-through damage', () => {
      const spinnerConfig: RobotConfiguration = {
        ...INITIAL_ROBOT_CONFIG,
        weaponId: 'horizontal-spinner',
      };
      const sim = createBattleSimulation(spinnerConfig, 'control', 'bull');
      expect(sim.boss.frontArmorPct).toBe(100);
      expect(sim.boss.wedgeCondition).toBe('healthy');

      // Deliver heavy weapon impacts to Bull's front
      sim.player.x = 0;
      sim.player.z = 0;
      sim.player.headingRad = 0;
      sim.player.vz = 1.2;
      sim.player.weaponSpinPct = 100;

      sim.boss.x = 0;
      sim.boss.z = 0.7;
      sim.boss.headingRad = Math.PI;
      sim.boss.vz = -3.0;

      stepBattleSimulation(sim, 0.02);

      // Bull front armor takes meaningful wear
      expect(sim.boss.frontArmorPct).toBeLessThan(100);
      expect(sim.boss.wedgeDeformationMm).toBeGreaterThan(0);
      expect(sim.recentImpactEvents.length).toBeGreaterThan(0);
      const lastHit = sim.recentImpactEvents[sim.recentImpactEvents.length - 1];
      expect(lastHit.rawDamage).toBeGreaterThan(0);
      expect(lastHit.finalDamage).toBeGreaterThan(0);
    });

    it('interrupts Bull charge on solid kinetic weapon strike', () => {
      const spinnerConfig: RobotConfiguration = {
        ...INITIAL_ROBOT_CONFIG,
        weaponId: 'vertical-spinner',
      };
      const sim = createBattleSimulation(spinnerConfig, 'control', 'bull');
      sim.player.x = 0;
      sim.player.z = 0;
      sim.player.headingRad = 0;
      sim.player.vz = 1.2;
      sim.player.weaponSpinPct = 100;

      sim.boss.x = 0;
      sim.boss.z = 0.7;
      sim.boss.headingRad = Math.PI;
      sim.bossChargeActiveSec = 1.0;
      sim.boss.vz = -3.5;

      stepBattleSimulation(sim, 0.02);

      // Charge is interrupted, Bull stunned and traction broken
      expect(sim.bossChargeActiveSec).toBe(0);
      expect(sim.bossStunTimerSec).toBeGreaterThan(0);
      expect(sim.boss.tractionBreakTimerSec).toBeGreaterThan(0);
    });

    it('amplifies Bull angular yaw on wedge corner strike', () => {
      const spinnerConfig: RobotConfiguration = {
        ...INITIAL_ROBOT_CONFIG,
        weaponId: 'horizontal-spinner',
      };
      const sim = createBattleSimulation(spinnerConfig, 'control', 'bull');
      // Contact offset laterally toward Bull's left/right wedge corner
      sim.player.x = 0.40;
      sim.player.z = 0;
      sim.player.headingRad = 0;
      sim.player.vz = 1.2;
      sim.player.weaponSpinPct = 100;

      sim.boss.x = 0;
      sim.boss.z = 0.7;
      sim.boss.headingRad = Math.PI;
      sim.boss.vz = -3.0;

      stepBattleSimulation(sim, 0.02);

      // Corner hit generates significant angular yaw rotation on Bull
      expect(Math.abs(sim.boss.angularVelocityRad)).toBeGreaterThan(4.0);
      const lastHit = sim.recentImpactEvents[sim.recentImpactEvents.length - 1];
      expect(lastHit.type).toBe('weapon');
    });

    it('degrades Bull pushing force during sustained contact past 1.5s', () => {
      const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull', undefined, 0, 0, true);
      sim.player.x = 0;
      sim.player.z = 0;
      sim.boss.x = 0;
      sim.boss.z = 0.5;
      sim.contactActive = true;
      sim.bossChargeActiveSec = 3.0;

      for (let f = 0; f < 80; f++) {
        sim.contactActive = true;
        sim.bossChargeActiveSec = 3.0;
        stepBattleSimulation(sim, 0.02);
      }

      // Bull pushing sustained timer accumulated past 1.0s
      expect(sim.bullPushSustainedSec).toBeGreaterThan(1.0);
    });

    it('allows hammer overhead strike to bypass wedge and stun Bull', () => {
      const hammerConfig: RobotConfiguration = {
        ...INITIAL_ROBOT_CONFIG,
        weaponId: 'hammer',
      };
      const sim = createBattleSimulation(hammerConfig, 'control', 'bull');
      sim.player.x = 0;
      sim.player.z = 0;
      sim.player.headingRad = 0;
      sim.player.vz = 1.2;
      sim.player.weaponActuationPhase = 0.5;

      sim.boss.x = 0;
      sim.boss.z = 0.7;
      sim.boss.headingRad = Math.PI;
      sim.boss.vz = -3.0;
      sim.bossChargeActiveSec = 0.8;

      stepBattleSimulation(sim, 0.02);

      expect(sim.bossChargeActiveSec).toBe(0);
      expect(sim.bossStunTimerSec).toBeGreaterThan(0.5);
      expect(sim.boss.hullIntegrityPct).toBeLessThan(100);
      const lastHit = sim.recentImpactEvents[sim.recentImpactEvents.length - 1];
      expect(lastHit.type).toBe('weapon');
      expect(lastHit.rawDamage).toBeGreaterThan(20);
    });

    it('triggers missed-charge overshoot recovery when player dodges laterally', () => {
      const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull');
      sim.bossChargeActiveSec = 1.0;
      sim.boss.headingRad = Math.PI; // Heading -z toward player
      sim.boss.x = 0;
      sim.boss.z = 1.5;
      sim.boss.vz = -4.5;

      // Player has dodged far to the right (laterally offset)
      sim.player.x = 1.8;
      sim.player.z = 0.2;

      stepBattleSimulation(sim, 0.02);

      // Charge aborted due to lateral dodge, Bull enters reposition/braking recovery
      expect(sim.bossChargeActiveSec).toBe(0);
      expect(sim.bossRepositionTimerSec).toBeGreaterThan(0.5);
      expect(sim.boss.aiStateLabel).toBe('REPOSITION');
    });
  });
});

