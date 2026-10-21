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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { soundEngine } from '../../audio/soundEngine';
import { getSponsorForTier } from '../../data/teamData';
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
  type CombatImpactEvent,
  type EngineeringStats,
  type RobotConfiguration,
  type SparkBurst,
  type TeamRobotProject,
  type WedgeTelemetry,
  type WeaponId,
} from '../../types/robot';
import { Robot3D } from '../three/Robot3D';
import { DevLoadoutCard } from '../dev/DevLoadoutCard';
import {
  DEV_AVAILABLE_WEAPONS,
  formatWeaponOptionLabel,
  type DevRobotSource,
} from '../../services/devMode';

interface ArenaScreenProps {
  playerConfig: RobotConfiguration;
  playerStats: EngineeringStats;
  bossId?: BossId;
  teamProject?: TeamRobotProject;
  onReturnToWorkshop: (resetToStarter?: boolean) => void;
  onReturnToDashboard?: () => void;
  onDefeatBoss?: (bossId: BossId) => void;
  isDevMode?: boolean;
  devRobotSource?: DevRobotSource;
  devWeaponId?: WeaponId;
  onDevChangeWeapon?: (weaponId: WeaponId) => void;
  onDevChangeRobotSource?: (source: DevRobotSource) => void;
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

// 3D Tournament Arena Billboard displaying the team's accepted sponsorship poster
const ArenaPosterBillboard: React.FC<{
  teamProject?: TeamRobotProject;
  playerConfig: RobotConfiguration;
}> = ({ teamProject, playerConfig }) => {
  const teamName = (teamProject?.teamName || playerConfig.name || 'TITAN ROBOTICS').toUpperCase();
  const lead = teamProject?.projectLead;
  const campaign = lead?.campaign;
  const activeSponsor = lead?.activeSponsors?.[0];
  const headline = campaign?.headline || lead?.adHeadline || 'BUILT TO STRIKE • ENGINEERED TO WIN';
  const hasCustomPoster = Boolean(lead?.campaignScore && lead.campaignScore > 0 && (campaign?.approved || lead.isCompleted));

  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Dark Tournament Backdrop
    const grad = ctx.createLinearGradient(0, 0, 1024, 512);
    if (hasCustomPoster && campaign?.theme === 'tech') {
      grad.addColorStop(0, '#02182b');
      grad.addColorStop(0.5, '#061c38');
      grad.addColorStop(1, '#021020');
    } else if (hasCustomPoster && campaign?.theme === 'speed') {
      grad.addColorStop(0, '#0c1222');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#090d16');
    } else if (hasCustomPoster && campaign?.theme === 'armored') {
      grad.addColorStop(0, '#1c1917');
      grad.addColorStop(0.5, '#292524');
      grad.addColorStop(1, '#0c0a09');
    } else {
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#090d16');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // 2. High-Tech Grid & Angled Racing Accents
    ctx.strokeStyle = hasCustomPoster ? 'rgba(6, 182, 212, 0.22)' : 'rgba(239, 68, 68, 0.22)';
    ctx.lineWidth = 2;
    for (let x = 40; x < 1024; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 40; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Outer Neon Framing Border
    ctx.strokeStyle = hasCustomPoster ? '#06b6d4' : '#f59e0b';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, 1000, 488);

    // Inner Subtle Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, 976, 464);

    // Top Header Banner
    ctx.fillStyle = hasCustomPoster ? '#06b6d4' : '#f59e0b';
    ctx.fillRect(24, 24, 976, 52);

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      hasCustomPoster
        ? '★ BESA COMBAT ROBOTICS TOURNAMENT • OFFICIAL TEAM POSTER ★'
        : '★ BESA COMBAT CHAMPIONSHIP • TOURNAMENT ARENA ★',
      512,
      50
    );

    // Center Team Name (Massive, Bold)
    ctx.font = '900 68px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = hasCustomPoster ? '#06b6d4' : '#ef4444';
    ctx.shadowBlur = 18;
    ctx.fillText(teamName, 512, 180);
    ctx.shadowBlur = 0;

    // Sub-Headline
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`"${headline}"`, 512, 255);

    // Divider Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(120, 310);
    ctx.lineTo(904, 310);
    ctx.stroke();

