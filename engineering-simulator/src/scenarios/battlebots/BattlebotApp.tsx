import {
  ArrowLeftRight,
  BatteryCharging,
  Box,
  CircleDot,
  Compass,
  Cpu,
  FlaskConical,
  Gauge,
  Shield,
  Sliders,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  Wrench,
  RotateCcw,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { useMuted } from '../../shared/audio/sfx';
import { ArenaScreen } from './components/arena/ArenaScreen';
import { InventorLabModal } from './components/inventor/InventorLabModal';
import { TestLabOverlay } from './components/testlab/TestLabOverlay';
import { type ActiveTestVisualState, WorkshopStage3D } from './components/three/WorkshopStage3D';
import { CompareModal } from './components/workshop/CompareModal';
import { EngineeringDetailsDrawer } from './components/workshop/EngineeringDetailsDrawer';
import { TeamDashboardScreen } from './components/team/TeamDashboardScreen';
import { SystemsTeamScreen } from './components/team/SystemsTeamScreen';
import { MechanicalScreen } from './components/disciplines/MechanicalScreen';
import { ElectricalScreen } from './components/disciplines/ElectricalScreen';
import { SoftwareScreen } from './components/disciplines/SoftwareScreen';
import { ProjectLeadScreen } from './components/disciplines/ProjectLeadScreen';
import { BattlebotShell, type ChecklistStep } from './components/BattlebotShell';
import { computeTeamEngineeringSummary } from './simulation/integrationValidator';
import type { BattlebotTeam, PartKey } from './teamSync';
import { ARMOR_CATALOG, ARMOR_THICKNESS_OPTIONS, BATTERY_CATALOG, CHASSIS_CATALOG, DRIVE_CATALOG, INITIAL_ROBOT_CONFIG, UTILITY_CATALOG, WEAPON_CATALOG, WHEELS_CATALOG } from './data/components';
import { BOSS_LADDER, getBossById } from './data/bosses';
import { calculateEngineeringStats, computeInstallConsequences } from './simulation/engineering';
import {
  type AppScreen,
  type ArmorId,
  type ArmorThickness,
  type BatteryId,
  type BossId,
  type ChassisId,
  type ComponentCardSpec,
  type ComponentCategory,
  type CustomComponentSpec,
  type DriveId,
  type ElectricalConfiguration,
  type InstallConsequenceToast,
  type MechanicalConfiguration,
  type ProjectLeadConfiguration,
  type RobotConfiguration,
  type SoftwareConfiguration,
  type TeamRobotProject,
  type TestLabType,
  type UtilityId,
  type WeaponId,
  type WheelsId,
} from './types/robot';

const CATEGORY_TABS: {
  id: ComponentCategory;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'chassis', label: 'CHASSIS', icon: <Box className="w-4 h-4" /> },
  { id: 'drive', label: 'DRIVE', icon: <Gauge className="w-4 h-4" /> },
  { id: 'wheels', label: 'WHEELS', icon: <CircleDot className="w-4 h-4" /> },
  { id: 'armor', label: 'ARMOR', icon: <Shield className="w-4 h-4" /> },
  { id: 'weapon', label: 'WEAPON', icon: <Swords className="w-4 h-4" /> },
  { id: 'power', label: 'POWER', icon: <BatteryCharging className="w-4 h-4" /> },
  { id: 'utility', label: 'UTILITY', icon: <Wrench className="w-4 h-4" /> },
];

const ACCENT_SWATCHES = ['#22d3ee', '#f59e0b', '#10b981', '#ec4899', '#a855f7'];

/** Config fields that come from the team project (the rest is local to this device). */
const configFromProject = (p: TeamRobotProject) => ({
  chassisId: p.mechanical.chassisId,
  driveId: p.mechanical.driveId,
  wheelsId: p.mechanical.wheelsId,
  armorId: p.mechanical.armorId,
  armorThickness: p.mechanical.armorThickness,
  weaponId: p.mechanical.weaponId,
  utilityId: p.mechanical.utilityId,
  batteryId: p.electrical.batteryId,
  accentColor: p.mechanical.accentColor,
});

interface BattlebotAppProps {
  /** The team's project (shared with teammates in multiplayer). */
  project: TeamRobotProject;
  onUpdatePart<K extends PartKey>(part: K, data: TeamRobotProject[K]): void;
  onResetProject(): void;
  /** Multiplayer only: who does which job. */
  team?: BattlebotTeam;
}

