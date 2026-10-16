import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Flame, Shield, Sparkles, Swords, Weight, Zap } from 'lucide-react';
import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { soundEngine } from '../../audio/soundEngine';
import { INITIAL_ROBOT_CONFIG, THE_BULL_CONFIG } from '../../data/components';
import { Robot3D } from '../three/Robot3D';

interface BossIntroScreenProps {
  initialStep: 'welcome' | 'boss-intro';
  onEnterWorkshop: () => void;
}

// Live autonomous demonstration: The Bull charging, ramming, and launching a generic test drone,
// then slowly turning around so students can observe both its frontal dominance and slow yaw turn.
const BullDemoScene: React.FC = () => {
  const bullGroupRef = useRef<THREE.Group>(null);
  const dummyGroupRef = useRef<THREE.Group>(null);
  const sparkRef = useRef<THREE.Group>(null);
  const [wheelSpin, setWheelSpin] = useState(14);
  const [dummyFlipped, setDummyFlipped] = useState(false);

  useFrame((state) => {
    const t = state.clock.elapsedTime % 7.5; // 7.5-second repeating autonomous demo loop

    if (!bullGroupRef.current || !dummyGroupRef.current) return;

    if (t < 1.8) {
      // Phase 1: Face-off & Bull spools up torque drive
      const chargeProgress = Math.max(0, (t - 0.5) / 1.3);
      bullGroupRef.current.position.set(0, 0, -1.8 + chargeProgress * 1.45);
      bullGroupRef.current.rotation.set(0, 0, 0);
      dummyGroupRef.current.position.set(0, 0, 0.5 - chargeProgress * 0.35);
      dummyGroupRef.current.rotation.set(0, Math.PI, 0);
      if (dummyFlipped) setDummyFlipped(false);
      if (sparkRef.current) sparkRef.current.visible = false;
    } else if (t < 3.4) {
      // Phase 2: Massive frontal ramming impact! The Bull shoves and flips the test bot
      const ramProgress = (t - 1.8) / 1.6;
      bullGroupRef.current.position.set(0, 0, -0.35 + ramProgress * 1.85);
      bullGroupRef.current.rotation.set(-0.05, 0, 0);

      dummyGroupRef.current.position.set(
        ramProgress * 0.45,
        Math.sin(ramProgress * Math.PI) * 0.48,
        0.15 + ramProgress * 2.15
      );
      dummyGroupRef.current.rotation.set(
        ramProgress * 2.2,
        Math.PI + ramProgress * 1.4,
        ramProgress * Math.PI
      );
      if (!dummyFlipped && ramProgress > 0.5) setDummyFlipped(true);
      if (sparkRef.current) {
        sparkRef.current.visible = ramProgress < 0.65;
        sparkRef.current.position.set(0, 0.35, -0.1 + ramProgress * 1.5);
        sparkRef.current.rotation.y = t * 20;
      }
    } else {
      // Phase 3: The Bull executes a slow, wide heavy turn back to starting position
      // (visibly demonstrating its slower turning speed and side/rear silhouette!)
      const turnProgress = (t - 3.4) / 4.1;
      const angle = turnProgress * Math.PI * 2;
      bullGroupRef.current.position.set(
        Math.sin(angle) * 0.85,
        0,
        THREE.MathUtils.lerp(1.5, -1.8, turnProgress)
      );
      bullGroupRef.current.rotation.set(0, angle, 0);
      if (sparkRef.current) sparkRef.current.visible = false;
      if (wheelSpin !== 14) setWheelSpin(14);
    }
  });

  return (
    <>
      <color attach="background" args={['#06090f']} />
      <fog attach="fog" args={['#06090f', 5.5, 16]} />

      <OrbitControls
        enablePan={false}
        minDistance={2.8}
        maxDistance={6.5}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />

      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[4, 7, 4]}
        intensity={1.7}
        color="#fef3c7"
      />
      <pointLight position={[-3.5, 2.5, -2]} intensity={1.2} color="#f59e0b" />
      <pointLight position={[3.5, 2.5, 2]} intensity={1.0} color="#38bdf8" />

      {/* Arena Demo Floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0b101b" metalness={0.7} roughness={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0]}>
        <ringGeometry args={[2.55, 2.65, 48]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.1} />
      </mesh>

      {/* Impact Sparks */}
      <group ref={sparkRef} visible={false}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const ang = (i * Math.PI) / 4;
          return (
            <mesh
              key={i}
              position={[Math.cos(ang) * 0.3, 0.15, Math.sin(ang) * 0.3]}
              rotation={[ang, ang, 0]}
            >
              <boxGeometry args={[0.04, 0.04, 0.28]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#f59e0b"
                emissiveIntensity={2.5}
              />
            </mesh>
          );
        })}
      </group>

      {/* THE BULL Boss Robot */}
      <group ref={bullGroupRef} position={[0, 0, -1.2]}>
        <Robot3D
          config={THE_BULL_CONFIG}
          isBullBoss={true}
          wheelSpeedRad={wheelSpin}
          motorTempC={68}
        />
      </group>

      {/* Generic Test Drone getting bulldozed */}
      <group ref={dummyGroupRef} position={[0, 0, 0.6]} rotation={[0, Math.PI, 0]}>
        <Robot3D
          config={{
            ...INITIAL_ROBOT_CONFIG,
            chassisId: 'compact',
            armorId: 'polycarbonate',
            weaponId: 'wedge',
            accentColor: '#64748b',
          }}
          wheelSpeedRad={-8}
          isFlipped={dummyFlipped}
        />
      </group>
    </>
  );
};

