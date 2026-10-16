import { type ArmorId, type ArmorThickness, type BatteryId, type ChassisId, type ComponentCardSpec, type DriveId, type RobotConfiguration, type UtilityId, type WeaponId, type WheelsId } from '../types/robot';

export const MAX_ROBOT_WEIGHT_LB = 30.0;

export interface ChassisSpec extends ComponentCardSpec<ChassisId> {
  baseSpeedFactor: number;
  turnRateFactor: number;
  stabilityBonus: number;
  comHeightDelta: number;
  frontAreaFactor: number;
  sideAreaFactor: number;
  dims: { width: number; length: number; height: number };
}

export interface DriveSpec extends ComponentCardSpec<DriveId> {
  topSpeedMphBase: number;
  torqueNm: number;
  peakPowerKw: number;
  continuousPowerKw: number;
  thermalRiseC: number;
}

export interface WheelsSpec extends ComponentCardSpec<WheelsId> {
  speedMultiplier: number;
  accelMultiplier: number;
  tractionCoeff: number;
  turnMultiplier: number;
  comDeltaInches: number;
  clearanceInches: number;
  selfRightingAssist: boolean;
}

export interface ArmorMaterialSpec extends ComponentCardSpec<ArmorId> {
  baseWeightLb: number;
  protectionRating: number;
  colorHex: string;
  metalness: number;
  roughness: number;
  opacity?: number;
}

export interface ArmorThicknessSpec {
  id: ArmorThickness;
  label: string;
  thicknessMm: number;
  weightMultiplier: number;
  protectionMultiplier: number;
  visualScale: number;
  description: string;
}

export interface WeaponSpec extends ComponentCardSpec<WeaponId> {
  energyJ: number;
  spinUpSec: number;
  peakPowerKw: number;
  avgPowerKw: number;
  recoilScore: number;
  controlScore: number;
  comDeltaInches: number;
  frontDeflectionBonus: number;
  selfRightingCapable: boolean;
  typeCategory: 'spinner-vert' | 'spinner-horiz' | 'lifter' | 'hammer' | 'wedge' | 'grabber';
}

export interface BatterySpec extends ComponentCardSpec<BatteryId> {
  capacityWh: number;
  peakSupplyKw: number;
  voltageNominalV: number;
}

export interface UtilitySpec extends ComponentCardSpec<UtilityId> {
  powerDrawKw: number;
  tractionBonus: number;
  speedMultiplier: number;
  turnMultiplier: number;
  coolingBonusC: number;
  frontArmorBonus: number;
  sideArmorBonus: number;
  rearArmorBonus: number;
  comDeltaInches: number;
  stabilityBonus: number;
  protectsWheels: boolean;
  enablesSelfRighting: boolean;
  weaponDurabilityBonus: number;
}

export const CHASSIS_CATALOG: Record<ChassisId, ChassisSpec> = {
  compact: {
    id: 'compact',
    category: 'chassis',
    name: 'COMPACT',
    subtitle: 'Agile short-wheelbase frame',
    weightLb: 5.2,
    pros: ['Lightweight frame frees mass budget', 'Quick turning & nimble rotation'],
    cons: ['Limited attachment space', 'Lower roll & pitch stability under recoil'],
    baseSpeedFactor: 1.06,
    turnRateFactor: 1.24,
    stabilityBonus: -10,
    comHeightDelta: 0.1,
    frontAreaFactor: 0.9,
    sideAreaFactor: 0.85,
    dims: { width: 1.35, length: 1.4, height: 0.42 },
    engineeringDetail: {
      materialOrSpec: '6061-T6 Pocketed Billet Frame',
      technicalNote: 'Low polar moment of inertia accelerates yaw rotation but reduces tipping footprint.',
      keyMetrics: [
        { label: 'Footprint', value: '14" × 14"' },
        { label: 'Yaw Inertia', value: 'Low (Agile)' },
      ],
    },
  },
  wide: {
    id: 'wide',
    category: 'chassis',
    name: 'WIDE',
    subtitle: 'Broad stance pushing platform',
    weightLb: 7.4,
    pros: ['Exceptionally stable lateral stance', 'Strong pushing & ramming platform'],
    cons: ['Heavier structural mass', 'Slower turning velocity'],
    baseSpeedFactor: 0.96,
    turnRateFactor: 0.84,
    stabilityBonus: 18,
    comHeightDelta: -0.1,
    frontAreaFactor: 1.25,
    sideAreaFactor: 0.95,
    dims: { width: 1.9, length: 1.55, height: 0.42 },
    engineeringDetail: {
      materialOrSpec: 'Welded Chromoly & Gusseted Bulkhead',
      technicalNote: 'Wide track width resists roll moments and distributes frontal impact loads.',
      keyMetrics: [
        { label: 'Footprint', value: '20" × 15.5"' },
        { label: 'Roll Resistance', value: '+35%' },
      ],
    },
  },
  long: {
    id: 'long',
    category: 'chassis',
    name: 'LONG',
    subtitle: 'Extended wheelbase weapon carrier',
    weightLb: 6.8,
    pros: ['High directional pitch stability', 'Generous front attachment room & recoil leverage'],
    cons: ['Slower yaw rotation', 'Larger side target profile'],
    baseSpeedFactor: 1.02,
    turnRateFactor: 0.8,
    stabilityBonus: 12,
    comHeightDelta: 0.0,
    frontAreaFactor: 0.95,
    sideAreaFactor: 1.3,
    dims: { width: 1.45, length: 2.0, height: 0.42 },
    engineeringDetail: {
      materialOrSpec: 'Twin-Rail Box Section Chassis',
      technicalNote: 'Longitudinal lever arm prevents forward nose-diving during vertical spinner recoil.',
      keyMetrics: [
        { label: 'Footprint', value: '15" × 21"' },
        { label: 'Pitch Stability', value: 'High' },
      ],
    },
  },
  'low-profile': {
    id: 'low-profile',
    category: 'chassis',
    name: 'LOW PROFILE',
    subtitle: 'Ground-hugging stealth geometry',
    weightLb: 6.1,
    pros: ['Ultra-low center of mass', 'Difficult for opponents to get underneath'],
    cons: ['Restricted internal volume (adds +6°C thermal buildup)', 'Tight ground clearance limits vertical travel'],
    baseSpeedFactor: 1.0,
    turnRateFactor: 1.05,
    stabilityBonus: 15,
    comHeightDelta: -0.45,
    frontAreaFactor: 0.82,
    sideAreaFactor: 0.82,
    dims: { width: 1.65, length: 1.65, height: 0.28 },
    engineeringDetail: {
      materialOrSpec: 'Flat-Pan Low-Slung Monocoque',
      technicalNote: 'Drops center of gravity by 0.45 in, dramatically lowering tipping torque during sharp turns.',
      keyMetrics: [
        { label: 'Deck Height', value: '2.8 in' },
        { label: 'Airflow Volume', value: 'Restricted' },
      ],
    },
  },
};

