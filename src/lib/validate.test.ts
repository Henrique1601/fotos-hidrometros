import { describe, expect, it } from 'vitest';
import { mean, stddev, validateIndex } from './validate';

describe('validate index', () => {
  it('alerta quando cai vs. anterior', () => {
    const w = validateIndex(900, 1000, []);
    expect(w.map((x) => x.code)).toContain('dropped');
  });

  it('não alerta em aumento normal', () => {
    expect(validateIndex(1005, 1000, [])).toEqual([]);
  });

  it('alerta outlier com 3+ peers', () => {
    const peers = [1000, 1010, 990, 1005, 998];
    const w = validateIndex(5000, null, peers);
    expect(w.map((x) => x.code)).toContain('outlier');
  });

  it('sem peers não gera outlier', () => {
    expect(validateIndex(5000, null, [1000])).toEqual([]);
  });

  it('alerta aumento acima de 100%', () => {
    const w = validateIndex(2500, 1000, []);
    expect(w.map((x) => x.code)).toContain('jump');
  });

  it('aumento de 50% passa', () => {
    expect(validateIndex(1500, 1000, [])).toEqual([]);
  });

  it('mean e stddev', () => {
    expect(mean([10, 20, 30])).toBe(20);
    expect(stddev([10, 10, 10])).toBe(0);
    expect(stddev([])).toBe(0);
  });
});
