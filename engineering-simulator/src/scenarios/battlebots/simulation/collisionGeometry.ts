import { CHASSIS_CATALOG } from '../data/components';
import { type BossId, type RobotConfiguration } from '../types/robot';

export interface BoxCollider2D {
  center: [number, number]; // [x, z] in arena world coords
  halfExtents: [number, number]; // [hx, hz] along local axes
  rotationRad: number; // yaw angle in radians
  uX: [number, number]; // unit vector along local width [ux, uz]
  uZ: [number, number]; // unit vector along local length [ux, uz] (facing forward when heading = 0)
}

export interface WeaponContactZone {
  center: [number, number];
  halfExtents: [number, number];
  rotationRad: number;
  uX: [number, number];
  uZ: [number, number];
  reachDistance: number;
  isFrontalWeapon: boolean;
  is360Perimeter: boolean; // e.g. Cyclone's rotating ring
  perimeterRadius?: number;
}

export interface RobotCollisionModel {
  chassis: BoxCollider2D;
  weapon: WeaponContactZone;
  corners: [number, number][]; // 4 world-space corners of chassis [x, z]
}

export interface ContactManifold {
  hasContact: boolean;
  penetration: number;
  normal: [number, number]; // Points from robot A to robot B
  contactPoint: [number, number]; // World [x, z]
  isWeaponContactA: boolean;
  isWeaponContactB: boolean;
}

/**
 * Derives accurate 2D Oriented Bounding Box (OBB) and Weapon Contact Zone
 * strictly from the actual 3D rendering dimensions and configuration.
 */
