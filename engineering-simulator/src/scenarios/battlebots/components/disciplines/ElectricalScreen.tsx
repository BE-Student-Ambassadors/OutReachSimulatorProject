import {
  ArrowLeft,
  CheckCircle2,
  Power,
  RotateCcw,
  ShieldAlert,
  Wand2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import {
  BATTERY_OPTIONS,
  DEFAULT_SIMPLIFIED_WIRES,
  DRIVE_ESC_OPTIONS,
  SIMPLIFIED_PORT_COMPATIBILITY,
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
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [isPoweringOn, setIsPoweringOn] = useState(false);
  const [powerOnComplete, setPowerOnComplete] = useState(elec.wiringVerified);

  const wires = elec.wires || [];

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

  // Simplified Electrical Validation State
  const validation = useMemo(() => {
    return validateSimplifiedElectrical(wires);
  }, [wires]);

  // Handle port selection and wiring
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

    // Check compatibility
    const compatible = SIMPLIFIED_PORT_COMPATIBILITY[p1] || [];
    if (!compatible.includes(p2)) {
      soundEngine.playWarning();
      return;
    }

    // Prevent duplicate wire
    const alreadyConnected = wires.some(
      (w) => (w.fromPort === p1 && w.toPort === p2) || (w.fromPort === p2 && w.toPort === p1)
    );
    if (alreadyConnected) return;

    soundEngine.playInstall();
    const newWire: WireConnection = {
      id: `w-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

  const handleAutoRoute = () => {
    soundEngine.playInstall();
    updateWires([...DEFAULT_SIMPLIFIED_WIRES], true);
    setPowerOnComplete(true);
  };

  const handleClearWires = () => {
    soundEngine.playClick();
    updateWires([], false);
    setSelectedPortId(null);
    setPowerOnComplete(false);
  };

  const handlePowerOn = () => {
    if (!validation.valid) {
      soundEngine.playWarning();
      return;
    }
    soundEngine.playArenaHorn();
    setIsPoweringOn(true);
    window.setTimeout(() => {
      setIsPoweringOn(false);
      setPowerOnComplete(true);
      soundEngine.playInstall();
      updateWires(wires, true);
    }, 1200);
  };

  // Node and Port Coordinates mapped to SVG viewBox 0 0 1000 520
  const portCoordinates: Record<string, { x: number; y: number; label: string; system: string }> = {
    // Stage 1: Battery
    bat_out: { x: 140, y: 220, label: 'BATTERY OUT', system: 'battery' },

    // Stage 2: Main Switch
    sw_in: { x: 230, y: 220, label: 'SWITCH IN', system: 'switch' },
    sw_out: { x: 330, y: 220, label: 'SWITCH OUT', system: 'switch' },

    // Stage 3: PDB
    pdb_in: { x: 420, y: 220, label: 'PDB IN', system: 'pdb' },
    pdb_drive_out: { x: 530, y: 120, label: 'DRIVE OUT', system: 'pdb' },
    pdb_weapon_out: { x: 530, y: 220, label: 'WEAPON OUT', system: 'pdb' },
    pdb_comp_out: { x: 530, y: 340, label: '5V LOGIC OUT', system: 'pdb' },

    // Stage 4: Controllers
    esc_drive_in: { x: 630, y: 120, label: 'DRIVE ESC IN', system: 'drive' },
    esc_drive_out: { x: 740, y: 120, label: 'DRIVE ESC OUT', system: 'drive' },

    esc_weapon_in: { x: 630, y: 220, label: 'WEAPON ESC IN', system: 'weapon' },
    esc_weapon_out: { x: 740, y: 220, label: 'WEAPON ESC OUT', system: 'weapon' },

    comp_in: { x: 630, y: 340, label: 'COMPUTER 5V IN', system: 'computer' },

    // Stage 5: Devices / Motors
    mot_drive_in: { x: 840, y: 120, label: 'MOTORS IN', system: 'drive' },
    mot_weapon_in: { x: 840, y: 220, label: 'WEAPON MOTOR IN', system: 'weapon' },
  };

  const compatibleTargetSet = useMemo(() => {
    if (!selectedPortId) return new Set<string>();
    return new Set(SIMPLIFIED_PORT_COMPATIBILITY[selectedPortId] || []);
  }, [selectedPortId]);

  const battery = BATTERY_OPTIONS[elec.batteryId];
  const driveEsc = DRIVE_ESC_OPTIONS[elec.driveEscRatingA];
  const weaponEsc = WEAPON_ESC_OPTIONS[elec.weaponEscRatingA];

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

      {/* Clear Educational Instruction Banner */}
      <div className="my-3 p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs font-mono-num">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
            YOUR TASK
          </span>
          <span className="text-slate-200">
            Connect power from the battery to every system:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            1. Battery → Main Switch
          </span>
          <span>→</span>
          <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            2. Main Switch → PDB
          </span>
          <span>→</span>
          <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            3. PDB → Controllers
          </span>
          <span>→</span>
          <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            4. Controllers → Motors / Weapon / Computer
          </span>
        </div>
      </div>

      {activeTab === 'wiring' ? (
        /* ==========================================
           TAB 1: STREAMLINED WIRING HARNESS BOARD
           ========================================== */
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-[480px]">
          {/* Main Visual Board */}
          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 z-10 text-xs font-mono-num">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">
                  WIRES: <strong className="text-amber-400">{wires.length} / 7</strong>
                </span>
                {selectedPortId && (
                  <span className="text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full animate-pulse">
                    Routing from: {portCoordinates[selectedPortId]?.label} (Click compatible green port)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoRoute}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono-num bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  AUTO-CONNECT
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

            {/* SVG Visual Canvas */}
            <div className="relative flex-1 w-full h-[400px]">
              <svg viewBox="0 0 960 440" className="w-full h-full select-none">
                {/* 1. Component Visual Blocks */}
                {/* Stage 1: Battery */}
                <g transform="translate(40, 160)">
                  <rect width="110" height="120" rx="12" fill="#0f172a" stroke="#334155" strokeWidth="2" />
                  <rect x="0" y="0" width="110" height="26" rx="12" fill="#1e293b" />
                  <text x="55" y="17" fill="#f8fafc" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    BATTERY
                  </text>
                  <text x="55" y="65" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    {battery.voltageV}V
                  </text>
                  <text x="55" y="85" fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle">
                    {battery.name}
                  </text>
                </g>

                {/* Stage 2: Main Switch */}
                <g transform="translate(220, 160)">
                  <rect width="120" height="120" rx="12" fill="#0f172a" stroke="#334155" strokeWidth="2" />
                  <rect x="0" y="0" width="120" height="26" rx="12" fill="#1e293b" />
                  <text x="60" y="17" fill="#f8fafc" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    MAIN SWITCH
                  </text>
                  <text x="60" y="70" fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle">
                    Safety Cutoff
                  </text>
                </g>

                {/* Stage 3: Power Distribution Board */}
                <g transform="translate(410, 80)">
                  <rect width="130" height="290" rx="12" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                  <rect x="0" y="0" width="130" height="26" rx="12" fill="#78350f" />
                  <text x="65" y="17" fill="#fef3c7" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    PDB BUS
                  </text>
                  <text x="65" y="150" fill="#cbd5e1" fontSize="9" fontFamily="monospace" textAnchor="middle">
                    Power Splitter
                  </text>
                </g>

                {/* Stage 4: Controllers */}
                {/* Drive ESC */}
                <g transform="translate(620, 70)">
                  <rect width="130" height="90" rx="10" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                  <rect x="0" y="0" width="130" height="22" rx="10" fill="#0369a1" />
                  <text x="65" y="15" fill="#f0f9ff" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    DRIVE ESC
                  </text>
                  <text x="65" y="55" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle">
                    {driveEsc.ratingA}A Rating
                  </text>
                </g>

                {/* Weapon ESC */}
                <g transform="translate(620, 175)">
                  <rect width="130" height="90" rx="10" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                  <rect x="0" y="0" width="130" height="22" rx="10" fill="#b45309" />
                  <text x="65" y="15" fill="#fffbeb" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    WEAPON ESC
                  </text>
                  <text x="65" y="55" fill="#f59e0b" fontSize="10" fontFamily="monospace" textAnchor="middle">
                    {weaponEsc.ratingA}A Rating
                  </text>
                </g>

                {/* Robot Computer (5V) */}
                <g transform="translate(620, 290)">
                  <rect width="130" height="90" rx="10" fill="#0f172a" stroke="#a855f7" strokeWidth="2" />
                  <rect x="0" y="0" width="130" height="22" rx="10" fill="#6b21a8" />
                  <text x="65" y="15" fill="#faf5ff" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    ROBOT COMPUTER
                  </text>
                  <text x="65" y="55" fill="#c084fc" fontSize="9" fontFamily="monospace" textAnchor="middle">
                    5V Autonomous
                  </text>
                </g>

                {/* Stage 5: Devices / Motors */}
                {/* Drive Motors */}
                <g transform="translate(830, 75)">
                  <rect width="100" height="80" rx="10" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />
                  <text x="50" y="45" fill="#67e8f9" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    DRIVE MOTORS
                  </text>
                </g>

                {/* Weapon Motor */}
                <g transform="translate(830, 180)">
                  <rect width="100" height="80" rx="10" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
                  <text x="50" y="45" fill="#fde047" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    WEAPON MOTOR
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
                        strokeWidth="4"
                        strokeLinecap="round"
                        className="group-hover:stroke-rose-400 transition-colors"
                      />
                      <circle
                        cx={midX}
                        cy={midY}
                        r="9"
                        fill="#0f172a"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        className="group-hover:fill-rose-600 transition-colors"
                      />
                      <text
                        x={midX}
                        y={midY + 3.5}
                        fill="#ffffff"
                        fontSize="9"
                        textAnchor="middle"
                        fontWeight="bold"
                        className="pointer-events-none"
                      >
                        ✕
                      </text>
                    </g>
                  );
                })}

                {/* 3. Render Ports */}
                {Object.entries(portCoordinates).map(([portId, pos]) => {
                  const isSelected = selectedPortId === portId;
                  const isCompatible = compatibleTargetSet.has(portId);

                  return (
                    <g
                      key={portId}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      className="cursor-pointer group"
                      onClick={() => handlePortClick(portId)}
                    >
                      {/* Port Hitbox */}
                      <circle r="18" fill="transparent" />

                      {/* Compatible Destination Pulse Glow */}
                      {isCompatible && (
                        <circle r="16" fill="none" stroke="#10b981" strokeWidth="2.5" className="animate-ping" />
                      )}

                      {/* Selected Source Pulse */}
                      {isSelected && (
                        <circle r="16" fill="none" stroke="#f59e0b" strokeWidth="2.5" className="animate-ping" />
                      )}

                      {/* Main Terminal Circle */}
                      <circle
                        r="8"
                        fill="#0f172a"
                        stroke={isSelected ? '#f59e0b' : isCompatible ? '#10b981' : '#64748b'}
                        strokeWidth={isSelected || isCompatible ? '3.5' : '2'}
                        className="group-hover:scale-125 transition-transform"
                      />
                      <circle
                        r="3.5"
                        fill={isSelected ? '#f59e0b' : isCompatible ? '#10b981' : '#94a3b8'}
                      />

                      {/* Port Label */}
                      <text
                        x={0}
                        y={pos.y > 250 ? 18 : -14}
                        fill={isSelected ? '#f59e0b' : isCompatible ? '#34d399' : '#94a3b8'}
                        fontSize="8.5"
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
                Click a port, then click the highlighted target port to run wire.
              </span>

              <button
                onClick={handlePowerOn}
                disabled={!validation.valid || isPoweringOn}
                className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-black text-sm transition-all shadow-lg ${
                  !validation.valid
                    ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 transform hover:-translate-y-0.5'
                }`}
              >
                <Power className="w-4 h-4" />
                {isPoweringOn ? 'ENERGIZING RAILS...' : powerOnComplete ? 'SYSTEM ONLINE ✓' : 'POWER ON TEST'}
              </button>
            </div>
          </div>

          {/* Electrical Checklist & Status Panel */}
          <div className="w-full lg:w-80 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                <h3 className="font-display font-bold text-sm text-white">ELECTRICAL CHECKLIST</h3>
              </div>

              {/* 5 Satisfying Checklist Items */}
              <div className="mt-4 space-y-2.5">
                {[
                  { label: 'Battery connected', complete: validation.batteryConnected },
                  { label: 'Main power connected', complete: validation.mainPowerConnected },
                  { label: 'Drive system powered', complete: validation.drivePowered },
                  { label: 'Weapon system powered', complete: validation.weaponPowered },
                  { label: 'Robot computer powered', complete: validation.computerPowered },
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

              {/* Startup Status Banner */}
              <div className="mt-4">
                {powerOnComplete ? (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono-num">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      POWER SYSTEM ONLINE
                    </div>
                    All 5 systems safely energized. Drivetrain and weapon motors ready for combat!
                  </div>
                ) : validation.observations.length > 0 ? (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs font-mono-num">
                    <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-400">
                      <ShieldAlert className="w-4 h-4" />
                      SYSTEMS PENDING:
                    </div>
                    {validation.observations[0]}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono-num">
                    Ready to test. Click <strong>[POWER ON TEST]</strong> to energize the robot.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Summary Bar */}
            <div className="pt-3 border-t border-slate-800 text-xs font-mono-num text-slate-400 flex justify-between">
              <span>PEAK DEMAND:</span>
              <strong className={summary.isOverCurrent ? 'text-red-400' : 'text-emerald-400'}>
                {summary.effectivePeakDemandA}A / {summary.batteryContinuousA}A
              </strong>
            </div>
          </div>
        </div>
      ) : (
        /* ==========================================
           TAB 2: POWER HARDWARE SPECIFICATIONS
           ========================================== */
        <div className="flex-1 my-2 grid grid-cols-1 md:grid-cols-2 gap-4">
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
