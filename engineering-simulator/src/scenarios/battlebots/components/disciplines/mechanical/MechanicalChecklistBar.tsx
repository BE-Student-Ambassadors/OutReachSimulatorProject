import React from 'react';
import {
  CheckCircle2,
  Package,
  ShoppingCart,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  Circle,
} from 'lucide-react';
import { type MechanicalWorkflowStage } from '../../../types/robot';

interface MechanicalChecklistBarProps {
  currentStage: MechanicalWorkflowStage;
  purchasedCount: number;
  totalRequired: number;
  partsDelivered: boolean;
  assembledCount: number;
  inspectionPassed: boolean;
  inspectionAttempted: boolean;
  onNavigateStage?: (stage: MechanicalWorkflowStage) => void;
}

export const MechanicalChecklistBar: React.FC<MechanicalChecklistBarProps> = ({
  currentStage,
  purchasedCount,
  totalRequired,
  partsDelivered,
  assembledCount,
  inspectionPassed,
  inspectionAttempted,
  onNavigateStage,
}) => {
  const isBuyDone = purchasedCount >= totalRequired;
  const isReceiveDone = partsDelivered;
  const isAssembleDone = assembledCount >= totalRequired;

  const steps = [
    {
      id: 'marketplace' as MechanicalWorkflowStage,
      stepNumber: '1',
      label: 'Buy Robot Parts',
      icon: <ShoppingCart className="w-3.5 h-3.5" />,
      statusText: `${purchasedCount} / ${totalRequired}`,
      isDone: isBuyDone,
      isActive: currentStage === 'marketplace',
      allowClick: true,
    },
    {
      id: 'delivery' as MechanicalWorkflowStage,
      stepNumber: '2',
      label: 'Receive Parts',
      icon: <Package className="w-3.5 h-3.5" />,
      statusText: isReceiveDone ? 'Delivered ✓' : isBuyDone ? 'Ready to order' : 'Pending',
      isDone: isReceiveDone,
      isActive: currentStage === 'delivery',
      allowClick: isBuyDone,
    },
    {
      id: 'workbench' as MechanicalWorkflowStage,
      stepNumber: '3',
      label: 'Assemble Robot',
      icon: <Wrench className="w-3.5 h-3.5" />,
      statusText: `${assembledCount} / ${totalRequired}`,
      isDone: isAssembleDone,
      isActive: currentStage === 'workbench',
      allowClick: isReceiveDone,
    },
    {
      id: 'inspection' as MechanicalWorkflowStage,
      stepNumber: '4',
      label: 'Mechanical Inspection',
      icon: inspectionPassed ? (
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
      ) : inspectionAttempted ? (
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
      ) : (
        <ShieldCheck className="w-3.5 h-3.5" />
      ),
      statusText: inspectionPassed
        ? 'Pass ✓'
        : inspectionAttempted
        ? 'Failed ✕'
        : isAssembleDone
        ? 'Ready'
        : 'Pending',
      isDone: inspectionPassed,
      isActive: currentStage === 'inspection',
      allowClick: isAssembleDone,
    },
  ];

  return (
    <div className="w-full bg-emerald-50/70 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs font-sans overflow-x-auto gap-3 select-none">
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <span className="text-[10px] text-emerald-900 font-mono font-bold tracking-wider uppercase hidden sm:inline">
          WORKFLOW:
        </span>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2 flex-1 justify-start min-w-[580px]">
        {steps.map((step, idx) => {
          const isClickable = step.allowClick && onNavigateStage;

          return (
            <React.Fragment key={step.id}>
              <div
                onClick={() => {
                  if (isClickable && onNavigateStage) {
                    onNavigateStage(step.id);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                  isClickable ? 'cursor-pointer' : 'cursor-default opacity-85'
                } ${
                  step.isActive
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : step.isDone
                    ? 'bg-emerald-700 border-emerald-700 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className="size-4 rounded-full flex items-center justify-center text-[10px] font-bold">
                  {step.isDone ? (
                    <CheckCircle2 className="size-3.5 text-white" />
                  ) : (
                    <Circle className="size-3.5 text-slate-400" />
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold">
                    {step.stepNumber}. {step.label}
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      step.isActive || step.isDone
                        ? 'text-white/80'
                        : step.statusText === 'Failed ✕'
                        ? 'text-rose-600 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    ({step.statusText})
                  </span>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div
                  className={`h-px w-3 transition-colors ${
                    step.isDone ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
