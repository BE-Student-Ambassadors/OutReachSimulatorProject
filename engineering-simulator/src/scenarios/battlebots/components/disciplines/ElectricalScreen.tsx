import {
  ArrowLeft,
  BookOpen,
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
}

export const ElectricalScreen: React.FC<ElectricalScreenProps> = ({
  project,
  onUpdateElectrical,
  onReturnToDashboard,
}) => {
  const elec = project.electrical;
  const summary = computeTeamEngineeringSummary(project);

  const [activeTab, setActiveTab] = useState<'wiring' | 'specs'>('wiring');
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [isPoweringOn, setIsPoweringOn] = useState(false);
  const [powerOnComplete, setPowerOnComplete] = useState(elec.wiringVerified);
  const [showReference, setShowReference] = useState(true);
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

  // Handle port click - all ports neutral, no giveaway hints
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
        text: 'All required robot circuits appear connected! Click [POWER ON] to verify voltages and boot the system.',
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
      // sensorNetwork
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
          text: 'Connect the sensor DATA telemetry line directly to the Robot Computer sensor telemetry port.',
        };
      }
    }

    setActiveHint(hintData);
  };

  const handleClearWires = () => {
    soundEngine.playClick();
    updateWires([], false);
    setSelectedPortId(null);
    setPowerOnComplete(false);
    setDiagnosticReport([]);
    setActiveHint(null);
  };

  const handlePowerOn = () => {
    setIsPoweringOn(true);
    soundEngine.playClick();

    window.setTimeout(() => {
      setIsPoweringOn(false);
      if (validation.valid) {
        soundEngine.playArenaHorn();
        setPowerOnComplete(true);
        updateWires(wires, true);
        setDiagnosticReport([]);
      } else {
        soundEngine.playWarning();
        setDiagnosticReport(validation.observations);
        setPowerOnComplete(false);
      }
    }, 1000);
  };

  // 14-connection layout mapped to SVG viewBox 0 0 1000 480
  const portCoordinates: Record<string, { x: number; y: number; label: string; system: string }> = {
    // Stage 1: Battery
    bat_pos: { x: 135, y: 195, label: 'BATTERY +', system: 'battery' },
    bat_neg: { x: 135, y: 255, label: 'BATTERY -', system: 'battery' },

    // Stage 2: Main Switch
    sw_in_pos: { x: 225, y: 195, label: 'SWITCH IN +', system: 'switch' },
    sw_in_neg: { x: 225, y: 255, label: 'SWITCH IN -', system: 'switch' },
    sw_out_pos: { x: 315, y: 195, label: 'SWITCH OUT +', system: 'switch' },
    sw_out_neg: { x: 315, y: 255, label: 'SWITCH OUT -', system: 'switch' },

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

  const sub = validation.subsystems || {
    mainPower: validation.mainPowerConnected,
    driveSystem: validation.drivePowered,
    weaponSystem: validation.weaponPowered,
    robotComputer: validation.computerPowered,
    sensorNetwork: validation.sensorConnected ?? true,
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
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-[10px] font-mono-num uppercase tracking-wider text-amber-400 font-semibold">
                DISCIPLINE 02 • ELECTRICAL ENGINEER
              </span>
            </div>
            <h2 className="font-display font-black text-2xl text-white">WIRE THE ROBOT</h2>
          </div>
        </div>

        {/* Tab & Completion Controls */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-mono-num">
            <button
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('wiring');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'wiring'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              WIRING HARNESS
            </button>
            <button
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('specs');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'specs'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              POWER SPECS
            </button>
          </div>

          <button
            onClick={() => setShowResetModal(true)}
            title="Reset Electrical task progress"
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono-num text-slate-400 hover:text-rose-300 bg-slate-900 border border-slate-800 hover:border-rose-900/50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>↻ Reset Task</span>
          </button>

          <button
            onClick={toggleComplete}
            disabled={!powerOnComplete}
            className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-display font-bold transition-all ${
              !powerOnComplete
                ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                : elec.isCompleted
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {elec.isCompleted ? 'DISCIPLINE COMPLETE' : 'MARK COMPLETE'}
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
        /* ==========================================
           TAB 1: 14-WIRE EXPANDED WIRING HARNESS BOARD
           ========================================== */
        <div className="flex-1 flex flex-col lg:flex-row gap-4 mt-3 min-h-[500px]">
          {/* Main Visual Board */}
          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 z-10 text-xs font-mono-num flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">
                  HARNESS CONNECTIONS: <strong className="text-amber-400">{wires.length} / 14</strong>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400/80" />
                  HINTS USED: <strong className={hintsUsed > 0 ? 'text-amber-300' : 'text-slate-400'}>{hintsUsed}</strong>
                </span>
                {selectedPortId && (
                  <span className="text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full animate-pulse">
                    Routing from: <strong>{portCoordinates[selectedPortId]?.label}</strong> — Click destination port
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowReference(!showReference)}
                  className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono-num border transition-colors ${
                    showReference
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  REFERENCE
                </button>
                <button
                  onClick={handleGetHint}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono-num bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-colors"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>GET HINT</span>
                  {hintsUsed > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-amber-500/30 text-[10px] rounded-full">
                      {hintsUsed}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleClearWires}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono-num bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  CLEAR
                </button>
              </div>
            </div>

            {/* Active Hint Banner */}
            {activeHint && (
              <div className="mt-2.5 mb-1 p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-start justify-between gap-3 text-xs font-mono-num z-10 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-300 block text-[11px] tracking-wide uppercase">
                      {activeHint.title}
                    </span>
                    <p className="text-slate-200 mt-0.5 leading-relaxed">{activeHint.text}</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveHint(null)}
                  className="cursor-pointer text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors shrink-0"
                  title="Dismiss hint"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* SVG Visual Canvas */}
            <div className="relative flex-1 w-full h-[420px]">
              <svg viewBox="0 0 1000 480" className="w-full h-full select-none">
                {/* 1. Component Visual Blocks */}
                {/* Stage 1: Battery */}
                <g transform="translate(35, 150)">
                  <rect width="100" height="140" rx="10" fill="#0f172a" stroke="#334155" strokeWidth="2" />
                  <rect x="0" y="0" width="100" height="24" rx="10" fill="#1e293b" />
                  <text x="50" y="16" fill="#f8fafc" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    BATTERY
                  </text>
                  <text x="50" y="70" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    {battery.voltageV}V
                  </text>
                  <text x="50" y="90" fill="#94a3b8" fontSize="8.5" fontFamily="monospace" textAnchor="middle">
                    {battery.name}
                  </text>
                </g>

                {/* Stage 2: Main Switch */}
                <g transform="translate(225, 150)">
                  <rect width="90" height="140" rx="10" fill="#0f172a" stroke="#334155" strokeWidth="2" />
                  <rect x="0" y="0" width="90" height="24" rx="10" fill="#1e293b" />
                  <text x="45" y="16" fill="#f8fafc" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    MAIN SWITCH
                  </text>
                  <text x="45" y="75" fill="#94a3b8" fontSize="8.5" fontFamily="monospace" textAnchor="middle">
                    Safety Cutoff
                  </text>
                </g>

                {/* Stage 3: Power Distribution Board */}
                <g transform="translate(405, 75)">
                  <rect width="90" height="320" rx="10" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                  <rect x="0" y="0" width="90" height="24" rx="10" fill="#78350f" />
                  <text x="45" y="16" fill="#fef3c7" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    PDB BUS
                  </text>
                  <text x="45" y="170" fill="#cbd5e1" fontSize="8.5" fontFamily="monospace" textAnchor="middle">
                    Power Dist.
                  </text>
                </g>

                {/* Stage 4: Controllers & 5V Regulator */}
                {/* Drive ESC */}
                <g transform="translate(575, 65)">
                  <rect width="100" height="95" rx="10" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                  <rect x="0" y="0" width="100" height="22" rx="10" fill="#0369a1" />
                  <text x="50" y="15" fill="#f0f9ff" fontSize="8.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    DRIVE ESC
                  </text>
                  <text x="50" y="55" fill="#38bdf8" fontSize="9" fontFamily="monospace" textAnchor="middle">
                    {driveEsc.ratingA}A Rating
                  </text>
                </g>

                {/* Weapon ESC */}
                <g transform="translate(575, 175)">
                  <rect width="100" height="95" rx="10" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                  <rect x="0" y="0" width="100" height="22" rx="10" fill="#b45309" />
                  <text x="50" y="15" fill="#fffbeb" fontSize="8.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    WEAPON ESC
                  </text>
                  <text x="50" y="55" fill="#f59e0b" fontSize="9" fontFamily="monospace" textAnchor="middle">
                    {weaponEsc.ratingA}A Rating
                  </text>
                </g>

                {/* 5V Regulator */}
                <g transform="translate(575, 310)">
                  <rect width="100" height="65" rx="10" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
                  <rect x="0" y="0" width="100" height="20" rx="10" fill="#065f46" />
                  <text x="50" y="14" fill="#ecfdf5" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    5V REGULATOR
                  </text>
                  <text x="50" y="48" fill="#34d399" fontSize="8.5" fontFamily="monospace" textAnchor="middle">
                    Clean 5.0V Logic
                  </text>
                </g>

                {/* Stage 5: Devices / Motors / Computer */}
                {/* Left Drive Motor */}
                <g transform="translate(765, 75)">
                  <rect width="85" height="42" rx="8" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />
                  <text x="42.5" y="25" fill="#67e8f9" fontSize="8.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    LEFT MOTOR
                  </text>
                </g>

                {/* Right Drive Motor */}
                <g transform="translate(765, 125)">
                  <rect width="85" height="42" rx="8" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />
                  <text x="42.5" y="25" fill="#67e8f9" fontSize="8.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    RIGHT MOTOR
                  </text>
                </g>

                {/* Weapon Motor */}
                <g transform="translate(765, 205)">
                  <rect width="85" height="50" rx="8" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
                  <text x="42.5" y="30" fill="#fde047" fontSize="8.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    WEAPON MOTOR
                  </text>
                </g>

                {/* Robot Computer */}
                <g transform="translate(765, 295)">
                  <rect width="100" height="125" rx="10" fill="#0f172a" stroke="#a855f7" strokeWidth="2" />
                  <rect x="0" y="0" width="100" height="22" rx="10" fill="#6b21a8" />
                  <text x="50" y="15" fill="#faf5ff" fontSize="8.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    ROBOT COMPUTER
                  </text>
                  <text x="50" y="65" fill="#c084fc" fontSize="8" fontFamily="monospace" textAnchor="middle">
                    5V Microcontroller
                  </text>
                </g>

                {/* Sensor Suite */}
                <g transform="translate(915, 345)">
                  <rect width="65" height="60" rx="8" fill="#0f172a" stroke="#ec4899" strokeWidth="1.5" />
                  <text x="32.5" y="35" fill="#f472b6" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
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
                        stroke="#f59e0b"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        className="group-hover:stroke-rose-400 transition-colors"
                      />
                      <circle
                        cx={midX}
                        cy={midY}
                        r="8"
                        fill="#0f172a"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        className="group-hover:fill-rose-600 transition-colors"
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        fill="#ffffff"
                        fontSize="8"
                        textAnchor="middle"
                        fontWeight="bold"
                        className="pointer-events-none"
                      >
                        ✕
                      </text>
                    </g>
                  );
                })}

                {/* 3. Render Ports (Neutral Visual Interface - NO Green Giveaways) */}
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
                        <circle r="16" fill="none" stroke="#f59e0b" strokeWidth="2.5" className="animate-ping" />
                      )}

                      {/* Main Terminal Circle - Visually Neutral */}
                      <circle
                        r="7"
                        fill="#0f172a"
                        stroke={isSelected ? '#f59e0b' : '#64748b'}
                        strokeWidth={isSelected ? '3' : '2'}
                        className="group-hover:scale-125 group-hover:stroke-amber-400 transition-all"
                      />
                      <circle
                        r="3"
                        fill={isSelected ? '#f59e0b' : '#94a3b8'}
                        className="group-hover:fill-amber-300"
                      />

                      {/* Port Label */}
                      <text
                        x={0}
                        y={pos.y > 270 ? 17 : -12}
                        fill={isSelected ? '#f59e0b' : '#94a3b8'}
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="pointer-events-none group-hover:fill-white"
                      >
                        {pos.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Bottom Inspect Action */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between z-10">
              <span className="text-xs font-mono-num text-slate-400">
                Click a port to start wire, then click another port to connect. Click wire junction (✕) to remove.
              </span>

              <button
                onClick={handlePowerOn}
                disabled={isPoweringOn}
                className="cursor-pointer inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-display font-black text-sm transition-all shadow-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 transform hover:-translate-y-0.5 active:scale-95"
              >
                <Power className="w-4 h-4" />
                {isPoweringOn ? 'ENERGIZING RAILS...' : powerOnComplete ? 'SYSTEM ONLINE ✓' : 'POWER ON'}
              </button>
            </div>
          </div>

          {/* Right Column: Reference Diagram & Subsystem Checklist */}
          <div className="w-full lg:w-88 flex flex-col gap-3">
            {/* Wiring Reference (Schematic) */}
            {showReference && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs font-mono-num">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    WIRING REFERENCE
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase">SCHEMATIC CLUE</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-slate-300 leading-relaxed font-mono-num">
                  <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800/60">
                    <strong className="text-sky-300">BATTERY (+, -)</strong> → <span className="text-slate-200">MAIN SWITCH (+, -)</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800/60">
                    <strong className="text-slate-200">MAIN SWITCH (+, -)</strong> → <span className="text-amber-300">PDB BUS (+, -)</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800/60">
                    <strong className="text-amber-300">PDB BUS</strong> →
                    <div className="pl-3 text-[10px] text-slate-400 space-y-0.5 mt-0.5">
                      <div>• DRIVE PWR → DRIVE ESC [POWER IN]</div>
                      <div>• WEAPON PWR → WEAPON ESC [POWER IN]</div>
                      <div>• 5V REG PWR → 5V REGULATOR [12V IN]</div>
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800/60">
                    <strong className="text-emerald-300">5V REGULATOR</strong> → <span className="text-purple-300">ROBOT COMPUTER [5V POWER]</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800/60">
                    <strong className="text-purple-300">ROBOT COMPUTER</strong> →
                    <div className="pl-3 text-[10px] text-slate-400 space-y-0.5 mt-0.5">
                      <div>• DRIVE SIG → DRIVE ESC [SIGNAL]</div>
                      <div>• WEAPON SIG → WEAPON ESC [SIGNAL]</div>
                      <div>• SENSOR DATA ← SENSOR [TELEMETRY]</div>
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800/60">
                    <strong className="text-cyan-300">CONTROLLER OUTPUTS</strong> →
                    <div className="pl-3 text-[10px] text-slate-400 space-y-0.5 mt-0.5">
                      <div>• DRIVE ESC [L, R] → LEFT & RIGHT MOTORS</div>
                      <div>• WEAPON ESC [OUT] → WEAPON MOTOR</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Electrical Checklist & Status Panel */}
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    <h3 className="font-display font-bold text-sm text-white">ELECTRICAL CHECKLIST</h3>
                  </div>
                </div>

                {/* Subsystem-Level Checklist (No Giveaways) */}
                <div className="mt-4 space-y-2.5">
                  {[
                    { label: 'Main power online', complete: sub.mainPower },
                    { label: 'Drive system online', complete: sub.driveSystem },
                    { label: 'Weapon system online', complete: sub.weaponSystem },
                    { label: 'Robot computer online', complete: sub.robotComputer },
                    { label: 'Sensor network online', complete: sub.sensorNetwork },
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

                {/* Startup Diagnostics */}
                <div className="mt-4">
                  {powerOnComplete ? (
                    <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono-num space-y-1">
                      <div className="flex items-center gap-1.5 font-bold mb-1 text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        ELECTRICAL SYSTEM VERIFIED
                      </div>
                      <div className="text-[11px] font-mono-num text-slate-200">
                        MAIN POWER............ONLINE<br />
                        DRIVE CONTROLLER......ONLINE<br />
                        WEAPON CONTROLLER.....ONLINE<br />
                        ROBOT COMPUTER........ONLINE<br />
                        SENSOR NETWORK........ONLINE
                      </div>
                    </div>
                  ) : diagnosticReport.length > 0 ? (
                    <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-200 text-xs font-mono-num space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-400">
                        <ShieldAlert className="w-4 h-4" />
                        DIAGNOSTIC FAULT REPORT:
                      </div>
                      <div className="text-[11px] text-rose-300 leading-relaxed">
                        {diagnosticReport[0]}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono-num">
                      Wire all components using the diagram, then click <strong>[POWER ON]</strong> to run diagnostics.
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Summary Bar */}
              <div className="pt-3 border-t border-slate-800 text-xs font-mono-num text-slate-400 flex justify-between">
                <span>PEAK CURRENT:</span>
                <strong className={summary.isOverCurrent ? 'text-red-400' : 'text-emerald-400'}>
                  {summary.effectivePeakDemandA}A / {summary.batteryContinuousA}A
                </strong>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==========================================
           TAB 2: POWER HARDWARE SPECIFICATIONS
           ========================================== */
        <div className="flex-1 my-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <h3 className="font-display font-bold text-sm text-white mb-3">BATTERY CAPACITY SELECTION</h3>
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
                        ? 'bg-amber-500/15 border-amber-500 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-display font-bold text-sm">{opt.name}</span>
                      <span className="text-xs font-mono-num text-amber-400 font-bold">
                        {opt.continuousCurrentA}A Cont.
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{opt.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <h3 className="font-display font-bold text-sm text-white mb-3">CONTROLLER HEADROOM</h3>
              <div className="mb-4">
                <span className="text-xs font-mono-num text-slate-400 block mb-1.5">DRIVE ESC:</span>
                <div className="grid grid-cols-3 gap-2">
                  {([35, 50, 70] as DriveEscRating[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => updateField('driveEscRatingA', r)}
                      className={`cursor-pointer py-2 rounded-xl text-xs font-mono-num font-bold border transition-all ${
                        elec.driveEscRatingA === r
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      {r}A ESC
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-mono-num text-slate-400 block mb-1.5">WEAPON ESC:</span>
                <div className="grid grid-cols-3 gap-2">
                  {([40, 80, 120] as WeaponEscRating[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => updateField('weaponEscRatingA', r)}
                      className={`cursor-pointer py-2 rounded-xl text-xs font-mono-num font-bold border transition-all ${
                        elec.weaponEscRatingA === r
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      {r}A ESC
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono-num">
              <div className="flex justify-between text-slate-400 mb-1">
                <span>ESTIMATED RUNTIME:</span>
                <span className="font-bold text-slate-200">{summary.runtimeSeconds} Seconds</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
