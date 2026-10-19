import {
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import { INITIAL_MECHANICAL_CONFIG } from '../../data/teamData';
import { computeTeamEngineeringSummary } from '../../simulation/integrationValidator';
import {
  type ArmorId,
  type ChassisId,
  type ComponentCategory,
  type DriveId,
  type MechanicalConfiguration,
  type MechanicalWorkflowStage,
  type PurchasedMechanicalPart,
  type TeamRobotProject,
  type UtilityId,
  type WeaponId,
  type WheelsId,
} from '../../types/robot';
import { ResetTaskModal } from './ResetTaskModal';
import { AssemblyWorkbench } from './mechanical/AssemblyWorkbench';
import { BotBayMarketplace } from './mechanical/BotBayMarketplace';
import { DeliveryAnimationModal } from './mechanical/DeliveryAnimationModal';
import { MechanicalChecklistBar } from './mechanical/MechanicalChecklistBar';
import { MechanicalInspectionModal } from './mechanical/MechanicalInspectionModal';

interface MechanicalScreenProps {
  project: TeamRobotProject;
  onUpdateMechanical: (nextMechanical: MechanicalConfiguration) => void;
  onReturnToDashboard: () => void;
}

export const MechanicalScreen: React.FC<MechanicalScreenProps> = ({
  project,
  onUpdateMechanical,
  onReturnToDashboard,
}) => {
  const mech = project.mechanical;
  const summary = computeTeamEngineeringSummary(project);

  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [inspectionAttempted, setInspectionAttempted] = useState(false);
  const [pendingOrderedParts, setPendingOrderedParts] = useState<PurchasedMechanicalPart[]>([]);

  // Default stage resolution
  const stage: MechanicalWorkflowStage = useMemo(() => {
    if (mech.workflowStage) return mech.workflowStage;
    if (mech.isCompleted) return 'workbench';
    if (mech.purchasedParts && Object.keys(mech.purchasedParts).length >= 5) {
      return mech.partsDelivered ? 'workbench' : 'delivery';
    }
    return 'marketplace';
  }, [mech.workflowStage, mech.isCompleted, mech.purchasedParts, mech.partsDelivered]);

  const purchasedPartsMap = mech.purchasedParts || {};
  const purchasedPartsList = Object.values(purchasedPartsMap);
  const assembledCategories = mech.assembledParts || (mech.isCompleted ? ['chassis', 'drive', 'wheels', 'armor', 'weapon'] : []);

  const requiredFulfilledCount = ['chassis', 'drive', 'wheels', 'armor', 'weapon'].filter(
    (c) => Boolean(purchasedPartsMap[c])
  ).length;

  const handleResetMechanical = () => {
    soundEngine.playInstall();
    onUpdateMechanical({
      ...INITIAL_MECHANICAL_CONFIG,
      purchasedParts: {},
      assembledParts: [],
      workflowStage: 'marketplace',
      partsDelivered: false,
      inspectionPassed: false,
      isCompleted: false,
    });
    setShowResetModal(false);
    setInspectionAttempted(false);
  };

  const handleOrderParts = (parts: PurchasedMechanicalPart[]) => {
    const partsMap: Record<string, PurchasedMechanicalPart> = {};
    let newChassisId = mech.chassisId;
    let newDriveId = mech.driveId;
    let newWheelsId = mech.wheelsId;
    let newArmorId = mech.armorId;
    let newWeaponId = mech.weaponId;
    let newUtilityId = mech.utilityId;

    parts.forEach((p) => {
      partsMap[p.category] = p;
      if (p.category === 'chassis') newChassisId = p.partId as ChassisId;
      if (p.category === 'drive') newDriveId = p.partId as DriveId;
      if (p.category === 'wheels') newWheelsId = p.partId as WheelsId;
      if (p.category === 'armor') newArmorId = p.partId as ArmorId;
      if (p.category === 'weapon') newWeaponId = p.partId as WeaponId;
      if (p.category === 'utility') newUtilityId = p.partId as UtilityId;
    });

    onUpdateMechanical({
      ...mech,
      chassisId: newChassisId,
      driveId: newDriveId,
      wheelsId: newWheelsId,
      armorId: newArmorId,
      weaponId: newWeaponId,
      utilityId: newUtilityId,
      purchasedParts: partsMap,
      assembledParts: [],
      partsDelivered: false,
      inspectionPassed: false,
      isCompleted: false,
      workflowStage: 'delivery',
    });

    setPendingOrderedParts(parts);
    setShowDeliveryModal(true);
  };

  const handleDeliveryComplete = () => {
    setShowDeliveryModal(false);
    onUpdateMechanical({
      ...mech,
      partsDelivered: true,
      workflowStage: 'workbench',
    });
  };

  const handleMountPart = (category: ComponentCategory) => {
    const nextAssembled = Array.from(new Set([...assembledCategories, category]));
    onUpdateMechanical({
      ...mech,
      assembledParts: nextAssembled,
    });
  };

  const handleUnmountPart = (category: ComponentCategory) => {
    const nextAssembled = assembledCategories.filter((c) => c !== category);
    onUpdateMechanical({
      ...mech,
      assembledParts: nextAssembled,
      inspectionPassed: false,
      isCompleted: false,
    });
  };

  const handleRunInspection = () => {
    setInspectionAttempted(true);
    setShowInspectionModal(true);
  };

  const handleConfirmVerified = () => {
    setShowInspectionModal(false);
    onUpdateMechanical({
      ...mech,
      inspectionPassed: true,
      isCompleted: true,
    });
  };

  const handleReturnToMarketplace = () => {
    setShowInspectionModal(false);
    onUpdateMechanical({
      ...mech,
      workflowStage: 'marketplace',
    });
  };

  const handleNavigateStage = (targetStage: MechanicalWorkflowStage) => {
    soundEngine.playClick();
    onUpdateMechanical({
      ...mech,
      workflowStage: targetStage,
    });
  };

  const toggleComplete = () => {
    soundEngine.playClick();
    onUpdateMechanical({ ...mech, isCompleted: !mech.isCompleted });
  };

  return (
    <div className="relative w-full h-full bg-[#070b16] text-white overflow-hidden flex flex-col justify-between select-none">
      {/* Top Header */}
      <div className="relative z-20 p-4 md:px-6 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-[#070b16] via-[#070b16]/95 to-slate-950/80 border-b border-slate-800">
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
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] font-mono-num uppercase tracking-wider text-cyan-400 font-semibold">
                DISCIPLINE 01 • MECHANICAL ENGINEER
              </span>
            </div>
            <h2 className="font-display font-black text-xl text-white">PHYSICAL ARCHITECTURE</h2>
          </div>
        </div>

        {/* Live Badges & Actions */}
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
              <span className="text-slate-400 block text-[9px]">AVAILABLE BUDGET</span>
              <span className="font-bold text-cyan-300">${summary.effectiveBudgetUsd}</span>
            </div>
          </div>

          <button
            onClick={() => setShowResetModal(true)}
            title="Reset Mechanical challenge"
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
            {mech.isCompleted ? 'DISCIPLINE COMPLETE ✓' : 'MARK COMPLETE'}
          </button>
        </div>
      </div>

      {/* Persistent Top Workflow Checklist Bar */}
      <MechanicalChecklistBar
        currentStage={stage}
        purchasedCount={requiredFulfilledCount}
        totalRequired={5}
        partsDelivered={Boolean(mech.partsDelivered || mech.isCompleted)}
        assembledCount={assembledCategories.filter((c) => ['chassis', 'drive', 'wheels', 'armor', 'weapon'].includes(c)).length}
        inspectionPassed={Boolean(mech.inspectionPassed || mech.isCompleted)}
        inspectionAttempted={inspectionAttempted}
        onNavigateStage={handleNavigateStage}
      />

      {/* Main Stage View */}
      {stage === 'marketplace' && (
        <BotBayMarketplace
          project={project}
          currentPurchases={purchasedPartsMap}
          onOrderParts={handleOrderParts}
        />
      )}

      {(stage === 'workbench' || stage === 'delivery' || stage === 'inspection') && (
        <AssemblyWorkbench
          project={project}
          purchasedParts={purchasedPartsList}
          assembledCategories={assembledCategories}
          onMountPart={handleMountPart}
          onUnmountPart={handleUnmountPart}
          onRunInspection={handleRunInspection}
          onReturnToMarketplace={handleReturnToMarketplace}
        />
      )}

      {/* Parts Delivery Animation Modal */}
      <DeliveryAnimationModal
        isOpen={showDeliveryModal}
        orderedParts={pendingOrderedParts.length > 0 ? pendingOrderedParts : purchasedPartsList}
        onComplete={handleDeliveryComplete}
      />

      {/* Mechanical Inspection Modal */}
      <MechanicalInspectionModal
        isOpen={showInspectionModal}
        onClose={() => setShowInspectionModal(false)}
        summary={summary}
        allAssembled={assembledCategories.filter((c) => ['chassis', 'drive', 'wheels', 'armor', 'weapon'].includes(c)).length >= 5}
        onReturnToMarketplace={handleReturnToMarketplace}
        onConfirmVerified={handleConfirmVerified}
      />

      {/* Reset Mechanical Task Confirmation Modal */}
      <ResetTaskModal
        isOpen={showResetModal}
        roleTitle="MECHANICAL"
        description="This will restore the Mechanical challenge to its starting configuration, clearing purchases, inventory, and assembly. Business sponsorships, Electrical wiring, and Software will NOT be changed."
        onConfirm={handleResetMechanical}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
};
