import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Activity,
  AlertTriangle,
  Battery,
  Camera,
  CheckCircle2,
  Cpu,
  Flame,
  RotateCcw,
  Shield,
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
import { BOSS_LADDER, getBossById } from '../../data/bosses';
import {
  ARENA_HALF_SIZE,
  createBattleSimulation,
  generateBattleAnalysisReport,
  type LiveBattleSimulation,
  stepBattleSimulation,
} from '../../simulation/battleEngine';
import { type AutonomousStrategy, type BattleAnalysisReport, type BattleEventLog, type BossId, type CombatantTelemetry, type EngineeringStats, type RobotConfiguration, type SparkBurst } from '../../types/robot';
import { Robot3D } from '../three/Robot3D';

interface ArenaScreenProps {
  playerConfig: RobotConfiguration;
  playerStats: EngineeringStats;
  bossId?: BossId;
  onReturnToWorkshop: (resetToStarter?: boolean) => void;
  onDefeatBoss?: (bossId: BossId) => void;
  onNextBoss?: () => void;
}

type SpectatorCamMode = 'director' | 'wide' | 'chase';

const STRATEGIES: {
  id: AutonomousStrategy;
  name: string;
  tagline: string;
  pros: string;
  tradeoffs: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'aggressive',
    name: 'AGGRESSIVE',
    tagline: 'Close distance immediately. Attack frequently.',
    pros: 'Maximizes offensive opportunities and pressure.',
    tradeoffs: 'High battery energy consumption & greater exposure to frontal damage.',
    icon: <Flame className="w-5 h-5 text-orange-400" />,
  },
  {
    id: 'control',
    name: 'CONTROL',
    tagline: 'Prioritize positioning, flanking, and pushing leverage.',
    pros: 'Targets exposed side/rear angles & controls arena hazards.',
    tradeoffs: 'Requires sufficient turning agility; sacrifices early direct strikes.',
    icon: <Cpu className="w-5 h-5 text-cyan-400" />,
  },
  {
    id: 'defensive',
    name: 'DEFENSIVE',
    tagline: 'Evade head-on charges. Counterattack when openings appear.',
    pros: 'Reduced damage exposure & full weapon spin-up time.',
    tradeoffs: 'Less offensive pressure; requires mobility to evade The Bull.',
    icon: <Shield className="w-5 h-5 text-emerald-400" />,
  },
];

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
  battlePhase: 'intro-strategy' | 'fighting' | 'finished';
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
}> = ({ simRef, battlePhase, camMode, playerConfig, bossId, showHitboxes = false, onSyncHud }) => {
  const { camera } = useThree();
  const playerGroupRef = useRef<THREE.Group>(null);
  const bullGroupRef = useRef<THREE.Group>(null);
  const hudTimerRef = useRef<number>(0);
  const lastEventIdRef = useRef<number>(0);

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
      stepBattleSimulation(sim, delta);

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
    const separation = Math.hypot(sim.player.x - sim.bull.x, sim.player.z - sim.bull.z);

    // Subtle impact camera shake
    const shakeAmt = sim.cameraImpactShake * 0.14;
    const shakeX = Math.sin(state.clock.elapsedTime * 55) * shakeAmt;
    const shakeY = Math.cos(state.clock.elapsedTime * 48) * shakeAmt;

    if (battlePhase === 'intro-strategy') {
      // Dramatic pre-battle orbit around arena center
      const t = state.clock.elapsedTime * 0.25;
      const targetPos = new THREE.Vector3(Math.sin(t) * 6.4, 3.8, Math.cos(t) * 6.4);
      camera.position.lerp(targetPos, delta * 3);
      camera.lookAt(0, 0.3, 0);
    } else if (camMode === 'wide') {
      const targetPos = new THREE.Vector3(0 + shakeX, 6.8 + shakeY, 6.8);
      camera.position.lerp(targetPos, delta * 4);
      camera.lookAt(0, 0, 0);
    } else if (camMode === 'chase') {
      const behindX = sim.player.x - Math.sin(sim.player.headingRad) * 3.4 + shakeX;
      const behindZ = sim.player.z - Math.cos(sim.player.headingRad) * 3.4;
      camera.position.lerp(new THREE.Vector3(behindX, 2.3 + shakeY, behindZ), delta * 6);
      camera.lookAt(midX, 0.35, midZ);
    } else {
      // DIRECTOR CAM: Dynamically frames both robots, tightening on engagement & pulling back when separated
      const zoomDist = THREE.MathUtils.clamp(3.3 + separation * 0.72, 3.6, 7.2);
      const camHeight = THREE.MathUtils.clamp(2.2 + separation * 0.42, 2.4, 4.8);
      const orbitOffset = Math.sin(state.clock.elapsedTime * 0.18) * 1.4;
      const targetCamPos = new THREE.Vector3(
        midX + orbitOffset + shakeX,
        camHeight + shakeY,
        midZ + zoomDist
      );
      camera.position.lerp(targetCamPos, delta * 4.5);
      camera.lookAt(midX, 0.25, midZ);
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
  onReturnToWorkshop,
  onDefeatBoss,
  onNextBoss,
}) => {
  const bossDossier = getBossById(bossId);
  const nextBoss = BOSS_LADDER.find((b) => b.tier === bossDossier.tier + 1);

  const [selectedStrategy, setSelectedStrategy] = useState<AutonomousStrategy>('control');
  const [battlePhase, setBattlePhase] = useState<'intro-strategy' | 'fighting' | 'finished'>(
    'intro-strategy'
  );
  const [camMode, setCamMode] = useState<SpectatorCamMode>('director');
  const [showHitboxes, setShowHitboxes] = useState(false);

  const [initialSim] = useState(() => createBattleSimulation(playerConfig, selectedStrategy, bossId));
  const simRef = useRef<LiveBattleSimulation | null>(initialSim);

  const [hudPlayer, setHudPlayer] = useState<CombatantTelemetry>(() => initialSim.player);
  const [hudBull, setHudBull] = useState<CombatantTelemetry>(() => initialSim.bull);
  const [hudTimeSec, setHudTimeSec] = useState<number>(0);
  const [hudEvents, setHudEvents] = useState<BattleEventLog[]>([]);
  const [analysisReport, setAnalysisReport] = useState<BattleAnalysisReport | null>(null);

  // Ensure keyboard inputs do NOTHING during battle (100% autonomous spectator guarantee)
  // Pressing 'H' toggles developer collision hitboxes
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.key === 'h' || e.key === 'H') {
        setShowHitboxes((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, []);

  const handleStartBattle = () => {
    soundEngine.playArenaHorn();
    simRef.current = createBattleSimulation(playerConfig, selectedStrategy, bossId);
    setHudPlayer(simRef.current.player);
    setHudBull(simRef.current.bull);
    setHudTimeSec(0);
    setHudEvents(simRef.current.events);
    setAnalysisReport(null);
    setBattlePhase('fighting');
  };

  const playerDriveCondition = Math.round(
    (hudPlayer.leftDriveHealthPct + hudPlayer.rightDriveHealthPct) * 0.5
  );
  const bullOverallCondition = Math.round(
    hudBull.hullIntegrityPct * 0.6 +
      ((hudBull.leftDriveHealthPct + hudBull.rightDriveHealthPct) * 0.5) * 0.4
  );

  return (
    <div className="relative w-full h-full bg-[#0a0f1d] overflow-hidden flex flex-col justify-between">
      {/* 3D Combat Arena Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [0, 4.2, 6.4], fov: 44 }}>
          <Arena3DScene
            simRef={simRef}
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
                if (rep.winner === 'player') {
                  onDefeatBoss?.(bossId);
                }
              }
            }}
          />
        </Canvas>
      </div>

      {/* ============================================================
          LIVE TELEMETRY HUD (Always visible at top)
         ============================================================ */}
      <div className="relative z-20 p-4 md:p-5 flex flex-col gap-3 pointer-events-none">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
          {/* LEFT: PLAYER BOT TELEMETRY */}
          <div className="holo-panel holo-glow-cyan rounded-2xl border border-cyan-500/40 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-display font-extrabold text-sm text-white tracking-wide">
                  {playerConfig.name} ({playerStats.totalWeightLb.toFixed(1)} LB)
                </span>
              </div>
              <span className="text-[10px] font-mono-num uppercase px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30 text-cyan-300">
                AI: {hudPlayer.aiStateLabel}
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

            {/* 4 Key Telemetry Subsystems: Battery, Weapon, Drive, Temperature */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                <div className="text-[9px] font-mono-num text-slate-400 flex items-center justify-center gap-0.5">
                  <Battery className="w-3 h-3 text-cyan-400" /> BATT
                </div>
                <div
                  className={`font-mono-num text-xs font-bold mt-0.5 ${
                    hudPlayer.batteryPct < 25 ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {Math.round(hudPlayer.batteryPct)}%
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                <div className="text-[9px] font-mono-num text-slate-400 flex items-center justify-center gap-0.5">
                  <Zap className="w-3 h-3 text-amber-400" /> WEAPON
                </div>
                <div
                  className={`font-mono-num text-xs font-bold mt-0.5 ${
                    hudPlayer.weaponHealthPct <= 20 ? 'text-red-400' : 'text-amber-300'
                  }`}
                >
                  {hudPlayer.weaponHealthPct <= 20
                    ? 'DOWN'
                    : `${Math.round(hudPlayer.weaponSpinPct)}%`}
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                <div className="text-[9px] font-mono-num text-slate-400 flex items-center justify-center gap-0.5">
                  <Activity className="w-3 h-3 text-emerald-400" /> DRIVE
                </div>
                <div
                  className={`font-mono-num text-xs font-bold mt-0.5 ${
                    playerDriveCondition < 55 ? 'text-amber-400' : 'text-emerald-300'
                  }`}
                >
                  {playerDriveCondition}%
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                <div className="text-[9px] font-mono-num text-slate-400 flex items-center justify-center gap-0.5">
                  <Thermometer className="w-3 h-3 text-orange-400" /> TEMP
                </div>
                <div
                  className={`font-mono-num text-xs font-bold mt-0.5 ${
                    hudPlayer.motorTempC >= 85 ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {Math.round(hudPlayer.motorTempC)}°C
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: MATCH CLOCK & AUTONOMOUS SPECTATOR BADGE */}
          <div className="flex flex-col items-center">
            <div className="holo-panel rounded-2xl border border-slate-700/80 px-6 py-2.5 text-center">
              <div className="text-[10px] font-mono-num uppercase tracking-widest text-cyan-300">
                AUTONOMOUS COMBAT TELEMETRY
              </div>
              <div className="font-mono-num text-2xl font-black text-white">
                {(36.0 - Math.min(36.0, hudTimeSec)).toFixed(1)}s
              </div>
            </div>

            {/* Live Important Event Callout Banner */}
            {battlePhase === 'fighting' && hudEvents[0] && (
              <div
                key={hudEvents[0].id}
                className={`mt-2.5 px-4 py-1.5 rounded-full font-mono-num text-xs font-bold uppercase tracking-wider border animate-pop-in ${
                  hudEvents[0].type === 'critical'
                    ? 'bg-red-950/90 border-red-500 text-red-200'
                    : hudEvents[0].type === 'impact'
                    ? 'bg-amber-950/90 border-amber-400 text-amber-200'
                    : hudEvents[0].type === 'warning'
                    ? 'bg-orange-950/90 border-orange-400 text-orange-200'
                    : 'bg-cyan-950/90 border-cyan-400 text-cyan-200'
                }`}
              >
                {hudEvents[0].text}
              </div>
            )}
          </div>

          {/* RIGHT: THE BULL CONDITION */}
          <div className="holo-panel holo-glow-amber rounded-2xl border border-amber-500/40 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono-num uppercase px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/30 text-amber-300">
                TIER 0{bossDossier.tier} BOSS
              </span>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-sm text-white tracking-wide">
                  {bossDossier.icon} {bossDossier.name} ({bossDossier.weightLb.toFixed(1)} LB)
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              </div>
            </div>

            <div className="mb-2.5">
              <div className="flex justify-between text-[11px] font-mono-num text-slate-300 mb-1">
                <span>GENERAL CONDITION</span>
                <span className="font-bold text-amber-300">{bullOverallCondition}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-150"
                  style={{ width: `${Math.max(0, bullOverallCondition)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                <div className="text-[9px] font-mono-num text-slate-400">FRONT PLOW</div>
                <div className="font-mono-num text-xs font-bold text-amber-300 mt-0.5">
                  {Math.round(hudBull.frontArmorPct)}%
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                <div className="text-[9px] font-mono-num text-slate-400">SIDE / REAR</div>
                <div className="font-mono-num text-xs font-bold text-white mt-0.5">
                  {Math.round(hudBull.sideArmorPct)}%
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                <div className="text-[9px] font-mono-num text-slate-400">DRIVETRAIN</div>
                <div className="font-mono-num text-xs font-bold text-white mt-0.5">
                  {hudBull.isFlipped
                    ? 'INVERTED'
                    : `${Math.round((hudBull.leftDriveHealthPct + hudBull.rightDriveHealthPct) * 0.5)}%`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          PHASE A: PRE-BATTLE STRATEGY SELECTION MODAL
         ============================================================ */}
      {battlePhase === 'intro-strategy' && (
        <div className="relative z-30 flex-1 flex items-center justify-center p-4">
          <div className="holo-panel holo-glow-cyan max-w-3xl w-full rounded-2xl border border-cyan-500/40 p-6 md:p-8 animate-pop-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <div className="text-xs font-mono-num uppercase tracking-widest text-cyan-300 mb-1">
                  AUTONOMOUS COMBAT PROTOCOL
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-black text-white">
                  CHOOSE AUTONOMOUS STRATEGY
                </h2>
              </div>
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onReturnToWorkshop(false);
                }}
                className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-display font-bold text-slate-300"
              >
                ← WORKSHOP
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 mb-5">
              Once battle starts, your robot fights <strong className="text-cyan-300">100% autonomously</strong>.
              Your strategy determines what your robot <em>attempts</em> to do — your engineering
              determines whether it <em>succeeds</em>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-6">
              {STRATEGIES.map((st) => {
                const isSelected = selectedStrategy === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      soundEngine.playClick();
                      setSelectedStrategy(st.id);
                    }}
                    className={`cursor-pointer rounded-xl p-4 text-left transition-all border flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-400 shadow-lg shadow-cyan-500/15'
                        : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        {st.icon}
                        <span
                          className={`text-[10px] font-mono-num uppercase px-2 py-0.5 rounded ${
                            isSelected
                              ? 'bg-cyan-400 text-slate-950 font-bold'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isSelected ? 'SELECTED' : 'SELECT'}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-extrabold text-white mb-1">
                        {st.name}
                      </h3>
                      <p className="text-xs text-slate-200 font-medium mb-3">{st.tagline}</p>
                    </div>

                    <div className="space-y-1.5 text-[11px] border-t border-slate-800/90 pt-2.5">
                      <div className="text-emerald-300">+ {st.pros}</div>
                      <div className="text-amber-300">- {st.tradeoffs}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-mono-num text-slate-400">
                ZERO MANUAL CONTROLS IN ARENA — PURE ENGINEERING TEST
              </div>
              <button
                onClick={handleStartBattle}
                className="cursor-pointer inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-black text-lg tracking-wide shadow-lg shadow-amber-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Swords className="w-5 h-5" />
                START BATTLE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          PHASE B: SPECTATOR FOOTER DURING AUTONOMOUS BATTLE
         ============================================================ */}
      {battlePhase === 'fighting' && (
        <div className="relative z-20 px-5 pb-5 flex items-end justify-between gap-4 pointer-events-none">
          {/* Live Telemetry Event Feed */}
          <div className="holo-panel rounded-xl border border-slate-800/90 p-3 max-w-md w-full">
            <div className="text-[10px] font-mono-num uppercase tracking-widest text-slate-400 mb-1.5">
              AUTONOMOUS CONTROLLER LOG (SENSE → DECIDE → ENGAGE)
            </div>
            <div className="space-y-1 max-h-24 overflow-hidden">
              {hudEvents.slice(0, 4).map((ev) => (
                <div key={ev.id} className="text-xs font-mono-num flex items-center gap-2">
                  <span className="text-slate-500">{ev.timeSec.toFixed(1)}s</span>
                  <span
                    className={
                      ev.type === 'critical'
                        ? 'text-red-300 font-semibold'
                        : ev.type === 'impact'
                        ? 'text-amber-300 font-semibold'
                        : ev.type === 'warning'
                        ? 'text-orange-300'
                        : 'text-cyan-300'
                    }
                  >
                    {ev.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Spectator Camera Angle Selector (No Robot Controls!) */}
          <div className="pointer-events-auto holo-panel rounded-xl border border-slate-800 p-2 flex items-center gap-1.5">
            <span className="text-[10px] font-mono-num uppercase text-slate-400 px-2 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-cyan-400" /> CAMERA:
            </span>
            {(
              [
                { id: 'director', label: 'DIRECTOR CAM' },
                { id: 'wide', label: 'ARENA WIDE' },
                { id: 'chase', label: 'FOLLOW BOT' },
              ] as { id: SpectatorCamMode; label: string }[]
            ).map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  soundEngine.playClick();
                  setCamMode(c.id);
                }}
                className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-mono-num font-bold transition-all ${
                  camMode === c.id
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {c.label}
              </button>
            ))}

            {/* Developer Hitbox Debug Toggle */}
            <button
              onClick={() => {
                soundEngine.playClick();
                setShowHitboxes((prev) => !prev);
              }}
              className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-mono-num font-bold transition-all border ${
                showHitboxes
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-sm shadow-rose-500/30'
                  : 'bg-slate-900 text-slate-400 border-slate-700/60 hover:text-slate-200'
              }`}
              title="Toggle Collision Hitboxes [H]"
            >
              DEBUG HITBOXES {showHitboxes ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          PHASE C: POST-BATTLE ENGINEERING ANALYSIS (WIN OR LOSS)
         ============================================================ */}
      {battlePhase === 'finished' && analysisReport && (
        <div className="relative z-30 flex-1 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`holo-panel max-w-3xl w-full rounded-2xl border p-6 md:p-8 animate-pop-in ${
              analysisReport.winner === 'player'
                ? 'holo-glow-cyan border-cyan-400/50'
                : 'holo-glow-red border-red-500/50'
            }`}
          >
            {/* Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
              <div>
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono-num uppercase tracking-widest mb-1.5 ${
                    analysisReport.winner === 'player'
                      ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                      : 'bg-red-500/20 border border-red-400/40 text-red-300'
                  }`}
                >
                  {analysisReport.winner === 'player' ? (
                    <>
                      <Trophy className="w-3.5 h-3.5" /> YOUR DESIGN WORKED.
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" /> POST-MATCH FAILURE TELEMETRY
                    </>
                  )}
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-black text-white">
                  {analysisReport.winner === 'player' ? 'BOSS DEFEATED' : 'THE BULL WINS'}
                </h2>
                <p className="text-sm text-slate-300 mt-1">{analysisReport.headlineSummary}</p>
              </div>

              <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-4 py-2.5 text-right">
                <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                  BATTLE TIME
                </div>
                <div className="font-mono-num text-2xl font-extrabold text-white">
                  {analysisReport.durationSec.toFixed(1)}s
                </div>
                <div className="text-[10px] font-mono-num text-cyan-300 uppercase">
                  STRATEGY: {analysisReport.strategyUsed}
                </div>
              </div>
            </div>

            {/* Engineering Evidence Narrative */}
            <div className="mb-5">
              <div className="text-xs font-mono-num uppercase tracking-widest text-cyan-300 font-bold mb-2.5 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> BATTLE ANALYSIS — ENGINEERING EVIDENCE
              </div>
              <div className="space-y-2 rounded-xl bg-slate-900/90 border border-slate-800 p-4">
                {analysisReport.engineeringEvidence.map((item, idx) => (
                  <div key={idx} className="text-xs sm:text-sm text-slate-200 flex items-start gap-2">
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

            {/* Subsystem Post-Battle Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mb-6">
              <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
                <div className="text-[10px] font-mono-num text-slate-400">BATTERY</div>
                <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                  {Math.round(analysisReport.playerFinal.batteryPct)}% left
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
                <div className="text-[10px] font-mono-num text-slate-400">DRIVE</div>
                <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                  {analysisReport.playerFinal.leftDriveHealthPct < 55
                    ? 'Left Damaged'
                    : `${Math.round(analysisReport.playerFinal.leftDriveHealthPct)}% Intact`}
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
                <div className="text-[10px] font-mono-num text-slate-400">WEAPON</div>
                <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                  {analysisReport.playerFinal.weaponHealthPct > 25 ? 'Functional' : 'Disabled'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
                <div className="text-[10px] font-mono-num text-slate-400">MAX MOTOR TEMP</div>
                <div
                  className={`font-mono-num text-sm font-bold mt-0.5 ${
                    analysisReport.peakMotorTempC >= 85 ? 'text-amber-400' : 'text-white'
                  }`}
                >
                  {analysisReport.peakMotorTempC}°C
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
                <div className="text-[10px] font-mono-num text-slate-400">STABILITY</div>
                <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                  {analysisReport.playerFinal.isFlipped
                    ? 'Inverted'
                    : analysisReport.playerStats.stabilityLabel}
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
                <div className="text-[10px] font-mono-num text-slate-400">ARMOR</div>
                <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                  {analysisReport.playerFinal.sideArmorPct < 45
                    ? 'Side Failed'
                    : `${Math.round(analysisReport.playerFinal.hullIntegrityPct)}% Hull`}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setBattlePhase('intro-strategy');
                }}
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-display font-bold text-slate-200"
              >
                <RotateCcw className="w-4 h-4 text-cyan-400" />
                CHANGE STRATEGY / REMATCH
              </button>

              {analysisReport.winner === 'player' ? (
                <div className="flex flex-wrap items-center gap-3">
                  {nextBoss && onNextBoss && (
                    <button
                      onClick={() => {
                        soundEngine.playInstall();
                        onNextBoss();
                      }}
                      className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 text-xs sm:text-sm font-display font-extrabold shadow-lg shadow-emerald-500/25 transform hover:scale-[1.02]"
                    >
                      <Trophy className="w-4 h-4" />
                      CHALLENGE TIER 0{nextBoss.tier}: {nextBoss.name} →
                    </button>
                  )}
                  <button
                    onClick={() => {
                      soundEngine.playInstall();
                      onReturnToWorkshop(false);
                    }}
                    className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-xs sm:text-sm font-display font-bold text-cyan-300"
                  >
                    <Wrench className="w-4 h-4" />
                    REDESIGN IN WORKSHOP
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    soundEngine.playInstall();
                    onReturnToWorkshop(false);
                  }}
                  className="cursor-pointer inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 text-sm font-display font-extrabold shadow-lg shadow-cyan-500/25"
                >
                  <Wrench className="w-4 h-4" />
                  RETURN TO WORKSHOP & REDESIGN
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
