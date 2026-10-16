import { ARMOR_CATALOG, ARMOR_THICKNESS_OPTIONS, BATTERY_CATALOG, CHASSIS_CATALOG, DRIVE_CATALOG, MAX_ROBOT_WEIGHT_LB, UTILITY_CATALOG, WEAPON_CATALOG, WHEELS_CATALOG } from '../data/components';
import { type ConsequenceChange, type EngineeringStats, type EngineeringWarning, type LevelRating, type RobotConfiguration, type StabilityRating, type TurningRating } from '../types/robot';

function formatRuntime(seconds: number): string {
  const clamped = Math.max(30, Math.round(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function calculateEngineeringStats(config: RobotConfiguration): EngineeringStats {
  const chassis = CHASSIS_CATALOG[config.chassisId];
  const drive = DRIVE_CATALOG[config.driveId];
  const wheels = WHEELS_CATALOG[config.wheelsId];
  const armorMat = ARMOR_CATALOG[config.armorId];
  const armorThick = ARMOR_THICKNESS_OPTIONS[config.armorThickness];
  const battery = BATTERY_CATALOG[config.batteryId];

  // Resolve weapon (standard or AI custom)
  const customWeapon = config.weaponId === 'custom-weapon' ? config.customWeapon : null;
  const stdWeapon =
    config.weaponId !== 'custom-weapon' ? WEAPON_CATALOG[config.weaponId] : WEAPON_CATALOG.wedge;

  const weaponWeightLb = customWeapon ? customWeapon.mass : stdWeapon.weightLb;
  const weaponPeakPowerKw = customWeapon ? customWeapon.powerDraw : stdWeapon.peakPowerKw;
  const weaponAvgPowerKw = customWeapon ? customWeapon.powerDraw * 0.44 : stdWeapon.avgPowerKw;
  const rawWeaponEnergyJ = customWeapon ? customWeapon.weaponEnergyPotential : stdWeapon.energyJ;
  const rawSpinUpSec = customWeapon ? customWeapon.spinUpSec : stdWeapon.spinUpSec;
  const rawRecoilScore = customWeapon ? customWeapon.recoilScore : stdWeapon.recoilScore;
  const weaponComDelta = customWeapon ? customWeapon.centerOfMassEffect : stdWeapon.comDeltaInches;

  // Resolve utility (standard or AI custom)
  const customUtil = config.utilityId === 'custom-utility' ? config.customUtility : null;
  const stdUtil =
    config.utilityId !== 'custom-utility' ? UTILITY_CATALOG[config.utilityId] : UTILITY_CATALOG.none;

  const utilWeightLb = customUtil ? customUtil.mass : stdUtil.weightLb;
  const utilPowerKw = customUtil ? customUtil.powerDraw * 0.25 : stdUtil.powerDrawKw;
  const utilTractionBonus = customUtil ? customUtil.tractionEffect : stdUtil.tractionBonus;
  const utilStabilityBonus = customUtil ? customUtil.stabilityEffect : stdUtil.stabilityBonus;
  const utilTurnDelta = customUtil ? customUtil.turningEffect : 0;
  const utilComDelta = customUtil ? customUtil.centerOfMassEffect : stdUtil.comDeltaInches;

  // 1. MASS & WEIGHT CONSTRAINT
  // Armor weight scales slightly with chassis surface area and thickness
  const areaScale = (chassis.frontAreaFactor + chassis.sideAreaFactor) * 0.5;
  const armorWeightLb = Number(
    (armorMat.baseWeightLb * armorThick.weightMultiplier * (0.85 + 0.15 * areaScale)).toFixed(1)
  );

  const totalWeightLb = Number(
    (
      chassis.weightLb +
      drive.weightLb +
      wheels.weightLb +
      armorWeightLb +
      weaponWeightLb +
      battery.weightLb +
      utilWeightLb
    ).toFixed(1)
  );

  const isOverweight = totalWeightLb > MAX_ROBOT_WEIGHT_LB;
  const overweightLb = isOverweight ? Number((totalWeightLb - MAX_ROBOT_WEIGHT_LB).toFixed(1)) : 0;

  // 2. POWER & BATTERY INTERACTION
  const peakPowerDemandKw = Number(
    (drive.peakPowerKw + weaponPeakPowerKw + utilPowerKw).toFixed(2)
  );
  const batteryPeakSupplyKw = battery.peakSupplyKw;
  const powerLimited = peakPowerDemandKw > batteryPeakSupplyKw;
  // Power throttle factor when battery can't keep up with peak demand
  const powerDeliveryRatio = powerLimited
    ? Math.max(0.62, batteryPeakSupplyKw / peakPowerDemandKw)
    : 1.0;

  // Average continuous combat power draw (kW) -> Runtime
  const avgMassPenaltyKw = Math.max(0, (totalWeightLb - 20) * 0.018);
  const avgCombatDrawKw = Math.max(
    0.35,
    drive.continuousPowerKw + weaponAvgPowerKw + utilPowerKw + avgMassPenaltyKw
  );
  // Scale runtime so typical combat batteries show 1:45 to 5:15 in continuous arena load
  const runtimeSeconds = Math.round((battery.capacityWh / (avgCombatDrawKw * 24)) * 60);
  const runtimeFormatted = formatRuntime(runtimeSeconds);

  // 3. TOP SPEED & ACCELERATION
  // Heavier robots lose a bit of top speed and noticeable acceleration
  const massFactor = Math.max(0.72, 1.15 - (totalWeightLb / 30.0) * 0.25);
  const topSpeedMph = Number(
    (
      drive.topSpeedMphBase *
      chassis.baseSpeedFactor *
      wheels.speedMultiplier *
      stdUtil.speedMultiplier *
      (0.88 + 0.12 * massFactor) *
      (powerLimited ? 0.92 : 1.0)
    ).toFixed(1)
  );

  const accelerationMphPerSec = Number(
    (
      (drive.torqueNm / Math.max(14, totalWeightLb)) *
      5.2 *
      wheels.accelMultiplier *
      powerDeliveryRatio
    ).toFixed(1)
  );
  const zeroToTenSec = Number(Math.max(0.55, 10 / Math.max(2.5, accelerationMphPerSec)).toFixed(2));

  // 4. TRACTION & PUSHING FORCE
  const customWeaponTraction = customWeapon ? customWeapon.tractionEffect : 0;
  const tractionCoeff = Number(
    Math.max(0.3, Math.min(1.35, wheels.tractionCoeff + utilTractionBonus + customWeaponTraction)).toFixed(2)
  );

  let tractionLabel: LevelRating = 'MODERATE';
  if (tractionCoeff >= 1.0) tractionLabel = 'EXTREME';
  else if (tractionCoeff >= 0.85) tractionLabel = 'HIGH';
  else if (tractionCoeff < 0.55) tractionLabel = 'LOW';

  // Normal force in Newtons: 1 lb ≈ 4.44822 N. Downforce module adds virtual normal force!
  const virtualDownforceLb = config.utilityId === 'traction-module' ? 6.5 : 0;
  const normalForceN = (totalWeightLb + virtualDownforceLb) * 4.44822;
  const maxTractionForceN = normalForceN * tractionCoeff * 1.45;
  // Drive wheel tangential force from motor torque & wheel radius
  const wheelRadiusFactor = config.wheelsId === 'small' ? 1.14 : config.wheelsId === 'large' ? 0.86 : 1.0;
  const maxDriveForceN = drive.torqueNm * 4.6 * wheelRadiusFactor * powerDeliveryRatio;

  // Pushing force is bounded by whichever is lower (with slight blend), and wheel slip occurs if drive > traction!
  const wheelSlipLikely = maxDriveForceN > maxTractionForceN * 1.08;
  const pushingForceN = Math.round(
    Math.min(maxDriveForceN, maxTractionForceN) +
      Math.abs(maxDriveForceN - maxTractionForceN) * 0.12
  );

  // 5. TURNING PERFORMANCE
  const rawTurnRate =
    145 *
    chassis.turnRateFactor *
    wheels.turnMultiplier *
    stdUtil.turnMultiplier *
    (0.85 + 0.15 * massFactor) +
    utilTurnDelta +
    (customWeapon ? customWeapon.turningEffect : 0);
  const turningRateDegPerSec = Math.round(Math.max(65, Math.min(240, rawTurnRate)));

  let turningLabel: TurningRating = 'MODERATE';
  if (turningRateDegPerSec >= 180) turningLabel = 'RAPID';
  else if (turningRateDegPerSec >= 145) turningLabel = 'AGILE';
  else if (turningRateDegPerSec < 112) turningLabel = 'SLOW';

  // 6. CENTER OF MASS & STABILITY
  const baseComInches = 2.1;
  const armorComShift = config.armorThickness === 'thick' ? 0.14 : config.armorThickness === 'thin' ? -0.06 : 0;
  const centerOfMassInches = Number(
    Math.max(
      1.1,
      baseComInches +
        chassis.comHeightDelta +
        wheels.comDeltaInches +
        weaponComDelta +
        utilComDelta +
        armorComShift
    ).toFixed(2)
  );

  let centerOfMassLabel: 'LOW' | 'MODERATE' | 'HIGH' = 'MODERATE';
  if (centerOfMassInches <= 1.85) centerOfMassLabel = 'LOW';
  else if (centerOfMassInches >= 2.45) centerOfMassLabel = 'HIGH';

  // Weapon recoil & effective energy
  const effectiveWeaponEnergyJ = Math.round(
    rawWeaponEnergyJ * (powerLimited ? Math.pow(powerDeliveryRatio, 1.2) : 1.0)
  );
  const effectiveSpinUpSec =
    rawSpinUpSec > 0
      ? Number((rawSpinUpSec / Math.max(0.65, powerDeliveryRatio)).toFixed(1))
      : 0;

  const guardRecoilReduction = config.utilityId === 'weapon-guard' ? 14 : 0;
  const weaponRecoilScore = Math.max(
    0,
    Math.min(100, Math.round(rawRecoilScore - guardRecoilReduction - (totalWeightLb - 22) * 0.9))
  );

  let weaponRecoilLabel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME' = 'LOW';
  if (weaponRecoilScore <= 8) weaponRecoilLabel = 'NONE';
  else if (weaponRecoilScore <= 28) weaponRecoilLabel = 'LOW';
  else if (weaponRecoilScore <= 58) weaponRecoilLabel = 'MODERATE';
  else if (weaponRecoilScore <= 78) weaponRecoilLabel = 'HIGH';
  else weaponRecoilLabel = 'EXTREME';

  // Stability score (0-100)
  const rawStability =
    68 +
    chassis.stabilityBonus +
    utilStabilityBonus +
    (customWeapon ? customWeapon.stabilityEffect : 0) -
    (centerOfMassInches - 2.0) * 26 -
    weaponRecoilScore * 0.28 +
    (totalWeightLb - 22) * 0.8;

  const stabilityScore = Math.max(15, Math.min(98, Math.round(rawStability)));
  let stabilityLabel: StabilityRating = 'MODERATE';
  if (stabilityScore >= 80) stabilityLabel = 'HIGH';
  else if (stabilityScore >= 64) stabilityLabel = 'GOOD';
  else if (stabilityScore >= 46) stabilityLabel = 'MODERATE';
  else if (stabilityScore >= 32) stabilityLabel = 'LOW';
  else stabilityLabel = 'CRITICAL';

  // 7. MOTOR THERMAL LOAD
  const lowProfileHeatPenalty = config.chassisId === 'low-profile' ? 6 : 0;
  const heavyLoadHeat = Math.max(0, (totalWeightLb - 24) * 2.2);
  const weaponLoadHeat = weaponPeakPowerKw * 6.5;
  const expectedMotorTempC = Math.round(
    Math.max(
      42,
      34 +
        drive.thermalRiseC +
        lowProfileHeatPenalty +
        heavyLoadHeat +
        weaponLoadHeat -
        stdUtil.coolingBonusC
    )
  );
  const thermalRisk = expectedMotorTempC >= 85;

  // 8. ARMOR PROTECTION & SELF-RIGHTING
  const baseArmorPts = armorMat.protectionRating * armorThick.protectionMultiplier;
  const customWeaponArmor = customWeapon
    ? customWeapon.armorEffect
    : { front: stdWeapon.frontDeflectionBonus, side: 0, rear: 0 };
  const customUtilArmor = customUtil
    ? customUtil.armorEffect
    : {
        front: stdUtil.frontArmorBonus,
        side: stdUtil.sideArmorBonus,
        rear: stdUtil.rearArmorBonus,
      };

  const frontArmorScore = Math.round(
    Math.min(140, baseArmorPts + customWeaponArmor.front + customUtilArmor.front)
  );
  const sideArmorScore = Math.round(
    Math.min(130, baseArmorPts * 0.88 + customWeaponArmor.side + customUtilArmor.side)
  );
  const rearArmorScore = Math.round(
    Math.min(130, baseArmorPts * 0.82 + customWeaponArmor.rear + customUtilArmor.rear)
  );

  const wheelsProtected =
    stdUtil.protectsWheels ||
    config.wheelsId === 'tracks' ||
    Boolean(customUtil && customUtil.armorEffect.side >= 18);

  let selfRightingLabel: 'RELIABLE' | 'POSSIBLE' | 'UNABLE' = 'UNABLE';
  if (stdUtil.enablesSelfRighting || stdWeapon.selfRightingCapable) {
    selfRightingLabel = 'RELIABLE';
  } else if (wheels.selfRightingAssist || config.weaponId === 'vertical-spinner') {
    selfRightingLabel = 'POSSIBLE';
  }

  // Weapon category & control score
  let weaponTypeCategory: EngineeringStats['weaponTypeCategory'] = stdWeapon.typeCategory;
  let weaponControlScore = stdWeapon.controlScore;
  if (customWeapon) {
    if (customWeapon.impactType === 'lift') {
      weaponTypeCategory = 'lifter';
      weaponControlScore = 86;
    } else if (customWeapon.impactType === 'control') {
      weaponTypeCategory = 'grabber';
      weaponControlScore = 90;
    } else if (customWeapon.impactType === 'deflect') {
      weaponTypeCategory = 'wedge';
      weaponControlScore = 80;
    } else if (customWeapon.geometryType === 'side-flail-spinner') {
      weaponTypeCategory = 'spinner-horiz';
      weaponControlScore = 30;
    } else {
      weaponTypeCategory = 'spinner-vert';
      weaponControlScore = 40;
    }
  }

  // 9. NON-PRESCRIPTIVE WARNINGS & OBSERVATIONS
  const warnings: EngineeringWarning[] = [];

  if (isOverweight) {
    warnings.push({
      id: 'overweight',
      type: 'warning',
      text: `⚠ OVERWEIGHT (+${overweightLb.toFixed(1)} LB)`,
      detail: 'Robot exceeds the 30.0 LB maximum arena weight limit.',
    });
  }

  if (powerLimited) {
    warnings.push({
      id: 'power-limit',
      type: 'warning',
      text: '⚠ WEAPON DEMANDS MORE POWER THAN BATTERY CAN PROVIDE',
      detail: `Peak load (${peakPowerDemandKw} kW) exceeds battery supply (${batteryPeakSupplyKw} kW), causing voltage sag and slower spin-up.`,
    });
  }

  if (centerOfMassLabel === 'HIGH') {
    warnings.push({
      id: 'high-com',
      type: 'warning',
      text: '⚠ HIGH CENTER OF MASS',
      detail: `Elevated CoM (${centerOfMassInches}") increases tipping risk during sharp turns or lateral impacts.`,
    });
  }

  if (thermalRisk) {
    warnings.push({
      id: 'high-temp',
      type: 'warning',
      text: '⚠ HIGH MOTOR TEMPERATURE EXPECTED',
      detail: `Projected motor temperature (${expectedMotorTempC}°C) may cause thermal current limiting during sustained combat.`,
    });
  }

  if (tractionLabel === 'LOW' || wheelSlipLikely) {
    warnings.push({
      id: 'low-traction',
      type: 'warning',
      text: '⚠ LOW TRACTION',
      detail: wheelSlipLikely
        ? 'Drive torque exceeds available tire grip — wheels will slip under heavy pushing load.'
        : 'Low floor grip reduces pushing force and makes the robot easier to shove.',
    });
  }

  if (effectiveSpinUpSec >= 2.7) {
    warnings.push({
      id: 'long-spinup',
      type: 'warning',
      text: '⚠ LONG WEAPON SPIN-UP',
      detail: `Weapon requires ${effectiveSpinUpSec}s to reach peak kinetic energy between impacts.`,
    });
  }

  if (weaponRecoilLabel === 'HIGH' || weaponRecoilLabel === 'EXTREME') {
    warnings.push({
      id: 'high-recoil',
      type: 'warning',
      text: '⚠ HIGH RECOIL',
      detail: 'High-energy weapon impacts will transfer severe reaction forces back into the chassis.',
    });
  }

  // Positive observations
  if (centerOfMassLabel === 'LOW') {
    warnings.push({
      id: 'low-com',
      type: 'positive',
      text: '✓ LOW CENTER OF MASS',
      detail: `Low CoM (${centerOfMassInches}") resists tipping and keeps the front edge planted.`,
    });
  }

  if (pushingForceN >= 165 && !wheelSlipLikely) {
    warnings.push({
      id: 'strong-push',
      type: 'positive',
      text: '✓ STRONG PUSHING CONFIGURATION',
      detail: `Delivers ${pushingForceN} N of tractive pushing force to control arena engagements.`,
    });
  }

  if (wheelsProtected) {
    warnings.push({
      id: 'wheels-protected',
      type: 'positive',
      text: '✓ WHEELS PROTECTED',
      detail: 'Drive wheels are shielded against direct lateral strikes.',
    });
  }

  if (selfRightingLabel === 'RELIABLE') {
    warnings.push({
      id: 'self-righting-ok',
      type: 'positive',
      text: '✓ RELIABLE SELF-RIGHTING',
      detail: 'Active mechanism can recover the robot if overturned.',
    });
  }

  return {
    totalWeightLb,
    maxWeightLb: MAX_ROBOT_WEIGHT_LB,
    isOverweight,
    overweightLb,
    topSpeedMph,
    zeroToTenSec,
    accelerationMphPerSec,
    driveTorqueNm: drive.torqueNm,
    tractionCoeff,
    tractionLabel,
    pushingForceN,
    wheelSlipLikely,
    turningRateDegPerSec,
    turningLabel,
    centerOfMassInches,
    centerOfMassLabel,
    stabilityScore,
    stabilityLabel,
    groundClearanceInches:
      config.chassisId === 'low-profile'
        ? Math.max(0.2, wheels.clearanceInches - 0.15)
        : wheels.clearanceInches,
    weaponEnergyJ: effectiveWeaponEnergyJ,
    weaponSpinUpSec: effectiveSpinUpSec,
    weaponRecoilScore,
    weaponRecoilLabel,
    weaponControlScore,
    weaponTypeCategory,
    batteryCapacityWh: battery.capacityWh,
    batteryPeakSupplyKw,
    peakPowerDemandKw,
    powerLimited,
    runtimeSeconds,
    runtimeFormatted,
    expectedMotorTempC,
    thermalRisk,
    frontArmorScore,
    sideArmorScore,
    rearArmorScore,
    wheelsProtected,
    selfRightingLabel,
    armorWeightLb,
    warnings,
  };
}

export function computeInstallConsequences(
  prev: EngineeringStats,
  next: EngineeringStats
): ConsequenceChange[] {
  const changes: ConsequenceChange[] = [];

  if (Math.abs(next.totalWeightLb - prev.totalWeightLb) >= 0.1) {
    const up = next.totalWeightLb > prev.totalWeightLb;
    changes.push({
      label: 'WEIGHT',
      before: `${prev.totalWeightLb.toFixed(1)}`,
      after: `${next.totalWeightLb.toFixed(1)} LB`,
      direction: up ? 'up' : 'down',
      tone: next.isOverweight ? 'warn' : up ? 'neutral' : 'good',
    });
  }

  if (Math.abs(next.weaponEnergyJ - prev.weaponEnergyJ) >= 25) {
    const up = next.weaponEnergyJ > prev.weaponEnergyJ;
    changes.push({
      label: 'WEAPON ENERGY',
      before: `${prev.weaponEnergyJ.toLocaleString()}`,
      after: `${next.weaponEnergyJ.toLocaleString()} J`,
      direction: up ? 'up' : 'down',
      tone: up ? 'good' : 'neutral',
    });
  }

  if (Math.abs(next.pushingForceN - prev.pushingForceN) >= 6) {
    const up = next.pushingForceN > prev.pushingForceN;
    changes.push({
      label: 'PUSHING FORCE',
      before: `${prev.pushingForceN}`,
      after: `${next.pushingForceN} N`,
      direction: up ? 'up' : 'down',
      tone: up ? 'good' : 'warn',
    });
  }

  if (Math.abs(next.topSpeedMph - prev.topSpeedMph) >= 0.4) {
    const up = next.topSpeedMph > prev.topSpeedMph;
    changes.push({
      label: 'TOP SPEED',
      before: `${prev.topSpeedMph.toFixed(1)}`,
      after: `${next.topSpeedMph.toFixed(1)} MPH`,
      direction: up ? 'up' : 'down',
      tone: up ? 'good' : 'warn',
    });
  }

  if (Math.abs(next.runtimeSeconds - prev.runtimeSeconds) >= 8) {
    const up = next.runtimeSeconds > prev.runtimeSeconds;
    changes.push({
      label: 'RUNTIME',
      before: prev.runtimeFormatted,
      after: next.runtimeFormatted,
      direction: up ? 'up' : 'down',
      tone: up ? 'good' : 'warn',
    });
  }

  if (prev.stabilityLabel !== next.stabilityLabel || Math.abs(next.stabilityScore - prev.stabilityScore) >= 6) {
    const up = next.stabilityScore > prev.stabilityScore;
    changes.push({
      label: 'STABILITY',
      before: prev.stabilityLabel,
      after: next.stabilityLabel,
      direction: up ? 'up' : 'down',
      tone: up ? 'good' : 'warn',
    });
  }

  if (Math.abs(next.frontArmorScore - prev.frontArmorScore) >= 5) {
    const up = next.frontArmorScore > prev.frontArmorScore;
    changes.push({
      label: 'ARMOR PROTECTION',
      before: `${prev.frontArmorScore}`,
      after: `${next.frontArmorScore} PTS`,
      direction: up ? 'up' : 'down',
      tone: up ? 'good' : 'warn',
    });
  }

  if (Math.abs(next.expectedMotorTempC - prev.expectedMotorTempC) >= 4) {
    const up = next.expectedMotorTempC > prev.expectedMotorTempC;
    changes.push({
      label: 'MOTOR TEMP',
      before: `${prev.expectedMotorTempC}°C`,
      after: `${next.expectedMotorTempC}°C`,
      direction: up ? 'up' : 'down',
      tone: up ? 'warn' : 'good',
    });
  }

  return changes.slice(0, 4);
}

// THE BULL's specialized engineering stats:
// Heavy (29.8 LB), thick front plow, high pushing force, slower turning, exposed sides/rear
export function calculateBullStats(): EngineeringStats {
  return {
    totalWeightLb: 29.8,
    maxWeightLb: 30.0,
    isOverweight: false,
    overweightLb: 0,
    topSpeedMph: 12.2,
    zeroToTenSec: 1.45,
    accelerationMphPerSec: 6.9,
    driveTorqueNm: 50,
    tractionCoeff: 0.88,
    tractionLabel: 'HIGH',
    pushingForceN: 174,
    wheelSlipLikely: false,
    turningRateDegPerSec: 94, // Slower turning! Vulnerable to flanking & nimble positioning
    turningLabel: 'SLOW',
    centerOfMassInches: 2.05,
    centerOfMassLabel: 'MODERATE',
    stabilityScore: 72,
    stabilityLabel: 'GOOD',
    groundClearanceInches: 0.42, // Low front plow, but dedicated low-profile wedges/lifters can slip under or flank
    weaponEnergyJ: 520, // Heavy ramming bull-horn plow
    weaponSpinUpSec: 0.0,
    weaponRecoilScore: 10,
    weaponRecoilLabel: 'LOW',
    weaponControlScore: 76,
    weaponTypeCategory: 'wedge',
    batteryCapacityWh: 96,
    batteryPeakSupplyKw: 3.8,
    peakPowerDemandKw: 1.8,
    powerLimited: false,
    runtimeSeconds: 220,
    runtimeFormatted: '3:40',
    expectedMotorTempC: 76,
    thermalRisk: false,
    frontArmorScore: 122, // Massively armored front bull plow
    sideArmorScore: 54, // Less protected from side engagement
    rearArmorScore: 46, // Less protected from rear engagement
    wheelsProtected: false,
    selfRightingLabel: 'UNABLE', // Cannot self-right if flipped!
    armorWeightLb: 9.8,
    warnings: [],
  };
}
