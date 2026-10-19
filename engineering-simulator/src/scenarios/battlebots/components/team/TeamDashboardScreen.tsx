import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Cpu,
  RotateCcw,
  ShieldAlert,
  Swords,
  Wrench,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import { ARMOR_CATALOG, CHASSIS_CATALOG, WEAPON_CATALOG } from '../../data/components';
import {
  computeTeamEngineeringSummary,
  validateSystemIntegration,
} from '../../simulation/integrationValidator';
import {
  type RobotConfiguration,
  type SystemIntegrationReport,
  type TeamRobotProject,
  type TeamRole,
} from '../../types/robot';
import { Robot3D } from '../three/Robot3D';
import { ResetProjectModal } from './ResetProjectModal';
import { SystemIntegrationModal } from './SystemIntegrationModal';

interface TeamDashboardScreenProps {
  project: TeamRobotProject;
  onSelectRole: (role: TeamRole) => void;
  onEnterArena: () => void;
  onResetProject: () => void;
  hideHeader?: boolean;
}

export const TeamDashboardScreen: React.FC<TeamDashboardScreenProps> = ({
  project,
  onSelectRole,
  onEnterArena,
  onResetProject,
  hideHeader = false,
}) => {
  const [showResetModal, setShowResetModal] = useState(false);
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);

  const summary = computeTeamEngineeringSummary(project);
  const integrationReport: SystemIntegrationReport = validateSystemIntegration(project);

  const currentRobotConfig: RobotConfiguration = {
    name: project.teamName,
    chassisId: project.mechanical.chassisId,
    driveId: project.mechanical.driveId,
    wheelsId: project.mechanical.wheelsId,
    armorId: project.mechanical.armorId,
    armorThickness: project.mechanical.armorThickness,
    weaponId: project.mechanical.weaponId,
    batteryId: project.electrical.batteryId,
    utilityId: project.mechanical.utilityId,
    accentColor: project.mechanical.accentColor,
    customWeapon: null,
    customUtility: null,
  };

  const handleRunIntegration = () => {
    soundEngine.playClick();
    if (integrationReport.overallPassed) {
      soundEngine.playArenaHorn();
    } else {
      soundEngine.playWarning();
    }
    setShowIntegrationModal(true);
  };

  const allRolesMarkedDone =
    project.mechanical.isCompleted &&
    project.electrical.isCompleted &&
    project.software.isCompleted &&
    project.projectLead.isCompleted;

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden flex flex-col justify-between font-sans">
      {/* 3D Turntable Background Canvas (Clean Studio Lighting) */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [2.6, 1.85, 2.9], fov: 42 }}>
          <color attach="background" args={['#e2e8f0']} />
          <fog attach="fog" args={['#e2e8f0', 6.5, 15]} />
          <OrbitControls
            enablePan={false}
            minDistance={2.0}
            maxDistance={5.2}
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI / 2 - 0.05}
            autoRotate
            autoRotateSpeed={0.8}
          />

          <ambientLight intensity={1.1} color="#ffffff" />
          <directionalLight
            castShadow
            position={[5, 8, 6]}
            intensity={2.2}
            color="#ffffff"
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <directionalLight position={[-4, 4.5, -3.5]} intensity={1.0} color="#94a3b8" />
          <pointLight position={[-3.5, 3, -3]} intensity={1.8} color="#0284c7" />
          <pointLight position={[3.5, 2.8, -3]} intensity={1.5} color="#d97706" />

          {/* Turntable platform */}
          <group position={[0, -0.02, 0]}>
            <mesh receiveShadow position={[0, -0.03, 0]}>
              <cylinderGeometry args={[2.0, 2.15, 0.08, 48]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.5} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
              <ringGeometry args={[1.82, 1.9, 48]} />
              <meshStandardMaterial
                color={project.mechanical.accentColor || '#0284c7'}
                emissive={project.mechanical.accentColor || '#0284c7'}
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>

          <group position={[0, 0, 0]}>
            <Robot3D
              config={currentRobotConfig}
              wheelSpeedRad={0}
              motorTempC={summary.stats.expectedMotorTempC}
            />
          </group>
        </Canvas>
      </div>

      {/* Top Header Bar (Shown only if not in Shell) */}
      {!hideHeader && (
        <div className="relative z-20 p-4 md:px-6 flex items-center justify-between pointer-events-auto bg-white/80 backdrop-blur-xs border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-800 font-bold">
                BESA Engineering Lab • Combat Robotics
              </span>
            </div>
            <h1 className="font-display font-black text-2xl md:text-3xl text-slate-900 tracking-tight">
              {project.teamName}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono shadow-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">TOTAL MASS</span>
                <span className={`font-bold ${summary.isOverweight ? 'text-rose-600 font-extrabold' : 'text-slate-800'}`}>
                  {summary.totalWeightLb.toFixed(1)} / 30.0 LB
                </span>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">PROJECT COST</span>
                <span className={`font-bold ${summary.isOverBudget ? 'text-rose-600 font-extrabold' : 'text-slate-800'}`}>
                  ${summary.totalCostUsd} / ${summary.effectiveBudgetUsd}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              title="Reset Project for next team"
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Reset Project</span>
            </button>
          </div>
        </div>
      )}

      {/* Middle Spacer for 3D View */}
      <div className="flex-1 pointer-events-none" />

      {/* Bottom Engineering Deck: 4 Discipline Cards + Integration Console */}
      <div className="relative z-20 p-4 md:p-5 bg-gradient-to-t from-slate-100 via-slate-100/95 to-transparent flex flex-col gap-3">
        {/* 4 Collaborative Roles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Mechanical */}
          <div
            onClick={() => {
              soundEngine.playClick();
              onSelectRole('mechanical');
            }}
            className="cursor-pointer rounded-2xl border border-slate-200 hover:border-cyan-500/80 p-3.5 bg-white hover:bg-slate-50 transition-all transform hover:-translate-y-0.5 shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
                  <Wrench className="w-4 h-4" />
                </div>
                <span className="font-display font-extrabold text-sm text-slate-900 tracking-wide">
                  MECHANICAL
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  project.mechanical.isCompleted
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                    : 'bg-cyan-50 border-cyan-200 text-cyan-800'
                }`}
              >
                {project.mechanical.isCompleted ? 'COMPLETE' : 'IN PROGRESS'}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Chassis & Weapon:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[130px]">
                  {CHASSIS_CATALOG[project.mechanical.chassisId]?.name} •{' '}
                  {WEAPON_CATALOG[project.mechanical.weaponId as Exclude<typeof project.mechanical.weaponId, 'custom-weapon'>]?.name ?? 'CUSTOM'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Armor:</span>
                <span className="font-semibold text-slate-800">
                  {ARMOR_CATALOG[project.mechanical.armorId]?.name} ({project.mechanical.armorThickness.toUpperCase()})
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-cyan-700">
              <span>CONFIGURE MACHINE</span>
              <span>→</span>
            </div>
          </div>

          {/* 2. Electrical */}
          <div
            onClick={() => {
              soundEngine.playClick();
              onSelectRole('electrical');
            }}
            className="cursor-pointer rounded-2xl border border-slate-200 hover:border-amber-500/80 p-3.5 bg-white hover:bg-slate-50 transition-all transform hover:-translate-y-0.5 shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="font-display font-extrabold text-sm text-slate-900 tracking-wide">
                  ELECTRICAL
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  project.electrical.isCompleted
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {project.electrical.isCompleted ? 'COMPLETE' : 'IN PROGRESS'}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Wiring Harness:</span>
                <span
                  className={`font-semibold ${
                    project.electrical.wiringVerified ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {project.electrical.wiringVerified ? 'VERIFIED ✓' : 'INCOMPLETE ✕'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Power System:</span>
                <span
                  className={`font-semibold ${
                    project.electrical.wiringVerified ? 'text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {project.electrical.wiringVerified ? 'ONLINE (100%)' : 'STANDBY'}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-amber-700">
              <span>WIRE & POWER</span>
              <span>→</span>
            </div>
          </div>

          {/* 3. Software */}
          <div
            onClick={() => {
              soundEngine.playClick();
              onSelectRole('software');
            }}
            className="cursor-pointer rounded-2xl border border-slate-200 hover:border-indigo-500/80 p-3.5 bg-white hover:bg-slate-50 transition-all transform hover:-translate-y-0.5 shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Cpu className="w-4 h-4" />
                </div>
                <span className="font-display font-extrabold text-sm text-slate-900 tracking-wide">
                  SOFTWARE
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  project.software.isCompleted
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                }`}
              >
                {project.software.isCompleted ? 'COMPLETE' : 'IN PROGRESS'}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Hardware Link:</span>
                <span
                  className={`font-semibold ${
                    project.software.computerConnected ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {project.software.computerConnected ? 'CONNECTED ✓' : 'UNCONNECTED ✕'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Autonomous Code:</span>
                <span
                  className={`font-semibold ${
                    project.software.softwareUploaded
                      ? 'text-emerald-700'
                      : project.software.bugsFixed
                      ? 'text-cyan-700'
                      : 'text-amber-700'
                  }`}
                >
                  {project.software.softwareUploaded
                    ? 'UPLOADED ✓'
                    : project.software.bugsFixed
                    ? 'READY TO UPLOAD'
                    : 'BUGS DETECTED'}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-indigo-700">
              <span>DEBUG & UPLOAD</span>
              <span>→</span>
            </div>
          </div>

          {/* 4. Business Lead */}
          <div
            onClick={() => {
              soundEngine.playClick();
              onSelectRole('project-lead');
            }}
            className="cursor-pointer rounded-2xl border border-slate-200 hover:border-emerald-500/80 p-3.5 bg-white hover:bg-slate-50 transition-all transform hover:-translate-y-0.5 shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Briefcase className="w-4 h-4" />
                </div>
                <span className="font-display font-extrabold text-sm text-slate-900 tracking-wide">
                  BUSINESS LEAD
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  project.projectLead.isCompleted
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {project.projectLead.isCompleted ? 'COMPLETE' : 'IN PROGRESS'}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Budget Spent:</span>
                <span
                  className={`font-semibold ${
                    summary.isOverBudget ? 'text-rose-600' : 'text-slate-800'
                  }`}
                >
                  ${summary.totalCostUsd} / ${summary.effectiveBudgetUsd}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Sponsorship:</span>
                <span className="font-semibold text-emerald-700 uppercase">
                  {project.projectLead.sponsorTier !== 'None'
                    ? `${project.projectLead.sponsorTier} (+$${project.projectLead.sponsorshipUsd})`
                    : 'NO SPONSOR (+$0)'}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-emerald-700">
              <span>PROMPT & SPONSOR</span>
              <span>→</span>
            </div>
          </div>
        </div>

        {/* Central Integration Gatekeeper Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                integrationReport.overallPassed
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : integrationReport.failures.length > 0
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-cyan-50 border-cyan-200 text-cyan-700'
              }`}
            >
              {integrationReport.overallPassed ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : integrationReport.failures.length > 0 ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                SYSTEM INTEGRATION STATUS
              </div>
              <div className="font-display font-extrabold text-sm md:text-base text-slate-900">
                {integrationReport.overallPassed
                  ? 'PASSED — ALL 4 DISCIPLINES CERTIFIED'
                  : integrationReport.failures.length > 0
                  ? `INTEGRATION CONFLICTS: ${integrationReport.failures.length} ISSUE(S) DETECTED`
                  : allRolesMarkedDone
                  ? 'ALL DISCIPLINES COMPLETE — READY FOR SYSTEM INTEGRATION CHECK'
                  : 'DISCIPLINES IN PROGRESS — INTEGRATION TEST AVAILABLE'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRunIntegration}
              className={`cursor-pointer px-5 py-2.5 rounded-xl text-xs font-display font-bold tracking-wide transition-all ${
                integrationReport.overallPassed
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
              }`}
            >
              Run Integration Check
            </button>

            {integrationReport.overallPassed && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playArenaHorn();
                  onEnterArena();
                }}
                className="cursor-pointer inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-display font-black text-xs md:text-sm tracking-wider shadow-lg shadow-red-600/25 animate-pulse transition-all transform hover:scale-102"
              >
                <Swords className="w-4 h-4" />
                Enter Combat Arena →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Integration Modal */}
      <SystemIntegrationModal
        isOpen={showIntegrationModal}
        project={project}
        report={integrationReport}
        onClose={() => setShowIntegrationModal(false)}
        onEnterArena={() => {
          setShowIntegrationModal(false);
          onEnterArena();
        }}
        onSelectRole={(role) => {
          setShowIntegrationModal(false);
          onSelectRole(role);
        }}
      />

      {/* Reset Project Modal */}
      <ResetProjectModal
        isOpen={showResetModal}
        onConfirmReset={() => {
          setShowResetModal(false);
          onResetProject();
        }}
        onClose={() => setShowResetModal(false)}
      />
    </div>
  );
};