export const DRIVE_CATALOG: Record<DriveId, DriveSpec> = {
  speed: {
    id: 'speed',
    category: 'drive',
    name: 'SPEED DRIVE',
    subtitle: 'High-RPM brushless outrunners',
    weightLb: 3.8,
    pros: ['Fast top speed (up to 18+ MPH)', 'Rapid arena closing & flanking speed'],
    cons: ['Lower pushing torque in shoving matches', 'Higher power consumption & heat generation'],
    topSpeedMphBase: 17.5,
    torqueNm: 26,
    peakPowerKw: 1.45,
    continuousPowerKw: 0.72,
    thermalRiseC: 36,
    engineeringDetail: {
      materialOrSpec: 'Dual 2800KV Brushless + 8:1 Planetary',
      technicalNote: 'Tall gearing maximizes wheel surface speed at the expense of stall torque.',
      keyMetrics: [
        { label: 'Gear Ratio', value: '8:1' },
        { label: 'Peak Drive Draw', value: '1.45 kW' },
      ],
    },
  },
  torque: {
    id: 'torque',
    category: 'drive',
    name: 'TORQUE DRIVE',
    subtitle: 'High-reduction heavy gearmotors',
    weightLb: 5.4,
    pros: ['Massive pushing torque', 'Relentless shoving & control power'],
    cons: ['Heavy gearbox assembly', 'Lower top speed', 'High current draw under stall'],
    topSpeedMphBase: 11.2,
    torqueNm: 54,
    peakPowerKw: 1.55,
    continuousPowerKw: 0.78,
    thermalRiseC: 32,
    engineeringDetail: {
      materialOrSpec: 'Dual High-Torque Sensored + 22:1 Stage',
      technicalNote: 'Multiplies motor torque for pushing battles; requires high-traction tires to avoid wheelspin.',
      keyMetrics: [
        { label: 'Stall Torque', value: '54 N·m' },
        { label: 'Gear Ratio', value: '22:1' },
      ],
    },
  },
  balanced: {
    id: 'balanced',
    category: 'drive',
    name: 'BALANCED DRIVE',
    subtitle: 'All-around combat drivetrain',
    weightLb: 4.2,
    pros: ['Balanced speed and pushing torque', 'Predictable power & thermal behavior'],
    cons: ['Outrun by pure Speed drives', 'Out-pushed by dedicated Torque drives'],
    topSpeedMphBase: 14.4,
    torqueNm: 38,
    peakPowerKw: 1.15,
    continuousPowerKw: 0.56,
    thermalRiseC: 24,
    engineeringDetail: {
      materialOrSpec: 'Dual 1900KV Brushless + 14:1 Gearbox',
      technicalNote: 'Operates near peak motor efficiency curve across typical arena velocities.',
      keyMetrics: [
        { label: 'Stall Torque', value: '38 N·m' },
        { label: 'Gear Ratio', value: '14:1' },
      ],
    },
  },
  lightweight: {
    id: 'lightweight',
    category: 'drive',
    name: 'LIGHTWEIGHT DRIVE',
    subtitle: 'Compact micro-gearmotor pods',
    weightLb: 2.3,
    pros: ['Extremely light — saves ~2–3 LB for weapon or armor', 'Low average battery draw'],
    cons: ['Lower pushing force & acceleration', 'Rapid thermal saturation under heavy load'],
    topSpeedMphBase: 12.6,
    torqueNm: 21,
    peakPowerKw: 0.85,
    continuousPowerKw: 0.42,
    thermalRiseC: 46,
    engineeringDetail: {
      materialOrSpec: 'Compact 22mm Coreless Planetary Pods',
      technicalNote: 'Low thermal mass causes copper windings to heat quickly when pushing heavy loads.',
      keyMetrics: [
        { label: 'Stall Torque', value: '21 N·m' },
        { label: 'Thermal Mass', value: 'Low (46°C rise)' },
      ],
    },
  },
};

