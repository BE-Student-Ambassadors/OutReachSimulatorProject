import { describe, expect, it } from 'vitest';
import { INITIAL_ROBOT_CONFIG } from '../data/components';
import { inventorAI } from '../services/inventorAI';
import { type RobotConfiguration } from '../types/robot';
import { runFullBattleHeadless } from './battleEngine';
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
    expect(flawedBattle.winner).toBe('bull');
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
});
