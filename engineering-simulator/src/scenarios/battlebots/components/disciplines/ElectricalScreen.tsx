import {
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Power,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { uid } from '../../../../core/format';
import { soundEngine } from '../../audio/soundEngine';
import {
  BATTERY_OPTIONS,
  DRIVE_ESC_OPTIONS,
  INITIAL_ELECTRICAL_CONFIG,
  validateSimplifiedElectrical,
  WEAPON_ESC_OPTIONS,
} from '../../data/teamData';
import { computeTeamEngineeringSummary } from '../../simulation/integrationValidator';
import {
  type DriveEscRating,
  type ElectricalConfiguration,
  type TeamRobotProject,
  type WeaponEscRating,
  type WireConnection,
} from '../../types/robot';
import { ResetTaskModal } from './ResetTaskModal';

interface ElectricalScreenProps {
  project: TeamRobotProject;
  onUpdateElectrical: (nextElectrical: ElectricalConfiguration) => void;
  onReturnToDashboard: () => void;
  hideHeader?: boolean;
}

export const ElectricalScreen: React.FC<ElectricalScreenProps> = ({
  project,
  onUpdateElectrical,
  onReturnToDashboard,
  hideHeader = false,
}) => {
  const elec = project.electrical;
  const summary = computeTeamEngineeringSummary(project);

  const [activeTab, setActiveTab] = useState<'wiring' | 'specs'>('wiring');
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [isPoweringOn, setIsPoweringOn] = useState(false);
  const [powerOnComplete, setPowerOnComplete] = useState(elec.wiringVerified);
  const [diagnosticReport, setDiagnosticReport] = useState<string[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintStage, setHintStage] = useState<Record<string, number>>({});
  const [activeHint, setActiveHint] = useState<{ title: string; text: string } | null>(null);

  const handleResetElectrical = () => {
    soundEngine.playInstall();
    setSelectedPortId(null);
    setPowerOnComplete(false);
    setDiagnosticReport([]);
    setHintsUsed(0);
    setHintStage({});
    setActiveHint(null);
    onUpdateElectrical({
      ...INITIAL_ELECTRICAL_CONFIG,
      wires: [],
      wiringVerified: false,
      isCompleted: false,
    });
    setShowResetModal(false);
  };

  const wires = useMemo(() => elec.wires || [], [elec.wires]);

  const updateWires = (nextWires: WireConnection[], verified = false) => {
    onUpdateElectrical({
      ...elec,
      wires: nextWires,
      wiringVerified: verified,
      isCompleted: verified ? true : elec.isCompleted,
    });
  };

  const updateField = <K extends keyof ElectricalConfiguration>(key: K, val: ElectricalConfiguration[K]) => {
    soundEngine.playInstall();
    onUpdateElectrical({ ...elec, [key]: val });
  };

  const toggleComplete = () => {
    soundEngine.playClick();
    onUpdateElectrical({ ...elec, isCompleted: !elec.isCompleted });
  };

  // Simplified Electrical Validation State (14 connections across 5 subsystems)
  const validation = useMemo(() => {
    return validateSimplifiedElectrical(wires);
  }, [wires]);

  // Handle port click
  const handlePortClick = (portId: string) => {
    soundEngine.playClick();
    if (!selectedPortId) {
      setSelectedPortId(portId);
      return;
    }

    if (selectedPortId === portId) {
      setSelectedPortId(null);
      return;
    }

    const p1 = selectedPortId;
    const p2 = portId;
    setSelectedPortId(null);

    // Prevent duplicate wire
    const alreadyConnected = wires.some(
      (w) => (w.fromPort === p1 && w.toPort === p2) || (w.fromPort === p2 && w.toPort === p1)
    );
    if (alreadyConnected) return;

    soundEngine.playInstall();
    const newWire: WireConnection = {
      id: uid('w'),
      fromPort: p1,
      toPort: p2,
    };
    const nextWires = [...wires, newWire];
    const isNowValid = validateSimplifiedElectrical(nextWires).valid;
    updateWires(nextWires, isNowValid);
  };

  const handleRemoveWire = (wireId: string) => {
    soundEngine.playClick();
    const nextWires = wires.filter((w) => w.id !== wireId);
    updateWires(nextWires, false);
    setPowerOnComplete(false);
  };

  const sub = validation.subsystems || {
    mainPower: validation.mainPowerConnected,
    driveSystem: validation.drivePowered,
    weaponSystem: validation.weaponPowered,
    robotComputer: validation.computerPowered,
    sensorNetwork: validation.sensorConnected ?? true,
  };

  const handleGetHint = () => {
    soundEngine.playClick();
    setHintsUsed((prev) => prev + 1);

    // Identify which subsystem is currently incomplete (in order of power distribution)
    let targetSubsystem = 'complete';
    if (!sub.mainPower) {
      targetSubsystem = 'mainPower';
    } else if (!sub.driveSystem) {
      targetSubsystem = 'driveSystem';
    } else if (!sub.weaponSystem) {
      targetSubsystem = 'weaponSystem';
    } else if (!sub.robotComputer) {
      targetSubsystem = 'robotComputer';
    } else if (!sub.sensorNetwork) {
      targetSubsystem = 'sensorNetwork';
    }

    if (targetSubsystem === 'complete') {
      setActiveHint({
        title: 'ALL SUBSYSTEMS WIRED',
        text: 'All required robot circuits appear connected! Click [POWER ON ROBOT] to verify voltages and boot the system.',
      });
      return;
    }

    const currentLevel = (hintStage[targetSubsystem] || 0) + 1;
    setHintStage((prev) => ({ ...prev, [targetSubsystem]: currentLevel }));

    let hintData: { title: string; text: string };

    if (targetSubsystem === 'mainPower') {
      if (currentLevel === 1) {
        hintData = {
          title: 'HINT 1 — CONCEPTUAL',
          text: 'Start by tracing how power gets from the battery to the rest of the robot.',
        };
      } else if (currentLevel === 2) {
        hintData = {
          title: 'HINT 2 — SUBSYSTEM',
          text: 'The Main Switch needs power from the battery before the Power Distribution Board can supply the robot.',
        };
      } else {
        hintData = {
          title: 'HINT 3 — CONNECTION CLUE',
          text: 'Look at the BATTERY output labels and the MAIN SWITCH input labels (+ to +, - to -). Trace the switch output to the PDB.',
        };
      }
    } else if (targetSubsystem === 'driveSystem') {
      if (currentLevel === 1) {
        hintData = {
          title: 'HINT 1 — CONCEPTUAL',
          text: 'The drive system requires power, steering control signals, and motor connections.',
        };
      } else if (currentLevel === 2) {
        hintData = {
          title: 'HINT 2 — SUBSYSTEM',
          text: 'The Drive Controller needs power from the PDB, command signals from the Computer, and phases to the drive motors.',
        };
      } else {
        hintData = {
          title: 'HINT 3 — CONNECTION CLUE',
          text: 'Inspect the Drive ESC ports: check PDB power input, the SIG control line from the computer, and the left and right motor outputs.',
        };
      }
    } else if (targetSubsystem === 'weaponSystem') {
      if (currentLevel === 1) {
        hintData = {
          title: 'HINT 1 — CONCEPTUAL',
          text: 'The high-current weapon motor cannot be powered directly by the computer. Look for the component between them.',
        };
      } else if (currentLevel === 2) {
        hintData = {
          title: 'HINT 2 — SUBSYSTEM',
          text: 'The Weapon ESC controls the weapon motor. It needs high-voltage power from the PDB and a trigger signal from the computer.',
        };
      } else {
        hintData = {
          title: 'HINT 3 — CONNECTION CLUE',
          text: 'Check the Weapon ESC: route weapon power from the PDB, connect the trigger signal from the computer, and connect the motor output phase.',
        };
      }
    } else if (targetSubsystem === 'robotComputer') {
      if (currentLevel === 1) {
        hintData = {
          title: 'HINT 1 — CONCEPTUAL',
          text: 'The Robot Computer uses regulated 5V power rather than direct high-voltage battery power.',
        };
      } else if (currentLevel === 2) {
        hintData = {
          title: 'HINT 2 — SUBSYSTEM',
          text: 'Trace power through the 5V Voltage Regulator. It takes high voltage from the PDB and outputs clean 5V to the computer.',
        };
      } else {
        hintData = {
          title: 'HINT 3 — CONNECTION CLUE',
          text: 'Connect the PDB regulator feed to the 5V Regulator input, then connect the regulator 5V output to the Robot Computer power input.',
        };
      }
    } else {
      if (currentLevel === 1) {
        hintData = {
          title: 'HINT 1 — CONCEPTUAL',
          text: 'The autonomous sensor suite needs a data path back to the Robot Computer.',
        };
      } else if (currentLevel === 2) {
        hintData = {
          title: 'HINT 2 — SUBSYSTEM',
          text: 'Sensors feed telemetry directly into the robot microcontroller so autonomous decision rules can function.',
        };
      } else {
        hintData = {
          title: 'HINT 3 — CONNECTION CLUE',
          text: 'Connect the SENSOR TELEMETRY port directly to the ROBOT COMPUTER SENSOR DATA port.',
        };
      }
    }

    setActiveHint(hintData);
  };

  const handleClearWires = () => {
    soundEngine.playClick();
    setSelectedPortId(null);
    setPowerOnComplete(false);
    setDiagnosticReport([]);
    updateWires([], false);
  };

  const handlePowerOn = () => {
    soundEngine.playClick();
    setIsPoweringOn(true);
    setDiagnosticReport([]);

    window.setTimeout(() => {
      setIsPoweringOn(false);
      const res = validateSimplifiedElectrical(wires);
      if (res.valid) {
        soundEngine.playInstall();
        setPowerOnComplete(true);
        updateWires(wires, true);
      } else {
        soundEngine.playWarning();
        setPowerOnComplete(false);
        setDiagnosticReport(
          res.observations.length > 0
            ? res.observations
            : ['System check failed: Harness incomplete or circuit short detected. Check connections.']
        );
      }
    }, 900);
  };

  // Port coordinates on the 1000x480 canvas
  const portCoordinates: Record<string, { x: number; y: number; label: string; system: string }> = {
    // Stage 1: Battery
    bat_pos: { x: 135, y: 195, label: 'BAT +', system: 'battery' },
    bat_neg: { x: 135, y: 255, label: 'BAT -', system: 'battery' },

    // Stage 2: Main Switch
    sw_in_pos: { x: 225, y: 195, label: 'IN +', system: 'switch' },
    sw_in_neg: { x: 225, y: 255, label: 'IN -', system: 'switch' },
    sw_out_pos: { x: 315, y: 195, label: 'OUT +', system: 'switch' },
    sw_out_neg: { x: 315, y: 255, label: 'OUT -', system: 'switch' },

    // Stage 3: PDB
    pdb_in_pos: { x: 405, y: 195, label: 'PDB IN +', system: 'pdb' },
    pdb_in_neg: { x: 405, y: 255, label: 'PDB IN -', system: 'pdb' },
    pdb_drive_out: { x: 495, y: 115, label: 'DRIVE PWR', system: 'pdb' },
    pdb_weapon_out: { x: 495, y: 225, label: 'WEAPON PWR', system: 'pdb' },
    pdb_reg_out: { x: 495, y: 345, label: '5V REG PWR', system: 'pdb' },

    // Stage 4: Controllers & 5V Regulator
    esc_drive_in: { x: 575, y: 95, label: 'POWER IN', system: 'drive' },
    esc_drive_sig: { x: 575, y: 135, label: 'SIGNAL', system: 'drive' },
    esc_drive_mot_l: { x: 675, y: 95, label: 'MOTOR L', system: 'drive' },
    esc_drive_mot_r: { x: 675, y: 135, label: 'MOTOR R', system: 'drive' },

    esc_weapon_in: { x: 575, y: 205, label: 'POWER IN', system: 'weapon' },
    esc_weapon_sig: { x: 575, y: 245, label: 'SIGNAL', system: 'weapon' },
    esc_weapon_mot: { x: 675, y: 225, label: 'MOTOR OUT', system: 'weapon' },

    reg_in: { x: 575, y: 345, label: '12V IN', system: 'regulator' },
    reg_out_5v: { x: 675, y: 345, label: '5V OUT', system: 'regulator' },

    // Stage 5: Motors, Computer, Sensor
    mot_left_in: { x: 765, y: 95, label: 'LEFT DRIVE', system: 'drive' },
    mot_right_in: { x: 765, y: 140, label: 'RIGHT DRIVE', system: 'drive' },
    mot_weapon_in: { x: 765, y: 225, label: 'WEAPON MOTOR', system: 'weapon' },

    comp_pwr_in: { x: 765, y: 325, label: '5V POWER', system: 'computer' },
    comp_sig_drive: { x: 765, y: 360, label: 'DRIVE SIG', system: 'computer' },
    comp_sig_weapon: { x: 765, y: 395, label: 'WEAPON SIG', system: 'computer' },
    comp_sens_data: { x: 865, y: 375, label: 'SENSOR DATA', system: 'computer' },

    sens_data: { x: 915, y: 375, label: 'TELEMETRY', system: 'sensor' },
  };

  const battery = BATTERY_OPTIONS[elec.batteryId];
  const driveEsc = DRIVE_ESC_OPTIONS[elec.driveEscRatingA];
  const weaponEsc = WEAPON_ESC_OPTIONS[elec.weaponEscRatingA];

  return (
    <div className="relative w-full h-full bg-slate-50 text-slate-800 overflow-y-auto flex flex-col justify-between p-4 md:p-5 font-sans">
      {/* Optional Top Sub-Header (when not inside global shell) */}
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
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-bold">
                  Discipline 02 • Electrical
                </span>
              </div>
              <h2 className="font-display font-black text-lg text-slate-900 leading-tight">
                Connect each robot system to the correct port.
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              title="Reset Electrical task progress"
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 bg-white border border-slate-200 hover:border-rose-200 transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>↻ Reset Task</span>
            </button>

            <button
              type="button"
              onClick={toggleComplete}
              disabled={!powerOnComplete}
              className={`cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-display font-bold transition-all ${
                !powerOnComplete
                  ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500'
                  : elec.isCompleted
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-amber-600 text-white hover:bg-amber-500 shadow-xs'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{elec.isCompleted ? 'Discipline Complete ✓' : 'Mark Complete'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Instruction & Action Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-800">
            Connect each robot system to the correct port.
          </p>
          {powerOnComplete && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> All Systems Online
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sub-tab Switcher: Wiring (dominant) vs Specs */}
          <div className="flex rounded-xl bg-slate-200/70 p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('wiring');
              }}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                activeTab === 'wiring'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Wiring Harness
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('specs');
              }}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                activeTab === 'specs'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Power Specs
            </button>
          </div>

          <button
            type="button"
            onClick={handleGetHint}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-sans font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors shadow-xs"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
            <span>Get Hint</span>
            {hintsUsed > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-200 text-amber-900 text-[10px] font-mono rounded-full font-bold">
                {hintsUsed}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleClearWires}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-sans font-semibold bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Board</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            title="Reset Electrical task progress"
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 bg-white border border-slate-200 hover:border-rose-200 transition-colors shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>↻ Reset Task</span>
          </button>

          <button
            type="button"
            onClick={handlePowerOn}
            disabled={isPoweringOn}
            className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2 rounded-xl font-display font-black text-xs uppercase transition-all shadow-md active:scale-98 ${
              powerOnComplete
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isPoweringOn ? 'Energizing...' : powerOnComplete ? 'System Online ✓' : '⚡ Power On Robot'}</span>
          </button>
        </div>
      </div>

      <ResetTaskModal
        isOpen={showResetModal}
        roleTitle="ELECTRICAL"
        description="This will clear all wires, reset the electrical checklist and power-on state, and mark the Electrical task as incomplete. Other team tasks will not be changed."
        onConfirm={handleResetElectrical}
        onCancel={() => setShowResetModal(false)}
      />

      {activeTab === 'wiring' ? (
        /* ============================================================
           100% FULL-WIDTH DOMINANT WIRING HARNESS BOARD WORKSTATION
           ============================================================ */
        <div className="flex-1 w-full flex flex-col justify-between min-h-[520px]">
          {/* Active Hint Banner */}
          {activeHint && (
            <div className="mb-2 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-3 text-xs font-sans z-10 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900 block text-[11px] tracking-wide uppercase">
                    {activeHint.title}
                  </span>
                  <p className="text-amber-950 mt-0.5 leading-relaxed">{activeHint.text}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveHint(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-amber-100/50 transition-colors shrink-0"
                title="Dismiss hint"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Diagnostic Failure Banner */}
          {diagnosticReport.length > 0 && !powerOnComplete && (
            <div className="mb-2 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-mono">{diagnosticReport[0]}</span>
            </div>
          )}

          {/* Full-Width SVG Breadboard Workspace */}
          <div className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-xs">
            {/* Status bar inside board */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="text-slate-500">
                  Harness Connections: <strong className="text-amber-700 font-bold">{wires.length} / 14</strong>
                </span>
                {selectedPortId && (
                  <span className="text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full animate-pulse text-[11px] font-sans">
                    Routing from: <strong>{portCoordinates[selectedPortId]?.label}</strong> — Click destination port
                  </span>
                )}
              </div>
              <span className="text-slate-400 font-sans text-[11px]">
                Click port to route wire • Click ✕ to disconnect
              </span>
            </div>

            {/* SVG Interactive Canvas */}
            <div className="relative flex-1 w-full min-h-[440px] h-[500px] rounded-2xl bg-[#f8fafc] border border-slate-200 overflow-hidden shadow-inner">
              <svg viewBox="0 0 1000 480" className="w-full h-full select-none">
                {/* Lab Grid Pattern */}
                <defs>
                  <pattern id="labGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
                  </pattern>
                </defs>
                <rect width="1000" height="480" fill="url(#labGrid)" />

                {/* 1. Component Visual Blocks */}
                {/* Stage 1: Battery */}
                <g transform="translate(35, 150)">
                  <rect width="100" height="140" rx="12" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" className="shadow-xs" />
                  <rect x="0" y="0" width="100" height="26" rx="12" fill="#0f172a" />
                  <text x="50" y="17" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    BATTERY
                  </text>
                  <text x="50" y="72" fill="#0284c7" fontSize="12" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    {battery.voltageV}V
                  </text>
                  <text x="50" y="92" fill="#64748b" fontSize="8.5" fontFamily="sans-serif" textAnchor="middle">
                    {battery.name}
                  </text>
                </g>

                {/* Stage 2: Main Switch */}
                <g transform="translate(225, 150)">
                  <rect width="90" height="140" rx="12" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
                  <rect x="0" y="0" width="90" height="26" rx="12" fill="#0f172a" />
                  <text x="45" y="17" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    MAIN SWITCH
                  </text>
                  <text x="45" y="78" fill="#64748b" fontSize="8.5" fontFamily="sans-serif" textAnchor="middle">
                    Safety Cutoff
                  </text>
                </g>

                {/* Stage 3: Power Distribution Board */}
                <g transform="translate(405, 75)">
                  <rect width="90" height="320" rx="12" fill="#ffffff" stroke="#d97706" strokeWidth="2" />
                  <rect x="0" y="0" width="90" height="26" rx="12" fill="#d97706" />
                  <text x="45" y="17" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    PDB BUS
                  </text>
                  <text x="45" y="172" fill="#78350f" fontSize="8.5" fontFamily="sans-serif" textAnchor="middle" fontWeight="bold">
                    Power Dist.
                  </text>
                </g>

                {/* Stage 4: Controllers & 5V Regulator */}
                {/* Drive ESC */}
                <g transform="translate(575, 65)">
                  <rect width="100" height="95" rx="12" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
                  <rect x="0" y="0" width="100" height="24" rx="12" fill="#0284c7" />
                  <text x="50" y="16" fill="#ffffff" fontSize="8.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    DRIVE ESC
                  </text>
                  <text x="50" y="58" fill="#0369a1" fontSize="9.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    {driveEsc.ratingA}A Rating
                  </text>
                </g>

                {/* Weapon ESC */}
                <g transform="translate(575, 175)">
                  <rect width="100" height="95" rx="12" fill="#ffffff" stroke="#d97706" strokeWidth="1.5" />
                  <rect x="0" y="0" width="100" height="24" rx="12" fill="#d97706" />
                  <text x="50" y="16" fill="#ffffff" fontSize="8.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    WEAPON ESC
                  </text>
                  <text x="50" y="58" fill="#b45309" fontSize="9.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    {weaponEsc.ratingA}A Rating
                  </text>
                </g>

                {/* 5V Regulator */}
                <g transform="translate(575, 310)">
                  <rect width="100" height="65" rx="12" fill="#ffffff" stroke="#059669" strokeWidth="1.5" />
                  <rect x="0" y="0" width="100" height="22" rx="12" fill="#059669" />
                  <text x="50" y="15" fill="#ffffff" fontSize="8" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    5V REGULATOR
                  </text>
                  <text x="50" y="48" fill="#047857" fontSize="8.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    Clean 5.0V Logic
                  </text>
                </g>

                {/* Stage 5: Devices / Motors / Computer */}
                {/* Left Drive Motor */}
                <g transform="translate(765, 75)">
                  <rect width="85" height="42" rx="8" fill="#ffffff" stroke="#0891b2" strokeWidth="1.5" />
                  <text x="42.5" y="25" fill="#0e7490" fontSize="8.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    LEFT MOTOR
                  </text>
                </g>

                {/* Right Drive Motor */}
                <g transform="translate(765, 125)">
                  <rect width="85" height="42" rx="8" fill="#ffffff" stroke="#0891b2" strokeWidth="1.5" />
                  <text x="42.5" y="25" fill="#0e7490" fontSize="8.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    RIGHT MOTOR
                  </text>
                </g>

                {/* Weapon Motor */}
                <g transform="translate(765, 205)">
                  <rect width="85" height="50" rx="8" fill="#ffffff" stroke="#d97706" strokeWidth="1.5" />
                  <text x="42.5" y="30" fill="#b45309" fontSize="8.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    WEAPON MOTOR
                  </text>
                </g>

                {/* Robot Computer */}
                <g transform="translate(765, 295)">
                  <rect width="100" height="125" rx="12" fill="#ffffff" stroke="#6366f1" strokeWidth="2" />
                  <rect x="0" y="0" width="100" height="24" rx="12" fill="#6366f1" />
                  <text x="50" y="16" fill="#ffffff" fontSize="8.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    ROBOT COMPUTER
                  </text>
                  <text x="50" y="65" fill="#4f46e5" fontSize="8" fontFamily="sans-serif" textAnchor="middle" fontWeight="bold">
                    5V Microcontroller
                  </text>
                </g>

                {/* Sensor Suite */}
                <g transform="translate(915, 345)">
                  <rect width="65" height="60" rx="8" fill="#ffffff" stroke="#ec4899" strokeWidth="1.5" />
                  <text x="32.5" y="35" fill="#be185d" fontSize="8" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                    SENSOR
                  </text>
                </g>

                {/* 2. Render Wires */}
                {wires.map((wire) => {
                  const p1 = portCoordinates[wire.fromPort];
                  const p2 = portCoordinates[wire.toPort];
                  if (!p1 || !p2) return null;

                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;
                  const pathD = `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;

                  return (
                    <g
                      key={wire.id}
                      className="cursor-pointer group"
                      onClick={() => handleRemoveWire(wire.id)}
                    >
                      <path d={pathD} fill="none" stroke="transparent" strokeWidth="20" />
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#d97706"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        className="group-hover:stroke-rose-600 transition-colors"
                      />
                      <circle
                        cx={midX}
                        cy={midY}
                        r="8"
                        fill="#ffffff"
                        stroke="#d97706"
                        strokeWidth="2"
                        className="group-hover:fill-rose-600 group-hover:stroke-rose-600 transition-colors"
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        fill="#d97706"
                        fontSize="8"
                        textAnchor="middle"
                        fontWeight="bold"
                        className="pointer-events-none group-hover:fill-white"
                      >
                        ✕
                      </text>
                    </g>
                  );
                })}

                {/* 3. Render Ports */}
                {Object.entries(portCoordinates).map(([portId, pos]) => {
                  const isSelected = selectedPortId === portId;

                  return (
                    <g
                      key={portId}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      className="cursor-pointer group"
                      onClick={() => handlePortClick(portId)}
                    >
                      {/* Port Hitbox */}
                      <circle r="18" fill="transparent" />

                      {/* Selected Source Pulse */}
                      {isSelected && (
                        <circle r="16" fill="none" stroke="#d97706" strokeWidth="2.5" className="animate-ping" />
                      )}

                      {/* Main Terminal Circle */}
                      <circle
                        r="7"
                        fill="#ffffff"
                        stroke={isSelected ? '#d97706' : '#64748b'}
                        strokeWidth={isSelected ? '3' : '2'}
                        className="group-hover:scale-125 group-hover:stroke-amber-600 transition-all"
                      />
                      <circle
                        r="3"
                        fill={isSelected ? '#d97706' : '#94a3b8'}
                        className="group-hover:fill-amber-600"
                      />

                      {/* Port Label */}
                      <text
                        x={0}
                        y={pos.y > 270 ? 17 : -12}
                        fill={isSelected ? '#d97706' : '#475569'}
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="pointer-events-none group-hover:fill-slate-900"
                      >
                        {pos.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Bottom Inspect Action */}
            <div className="pt-3 mt-1 border-t border-slate-200 flex items-center justify-between z-10 text-xs">
              <span className="text-slate-500 font-sans">
                Peak Current Draw: <strong className={summary.isOverCurrent ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>{summary.effectivePeakDemandA}A / {summary.batteryContinuousA}A</strong>
              </span>

              <button
                type="button"
                onClick={handlePowerOn}
                disabled={isPoweringOn}
                className="cursor-pointer inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-display font-black text-xs uppercase transition-all shadow-md bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20 active:scale-98"
              >
                <Power className="w-4 h-4" />
                <span>{isPoweringOn ? 'Energizing Rails...' : powerOnComplete ? 'System Online ✓' : '⚡ Power On Robot'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================
           TAB 2: POWER HARDWARE SPECIFICATIONS
           ============================================================ */
        <div className="flex-1 my-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h3 className="font-display font-bold text-sm text-slate-900 mb-3">Battery Capacity Selection</h3>
            <div className="space-y-2">
              {(Object.keys(BATTERY_OPTIONS) as (keyof typeof BATTERY_OPTIONS)[]).map((key) => {
                const opt = BATTERY_OPTIONS[key];
                const isSelected = elec.batteryId === key;
                return (
                  <div
                    key={key}
                    onClick={() => updateField('batteryId', key)}
                    className={`cursor-pointer p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-amber-50 border-amber-500 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-display font-bold text-sm">{opt.name}</span>
                      <span className="text-xs font-mono text-amber-700 font-bold">
                        {opt.continuousCurrentA}A Cont.
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{opt.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900 mb-3">Controller Headroom Specs</h3>
              <div className="mb-4">
                <span className="text-xs text-slate-500 font-semibold block mb-1.5 uppercase font-mono">Drive ESC:</span>
                <div className="grid grid-cols-3 gap-2">
                  {([35, 50, 70] as DriveEscRating[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateField('driveEscRatingA', r)}
                      className={`cursor-pointer py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                        elec.driveEscRatingA === r
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {r}A ESC
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-500 font-semibold block mb-1.5 uppercase font-mono">Weapon ESC:</span>
                <div className="grid grid-cols-3 gap-2">
                  {([40, 80, 120] as WeaponEscRating[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateField('weaponEscRatingA', r)}
                      className={`cursor-pointer py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                        elec.weaponEscRatingA === r
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {r}A ESC
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
              <div className="flex justify-between text-slate-600 mb-1 font-sans">
                <span>Estimated Runtime:</span>
                <span className="font-bold text-slate-900 font-mono">{summary.runtimeSeconds} Seconds</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
