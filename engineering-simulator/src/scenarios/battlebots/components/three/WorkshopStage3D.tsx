import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { type ActiveSponsorship, type ComponentCategory, type EngineeringStats, type RobotConfiguration, type TestLabType } from '../../types/robot';
import { Robot3D } from './Robot3D';

export interface ActiveTestVisualState {
  testType: TestLabType | null;
  progress: number; // 0 to 1
  isRunning: boolean;
}

interface WorkshopSceneContentProps {
  config: RobotConfiguration;
  stats: EngineeringStats;
  mode: 'workshop' | 'test-lab';
  installingCategory: ComponentCategory | null;
  selectedCategory: ComponentCategory;
  onSelectCategory: (cat: ComponentCategory) => void;
  cameraResetTrigger: number;
  activeTest: ActiveTestVisualState;
  sponsor?: ActiveSponsorship | null;
}

const CameraController: React.FC<{
  mode: 'workshop' | 'test-lab';
  resetTrigger: number;
  activeTest: ActiveTestVisualState;
}> = ({ mode, resetTrigger, activeTest }) => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    if (mode === 'test-lab') {
      camera.position.set(2.9, 1.95, 3.1);
    } else {
      camera.position.set(2.45, 1.75, 2.65);
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0.35, 0);
      controlsRef.current.update();
    }
  }, [resetTrigger, mode, camera]);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;
    // Subtle camera framing during active test
    if (mode === 'test-lab' && activeTest.isRunning) {
      const targetZ = activeTest.testType === 'push' || activeTest.testType === 'weapon' ? 0.35 : 0;
      controlsRef.current.target.lerp(new THREE.Vector3(0, 0.35, targetZ), delta * 4);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={1.9}
      maxDistance={5.2}
      minPolarAngle={0.28}
      maxPolarAngle={Math.PI / 2 - 0.06}
      dampingFactor={0.08}
      enableDamping
    />
  );
};

