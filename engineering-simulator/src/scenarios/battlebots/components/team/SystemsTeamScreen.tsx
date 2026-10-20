import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Swords,
  XCircle,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import {
  computeTeamEngineeringSummary,
  validateSystemIntegration,
} from '../../simulation/integrationValidator';
import {
  type ComponentCategory,
  type RobotConfiguration,
  type SystemIntegrationReport,
  type TeamRobotProject,
  type TeamRole,
} from '../../types/robot';
import { Robot3D } from '../three/Robot3D';

interface SystemsTeamScreenProps {
  project: TeamRobotProject;
  onEnterArena: () => void;
  onReturnToTeam: () => void;
  onSelectRole: (role: TeamRole) => void;
}

export const SystemsTeamScreen: React.FC<SystemsTeamScreenProps> = ({
  project,
  onEnterArena,
  onReturnToTeam,
  onSelectRole,
}) => {
  const summary = computeTeamEngineeringSummary(project);
  const report: SystemIntegrationReport = validateSystemIntegration(project);

  const currentRobotConfig: RobotConfiguration = useMemo(() => ({
    name: project.teamName,
    chassisId: project.mechanical.chassisId,
    driveId: project.mechanical.driveId,
    wheelsId: project.mechanical.wheelsId,
    armorId: project.mechanical.armorId,
    armorThickness: project.mechanical.armorThickness,
    weaponId: project.mechanical.weaponId,
    batteryId: project.electrical.batteryId,
    utilityId: project.mechanical.utilityId || 'none',
    accentColor: project.mechanical.accentColor || '#0284c7',
    customWeapon: null,
    customUtility: null,
    autonomousStrategy:
      project.software.approach === 'flank'
        ? 'aggressive'
        : project.software.approach === 'careful'
        ? 'control'
        : 'aggressive',
  }), [project]);

  const assembledCategories: ComponentCategory[] = useMemo(() => {
    if (project.mechanical.isCompleted) {
      return ['chassis', 'drive', 'wheels', 'armor', 'weapon', 'utility'];
    }
    return (project.mechanical.assembledParts as ComponentCategory[]) || ['chassis', 'drive', 'wheels'];
  }, [project.mechanical]);

  return (
    <div className="relative w-full h-full bg-slate-100 flex flex-col justify-between font-sans overflow-hidden select-none">
      {/* 1. Minimal Header */}
      <div className="relative z-20 px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-xs border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onReturnToTeam();
          }}
          className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 shadow-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Team Home</span>
        </button>

        <div className="text-center">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
            Systems & Team
          </span>
          <h1 className="font-display font-black text-lg text-slate-900 leading-tight">
            Robot Verification
          </h1>
        </div>

        <div className="w-24 text-right">
          <span className="font-mono text-xs font-bold text-slate-700">
            {summary.totalWeightLb.toFixed(1)} lb
          </span>
        </div>
      </div>

      {/* 2. Main 3D Canvas with Center Robot */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [2.5, 1.8, 2.7], fov: 42 }}>
          <color attach="background" args={['#f1f5f9']} />
          <ambientLight intensity={1.1} />
          <directionalLight position={[5, 8, 6]} intensity={1.8} castShadow />
          <directionalLight position={[-4, 4, -3]} intensity={0.6} />

          {/* Clean Turntable Platform */}
          <group position={[0, -0.02, 0]}>
            <mesh receiveShadow position={[0, -0.03, 0]}>
              <cylinderGeometry args={[2.0, 2.15, 0.08, 48]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.5} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
              <ringGeometry args={[1.82, 1.9, 48]} />
              <meshStandardMaterial
                color={report.overallPassed ? '#10b981' : '#f59e0b'}
                emissive={report.overallPassed ? '#10b981' : '#f59e0b'}
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>

          <group position={[0, 0, 0]}>
            <Robot3D
              config={currentRobotConfig}
              assembledCategories={assembledCategories}
              wheelSpeedRad={0}
            />
          </group>

          <OrbitControls
            enablePan={false}
            minDistance={1.8}
            maxDistance={4.8}
            maxPolarAngle={Math.PI / 2 - 0.05}
            autoRotate
            autoRotateSpeed={0.7}
          />
        </Canvas>
      </div>

      {/* 3. Around the Robot: The 4 Discipline Status Chips */}
      <div className="relative z-10 p-6 flex flex-wrap items-center justify-center gap-3 pointer-events-none mt-2">
        {[
          { label: 'Mechanical', pass: project.mechanical.isCompleted, role: 'mechanical' as TeamRole },
          { label: 'Electrical', pass: project.electrical.isCompleted, role: 'electrical' as TeamRole },
          { label: 'Software', pass: project.software.isCompleted, role: 'software' as TeamRole },
          { label: 'Business', pass: project.projectLead.isCompleted, role: 'project-lead' as TeamRole },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelectRole(item.role)}
            className={`pointer-events-auto px-4 py-2 rounded-2xl border text-xs font-display font-bold flex items-center gap-2 shadow-xs transition-all ${
              item.pass
                ? 'bg-white/90 border-emerald-400 text-emerald-900 shadow-emerald-500/10'
                : 'bg-white/90 border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span
              className={`size-5 rounded-full flex items-center justify-center text-xs ${
                item.pass ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-200 text-slate-500'
              }`}
            >
              {item.pass ? '✓' : '●'}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Middle Spacer for 3D View */}
      <div className="flex-1 pointer-events-none" />

      {/* 4. Bottom Gatekeeper Card */}
      <div className="relative z-20 p-6 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg bg-white/95 backdrop-blur-md border border-slate-200 rounded-3xl p-6 shadow-xl text-center">
          {report.overallPassed ? (
            /* ROBOT READY */
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold font-mono mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>ALL CHECKS PASSED</span>
              </div>
              <h2 className="font-display font-black text-2xl text-slate-900 tracking-tight mb-4">
                ROBOT READY
              </h2>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playArenaHorn();
                  onEnterArena();
                }}
                className="cursor-pointer w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-display font-black text-sm uppercase tracking-wider shadow-lg shadow-red-600/25 transition-all transform active:scale-98 flex items-center justify-center gap-2"
              >
                <Swords className="w-5 h-5" />
                <span>Enter The Arena</span>
              </button>
            </div>
          ) : (
            /* ROBOT NOT READY */
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold font-mono mb-2">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>INTEGRATION CHECK</span>
              </div>
              <h2 className="font-display font-black text-2xl text-slate-900 tracking-tight mb-2">
                ROBOT NOT READY
              </h2>

              {/* Show ONLY Failed Conditions */}
              <div className="space-y-1.5 my-4 text-left font-mono text-xs">
                {summary.isOverweight && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
                    <span className="font-bold">⚠ Weight:</span>
                    <span>{summary.totalWeightLb.toFixed(1)} / 30.0 lb</span>
                  </div>
                )}
                {summary.isOverBudget && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
                    <span className="font-bold">⚠ Budget:</span>
                    <span>${summary.totalCostUsd} / ${summary.effectiveBudgetUsd}</span>
                  </div>
                )}
                {report.failures.map((f, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <span className="text-[11px] leading-snug">{f}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onReturnToTeam();
                }}
                className="cursor-pointer w-full py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-display font-bold text-xs uppercase tracking-wider transition-colors"
              >
                Return to Team
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