export const WHEELS_CATALOG: Record<WheelsId, WheelsSpec> = {
  small: {
    id: 'small',
    category: 'wheels',
    name: 'SMALL WHEELS',
    subtitle: 'Compact low-slung urethane hubs',
    weightLb: 1.6,
    pros: ['Low center of mass', 'Fast initial acceleration & snappy response'],
    cons: ['Low ground clearance', 'Cannot drive inverted if flipped'],
    speedMultiplier: 0.93,
    accelMultiplier: 1.18,
    tractionCoeff: 0.68,
    turnMultiplier: 1.1,
    comDeltaInches: -0.25,
    clearanceInches: 0.35,
    selfRightingAssist: false,
    engineeringDetail: {
      materialOrSpec: '3.0" Molded 70A Urethane Hubs',
      technicalNote: 'Small rolling radius increases effective tractive force for quick launches.',
      keyMetrics: [
        { label: 'Diameter', value: '3.0 in' },
        { label: 'Friction μ', value: '0.68' },
      ],
    },
  },
  large: {
    id: 'large',
    category: 'wheels',
    name: 'LARGE WHEELS',
    subtitle: 'Oversized all-terrain combat tires',
    weightLb: 3.1,
    pros: ['Good ground clearance', 'Allows driving inverted / assists self-righting'],
    cons: ['Heavy rotational mass', 'Raises center of mass'],
    speedMultiplier: 1.08,
    accelMultiplier: 0.88,
    tractionCoeff: 0.74,
    turnMultiplier: 0.95,
    comDeltaInches: 0.42,
    clearanceInches: 0.85,
    selfRightingAssist: true,
    engineeringDetail: {
      materialOrSpec: '5.5" Foam-Filled Exposed Rim Tires',
      technicalNote: 'Wheels extend above and below chassis deck, permitting inverted operation.',
      keyMetrics: [
        { label: 'Diameter', value: '5.5 in' },
        { label: 'Friction μ', value: '0.74' },
      ],
    },
  },
  'high-traction': {
    id: 'high-traction',
    category: 'wheels',
    name: 'HIGH-TRACTION WHEELS',
    subtitle: 'Soft-compound cleated Vulcollan',
    weightLb: 2.6,
    pros: ['Excellent pushing traction', 'Converts high motor torque into floor grip'],
    cons: ['Higher scrub resistance slows turning rate'],
    speedMultiplier: 0.98,
    accelMultiplier: 1.08,
    tractionCoeff: 0.92,
    turnMultiplier: 0.82,
    comDeltaInches: 0.0,
    clearanceInches: 0.5,
    selfRightingAssist: false,
    engineeringDetail: {
      materialOrSpec: '4.0" Soft 45A Cleated Elastomer',
      technicalNote: 'High surface stiction maximizes drawbar pull but resists skid-steer rotation.',
      keyMetrics: [
        { label: 'Diameter', value: '4.0 in' },
        { label: 'Friction μ', value: '0.92 (High)' },
      ],
    },
  },
  omni: {
    id: 'omni',
    category: 'wheels',
    name: 'OMNI WHEELS',
    subtitle: 'Multi-axis lateral roller hubs',
    weightLb: 2.4,
    pros: ['Exceptional maneuverability & flanking agility', 'Near-zero lateral scrub resistance'],
    cons: ['Poor pushing traction — easily shoved backward'],
    speedMultiplier: 1.04,
    accelMultiplier: 0.96,
    tractionCoeff: 0.44,
    turnMultiplier: 1.38,
    comDeltaInches: 0.05,
    clearanceInches: 0.5,
    selfRightingAssist: false,
    engineeringDetail: {
      materialOrSpec: '4.0" Dual-Row 45° Mecanum/Omni Rollers',
      technicalNote: 'Free-spinning sub-rollers eliminate yaw scrub, enabling rapid flanking maneuvers.',
      keyMetrics: [
        { label: 'Yaw Agility', value: '+38%' },
        { label: 'Friction μ', value: '0.44 (Low)' },
      ],
    },
  },
  tracks: {
    id: 'tracks',
    category: 'wheels',
    name: 'TRACKS',
    subtitle: 'Continuous armored tread modules',
    weightLb: 4.5,
    pros: ['Huge contact patch & pushing traction', 'Durable multi-bogie drive layout'],
    cons: ['Heavy (+4.5 LB)', 'High rolling friction reduces top speed', 'Slow turning'],
    speedMultiplier: 0.84,
    accelMultiplier: 0.92,
    tractionCoeff: 1.08,
    turnMultiplier: 0.72,
    comDeltaInches: -0.15,
    clearanceInches: 0.45,
    selfRightingAssist: false,
    engineeringDetail: {
      materialOrSpec: 'Reinforced Kevlar-Core Rubber Belting + Steel Sprockets',
      technicalNote: 'Distributes normal force across full chassis length for maximum tractive effort.',
      keyMetrics: [
        { label: 'Contact Patch', value: '34 sq in' },
        { label: 'Friction μ', value: '1.08 (Extreme)' },
      ],
    },
  },
};

