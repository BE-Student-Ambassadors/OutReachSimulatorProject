import { Html, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { ArrowRight, HelpCircle, RotateCcw, Terminal, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { soundEngine } from '../../../audio/soundEngine';
import { CHASSIS_CATALOG } from '../../../data/components';
import {
  type ComponentCategory,
  type RobotConfiguration,
  type TeamRobotProject,
} from '../../../types/robot';
import { Robot3D } from '../../three/Robot3D';

export type ControllerPort = 'POWER' | 'DATA' | 'MOTOR' | 'SENSOR';

interface Software3DWorkstationProps {
  project: TeamRobotProject;
  connectedPort: ControllerPort | null;
  onPortChange: (port: ControllerPort | null) => void;
  explanationAcknowledged: boolean;
  onAcknowledgeExplanation: () => void;
  onOpenIde: () => void;
  onResetTask?: () => void;
}

interface PortSpec {
  id: ControllerPort;
  label: string;
  voltage: string;
  purpose: string;
  relX: number;
}

// 4 Controller Port Specs spaced across the robot's rear service panel
// DATA is strictly the second port physically: [POWER, DATA, MOTOR, SENSOR]
export const PORT_ORDER: ControllerPort[] = ['POWER', 'DATA', 'MOTOR', 'SENSOR'];

const PORT_SPECS: Record<ControllerPort, PortSpec> = {
  POWER: {
    id: 'POWER',
    label: 'POWER',
    voltage: '12V DC',
    purpose: 'Main battery pack input rail',
    relX: -0.15,
  },
  DATA: {
    id: 'DATA',
    label: 'DATA',
    voltage: '5V USB',
    purpose: 'Serial bootloader & firmware programming link',
    relX: -0.05,
  },
  MOTOR: {
    id: 'MOTOR',
    label: 'MOTOR',
    voltage: '5V PWM',
    purpose: 'Dual ESC brushless motor signals',
    relX: 0.05,
  },
  SENSOR: {
    id: 'SENSOR',
    label: 'SENSOR',
    voltage: '3.3V I2C',
    purpose: 'Telemetry & ultrasonic sensor bus',
    relX: 0.15,
  },
};

const REST_CONNECTOR_POS: [number, number, number] = [-0.2, 0.022, 0.45];
const LAPTOP_USB_POS: [number, number, number] = [-0.98, 0.032, 0.0];

// Robot Workbench Placement & Angle
// Angled at Math.PI * 0.72 (~130°) so the upper rear service deck faces
// directly toward the camera and laptop, keeping all front weapons (spinners,
// lifters, wedges) tucked in the background where they can never obstruct the DATA port.
const ROBOT_POS: [number, number, number] = [0.68, 0.01, 0.04];
const ROBOT_ROT_Y = Math.PI * 0.72;

// ==========================================
// 3D USB PROGRAMMING CABLE
// ==========================================
const UsbCable3D: React.FC<{
  targetPos: [number, number, number];
  isConnected: boolean;
  isDragging: boolean;
  onStartDrag?: (e: any) => void;
}> = ({ targetPos, isConnected, isDragging, onStartDrag }) => {
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...LAPTOP_USB_POS);
    const end = new THREE.Vector3(...targetPos);

    if (isDragging) {
      // Natural droop while being held by pointer in 3D
      const mid1 = new THREE.Vector3(
        start.x + (end.x - start.x) * 0.45,
        Math.max(0.015, Math.min(start.y, end.y) * 0.5),
        start.z + (end.z - start.z) * 0.35 + 0.12
      );
      const mid2 = new THREE.Vector3(
        end.x - (end.x - start.x) * 0.15,
        Math.max(0.03, end.y * 0.75),
        end.z + 0.04
      );
      return new THREE.CatmullRomCurve3([start, mid1, mid2, end]);
    }

    if (!isConnected) {
      // Natural draping on cutting mat when cable is idle
      const mid1 = new THREE.Vector3(
        start.x + (end.x - start.x) * 0.4,
        0.014,
        start.z + 0.22
      );
      const mid2 = new THREE.Vector3(
        start.x + (end.x - start.x) * 0.8,
        0.016,
        end.z + 0.06
      );
      return new THREE.CatmullRomCurve3([start, mid1, mid2, end]);
    }

    // Rises from cutting mat up to robot's upper rear service deck
    const mid1 = new THREE.Vector3(
      start.x + 0.35,
      0.014,
      start.z + 0.2
    );
    const mid2 = new THREE.Vector3(
      end.x - 0.28,
      0.02,
      end.z + 0.16
    );
    const mid3 = new THREE.Vector3(
      end.x - 0.06,
      Math.max(0.08, end.y * 0.9),
      end.z + 0.03
    );

    return new THREE.CatmullRomCurve3([start, mid1, mid2, mid3, end]);
  }, [targetPos, isConnected, isDragging]);

  return (
    <group>
      {/* Flexible silicone cable */}
      <mesh>
        <tubeGeometry args={[curve, 48, 0.009, 8, false]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Cable connector head */}
      <group
        position={targetPos}
        rotation={
          isConnected
            ? [-Math.PI / 2, 0, 0]
            : isDragging
            ? [-Math.PI / 2.6, 0, 0.1]
            : [-Math.PI / 2.3, 0, 0.2]
        }
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartDrag?.(e);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = isDragging ? 'grabbing' : 'grab';
        }}
        onPointerOut={() => {
          if (!isDragging) {
            document.body.style.cursor = 'auto';
          }
        }}
      >
        {/* Invisible enlarged hit target for easy mouse dragging */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.07, 0.07, 0.07]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Molded rubber strain relief boot */}
        <mesh position={[0, -0.025, 0]}>
          <cylinderGeometry args={[0.014, 0.011, 0.03, 12]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
        {/* Plastic connector shell */}
        <mesh position={[0, -0.005, 0]}>
          <boxGeometry args={[0.028, 0.026, 0.016]} />
          <meshStandardMaterial
            color={isDragging ? '#0284c7' : '#1e293b'}
            roughness={0.5}
            metalness={0.4}
          />
        </mesh>
        {/* Nickel-plated USB/DuPont plug tip */}
        <mesh position={[0, 0.014, 0]}>
          <boxGeometry args={[0.022, 0.014, 0.012]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Grabbing indicator label when hovering loose connector */}
        {!isConnected && !isDragging && (
          <Html position={[0, 0.05, 0]} center distanceFactor={0.8} className="pointer-events-none select-none">
            <div className="bg-slate-900/90 text-[9px] font-mono font-bold text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/50 shadow-md whitespace-nowrap">
              Drag to Connect
            </div>
          </Html>
        )}
      </group>
    </group>
  );
};

