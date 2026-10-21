import {
  BATTERY_OPTIONS,
  COOLING_OPTIONS,
  COMPONENT_MARKET_DATA,
  DRIVE_ESC_OPTIONS,
  PROJECT_LEAD_SPECS,
  WEAPON_ESC_OPTIONS,
} from '../data/teamData';
import {
  ARMOR_CATALOG,
  ARMOR_THICKNESS_OPTIONS,
  CHASSIS_CATALOG,
  DRIVE_CATALOG,
  MAX_ROBOT_WEIGHT_LB,
  UTILITY_CATALOG,
  WEAPON_CATALOG,
  WHEELS_CATALOG,
} from '../data/components';
import {
  type EngineeringStats,
  type RobotConfiguration,
  type SystemIntegrationReport,
  type TeamRobotProject,
} from '../types/robot';
import { calculateEngineeringStats } from './engineering';

export interface CalculatedBOMItem {
  discipline: 'Mechanical' | 'Electrical' | 'Software' | 'Project';
  partName: string;
  costUsd: number;
  leadTimeDays: number;
  weightLb: number;
}

export interface DetailedTeamEngineeringSummary {
  totalWeightLb: number;
  isOverweight: boolean;
  totalCostUsd: number;
  effectiveBudgetUsd: number;
  isOverBudget: boolean;
  maxLeadTimeDays: number;
  leadTimeConflict: boolean;
  peakCurrentDemandA: number;
  effectivePeakDemandA: number;
  batteryContinuousA: number;
  isOverCurrent: boolean;
  driveEscSafe: boolean;
  weaponEscSafe: boolean;
  runtimeSeconds: number;
  bomItems: CalculatedBOMItem[];
  stats: EngineeringStats;
}

