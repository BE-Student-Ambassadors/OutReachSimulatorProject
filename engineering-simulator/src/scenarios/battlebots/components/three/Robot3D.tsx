import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARMOR_CATALOG, ARMOR_THICKNESS_OPTIONS, CHASSIS_CATALOG } from '../../data/components';
import { type ComponentCategory, type CustomComponentSpec, type RobotConfiguration } from '../../types/robot';

export interface Robot3DProps {
  config: RobotConfiguration;
  isBullBoss?: boolean;
  installingCategory?: ComponentCategory | null;
  installProgress?: number; // 0 to 1
  selectedCategory?: ComponentCategory;
  onSelectCategory?: (cat: ComponentCategory) => void;

  // Dynamic simulation / animation states
  wheelSpeedRad?: number; // rad/sec
  wheelSlipping?: boolean;
  weaponActive?: boolean;
  weaponSpinPct?: number; // 0 to 100
  weaponActuationPhase?: number; // 0 to 1 for lifter/hammer/grabber
  chassisPitchRad?: number;
  chassisRollRad?: number;
  isFlipped?: boolean;
  motorTempC?: number;
  damageState?: {
    frontArmorPct: number;
    sideArmorPct: number;
    rearArmorPct: number;
    leftDrivePct: number;
    rightDrivePct: number;
    weaponPct: number;
  };
}

