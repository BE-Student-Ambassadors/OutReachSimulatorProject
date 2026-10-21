import { createKeyboardController, type KeyboardControllerInstance } from '../../simulation/playerInput';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  AlertTriangle,
  Battery,
  Camera,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  Swords,
  Thermometer,
  Trophy,
  Wrench,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { soundEngine } from '../../audio/soundEngine';
import { useLoop } from '../../../../shared/audio/sfx';
import { getBossById } from '../../data/bosses';
import {
  ARENA_HALF_SIZE,
  createBattleSimulation,
  generateBattleAnalysisReport,
  type LiveBattleSimulation,
  stepBattleSimulation,
} from '../../simulation/battleEngine';
import {
  type BattleAnalysisReport,
  type BattleEventLog,
  type BossId,
  type CombatantTelemetry,
  type EngineeringStats,
  type RobotConfiguration,
  type SparkBurst,
  type TeamRobotProject,
} from '../../types/robot';
import { Robot3D } from '../three/Robot3D';

interface ArenaScreenProps {
  playerConfig: RobotConfiguration;
  playerStats: EngineeringStats;
  bossId?: BossId;
  teamProject?: TeamRobotProject;
  onReturnToWorkshop: (resetToStarter?: boolean) => void;
  onReturnToDashboard?: () => void;
  onDefeatBoss?: (bossId: BossId) => void;
}

type SpectatorCamMode = 'director' | 'wide' | 'chase';

