import {
  type BehaviorRule,
  type CoolingSystemOption,
  type CurrentLimiterOption,
  type DriveEscRating,
  type ElectricalConfiguration,
  type MechanicalConfiguration,
  type ProjectLeadConfiguration,
  type SoftwareApproachDecision,
  type SoftwareAttackDecision,
  type SoftwareConfiguration,
  type SoftwareRecoveryDecision,
  type TeamRobotProject,
  type WeaponEscRating,
  type WireConnection,
} from '../types/robot';

// Component pricing & lead times catalog
export interface ComponentCostSpec {
  costUsd: number;
  leadTimeDays: number; // 0 = In stock
  peakCurrentA?: number;
  continuousCurrentA?: number;
}

export const COMPONENT_MARKET_DATA: {
  chassis: Record<string, ComponentCostSpec>;
  drive: Record<string, ComponentCostSpec>;
  wheels: Record<string, ComponentCostSpec>;
  armor: Record<string, ComponentCostSpec>;
  armorThicknessMultiplier: Record<string, number>;
  weapon: Record<string, ComponentCostSpec>;
  utility: Record<string, ComponentCostSpec>;
} = {
  chassis: {
    compact: { costUsd: 220, leadTimeDays: 0 },
    wide: { costUsd: 310, leadTimeDays: 0 },
    long: { costUsd: 280, leadTimeDays: 0 },
    'low-profile': { costUsd: 360, leadTimeDays: 4 },
  },
  drive: {
    speed: { costUsd: 260, leadTimeDays: 0, peakCurrentA: 45, continuousCurrentA: 24 },
    torque: { costUsd: 290, leadTimeDays: 0, peakCurrentA: 52, continuousCurrentA: 28 },
    balanced: { costUsd: 240, leadTimeDays: 0, peakCurrentA: 42, continuousCurrentA: 22 },
    lightweight: { costUsd: 270, leadTimeDays: 4, peakCurrentA: 38, continuousCurrentA: 20 },
  },
  wheels: {
    small: { costUsd: 75, leadTimeDays: 0 },
    large: { costUsd: 95, leadTimeDays: 0 },
    'high-traction': { costUsd: 130, leadTimeDays: 0 },
    omni: { costUsd: 185, leadTimeDays: 3 },
    tracks: { costUsd: 210, leadTimeDays: 6 },
  },
  armor: {
    polycarbonate: { costUsd: 120, leadTimeDays: 0 },
    aluminum: { costUsd: 280, leadTimeDays: 0 },
    titanium: { costUsd: 720, leadTimeDays: 21 }, // 3 weeks lead time! (Conflict without expedited shipping!)
    steel: { costUsd: 340, leadTimeDays: 0 },
  },
  armorThicknessMultiplier: {
    thin: 0.75,
    medium: 1.0,
    thick: 1.4,
  },
  weapon: {
    'vertical-spinner': { costUsd: 620, leadTimeDays: 0, peakCurrentA: 75, continuousCurrentA: 32 },
    'horizontal-spinner': { costUsd: 580, leadTimeDays: 0, peakCurrentA: 68, continuousCurrentA: 30 },
    lifter: { costUsd: 380, leadTimeDays: 0, peakCurrentA: 35, continuousCurrentA: 12 },
    hammer: { costUsd: 460, leadTimeDays: 4, peakCurrentA: 48, continuousCurrentA: 15 },
    wedge: { costUsd: 190, leadTimeDays: 0, peakCurrentA: 10, continuousCurrentA: 2 },
    grabber: { costUsd: 420, leadTimeDays: 5, peakCurrentA: 40, continuousCurrentA: 14 },
    'custom-weapon': { costUsd: 500, leadTimeDays: 7, peakCurrentA: 55, continuousCurrentA: 25 },
  },
  utility: {
    none: { costUsd: 0, leadTimeDays: 0, peakCurrentA: 0, continuousCurrentA: 0 },
    'wheel-guards': { costUsd: 140, leadTimeDays: 0, peakCurrentA: 0, continuousCurrentA: 0 },
    'self-righting': { costUsd: 240, leadTimeDays: 3, peakCurrentA: 25, continuousCurrentA: 5 },
    'extra-cooling': { costUsd: 95, leadTimeDays: 0, peakCurrentA: 4, continuousCurrentA: 3 },
    'rear-wedge': { costUsd: 120, leadTimeDays: 0, peakCurrentA: 0, continuousCurrentA: 0 },
    'weapon-guard': { costUsd: 160, leadTimeDays: 0, peakCurrentA: 0, continuousCurrentA: 0 },
    'traction-module': { costUsd: 180, leadTimeDays: 4, peakCurrentA: 8, continuousCurrentA: 4 },
    'custom-utility': { costUsd: 200, leadTimeDays: 5, peakCurrentA: 10, continuousCurrentA: 5 },
  },
};

// Electrical Hardware Catalog
export interface BatteryOptionSpec {
  id: 'small' | 'medium' | 'large';
  name: string;
  chemistry: string;
  voltageV: number;
  capacityWh: number;
  continuousCurrentA: number;
  burstCurrentA: number;
  weightLb: number;
  costUsd: number;
  leadTimeDays: number;
  description: string;
}

export const BATTERY_OPTIONS: Record<'small' | 'medium' | 'large', BatteryOptionSpec> = {
  small: {
    id: 'small',
    name: '3S Compact LiPo',
    chemistry: '11.1V 4,200mAh',
    voltageV: 11.1,
    capacityWh: 46,
    continuousCurrentA: 80,
    burstCurrentA: 105,
    weightLb: 1.9,
    costUsd: 120,
    leadTimeDays: 0,
    description: 'Lightweight battery frees mass for heavier armor, but risks overcurrent if powering a heavy spinner.',
  },
  medium: {
    id: 'medium',
    name: '4S Standard High-C',
    chemistry: '14.8V 5,000mAh',
    voltageV: 14.8,
    capacityWh: 74,
    continuousCurrentA: 115,
    burstCurrentA: 145,
    weightLb: 3.1,
    costUsd: 190,
    leadTimeDays: 0,
    description: 'Balanced competition pack capable of supporting most weapon configurations with safe continuous margins.',
  },
  large: {
    id: 'large',
    name: '6S Heavy Duty Pack',
    chemistry: '22.2V 4,500mAh',
    voltageV: 22.2,
    capacityWh: 100,
    continuousCurrentA: 160,
    burstCurrentA: 200,
    weightLb: 4.5,
    costUsd: 280,
    leadTimeDays: 4,
    description: 'High power reservoir delivering maximum current with zero voltage sag, but adds significant mass (4.5 lb).',
  },
};

export interface EscOptionSpec<T extends number> {
  ratingA: T;
  name: string;
  weightLb: number;
  costUsd: number;
  leadTimeDays: number;
  burstA: number;
  description: string;
}

export const DRIVE_ESC_OPTIONS: Record<DriveEscRating, EscOptionSpec<DriveEscRating>> = {
  35: {
    ratingA: 35,
    name: '35A Dual Compact ESC',
    weightLb: 0.4,
    costUsd: 90,
    leadTimeDays: 0,
    burstA: 50,
    description: 'Budget dual controller. Sufficient for lightweight drives; will overheat under continuous pushing stalls.',
  },
  50: {
    ratingA: 50,
    name: '50A Heavy-Duty Dual ESC',
    weightLb: 0.7,
    costUsd: 150,
    leadTimeDays: 0,
    burstA: 75,
    description: 'Rugged MOSFET architecture with heatsinks. Handles aggressive high-traction drive motors safely.',
  },
  70: {
    ratingA: 70,
    name: '70A Smart Telemetry Dual ESC',
    weightLb: 0.9,
    costUsd: 220,
    leadTimeDays: 5,
    burstA: 110,
    description: 'Ultra-durable opto-isolated controller with active thermal throttling and over-torque telemetry.',
  },
};

export const WEAPON_ESC_OPTIONS: Record<WeaponEscRating, EscOptionSpec<WeaponEscRating>> = {
  40: {
    ratingA: 40,
    name: '40A Micro Weapon ESC',
    weightLb: 0.3,
    costUsd: 85,
    leadTimeDays: 0,
    burstA: 60,
    description: 'Lightweight controller ideal for wedges, lifters, or low-draw weapons. Too small for kinetic spinners.',
  },
  80: {
    ratingA: 80,
    name: '80A Kinetic Spinner ESC',
    weightLb: 0.8,
    costUsd: 160,
    leadTimeDays: 0,
    burstA: 120,
    description: 'Dedicated high-current brushless drive capable of spinning up heavy vertical and horizontal discs.',
  },
  120: {
    ratingA: 120,
    name: '120A Extreme Opto-Pro ESC',
    weightLb: 1.1,
    costUsd: 240,
    leadTimeDays: 6,
    burstA: 170,
    description: 'Commercial combat-grade weapon controller for massive rotational inertia and zero desync.',
  },
};

export interface CurrentLimiterSpec {
  capA: CurrentLimiterOption;
  label: string;
  description: string;
  spinUpPenaltyMultiplier: number;
  torquePenaltyMultiplier: number;
}

export const CURRENT_LIMITER_OPTIONS: Record<CurrentLimiterOption, CurrentLimiterSpec> = {
  0: {
    capA: 0,
    label: 'Uncapped (Full Power)',
    description: 'No software governor. Allows 100% torque and instant spin-up, but draws maximum peak current.',
    spinUpPenaltyMultiplier: 1.0,
    torquePenaltyMultiplier: 1.0,
  },
  140: {
    capA: 140,
    label: '140A Soft Governor',
    description: 'Clips extreme spike transients while preserving high acceleration and rapid weapon spin-up.',
    spinUpPenaltyMultiplier: 1.08,
    torquePenaltyMultiplier: 0.96,
  },
  120: {
    capA: 120,
    label: '120A Balanced Limiter',
    description: 'Balanced ceiling. Keeps battery safely below thermal cutoff with modest spin-up delay.',
    spinUpPenaltyMultiplier: 1.25,
    torquePenaltyMultiplier: 0.90,
  },
  100: {
    capA: 100,
    label: '100A Conservative Cap',
    description: 'Strict power cap. Guarantees safe draw on smaller batteries, but noticeably slows weapon spin-up.',
    spinUpPenaltyMultiplier: 1.55,
    torquePenaltyMultiplier: 0.82,
  },
};

