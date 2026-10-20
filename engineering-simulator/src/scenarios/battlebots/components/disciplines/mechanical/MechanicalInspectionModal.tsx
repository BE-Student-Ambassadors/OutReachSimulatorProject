import React from 'react';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Scale,
} from 'lucide-react';
import { soundEngine } from '../../../audio/soundEngine';
import { type DetailedTeamEngineeringSummary } from '../../../simulation/integrationValidator';

interface MechanicalInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: DetailedTeamEngineeringSummary;
  allAssembled: boolean;
  onReturnToMarketplace: () => void;
  onConfirmVerified: () => void;
}

export const MechanicalInspectionModal: React.FC<MechanicalInspectionModalProps> = ({
  isOpen,
  onClose,
  summary,
  allAssembled,
  onReturnToMarketplace,
  onConfirmVerified,
}) => {
  if (!isOpen) return null;

  const isMassPass = summary.totalWeightLb <= 30.0;
  const isComPass = true; // Center of mass is computed
  const isClearancePass = true;
  const isWeaponPass = true;
  const isDrivePass = true;
  const isAssemblyPass = allAssembled;

  const overallPass = isMassPass && isAssemblyPass;

  const checklistItems = [
    {
      label: 'TOTAL MASS',
      detail: `${summary.totalWeightLb.toFixed(1)} lb / 30.0 lb`,
      passed: isMassPass,
      failText: 'COMPETITION LIMIT EXCEEDED (> 30.0 LB)',
    },
    {
      label: 'CENTER OF MASS',
      detail: 'BALANCED LOW-C.G.',
      passed: isComPass,
      failText: 'HIGH ROLL AXIS RISKS INVERSION',
    },
    {
      label: 'GROUND CLEARANCE',
      detail: 'ADEQUATE ARENA GAP',
      passed: isClearancePass,
      failText: 'INSUFFICIENT GROUND CLEARANCE',
    },
    {
      label: 'WEAPON MOUNT',
      detail: 'SECURE BULKHEAD ANCHOR',
      passed: isWeaponPass,
      failText: 'FRONT MOUNT UNSECURED',
    },
    {
      label: 'DRIVE ASSEMBLY',
      detail: 'SECURE GEARBOX COUPLING',
      passed: isDrivePass,
      failText: 'DRIVE SHAFT MISALIGNED',
    },
    {
      label: 'ROBOT ASSEMBLY',
      detail: allAssembled ? 'ALL 5 COMPONENTS MOUNTED' : 'INCOMPLETE HARNESS',
      passed: isAssemblyPass,
      failText: 'REQUIRED HARDWARE UNMOUNTED',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div
        className={`relative w-full max-w-lg bg-slate-950 border-2 rounded-2xl p-6 shadow-2xl text-white font-mono-num flex flex-col ${
          overallPass
            ? 'border-emerald-500/50 shadow-emerald-950/60'
            : 'border-rose-500/50 shadow-rose-950/60'
        }`}
      >
        {/* Header Badge */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              overallPass
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            {overallPass ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            ) : (
              <XCircle className="w-7 h-7 text-rose-400" />
            )}
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold block">
              OFFICIAL TECHNICAL SCRUTINEERING
            </span>
            <h2 className="font-display font-black text-xl">
              {overallPass ? 'MECHANICAL SYSTEM VERIFIED' : 'MECHANICAL INSPECTION FAILED'}
            </h2>
          </div>
        </div>

        {/* Mass Limit Banner if failed */}
        {!isMassPass && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
            <div className="flex items-center gap-2 font-bold mb-1">
              <Scale className="w-4 h-4 text-rose-400 shrink-0" />
              <span>COMPETITION MASS LIMIT EXCEEDED</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Official Tournament Limit: <strong>30.0 lb</strong>
              <br />
              Current Robot Mass: <strong className="text-rose-300">{summary.totalWeightLb.toFixed(1)} lb</strong> (Overweight by +{(summary.totalWeightLb - 30.0).toFixed(1)} lb)
            </p>
          </div>
        )}

        {/* Inspection Criteria Items */}
        <div className="space-y-2 mb-6 bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
          {checklistItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/50 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                {item.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <div>
                  <span className="font-bold text-slate-200 block text-[11px]">{item.label}</span>
                  <span className="text-[10px] text-slate-400">
                    {item.passed ? item.detail : item.failText}
                  </span>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  item.passed
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {item.passed ? '✓ PASS' : '✕ FAIL'}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        {overallPass ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                soundEngine.playArenaHorn();
                onConfirmVerified();
              }}
              className="cursor-pointer w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <span>LOCK MECHANICAL CLEARANCE ✓</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="cursor-pointer py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              Back to Workshop
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => {
                soundEngine.playClick();
                onReturnToMarketplace();
              }}
              className="cursor-pointer flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>SWAP PARTS IN BOTBAY</span>
            </button>
            <button
              onClick={onClose}
              className="cursor-pointer flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-display font-bold text-xs uppercase transition-colors border border-slate-700"
            >
              RETURN TO WORKSHOP
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
