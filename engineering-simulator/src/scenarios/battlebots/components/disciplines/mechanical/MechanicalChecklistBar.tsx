import React from 'react';
import {
  CheckCircle2,
  Package,
  ShoppingCart,
  Wrench,
  ShieldCheck,
  AlertTriangle,
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
      label: 'BUY YOUR ROBOT PARTS',
      icon: <ShoppingCart className="w-3.5 h-3.5" />,
      statusText: `${purchasedCount} / ${totalRequired}`,
      isDone: isBuyDone,
      isActive: currentStage === 'marketplace',
      allowClick: true,
    },
    {
      id: 'delivery' as MechanicalWorkflowStage,
      stepNumber: '2',
      label: 'RECEIVE YOUR PARTS',
      icon: <Package className="w-3.5 h-3.5" />,
      statusText: isReceiveDone ? 'DELIVERED ✓' : isBuyDone ? 'READY TO ORDER' : 'PENDING',
      isDone: isReceiveDone,
      isActive: currentStage === 'delivery',
      allowClick: isBuyDone,
    },
    {
      id: 'workbench' as MechanicalWorkflowStage,
      stepNumber: '3',
      label: 'ASSEMBLE YOUR ROBOT',
      icon: <Wrench className="w-3.5 h-3.5" />,
      statusText: `${assembledCount} / ${totalRequired}`,
      isDone: isAssembleDone,
      isActive: currentStage === 'workbench',
      allowClick: isReceiveDone,
    },
    {
      id: 'inspection' as MechanicalWorkflowStage,
      stepNumber: '4',
      label: 'PASS MECHANICAL CHECK',
      icon: inspectionPassed ? (
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
      ) : inspectionAttempted ? (
        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
      ) : (
        <ShieldCheck className="w-3.5 h-3.5" />
      ),
      statusText: inspectionPassed
        ? 'PASS ✓'
        : inspectionAttempted
        ? 'FAILED ✕'
        : isAssembleDone
        ? 'READY TO INSPECT'
        : 'NOT READY',
      isDone: inspectionPassed,
      isActive: currentStage === 'inspection',
      allowClick: isAssembleDone,
    },
  ];

  return (
    <div className="w-full bg-slate-950/90 border-y border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs font-mono-num overflow-x-auto gap-3 select-none">
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <span className="text-[10px] text-cyan-400/80 font-bold tracking-wider uppercase hidden sm:inline">
          WORKFLOW:
        </span>
      </div>

      <div className="flex items-center gap-2 md:gap-3 flex-1 justify-between min-w-[620px]">
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                  isClickable ? 'cursor-pointer' : 'cursor-default opacity-85'
                } ${
                  step.isActive
                    ? 'bg-cyan-500/15 border-cyan-400/60 text-white shadow-sm shadow-cyan-500/20'
                    : step.isDone
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-400'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step.isDone
                      ? 'bg-emerald-500 text-slate-950'
                      : step.isActive
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {step.isDone ? <CheckCircle2 className="w-3 h-3 stroke-[3]" /> : step.stepNumber}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold tracking-wide">
                      {step.label}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono-num font-semibold ${
                      step.isDone
                        ? 'text-emerald-400'
                        : step.isActive
                        ? 'text-cyan-300'
                        : step.statusText === 'FAILED ✕'
                        ? 'text-rose-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.statusText}
                  </span>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div
                  className={`h-px w-4 md:w-6 transition-colors ${
                    step.isDone ? 'bg-emerald-500/50' : 'bg-slate-800'
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