export interface CoolingSystemSpec {
  id: CoolingSystemOption;
  name: string;
  weightLb: number;
  costUsd: number;
  leadTimeDays: number;
  tempReductionC: number;
  description: string;
}

export const COOLING_OPTIONS: Record<CoolingSystemOption, CoolingSystemSpec> = {
  passive: {
    id: 'passive',
    name: 'Passive Aluminum Shrouds',
    weightLb: 0.0,
    costUsd: 0,
    leadTimeDays: 0,
    tempReductionC: 0,
    description: 'Natural air convection. Zero added weight and cost, but motors will run hot under extended pushing.',
  },
  fan: {
    id: 'fan',
    name: 'Forced-Air Cooling Fan',
    weightLb: 0.3,
    costUsd: 45,
    leadTimeDays: 0,
    tempReductionC: 15,
    description: 'Twin centrifugal micro-fans continuously blow over drive and weapon motor cans (-15°C thermal drop).',
  },
  copper: {
    id: 'copper',
    name: 'Dual Copper Heat Pipes',
    weightLb: 0.6,
    costUsd: 85,
    leadTimeDays: 3,
    tempReductionC: 24,
    description: 'Direct-contact sintered copper heat pipes venting to the chassis frame (-24°C thermal drop).',
  },
};

// Software Autonomous Building Blocks
export const SOFTWARE_SENSOR_OPTIONS = [
  { id: 'robot_tilt', label: 'Robot Orientation', values: [{ id: 'flipped', label: 'Tilted / Inverted (>45°)' }, { id: 'upright', label: 'Upright on Wheels' }] },
  { id: 'weapon_ready', label: 'Weapon Status', values: [{ id: 'yes', label: 'Spinning at Target Speed (>80%)' }, { id: 'no', label: 'Spinning Up / Low RPM (<80%)' }] },
  { id: 'opponent_distance', label: 'Opponent Distance', values: [{ id: 'close', label: 'Close Range (< 1.5m)' }, { id: 'medium', label: 'Medium Range (1.5 - 3.0m)' }, { id: 'far', label: 'Long Range (> 3.0m)' }] },
  { id: 'opponent_angle', label: 'Opponent Heading', values: [{ id: 'front', label: 'In Front (±25° cone)' }, { id: 'flank', label: 'To Side / Flank (25° - 110°)' }, { id: 'rear', label: 'Behind Robot (> 110°)' }] },
  { id: 'front_contact', label: 'Front Bumper Contact', values: [{ id: 'contact', label: 'Ramming / Contacting Opponent' }, { id: 'clear', label: 'Open Arena Floor' }] },
] as const;

export const SOFTWARE_ACTION_OPTIONS = [
  { id: 'full_charge', label: 'Full Throttle Attack', icon: '⚔️', desc: 'Maximum acceleration straight into opponent frontally.' },
  { id: 'approach', label: 'Tactical Advance', icon: '🎯', desc: 'Approach opponent steadily while maintaining direct front-facing heading.' },
  { id: 'flank_target', label: 'Circle & Flank Side', icon: '🔄', desc: 'Arc around opponent to target weaker side or rear armor.' },
  { id: 'back_away', label: 'Reverse & Disengage', icon: '🛡️', desc: 'Back away to safe distance to allow weapon spin-up or cool-down.' },
  { id: 'turn_toward', label: 'Pivot to Face Target', icon: '🧭', desc: 'Rotate on center axis to align weapon with opponent.' },
  { id: 'recover_self_right', label: 'Fire Self-Righting Actuator', icon: '⚡', desc: 'Deploy self-righting arm or drive pulse to flip robot back upright.' },
] as const;

export const DEFAULT_SOFTWARE_RULES: BehaviorRule[] = [
  {
    id: 'rule-flip',
    sensor: 'robot_tilt',
    conditionValue: 'flipped',
    action: 'recover_self_right',
    label: 'IF Robot Inverted → Self-Right Immediately',
  },
  {
    id: 'rule-spinup',
    sensor: 'weapon_ready',
    conditionValue: 'no',
    action: 'back_away',
    label: 'IF Weapon Not Ready → Back Away to Spin Up',
  },
  {
    id: 'rule-attack',
    sensor: 'opponent_angle',
    conditionValue: 'front',
    action: 'full_charge',
    label: 'IF Opponent In Front → Attack with Full Throttle',
  },
  {
    id: 'rule-align',
    sensor: 'opponent_angle',
    conditionValue: 'flank',
    action: 'turn_toward',
    label: 'IF Opponent on Flank → Pivot to Align Front',
  },
];

// Project Lead Specs
export const PROJECT_LEAD_SPECS = {
  budgetCapUsd: 2500,
  competitionDeadlineDays: 14, // 2 weeks
  shippingTiers: {
    standard: {
      id: 'standard',
      name: 'Standard Ground Shipping',
      costUsd: 0,
      leadTimeReductionDays: 0,
      description: 'Standard 3-5 day ground delivery. No added freight surcharge.',
    },
    expedited: {
      id: 'expedited',
      name: 'Expedited Express Freight',
      costUsd: 160,
      leadTimeReductionDays: 7, // Cuts 7 days off lead times!
      description: 'Air priority delivery. Reduces all component delivery times by 7 days for $160.',
    },
  },
  spareKits: {
    none: {
      id: 'none',
      name: 'No Pit Spares (High Risk)',
      costUsd: 0,
      weightLb: 0,
      leadTimeDays: 0,
      description: 'Zero spare components purchased. Saves budget, but risks disqualification if drive burns out.',
    },
    drive: {
      id: 'drive',
      name: 'Drive Motor & Belt Kit',
      costUsd: 140,
      weightLb: 0,
      leadTimeDays: 0,
      description: 'Spare drive gearboxes, replacement wheel hubs, and drive belts for quick pit repairs.',
    },
    full: {
      id: 'full',
      name: 'Full Championship Pit Pack',
      costUsd: 280,
      weightLb: 0,
      leadTimeDays: 0,
      description: 'Comprehensive pit pack: backup drive motor, spare weapon pulley, belts, and structural fasteners.',
    },
  },
};

// ==========================================
// ELECTRICAL WIRING HARNESS DATA & INSPECTION
// ==========================================

export interface WiringPortSpec {
  id: string;
  componentId: string;
  name: string;
  type: 'pwr_pos' | 'pwr_neg' | '5v_pos' | '5v_neg' | 'motor_phase' | 'signal' | 'sensor_data';
  polarity?: '+' | '-';
  voltageV?: number;
  label: string;
}

export interface WiringComponentSpec {
  id: string;
  name: string;
  category: 'source' | 'switch' | 'distribution' | 'controller' | 'logic' | 'load';
  x: number; // percentage in diagram [0-100]
  y: number; // percentage in diagram [0-100]
  ports: WiringPortSpec[];
  icon: string;
}

