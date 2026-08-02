import { describe, expect, it } from 'vitest';
import { clampZoom } from './camera';

describe('clampZoom', () => {
  it('clampa dentro dos limites', () => {
    expect(clampZoom(50, 1, 4, 0.1)).toBe(4);
    expect(clampZoom(0.2, 1, 4, 0.1)).toBe(1);
  });

  it('ajusta ao step', () => {
    expect(clampZoom(1.17, 1, 4, 0.1)).toBeCloseTo(1.2);
    expect(clampZoom(2.04, 1, 4, 0.1)).toBeCloseTo(2.0);
  });

  it('retorna min quando min === max', () => {
    expect(clampZoom(5, 1, 1, 0.1)).toBe(1);
  });
});
