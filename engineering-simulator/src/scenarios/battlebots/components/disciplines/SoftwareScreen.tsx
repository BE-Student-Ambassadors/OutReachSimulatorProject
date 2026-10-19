import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Code2,
  Cpu,
  Laptop,
  RotateCcw,
  ShieldAlert,
  Terminal,
  UploadCloud,
  Usb,
} from 'lucide-react';
import React, { useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import {
  BOTCODE_VARIANTS,
  evaluateBotCode,
  INITIAL_BOTCODE_SCRIPT,
  type BotCodeValidation,
} from '../../data/teamData';
import {
  type SoftwareConfiguration,
  type TeamRobotProject,
} from '../../types/robot';
import { ResetTaskModal } from './ResetTaskModal';

interface SoftwareScreenProps {
  project: TeamRobotProject;
  onUpdateSoftware: (nextSoftware: SoftwareConfiguration) => void;
  onReturnToDashboard: () => void;
  hideHeader?: boolean;
}

export const SoftwareScreen: React.FC<SoftwareScreenProps> = ({
  project,
  onUpdateSoftware,
  onReturnToDashboard,
  hideHeader = false,
}) => {
  const soft = project.software;
  const originalScript = soft.initialScript || INITIAL_BOTCODE_SCRIPT;

  // Step 1: Physical connection
  const [cableConnected, setCableConnected] = useState(soft.computerConnected || soft.softwareUploaded);
  const [selectedRobotPort, setSelectedRobotPort] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Step 2: Code Editor State
  const [code, setCode] = useState(soft.codeContent || originalScript);
  const [lastCheck, setLastCheck] = useState<BotCodeValidation | null>(() => {
    if (soft.bugsFixed || soft.softwareUploaded) {
      return evaluateBotCode(soft.codeContent || originalScript);
    }
    return null;
  });
  const [showReference, setShowReference] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const currentEval = evaluateBotCode(code);

  const updateSoft = (updated: Partial<SoftwareConfiguration>) => {
    onUpdateSoftware({ ...soft, ...updated });
  };

  const handleResetSoftware = () => {
    soundEngine.playInstall();
    setCableConnected(false);
    setSelectedRobotPort(null);
    setConnectionError(null);
    setCode(originalScript);
    setLastCheck(null);
    setIsUploading(false);
    setUploadProgress(0);
    updateSoft({
      computerConnected: false,
      codeContent: originalScript,
      bugsFixed: false,
      softwareUploaded: false,
      testPassed: false,
      isCompleted: false,
    });
    setShowResetModal(false);
  };

  const handleConnectPort = (port: 'POWER' | 'CONTROL' | 'MOTOR' | 'SENSOR') => {
    soundEngine.playClick();
    setSelectedRobotPort(port);

    if (port === 'CONTROL') {
      soundEngine.playInstall();
      setCableConnected(true);
      setConnectionError(null);
      updateSoft({ computerConnected: true });
    } else {
      soundEngine.playWarning();
      setConnectionError(`Connection refused on [${port}]. Connect USB cable to robot [CONTROL] port.`);
    }
  };

  const handleCheckCode = () => {
    soundEngine.playClick();
    const evaluation = evaluateBotCode(code);
    setLastCheck(evaluation);

    if (evaluation.allVerified) {
      soundEngine.playInstall();
      updateSoft({
        codeContent: code,
        bugsFixed: true,
      });
    } else {
      soundEngine.playWarning();
      updateSoft({
        codeContent: code,
        bugsFixed: false,
      });
    }
  };

  const handleResetTemplate = (variantIndex = 0) => {
    soundEngine.playClick();
    const template = BOTCODE_VARIANTS[variantIndex] || BOTCODE_VARIANTS[0];
    setCode(template.script);
    setLastCheck(null);
    updateSoft({
      codeContent: template.script,
      bugsFixed: false,
      softwareUploaded: false,
      isCompleted: false,
    });
  };

  const handleUploadToRobot = () => {
    if (!currentEval.allVerified || isUploading) return;
    soundEngine.playClick();
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          soundEngine.playInstall();
          updateSoft({
            codeContent: code,
            bugsFixed: true,
            softwareUploaded: true,
            testPassed: true,
            isCompleted: true,
          });
          return 100;
        }
        return prev + 25;
      });
    }, 250);
  };

  const toggleComplete = () => {
    soundEngine.playClick();
    updateSoft({ isCompleted: !soft.isCompleted });
  };

  return (
    <div className="relative w-full h-full bg-slate-50 text-slate-800 overflow-y-auto flex flex-col justify-between p-4 md:p-5 font-sans">
      {/* Optional Top Sub-Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onReturnToDashboard();
              }}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-700 font-bold">
                  Discipline 03 • Software
                </span>
              </div>
              <h2 className="font-display font-black text-lg text-slate-900 leading-tight">BotCode IDE & Microcontroller</h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              title="Reset Software task progress"
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 bg-white border border-slate-200 hover:border-rose-200 transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>↻ Reset Task</span>
            </button>

            <button
              type="button"
              onClick={toggleComplete}
              disabled={!soft.softwareUploaded}
              className={`cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-display font-bold transition-all ${
                !soft.softwareUploaded
                  ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500'
                  : soft.isCompleted
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xs'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{soft.isCompleted ? 'Discipline Complete ✓' : 'Mark Complete'}</span>
            </button>
          </div>
        </div>
      )}

      <ResetTaskModal
        isOpen={showResetModal}
        roleTitle="SOFTWARE"
        description="This will disconnect the USB cable, restore the original code bug set for this session, clear uploaded software, and mark the Software task as incomplete. Other team tasks will not be changed."
        onConfirm={handleResetSoftware}
        onCancel={() => setShowResetModal(false)}
      />

      {!cableConnected ? (
        /* ==========================================
           STEP 1: PHYSICAL CABLE CONNECTION
           ========================================== */
        <div className="flex-1 my-3 flex flex-col justify-between">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl mb-4 text-xs font-sans shadow-xs">
            <span className="text-indigo-700 font-bold block mb-1">
              Step 1: Physical Link Setup
            </span>
            <p className="text-slate-600">
              Your computer must connect to the robot microcontroller before you can inspect onboard software.
              Click the correct port on the robot to connect the <strong>USB Data Cable</strong>.
            </p>
          </div>

          <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-around gap-6 relative shadow-xs">
            {/* Left: Programmer Laptop */}
            <div className="flex flex-col items-center p-6 bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-sm text-center">
              <Laptop className="size-16 text-indigo-600 mb-3" />
              <h3 className="font-display font-bold text-base text-slate-900">Developer Laptop</h3>
              <span className="text-[11px] font-sans text-slate-500 mb-4">
                Field Debug Workstation
              </span>

              <div className="px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-2 text-xs font-mono text-indigo-800">
                <Usb className="w-4 h-4 text-indigo-600" />
                <span>USB 3.0 LINK READY</span>
              </div>
            </div>

            {/* Connecting Cable Graphic */}
            <div className="hidden md:flex flex-col items-center text-slate-400 font-mono text-xs">
              <span>────── USB CABLE ──────►</span>
            </div>

            {/* Right: Team Robot Interface */}
            <div className="flex flex-col items-center p-6 bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-sm text-center">
              <Cpu className="size-16 text-cyan-600 mb-3" />
              <h3 className="font-display font-bold text-base text-slate-900">
                {project.teamName || 'BattleBot'}
              </h3>
              <span className="text-[11px] font-sans text-slate-500 mb-4">
                Onboard Controller Header
              </span>

              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold tracking-wider mb-2">
                Select Connection Port:
              </span>

              <div className="grid grid-cols-2 gap-2.5 w-full font-mono">
                {(['POWER', 'CONTROL', 'MOTOR', 'SENSOR'] as const).map((port) => (
                  <button
                    key={port}
                    type="button"
                    onClick={() => handleConnectPort(port)}
                    className={`cursor-pointer py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      selectedRobotPort === port
                        ? port === 'CONTROL'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-rose-50 text-rose-700 border-rose-300'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-xs'
                    }`}
                  >
                    [{port}]
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error Feedback */}
          <div className="mt-4">
            {connectionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{connectionError}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==========================================
           STEP 2: BOTCODE TEXT EDITOR & DEBUGGING
           ========================================== */
        <div className="flex-1 my-2 flex flex-col lg:flex-row gap-4 min-h-[520px]">
          {/* Main BotCode Text Editor Window */}
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div>
              {/* Terminal Window Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  <span className="font-mono text-xs font-bold text-slate-900">
                    BotCode IDE v2.4 • onboard://{project.teamName.toLowerCase().replace(/\s+/g, '_')}.bot
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowReference(!showReference)}
                    className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors font-semibold"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Language Reference</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetTemplate(0)}
                    title="Reset to original code"
                    className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 font-semibold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Reset Code</span>
                  </button>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-700 font-bold">LINK ACTIVE</span>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="mt-3">
                {currentEval.allVerified ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                    <span className="font-bold">✓ All subsystems verified • Syntax valid</span>
                    <span className="text-[11px] font-mono text-emerald-700">Ready to upload</span>
                  </div>
                ) : lastCheck ? (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                    <span className="font-bold">
                      ⚠ {lastCheck.bugsRemainingCount} subsystem defect(s) detected
                    </span>
                    <span className="text-[11px] text-amber-700">
                      Use the reference guide to correct the code
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>Inspect and edit the program below, then click <strong>[Check Code]</strong> to test.</span>
                    <span className="text-[11px] font-mono text-slate-400">Direct IDE</span>
                  </div>
                )}
              </div>

              {/* Collapsible Command Guide */}
              {showReference && (
                <div className="mt-3 p-3.5 bg-slate-50 border border-indigo-200 rounded-2xl text-xs text-slate-700 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                    <span className="font-bold text-indigo-900">BotCode Command Reference</span>
                    <span className="text-[10px] text-slate-400 font-mono">Case-sensitive</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <strong className="text-indigo-800 block font-sans">MOVEMENT</strong>
                      <code>drive FORWARD</code> • <code>drive BACKWARD</code> • <code>drive STOP</code>
                    </div>
                    <div>
                      <strong className="text-indigo-800 block font-sans">WEAPON ACTUATION</strong>
                      <code>weapon SPIN</code> • <code>weapon STOP</code> • <code>weapon = READY</code>
                    </div>
                    <div>
                      <strong className="text-indigo-800 block font-sans">SENSORS & CONDITIONS</strong>
                      <code>sensor opponent = ON</code> • <code>IF opponent detected:</code>
                    </div>
                    <div>
                      <strong className="text-indigo-800 block font-sans">INVERSION RECOVERY</strong>
                      <code>self_right ON</code> • <code>IF robot flipped:</code> (Colons required on IF lines)
                    </div>
                  </div>
                </div>
              )}

              {/* Direct Code Editor Textarea (Clean Slate Theme) */}
              <div className="my-3">
                <textarea
                  rows={13}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                  }}
                  spellCheck={false}
                  className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl font-mono text-xs text-emerald-400 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none selection:bg-indigo-500/30"
                  placeholder="Enter BotCode program..."
                />
              </div>

              {/* Problems Panel: Diagnostic messages from last check */}
              {lastCheck && lastCheck.diagnostics.length > 0 && (
                <div className="space-y-1.5 mb-2 font-mono">
                  {lastCheck.diagnostics.map((diag, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      <span>{diag}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCheckCode}
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition-colors shadow-xs"
              >
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Check Code</span>
              </button>

              <button
                type="button"
                onClick={handleUploadToRobot}
                disabled={!currentEval.allVerified || isUploading}
                className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all shadow-md ${
                  !currentEval.allVerified
                    ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-400'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-98'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isUploading
                  ? `Uploading... ${uploadProgress}%`
                  : soft.softwareUploaded
                  ? 'Software Installed ✓'
                  : 'Upload to Robot'}</span>
              </button>
            </div>
          </div>

          {/* Software Checklist Sidebar */}
          <div className="w-full lg:w-80 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs shrink-0">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-display font-bold text-sm text-slate-900">Subsystem Validation</h3>
              </div>

              {/* Checklist Items */}
              <div className="mt-4 space-y-2">
                {[
                  { label: 'Movement subsystem verified', complete: currentEval.subsystems.movement },
                  { label: 'Opponent detection verified', complete: currentEval.subsystems.detection },
                  { label: 'Weapon subsystem verified', complete: currentEval.subsystems.weapon },
                  { label: 'Recovery system verified', complete: currentEval.subsystems.recovery },
                  { label: 'Syntax & colons verified', complete: currentEval.subsystems.syntax },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-sans transition-all ${
                      item.complete
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div
                      className={`size-4 rounded-md flex items-center justify-center text-[10px] font-bold ${
                        item.complete ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                      }`}
                    >
                      {item.complete ? '✓' : ''}
                    </div>
                    <span className={item.complete ? 'font-bold' : ''}>{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Status Message */}
              <div className="mt-4">
                {soft.softwareUploaded ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-sans">
                    <div className="flex items-center gap-1.5 font-bold mb-1 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Robot Software Flashed
                    </div>
                    Program is verified and active on the onboard microcontroller!
                  </div>
                ) : currentEval.allVerified ? (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-sans">
                    All subsystems verified! Click <strong>[Upload to Robot]</strong> to flash onboard memory.
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-sans">
                    {currentEval.bugsRemainingCount} subsystem(s) incomplete or failing verification.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Helper Note */}
            <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-500 font-sans">
              <span className="text-indigo-700 font-bold block mb-1">ENGINEER DEBUG TIP:</span>
              Inspect each line against the BotCode Reference. Pay close attention to command names, direction keywords, and colons after IF statements.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
