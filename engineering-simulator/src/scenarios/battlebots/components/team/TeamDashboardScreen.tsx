import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Code2,
  Lock,
  RotateCcw,
  Wrench,
  Zap,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import {
  type RobotConfiguration,
  type TeamRobotProject,
  type TeamRole,
} from '../../types/robot';
import { Robot3D } from '../three/Robot3D';
import { ResetProjectModal } from './ResetProjectModal';

interface TeamDashboardScreenProps {
  project: TeamRobotProject;
  onSelectRole: (role: TeamRole) => void;
  onCheckRobot?: () => void;
  onEnterArena: () => void;
  onResetProject: () => void;
  hideHeader?: boolean;
}

export const TeamDashboardScreen: React.FC<TeamDashboardScreenProps> = ({
  project,
  onSelectRole,
  onCheckRobot,
  onEnterArena,
  onResetProject,
}) => {
  const [showResetModal, setShowResetModal] = React.useState(false);

  // Bull configuration for large 3D visual
  const bullConfig: RobotConfiguration = useMemo(() => ({
    name: 'The Bull',
    chassisId: 'wide',
    driveId: 'torque',
    wheelsId: 'high-traction',
    armorId: 'steel',
    armorThickness: 'thick',
    weaponId: 'wedge',
    batteryId: 'large',
    utilityId: 'wheel-guards',
    accentColor: '#dc2626',
    customWeapon: null,
    customUtility: null,
    autonomousStrategy: 'aggressive',
  }), []);

  // Determine state for each of the 4 roles: 'done' | 'progress' | 'not-started'
  const getRoleStatus = (role: TeamRole): 'done' | 'progress' | 'not-started' => {
    switch (role) {
      case 'mechanical':
        if (project.mechanical.isCompleted) return 'done';
        if (
          Object.keys(project.mechanical.purchasedParts || {}).length > 0 ||
          (project.mechanical.assembledParts || []).length > 0
        )
          return 'progress';
        return 'not-started';

      case 'electrical':
        if (project.electrical.isCompleted) return 'done';
        if ((project.electrical.wires || []).length > 0 || project.electrical.wiringVerified)
          return 'progress';
        return 'not-started';

      case 'software':
        if (project.software.isCompleted) return 'done';
        if (
          project.software.computerConnected ||
          project.software.bugsFixed ||
          project.software.softwareUploaded
        )
          return 'progress';
        return 'not-started';

      case 'project-lead':
        if (project.projectLead.isCompleted) return 'done';
        if (Boolean(project.projectLead.adPrompt?.trim()) || project.projectLead.sponsorTier !== 'None')
          return 'progress';
        return 'not-started';
    }
  };

  const allRolesComplete =
    project.mechanical.isCompleted &&
    project.electrical.isCompleted &&
    project.software.isCompleted &&
    project.projectLead.isCompleted;

  const rolesList: {
    id: TeamRole;
    name: string;
    tagline: string;
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
  }[] = [
    {
      id: 'mechanical',
      name: 'Mechanical',
      tagline: 'Build the robot',
      icon: Wrench,
      colorClass: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    },
    {
      id: 'electrical',
      name: 'Electrical',
      tagline: 'Wire the robot',
      icon: Zap,
      colorClass: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      id: 'software',
      name: 'Software',
      tagline: 'Program the robot',
      icon: Code2,
      colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      id: 'project-lead',
      name: 'Business',
      tagline: 'Fund the robot',
      icon: Briefcase,
      colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
  ];

  return (
    <div className="relative w-full h-full bg-slate-50 text-slate-800 flex flex-col justify-between p-4 md:p-6 lg:p-8 font-sans overflow-y-auto select-none">
      {/* Main 2-Column Home Layout */}
      <div className="flex-1 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* ==========================================
            LEFT COLUMN: BATTLEBOT CHALLENGE & TEAM
            ========================================== */}
        <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
          <div>
            <span className="text-[11px] font-mono font-black uppercase tracking-wider text-cyan-700 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-full inline-block mb-2">
              BattleBot Challenge
            </span>
            <h1 className="font-display font-black text-3xl sm:text-4xl text-slate-900 tracking-tight leading-tight">
              Build an autonomous 30 lb robot and defeat The Bull.
            </h1>
          </div>

          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">
              Your Team
            </h2>

            {/* 4 Simple Role Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rolesList.map((role) => {
                const status = getRoleStatus(role.id);
                const Icon = role.icon;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onSelectRole(role.id);
                    }}
                    className="cursor-pointer group p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all text-left flex flex-col justify-between min-h-[110px]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`size-8 rounded-xl border flex items-center justify-center shrink-0 ${role.colorClass}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-display font-extrabold text-sm text-slate-900">
                          {role.name}
                        </span>
                      </div>

                      {/* Tiny state indicator */}
                      <span className="text-xs font-bold">
                        {status === 'done' ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-mono text-[11px]">
                            ✓ Done
                          </span>
                        ) : status === 'progress' ? (
                          <span className="text-cyan-600 flex items-center gap-1 font-mono text-[11px]">
                            ● Active
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-[11px]">
                            ○ Ready
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500 font-medium">
                        {role.tagline}
                      </span>
                      <span className="text-xs font-display font-bold text-slate-800 group-hover:text-cyan-600 flex items-center gap-1 transition-colors">
                        <span>{status === 'done' ? 'Review' : status === 'progress' ? 'Continue' : 'Start'}</span>
                        <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ==========================================
            RIGHT COLUMN: LARGE THE BULL VISUAL
            ========================================== */}
        <div className="lg:col-span-6 h-[420px] sm:h-[480px] rounded-3xl bg-gradient-to-b from-slate-100 to-slate-200/80 border border-slate-200 relative overflow-hidden flex flex-col justify-between p-6 shadow-sm">
          {/* Subtle Stage Background */}
          <div className="absolute inset-0 z-0">
            <Canvas shadows camera={{ position: [2.5, 1.7, 2.7], fov: 38 }}>
              <ambientLight intensity={1.2} />
              <directionalLight position={[5, 8, 5]} intensity={2.2} castShadow />
              <directionalLight position={[-4, 4, -3]} intensity={0.8} />

              <group position={[0, -0.05, 0]}>
                <mesh receiveShadow position={[0, -0.03, 0]}>
                  <cylinderGeometry args={[1.8, 1.95, 0.08, 48]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.5} />
                </mesh>
              </group>

              <group position={[0, -0.02, 0]}>
                <Robot3D
                  isBullBoss={true}
                  config={bullConfig}
                  wheelSpeedRad={0}
                />
              </group>

              <OrbitControls
                enablePan={false}
                minDistance={1.8}
                maxDistance={4.2}
                maxPolarAngle={Math.PI / 2 - 0.05}
                autoRotate
                autoRotateSpeed={0.8}
              />
            </Canvas>
          </div>

          {/* Minimal Text Top */}
          <div className="relative z-10 text-center pointer-events-none">
            <h3 className="font-display font-black text-2xl text-slate-900 tracking-tight">
              THE BULL
            </h3>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
              Final Opponent
            </span>
          </div>

          {/* Bottom Card: Locked or Ready */}
          <div className="relative z-10 flex justify-center pointer-events-none">
            {!allRolesComplete ? (
              <div className="bg-white/90 backdrop-blur-md border border-slate-200 px-5 py-3 rounded-2xl shadow-md text-center max-w-xs">
                <div className="flex items-center justify-center gap-1.5 text-slate-700 font-bold text-xs">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Arena Locked</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Complete all 4 roles to enter.
                </p>
              </div>
            ) : (
              <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-emerald-300 p-4 rounded-2xl shadow-xl text-center max-w-xs animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-bold text-xs mb-2 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>TEAM READY</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playInstall();
                    if (onCheckRobot) {
                      onCheckRobot();
                    } else {
                      onEnterArena();
                    }
                  }}
                  className="cursor-pointer w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-display font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/25 transition-all transform active:scale-98 flex items-center justify-center gap-1.5"
                >
                  <span>Check Your Robot →</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtle Reset Project Control */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-end pt-4">
        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          className="cursor-pointer inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Project</span>
        </button>
      </div>

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