export const ARMOR_CATALOG: Record<ArmorId, ArmorMaterialSpec> = {
  polycarbonate: {
    id: 'polycarbonate',
    category: 'armor',
    name: 'LIGHT POLYCARBONATE',
    subtitle: 'LIGHT — Shatter-resistant polymer',
    weightLb: 2.4,
    pros: ['Saves significant mass for heavy weapons', 'Flexes on impact without permanent bending'],
    cons: ['Vulnerable to cutting, gouging, and heavy repeated kinetic blows'],
    baseWeightLb: 2.4,
    protectionRating: 42,
    colorHex: '#38bdf8',
    metalness: 0.15,
    roughness: 0.2,
    opacity: 0.78,
    engineeringDetail: {
      materialOrSpec: 'Lexan 9034 Impact Polycarbonate',
      technicalNote: 'Low density (1.20 g/cm³) provides high elastic deformation but low surface hardness.',
      keyMetrics: [
        { label: 'Density', value: '1.20 g/cm³' },
        { label: 'Yield Strength', value: '62 MPa' },
      ],
    },
  },
  aluminum: {
    id: 'aluminum',
    category: 'armor',
    name: 'ALUMINUM',
    subtitle: 'BALANCED — Aerospace structural alloy',
    weightLb: 4.2,
    pros: ['Lightweight structural protection', 'Good stiffness-to-weight balance'],
    cons: ['Moderate durability against extreme kinetic spinners'],
    baseWeightLb: 4.2,
    protectionRating: 66,
    colorHex: '#94a3b8',
    metalness: 0.68,
    roughness: 0.35,
    engineeringDetail: {
      materialOrSpec: '7075-T6 Aircraft Aluminum Plate',
      technicalNote: 'Medium density (2.81 g/cm³) allows thicker plates for buckling resistance.',
      keyMetrics: [
        { label: 'Density', value: '2.81 g/cm³' },
        { label: 'Yield Strength', value: '503 MPa' },
      ],
    },
  },
  titanium: {
    id: 'titanium',
    category: 'armor',
    name: 'TITANIUM',
    subtitle: 'HEAVY — High strength-to-weight alloy',
    weightLb: 6.1,
    pros: ['Superior strength-to-weight ratio', 'Highly impact & gouge resistant'],
    cons: ['Heavier than polymer or aluminum', 'Consumes a significant portion of 30 LB budget'],
    baseWeightLb: 6.1,
    protectionRating: 86,
    colorHex: '#cbd5e1',
    metalness: 0.82,
    roughness: 0.25,
    engineeringDetail: {
      materialOrSpec: 'Ti-6Al-4V Grade 5 Titanium',
      technicalNote: 'High tensile strength (880 MPa) and toughness absorb severe shock loads.',
      keyMetrics: [
        { label: 'Density', value: '4.43 g/cm³' },
        { label: 'Yield Strength', value: '880 MPa' },
      ],
    },
  },
  steel: {
    id: 'steel',
    category: 'armor',
    name: 'HARDENED STEEL',
    subtitle: 'MAXIMUM — Abrasion-resistant plate',
    weightLb: 8.6,
    pros: ['Extremely durable shell', 'Shrugs off severe kinetic and ramming impacts'],
    cons: ['Extremely heavy — demands severe sacrifices elsewhere'],
    baseWeightLb: 8.6,
    protectionRating: 100,
    colorHex: '#475569',
    metalness: 0.88,
    roughness: 0.4,
    engineeringDetail: {
      materialOrSpec: 'AR500 Quenched & Tempered Steel',
      technicalNote: '500 Brinell surface hardness resists tooth bite, at high mass penalty (7.85 g/cm³).',
      keyMetrics: [
        { label: 'Density', value: '7.85 g/cm³' },
        { label: 'Hardness', value: '500 HBW' },
      ],
    },
  },
};