export function getRobotCollisionModel(
  x: number,
  z: number,
  headingRad: number,
  config: RobotConfiguration,
  bossId?: BossId | null
): RobotCollisionModel {
  const isBull = bossId === 'bull';
  const isCyclone = bossId === 'cyclone';
  const isScorpion = bossId === 'scorpion';
  const isSpider = bossId === 'spider';
  const isTitan = bossId === 'titan';

  const chassisSpec = CHASSIS_CATALOG[config.chassisId] || CHASSIS_CATALOG['compact'];
  const { width: cW, length: cL } = chassisSpec.dims;

  // Compute chassis half-extents including wheel track and armor plate standoffs
  let hx = cW * 0.5;
  let hz = cL * 0.5;

  if (isBull) {
    // The Bull uses wide chassis + high traction heavy tread wheels + side plates
    hx = 1.95 * 0.5 + 0.16; // 1.135m total half-width
    hz = 1.60 * 0.5;        // 0.80m half-length
  } else if (isCyclone) {
    hx = cW * 0.5 + 0.12;
    hz = cL * 0.5 + 0.05;
  } else if (isScorpion) {
    hx = 1.45 * 0.5 + 0.15;
    hz = 1.55 * 0.5;
  } else if (isSpider) {
    hx = 1.35 * 0.5 + 0.18; // Hexagonal outriggers
    hz = 1.40 * 0.5;
  } else if (isTitan) {
    hx = 1.90 * 0.5 + 0.18;
    hz = 1.65 * 0.5;
  } else {
    // Player bot: wheels stick out laterally by ~0.15 - 0.22m
    const wheelOffset =
      config.wheelsId === 'high-traction'
        ? 0.18
        : config.wheelsId === 'tracks'
        ? 0.20
        : config.wheelsId === 'large'
        ? 0.16
        : 0.14;
    hx += wheelOffset;
    // Glacis plates and bumpers add slight forward/rear margin
    hz += 0.04;
  }

  // Heading unit vectors: In Three.js model, local +Z is forward, local +X is right
  // Under rotation by headingRad around Y (Three.js standard):
  // forward vector (local +Z): [sin(heading), cos(heading)]
  // right vector (local +X): [cos(heading), -sin(heading)]
  const fX = Math.sin(headingRad);
  const fZ = Math.cos(headingRad);
  const rX = Math.cos(headingRad);
  const rZ = -Math.sin(headingRad);

  const uX: [number, number] = [rX, rZ];
  const uZ: [number, number] = [fX, fZ];

  const chassis: BoxCollider2D = {
    center: [x, z],
    halfExtents: [hx, hz],
    rotationRad: headingRad,
    uX,
    uZ,
  };

  // 4 World-space corners of chassis OBB
  const corners: [number, number][] = [
    [x + rX * hx + fX * hz, z + rZ * hx + fZ * hz], // front-right
    [x - rX * hx + fX * hz, z - rZ * hx + fZ * hz], // front-left
    [x - rX * hx - fX * hz, z - rZ * hx - fZ * hz], // rear-left
    [x + rX * hx - fX * hz, z + rZ * hx - fZ * hz], // rear-right
  ];

  // Weapon Contact Geometry
  let wCenterOffset: number;
  let wHalfWidth: number;
  let wHalfDepth: number;
  const isFrontal = true;
  let is360 = false;
  let perimeterRadius = 0;

  if (isBull) {
    // Massive sloped bronze dozer blade & steel horns protruding forward
    // In Robot3D: horns and plow extend z = cL*0.5 + 0.18 to +0.65m forward
    wCenterOffset = hz + 0.32;
    wHalfWidth = hx * 0.98;
    wHalfDepth = 0.30;
  } else if (isCyclone) {
    // Cyclone's rotating horizontal ring encircles the robot at radius ~1.25m
    is360 = true;
    perimeterRadius = Math.max(hx, hz) + 0.38;
    wCenterOffset = 0;
    wHalfWidth = perimeterRadius;
    wHalfDepth = perimeterRadius;
  } else if (isScorpion) {
    // Front clamping pincers (z = cL*0.5 + 0.14 to 0.70m)
    wCenterOffset = hz + 0.38;
    wHalfWidth = hx * 0.92;
    wHalfDepth = 0.32;
  } else if (isSpider) {
    // Front twin high-RPM drums
    wCenterOffset = hz + 0.24;
    wHalfWidth = hx * 0.75;
    wHalfDepth = 0.22;
  } else if (isTitan) {
    // Central heavy kinetic drum & forward ramming shields
    wCenterOffset = hz + 0.32;
    wHalfWidth = hx * 0.88;
    wHalfDepth = 0.28;
  } else {
    // Player Weapons
    const wId = config.weaponId;
    if (wId === 'horizontal-spinner') {
      // 1.65m long spinning AR500 bar centered at front
      wCenterOffset = hz + 0.26;
      wHalfWidth = 0.82; // 1.64m full span
      wHalfDepth = 0.28;
    } else if (wId === 'vertical-spinner') {
      // 0.76m diameter vertical disc protruding forward
      wCenterOffset = hz + 0.28;
      wHalfWidth = 0.42;
      wHalfDepth = 0.30;
    } else if (wId === 'lifter') {
      // Lifting forks extending forward
      wCenterOffset = hz + 0.34;
      wHalfWidth = hx * 0.75;
      wHalfDepth = 0.32;
    } else if (wId === 'grabber') {
      // Hydraulic pincers
      wCenterOffset = hz + 0.35;
      wHalfWidth = hx * 0.85;
      wHalfDepth = 0.34;
    } else if (wId === 'hammer') {
      // Overhead hammer arm strikes in front
      wCenterOffset = hz + 0.42;
      wHalfWidth = 0.32;
      wHalfDepth = 0.24;
    } else {
      // Wedge: Full-width sloped deflection plow
      wCenterOffset = hz + 0.24;
      wHalfWidth = hx * 0.95;
      wHalfDepth = 0.24;
    }
  }

  const wCenterX = x + fX * wCenterOffset;
  const wCenterZ = z + fZ * wCenterOffset;

  const weapon: WeaponContactZone = {
    center: [wCenterX, wCenterZ],
    halfExtents: [wHalfWidth, wHalfDepth],
    rotationRad: headingRad,
    uX,
    uZ,
    reachDistance: wCenterOffset + wHalfDepth,
    isFrontalWeapon: isFrontal,
    is360Perimeter: is360,
    perimeterRadius,
  };

  return { chassis, weapon, corners };
}

/**
 * Separating Axis Theorem (SAT) collision test between two Oriented Bounding Boxes (OBB).
 * Returns true if overlapping, along with minimum penetration depth and contact normal pointing from A to B.
 */
