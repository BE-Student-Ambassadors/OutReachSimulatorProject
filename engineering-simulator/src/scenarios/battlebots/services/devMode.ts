import { INITIAL_ROBOT_CONFIG, WEAPON_CATALOG, type WeaponSpec } from '../data/components';
import { calculateEngineeringStats } from '../simulation/engineering';
import type { EngineeringStats, RobotConfiguration, TeamRobotProject, WeaponId } from '../types/robot';

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

export type DevRobotSource = 'default' | 'current';

export const DEV_WEAPON_STORAGE_KEY = 'battlebot_dev_weapon';
export const DEV_ROBOT_SOURCE_STORAGE_KEY = 'battlebot_dev_robot_source';

/**
 * Read the available weapons from the single source of truth in components.ts
 */
export const DEV_AVAILABLE_WEAPONS: WeaponSpec[] = Object.values(WEAPON_CATALOG);

/**
 * Formats a weapon spec into a clean display title with weight (e.g. "Vertical Spinner (6.2 lb)")
 */
export function formatWeaponOptionLabel(spec: WeaponSpec): string {
  const title = spec.name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return `${title} (${spec.weightLb.toFixed(1)} lb)`;
}

export function getStoredDevWeapon(): WeaponId {
  if (typeof window === 'undefined') return 'vertical-spinner';
  try {
    const stored = localStorage.getItem(DEV_WEAPON_STORAGE_KEY);
    if (stored && stored in WEAPON_CATALOG) {
      return stored as WeaponId;
    }
  } catch {
    // ignore
  }
  return 'vertical-spinner';
}

export function setStoredDevWeapon(weaponId: WeaponId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEV_WEAPON_STORAGE_KEY, weaponId);
  } catch {
    // ignore
  }
}

export function getStoredDevRobotSource(): DevRobotSource {
  if (typeof window === 'undefined') return 'default';
  try {
    const stored = localStorage.getItem(DEV_ROBOT_SOURCE_STORAGE_KEY);
    if (stored === 'default' || stored === 'current') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'default';
}

export function setStoredDevRobotSource(source: DevRobotSource): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEV_ROBOT_SOURCE_STORAGE_KEY, source);
  } catch {
    // ignore
  }
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

export interface DevLoadoutOptions {
  robotSource?: DevRobotSource;
  weaponId?: WeaponId;
}

/**
 * Resolves which robot configuration to load into the Arena in Developer Mode.
 *
 * Supports:
 * - Choosing between Default Test Robot (baseline) and Current Robot (built in workshop)
 * - Equipping any valid Mechanical weapon from components.ts
 * - Recomputing real engineering stats (mass, CoM, weapon energy, RPM, collision geometry)
 * - Tolerating overweight test configurations (> 30 lb) without forcing or silently mutating other components
 */
export function resolveDevArenaRobot(
  currentConfig: RobotConfiguration,
  project: TeamRobotProject,
  options?: DevLoadoutOptions
): { config: RobotConfiguration; isDefaultTestBot: boolean; stats: EngineeringStats } {
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

  let isDefaultTestBot = true;
  let baseConfig = DEV_DEFAULT_ROBOT_CONFIG;

  if (options?.robotSource === 'current') {
    isDefaultTestBot = false;
    baseConfig = currentConfig;
  } else if (options?.robotSource === 'default') {
    isDefaultTestBot = true;
    baseConfig = DEV_DEFAULT_ROBOT_CONFIG;
  } else {
    // Automatic fallback when no source is specified:
    // Priority 1: Use user's current configuration if customized and legally under 30 lb
    if (isCustomized && !currentStats.isOverweight) {
      isDefaultTestBot = false;
      baseConfig = currentConfig;
    } else {
      isDefaultTestBot = true;
      baseConfig = DEV_DEFAULT_ROBOT_CONFIG;
    }
  }

  // Determine effective weapon: explicitly selected dev weapon takes precedence
  const effectiveWeaponId = options?.weaponId || baseConfig.weaponId;

  const resolvedConfig: RobotConfiguration = {
    ...baseConfig,
    weaponId: effectiveWeaponId,
    // Clear customWeapon when using catalog weapon or default bot to ensure standard spec applies
    customWeapon: isDefaultTestBot ? null : (effectiveWeaponId === baseConfig.weaponId ? baseConfig.customWeapon : null),
  };

  // Recompute engineering stats from the real configuration
  const stats = calculateEngineeringStats(resolvedConfig);

  return {
    config: resolvedConfig,
    isDefaultTestBot,
    stats,
  };
}