// ==========================================
// 3D DEVELOPER LAPTOP WITH POWERED-ON WHITE SCREEN
// ==========================================
const DeveloperLaptop3D: React.FC<{
  connectedPort: ControllerPort | null;
}> = ({ connectedPort }) => {
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

        {/* Visibly Powered-On White Screen Backlight Panel */}
        <mesh position={[0, 0.26, 0.002]}>
          <planeGeometry args={[0.64, 0.46]} />
          <meshStandardMaterial
            color="#f8fafc"
            emissive="#ffffff"
            emissiveIntensity={0.25}
            roughness={0.2}
          />
        </mesh>

        {/* Soft screen light casting onto keyboard and table */}
        <pointLight
          position={[0, 0.26, 0.14]}
          color="#f8fafc"
          intensity={0.5}
          distance={0.9}
        />

        {/* Reactive White Screen UI in 3D */}
        <Html
          transform
          occlude
          position={[0, 0.26, 0.004]}
          distanceFactor={0.58}
          className="pointer-events-none select-none w-[560px] h-[400px] bg-slate-50 text-slate-800 p-5 font-mono text-[12px] flex flex-col justify-between border-2 border-slate-300 rounded-lg shadow-2xl"
        >
          <div>
            {/* Titlebar */}
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-rose-400 inline-block" />
                <span className="size-3 rounded-full bg-amber-400 inline-block" />
                <span className="size-3 rounded-full bg-emerald-400 inline-block" />
                <span className="font-bold text-slate-800 ml-1 text-[13px] tracking-wide">
                  BOTCODE LINK
                </span>
              </div>
              <div
                className={`flex items-center gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md border shadow-2xs ${
                  connectedPort === 'DATA'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : connectedPort
                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    connectedPort === 'DATA'
                      ? 'bg-emerald-600 animate-pulse'
                      : connectedPort
                      ? 'bg-rose-600'
                      : 'bg-slate-400'
                  }`}
                />
                <span>
                  {connectedPort === 'DATA'
                    ? 'LINK ACTIVE'
                    : connectedPort
                    ? 'INTERFACE ERROR'
                    : 'STANDBY'}
                </span>
              </div>
            </div>

            {/* Main Screen Content by State */}
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block font-bold">
                  Robot Connection
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                  STATUS
                </span>
              </div>

              {/* STATE A — NO CONNECTION */}
              {connectedPort === null && (
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-700 text-sm font-bold">
                    <span className="text-base leading-none text-slate-400">○</span>
                    <span>NO ROBOT CONNECTED</span>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Connect the computer to the robot's data interface.
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                    Awaiting USB serial programming connection...
                  </p>
                </div>
              )}

              {/* STATE B — WRONG PORT */}
              {connectedPort !== null && connectedPort !== 'DATA' && (
                <div className="p-4 rounded-xl bg-rose-50/90 border border-rose-200 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 text-sm font-bold">
                    <span className="text-base leading-none">✕</span>
                    <span>CONNECTION NOT RECOGNIZED</span>
                  </div>
                  <p className="text-rose-800 text-xs leading-relaxed font-medium">
                    No data connection detected.
                  </p>
                  <p className="text-[10px] text-rose-600 font-mono pt-1 border-t border-rose-200/60">
                    The computer cannot establish a programming connection through this port.
                  </p>
                </div>
              )}

              {/* STATE C — CORRECT DATA PORT */}
              {connectedPort === 'DATA' && (
                <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-200 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 text-sm font-bold">
                    <span className="text-base leading-none">✓</span>
                    <span>ROBOT CONNECTED</span>
                  </div>
                  <p className="text-emerald-700 text-xs leading-relaxed font-semibold">
                    Data link established.
                  </p>
                  <p className="text-[10px] text-emerald-600 font-mono pt-1 border-t border-emerald-200/60">
                    Serial baud rate: 115200 • Ready to flash firmware
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Screen Footer */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
            <span>Baud: 115200 • 8-N-1</span>
            <span>Interface: USB-UART Bridge</span>
          </div>
        </Html>
      </group>
    </group>
  );
};

// ==========================================
// 3D MICROCONTROLLER BOARD & 4 PORTS (MOUNTED ON ROBOT UPPER REAR DECK)
// ==========================================
const ControllerBoard3D: React.FC<{
  serviceDeckY: number;
  serviceRearZ: number;
  connectedPort: ControllerPort | null;
  hoveredPort: ControllerPort | null;
  onHoverPort: (port: ControllerPort | null) => void;
  onSelectPort: (port: ControllerPort) => void;
}> = ({
  serviceDeckY,
  serviceRearZ,
  connectedPort,
  hoveredPort,
  onHoverPort,
  onSelectPort,
}) => {
  const isDataConnected = connectedPort === 'DATA';
  const hasError = connectedPort !== null && connectedPort !== 'DATA';

  return (
    <group position={[0, serviceDeckY, serviceRearZ]}>
      {/* Heavy Anodized Aluminum Service Deck Mounting Plate */}
      <mesh position={[0, 0.008, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.48, 0.016, 0.22]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.85} />
      </mesh>

      {/* Hex Mounting Screws on the 4 Corners */}
      {[-0.22, 0.22].map((sx) =>
        [-0.09, 0.09].map((sz) => (
          <mesh key={`${sx}_${sz}`} position={[sx, 0.017, sz]}>
            <cylinderGeometry args={[0.009, 0.009, 0.006, 6]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
          </mesh>
        ))
      )}

      {/* High-Temp FR4 Green Circuit Board */}
      <mesh position={[0, 0.018, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.008, 0.17]} />
        <meshStandardMaterial color="#065f46" roughness={0.4} metalness={0.25} />
      </mesh>

      {/* Gold Edge Connector Traces */}
      <mesh position={[0, 0.023, 0.075]}>
        <boxGeometry args={[0.38, 0.002, 0.01]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* STM32 Microcontroller IC Package */}
      <mesh position={[-0.12, 0.026, -0.04]}>
        <boxGeometry args={[0.09, 0.01, 0.09]} />
        <meshStandardMaterial color="#020617" roughness={0.6} />
      </mesh>

      {/* Crystal Oscillator Can */}
      <mesh position={[-0.16, 0.026, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.009, 0.009, 0.026, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Controller Status LED */}
      <mesh position={[0.16, 0.026, -0.04]}>
        <sphereGeometry args={[0.009, 16, 16]} />
        <meshStandardMaterial
          color={
            isDataConnected
              ? '#10b981'
              : hasError
              ? '#ef4444'
              : '#334155'
          }
          emissive={
            isDataConnected
              ? '#10b981'
              : hasError
              ? '#ef4444'
              : '#000000'
          }
          emissiveIntensity={isDataConnected || hasError ? 2.5 : 0}
        />
      </mesh>
      {isDataConnected && (
        <pointLight position={[0.16, 0.08, -0.04]} color="#10b981" intensity={1.5} distance={0.6} />
      )}

      {/* 4 Labeled Controller Header Ports: DATA is the 2nd port */}
      {PORT_ORDER.map((portKey) => {
        const spec = PORT_SPECS[portKey];
        const isCurrentPlug = connectedPort === portKey;
        const isHovered = hoveredPort === portKey;

        return (
          <group
            key={portKey}
            position={[spec.relX, 0.018, 0.02]}
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
                onHoverPort(portKey);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                onHoverPort(null);
                document.body.style.cursor = 'auto';
              }}
            >
              <boxGeometry args={[0.08, 0.06, 0.06]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {/* Neutral Hover Outline / Glow (EXACT SAME for all 4 ports; NEVER green for DATA before connect) */}
            {isHovered && !isCurrentPlug && (
              <mesh position={[0, 0.014, 0]}>
                <boxGeometry args={[0.076, 0.03, 0.048]} />
                <meshBasicMaterial color="#38bdf8" wireframe />
              </mesh>
            )}

            {/* Black Nylon Header Socket Block (Neutral #1e293b by default; NEVER green before connection) */}
            <mesh position={[0, 0.014, 0]} castShadow>
              <boxGeometry args={[0.064, 0.024, 0.038]} />
              <meshStandardMaterial
                color={
                  isCurrentPlug
                    ? portKey === 'DATA'
                      ? '#059669'
                      : '#dc2626'
                    : isHovered
                    ? '#334155'
                    : '#1e293b'
                }
                emissive={isHovered && !isCurrentPlug ? '#0284c7' : '#000000'}
                emissiveIntensity={isHovered && !isCurrentPlug ? 0.35 : 0}
                roughness={0.6}
                metalness={0.3}
              />
            </mesh>

            {/* Pin Holes */}
            <mesh position={[-0.014, 0.026, 0]}>
              <boxGeometry args={[0.007, 0.004, 0.012]} />
              <meshBasicMaterial color="#020617" />
            </mesh>
            <mesh position={[0.014, 0.026, 0]}>
              <boxGeometry args={[0.007, 0.004, 0.012]} />
              <meshBasicMaterial color="#020617" />
            </mesh>

            {/* Floating 3D Badge: High-contrast, clearly legible, medium/semi-bold weight */}
            <Html
              position={[0, 0.052, 0]}
              center
              distanceFactor={1.4}
              className="pointer-events-none select-none text-center"
            >
              <div
                className={`w-[54px] py-0.5 rounded-md text-xs font-sans font-semibold tracking-wider transition-all border shadow-lg inline-block text-center ${
                  isCurrentPlug
                    ? portKey === 'DATA'
                      ? 'bg-emerald-600 text-white border-emerald-300 ring-2 ring-emerald-400/40 scale-105'
                      : 'bg-rose-600 text-white border-rose-300 ring-2 ring-rose-400/40 scale-105'
                    : isHovered
                    ? 'bg-slate-900 text-cyan-300 border-2 border-cyan-400 ring-2 ring-cyan-400/50 scale-105'
                    : 'bg-slate-950 text-white border-2 border-slate-300/90 shadow-md'
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
  connectedPort,
  onPortChange,
  explanationAcknowledged,
  onAcknowledgeExplanation,
  onOpenIde,
  onResetTask,
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showPortGuideModal, setShowPortGuideModal] = useState(false);
  const [hoveredPort, setHoveredPort] = useState<ControllerPort | null>(null);
  const [isDraggingCable, setIsDraggingCable] = useState(false);
  const [dragCablePos, setDragCablePos] = useState<[number, number, number] | null>(null);

  const isDataConnected = connectedPort === 'DATA';
  const hasWrongPortError = connectedPort !== null && connectedPort !== 'DATA';

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

  // Compute exact upper rear service deck height and position based on the robot's physical chassis
  const { serviceDeckY, serviceRearZ } = useMemo(() => {
    const chassisSpec = CHASSIS_CATALOG[project.mechanical.chassisId] || CHASSIS_CATALOG.compact;
    const { length: cL, height: cH } = chassisSpec.dims;

    let wheelRadius = 0.32;
    switch (project.mechanical.wheelsId) {
      case 'small':
        wheelRadius = 0.23;
        break;
      case 'large':
        wheelRadius = 0.42;
        break;
      case 'high-traction':
        wheelRadius = 0.32;
        break;
      case 'omni':
        wheelRadius = 0.31;
        break;
      case 'tracks':
        wheelRadius = 0.28;
        break;
    }

    const lowOffset = project.mechanical.chassisId === 'low-profile' ? -0.05 : 0;
    const deckCenterY = Math.max(cH * 0.55 + 0.06, wheelRadius + lowOffset);

    // Mounted on the upper top plate of the rear electronics area
    const deckY = deckCenterY + cH * 0.5 + 0.02;
    const rearZ = -cL * 0.34;

    return { serviceDeckY: deckY, serviceRearZ: rearZ };
  }, [project.mechanical.chassisId, project.mechanical.wheelsId]);

  // Compute world positions of all 4 ports for precise cable routing
  const portWorldPositions = useMemo<Record<ControllerPort, [number, number, number]>>(() => {
    const cosY = Math.cos(ROBOT_ROT_Y);
    const sinY = Math.sin(ROBOT_ROT_Y);

    const calcWorld = (relX: number): [number, number, number] => {
      const localX = relX;
      const localY = serviceDeckY + 0.038;
      const localZ = serviceRearZ + 0.02;

      const wx = ROBOT_POS[0] + localX * cosY + localZ * sinY;
      const wy = ROBOT_POS[1] + localY;
      const wz = ROBOT_POS[2] - localX * sinY + localZ * cosY;

      return [wx, wy, wz];
    };

    return {
      POWER: calcWorld(PORT_SPECS.POWER.relX),
      MOTOR: calcWorld(PORT_SPECS.MOTOR.relX),
      SENSOR: calcWorld(PORT_SPECS.SENSOR.relX),
      DATA: calcWorld(PORT_SPECS.DATA.relX),
    };
  }, [serviceDeckY, serviceRearZ]);

  // Handle clicking a port: toggles disconnect if already plugged, or plugs into clicked port
  const handleSelectPort = (port: ControllerPort) => {
    if (connectedPort === port) {
      // Unplug
      soundEngine.playClick();
      onPortChange(null);
      return;
    }

    soundEngine.playClick();
    onPortChange(port);

    if (port === 'DATA') {
      soundEngine.playInstall();
    } else {
      soundEngine.playWarning();
    }
  };

  const handleDisconnect = () => {
    soundEngine.playClick();
    onPortChange(null);
  };

  const handleLaunchIde = () => {
    if (!isDataConnected) return;
    soundEngine.playInstall();
    setIsTransitioning(true);
    setTimeout(() => {
      onOpenIde();
    }, 450);
  };

  // Compute current cable connector end position
  const cableTargetPos: [number, number, number] = useMemo(() => {
    if (isDraggingCable && dragCablePos) return dragCablePos;
    if (!connectedPort) return REST_CONNECTOR_POS;
    return portWorldPositions[connectedPort] || REST_CONNECTOR_POS;
  }, [isDraggingCable, dragCablePos, connectedPort, portWorldPositions]);

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

          {/* Invisible plane to capture 3D pointer dragging across the workstation */}
          {isDraggingCable && (
            <mesh
              position={[0, 0.16, 0.2]}
              rotation={[-Math.PI * 0.18, 0, 0]}
              onPointerMove={(e) => {
                e.stopPropagation();
                const p = e.point;
                const clampedX = Math.max(-1.15, Math.min(1.15, p.x));
                const clampedY = Math.max(0.02, Math.min(0.65, p.y));
                const clampedZ = Math.max(-0.4, Math.min(0.75, p.z));
                const nextPos: [number, number, number] = [clampedX, clampedY, clampedZ];
                setDragCablePos(nextPos);

                // Proximity snap check to ports
                let closestPort: ControllerPort | null = null;
                let minDist = 0.22;
                for (const pKey of PORT_ORDER) {
                  const pPos = portWorldPositions[pKey];
                  const d = Math.hypot(
                    pPos[0] - clampedX,
                    pPos[1] - clampedY,
                    pPos[2] - clampedZ
                  );
                  if (d < minDist) {
                    minDist = d;
                    closestPort = pKey;
                  }
                }
                setHoveredPort(closestPort);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                setIsDraggingCable(false);
                setDragCablePos(null);
                document.body.style.cursor = 'auto';
                if (hoveredPort) {
                  handleSelectPort(hoveredPort);
                }
              }}
            >
              <planeGeometry args={[14, 14]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          )}

          {/* Left: 3D Developer Laptop with Powered-On White Screen */}
          <DeveloperLaptop3D connectedPort={connectedPort} />

          {/* Right: Team's Actual BattleBot with Upper Rear Service Panel */}
          <group position={ROBOT_POS} rotation={[0, ROBOT_ROT_Y, 0]}>
            <Robot3D
              config={robotConfig}
              assembledCategories={assembledCategories}
              wheelSpeedRad={0}
              sponsor={project.projectLead.activeSponsors?.[0] || null}
            />
            {/* Elevated Service Deck mounted on robot upper rear */}
            <ControllerBoard3D
              serviceDeckY={serviceDeckY}
              serviceRearZ={serviceRearZ}
              connectedPort={connectedPort}
              hoveredPort={hoveredPort}
              onHoverPort={setHoveredPort}
              onSelectPort={handleSelectPort}
            />
          </group>

          {/* 3D USB Programming Cable (Interactive grab & drag) */}
          <UsbCable3D
            targetPos={cableTargetPos}
            isConnected={Boolean(connectedPort)}
            isDragging={isDraggingCable}
            onStartDrag={() => {
              setIsDraggingCable(true);
              setDragCablePos(cableTargetPos);
            }}
          />

          <OrbitControls
            enabled={!isDraggingCable}
            enablePan={false}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={1.2}
            maxDistance={3.8}
            target={[0, 0.1, 0.1]}
          />
        </Canvas>
      </div>

      {/* Floating Top Banner & Controls */}
      <div className="absolute top-4 left-4 right-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pointer-events-none z-10">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-2xl shadow-xl pointer-events-auto max-w-lg">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isDataConnected
                  ? 'bg-emerald-400 animate-pulse'
                  : hasWrongPortError
                  ? 'bg-rose-400'
                  : 'bg-cyan-400 animate-pulse'
              }`}
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 font-bold">
              Field Engineering Workstation • Software Discipline
            </span>
            <span className="text-[9px] font-mono font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-700/80 px-2 py-0.5 rounded-full">
              SIMULATED PROGRAMMING LANGUAGE
            </span>
          </div>
          <h2 className="font-display font-black text-white text-base leading-snug">
            Connect Computer to Robot Controller
          </h2>
          <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">
            Attach the USB programming cable to the robot controller's serial data interface.
            Inspect the 4 labeled headers on the robot's upper rear service deck.
          </p>
        </div>

        {/* Toolbar Buttons: Port Guide & Reset Task */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {explanationAcknowledged && (
            <button
              type="button"
              onClick={() => setShowPortGuideModal(true)}
              className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors"
              title="Review why the DATA port is used"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Why DATA Port?</span>
            </button>
          )}

          {onResetTask && (
            <button
              type="button"
              onClick={onResetTask}
              className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>↻ Reset Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Educational Explanation Modal (Appears after solving DATA connection) */}
      {((isDataConnected && !explanationAcknowledged) || showPortGuideModal) && (
        <div className="absolute inset-0 z-30 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 text-slate-800 font-sans space-y-4 animate-in zoom-in-95 relative">
            {showPortGuideModal && (
              <button
                type="button"
                onClick={() => setShowPortGuideModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="size-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                ✓
              </div>
              <div>
                <h3 className="font-display font-black text-slate-900 text-base leading-tight">
                  DATA Connection Established
                </h3>
              </div>
            </div>

            {/* Why This Port */}
            <div className="space-y-1">
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-indigo-700">
                WHY THIS PORT?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                The DATA port lets the computer communicate with the robot's onboard controller.
              </p>
            </div>

            {/* What this connection lets you do */}
            <div className="space-y-1.5 text-xs text-slate-600">
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-indigo-700">
                THIS CONNECTION LETS YOU:
              </h4>
              <ul className="space-y-1 pl-1 text-[11px]">
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Send software and instructions to the robot</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Receive telemetry and diagnostics from the controller</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Test the robot's physical drive and weapons</span>
                </li>
              </ul>
            </div>

            {/* Different Connections Have Different Jobs */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] space-y-1.5">
              <h4 className="font-display font-bold text-[10px] uppercase tracking-wider text-slate-800">
                DIFFERENT CONNECTIONS HAVE DIFFERENT JOBS:
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                  <strong className="text-slate-900 block font-sans">POWER</strong>
                  Supplies electrical power.
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                  <strong className="text-slate-900 block font-sans">MOTOR</strong>
                  Connects to the drive motors.
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                  <strong className="text-slate-900 block font-sans">SENSOR</strong>
                  Receives sensor information.
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <strong className="text-emerald-800 block font-sans">DATA</strong>
                  Computer communication.
                </div>
              </div>
            </div>

            {/* Acknowledge Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playInstall();
                  if (showPortGuideModal) {
                    setShowPortGuideModal(false);
                  } else {
                    onAcknowledgeExplanation();
                  }
                }}
                className="cursor-pointer inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-display font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
              >
                <span>Got It</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom HUD: Port Action Bar, Wrong Port Feedback & Launch IDE Button */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row items-center justify-between gap-3 z-10 pointer-events-none">
        {/* Left Side: Port Selection Buttons & Unplug */}
        <div className="flex items-center gap-2 flex-wrap pointer-events-auto">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-2.5 rounded-2xl flex items-center gap-2 shadow-xl">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold px-2 hidden sm:inline">
              Controller Ports:
            </span>
            {PORT_ORDER.map((p) => {
              const isSelected = connectedPort === p;
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

          {/* Disconnect Cable Button (visible whenever cable is plugged into any port) */}
          {connectedPort !== null && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="cursor-pointer px-3 py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-rose-300 text-xs font-semibold shadow-lg transition-colors flex items-center gap-1.5"
            >
              <span>✕ Disconnect Cable</span>
            </button>
          )}
        </div>

        {/* Center / Right: Wrong Connection Feedback (Section 12) */}
        {hasWrongPortError && (
          <div className="pointer-events-auto bg-rose-950/90 backdrop-blur-md border border-rose-800/90 p-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in max-w-md">
            <div>
              <span className="text-xs font-bold text-rose-300 block">
                ✕ CONNECTION NOT RECOGNIZED
              </span>
              <p className="text-[11px] text-rose-200 mt-0.5 leading-snug">
                No data connection detected. The computer cannot establish a programming connection through this port.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              className="cursor-pointer px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold whitespace-nowrap shadow-md transition-all active:scale-95"
            >
              Try Another Port
            </button>
          </div>
        )}

        {/* Right Side: Launch IDE Button (ONLY available when CURRENTLY connected to DATA and acknowledged) */}
        {isDataConnected && explanationAcknowledged && (
          <div className="pointer-events-auto animate-bounce">
            <button
              type="button"
              onClick={handleLaunchIde}
              className="cursor-pointer inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-display font-black text-sm uppercase tracking-wider shadow-2xl shadow-indigo-500/50 transition-all active:scale-95 border border-indigo-400"
            >
              <Terminal className="w-4 h-4 text-emerald-300" />
              <div className="flex flex-col text-left">
                <span className="leading-tight">Open BotCode IDE</span>
                <span className="text-[9px] font-mono font-normal normal-case text-indigo-200">
                  Data Link Verified
                </span>
              </div>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