export const ARMOR_THICKNESS_OPTIONS: Record<ArmorThickness, ArmorThicknessSpec> = {
  thin: {
    id: 'thin',
    label: 'THIN',
    thicknessMm: 3.0,
    weightMultiplier: 0.72,
    protectionMultiplier: 0.76,
    visualScale: 0.65,
    description: '3.0 mm gauge — Saves weight, lower dent resistance',
  },
  medium: {
    id: 'medium',
    label: 'MEDIUM',
    thicknessMm: 5.0,
    weightMultiplier: 1.0,
    protectionMultiplier: 1.0,
    visualScale: 1.0,
    description: '5.0 mm gauge — Standard structural thickness',
  },
  thick: {
    id: 'thick',
    label: 'THICK',
    thicknessMm: 8.0,
    weightMultiplier: 1.38,
    protectionMultiplier: 1.28,
    visualScale: 1.45,
    description: '8.0 mm gauge — Heavy-duty plating, adds significant mass',
  },
};

export const WEAPON_CATALOG: Record<Exclude<WeaponId, 'custom-weapon'>, WeaponSpec> = {
  'vertical-spinner': {
    id: 'vertical-spinner',
    category: 'weapon',
    name: 'VERTICAL SPINNER',
    subtitle: 'High-inertia uppercut drum disc',
    weightLb: 6.2,
    pros: ['Massive impact energy (3,800 J)', 'Can launch opponents upward & buckle armor'],
    cons: ['Heavy front mass (6.2 LB)', 'High power draw & 2.8s spin-up', 'Strong recoil & gyroscopic forces'],
    energyJ: 3800,
    spinUpSec: 2.8,
    peakPowerKw: 2.6,
    avgPowerKw: 1.15,
    recoilScore: 76,
    controlScore: 28,
    comDeltaInches: 0.35,
    frontDeflectionBonus: 6,
    selfRightingCapable: false,
    typeCategory: 'spinner-vert',
    engineeringDetail: {
      materialOrSpec: 'S7 Tool Steel Asymmetric Twin-Tooth Disc @ 9,500 RPM',
      technicalNote: 'Stores E = ½Iω² rotational kinetic energy. Upward bite transfers normal reaction into chassis floor.',
      keyMetrics: [
        { label: 'Stored Energy', value: '3,800 J' },
        { label: 'Peak Draw', value: '2.60 kW' },
      ],
    },
  },
  'horizontal-spinner': {
    id: 'horizontal-spinner',
    category: 'weapon',
    name: 'HORIZONTAL SPINNER',
    subtitle: 'Wide-arc kinetic cleaver bar',
    weightLb: 6.6,
    pros: ['Huge frontal & lateral attack radius (4,200 J)', 'Devastating against side armor & wheels'],
    cons: ['Extreme lateral recoil', 'Very power hungry (2.9 kW peak)', 'Vulnerable to wall impacts & heavy wedges'],
    energyJ: 4200,
    spinUpSec: 3.3,
    peakPowerKw: 2.9,
    avgPowerKw: 1.28,
    recoilScore: 88,
    controlScore: 20,
    comDeltaInches: 0.42,
    frontDeflectionBonus: -8,
    selfRightingCapable: false,
    typeCategory: 'spinner-horiz',
    engineeringDetail: {
      materialOrSpec: '18" AR500 Balanced Impact Bar @ 7,200 RPM',
      technicalNote: 'High polar moment of inertia delivers immense lateral impulse but throws the chassis sideways on impact.',
      keyMetrics: [
        { label: 'Stored Energy', value: '4,200 J' },
        { label: 'Peak Draw', value: '2.90 kW' },
      ],
    },
  },
  lifter: {
    id: 'lifter',
    category: 'weapon',
    name: 'LIFTER',
    subtitle: 'High-leverage articulated lifting forks',
    weightLb: 3.4,
    pros: ['Lightweight (3.4 LB) & low battery draw', 'High control & overturning capability', 'Can self-right when inverted'],
    cons: ['Minimal direct kinetic damage', 'Requires getting forks underneath opponent'],
    energyJ: 420,
    spinUpSec: 0.6,
    peakPowerKw: 0.75,
    avgPowerKw: 0.28,
    recoilScore: 14,
    controlScore: 88,
    comDeltaInches: -0.1,
    frontDeflectionBonus: 18,
    selfRightingCapable: true,
    typeCategory: 'lifter',
    engineeringDetail: {
      materialOrSpec: '4-Bar Ballscrew Actuator + Spring-Steel Forks',
      technicalNote: 'Converts high gear reduction into 180 lb lifting tip force to overturn high-CoM or flanked targets.',
      keyMetrics: [
        { label: 'Lift Cycle', value: '0.6 sec' },
        { label: 'Peak Draw', value: '0.75 kW' },
      ],
    },
  },
  hammer: {
    id: 'hammer',
    category: 'weapon',
    name: 'HAMMER',
    subtitle: 'Rapid-fire overhead pneumatic spike',
    weightLb: 4.5,
    pros: ['Strikes vulnerable top deck & internal electronics', 'Moderate power draw', 'Can self-right robot'],
    cons: ['Requires accurate close-range positioning', 'Slower swing cycle & pitches chassis on miss'],
    energyJ: 1650,
    spinUpSec: 1.1,
    peakPowerKw: 1.25,
    avgPowerKw: 0.45,
    recoilScore: 48,
    controlScore: 54,
    comDeltaInches: 0.3,
    frontDeflectionBonus: 8,
    selfRightingCapable: true,
    typeCategory: 'hammer',
    engineeringDetail: {
      materialOrSpec: '180° Rack-and-Pinion Whip Hammer + Tungsten Tip',
      technicalNote: 'Bypasses thick sloped front wedges by striking directly downward onto top plates.',
      keyMetrics: [
        { label: 'Strike Energy', value: '1,650 J' },
        { label: 'Cycle Time', value: '1.1 sec' },
      ],
    },
  },
  wedge: {
    id: 'wedge',
    category: 'weapon',
    name: 'WEDGE',
    subtitle: 'Ground-scraping hardened deflection plow',
    weightLb: 2.2,
    pros: ['Extremely lightweight (2.2 LB)', 'Zero weapon power draw', 'Superior frontal deflection & low edge'],
    cons: ['Deals no direct weapon damage — relies on pushing & wall impacts'],
    energyJ: 140,
    spinUpSec: 0.0,
    peakPowerKw: 0.0,
    avgPowerKw: 0.0,
    recoilScore: 5,
    controlScore: 82,
    comDeltaInches: -0.3,
    frontDeflectionBonus: 36,
    selfRightingCapable: false,
    typeCategory: 'wedge',
    engineeringDetail: {
      materialOrSpec: '32° Sloped AR500 Hinged Ground Plow',
      technicalNote: 'Redirects opponent horizontal momentum upward while protecting the front bulkhead.',
      keyMetrics: [
        { label: 'Approach Angle', value: '32°' },
        { label: 'Power Draw', value: '0.0 kW' },
      ],
    },
  },
  grabber: {
    id: 'grabber',
    category: 'weapon',
    name: 'GRABBER',
    subtitle: 'Twin articulated hydraulic crushing jaws',
    weightLb: 4.1,
    pros: ['Locks onto opponent to dictate arena positioning', 'Neutralizes enemy charge & drags into hazards'],
    cons: ['Close-range engagement required', 'Moderate weight & actuator complexity'],
    energyJ: 680,
    spinUpSec: 0.75,
    peakPowerKw: 0.95,
    avgPowerKw: 0.36,
    recoilScore: 18,
    controlScore: 92,
    comDeltaInches: 0.05,
    frontDeflectionBonus: 14,
    selfRightingCapable: false,
    typeCategory: 'grabber',
    engineeringDetail: {
      materialOrSpec: 'Dual Self-Locking Worm-Gear Clamping Pincers',
      technicalNote: 'High clamping force pins opponent chassis, allowing high-traction drives to control the arena.',
      keyMetrics: [
        { label: 'Clamp Time', value: '0.75 sec' },
        { label: 'Control Rating', value: 'Very High' },
      ],
    },
  },
};