    // Bottom Sponsor / Partner Badge Strip
    if (activeSponsor) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(160, 345, 704, 95);
      ctx.strokeStyle = activeSponsor.brandColor || '#06b6d4';
      ctx.lineWidth = 3;
      ctx.strokeRect(160, 345, 704, 95);

      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`OFFICIAL ${activeSponsor.tier.toUpperCase()} SPONSOR`, 512, 375);

      ctx.font = '900 32px sans-serif';
      ctx.fillStyle = activeSponsor.brandColor || '#38bdf8';
      ctx.fillText(activeSponsor.sponsorName.toUpperCase(), 512, 412);
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(200, 345, 624, 95);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(200, 345, 624, 95);

      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('SANCTIONED 30 LB COMBAT ROBOT ENTRY', 512, 380);

      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('SPONSORSHIP STUDIO • ARENA DIVISION', 512, 414);
    }

    const t = new THREE.CanvasTexture(canvas);
    t.needsUpdate = true;
    return t;
  }, [teamName, headline, activeSponsor, hasCustomPoster, campaign?.theme]);

  return (
    <group position={[0, 2.65, -(ARENA_HALF_SIZE + 0.85)]}>
      {/* Billboard Main Screen Board */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[4.8, 2.4]} />
        {texture ? (
          <meshStandardMaterial
            map={texture}
            roughness={0.25}
            metalness={0.3}
            emissive="#1e293b"
            emissiveIntensity={0.25}
          />
        ) : (
          <meshStandardMaterial color="#0f172a" />
        )}
      </mesh>

      {/* Frame surround bevel */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[4.95, 2.55, 0.1]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.5} metalness={0.8} />
      </mesh>

      {/* Top Billboard Floodlight Bar */}
      <mesh position={[0, 1.25, 0.2]}>
        <boxGeometry args={[4.6, 0.08, 0.35]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Left & Right Support Truss Pillars down to Floor */}
      {[-2.2, 2.2].map((x, i) => (
        <group key={i} position={[x, -1.325, 0]}>
          <mesh position={[0, 0, -0.05]}>
            <boxGeometry args={[0.14, 2.65, 0.14]} />
            <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

interface ProceduralDebrisPiece {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  vRotX: number;
  vRotY: number;
  vRotZ: number;
  type: 'plate' | 'wheel' | 'fragment';
  color: string;
  size: [number, number, number];
  isSettled: boolean;
}

// 3D Arena Scene & Automatic Spectator Camera Controller
const Arena3DScene: React.FC<{
  simRef: React.MutableRefObject<LiveBattleSimulation | null>;
  keyboardRef: React.MutableRefObject<KeyboardControllerInstance | null>;
  battlePhase: 'tutorial' | 'countdown' | 'fighting' | 'finished';
  camMode: SpectatorCamMode;
  playerConfig: RobotConfiguration;
  bossId: BossId;
  teamProject?: TeamRobotProject;
  showHitboxes?: boolean;
  isDevMode?: boolean;
  onSyncHud: (
    player: CombatantTelemetry,
    bull: CombatantTelemetry,
    timeSec: number,
    events: BattleEventLog[],
    report: BattleAnalysisReport | null,
    lastImpact?: CombatImpactEvent | null,
    lastWedge?: WedgeTelemetry | null,
    isCritical?: boolean,
    isFinalHit?: boolean
  ) => void;
}> = ({ simRef, keyboardRef, battlePhase, camMode, playerConfig, bossId, teamProject, showHitboxes = false, isDevMode = false, onSyncHud }) => {
  const { camera } = useThree();
  const playerGroupRef = useRef<THREE.Group>(null);
  const bullGroupRef = useRef<THREE.Group>(null);
  const hudTimerRef = useRef<number>(0);
  const lastEventIdRef = useRef<number>(0);
  // Drive motors hum with the robot's speed; the weapon whines as it spins up.
  const fighting = battlePhase === 'fighting';
  const motorHum = useLoop('motor', fighting);
  const weaponWhine = useLoop('whine', fighting);
  const lastImpactEventIdRef = useRef<number>(0);
  const hitstopTimerRef = useRef<number>(0);

  // End-of-Battle finish sequence audio & debris refs
  const criticalAlertPlayedRef = useRef<boolean>(false);
  const finalHitPlayedRef = useRef<boolean>(false);
  const debrisRef = useRef<ProceduralDebrisPiece[]>([]);

  const [renderState, setRenderState] = useState<{
    player: CombatantTelemetry | null;
    bull: CombatantTelemetry | null;
    sparks: SparkBurst[];
    debris: ProceduralDebrisPiece[];
    isFinalHit: boolean;
    debugHitboxes?: LiveBattleSimulation['debugHitboxes'];
  }>({
    player: null,
    bull: null,
    sparks: [],
    debris: [],
    isFinalHit: false,
  });

  useFrame((state, delta) => {
    const sim = simRef.current;
    if (!sim) return;

    if (battlePhase === 'tutorial' || battlePhase === 'countdown') {
      criticalAlertPlayedRef.current = false;
      finalHitPlayedRef.current = false;
      debrisRef.current = [];
    }

    // Arcade Critical State Sound Cue
    if (sim.isCriticalState && !criticalAlertPlayedRef.current) {
      criticalAlertPlayedRef.current = true;
      soundEngine.playCriticalAlert();
    }

    // Final Impact Sequence (Audio, Hitstop, Input cutoff, Debris)
    if (sim.isFinalHitExecuted && !finalHitPlayedRef.current) {
      finalHitPlayedRef.current = true;
      soundEngine.playFinalHit();
      hitstopTimerRef.current = 0.42;
      keyboardRef.current?.clear();
      keyboardRef.current?.setEnabled(false);

      const bx = sim.bull.x;
      const bz = sim.bull.z;
      debrisRef.current = [
        {
          id: 1,
          x: bx,
          y: 0.35,
          z: bz,
          vx: -0.6 + Math.random() * 1.2,
          vy: 2.8,
          vz: 1.4,
          rotX: 0,
          rotY: 0,
          rotZ: 0,
          vRotX: 12,
          vRotY: 6,
          vRotZ: 8,
          type: 'plate',
          color: '#b45309',
          size: [0.24, 0.04, 0.18],
          isSettled: false,
        },
        {
          id: 2,
          x: bx + 0.2,
          y: 0.25,
          z: bz,
          vx: 1.8,
          vy: 2.2,
          vz: -0.8,
          rotX: 0,
          rotY: 0,
          rotZ: 0,
          vRotX: 5,
          vRotY: 15,
          vRotZ: 4,
          type: 'wheel',
          color: '#1e293b',
          size: [0.12, 0.12, 0.08],
          isSettled: false,
        },
        {
          id: 3,
          x: bx - 0.15,
          y: 0.28,
          z: bz,
          vx: -1.6,
          vy: 2.4,
          vz: -0.6,
          rotX: 0,
          rotY: 0,
          rotZ: 0,
          vRotX: 10,
          vRotY: 8,
          vRotZ: 14,
          type: 'fragment',
          color: '#64748b',
          size: [0.08, 0.04, 0.08],
          isSettled: false,
        },
        {
          id: 4,
          x: bx,
          y: 0.32,
          z: bz + 0.15,
          vx: 0.8,
          vy: 3.1,
          vz: 1.8,
          rotX: 0,
          rotY: 0,
          rotZ: 0,
          vRotX: 14,
          vRotY: 11,
          vRotZ: 7,
          type: 'fragment',
          color: '#475569',
          size: [0.07, 0.04, 0.07],
          isSettled: false,
        },
        {
          id: 5,
          x: bx + 0.1,
          y: 0.3,
          z: bz - 0.1,
          vx: -1.2,
          vy: 2.0,
          vz: -1.5,
          rotX: 0,
          rotY: 0,
          rotZ: 0,
          vRotX: 8,
          vRotY: 16,
          vRotZ: 5,
          type: 'fragment',
          color: '#94a3b8',
          size: [0.06, 0.03, 0.06],
          isSettled: false,
        },
      ];
    }

    // Step procedural mechanical debris
    for (const p of debrisRef.current) {
      if (!p.isSettled) {
        p.vy -= 9.8 * delta;
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;
        p.rotX += p.vRotX * delta;
        p.rotY += p.vRotY * delta;
        p.rotZ += p.vRotZ * delta;
        if (p.y <= 0.02) {
          p.y = 0.02;
          p.vy = -p.vy * 0.28;
          p.vx *= 0.65;
          p.vz *= 0.65;
          p.vRotX *= 0.5;
          p.vRotY *= 0.5;
          p.vRotZ *= 0.5;
          if (Math.abs(p.vy) < 0.25) {
            p.vy = 0;
            p.isSettled = true;
          }
        }
      }
    }

    // Presentation-level hitstop freeze on heavy/major impacts
    if (hitstopTimerRef.current > 0) {
      hitstopTimerRef.current = Math.max(0, hitstopTimerRef.current - delta);
    } else if (battlePhase === 'fighting' && !sim.isFinished) {
      const input = keyboardRef.current ? keyboardRef.current.getInput() : undefined;
      stepBattleSimulation(sim, delta, input);
      motorHum.current.set(0.08 + Math.min(1, Math.hypot(sim.player.vx, sim.player.vz) / 3.5) * 0.92);
      weaponWhine.current.set(sim.player.weaponSpinPct / 100);

      // Play sound and trigger hitstop from authoritative CombatImpactEvent
      if (sim.lastImpactEvent && sim.lastImpactEvent.id !== lastImpactEventIdRef.current) {
        lastImpactEventIdRef.current = sim.lastImpactEvent.id;
        const imp = sim.lastImpactEvent;
        soundEngine.playCombatImpact(imp.severity, imp.type);
        if (imp.hitstopMs > 0) {
          hitstopTimerRef.current = imp.hitstopMs / 1000;
        }
        if (isDevMode) {
          console.log('[DEV IMPACT TELEMETRY]', {
            classification: imp.attackClassification ?? 'NEW_STRIKE',
            attackType: imp.attackType ?? imp.type,
            sector: imp.hitSector ?? 'front',
            impactSeverity: imp.severity,
            damageSeverity: imp.damageSeverity ?? 'moderate',
            source: imp.sourceRobot,
            target: imp.targetRobot,
            relativeSpeed: `${imp.relativeVelocity} m/s`,
            targetImpulse: `${imp.impulse} N*s`,
            attackerReactionImpulse: imp.attackerReactionImpulse ? `${imp.attackerReactionImpulse} N*s` : 'N/A',
            targetDeltaV: imp.targetDeltaV ? `${imp.targetDeltaV} m/s` : 'N/A',
            attackerDeltaV: imp.attackerDeltaV ? `${imp.attackerDeltaV} m/s` : 'N/A',
            targetDeltaOmega: imp.targetDeltaOmega ? `${(imp.targetDeltaOmega * (180 / Math.PI)).toFixed(0)} deg/s` : '0 deg/s',
            attackerDeltaOmega: imp.attackerDeltaOmega ? `${(imp.attackerDeltaOmega * (180 / Math.PI)).toFixed(0)} deg/s` : '0 deg/s',
            weaponRpmBefore: imp.weaponRpmBefore !== undefined ? `${imp.weaponRpmBefore.toFixed(0)}%` : 'N/A',
            weaponRpmAfter: imp.weaponRpmAfter !== undefined ? `${imp.weaponRpmAfter.toFixed(0)}%` : 'N/A',
            weaponEnergyBefore: imp.weaponEnergyBefore !== undefined ? `${imp.weaponEnergyBefore} J` : 'N/A',
            weaponEnergyAfter: imp.weaponEnergyAfter !== undefined ? `${imp.weaponEnergyAfter} J` : 'N/A',
            rawDamage: imp.rawDamage !== undefined ? imp.rawDamage : 'N/A',
            armorAbsorbed: imp.armorAbsorbed !== undefined ? imp.armorAbsorbed : 'N/A',
            componentDamage: imp.componentDamage !== undefined ? imp.componentDamage : 'N/A',
            finalDamage: imp.finalDamage !== undefined ? `${imp.finalDamage}%` : 'N/A',
            targetHealthBefore: imp.targetHealthBefore !== undefined ? `${imp.targetHealthBefore}%` : 'N/A',
            targetHealthAfter: imp.targetHealthAfter !== undefined ? `${imp.targetHealthAfter}%` : 'N/A',
            tractionBreak: imp.tractionBreakDurationSec ? `${Math.round(imp.tractionBreakDurationSec * 1000)} ms` : '0 ms',
          });
        }
      } else {
        const newest = sim.events[0];
        if (newest && newest.id !== lastEventIdRef.current) {
          lastEventIdRef.current = newest.id;
          if (newest.type === 'impact') {
            soundEngine.playImpact('heavy');
          }
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
          finalReport,
          null,
          null,
          false,
          sim.isFinalHitExecuted
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

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Punchy impact camera shake
    const shakeAmt = prefersReducedMotion ? 0 : sim.cameraImpactShake * 0.22;
    const shakeX = Math.sin(state.clock.elapsedTime * 65) * shakeAmt;
    const shakeY = Math.cos(state.clock.elapsedTime * 55) * shakeAmt;

    if (sim.isFinalHitExecuted) {
      // Dramatic Low-Angle Heroic Camera:
      // Glides low to the floor looking up past the student's victorious robot toward the disabled Bull
      const heroDist = 2.6;
      const heroCamHeight = 0.95;
      const targetCamX = sim.player.x - Math.sin(sim.player.headingRad) * heroDist + shakeX;
      const targetCamZ = sim.player.z - Math.cos(sim.player.headingRad) * heroDist + shakeY;
      camera.position.lerp(new THREE.Vector3(targetCamX, heroCamHeight, targetCamZ), delta * 4.0);
      camera.lookAt(midX, 0.45, midZ);
    } else if (battlePhase === 'tutorial' || battlePhase === 'countdown') {
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
      const targetPos = new THREE.Vector3(0 + shakeX, 9.2 + shakeY, 9.2);
      camera.position.lerp(targetPos, delta * 4);
      camera.lookAt(0, 0, 0);
    } else {
      // STABLE PLAYABLE GAMEPLAY CAMERA (Elevated chase with smooth damping following player)
      const behindDist = 4.4;
      const camHeight = 4.5;
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
        debris: [...debrisRef.current],
        isFinalHit: sim.isFinalHitExecuted,
        debugHitboxes: sim.debugHitboxes ? { ...sim.debugHitboxes } : undefined,
      });
      if (battlePhase === 'fighting' && !sim.isFinished) {
        onSyncHud(
          { ...sim.player },
          { ...sim.bull },
          sim.timeSec,
          [...sim.events],
          null,
          sim.lastImpactEvent,
          sim.lastWedgeTelemetry,
          sim.isCriticalState,
          sim.isFinalHitExecuted
        );
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
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 3.8]}>
          <ringGeometry args={[0.95, 1.05, 4]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.0} />
        </mesh>

        {/* Boss Starting Box (North) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, -3.8]}>
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

      {/* North Wall High-Impact Arena Poster Billboard */}
      <ArenaPosterBillboard
        teamProject={teamProject}
        playerConfig={playerConfig}
      />

      {/* Active Impact Directional Sparks & Procedural Debris */}
      {renderState.sparks.map((sp) => {
        const t = sp.age;
        const posX = sp.x + (sp.vx ?? 0) * t;
        const posY = Math.max(0.02, sp.y + (sp.vy ?? 0) * t - 0.5 * 9.8 * t * t);
        const posZ = sp.z + (sp.vz ?? 0) * t;
        const maxT = sp.maxAge ?? 0.35;
        const lifeRatio = Math.max(0, 1 - t / maxT);

        if (sp.isDebris) {
          return (
            <mesh
              key={sp.id}
              position={[posX, posY, posZ]}
              rotation={[t * 12, t * 15, 0]}
            >
              <boxGeometry args={[0.065, 0.025, 0.065]} />
              <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.3} />
            </mesh>
          );
        }

        const speed = Math.hypot(sp.vx ?? 0, sp.vz ?? 0);
        const streakLen = Math.max(0.08, Math.min(0.35, speed * 0.05 * lifeRatio));
        const angle = Math.atan2(sp.vx ?? 0, sp.vz ?? 0);

        return (
          <mesh
            key={sp.id}
            position={[posX, posY, posZ]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry args={[0.025, 0.025, streakLen]} />
            <meshStandardMaterial
              color={sp.color}
              emissive={sp.color}
              emissiveIntensity={2.8 * lifeRatio}
              transparent
              opacity={Math.min(1.0, lifeRatio * 1.5)}
            />
          </mesh>
        );
      })}

      {/* Subtle Cyan Driver Ring under Player Robot */}
      {pState && (
        <group position={[pState.x, 0.015, pState.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.54, 0.62, 32]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.85} />
          </mesh>
        </group>
      )}

      {/* Knockout Procedural Debris (Detached armor plate, broken wheel, hull fragments) */}
      {renderState.debris.map((p) => (
        <mesh
          key={p.id}
          position={[p.x, p.y, p.z]}
          rotation={[p.rotX, p.rotY, p.rotZ]}
          castShadow
        >
          {p.type === 'wheel' ? (
            <cylinderGeometry args={[p.size[0], p.size[1], p.size[2], 16]} />
          ) : (
            <boxGeometry args={p.size} />
          )}
          <meshStandardMaterial
            color={p.color}
            metalness={p.type === 'wheel' ? 0.2 : 0.8}
            roughness={p.type === 'wheel' ? 0.8 : 0.3}
          />
        </mesh>
      ))}

      {/* Student's Exact Assembled Robot3D */}
      <group ref={playerGroupRef} position={[0, 0, 3.8]} rotation={[0, Math.PI, 0]}>
        <Robot3D
          config={playerConfig}
          sponsor={
            teamProject?.projectLead?.activeSponsors?.[0] ||
            (teamProject?.projectLead?.sponsorTier && teamProject.projectLead.sponsorTier !== 'None'
              ? (getSponsorForTier(teamProject.projectLead.sponsorTier) as any)
              : null)
          }
          impactFlashIntensity={pState?.impactFlashIntensity ?? 0}
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

      {/* Active Boss Robot (Slumps and shuts down on finishing blow) */}
      <group
        ref={bullGroupRef}
        position={[0, 0, -3.8]}
        rotation={[
          renderState.isFinalHit ? -0.06 : 0,
          0,
          renderState.isFinalHit ? 0.16 : 0,
        ]}
      >
        <Robot3D
          config={bossDossier.config}
          bossId={bossId}
          impactFlashIntensity={bState?.impactFlashIntensity ?? 0}
          wheelSpeedRad={renderState.isFinalHit ? 0 : bState ? Math.hypot(bState.vx, bState.vz) * 6 : 0}
          weaponActive={battlePhase === 'fighting' && !renderState.isFinalHit}
          weaponSpinPct={renderState.isFinalHit ? 0 : (bState?.weaponSpinPct ?? 80)}
          weaponActuationPhase={bState?.weaponActuationPhase ?? 0}
          chassisPitchRad={(bState?.pitchRad ?? 0) + (renderState.isFinalHit ? -0.06 : 0)}
          chassisRollRad={(bState?.rollRad ?? 0) + (renderState.isFinalHit ? 0.16 : 0)}
          isFlipped={bState?.isFlipped ?? false}
          motorTempC={bState?.motorTempC ?? bossDossier.stats.expectedMotorTempC}
          damageState={
            bState
              ? {
                  frontArmorPct: renderState.isFinalHit ? 0 : bState.frontArmorPct,
                  sideArmorPct: renderState.isFinalHit ? Math.min(25, bState.sideArmorPct) : bState.sideArmorPct,
                  rearArmorPct: bState.rearArmorPct,
                  leftDrivePct: renderState.isFinalHit ? 0 : bState.leftDriveHealthPct,
                  rightDrivePct: renderState.isFinalHit ? 0 : bState.rightDriveHealthPct,
                  weaponPct: renderState.isFinalHit ? 0 : bState.weaponHealthPct,
                }
              : undefined
          }
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
  isDevMode = false,
  devRobotSource,
  devWeaponId,
  onDevChangeWeapon,
  onDevChangeRobotSource,
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

  const devDefaultLimiter = isDevMode && !teamProject?.electrical.currentLimiterA ? 120 : teamProject?.electrical.currentLimiterA;
  const [initialSim] = useState(() =>
    createBattleSimulation(
      playerConfig,
      'control',
      'bull',
      teamProject?.software.rules,
      devDefaultLimiter,
      coolingDrop,
      true
    )
  );
  const simRef = useRef<LiveBattleSimulation | null>(initialSim);

  const [hudPlayer, setHudPlayer] = useState<CombatantTelemetry>(() => initialSim.player);
  const [hudBull, setHudBull] = useState<CombatantTelemetry>(() => initialSim.bull);
  const [hudTimeSec, setHudTimeSec] = useState<number>(0);
  const [, setHudEvents] = useState<BattleEventLog[]>([]);
  const [hudLastImpact, setHudLastImpact] = useState<CombatImpactEvent | null>(null);
  const [hudLastWedge, setHudLastWedge] = useState<WedgeTelemetry | null>(null);
  const [hudIsCritical, setHudIsCritical] = useState<boolean>(false);
  const [hudIsFinalHit, setHudIsFinalHit] = useState<boolean>(false);
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

  useEffect(() => {
    if (battlePhase === 'tutorial') {
      const effectiveLimiter = isDevMode && !teamProject?.electrical.currentLimiterA ? 120 : teamProject?.electrical.currentLimiterA;
      simRef.current = createBattleSimulation(
        playerConfig,
        'control',
        'bull',
        teamProject?.software.rules,
        effectiveLimiter,
        coolingDrop,
        true
      );
      setHudPlayer(simRef.current.player);
      setHudBull(simRef.current.bull);
    }
  }, [playerConfig, battlePhase, coolingDrop, isDevMode, teamProject]);

  const handleStartBattle = (overrideConfig?: RobotConfiguration) => {
    soundEngine.playClick();
    const activeCfg = overrideConfig || playerConfig;
    const effectiveLimiter = isDevMode && !teamProject?.electrical.currentLimiterA ? 120 : teamProject?.electrical.currentLimiterA;
    simRef.current = createBattleSimulation(
      activeCfg,
      'control',
      'bull',
      teamProject?.software.rules,
      effectiveLimiter,
      coolingDrop,
      true
    );
    setHudPlayer(simRef.current.player);
    setHudBull(simRef.current.bull);
    setHudTimeSec(0);
    setHudEvents(simRef.current.events);
    setHudIsCritical(false);
    setHudIsFinalHit(false);
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
        <Canvas shadows camera={{ position: [0, 5.0, 8.2], fov: 46 }}>
          <Arena3DScene
            simRef={simRef}
            keyboardRef={keyboardRef}
            battlePhase={battlePhase}
            camMode={camMode}
            playerConfig={playerConfig}
            bossId={bossId}
            teamProject={teamProject}
            showHitboxes={showHitboxes}
            isDevMode={isDevMode}
            onSyncHud={(p, b, t, evs, rep, lastImp, lastWedge, isCrit, isFinal) => {
              setHudPlayer(p);
              setHudBull(b);
              setHudTimeSec(t);
              setHudEvents(evs);
              setHudIsCritical(!!isCrit);
              setHudIsFinalHit(!!isFinal);
              if (lastImp) {
                setHudLastImpact(lastImp);
              }
              if (lastWedge) {
                setHudLastWedge(lastWedge);
              }
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

      {/* Developer Mode Live Impact Telemetry HUD (Section 18) */}
      {isDevMode && (battlePhase === 'fighting' || battlePhase === 'countdown' || battlePhase === 'tutorial') && (
        <div className="absolute top-20 right-4 z-30 pointer-events-auto bg-slate-950/90 border border-amber-500/50 rounded-xl p-3 text-xs font-mono shadow-xl backdrop-blur max-w-xs">
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-1.5 mb-2">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              IMPACT TELEMETRY
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-300 pb-1 mb-1 border-b border-amber-500/20">
            <span>SPONSOR:</span>
            <span className="font-bold text-cyan-300">
              {teamProject?.projectLead?.activeSponsors?.[0]?.sponsorName || 'NONE (NO DECAL)'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] text-amber-300 uppercase font-bold">
              {hudLastImpact ? hudLastImpact.severity : 'STANDBY'}
            </span>
          </div>
          {/* Bull Combat Balance Telemetry (Section 22) */}
          <div className="mb-2 pb-2 border-b border-amber-500/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                BULL COMBAT STATUS
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                hudBull.wedgeCondition === 'critical' || hudBull.frontArmorPct < 20
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : hudBull.wedgeCondition === 'heavily-damaged' || hudBull.frontArmorPct < 45
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : hudBull.wedgeCondition === 'damaged' || hudBull.frontArmorPct < 75
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                WEDGE: {hudBull.wedgeCondition ?? (hudBull.frontArmorPct >= 75 ? 'HEALTHY' : hudBull.frontArmorPct >= 45 ? 'DAMAGED' : hudBull.frontArmorPct >= 20 ? 'HEAVILY DAMAGED' : 'CRITICAL')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <span className="text-slate-400">Total Health:</span>
              <span className="text-white font-bold">{bullOverallCondition}% (Hull: {hudBull.hullIntegrityPct.toFixed(0)}%)</span>
              <span className="text-slate-400">Wedge Armor:</span>
              <span className="text-amber-300 font-bold">{hudBull.frontArmorPct.toFixed(0)}% (Deform: {(hudBull.wedgeDeformationMm ?? (100 - hudBull.frontArmorPct) * 0.35).toFixed(0)}mm)</span>
              <span className="text-slate-400">Drive Condition:</span>
              <span className="text-cyan-300">L: {hudBull.leftDriveHealthPct.toFixed(0)}% | R: {hudBull.rightDriveHealthPct.toFixed(0)}%</span>
              <span className="text-slate-400">Traction:</span>
              <span className={hudBull.tractionBreakTimerSec > 0 ? "text-rose-400 font-bold animate-pulse" : "text-emerald-400 font-bold"}>
                {hudBull.tractionBreakTimerSec > 0 ? `SLIP (${(hudBull.tractionBreakTimerSec * 1000).toFixed(0)}ms)` : 'NOMINAL 100%'}
              </span>
            </div>
          </div>

          {hudLastImpact ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <span className="text-slate-400">Class:</span>
              <span className={`font-bold uppercase ${
                hudLastImpact.attackClassification === 'NEW_STRIKE' ? 'text-emerald-400' :
                hudLastImpact.attackClassification === 'SUSTAINED_CONTACT' ? 'text-amber-400' : 'text-sky-400'
              }`}>{hudLastImpact.attackClassification ?? 'NEW_STRIKE'}</span>
              <span className="text-slate-400">Attack Type:</span>
              <span className="text-white font-bold uppercase">{hudLastImpact.attackType ?? hudLastImpact.type} ({hudLastImpact.sourceRobot} → {hudLastImpact.targetRobot})</span>
              <span className="text-slate-400">Hit Sector:</span>
              <span className="text-emerald-300 font-bold uppercase">{hudLastImpact.hitSector ?? 'FRONT'}</span>
              <span className="text-slate-400">Severity:</span>
              <span className="text-purple-300 font-bold uppercase">IMP: {hudLastImpact.severity} | DMG: {hudLastImpact.damageSeverity ?? 'MOD'}</span>
              <span className="text-slate-400">Rel Speed:</span>
              <span className="text-white font-bold">{hudLastImpact.relativeVelocity.toFixed(2)} m/s</span>
              <span className="text-slate-400">Weapon RPM:</span>
              <span className="text-amber-300 font-bold">
                {hudLastImpact.weaponRpmBefore !== undefined ? `${hudLastImpact.weaponRpmBefore.toFixed(0)}% → ${hudLastImpact.weaponRpmAfter?.toFixed(0) ?? '?'}%` : 'N/A'}
              </span>
              <span className="text-slate-400">Weapon Energy:</span>
              <span className="text-amber-300 font-bold">
                {hudLastImpact.weaponEnergyBefore !== undefined ? `${hudLastImpact.weaponEnergyBefore}J → ${hudLastImpact.weaponEnergyAfter ?? 0}J` : hudLastImpact.weaponEnergyJ ? `${hudLastImpact.weaponEnergyJ}J` : 'N/A'}
              </span>
              <span className="text-slate-400">Raw / Absorbed:</span>
              <span className="text-amber-400 font-bold">
                {hudLastImpact.rawDamage !== undefined ? hudLastImpact.rawDamage.toFixed(1) : 'N/A'} / {hudLastImpact.armorAbsorbed !== undefined ? `${hudLastImpact.armorAbsorbed.toFixed(1)} abs` : '0 abs'}
              </span>
              <span className="text-slate-400">Comp / Final Dmg:</span>
              <span className="text-rose-400 font-bold">
                {hudLastImpact.componentDamage !== undefined ? `${hudLastImpact.componentDamage.toFixed(1)}c` : '0c'} | {hudLastImpact.finalDamage !== undefined ? `${hudLastImpact.finalDamage.toFixed(1)}%` : 'N/A'}
              </span>
              <span className="text-slate-400">Target Impulse:</span>
              <span className="text-cyan-300 font-bold">{hudLastImpact.impulse.toFixed(1)} N·s (ΔV: {hudLastImpact.targetDeltaV ?? 0}m/s)</span>
              <span className="text-slate-400">Attacker Recoil:</span>
              <span className="text-purple-300 font-bold">
                {hudLastImpact.attackerReactionImpulse !== undefined ? `${hudLastImpact.attackerReactionImpulse.toFixed(1)} N·s (ΔV: ${hudLastImpact.attackerDeltaV ?? 0}m/s)` : 'N/A'}
              </span>
              <span className="text-slate-400">Angular Impulse:</span>
              <span className="text-purple-300 font-bold">
                Tgt: {hudLastImpact.targetDeltaOmega !== undefined ? `${(hudLastImpact.targetDeltaOmega * (180 / Math.PI)).toFixed(0)}°/s` : '0°/s'} | Atk: {hudLastImpact.attackerDeltaOmega !== undefined ? `${(hudLastImpact.attackerDeltaOmega * (180 / Math.PI)).toFixed(0)}°/s` : '0°/s'}
              </span>
              <span className="text-slate-400">Traction Break:</span>
              <span className="text-rose-400 font-bold">{hudLastImpact.tractionBreakDurationSec !== undefined ? `${Math.round(hudLastImpact.tractionBreakDurationSec * 1000)} ms` : '0 ms'}</span>
              <span className="text-slate-400">Health Before/After:</span>
              <span className="text-white font-bold">
                {hudLastImpact.targetHealthBefore !== undefined ? `${hudLastImpact.targetHealthBefore.toFixed(1)}% → ${hudLastImpact.targetHealthAfter?.toFixed(1) ?? '?'}%` : 'N/A'}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 italic py-1">
              Awaiting first collision impact...
            </div>
          )}

          {/* Section 17 Wedge Engagement Telemetry */}
          {hudLastWedge && (
            <div className="mt-2.5 pt-2 border-t border-amber-500/30">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  Bull Wedge Dynamics
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  hudLastWedge.outcome === 'FLIP'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : hudLastWedge.outcome === 'RIDE_OVER'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : hudLastWedge.outcome === 'WEAPON_COUNTER'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : hudLastWedge.outcome === 'SIDE_DEFLECTION'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'bg-slate-500/20 text-slate-300 border border-slate-500/40'
                }`}>
                  {hudLastWedge.outcome}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                <span className="text-slate-400">Closing Speed:</span>
                <span className="text-white font-bold">{hudLastWedge.relativeClosingSpeed.toFixed(2)} m/s</span>
                <span className="text-slate-400">Player / Bull Fwd:</span>
                <span className="text-white">{hudLastWedge.playerFwdSpeed.toFixed(2)} / {hudLastWedge.bullFwdSpeed.toFixed(2)} m/s</span>
                <span className="text-slate-400">Contact Angle:</span>
                <span className="text-white">{hudLastWedge.contactAngleDeg.toFixed(0)}°</span>
                <span className="text-slate-400">Lateral Offset:</span>
                <span className="text-white">{hudLastWedge.contactLateralOffset.toFixed(2)} m</span>
                <span className="text-slate-400">Tangential / Norm:</span>
                <span className="text-cyan-300">{hudLastWedge.tangentialSpeed.toFixed(2)} / {hudLastWedge.normalSpeed.toFixed(2)}</span>
                <span className="text-slate-400">Pitch / Yaw Rate:</span>
                <span className="text-purple-300">{(hudLastWedge.playerPitchRad * (180 / Math.PI)).toFixed(0)}° / {(hudLastWedge.playerOmega * (180 / Math.PI)).toFixed(0)}°/s</span>
                <span className="text-slate-400">CoM / Stability:</span>
                <span className="text-emerald-400 font-bold">{hudLastWedge.playerCoM} ({hudLastWedge.playerStability})</span>
                <span className="text-slate-400">Weapon State:</span>
                <span className="text-amber-300 font-bold">{hudLastWedge.weaponActive ? `ACTIVE (${hudLastWedge.weaponRpmPct.toFixed(0)}%)` : 'IDLE'}</span>
              </div>
            </div>
          )}
        </div>
      )}

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
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
                    FINAL COMBAT ARENA
                  </div>
                  {isDevMode && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-300">
                      DEV MODE
                    </span>
                  )}
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
            {isDevMode && onDevChangeWeapon && onDevChangeRobotSource && (
              <div className="mb-5">
                <DevLoadoutCard
                  robotSource={devRobotSource || 'default'}
                  weaponId={devWeaponId || playerConfig.weaponId}
                  onChangeRobotSource={onDevChangeRobotSource}
                  onChangeWeapon={onDevChangeWeapon}
                  totalWeightLb={playerStats.totalWeightLb}
                  isOverweight={playerStats.isOverweight}
                  variant="pre-fight"
                  showEnterButton={false}
                />
              </div>
            )}

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
                onClick={() => handleStartBattle()}
                className="cursor-pointer inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-black text-base tracking-wide shadow-lg shadow-amber-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Swords className="w-5 h-5" />
                <span>START BATTLE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Arcade Critical State Banner (The Bull is Critical - Finish The Fight!) */}
      {battlePhase === 'fighting' && hudIsCritical && !hudIsFinalHit && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-bounce">
          <div className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-red-950/95 via-rose-900/95 to-red-950/95 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.7)] flex items-center gap-3 backdrop-blur-md">
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-red-300 font-black tracking-widest text-sm md:text-base uppercase font-mono">
              THE BULL IS CRITICAL!
            </span>
            <span className="text-amber-300 font-black text-sm md:text-base tracking-wider flex items-center gap-1">
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              FINISH THE FIGHT!
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
            </span>
          </div>
          <div className="text-[11px] text-amber-200/95 font-mono mt-1.5 bg-slate-950/90 px-3.5 py-1 rounded-full border border-amber-500/40 shadow-md">
            LAND FINAL HIT — WASD / SPACE
          </div>
        </div>
      )}

      {/* Triumphant Arcade Knockout Overlay */}
      {battlePhase === 'fighting' && hudIsFinalHit && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none">
          {/* Subtle cinematic radial vignette & flash */}
          <div className="absolute inset-0 bg-radial from-transparent via-amber-500/10 to-slate-950/75 pointer-events-none animate-in fade-in duration-300" />

          <div className="relative z-10 flex flex-col items-center text-center animate-in zoom-in-75 duration-300 px-4">
            <div className="text-6xl md:text-8xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-400 to-amber-600 drop-shadow-[0_0_40px_rgba(245,158,11,0.85)] uppercase">
              KNOCKOUT!
            </div>
            <div className="mt-3 text-xl md:text-3xl font-extrabold tracking-widest text-cyan-300 uppercase font-mono drop-shadow-[0_0_20px_rgba(6,182,212,0.7)]">
              {teamProject?.teamName || 'YOUR TEAM'} DEFEATED THE BULL
            </div>
            <div className="mt-3 text-sm md:text-base font-bold text-slate-200 tracking-wide font-mono bg-slate-950/90 px-5 py-1.5 rounded-full border border-cyan-500/50 shadow-lg">
              YOUR ENGINEERING DESIGN WORKED
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

            {isDevMode && (
              <div className="flex items-center gap-1.5">
                {onDevChangeWeapon && (
                  <div className="flex items-center gap-1 bg-slate-900 border border-amber-500/50 rounded-lg px-2 py-0.5">
                    <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">DEV WEAPON:</span>
                    <select
                      value={devWeaponId || playerConfig.weaponId}
                      onChange={(e) => {
                        const newWId = e.target.value as WeaponId;
                        onDevChangeWeapon(newWId);
                        const updatedCfg: RobotConfiguration = { ...playerConfig, weaponId: newWId, customWeapon: null };
                        handleStartBattle(updatedCfg);
                      }}
                      className="cursor-pointer bg-transparent text-amber-300 font-mono font-bold text-xs focus:outline-none"
                      title="Switch Dev Weapon and Reset Battle"
                    >
                      {DEV_AVAILABLE_WEAPONS.map((spec) => (
                        <option key={spec.id} value={spec.id} className="bg-slate-900 text-amber-300">
                          {formatWeaponOptionLabel(spec)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    handleStartBattle();
                  }}
                  className="cursor-pointer px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 flex items-center gap-1.5 shadow-sm shadow-amber-500/20"
                  title="Developer Mode: Reset battle state instantly"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>RESET TEST BATTLE</span>
                </button>
              </div>
            )}
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
