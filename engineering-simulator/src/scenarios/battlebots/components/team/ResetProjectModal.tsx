import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import React from 'react';

interface ResetProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: () => void;
}

export const ResetProjectModal: React.FC<ResetProjectModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="holo-panel rounded-2xl border border-red-500/40 p-6 md:p-8 max-w-md w-full shadow-2xl shadow-red-950/50 bg-[#0d121f]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5 text-red-400">
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="font-display font-extrabold text-lg text-white tracking-wide">
              RESET TEAM PROJECT?
            </h3>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-6 font-sans">
          This will reset all four engineering roles, integration status, and battle results for the next student team.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2.5 rounded-xl text-xs font-mono-num font-semibold text-slate-300 hover:text-white bg-slate-850 hover:bg-slate-800 border border-slate-700 transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={() => {
              onConfirmReset();
              onClose();
            }}
            className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-display font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-600/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESET PROJECT
          </button>
        </div>
      </div>
    </div>
  );
};

