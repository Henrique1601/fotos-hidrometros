import { describe, expect, it } from 'vitest';
import {
  aptCode,
  buildTowers,
  columnSequence,
  CONDO_TOTAL_UNITS,
  floorSequence,
  isValidCondoUnit,
  TOWERS,
  towerById,
  towerTotalUnits,
  unitSide,
  VALID_UNIT_KEYS,
} from './towers';

describe('towers', () => {
  it('gera 8 torres A-H', () => {
    expect(TOWERS.map((t) => t.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });

  it('andar 03: A/B/D/E/F tem 4 unidades e C/G/H tem 5', () => {
    for (const id of ['A', 'B', 'D', 'E', 'F']) {
      const f3 = towerById(id).floors.find((f) => f.floor === 3)!;
      expect(f3.units).toEqual([1, 2, 3, 4]);
    }
    for (const id of ['C', 'G', 'H']) {
      const f3 = towerById(id).floors.find((f) => f.floor === 3)!;
      expect(f3.units).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('andares 04-25 tem 8 unidades', () => {
    const t = towerById('A');
    for (const f of t.floors.filter((f) => f.floor >= 4)) {
      expect(f.units).toHaveLength(8);
    }
  });

  it('aptCode sem zero à esquerda', () => {
    expect(aptCode(3, 1)).toBe('31');
    expect(aptCode(10, 1)).toBe('101');
    expect(aptCode(25, 8)).toBe('258');
  });

  it('unitSide: 3-6 esquerda, 1/2/7/8 direita', () => {
    expect(unitSide(3)).toBe('left');
    expect(unitSide(6)).toBe('left');
    expect(unitSide(1)).toBe('right');
    expect(unitSide(2)).toBe('right');
    expect(unitSide(7)).toBe('right');
    expect(unitSide(8)).toBe('right');
  });

  it('towerTotalUnits: A/B/D/E/F = 180, C/G = 181, H = 173', () => {
    expect(towerTotalUnits(towerById('A'))).toBe(180);
    expect(towerTotalUnits(towerById('B'))).toBe(180);
    expect(towerTotalUnits(towerById('C'))).toBe(181);
    expect(towerTotalUnits(towerById('D'))).toBe(180);
    expect(towerTotalUnits(towerById('E'))).toBe(180);
    expect(towerTotalUnits(towerById('F'))).toBe(180);
    expect(towerTotalUnits(towerById('G'))).toBe(181);
    expect(towerTotalUnits(towerById('H'))).toBe(173);
  });

  it('floorSequence: esq desc depois dir desc por andar, andares descendentes (25 a 3)', () => {
    const t = towerById('A');
    const seq = floorSequence(t);
    const codes = seq.map((u) => u.aptCode);
    const expected = [
      '256', '255', '254', '253', '252', '251', '258', '257',
      '246', '245', '244', '243', '242', '241', '248', '247',
      '236', '235', '234', '233', '232', '231', '238', '237',
    ];
    expect(codes.slice(0, 24)).toEqual(expected);
    expect(seq[0].floor).toBe(25);
    expect(seq[0].aptCode).toBe('256');
    expect(seq[7].aptCode).toBe('257');
    expect(seq[8].floor).toBe(24);
    expect(seq[seq.length - 1].aptCode).toBe('31');
    expect(seq[seq.length - 4].aptCode).toBe('34');
  });

  it('columnSequence segue a ordem das colunas do 25 ao 3', () => {
    const t = towerById('A');
    const left = columnSequence(t, 'left').map((u) => u.aptCode);
    expect(left.slice(0, 4)).toEqual(['256', '255', '254', '253']);
  });

  it('towerById retorna A para id inválido', () => {
    expect(towerById('ZZ').id).toBe('A');
  });

  it('buildTowers produz torres com floors descendentes (Torre H 24..3, outras 25..3)', () => {
    for (const t of buildTowers()) {
      const expectedMax = t.id === 'H' ? 24 : 25;
      const expectedLength = t.id === 'H' ? 22 : 23;
      expect(t.floors[0].floor).toBe(expectedMax);
      expect(t.floors[t.floors.length - 1].floor).toBe(3);
      expect(t.floors).toHaveLength(expectedLength);
    }
  });

  it('total do condomínio é exatamente 1.435 unidades', () => {
    expect(CONDO_TOTAL_UNITS).toBe(1435);
    expect(VALID_UNIT_KEYS.size).toBe(1435);
  });

  it('isValidCondoUnit valida apenas apartamentos existentes', () => {
    expect(isValidCondoUnit('A', '31')).toBe(true);
    expect(isValidCondoUnit('C', '35')).toBe(true);
    expect(isValidCondoUnit('E', '34')).toBe(true);
    // Apt 35 da Torre E não existe
    expect(isValidCondoUnit('E', '35')).toBe(false);
    // 25º andar da Torre H não existe
    expect(isValidCondoUnit('H', '251')).toBe(false);
    expect(isValidCondoUnit('H', '241')).toBe(true);
    // Torre inexistente
    expect(isValidCondoUnit('Z', '31')).toBe(false);
  });
});