export const WIRING_COMPONENTS: WiringComponentSpec[] = [
  {
    id: 'battery',
    name: 'LiPo Battery Pack',
    category: 'source',
    x: 18,
    y: 12,
    icon: 'Battery',
    ports: [
      { id: 'bat_pos', componentId: 'battery', name: 'BATTERY (+)', type: 'pwr_pos', polarity: '+', voltageV: 14.8, label: 'BAT +' },
      { id: 'bat_neg', componentId: 'battery', name: 'BATTERY (-)', type: 'pwr_neg', polarity: '-', voltageV: 0, label: 'BAT -' },
    ],
  },
  {
    id: 'switch',
    name: 'Main Safety Switch',
    category: 'switch',
    x: 50,
    y: 12,
    icon: 'Power',
    ports: [
      { id: 'sw_in_pos', componentId: 'switch', name: 'SWITCH IN (+)', type: 'pwr_pos', polarity: '+', label: 'IN +' },
      { id: 'sw_in_neg', componentId: 'switch', name: 'SWITCH IN (-)', type: 'pwr_neg', polarity: '-', label: 'IN -' },
      { id: 'sw_out_pos', componentId: 'switch', name: 'SWITCH OUT (+)', type: 'pwr_pos', polarity: '+', label: 'OUT +' },
      { id: 'sw_out_neg', componentId: 'switch', name: 'SWITCH OUT (-)', type: 'pwr_neg', polarity: '-', label: 'OUT -' },
    ],
  },
  {
    id: 'pdb',
    name: 'Power Distribution Board (PDB)',
    category: 'distribution',
    x: 50,
    y: 36,
    icon: 'Cpu',
    ports: [
      { id: 'pdb_in_pos', componentId: 'pdb', name: 'PDB MAIN IN (+)', type: 'pwr_pos', polarity: '+', label: 'MAIN +' },
      { id: 'pdb_in_neg', componentId: 'pdb', name: 'PDB MAIN IN (-)', type: 'pwr_neg', polarity: '-', label: 'MAIN -' },
      { id: 'pdb_drive_pos', componentId: 'pdb', name: 'PDB DRIVE OUT (+)', type: 'pwr_pos', polarity: '+', label: 'DRV +' },
      { id: 'pdb_drive_neg', componentId: 'pdb', name: 'PDB DRIVE OUT (-)', type: 'pwr_neg', polarity: '-', label: 'DRV -' },
      { id: 'pdb_weapon_pos', componentId: 'pdb', name: 'PDB WEAPON OUT (+)', type: 'pwr_pos', polarity: '+', label: 'WEAP +' },
      { id: 'pdb_weapon_neg', componentId: 'pdb', name: 'PDB WEAPON OUT (-)', type: 'pwr_neg', polarity: '-', label: 'WEAP -' },
      { id: 'pdb_bec_pos', componentId: 'pdb', name: 'PDB BEC OUT (+)', type: 'pwr_pos', polarity: '+', label: 'BEC +' },
      { id: 'pdb_bec_neg', componentId: 'pdb', name: 'PDB BEC OUT (-)', type: 'pwr_neg', polarity: '-', label: 'BEC -' },
    ],
  },
  {
    id: 'drive_esc',
    name: 'Drive ESC',
    category: 'controller',
    x: 20,
    y: 60,
    icon: 'Gauge',
    ports: [
      { id: 'esc_d_pwr_pos', componentId: 'drive_esc', name: 'DRIVE ESC PWR (+)', type: 'pwr_pos', polarity: '+', label: 'PWR +' },
      { id: 'esc_d_pwr_neg', componentId: 'drive_esc', name: 'DRIVE ESC PWR (-)', type: 'pwr_neg', polarity: '-', label: 'PWR -' },
      { id: 'esc_d_sig', componentId: 'drive_esc', name: 'DRIVE ESC SIGNAL', type: 'signal', label: 'SIG' },
      { id: 'esc_d_mot', componentId: 'drive_esc', name: 'DRIVE ESC MOTOR OUT', type: 'motor_phase', label: 'MOTOR' },
    ],
  },
  {
    id: 'bec',
    name: '5V BEC Step-Down',
    category: 'distribution',
    x: 50,
    y: 58,
    icon: 'Zap',
    ports: [
      { id: 'bec_in_pos', componentId: 'bec', name: 'BEC INPUT (+)', type: 'pwr_pos', polarity: '+', label: 'VIN +' },
      { id: 'bec_in_neg', componentId: 'bec', name: 'BEC INPUT (-)', type: 'pwr_neg', polarity: '-', label: 'VIN -' },
      { id: 'bec_out_5v_pos', componentId: 'bec', name: 'BEC 5V OUT (+)', type: '5v_pos', polarity: '+', voltageV: 5.0, label: '5V +' },
      { id: 'bec_out_5v_neg', componentId: 'bec', name: 'BEC 5V OUT (-)', type: '5v_neg', polarity: '-', voltageV: 0, label: '5V -' },
    ],
  },
  {
    id: 'weapon_esc',
    name: 'Weapon ESC',
    category: 'controller',
    x: 80,
    y: 60,
    icon: 'Swords',
    ports: [
      { id: 'esc_w_pwr_pos', componentId: 'weapon_esc', name: 'WEAPON ESC PWR (+)', type: 'pwr_pos', polarity: '+', label: 'PWR +' },
      { id: 'esc_w_pwr_neg', componentId: 'weapon_esc', name: 'WEAPON ESC PWR (-)', type: 'pwr_neg', polarity: '-', label: 'PWR -' },
      { id: 'esc_w_sig', componentId: 'weapon_esc', name: 'WEAPON ESC SIGNAL', type: 'signal', label: 'SIG' },
      { id: 'esc_w_mot', componentId: 'weapon_esc', name: 'WEAPON ESC MOTOR OUT', type: 'motor_phase', label: 'MOTOR' },
    ],
  },
  {
    id: 'computer',
    name: 'Autonomous Computer',
    category: 'logic',
    x: 50,
    y: 78,
    icon: 'Cpu',
    ports: [
      { id: 'comp_pwr_pos', componentId: 'computer', name: 'COMPUTER 5V IN (+)', type: '5v_pos', polarity: '+', voltageV: 5.0, label: '5V +' },
      { id: 'comp_pwr_neg', componentId: 'computer', name: 'COMPUTER 5V IN (-)', type: '5v_neg', polarity: '-', voltageV: 0, label: 'GND' },
      { id: 'comp_sig_drive', componentId: 'computer', name: 'DRIVE SIGNAL OUT', type: 'signal', label: 'DRV SIG' },
      { id: 'comp_sig_weapon', componentId: 'computer', name: 'WEAPON SIGNAL OUT', type: 'signal', label: 'WEAP SIG' },
      { id: 'comp_sens_pwr_pos', componentId: 'computer', name: 'SENSOR 5V OUT (+)', type: '5v_pos', polarity: '+', label: 'SENS 5V' },
      { id: 'comp_sens_pwr_neg', componentId: 'computer', name: 'SENSOR 5V OUT (-)', type: '5v_neg', polarity: '-', label: 'SENS GND' },
      { id: 'comp_sens_data', componentId: 'computer', name: 'SENSOR DATA IN', type: 'sensor_data', label: 'DATA' },
    ],
  },
  {
    id: 'motors',
    name: 'Drive Motors',
    category: 'load',
    x: 18,
    y: 86,
    icon: 'Gauge',
    ports: [
      { id: 'mot_drive_in', componentId: 'motors', name: 'DRIVE MOTOR PHASE', type: 'motor_phase', label: 'PHASE IN' },
    ],
  },
  {
    id: 'weapon_motor',
    name: 'Weapon Motor',
    category: 'load',
    x: 82,
    y: 86,
    icon: 'Swords',
    ports: [
      { id: 'mot_weapon_in', componentId: 'weapon_motor', name: 'WEAPON MOTOR PHASE', type: 'motor_phase', label: 'PHASE IN' },
    ],
  },
  {
    id: 'sensors',
    name: 'Autonomous Sensor Suite',
    category: 'logic',
    x: 74,
    y: 74,
    icon: 'Activity',
    ports: [
      { id: 'sens_pwr_pos', componentId: 'sensors', name: 'SENSOR POWER (+)', type: '5v_pos', polarity: '+', label: '5V +' },
      { id: 'sens_pwr_neg', componentId: 'sensors', name: 'SENSOR POWER (-)', type: '5v_neg', polarity: '-', label: 'GND' },
      { id: 'sens_data', componentId: 'sensors', name: 'SENSOR DATA OUT', type: 'sensor_data', label: 'DATA' },
    ],
  },
];

export const ALL_WIRING_PORTS_MAP = new Map<string, WiringPortSpec>();
for (const comp of WIRING_COMPONENTS) {
  for (const p of comp.ports) {
    ALL_WIRING_PORTS_MAP.set(p.id, p);
  }
}

export const DEFAULT_VALID_WIRES: WireConnection[] = [
  // Battery -> Switch
  { id: 'w1', fromPort: 'bat_pos', toPort: 'sw_in_pos' },
  { id: 'w2', fromPort: 'bat_neg', toPort: 'sw_in_neg' },
  // Switch -> PDB
  { id: 'w3', fromPort: 'sw_out_pos', toPort: 'pdb_in_pos' },
  { id: 'w4', fromPort: 'sw_out_neg', toPort: 'pdb_in_neg' },
  // PDB -> Drive ESC
  { id: 'w5', fromPort: 'pdb_drive_pos', toPort: 'esc_d_pwr_pos' },
  { id: 'w6', fromPort: 'pdb_drive_neg', toPort: 'esc_d_pwr_neg' },
  // PDB -> Weapon ESC
  { id: 'w7', fromPort: 'pdb_weapon_pos', toPort: 'esc_w_pwr_pos' },
  { id: 'w8', fromPort: 'pdb_weapon_neg', toPort: 'esc_w_pwr_neg' },
  // PDB -> 5V BEC
  { id: 'w9', fromPort: 'pdb_bec_pos', toPort: 'bec_in_pos' },
  { id: 'w10', fromPort: 'pdb_bec_neg', toPort: 'bec_in_neg' },
  // BEC 5V -> Computer
  { id: 'w11', fromPort: 'bec_out_5v_pos', toPort: 'comp_pwr_pos' },
  { id: 'w12', fromPort: 'bec_out_5v_neg', toPort: 'comp_pwr_neg' },
  // Computer -> Drive ESC & Weapon ESC signal
  { id: 'w13', fromPort: 'comp_sig_drive', toPort: 'esc_d_sig' },
  { id: 'w14', fromPort: 'comp_sig_weapon', toPort: 'esc_w_sig' },
  // ESCs -> Motors
  { id: 'w15', fromPort: 'esc_d_mot', toPort: 'mot_drive_in' },
  { id: 'w16', fromPort: 'esc_w_mot', toPort: 'mot_weapon_in' },
  // Computer -> Sensors (5V Power + Data)
  { id: 'w17', fromPort: 'comp_sens_pwr_pos', toPort: 'sens_pwr_pos' },
  { id: 'w18', fromPort: 'comp_sens_pwr_neg', toPort: 'sens_pwr_neg' },
  { id: 'w19', fromPort: 'sens_data', toPort: 'comp_sens_data' },
];

export const DEFAULT_SIMPLIFIED_WIRES: WireConnection[] = [
  { id: 'w1', fromPort: 'bat_pos', toPort: 'sw_in_pos' },
  { id: 'w2', fromPort: 'bat_neg', toPort: 'sw_in_neg' },
  { id: 'w3', fromPort: 'sw_out_pos', toPort: 'pdb_in_pos' },
  { id: 'w4', fromPort: 'sw_out_neg', toPort: 'pdb_in_neg' },
  { id: 'w5', fromPort: 'pdb_drive_out', toPort: 'esc_drive_in' },
  { id: 'w6', fromPort: 'pdb_weapon_out', toPort: 'esc_weapon_in' },
  { id: 'w7', fromPort: 'pdb_reg_out', toPort: 'reg_in' },
  { id: 'w8', fromPort: 'esc_drive_mot_l', toPort: 'mot_left_in' },
  { id: 'w9', fromPort: 'esc_drive_mot_r', toPort: 'mot_right_in' },
  { id: 'w10', fromPort: 'esc_weapon_mot', toPort: 'mot_weapon_in' },
  { id: 'w11', fromPort: 'reg_out_5v', toPort: 'comp_pwr_in' },
  { id: 'w12', fromPort: 'comp_sig_drive', toPort: 'esc_drive_sig' },
  { id: 'w13', fromPort: 'comp_sig_weapon', toPort: 'esc_weapon_sig' },
  { id: 'w14', fromPort: 'sens_data', toPort: 'comp_sens_data' },
];

export interface SimplifiedElectricalValidation {
  valid: boolean;
  observations: string[];
  batteryConnected: boolean;
  mainPowerConnected: boolean;
  drivePowered: boolean;
  weaponPowered: boolean;
  computerPowered: boolean;
  sensorConnected?: boolean;
  subsystems?: {
    mainPower: boolean;
    driveSystem: boolean;
    weaponSystem: boolean;
    robotComputer: boolean;
    sensorNetwork: boolean;
  };
}

