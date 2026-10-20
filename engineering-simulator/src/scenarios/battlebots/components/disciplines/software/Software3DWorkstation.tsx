import { Html, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { ArrowRight, RotateCcw, Terminal } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { soundEngine } from '../../../audio/soundEngine';
import {
  type ComponentCategory,
  type RobotConfiguration,
  type TeamRobotProject,
} from '../../../types/robot';
import { Robot3D } from '../../three/Robot3D';

export type ControllerPort = 'POWER' | 'MOTOR' | 'SENSOR' | 'DATA';

interface Software3DWorkstationProps {
  project: TeamRobotProject;
  onOpenIde: () => void;
  onResetTask?: () => void;
}

interface PortSpec {
  id: ControllerPort;
  label: string;
  voltage: string;
  purpose: string;
  position: [number, number, number];
}

// 4 Controller Port Specs
const PORT_SPECS: Record<ControllerPort, PortSpec> = {
  POWER: {
    id: 'POWER',
    label: 'POWER',
    voltage: '12V DC',
    purpose: 'Main battery pack input rail',
    position: [-0.18, 0.038, 0.28],
  },
  MOTOR: {
    id: 'MOTOR',
    label: 'MOTOR',
    voltage: '5V PWM',
    purpose: 'Dual ESC brushless motor signals',
    position: [-0.06, 0.038, 0.28],
  },
  SENSOR: {
    id: 'SENSOR',
    label: 'SENSOR',
    voltage: '3.3V I2C',
    purpose: 'Telemetry & ultrasonic sensor bus',
    position: [0.06, 0.038, 0.28],
  },
  DATA: {
    id: 'DATA',
    label: 'DATA',
    voltage: '5V USB',
    purpose: 'Serial bootloader & firmware programming link',
    position: [0.18, 0.038, 0.28],
  },
};

const REST_CONNECTOR_POS: [number, number, number] = [-0.15, 0.022, 0.5];
const LAPTOP_USB_POS: [number, number, number] = [-0.92, 0.026, 0.16];

// ==========================================
// 3D USB PROGRAMMING CABLE
// ==========================================
const UsbCable3D: React.FC<{
  targetPos: [number, number, number];
  isConnected: boolean;
}> = ({ targetPos, isConnected }) => {
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...LAPTOP_USB_POS);
    const end = new THREE.Vector3(...targetPos);

    // Calculate natural slack points across the cutting mat
    const mid1 = new THREE.Vector3(
      start.x + (end.x - start.x) * 0.35,
      0.014,
      Math.max(start.z, end.z) + 0.15
    );
    const mid2 = new THREE.Vector3(
      start.x + (end.x - start.x) * 0.75,
      0.016,
      end.z + (isConnected ? 0.08 : 0.04)
    );

    return new THREE.CatmullRomCurve3([start, mid1, mid2, end]);
  }, [targetPos, isConnected]);

  return (
    <group>
      {/* Flexible silicone cable */}
      <mesh>
        <tubeGeometry args={[curve, 44, 0.009, 8, false]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Cable connector head */}
      <group position={targetPos} rotation={isConnected ? [-Math.PI / 2, 0, 0] : [-Math.PI / 2.3, 0, 0.2]}>
        {/* Molded rubber strain relief boot */}
        <mesh position={[0, -0.025, 0]}>
          <cylinderGeometry args={[0.014, 0.011, 0.03, 12]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
        {/* Plastic connector shell */}
        <mesh position={[0, -0.005, 0]}>
          <boxGeometry args={[0.028, 0.026, 0.016]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} />
        </mesh>
        {/* Nickel-plated USB/DuPont plug tip */}
        <mesh position={[0, 0.014, 0]}>
          <boxGeometry args={[0.022, 0.014, 0.012]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
};

// ==========================================
// 3D DEVELOPER LAPTOP WITH TERMINAL SCREEN
// ==========================================
const DeveloperLaptop3D: React.FC<{
  connectedPort: ControllerPort | null;
  statusLed: 'off' | 'amber' | 'green' | 'red';
  terminalMessage: string;
  terminalSub: string;
}> = ({ connectedPort, statusLed, terminalMessage, terminalSub }) => {
  return (
    <group position={[-1.3, 0.02, 0.15]} rotation={[0, Math.PI * 0.14, 0]}>
      {/* Laptop Base Body */}
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.022, 0.52]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Keyboard Well */}
      <mesh position={[0, 0.024, -0.04]}>
        <boxGeometry args={[0.62, 0.004, 0.28]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Trackpad */}
      <mesh position={[0, 0.024, 0.16]}>
        <boxGeometry args={[0.22, 0.002, 0.14]} />
        <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* USB Port Socket on right side */}
      <mesh position={[0.352, 0.012, 0]}>
        <boxGeometry args={[0.006, 0.012, 0.03]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} />
      </mesh>

      {/* Screen Display Lid (Tilted back ~110°) */}
      <group position={[0, 0.024, -0.25]} rotation={[-Math.PI * 0.38, 0, 0]}>
        {/* Lid Rear Casing */}
        <mesh position={[0, 0.26, -0.008]} castShadow>
          <boxGeometry args={[0.7, 0.52, 0.016]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Screen Bezel */}
        <mesh position={[0, 0.26, 0]}>
          <boxGeometry args={[0.67, 0.49, 0.002]} />
          <meshStandardMaterial color="#020617" roughness={0.8} />
        </mesh>

        {/* Glowing Screen Panel */}
        <mesh position={[0, 0.26, 0.002]}>
          <planeGeometry args={[0.64, 0.46]} />
          <meshBasicMaterial color="#030712" />
        </mesh>

        {/* Terminal Screen UI in 3D */}
        <Html
          transform
          occlude
          position={[0, 0.26, 0.004]}
          distanceFactor={0.58}
          className="pointer-events-none select-none w-[560px] h-[400px] bg-slate-950 text-slate-100 p-4 font-mono text-[11px] flex flex-col justify-between border border-slate-800 rounded-lg shadow-2xl"
        >
          <div>
            {/* Terminal Titlebar */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[10px] text-slate-400">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                <span className="font-bold text-slate-300 ml-1">BotCode Field Monitor v2.4</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold">
                <span
                  className={`size-2 rounded-full ${
                    statusLed === 'green'
                      ? 'bg-emerald-400 animate-pulse'
                      : statusLed === 'amber'
                      ? 'bg-amber-400 animate-pulse'
                      : statusLed === 'red'
                      ? 'bg-rose-400'
                      : 'bg-slate-600'
                  }`}
                />
                <span
                  className={
                    statusLed === 'green'
                      ? 'text-emerald-400'
                      : statusLed === 'amber'
                      ? 'text-amber-400'
                      : statusLed === 'red'
                      ? 'text-rose-400'
                      : 'text-slate-500'
                  }
                >
                  {statusLed === 'green'
                    ? 'LINK ACTIVE'
                    : statusLed === 'amber'
                    ? 'SYNCING...'
                    : statusLed === 'red'
                    ? 'BUS ERROR'
                    : 'NO LINK'}
                </span>
              </div>
            </div>

            {/* Terminal Log Output */}
            <div className="space-y-1.5 font-mono">
              <p className="text-slate-500">$ stm32-flash-util --port /dev/ttyUSB0 --probe</p>
              <p className="text-slate-400">
                [BUS] Scanning USB programmer endpoints on local workstation...
              </p>

              {connectedPort === null && (
                <div className="mt-4 p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  <p className="text-indigo-400 font-bold mb-1">
                    ► AWAITING CONTROLLER CONNECTION
                  </p>
                  <p className="text-slate-400 leading-relaxed text-[10px]">
                    Connect the 3D USB programming cable to the robot controller's serial interface.
                    Inspect the 4 labeled headers: [POWER], [MOTOR], [SENSOR], or [DATA].
                  </p>
                </div>
              )}

              {connectedPort !== null && connectedPort !== 'DATA' && (
                <div className="mt-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300">
                  <p className="text-rose-400 font-bold mb-1">[!] CONNECTION ERROR DETECTED</p>
                  <p className="text-rose-200 text-[10px] leading-relaxed">{terminalMessage}</p>
                  <p className="text-rose-400/80 text-[9px] mt-1.5">{terminalSub}</p>
                </div>
              )}

              {connectedPort === 'DATA' && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-emerald-200">
                  <p className="text-emerald-400 font-bold mb-1">✓ SERIAL LINK ESTABLISHED</p>
                  <p className="text-[10px] text-emerald-300 font-semibold">{terminalMessage}</p>
                  <p className="text-[9px] text-emerald-400/90 mt-1 font-mono">{terminalSub}</p>
                </div>
              )}
            </div>
          </div>

          {/* Terminal Footer */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span>Baud: 115200 • 8-N-1</span>
            <span>Target: STM32 Combat Core</span>
          </div>
        </Html>
      </group>
    </group>
  );
};

