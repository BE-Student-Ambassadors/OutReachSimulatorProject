import {
  ArrowLeft,
  CheckCircle2,
  Code2,
  Cpu,
  Laptop,
  ShieldAlert,
  Terminal,
  UploadCloud,
  Usb,
  RotateCcw,
  BookOpen,
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
}

export const SoftwareScreen: React.FC<SoftwareScreenProps> = ({
  project,
  onUpdateSoftware,
  onReturnToDashboard,
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
    <div className="relative w-full h-full bg-[#080d1a] text-white overflow-y-auto flex flex-col justify-between p-4 md:p-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEngine.playClick();
              onReturnToDashboard();
            }}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono-num font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-700 hover:border-slate-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            DASHBOARD
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-mono-num uppercase tracking-wider text-emerald-400 font-semibold">
                DISCIPLINE 03 • SOFTWARE ENGINEER
              </span>
            </div>
            <h2 className="font-display font-black text-2xl text-white">
              CONNECT, DEBUG & UPLOAD
            </h2>
          </div>
        </div>

        {/* Completion Action & Task Reset */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowResetModal(true)}
            title="Reset Software task progress"
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono-num text-slate-400 hover:text-rose-300 bg-slate-900 border border-slate-800 hover:border-rose-900/50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>↻ Reset Task</span>
          </button>

          <button
            onClick={toggleComplete}
            disabled={!soft.softwareUploaded}
            className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-display font-bold transition-all ${
              !soft.softwareUploaded
                ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                : soft.isCompleted
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {soft.isCompleted ? 'DISCIPLINE COMPLETE' : 'MARK COMPLETE'}
          </button>
        </div>
      </div>

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
        <div className="flex-1 my-4 flex flex-col justify-between">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl mb-4 text-xs font-mono-num">
            <span className="text-emerald-400 font-bold block mb-1">
              STEP 1: PHYSICAL CONNECTION
            </span>
            <p className="text-slate-300">
              Your computer must connect to the robot before you can inspect onboard software.
              Click the correct port on the robot to connect the <strong>USB DATA CABLE</strong>.
            </p>
          </div>

          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-around gap-6 relative">
            {/* Left: Programmer Laptop */}
            <div className="flex flex-col items-center p-6 bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm">
              <Laptop className="w-16 h-16 text-cyan-400 mb-3" />
              <h3 className="font-display font-bold text-base text-white">DEVELOPER LAPTOP</h3>
              <span className="text-[11px] font-mono-num text-slate-400 mb-4">
                Field Debug Station
              </span>

              <div className="px-3 py-2 rounded-xl bg-cyan-950/40 border border-cyan-800/50 flex items-center gap-2 text-xs font-mono-num text-cyan-300">
                <Usb className="w-4 h-4" />
                <span>USB 3.0 DATA CABLE (READY)</span>
              </div>
            </div>

            {/* Connecting Cable Graphic */}
            <div className="hidden md:flex flex-col items-center text-slate-500 font-mono-num text-xs">
              <span>────── USB LINK ──────►</span>
            </div>

            {/* Right: Team Robot Interface */}
            <div className="flex flex-col items-center p-6 bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm">
              <Cpu className="w-16 h-16 text-emerald-400 mb-3" />
              <h3 className="font-display font-bold text-base text-white">
                {project.teamName || 'BATTLEBOT'}
              </h3>
              <span className="text-[11px] font-mono-num text-slate-400 mb-4">
                Onboard Controller Header
              </span>

              <span className="text-[10px] font-mono-num text-slate-400 uppercase tracking-wider mb-2">
                SELECT CONNECTION PORT:
              </span>

              <div className="grid grid-cols-2 gap-2.5 w-full">
                {(['POWER', 'CONTROL', 'MOTOR', 'SENSOR'] as const).map((port) => (
                  <button
                    key={port}
                    onClick={() => handleConnectPort(port)}
                    className={`cursor-pointer py-2.5 px-3 rounded-xl border text-xs font-mono-num font-bold transition-all ${
                      selectedRobotPort === port
                        ? port === 'CONTROL'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    [{port}]
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error / Success Feedback */}
          <div className="mt-4">
            {connectionError && (
              <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-xl text-xs font-mono-num text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{connectionError}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==========================================
           STEP 2: BOTCODE TEXT EDITOR & DEBUGGING
           ========================================== */
        <div className="flex-1 my-3 flex flex-col lg:flex-row gap-4 min-h-[520px]">
          {/* Main BotCode Text Editor Window */}
          <div className="flex-1 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              {/* Terminal Window Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono-num text-xs font-bold text-white">
                    BOTCODE IDE v2.4 • onboard://{project.teamName.toLowerCase().replace(/\s+/g, '_')}.bot
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono-num">
                  <button
                    onClick={() => setShowReference(!showReference)}
                    className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    <span>BOTCODE REFERENCE</span>
                  </button>
                  <button
                    onClick={() => handleResetTemplate(0)}
                    title="Reset to original code"
                    className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="text-[11px]">RESET</span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-bold">LINK ACTIVE</span>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="mt-3">
                {currentEval.allVerified ? (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-mono-num text-emerald-300 flex items-center justify-between">
                    <span className="font-bold">✓ ALL SUBSYSTEMS VERIFIED • SYNTAX VALID</span>
                    <span className="text-[11px] text-emerald-400">Ready for onboard upload</span>
                  </div>
                ) : lastCheck ? (
                  <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-mono-num text-amber-300 flex items-center justify-between">
                    <span className="font-bold">
                      ⚠ {lastCheck.bugsRemainingCount} SUBSYSTEM DEFECT(S) DETECTED
                    </span>
                    <span className="text-[11px] text-amber-400">
                      Use the BotCode Reference to correct the code
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono-num text-slate-300 flex items-center justify-between">
                    <span>Edit the code manually below, then click <strong>[CHECK CODE]</strong> to verify.</span>
                    <span className="text-[11px] text-slate-400">Direct code editing</span>
                  </div>
                )}
              </div>

              {/* Collapsible Command Guide */}
              {showReference && (
                <div className="mt-3 p-3.5 bg-slate-900/90 border border-cyan-800/40 rounded-xl text-xs font-mono-num text-slate-300 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-cyan-300">BOTCODE COMMAND GUIDE</span>
                    <span className="text-[10px] text-slate-400">Case-sensitive commands</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <strong className="text-emerald-400 block">MOVEMENT</strong>
                      <code>drive FORWARD</code> • <code>drive BACKWARD</code> • <code>drive STOP</code>
                    </div>
                    <div>
                      <strong className="text-emerald-400 block">WEAPON ACTUATION</strong>
                      <code>weapon SPIN</code> • <code>weapon STOP</code> • <code>weapon = READY</code>
                    </div>
                    <div>
                      <strong className="text-emerald-400 block">SENSORS & CONDITIONS</strong>
                      <code>sensor opponent = ON</code> • <code>IF opponent detected:</code>
                    </div>
                    <div>
                      <strong className="text-emerald-400 block">INVERSION RECOVERY & SYNTAX</strong>
                      <code>self_right ON</code> • <code>IF robot flipped:</code> (Colons required on all IF lines)
                    </div>
                  </div>
                </div>
              )}

              {/* Direct Code Editor Textarea */}
              <div className="my-3">
                <textarea
                  rows={14}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                  }}
                  spellCheck={false}
                  className="w-full p-4 bg-[#050811] border border-slate-800 rounded-xl font-mono text-xs text-emerald-300 leading-relaxed focus:outline-none focus:border-emerald-500 resize-none selection:bg-emerald-500/30"
                  placeholder="Enter BotCode program..."
                />
              </div>

              {/* Diagnostic messages from last check */}
              {lastCheck && lastCheck.diagnostics.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {lastCheck.diagnostics.map((diag, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-rose-950/30 border border-rose-800/40 text-xs font-mono-num text-rose-300 flex items-center gap-2"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>{diag}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={handleCheckCode}
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono-num font-bold text-white transition-colors"
              >
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>CHECK CODE</span>
              </button>

              <button
                onClick={handleUploadToRobot}
                disabled={!currentEval.allVerified || isUploading}
                className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-black text-sm transition-all shadow-lg ${
                  !currentEval.allVerified
                    ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 transform hover:-translate-y-0.5'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                {isUploading
                  ? `UPLOADING... ${uploadProgress}%`
                  : soft.softwareUploaded
                  ? 'SOFTWARE INSTALLED ✓'
                  : 'UPLOAD TO ROBOT'}
              </button>
            </div>
          </div>

          {/* Software Checklist Sidebar */}
          <div className="w-full lg:w-80 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-display font-bold text-sm text-white">SUBSYSTEM STATUS</h3>
              </div>

              {/* Checklist Items */}
              <div className="mt-4 space-y-2.5">
                {[
                  { label: 'Movement subsystem verified', complete: currentEval.subsystems.movement },
                  { label: 'Opponent detection verified', complete: currentEval.subsystems.detection },
                  { label: 'Weapon subsystem verified', complete: currentEval.subsystems.weapon },
                  { label: 'Recovery system verified', complete: currentEval.subsystems.recovery },
                  { label: 'Syntax & colons verified', complete: currentEval.subsystems.syntax },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-mono-num transition-all ${
                      item.complete
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold ${
                        item.complete ? 'bg-emerald-500 text-slate-950' : 'border border-slate-600'
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
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono-num">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ROBOT SOFTWARE VERIFIED
                    </div>
                    Program successfully uploaded to the onboard microcontroller!
                  </div>
                ) : currentEval.allVerified ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono-num">
                    All subsystems verified! Click <strong>[UPLOAD TO ROBOT]</strong> to flash onboard memory.
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs font-mono-num">
                    {currentEval.bugsRemainingCount} subsystem(s) incomplete or failing verification.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Helper Note */}
            <div className="pt-3 border-t border-slate-800 text-[11px] font-mono-num text-slate-400">
              <span className="text-emerald-400 font-bold block mb-1">ENGINEER DEBUG TIP:</span>
              Inspect each line against the BotCode Reference. Pay close attention to command names, direction keywords, and colons after IF statements.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