function hasConnectionBetween(wires: WireConnection[], portA: string, portB: string): boolean {
  return wires.some(
    (w) =>
      (w.fromPort === portA && w.toPort === portB) ||
      (w.fromPort === portB && w.toPort === portA)
  );
}

export function validateSimplifiedElectrical(wires: WireConnection[]): SimplifiedElectricalValidation {
  const observations: string[] = [];

  const has14WirePorts = wires.some(
    (w) =>
      w.fromPort === 'bat_pos' ||
      w.toPort === 'bat_pos' ||
      w.fromPort === 'sw_in_pos' ||
      w.toPort === 'sw_in_pos' ||
      w.fromPort === 'esc_drive_mot_l' ||
      w.toPort === 'esc_drive_mot_l'
  );

  let mainPower: boolean;
  let driveSystem: boolean;
  let weaponSystem: boolean;
  let robotComputer: boolean;
  let sensorNetwork: boolean;

  if (has14WirePorts) {
    mainPower =
      hasConnectionBetween(wires, 'bat_pos', 'sw_in_pos') &&
      hasConnectionBetween(wires, 'bat_neg', 'sw_in_neg') &&
      hasConnectionBetween(wires, 'sw_out_pos', 'pdb_in_pos') &&
      hasConnectionBetween(wires, 'sw_out_neg', 'pdb_in_neg');

    driveSystem =
      hasConnectionBetween(wires, 'pdb_drive_out', 'esc_drive_in') &&
      hasConnectionBetween(wires, 'comp_sig_drive', 'esc_drive_sig') &&
      hasConnectionBetween(wires, 'esc_drive_mot_l', 'mot_left_in') &&
      hasConnectionBetween(wires, 'esc_drive_mot_r', 'mot_right_in');

    weaponSystem =
      hasConnectionBetween(wires, 'pdb_weapon_out', 'esc_weapon_in') &&
      hasConnectionBetween(wires, 'comp_sig_weapon', 'esc_weapon_sig') &&
      hasConnectionBetween(wires, 'esc_weapon_mot', 'mot_weapon_in');

    robotComputer =
      hasConnectionBetween(wires, 'pdb_reg_out', 'reg_in') &&
      hasConnectionBetween(wires, 'reg_out_5v', 'comp_pwr_in');

    sensorNetwork = hasConnectionBetween(wires, 'sens_data', 'comp_sens_data');
  } else {
    // Backward compatibility for 7-wire harness
    const batConn = hasConnectionBetween(wires, 'bat_out', 'sw_in');
    const swConn = hasConnectionBetween(wires, 'sw_out', 'pdb_in');
    mainPower = batConn && swConn;

    const driveEscIn = hasConnectionBetween(wires, 'pdb_drive_out', 'esc_drive_in');
    const driveEscOut = hasConnectionBetween(wires, 'esc_drive_out', 'mot_drive_in');
    driveSystem = driveEscIn && driveEscOut;

    const weapEscIn = hasConnectionBetween(wires, 'pdb_weapon_out', 'esc_weapon_in');
    const weapEscOut = hasConnectionBetween(wires, 'esc_weapon_out', 'mot_weapon_in');
    weaponSystem = weapEscIn && weapEscOut;

    robotComputer = hasConnectionBetween(wires, 'pdb_comp_out', 'comp_in');
    sensorNetwork = true;
  }

  if (!mainPower) {
    observations.push('⚠ MAIN POWER OFFLINE: High-voltage battery circuit to Power Distribution is incomplete.');
  }
  if (!driveSystem) {
    observations.push('⚠ DRIVE SYSTEM OFFLINE: Drive controller power, motor phases, or command signal unverified.');
  }
  if (!weaponSystem) {
    observations.push('⚠ WEAPON SYSTEM OFFLINE: Weapon controller power, motor phase, or trigger signal unverified.');
  }
  if (!robotComputer) {
    observations.push('⚠ ROBOT COMPUTER HAS NO POWER: 5V logic voltage regulator circuit incomplete.');
  }
  if (!sensorNetwork) {
    observations.push('⚠ SENSOR NETWORK OFFLINE: Telemetry data line not connected to robot computer.');
  }

  const valid = mainPower && driveSystem && weaponSystem && robotComputer && sensorNetwork;

  return {
    valid,
    observations,
    batteryConnected: mainPower,
    mainPowerConnected: mainPower,
    drivePowered: driveSystem,
    weaponPowered: weaponSystem,
    computerPowered: robotComputer,
    sensorConnected: sensorNetwork,
    subsystems: {
      mainPower,
      driveSystem,
      weaponSystem,
      robotComputer,
      sensorNetwork,
    },
  };
}

// COMPATIBLE PORT PAIRS (Neutral Physical Interface)
export const SIMPLIFIED_PORT_COMPATIBILITY: Record<string, string[]> = {
  bat_pos: ['sw_in_pos'],
  bat_neg: ['sw_in_neg'],
  sw_in_pos: ['bat_pos'],
  sw_in_neg: ['bat_neg'],
  sw_out_pos: ['pdb_in_pos'],
  sw_out_neg: ['pdb_in_neg'],
  pdb_in_pos: ['sw_out_pos'],
  pdb_in_neg: ['sw_out_neg'],
  pdb_drive_out: ['esc_drive_in'],
  esc_drive_in: ['pdb_drive_out'],
  esc_drive_sig: ['comp_sig_drive'],
  comp_sig_drive: ['esc_drive_sig'],
  esc_drive_mot_l: ['mot_left_in'],
  mot_left_in: ['esc_drive_mot_l'],
  esc_drive_mot_r: ['mot_right_in'],
  mot_right_in: ['esc_drive_mot_r'],
  pdb_weapon_out: ['esc_weapon_in'],
  esc_weapon_in: ['pdb_weapon_out'],
  esc_weapon_sig: ['comp_sig_weapon'],
  comp_sig_weapon: ['esc_weapon_sig'],
  esc_weapon_mot: ['mot_weapon_in'],
  mot_weapon_in: ['esc_weapon_mot'],
  pdb_reg_out: ['reg_in'],
  reg_in: ['pdb_reg_out'],
  reg_out_5v: ['comp_pwr_in'],
  comp_pwr_in: ['reg_out_5v'],
  sens_data: ['comp_sens_data'],
  comp_sens_data: ['sens_data'],
  // Legacy aliases
  bat_out: ['sw_in'],
  sw_in: ['bat_out'],
  sw_out: ['pdb_in'],
  pdb_in: ['sw_out'],
  esc_drive_out: ['mot_drive_in'],
  mot_drive_in: ['esc_drive_out'],
  esc_weapon_out: ['mot_weapon_in'],
  pdb_comp_out: ['comp_in'],
  comp_in: ['pdb_comp_out'],
};

// ==========================================
// SOFTWARE BOTCODE DATA & BUGS
// ==========================================

export interface BotCodeBug {
  id: string;
  line: number;
  subsystem: 'Movement' | 'Weapon' | 'Detection' | 'Recovery';
  wrongText: string;
  correctText: string;
  hint: string;
}

export interface BotCodeBugVariant {
  id: string;
  variantIndex: number;
  script: string;
  description: string;
}

export const BOTCODE_VARIANTS: BotCodeBugVariant[] = [
  {
    id: 'variant-1',
    variantIndex: 0,
    script: `BOT NIGHTFALL

START:

    sensor opponent = ON
    sensor distance = ON

    weapon = READY

    IF opponent deteced:
        drive FORWRD

    IF opponent close:
        wepon SPNI

    IF robot flipped:
        self_right ON

END`,
    description: 'Typo in detection, misspelling in drive, typo in weapon and action',
  },
  {
    id: 'variant-2',
    variantIndex: 1,
    script: `BOT NIGHTFALL

START:

    sensor opponent = OFF
    sensor distance = ON

    weapon = READY

    IF opponent detected:
        drive BACKWARD

    IF opponent close:
        wepon SPIN

    IF robot flipped:
        self_right

END`,
    description: 'Opponent sensor turned OFF, reverse drive direction on detect, typo in weapon, missing ON command in recovery',
  },
  {
    id: 'variant-3',
    variantIndex: 2,
    script: `BOT NIGHTFALL

START:

    sensor opponent = ON
    sensor distance = ON

    weapon = OFF

    IF opponent detected
        drive FORWARD

    IF opponent close:
        weapon SPNI

    IF robot flipped:
        self_right ON

END`,
    description: 'Weapon armed state OFF, missing colon in detection, typo in weapon spin command',
  },
];

export const INITIAL_BOTCODE_SCRIPT = BOTCODE_VARIANTS[0].script;

export const BOTCODE_BUGS: BotCodeBug[] = [
  {
    id: 'bug_deteced',
    line: 9,
    subsystem: 'Detection',
    wrongText: 'deteced',
    correctText: 'detected',
    hint: 'Opponent detection condition: check "deteced"',
  },
  {
    id: 'bug_forwrd',
    line: 10,
    subsystem: 'Movement',
    wrongText: 'FORWRD',
    correctText: 'FORWARD',
    hint: 'Drive movement command: check "FORWRD"',
  },
  {
    id: 'bug_wepon',
    line: 13,
    subsystem: 'Weapon',
    wrongText: 'wepon',
    correctText: 'weapon',
    hint: 'Weapon subsystem identifier: check "wepon"',
  },
  {
    id: 'bug_spni',
    line: 13,
    subsystem: 'Weapon',
    wrongText: 'SPNI',
    correctText: 'SPIN',
    hint: 'Weapon actuation command: check "SPNI"',
  },
];

export interface BotCodeSubsystems {
  movement: boolean;
  detection: boolean;
  weapon: boolean;
  recovery: boolean;
  syntax: boolean;
}

export interface BotCodeValidation {
  allVerified: boolean;
  subsystems: BotCodeSubsystems;
  bugsRemainingCount: number;
  diagnostics: string[];
}

