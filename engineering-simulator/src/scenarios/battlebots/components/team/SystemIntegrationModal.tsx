import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Cpu,
  ShieldAlert,
  Swords,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import React from 'react';
import { soundEngine } from '../../audio/soundEngine';
import { type SystemIntegrationReport, type TeamRobotProject } from '../../types/robot';
import { computeTeamEngineeringSummary } from '../../simulation/integrationValidator';

interface SystemIntegrationModalProps {
  isOpen: boolean;
  project: TeamRobotProject;
  report: SystemIntegrationReport;
  onClose: () => void;
  onEnterArena: () => void;
  onSelectRole: (role: 'mechanical' | 'electrical' | 'software' | 'project-lead') => void;
}

export const SystemIntegrationModal: React.FC<SystemIntegrationModalProps> = ({
  isOpen,
  project,
  report,
  onClose,
  onEnterArena,
  onSelectRole,
}) => {
  if (!isOpen) return null;

  const summary = computeTeamEngineeringSummary(project);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="holo-panel rounded-3xl border border-slate-700 max-w-3xl w-full p-6 sm:p-8 bg-[#0b101d] my-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl border ${
                report.overallPassed
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-400'
              }`}
            >
              {report.overallPassed ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="text-[10px] font-mono-num uppercase tracking-widest text-slate-400">
                OFFICIAL TECHNICAL INSPECTION
              </div>
              <h2 className="font-display font-black text-2xl text-white tracking-wide">
                SYSTEM INTEGRATION REVIEW
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overall Status Banner */}
        <div
          className={`p-4 rounded-2xl border mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${
            report.overallPassed
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {report.overallPassed ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="font-display font-extrabold text-base tracking-wide text-white">
                {report.overallPassed
                  ? 'SYSTEM INTEGRATION PASSED — CLEARED FOR COMBAT'
                  : 'SYSTEM INTEGRATION FAILED — ROBOT NOT COMPETITION READY'}
              </div>
              <div className="text-xs text-slate-300">
                {report.overallPassed
                  ? 'All four disciplines satisfy physical, electrical, algorithmic, and financial requirements.'
                  : 'Discrepancies identified between subsystems. The team must collaborate to resolve conflicts.'}
              </div>
            </div>
          </div>
          {report.overallPassed && (
            <button
              onClick={() => {
                soundEngine.playArenaHorn();
                onEnterArena();
              }}
              className="cursor-pointer shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-display font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-all transform hover:scale-105"
            >
              <Swords className="w-4 h-4" />
              ENTER ARENA →
            </button>
          )}
        </div>

        {/* 4 Disciplines Scorecards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {/* Mechanical */}
          <button
            onClick={() => onSelectRole('mechanical')}
            className={`cursor-pointer text-left p-3.5 rounded-xl border transition-all ${
              report.mechanicalPassed
                ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-cyan-400 text-xs font-mono-num flex items-center gap-1 font-semibold">
                <Wrench className="w-3.5 h-3.5" /> MECHANICAL
              </span>
              {report.mechanicalPassed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="text-xs font-mono-num text-slate-200 font-bold">
              {summary.totalWeightLb.toFixed(1)} / 30.0 LB
            </div>
            <div className="text-[10px] font-mono-num text-slate-400 mt-0.5">
              {report.mechanicalPassed ? 'WEIGHT LEGAL' : 'OVERWEIGHT'}
            </div>
          </button>

          {/* Electrical */}
          <button
            onClick={() => onSelectRole('electrical')}
            className={`cursor-pointer text-left p-3.5 rounded-xl border transition-all ${
              report.electricalPassed
                ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-amber-400 text-xs font-mono-num flex items-center gap-1 font-semibold">
                <Zap className="w-3.5 h-3.5" /> ELECTRICAL
              </span>
              {report.electricalPassed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="text-xs font-mono-num text-slate-200 font-bold">
              {report.electricalPassed ? 'HARNESS VERIFIED'
                : `${project.electrical.wires?.length || 0} / 14 WIRES`}
            </div>
            <div className="text-[10px] font-mono-num text-slate-400 mt-0.5">
              {report.electricalPassed ? 'STANDARD HARNESS ✓'
                : 'WIRING INCOMPLETE'}
            </div>
          </button>

          {/* Software */}
          <button
            onClick={() => onSelectRole('software')}
            className={`cursor-pointer text-left p-3.5 rounded-xl border transition-all ${
              report.softwarePassed
                ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-emerald-400 text-xs font-mono-num flex items-center gap-1 font-semibold">
                <Cpu className="w-3.5 h-3.5" /> SOFTWARE
              </span>
              {report.softwarePassed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="text-xs font-mono-num text-slate-200 font-bold">
              {project.software.softwareUploaded
                ? 'CODE UPLOADED'
                : project.software.bugsFixed
                ? 'READY TO UPLOAD'
                : 'BUGS DETECTED'}
            </div>
            <div className="text-[10px] font-mono-num text-slate-400 mt-0.5">
              {report.softwarePassed ? 'SOFTWARE VERIFIED' : 'UPLOAD REQUIRED'}
            </div>
          </button>

          {/* Project Lead */}
          <button
            onClick={() => onSelectRole('project-lead')}
            className={`cursor-pointer text-left p-3.5 rounded-xl border transition-all ${
              report.projectLeadPassed
                ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-purple-400 text-xs font-mono-num flex items-center gap-1 font-semibold">
                <Briefcase className="w-3.5 h-3.5" /> PROJECT LEAD
              </span>
              {report.projectLeadPassed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="text-xs font-mono-num text-slate-200 font-bold">
              ${summary.totalCostUsd} / ${summary.effectiveBudgetUsd}
            </div>
            <div className="text-[10px] font-mono-num text-slate-400 mt-0.5">
              {project.projectLead.sponsorshipUsd > 0
                ? `${project.projectLead.sponsorTier.toUpperCase()} (+$${project.projectLead.sponsorshipUsd})`
                : 'NO SPONSOR'}
            </div>
          </button>
        </div>

        {/* Detailed Failures & Diagnostic Observations */}
        {report.failures.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-mono-num uppercase tracking-wider text-rose-400 font-semibold mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> BLOCKING INTEGRATION ISSUES ({report.failures.length})
            </div>
            <div className="space-y-2">
              {report.failures.map((msg, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-rose-950/30 border border-rose-500/40 p-3 text-xs font-mono-num text-rose-200 leading-relaxed"
                >
                  {msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Engineering Observations / Warnings */}
        {report.warnings.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-mono-num uppercase tracking-wider text-amber-400 font-semibold mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> ENGINEERING ADVISORIES ({report.warnings.length})
            </div>
            <div className="space-y-2">
              {report.warnings.map((msg, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-amber-950/30 border border-amber-500/40 p-3 text-xs font-mono-num text-amber-200 leading-relaxed"
                >
                  {msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <div className="text-xs font-mono-num text-slate-400 hidden sm:block">
            Click on any role above to return and adjust design tradeoffs.
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer px-5 py-2.5 rounded-xl text-xs font-mono-num font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors ml-auto"
          >
            CLOSE REVIEW
          </button>
        </div>
      </div>
    </div>
  );
};

