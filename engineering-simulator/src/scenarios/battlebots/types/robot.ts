export type ComponentCategory =
  | 'chassis'
  | 'drive'
  | 'wheels'
  | 'armor'
  | 'weapon'
  | 'power'
  | 'utility';

export type ChassisId = 'compact' | 'wide' | 'long' | 'low-profile';
export type DriveId = 'speed' | 'torque' | 'balanced' | 'lightweight';
export type WheelsId = 'small' | 'large' | 'high-traction' | 'omni' | 'tracks';
export type ArmorId = 'polycarbonate' | 'aluminum' | 'titanium' | 'steel';
export type ArmorThickness = 'thin' | 'medium' | 'thick';
export type WeaponId =
  | 'vertical-spinner'
  | 'horizontal-spinner'
  | 'lifter'
  | 'hammer'
  | 'wedge'
  | 'grabber'
  | 'custom-weapon';
export type BatteryId = 'small' | 'medium' | 'large';
export type UtilityId =
  | 'none'
  | 'wheel-guards'
  | 'self-righting'
  | 'extra-cooling'
  | 'rear-wedge'
  | 'weapon-guard'
  | 'traction-module'
  | 'custom-utility';

export type AutonomousStrategy = 'aggressive' | 'control' | 'defensive';

export type CustomGeometryType =
  | 'twin-clamp'
  | 'armored-plow-guards'
  | 'side-flail-spinner'
  | 'eccentric-flipper-forks'
  | 'overhead-kinetic-pick'
  | 'high-rpm-mini-drum';

export interface CustomGeometryParameters {
  primaryColor: string;
  secondaryColor: string;
  armCount: number;
  lengthScale: number;
  spreadScale: number;
  discRadius: number;
  plateAngleDeg: number;
}

export interface CustomComponentSpec {
  id: 'custom-weapon' | 'custom-utility';
  name: string;
  category: 'weapon' | 'utility';
  promptUsed: string;
  description: string;
  geometryType: CustomGeometryType;
  geometryParameters: CustomGeometryParameters;
  mass: number;
  powerDraw: number;
  impactType: 'kinetic' | 'lift' | 'control' | 'deflect' | 'hybrid';
  weaponEnergyPotential: number;
  durability: number;
  tractionEffect: number;
  stabilityEffect: number;
  turningEffect: number;
  centerOfMassEffect: number;
  armorEffect: {
    front: number;
    side: number;
    rear: number;
  };
  spinUpSec: number;
  recoilScore: number;
  complexity: 'LOW' | 'MODERATE' | 'HIGH';
  pros: string[];
  tradeoffs: string[];
  visualDescription: string;
  constraintExplanation?: string;
}

export interface RobotConfiguration {
  name: string;
  chassisId: ChassisId;
  driveId: DriveId;
  wheelsId: WheelsId;
  armorId: ArmorId;
  armorThickness: ArmorThickness;
  weaponId: WeaponId;
  batteryId: BatteryId;
  utilityId: UtilityId;
  accentColor: string;
  customWeapon?: CustomComponentSpec | null;
  customUtility?: CustomComponentSpec | null;
}

export interface ComponentCardSpec<T extends string = string> {
  id: T;
  category: ComponentCategory;
  name: string;
  subtitle: string;
  weightLb: number;
  costUsd?: number;
  leadTimeDays?: number;
  peakCurrentA?: number;
  continuousCurrentA?: number;
  pros: string[];
  cons: string[];
  engineeringDetail: {
    materialOrSpec: string;
    technicalNote: string;
    keyMetrics: { label: string; value: string }[];
  };
}

export type LevelRating = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
export type StabilityRating = 'CRITICAL' | 'LOW' | 'MODERATE' | 'GOOD' | 'HIGH';
export type TurningRating = 'SLOW' | 'MODERATE' | 'AGILE' | 'RAPID';

export interface EngineeringWarning {
  id: string;
  type: 'warning' | 'positive';
  text: string;
  detail: string;
}

export interface EngineeringStats {
  totalWeightLb: number;
  maxWeightLb: number;
  isOverweight: boolean;
  overweightLb: number;

  topSpeedMph: number;
  zeroToTenSec: number;
  accelerationMphPerSec: number;
  driveTorqueNm: number;
  tractionCoeff: number;
  tractionLabel: LevelRating;
  pushingForceN: number;
  wheelSlipLikely: boolean;
  turningRateDegPerSec: number;
  turningLabel: TurningRating;