export function computeTeamEngineeringSummary(project: TeamRobotProject): DetailedTeamEngineeringSummary {
  const { mechanical, electrical, software, projectLead } = project;

  // 1. Resolve mechanical base specs
  const chassis = CHASSIS_CATALOG[mechanical.chassisId];
  const drive = DRIVE_CATALOG[mechanical.driveId];
  const wheels = WHEELS_CATALOG[mechanical.wheelsId];
  const armorMat = ARMOR_CATALOG[mechanical.armorId];
  const armorThick = ARMOR_THICKNESS_OPTIONS[mechanical.armorThickness];
  const weapon = WEAPON_CATALOG[mechanical.weaponId as Exclude<typeof mechanical.weaponId, 'custom-weapon'>] || WEAPON_CATALOG.wedge;
  const utility = UTILITY_CATALOG[mechanical.utilityId as Exclude<typeof mechanical.utilityId, 'custom-utility'>] || UTILITY_CATALOG.none;

  // 2. Resolve electrical hardware specs
  const battery = BATTERY_OPTIONS[electrical.batteryId];
  const driveEsc = DRIVE_ESC_OPTIONS[electrical.driveEscRatingA];
  const weaponEsc = WEAPON_ESC_OPTIONS[electrical.weaponEscRatingA];
  const cooling = COOLING_OPTIONS[electrical.coolingSystem];

  // 3. Resolve project lead options
  const shipping = PROJECT_LEAD_SPECS.shippingTiers[projectLead.shippingTier];
  const spareKit = PROJECT_LEAD_SPECS.spareKits[projectLead.sparePartsKit];

  // 4. Calculate Bill of Materials (BOM) items
  const chassisMarket = COMPONENT_MARKET_DATA.chassis[mechanical.chassisId];
  const driveMarket = COMPONENT_MARKET_DATA.drive[mechanical.driveId];
  const wheelsMarket = COMPONENT_MARKET_DATA.wheels[mechanical.wheelsId];
  const armorMarket = COMPONENT_MARKET_DATA.armor[mechanical.armorId];
  const armorCost = Math.round(armorMarket.costUsd * COMPONENT_MARKET_DATA.armorThicknessMultiplier[mechanical.armorThickness]);
  const weaponMarket = COMPONENT_MARKET_DATA.weapon[mechanical.weaponId] || { costUsd: 200, leadTimeDays: 0, peakCurrentA: 20 };
  const utilityMarket = COMPONENT_MARKET_DATA.utility[mechanical.utilityId] || { costUsd: 0, leadTimeDays: 0, peakCurrentA: 0 };

  const sensorCost = software.sensorPackage === 'lidar' ? 210 : software.sensorPackage === 'ultrasonic' ? 85 : 0;
  const sensorLead = software.sensorPackage === 'lidar' ? 5 : 0;

  const leadTimeReduction = shipping.leadTimeReductionDays;

  const bomItems: CalculatedBOMItem[] = [
    { discipline: 'Mechanical', partName: `Chassis (${chassis.name})`, costUsd: chassisMarket.costUsd, leadTimeDays: Math.max(0, chassisMarket.leadTimeDays - leadTimeReduction), weightLb: chassis.weightLb },
    { discipline: 'Mechanical', partName: `Drivetrain (${drive.name})`, costUsd: driveMarket.costUsd, leadTimeDays: Math.max(0, driveMarket.leadTimeDays - leadTimeReduction), weightLb: drive.weightLb },
    { discipline: 'Mechanical', partName: `Wheels (${wheels.name})`, costUsd: wheelsMarket.costUsd, leadTimeDays: Math.max(0, wheelsMarket.leadTimeDays - leadTimeReduction), weightLb: wheels.weightLb },
    { discipline: 'Mechanical', partName: `Armor (${armorMat.name} ${armorThick.label})`, costUsd: armorCost, leadTimeDays: Math.max(0, armorMarket.leadTimeDays - leadTimeReduction), weightLb: Number((armorMat.baseWeightLb * armorThick.weightMultiplier).toFixed(1)) },
    { discipline: 'Mechanical', partName: `Weapon (${weapon.name})`, costUsd: weaponMarket.costUsd, leadTimeDays: Math.max(0, weaponMarket.leadTimeDays - leadTimeReduction), weightLb: weapon.weightLb },
    { discipline: 'Mechanical', partName: `Utility (${utility.name})`, costUsd: utilityMarket.costUsd, leadTimeDays: Math.max(0, utilityMarket.leadTimeDays - leadTimeReduction), weightLb: utility.weightLb },
    { discipline: 'Electrical', partName: `Battery (${battery.name})`, costUsd: battery.costUsd, leadTimeDays: Math.max(0, battery.leadTimeDays - leadTimeReduction), weightLb: battery.weightLb },
    { discipline: 'Electrical', partName: `Drive Controller (${driveEsc.name})`, costUsd: driveEsc.costUsd, leadTimeDays: Math.max(0, driveEsc.leadTimeDays - leadTimeReduction), weightLb: driveEsc.weightLb },
    { discipline: 'Electrical', partName: `Weapon Controller (${weaponEsc.name})`, costUsd: weaponEsc.costUsd, leadTimeDays: Math.max(0, weaponEsc.leadTimeDays - leadTimeReduction), weightLb: weaponEsc.weightLb },
    { discipline: 'Electrical', partName: `Thermal Cooling (${cooling.name})`, costUsd: cooling.costUsd, leadTimeDays: Math.max(0, cooling.leadTimeDays - leadTimeReduction), weightLb: cooling.weightLb },
    { discipline: 'Software', partName: `Autonomous Sensors (${software.sensorPackage.toUpperCase()})`, costUsd: sensorCost, leadTimeDays: Math.max(0, sensorLead - leadTimeReduction), weightLb: 0.2 },
    { discipline: 'Project', partName: `Pit Sparing (${spareKit.name})`, costUsd: spareKit.costUsd, leadTimeDays: 0, weightLb: 0 },
    { discipline: 'Project', partName: `Shipping Tier (${shipping.name})`, costUsd: shipping.costUsd, leadTimeDays: 0, weightLb: 0 },
  ];

  // 5. Total weights & costs
  const totalWeightLb = Number(
    bomItems.reduce((acc, item) => acc + item.weightLb, 0).toFixed(1)
  );
  const totalCostUsd = bomItems.reduce((acc, item) => acc + item.costUsd, 0);
  const maxLeadTimeDays = Math.max(...bomItems.map((item) => item.leadTimeDays));

  // 6. Current draw & electrical constraints
  const drivePeakA = driveMarket.peakCurrentA || 42;
  const weaponPeakA = weaponMarket.peakCurrentA || 15;
  const electronicsDrawA = 5 + (cooling.id === 'fan' ? 2 : 0);
  const rawPeakCurrentDemandA = drivePeakA + weaponPeakA + electronicsDrawA;

  // Apply current limiter if set
  const effectivePeakDemandA =
    electrical.currentLimiterA > 0
      ? Math.min(rawPeakCurrentDemandA, electrical.currentLimiterA)
      : rawPeakCurrentDemandA;

  const isOverCurrent = effectivePeakDemandA > battery.continuousCurrentA;
  const driveEscSafe = driveEsc.burstA >= drivePeakA;
  const weaponEscSafe = weaponEsc.burstA >= weaponPeakA;

  // 7. Base Robot Configuration for existing engineering stats
  const baseConfig: RobotConfiguration = {
    name: project.teamName || 'TEAM ROBOT',
    chassisId: mechanical.chassisId,
    driveId: mechanical.driveId,
    wheelsId: mechanical.wheelsId,
    armorId: mechanical.armorId,
    armorThickness: mechanical.armorThickness,
    weaponId: mechanical.weaponId,
    batteryId: electrical.batteryId,
    utilityId: mechanical.utilityId,
    accentColor: mechanical.accentColor,
    customWeapon: null,
    customUtility: null,
  };

  const stats = calculateEngineeringStats(baseConfig);
  stats.totalWeightLb = totalWeightLb;
  stats.isOverweight = totalWeightLb > MAX_ROBOT_WEIGHT_LB;
  stats.overweightLb = stats.isOverweight ? Number((totalWeightLb - MAX_ROBOT_WEIGHT_LB).toFixed(1)) : 0;
  // Apply cooling temperature reduction
  stats.expectedMotorTempC = Math.max(38, stats.expectedMotorTempC - cooling.tempReductionC);

  // Effective budget = base budget ($1800) + secured sponsorships
  const sponsorFunding = Math.max(
    projectLead.sponsorshipUsd || 0,
    (projectLead.activeSponsors || []).reduce((acc, s) => acc + s.amountUsd, 0)
  );
  const totalApprovedBudget = (projectLead.baseBudgetUsd || 1800) + sponsorFunding;
  const budgetCap = Math.max(projectLead.budgetCapUsd || 1800, totalApprovedBudget);

  return {
    totalWeightLb,
    isOverweight: stats.isOverweight,
    totalCostUsd,
    effectiveBudgetUsd: budgetCap,
    isOverBudget: totalCostUsd > budgetCap,
    maxLeadTimeDays,
    leadTimeConflict: maxLeadTimeDays > PROJECT_LEAD_SPECS.competitionDeadlineDays,
    peakCurrentDemandA: rawPeakCurrentDemandA,
    effectivePeakDemandA,
    batteryContinuousA: battery.continuousCurrentA,
    isOverCurrent,
    driveEscSafe,
    weaponEscSafe,
    runtimeSeconds: stats.runtimeSeconds,
    bomItems,
    stats,
  };
}

