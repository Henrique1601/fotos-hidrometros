export type Side = 'left' | 'right';

export interface FloorConfig {
  floor: number;
  units: number[];
}

export interface TowerConfig {
  id: string;
  label: string;
  floors: FloorConfig[];
}

export interface UnitRef {
  floor: number;
  unit: number;
  aptCode: string;
  side: Side;
}

const TOWER_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const EXTRA_UNIT_ON_FLOOR_3 = new Set(['C', 'E', 'G', 'H']);
const FLOOR_MIN = 3;
const FLOOR_MAX = 25;
const UNITS_FULL = [1, 2, 3, 4, 5, 6, 7, 8];

export const SIDE_ORDER: Record<Side, number[]> = {
  left: [6, 5, 4, 3],
  right: [2, 1, 8, 7],
};

export function unitSide(unit: number): Side {
  return SIDE_ORDER.left.includes(unit) ? 'left' : 'right';
}

export function aptCode(floor: number, unit: number): string {
  return String(floor * 10 + unit);
}

export function buildTowers(): TowerConfig[] {
  return TOWER_IDS.map((id) => {
    const floors: FloorConfig[] = [];
    const maxFloor = id === 'H' ? 24 : FLOOR_MAX;
    for (let f = maxFloor; f >= FLOOR_MIN; f--) {
      const units = f === 3 ? (EXTRA_UNIT_ON_FLOOR_3.has(id) ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]) : UNITS_FULL;
      floors.push({ floor: f, units });
    }
    return { id, label: `Torre ${id}`, floors };
  });
}

export const TOWERS: TowerConfig[] = buildTowers();

export function towerById(id: string): TowerConfig {
  return TOWERS.find((t) => t.id === id) ?? TOWERS[0];
}

export function towerUnits(tower: TowerConfig): UnitRef[] {
  const out: UnitRef[] = [];
  for (const f of tower.floors) {
    for (const u of f.units) {
      out.push({ floor: f.floor, unit: u, aptCode: aptCode(f.floor, u), side: unitSide(u) });
    }
  }
  return out;
}

export function towerTotalUnits(tower: TowerConfig): number {
  return tower.floors.reduce((acc, f) => acc + f.units.length, 0);
}

export function columnSequence(tower: TowerConfig, side: Side): UnitRef[] {
  const order = SIDE_ORDER[side];
  const out: UnitRef[] = [];
  for (const f of tower.floors) {
    for (const u of order) {
      if (f.units.includes(u)) {
        out.push({ floor: f.floor, unit: u, aptCode: aptCode(f.floor, u), side });
      }
    }
  }
  return out;
}

export function floorSequence(tower: TowerConfig): UnitRef[] {
  const out: UnitRef[] = [];
  for (const f of tower.floors) {
    for (const side of ['left', 'right'] as Side[]) {
      for (const u of SIDE_ORDER[side]) {
        if (f.units.includes(u)) {
          out.push({ floor: f.floor, unit: u, aptCode: aptCode(f.floor, u), side });
        }
      }
    }
  }
  return out;
}
