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
}

export const TeamDashboardScreen: React.FC<TeamDashboardScreenProps> = ({
  project,
  onSelectRole,
  onEnterArena,
  onResetProject,
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
    <div className="relative w-full h-full bg-[#080d1a] overflow-hidden flex flex-col justify-between">
      {/* 3D Turntable Background Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [2.6, 1.85, 2.9], fov: 42 }}>
          <color attach="background" args={['#080d1a']} />
          <fog attach="fog" args={['#080d1a', 5.5, 14]} />
          <OrbitControls
            enablePan={false}
            minDistance={2.0}
            maxDistance={5.2}
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI / 2 - 0.05}
            autoRotate
            autoRotateSpeed={0.8}
          />

          <ambientLight intensity={0.9} color="#f8fafc" />
          <directionalLight
            castShadow
            position={[4.5, 7, 5]}
            intensity={2.2}
            color="#ffffff"
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <directionalLight position={[-4, 4.5, -3.5]} intensity={1.1} color="#94a3b8" />
          <pointLight position={[-3.5, 3, -3]} intensity={2.0} color="#38bdf8" />
          <pointLight position={[3.5, 2.8, -3]} intensity={1.8} color="#f59e0b" />

          {/* Turntable platform */}
          <group position={[0, -0.02, 0]}>
            <mesh receiveShadow position={[0, -0.03, 0]}>
              <cylinderGeometry args={[2.0, 2.15, 0.08, 48]} />
              <meshStandardMaterial color="#1e2638" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
              <ringGeometry args={[1.82, 1.9, 48]} />
              <meshStandardMaterial
                color={project.mechanical.accentColor}
                emissive={project.mechanical.accentColor}
                emissiveIntensity={1.2}
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

      {/* Top Header Bar */}
      <div className="relative z-20 p-4 md:px-6 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-[#080d1a]/90 via-[#080d1a]/60 to-transparent">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono-num uppercase tracking-widest text-cyan-400 font-semibold">
              BESA COMBAT ROBOTICS • TEAM ENGINEERING STATION
            </span>
          </div>
          <h1 className="font-display font-black text-2xl md:text-3xl text-white tracking-wide">
            {project.teamName}
          </h1>
        </div>

        {/* Top Right Actions: Quick Stats & Instructor Reset */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono-num">
            <div>
              <span className="text-slate-400 block text-[10px]">TOTAL MASS</span>
              <span
                className={`font-bold ${
                  summary.isOverweight ? 'text-red-400 font-extrabold' : 'text-slate-200'
                }`}
              >
                {summary.totalWeightLb.toFixed(1)} / 30.0 LB
              </span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div>
              <span className="text-slate-400 block text-[10px]">PROJECT COST</span>
              <span
                className={`font-bold ${
                  summary.isOverBudget ? 'text-red-400 font-extrabold' : 'text-slate-200'
                }`}
              >
                ${summary.totalCostUsd} / ${summary.effectiveBudgetUsd}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowResetModal(true)}
            title="Reset Project for next team"
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono-num text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">RESET PROJECT</span>
          </button>
        </div>
      </div>

      {/* Middle Spacer for 3D View */}
      <div className="flex-1 pointer-events-none" />

      {/* Bottom Engineering Deck: 4 Discipline Cards + Integration Console */}
      <div className="relative z-20 p-4 md:p-6 bg-gradient-to-t from-[#080d1a] via-[#080d1a]/95 to-transparent flex flex-col gap-3">
        {/* 4 Collaborative Roles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Mechanical */}
          <div
            onClick={() => {
              soundEngine.playClick();
              onSelectRole('mechanical');
            }}
            className="cursor-pointer holo-panel rounded-2xl border border-cyan-500/30 hover:border-cyan-400/80 p-3.5 bg-slate-900/85 hover:bg-slate-900 transition-all transform hover:-translate-y-1 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                  <Wrench className="w-4 h-4" />
                </div>
                <span className="font-display font-extrabold text-sm text-white tracking-wide">
                  MECHANICAL
                </span>
              </div>
              <span
                className={`text-[10px] font-mono-num px-2 py-0.5 rounded-full border ${
                  project.mechanical.isCompleted
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                }`}
              >
                {project.mechanical.isCompleted ? 'COMPLETE' : 'IN PROGRESS'}
              </span>
            </div>

            <div className="space-y-1 text-xs font-mono-num text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Chassis & Weapon:</span>
                <span className="font-semibold text-slate-100 truncate max-w-[130px]">
                  {CHASSIS_CATALOG[project.mechanical.chassisId]?.name} •{' '}
                  {WEAPON_CATALOG[project.mechanical.weaponId as Exclude<typeof project.mechanical.weaponId, 'custom-weapon'>]?.name ?? 'CUSTOM'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Armor:</span>
                <span className="font-semibold text-slate-100">
                  {ARMOR_CATALOG[project.mechanical.armorId]?.name} ({project.mechanical.armorThickness.toUpperCase()})
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono-num text-cyan-400 font-semibold">
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
            className="cursor-pointer holo-panel rounded-2xl border border-amber-500/30 hover:border-amber-400/80 p-3.5 bg-slate-900/85 hover:bg-slate-900 transition-all transform hover:-translate-y-1 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="font-display font-extrabold text-sm text-white tracking-wide">
                  ELECTRICAL
                </span>
              </div>
              <span
                className={`text-[10px] font-mono-num px-2 py-0.5 rounded-full border ${
                  project.electrical.isCompleted
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {project.electrical.isCompleted ? 'COMPLETE' : 'IN PROGRESS'}
              </span>
            </div>

            <div className="space-y-1 text-xs font-mono-num text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Wiring Harness:</span>
                <span
                  className={`font-semibold ${
                    project.electrical.wiringVerified ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {project.electrical.wiringVerified ? 'VERIFIED ✓' : 'INCOMPLETE ✕'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Power System:</span>
                <span
                  className={`font-semibold ${
                    project.electrical.wiringVerified ? 'text-emerald-400' : 'text-slate-300'
                  }`}
                >
                  {project.electrical.wiringVerified ? 'ONLINE (100%)' : 'STANDBY'}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono-num text-amber-400 font-semibold">
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
            className="cursor-pointer holo-panel rounded-2xl border border-emerald-500/30 hover:border-emerald-400/80 p-3.5 bg-slate-900/85 hover:bg-slate-900 transition-all transform hover:-translate-y-1 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                  <Cpu className="w-4 h-4" />
                </div>
                <span className="font-display font-extrabold text-sm text-white tracking-wide">
                  SOFTWARE
                </span>
              </div>
              <span
                className={`text-[10px] font-mono-num px-2 py-0.5 rounded-full border ${
                  project.software.isCompleted
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {project.software.isCompleted ? 'COMPLETE' : 'IN PROGRESS'}
              </span>
            </div>

            <div className="space-y-1 text-xs font-mono-num text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Hardware Link:</span>
                <span
                  className={`font-semibold ${
                    project.software.computerConnected ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {project.software.computerConnected ? 'CONNECTED ✓' : 'UNCONNECTED ✕'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Autonomous Code:</span>
                <span
                  className={`font-semibold ${
                    project.software.softwareUploaded
                      ? 'text-emerald-400'
                      : project.software.bugsFixed
                      ? 'text-cyan-300'
                      : 'text-amber-400'
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

            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono-num text-emerald-400 font-semibold">
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
            className="cursor-pointer holo-panel rounded-2xl border border-purple-500/30 hover:border-purple-400/80 p-3.5 bg-slate-900/85 hover:bg-slate-900 transition-all transform hover:-translate-y-1 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <Briefcase className="w-4 h-4" />
                </div>
                <span className="font-display font-extrabold text-sm text-white tracking-wide">
                  BUSINESS LEAD
                </span>
              </div>
              <span
                className={`text-[10px] font-mono-num px-2 py-0.5 rounded-full border ${
                  project.projectLead.isCompleted
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                }`}
              >
                {project.projectLead.isCompleted ? 'COMPLETE' : 'IN PROGRESS'}
              </span>
            </div>

            <div className="space-y-1 text-xs font-mono-num text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Budget Spent:</span>
                <span
                  className={`font-semibold ${
                    summary.isOverBudget ? 'text-red-400' : 'text-slate-100'
                  }`}
                >
                  ${summary.totalCostUsd} / ${summary.effectiveBudgetUsd}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sponsorship:</span>
                <span className="font-semibold text-purple-300 uppercase">
                  {project.projectLead.sponsorTier !== 'None'
                    ? `${project.projectLead.sponsorTier} (+$${project.projectLead.sponsorshipUsd})`
                    : 'NO SPONSOR (+$0)'}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono-num text-purple-400 font-semibold">
              <span>PROMPT & SPONSOR</span>
              <span>→</span>
            </div>
          </div>
        </div>

        {/* Central Integration Gatekeeper Bar */}
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                integrationReport.overallPassed
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : integrationReport.failures.length > 0
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
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
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                SYSTEM INTEGRATION STATUS
              </div>
              <div className="font-display font-extrabold text-sm md:text-base text-white">
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
              onClick={handleRunIntegration}
              className={`cursor-pointer px-5 py-2.5 rounded-xl text-xs font-display font-bold tracking-wide transition-all ${
                integrationReport.overallPassed
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20'
              }`}
            >
              RUN INTEGRATION CHECK
            </button>

            {integrationReport.overallPassed && (
              <button
                onClick={() => {
                  soundEngine.playArenaHorn();
                  onEnterArena();
                }}
                className="cursor-pointer inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-black text-xs md:text-sm tracking-wider shadow-lg shadow-amber-500/30 animate-pulse transition-all transform hover:scale-105"
              >
                <Swords className="w-4 h-4" />
                ENTER COMBAT ARENA →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Integration Review Modal */}
      <SystemIntegrationModal
        isOpen={showIntegrationModal}
        project={project}
        report={integrationReport}
        onClose={() => setShowIntegrationModal(false)}
        onEnterArena={onEnterArena}
        onSelectRole={(role) => {
          setShowIntegrationModal(false);
          onSelectRole(role);
        }}
      />

      {/* Instructor Reset Modal */}
      <ResetProjectModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirmReset={onResetProject}
      />
    </div>
  );
};
