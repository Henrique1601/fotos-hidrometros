import { describe, expect, it } from 'vitest';
import { Campaign } from '../db/db';
import {
  ANOMALY_LIMIT_M3,
  computeConsumption,
  keyOf,
  selectPreviousCampaign,
} from './consumption';

function camp(id: number, month: number, year: number): Campaign {
  return {
    id,
    month,
    year,
    createdAt: id,
    updatedAt: id,
    status: 'collecting',
  };
}

describe('selectPreviousCampaign', () => {
  it('pega a campanha imediatamente anterior (mesmo ano)', () => {
    const current = camp(3, 7, 2026);
    const camps = [camp(1, 5, 2026), camp(2, 6, 2026), camp(4, 8, 2026)];
    expect(selectPreviousCampaign(camps, current)?.id).toBe(2);
  });

  it('cruza o ano (janeiro pega dezembro do ano anterior)', () => {
    const current = camp(5, 1, 2026);
    const camps = [camp(1, 12, 2025), camp(2, 1, 2025), camp(3, 3, 2026)];
    expect(selectPreviousCampaign(camps, current)?.id).toBe(1);
  });

  it('ignora a própria campanha e futuras', () => {
    const current = camp(2, 6, 2026);
    const camps = [camp(1, 5, 2026), camp(2, 6, 2026), camp(3, 7, 2026)];
    expect(selectPreviousCampaign(camps, current)?.id).toBe(1);
  });

  it('retorna null sem campanhas anteriores', () => {
    expect(selectPreviousCampaign([camp(1, 6, 2026)], camp(1, 6, 2026))).toBeNull();
  });
});

describe('computeConsumption', () => {
  const records = [
    { towerId: 'A', aptCode: '258', index: 1234 },
    { towerId: 'A', aptCode: '257', index: 567 },
    { towerId: 'A', aptCode: '256', index: 100 },
    { towerId: 'A', aptCode: '255', index: 50 },
  ];

  it('calcula consumo e marca anomalia acima do limite', () => {
    const prev = new Map([
      [keyOf('A', '258'), 1200],
      [keyOf('A', '257'), 500],
    ]);
    const map = computeConsumption(records, prev);
    expect(map.get(keyOf('A', '258'))).toEqual({
      previousIndex: 1200,
      consumption: 34,
      status: 'anomaly',
    });
    expect(map.get(keyOf('A', '257'))).toEqual({
      previousIndex: 500,
      consumption: 67,
      status: 'anomaly',
    });
  });

  it('marca como no-base quando não há campanha anterior', () => {
    const map = computeConsumption(records, new Map());
    expect(map.get(keyOf('A', '258'))?.status).toBe('no-base');
    expect(map.get(keyOf('A', '258'))?.previousIndex).toBeNull();
    expect(map.get(keyOf('A', '258'))?.consumption).toBeNull();
  });

  it('marca anomalia em consumo negativo (regressão)', () => {
    const prev = new Map([[keyOf('A', '256'), 150]]);
    const map = computeConsumption(records, prev);
    expect(map.get(keyOf('A', '256'))).toEqual({
      previousIndex: 150,
      consumption: -50,
      status: 'anomaly',
    });
  });

  it('marca OK abaixo do limite', () => {
    const prev = new Map([[keyOf('A', '255'), 40]]);
    const map = computeConsumption(records, prev);
    expect(map.get(keyOf('A', '255'))).toEqual({
      previousIndex: 40,
      consumption: 10,
      status: 'ok',
    });
  });

  it('limite de anomalia é ANOMALY_LIMIT_M3', () => {
    expect(ANOMALY_LIMIT_M3).toBe(30);
    const prev = new Map([[keyOf('A', '255'), 30]]);
    const map = computeConsumption(records, prev);
    expect(map.get(keyOf('A', '255'))?.status).toBe('ok');
  });
});