  centerOfMassInches: number;
  centerOfMassLabel: 'LOW' | 'MODERATE' | 'HIGH';
  stabilityScore: number;
  stabilityLabel: StabilityRating;
  groundClearanceInches: number;

  weaponEnergyJ: number;
  weaponSpinUpSec: number;
  weaponRecoilScore: number;
  weaponRecoilLabel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  weaponControlScore: number;
  weaponTypeCategory: 'spinner-vert' | 'spinner-horiz' | 'lifter' | 'hammer' | 'wedge' | 'grabber';

  batteryCapacityWh: number;
  batteryPeakSupplyKw: number;
  peakPowerDemandKw: number;
  powerLimited: boolean;
  runtimeSeconds: number;
  runtimeFormatted: string;
  expectedMotorTempC: number;
  thermalRisk: boolean;

  frontArmorScore: number;
  sideArmorScore: number;
  rearArmorScore: number;
  wheelsProtected: boolean;
  selfRightingLabel: 'RELIABLE' | 'POSSIBLE' | 'UNABLE';
  armorWeightLb: number;

  warnings: EngineeringWarning[];
}

export interface ConsequenceChange {
  label: string;
  before: string;
  after: string;
  direction: 'up' | 'down' | 'neutral';
  tone: 'good' | 'warn' | 'neutral';
}

export interface InstallConsequenceToast {
  id: number;
  componentName: string;
  category: ComponentCategory;
  changes: ConsequenceChange[];
}

export type AppScreen =
  | 'welcome'
  | 'mission'
  | 'team-dashboard'
  | 'mechanical'
  | 'electrical'
  | 'software'
  | 'project-lead'
  | 'integration'
  | 'workshop'
  | 'test-lab'
  | 'boss-intro'
  | 'arena';

export type TeamRole = 'mechanical' | 'electrical' | 'software' | 'project-lead';

export type PartCondition = 'new' | 'refurbished' | 'used';

export interface PurchasedMechanicalPart {
  category: ComponentCategory;
  partId: string;
  condition: PartCondition;
  costUsd: number;
  weightLb: number;
  name: string;
  assembled?: boolean;
}

export type MechanicalWorkflowStage = 'marketplace' | 'delivery' | 'workbench' | 'inspection';

export interface MechanicalConfiguration {
  chassisId: ChassisId;
  driveId: DriveId;
  wheelsId: WheelsId;
  armorId: ArmorId;
  armorThickness: ArmorThickness;
  weaponId: WeaponId;
  utilityId: UtilityId;
  accentColor: string;
  isCompleted: boolean;
  // Dynamic Mechanical Workflow state
  purchasedParts?: Record<string, PurchasedMechanicalPart>;
  assembledParts?: string[];
  workflowStage?: MechanicalWorkflowStage;
  partsDelivered?: boolean;
  inspectionPassed?: boolean;
}

export type BatteryType = BatteryId;
export type DriveEscRating = 35 | 50 | 70;
export type WeaponEscRating = 40 | 80 | 120;
export type CurrentLimiterOption = 0 | 100 | 120 | 140; // 0 = uncapped
export type CoolingSystemOption = 'passive' | 'fan' | 'copper';

export interface WireConnection {
  id: string;
  fromPort: string;
  toPort: string;
}

export interface ElectricalConfiguration {
  batteryId: BatteryType;
  driveEscRatingA: DriveEscRating;
  weaponEscRatingA: WeaponEscRating;
  currentLimiterA: CurrentLimiterOption;
  coolingSystem: CoolingSystemOption;
  wires: WireConnection[];
  wiringVerified: boolean;
  isCompleted: boolean;
}

export type SoftwareSensorId =
  | 'opponent_distance'
  | 'opponent_angle'
  | 'weapon_ready'
  | 'robot_tilt'
  | 'front_contact';

export type SoftwareActionId =
  | 'full_charge'
  | 'approach'
  | 'flank_target'
  | 'back_away'
  | 'turn_toward'
  | 'recover_self_right';

export interface BehaviorRule {
  id: string;
  sensor: SoftwareSensorId;
  conditionValue: string; // e.g. 'close', 'front', 'yes', 'flipped', 'touching'
  action: SoftwareActionId;
  label: string;
}

export type SoftwareApproachDecision = 'charge' | 'careful' | 'flank';
export type SoftwareAttackDecision = 'immediate' | 'line_up' | 'back_off';
export type SoftwareRecoveryDecision = 'reverse_turn' | 'self_right' | 'keep_attacking';