export function evaluateBotCode(code: string): BotCodeValidation {
  const cleanCode = (code || '').trim();
  const lines = cleanCode.split('\n').map((l) => l.trim());

  // 1. Detection Subsystem:
  // Must have 'sensor opponent = ON' (not OFF)
  // Must have 'IF opponent detected:' (correct spelling and colon)
  const hasSensorOn = /sensor\s+opponent\s*=\s*ON/i.test(cleanCode) && !/sensor\s+opponent\s*=\s*OFF/i.test(cleanCode);
  const hasDetectClause = /IF\s+opponent\s+detected\s*:/i.test(cleanCode);
  const detection = hasSensorOn && hasDetectClause;

  // 2. Movement Subsystem:
  // Must have 'drive FORWARD' under attack/detect (no 'drive FORWRD', no 'drive BACKWARD', no 'drive STOP')
  const hasDriveForward = /drive\s+FORWARD\b/.test(cleanCode);
  const hasDriveTypo = /FORWRD/i.test(cleanCode);
  const hasWrongDrive = /drive\s+BACKWARD/i.test(cleanCode) || /drive\s+STOP/i.test(cleanCode);
  const movement = hasDriveForward && !hasDriveTypo && !hasWrongDrive;

  // 3. Weapon Subsystem:
  // Must have 'weapon = READY' (not OFF)
  // Must have 'weapon SPIN' (no 'wepon', no 'SPNI', no 'weapon STOP')
  const hasWeaponReady = /weapon\s*=\s*READY/i.test(cleanCode) && !/weapon\s*=\s*OFF/i.test(cleanCode);
  const hasWeaponSpin = /weapon\s+SPIN\b/.test(cleanCode);
  const hasWeaponTypo = /wepon/i.test(cleanCode) || /SPNI/i.test(cleanCode);
  const hasWeaponStop = /weapon\s+STOP/i.test(cleanCode);
  const weapon = hasWeaponReady && hasWeaponSpin && !hasWeaponTypo && !hasWeaponStop;

  // 4. Recovery Subsystem:
  // Must have 'self_right ON' under 'IF robot flipped:' (not just 'self_right' or 'OFF')
  const hasSelfRightOn = /self_right\s+ON\b/.test(cleanCode);
  const hasIncompleteSelfRight = /self_right\s*$/m.test(cleanCode);
  const hasFlippedClause = /IF\s+robot\s+flipped\s*:/i.test(cleanCode);
  const recovery = hasSelfRightOn && !hasIncompleteSelfRight && hasFlippedClause;

  // 5. Syntax Subsystem:
  // Must have 'START:' and 'END'
  // All 'IF' clauses must end with ':'
  const hasStart = /^START:/m.test(cleanCode);
  const hasEnd = /^END/m.test(cleanCode);
  const ifLines = lines.filter((l) => l.startsWith('IF'));
  const allIfsHaveColon = ifLines.length > 0 && ifLines.every((l) => l.endsWith(':'));
  const syntax = hasStart && hasEnd && allIfsHaveColon;

  let bugsRemainingCount = 0;
  const diagnostics: string[] = [];

  if (!movement) {
    bugsRemainingCount++;
    diagnostics.push('Movement system: drive command is misspelled or moving in reverse.');
  }
  if (!detection) {
    bugsRemainingCount++;
    diagnostics.push('Opponent detection: sensor is deactivated or detection conditional syntax is incorrect.');
  }
  if (!weapon) {
    bugsRemainingCount++;
    diagnostics.push('Weapon control: weapon is disarmed, misspelled, or instructed to stop on close contact.');
  }
  if (!recovery) {
    bugsRemainingCount++;
    diagnostics.push('Recovery system: self-righting parameter is missing or inverted conditional is incomplete.');
  }
  if (!syntax) {
    bugsRemainingCount++;
    diagnostics.push('Program syntax: check colons on conditional blocks and program tags.');
  }

  const allVerified = movement && detection && weapon && recovery && syntax;

  return {
    allVerified,
    subsystems: {
      movement,
      detection,
      weapon,
      recovery,
      syntax,
    },
    bugsRemainingCount,
    diagnostics,
  };
}

export function checkBotCodeBugs(code: string): {
  remainingBugs: BotCodeBug[];
  fixedBugs: BotCodeBug[];
  allFixed: boolean;
  checklist: {
    connection: boolean;
    movement: boolean;
    weapon: boolean;
    detection: boolean;
    recovery: boolean;
  };
} {
  const result = evaluateBotCode(code);
  const remainingBugs: BotCodeBug[] = [];
  const fixedBugs: BotCodeBug[] = [];

  // Check specific bug occurrences for granular tracking
  if (/deteced/i.test(code) || !result.subsystems.detection) {
    remainingBugs.push({ id: 'bug_deteced', line: 9, subsystem: 'Detection', wrongText: 'deteced', correctText: 'detected', hint: 'Check detection syntax' });
  } else {
    fixedBugs.push({ id: 'bug_deteced', line: 9, subsystem: 'Detection', wrongText: 'deteced', correctText: 'detected', hint: 'Check detection syntax' });
  }

  if (/FORWRD/i.test(code) || /BACKWARD/i.test(code) || !result.subsystems.movement) {
    remainingBugs.push({ id: 'bug_forwrd', line: 10, subsystem: 'Movement', wrongText: 'FORWRD', correctText: 'FORWARD', hint: 'Check movement command' });
  } else {
    fixedBugs.push({ id: 'bug_forwrd', line: 10, subsystem: 'Movement', wrongText: 'FORWRD', correctText: 'FORWARD', hint: 'Check movement command' });
  }

  if (/SPNI/i.test(code) || /weapon\s+STOP/i.test(code)) {
    remainingBugs.push({ id: 'bug_spni', line: 13, subsystem: 'Weapon', wrongText: 'SPNI', correctText: 'SPIN', hint: 'Check weapon action' });
  } else {
    fixedBugs.push({ id: 'bug_spni', line: 13, subsystem: 'Weapon', wrongText: 'SPNI', correctText: 'SPIN', hint: 'Check weapon action' });
  }

  if (/wepon/i.test(code) || /weapon\s*=\s*OFF/i.test(code)) {
    remainingBugs.push({ id: 'bug_wepon', line: 13, subsystem: 'Weapon', wrongText: 'wepon', correctText: 'weapon', hint: 'Check weapon identifier' });
  } else {
    fixedBugs.push({ id: 'bug_wepon', line: 13, subsystem: 'Weapon', wrongText: 'wepon', correctText: 'weapon', hint: 'Check weapon identifier' });
  }

  return {
    remainingBugs,
    fixedBugs,
    allFixed: result.allVerified,
    checklist: {
      connection: true,
      movement: result.subsystems.movement,
      weapon: result.subsystems.weapon,
      detection: result.subsystems.detection,
      recovery: result.subsystems.recovery,
    },
  };
}

// ==========================================
// BUSINESS NATURAL LANGUAGE AD EVALUATION
// ==========================================

export interface AdRubricCriterion {
  label: string;
  passed: boolean;
  score: number;
  maxScore: number;
  hint?: string;
}

export interface AdCampaignEvaluation {
  score: number;
  tier: 'None' | 'Bronze' | 'Silver' | 'Gold';
  fundingUsd: number;
  headline: string;
  theme: 'aggressive' | 'tech' | 'armored' | 'speed';
  criteria: {
    robotIdentity: AdRubricCriterion;
    engineeringStory: AdRubricCriterion;
    sponsorValue: AdRubricCriterion;
    callToAction: AdRubricCriterion;
    creativeDirection: AdRubricCriterion;
    sponsorAppeal?: AdRubricCriterion;
    clearMessage?: AdRubricCriterion;
  };
  sponsorFeedback: string;
}