export const BossIntroScreen: React.FC<BossIntroScreenProps> = ({
  initialStep,
  onEnterWorkshop,
}) => {
  const [step, setStep] = useState<'welcome' | 'boss-intro'>(initialStep);

  return (
    <div className="relative w-full h-full bg-[#06090f] overflow-hidden flex flex-col justify-between">
      {/* Live 3D Background Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [3.2, 2.15, 3.3], fov: 42 }}>
          <BullDemoScene />
        </Canvas>
      </div>

      {/* Subtle vignette gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06090f] via-transparent to-[#06090f]/80 z-10" />

      {step === 'welcome' ? (
        /* ============================================================
           STEP 1: FIRST-RUN WELCOME OVERLAY
           ============================================================ */
        <div className="relative z-20 flex-1 flex items-center justify-center p-6">
          <div className="holo-panel holo-glow-cyan max-w-2xl w-full rounded-2xl border border-cyan-500/35 p-8 md:p-10 text-center animate-pop-in">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-mono-num tracking-widest uppercase mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Interactive Combat Robotics Challenge
            </div>

            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
              WELCOME TO THE{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-300">
                BATTLEBOT INCUBATOR
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-200 font-medium mb-3">
              Your challenge: Engineer a combat robot under{' '}
              <span className="text-cyan-300 font-bold font-mono-num">30.0 LB</span> that can
              defeat <span className="text-amber-400 font-bold">The Bull</span>.
            </p>

            <p className="text-sm md:text-base text-slate-400 max-w-xl mx-auto mb-7">
              There is no single &ldquo;best&rdquo; robot. Every advantage comes with a physical
              tradeoff in mass, power, traction, stability, or heat.
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
              MEET THE BULL
            </button>
          </div>
        </div>
      ) : (
        /* ============================================================
           STEP 2: THE BULL — BOSS INTRODUCTION & LIVE DEMO
           ============================================================ */
        <>
          {/* Top Boss Banner */}
          <div className="relative z-20 flex items-center justify-between px-6 pt-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-mono-num uppercase tracking-widest mb-1">
                <Flame className="w-3.5 h-3.5" /> Arena Champion Specimen
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight text-white">
                THE BULL
              </h1>
            </div>

            <div className="holo-panel rounded-xl border border-amber-500/30 px-4 py-2.5 text-right">
              <div className="text-[11px] font-mono-num uppercase tracking-wider text-slate-400">
                CHAMPION WEIGHT
              </div>
              <div className="font-mono-num text-2xl font-bold text-amber-400">
                29.8 / 30.0 LB
              </div>
            </div>
          </div>

          {/* Bottom Observation HUD + CTA */}
          <div className="relative z-20 px-6 pb-6 flex flex-col md:flex-row items-end justify-between gap-4">
            <div className="holo-panel holo-glow-amber rounded-2xl border border-amber-500/35 p-5 max-w-2xl w-full">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono-num uppercase tracking-widest text-amber-300 font-semibold">
                  LIVE AUTONOMOUS OBSERVATION — DRAG TO INSPECT 3D MODEL
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-amber-400" /> FRONT PLOW
                  </div>
                  <div className="font-mono-num text-sm font-bold text-slate-100 mt-0.5">
                    THICK AR500 STEEL
                  </div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> PUSHING FORCE
                  </div>
                  <div className="font-mono-num text-sm font-bold text-slate-100 mt-0.5">
                    174 N (HIGH TORQUE)
                  </div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Weight className="w-3.5 h-3.5 text-amber-400" /> TRACTION
                  </div>
                  <div className="font-mono-num text-sm font-bold text-slate-100 mt-0.5">
                    CLEATED HIGH-GRIP
                  </div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> MANEUVERABILITY
                  </div>
                  <div className="font-mono-num text-sm font-bold text-slate-100 mt-0.5">
                    94°/S (HEAVY YAW)
                  </div>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Watch how <strong className="text-amber-300">The Bull</strong> obliterates light
                targets head-on with its thick sloped steel plow and high-traction drive, then
                observe how it rotates and where its heavy armor is concentrated.
              </p>
            </div>

            <div className="holo-panel rounded-2xl border border-cyan-500/40 p-5 flex flex-col items-start md:items-end justify-between shrink-0 w-full md:w-auto">
              <div className="text-xs font-mono-num uppercase tracking-widest text-cyan-300 mb-1">
                YOUR MISSION
              </div>
              <div className="font-display text-lg font-extrabold text-white mb-3">
                ENGINEER SOMETHING THAT CAN BEAT IT.
              </div>
              <button
                onClick={() => {
                  soundEngine.playInstall();
                  onEnterWorkshop();
                }}
                className="cursor-pointer w-full md:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-display font-extrabold text-base tracking-wide shadow-lg shadow-cyan-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
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