export const BATTERY_CATALOG: Record<BatteryId, BatterySpec> = {
  small: {
    id: 'small',
    category: 'power',
    name: 'SMALL BATTERY',
    subtitle: 'Lightweight 4S LiPo sprint pack',
    weightLb: 1.6,
    pros: ['Extremely light (1.6 LB)', 'Frees up to 3 LB for heavy armor or weapons'],
    cons: ['Short combat runtime', 'Limited 2.2 kW peak output throttles power-hungry spinners'],
    capacityWh: 48,
    peakSupplyKw: 2.2,
    voltageNominalV: 14.8,
    engineeringDetail: {
      materialOrSpec: '4S 3250mAh 45C LiPo Pack',
      technicalNote: 'High internal resistance causes voltage sag if weapon + drive exceed 2.2 kW peak demand.',
      keyMetrics: [
        { label: 'Capacity', value: '48 Wh' },
        { label: 'Peak Output', value: '2.20 kW' },
      ],
    },
  },
  medium: {
    id: 'medium',
    category: 'power',
    name: 'MEDIUM BATTERY',
    subtitle: 'Balanced 6S high-discharge pack',
    weightLb: 3.0,
    pros: ['Balanced mass and runtime', 'Delivers 3.4 kW peak for most standard builds'],
    cons: ['Can still hit power limits if pairing a giant spinner with high-current drive'],
    capacityWh: 82,
    peakSupplyKw: 3.4,
    voltageNominalV: 22.2,
    engineeringDetail: {
      materialOrSpec: '6S 3700mAh 65C LiPo Pack',
      technicalNote: 'Standard 22.2V combat bus balances energy density with burst discharge capability.',
      keyMetrics: [
        { label: 'Capacity', value: '82 Wh' },
        { label: 'Peak Output', value: '3.40 kW' },
      ],
    },
  },
  large: {
    id: 'large',
    category: 'power',
    name: 'LARGE BATTERY',
    subtitle: 'Heavy-duty 6S2P endurance core',
    weightLb: 4.7,
    pros: ['Long combat runtime', 'Massive 4.9 kW peak output unleashes full spinner & torque power'],
    cons: ['Heavy (4.7 LB) — cuts deeply into armor/chassis weight budget'],
    capacityWh: 128,
    peakSupplyKw: 4.9,
    voltageNominalV: 22.2,
    engineeringDetail: {
      materialOrSpec: '6S2P 5800mAh 80C Graphene LiPo Array',
      technicalNote: 'Parallel cell architecture halves internal resistance for zero voltage sag under peak load.',
      keyMetrics: [
        { label: 'Capacity', value: '128 Wh' },
        { label: 'Peak Output', value: '4.90 kW' },
      ],
    },
  },
};