export function testOBBOBB(
  a: BoxCollider2D,
  b: BoxCollider2D
): { overlap: boolean; penetration: number; normal: [number, number]; contactPoint: [number, number] } {
  const dX = b.center[0] - a.center[0];
  const dZ = b.center[1] - a.center[1];

  // 4 Candidate Separating Axes: 2 from box A (local X, local Z) and 2 from box B (local X, local Z)
  const axes: [number, number][] = [
    a.uX,
    a.uZ,
    b.uX,
    b.uZ,
  ];

  let minPenetration = Number.POSITIVE_INFINITY;
  let bestNormal: [number, number] = [0, 0];

  for (let i = 0; i < axes.length; i++) {
    const ax = axes[i][0];
    const az = axes[i][1];

    // Project delta center onto axis
    const distOnAxis = Math.abs(dX * ax + dZ * az);

    // Project Box A extents onto axis
    const projA =
      a.halfExtents[0] * Math.abs(a.uX[0] * ax + a.uX[1] * az) +
      a.halfExtents[1] * Math.abs(a.uZ[0] * ax + a.uZ[1] * az);

    // Project Box B extents onto axis
    const projB =
      b.halfExtents[0] * Math.abs(b.uX[0] * ax + b.uX[1] * az) +
      b.halfExtents[1] * Math.abs(b.uZ[0] * ax + b.uZ[1] * az);

    const overlap = projA + projB - distOnAxis;
    if (overlap <= 0) {
      // Separating axis found: boxes do not intersect!
      return { overlap: false, penetration: 0, normal: [0, 0], contactPoint: [0, 0] };
    }

    if (overlap < minPenetration) {
      minPenetration = overlap;
      // Normal points from A to B
      const sign = (dX * ax + dZ * az) >= 0 ? 1 : -1;
      bestNormal = [ax * sign, az * sign];
    }
  }

  // Contact point on boundary between A and B along contact normal
  const rA =
    a.halfExtents[0] * Math.abs(a.uX[0] * bestNormal[0] + a.uX[1] * bestNormal[1]) +
    a.halfExtents[1] * Math.abs(a.uZ[0] * bestNormal[0] + a.uZ[1] * bestNormal[1]);
  const rB =
    b.halfExtents[0] * Math.abs(b.uX[0] * bestNormal[0] + b.uX[1] * bestNormal[1]) +
    b.halfExtents[1] * Math.abs(b.uZ[0] * bestNormal[0] + b.uZ[1] * bestNormal[1]);

  const pA_x = a.center[0] + bestNormal[0] * rA;
  const pA_z = a.center[1] + bestNormal[1] * rA;
  const pB_x = b.center[0] - bestNormal[0] * rB;
  const pB_z = b.center[1] - bestNormal[1] * rB;

  const contactX = (pA_x + pB_x) * 0.5;
  const contactZ = (pA_z + pB_z) * 0.5;

  return {
    overlap: true,
    penetration: minPenetration,
    normal: bestNormal,
    contactPoint: [contactX, contactZ],
  };
}

/**
 * Tests weapon zone contact against opponent chassis.
 */
export function testWeaponChassisContact(
  weapon: WeaponContactZone,
  opponentChassis: BoxCollider2D
): { hit: boolean; contactPoint: [number, number] } {
  if (weapon.is360Perimeter && weapon.perimeterRadius) {
    // Circle/ring vs box check
    const dx = opponentChassis.center[0] - weapon.center[0];
    const dz = opponentChassis.center[1] - weapon.center[1];
    const dist = Math.hypot(dx, dz);
    const oppRadius = Math.min(opponentChassis.halfExtents[0], opponentChassis.halfExtents[1]);
    if (dist <= weapon.perimeterRadius + oppRadius) {
      return {
        hit: true,
        contactPoint: [
          weapon.center[0] + (dx / Math.max(0.001, dist)) * weapon.perimeterRadius,
          weapon.center[1] + (dz / Math.max(0.001, dist)) * weapon.perimeterRadius,
        ],
      };
    }
    return { hit: false, contactPoint: [0, 0] };
  }

  const weaponBox: BoxCollider2D = {
    center: weapon.center,
    halfExtents: weapon.halfExtents,
    rotationRad: weapon.rotationRad,
    uX: weapon.uX,
    uZ: weapon.uZ,
  };

  const res = testOBBOBB(weaponBox, opponentChassis);
  return { hit: res.overlap, contactPoint: res.contactPoint };
}