export function validateSystemIntegration(project: TeamRobotProject): SystemIntegrationReport {
  const summary = computeTeamEngineeringSummary(project);
  const failures: string[] = [];
  const warnings: string[] = [];

  let mechanicalPassed = true;
  let electricalPassed = true;
  let softwarePassed = true;
  let projectLeadPassed = true;

  // ==========================================
  // 1. MECHANICAL VALIDATION
  // ==========================================
  if (!project.mechanical.isCompleted) {
    mechanicalPassed = false;
    failures.push('Mechanical: Physical robot design has not been finalized and signed off.');
  }

  if (summary.totalWeightLb > MAX_ROBOT_WEIGHT_LB) {
    mechanicalPassed = false;
    failures.push(
      `Mechanical: Robot mass is ${summary.totalWeightLb.toFixed(1)} lb. Competition limit is ${MAX_ROBOT_WEIGHT_LB.toFixed(1)} lb (+${(summary.totalWeightLb - MAX_ROBOT_WEIGHT_LB).toFixed(1)} lb overweight).`
    );
  }

  if (summary.stats.groundClearanceInches < 0.28) {
    warnings.push(
      `Mechanical Note: Low ground clearance (${summary.stats.groundClearanceInches.toFixed(2)}") increases risk of high-centering on arena debris.`
    );
  }

  // ==========================================
  // 2. ELECTRICAL VALIDATION (Standard Wiring Only)
  // ==========================================
  if (!project.electrical.wiringVerified || !project.electrical.isCompleted) {
    electricalPassed = false;
    failures.push(
      'Electrical: Wiring harness has not passed electrical safety inspection. Route and verify all 14 power, ESC, and logic wires.'
    );
  }

  // NOTE: Amperage sizing and power system headroom are part of the optional
  // Advanced Power Challenge. They provide engineering feedback/warnings but
  // NEVER block Standard Electrical completion or System Integration gating.
  if (summary.isOverCurrent) {
    warnings.push(
      `Electrical Note: Peak current demand (${summary.effectivePeakDemandA} A) exceeds continuous battery capability (${summary.batteryContinuousA} A).`
    );
  }

  if (!summary.driveEscSafe) {
    warnings.push(
      `Electrical Note: Drive ESC rating (${project.electrical.driveEscRatingA} A) is near or below drive motor peak draw (${summary.stats.driveTorqueNm > 45 ? 52 : 42} A).`
    );
  }

  if (!summary.weaponEscSafe) {
    warnings.push(
      `Electrical Note: Weapon ESC rating (${project.electrical.weaponEscRatingA} A) is near or below weapon peak draw.`
    );
  }

  if (summary.runtimeSeconds < 120) {
    warnings.push(
      `Electrical Note: Estimated runtime is ${Math.floor(summary.runtimeSeconds / 60)}m ${summary.runtimeSeconds % 60}s. Match endurance may be limited under continuous run.`
    );
  }


  if (project.electrical.currentLimiterA > 0) {
    warnings.push(
      `Electrical Note: Current limiter active at ${project.electrical.currentLimiterA} A. Safely protects battery, but weapon spin-up time and motor acceleration will be slightly throttled.`
    );
  }

  // ==========================================
  // 3. SOFTWARE VALIDATION
  // ==========================================
  if (project.software.rules.length < 2) {
    softwarePassed = false;
    failures.push(
      `Software: Autonomous behavior stack has only ${project.software.rules.length} rule(s). Minimum 2 active rules required for competitive behavior.`
    );
  }

  const hasAttackAction = project.software.rules.some(
    (r) => r.action === 'full_charge' || r.action === 'approach' || r.action === 'flank_target'
  );
  if (!hasAttackAction) {
    softwarePassed = false;
    failures.push(
      `Software: Autonomous rule stack contains no offensive engagement actions (Full Charge, Approach, or Flank). Robot will remain passive in combat.`
    );
  }

  if (!project.software.softwareUploaded && !project.software.testPassed) {
    softwarePassed = false;
    failures.push(
      `Software: Autonomous software has not been debugged and uploaded to robot (Virtual Test Bench unverified).`
    );
  }

  // ==========================================
  // 4. BUSINESS / PROJECT LEAD VALIDATION
  // ==========================================
  if (summary.isOverBudget) {
    projectLeadPassed = false;
    failures.push(
      `Business Lead: Total project expenditure ($${summary.totalCostUsd.toLocaleString()}) exceeds approved budget ($${project.projectLead.budgetCapUsd.toLocaleString()}) by $${(summary.totalCostUsd - project.projectLead.budgetCapUsd).toLocaleString()}. Improve your campaign prompt to earn a higher sponsorship tier.`
    );
  }

  if (summary.leadTimeConflict) {
    projectLeadPassed = false;
    failures.push(
      `Business Lead: Longest component delivery lead time (${summary.maxLeadTimeDays} days) exceeds competition deadline (${PROJECT_LEAD_SPECS.competitionDeadlineDays} days). Robot will not be ready in time.`
    );
  }

  if (!project.projectLead.complianceSigned && (project.projectLead.sponsorshipUsd || 0) === 0 && (project.projectLead.activeSponsors || []).length === 0) {
    projectLeadPassed = false;
    failures.push(
      `Business Lead: Technical Inspection sign-off and sponsorship campaign have not been accepted.`
    );
  }

  if (project.projectLead.sparePartsKit === 'none') {
    warnings.push(
      `Project Note: No pit spare parts purchased. If drive or weapon sustain structural damage, repairs between heats will not be possible.`
    );
  }

  const overallPassed =
    mechanicalPassed &&
    electricalPassed &&
    softwarePassed &&
    projectLeadPassed &&
    failures.length === 0;

  return {
    overallPassed,
    mechanicalPassed,
    electricalPassed,
    softwarePassed,
    projectLeadPassed,
    failures,
    warnings,
  };
}