export function BattlebotApp({ project, onUpdatePart, onResetProject, team }: BattlebotAppProps) {
  const [screen, setScreen] = useState<AppScreen>('team-dashboard');

  const [config, setConfig] = useState<RobotConfiguration>(() => ({
    ...INITIAL_ROBOT_CONFIG,
    ...configFromProject(project),
  }));
  // Keep the robot config in step with the project, including teammates' changes.
  const [configSource, setConfigSource] = useState({ mechanical: project.mechanical, electrical: project.electrical });
  if (configSource.mechanical !== project.mechanical || configSource.electrical !== project.electrical) {
    setConfigSource({ mechanical: project.mechanical, electrical: project.electrical });
    setConfig((prev) => ({ ...prev, ...configFromProject(project) }));
  }

  const handleUpdateMechanical = (nextMech: MechanicalConfiguration) => onUpdatePart('mechanical', nextMech);
  const handleUpdateElectrical = (nextElec: ElectricalConfiguration) => onUpdatePart('electrical', nextElec);
  const handleUpdateSoftware = (nextSoft: SoftwareConfiguration) => onUpdatePart('software', nextSoft);
  const handleUpdateProjectLead = (nextLead: ProjectLeadConfiguration) => onUpdatePart('projectLead', nextLead);

  const handleResetProject = () => {
    onResetProject();
    setScreen('team-dashboard');
    soundEngine.playInstall();
  };

  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory>('weapon');
  const [installingCategory, setInstallingCategory] = useState<ComponentCategory | null>(null);
  const [consequenceToast, setConsequenceToast] = useState<InstallConsequenceToast | null>(null);
  const [showEngineeringDetails, setShowEngineeringDetails] = useState(false);
  const [showInventorLab, setShowInventorLab] = useState(false);
  const [comparePartId, setComparePartId] = useState<string | null>(null);
  const muted = useMuted();
  const [cameraResetTrigger, setCameraResetTrigger] = useState(0);
  const [arenaTransitioning, setArenaTransitioning] = useState(false);
  const [showResetEntireProjectModal, setShowResetEntireProjectModal] = useState(false);

  // Boss Ladder Progression State
  const [unlockedBossIndex, setUnlockedBossIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('besa_battlebots_unlocked_index');
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const selectedBossId: BossId = 'bull';

  const handleDefeatBoss = (defeatedBossId: BossId) => {
    const currentIndex = BOSS_LADDER.findIndex((b) => b.id === defeatedBossId);
    if (currentIndex !== -1 && currentIndex + 1 > unlockedBossIndex) {
      const nextIndex = Math.min(BOSS_LADDER.length - 1, currentIndex + 1);
      setUnlockedBossIndex(nextIndex);
      try {
        localStorage.setItem('besa_battlebots_unlocked_index', nextIndex.toString());
      } catch {
        // ignore
      }
    }
  };

  // Test Lab states
  const [activeTest, setActiveTest] = useState<ActiveTestVisualState>({
    testType: null,
    progress: 0,
    isRunning: false,
  });
  const [completedTest, setCompletedTest] = useState<TestLabType | null>('weapon');

  const toastTimeoutRef = useRef<number | null>(null);
  const installTimeoutRef = useRef<number | null>(null);
  const toastCounterRef = useRef<number>(0);

  const stats = useMemo(() => calculateEngineeringStats(config), [config]);

  // Progress animation loop for active Test Lab test
  useEffect(() => {
    if (!activeTest.isRunning || !activeTest.testType) return;
    let rafId: number;
    const startTime = performance.now();
    const durationMs = 2400;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const prog = Math.min(1, elapsed / durationMs);
      setActiveTest((prev) => ({ ...prev, progress: prog }));
      if (prog < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setCompletedTest(activeTest.testType);
        setActiveTest((prev) => ({ ...prev, isRunning: false, progress: 1 }));
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [activeTest.isRunning, activeTest.testType]);

  // Equip a component and trigger 3D installation animation + consequence toast
  const triggerInstallUpdate = (
    nextConfig: RobotConfiguration,
    category: ComponentCategory,
    componentName: string
  ) => {
    const prevStats = calculateEngineeringStats(config);
    const nextStats = calculateEngineeringStats(nextConfig);
    const changes = computeInstallConsequences(prevStats, nextStats);

    setConfig(nextConfig);
    setInstallingCategory(category);
    if (nextStats.isOverweight) {
      soundEngine.playWarning();
    } else {
      soundEngine.playInstall();
    }

    if (installTimeoutRef.current) window.clearTimeout(installTimeoutRef.current);
    installTimeoutRef.current = window.setTimeout(() => {
      setInstallingCategory(null);
    }, 650);

    if (changes.length > 0) {
      toastCounterRef.current += 1;
      setConsequenceToast({
        id: toastCounterRef.current,
        componentName,
        category,
        changes,
      });
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = window.setTimeout(() => {
        setConsequenceToast(null);
      }, 4200);
    }
  };

  const renderToast = (t: InstallConsequenceToast | null) => {
    if (!t) return null;
    return (
      <div
        key={t.id}
        className="pointer-events-auto holo-panel holo-glow-cyan rounded-2xl border border-cyan-400/50 p-4 animate-pop-in"
      >
      <div className="text-[10px] font-mono-num uppercase tracking-widest text-cyan-300 mb-0.5">
        SUBSYSTEM INSTALLED
      </div>
      <div className="font-display text-base font-extrabold text-white border-b border-slate-800 pb-2 mb-2.5">
        {t.componentName}
      </div>
      <div className="space-y-2">
        {t.changes.map((ch) => (
          <div key={ch.label} className="flex items-center justify-between text-xs font-mono-num">
            <span className="text-slate-400">{ch.label}</span>
            <span
              className={`font-bold ${
                ch.tone === 'good'
                  ? 'text-emerald-300'
                  : ch.tone === 'warn'
                  ? 'text-amber-300'
                  : 'text-cyan-200'
              }`}
            >
              {ch.before} → {ch.after} {ch.direction === 'up' ? '↑' : '↓'}
            </span>
          </div>
        ))}
      </div>
    </div>
    );
  };

  const handleEquipPart = (category: ComponentCategory, id: string, labelName?: string) => {
    const nextConfig = { ...config };
    let partName = labelName || id.toUpperCase();

    switch (category) {
      case 'chassis':
        nextConfig.chassisId = id as ChassisId;
        partName = CHASSIS_CATALOG[id as ChassisId]?.name ?? partName;
        break;
      case 'drive':
        nextConfig.driveId = id as DriveId;
        partName = DRIVE_CATALOG[id as DriveId]?.name ?? partName;
        break;
      case 'wheels':
        nextConfig.wheelsId = id as WheelsId;
        partName = WHEELS_CATALOG[id as WheelsId]?.name ?? partName;
        break;
      case 'armor':
        nextConfig.armorId = id as ArmorId;
        partName = ARMOR_CATALOG[id as ArmorId]?.name ?? partName;
        break;
      case 'weapon':
        nextConfig.weaponId = id as WeaponId;
        partName =
          id === 'custom-weapon' && config.customWeapon
            ? config.customWeapon.name
            : WEAPON_CATALOG[id as Exclude<WeaponId, 'custom-weapon'>]?.name ?? partName;
        break;
      case 'power':
        nextConfig.batteryId = id as BatteryId;
        partName = BATTERY_CATALOG[id as BatteryId]?.name ?? partName;
        break;
      case 'utility':
        nextConfig.utilityId = id as UtilityId;
        partName =
          id === 'custom-utility' && config.customUtility
            ? config.customUtility.name
            : UTILITY_CATALOG[id as Exclude<UtilityId, 'custom-utility'>]?.name ?? partName;
        break;
    }

    triggerInstallUpdate(nextConfig, category, partName);
  };

  const handleChangeArmorThickness = (thickness: ArmorThickness) => {
    const spec = ARMOR_THICKNESS_OPTIONS[thickness];
    const nextConfig: RobotConfiguration = {
      ...config,
      armorThickness: thickness,
    };
    triggerInstallUpdate(nextConfig, 'armor', `${spec.label} ARMOR GAUGE`);
  };

  const handleInstallCustomComponent = (customSpec: CustomComponentSpec) => {
    if (customSpec.category === 'weapon') {
      const nextConfig: RobotConfiguration = {
        ...config,
        weaponId: 'custom-weapon',
        customWeapon: customSpec,
      };
      setSelectedCategory('weapon');
      triggerInstallUpdate(nextConfig, 'weapon', customSpec.name);
    } else {
      const nextConfig: RobotConfiguration = {
        ...config,
        utilityId: 'custom-utility',
        customUtility: customSpec,
      };
      setSelectedCategory('utility');
      triggerInstallUpdate(nextConfig, 'utility', customSpec.name);
    }
  };

  const handleStartTestLabTest = (test: TestLabType) => {
    if (test === 'weapon' || test === 'speed') {
      soundEngine.playSpinUp(1.1);
    } else {
      soundEngine.playInstall();
    }
    setActiveTest({
      testType: test,
      progress: 0,
      isRunning: true,
    });
  };

  const handleEnterArenaTransition = () => {
    if (stats.isOverweight) {
      soundEngine.playWarning();
      return;
    }
    soundEngine.playArenaHorn();
    setArenaTransitioning(true);
    window.setTimeout(() => {
      setArenaTransitioning(false);
      setScreen('arena');
    }, 680);
  };

  // Build active card list for currently selected category
  const activeCards: {
    card: ComponentCardSpec;
    isEquipped: boolean;
    displayWeightLb: number;
  }[] = useMemo(() => {
    switch (selectedCategory) {
      case 'chassis':
        return Object.values(CHASSIS_CATALOG).map((c) => ({
          card: c,
          isEquipped: config.chassisId === c.id,
          displayWeightLb: c.weightLb,
        }));
      case 'drive':
        return Object.values(DRIVE_CATALOG).map((d) => ({
          card: d,
          isEquipped: config.driveId === d.id,
          displayWeightLb: d.weightLb,
        }));
      case 'wheels':
        return Object.values(WHEELS_CATALOG).map((w) => ({
          card: w,
          isEquipped: config.wheelsId === w.id,
          displayWeightLb: w.weightLb,
        }));
      case 'armor': {
        const thickMult = ARMOR_THICKNESS_OPTIONS[config.armorThickness].weightMultiplier;
        return Object.values(ARMOR_CATALOG).map((a) => ({
          card: a,
          isEquipped: config.armorId === a.id,
          displayWeightLb: Number((a.baseWeightLb * thickMult).toFixed(1)),
        }));
      }
      case 'weapon': {
        const baseWeapons = Object.values(WEAPON_CATALOG).map((w) => ({
          card: w as ComponentCardSpec,
          isEquipped: config.weaponId === w.id,
          displayWeightLb: w.weightLb,
        }));
        if (config.customWeapon) {
          baseWeapons.unshift({
            card: {
              id: 'custom-weapon',
              category: 'weapon',
              name: `✨ ${config.customWeapon.name}`,
              subtitle: 'Custom AI Inventor Attachment',
              weightLb: config.customWeapon.mass,
              pros: config.customWeapon.pros,
              cons: config.customWeapon.tradeoffs,
              engineeringDetail: {
                materialOrSpec: config.customWeapon.visualDescription,
                technicalNote: config.customWeapon.description,
                keyMetrics: [],
              },
            },
            isEquipped: config.weaponId === 'custom-weapon',
            displayWeightLb: config.customWeapon.mass,
          });
        }
        return baseWeapons;
      }
      case 'power':
        return Object.values(BATTERY_CATALOG).map((b) => ({
          card: b,
          isEquipped: config.batteryId === b.id,
          displayWeightLb: b.weightLb,
        }));
      case 'utility': {
        const baseUtils = Object.values(UTILITY_CATALOG).map((u) => ({
          card: u as ComponentCardSpec,
          isEquipped: config.utilityId === u.id,
          displayWeightLb: u.weightLb,
        }));
        if (config.customUtility) {
          baseUtils.unshift({
            card: {
              id: 'custom-utility',
              category: 'utility',
              name: `✨ ${config.customUtility.name}`,
              subtitle: 'Custom AI Inventor Attachment',
              weightLb: config.customUtility.mass,
              pros: config.customUtility.pros,
              cons: config.customUtility.tradeoffs,
              engineeringDetail: {
                materialOrSpec: config.customUtility.visualDescription,
                technicalNote: config.customUtility.description,
                keyMetrics: [],
              },
            },
            isEquipped: config.utilityId === 'custom-utility',
            displayWeightLb: config.customUtility.mass,
          });
        }
        return baseUtils;
      }
    }
  }, [selectedCategory, config]);

  // 1. HOME SCREEN - ENTRY TO LIGHT TEAM DASHBOARD (Bypasses legacy dark landing page)
  if (screen === 'welcome' || screen === 'mission') {
    setScreen('team-dashboard');
    return null;
  }

  // 7. COMBAT ARENA SCREEN (VS THE BULL ONLY - Manual Combat Arena)
  if (screen === 'arena') {
    return (
      <ArenaScreen
        playerConfig={config}
        playerStats={stats}
        bossId="bull"
        teamProject={project}
        onDefeatBoss={handleDefeatBoss}
        onReturnToWorkshop={() => setScreen('team-dashboard')}
        onReturnToDashboard={() => setScreen('team-dashboard')}
      />
    );
  }

  // Calculate global budget numbers and active checklist steps
  const teamSummary = computeTeamEngineeringSummary(project);
  const totalFunding = (project.projectLead.baseBudgetUsd || 1800) + (project.projectLead.sponsorshipUsd || 0);

  // Compute station checklist steps
  const getDisciplineChecklist = (): ChecklistStep[] => {
    switch (screen) {
      case 'mechanical': {
        const purchasedCount = ['chassis', 'drive', 'wheels', 'armor', 'weapon'].filter(
          (c) => Boolean(project.mechanical.purchasedParts?.[c])
        ).length;
        const assembledCount = (project.mechanical.assembledParts || []).length;
        return [
          {
            label: 'Buy Parts',
            done: purchasedCount >= 5,
          },
          {
            label: 'Assemble',
            done: assembledCount >= 5,
          },
          {
            label: 'Inspect',
            done: Boolean(project.mechanical.inspectionPassed || project.mechanical.isCompleted),
          },
        ];
      }
      case 'electrical': {
        const wireCount = project.electrical.wires?.length || 0;
        return [
          {
            label: 'Connect',
            done: Boolean(wireCount > 0 || project.electrical.wiringVerified),
          },
          {
            label: 'Wire',
            done: Boolean(project.electrical.wiringVerified),
          },
          {
            label: 'Test',
            done: Boolean(project.electrical.isCompleted),
          },
        ];
      }
      case 'software': {
        return [
          {
            label: 'Connect',
            done: Boolean(project.software.computerConnected || project.software.softwareUploaded),
          },
          {
            label: 'Debug',
            done: Boolean(project.software.bugsFixed || project.software.softwareUploaded),
          },
          {
            label: 'Upload',
            done: Boolean(project.software.softwareUploaded),
          },
          {
            label: 'Test Controls',
            done: Boolean(project.software.testPassed && project.software.isCompleted),
          },
        ];
      }
      case 'project-lead': {
        return [
          {
            label: 'Create Ad',
            done: Boolean(project.projectLead.adPrompt?.trim() || project.projectLead.campaignScore > 0),
          },
          {
            label: 'Earn Sponsor',
            done: Boolean(project.projectLead.sponsorTier !== 'None' && project.projectLead.isCompleted),
          },
        ];
      }
      case 'team-dashboard':
      case 'integration':
      default:
        return [];
    }
  };

  return (
    <>
      <BattlebotShell
        project={project}
        activeScreen={screen}
        onNavigate={(target) => setScreen(target)}
        onResetGame={() => setShowResetEntireProjectModal(true)}
        checklistSteps={getDisciplineChecklist()}
        spentUsd={teamSummary.totalCostUsd}
        availableUsd={totalFunding}
        myRoles={team?.myRoles}
      >
        {screen === 'team-dashboard' && (
          <TeamDashboardScreen
            project={project}
            onSelectRole={(role) => setScreen(role)}
            onCheckRobot={() => setScreen('integration')}
            onEnterArena={() => setScreen('arena')}
            onResetProject={handleResetProject}
            hideHeader={true}
            team={team}
          />
        )}

        {screen === 'integration' && (
          <SystemsTeamScreen
            project={project}
            onEnterArena={() => setScreen('arena')}
            onReturnToTeam={() => setScreen('team-dashboard')}
            onSelectRole={(role) => setScreen(role)}
          />
        )}

        {screen === 'mechanical' && (
          <MechanicalScreen
            project={project}
            onUpdateMechanical={handleUpdateMechanical}
            onReturnToDashboard={() => setScreen('team-dashboard')}
            hideHeader={true}
          />
        )}

        {screen === 'electrical' && (
          <ElectricalScreen
            project={project}
            onUpdateElectrical={handleUpdateElectrical}
            onReturnToDashboard={() => setScreen('team-dashboard')}
            hideHeader={true}
          />
        )}

        {screen === 'software' && (
          <SoftwareScreen
            project={project}
            onUpdateSoftware={handleUpdateSoftware}
            onReturnToDashboard={() => setScreen('team-dashboard')}
            hideHeader={true}
          />
        )}

        {screen === 'project-lead' && (
          <ProjectLeadScreen
            project={project}
            onUpdateProjectLead={handleUpdateProjectLead}
            onReturnToDashboard={() => setScreen('team-dashboard')}
            hideHeader={true}
          />
        )}
      </BattlebotShell>

      {/* Global Reset Entire BattleBot Project Modal */}
      {showResetEntireProjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 text-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-2xl bg-rose-50 border border-rose-200 grid place-items-center text-rose-600 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-slate-900">
                  RESET BATTLEBOT PROJECT?
                </h3>
                <p className="text-xs text-slate-500">Are you sure you want to start over?</p>
              </div>
            </div>

            <div className="my-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2 font-sans">
              <p className="font-semibold text-slate-700">This will reset:</p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
                <li>all 4 engineering disciplines</li>
                <li>all purchased parts and assembly</li>
                <li>funding and sponsorships</li>
                <li>system integration test results</li>
                <li>battle history</li>
              </ul>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 italic">
                Your rocket engineering scenario will NOT be affected.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetEntireProjectModal(false)}
                className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetEntireProjectModal(false);
                  handleResetProject();
                }}
                className="cursor-pointer px-4 py-2 rounded-xl text-xs font-display font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 transition-all"
              >
                Reset Entire Project
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Weight progress bar percentage & color state
  const weightPct = Math.min(100, (stats.totalWeightLb / stats.maxWeightLb) * 100);
  const isNearWeightLimit = !stats.isOverweight && stats.totalWeightLb >= 27.5;

  // 3. MAIN WORKSHOP & TEST LAB SCREEN (Shared 3D Stage for seamless transition!)
  return (
    <div className="relative w-full h-full bg-[#070a10] overflow-hidden flex flex-col justify-between">
      {/* Full-bleed Interactive 3D Robot Stage */}
      <div className="absolute inset-0 z-0">
        <WorkshopStage3D
          config={config}
          stats={stats}
          mode={screen === 'test-lab' ? 'test-lab' : 'workshop'}
          installingCategory={installingCategory}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            soundEngine.playClick();
            setSelectedCategory(cat);
          }}
          cameraResetTrigger={cameraResetTrigger}
          activeTest={activeTest}
        />
      </div>

      {/* Cinematic Arena Transition Curtain */}
      {arenaTransitioning && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center animate-fade-in">
          <div className="text-xs font-mono-num uppercase tracking-widest text-amber-400 mb-2">
            LOWERING TURNTABLE PLATFORM • OPENING ARENA BAY DOORS
          </div>
          <div className="font-display text-3xl md:text-4xl font-black text-white tracking-wider">
            ENTERING COMBAT ARENA...
          </div>
        </div>
      )}

      {/* If in Test Lab mode, render TestLabOverlay on top of the 3D stage */}
      {screen === 'test-lab' ? (
        <TestLabOverlay
          config={config}
          stats={stats}
          activeTest={activeTest}
          completedTest={completedTest}
          onStartTest={handleStartTestLabTest}
          onReturnToCustomization={() => {
            setActiveTest({ testType: null, progress: 0, isRunning: false });
            setScreen('workshop');
          }}
          onEnterArena={handleEnterArenaTransition}
        />
      ) : (
        /* ============================================================
           MAIN WORKSHOP INTERFACE (Robot First, Data Second!)
           ============================================================ */
        <>
          {/* TOP BAR: Brand + Guidance Steps + Persistent 30.0 LB Weight Constraint */}
          <header className="relative z-20 px-4 md:px-6 pt-3.5 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
            {/* Left: Title & Quick Boss / Sound / Camera Controls */}
            <div className="pointer-events-auto flex items-center gap-3">
              <div className="holo-panel rounded-xl border border-slate-800 px-3.5 py-2 flex items-center gap-3">
                <div>
                  <div className="text-[10px] font-mono-num uppercase tracking-widest text-cyan-400">
                    COMBAT ROBOTICS SANDBOX
                  </div>
                  <div className="font-display text-lg md:text-xl font-black tracking-tight text-white">
                    BATTLEBOT INCUBATOR
                  </div>
                </div>

                {/* Color Trim Swatches */}
                <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-slate-800">
                  {ACCENT_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      title="Change Accent Trim"
                      onClick={() => {
                        soundEngine.playClick();
                        setConfig((prev) => ({ ...prev, accentColor: hex }));
                      }}
                      className={`cursor-pointer w-3.5 h-3.5 rounded-full transition-transform ${
                        config.accentColor === hex ? 'scale-125 ring-2 ring-white' : 'opacity-65 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              {(() => {
                const currentBoss = getBossById(selectedBossId);
                return (
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      setScreen('boss-intro');
                    }}
                    className="cursor-pointer holo-panel rounded-xl border border-amber-500/35 hover:border-amber-400 px-3 py-2 text-xs font-display font-bold text-amber-300 flex items-center gap-1.5 transition-colors"
                  >
                    <span>{currentBoss.icon}</span>
                    <span>LADDER: {currentBoss.name.toUpperCase()}</span>
                  </button>
                );
              })()}

              <button
                onClick={() => {
                  soundEngine.playClick();
                  setCameraResetTrigger((c) => c + 1);
                }}
                title="Reset 3D Camera"
                className="cursor-pointer holo-panel rounded-xl border border-slate-800 hover:border-slate-600 p-2 text-slate-300"
              >
                <Compass className="w-4 h-4" />
              </button>

              <button
                onClick={() => soundEngine.toggleMute()}
                title={muted ? 'Unmute Audio' : 'Mute Audio'}
                className="cursor-pointer holo-panel rounded-xl border border-slate-800 hover:border-slate-600 p-2 text-slate-300"
              >
                {muted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
              </button>
            </div>

            {/* Center Optional Subtle Guidance Strip */}
            <div className="hidden xl:flex items-center gap-2 holo-panel rounded-full border border-slate-800/80 px-4 py-1.5 text-[11px] font-mono-num text-slate-300">
              <span className="text-cyan-300 font-semibold">1. Choose weapon</span>
              <span className="text-slate-600">→</span>
              <span>2. Build around it</span>
              <span className="text-slate-600">→</span>
              <span>3. Watch 30 LB limit</span>
              <span className="text-slate-600">→</span>
              <span>4. Test & Battle</span>
            </div>

            {/* Right: PROMINENT 30.0 LB MAXIMUM WEIGHT DISPLAY */}
            <div
              className={`pointer-events-auto holo-panel rounded-2xl border px-4 py-2 min-w-[240px] transition-all ${
                stats.isOverweight
                  ? 'holo-glow-red border-red-500 bg-red-950/40'
                  : isNearWeightLimit
                  ? 'holo-glow-amber border-amber-500/60'
                  : 'holo-glow-cyan border-cyan-500/40'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-[10px] font-mono-num uppercase tracking-widest text-slate-300 font-semibold">
                  {stats.isOverweight ? (
                    <span className="text-red-300 font-extrabold">
                      OVERWEIGHT +{stats.overweightLb.toFixed(1)} LB
                    </span>
                  ) : (
                    'WEIGHT LIMIT'
                  )}
                </span>
                <span
                  className={`font-mono-num text-xl md:text-2xl font-black ${
                    stats.isOverweight
                      ? 'text-red-400'
                      : isNearWeightLimit
                      ? 'text-amber-300'
                      : 'text-white'
                  }`}
                >
                  {stats.totalWeightLb.toFixed(1)}{' '}
                  <span className="text-sm font-normal text-slate-400">/ 30.0 LB</span>
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    stats.isOverweight
                      ? 'bg-red-500'
                      : isNearWeightLimit
                      ? 'bg-amber-400'
                      : 'bg-cyan-400'
                  }`}
                  style={{ width: `${weightPct}%` }}
                />
              </div>
            </div>
          </header>

          {/* MIDDLE STAGE OVERLAYS: Temporary Install Consequence Toast (Left) & Compact Engineering HUD (Right) */}
          <div className="relative z-20 flex-1 flex items-center justify-between px-4 md:px-6 pointer-events-none">
            {/* Left: Temporary Component Installation Consequence Toast */}
            <div className="w-72">
              {consequenceToast && renderToast(consequenceToast)}
            </div>

            {/* Right: Compact Elegant Engineering Summary HUD + Warnings + [ENGINEERING DETAILS] */}
            <div className="pointer-events-auto holo-panel rounded-2xl border border-slate-800/90 p-3.5 w-72 md:w-80">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                <span className="text-[11px] font-mono-num uppercase tracking-widest text-cyan-300 font-semibold flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> LIVE ENGINEERING HUD
                </span>
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setShowEngineeringDetails(true);
                  }}
                  className="cursor-pointer text-[10px] font-mono-num uppercase px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300"
                >
                  ENGINEERING DETAILS
                </button>
              </div>

              {/* 6 Real-Unit Summary Metrics (No RPG stats!) */}
              <div className="grid grid-cols-2 gap-1.5 text-xs font-mono-num mb-2.5">
                <div className="rounded-lg bg-slate-900/85 px-2.5 py-1.5 border border-slate-800/80">
                  <div className="text-[9px] text-slate-400">SPEED</div>
                  <div className="font-bold text-white">{stats.topSpeedMph} MPH</div>
                </div>
                <div className="rounded-lg bg-slate-900/85 px-2.5 py-1.5 border border-slate-800/80">
                  <div className="text-[9px] text-slate-400">PUSHING FORCE</div>
                  <div className="font-bold text-white">{stats.pushingForceN} N</div>
                </div>
                <div className="rounded-lg bg-slate-900/85 px-2.5 py-1.5 border border-slate-800/80">
                  <div className="text-[9px] text-slate-400">WEAPON ENERGY</div>
                  <div className="font-bold text-amber-300">
                    {stats.weaponEnergyJ.toLocaleString()} J
                  </div>
                </div>
                <div className="rounded-lg bg-slate-900/85 px-2.5 py-1.5 border border-slate-800/80">
                  <div className="text-[9px] text-slate-400">SPIN-UP / CYCLE</div>
                  <div className="font-bold text-white">{stats.weaponSpinUpSec} SEC</div>
                </div>
                <div className="rounded-lg bg-slate-900/85 px-2.5 py-1.5 border border-slate-800/80">
                  <div className="text-[9px] text-slate-400">RUNTIME</div>
                  <div className="font-bold text-cyan-300">{stats.runtimeFormatted}</div>
                </div>
                <div className="rounded-lg bg-slate-900/85 px-2.5 py-1.5 border border-slate-800/80">
                  <div className="text-[9px] text-slate-400">STABILITY</div>
                  <div className="font-bold text-white">{stats.stabilityLabel}</div>
                </div>
              </div>

              {/* Active Engineering Warnings & Positive Observations */}
              <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
                {stats.warnings.slice(0, 4).map((w) => (
                  <div
                    key={w.id}
                    title={w.detail}
                    className={`text-[11px] font-mono-num px-2.5 py-1 rounded-md border ${
                      w.type === 'warning'
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                        : 'bg-emerald-950/35 border-emerald-500/35 text-emerald-200'
                    }`}
                  >
                    {w.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM CUSTOMIZATION DOCK: Category Navigation + Component Carousel + Primary Actions */}
          <footer className="relative z-20 px-4 md:px-6 pb-3.5 flex flex-col gap-2 pointer-events-none">
            {/* Category Bar + Armor Thickness Slider + Inventor Lab Button */}
            <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2">
              <div className="holo-panel rounded-xl border border-slate-800 p-1 flex flex-wrap items-center gap-1">
                {CATEGORY_TABS.map((tab) => {
                  const active = selectedCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        soundEngine.playClick();
                        setSelectedCategory(tab.id);
                      }}
                      className={`cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-display font-extrabold text-xs tracking-wider transition-all ${
                        active
                          ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tactile Armor Thickness Selector when ARMOR tab is open */}
              {selectedCategory === 'armor' && (
                <div className="holo-panel rounded-xl border border-cyan-500/40 px-3 py-1.5 flex items-center gap-2 animate-fade-in">
                  <span className="text-[11px] font-mono-num uppercase text-cyan-300 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5" /> THICKNESS:
                  </span>
                  {(['thin', 'medium', 'thick'] as ArmorThickness[]).map((th) => {
                    const spec = ARMOR_THICKNESS_OPTIONS[th];
                    const active = config.armorThickness === th;
                    return (
                      <button
                        key={th}
                        onClick={() => handleChangeArmorThickness(th)}
                        className={`cursor-pointer px-2.5 py-1 rounded-md text-xs font-mono-num font-bold transition-all ${
                          active
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {spec.label} ({spec.thicknessMm}mm)
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Right Quick Tools: ✨ INVENTOR LAB & COMPARE */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setComparePartId(activeCards[0]?.card.id ?? null);
                  }}
                  className="cursor-pointer holo-panel rounded-xl border border-slate-700 hover:border-cyan-400/50 px-3.5 py-2 text-xs font-display font-bold text-slate-200 flex items-center gap-1.5"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                  COMPARE {selectedCategory.toUpperCase()}
                </button>

                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setShowInventorLab(true);
                  }}
                  className="cursor-pointer rounded-xl bg-gradient-to-r from-purple-500/25 to-cyan-500/25 hover:from-purple-500/35 hover:to-cyan-500/35 border border-cyan-400/50 px-4 py-2 text-xs font-display font-extrabold text-cyan-200 flex items-center gap-1.5 shadow-md shadow-cyan-500/10"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                  ✨ INVENTOR LAB
                </button>
              </div>
            </div>

            {/* Component Cards Tray + Primary Action Bar ([TEST BOT] & [ENTER ARENA]) */}
            <div className="pointer-events-auto flex flex-col lg:flex-row items-stretch gap-2.5">
              {/* Horizontal Component Card Carousel */}
              <div className="holo-panel rounded-2xl border border-slate-800/90 p-2.5 flex-1 overflow-x-auto flex items-stretch gap-2.5">
                {activeCards.map(({ card, isEquipped, displayWeightLb }) => (
                  <div
                    key={card.id}
                    onClick={() => {
                      if (!isEquipped) {
                        handleEquipPart(selectedCategory, card.id, card.name);
                      }
                    }}
                    className={`cursor-pointer min-w-[220px] max-w-[245px] shrink-0 rounded-xl p-3 border transition-all flex flex-col justify-between ${
                      isEquipped
                        ? 'bg-cyan-950/35 border-cyan-400 shadow-lg shadow-cyan-500/15'
                        : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-display font-extrabold text-sm text-white leading-tight">
                          {card.name}
                        </h3>
                        <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded bg-slate-950 text-cyan-300 shrink-0">
                          {displayWeightLb.toFixed(1)} LB
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-2 line-clamp-1">
                        {card.subtitle}
                      </p>

                      {/* Concise Pros & Cons */}
                      <div className="space-y-0.5 text-[11px] mb-2.5">
                        {card.pros.slice(0, 2).map((p, i) => (
                          <div key={i} className="text-emerald-300 leading-snug line-clamp-1">
                            + {p}
                          </div>
                        ))}
                        {card.cons.slice(0, 2).map((c, i) => (
                          <div key={i} className="text-amber-300 leading-snug line-clamp-1">
                            - {c}
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEquipPart(selectedCategory, card.id, card.name);
                      }}
                      className={`cursor-pointer w-full py-1.5 rounded-lg font-display font-extrabold text-xs tracking-wider uppercase transition-all ${
                        isEquipped
                          ? 'bg-cyan-400/20 border border-cyan-400/50 text-cyan-200'
                          : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                      }`}
                    >
                      {isEquipped ? '✓ INSTALLED' : 'EQUIP'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Right CTA Column: [TEST BOT] & [ENTER ARENA] */}
              <div className="holo-panel rounded-2xl border border-slate-800/90 p-2.5 flex lg:flex-col justify-between gap-2 shrink-0 lg:w-56">
                <button
                  onClick={() => {
                    soundEngine.playInstall();
                    setScreen('test-lab');
                    handleStartTestLabTest('weapon');
                  }}
                  className="cursor-pointer flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 px-4 py-3 font-display font-extrabold text-sm text-cyan-300 flex items-center justify-center gap-2 transition-all"
                >
                  <FlaskConical className="w-4 h-4" />
                  TEST BOT
                </button>

                <button
                  onClick={handleEnterArenaTransition}
                  disabled={stats.isOverweight}
                  className={`cursor-pointer flex-1 rounded-xl px-4 py-3.5 font-display font-black text-sm md:text-base tracking-wide flex flex-col items-center justify-center transition-all ${
                    stats.isOverweight
                      ? 'bg-red-950/70 border border-red-500/60 text-red-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/25 transform hover:scale-[1.01]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Swords className="w-4 h-4" />
                    ENTER ARENA
                  </span>
                  {stats.isOverweight && (
                    <span className="text-[10px] font-mono-num uppercase tracking-wider text-red-200 mt-0.5">
                      OVERWEIGHT +{stats.overweightLb.toFixed(1)} LB
                    </span>
                  )}
                </button>
              </div>
            </div>
          </footer>
        </>
      )}

      {/* Modals & Drawers */}
      {showEngineeringDetails && (
        <EngineeringDetailsDrawer
          config={config}
          stats={stats}
          onClose={() => setShowEngineeringDetails(false)}
        />
      )}

      {showInventorLab && (
        <InventorLabModal
          onClose={() => setShowInventorLab(false)}
          onInstallCustomComponent={handleInstallCustomComponent}
        />
      )}

      {comparePartId && (
        <CompareModal
          category={selectedCategory}
          currentConfig={config}
          initialPartAId={comparePartId ?? undefined}
          onClose={() => setComparePartId(null)}
          onEquipPart={(cat, id) => handleEquipPart(cat, id)}
        />
      )}
    </div>
  );
}

export default BattlebotApp;