export function evaluateAdCampaignPrompt(rawPrompt: string): AdCampaignEvaluation {
  const prompt = (rawPrompt || '').trim();
  const lower = prompt.toLowerCase();
  const words = prompt.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return {
      score: 0,
      tier: 'None',
      fundingUsd: 0,
      headline: 'AWAITING CAMPAIGN PROMPT',
      theme: 'tech',
      criteria: {
        robotIdentity: { label: 'Robot Identity', passed: false, score: 0, maxScore: 20, hint: 'Give your BattleBot a bold, memorable name or identity.' },
        engineeringStory: { label: 'Engineering Story', passed: false, score: 0, maxScore: 25, hint: 'Highlight specific weapon, armor, and drivetrain engineering.' },
        sponsorValue: { label: 'Sponsor Value', passed: false, score: 0, maxScore: 30, hint: 'Explain what companies gain by supporting your team (brand visibility, STEM education, tournament partnership).' },
        callToAction: { label: 'Call to Action', passed: false, score: 0, maxScore: 15, hint: 'Include a direct call to action inviting sponsors to partner or support.' },
        creativeDirection: { label: 'Creative Direction', passed: false, score: 0, maxScore: 10, hint: 'Describe the visual tone, mood, or setting of your campaign.' },
        sponsorAppeal: { label: 'Sponsor Value', passed: false, score: 0, maxScore: 30, hint: 'Explain what companies gain by supporting your team.' },
        clearMessage: { label: 'Call to Action', passed: false, score: 0, maxScore: 15, hint: 'Include a direct call to action.' },
      },
      sponsorFeedback: 'No campaign prompt provided. Enter a prompt describing your BattleBot advertisement.',
    };
  }

  // 1. Robot Identity (0 to 20 pts)
  let identityScore = 0;
  let identityHint = '';
  const hasName =
    /[A-Z]{3,}/.test(prompt) ||
    /["'][^"']+["']/.test(prompt) ||
    /call it|named|battlebot|nightfall|titan|bull|apex|viper|shadow|beast|thunder|claw/i.test(prompt);
  const hasTone = /futuristic|dramatic|aggressive|sleek|unstoppable|champion|dominant|lethal|fearless|powerful|heavyweight|high-impact|arena|combat/i.test(prompt);

  if (hasName) identityScore += 10;
  if (hasTone) identityScore += 7;
  if (words.length >= 4) identityScore += 3;
  if (identityScore < 16) {
    identityHint = 'Give your BattleBot a bold capitalized name and define a clear theme (e.g. futuristic, aggressive, fortress).';
  }

  // 2. Engineering Story (0 to 25 pts)
  let engScore = 0;
  let engHint = '';
  const mentionsWeapon = /spinner|vertical|horizontal|wedge|hammer|lifter|grabber|blade|weapon|kinetic|joule|rpm|drum/i.test(prompt);
  const mentionsSpecs = /speed|fast|mph|traction|torque|motor|brushless|armor|titanium|steel|ar500|aluminum|chassis|power|battery|esc|cooling|autonomous|ai|sensor|telemetry|lidar|ultrasonic|technology/i.test(prompt);
  const mentionsPerformance = /kinetic energy|rotational|leverage|low-clearance|penetration|impact resistance|shock|spin-up|acceleration|traction|deadly|advanced/i.test(prompt);

  if (mentionsWeapon) engScore += 8;
  if (mentionsSpecs) engScore += 9;
  if (mentionsPerformance) engScore += 8;
  if (engScore < 20) {
    engHint = 'Describe both your weapon system and physical/electrical specs (e.g. AR500 steel, vertical spinner, kinetic energy transfer).';
  }

  // 3. Sponsor Value (0 to 30 pts) - Strictest Category!
  let sponsorScore = 0;
  let sponsorHint = '';
  const mentionsSponsorPartnership = /sponsor|sponsorship|partner|partnership|invest|invest in|backer|support|corporate/i.test(prompt);
  const mentionsBrandVisibility = /brand|logo|exposure|visibility|broadcast|showcase|audience|arena showcase|chassis placement/i.test(prompt);
  const mentionsStemCommunity = /stem|education|student|next-gen|future|workforce|engineering team|innovation|talent|development|community|team/i.test(prompt);
  const mentionsVictoryValue = /champion|championship|tournament|dominate|victory|win the arena|win/i.test(prompt);

  if (mentionsSponsorPartnership) sponsorScore += 10;
  if (mentionsBrandVisibility) sponsorScore += 10;
  if (mentionsStemCommunity) sponsorScore += 10;
  if (mentionsVictoryValue && sponsorScore < 30) sponsorScore += 10;

  if (sponsorScore < 20) {
    sponsorHint = 'Explain why supporting your robotics team matters to a company: brand visibility on the chassis, supporting student STEM education, or championship partnership.';
  }

  // 4. Call to Action / Message (0 to 15 pts)
  let ctaScore = 0;
  let ctaHint = '';
  const hasDirectCall = /join us|partner with|support our|sponsor our|invest in|invest|back our|help us|contact us|become a partner|sponsor/i.test(prompt);
  const hasAudienceAddress = /companies|industry|robotics companies|sponsors|leaders|community|team|arena|dominate|today/i.test(prompt);

  if (hasDirectCall) ctaScore += 10;
  if (hasAudienceAddress) ctaScore += 5;
  if (ctaScore < 12) {
    ctaHint = 'Include a direct call to action inviting robotics companies or sponsors to partner with your team today.';
  }

  // 5. Creative Direction / Clarity (0 to 10 pts)
  let clarityScore = 0;
  let clarityHint = '';
  if (words.length >= 5) clarityScore += 5;
  if (words.length >= 20) clarityScore += 5;
  if (clarityScore < 8) {
    clarityHint = 'Expand your prompt into complete descriptive sentences with clear creative and visual direction.';
  }

  const rawTotal = identityScore + engScore + sponsorScore + ctaScore + clarityScore;
  const totalScore = Math.min(100, Math.max(40, rawTotal));

  let tier: 'Bronze' | 'Silver' | 'Gold' = 'Bronze';
  let fundingUsd = 200;
  let sponsorFeedback = 'Basic advertisement created. To earn Silver or Gold, explain the engineering specs and what value the sponsor receives.';

  if (totalScore >= 85) {
    tier = 'Gold';
    fundingUsd = 700;
    sponsorFeedback = 'Premier Campaign! Your team clearly communicated the robot identity, technical engineering specs, and a compelling sponsor value proposition.';
  } else if (totalScore >= 65) {
    tier = 'Silver';
    fundingUsd = 400;
    sponsorFeedback = 'Solid Campaign! The robot and engineering are memorable, but the campaign could more strongly explain what the sponsor gains by backing your team.';
  }

  // Headline extraction
  let headline = 'BUILT TO STRIKE • ENGINEERED TO WIN';
  if (/futuristic/i.test(lower)) headline = 'NEXT-GEN AUTONOMOUS COMBAT ROBOTICS';
  else if (/dramatic|aggressive/i.test(lower)) headline = 'UNSTOPPABLE KINETIC DESTRUCTION';
  else if (/defend|tank|armor/i.test(lower)) headline = 'INDESTRUCTIBLE ARMOR • FORTRESS OF STEEL';
  else if (/speed|fast/i.test(lower)) headline = 'VELOCITY UNBOUND • SURGICAL PRECISION';

  let theme: 'aggressive' | 'tech' | 'armored' | 'speed' = 'aggressive';
  if (/tech|futuristic|ai|autonomous/i.test(lower)) theme = 'tech';
  else if (/armor|tank|titanium|ar500/i.test(lower)) theme = 'armored';
  else if (/speed|fast|lightning/i.test(lower)) theme = 'speed';

  const criteriaObj = {
    robotIdentity: { label: 'Robot Identity', passed: identityScore >= 16, score: identityScore, maxScore: 20, hint: identityHint },
    engineeringStory: { label: 'Engineering Story', passed: engScore >= 18, score: engScore, maxScore: 25, hint: engHint },
    sponsorValue: { label: 'Sponsor Value', passed: sponsorScore >= 20, score: sponsorScore, maxScore: 30, hint: sponsorHint },
    callToAction: { label: 'Call to Action', passed: ctaScore >= 10, score: ctaScore, maxScore: 15, hint: ctaHint },
    creativeDirection: { label: 'Creative Direction', passed: clarityScore >= 8, score: clarityScore, maxScore: 10, hint: clarityHint },
    sponsorAppeal: { label: 'Sponsor Value', passed: sponsorScore >= 20, score: sponsorScore, maxScore: 30, hint: sponsorHint },
    clearMessage: { label: 'Call to Action', passed: ctaScore >= 10, score: ctaScore, maxScore: 15, hint: ctaHint },
  };

  return {
    score: totalScore,
    tier,
    fundingUsd,
    headline,
    theme,
    criteria: criteriaObj,
    sponsorFeedback,
  };
}

