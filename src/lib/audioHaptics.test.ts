import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isSoundEnabled, setSoundEnabled, playShutterFeedback } from './audioHaptics';

describe('audioHaptics', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      clear: () => {
        store = {};
      },
    });
  });

  it('default is sound enabled', () => {
    expect(isSoundEnabled()).toBe(true);
  });

  it('can toggle sound enabled', () => {
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });

  it('playShutterFeedback executes without crashing in test environment', () => {
    expect(() => playShutterFeedback()).not.toThrow();
  });

  it('playShutterFeedback triggers vibrate if available', () => {
    const vibrateSpy = vi.fn();
    vi.stubGlobal('navigator', { vibrate: vibrateSpy });

    playShutterFeedback();
    expect(vibrateSpy).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
