import { describe, expect, it } from 'vitest';
import { evaluateBotCode, INITIAL_BOTCODE_SCRIPT } from '../data/teamData';

describe('Software Physical Connection & IDE Gating Logic (Cases 1-8)', () => {
  type ControllerPort = 'POWER' | 'MOTOR' | 'SENSOR' | 'DATA';

  interface WorkstationState {
    computerOn: boolean;
    connectedPort: ControllerPort | null;
    explanationAcknowledged: boolean;
    viewMode: 'workstation' | 'ide';
    codeContent: string;
    softwareUploaded: boolean;
  }

  const createInitialState = (): WorkstationState => ({
    computerOn: true,
    connectedPort: null,
    explanationAcknowledged: false,
    viewMode: 'workstation',
    codeContent: INITIAL_BOTCODE_SCRIPT,
    softwareUploaded: false,
  });

  const getScreenStatus = (state: WorkstationState) => {
    if (!state.computerOn) return 'OFF';
    if (state.connectedPort === null) return 'NO_ROBOT_CONNECTED';
    if (state.connectedPort === 'DATA') return 'ROBOT_CONNECTED';
    return 'CONNECTION_NOT_RECOGNIZED';
  };

  const canOpenIDE = (state: WorkstationState) => {
    return state.connectedPort === 'DATA' && state.explanationAcknowledged;
  };

  const canUploadProgram = (state: WorkstationState) => {
    const evalResult = evaluateBotCode(state.codeContent);
    return state.connectedPort === 'DATA' && evalResult.allVerified;
  };

  const canRunRobotHardwareTest = (state: WorkstationState) => {
    return state.connectedPort === 'DATA' && state.softwareUploaded;
  };

  it('CASE 1: Start activity - Computer ON, screen says NO ROBOT CONNECTED, IDE unavailable', () => {
    const state = createInitialState();
    expect(state.computerOn).toBe(true);
    expect(getScreenStatus(state)).toBe('NO_ROBOT_CONNECTED');
    expect(canOpenIDE(state)).toBe(false);
  });

  it('CASE 2: Connect to MOTOR - Screen says CONNECTION NOT RECOGNIZED, IDE unavailable', () => {
    const state = createInitialState();
    state.connectedPort = 'MOTOR';
    expect(getScreenStatus(state)).toBe('CONNECTION_NOT_RECOGNIZED');
    expect(canOpenIDE(state)).toBe(false);
  });

  it('CASE 3: Connect to DATA - Screen says ROBOT CONNECTED, explanation required before IDE', () => {
    const state = createInitialState();
    state.connectedPort = 'DATA';
    expect(getScreenStatus(state)).toBe('ROBOT_CONNECTED');
    // Explanation has not yet been acknowledged:
    expect(state.explanationAcknowledged).toBe(false);
    expect(canOpenIDE(state)).toBe(false);
  });

  it('CASE 4: Acknowledge explanation - OPEN BOTCODE IDE becomes available', () => {
    const state = createInitialState();
    state.connectedPort = 'DATA';
    state.explanationAcknowledged = true;
    expect(canOpenIDE(state)).toBe(true);
  });

  it('CASE 5: Connect DATA correctly, then disconnect - Connection becomes invalid, OPEN IDE unavailable', () => {
    const state = createInitialState();
    state.connectedPort = 'DATA';
    state.explanationAcknowledged = true;
    expect(canOpenIDE(state)).toBe(true);

    // Disconnect cable
    state.connectedPort = null;
    expect(getScreenStatus(state)).toBe('NO_ROBOT_CONNECTED');
    expect(canOpenIDE(state)).toBe(false);
  });

  it('CASE 6: Connect DATA correctly, then move cable to POWER - Connection becomes invalid, wrong feedback appears, OPEN IDE unavailable', () => {
    const state = createInitialState();
    state.connectedPort = 'DATA';
    state.explanationAcknowledged = true;
    expect(canOpenIDE(state)).toBe(true);

    // Move cable to POWER
    state.connectedPort = 'POWER';
    expect(getScreenStatus(state)).toBe('CONNECTION_NOT_RECOGNIZED');
    expect(canOpenIDE(state)).toBe(false);
  });

  it('CASE 7: Reconnect DATA - Connection becomes valid again, IDE access returns', () => {
    const state = createInitialState();
    state.connectedPort = 'DATA';
    state.explanationAcknowledged = true;
    state.connectedPort = null; // disconnected
    expect(canOpenIDE(state)).toBe(false);

    // Reconnect to DATA
    state.connectedPort = 'DATA';
    expect(getScreenStatus(state)).toBe('ROBOT_CONNECTED');
    expect(canOpenIDE(state)).toBe(true);
  });

  it('CASE 8: Enter IDE, make debugging progress, then later lose connection - progress saved, physical actions blocked', () => {
    const state = createInitialState();
    state.connectedPort = 'DATA';
    state.explanationAcknowledged = true;
    state.viewMode = 'ide';

    // Student fixes bugs in code
    const validScript = `BOT NIGHTFALL

START:
    sensor opponent = ON
    sensor distance = ON
    weapon = READY
    IF opponent detected:
        drive FORWARD
    IF opponent close:
        weapon SPIN
    IF robot flipped:
        self_right ON
END`.trim();
    state.codeContent = validScript;
    state.softwareUploaded = true;

    // Cable physically disconnects
    state.connectedPort = null;

    // Code progress is NOT wiped
    expect(state.codeContent).toBe(validScript);
    expect(evaluateBotCode(state.codeContent).allVerified).toBe(true);

    // But actions requiring connection are blocked
    expect(canUploadProgram(state)).toBe(false);
    expect(canRunRobotHardwareTest(state)).toBe(false);

    // Reconnecting DATA restores physical hardware actions
    state.connectedPort = 'DATA';
    expect(canUploadProgram(state)).toBe(true);
    expect(canRunRobotHardwareTest(state)).toBe(true);
  });
});
