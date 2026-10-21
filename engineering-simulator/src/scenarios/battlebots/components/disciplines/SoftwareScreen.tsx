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
import React, { useState, useEffect, useRef, type ReactNode } from 'react';
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

const LINE_H = 19;

const BOT_KEYWORDS = new Set(['BOT', 'START', 'END', 'IF']);
const BOT_COMMANDS = new Set(['drive', 'weapon', 'sensor', 'self_right']);
const BOT_VALUES = new Set(['FORWARD', 'BACKWARD', 'STOP', 'SPIN', 'READY', 'ON', 'OFF']);
const BOT_SUBJECTS = new Set(['opponent', 'distance', 'detected', 'close', 'robot', 'flipped']);

/** Colors one line of BotCode. */
function highlightBotCode(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\/\/.*$)|([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d+)?)|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  let i = 0;
  const botName = /^\s*BOT\s/.test(line);
  while ((m = re.exec(line))) {
    const [tok, comment, word, num] = m;
    const k = i++;
    if (comment) out.push(<span key={k} className="text-[#7d8a80]">{tok}</span>);
    else if (word && BOT_KEYWORDS.has(word)) out.push(<span key={k} className="font-semibold text-[#c79bff]">{tok}</span>);
    else if (word && BOT_COMMANDS.has(word)) out.push(<span key={k} className="text-[#8fd19e]">{tok}</span>);
    else if (word && BOT_VALUES.has(word)) out.push(<span key={k} className="text-[#ffd479]">{tok}</span>);
    else if (word && BOT_SUBJECTS.has(word)) out.push(<span key={k} className="text-[#f0a68a]">{tok}</span>);
    else if (word && botName) out.push(<span key={k} className="text-[#e3b341]">{tok}</span>);
    else if (num) out.push(<span key={k} className="text-[#ffd479]">{tok}</span>);
    else out.push(<span key={k}>{tok}</span>);
  }
  return out;
}

/** Line-level problems a compiler would report: words BotCode doesn't know, and IF lines without a colon. */
function findLineProblems(code: string): { line: number; message: string }[] {
  const known = new Set([...BOT_KEYWORDS, ...BOT_COMMANDS, ...BOT_VALUES, ...BOT_SUBJECTS]);
  const out: { line: number; message: string }[] = [];
  code.split('\n').forEach((raw, idx) => {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line || /^BOT\s/.test(line)) return;
    const unknown = (line.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []).filter((w) => !known.has(w));
    if (unknown.length) out.push({ line: idx + 1, message: `"${unknown[0]}" is not a BotCode word.` });
    if (/^IF\b/.test(line) && !line.endsWith(':')) out.push({ line: idx + 1, message: 'an IF line has to end with a colon.' });
  });
  return out;
}

