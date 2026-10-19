import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  CheckCircle2,
  Compass,
  Lightbulb,
  Package,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { soundEngine } from '../../../audio/soundEngine';
import {
  type ComponentCategory,
  type PurchasedMechanicalPart,
  type RobotConfiguration,
  type TeamRobotProject,
} from '../../../types/robot';
import { Robot3D } from '../../three/Robot3D';
import { BlueprintModal } from './BlueprintModal';

interface AssemblyWorkbenchProps {
  project: TeamRobotProject;
  purchasedParts: PurchasedMechanicalPart[];
  assembledCategories: string[];
  onMountPart: (category: ComponentCategory) => void;
  onUnmountPart: (category: ComponentCategory) => void;
  onRunInspection: () => void;
  onReturnToMarketplace: () => void;
}

export const AssemblyWorkbench: React.FC<AssemblyWorkbenchProps> = ({
  project,
  purchasedParts,
  assembledCategories,
  onMountPart,
  onUnmountPart,
  onRunInspection,
  onReturnToMarketplace,
}) => {
  const [selectedTrayCategory, setSelectedTrayCategory] = useState<ComponentCategory | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showBlueprint, setShowBlueprint] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [activeHint, setActiveHint] = useState<{ title: string; text: string } | null>(null);
  const [draggedCategory, setDraggedCategory] = useState<ComponentCategory | null>(null);

  const mech = project.mechanical;

  // Mount sequence validator
  const canMountCategory = (cat: ComponentCategory): { allowed: boolean; reason?: string } => {
    if (cat === 'chassis') {
      return { allowed: true };
    }
    if (!assembledCategories.includes('chassis')) {
      return {
        allowed: false,
        reason: '⚠ MOUNTING POINT NOT AVAILABLE: Central chassis frame must be anchored before installing internal systems.',
      };
    }
    if (cat === 'wheels' || cat === 'armor' || cat === 'weapon') {
      if (!assembledCategories.includes('drive')) {
        return {
          allowed: false,
          reason: '⚠ MOUNTING POINT NOT AVAILABLE: Internal drive motor package must be secured inside chassis prior to wheel/armor installation.',
        };
      }
    }
    return { allowed: true };
  };

  const handleAttemptMount = (cat: ComponentCategory) => {
    const check = canMountCategory(cat);
    if (!check.allowed) {
      soundEngine.playWarning();
      setErrorMessage(check.reason || 'Mounting point not available');
      return;
    }

    soundEngine.playInstall();
    setErrorMessage(null);
    setSelectedTrayCategory(null);
    onMountPart(cat);
  };

  const handleGetHint = () => {
    soundEngine.playClick();
    setHintsUsed((prev) => prev + 1);

    // Determine current unmounted step
    if (!assembledCategories.includes('chassis')) {
      setActiveHint(
        hintsUsed % 2 === 0
          ? {
              title: 'HINT 1 — STRUCTURAL FOUNDATION',
              text: 'Every combat robot begins with the chassis tub. It provides attachment hardpoints for all other systems.',
            }
          : {
              title: 'HINT 2 — BLUEPRINT CLUE',
              text: 'Mount your chassis frame into the center of the turntable workspace first.',
            }
      );
      return;
    }

    if (!assembledCategories.includes('drive')) {
      setActiveHint(
        hintsUsed % 2 === 0
          ? {
              title: 'HINT 1 — INTERNAL PROPULSION',
              text: 'Internal motor pods mount into the central bay of the chassis before outer wheels and armor are bolted on.',
            }
          : {
              title: 'HINT 2 — BLUEPRINT CLUE',
              text: 'Inspect [2] INTERNAL DRIVE MOTORS on your blueprint and secure the motor drivetrain package.',
            }
      );
      return;
    }

    if (!assembledCategories.includes('wheels')) {
      setActiveHint({
        title: 'HINT — MOBILITY ATTACHMENT',
        text: 'Attach your purchased wheels or tracks to the outer axle shafts on the sides of the chassis.',
      });
      return;
    }

    if (!assembledCategories.includes('armor')) {
      setActiveHint({
        title: 'HINT — PERIMETER PROTECTION',
        text: 'Fasten your armor plates onto the perimeter structural rails to enclose the internal electronics.',
      });
      return;
    }

    if (!assembledCategories.includes('weapon')) {
      setActiveHint({
        title: 'HINT — OFFENSIVE HARDPOINT',
        text: 'Bolt your front weapon assembly onto the forward bulkhead hardpoint indicated by the [▲ FRONT] arrow on your blueprint.',
      });
      return;
    }

    setActiveHint({
      title: 'ASSEMBLY COMPLETE',
      text: 'All purchased systems are installed! Click [RUN MECHANICAL INSPECTION] to verify mass and clearances.',
    });
  };

  const previewConfig: RobotConfiguration = {
    name: project.teamName,
    chassisId: mech.chassisId,
    driveId: mech.driveId,
    wheelsId: mech.wheelsId,
    armorId: mech.armorId,
    armorThickness: mech.armorThickness,
    weaponId: mech.weaponId,
    batteryId: project.electrical.batteryId,
    utilityId: mech.utilityId,
    accentColor: mech.accentColor,
    customWeapon: null,
    customUtility: null,
  };

  const requiredCategories: ComponentCategory[] = ['chassis', 'drive', 'wheels', 'armor', 'weapon'];
  const allRequiredMounted = requiredCategories.every((cat) => assembledCategories.includes(cat));

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 md:p-6 overflow-hidden min-h-0 text-white font-mono-num relative">
      {/* Center / Left: 3D Turntable Workspace */}
      <div className="flex-1 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-2xl">
        {/* Top Workspace Toolbar */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 z-10 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              MOUNTED HARDWARE: <strong className="text-cyan-400">{assembledCategories.length} / 5</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400/80" />
              HINTS USED: <strong className={hintsUsed > 0 ? 'text-amber-300' : 'text-slate-400'}>{hintsUsed}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundEngine.playClick();
                setShowBlueprint(true);
              }}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>📐 VIEW BLUEPRINT</span>
            </button>

            <button
              onClick={handleGetHint}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-colors"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>GET HINT</span>
            </button>

            <button
              onClick={onReturnToMarketplace}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>SWAP IN BOTBAY</span>
            </button>
          </div>
        </div>

        {/* Warning / Error Banner */}
        {errorMessage && (
          <div className="mt-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 flex items-start justify-between gap-3 z-10 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Hint Banner */}
        {activeHint && (
          <div className="mt-2 p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-start justify-between gap-3 text-xs z-10 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block text-[11px] tracking-wide uppercase">
                  {activeHint.title}
                </span>
                <p className="text-slate-200 mt-0.5 leading-relaxed">{activeHint.text}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveHint(null)}
              className="cursor-pointer text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3D Canvas Area */}
        <div
          className="relative flex-1 w-full min-h-[380px] my-2 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border border-slate-900"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedCategory) {
              handleAttemptMount(draggedCategory);
              setDraggedCategory(null);
            }
          }}
        >
          <Canvas shadows camera={{ position: [2.6, 2.0, 3.0], fov: 42 }}>
            <color attach="background" args={['#060a14']} />
            <fog attach="fog" args={['#060a14', 6, 15]} />
            <OrbitControls
              enablePan={false}
              minDistance={1.8}
              maxDistance={5.2}
              minPolarAngle={0.25}
              maxPolarAngle={Math.PI / 2 - 0.05}
            />
            <ambientLight intensity={0.9} color="#f8fafc" />
            <directionalLight castShadow position={[4.5, 7, 5]} intensity={2.2} color="#ffffff" />
            <directionalLight position={[-4, 4.5, -3.5]} intensity={1.1} color="#94a3b8" />
            <pointLight position={[-3, 2.5, -2.5]} intensity={2.0} color="#22d3ee" />

            {/* Turntable Floor */}
            <group position={[0, -0.02, 0]}>
              <mesh receiveShadow position={[0, -0.03, 0]}>
                <cylinderGeometry args={[2.0, 2.15, 0.08, 48]} />
                <meshStandardMaterial color="#172033" metalness={0.5} roughness={0.5} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
                <ringGeometry args={[1.82, 1.9, 48]} />
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={1.0} />
              </mesh>
            </group>

            {/* 3D Robot Assembly Model */}
            <group position={[0, 0, 0]}>
              <Robot3D
                config={previewConfig}
                assembledCategories={assembledCategories}
                wheelSpeedRad={0}
                motorTempC={42}
              />
            </group>
          </Canvas>

          {/* Interactive Mount Hotspot Overlay Bar (Touch/Click Friendly) */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2 pointer-events-auto">
            {selectedTrayCategory && (
              <div className="px-4 py-2 rounded-xl bg-cyan-950/90 border border-cyan-400 text-xs text-white shadow-xl flex items-center gap-3 animate-pulse">
                <span>
                  Selected: <strong className="text-cyan-300 uppercase">{selectedTrayCategory}</strong>
                </span>
                <button
                  onClick={() => handleAttemptMount(selectedTrayCategory)}
                  className="cursor-pointer px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold uppercase"
                >
                  MOUNT ONTO ROBOT
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Status / Instructions */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between z-10 text-xs text-slate-400">
          <span>
            Drag parts from tray onto turntable or click a part to select & mount. Follow blueprint sequence.
          </span>

          {allRequiredMounted && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onRunInspection();
              }}
              className="cursor-pointer inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-display font-black text-sm bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 active:scale-95"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>RUN MECHANICAL INSPECTION</span>
            </button>
          )}
        </div>
      </div>

      {/* Right Column: Parts Tray & Assembly Checklist */}
      <div className="w-full lg:w-80 flex flex-col gap-3">
        {/* Parts Tray */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl text-xs font-mono-num flex-1">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-400" />
                PARTS TRAY
              </span>
              <span className="text-[10px] text-slate-400 uppercase">PURCHASED HARDWARE</span>
            </div>

            {/* List of Purchased Parts in Tray */}
            <div className="space-y-2 mb-4">
              {purchasedParts.map((part) => {
                const isMounted = assembledCategories.includes(part.category);
                const isSelected = selectedTrayCategory === part.category;

                return (
                  <div
                    key={part.category}
                    draggable={!isMounted}
                    onDragStart={() => setDraggedCategory(part.category)}
                    onClick={() => {
                      if (!isMounted) {
                        soundEngine.playClick();
                        setSelectedTrayCategory(part.category);
                      }
                    }}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      isMounted
                        ? 'bg-slate-900/40 border-slate-800/80 text-slate-500 opacity-75'
                        : isSelected
                        ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-md cursor-pointer'
                        : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-500 text-slate-200 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-cyan-400 uppercase font-bold">
                        {part.category}
                      </span>
                      {isMounted ? (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> MOUNTED
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-300 font-bold">IN TRAY</span>
                      )}
                    </div>

                    <div className="font-bold text-[11px] truncate text-slate-100 mb-1">
                      {part.name}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{part.condition.toUpperCase()} • {part.weightLb} lb</span>
                      {isMounted ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            soundEngine.playClick();
                            onUnmountPart(part.category);
                          }}
                          className="text-rose-400 hover:text-rose-300 underline cursor-pointer"
                        >
                          Unmount
                        </button>
                      ) : (
                        <span className="text-cyan-400 font-bold">CLICK OR DRAG</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assembly Checklist */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <span className="text-[10px] text-cyan-400 font-bold uppercase block mb-1">
              ROBOT ASSEMBLY STATUS
            </span>
            {[
              { id: 'chassis', label: 'Chassis frame anchored' },
              { id: 'drive', label: 'Drive system installed' },
              { id: 'wheels', label: 'Wheels & traction mounted' },
              { id: 'armor', label: 'Armor panels fastened' },
              { id: 'weapon', label: 'Front weapon bulkhead secured' },
            ].map((step) => {
              const isChecked = assembledCategories.includes(step.id);
              return (
                <div key={step.id} className="flex items-center gap-2 text-xs text-slate-300">
                  {isChecked ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                  )}
                  <span className={isChecked ? 'text-slate-200 line-through opacity-80' : 'text-slate-400'}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Blueprint Modal */}
      <BlueprintModal
        isOpen={showBlueprint}
        onClose={() => setShowBlueprint(false)}
        teamName={project.teamName}
        config={{
          chassisId: mech.chassisId,
          driveId: mech.driveId,
          wheelsId: mech.wheelsId,
          armorId: mech.armorId,
          weaponId: mech.weaponId,
          utilityId: mech.utilityId,
        }}
      />
    </div>
  );
};
