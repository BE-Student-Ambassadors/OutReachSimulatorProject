import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Code2,
  Laptop,
  RotateCcw,
  ShieldAlert,
  Terminal,
  UploadCloud,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
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
import { Software3DWorkstation, type ControllerPort } from './software/Software3DWorkstation';

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

  // Step 1: Physical connection authoritative state
  const [connectedPort, setConnectedPort] = useState<ControllerPort | null>(() => {
    if (soft.computerConnected || soft.softwareUploaded) return 'DATA';
    return null;
  });
  const [explanationAcknowledged, setExplanationAcknowledged] = useState<boolean>(() => {
    return Boolean(soft.computerConnected || soft.softwareUploaded);
  });
  const [viewMode, setViewMode] = useState<'workstation' | 'ide'>(() => {
    return soft.computerConnected || soft.softwareUploaded ? 'ide' : 'workstation';
  });

  const isDataConnected = connectedPort === 'DATA';

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
  const [testedForward, setTestedForward] = useState(Boolean(soft.testPassed));
  const [testedTurn, setTestedTurn] = useState(Boolean(soft.testPassed));
  const [testedWeapon, setTestedWeapon] = useState(Boolean(soft.testPassed));

  const currentEval = evaluateBotCode(code);

  const handleTestForward = () => {
    if (!isDataConnected) {
      soundEngine.playWarning();
      return;
    }
    soundEngine.playInstall();
    setTestedForward(true);
  };

  const handleTestTurn = () => {
    if (!isDataConnected) {
      soundEngine.playWarning();
      return;
    }
    soundEngine.playInstall();
    setTestedTurn(true);
  };

  const handleTestWeapon = () => {
    if (!isDataConnected) {
      soundEngine.playWarning();
      return;
    }
    soundEngine.playInstall();
    setTestedWeapon(true);
  };

  useEffect(() => {
    if (testedForward && testedTurn && testedWeapon && !soft.testPassed) {
      soundEngine.playInstall();
      updateSoft({ testPassed: true, isCompleted: true });
    }
  }, [testedForward, testedTurn, testedWeapon]);

  // Keyboard listener to test controls live in Software role (requires active DATA link)
  useEffect(() => {
    if (!isDataConnected || !soft.softwareUploaded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        handleTestForward();
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleTestTurn();
      } else if (e.code === 'Space' || e.key === ' ') {
        handleTestWeapon();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDataConnected, soft.softwareUploaded]);

  const updateSoft = (updated: Partial<SoftwareConfiguration>) => {
    onUpdateSoftware({ ...soft, ...updated });
  };

  const handlePortChange = (port: ControllerPort | null) => {
    setConnectedPort(port);
    const valid = port === 'DATA';
    updateSoft({ computerConnected: valid });
  };

  const handleOpenIde = () => {
    if (!isDataConnected) return;
    soundEngine.playInstall();
    setViewMode('ide');
  };

  const handleResetSoftware = () => {
    soundEngine.playInstall();
    setConnectedPort(null);
    setExplanationAcknowledged(false);
    setViewMode('workstation');
    setCode(originalScript);
    setLastCheck(null);
    setIsUploading(false);
    setUploadProgress(0);
    setTestedForward(false);
    setTestedTurn(false);
    setTestedWeapon(false);
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
    if (!isDataConnected || !currentEval.allVerified || isUploading) return;
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
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-700 font-bold">
                  Discipline 03 • Software
                </span>
                <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  SIMULATED PROGRAMMING LANGUAGE
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

      {viewMode === 'workstation' ? (
        /* ==========================================
           STEP 1: IMMERSIVE 3D WORKBENCH & CABLE CONNECTION
           ========================================== */
        <div className="flex-1 my-2 rounded-2xl overflow-hidden border border-slate-200 shadow-xs flex flex-col min-h-[560px]">
          <Software3DWorkstation
            project={project}
            connectedPort={connectedPort}
            onPortChange={handlePortChange}
            explanationAcknowledged={explanationAcknowledged}
            onAcknowledgeExplanation={() => setExplanationAcknowledged(true)}
            onOpenIde={handleOpenIde}
            onResetTask={() => setShowResetModal(true)}
          />
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
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  <span className="font-mono text-xs font-bold text-slate-900">
                    BotCode IDE v2.4 • onboard://{project.teamName.toLowerCase().replace(/\s+/g, '_')}.bot
                  </span>
                  <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    SIMULATED PROGRAMMING LANGUAGE
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setViewMode('workstation');
                    }}
                    title="View 3D robotics workstation"
                    className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors font-semibold"
                  >
                    <Laptop className="w-3.5 h-3.5 text-indigo-600" />
                    <span>3D Workstation</span>
                  </button>
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
                    {isDataConnected ? (
                      <>
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-emerald-700 font-bold">LINK ACTIVE</span>
                      </>
                    ) : (
                      <>
                        <span className="size-2 rounded-full bg-rose-500" />
                        <span className="text-rose-700 font-bold">NO DATA LINK</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Lost Connection Alert in IDE */}
              {!isDataConnected && (
                <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold block">Robot Data Cable Disconnected</span>
                      <span className="text-[11px] text-amber-800">
                        Your code progress is saved. Reconnect the USB cable to the DATA port in the 3D Workstation to upload software or test robot hardware.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setViewMode('workstation');
                    }}
                    className="cursor-pointer px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs whitespace-nowrap shadow-xs"
                  >
                    3D Workstation →
                  </button>
                </div>
              )}

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
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
                    <span>Inspect and edit the program below in <strong>BotCode</strong> (a simplified programming language created for this activity), then click <strong>[Check Code]</strong> to test.</span>
                    <span className="text-[11px] font-mono text-slate-400">Direct IDE</span>
                  </div>
                )}
              </div>

              {/* Collapsible Command Guide */}
              {showReference && (
                <div className="mt-3 p-3.5 bg-slate-50 border border-indigo-200 rounded-2xl text-xs text-slate-700 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-900">BotCode Command Reference</span>
                      <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-semibold">
                        Simulated language for this activity
                      </span>
                    </div>
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
                disabled={!currentEval.allVerified || isUploading || !isDataConnected}
                title={!isDataConnected ? 'Requires active DATA connection to robot' : undefined}
                className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all shadow-md ${
                  !currentEval.allVerified || !isDataConnected
                    ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-400'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-98'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>
                  {!isDataConnected
                    ? 'Upload (No DATA Link)'
                    : isUploading
                    ? `Uploading... ${uploadProgress}%`
                    : soft.softwareUploaded
                    ? 'Software Installed ✓'
                    : 'Upload to Robot'}
                </span>
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

              {/* Status & Control Test Panel */}
              <div className="mt-4">
                {soft.softwareUploaded ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-sans">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Driver Software Flashed
                      </div>
                      <p className="text-[11px] text-emerald-950 mt-0.5">
                        {isDataConnected
                          ? 'Test onboard controls below using your keyboard or click buttons:'
                          : 'Reconnect the DATA cable in 3D Workstation to test hardware controls.'}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs font-sans space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-indigo-200/60">
                        <span className="font-bold text-indigo-900 text-[11px] uppercase tracking-wider">
                          DRIVER CONTROL TEST
                        </span>
                        <span className="text-[10px] font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                          {isDataConnected
                            ? `${[testedForward, testedTurn, testedWeapon].filter(Boolean).length} / 3 VERIFIED`
                            : 'NO DATA LINK'}
                        </span>
                      </div>

                      {/* Test 1: Forward */}
                      <button
                        type="button"
                        onClick={handleTestForward}
                        disabled={!isDataConnected}
                        className={`cursor-pointer w-full p-2 rounded-xl border flex items-center justify-between transition-all ${
                          !isDataConnected
                            ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                            : testedForward
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-white border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px] font-mono font-bold">
                            W / ↑
                          </span>
                          <span className="font-semibold text-[11px]">Forward Drive</span>
                        </div>
                        <span className="font-mono text-[10px] font-bold">
                          {!isDataConnected ? 'No Link' : testedForward ? '✓ OK' : 'Press W / ↑'}
                        </span>
                      </button>

                      {/* Test 2: Turn */}
                      <button
                        type="button"
                        onClick={handleTestTurn}
                        disabled={!isDataConnected}
                        className={`cursor-pointer w-full p-2 rounded-xl border flex items-center justify-between transition-all ${
                          !isDataConnected
                            ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                            : testedTurn
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-white border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px] font-mono font-bold">
                            A / ←
                          </span>
                          <span className="font-semibold text-[11px]">Left Steering</span>
                        </div>
                        <span className="font-mono text-[10px] font-bold">
                          {!isDataConnected ? 'No Link' : testedTurn ? '✓ OK' : 'Press A / ←'}
                        </span>
                      </button>

                      {/* Test 3: Weapon */}
                      <button
                        type="button"
                        onClick={handleTestWeapon}
                        disabled={!isDataConnected}
                        className={`cursor-pointer w-full p-2 rounded-xl border flex items-center justify-between transition-all ${
                          !isDataConnected
                            ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                            : testedWeapon
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-white border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px] font-mono font-bold">
                            SPACE
                          </span>
                          <span className="font-semibold text-[11px]">Weapon Trigger</span>
                        </div>
                        <span className="font-mono text-[10px] font-bold">
                          {!isDataConnected ? 'No Link' : testedWeapon ? '✓ OK' : 'Press SPACE'}
                        </span>
                      </button>

                      {testedForward && testedTurn && testedWeapon && (
                        <div className="p-2.5 rounded-xl bg-emerald-600 text-white font-sans text-xs space-y-0.5 animate-in fade-in">
                          <div className="font-bold flex items-center gap-1.5 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> DRIVER SOFTWARE READY
                          </div>
                          <div className="text-[10px] font-mono text-emerald-100">
                            Controls: WASD / ARROWS &bull; SPACE
                          </div>
                        </div>
                      )}
                    </div>
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