function BotCodeReference() {
  const row = (code: string, what: string) => (
    <div className="border-b border-line py-1.5 last:border-0">
      <code className="font-mono text-[12px] font-semibold text-[#5b3c94]">{code}</code>
      <div className="text-xs text-ink/65">{what}</div>
    </div>
  );
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
        <BookOpen className="size-4" /> BotCode reference
      </h3>
      <p className="mt-1 text-[11px] text-ink/50">Case-sensitive. Indented lines belong to the IF above them.</p>
      <div className="mt-1">
        {row('BOT name', 'Names the program.')}
        {row('START: … END', 'Everything between them runs on the robot.')}
        {row('sensor opponent = ON', 'Turns a sensor on (or OFF). Sensors: opponent, distance.')}
        {row('weapon = READY', 'Arms the weapon (or OFF).')}
        {row('IF opponent detected:', 'Runs the lines below when the sensor sees the opponent.')}
        {row('IF opponent close:', 'Runs the lines below when the opponent is in reach.')}
        {row('IF robot flipped:', 'Runs the lines below when the robot is upside down.')}
        {row('drive FORWARD', 'Also BACKWARD or STOP.')}
        {row('weapon SPIN', 'Spins the weapon up (weapon STOP spins it down).')}
        {row('self_right ON', 'Fires the self-righting mechanism.')}
        {row('// comment', 'Ignored by the robot.')}
      </div>
    </div>
  );
}

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
  const [showReference, setShowReference] = useState(true);
  const pre = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [testedForward, setTestedForward] = useState(Boolean(soft.testPassed));
  const [testedTurn, setTestedTurn] = useState(Boolean(soft.testPassed));
  const [testedWeapon, setTestedWeapon] = useState(Boolean(soft.testPassed));

  const currentEval = evaluateBotCode(code);
  const lines = code.split('\n');
  // Line markers show what the last Check found, like a compiler run.
  const lineProblems = lastCheck ? findLineProblems(code) : [];
  const problemLines = new Set(lineProblems.map((p) => p.line));
  const editedSinceUpload = soft.softwareUploaded && (soft.codeContent ?? '') !== code;
  const fileName = `${project.teamName.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'robot'}.bot`;

  const updateSoft = (updated: Partial<SoftwareConfiguration>) => {
    onUpdateSoftware({ ...soft, ...updated });
  };

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

    // Side effects stay outside the state updater (React may call updaters during render).
    let progress = 0;
    const interval = setInterval(() => {
      progress += 25;
      setUploadProgress(Math.min(100, progress));
      if (progress > 100) {
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
      }
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
           STEP 2: BOTCODE IDE
           ========================================== */
        <div className="flex-1 my-2 flex gap-3 min-h-[520px]">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[#14201a] shadow-xl ring-4 ring-[#1b2a20]">
            {/* Toolbar */}
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#1b2a20] px-3 py-2">
              <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-xs text-white/80">{fileName}</span>
              {isDataConnected ? (
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#8fd19e]">
                  <span className="size-2 rounded-full bg-[#4ade80] shadow-[0_0_6px_2px_#4ade8088]" /> robot connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#f2a093]">
                  <span className="size-2 rounded-full bg-[#ef6b5a]" /> no data link
                </span>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setViewMode('workstation');
                  }}
                  className="cursor-pointer flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/60 hover:text-white"
                >
                  <Laptop className="size-3.5" /> Workstation
                </button>
                <button
                  type="button"
                  onClick={() => setShowReference((v) => !v)}
                  className={`cursor-pointer flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${showReference ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'}`}
                >
                  <BookOpen className="size-3.5" /> Reference
                </button>
                <button
                  type="button"
                  onClick={() => handleResetTemplate(0)}
                  title="Reset to original code"
                  className="cursor-pointer flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/60 hover:text-white"
                >
                  <RotateCcw className="size-3.5" /> Reset code
                </button>
                <button
                  type="button"
                  onClick={handleCheckCode}
                  className="cursor-pointer flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/20 hover:bg-white/15"
                >
                  <Terminal className="size-3.5" /> Check code
                </button>
                <button
                  type="button"
                  onClick={handleUploadToRobot}
                  disabled={!currentEval.allVerified || isUploading || !isDataConnected}
                  title={!isDataConnected ? 'Requires active DATA connection to robot' : undefined}
                  className="btn-press cursor-pointer flex items-center gap-1.5 rounded-lg bg-[#4f9a5c] px-3 py-1.5 font-display text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <UploadCloud className="size-3.5" />
                  {isUploading ? `Uploading… ${uploadProgress}%` : soft.softwareUploaded && !editedSinceUpload ? 'Uploaded ✓' : 'Upload to robot'}
                </button>
              </div>
            </div>

            {/* Tip about the language */}
            <div className="flex shrink-0 items-start gap-2 border-b border-[#d9a52b]/30 bg-[#d9a52b]/15 px-4 py-2 text-[12.5px] text-[#ffe3a3]">
              <Code2 className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>BotCode</strong> is a simplified language made for this activity. <strong>Check code</strong> tests each subsystem of the program;{' '}
                <strong>Upload to robot</strong> flashes it onto the robot once every subsystem passes.
              </span>
            </div>

            {/* Lost connection */}
            {!isDataConnected && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ef6b5a]/30 bg-[#ef6b5a]/15 px-4 py-2 text-[12.5px] text-[#ffd0c8]">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="size-4 shrink-0" />
                  The robot's data cable is unplugged. Your code is saved; uploading and testing need the cable in the DATA port.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setViewMode('workstation');
                  }}
                  className="cursor-pointer shrink-0 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/25"
                >
                  Workstation →
                </button>
              </div>
            )}

            {/* Editor */}
            <div className="relative flex min-h-0 flex-1 font-mono text-[13px]">
              <div ref={gutter} className="w-14 shrink-0 overflow-hidden border-r border-white/10 bg-[#111b16] py-3 text-right text-white/35">
                {lines.map((_, i) => (
                  <div key={i} className="relative pr-3" style={{ height: LINE_H, lineHeight: `${LINE_H}px` }}>
                    {problemLines.has(i + 1) && <span className="absolute left-1.5 top-[6px] size-2.5 rounded-full bg-[#ef6b5a]" />}
                    {i + 1}
                  </div>
                ))}
              </div>
              <div className="relative min-w-0 flex-1">
                <pre ref={pre} aria-hidden className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre px-4 py-3 text-[#e7efe9]" style={{ lineHeight: `${LINE_H}px` }}>
                  {lines.map((l, i) => (
                    <div key={i} className={problemLines.has(i + 1) ? 'bg-[#ef6b5a]/15 underline decoration-[#ef6b5a] decoration-wavy underline-offset-4' : ''} style={{ height: LINE_H }}>
                      {highlightBotCode(l)}
                      {'\u200b'}
                    </div>
                  ))}
                </pre>
                <textarea
                  value={code}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  onChange={(e) => setCode(e.target.value)}
                  onScroll={(e) => {
                    if (pre.current) {
                      pre.current.scrollTop = e.currentTarget.scrollTop;
                      pre.current.scrollLeft = e.currentTarget.scrollLeft;
                    }
                    if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Tab') return;
                    e.preventDefault();
                    const t = e.currentTarget;
                    const { selectionStart: a, selectionEnd: b } = t;
                    setCode(code.slice(0, a) + '    ' + code.slice(b));
                    requestAnimationFrame(() => t.setSelectionRange(a + 4, a + 4));
                  }}
                  className="absolute inset-0 resize-none overflow-auto whitespace-pre bg-transparent px-4 py-3 text-transparent caret-white outline-none selection:bg-white/20"
                  style={{ lineHeight: `${LINE_H}px` }}
                />
              </div>
            </div>

            {/* Problems / output */}
            <div className="h-[128px] shrink-0 overflow-y-auto border-t border-white/10 bg-[#0f1813] px-4 py-2 font-mono text-[12.5px]">
              <div className="mb-1 flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/45">
                <span>Problems ({lastCheck ? lineProblems.length + lastCheck.diagnostics.length : 0})</span>
                <span className={soft.softwareUploaded && !editedSinceUpload ? 'text-[#8fd19e]' : 'text-[#e3b341]'}>
                  {soft.softwareUploaded ? (editedSinceUpload ? '● edited since last upload' : '● running on the robot') : '● not uploaded yet'}
                </span>
              </div>
              {isUploading && <div className="text-[#e3b341]">Flashing onboard memory… {uploadProgress}%</div>}
              {!lastCheck ? (
                <div className="text-white/50">Not checked yet. Click Check code to test every subsystem.</div>
              ) : lastCheck.allVerified && lineProblems.length === 0 ? (
                <div className="flex items-center gap-1.5 text-[#8fd19e]">
                  <CheckCircle2 className="size-3.5" /> No problems found. Every subsystem passes.
                </div>
              ) : (
                <>
                  {lineProblems.map((p, i) => (
                    <div key={`l${i}`} className="text-[#f2a093]">
                      <span className="text-white/45">line {p.line}:</span> {p.message}
                    </div>
                  ))}
                  {lastCheck.diagnostics.map((d, i) => (
                    <div key={`d${i}`} className="text-[#f2a093]">
                      <span className="text-white/45">check:</span> {d}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Side panel: subsystem checks, driver test, reference */}
          <aside className="flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
                <Code2 className="size-4" /> Subsystem checks
              </h3>
              <div className="mt-2 space-y-1.5">
                {[
                  { label: 'Movement', complete: currentEval.subsystems.movement },
                  { label: 'Opponent detection', complete: currentEval.subsystems.detection },
                  { label: 'Weapon', complete: currentEval.subsystems.weapon },
                  { label: 'Recovery', complete: currentEval.subsystems.recovery },
                  { label: 'Syntax & colons', complete: currentEval.subsystems.syntax },
                ].map((item) => {
                  const shown = lastCheck ? item.complete : null;
                  return (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <span
                        className={`grid size-4 place-items-center rounded-md text-[10px] font-bold ${
                          shown === null ? 'bg-paper ring-1 ring-line' : shown ? 'bg-forest text-white' : 'bg-rust/15 text-rust ring-1 ring-rust/40'
                        }`}
                      >
                        {shown === null ? '' : shown ? '✓' : '✕'}
                      </span>
                      <span className={shown ? 'font-semibold text-ink' : 'text-ink/65'}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {soft.softwareUploaded && (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-ink">Driver control test</h3>
                  <span className="font-mono text-[10px] font-semibold text-ink/55">
                    {isDataConnected ? `${[testedForward, testedTurn, testedWeapon].filter(Boolean).length} / 3` : 'no data link'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink/60">
                  {isDataConnected ? 'Press the keys (or click) to try each control on the robot.' : 'Plug the data cable back in to test the controls.'}
                </p>
                <div className="mt-2 space-y-1.5">
                  {[
                    { keys: 'W / ↑', label: 'Forward drive', done: testedForward, onTest: handleTestForward },
                    { keys: 'A / ←', label: 'Left steering', done: testedTurn, onTest: handleTestTurn },
                    { keys: 'SPACE', label: 'Weapon trigger', done: testedWeapon, onTest: handleTestWeapon },
                  ].map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={t.onTest}
                      disabled={!isDataConnected}
                      className={`cursor-pointer flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        t.done ? 'bg-mint text-forest ring-forest/30' : 'bg-paper text-ink/75 ring-line hover:bg-white'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold ring-1 ring-line">{t.keys}</kbd>
                        <span className="font-semibold">{t.label}</span>
                      </span>
                      <span className="font-mono text-[10px] font-bold">{t.done ? '✓ OK' : 'not tested'}</span>
                    </button>
                  ))}
                </div>
                {testedForward && testedTurn && testedWeapon && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-forest px-2.5 py-1.5 text-xs font-bold text-white">
                    <CheckCircle2 className="size-3.5" /> Driver software ready
                  </div>
                )}
              </div>
            )}

            {showReference && <BotCodeReference />}
          </aside>
        </div>
      )}
    </div>
  );
};
