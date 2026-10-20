/**
 * Player Keyboard Input Controller for Manual BattleBot Combat.
 * Handles held-key tracking (WASD & Arrow Keys + Space), opposing key resolution,
 * duplicate normalization, and input safety (blur, pause, unmount).
 */

export interface PlayerInput {
  throttle: number; // -1.0 (reverse) to +1.0 (forward)
  steering: number; // -1.0 (turn left) to +1.0 (turn right)
  weaponActive: boolean; // true if SPACE is held
}

export function createDefaultPlayerInput(): PlayerInput {
  return {
    throttle: 0,
    steering: 0,
    weaponActive: false,
  };
}

/**
 * Pure function mapping a set of held key codes into normalized PlayerInput.
 * Normalizes WASD and Arrow Keys without double-stacking forces.
 * Resolves opposing inputs (W+S -> 0, A+D -> 0).
 */
export function computePlayerInputFromKeys(heldKeys: ReadonlySet<string>): PlayerInput {
  const forward =
    heldKeys.has('KeyW') ||
    heldKeys.has('ArrowUp') ||
    heldKeys.has('w') ||
    heldKeys.has('W');

  const backward =
    heldKeys.has('KeyS') ||
    heldKeys.has('ArrowDown') ||
    heldKeys.has('s') ||
    heldKeys.has('S');

  const left =
    heldKeys.has('KeyA') ||
    heldKeys.has('ArrowLeft') ||
    heldKeys.has('a') ||
    heldKeys.has('A');

  const right =
    heldKeys.has('KeyD') ||
    heldKeys.has('ArrowRight') ||
    heldKeys.has('d') ||
    heldKeys.has('D');

  const weapon =
    heldKeys.has('Space') ||
    heldKeys.has(' ');

  // Opposing inputs resolve to 0
  const throttle = forward && !backward ? 1 : backward && !forward ? -1 : 0;
  const steering = right && !left ? 1 : left && !right ? -1 : 0;

  return {
    throttle,
    steering,
    weaponActive: weapon,
  };
}

export interface KeyboardControllerInstance {
  getInput: () => PlayerInput;
  clear: () => void;
  dispose: () => void;
  setEnabled: (enabled: boolean) => void;
}

/**
 * Creates an authoritative keyboard input listener attached to the window or a container.
 * Prevents default scrolling on Space and Arrow keys only when active.
 * Cleans up cleanly on unmount or blur.
 */
export function createKeyboardController(
  target: Window | HTMLElement = typeof window !== 'undefined' ? window : ({} as Window)
): KeyboardControllerInstance {
  const heldKeys = new Set<string>();
  let isEnabled = true;

  // Keys that scroll the browser by default
  const BROWSER_SCROLL_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    ' ',
    'Space',
  ]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isEnabled) return;

    if (BROWSER_SCROLL_KEYS.has(e.key) || BROWSER_SCROLL_KEYS.has(e.code)) {
      e.preventDefault();
    }

    // Store both code and key for rock-solid cross-browser detection
    if (e.code) heldKeys.add(e.code);
    if (e.key) heldKeys.add(e.key);
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code) heldKeys.delete(e.code);
    if (e.key) heldKeys.delete(e.key);
  };

  const handleBlur = () => {
    // Window lost focus or user alt-tabbed: immediately clear all held keys
    heldKeys.clear();
  };

  if (target && typeof target.addEventListener === 'function') {
    target.addEventListener('keydown', handleKeyDown as EventListener, { passive: false });
    target.addEventListener('keyup', handleKeyUp as EventListener);
    target.addEventListener('blur', handleBlur as EventListener);
  }

  return {
    getInput: () => {
      if (!isEnabled) {
        return createDefaultPlayerInput();
      }
      return computePlayerInputFromKeys(heldKeys);
    },
    clear: () => {
      heldKeys.clear();
    },
    setEnabled: (enabled: boolean) => {
      isEnabled = enabled;
      if (!enabled) {
        heldKeys.clear();
      }
    },
    dispose: () => {
      heldKeys.clear();
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener('keydown', handleKeyDown as EventListener);
        target.removeEventListener('keyup', handleKeyUp as EventListener);
        target.removeEventListener('blur', handleBlur as EventListener);
      }
    },
  };
}