export function validateElectricalCircuit(wires: WireConnection[]): {
  valid: boolean;
  observations: string[];
  passedChecks: string[];
} {
  if (wires.length === 0) {
    return {
      valid: false,
      observations: ['Wiring harness is empty. Connect components to establish power and control.'],
      passedChecks: [],
    };
  }

  // Check if using simplified wiring ports (distinguished by simplified port IDs)
  const isSimplified = wires.some(
    (w) =>
      w.fromPort === 'bat_out' ||
      w.toPort === 'bat_out' ||
      w.fromPort === 'sw_in' ||
      w.toPort === 'sw_in' ||
      w.fromPort === 'esc_drive_in' ||
      w.toPort === 'esc_drive_in' ||
      w.fromPort === 'esc_weapon_in' ||
      w.toPort === 'esc_weapon_in' ||
      w.fromPort === 'comp_in' ||
      w.toPort === 'comp_in'
  );

  if (isSimplified) {
    const simp = validateSimplifiedElectrical(wires);
    const passedChecks: string[] = [];
    if (simp.batteryConnected) passedChecks.push('Battery connected');
    if (simp.mainPowerConnected) passedChecks.push('Main power connected');
    if (simp.drivePowered) passedChecks.push('Drive system powered');
    if (simp.weaponPowered) passedChecks.push('Weapon system powered');
    if (simp.computerPowered) passedChecks.push('Robot computer powered');
    return {
      valid: simp.valid,
      observations: simp.observations,
      passedChecks,
    };
  }

  const observations: string[] = [];
  const passedChecks: string[] = [];

  // 1. Direct Short Circuit Checks
  const hasShortCircuit =
    hasConnectionBetween(wires, 'bat_pos', 'bat_neg') ||
    hasConnectionBetween(wires, 'sw_out_pos', 'sw_out_neg') ||
    hasConnectionBetween(wires, 'pdb_in_pos', 'pdb_in_neg');
  if (hasShortCircuit) {
    observations.push('⚠ SHORT CIRCUIT: Direct connection between high-voltage positive and negative return rails.');
  }

  // 2. Overvoltage Direct to 5V Computer Check
  const directBatToComp =
    hasConnectionBetween(wires, 'bat_pos', 'comp_pwr_pos') ||
    hasConnectionBetween(wires, 'sw_out_pos', 'comp_pwr_pos') ||
    hasConnectionBetween(wires, 'pdb_in_pos', 'comp_pwr_pos') ||
    hasConnectionBetween(wires, 'pdb_drive_pos', 'comp_pwr_pos') ||
    hasConnectionBetween(wires, 'pdb_weapon_pos', 'comp_pwr_pos') ||
    hasConnectionBetween(wires, 'pdb_bec_pos', 'comp_pwr_pos');
  if (directBatToComp) {
    observations.push(
      '⚠ OVERVOLTAGE: Direct high-voltage battery bus (14.8V) detected on 5V autonomous computer. Requires 5V BEC voltage regulator step-down.'
    );
  }

  // 3. Motor Connected Directly to Battery (Bypassing ESC)
  const motorDirectToBat =
    hasConnectionBetween(wires, 'bat_pos', 'mot_drive_in') ||
    hasConnectionBetween(wires, 'pdb_drive_pos', 'mot_drive_in') ||
    hasConnectionBetween(wires, 'bat_pos', 'mot_weapon_in') ||
    hasConnectionBetween(wires, 'pdb_weapon_pos', 'mot_weapon_in');
  if (motorDirectToBat) {
    observations.push(
      '⚠ NO MOTOR CONTROLLER: Motor connected directly to raw battery bus without an Electronic Speed Controller (ESC).'
    );
  }

  // 4. Sensor Data Connected to Power Line
  const sensorDataToPower =
    hasConnectionBetween(wires, 'sens_data', 'bat_pos') ||
    hasConnectionBetween(wires, 'sens_data', 'sw_out_pos') ||
    hasConnectionBetween(wires, 'sens_data', 'comp_pwr_pos') ||
    hasConnectionBetween(wires, 'sens_data', 'bec_out_5v_pos');
  if (sensorDataToPower) {
    observations.push(
      '⚠ INVALID CONNECTION: Telemetry data line connected directly to power bus.'
    );
  }

  // 5. Battery to Switch
  const batToSwitchPos = hasConnectionBetween(wires, 'bat_pos', 'sw_in_pos');
  const batToSwitchNeg = hasConnectionBetween(wires, 'bat_neg', 'sw_in_neg');
  if (!batToSwitchPos || !batToSwitchNeg) {
    observations.push('⚠ Power source disconnected: Battery is not connected to safety switch.');
  } else {
    passedChecks.push('Battery safely routed through master switch');
  }

  // 6. Switch to PDB
  const switchToPdbPos = hasConnectionBetween(wires, 'sw_out_pos', 'pdb_in_pos');
  const switchToPdbNeg = hasConnectionBetween(wires, 'sw_out_neg', 'pdb_in_neg');
  if (!switchToPdbPos || !switchToPdbNeg) {
    observations.push('⚠ Main distribution unpowered: Power Distribution Board (PDB) has no supply from master switch.');
  } else {
    passedChecks.push('PDB main power rails energized');
  }

  // 7. PDB to Drive ESC
  const pdbToDrivePos = hasConnectionBetween(wires, 'pdb_drive_pos', 'esc_d_pwr_pos');
  const pdbToDriveNeg = hasConnectionBetween(wires, 'pdb_drive_neg', 'esc_d_pwr_neg');
  if (!pdbToDrivePos || !pdbToDriveNeg) {
    observations.push('⚠ Drive controller has no power: Drive ESC power terminals are incomplete.');
  } else {
    passedChecks.push('Drive ESC power circuit complete');
  }

  // 8. PDB to Weapon ESC
  const pdbToWeapPos = hasConnectionBetween(wires, 'pdb_weapon_pos', 'esc_w_pwr_pos');
  const pdbToWeapNeg = hasConnectionBetween(wires, 'pdb_weapon_neg', 'esc_w_pwr_neg');
  if (!pdbToWeapPos || !pdbToWeapNeg) {
    observations.push('⚠ Weapon controller has no power: Weapon ESC power terminals are incomplete.');
  } else {
    passedChecks.push('Weapon ESC power circuit complete');
  }

  // 9. PDB to 5V BEC
  const pdbToBecPos = hasConnectionBetween(wires, 'pdb_bec_pos', 'bec_in_pos');
  const pdbToBecNeg = hasConnectionBetween(wires, 'pdb_bec_neg', 'bec_in_neg');
  if (!pdbToBecPos || !pdbToBecNeg) {
    observations.push('⚠ Voltage regulator unpowered: 5V BEC has no high-voltage input from PDB.');
  } else {
    passedChecks.push('5V BEC voltage regulator energized');
  }

  // 10. BEC 5V to Computer
  const becToCompPos = hasConnectionBetween(wires, 'bec_out_5v_pos', 'comp_pwr_pos');
  const becToCompNeg = hasConnectionBetween(wires, 'bec_out_5v_neg', 'comp_pwr_neg');
  if (!becToCompPos || !becToCompNeg) {
    observations.push('⚠ Autonomous computer has no 5V regulated logic power supply.');
  } else {
    passedChecks.push('Autonomous computer receiving clean 5.0V regulated power');
  }

  // 11. ESC Signal Lines from Computer
  const driveSigOk = hasConnectionBetween(wires, 'comp_sig_drive', 'esc_d_sig');
  if (!driveSigOk) {
    observations.push('⚠ Drive ESC signal line disconnected: Computer cannot command drivetrain.');
  } else {
    passedChecks.push('Drive ESC signal line verified');
  }

  const weapSigOk = hasConnectionBetween(wires, 'comp_sig_weapon', 'esc_w_sig');
  if (!weapSigOk) {
    observations.push('⚠ Weapon ESC signal line disconnected: Computer cannot trigger weapon.');
  } else {
    passedChecks.push('Weapon ESC signal line verified');
  }

  // 12. ESC to Motors
  const driveMotorOk = hasConnectionBetween(wires, 'esc_d_mot', 'mot_drive_in');
  if (!driveMotorOk) {
    observations.push('⚠ Drive motor phase disconnected from Drive ESC.');
  } else {
    passedChecks.push('Drive motor connected to ESC output phase');
  }

  const weaponMotorOk = hasConnectionBetween(wires, 'esc_w_mot', 'mot_weapon_in');
  if (!weaponMotorOk) {
    observations.push('⚠ Weapon motor phase disconnected from Weapon ESC.');
  } else {
    passedChecks.push('Weapon motor connected to ESC output phase');
  }

  // 13. Sensors Power & Data
  const sensPwrPosOk = hasConnectionBetween(wires, 'comp_sens_pwr_pos', 'sens_pwr_pos');
  const sensPwrNegOk = hasConnectionBetween(wires, 'comp_sens_pwr_neg', 'sens_pwr_neg');
  const sensDataOk = hasConnectionBetween(wires, 'sens_data', 'comp_sens_data');

  if (!sensPwrPosOk || !sensPwrNegOk) {
    observations.push('⚠ Autonomous sensors have no 5V power supply.');
  }
  if (!sensDataOk) {
    observations.push('⚠ Sensor data path incomplete: Telemetry line not routed to computer.');
  }
  if (sensPwrPosOk && sensPwrNegOk && sensDataOk) {
    passedChecks.push('Autonomous sensor suite powered and telemetry stream active');
  }

  const valid = observations.length === 0;
  return { valid, observations, passedChecks };
}

// ==========================================
// SOFTWARE FLOWCHART DECISION SPECIFICATIONS
// ==========================================

export interface SoftwareFlowchartOption<T extends string> {
  id: T;
  name: string;
  tagline: string;
  description: string;
  pros: string;
  cons: string;
}

export const SOFTWARE_APPROACH_OPTIONS: Record<SoftwareApproachDecision, SoftwareFlowchartOption<SoftwareApproachDecision>> = {
  charge: {
    id: 'charge',
    name: 'Full-Speed Charge',
    tagline: 'Aggressive direct acceleration into opponent center-of-mass',
    description: 'Commands 100% throttle immediately upon target detection. Closes distance rapidly to overwhelm opponent defense with momentum.',
    pros: 'Maximizes initial kinetic impact energy; prevents opponent from getting spin-up time.',
    cons: 'Higher drift overshoot on turns; vulnerable to opponent wedge deflection if off-axis.',
  },
  careful: {
    id: 'careful',
    name: 'Controlled Standoff',
    tagline: 'Smooth measured approach maintaining heading lock',
    description: 'Throttles at 65% while making micro-heading corrections to keep front weapon or armor squarely centered on target before impact.',
    pros: 'Minimizes overshoot; preserves steering control and traction; ensures clean front-on impacts.',
    cons: 'Slower closing speed allows opponent spinners more time to achieve kinetic RPM.',
  },
  flank: {
    id: 'flank',
    name: 'Angled Flank Sweep',
    tagline: 'Curves around target to strike exposed wheels or rear armor',
    description: 'Calculates an offset arc trajectory aiming 30-45° away from front armor, curving in toward the side or rear drive train.',
    pros: 'Bypasses strong front wedges/plows to attack vulnerable exposed wheels and rear panels.',
    cons: 'Requires agile turning drivetrain; risk of overshooting against high-speed opponents.',
  },
};

export const SOFTWARE_ATTACK_OPTIONS: Record<SoftwareAttackDecision, SoftwareFlowchartOption<SoftwareAttackDecision>> = {
  immediate: {
    id: 'immediate',
    name: 'Immediate Strike',
    tagline: 'Fire weapon instantly upon contact range',
    description: 'Triggers weapon actuation and maximum motor drive the microsecond target distance drops under 0.4 meters.',
    pros: 'Zero reaction lag; catches opponents before they can evade or counter-push.',
    cons: 'If weapon is still spinning up, delivers lower energy impact.',
  },
  line_up: {
    id: 'line_up',
    name: 'Square Up & Strike',
    tagline: 'Pivot to ensure perpendicular contact before releasing kinetic force',
    description: 'Executes a high-speed rotational snap to align weapon perpendicular to the nearest chassis face before engaging contact drive.',
    pros: 'Ensures strike energy transfers directly into opponent frame rather than glancing off at an angle.',
    cons: 'Requires 0.15s alignment delay before firing.',
  },
  back_off: {
    id: 'back_off',
    name: 'Standoff Spin-Up',
    tagline: 'Maintain 1.5m buffer until kinetic weapon exceeds 85% RPM',
    description: 'Maintains distance until spinner telemetry reports full kinetic flywheel energy, only lunging forward when strike power is maximized.',
    pros: 'Guarantees maximum destruction Joule delivery; eliminates under-speed weapon stall.',
    cons: 'Leaves robot passive for 1-2 seconds at match start while spooling up.',
  },
};

export const SOFTWARE_RECOVERY_OPTIONS: Record<SoftwareRecoveryDecision, SoftwareFlowchartOption<SoftwareRecoveryDecision>> = {
  reverse_turn: {
    id: 'reverse_turn',
    name: 'Reverse & J-Turn Escape',
    tagline: 'Reverse 1.0m and pivot 90° away from pinning contact',
    description: 'On detecting stall or pin, reverses full throttle for 0.6 seconds and executes a 90° power slide to clear arena corners and wall traps.',
    pros: 'Reliable escape maneuver from arena hazards and opponent wedges.',
    cons: 'Briefly presents side/rear armor during the turn.',
  },
  self_right: {
    id: 'self_right',
    name: 'Deploy Self-Righting Arm',
    tagline: 'Fire lifter arm or inverted roll mechanism to reorient chassis',
    description: 'Telemetry gyro detects tilt > 90° and fires auxiliary self-righting actuator to flip the chassis back onto its drive wheels.',
    pros: 'Quickly recovers from high-energy rollover hits; prevents high-centering.',
    cons: 'Requires mechanical self-righting or lifter attachment to function effectively.',
  },
  keep_attacking: {
    id: 'keep_attacking',
    name: 'Invertible Combat Drive',
    tagline: 'Invert steering controls and continue attacking upside-down',
    description: 'Inverts drive motor polarities instantly upon flip, allowing robots with symmetrical wheels to fight seamlessly without righting.',
    pros: 'Zero downtime when flipped; keeps attacking continuously without pausing.',
    cons: 'Requires chassis and wheels designed for inverted clearance.',
  },
};