// 3D Developer Debug Orientation & Vectors (Green Forward, Red Weapon/Front, Blue Velocity)
const OrientationDebugArrows: React.FC<{
  position: [number, number, number];
  headingRad: number;
  velocity: [number, number];
  weaponCenter: [number, number];
}> = ({ position, headingRad, velocity, weaponCenter }) => {
  const [x, y, z] = position;
  const speed = Math.hypot(velocity[0], velocity[1]);
  const velAngle = Math.atan2(velocity[0], velocity[1]);
  const velLen = THREE.MathUtils.clamp(speed * 0.45, 0.35, 1.6);

  const dWeaponX = weaponCenter[0] - x;
  const dWeaponZ = weaponCenter[1] - z;
  const weaponDist = Math.max(0.01, Math.hypot(dWeaponX, dWeaponZ));
  const weaponAngle = Math.atan2(dWeaponX, dWeaponZ);

  return (
    <group position={[x, y, z]}>
      {/* 1. GREEN ARROW: Canonical Simulation FORWARD Vector */}
      <group rotation={[0, headingRad, 0]}>
        {/* Shaft along local +Z */}
        <mesh position={[0, 0.45, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.1, 12]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        {/* Arrowhead cone pointing forward */}
        <mesh position={[0, 0.45, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.075, 0.22, 12]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      </group>

      {/* 2. RED ARROW & MARKER: Primary Weapon / Front */}
      <group rotation={[0, weaponAngle, 0]}>
        {/* Shaft pointing to primary weapon */}
        <mesh position={[0, 0.5, weaponDist * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, weaponDist, 12]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        {/* Arrowhead at weapon center */}
        <mesh position={[0, 0.5, weaponDist]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.085, 0.22, 12]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>
      {/* Red glowing beacon sphere directly on weapon contact center */}
      <mesh position={[dWeaponX, 0.5, dWeaponZ]}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshBasicMaterial color="#ff2222" />
      </mesh>

      {/* 3. BLUE ARROW: Current Velocity Vector (when robot is moving) */}
      {speed > 0.15 && (
        <group rotation={[0, velAngle, 0]}>
          {/* Shaft along velocity direction */}
          <mesh position={[0, 0.4, (velLen - 0.18) * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, Math.max(0.01, velLen - 0.18), 12]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
          {/* Arrowhead */}
          <mesh position={[0, 0.4, velLen - 0.09]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.065, 0.18, 12]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
        </group>
      )}
    </group>
  );
};

// 3D Arena Scene & Automatic Spectator Camera Controller
const Arena3DScene: React.FC<{
  simRef: React.MutableRefObject<LiveBattleSimulation | null>;
  keyboardRef: React.MutableRefObject<KeyboardControllerInstance | null>;
  battlePhase: 'tutorial' | 'countdown' | 'fighting' | 'finished';
  camMode: SpectatorCamMode;
  playerConfig: RobotConfiguration;
  bossId: BossId;
  showHitboxes?: boolean;
  onSyncHud: (
    player: CombatantTelemetry,
    bull: CombatantTelemetry,
    timeSec: number,
    events: BattleEventLog[],
    report: BattleAnalysisReport | null
  ) => void;
}> = ({ simRef, keyboardRef, battlePhase, camMode, playerConfig, bossId, showHitboxes = false, onSyncHud }) => {
  const { camera } = useThree();
  const playerGroupRef = useRef<THREE.Group>(null);
  const bullGroupRef = useRef<THREE.Group>(null);
  const hudTimerRef = useRef<number>(0);
  const lastEventIdRef = useRef<number>(0);
  // Drive motors hum with the robot's speed; the weapon whines as it spins up.
  const fighting = battlePhase === 'fighting';
  const motorHum = useLoop('motor', fighting);
  const weaponWhine = useLoop('whine', fighting);

  const [renderState, setRenderState] = useState<{
    player: CombatantTelemetry | null;
    bull: CombatantTelemetry | null;
    sparks: SparkBurst[];
    debugHitboxes?: LiveBattleSimulation['debugHitboxes'];
  }>({
    player: null,
    bull: null,
    sparks: [],
  });

  useFrame((state, delta) => {
    const sim = simRef.current;
    if (!sim) return;

    if (battlePhase === 'fighting' && !sim.isFinished) {
      const input = keyboardRef.current ? keyboardRef.current.getInput() : undefined;
      stepBattleSimulation(sim, delta, input);
      motorHum.current.set(0.08 + Math.min(1, Math.hypot(sim.player.vx, sim.player.vz) / 3.5) * 0.92);
      weaponWhine.current.set(sim.player.weaponSpinPct / 100);

      // Play sound effects when new impact events arrive
      const newest = sim.events[0];
      if (newest && newest.id !== lastEventIdRef.current) {
        lastEventIdRef.current = newest.id;
        if (newest.type === 'impact') {
          soundEngine.playImpact('heavy');
        } else if (newest.type === 'critical') {
          soundEngine.playImpact('medium');
        }
      }

      if (sim.isFinished) {
        motorHum.current.set(0);
        weaponWhine.current.set(0);
        const finalReport = generateBattleAnalysisReport(sim);
        soundEngine.playBattleEnd(finalReport.winner === 'player');
        onSyncHud(
          { ...sim.player },
          { ...sim.bull },
          sim.timeSec,
          [...sim.events],
          finalReport
        );
      }
    }

    // Update 3D positions smoothly every frame
    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(sim.player.x, 0, sim.player.z);
      playerGroupRef.current.rotation.set(0, sim.player.headingRad, 0);
    }
    if (bullGroupRef.current) {
      bullGroupRef.current.position.set(sim.bull.x, 0, sim.bull.z);
      bullGroupRef.current.rotation.set(0, sim.bull.headingRad, 0);
    }

    // Automatic Cinematic Spectator Camera
    const midX = (sim.player.x + sim.bull.x) * 0.5;
    const midZ = (sim.player.z + sim.bull.z) * 0.5;


    // Subtle impact camera shake
    const shakeAmt = sim.cameraImpactShake * 0.14;
    const shakeX = Math.sin(state.clock.elapsedTime * 55) * shakeAmt;
    const shakeY = Math.cos(state.clock.elapsedTime * 48) * shakeAmt;

    if (battlePhase === 'tutorial' || battlePhase === 'countdown') {
      // Dramatic establishing orbit around arena center
      const t = state.clock.elapsedTime * 0.22;
      const targetPos = new THREE.Vector3(Math.sin(t) * 6.6, 3.8, Math.cos(t) * 6.6);
      camera.position.lerp(targetPos, delta * 3);
      camera.lookAt(0, 0.3, 0);
    } else if (battlePhase === 'finished') {
      // Post-battle orbit
      const t = state.clock.elapsedTime * 0.35;
      const targetPos = new THREE.Vector3(midX + Math.sin(t) * 4.5, 3.2, midZ + Math.cos(t) * 4.5);
      camera.position.lerp(targetPos, delta * 3.5);
      camera.lookAt(midX, 0.35, midZ);
    } else if (camMode === 'wide') {
      const targetPos = new THREE.Vector3(0 + shakeX, 7.0 + shakeY, 7.0);
      camera.position.lerp(targetPos, delta * 4);
      camera.lookAt(0, 0, 0);
    } else {
      // STABLE PLAYABLE GAMEPLAY CAMERA (Elevated chase with smooth damping following player)
      const behindDist = 3.6;
      const camHeight = 3.8;
      const targetCamX = sim.player.x - Math.sin(sim.player.headingRad) * behindDist + (midX - sim.player.x) * 0.25 + shakeX;
      const targetCamZ = sim.player.z - Math.cos(sim.player.headingRad) * behindDist + (midZ - sim.player.z) * 0.25 + shakeY;
      camera.position.lerp(new THREE.Vector3(targetCamX, camHeight, targetCamZ), delta * 4.5);
      camera.lookAt(midX, 0.3, midZ);
    }

    // Throttle React state updates for HUD & spark meshes to ~15Hz
    hudTimerRef.current += delta;
    if (hudTimerRef.current >= 0.065) {
      hudTimerRef.current = 0;
      setRenderState({
        player: { ...sim.player },
        bull: { ...sim.bull },
        sparks: [...sim.sparks],
        debugHitboxes: sim.debugHitboxes ? { ...sim.debugHitboxes } : undefined,
      });
      if (battlePhase === 'fighting' && !sim.isFinished) {
        onSyncHud({ ...sim.player }, { ...sim.bull }, sim.timeSec, [...sim.events], null);
      }
    }
  });

  const pState = renderState.player;
  const bState = renderState.bull;
  const bossDossier = getBossById(bossId);

  return (
    <>
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 12, 28]} />

      {/* Lit Industrial BattleBox Arena Lighting */}
      <ambientLight intensity={0.92} color="#f8fafc" />
      <directionalLight
        castShadow
        position={[5, 9, 5]}
        intensity={2.3}
        color="#ffffff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-5, 7, -5]} intensity={1.25} color="#94a3b8" />
      <pointLight position={[-4.5, 4, -4.5]} intensity={2.2} color="#f59e0b" />
      <pointLight position={[4.5, 4, 4.5]} intensity={2.2} color="#22d3ee" />

      {/* Enclosed Combat Arena Floor & Hazard Perimeter Walls */}
      <group>
        {/* Main steel battle floor — lit dark-gray steel arena floor */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[ARENA_HALF_SIZE * 2 + 1.2, ARENA_HALF_SIZE * 2 + 1.2]} />
          <meshStandardMaterial color="#222e42" metalness={0.55} roughness={0.45} />
        </mesh>

        {/* Center combat ring & starting box markings */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <ringGeometry args={[1.65, 1.75, 48]} />
          <meshStandardMaterial color="#475569" emissive="#334155" emissiveIntensity={0.6} />
        </mesh>

        {/* Player Starting Box (South - Cyan) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 2.35]}>
          <ringGeometry args={[0.95, 1.05, 4]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.0} />
        </mesh>

        {/* Boss Starting Box (North) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, -2.35]}>
          <ringGeometry args={[0.95, 1.05, 4]} />
          <meshStandardMaterial color={bossDossier.config.accentColor} emissive={bossDossier.config.accentColor} emissiveIntensity={1.0} />
        </mesh>

        {/* 4 Enclosed Hazard Perimeter Bumpers */}
        {[
          { pos: [0, 0.28, -(ARENA_HALF_SIZE + 0.55)], size: [ARENA_HALF_SIZE * 2 + 1.2, 0.58, 0.24], color: '#f59e0b' },
          { pos: [0, 0.28, ARENA_HALF_SIZE + 0.55], size: [ARENA_HALF_SIZE * 2 + 1.2, 0.58, 0.24], color: '#22d3ee' },
          { pos: [-(ARENA_HALF_SIZE + 0.55), 0.28, 0], size: [0.24, 0.58, ARENA_HALF_SIZE * 2 + 1.2], color: '#f59e0b' },
          { pos: [ARENA_HALF_SIZE + 0.55, 0.28, 0], size: [0.24, 0.58, ARENA_HALF_SIZE * 2 + 1.2], color: '#22d3ee' },
        ].map((w, idx) => (
          <group key={idx} position={w.pos as [number, number, number]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={w.size as [number, number, number]} />
              <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
            </mesh>
            {/* Glowing hazard top rail */}
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry
                args={[
                  (w.size[0] as number) * 0.98,
                  0.04,
                  (w.size[2] as number) * 0.98,
                ]}
              />
              <meshStandardMaterial
                color={w.color}
                emissive={w.color}
                emissiveIntensity={0.85}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Active Impact Spark Bursts */}
      {renderState.sparks.map((sp) => (
        <group key={sp.id} position={[sp.x, sp.y, sp.z]} rotation={[0, sp.age * 25, 0]}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const ang = (i * Math.PI) / 3;
            const spread = 0.15 + sp.age * 1.4;
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(ang) * spread,
                  Math.sin(ang * 2) * 0.2,
                  Math.sin(ang) * spread,
                ]}
                rotation={[ang, ang, 0]}
              >
                <boxGeometry args={[0.04, 0.04, 0.26]} />
                <meshStandardMaterial
                  color={sp.color}
                  emissive={sp.color}
                  emissiveIntensity={2.5}
                />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* Subtle Cyan Driver Ring under Player Robot */}
      {pState && (
        <group position={[pState.x, 0.015, pState.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.54, 0.62, 32]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.85} />
          </mesh>
        </group>
      )}

      {/* Student's Exact Assembled Robot3D */}
      <group ref={playerGroupRef} position={[0, 0, 2.35]} rotation={[0, Math.PI, 0]}>
        <Robot3D
          config={playerConfig}
          wheelSpeedRad={
            pState ? Math.hypot(pState.vx, pState.vz) * 6 : 0
          }
          weaponActive={battlePhase === 'fighting'}
          weaponSpinPct={pState?.weaponSpinPct ?? 0}
          weaponActuationPhase={pState?.weaponActuationPhase ?? 0}
          chassisPitchRad={pState?.pitchRad ?? 0}
          chassisRollRad={pState?.rollRad ?? 0}
          isFlipped={pState?.isFlipped ?? false}
          motorTempC={pState?.motorTempC ?? 40}
          damageState={
            pState
              ? {
                  frontArmorPct: pState.frontArmorPct,
                  sideArmorPct: pState.sideArmorPct,
                  rearArmorPct: pState.rearArmorPct,
                  leftDrivePct: pState.leftDriveHealthPct,
                  rightDrivePct: pState.rightDriveHealthPct,
                  weaponPct: pState.weaponHealthPct,
                }
              : undefined
          }
        />
      </group>

      {/* Active Boss Robot */}
      <group ref={bullGroupRef} position={[0, 0, -2.35]} rotation={[0, 0, 0]}>
        <Robot3D
          config={bossDossier.config}
          bossId={bossId}
          wheelSpeedRad={bState ? Math.hypot(bState.vx, bState.vz) * 6 : 0}
          weaponActive={battlePhase === 'fighting'}
          weaponSpinPct={bState?.weaponSpinPct ?? 80}
          weaponActuationPhase={bState?.weaponActuationPhase ?? 0}
          chassisPitchRad={bState?.pitchRad ?? 0}
          chassisRollRad={bState?.rollRad ?? 0}
          isFlipped={bState?.isFlipped ?? false}
          motorTempC={bState?.motorTempC ?? bossDossier.stats.expectedMotorTempC}
        />
      </group>

      {/* DEVELOPER DEBUG HITBOXES OVERLAY */}
      {showHitboxes && renderState.debugHitboxes && (
        <group>
          {/* Player Chassis Collider (Cyan Wireframe Box) */}
          <mesh
            position={[
              renderState.debugHitboxes.playerChassis.center[0],
              0.22,
              renderState.debugHitboxes.playerChassis.center[1],
            ]}
            rotation={[0, renderState.debugHitboxes.playerChassis.rotationRad, 0]}
          >
            <boxGeometry
              args={[
                renderState.debugHitboxes.playerChassis.halfExtents[0] * 2,
                0.44,
                renderState.debugHitboxes.playerChassis.halfExtents[1] * 2,
              ]}
            />
            <meshBasicMaterial color="#06b6d4" wireframe transparent opacity={0.85} />
          </mesh>

          {/* Player Weapon Contact Zone (Green Wireframe Box or Cylinder) */}
          {renderState.debugHitboxes.playerWeapon.is360Perimeter ? (
            <mesh
              position={[
                renderState.debugHitboxes.playerWeapon.center[0],
                0.22,
                renderState.debugHitboxes.playerWeapon.center[1],
              ]}
            >
              <cylinderGeometry
                args={[
                  renderState.debugHitboxes.playerWeapon.perimeterRadius ?? 1.25,
                  renderState.debugHitboxes.playerWeapon.perimeterRadius ?? 1.25,
                  0.25,
                  32,
                ]}
              />
              <meshBasicMaterial color="#22c55e" wireframe transparent opacity={0.8} />
            </mesh>
          ) : (
            <mesh
              position={[
                renderState.debugHitboxes.playerWeapon.center[0],
                0.22,
                renderState.debugHitboxes.playerWeapon.center[1],
              ]}
              rotation={[0, renderState.debugHitboxes.playerWeapon.rotationRad, 0]}
            >
              <boxGeometry
                args={[
                  renderState.debugHitboxes.playerWeapon.halfExtents[0] * 2,
                  0.36,
                  renderState.debugHitboxes.playerWeapon.halfExtents[1] * 2,
                ]}
              />
              <meshBasicMaterial color="#22c55e" wireframe transparent opacity={0.8} />
            </mesh>
          )}

          {/* Boss Chassis Collider (Amber Wireframe Box) */}
          <mesh
            position={[
              renderState.debugHitboxes.bossChassis.center[0],
              0.22,
              renderState.debugHitboxes.bossChassis.center[1],
            ]}
            rotation={[0, renderState.debugHitboxes.bossChassis.rotationRad, 0]}
          >
            <boxGeometry
              args={[
                renderState.debugHitboxes.bossChassis.halfExtents[0] * 2,
                0.46,
                renderState.debugHitboxes.bossChassis.halfExtents[1] * 2,
              ]}
            />
            <meshBasicMaterial color="#f59e0b" wireframe transparent opacity={0.85} />
          </mesh>

          {/* Boss Weapon Contact Zone (Red Wireframe Box or Ring) */}
          {renderState.debugHitboxes.bossWeapon.is360Perimeter ? (
            <mesh
              position={[
                renderState.debugHitboxes.bossWeapon.center[0],
                0.22,
                renderState.debugHitboxes.bossWeapon.center[1],
              ]}
            >
              <cylinderGeometry
                args={[
                  renderState.debugHitboxes.bossWeapon.perimeterRadius ?? 1.35,
                  renderState.debugHitboxes.bossWeapon.perimeterRadius ?? 1.35,
                  0.26,
                  32,
                ]}
              />
              <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.8} />
            </mesh>
          ) : (
            <mesh
              position={[
                renderState.debugHitboxes.bossWeapon.center[0],
                0.22,
                renderState.debugHitboxes.bossWeapon.center[1],
              ]}
              rotation={[0, renderState.debugHitboxes.bossWeapon.rotationRad, 0]}
            >
              <boxGeometry
                args={[
                  renderState.debugHitboxes.bossWeapon.halfExtents[0] * 2,
                  0.4,
                  renderState.debugHitboxes.bossWeapon.halfExtents[1] * 2,
                ]}
              />
              <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.8} />
            </mesh>
          )}

          {/* Contact Point & Collision Normal Vector when in contact */}
          {renderState.debugHitboxes.hasContact && renderState.debugHitboxes.contactPoint && (
            <group position={[renderState.debugHitboxes.contactPoint[0], 0.3, renderState.debugHitboxes.contactPoint[1]]}>
              <mesh>
                <sphereGeometry args={[0.09, 12, 12]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              {renderState.debugHitboxes.contactNormal && (
                <mesh
                  position={[
                    renderState.debugHitboxes.contactNormal[0] * 0.35,
                    0,
                    renderState.debugHitboxes.contactNormal[1] * 0.35,
                  ]}
                  rotation={[
                    0,
                    Math.atan2(
                      renderState.debugHitboxes.contactNormal[0],
                      renderState.debugHitboxes.contactNormal[1]
                    ),
                    0,
                  ]}
                >
                  <boxGeometry args={[0.04, 0.04, 0.7]} />
                  <meshBasicMaterial color="#f43f5e" />
                </mesh>
              )}
            </group>
          )}

          {/* Orientation Debug Arrows (GREEN: Forward, RED: Weapon/Front, BLUE: Velocity) */}
          {pState && renderState.debugHitboxes && (
            <OrientationDebugArrows
              position={[pState.x, 0, pState.z]}
              headingRad={pState.headingRad}
              velocity={[pState.vx, pState.vz]}
              weaponCenter={renderState.debugHitboxes.playerWeapon.center}
            />
          )}

          {bState && renderState.debugHitboxes && (
            <OrientationDebugArrows
              position={[bState.x, 0, bState.z]}
              headingRad={bState.headingRad}
              velocity={[bState.vx, bState.vz]}
              weaponCenter={renderState.debugHitboxes.bossWeapon.center}
            />
          )}
        </group>
      )}
    </>
  );
};

export const ArenaScreen: React.FC<ArenaScreenProps> = ({
  playerConfig,
  playerStats,
  bossId = 'bull',
  teamProject,
  onReturnToWorkshop,
  onReturnToDashboard,
  onDefeatBoss,
}) => {
  const [battlePhase, setBattlePhase] = useState<'tutorial' | 'countdown' | 'fighting' | 'finished'>('tutorial');
  const [countdownNumber, setCountdownNumber] = useState<number | 'FIGHT!'>(3);
  const [camMode, setCamMode] = useState<SpectatorCamMode>('director');
  const [showHitboxes, setShowHitboxes] = useState(false);

  const keyboardRef = useRef<KeyboardControllerInstance | null>(null);

  const coolingDrop =
    teamProject?.electrical.coolingSystem === 'fan'
      ? 15
      : teamProject?.electrical.coolingSystem === 'copper'
      ? 24
      : 0;

  const [initialSim] = useState(() =>
    createBattleSimulation(
      playerConfig,
      'control',
      'bull',
      teamProject?.software.rules,
      teamProject?.electrical.currentLimiterA,
      coolingDrop,
      true
    )
  );
  const simRef = useRef<LiveBattleSimulation | null>(initialSim);

  const [hudPlayer, setHudPlayer] = useState<CombatantTelemetry>(() => initialSim.player);
  const [hudBull, setHudBull] = useState<CombatantTelemetry>(() => initialSim.bull);
  const [hudTimeSec, setHudTimeSec] = useState<number>(0);
  const [, setHudEvents] = useState<BattleEventLog[]>([]);
  const [analysisReport, setAnalysisReport] = useState<BattleAnalysisReport | null>(null);

  // Setup keyboard controller
  useEffect(() => {
    const controller = createKeyboardController(window);
    keyboardRef.current = controller;
    controller.setEnabled(battlePhase === 'fighting');

    const handleDebugKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setShowHitboxes((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleDebugKey);

    return () => {
      controller.dispose();
      window.removeEventListener('keydown', handleDebugKey);
    };
  }, []);

  useEffect(() => {
    if (keyboardRef.current) {
      keyboardRef.current.setEnabled(battlePhase === 'fighting');
    }
  }, [battlePhase]);

  const startCountdown = () => {
    setBattlePhase('countdown');
    setCountdownNumber(3);
    soundEngine.playClick();

    window.setTimeout(() => {
      setCountdownNumber(2);
      soundEngine.playClick();
      window.setTimeout(() => {
        setCountdownNumber(1);
        soundEngine.playClick();
        window.setTimeout(() => {
          setCountdownNumber('FIGHT!');
          soundEngine.playArenaHorn();
          window.setTimeout(() => {
            setBattlePhase('fighting');
            keyboardRef.current?.setEnabled(true);
          }, 600);
        }, 1000);
      }, 1000);
    }, 1000);
  };

  const handleStartBattle = () => {
    soundEngine.playClick();
    simRef.current = createBattleSimulation(
      playerConfig,
      'control',
      'bull',
      teamProject?.software.rules,
      teamProject?.electrical.currentLimiterA,
      coolingDrop,
      true
    );
    setHudPlayer(simRef.current.player);
    setHudBull(simRef.current.bull);
    setHudTimeSec(0);
    setHudEvents(simRef.current.events);
    setAnalysisReport(null);
    keyboardRef.current?.clear();
    startCountdown();
  };

  const handleRematch = () => {
    handleStartBattle();
  };

  const handleReturnToEngineering = () => {
    soundEngine.playInstall();
    keyboardRef.current?.clear();
    if (onReturnToDashboard) {
      onReturnToDashboard();
    } else {
      onReturnToWorkshop(false);
    }
  };

  const bullOverallCondition = Math.round(
    hudBull.hullIntegrityPct * 0.6 +
      ((hudBull.leftDriveHealthPct + hudBull.rightDriveHealthPct) * 0.5) * 0.4
  );

  const teamName = (teamProject?.teamName || playerConfig.name || 'TITAN').toUpperCase();
  const isSpinner = playerStats.weaponSpinUpSec > 0;

  return (
    <div className="relative w-full h-full bg-[#0a0f1d] overflow-hidden flex flex-col justify-between select-none">
      {/* 3D Combat Arena Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [0, 4.2, 6.4], fov: 44 }}>
          <Arena3DScene
            simRef={simRef}
            keyboardRef={keyboardRef}
            battlePhase={battlePhase}
            camMode={camMode}
            playerConfig={playerConfig}
            bossId={bossId}
            showHitboxes={showHitboxes}
            onSyncHud={(p, b, t, evs, rep) => {
              setHudPlayer(p);
              setHudBull(b);
              setHudTimeSec(t);
              setHudEvents(evs);
              if (rep) {
                setAnalysisReport(rep);
                setBattlePhase('finished');
                keyboardRef.current?.clear();
                keyboardRef.current?.setEnabled(false);
                if (rep.winner === 'player') {
                  onDefeatBoss?.(bossId);
                }
              }
            }}
          />
        </Canvas>
      </div>

      {/* ============================================================
          LIVE TELEMETRY HUD (Only shown during countdown & battle)
         ============================================================ */}
      {(battlePhase === 'fighting' || battlePhase === 'countdown') && (
        <div className="relative z-20 p-4 md:p-5 flex flex-col gap-3 pointer-events-none">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
            {/* LEFT: PLAYER BOT TELEMETRY */}
            <div className="holo-panel holo-glow-cyan rounded-2xl border border-cyan-500/40 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="font-display font-extrabold text-sm text-white tracking-wide">
                    {teamName} ({playerStats.totalWeightLb.toFixed(1)} LB)
                  </span>
                </div>
                <span className="text-[10px] font-mono-num uppercase px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-bold">
                  DRIVER CONTROL
                </span>
              </div>

              {/* Hull Bar */}
              <div className="mb-2.5">
                <div className="flex justify-between text-[11px] font-mono-num text-slate-300 mb-1">
                  <span>STRUCTURAL INTEGRITY</span>
                  <span className="font-bold text-cyan-300">
                    {Math.round(hudPlayer.hullIntegrityPct)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-sky-300 transition-all duration-150"
                    style={{ width: `${Math.max(0, hudPlayer.hullIntegrityPct)}%` }}
                  />
                </div>
              </div>

              {/* Telemetry Subsystems: Battery, Weapon, Temp */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                  <div className="text-[9px] font-mono-num text-slate-400 flex items-center justify-center gap-0.5">
                    <Battery className="w-3 h-3 text-cyan-400" /> BATT
                  </div>
                  <div className={`font-mono-num text-xs font-bold mt-0.5 ${hudPlayer.batteryPct < 20 ? 'text-red-400' : 'text-white'}`}>
                    {Math.round(hudPlayer.batteryPct)}%
                  </div>
                </div>

                <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                  <div className="text-[9px] font-mono-num text-slate-400 flex items-center justify-center gap-0.5">
                    <Zap className="w-3 h-3 text-amber-400" /> WEAPON
                  </div>
                  <div className="font-mono-num text-xs font-bold mt-0.5 text-amber-300">
                    {isSpinner
                      ? `${Math.round(hudPlayer.weaponSpinPct)}%`
                      : hudPlayer.weaponActuationPhase > 0
                      ? 'ACTUATING'
                      : 'ARMED'}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                  <div className="text-[9px] font-mono-num text-slate-400 flex items-center justify-center gap-0.5">
                    <Thermometer className="w-3 h-3 text-rose-400" /> TEMP
                  </div>
                  <div className={`font-mono-num text-xs font-bold mt-0.5 ${hudPlayer.motorTempC >= 85 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                    {Math.round(hudPlayer.motorTempC)}°C
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER: ARENA MATCH TIMER & OPPONENT CALLOUT */}
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="holo-panel rounded-xl border border-slate-800 px-4 py-2 flex items-center gap-3">
                <div className="text-center">
                  <div className="text-[9px] font-mono-num uppercase tracking-wider text-slate-400">
                    MATCH CLOCK
                  </div>
                  <div className="font-mono-num text-xl font-black text-amber-400">
                    {Math.floor(hudTimeSec / 60)}:{(Math.floor(hudTimeSec % 60)).toString().padStart(2, '0')}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: THE BULL AI OPPONENT TELEMETRY */}
            <div className="holo-panel holo-glow-red rounded-2xl border border-red-500/40 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono-num uppercase px-2 py-0.5 rounded bg-red-500/20 border border-red-400/30 text-red-300 font-bold">
                  AI OPPONENT
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-display font-extrabold text-sm text-white tracking-wide">
                    THE BULL (30.0 LB)
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                </div>
              </div>

              {/* Boss Hull Bar */}
              <div className="mb-2.5">
                <div className="flex justify-between text-[11px] font-mono-num text-slate-300 mb-1">
                  <span>STRUCTURAL INTEGRITY</span>
                  <span className="font-bold text-red-400">
                    {bullOverallCondition}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-amber-500 transition-all duration-150"
                    style={{ width: `${Math.max(0, bullOverallCondition)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                <span>WEDGE PLOW: {hudBull.isGrabbing ? 'PINNING' : 'ACTIVE'}</span>
                <span>STATE: {hudBull.aiStateLabel}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          COUNTDOWN OVERLAY (3, 2, 1, FIGHT!)
         ============================================================ */}
      {battlePhase === 'countdown' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs pointer-events-none">
          <div className="text-center animate-in zoom-in-75 duration-300">
            <span className="font-display font-black text-7xl md:text-9xl text-amber-400 drop-shadow-[0_0_35px_rgba(251,191,36,0.6)]">
              {countdownNumber}
            </span>
          </div>
        </div>
      )}

      {/* ============================================================
          PHASE 1: CONTROL TUTORIAL MODAL (Before Battle Starts)
         ============================================================ */}
      {battlePhase === 'tutorial' && (
        <div className="relative z-30 flex-1 flex items-center justify-center p-4">
          <div className="holo-panel holo-glow-cyan max-w-2xl w-full rounded-3xl border border-cyan-500/40 p-6 md:p-8 animate-pop-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-1 font-bold">
                  FINAL COMBAT ARENA
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-black text-white">
                  {teamName} VS THE BULL
                </h2>
              </div>
              <button
                type="button"
                onClick={handleReturnToEngineering}
                className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-display font-bold text-slate-300 transition-colors"
              >
                ← WORKSHOP
              </button>
            </div>

            {/* Visual Controls Schematic Card */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-center mb-6">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold block mb-4">
                CONTROLS
              </span>

              {/* D-Pad Layout */}
              <div className="flex flex-col items-center justify-center gap-2 mb-6">
                {/* Forward Key */}
                <div className="flex flex-col items-center">
                  <div className="px-4 py-2 rounded-xl bg-slate-800 border border-cyan-500/50 text-cyan-300 font-mono font-black text-sm shadow-md flex items-center gap-1.5">
                    <span>W</span>
                    <span className="text-slate-500">/</span>
                    <span>↑</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">FORWARD</span>
                </div>

                {/* Left - Neutral - Right Row */}
                <div className="flex items-center justify-center gap-4">
                  <div className="flex flex-col items-center">
                    <div className="px-4 py-2 rounded-xl bg-slate-800 border border-cyan-500/50 text-cyan-300 font-mono font-black text-sm shadow-md flex items-center gap-1.5">
                      <span>A</span>
                      <span className="text-slate-500">/</span>
                      <span>←</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">LEFT</span>
                  </div>

                  <div className="w-8 h-8 rounded-full border border-slate-700/80 flex items-center justify-center text-slate-500 text-xs font-mono">
                    ❖
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="px-4 py-2 rounded-xl bg-slate-800 border border-cyan-500/50 text-cyan-300 font-mono font-black text-sm shadow-md flex items-center gap-1.5">
                      <span>D</span>
                      <span className="text-slate-500">/</span>
                      <span>→</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">RIGHT</span>
                  </div>
                </div>

                {/* Reverse Key */}
                <div className="flex flex-col items-center">
                  <div className="px-4 py-2 rounded-xl bg-slate-800 border border-cyan-500/50 text-cyan-300 font-mono font-black text-sm shadow-md flex items-center gap-1.5">
                    <span>S</span>
                    <span className="text-slate-500">/</span>
                    <span>↓</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">REVERSE</span>
                </div>
              </div>

              {/* Spacebar for Weapon */}
              <div className="pt-4 border-t border-slate-800 flex flex-col items-center justify-center">
                <div className="w-56 py-2.5 rounded-xl bg-slate-800 border border-amber-500/50 text-amber-300 font-mono font-black text-xs uppercase tracking-wider shadow-md">
                  SPACE
                </div>
                <span className="text-[10px] text-amber-400 font-mono mt-1 font-bold">
                  {isSpinner ? 'HOLD FOR WEAPON POWER' : 'PRIMARY WEAPON / ACTION'}
                </span>
              </div>
            </div>

            {/* Launch Action */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">
                DRIVE YOUR ROBOT • DEFEAT THE BULL
              </span>

              <button
                type="button"
                onClick={handleStartBattle}
                className="cursor-pointer inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-black text-base tracking-wide shadow-lg shadow-amber-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Swords className="w-5 h-5" />
                <span>START BATTLE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          IN-BATTLE CONTROL REMINDER & FEED (During Battle)
         ============================================================ */}
      {battlePhase === 'fighting' && (
        <div className="relative z-20 px-5 pb-5 flex items-end justify-between gap-4 pointer-events-none">
          {/* Subtle Control Reminder Pill */}
          <div className="holo-panel px-4 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-3">
            <span><strong className="text-cyan-400 font-bold">WASD / ARROWS</strong> DRIVE</span>
            <span className="text-slate-600">•</span>
            <span><strong className="text-amber-400 font-bold">SPACE</strong> WEAPON</span>
          </div>

          {/* Spectator Camera Mode & Hitboxes */}
          <div className="pointer-events-auto holo-panel rounded-xl border border-slate-800 p-2 flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 px-2 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-cyan-400" /> CAM:
            </span>
            {(
              [
                { id: 'director', label: 'FOLLOW' },
                { id: 'wide', label: 'WIDE' },
              ] as { id: SpectatorCamMode; label: string }[]
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setCamMode(c.id);
                }}
                className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  camMode === c.id
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {c.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setShowHitboxes((prev) => !prev);
              }}
              className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                showHitboxes
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-sm shadow-rose-500/30'
                  : 'bg-slate-900 text-slate-400 border-slate-700/60 hover:text-slate-200'
              }`}
              title="Toggle Collision Hitboxes [H]"
            >
              HITBOXES {showHitboxes ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          PHASE C: POST-BATTLE RESULT (WIN OR LOSS)
         ============================================================ */}
      {battlePhase === 'finished' && analysisReport && (
        <div className="relative z-30 flex-1 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`holo-panel max-w-2xl w-full rounded-3xl border p-6 md:p-8 animate-pop-in ${
              analysisReport.winner === 'player'
                ? 'holo-glow-cyan border-cyan-400/50'
                : 'holo-glow-red border-red-500/50'
            }`}
          >
            {/* Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
              <div>
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono uppercase tracking-widest mb-1.5 ${
                    analysisReport.winner === 'player'
                      ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold'
                      : 'bg-red-500/20 border border-red-400/40 text-red-300 font-bold'
                  }`}
                >
                  {analysisReport.winner === 'player' ? (
                    <>
                      <Trophy className="w-3.5 h-3.5" /> CHAMPIONSHIP VICTORY
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" /> COMBAT EVALUATION
                    </>
                  )}
                </div>
                <h2 className="font-display text-3xl font-black text-white">
                  {analysisReport.winner === 'player'
                    ? 'YOUR TEAM DEFEATED THE BULL'
                    : 'THE BULL PREVAILED'}
                </h2>
                <p className={`text-sm font-semibold mt-1 ${analysisReport.winner === 'player' ? 'text-emerald-300' : 'text-slate-300'}`}>
                  {analysisReport.winner === 'player'
                    ? 'YOUR DESIGN WORKED.'
                    : analysisReport.headlineSummary}
                </p>
              </div>

              <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-4 py-2.5 text-right font-mono">
                <div className="text-[10px] text-slate-400 uppercase">
                  BATTLE TIME
                </div>
                <div className="text-2xl font-black text-white">
                  {analysisReport.durationSec.toFixed(1)}s
                </div>
              </div>
            </div>

            {/* Factual Engineering Observations */}
            <div className="mb-5">
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-300 font-bold mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> ENGINEERING OBSERVATIONS
              </div>
              <div className="space-y-2 rounded-2xl bg-slate-900/90 border border-slate-800 p-4 font-sans text-xs sm:text-sm text-slate-200">
                {analysisReport.engineeringEvidence.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        analysisReport.winner === 'player' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subsystem Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6 text-xs font-mono">
              <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
                <div className="text-[10px] text-slate-400">BATTERY FINISH</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {Math.round(analysisReport.playerFinal.batteryPct)}%
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
                <div className="text-[10px] text-slate-400">PEAK DRIVE TEMP</div>
                <div className={`text-sm font-bold mt-0.5 ${analysisReport.peakMotorTempC >= 85 ? 'text-amber-400' : 'text-white'}`}>
                  {analysisReport.peakMotorTempC}°C
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
                <div className="text-[10px] text-slate-400">IMPACTS DELIVERED</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {analysisReport.impactsDelivered} Strikes
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
                <div className="text-[10px] text-slate-400">PUSH DOMINANCE</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {Math.round(analysisReport.pushDominanceRatio * 100)}%
                </div>
              </div>
            </div>

            {/* Action Buttons: REMATCH and RETURN TO ENGINEERING */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleRematch}
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-display font-bold text-slate-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-cyan-400" />
                <span>↻ REMATCH</span>
              </button>

              <button
                type="button"
                onClick={handleReturnToEngineering}
                className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 text-xs sm:text-sm font-display font-extrabold shadow-lg shadow-cyan-500/25 transition-all transform hover:scale-[1.02]"
              >
                <Wrench className="w-4 h-4" />
                <span>RETURN TO ENGINEERING</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