export const UTILITY_CATALOG: Record<Exclude<UtilityId, 'custom-utility'>, UtilitySpec> = {
  none: {
    id: 'none',
    category: 'utility',
    name: 'NO UTILITY',
    subtitle: 'Clean baseline configuration',
    weightLb: 0.0,
    pros: ['Adds 0.0 LB to total robot mass', 'Zero auxiliary power draw'],
    cons: ['No dedicated wheel protection, active cooling, or self-righting assist'],
    powerDrawKw: 0.0,
    tractionBonus: 0.0,
    speedMultiplier: 1.0,
    turnMultiplier: 1.0,
    coolingBonusC: 0,
    frontArmorBonus: 0,
    sideArmorBonus: 0,
    rearArmorBonus: 0,
    comDeltaInches: 0,
    stabilityBonus: 0,
    protectsWheels: false,
    enablesSelfRighting: false,
    weaponDurabilityBonus: 0,
    engineeringDetail: {
      materialOrSpec: 'Standard Open Utility Bay',
      technicalNote: 'Reserves entire mass budget for primary subsystems.',
      keyMetrics: [
        { label: 'Added Mass', value: '0.0 LB' },
        { label: 'Aux Draw', value: '0 W' },
      ],
    },
  },
  'wheel-guards': {
    id: 'wheel-guards',
    category: 'utility',
    name: 'WHEEL GUARDS',
    subtitle: 'Bolt-on shock-mounted side fenders',
    weightLb: 1.8,
    pros: ['Protects wheels & side drives from direct strikes', 'Boosts side armor protection'],
    cons: ['Adds 1.8 LB perimeter weight', 'Slightly slows turning agility (-5%)'],
    powerDrawKw: 0.0,
    tractionBonus: 0.0,
    speedMultiplier: 0.98,
    turnMultiplier: 0.95,
    coolingBonusC: 0,
    frontArmorBonus: 0,
    sideArmorBonus: 24,
    rearArmorBonus: 6,
    comDeltaInches: 0.0,
    stabilityBonus: 4,
    protectsWheels: true,
    enablesSelfRighting: false,
    weaponDurabilityBonus: 0,
    engineeringDetail: {
      materialOrSpec: 'UHMW-Lined Standoff Fender Skirts',
      technicalNote: 'Standoff air gap absorbs kinetic impacts before they reach wheel hubs or axles.',
      keyMetrics: [
        { label: 'Side Protection', value: '+24 pts' },
        { label: 'Wheel Shielding', value: 'Active' },
      ],
    },
  },
  'self-righting': {
    id: 'self-righting',
    category: 'utility',
    name: 'SELF-RIGHTING ARM',
    subtitle: 'Dorsal motorized recovery hoop',
    weightLb: 1.9,
    pros: ['Reliably flips robot back onto its wheels if inverted'],
    cons: ['Costs 1.9 LB', 'Raises center of mass (+0.22 in) & draws auxiliary power'],
    powerDrawKw: 0.12,
    tractionBonus: 0.0,
    speedMultiplier: 1.0,
    turnMultiplier: 0.97,
    coolingBonusC: 0,
    frontArmorBonus: 0,
    sideArmorBonus: 0,
    rearArmorBonus: 0,
    comDeltaInches: 0.22,
    stabilityBonus: -5,
    protectsWheels: false,
    enablesSelfRighting: true,
    weaponDurabilityBonus: 0,
    engineeringDetail: {
      materialOrSpec: 'High-Torque Dorsal Roll-Bar Servo Actuator',
      technicalNote: 'Shifts dorsal pivot to roll inverted chassis back upright within 1.5 seconds.',
      keyMetrics: [
        { label: 'Recovery Time', value: '1.5 sec' },
        { label: 'CoM Shift', value: '+0.22 in' },
      ],
    },
  },
  'extra-cooling': {
    id: 'extra-cooling',
    category: 'utility',
    name: 'EXTRA COOLING',
    subtitle: 'Dual forced-air blowers & copper heat pipes',
    weightLb: 1.3,
    pros: ['Drops expected motor temperature by 22°C', 'Prevents thermal throttling in long pushing matches'],
    cons: ['Adds 1.3 LB', 'Continuous 140W fan power draw reduces battery runtime slightly'],
    powerDrawKw: 0.14,
    tractionBonus: 0.0,
    speedMultiplier: 1.0,
    turnMultiplier: 1.0,
    coolingBonusC: 22,
    frontArmorBonus: 0,
    sideArmorBonus: 0,
    rearArmorBonus: 0,
    comDeltaInches: 0.05,
    stabilityBonus: 0,
    protectsWheels: false,
    enablesSelfRighting: false,
    weaponDurabilityBonus: 0,
    engineeringDetail: {
      materialOrSpec: 'Dual 40mm High-Static Ducted Blowers + Finned Heatsinks',
      technicalNote: 'Increases convective heat transfer coefficient across drive and weapon motor cans.',
      keyMetrics: [
        { label: 'Temp Reduction', value: '-22°C' },
        { label: 'Continuous Draw', value: '140 W' },
      ],
    },
  },
  'rear-wedge': {
    id: 'rear-wedge',
    category: 'utility',
    name: 'REAR WEDGE',
    subtitle: 'Aft sloped armored counter-plow',
    weightLb: 1.7,
    pros: ['Heavily reinforces rear armor (+28)', 'Counterbalances heavy front weapons for better stability'],
    cons: ['Adds 1.7 LB', 'Increases length & slows turning rate (-6%)'],
    powerDrawKw: 0.0,
    tractionBonus: 0.0,
    speedMultiplier: 0.98,
    turnMultiplier: 0.94,
    coolingBonusC: 0,
    frontArmorBonus: 0,
    sideArmorBonus: 4,
    rearArmorBonus: 28,
    comDeltaInches: -0.1,
    stabilityBonus: 9,
    protectsWheels: false,
    enablesSelfRighting: false,
    weaponDurabilityBonus: 0,
    engineeringDetail: {
      materialOrSpec: '40° Aft Deflection Ramp + Counterweight Block',
      technicalNote: 'Brings longitudinal center of mass rearward and prevents rear-end scoop attacks.',
      keyMetrics: [
        { label: 'Rear Protection', value: '+28 pts' },
        { label: 'Stability Bonus', value: '+9' },
      ],
    },
  },
  'weapon-guard': {
    id: 'weapon-guard',
    category: 'utility',
    name: 'WEAPON GUARD',
    subtitle: 'Shock-isolated front bulkhead frame',
    weightLb: 2.1,
    pros: ['Increases weapon durability & reduces recoil shock', 'Reinforces front armor (+16)'],
    cons: ['Heavy (2.1 LB) on the nose', 'Slightly reduces turning speed'],
    powerDrawKw: 0.0,
    tractionBonus: 0.0,
    speedMultiplier: 0.97,
    turnMultiplier: 0.93,
    coolingBonusC: 0,
    frontArmorBonus: 16,
    sideArmorBonus: 0,
    rearArmorBonus: 0,
    comDeltaInches: 0.08,
    stabilityBonus: 8,
    protectsWheels: false,
    enablesSelfRighting: false,
    weaponDurabilityBonus: 35,
    engineeringDetail: {
      materialOrSpec: '7075 Shock-Mounted Weapon Bulkhead Ears',
      technicalNote: 'Urethane bushings isolate weapon shaft bearings from direct collision shear.',
      keyMetrics: [
        { label: 'Weapon Durability', value: '+35%' },
        { label: 'Front Armor', value: '+16 pts' },
      ],
    },
  },
  'traction-module': {
    id: 'traction-module',
    category: 'utility',
    name: 'TRACTION MODULE',
    subtitle: 'Underbody magnetic/downforce skirt',
    weightLb: 1.5,
    pros: ['Significantly boosts floor traction (+0.22 μ) & pushing force', 'Lowers center of mass & increases stability'],
    cons: ['Floor drag reduces top speed (-8%) and turning agility (-9%)', 'Draws 90W auxiliary power'],
    powerDrawKw: 0.09,
    tractionBonus: 0.22,
    speedMultiplier: 0.92,
    turnMultiplier: 0.91,
    coolingBonusC: 0,
    frontArmorBonus: 0,
    sideArmorBonus: 0,
    rearArmorBonus: 0,
    comDeltaInches: -0.22,
    stabilityBonus: 12,
    protectsWheels: false,
    enablesSelfRighting: false,
    weaponDurabilityBonus: 0,
    engineeringDetail: {
      materialOrSpec: 'Neodymium Downforce Array + Flexible Sealing Skirt',
      technicalNote: 'Increases effective normal force on the arena floor without exceeding the 30 LB scale weight.',
      keyMetrics: [
        { label: 'Traction Boost', value: '+0.22 μ' },
        { label: 'Speed Drag', value: '-8%' },
      ],
    },
  },
};

export const INITIAL_ROBOT_CONFIG: RobotConfiguration = {
  name: 'PROTOTYPE MK-I',
  chassisId: 'compact',
  driveId: 'balanced',
  wheelsId: 'small',
  armorId: 'aluminum',
  armorThickness: 'medium',
  weaponId: 'wedge',
  batteryId: 'medium',
  utilityId: 'none',
  accentColor: '#22d3ee',
  customWeapon: null,
  customUtility: null,
};

export const THE_BULL_CONFIG: RobotConfiguration = {
  name: 'THE BULL',
  chassisId: 'wide',
  driveId: 'torque',
  wheelsId: 'high-traction',
  armorId: 'steel',
  armorThickness: 'thick',
  weaponId: 'wedge',
  batteryId: 'large',
  utilityId: 'weapon-guard',
  accentColor: '#f59e0b',
};