// ==========================================
// BUSINESS LEAD SPONSORS & CAMPAIGN DATA
// ==========================================

export interface SponsorPitchChoice {
  text: string;
  sponsorReply: string;
  offerUsd: number;
  tier: 'Gold' | 'Silver' | 'Bronze';
}

export interface SponsorSpec {
  id: string;
  name: string;
  logo: string;
  industry: string;
  description: string;
  question: string;
  choices: [SponsorPitchChoice, SponsorPitchChoice, SponsorPitchChoice];
}

export const SPONSORS_CATALOG: Record<string, SponsorSpec> = {
  motionforge: {
    id: 'motionforge',
    name: 'MotionForge Motors',
    logo: '⚡ MF',
    industry: 'High-Torque Planetary Drivetrains',
    description: 'Specializes in extreme torque planetary gearboxes and brushless traction motors for combat robotics.',
    question: 'We engineer industrial-grade planetary drives for ruthless arena pushing. How does your robot design demonstrate our high-torque brand?',
    choices: [
      {
        text: 'Our drivetrain is geared for aggressive traction and heavy torque to bully opponents and dominate the center ring.',
        sponsorReply: 'Outstanding pitch! That matches our pushing philosophy perfectly. MotionForge is proud to back you with tier-1 funding.',
        offerUsd: 550,
        tier: 'Gold',
      },
      {
        text: 'We picked balanced motors that should give us good cruising speed and decent reliability.',
        sponsorReply: 'Fair assessment. We will offer standard sponsorship to see how you perform.',
        offerUsd: 350,
        tier: 'Silver',
      },
      {
        text: 'We mostly care about our weapon; driving around is secondary to raw spinner hits.',
        sponsorReply: 'If you do not prioritize drivetrain performance, we can only provide baseline developmental support.',
        offerUsd: 150,
        tier: 'Bronze',
      },
    ],
  },
  batterylabs: {
    id: 'batterylabs',
    name: 'BatteryLabs Lithium',
    logo: '🔋 BL',
    industry: 'Extreme-Discharge LiPo Cells',
    description: 'Manufactures high-C graphene lithium cells capable of brutal continuous discharge without thermal runaway.',
    question: 'Combat bots pull violent current spikes that destroy cheap packs. How will your electrical configuration showcase our cell endurance?',
    choices: [
      {
        text: 'We size our ESCs with high current headroom and active thermal management so our pack delivers uninterrupted peak discharge.',
        sponsorReply: 'Brilliant electrical engineering! You understand current demand and thermal margins. Here is our premier battery research grant.',
        offerUsd: 500,
        tier: 'Gold',
      },
      {
        text: 'We selected a standard 4S pack that balances run time with chassis weight.',
        sponsorReply: 'Solid, sensible engineering choice. We will sponsor your battery bay.',
        offerUsd: 320,
        tier: 'Silver',
      },
      {
        text: 'We will just push maximum throttle until either the opponent breaks or something overheats.',
        sponsorReply: 'Thermal runaways damage our brand reputation. We will only offer minimal trial backing.',
        offerUsd: 150,
        tier: 'Bronze',
      },
    ],
  },
  titanmaterials: {
    id: 'titanmaterials',
    name: 'Titan Materials Corp',
    logo: '🛡️ TMC',
    industry: 'Aerospace Alloys & Hardened Armor',
    description: 'World leader in Grade 5 titanium, AR500 ballistic steel, and lightweight impact-absorbing composite plates.',
    question: 'Our brand is built on surviving catastrophic kinetic impacts. What is your team’s defensive philosophy against The Bull?',
    choices: [
      {
        text: 'We combine sloped deflection geometry with premium alloy plate to dissipate kinetic energy and protect vital electronics.',
        sponsorReply: 'Superb! An engineering team that truly respects impact dynamics. Titan Materials is signing on as your premier armor sponsor.',
        offerUsd: 600,
        tier: 'Gold',
      },
      {
        text: 'We have adequate armor plates to keep our frame from cracking during normal hits.',
        sponsorReply: 'Good defensive mindset. We are pleased to provide supporting material sponsorship.',
        offerUsd: 350,
        tier: 'Silver',
      },
      {
        text: 'Armor slows robots down; we would rather take hits and rely entirely on weapon offense.',
        sponsorReply: 'A bot that disintegrates in 30 seconds does not help our armor brand. Modest tooling grant only.',
        offerUsd: 180,
        tier: 'Bronze',
      },
    ],
  },
  technova: {
    id: 'technova',
    name: 'TechNova Autonomous Systems',
    logo: '🧠 TN',
    industry: 'Robotic Vision & Autonomous Control',
    description: 'Designs real-time optical lidar, high-rate ultrasonic suites, and embedded decision hardware.',
    question: 'Autonomous combat requires lightning-fast SENSE-DECIDE-ACT execution. How does your software stack leverage our sensors?',
    choices: [
      {
        text: 'Our SENSE-DECIDE-ACT loop uses distance & angle telemetry to orchestrate approach vectors and self-righting recoveries in real time.',
        sponsorReply: 'Extraordinary! You are demonstrating the true power of autonomous robotics. TechNova is proud to fund your software team.',
        offerUsd: 500,
        tier: 'Gold',
      },
      {
        text: 'We configured basic distance rules to charge when close and turn when obstructed.',
        sponsorReply: 'Practical rule-based logic. We are glad to support your autonomous development.',
        offerUsd: 300,
        tier: 'Silver',
      },
      {
        text: 'Software is just a formality; our robot will mostly drive straight forward.',
        sponsorReply: 'Autonomous innovation requires more intention. We can offer a minor educational grant.',
        offerUsd: 120,
        tier: 'Bronze',
      },
    ],
  },
};

export interface CampaignThemeSpec {
  id: 'aggressive' | 'tech' | 'armored' | 'speed';
  label: string;
  tagline: string;
  bannerColor: string;
  textColor: string;
  glowColor: string;
}

export const CAMPAIGN_THEMES: Record<string, CampaignThemeSpec> = {
  aggressive: {
    id: 'aggressive',
    label: 'Redline Kinetic',
    tagline: 'Brutal Kinetic Dominance • Zero Mercy',
    bannerColor: 'from-red-600 via-rose-700 to-amber-600',
    textColor: 'text-rose-400',
    glowColor: 'shadow-rose-600/30',
  },
  tech: {
    id: 'tech',
    label: 'Cyber Matrix',
    tagline: 'Autonomous Precision • Next-Gen AI Strike',
    bannerColor: 'from-cyan-600 via-blue-700 to-indigo-700',
    textColor: 'text-cyan-400',
    glowColor: 'shadow-cyan-500/30',
  },
  armored: {
    id: 'armored',
    label: 'Titan Defender',
    tagline: 'Indestructible Armor • Unyielding Fortitude',
    bannerColor: 'from-amber-600 via-yellow-700 to-orange-800',
    textColor: 'text-amber-400',
    glowColor: 'shadow-amber-500/30',
  },
  speed: {
    id: 'speed',
    label: 'Lightning Strike',
    tagline: 'Velocity Unbound • Surgical Precision',
    bannerColor: 'from-emerald-600 via-teal-700 to-sky-700',
    textColor: 'text-emerald-400',
    glowColor: 'shadow-emerald-500/30',
  },
};

// Default Initial Team Robot Project
export const INITIAL_MECHANICAL_CONFIG: MechanicalConfiguration = {
  chassisId: 'compact',
  driveId: 'balanced',
  wheelsId: 'small',
  armorId: 'aluminum',
  armorThickness: 'medium',
  weaponId: 'wedge',
  utilityId: 'none',
  accentColor: '#22d3ee',
  isCompleted: false,
};

export const INITIAL_ELECTRICAL_CONFIG: ElectricalConfiguration = {
  batteryId: 'medium',
  driveEscRatingA: 50,
  weaponEscRatingA: 80,
  currentLimiterA: 120,
  coolingSystem: 'passive',
  wires: [],
  wiringVerified: false,
  isCompleted: false,
};

export const INITIAL_SOFTWARE_CONFIG: SoftwareConfiguration = {
  computerConnected: false,
  bugsFixed: false,
  softwareUploaded: false,
  codeContent: INITIAL_BOTCODE_SCRIPT,
  initialScript: INITIAL_BOTCODE_SCRIPT,
  approach: 'charge',
  attack: 'immediate',
  recovery: 'reverse_turn',
  rules: [...DEFAULT_SOFTWARE_RULES],
  sensorPackage: 'basic',
  isCompleted: false,
  testPassed: false,
};

export const INITIAL_PROJECT_LEAD_CONFIG: ProjectLeadConfiguration = {
  baseBudgetUsd: 1800,
  budgetCapUsd: 1800,
  sponsorshipUsd: 0,
  sponsorTier: 'None',
  adPrompt: '',
  adHeadline: '',
  campaignScore: 0,
  activeSponsors: [],
  campaign: null,
  shippingTier: 'standard',
  sparePartsKit: 'drive',
  complianceSigned: false,
  isCompleted: false,
};

export function createInitialTeamProject(teamName = 'TEAM TITAN'): TeamRobotProject {
  return {
    teamName,
    activeRole: null,
    mechanical: { ...INITIAL_MECHANICAL_CONFIG },
    electrical: { ...INITIAL_ELECTRICAL_CONFIG, wires: [] },
    software: {
      ...INITIAL_SOFTWARE_CONFIG,
      initialScript: INITIAL_BOTCODE_SCRIPT,
      rules: [...DEFAULT_SOFTWARE_RULES],
    },
    projectLead: {
      ...INITIAL_PROJECT_LEAD_CONFIG,
      activeSponsors: [],
    },
    derivedStats: {} as TeamRobotProject['derivedStats'],
    integration: {
      overallPassed: false,
      mechanicalPassed: false,
      electricalPassed: false,
      softwarePassed: false,
      projectLeadPassed: false,
      failures: [],
      warnings: [],
    },
    lastBattleResult: null,
  };
}
