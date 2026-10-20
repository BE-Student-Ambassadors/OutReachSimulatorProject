import { describe, expect, it } from 'vitest';
import { INITIAL_ROBOT_CONFIG } from '../data/components';
import { type RobotConfiguration } from '../types/robot';
import {
  createBattleSimulation,
  stepBattleSimulation,
} from './battleEngine';
import {
  computePlayerInputFromKeys,
  createKeyboardController,
} from './playerInput';

const SPINNER_CONFIG: RobotConfiguration = {
  ...INITIAL_ROBOT_CONFIG,
  weaponId: 'vertical-spinner',
};

describe('Manual Control & Keyboard Input System', () => {
  it('maps W to forward command (throttle = 1, steering = 0)', () => {
    const input = computePlayerInputFromKeys(new Set(['KeyW']));
    expect(input.throttle).toBe(1);
    expect(input.steering).toBe(0);
    expect(input.weaponActive).toBe(false);
  });

  it('maps ArrowUp to the exact same forward command (throttle = 1)', () => {
    const input = computePlayerInputFromKeys(new Set(['ArrowUp']));
    expect(input.throttle).toBe(1);
    expect(input.steering).toBe(0);
  });

  it('maps S and ArrowDown to reverse command (throttle = -1)', () => {
    const inputS = computePlayerInputFromKeys(new Set(['KeyS']));
    const inputDown = computePlayerInputFromKeys(new Set(['ArrowDown']));
    expect(inputS.throttle).toBe(-1);
    expect(inputDown.throttle).toBe(-1);
  });

  it('maps A and ArrowLeft to left steering (steering = -1)', () => {
    const inputA = computePlayerInputFromKeys(new Set(['KeyA']));
    const inputLeft = computePlayerInputFromKeys(new Set(['ArrowLeft']));
    expect(inputA.steering).toBe(-1);
    expect(inputLeft.steering).toBe(-1);
  });

  it('maps D and ArrowRight to right steering (steering = 1)', () => {
    const inputD = computePlayerInputFromKeys(new Set(['KeyD']));
    const inputRight = computePlayerInputFromKeys(new Set(['ArrowRight']));
    expect(inputD.steering).toBe(1);
    expect(inputRight.steering).toBe(1);
  });

  it('combines W + A and ArrowUp + ArrowLeft into forward-left movement', () => {
    const inputWA = computePlayerInputFromKeys(new Set(['KeyW', 'KeyA']));
    const inputArrows = computePlayerInputFromKeys(new Set(['ArrowUp', 'ArrowLeft']));
    expect(inputWA.throttle).toBe(1);
    expect(inputWA.steering).toBe(-1);
    expect(inputArrows.throttle).toBe(1);
    expect(inputArrows.steering).toBe(-1);
  });

  it('combines S + D and ArrowDown + ArrowRight into reverse-right movement', () => {
    const inputSD = computePlayerInputFromKeys(new Set(['KeyS', 'KeyD']));
    const inputArrows = computePlayerInputFromKeys(new Set(['ArrowDown', 'ArrowRight']));
    expect(inputSD.throttle).toBe(-1);
    expect(inputSD.steering).toBe(1);
    expect(inputArrows.throttle).toBe(-1);
    expect(inputArrows.steering).toBe(1);
  });

  it('cancels opposing inputs predictably (W + S -> neutral throttle = 0, A + D -> neutral steering = 0)', () => {
    const opposingThrottle = computePlayerInputFromKeys(new Set(['KeyW', 'KeyS']));
    expect(opposingThrottle.throttle).toBe(0);

    const opposingArrows = computePlayerInputFromKeys(new Set(['ArrowUp', 'ArrowDown']));
    expect(opposingArrows.throttle).toBe(0);

    const opposingSteering = computePlayerInputFromKeys(new Set(['KeyA', 'KeyD']));
    expect(opposingSteering.steering).toBe(0);

    const opposingArrowSteering = computePlayerInputFromKeys(new Set(['ArrowLeft', 'ArrowRight']));
    expect(opposingArrowSteering.steering).toBe(0);
  });

  it('does NOT double throttle when holding both W and ArrowUp', () => {
    const duplicateInput = computePlayerInputFromKeys(new Set(['KeyW', 'ArrowUp']));
    expect(duplicateInput.throttle).toBe(1);
  });

  it('activates primary weapon with SPACE and releases on keyup', () => {
    const withSpace = computePlayerInputFromKeys(new Set(['Space']));
    expect(withSpace.weaponActive).toBe(true);

    const withoutSpace = computePlayerInputFromKeys(new Set([]));
    expect(withoutSpace.weaponActive).toBe(false);
  });

  it('clears all held inputs on blur or controller clear', () => {
    const listeners: Record<string, ((e: any) => void)[]> = {};
    const mockWindow = {
      addEventListener: (type: string, fn: any) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: any) => {
        if (listeners[type]) {
          listeners[type] = listeners[type].filter((f) => f !== fn);
        }
      },
    } as any;

    const controller = createKeyboardController(mockWindow);

    listeners['keydown']?.forEach((fn) => fn({ code: 'KeyW', key: 'w', preventDefault: () => {} }));
    expect(controller.getInput().throttle).toBe(1);

    listeners['blur']?.forEach((fn) => fn({}));
    expect(controller.getInput().throttle).toBe(0);
    expect(controller.getInput().steering).toBe(0);

    controller.dispose();
  });

  it('clears inputs when disabled (e.g. battle finished or countdown)', () => {
    const listeners: Record<string, ((e: any) => void)[]> = {};
    const mockWindow = {
      addEventListener: (type: string, fn: any) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      removeEventListener: () => {},
    } as any;

    const controller = createKeyboardController(mockWindow);
    listeners['keydown']?.forEach((fn) => fn({ code: 'KeyW', key: 'w', preventDefault: () => {} }));
    expect(controller.getInput().throttle).toBe(1);

    controller.setEnabled(false);
    expect(controller.getInput().throttle).toBe(0);

    controller.dispose();
  });

  it('physical simulation: keyboard throttle increases forward velocity along heading', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull', undefined, 0, 0, true);
    sim.player.vx = 0;
    sim.player.vz = 0;
    sim.player.headingRad = Math.PI; // Facing North (-z)

    stepBattleSimulation(sim, 0.05, { throttle: 1, steering: 0, weaponActive: false });

    // Since heading is PI (facing -z), forward velocity moves along -z
    expect(sim.player.vz).toBeLessThan(0);
    expect(Math.abs(sim.player.vx)).toBeCloseTo(0, 1);
  });

  it('physical simulation: steering input turns the robot heading', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull', undefined, 0, 0, true);
    const initialHeading = sim.player.headingRad;

    // Apply right steering (D / ArrowRight -> steering = 1)
    stepBattleSimulation(sim, 0.1, { throttle: 0, steering: 1, weaponActive: false });

    expect(sim.player.headingRad).not.toBe(initialHeading);
  });

  it('physical simulation: holding SPACE spools up spinner weapon and releasing spins down naturally', () => {
    const sim = createBattleSimulation(SPINNER_CONFIG, 'control', 'bull', undefined, 0, 0, true);
    sim.player.weaponSpinPct = 0;

    // Step with SPACE held
    for (let i = 0; i < 20; i++) {
      stepBattleSimulation(sim, 0.05, { throttle: 0, steering: 0, weaponActive: true });
    }
    const highRpm = sim.player.weaponSpinPct;
    expect(highRpm).toBeGreaterThan(15);

    // Step with SPACE released -> spins down naturally
    for (let i = 0; i < 10; i++) {
      stepBattleSimulation(sim, 0.05, { throttle: 0, steering: 0, weaponActive: false });
    }
    expect(sim.player.weaponSpinPct).toBeLessThan(highRpm);
  });

  it('physical simulation: drive damage causes asymmetrical steering drift', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull', undefined, 0, 0, true);
    sim.player.leftDriveHealthPct = 20;
    sim.player.rightDriveHealthPct = 100;
    sim.player.headingRad = 0;

    stepBattleSimulation(sim, 0.1, { throttle: 1, steering: 0, weaponActive: false });

    expect(sim.player.headingRad).not.toBe(0);
  });

  it('physical simulation: electrical bottleneck limits performance under simultaneous drive + weapon draw', () => {
    const sim = createBattleSimulation(SPINNER_CONFIG, 'control', 'bull', undefined, 100, 0, true);
    sim.playerStats.powerLimited = true;

    const simIdle = createBattleSimulation(SPINNER_CONFIG, 'control', 'bull', undefined, 100, 0, true);
    simIdle.playerStats.powerLimited = true;

    sim.player.weaponSpinPct = 0;
    simIdle.player.weaponSpinPct = 0;

    for (let i = 0; i < 10; i++) {
      stepBattleSimulation(sim, 0.05, { throttle: 1, steering: 0, weaponActive: true });
      stepBattleSimulation(simIdle, 0.05, { throttle: 0, steering: 0, weaponActive: true });
    }

    expect(simIdle.player.weaponSpinPct).toBeGreaterThan(sim.player.weaponSpinPct);
  });
});
