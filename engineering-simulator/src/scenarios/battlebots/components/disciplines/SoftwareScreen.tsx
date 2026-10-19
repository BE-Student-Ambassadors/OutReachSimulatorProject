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
} from 'lucide-react';
import React, { useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import {
  BOTCODE_BUGS,
  checkBotCodeBugs,
  INITIAL_BOTCODE_SCRIPT,
} from '../../data/teamData';
import {
  type SoftwareConfiguration,
  type TeamRobotProject,
} from '../../types/robot';

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

  // Step 1: Physical connection
  const [cableConnected, setCableConnected] = useState(soft.computerConnected || soft.softwareUploaded);
  const [selectedRobotPort, setSelectedRobotPort] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Step 2: Code Editor State
  const [code, setCode] = useState(soft.codeContent || INITIAL_BOTCODE_SCRIPT);
  const [activeBugId, setActiveBugId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const bugAnalysis = checkBotCodeBugs(code);

  const updateSoft = (updated: Partial<SoftwareConfiguration>) => {
    onUpdateSoftware({ ...soft, ...updated });
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

  const handleFixWord = (bugId: string, correction: string) => {
    soundEngine.playInstall();
    const bug = BOTCODE_BUGS.find((b) => b.id === bugId);
    if (!bug) return;

    const newCode = code.replace(bug.wrongText, correction);
    setCode(newCode);
    setActiveBugId(null);

    const check = checkBotCodeBugs(newCode);
    updateSoft({
      codeContent: newCode,
      bugsFixed: check.allFixed,
    });
  };

  const handleUploadToRobot = () => {
    if (!bugAnalysis.allFixed || isUploading) return;
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

        {/* Completion Action */}
        <div className="flex items-center gap-3">
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
           STEP 2: BOTCODE EDITOR & DEBUGGING
           ========================================== */
        <div className="flex-1 my-3 flex flex-col lg:flex-row gap-4 min-h-[500px]">
          {/* Main BotCode Editor Screen */}
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
                <div className="flex items-center gap-2 text-xs font-mono-num">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-bold">LINK ACTIVE</span>
                </div>
              </div>

              {/* Bug Count Alert */}
              <div className="mt-3">
                {bugAnalysis.allFixed ? (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-mono-num text-emerald-300 flex items-center justify-between">
                    <span className="font-bold">✓ 0 BUGS DETECTED • SYNTAX VERIFIED</span>
                    <span className="text-[11px] text-emerald-400">Ready for onboard upload</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-mono-num text-amber-300 flex items-center justify-between">
                    <span className="font-bold">
                      ⚠ {bugAnalysis.remainingBugs.length} BUGS DETECTED IN ROBOT PROGRAM
                    </span>
                    <span className="text-[11px] text-amber-400">
                      Click the underlined keywords to inspect and repair
                    </span>
                  </div>
                )}
              </div>

              {/* Code Viewing & Repair Canvas */}
              <div className="my-3 p-4 bg-[#050811] border border-slate-800/80 rounded-xl font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto space-y-1">
                <div><span className="text-purple-400 font-bold">BOT</span> <span className="text-cyan-300">{project.teamName || 'NIGHTFALL'}</span></div>
                <br />
                <div><span className="text-amber-400 font-bold">START:</span></div>
                <br />
                <div className="pl-4">
                  <span className="text-blue-400">sensor</span> opponent = <span className="text-emerald-400">ON</span>
                </div>
                <div className="pl-4">
                  <span className="text-blue-400">weapon</span> = <span className="text-emerald-400">READY</span>
                </div>
                <br />

                {/* IF opponent detected */}
                <div className="pl-4">
                  <span className="text-purple-400 font-bold">IF</span> opponent{' '}
                  {code.includes('deteced') ? (
                    <button
                      onClick={() => setActiveBugId('bug_deteced')}
                      className="cursor-pointer text-amber-400 underline decoration-wavy decoration-amber-400 font-bold px-1 rounded bg-amber-950/40 hover:bg-amber-900/60 transition-colors"
                    >
                      deteced
                    </button>
                  ) : (
                    <span className="text-emerald-400 font-bold bg-emerald-950/30 px-1 rounded">
                      detected
                    </span>
                  )}
                  :
                </div>
                <div className="pl-8">
                  <span className="text-slate-400">drive</span>{' '}
                  {code.includes('FORWRD') ? (
                    <button
                      onClick={() => setActiveBugId('bug_forwrd')}
                      className="cursor-pointer text-amber-400 underline decoration-wavy decoration-amber-400 font-bold px-1 rounded bg-amber-950/40 hover:bg-amber-900/60 transition-colors"
                    >
                      FORWRD
                    </button>
                  ) : (
                    <span className="text-emerald-400 font-bold bg-emerald-950/30 px-1 rounded">
                      FORWARD
                    </span>
                  )}
                </div>
                <br />

                {/* IF opponent close */}
                <div className="pl-4">
                  <span className="text-purple-400 font-bold">IF</span> opponent close:
                </div>
                <div className="pl-8">
                  {code.includes('wepon') ? (
                    <button
                      onClick={() => setActiveBugId('bug_wepon')}
                      className="cursor-pointer text-amber-400 underline decoration-wavy decoration-amber-400 font-bold px-1 rounded bg-amber-950/40 hover:bg-amber-900/60 transition-colors"
                    >
                      wepon
                    </button>
                  ) : (
                    <span className="text-emerald-400 font-bold bg-emerald-950/30 px-1 rounded">
                      weapon
                    </span>
                  )}{' '}
                  {code.includes('SPNI') ? (
                    <button
                      onClick={() => setActiveBugId('bug_spni')}
                      className="cursor-pointer text-amber-400 underline decoration-wavy decoration-amber-400 font-bold px-1 rounded bg-amber-950/40 hover:bg-amber-900/60 transition-colors"
                    >
                      SPNI
                    </button>
                  ) : (
                    <span className="text-emerald-400 font-bold bg-emerald-950/30 px-1 rounded">
                      SPIN
                    </span>
                  )}
                </div>
                <br />

                {/* IF robot flipped */}
                <div className="pl-4">
                  <span className="text-purple-400 font-bold">IF</span> robot flipped:
                </div>
                <div className="pl-8">
                  <span className="text-slate-400">self_right</span> <span className="text-emerald-400">ON</span>
                </div>
                <br />
                <div><span className="text-amber-400 font-bold">END</span></div>
              </div>
            </div>

            {/* Upload Action Bar */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono-num text-slate-400">
                Click any highlighted keyword in the editor above to correct bugs.
              </span>

              <button
                onClick={handleUploadToRobot}
                disabled={!bugAnalysis.allFixed || isUploading}
                className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-black text-sm transition-all shadow-lg ${
                  !bugAnalysis.allFixed
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
                <h3 className="font-display font-bold text-sm text-white">SOFTWARE CHECKLIST</h3>
              </div>

              {/* Checklist Items */}
              <div className="mt-4 space-y-2.5">
                {[
                  { label: 'Connection established', complete: true },
                  { label: 'Movement command verified', complete: bugAnalysis.checklist.movement },
                  { label: 'Weapon command verified', complete: bugAnalysis.checklist.weapon },
                  { label: 'Opponent detection verified', complete: bugAnalysis.checklist.detection },
                  { label: 'Recovery system verified', complete: bugAnalysis.checklist.recovery },
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
                ) : bugAnalysis.allFixed ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono-num">
                    All bugs resolved! Click <strong>[UPLOAD TO ROBOT]</strong> to flash onboard memory.
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs font-mono-num">
                    {bugAnalysis.remainingBugs.length} bug(s) remaining. Inspect code lines in the editor.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Helper Note */}
            <div className="pt-3 border-t border-slate-800 text-[11px] font-mono-num text-slate-400">
              <span className="text-emerald-400 font-bold block mb-1">PROGRAMMER TIP:</span>
              Robot code must be precise. Spelling errors cause the microcontroller to reject autonomous commands.
            </div>
          </div>
        </div>
      )}

      {/* Bug Fix Interactive Modal */}
      {activeBugId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0b1020] border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start mb-3 pb-2 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono-num text-amber-400 uppercase tracking-widest font-bold block">
                  SYNTAX REPAIR
                </span>
                <h3 className="font-display font-bold text-base text-white">
                  Fix Subsystem Keyword
                </h3>
              </div>
              <button
                onClick={() => setActiveBugId(null)}
                className="cursor-pointer text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {(() => {
              const bug = BOTCODE_BUGS.find((b) => b.id === activeBugId);
              if (!bug) return null;
              return (
                <div>
                  <p className="text-xs font-mono-num text-slate-300 mb-3">
                    {bug.hint}
                  </p>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono-num mb-4">
                    <span className="text-slate-400">CURRENT TEXT: </span>
                    <strong className="text-rose-400 font-bold">{bug.wrongText}</strong>
                  </div>

                  <span className="text-[10px] font-mono-num text-slate-400 uppercase tracking-wider block mb-2">
                    SELECT CORRECTION:
                  </span>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      onClick={() => handleFixWord(bug.id, bug.correctText)}
                      className="cursor-pointer p-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400 text-emerald-300 font-mono-num font-bold text-xs text-left"
                    >
                      {bug.correctText} ✓
                    </button>
                    <button
                      onClick={() => setActiveBugId(null)}
                      className="cursor-pointer p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-mono-num text-xs text-left"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
