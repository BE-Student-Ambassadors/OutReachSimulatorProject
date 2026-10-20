import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INITIAL_ROBOT_CONFIG } from '../data/components';
import { createInitialTeamProject } from '../data/teamData';
import { calculateEngineeringStats } from './engineering';
import {
  createBattleSimulation,
  stepBattleSimulation,
} from './battleEngine';
import {
  DEV_DEFAULT_ROBOT_CONFIG,
  isBattlebotDevMode,
  resolveDevArenaRobot,
} from '../services/devMode';

describe('BattleBot Developer Mode & Arena Bypass System', () => {
  beforeEach(() => {
    (globalThis as any).window = {
      location: {
        search: '',
        hash: '',
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  describe('1. URL Query Parameter Detection', () => {
    it('returns false when no query parameters are present (normal student mode)', () => {
      window.location.search = '';
      window.location.hash = '';
      expect(isBattlebotDevMode()).toBe(false);
    });

    it('returns false when other parameters exist without dev=true', () => {
      window.location.search = '?play=battlebots&team=delta';
      expect(isBattlebotDevMode()).toBe(false);
    });

    it('returns false when dev=false', () => {
      window.location.search = '?play=battlebots&dev=false';
      expect(isBattlebotDevMode()).toBe(false);
    });

    it('returns true when ?dev=true is present', () => {
      window.location.search = '?dev=true';
      expect(isBattlebotDevMode()).toBe(true);
    });

    it('returns true when combined with other parameters (e.g. ?play=battlebots&dev=true)', () => {
      window.location.search = '?play=battlebots&dev=true&lang=en';
      expect(isBattlebotDevMode()).toBe(true);
    });

    it('returns true when dev=true is passed via hash route (?dev=true)', () => {
      window.location.search = '';
      window.location.hash = '#/battlebots?dev=true';
      expect(isBattlebotDevMode()).toBe(true);
    });
  });

  describe('2. Default Test Robot Validation', () => {
    it('is strictly under the 30.0 lb weight limit', () => {
      const stats = calculateEngineeringStats(DEV_DEFAULT_ROBOT_CONFIG);
      expect(stats.totalWeightLb).toBeLessThanOrEqual(30.0);
      expect(stats.isOverweight).toBe(false);
    });

    it('has valid drive, wheels, armor, weapon, and power subsystems', () => {
      expect(DEV_DEFAULT_ROBOT_CONFIG.chassisId).toBeTruthy();
      expect(DEV_DEFAULT_ROBOT_CONFIG.driveId).toBeTruthy();
      expect(DEV_DEFAULT_ROBOT_CONFIG.wheelsId).toBeTruthy();
      expect(DEV_DEFAULT_ROBOT_CONFIG.armorId).toBeTruthy();
      expect(DEV_DEFAULT_ROBOT_CONFIG.weaponId).toBeTruthy();
      expect(DEV_DEFAULT_ROBOT_CONFIG.batteryId).toBeTruthy();

      const stats = calculateEngineeringStats(DEV_DEFAULT_ROBOT_CONFIG);
      expect(stats.topSpeedMph).toBeGreaterThan(8);
      expect(stats.pushingForceN).toBeGreaterThan(60);
      expect(stats.weaponEnergyJ).toBeGreaterThan(2000);
      expect(stats.runtimeSeconds).toBeGreaterThan(120);
    });

    it('runs through full combat physics against The Bull without errors', () => {
      const sim = createBattleSimulation(DEV_DEFAULT_ROBOT_CONFIG, 'control', 'bull', undefined, 120, 0, true);
      expect(sim.isFinished).toBe(false);
      expect(sim.player.hullIntegrityPct).toBe(100);
      expect(sim.bull.hullIntegrityPct).toBe(100);

      // Step physical simulation
      for (let i = 0; i < 30; i++) {
        stepBattleSimulation(sim, 0.05, { throttle: 1, steering: 0, weaponActive: true });
      }

      expect(sim.player.vz).not.toBe(0);
      expect(sim.player.weaponSpinPct).toBeGreaterThan(0);
    });
  });

  describe('3. Robot Selection Priority', () => {
    it('Priority 2: uses DEV_DEFAULT_ROBOT_CONFIG when project is fresh/unmodified', () => {
      const project = createInitialTeamProject();
      const currentConfig = { ...INITIAL_ROBOT_CONFIG };

      const resolved = resolveDevArenaRobot(currentConfig, project);
      expect(resolved.isDefaultTestBot).toBe(true);
      expect(resolved.config.name).toBe('DEV TEST BOT');
      expect(resolved.config.weaponId).toBe('vertical-spinner');
    });

    it('Priority 1: preserves and uses current robot when developer customizes a valid build in Mechanical', () => {
      const project = createInitialTeamProject();
      const customConfig = {
        ...INITIAL_ROBOT_CONFIG,
        name: 'CUSTOM EXPERIMENT',
        weaponId: 'horizontal-spinner' as const,
        chassisId: 'compact' as const,
        driveId: 'speed' as const,
        wheelsId: 'small' as const,
        armorId: 'polycarbonate' as const,
        armorThickness: 'medium' as const,
        batteryId: 'medium' as const,
      };

      const resolved = resolveDevArenaRobot(customConfig, project);
      expect(resolved.isDefaultTestBot).toBe(false);
      expect(resolved.config.name).toBe('CUSTOM EXPERIMENT');
      expect(resolved.config.weaponId).toBe('horizontal-spinner');
    });

    it('Priority 2 fallback: reverts to DEV_DEFAULT_ROBOT_CONFIG if current robot exceeds 30.0 lb limit', () => {
      const project = createInitialTeamProject();
      const overweightConfig = {
        ...INITIAL_ROBOT_CONFIG,
        name: 'ILLEGAL TANK',
        chassisId: 'wide' as const,
        driveId: 'torque' as const,
        wheelsId: 'tracks' as const,
        armorId: 'steel' as const,
        armorThickness: 'thick' as const,
        weaponId: 'horizontal-spinner' as const,
        batteryId: 'large' as const,
      };

      const resolved = resolveDevArenaRobot(overweightConfig, project);
      expect(resolved.isDefaultTestBot).toBe(true);
      expect(resolved.config.name).toBe('DEV TEST BOT');
    });
  });

  describe('4. Arena Progression Integrity', () => {
    it('does NOT prematurely mark roles or integration as completed in the underlying project', () => {
      const project = createInitialTeamProject();
      expect(project.mechanical.isCompleted).toBe(false);
      expect(project.electrical.isCompleted).toBe(false);
      expect(project.software.isCompleted).toBe(false);
      expect(project.projectLead.isCompleted).toBe(false);
      expect(project.integration.overallPassed).toBe(false);

      // Resolving dev robot or entering dev arena must leave project state pristine
      const resolved = resolveDevArenaRobot(INITIAL_ROBOT_CONFIG, project);
      expect(resolved.config).toBeDefined();

      expect(project.mechanical.isCompleted).toBe(false);
      expect(project.electrical.isCompleted).toBe(false);
      expect(project.software.isCompleted).toBe(false);
      expect(project.projectLead.isCompleted).toBe(false);
      expect(project.integration.overallPassed).toBe(false);
    });
  });
});