const WorkshopSceneContent: React.FC<WorkshopSceneContentProps> = ({
  config,
  stats,
  mode,
  installingCategory,
  selectedCategory,
  onSelectCategory,
  cameraResetTrigger,
  activeTest,
  sponsor,
}) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const botGroupRef = useRef<THREE.Group>(null);
  const sparkGroupRef = useRef<THREE.Group>(null);

  // Compute live animation parameters for Robot3D during tests
  const p = activeTest.progress;
  const isTesting = mode === 'test-lab' && activeTest.isRunning;
  const tType = activeTest.testType;

  let wheelSpeedRad = 0;
  let wheelSlipping = false;
  let weaponActive = false;
  let weaponSpinPct = 0;
  let weaponActuationPhase = 0;
  let chassisPitchRad = 0;
  let chassisRollRad = 0;
  let botOffsetZ = 0;
  let botOffsetX = 0;
  let botYawRad = 0;
  let liveTempC = 38;
  let showSparks = false;

  if (isTesting && tType === 'speed') {
    wheelSpeedRad = 24 * Math.min(1, p * 2.2) * (stats.topSpeedMph / 14);
    botOffsetZ = Math.sin(p * Math.PI * 2) * 0.55 * (stats.topSpeedMph / 15);
    chassisPitchRad = p < 0.3 ? -0.06 : 0;
  } else if (isTesting && tType === 'push') {
    const engaged = p > 0.2;
    wheelSpeedRad = engaged ? 16 : 12;
    wheelSlipping = engaged && stats.wheelSlipLikely;
    botOffsetZ = engaged ? 0.36 + Math.sin(p * 40) * 0.012 : p * 1.8;
    chassisPitchRad = engaged ? -0.05 * (stats.pushingForceN / 160) : 0;
    showSparks = wheelSlipping;
  } else if (isTesting && tType === 'weapon') {
    weaponActive = true;
    const spinRatio = Math.min(1, p / Math.max(0.25, stats.weaponSpinUpSec * 0.22));
    weaponSpinPct = spinRatio * 100;
    weaponActuationPhase = (p * 2.5) % 1;

    // Impact pulse around p = 0.65 - 0.82
    const inImpact = p > 0.62 && p < 0.82;
    if (inImpact) {
      const recoilFactor = stats.weaponRecoilScore / 100;
      const stabilityDamp = (115 - stats.stabilityScore) / 80;
      chassisPitchRad = -Math.sin((p - 0.62) * 35) * 0.32 * recoilFactor * stabilityDamp;
      chassisRollRad = Math.cos((p - 0.62) * 28) * 0.22 * recoilFactor * stabilityDamp;
      botOffsetZ = 0.25 - (p - 0.62) * 0.6 * recoilFactor;
      showSparks = stats.weaponEnergyJ > 500;
    } else if (p <= 0.62) {
      botOffsetZ = (p / 0.62) * 0.26;
    }
  } else if (isTesting && tType === 'stability') {
    wheelSpeedRad = 18;
    weaponActive = stats.weaponEnergyJ > 1000;
    weaponSpinPct = weaponActive ? 85 : 0;
    const tipSensitivity = Math.max(0.25, (105 - stats.stabilityScore) / 65);
    botYawRad = Math.sin(p * Math.PI * 4) * 0.65;
    botOffsetX = Math.cos(p * Math.PI * 4) * 0.22;
    chassisRollRad = Math.sin(p * Math.PI * 4) * 0.42 * tipSensitivity;
    chassisPitchRad = Math.cos(p * Math.PI * 2) * 0.16 * tipSensitivity;
  } else if (isTesting && tType === 'power') {
    wheelSpeedRad = 16;
    weaponActive = true;
    weaponSpinPct = stats.powerLimited ? 68 : 95;
    weaponActuationPhase = (p * 2) % 1;
    liveTempC = 36 + (stats.expectedMotorTempC - 36) * p;
  }

  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * (mode === 'test-lab' ? 0.45 : 0.12);
    }
    if (botGroupRef.current) {
      botGroupRef.current.position.z = THREE.MathUtils.lerp(
        botGroupRef.current.position.z,
        botOffsetZ,
        delta * 12
      );
      botGroupRef.current.position.x = THREE.MathUtils.lerp(
        botGroupRef.current.position.x,
        botOffsetX,
        delta * 12
      );
      botGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        botGroupRef.current.rotation.y,
        botYawRad,
        delta * 12
      );
    }
    if (sparkGroupRef.current && showSparks) {
      sparkGroupRef.current.rotation.y = state.clock.elapsedTime * 19;
    }
  });

  // Ring accent color reflects overweight status or test mode
  const platformGlowColor = stats.isOverweight
    ? '#ef4444'
    : mode === 'test-lab'
    ? '#f59e0b'
    : '#22d3ee';

  return (
    <>
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 6.5, 17]} />

      <CameraController
        mode={mode}
        resetTrigger={cameraResetTrigger}
        activeTest={activeTest}
      />

      {/* Lit Industrial Robotics Workshop Lighting */}
      <ambientLight intensity={0.92} color="#f1f5f9" />
      <directionalLight
        castShadow
        position={[4.5, 7.5, 5.5]}
        intensity={2.3}
        color="#ffffff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      {/* Front-left cool fill light to illuminate dark mechanical crevices */}
      <directionalLight position={[-4, 4.5, 3.5]} intensity={1.15} color="#cbd5e1" />
      {/* High-contrast cool rim light behind robot for silhouette separation */}
      <pointLight position={[-3.2, 3.2, -3.0]} intensity={2.6} color="#38bdf8" />
      {/* High-contrast warm rim light behind robot */}
      <pointLight position={[3.2, 2.8, -3.0]} intensity={2.1} color="#f59e0b" />
      {/* Overhead high-CRI task spotlight */}
      <spotLight
        position={[0, 6.0, 0]}
        angle={0.68}
        penumbra={0.7}
        intensity={1.9}
        color="#f8fafc"
      />

      {/* Industrial Garage Background Pillars & Girders */}
      <group position={[0, 0, -4.5]}>
        {[-3.6, -1.8, 1.8, 3.6].map((xCol, idx) => (
          <mesh key={idx} position={[xCol, 2.2, 0]}>
            <boxGeometry args={[0.26, 4.8, 0.26]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, 3.9, 0]}>
          <boxGeometry args={[9.5, 0.28, 0.32]} />
          <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.3} />
        </mesh>
      </group>

      {/* Illuminated Circular Workshop Turntable & Test Platform */}
      <group position={[0, -0.02, 0]}>
        {/* Outer bay floor — visible dark-gray concrete floor */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
          <planeGeometry args={[26, 26]} />
          <meshStandardMaterial color="#1e2638" metalness={0.35} roughness={0.65} />
        </mesh>

        {/* Main elevated circular turntable — contrasting metallic gray pedestal */}
        <mesh receiveShadow position={[0, -0.03, 0]}>
          <cylinderGeometry args={[2.08, 2.25, 0.08, 48]} />
          <meshStandardMaterial color="#2c384e" metalness={0.55} roughness={0.38} />
        </mesh>

        {/* Glowing outer calibration ring */}
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[1.90, 1.98, 48]} />
          <meshStandardMaterial
            color={platformGlowColor}
            emissive={platformGlowColor}
            emissiveIntensity={1.35}
          />
        </mesh>

        {/* Inner reticle ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
          <ringGeometry args={[1.14, 1.18, 36]} />
          <meshStandardMaterial
            color={platformGlowColor}
            emissive={platformGlowColor}
            emissiveIntensity={0.65}
            transparent
            opacity={0.75}
          />
        </mesh>

        {/* Test Stand Instrumental Barriers (Visible in Test Lab mode) */}
        {mode === 'test-lab' && (
          <group>
            {/* Calibrated test track rails */}
            {[-1.25, 1.25].map((xRail, i) => (
              <mesh key={i} position={[xRail, 0.05, 0]}>
                <boxGeometry args={[0.06, 0.06, 3.2]} />
                <meshStandardMaterial
                  color="#f59e0b"
                  emissive="#f59e0b"
                  emissiveIntensity={0.5}
                />
              </mesh>
            ))}

            {/* Dynamometer / Impact Test Block in front of the robot */}
            {(tType === 'push' || tType === 'weapon') && (
              <group position={[0, 0.34, 1.32]}>
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[1.45, 0.65, 0.42]} />
                  <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
                </mesh>
                {/* Hazard stripe bar on test block */}
                <mesh position={[0, 0.1, -0.22]}>
                  <boxGeometry args={[1.3, 0.16, 0.02]} />
                  <meshStandardMaterial
                    color="#f59e0b"
                    emissive="#f59e0b"
                    emissiveIntensity={0.65}
                  />
                </mesh>
              </group>
            )}
          </group>
        )}
      </group>

      {/* Spark burst effect during weapon impact or wheel slip */}
      {showSparks && (
        <group ref={sparkGroupRef} position={[0, 0.28, 0.98]}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const ang = (i * Math.PI) / 4;
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(ang) * 0.25,
                  Math.sin(ang * 2) * 0.18 + 0.1,
                  Math.sin(ang) * 0.25,
                ]}
                rotation={[ang, ang, 0]}
              >
                <boxGeometry args={[0.03, 0.03, 0.22]} />
                <meshStandardMaterial
                  color="#fde047"
                  emissive="#f59e0b"
                  emissiveIntensity={2.5}
                />
              </mesh>
            );
          })}
        </group>
      )}

      {/* The Assembled 3D Robot */}
      <group ref={botGroupRef}>
        <Robot3D
          config={config}
          installingCategory={installingCategory}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          wheelSpeedRad={wheelSpeedRad}
          wheelSlipping={wheelSlipping}
          weaponActive={weaponActive}
          weaponSpinPct={weaponSpinPct}
          weaponActuationPhase={weaponActuationPhase}
          chassisPitchRad={chassisPitchRad}
          chassisRollRad={chassisRollRad}
          motorTempC={liveTempC}
          sponsor={sponsor}
        />
      </group>
    </>
  );
};

export const WorkshopStage3D: React.FC<WorkshopSceneContentProps> = (props) => {
  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ position: [2.45, 1.75, 2.65], fov: 42 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <WorkshopSceneContent {...props} />
      </Canvas>
    </div>
  );
};
