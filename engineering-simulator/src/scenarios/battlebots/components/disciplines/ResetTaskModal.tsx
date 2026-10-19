import { AlertTriangle, RotateCcw } from 'lucide-react';
import React from 'react';
import { soundEngine } from '../../audio/soundEngine';

interface ResetTaskModalProps {
  isOpen: boolean;
  roleTitle: string; // e.g. "MECHANICAL", "ELECTRICAL", "SOFTWARE", "BUSINESS"
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ResetTaskModal: React.FC<ResetTaskModalProps> = ({
  isOpen,
  roleTitle,
  description = 'Your progress for this task will be cleared. Other team tasks will not be affected.',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0b1020] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono-num text-amber-400 uppercase tracking-widest font-bold block">
              RESET CONFIRMATION
            </span>
            <h3 className="font-display font-black text-lg text-white">
              RESET {roleTitle.toUpperCase()} TASK?
            </h3>
          </div>
        </div>

        <p className="text-xs text-slate-300 font-mono-num leading-relaxed mb-6">
          {description}
        </p>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={() => {
              soundEngine.playClick();
              onCancel();
            }}
            className="cursor-pointer px-4 py-2 rounded-xl text-xs font-mono-num font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-700 hover:border-slate-600 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              onConfirm();
            }}
            className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-display font-bold text-rose-200 bg-rose-600/80 hover:bg-rose-500 border border-rose-500 shadow-md shadow-rose-900/30 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Task
          </button>
        </div>
      </div>
    </div>
  );
};