export interface SoftwareConfiguration {
  computerConnected: boolean;
  bugsFixed: boolean;
  softwareUploaded: boolean;
  codeContent: string;
  initialScript?: string;
  approach: SoftwareApproachDecision;
  attack: SoftwareAttackDecision;
  recovery: SoftwareRecoveryDecision;
  rules: BehaviorRule[];
  sensorPackage: 'basic' | 'ultrasonic' | 'lidar';
  isCompleted: boolean;
  testPassed: boolean;
}

export type SponsorTier = 'None' | 'Bronze' | 'Silver' | 'Gold';

export interface ActiveSponsorship {
  sponsorId: string;
  sponsorName: string;
  amountUsd: number;
  tier: 'Bronze' | 'Silver' | 'Gold';
}

export interface MarketingCampaign {
  robotName: string;
  headline: string;
  theme: 'aggressive' | 'tech' | 'armored' | 'speed';
  approved: boolean;
}

export interface ProjectLeadConfiguration {
  baseBudgetUsd: number; // 1800
  budgetCapUsd: number; // baseBudgetUsd + sponsorshipUsd
  sponsorshipUsd: number; // 0, 200, 400, 700
  sponsorTier: SponsorTier;
  adPrompt: string;
  adHeadline: string;
  campaignScore: number;
  activeSponsors: ActiveSponsorship[];
  campaign: MarketingCampaign | null;
  shippingTier: 'standard' | 'expedited';
  sparePartsKit: 'none' | 'drive' | 'full';
  complianceSigned: boolean;
  isCompleted: boolean;
}

export interface SystemIntegrationReport {
  overallPassed: boolean;
  mechanicalPassed: boolean;
  electricalPassed: boolean;
  softwarePassed: boolean;
  projectLeadPassed: boolean;
  failures: string[];
  warnings: string[];
}

export interface TeamRobotProject {
  teamName: string;
  activeRole: TeamRole | null;
  mechanical: MechanicalConfiguration;
  electrical: ElectricalConfiguration;
  software: SoftwareConfiguration;
  projectLead: ProjectLeadConfiguration;
  derivedStats: EngineeringStats;
  integration: SystemIntegrationReport;
  lastBattleResult: BattleAnalysisReport | null;
}

export type TestLabType = 'speed' | 'push' | 'weapon' | 'stability' | 'power';

export interface BattleEventLog {
  id: number;
  timeSec: number;
  text: string;
  type: 'info' | 'impact' | 'warning' | 'critical';
}

export interface CombatantTelemetry {
  x: number;
  z: number;
  headingRad: number;
  vx: number;
  vz: number;
  pitchRad: number;
  rollRad: number;
  isFlipped: boolean;
  flipTimerSec: number;

  batteryPct: number;
  motorTempC: number;
  weaponSpinPct: number;
  weaponActuationPhase: number;
  isGrabbing: boolean;

  hullIntegrityPct: number;
  frontArmorPct: number;
  sideArmorPct: number;
  rearArmorPct: number;
  leftDriveHealthPct: number;
  rightDriveHealthPct: number;
  weaponHealthPct: number;

  aiStateLabel: 'SENSE' | 'APPROACH' | 'FLANK' | 'ENGAGE' | 'RECOVER' | 'EVADE' | 'PUSH';
}

export interface SparkBurst {
  id: number;
  x: number;
  y: number;
  z: number;
  color: string;
  intensity: number;
  age: number;
}

export type BossId = 'bull' | 'scorpion' | 'cyclone' | 'spider' | 'titan';

export interface BossDossier {
  id: BossId;
  name: string;
  subtitle: string;
  icon: string;
  tier: number;
  tagline: string;
  weightLb: number;
  config: RobotConfiguration;
  stats: EngineeringStats;
  strengths: string[];
  vulnerabilities: string[];
  engineeringLesson: string;
  lore: string;
}

export interface BossProgressionState {
  unlockedIndex: number;
  currentBossId: BossId;
  bossVictories: Partial<Record<BossId, boolean>>;
}

export interface BattleAnalysisReport {
  winner: 'player' | 'bull' | 'boss';
  winReason: string;
  durationSec: number;
  strategyUsed: AutonomousStrategy;
  playerFinal: CombatantTelemetry;
  bullFinal: CombatantTelemetry;
  bossDossier?: BossDossier;
  playerStats: EngineeringStats;
  headlineSummary: string;
  engineeringEvidence: string[];
  majorEvents: string[];
  peakMotorTempC: number;
  impactsDelivered: number;
  lateralImpactsTaken: number;
  flipsInflicted: number;
  pushDominanceRatio: number;
}