// ==========================================
// 3D MICROCONTROLLER BOARD & 4 PORTS
// ==========================================
const ControllerBoard3D: React.FC<{
  connectedPort: ControllerPort | null;
  statusLed: 'off' | 'amber' | 'green' | 'red';
  onSelectPort: (port: ControllerPort) => void;
}> = ({ connectedPort, statusLed, onSelectPort }) => {
  return (
    <group position={[0, 0.02, 0.28]}>
      {/* Green FR4 Circuit Board */}
      <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.56, 0.016, 0.32]} />
        <meshStandardMaterial color="#065f46" roughness={0.4} metalness={0.2} />
      </mesh>

      {/* Gold Edge Connector Traces */}
      <mesh position={[0, 0.019, 0.15]}>
        <boxGeometry args={[0.5, 0.002, 0.012]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* STM32 Microcontroller IC Package */}
      <mesh position={[-0.12, 0.024, -0.06]}>
        <boxGeometry args={[0.12, 0.014, 0.12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} />
      </mesh>

      {/* Crystal Oscillator Can */}
      <mesh position={[-0.2, 0.024, 0.04]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.036, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Controller Status LED */}
      <mesh position={[0.22, 0.024, -0.1]}>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshStandardMaterial
          color={
            statusLed === 'green'
              ? '#10b981'
              : statusLed === 'amber'
              ? '#f59e0b'
              : statusLed === 'red'
              ? '#ef4444'
              : '#334155'
          }
          emissive={
            statusLed === 'green'
              ? '#10b981'
              : statusLed === 'amber'
              ? '#f59e0b'
              : statusLed === 'red'
              ? '#ef4444'
              : '#000000'
          }
          emissiveIntensity={statusLed === 'off' ? 0 : 2.5}
        />
      </mesh>
      {statusLed === 'green' && (
        <pointLight position={[0.22, 0.08, -0.1]} color="#10b981" intensity={1.5} distance={0.6} />
      )}

      {/* Board silkscreen title */}
      <mesh position={[0.05, 0.019, -0.1]}>
        <planeGeometry args={[0.2, 0.04]} />
        <meshBasicMaterial color="#ffffff" opacity={0.8} transparent />
      </mesh>

      {/* 4 Labeled Controller Header Ports */}
      {(['POWER', 'MOTOR', 'SENSOR', 'DATA'] as ControllerPort[]).map((portKey) => {
        const spec = PORT_SPECS[portKey];
        const relX = spec.position[0];
        const isCurrentPlug = connectedPort === portKey;

        return (
          <group
            key={portKey}
            position={[relX, 0.02, 0.05]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPort(portKey);
            }}
          >
            {/* Clickable Hover / Collision Trigger Box */}
            <mesh
              position={[0, 0.02, 0]}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto';
              }}
            >
              <boxGeometry args={[0.08, 0.05, 0.06]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {/* Black Nylon Header Socket Block (Notice: DO NOT highlight DATA green beforehand!) */}
            <mesh position={[0, 0.016, 0]} castShadow>
              <boxGeometry args={[0.068, 0.026, 0.042]} />
              <meshStandardMaterial
                color={isCurrentPlug ? '#0284c7' : '#1e293b'}
                roughness={0.6}
                metalness={0.3}
              />
            </mesh>

            {/* Pin Holes */}
            <mesh position={[-0.016, 0.03, 0]}>
              <boxGeometry args={[0.008, 0.004, 0.014]} />
              <meshBasicMaterial color="#020617" />
            </mesh>
            <mesh position={[0.016, 0.03, 0]}>
              <boxGeometry args={[0.008, 0.004, 0.014]} />
              <meshBasicMaterial color="#020617" />
            </mesh>

            {/* Crisp 3D Printed White Label over Socket */}
            <Html
              position={[0, 0.042, 0]}
              center
              distanceFactor={0.9}
              className="pointer-events-none select-none text-center"
            >
              <div
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black tracking-wider transition-all border ${
                  isCurrentPlug
                    ? 'bg-cyan-500 text-white border-cyan-300 shadow-md scale-105'
                    : 'bg-slate-900/90 text-slate-100 border-slate-700'
                }`}
              >
                {spec.label}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

// ==========================================
// MAIN 3D SOFTWARE WORKSTATION COMPONENT
// ==========================================
export const Software3DWorkstation: React.FC<Software3DWorkstationProps> = ({
  project,
  onOpenIde,
  onResetTask,
}) => {
  const [selectedPort, setSelectedPort] = useState<ControllerPort | null>(null);
  const [statusLed, setStatusLed] = useState<'off' | 'amber' | 'green' | 'red'>('off');
  const [terminalMessage, setTerminalMessage] = useState<string>('');
  const [terminalSub, setTerminalSub] = useState<string>('');
  const [isDataConnected, setIsDataConnected] = useState<boolean>(
    Boolean(project.software.computerConnected || project.software.softwareUploaded)
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Derive Team BattleBot Configuration
  const robotConfig: RobotConfiguration = useMemo(() => {
    return {
      name: project.teamName,
      chassisId: project.mechanical.chassisId,
      driveId: project.mechanical.driveId,
      wheelsId: project.mechanical.wheelsId,
      armorId: project.mechanical.armorId,
      armorThickness: project.mechanical.armorThickness,
      weaponId: project.mechanical.weaponId,
      batteryId: project.electrical.batteryId,
      utilityId: project.mechanical.utilityId || 'none',
      accentColor: project.mechanical.accentColor || '#0284c7',
      autonomousStrategy:
        project.software.approach === 'flank'
          ? 'aggressive'
          : project.software.approach === 'careful'
          ? 'control'
          : 'aggressive',
    };
  }, [project]);

  const assembledCategories: ComponentCategory[] = useMemo(() => {
    if (project.mechanical.isCompleted) {
      return ['chassis', 'drive', 'wheels', 'armor', 'weapon', 'utility'];
    }
    return (project.mechanical.assembledParts as ComponentCategory[]) || ['chassis', 'drive', 'wheels'];
  }, [project.mechanical]);

  // Handle port connection logic
  const handleSelectPort = (port: ControllerPort) => {
    soundEngine.playClick();
    setSelectedPort(port);

    if (port === 'DATA') {
      // Correct serial programming port
      setStatusLed('amber');
      setTerminalMessage('Synchronizing with microcontroller bootloader...');
      setTerminalSub('Target: STM32F4 Combat Microcontroller • Handshake in progress');

      setTimeout(() => {
        soundEngine.playInstall();
        setStatusLed('green');
        setIsDataConnected(true);
        setTerminalMessage('STM32F4 Combat Microcontroller (Rev 3.2) Online');
        setTerminalSub('Serial Link: /dev/ttyUSB0 • 115200 Baud • Flash ready');
      }, 700);
    } else {
      // Wrong port: snap in briefly, trigger warning and unhook
      soundEngine.playWarning();
      setStatusLed('red');

      let explanation = '';
      let sub = '';
      if (port === 'POWER') {
        explanation = 'NO DATA LINK: DC 12V power supply bus detected.';
        sub = 'Microcontroller bootloader requires the [DATA] serial port, not the raw power rail.';
      } else if (port === 'MOTOR') {
        explanation = 'NO DATA LINK: PWM motor driver output header.';
        sub = 'Cannot upload firmware through motor ESC signal outputs.';
      } else {
        explanation = 'NO DATA LINK: I2C sensor bus detected.';
        sub = 'Telemetry input active — no USB programming interface.';
      }

      setTerminalMessage(explanation);
      setTerminalSub(sub);

      // Unplug cable back to workbench after 1.8 seconds
      setTimeout(() => {
        setSelectedPort(null);
        setStatusLed('off');
      }, 1800);
    }
  };

  const handleLaunchIde = () => {
    soundEngine.playInstall();
    setIsTransitioning(true);
    setTimeout(() => {
      onOpenIde();
    }, 450);
  };

  // Compute current cable connector end position
  const cableTargetPos: [number, number, number] = useMemo(() => {
    if (!selectedPort) return REST_CONNECTOR_POS;
    return PORT_SPECS[selectedPort].position;
  }, [selectedPort]);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-900 overflow-hidden select-none font-sans">
      {/* 3D Canvas Scene */}
      <div
        className={`flex-1 w-full h-full transition-opacity duration-500 ${
          isTransitioning ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
        }`}
      >
        <Canvas
          shadows
          camera={{ position: [0, 1.45, 2.35], fov: 42 }}
          className="w-full h-full"
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[4, 6, 4]} intensity={1.5} castShadow />
          <directionalLight position={[-4, 4, -2]} intensity={0.6} />

          {/* Workbench Table Surface */}
          <mesh position={[0, -0.06, 0]} receiveShadow>
            <boxGeometry args={[5.6, 0.08, 3.2]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.2} />
          </mesh>

          {/* Self-Healing Cutting Mat with Ruler Grid */}
          <group position={[0, -0.016, 0.08]}>
            <mesh receiveShadow>
              <boxGeometry args={[4.4, 0.01, 2.4]} />
              <meshStandardMaterial color="#064e3b" roughness={0.5} />
            </mesh>
            {/* Grid Lines on Cutting Mat */}
            <gridHelper
              args={[4.2, 42, '#047857', '#065f46']}
              position={[0, 0.006, 0]}
            />
          </group>

          {/* Left: 3D Developer Laptop */}
          <DeveloperLaptop3D
            connectedPort={selectedPort}
            statusLed={statusLed}
            terminalMessage={terminalMessage}
            terminalSub={terminalSub}
          />

          {/* Right: Team's Actual BattleBot */}
          <group position={[1.1, 0.01, -0.05]} rotation={[0, -Math.PI * 0.22, 0]}>
            <Robot3D
              config={robotConfig}
              assembledCategories={assembledCategories}
              wheelSpeedRad={0}
            />
          </group>

          {/* Center: Microcontroller Board with 4 Ports */}
          <ControllerBoard3D
            connectedPort={selectedPort}
            statusLed={statusLed}
            onSelectPort={handleSelectPort}
          />

          {/* 3D USB Programming Cable */}
          <UsbCable3D
            targetPos={cableTargetPos}
            isConnected={Boolean(selectedPort)}
          />

          <OrbitControls
            enablePan={false}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={1.2}
            maxDistance={3.8}
            target={[0, 0.1, 0.1]}
          />
        </Canvas>
      </div>

      {/* Floating Interactive Instructions & Port Selector Overlay */}
      <div className="absolute top-4 left-4 right-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pointer-events-none z-10">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-2xl shadow-xl pointer-events-auto max-w-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 font-bold">
              Field Engineering Workstation • Software Discipline
            </span>
          </div>
          <h2 className="font-display font-black text-white text-base leading-snug">
            Connect Computer to Robot Controller
          </h2>
          <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">
            Click the correct communication port on the robot controller board to attach the USB cable.
            Read the port labels carefully.
          </p>
        </div>

        {/* Reset Task Button */}
        {onResetTask && (
          <button
            type="button"
            onClick={onResetTask}
            className="cursor-pointer pointer-events-auto px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>↻ Reset Task</span>
          </button>
        )}
      </div>

      {/* Bottom HUD: Port Action Bar & Launch IDE Button */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row items-center justify-between gap-3 z-10 pointer-events-none">
        {/* Accessible Port Selection Buttons */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-2.5 rounded-2xl flex items-center gap-2 shadow-xl pointer-events-auto">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold px-2 hidden sm:inline">
            Controller Ports:
          </span>
          {(['POWER', 'MOTOR', 'SENSOR', 'DATA'] as ControllerPort[]).map((p) => {
            const isSelected = selectedPort === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handleSelectPort(p)}
                className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                  isSelected
                    ? p === 'DATA'
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg'
                      : 'bg-rose-600 border-rose-400 text-white shadow-lg'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                [{p}]
              </button>
            );
          })}
        </div>

        {/* Success / Launch IDE Button */}
        {isDataConnected && (
          <div className="pointer-events-auto animate-bounce">
            <button
              type="button"
              onClick={handleLaunchIde}
              className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-display font-black text-sm uppercase tracking-wider shadow-2xl shadow-indigo-500/50 transition-all active:scale-95 border border-indigo-400"
            >
              <Terminal className="w-4 h-4 text-emerald-300" />
              <span>Open BotCode IDE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
