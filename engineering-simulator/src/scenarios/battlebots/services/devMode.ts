import { INITIAL_ROBOT_CONFIG } from '../data/components';
import { calculateEngineeringStats } from '../simulation/engineering';
import type { RobotConfiguration, TeamRobotProject } from '../types/robot';

/**
 * Checks whether developer/admin testing mode is enabled via the URL (?dev=true).
 * When active, developer bypasses allow direct Arena access and quick combat iteration.
 */
export function isBattlebotDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('dev') === 'true' || searchParams.get('dev') === '1') return true;
    if (window.location.hash) {
      const hashQuery = window.location.hash.split('?')[1];
      if (hashQuery) {
        const hashParams = new URLSearchParams(hashQuery);
        if (hashParams.get('dev') === 'true' || hashParams.get('dev') === '1') return true;
      }
      if (window.location.hash.includes('dev=true')) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Valid default developer test robot:
 * - Weight: ~28.5 lb (strictly under 30.0 lb limit)
 * - Drive: Balanced drive + High-traction wheels (agile, solid torque & speed)
 * - Armor: Polycarbonate medium (good durability & weight balance)
 * - Weapon: Vertical Spinner (3,200 J kinetic disc, capable of flipping/damaging The Bull)
 * - Power: Large Battery (high continuous/peak discharge)
 * - Utility: Wheel Guards (prevents wheel snags)
 */
export const DEV_DEFAULT_ROBOT_CONFIG: RobotConfiguration = {
  ...INITIAL_ROBOT_CONFIG,
  name: 'DEV TEST BOT',
  chassisId: 'long',
  driveId: 'balanced',
  wheelsId: 'high-traction',
  armorId: 'polycarbonate',
  armorThickness: 'medium',
  weaponId: 'vertical-spinner',
  batteryId: 'large',
  utilityId: 'wheel-guards',
  accentColor: '#22d3ee',
  customWeapon: null,
  customUtility: null,
};

/**
 * Resolves which robot configuration to load into the Arena in Developer Mode:
 * Priority 1: If user already has a customized, valid (under 30 lb) robot configuration, use it.
 * Priority 2: Otherwise use the default developer test robot.
 */
export function resolveDevArenaRobot(
  currentConfig: RobotConfiguration,
  project: TeamRobotProject
): { config: RobotConfiguration; isDefaultTestBot: boolean } {
  const isCustomized =
    Boolean(project.mechanical.isCompleted) ||
    (project.mechanical.assembledParts && project.mechanical.assembledParts.length >= 5) ||
    (project.mechanical.purchasedParts && Object.keys(project.mechanical.purchasedParts).length >= 5) ||
    currentConfig.weaponId !== INITIAL_ROBOT_CONFIG.weaponId ||
    currentConfig.chassisId !== INITIAL_ROBOT_CONFIG.chassisId ||
    currentConfig.driveId !== INITIAL_ROBOT_CONFIG.driveId ||
    currentConfig.wheelsId !== INITIAL_ROBOT_CONFIG.wheelsId ||
    currentConfig.armorId !== INITIAL_ROBOT_CONFIG.armorId ||
    currentConfig.batteryId !== INITIAL_ROBOT_CONFIG.batteryId ||
    currentConfig.utilityId !== INITIAL_ROBOT_CONFIG.utilityId;

  const currentStats = calculateEngineeringStats(currentConfig);

  // Priority 1: Use user's current configuration if customized and legally under 30 lb
  if (isCustomized && !currentStats.isOverweight) {
    return { config: currentConfig, isDefaultTestBot: false };
  }

  // Priority 2: Use default developer test robot
  return { config: DEV_DEFAULT_ROBOT_CONFIG, isDefaultTestBot: true };
}

