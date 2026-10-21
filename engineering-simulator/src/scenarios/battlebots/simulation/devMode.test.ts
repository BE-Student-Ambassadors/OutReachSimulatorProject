import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INITIAL_ROBOT_CONFIG, WEAPON_CATALOG } from '../data/components';
import { createInitialTeamProject } from '../data/teamData';
import { calculateEngineeringStats } from './engineering';
import {
  createBattleSimulation,
  stepBattleSimulation,
} from './battleEngine';
import {
  DEV_DEFAULT_ROBOT_CONFIG,
  DEV_AVAILABLE_WEAPONS,
  formatWeaponOptionLabel,
  getStoredDevRobotSource,
  getStoredDevWeapon,
  isBattlebotDevMode,
  resolveDevArenaRobot,
  setStoredDevRobotSource,
  setStoredDevWeapon,
} from '../services/devMode';
import type { WeaponId } from '../types/robot';

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

  describe('5. Dev Weapon Selector & Loadout System', () => {
    it('provides all 6 valid Mechanical weapons from components.ts WEAPON_CATALOG', () => {
      expect(DEV_AVAILABLE_WEAPONS.length).toBe(6);
      const weaponIds = DEV_AVAILABLE_WEAPONS.map((w) => w.id);
      expect(weaponIds).toContain('vertical-spinner');
      expect(weaponIds).toContain('horizontal-spinner');
      expect(weaponIds).toContain('lifter');
      expect(weaponIds).toContain('hammer');
      expect(weaponIds).toContain('wedge');
      expect(weaponIds).toContain('grabber');
    });

    it('formats weapon option labels accurately with proper title and spec weight', () => {
      const vertLabel = formatWeaponOptionLabel(WEAPON_CATALOG['vertical-spinner']);
      expect(vertLabel).toContain('Vertical Spinner');
      expect(vertLabel).toContain('6.2 lb');

      const horizLabel = formatWeaponOptionLabel(WEAPON_CATALOG['horizontal-spinner']);
      expect(horizLabel).toContain('Horizontal Spinner');
      expect(horizLabel).toContain('6.6 lb');
    });

    it('recalculates engineering stats dynamically for every selectable weapon', () => {
      const project = createInitialTeamProject();
      const weapons: WeaponId[] = [
        'vertical-spinner',
        'horizontal-spinner',
        'lifter',
        'hammer',
        'wedge',
        'grabber',
      ];

      for (const wId of weapons) {
        const resolved = resolveDevArenaRobot(INITIAL_ROBOT_CONFIG, project, {
          robotSource: 'default',
          weaponId: wId,
        });

        expect(resolved.config.weaponId).toBe(wId);
        expect(resolved.stats).toBeDefined();

        const spec = WEAPON_CATALOG[wId as Exclude<WeaponId, 'custom-weapon'>];
        expect(resolved.stats.weaponEnergyJ).toBe(spec.energyJ);
        if (spec.spinUpSec > 0) {
          expect(resolved.stats.weaponSpinUpSec).toBeGreaterThan(0);
        } else {
          expect(resolved.stats.weaponSpinUpSec).toBe(0);
        }

        // Mass calculation correctly integrates weapon weight
        const expectedWeight = calculateEngineeringStats(resolved.config).totalWeightLb;
        expect(resolved.stats.totalWeightLb).toBe(expectedWeight);
      }
    });
  });

  describe('6. Robot Source Selection (Default Test Robot vs Current Robot)', () => {
    it('uses DEV_DEFAULT_ROBOT_CONFIG baseline when robotSource is "default"', () => {
      const project = createInitialTeamProject();
      const customConfig = {
        ...INITIAL_ROBOT_CONFIG,
        name: 'MY WORKSHOP BOT',
        chassisId: 'compact' as const,
      };

      const resolved = resolveDevArenaRobot(customConfig, project, {
        robotSource: 'default',
        weaponId: 'lifter',
      });

      expect(resolved.isDefaultTestBot).toBe(true);
      expect(resolved.config.chassisId).toBe('long'); // from DEV_DEFAULT_ROBOT_CONFIG
      expect(resolved.config.weaponId).toBe('lifter');
    });

    it('uses current workshop robot when robotSource is "current"', () => {
      const project = createInitialTeamProject();
      const customConfig = {
        ...INITIAL_ROBOT_CONFIG,
        name: 'MY WORKSHOP BOT',
        chassisId: 'compact' as const,
        armorId: 'titanium' as const,
        wheelsId: 'tracks' as const,
      };

      const resolved = resolveDevArenaRobot(customConfig, project, {
        robotSource: 'current',
        weaponId: 'hammer',
      });

      expect(resolved.isDefaultTestBot).toBe(false);
      expect(resolved.config.name).toBe('MY WORKSHOP BOT');
      expect(resolved.config.chassisId).toBe('compact');
      expect(resolved.config.armorId).toBe('titanium');
      expect(resolved.config.wheelsId).toBe('tracks');
      expect(resolved.config.weaponId).toBe('hammer');
    });
  });

  describe('7. Tolerating Illegal Overweight Test Configurations (> 30 lb)', () => {
    it('displays exact weight and does NOT mutate other components when overweight', () => {
      const project = createInitialTeamProject();
      const heavyTankConfig = {
        ...INITIAL_ROBOT_CONFIG,
        name: 'HEAVY TANK 32LB',
        chassisId: 'wide' as const,
        driveId: 'torque' as const,
        wheelsId: 'tracks' as const,
        armorId: 'steel' as const,
        armorThickness: 'thick' as const,
        batteryId: 'large' as const,
      };

      const resolved = resolveDevArenaRobot(heavyTankConfig, project, {
        robotSource: 'current',
        weaponId: 'horizontal-spinner',
      });

      expect(resolved.isDefaultTestBot).toBe(false);
      expect(resolved.stats.totalWeightLb).toBeGreaterThan(30.0);
      expect(resolved.stats.isOverweight).toBe(true);
      // Components must be unaltered
      expect(resolved.config.armorId).toBe('steel');
      expect(resolved.config.armorThickness).toBe('thick');
      expect(resolved.config.wheelsId).toBe('tracks');
      expect(resolved.config.weaponId).toBe('horizontal-spinner');
    });

    it('allows overweight robot into combat simulation without throwing error', () => {
      const heavyTankConfig = {
        ...INITIAL_ROBOT_CONFIG,
        name: 'HEAVY TEST BOT',
        chassisId: 'wide' as const,
        driveId: 'torque' as const,
        wheelsId: 'tracks' as const,
        armorId: 'steel' as const,
        armorThickness: 'thick' as const,
        weaponId: 'horizontal-spinner' as const,
        batteryId: 'large' as const,
      };

      const sim = createBattleSimulation(heavyTankConfig, 'control', 'bull', undefined, 120, 0, true);
      expect(sim.player.hullIntegrityPct).toBe(100);

      // Step simulation
      for (let i = 0; i < 20; i++) {
        stepBattleSimulation(sim, 0.05, { throttle: 1, steering: 0, weaponActive: true });
      }

      expect(sim.player.vz).not.toBe(0);
    });
  });

  describe('8. Dev Loadout Storage & Persistence', () => {
    beforeEach(() => {
      const storage: Record<string, string> = {};
      (globalThis as any).localStorage = {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => {
          storage[k] = v;
        },
        removeItem: (k: string) => {
          delete storage[k];
        },
      };
    });

    afterEach(() => {
      delete (globalThis as any).localStorage;
    });

    it('persists and restores dev weapon selection', () => {
      expect(getStoredDevWeapon()).toBe('vertical-spinner'); // default
      setStoredDevWeapon('lifter');
      expect(getStoredDevWeapon()).toBe('lifter');
      setStoredDevWeapon('hammer');
      expect(getStoredDevWeapon()).toBe('hammer');
    });

    it('persists and restores dev robot source selection', () => {
      expect(getStoredDevRobotSource()).toBe('default');
      setStoredDevRobotSource('current');
      expect(getStoredDevRobotSource()).toBe('current');
      setStoredDevRobotSource('default');
      expect(getStoredDevRobotSource()).toBe('default');
    });
  });

  describe('9. Combat Physics Multi-Weapon Execution in Arena', () => {
    const weaponsToTest: WeaponId[] = [
      'vertical-spinner',
      'horizontal-spinner',
      'lifter',
      'hammer',
      'wedge',
      'grabber',
    ];

    for (const wId of weaponsToTest) {
      it(`initializes and steps combat simulation with weapon "${wId}" successfully`, () => {
        const testConfig = {
          ...DEV_DEFAULT_ROBOT_CONFIG,
          weaponId: wId,
        };

        const sim = createBattleSimulation(testConfig, 'control', 'bull', undefined, 120, 0, true);
        expect(sim).toBeDefined();
        expect(sim.playerConfig.weaponId).toBe(wId);
        expect(sim.playerStats.weaponEnergyJ).toBe(WEAPON_CATALOG[wId as Exclude<WeaponId, 'custom-weapon'>].energyJ);

        for (let i = 0; i < 15; i++) {
          stepBattleSimulation(sim, 0.05, { throttle: 0.8, steering: 0.2, weaponActive: true });
        }

        expect(sim.timeSec).toBeGreaterThan(0.5);
      });
    }
  });
});
