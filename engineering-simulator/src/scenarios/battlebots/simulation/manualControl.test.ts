import { describe, expect, it } from 'vitest';
import { INITIAL_ROBOT_CONFIG } from '../data/components';
import {
  createBattleSimulation,
  stepBattleSimulation,
} from './battleEngine';
import {
  computePlayerInputFromKeys,
  createKeyboardController,
} from './playerInput';

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

  it('physical simulation: A / ArrowLeft turns LEFT and D / ArrowRight turns RIGHT', () => {
    // When facing North (heading = PI, toward -z):
    // Left (West) corresponds to negative X (heading increases, sin(PI + d) < 0).
    // Right (East) corresponds to positive X (heading decreases, sin(PI - d) > 0).

    // 1. Test D / Right steering:
    const simRight = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull', undefined, 0, 0, true);
    simRight.player.headingRad = Math.PI;
    stepBattleSimulation(simRight, 0.1, { throttle: 1, steering: 1, weaponActive: false });
    // Velocity along X must be positive (moving RIGHT/East)
    expect(simRight.player.vx).toBeGreaterThan(0);

    // 2. Test A / Left steering:
    const simLeft = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull', undefined, 0, 0, true);
    simLeft.player.headingRad = Math.PI;
    stepBattleSimulation(simLeft, 0.1, { throttle: 1, steering: -1, weaponActive: false });
    // Velocity along X must be negative (moving LEFT/West)
    expect(simLeft.player.vx).toBeLessThan(0);
  });

  it('physical simulation: diagonal driving combinations (W+A, W+D, S+A, S+D)', () => {
    // Forward-Left (W + A): vx < 0 (left), vz < 0 (forward)
    const simWA = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull', undefined, 0, 0, true);
    simWA.player.headingRad = Math.PI;
    stepBattleSimulation(simWA, 0.1, { throttle: 1, steering: -1, weaponActive: false });
    expect(simWA.player.vx).toBeLessThan(0);
    expect(simWA.player.vz).toBeLessThan(0);

    // Forward-Right (W + D): vx > 0 (right), vz < 0 (forward)
    const simWD = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull', undefined, 0, 0, true);
    simWD.player.headingRad = Math.PI;
    stepBattleSimulation(simWD, 0.1, { throttle: 1, steering: 1, weaponActive: false });
    expect(simWD.player.vx).toBeGreaterThan(0);
    expect(simWD.player.vz).toBeLessThan(0);

    // Reverse-Left (S + A): vx < 0 (left), vz > 0 (reverse)
    const simSA = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull', undefined, 0, 0, true);
    simSA.player.headingRad = Math.PI;
    stepBattleSimulation(simSA, 0.1, { throttle: -1, steering: -1, weaponActive: false });
    expect(simSA.player.vx).toBeLessThan(0);
    expect(simSA.player.vz).toBeGreaterThan(0);

    // Reverse-Right (S + D): vx > 0 (right), vz > 0 (reverse)
    const simSD = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull', undefined, 0, 0, true);
    simSD.player.headingRad = Math.PI;
    stepBattleSimulation(simSD, 0.1, { throttle: -1, steering: 1, weaponActive: false });
    expect(simSD.player.vx).toBeGreaterThan(0);
    expect(simSD.player.vz).toBeGreaterThan(0);
  });

  it('arena dimensions: enlarged combat area and increased initial robot separation', () => {
    const sim = createBattleSimulation(INITIAL_ROBOT_CONFIG, 'control', 'bull', undefined, 0, 0, true);
    // Initial separation must be 7.6m (player at +3.8, boss at -3.8)
    expect(sim.player.z).toBeCloseTo(3.8, 1);
    expect(sim.boss.z).toBeCloseTo(-3.8, 1);
    const initialSeparation = Math.hypot(sim.player.x - sim.boss.x, sim.player.z - sim.boss.z);
    expect(initialSeparation).toBeGreaterThanOrEqual(7.5);
  });

  it('horizontal spinner vs Bull: head-on collision into front plow is deflected without auto-winning', () => {
    const horizConfig = { ...INITIAL_ROBOT_CONFIG, weaponId: 'horizontal-spinner' as const };
    const sim = createBattleSimulation(horizConfig, 'control', 'bull', undefined, 0, 0, true);
    sim.player.weaponSpinPct = 100;

    // Position player directly in front of Bull facing head-on
    sim.player.x = 0;
    sim.player.z = 0.5;
    sim.player.headingRad = Math.PI; // Facing -z into Bull
    sim.boss.x = 0;
    sim.boss.z = 0;
    sim.boss.headingRad = 0; // Facing +z into Player

    stepBattleSimulation(sim, 0.05, { throttle: 1, steering: 0, weaponActive: true });

    // Bull's front plow deflects the strike:
    // Bull front armor takes deflection shock, but hull remains largely intact (>90%)
    expect(sim.boss.hullIntegrityPct).toBeGreaterThan(90);
    expect(sim.boss.sideArmorPct).toBe(100); // Did not bypass plow to hit side
    // Spinner dumps kinetic energy into the deflection and stalls
    expect(sim.player.weaponSpinPct).toBeLessThan(15);
    // Player suffers strong recoil pushing them backward (+z)
    expect(sim.player.vz).toBeGreaterThan(1.5);
  });

  it('horizontal spinner vs Bull: continuous contact while stalled does not deliver heavy hits', () => {
    const horizConfig = { ...INITIAL_ROBOT_CONFIG, weaponId: 'horizontal-spinner' as const };
    const sim = createBattleSimulation(horizConfig, 'control', 'bull', undefined, 0, 0, true);

    // Keep robots touching with a stalled weapon (<28% spin)
    sim.player.x = 0;
    sim.player.z = 0.4;
    sim.player.headingRad = Math.PI;
    sim.player.weaponSpinPct = 15;
    sim.boss.x = 0;
    sim.boss.z = 0;
    sim.boss.headingRad = 0;

    const initialHull = sim.boss.hullIntegrityPct;

    // Step for 1 second of continuous pushing with stalled weapon
    for (let i = 0; i < 20; i++) {
      stepBattleSimulation(sim, 0.05, { throttle: 1, steering: 0, weaponActive: false });
    }

    // Hull should NOT suffer heavy kinetic damage while stalled
    expect(sim.boss.hullIntegrityPct).toBeCloseTo(initialHull, 0);
  });

  it('horizontal spinner vs Bull: flanking strike to side delivers devastating breach', () => {
    const horizConfig = { ...INITIAL_ROBOT_CONFIG, weaponId: 'horizontal-spinner' as const };
    const sim = createBattleSimulation(horizConfig, 'control', 'bull', undefined, 0, 0, true);
    sim.player.weaponSpinPct = 100;

    // Position player on Bull's flank (striking Bull from the East, Bull facing North)
    sim.boss.x = 0;
    sim.boss.z = 0;
    sim.boss.headingRad = Math.PI; // Boss facing North (-z)
    sim.player.x = 0.5;
    sim.player.z = 0;
    sim.player.headingRad = -Math.PI / 2; // Player facing West (-x into Bull's side)

    stepBattleSimulation(sim, 0.05, { throttle: 1, steering: 0, weaponActive: true });

    // Striking unprotected side delivers catastrophic kinetic breach!
    expect(sim.boss.sideArmorPct).toBeLessThan(85);
    expect(sim.boss.hullIntegrityPct).toBeLessThan(90);
    // Boss is knocked away toward -x and stunned
    expect(sim.boss.vx).toBeLessThan(-1.0);
    expect(sim.bossStunTimerSec).toBeGreaterThan(0.3);
  });
});
