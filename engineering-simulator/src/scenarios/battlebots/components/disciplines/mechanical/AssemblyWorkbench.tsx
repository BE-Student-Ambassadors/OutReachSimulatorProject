import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  CheckCircle2,
  Compass,
  GripVertical,
  Lightbulb,
  Package,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { soundEngine } from '../../../audio/soundEngine';
import {
  type ComponentCategory,
  type PurchasedMechanicalPart,
  type RobotConfiguration,
  type TeamRobotProject,
} from '../../../types/robot';
import { Robot3D } from '../../three/Robot3D';
import { BlueprintModal } from './BlueprintModal';
import { PartArt } from './PartArt';

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
  const [isDragHovering, setIsDragHovering] = useState(false);

  const mech = project.mechanical;

  // Sequence of 6 categories: 1. Chassis, 2. Drive, 3. Wheels, 4. Armor, 5. Weapon, 6. Utility
  const activeGhostCategory = useMemo<ComponentCategory | null>(() => {
    if (draggedCategory && !assembledCategories.includes(draggedCategory)) {
      return draggedCategory;
    }
    const sequence: ComponentCategory[] = ['chassis', 'drive', 'wheels', 'armor', 'weapon', 'utility'];
    for (const cat of sequence) {
      if (!assembledCategories.includes(cat)) {
        if (cat === 'utility') {
          const hasUtil = purchasedParts.some((p) => p.category === 'utility');
          if (!hasUtil) continue;
        }
        return cat;
      }
    }
    return null;
  }, [assembledCategories, draggedCategory, purchasedParts]);

  // Mount sequence validator
  const canMountCategory = (cat: ComponentCategory): { allowed: boolean; reason?: string } => {
    if (cat === 'chassis') {
      return { allowed: true };
    }
    if (!assembledCategories.includes('chassis')) {
      return {
        allowed: false,
        reason: '⚠ Mounting Point Not Ready: Central chassis frame must be anchored before installing internal systems.',
      };
    }
    if (cat === 'wheels' || cat === 'armor' || cat === 'weapon') {
      if (!assembledCategories.includes('drive')) {
        return {
          allowed: false,
          reason: '⚠ Mounting Point Not Ready: Internal drive motor package must be secured inside chassis prior to wheel/armor installation.',
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
              title: 'HINT 2 — ASSEMBLY SEQUENCE',
              text: 'Click or drag your purchased Chassis onto the turntable to establish the main structural frame.',
            }
      );
      return;
    }

    if (!assembledCategories.includes('drive')) {
      setActiveHint({
        title: 'HINT — POWERTRAIN FIRST',
        text: 'The drive motor system sits deep within the chassis channels. Mount the drive before putting on outer wheels and armor plates.',
      });
      return;
    }

    const remainingUnmounted = ['wheels', 'armor', 'weapon'].filter(
      (c) => !assembledCategories.includes(c)
    );
    if (remainingUnmounted.length > 0) {
      const nextTarget = remainingUnmounted[0].toUpperCase();
      setActiveHint({
        title: 'HINT — EXTERIOR HARDWARE',
        text: `The drive train is locked in. Now install your ${nextTarget} onto the outer hardpoints.`,
      });
      return;
    }

    setActiveHint({
      title: 'HINT — ASSEMBLY COMPLETE',
      text: 'All primary hardware is secured! Click "Run Mechanical Inspection" below to verify weight limits and structural clearance.',
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
    <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 md:p-5 overflow-hidden min-h-0 text-slate-800 font-sans relative">
      {/* Center / Left: 3D Turntable Workspace */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-xs">
        {/* Top Workspace Toolbar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 z-10 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-slate-500">
              Hardware Installed: <strong className="text-cyan-700 font-mono">{assembledCategories.length} / 5</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              Hints used: <strong className={hintsUsed > 0 ? 'text-amber-700 font-mono' : 'text-slate-400'}>{hintsUsed}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setShowBlueprint((prev) => !prev);
              }}
              className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                showBlueprint
                  ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs ring-2 ring-cyan-500/20'
                  : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-200'
              }`}
              title="Toggle full robot blueprint silhouette"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{showBlueprint ? 'Blueprint Active ✓' : 'Blueprint'}</span>
            </button>

            <button
              type="button"
              onClick={handleGetHint}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
              <span>Hint</span>
            </button>

            <button
              type="button"
              onClick={onReturnToMarketplace}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>BotBay Catalog</span>
            </button>
          </div>
        </div>

        {/* Warning / Error Banner */}
        {errorMessage && (
          <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start justify-between gap-3 z-10 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hint Banner */}
        {activeHint && (
          <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-3 text-xs z-10 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900 block text-[11px] tracking-wide uppercase">
                  {activeHint.title}
                </span>
                <p className="text-amber-950 mt-0.5 leading-relaxed">{activeHint.text}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveHint(null)}
              className="cursor-pointer text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-amber-100/50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3D Canvas Area */}
        <div
          className={`relative flex-1 w-full min-h-[360px] my-2 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing border transition-all ${
            isDragHovering
              ? 'border-cyan-400 ring-4 ring-cyan-400/20 bg-gradient-to-b from-cyan-50/40 to-slate-200'
              : 'border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isDragHovering) setIsDragHovering(true);
          }}
          onDragLeave={() => setIsDragHovering(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragHovering(false);
            if (draggedCategory) {
              handleAttemptMount(draggedCategory);
              setDraggedCategory(null);
            }
          }}
        >
          <Canvas shadows camera={{ position: [2.6, 2.0, 3.0], fov: 42 }}>
            <color attach="background" args={['#e2e8f0']} />
            <fog attach="fog" args={['#e2e8f0', 7, 16]} />
            <OrbitControls
              enablePan={false}
              minDistance={1.8}
              maxDistance={5.2}
              minPolarAngle={0.25}
              maxPolarAngle={Math.PI / 2 - 0.05}
            />
            <ambientLight intensity={1.1} color="#ffffff" />
            <directionalLight castShadow position={[5, 8, 6]} intensity={2.0} color="#ffffff" />
            <directionalLight position={[-4, 4.5, -3.5]} intensity={0.9} color="#94a3b8" />
            <pointLight position={[-3, 2.5, -2.5]} intensity={1.5} color="#38bdf8" />

            {/* Turntable Floor with Target Reticle */}
            <group position={[0, -0.02, 0]}>
              <mesh receiveShadow position={[0, -0.03, 0]}>
                <cylinderGeometry args={[2.0, 2.15, 0.08, 48]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.3} roughness={0.6} />
              </mesh>
              {/* Outer Cyan Ring */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
                <ringGeometry args={[1.82, 1.9, 48]} />
                <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.6} />
              </mesh>
              {/* Magnetic Snap Reticle (Pulsing when hovering or target active) */}
              {activeGhostCategory && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
                  <ringGeometry args={[1.4, 1.48, 48]} />
                  <meshStandardMaterial
                    color="#00f0ff"
                    emissive="#00f0ff"
                    emissiveIntensity={isDragHovering ? 2.5 : 1.0}
                    transparent
                    opacity={isDragHovering ? 0.95 : 0.6}
                  />
                </mesh>
              )}
            </group>

            {/* 3D Robot Assembly Model with Visual Placement Ghosts */}
            <group position={[0, 0, 0]}>
              <Robot3D
                config={previewConfig}
                assembledCategories={assembledCategories}
                ghostMode={true}
                activeGhostCategory={activeGhostCategory}
                isTargetHovered={isDragHovering}
                showFullBlueprint={showBlueprint}
                wheelSpeedRad={0}
                motorTempC={42}
                sponsor={project.projectLead.activeSponsors?.[0] || null}
              />
            </group>
          </Canvas>

          {/* Interactive Mount Hotspot Overlay Bar (Touch/Click Friendly) */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2 pointer-events-auto">
            {selectedTrayCategory && (
              <div className="px-4 py-2 rounded-xl bg-white border border-cyan-400 text-xs text-slate-800 shadow-xl flex items-center gap-3">
                <span>
                  Selected: <strong className="text-cyan-800 uppercase">{selectedTrayCategory}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleAttemptMount(selectedTrayCategory)}
                  className="cursor-pointer px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase"
                >
                  Mount onto Robot
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Status / Instructions */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between z-10 text-xs text-slate-500">
          <span>
            Drag parts from tray onto turntable or click a part to select & mount. Follow blueprint sequence.
          </span>

          {allRequiredMounted && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onRunInspection();
              }}
              className="cursor-pointer inline-flex items-center gap-2 px-5 py-2 rounded-xl font-display font-black text-xs uppercase bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 transition-all active:scale-98"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Run Mechanical Inspection</span>
            </button>
          )}
        </div>
      </div>

      {/* Right Column: Parts Tray & Assembly Checklist */}
      <div className="w-full lg:w-80 flex flex-col gap-3 shrink-0">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs text-xs font-sans flex-1">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <span className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-600" />
                Workshop Parts Tray
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Ready to Mount</span>
            </div>

            {/* List of Purchased Parts in Tray */}
            <div className="space-y-2 mb-4">
              {purchasedParts.map((part) => {
                const isMounted = assembledCategories.includes(part.category);
                const isSelected = selectedTrayCategory === part.category;
                const isDraggingThis = draggedCategory === part.category;

                return (
                  <div
                    key={part.category}
                    draggable={!isMounted}
                    onDragStart={() => setDraggedCategory(part.category)}
                    onDragEnd={() => setDraggedCategory(null)}
                    onClick={() => {
                      if (!isMounted) {
                        soundEngine.playClick();
                        setSelectedTrayCategory(part.category);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-xs transition-all duration-150 select-none ${
                      isMounted
                        ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-75'
                        : isDraggingThis
                        ? 'bg-cyan-50 border-cyan-400 ring-2 ring-cyan-400/40 opacity-50 scale-98 cursor-grabbing shadow-lg'
                        : isSelected
                        ? 'bg-cyan-50 border-cyan-400 text-cyan-900 shadow-sm ring-2 ring-cyan-400/30 -translate-y-0.5 cursor-grab active:cursor-grabbing'
                        : 'bg-white border-slate-200 hover:border-cyan-400 hover:ring-2 hover:ring-cyan-400/20 hover:-translate-y-1 hover:shadow-md text-slate-700 cursor-grab active:cursor-grabbing shadow-xs group'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Drag Grip Handle on unmounted parts */}
                      {!isMounted && (
                        <div
                          className="flex items-center text-slate-300 group-hover:text-cyan-600 transition-colors shrink-0"
                          title="Click and drag onto turntable to mount"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                      )}

                      <div className="size-10 rounded-lg bg-slate-100 border border-slate-200 grid place-items-center shrink-0 p-1">
                        <PartArt category={part.category} partId={part.partId} className="w-full h-full" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-cyan-700 uppercase font-bold">
                            {part.category}
                          </span>
                          {isMounted ? (
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Mounted
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 font-medium">In tray</span>
                          )}
                        </div>

                        <div className="font-semibold text-xs truncate text-slate-900 leading-tight">
                          {part.name}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                          <span>{part.condition.toUpperCase()} • {part.weightLb} lb</span>
                          {isMounted ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                soundEngine.playClick();
                                onUnmountPart(part.category);
                              }}
                              className="text-rose-600 hover:text-rose-700 font-sans font-semibold underline cursor-pointer"
                            >
                              Unmount
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-sans font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 group-hover:bg-cyan-100 group-hover:border-cyan-300 px-1.5 py-0.5 rounded shadow-2xs transition-colors">
                              <GripVertical className="w-2.5 h-2.5" /> DRAG
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assembly Checklist */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
              Assembly Progress
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
                <div key={step.id} className="flex items-center gap-2 text-xs">
                  {isChecked ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                  )}
                  <span className={isChecked ? 'text-slate-400 line-through' : 'text-slate-600'}>
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
