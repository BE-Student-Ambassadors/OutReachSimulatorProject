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
import { MechanicalInspectionModal } from './mechanical/MechanicalInspectionModal';

interface MechanicalScreenProps {
  project: TeamRobotProject;
  onUpdateMechanical: (nextMechanical: MechanicalConfiguration) => void;
  onReturnToDashboard: () => void;
  hideHeader?: boolean;
}

export const MechanicalScreen: React.FC<MechanicalScreenProps> = ({
  project,
  onUpdateMechanical,
  onReturnToDashboard,
  hideHeader = false,
}) => {
  const mech = project.mechanical;
  const summary = computeTeamEngineeringSummary(project);

  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
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
    <div className="relative w-full h-full bg-slate-50 text-slate-800 overflow-hidden flex flex-col justify-between select-none">
      {/* Optional Top Sub-Header (Only shown if hideHeader is false) */}
      {!hideHeader && (
        <div className="relative z-20 p-3.5 md:px-5 flex items-center justify-between pointer-events-auto bg-white border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onReturnToDashboard();
              }}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-700 font-bold">
                  Discipline 01 • Mechanical
                </span>
              </div>
              <h2 className="font-display font-black text-lg text-slate-900 leading-tight">Robot Structure & Marketplace</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              title="Reset Mechanical task"
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>↻ Reset Task</span>
            </button>

            <button
              type="button"
              onClick={toggleComplete}
              className={`cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-display font-bold transition-all ${
                mech.isCompleted
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{mech.isCompleted ? 'Discipline Complete ✓' : 'Mark Complete'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Stage View */}
      {stage === 'marketplace' && (
        <BotBayMarketplace
          project={project}
          currentPurchases={purchasedPartsMap}
          onOrderParts={handleOrderParts}
          onGoToWorkbench={() => handleNavigateStage('workbench')}
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
