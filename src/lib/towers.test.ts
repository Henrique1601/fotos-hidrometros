import { describe, expect, it } from 'vitest';
import {
  aptCode,
  buildTowers,
  columnSequence,
  floorSequence,
  TOWERS,
  towerById,
  towerTotalUnits,
  unitSide,
} from './towers';

describe('towers', () => {
  it('gera 8 torres A-H', () => {
    expect(TOWERS.map((t) => t.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });

  it('andar 03: A/B/D/F tem 4 unidades e C/E/G/H tem 5', () => {
    for (const id of ['A', 'B', 'D', 'F']) {
      const f3 = towerById(id).floors.find((f) => f.floor === 3)!;
      expect(f3.units).toEqual([1, 2, 3, 4]);
    }
    for (const id of ['C', 'E', 'G', 'H']) {
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

  it('towerTotalUnits: A = 4 + 22*8 = 180', () => {
    expect(towerTotalUnits(towerById('A'))).toBe(180);
    expect(towerTotalUnits(towerById('C'))).toBe(181);
  });

  it('floorSequence: esq desc depois dir desc por andar, andares ascendentes', () => {
    const t = towerById('A');
    const seq = floorSequence(t);
    const codes = seq.map((u) => u.aptCode);
    const expected = [
      '34', '33', '32', '31',
      '46', '45', '44', '43', '48', '47', '42', '41',
      '56', '55', '54', '53', '58', '57', '52', '51',
      '66', '65', '64', '63',
    ];
    expect(codes.slice(0, 24)).toEqual(expected);
    expect(seq[0].floor).toBe(3);
    expect(seq[3].floor).toBe(3);
    expect(seq[4].floor).toBe(4);
    expect(seq[23].floor).toBe(6);
    expect(seq[seq.length - 1].aptCode).toBe('251');
  });

  it('columnSequence mantém o formato antigo (coluna única)', () => {
    const t = towerById('A');
    const left = columnSequence(t, 'left').map((u) => u.aptCode);
    expect(left.slice(0, 4)).toEqual(['34', '33', '46', '45']);
  });

  it('towerById retorna A para id inválido', () => {
    expect(towerById('ZZ').id).toBe('A');
  });

  it('buildTowers produz torres com floors 3..25', () => {
    for (const t of buildTowers()) {
      expect(t.floors[0].floor).toBe(3);
      expect(t.floors[t.floors.length - 1].floor).toBe(25);
      expect(t.floors).toHaveLength(23);
    }
  });
});
