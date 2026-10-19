import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  CircleDot,
  RotateCcw,
  Shield,
  Swords,
  Wrench,
} from 'lucide-react';
import React, { useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import {
  ARMOR_CATALOG,
  CHASSIS_CATALOG,
  DRIVE_CATALOG,
  UTILITY_CATALOG,
  WEAPON_CATALOG,
  WHEELS_CATALOG,
} from '../../data/components';
import { INITIAL_MECHANICAL_CONFIG } from '../../data/teamData';
import { computeTeamEngineeringSummary } from '../../simulation/integrationValidator';
import {
  type ArmorId,
  type ArmorThickness,
  type ChassisId,
  type DriveId,
  type MechanicalConfiguration,
  type RobotConfiguration,
  type TeamRobotProject,
  type UtilityId,
  type WeaponId,
  type WheelsId,
} from '../../types/robot';
import { Robot3D } from '../three/Robot3D';
import { ResetTaskModal } from './ResetTaskModal';

interface MechanicalScreenProps {
  project: TeamRobotProject;
  onUpdateMechanical: (nextMechanical: MechanicalConfiguration) => void;
  onReturnToDashboard: () => void;
}

type TabType = 'chassis' | 'weapon' | 'wheels' | 'armor' | 'utility';

export const MechanicalScreen: React.FC<MechanicalScreenProps> = ({
  project,
  onUpdateMechanical,
  onReturnToDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('weapon');
  const [showResetModal, setShowResetModal] = useState(false);
  const mech = project.mechanical;
  const summary = computeTeamEngineeringSummary(project);

  const handleResetMechanical = () => {
    soundEngine.playInstall();
    onUpdateMechanical({ ...INITIAL_MECHANICAL_CONFIG, isCompleted: false });
    setShowResetModal(false);
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

  const updateField = <K extends keyof MechanicalConfiguration>(key: K, val: MechanicalConfiguration[K]) => {
    soundEngine.playInstall();
    onUpdateMechanical({ ...mech, [key]: val });
  };

  const toggleComplete = () => {
    soundEngine.playClick();
    onUpdateMechanical({ ...mech, isCompleted: !mech.isCompleted });
  };

  return (
    <div className="relative w-full h-full bg-[#070b16] text-white overflow-hidden flex flex-col justify-between">
      {/* 3D Interactive Turntable */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [2.5, 1.8, 2.8], fov: 42 }}>
          <color attach="background" args={['#070b16']} />
          <fog attach="fog" args={['#070b16', 5, 14]} />
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

          {/* Turntable */}
          <group position={[0, -0.02, 0]}>
            <mesh receiveShadow position={[0, -0.03, 0]}>
              <cylinderGeometry args={[2.0, 2.15, 0.08, 48]} />
              <meshStandardMaterial color="#1e2638" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
              <ringGeometry args={[1.82, 1.9, 48]} />
              <meshStandardMaterial color={mech.accentColor} emissive={mech.accentColor} emissiveIntensity={1.2} />
            </mesh>
          </group>

          <group position={[0, 0, 0]}>
            <Robot3D config={previewConfig} wheelSpeedRad={0} motorTempC={summary.stats.expectedMotorTempC} />
          </group>
        </Canvas>
      </div>

      {/* Top Header */}
      <div className="relative z-20 p-4 md:px-6 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-[#070b16]/95 via-[#070b16]/70 to-transparent">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEngine.playClick();
              onReturnToDashboard();
            }}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono-num font-semibold text-slate-300 hover:text-white bg-slate-900/90 border border-slate-700 hover:border-slate-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            DASHBOARD
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-[10px] font-mono-num uppercase tracking-wider text-cyan-400 font-semibold">
                DISCIPLINE 01 • MECHANICAL ENGINEER
              </span>
            </div>
            <h2 className="font-display font-black text-xl text-white">PHYSICAL ARCHITECTURE</h2>
          </div>
        </div>

        {/* Live Cross-Discipline Badges & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono-num">
            <div>
              <span className="text-slate-400 block text-[9px]">TOTAL WEIGHT</span>
              <span className={`font-bold ${summary.isOverweight ? 'text-red-400' : 'text-slate-100'}`}>
                {summary.totalWeightLb.toFixed(1)} / 30.0 LB
              </span>
            </div>
            <div className="w-px h-5 bg-slate-800" />
            <div>
              <span className="text-slate-400 block text-[9px]">TURN RATE</span>
              <span className="font-bold text-cyan-300">{summary.stats.turningRateDegPerSec}°/S</span>
            </div>
          </div>

          <button
            onClick={() => setShowResetModal(true)}
            title="Reset Mechanical task progress"
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono-num text-slate-400 hover:text-rose-300 bg-slate-900/80 border border-slate-800 hover:border-rose-900/50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>↻ Reset Task</span>
          </button>

          <button
            onClick={toggleComplete}
            className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-display font-bold transition-all ${
              mech.isCompleted
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {mech.isCompleted ? 'DISCIPLINE COMPLETE' : 'MARK COMPLETE'}
          </button>
        </div>
      </div>

      <ResetTaskModal
        isOpen={showResetModal}
        roleTitle="MECHANICAL"
        description="This will restore the Mechanical challenge to its starting configuration. Other team tasks will not be changed."
        onConfirm={handleResetMechanical}
        onCancel={() => setShowResetModal(false)}
      />

      {/* Middle Spacer for 3D View */}
      <div className="flex-1 pointer-events-none" />

      {/* Bottom Selector Drawer */}
      <div className="relative z-20 p-4 md:p-6 bg-gradient-to-t from-[#070b16] via-[#070b16]/95 to-transparent flex flex-col gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'chassis' as TabType, label: 'CHASSIS', icon: <Box className="w-3.5 h-3.5" /> },
            { id: 'weapon' as TabType, label: 'WEAPON', icon: <Swords className="w-3.5 h-3.5" /> },
            { id: 'wheels' as TabType, label: 'WHEELS & DRIVE', icon: <CircleDot className="w-3.5 h-3.5" /> },
            { id: 'armor' as TabType, label: 'ARMOR & MATERIAL', icon: <Shield className="w-3.5 h-3.5" /> },
            { id: 'utility' as TabType, label: 'UTILITY MODULE', icon: <Wrench className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                soundEngine.playClick();
                setActiveTab(tab.id);
              }}
              className={`cursor-pointer px-3.5 py-2 rounded-xl text-xs font-display font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Options Cards for Active Tab */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1">
          {/* TAB 1: CHASSIS */}
          {activeTab === 'chassis' &&
            Object.values(CHASSIS_CATALOG).map((c) => {
              const isSelected = mech.chassisId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => updateField('chassisId', c.id as ChassisId)}
                  className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-display font-bold text-sm text-white">{c.name}</span>
                    <span className="text-[10px] font-mono-num text-cyan-400">{c.weightLb} LB</span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-1">{c.subtitle}</p>
                  <div className="text-[10px] font-mono-num text-slate-400 mt-1">
                    Turn Factor: {c.turnRateFactor}x • Width: {c.dims.width}m
                  </div>
                </div>
              );
            })}

          {/* TAB 2: WEAPON */}
          {activeTab === 'weapon' &&
            Object.values(WEAPON_CATALOG).map((w) => {
              const isSelected = mech.weaponId === w.id;
              return (
                <div
                  key={w.id}
                  onClick={() => updateField('weaponId', w.id as WeaponId)}
                  className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-display font-bold text-sm text-white">{w.name}</span>
                    <span className="text-[10px] font-mono-num text-cyan-400">{w.weightLb} LB</span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-1">{w.subtitle}</p>
                  <div className="text-[10px] font-mono-num text-amber-300 mt-1 flex justify-between">
                    <span>Power: {(w.peakPowerKw * 1000).toLocaleString()} W</span>
                    <span>Energy: {w.energyJ.toLocaleString()} J</span>
                  </div>
                </div>
              );
            })}

          {/* TAB 3: WHEELS & DRIVE */}
          {activeTab === 'wheels' && (
            <>
              {Object.values(WHEELS_CATALOG).map((wh) => {
                const isSelected = mech.wheelsId === wh.id;
                return (
                  <div
                    key={wh.id}
                    onClick={() => updateField('wheelsId', wh.id as WheelsId)}
                    className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-display font-bold text-sm text-white">{wh.name}</span>
                      <span className="text-[10px] font-mono-num text-cyan-400">{wh.weightLb} LB</span>
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-1">{wh.subtitle}</p>
                    <div className="text-[10px] font-mono-num text-slate-400 mt-1">
                      Traction: μ {wh.tractionCoeff} • Turn: {wh.turnMultiplier}x
                    </div>
                  </div>
                );
              })}
              {Object.values(DRIVE_CATALOG).map((d) => {
                const isSelected = mech.driveId === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => updateField('driveId', d.id as DriveId)}
                    className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-display font-bold text-sm text-white">DRIVE: {d.name}</span>
                      <span className="text-[10px] font-mono-num text-cyan-400">{d.weightLb} LB</span>
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-1">{d.subtitle}</p>
                    <div className="text-[10px] font-mono-num text-slate-400 mt-1">
                      Torque: {d.torqueNm} Nm • Top Speed: {d.topSpeedMphBase} MPH
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* TAB 4: ARMOR */}
          {activeTab === 'armor' && (
            <>
              {Object.values(ARMOR_CATALOG).map((a) => {
                const isSelected = mech.armorId === a.id;
                return (
                  <div
                    key={a.id}
                    onClick={() => updateField('armorId', a.id as ArmorId)}
                    className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-display font-bold text-sm text-white">{a.name}</span>
                      <span className="text-[10px] font-mono-num text-cyan-400">{a.baseWeightLb} LB</span>
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-1">{a.subtitle}</p>
                    <div className="text-[10px] font-mono-num text-slate-400 mt-1">
                      Protection: {a.protectionRating} PTS
                    </div>
                  </div>
                );
              })}
              {/* Armor Thickness Buttons */}
              <div className="col-span-2 sm:col-span-3 lg:col-span-4 p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs font-mono-num text-slate-400">ARMOR THICKNESS:</span>
                <div className="flex gap-2">
                  {(['thin', 'medium', 'thick'] as ArmorThickness[]).map((thick) => (
                    <button
                      key={thick}
                      onClick={() => updateField('armorThickness', thick)}
                      className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-mono-num uppercase font-bold transition-all ${
                        mech.armorThickness === thick
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {thick}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TAB 5: UTILITY */}
          {activeTab === 'utility' &&
            Object.values(UTILITY_CATALOG).map((u) => {
              const isSelected = mech.utilityId === u.id;
              return (
                <div
                  key={u.id}
                  onClick={() => updateField('utilityId', u.id as UtilityId)}
                  className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-display font-bold text-sm text-white">{u.name}</span>
                    <span className="text-[10px] font-mono-num text-cyan-400">{u.weightLb} LB</span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-1">{u.subtitle}</p>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
