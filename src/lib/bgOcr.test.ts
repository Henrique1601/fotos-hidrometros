import { describe, expect, it, vi } from 'vitest';
import { BgOcrManager } from './bgOcr';

describe('BgOcrManager', () => {
  it('inicializa com estado ocioso', () => {
    const mgr = new BgOcrManager();
    const state = mgr.getState();
    expect(state.isRunning).toBe(false);
    expect(state.total).toBe(0);
    expect(state.processed).toBe(0);
  });

  it('notifica observadores quando estado muda', () => {
    const mgr = new BgOcrManager();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);

    mgr.stop();
    expect(listener).toHaveBeenCalled();
    unsub();
  });
});
