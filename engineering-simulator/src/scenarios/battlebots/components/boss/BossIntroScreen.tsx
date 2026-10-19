import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { CheckCircle2, Flame, Lock, Shield, Sparkles, Swords, Weight, Wrench, Zap } from 'lucide-react';
import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { soundEngine } from '../../audio/soundEngine';
import { BOSS_LADDER, getBossById } from '../../data/bosses';
import { type BossDossier, type BossId } from '../../types/robot';
import { Robot3D } from '../three/Robot3D';

interface BossIntroScreenProps {
  initialStep: 'welcome' | 'boss-intro';
  unlockedIndex: number;
  selectedBossId: BossId;
  onSelectBoss: (bossId: BossId) => void;
  onEnterWorkshop: () => void;
}

const Boss3DPreviewScene: React.FC<{ boss: BossDossier }> = ({ boss }) => {
  const bossGroupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!bossGroupRef.current) return;
    // Gentle idle rotation to showcase full 3D silhouette and materials
    const t = state.clock.elapsedTime * 0.45;
    bossGroupRef.current.rotation.y = Math.sin(t) * 0.35;
  });

  return (
    <>
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 6, 17]} />

      <OrbitControls
        enablePan={false}
        minDistance={2.4}
        maxDistance={5.8}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />

      {/* High-visibility 3D lighting */}
      <ambientLight intensity={0.92} color="#f8fafc" />
      <directionalLight
        castShadow
        position={[4.5, 7.5, 5]}
        intensity={2.3}
        color="#ffffff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-4, 5, -3.5]} intensity={1.2} color="#94a3b8" />
      <pointLight position={[-3.5, 3.2, -3]} intensity={2.4} color="#38bdf8" />
      <pointLight position={[3.5, 3, -3]} intensity={2.0} color="#f59e0b" />

      {/* Lit Industrial Turntable Floor */}
      <group position={[0, -0.02, 0]}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
          <planeGeometry args={[22, 22]} />
          <meshStandardMaterial color="#1e2638" metalness={0.35} roughness={0.65} />
        </mesh>
        <mesh receiveShadow position={[0, -0.03, 0]}>
          <cylinderGeometry args={[2.0, 2.15, 0.08, 48]} />
          <meshStandardMaterial color="#2d3748" metalness={0.55} roughness={0.4} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[1.82, 1.9, 48]} />
          <meshStandardMaterial
            color={boss.config.accentColor}
            emissive={boss.config.accentColor}
            emissiveIntensity={1.3}
          />
        </mesh>
      </group>

      {/* Selected Boss 3D Mesh */}
      <group ref={bossGroupRef} position={[0, 0, 0]}>
        <Robot3D
          config={boss.config}
          bossId={boss.id}
          wheelSpeedRad={8}
          motorTempC={boss.stats.expectedMotorTempC}
        />
      </group>
    </>
  );
};