// Procedural 3D primitive builder for AI Inventor Lab components
const ProceduralCustomComponent3D: React.FC<{
  spec: CustomComponentSpec;
  spinRef?: React.RefObject<THREE.Group | null>;
  actuationPhase: number;
}> = ({ spec, spinRef, actuationPhase }) => {
  const { geometryType, geometryParameters } = spec;
  const pColor = geometryParameters.primaryColor || '#22d3ee';
  const sColor = geometryParameters.secondaryColor || '#94a3b8';
  const len = geometryParameters.lengthScale || 1.0;
  const spread = geometryParameters.spreadScale || 1.0;

  if (geometryType === 'twin-clamp') {
    const jawAngle = 0.45 - Math.sin(actuationPhase * Math.PI) * 0.38;
    return (
      <group position={[0, 0.05, 0.12]}>
        {/* Central hydraulic manifold & pivot block */}
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.55 * spread, 0.22, 0.28]} />
          <meshStandardMaterial color={sColor} metalness={0.75} roughness={0.3} />
        </mesh>
        {/* Left & Right articulated curved clamp arms */}
        {[-1, 1].map((dir) => (
          <group
            key={dir}
            position={[dir * 0.24 * spread, 0, 0.08]}
            rotation={[0, dir * -jawAngle, 0]}
          >
            {/* Pivot cylinder */}
            <mesh castShadow position={[0, 0, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 0.28, 16]} />
              <meshStandardMaterial color={pColor} metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Proximal arm bar */}
            <mesh castShadow position={[dir * 0.14, 0, 0.26 * len]} rotation={[0, dir * 0.3, 0]}>
              <boxGeometry args={[0.11, 0.16, 0.55 * len]} />
              <meshStandardMaterial color={pColor} metalness={0.7} roughness={0.25} />
            </mesh>
            {/* Distal curved claw tip */}
            <mesh
              castShadow
              position={[dir * 0.08, 0, 0.56 * len]}
              rotation={[0, dir * -0.48, 0]}
            >
              <boxGeometry args={[0.1, 0.14, 0.36 * len]} />
              <meshStandardMaterial color="#f8fafc" metalness={0.9} roughness={0.15} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (geometryType === 'eccentric-flipper-forks') {
    const liftAngle = -Math.sin(actuationPhase * Math.PI) * 0.65;
    return (
      <group position={[0, -0.04, 0.1]} rotation={[liftAngle, 0, 0]}>
        {/* Crossbar pivot shaft */}
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.85 * spread, 16]} />
          <meshStandardMaterial color={sColor} metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Central cam actuator cylinder */}
        <mesh castShadow position={[0, 0.14, 0.12]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.38, 16]} />
          <meshStandardMaterial color={pColor} metalness={0.7} roughness={0.25} />
        </mesh>
        {/* 3 low-clearance piano-key forks */}
        {[-0.32 * spread, 0, 0.32 * spread].map((xOff, idx) => (
          <group key={idx} position={[xOff, -0.05, 0.32 * len]}>
            <mesh castShadow receiveShadow rotation={[0.14, 0, 0]}>
              <boxGeometry args={[0.13, 0.045, 0.68 * len]} />
              <meshStandardMaterial color={pColor} metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (geometryType === 'armored-plow-guards') {
    return (
      <group>
        {/* Left & Right outrigger wheel-shielding plow skirts */}
        {[-1, 1].map((dir) => (
          <group key={dir} position={[dir * 0.92, -0.04, 0]}>
            <mesh castShadow receiveShadow rotation={[0, 0, dir * -0.18]}>
              <boxGeometry args={[0.12, 0.34, 1.38]} />
              <meshStandardMaterial color={pColor} metalness={0.78} roughness={0.25} />
            </mesh>
            {/* Front angled gusset wedge */}
            <mesh
              castShadow
              position={[dir * -0.08, -0.04, 0.68]}
              rotation={[0.35, dir * 0.35, 0]}
            >
              <boxGeometry args={[0.26, 0.26, 0.12]} />
              <meshStandardMaterial color={sColor} metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (geometryType === 'side-flail-spinner') {
    return (
      <group position={[0, 0.08, 0.18]}>
        {/* Outrigger boom */}
        <mesh castShadow position={[0, 0.04, 0.12]}>
          <boxGeometry args={[0.42, 0.14, 0.48]} />
          <meshStandardMaterial color={sColor} metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Spinning horizontal rotor assembly */}
        <group ref={spinRef} position={[0, 0.14, 0.32]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.14, 20]} />
            <meshStandardMaterial color={pColor} metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh castShadow>
            <boxGeometry args={[1.35 * spread, 0.06, 0.22]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.92} roughness={0.15} />
          </mesh>
          {[-0.62 * spread, 0.62 * spread].map((xPos, i) => (
            <mesh key={i} castShadow position={[xPos, 0, 0.08]}>
              <boxGeometry args={[0.18, 0.09, 0.18]} />
              <meshStandardMaterial color={pColor} metalness={0.8} roughness={0.2} />
            </mesh>
          ))}
        </group>
      </group>
    );
  }

  // Default / high-rpm-mini-drum / overhead-kinetic-pick
  return (
    <group position={[0, 0.05, 0.18]}>
      {/* Twin bulkhead supports */}
      {[-0.32, 0.32].map((xPos, i) => (
        <mesh key={i} castShadow position={[xPos, 0, 0.12]}>
          <boxGeometry args={[0.08, 0.34, 0.42]} />
          <meshStandardMaterial color={sColor} metalness={0.75} roughness={0.3} />
        </mesh>
      ))}
      {/* Spinning multi-tooth kinetic drum */}
      <group ref={spinRef} position={[0, 0.04, 0.28]}>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.28, 0.28, 0.54, 24]} />
          <meshStandardMaterial color={pColor} metalness={0.85} roughness={0.2} />
        </mesh>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((ang, i) => (
          <mesh
            key={i}
            castShadow
            position={[0, Math.sin(ang) * 0.28, Math.cos(ang) * 0.28]}
            rotation={[ang, 0, 0]}
          >
            <boxGeometry args={[0.5, 0.1, 0.14]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.1} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

export const Robot3D: React.FC<Robot3DProps> = ({
  config,
  isBullBoss = false,
  installingCategory = null,
  selectedCategory,
  onSelectCategory,
  wheelSpeedRad = 0,
  wheelSlipping = false,
  weaponActive = false,
  weaponSpinPct = 0,
  weaponActuationPhase = 0,
  chassisPitchRad = 0,
  chassisRollRad = 0,
  isFlipped = false,
  motorTempC = 45,
  damageState,
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const vertSpinnerRef = useRef<THREE.Group>(null);
  const horizSpinnerRef = useRef<THREE.Group>(null);
  const customSpinnerRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const coolingFanRef = useRef<THREE.Group>(null);
  const installAnimRef = useRef<number>(0);

  useEffect(() => {
    if (installingCategory) {
      installAnimRef.current = 1.0; // starts at 1 and decays to 0
    }
  }, [installingCategory]);

  const chassisSpec = CHASSIS_CATALOG[config.chassisId];
  const armorSpec = ARMOR_CATALOG[config.armorId];
  const thickSpec = ARMOR_THICKNESS_OPTIONS[config.armorThickness];

  const { width: cW, length: cL, height: cH } = chassisSpec.dims;
  const plateThickness = 0.045 * thickSpec.visualScale;

  // Compute wheel vertical offset so robot sits cleanly on floor (y = 0)
  const wheelRadius = useMemo(() => {
    if (isBullBoss) return 0.34;
    switch (config.wheelsId) {
      case 'small':
        return 0.23;
      case 'large':
        return 0.42;
      case 'high-traction':
        return 0.32;
      case 'omni':
        return 0.31;
      case 'tracks':
        return 0.28;
    }
  }, [config.wheelsId, isBullBoss]);

  const deckCenterY = useMemo(() => {
    const lowOffset = config.chassisId === 'low-profile' ? -0.05 : 0;
    return Math.max(cH * 0.55 + 0.06, wheelRadius + lowOffset);
  }, [cH, wheelRadius, config.chassisId]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    // Decay mechanical installation offset animation
    if (installAnimRef.current > 0) {
      installAnimRef.current = Math.max(0, installAnimRef.current - dt * 3.2);
    }

    // Rotate wheels
    if (wheelSpeedRad !== 0 || wheelSlipping) {
      const spinRate = wheelSlipping ? 26 : wheelSpeedRad;
      wheelRefs.current.forEach((w) => {
        if (w) {
          w.rotation.x += spinRate * dt;
        }
      });
    }

    // Rotate vertical / horizontal / custom spinners
    const activeSpinPct = weaponActive ? Math.max(35, weaponSpinPct) : weaponSpinPct;
    if (activeSpinPct > 1) {
      const spinSpeed = (activeSpinPct / 100) * 38;
      if (vertSpinnerRef.current) {
        vertSpinnerRef.current.rotation.x -= spinSpeed * dt;
      }
      if (horizSpinnerRef.current) {
        horizSpinnerRef.current.rotation.y += spinSpeed * dt;
      }
      if (customSpinnerRef.current) {
        if (config.customWeapon?.geometryType === 'side-flail-spinner') {
          customSpinnerRef.current.rotation.y += spinSpeed * dt;
        } else {
          customSpinnerRef.current.rotation.x -= spinSpeed * dt;
        }
      }
    }

    // Rotate cooling fans continuously
    if (coolingFanRef.current) {
      coolingFanRef.current.rotation.y += dt * 18;
    }

    // Apply chassis pitch, roll, and flipped inversion smoothly
    if (rootRef.current) {
      const targetFlipRoll = isFlipped ? Math.PI : 0;
      rootRef.current.rotation.x = THREE.MathUtils.lerp(
        rootRef.current.rotation.x,
        chassisPitchRad,
        dt * 12
      );
      rootRef.current.rotation.z = THREE.MathUtils.lerp(
        rootRef.current.rotation.z,
        chassisRollRad + targetFlipRoll,
        dt * 10
      );
    }
  });

  // Helper for mechanical slide-in offset
  const getInstallOffset = (...args: unknown[]): [number, number, number] => {
    void args;
    return [0, 0, 0];
  };

  const handlePartClick = (cat: ComponentCategory, e: { stopPropagation: () => void }) => {
    if (onSelectCategory) {
      e.stopPropagation();
      onSelectCategory(cat);
    }
  };

  // Thermal glow color for internal motor housings
  const motorGlowColor =
    motorTempC > 85 ? '#ef4444' : motorTempC > 68 ? '#f59e0b' : '#0ea5e9';
  const motorGlowIntensity = Math.min(2.2, Math.max(0.2, (motorTempC - 35) / 35));

  // Armor damage tinting
  const frontDamaged = (damageState?.frontArmorPct ?? 100) < 45;
  const sideDamaged = (damageState?.sideArmorPct ?? 100) < 45;

  // Lifter / Hammer / Grabber angles
  const lifterAngle = -Math.sin(weaponActuationPhase * Math.PI) * 0.72;
  const hammerAngle = Math.sin(weaponActuationPhase * Math.PI) * 1.65;
  const grabberAngle = 0.42 - Math.sin(weaponActuationPhase * Math.PI) * 0.36;

  return (
    <group ref={rootRef} position={[0, deckCenterY, 0]}>
      {/* ============================================================
          1. CHASSIS CORE
         ============================================================ */}
      <group
        position={getInstallOffset('chassis', 'y', 1)}
        onClick={(e) => handlePartClick('chassis', e)}
      >
        {/* Main structural frame tub */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[cW, cH, cL]} />
          <meshStandardMaterial
            color={isBullBoss ? '#1c1917' : '#1e293b'}
            metalness={0.78}
            roughness={0.32}
          />
        </mesh>

        {/* Chassis structural rails & accent trim */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            castShadow
            position={[side * (cW * 0.48), cH * 0.51, 0]}
          >
            <boxGeometry args={[0.07, 0.04, cL * 0.94]} />
            <meshStandardMaterial
              color={config.accentColor}
              emissive={config.accentColor}
              emissiveIntensity={selectedCategory === 'chassis' ? 0.85 : 0.35}
              metalness={0.6}
              roughness={0.2}
            />
          </mesh>
        ))}

        {/* Top diagnostic deck viewport */}
        <mesh position={[0, cH * 0.51, -0.08]}>
          <boxGeometry args={[cW * 0.52, 0.02, cL * 0.48]} />
          <meshStandardMaterial
            color="#090d16"
            metalness={0.9}
            roughness={0.15}
          />
        </mesh>
      </group>

      {/* ============================================================
          2. DRIVE SYSTEM (Left & Right Internal Motor Pods + Vents)
         ============================================================ */}
      <group
        position={getInstallOffset('drive', 'y', 1)}
        onClick={(e) => handlePartClick('drive', e)}
      >
        {[-1, 1].map((side) => {
          const motorScale =
            config.driveId === 'torque'
              ? 1.25
              : config.driveId === 'lightweight'
              ? 0.72
              : 1.0;
          return (
            <group key={side} position={[side * (cW * 0.24), cH * 0.42, -cL * 0.14]}>
              {/* Brushless motor can */}
              <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry
                  args={[0.11 * motorScale, 0.11 * motorScale, 0.28 * motorScale, 16]}
                />
                <meshStandardMaterial
                  color={config.driveId === 'speed' ? '#0284c7' : config.driveId === 'torque' ? '#d97706' : '#64748b'}
                  metalness={0.85}
                  roughness={0.22}
                />
              </mesh>
              {/* Thermal copper coil glow ring */}
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry
                  args={[0.115 * motorScale, 0.115 * motorScale, 0.08, 16]}
                />
                <meshStandardMaterial
                  color={motorGlowColor}
                  emissive={motorGlowColor}
                  emissiveIntensity={motorGlowIntensity}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* ============================================================
          3. POWER SYSTEM (Battery Core & Charge Telemetry Bar)
         ============================================================ */}
      <group
        position={getInstallOffset('power', 'y', 1)}
        onClick={(e) => handlePartClick('power', e)}
      >
        {(() => {
          const battScale =
            config.batteryId === 'large'
              ? 1.32
              : config.batteryId === 'small'
              ? 0.72
              : 1.0;
          return (
            <group position={[0, cH * 0.48, 0.08]}>
              <mesh castShadow>
                <boxGeometry args={[0.36 * battScale, 0.14, 0.34 * battScale]} />
                <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.3} />
              </mesh>
              {/* Glowing LiPo cell indicator bars */}
              {[-0.08, 0, 0.08].map((zOff, i) => (
                <mesh key={i} position={[0, 0.075, zOff * battScale]}>
                  <boxGeometry args={[0.28 * battScale, 0.015, 0.04]} />
                  <meshStandardMaterial
                    color="#22d3ee"
                    emissive="#22d3ee"
                    emissiveIntensity={0.95}
                  />
                </mesh>
              ))}
            </group>
          );
        })()}
      </group>

      {/* ============================================================
          4. WHEELS OR CONTINUOUS TRACKS
         ============================================================ */}
      <group
        position={getInstallOffset('wheels', 'x', 1)}
        onClick={(e) => handlePartClick('wheels', e)}
      >
        {config.wheelsId === 'tracks' && !isBullBoss ? (
          // Continuous Track Modules on Left & Right
          [-1, 1].map((side) => {
            const xPos = side * (cW * 0.5 + 0.15);
            return (
              <group key={side} position={[xPos, -0.04, 0]}>
                {/* Armored track belt outer loop */}
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[0.22, 0.44, cL * 0.96]} />
                  <meshStandardMaterial color="#18181b" metalness={0.3} roughness={0.85} />
                </mesh>
                {/* Internal bogie frame */}
                <mesh castShadow>
                  <boxGeometry args={[0.24, 0.22, cL * 0.82]} />
                  <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
                </mesh>
                {/* Front & Rear drive sprockets */}
                {[-cL * 0.38, 0, cL * 0.38].map((zBogie, bIdx) => (
                  <group
                    key={bIdx}
                    ref={(el) => {
                      wheelRefs.current[side === -1 ? bIdx : bIdx + 3] = el;
                    }}
                    position={[side * 0.02, 0, zBogie]}
                  >
                    <mesh rotation={[0, 0, Math.PI / 2]}>
                      <cylinderGeometry args={[0.19, 0.19, 0.25, 12]} />
                      <meshStandardMaterial
                        color={config.accentColor}
                        metalness={0.75}
                        roughness={0.3}
                      />
                    </mesh>
                  </group>
                ))}
              </group>
            );
          })
        ) : (
          // 4 Distinct Wheels (Small, Large, High-Traction, Omni)
          [-1, 1].map((side) =>
            [-1, 1].map((frontBack) => {
              const idx = (side === -1 ? 0 : 2) + (frontBack === -1 ? 0 : 1);
              const wheelWidth =
                isBullBoss || config.wheelsId === 'high-traction'
                  ? 0.22
                  : config.wheelsId === 'large'
                  ? 0.19
                  : 0.15;
              const xPos = side * (cW * 0.5 + wheelWidth * 0.56);
              const zPos = frontBack * (cL * 0.33);

              return (
                <group
                  key={`${side}-${frontBack}`}
                  ref={(el) => {
                    wheelRefs.current[idx] = el;
                  }}
                  position={[xPos, 0, zPos]}
                >
                  {/* Main tire cylinder */}
                  <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry
                      args={[
                        wheelRadius,
                        wheelRadius,
                        wheelWidth,
                        config.wheelsId === 'high-traction' ? 14 : 24,
                      ]}
                    />
                    <meshStandardMaterial
                      color={
                        config.wheelsId === 'high-traction'
                          ? '#eab308'
                          : config.wheelsId === 'omni'
                          ? '#334155'
                          : '#18181b'
                      }
                      metalness={config.wheelsId === 'omni' ? 0.6 : 0.15}
                      roughness={0.78}
                    />
                  </mesh>

                  {/* Wheel hubcap */}
                  <mesh rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry
                      args={[wheelRadius * 0.55, wheelRadius * 0.55, wheelWidth + 0.02, 12]}
                    />
                    <meshStandardMaterial
                      color={isBullBoss ? '#d97706' : config.accentColor}
                      metalness={0.8}
                      roughness={0.25}
                    />
                  </mesh>

                  {/* Omni wheel angled sub-rollers */}
                  {config.wheelsId === 'omni' &&
                    !isBullBoss &&
                    [0, 1, 2, 3, 4, 5].map((rIdx) => {
                      const ang = (rIdx * Math.PI) / 3;
                      return (
                        <mesh
                          key={rIdx}
                          position={[
                            0,
                            Math.sin(ang) * (wheelRadius * 0.92),
                            Math.cos(ang) * (wheelRadius * 0.92),
                          ]}
                          rotation={[ang + 0.6, 0, Math.PI / 2]}
                        >
                          <cylinderGeometry args={[0.055, 0.055, wheelWidth * 0.85, 8]} />
                          <meshStandardMaterial color="#38bdf8" metalness={0.5} roughness={0.3} />
                        </mesh>
                      );
                    })}

                  {/* High-traction aggressive tread lugs */}
                  {(config.wheelsId === 'high-traction' || isBullBoss) &&
                    [0, 1, 2, 3, 4, 5, 6, 7].map((tIdx) => {
                      const ang = (tIdx * Math.PI) / 4;
                      return (
                        <mesh
                          key={tIdx}
                          position={[
                            0,
                            Math.sin(ang) * (wheelRadius * 0.97),
                            Math.cos(ang) * (wheelRadius * 0.97),
                          ]}
                          rotation={[-ang, 0, 0]}
                        >
                          <boxGeometry args={[wheelWidth * 0.95, 0.045, 0.07]} />
                          <meshStandardMaterial color="#090d16" roughness={0.9} />
                        </mesh>
                      );
                    })}
                </group>
              );
            })
          )
        )}
      </group>

      {/* ============================================================
          5. ARMOR PANELS (Scaled visibly by Thin / Medium / Thick)
         ============================================================ */}
      <group
        position={getInstallOffset('armor', 'y', 1)}
        onClick={(e) => handlePartClick('armor', e)}
      >
        {/* Left & Right side armor plates */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            castShadow
            receiveShadow
            position={[
              side * (cW * 0.5 + plateThickness * 0.5),
              0.02,
              0,
            ]}
            rotation={[0, 0, sideDamaged ? side * 0.12 : 0]}
          >
            <boxGeometry args={[plateThickness, cH * 0.92, cL * 0.72]} />
            <meshStandardMaterial
              color={isBullBoss ? '#292524' : armorSpec.colorHex}
              metalness={armorSpec.metalness}
              roughness={armorSpec.roughness}
              transparent={Boolean(armorSpec.opacity)}
              opacity={armorSpec.opacity ?? 1}
            />
          </mesh>
        ))}

        {/* Top front & rear glacis armor plates */}
        <mesh
          castShadow
          receiveShadow
          position={[0, cH * 0.5 + plateThickness * 0.5, cL * 0.28]}
          rotation={[frontDamaged ? -0.1 : 0.08, 0, 0]}
        >
          <boxGeometry args={[cW * 0.88, plateThickness, cL * 0.34]} />
          <meshStandardMaterial
            color={isBullBoss ? '#b45309' : armorSpec.colorHex}
            metalness={armorSpec.metalness}
            roughness={armorSpec.roughness}
            transparent={Boolean(armorSpec.opacity)}
            opacity={armorSpec.opacity ?? 1}
          />
        </mesh>

        {/* Rear bulkhead armor plate */}
        <mesh
          castShadow
          receiveShadow
          position={[0, 0.02, -(cL * 0.5 + plateThickness * 0.5)]}
        >
          <boxGeometry args={[cW * 0.9, cH * 0.88, plateThickness]} />
          <meshStandardMaterial
            color={isBullBoss ? '#44403c' : armorSpec.colorHex}
            metalness={armorSpec.metalness}
            roughness={armorSpec.roughness}
            transparent={Boolean(armorSpec.opacity)}
            opacity={armorSpec.opacity ?? 1}
          />
        </mesh>
      </group>

      {/* ============================================================
          6. FRONT WEAPON SYSTEM (or THE BULL'S HORNED RAMMING PLOW)
         ============================================================ */}
      <group
        position={[
          getInstallOffset('weapon', 'z', 1)[0],
          getInstallOffset('weapon', 'z', 1)[1],
          cL * 0.5 + getInstallOffset('weapon', 'z', 1)[2],
        ]}
        onClick={(e) => handlePartClick('weapon', e)}
      >
        {isBullBoss ? (
          // THE BULL'S SIGNATURE HEAVY BRONZE & STEEL BULL-PLOW + HORNS
          <group position={[0, -0.04, 0.18]}>
            {/* Massive sloped front dozer blade */}
            <mesh castShadow receiveShadow rotation={[0.42, 0, 0]} position={[0, 0.02, 0.12]}>
              <boxGeometry args={[cW * 1.16, 0.14, 0.62]} />
              <meshStandardMaterial color="#b45309" metalness={0.88} roughness={0.28} />
            </mesh>
            {/* Lower ground-scraping steel lip */}
            <mesh castShadow position={[0, -0.14, 0.34]} rotation={[0.18, 0, 0]}>
              <boxGeometry args={[cW * 1.18, 0.06, 0.28]} />
              <meshStandardMaterial color="#e7e5e4" metalness={0.92} roughness={0.2} />
            </mesh>
            {/* Left & Right menacing metallic bull horns */}
            {[-1, 1].map((side) => (
              <group
                key={side}
                position={[side * (cW * 0.44), 0.18, 0.08]}
                rotation={[-0.35, side * -0.28, side * 0.2]}
              >
                <mesh castShadow>
                  <coneGeometry args={[0.11, 0.68, 12]} />
                  <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.18} />
                </mesh>
              </group>
            ))}
            {/* Glowing red optic visor */}
            <mesh position={[0, 0.2, -0.05]}>
              <boxGeometry args={[0.75, 0.06, 0.08]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#ef4444"
                emissiveIntensity={1.6}
              />
            </mesh>
          </group>
        ) : config.weaponId === 'custom-weapon' && config.customWeapon ? (
          <ProceduralCustomComponent3D
            spec={config.customWeapon}
            spinRef={customSpinnerRef}
            actuationPhase={weaponActuationPhase}
          />
        ) : config.weaponId === 'vertical-spinner' ? (
          // VERTICAL SPINNER: Twin bulkhead mounts + large rotating uppercut drum/disc
          <group position={[0, 0.02, 0.16]}>
            {[-0.34, 0.34].map((xOff, i) => (
              <mesh key={i} castShadow position={[xOff, 0, 0.08]}>
                <boxGeometry args={[0.09, 0.38, 0.46]} />
                <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.28} />
              </mesh>
            ))}
            <group ref={vertSpinnerRef} position={[0, 0.05, 0.26]}>
              {/* Heavy primary disc */}
              <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.38, 0.38, 0.24, 24]} />
                <meshStandardMaterial
                  color={config.accentColor}
                  metalness={0.85}
                  roughness={0.2}
                />
              </mesh>
              {/* Asymmetric S7 tool-steel impact teeth */}
              {[0, Math.PI].map((ang, i) => (
                <mesh
                  key={i}
                  castShadow
                  position={[0, Math.sin(ang) * 0.36, Math.cos(ang) * 0.36]}
                  rotation={[ang, 0, 0]}
                >
                  <boxGeometry args={[0.28, 0.14, 0.18]} />
                  <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.12} />
                </mesh>
              ))}
            </group>
          </group>
        ) : config.weaponId === 'horizontal-spinner' ? (
          // HORIZONTAL SPINNER: Forward cantilevered turret + massive wide cleaver bar
          <group position={[0, 0.06, 0.22]}>
            <mesh castShadow position={[0, -0.02, 0.04]}>
              <boxGeometry args={[0.48, 0.18, 0.44]} />
              <meshStandardMaterial color="#334155" metalness={0.82} roughness={0.28} />
            </mesh>
            <group ref={horizSpinnerRef} position={[0, 0.12, 0.18]}>
              {/* Central rotor hub */}
              <mesh castShadow>
                <cylinderGeometry args={[0.2, 0.2, 0.14, 20]} />
                <meshStandardMaterial color={config.accentColor} metalness={0.85} roughness={0.2} />
              </mesh>
              {/* Wide AR500 horizontal impact bar */}
              <mesh castShadow>
                <boxGeometry args={[1.65, 0.065, 0.24]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.16} />
              </mesh>
              {/* Impact tips */}
              {[-0.78, 0.78].map((xTip, i) => (
                <mesh key={i} castShadow position={[xTip, 0, 0.08]}>
                  <boxGeometry args={[0.16, 0.09, 0.16]} />
                  <meshStandardMaterial color={config.accentColor} metalness={0.85} roughness={0.2} />
                </mesh>
              ))}
            </group>
          </group>
        ) : config.weaponId === 'lifter' ? (
          // LIFTER: Motorized articulated dual fork assembly
          <group position={[0, -0.04, 0.08]} rotation={[lifterAngle, 0, 0]}>
            {/* Pivot axle & hydraulic cylinder */}
            <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.07, 0.07, cW * 0.78, 16]} />
              <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh castShadow position={[0, 0.14, 0.12]} rotation={[0.45, 0, 0]}>
              <cylinderGeometry args={[0.075, 0.09, 0.36, 16]} />
              <meshStandardMaterial color={config.accentColor} metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Left & Right heavy lifting forks */}
            {[-cW * 0.26, cW * 0.26].map((xFork, i) => (
              <group key={i} position={[xFork, -0.06, 0.34]}>
                <mesh castShadow receiveShadow rotation={[0.12, 0, 0]}>
                  <boxGeometry args={[0.14, 0.055, 0.72]} />
                  <meshStandardMaterial color="#f8fafc" metalness={0.9} roughness={0.18} />
                </mesh>
                {/* Upright backstop horn */}
                <mesh castShadow position={[0, 0.12, -0.22]} rotation={[-0.25, 0, 0]}>
                  <boxGeometry args={[0.12, 0.26, 0.07]} />
                  <meshStandardMaterial color={config.accentColor} metalness={0.78} roughness={0.25} />
                </mesh>
              </group>
            ))}
          </group>
        ) : config.weaponId === 'hammer' ? (
          // HAMMER: Dorsal pivot tower + articulated overhead battle hammer/spike
          <group position={[0, cH * 0.45, -0.18]}>
            {/* Twin A-frame tower supports */}
            {[-0.2, 0.2].map((xTower, i) => (
              <mesh key={i} castShadow position={[xTower, 0.18, 0]}>
                <boxGeometry args={[0.06, 0.38, 0.26]} />
                <meshStandardMaterial color="#334155" metalness={0.82} roughness={0.25} />
              </mesh>
            ))}
            {/* Pivoting overhead hammer arm */}
            <group position={[0, 0.32, 0]} rotation={[hammerAngle - 0.35, 0, 0]}>
              <mesh castShadow position={[0, 0, 0.42]}>
                <boxGeometry args={[0.08, 0.08, 0.92]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.2} />
              </mesh>
              {/* Heavy tungsten hammer head + spike */}
              <group position={[0, -0.06, 0.84]}>
                <mesh castShadow>
                  <boxGeometry args={[0.24, 0.28, 0.22]} />
                  <meshStandardMaterial color={config.accentColor} metalness={0.85} roughness={0.2} />
                </mesh>
                <mesh castShadow position={[0, -0.22, 0]} rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[0.09, 0.26, 12]} />
                  <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.1} />
                </mesh>
              </group>
            </group>
          </group>
        ) : config.weaponId === 'grabber' ? (
          // GRABBER: Twin articulated hydraulic crushing pincers + upper clamp jaw
          <group position={[0, 0.0, 0.1]}>
            <mesh castShadow position={[0, 0, 0]}>
              <boxGeometry args={[cW * 0.65, 0.2, 0.24]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
            </mesh>
            {[-1, 1].map((dir) => (
              <group
                key={dir}
                position={[dir * (cW * 0.28), -0.02, 0.08]}
                rotation={[0, dir * -grabberAngle, 0]}
              >
                <mesh castShadow position={[dir * 0.12, 0, 0.28]} rotation={[0, dir * 0.28, 0]}>
                  <boxGeometry args={[0.11, 0.14, 0.56]} />
                  <meshStandardMaterial color={config.accentColor} metalness={0.82} roughness={0.22} />
                </mesh>
                <mesh castShadow position={[dir * 0.06, 0, 0.58]} rotation={[0, dir * -0.52, 0]}>
                  <boxGeometry args={[0.1, 0.14, 0.36]} />
                  <meshStandardMaterial color="#f8fafc" metalness={0.92} roughness={0.15} />
                </mesh>
              </group>
            ))}
          </group>
        ) : (
          // WEDGE: Full-width ground-scraping sloped deflection plow
          <group position={[0, -0.04, 0.16]}>
            <mesh castShadow receiveShadow rotation={[0.48, 0, 0]} position={[0, 0.02, 0.08]}>
              <boxGeometry args={[cW * 1.04, 0.09, 0.56]} />
              <meshStandardMaterial
                color={armorSpec.colorHex}
                metalness={0.88}
                roughness={0.22}
              />
            </mesh>
            {/* Beveled ground-scraping leading edge */}
            <mesh castShadow position={[0, -0.11, 0.32]} rotation={[0.16, 0, 0]}>
              <boxGeometry args={[cW * 1.04, 0.04, 0.22]} />
              <meshStandardMaterial color={config.accentColor} metalness={0.9} roughness={0.18} />
            </mesh>
          </group>
        )}
      </group>

      {/* ============================================================
          7. UTILITY SUBSYSTEM
         ============================================================ */}
      {!isBullBoss && config.utilityId !== 'none' && (
        <group
          position={getInstallOffset('utility', 'y', 1)}
          onClick={(e) => handlePartClick('utility', e)}
        >
          {config.utilityId === 'custom-utility' && config.customUtility ? (
            <ProceduralCustomComponent3D
              spec={config.customUtility}
              actuationPhase={weaponActuationPhase}
            />
          ) : config.utilityId === 'wheel-guards' ? (
            // Armored wrap-around wheel fender guards
            [-1, 1].map((side) => (
              <group key={side} position={[side * (cW * 0.5 + 0.26), 0.02, 0]}>
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[0.07, 0.34, cL * 0.94]} />
                  <meshStandardMaterial color={armorSpec.colorHex} metalness={0.85} roughness={0.25} />
                </mesh>
                <mesh castShadow position={[side * -0.08, 0.16, 0]}>
                  <boxGeometry args={[0.2, 0.05, cL * 0.92]} />
                  <meshStandardMaterial color={config.accentColor} metalness={0.75} roughness={0.25} />
                </mesh>
              </group>
            ))
          ) : config.utilityId === 'self-righting' ? (
            // Dorsal arched self-righting roll hoop
            <group position={[0, cH * 0.55, -0.12]}>
              <mesh castShadow rotation={[0, 0, 0]}>
                <torusGeometry args={[0.38, 0.045, 12, 28, Math.PI]} />
                <meshStandardMaterial color={config.accentColor} metalness={0.85} roughness={0.2} />
              </mesh>
            </group>
          ) : config.utilityId === 'extra-cooling' ? (
            // Dual forced-air blower fans & copper heat pipes on rear deck
            <group position={[0, cH * 0.54, -cL * 0.26]}>
              {[-0.22, 0.22].map((xFan, i) => (
                <group key={i} position={[xFan, 0.04, 0]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.15, 0.16, 0.09, 18]} />
                    <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
                  </mesh>
                  <group ref={i === 0 ? coolingFanRef : undefined}>
                    <mesh position={[0, 0.045, 0]}>
                      <boxGeometry args={[0.24, 0.015, 0.05]} />
                      <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} />
                    </mesh>
                    <mesh position={[0, 0.045, 0]} rotation={[0, Math.PI / 2, 0]}>
                      <boxGeometry args={[0.24, 0.015, 0.05]} />
                      <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} />
                    </mesh>
                  </group>
                </group>
              ))}
            </group>
          ) : config.utilityId === 'rear-wedge' ? (
            // Sloped aft counter-plow wedge
            <group position={[0, -0.03, -(cL * 0.5 + 0.14)]}>
              <mesh castShadow receiveShadow rotation={[-0.5, 0, 0]}>
                <boxGeometry args={[cW * 0.92, 0.09, 0.42]} />
                <meshStandardMaterial color={armorSpec.colorHex} metalness={0.85} roughness={0.25} />
              </mesh>
            </group>
          ) : config.utilityId === 'weapon-guard' ? (
            // Heavy reinforced front shock bulkhead frame
            <group position={[0, 0.04, cL * 0.48]}>
              {[-cW * 0.36, cW * 0.36].map((xGuard, i) => (
                <mesh key={i} castShadow position={[xGuard, 0.06, 0.12]}>
                  <boxGeometry args={[0.14, 0.36, 0.34]} />
                  <meshStandardMaterial color={config.accentColor} metalness={0.88} roughness={0.2} />
                </mesh>
              ))}
            </group>
          ) : config.utilityId === 'traction-module' ? (
            // Underbody magnetic downforce skirt with cyan vacuum glow
            <group position={[0, -cH * 0.48, 0]}>
              <mesh castShadow>
                <boxGeometry args={[cW * 0.92, 0.06, cL * 0.84]} />
                <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.025, 0]}>
                <boxGeometry args={[cW * 0.94, 0.015, cL * 0.86]} />
                <meshStandardMaterial
                  color="#22d3ee"
                  emissive="#22d3ee"
                  emissiveIntensity={0.85}
                />
              </mesh>
            </group>
          ) : null}
        </group>
      )}
    </group>
  );
};
