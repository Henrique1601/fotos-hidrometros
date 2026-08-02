import { describe, expect, it } from 'vitest';
import { campaignLabel, formatIndex, monthName, pad2, parseIndex, sideLabel } from './utils';

describe('utils', () => {
  it('pad2', () => {
    expect(pad2(3)).toBe('03');
    expect(pad2(25)).toBe('25');
  });

  it('monthName', () => {
    expect(monthName(1)).toBe('Janeiro');
    expect(monthName(12)).toBe('Dezembro');
    expect(monthName(13)).toBe('');
  });

  it('campaignLabel usa nome quando presente', () => {
    expect(campaignLabel('Julho 2026', 7, 2026)).toBe('Julho 2026');
    expect(campaignLabel(undefined, 7, 2026)).toBe('Julho 2026');
    expect(campaignLabel('  ', 7, 2026)).toBe('Julho 2026');
  });

  it('formatIndex pt-BR', () => {
    expect(formatIndex(1234)).toBe('1.234');
    expect(formatIndex(1.5)).toBe('1,5');
    expect(formatIndex(null)).toBe('—');
    expect(formatIndex(undefined)).toBe('—');
  });

  it('parseIndex aceita formatos', () => {
    expect(parseIndex('1234')).toBe(1234);
    expect(parseIndex('1.234')).toBe(1234);
    expect(parseIndex('1,234')).toBe(1.234);
    expect(parseIndex('  456 ')).toBe(456);
    expect(parseIndex('')).toBe(null);
    expect(parseIndex('abc')).toBe(null);
  });

  it('sideLabel', () => {
    expect(sideLabel('left')).toBe('Esquerda');
    expect(sideLabel('right')).toBe('Direita');
  });
});