export const BossIntroScreen: React.FC<BossIntroScreenProps> = ({
  initialStep,
  unlockedIndex,
  selectedBossId,
  onSelectBoss,
  onEnterWorkshop,
}) => {
  const [step, setStep] = useState<'welcome' | 'boss-intro'>(initialStep);
  const activeBoss = getBossById(selectedBossId);

  return (
    <div className="relative w-full h-full bg-[#0b0f19] overflow-hidden flex flex-col justify-between">
      {/* 3D Viewport */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [2.8, 1.95, 3.1], fov: 42 }}>
          <Boss3DPreviewScene boss={activeBoss} />
        </Canvas>
      </div>

      {/* Subtle vignette gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-transparent to-[#0b0f19]/80 z-10" />

      {step === 'welcome' ? (
        /* ============================================================
           STEP 1: WELCOME INTRO OVERLAY
           ============================================================ */
        <div className="relative z-20 flex-1 flex items-center justify-center p-6">
          <div className="holo-panel holo-glow-cyan max-w-2xl w-full p-8 md:p-10 rounded-3xl border border-cyan-500/40 text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-mono-num uppercase tracking-widest mb-4">
              <Sparkles className="w-3.5 h-3.5" /> BESA Robotics Lab • 30 LB Class
            </div>

            <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">
              BATTLEBOT INCUBATOR
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 max-w-lg mx-auto">
              Engineer an autonomous combat robot under a strict{' '}
              <strong className="text-cyan-300">30.0 lb weight constraint</strong>. Ascend the Boss Ladder
              by analyzing mechanical tradeoffs in weapon energy, armor, traction, and drive agility.
            </p>

            <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto mb-8">
              {['BUILD.', 'TEST.', 'BATTLE.', 'ITERATE.'].map((word, i) => (
                <div
                  key={word}
                  className="rounded-xl bg-slate-900/90 border border-slate-700/80 py-3 px-2 font-display font-bold text-sm md:text-base tracking-wider text-cyan-300"
                >
                  <span className="block text-[10px] font-mono-num text-slate-500 mb-0.5">
                    0{i + 1}
                  </span>
                  {word}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                soundEngine.playClick();
                soundEngine.playImpact('medium');
                setStep('boss-intro');
              }}
              className="cursor-pointer inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-lg tracking-wide shadow-lg shadow-amber-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Swords className="w-5 h-5" />
              INSPECT THE BOSS LADDER →
            </button>
          </div>
        </div>
      ) : (
        /* ============================================================
           STEP 2: BOSS LADDER DOSSIER & 3D INSPECTOR
           ============================================================ */
        <>
          {/* Top Boss Navigation Bar */}
          <div className="relative z-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-6 pt-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-mono-num uppercase tracking-widest mb-1">
                <Flame className="w-3.5 h-3.5" /> Tier {activeBoss.tier} Combatant Dossier
              </div>
              <h1 className="font-display text-3xl md:text-5xl font-black tracking-tight text-white flex items-center gap-2">
                <span>{activeBoss.icon}</span> {activeBoss.name}
              </h1>
            </div>

            {/* Boss Ladder Selector Pills */}
            <div className="holo-panel rounded-2xl border border-slate-800 p-1.5 flex flex-wrap items-center gap-1.5">
              {BOSS_LADDER.map((boss, idx) => {
                const isUnlocked = idx <= unlockedIndex;
                const isSelected = boss.id === selectedBossId;
                return (
                  <button
                    key={boss.id}
                    disabled={!isUnlocked}
                    onClick={() => {
                      soundEngine.playClick();
                      onSelectBoss(boss.id);
                    }}
                    className={`cursor-pointer px-3 py-2 rounded-xl text-xs font-display font-bold flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                        : isUnlocked
                        ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                        : 'bg-slate-950/70 text-slate-600 border border-slate-900 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span>{boss.icon}</span>
                    <span className="hidden sm:inline">0{boss.tier}</span>
                    <span>{boss.name.replace('THE ', '')}</span>
                    {idx < unlockedIndex && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />}
                    {!isUnlocked && <Lock className="w-3 h-3 text-slate-600 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Observation HUD + Telemetry Breakdown */}
          <div className="relative z-20 px-6 pb-6 flex flex-col lg:flex-row items-end justify-between gap-4">
            <div className="holo-panel holo-glow-amber rounded-2xl border border-amber-500/35 p-5 max-w-3xl w-full">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-mono-num uppercase tracking-widest text-amber-300 font-semibold">
                  INTERACTIVE 3D DOSSIER — DRAG TO ROTATE & SCOUT
                </span>
                <span className="text-xs font-mono-num text-slate-400">
                  WEIGHT: {activeBoss.weightLb} LB
                </span>
              </div>

              {/* 4 Real-Unit Boss Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs font-mono-num">
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-400" /> FRONT ARMOR
                  </div>
                  <div className="font-bold text-slate-100 mt-0.5">
                    {activeBoss.stats.frontArmorScore} PTS
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" /> WEAPON POWER
                  </div>
                  <div className="font-bold text-amber-300 mt-0.5">
                    {activeBoss.stats.weaponEnergyJ.toLocaleString()} J
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Weight className="w-3 h-3 text-amber-400" /> PUSHING FORCE
                  </div>
                  <div className="font-bold text-slate-100 mt-0.5">
                    {activeBoss.stats.pushingForceN} N
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> TURN RATE
                  </div>
                  <div className="font-bold text-slate-100 mt-0.5">
                    {activeBoss.stats.turningRateDegPerSec}°/S
                  </div>
                </div>
              </div>

              {/* Strengths & Vulnerabilities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs mb-2.5">
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-2.5">
                  <div className="text-[10px] font-mono-num text-emerald-400 font-bold uppercase mb-1">
                    MECHANICAL STRENGTHS
                  </div>
                  <ul className="space-y-0.5 text-slate-300">
                    {activeBoss.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-emerald-400">✓</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-2.5">
                  <div className="text-[10px] font-mono-num text-amber-400 font-bold uppercase mb-1">
                    EXPLOITABLE TRADEOFFS
                  </div>
                  <ul className="space-y-0.5 text-slate-300">
                    {activeBoss.vulnerabilities.map((v, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-amber-400">!</span> {v}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Engineering Lesson Callout */}
              <div className="text-[11px] text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>Engineering Objective:</strong> {activeBoss.engineeringLesson}
                </span>
              </div>
            </div>

            {/* Right Action Box */}
            <div className="holo-panel rounded-2xl border border-cyan-500/40 p-5 flex flex-col items-start lg:items-end justify-between shrink-0 w-full lg:w-72">
              <div className="text-xs font-mono-num uppercase tracking-widest text-cyan-300 mb-1">
                COMBAT LAB
              </div>
              <div className="font-display text-base font-extrabold text-white mb-3">
                READY TO ENGINEER YOUR ROBOT?
              </div>
              <button
                onClick={() => {
                  soundEngine.playInstall();
                  onEnterWorkshop();
                }}
                className="cursor-pointer w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-display font-extrabold text-sm tracking-wide shadow-lg shadow-cyan-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                ENTER ROBOT WORKSHOP →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
