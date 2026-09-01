import { describe, expect, it } from 'vitest';
import { calculateMeasurementStats, formatDuration, formatPace } from './measurementStats';
import { MeterRecord } from '../db/db';

describe('measurementStats', () => {
  it('formatDuration formata segundos, minutos e horas corretamente', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45 * 1000)).toBe('45s');
    expect(formatDuration(2 * 60 * 1000 + 30 * 1000)).toBe('2m 30s');
    expect(formatDuration(3600 * 1000 + 15 * 60 * 1000)).toBe('1h 15m');
  });

  it('formatPace formata segundos por apt', () => {
    expect(formatPace(0)).toBe('--');
    expect(formatPace(14.2)).toBe('14s/un');
    expect(formatPace(65)).toBe('1m 05s/un');
  });

  it('calculateMeasurementStats com lista vazia retorna zeros', () => {
    const stats = calculateMeasurementStats([]);
    expect(stats.totalPhotos).toBe(0);
    expect(stats.activeTimeMs).toBe(0);
    expect(stats.avgSecondsPerPhoto).toBe(0);
    expect(stats.photosPerHour).toBe(0);
  });

  it('calculateMeasurementStats calcula tempo ativo e ritmo corretamente', () => {
    const base = 1700000000000;
    const records: Partial<MeterRecord>[] = [
      { towerId: 'A', aptCode: '256', capturedAt: base },
      { towerId: 'A', aptCode: '255', capturedAt: base + 15000 },
      { towerId: 'A', aptCode: '254', capturedAt: base + 30000 },
      { towerId: 'A', aptCode: '253', capturedAt: base + 45000 },
    ];

    const stats = calculateMeasurementStats(records as MeterRecord[]);
    expect(stats.totalPhotos).toBe(4);
    expect(stats.activeTimeMs).toBe(45000);
    expect(stats.avgSecondsPerPhoto).toBeCloseTo(15, 1);
    expect(stats.photosPerHour).toBe(240);
  });

  it('calculateMeasurementStats ignora intervalos de pausa maiores que o limite', () => {
    const base = 1700000000000;
    const records: Partial<MeterRecord>[] = [
      { towerId: 'A', aptCode: '256', capturedAt: base },
      { towerId: 'A', aptCode: '255', capturedAt: base + 20000 },
      { towerId: 'A', aptCode: '254', capturedAt: base + 20000 + 1800000 },
      { towerId: 'A', aptCode: '253', capturedAt: base + 20000 + 1800000 + 20000 },
    ];

    const stats = calculateMeasurementStats(records as MeterRecord[]);
    expect(stats.totalPhotos).toBe(4);
    expect(stats.activeTimeMs).toBe(60000);
  });
});
