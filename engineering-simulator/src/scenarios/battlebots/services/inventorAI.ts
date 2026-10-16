import { type CustomComponentSpec, type CustomGeometryType } from '../types/robot';

export interface InventorProvider {
  generateComponent(prompt: string): Promise<CustomComponentSpec>;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// Strict engineering budget validator: ensures no component has maximum energy/armor with zero mass/power
export function validateAndClampCustomComponent(raw: CustomComponentSpec): CustomComponentSpec {
  const energy = clamp(raw.weaponEnergyPotential, 0, 3950);
  const frontArmor = clamp(raw.armorEffect.front, -10, 34);
  const sideArmor = clamp(raw.armorEffect.side, -10, 30);
  const rearArmor = clamp(raw.armorEffect.rear, -10, 28);

  // Enforce minimum physical mass based on energy, armor, and durability
  const minRequiredMass =
    1.8 +
    (energy / 1200) * 1.35 +
    Math.max(0, frontArmor + sideArmor + rearArmor) * 0.045 +
    Math.max(0, raw.tractionEffect) * 3.5;

  const validatedMass = Number(clamp(Math.max(raw.mass, minRequiredMass), 1.8, 7.2).toFixed(1));

  // Enforce power draw proportional to kinetic energy
  const minPowerDraw = energy > 600 ? Number(((energy / 1500) * 1.05).toFixed(2)) : raw.powerDraw;
  const validatedPower = Number(clamp(Math.max(raw.powerDraw, minPowerDraw), 0.0, 3.1).toFixed(2));

  // Enforce recoil proportional to energy
  const minRecoil = energy > 800 ? Math.round((energy / 4000) * 82) : raw.recoilScore;
  const validatedRecoil = clamp(Math.max(raw.recoilScore, minRecoil), 5, 92);

  return {
    ...raw,
    mass: validatedMass,
    powerDraw: validatedPower,
    weaponEnergyPotential: Math.round(energy),
    recoilScore: validatedRecoil,
    durability: clamp(raw.durability, 0.65, 1.35),
    tractionEffect: Number(clamp(raw.tractionEffect, -0.12, 0.22).toFixed(2)),
    stabilityEffect: Math.round(clamp(raw.stabilityEffect, -22, 18)),
    turningEffect: Math.round(clamp(raw.turningEffect, -24, 16)),
    centerOfMassEffect: Number(clamp(raw.centerOfMassEffect, -0.25, 0.38).toFixed(2)),
    armorEffect: {
      front: Math.round(frontArmor),
      side: Math.round(sideArmor),
      rear: Math.round(rearArmor),
    },
  };
}

class DeterministicEngineeringInventorProvider implements InventorProvider {
  public async generateComponent(prompt: string): Promise<CustomComponentSpec> {
    const clean = prompt.trim();
    const lower = clean.toLowerCase();

    // Detect "cheat" / impossible physics prompts
    const isCheatAttempt =
      lower.includes('indestructible') ||
      lower.includes('weighs nothing') ||
      lower.includes('zero weight') ||
      lower.includes('0 lb') ||
      lower.includes('no weight') ||
      lower.includes('infinite') ||
      lower.includes('destroys everything') ||
      lower.includes('invincible') ||
      lower.includes('unbreakable') ||
      lower.includes('cheat');

    const constraintNote = isCheatAttempt
      ? 'Engineering Constraint Applied: Conservation of mass and energy prevent zero-weight or indestructible parts. Generated a high-output lightweight kinetic spinner that balances high impact against power draw, moderate durability, and chassis recoil.'
      : undefined;

    // 1. Cheat attempt OR lightweight high-speed spinner request
    if (isCheatAttempt) {
      return validateAndClampCustomComponent({
        id: 'custom-weapon',
        name: 'LIGHTWEIGHT HIGH-SPEED SPINNER',
        category: 'weapon',
        promptUsed: clean,
        description:
          'High-RPM pocketed titanium-rim rotor engineered for maximum kinetic transfer per pound, trading structural bulk for rotational velocity.',
        geometryType: 'high-rpm-mini-drum',
        geometryParameters: {
          primaryColor: '#f43f5e',
          secondaryColor: '#38bdf8',
          armCount: 3,
          lengthScale: 1.05,
          spreadScale: 1.1,
          discRadius: 0.44,
          plateAngleDeg: 25,
        },
        mass: 4.8,
        powerDraw: 2.55,
        impactType: 'kinetic',
        weaponEnergyPotential: 3450,
        durability: 0.85,
        tractionEffect: -0.04,
        stabilityEffect: -14,
        turningEffect: -8,
        centerOfMassEffect: 0.28,
        armorEffect: { front: 4, side: 0, rear: 0 },
        spinUpSec: 2.6,
        recoilScore: 74,
        complexity: 'HIGH',
        pros: [
          'High impact energy (3,450 J) relative to mass',
          'Can rupture side plates and launch opponents',
        ],
        tradeoffs: [
          'Requires 2.55 kW peak battery output',
          'High recoil destabilizes light chassis on impact',
          'Moderate structural durability under repeated blows',
        ],
        visualDescription: 'Twin-flanged high-RPM titanium drum with skeletal lightening pockets',
        constraintExplanation: constraintNote,
      });
    }

    // 2. Wheel protection + pushing / plow utility or hybrid
    if (
      (lower.includes('wheel') && (lower.includes('protect') || lower.includes('guard') || lower.includes('shield'))) ||
      (lower.includes('push') && (lower.includes('protect') || lower.includes('guard') || lower.includes('skirt')))
    ) {
      return validateAndClampCustomComponent({
        id: 'custom-utility',
        name: 'ARMORED OUTRIGGER PLOW SKIRTS',
        category: 'utility',
        promptUsed: clean,
        description:
          'Wrap-around sloped side fenders integrated with a ground-scraping front push lip to shield drive wheels and boost shoving leverage.',
        geometryType: 'armored-plow-guards',
        geometryParameters: {
          primaryColor: '#22d3ee',
          secondaryColor: '#64748b',
          armCount: 2,
          lengthScale: 1.15,
          spreadScale: 1.25,
          discRadius: 0.25,
          plateAngleDeg: 34,
        },
        mass: 2.7,
        powerDraw: 0.05,
        impactType: 'deflect',
        weaponEnergyPotential: 180,
        durability: 1.25,
        tractionEffect: 0.14,
        stabilityEffect: 11,
        turningEffect: -14,
        centerOfMassEffect: -0.16,
        armorEffect: { front: 18, side: 26, rear: 8 },
        spinUpSec: 0,
        recoilScore: 6,
        complexity: 'LOW',
        pros: [
          'Shields exposed wheels (+26 side armor)',
          'Improves pushing grip (+0.14 μ) & front deflection',
        ],
        tradeoffs: [
          'Adds 2.7 LB perimeter weight',
          'Wider footprint slows turning speed (-14 deg/s)',
        ],
        visualDescription: 'Angled side-skirt outriggers with twin front deflection gussets',
      });
    }

    // 3. Grabbing / clamping arms
    if (
      lower.includes('grab') ||
      lower.includes('clamp') ||
      lower.includes('arm') ||
      lower.includes('pincer') ||
      lower.includes('claw') ||
      lower.includes('hold')
    ) {
      return validateAndClampCustomComponent({
        id: 'custom-weapon',
        name: 'TWIN HYDRAULIC CLAMP ARMS',
        category: 'weapon',
        promptUsed: clean,
        description:
          'Dual curved articulated gripping arms with serrated tips designed to trap heavy opponents and drag them across the arena.',
        geometryType: 'twin-clamp',
        geometryParameters: {
          primaryColor: '#f59e0b',
          secondaryColor: '#0ea5e9',
          armCount: 2,
          lengthScale: 1.2,
          spreadScale: 1.3,
          discRadius: 0.28,
          plateAngleDeg: 28,
        },
        mass: 4.3,
        powerDraw: 0.85,
        impactType: 'control',
        weaponEnergyPotential: 720,
        durability: 1.1,
        tractionEffect: 0.06,
        stabilityEffect: 6,
        turningEffect: -10,
        centerOfMassEffect: 0.06,
        armorEffect: { front: 16, side: 8, rear: 0 },
        spinUpSec: 0.7,
        recoilScore: 16,
        complexity: 'HIGH',
        pros: [
          'High clamping & repositioning control over The Bull',
          'Moderate 0.85 kW actuator draw preserves battery runtime',
        ],
        tradeoffs: [
          '4.3 LB front-mounted mass',
          'Wide open-jaw envelope reduces turning agility',
        ],
        visualDescription: 'Two curved hydraulic pincer arms with reinforced pivot knuckles',
      });
    }

    // 4. Flipping / lifting / undercutting
    if (
      lower.includes('flip') ||
      lower.includes('lift') ||
      lower.includes('under') ||
      lower.includes('scoop') ||
      lower.includes('fork') ||
      lower.includes('wedge')
    ) {
      return validateAndClampCustomComponent({
        id: 'custom-weapon',
        name: 'ECCENTRIC TWIN FLIPPER FORKS',
        category: 'weapon',
        promptUsed: clean,
        description:
          'Low-clearance spring-steel piano-key forks paired with a rapid cam-lifter linkage to slip beneath heavy armor and overturn opponents.',
        geometryType: 'eccentric-flipper-forks',
        geometryParameters: {
          primaryColor: '#10b981',
          secondaryColor: '#cbd5e1',
          armCount: 3,
          lengthScale: 1.25,
          spreadScale: 1.15,
          discRadius: 0.3,
          plateAngleDeg: 22,
        },
        mass: 3.6,
        powerDraw: 0.82,
        impactType: 'lift',
        weaponEnergyPotential: 540,
        durability: 1.05,
        tractionEffect: 0.05,
        stabilityEffect: 9,
        turningEffect: -6,
        centerOfMassEffect: -0.14,
        armorEffect: { front: 22, side: 0, rear: 0 },
        spinUpSec: 0.55,
        recoilScore: 15,
        complexity: 'MODERATE',
        pros: [
          'Razor-low front approach angle slips under heavy plows',
          'Fast 0.55s lift cycle can overturn The Bull & self-right',
        ],
        tradeoffs: [
          'Low direct kinetic damage (540 J)',
          'Extended front forks can snag on uneven impacts',
        ],
        visualDescription: 'Three articulated ground-scraping forks with central cam lifter cylinder',
      });
    }

    // 5. Side-hitting / horizontal / wide / flail weapon
    if (
      lower.includes('side') ||
      lower.includes('horizontal') ||
      lower.includes('wide') ||
      lower.includes('bar') ||
      lower.includes('spin') ||
      lower.includes('blade')
    ) {
      return validateAndClampCustomComponent({
        id: 'custom-weapon',
        name: 'OUTRIGGER SIDE-STRIKE ROTOR',
        category: 'weapon',
        promptUsed: clean,
        description:
          'Offset horizontal twin-blade rotor positioned to bypass thick front plows and tear into exposed side armor and drive wheels.',
        geometryType: 'side-flail-spinner',
        geometryParameters: {
          primaryColor: '#ec4899',
          secondaryColor: '#38bdf8',
          armCount: 2,
          lengthScale: 1.3,
          spreadScale: 1.35,
          discRadius: 0.52,
          plateAngleDeg: 18,
        },
        mass: 4.9,
        powerDraw: 2.35,
        impactType: 'kinetic',
        weaponEnergyPotential: 3320,
        durability: 0.92,
        tractionEffect: -0.02,
        stabilityEffect: -12,
        turningEffect: -9,
        centerOfMassEffect: 0.24,
        armorEffect: { front: 2, side: 6, rear: 0 },
        spinUpSec: 2.4,
        recoilScore: 70,
        complexity: 'HIGH',
        pros: [
          'Wide sweep hits side armor & wheels (3,320 J)',
          '1.7 LB lighter than a full-size horizontal cleaver',
        ],
        tradeoffs: [
          '2.35 kW peak power demand requires strong battery',
          'Significant lateral recoil on contact',
        ],
        visualDescription: 'Elevated twin-blade horizontal rotor on cantilevered outrigger boom',
      });
    }

    // 6. Default versatile custom invention: Overhead / angled kinetic impactor
    const geometryTypes: CustomGeometryType[] = [
      'overhead-kinetic-pick',
      'high-rpm-mini-drum',
      'twin-clamp',
      'eccentric-flipper-forks',
    ];
    const hash = clean.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const chosenGeom = geometryTypes[hash % geometryTypes.length];

    return validateAndClampCustomComponent({
      id: 'custom-weapon',
      name: 'CUSTOM TACTICAL IMPACT RIG',
      category: 'weapon',
      promptUsed: clean,
      description: `Custom-engineered combat attachment tailored for: "${clean.slice(0, 68)}". Combines focused impact leverage with reinforced mounting brackets.`,
      geometryType: chosenGeom,
      geometryParameters: {
        primaryColor: '#a855f7',
        secondaryColor: '#22d3ee',
        armCount: 2 + (hash % 2),
        lengthScale: 1.15,
        spreadScale: 1.15,
        discRadius: 0.4,
        plateAngleDeg: 26,
      },
      mass: 4.4,
      powerDraw: 1.65,
      impactType: 'kinetic',
      weaponEnergyPotential: 2450,
      durability: 1.0,
      tractionEffect: 0.0,
      stabilityEffect: -6,
      turningEffect: -8,
      centerOfMassEffect: 0.18,
      armorEffect: { front: 10, side: 4, rear: 0 },
      spinUpSec: 1.6,
      recoilScore: 46,
      complexity: 'MODERATE',
      pros: [
        'Strong 2,450 J impact delivery with 1.6s cycle',
        'Reinforced front mount adds +10 frontal protection',
      ],
      tradeoffs: [
        '4.4 LB mass requires careful armor/battery budgeting',
        '1.65 kW peak draw and moderate chassis recoil',
      ],
      visualDescription: 'Modular multi-element combat actuator built from structural plates, pivots, and striking bars',
    });
  }
}

export const inventorAI: InventorProvider = new DeterministicEngineeringInventorProvider();
