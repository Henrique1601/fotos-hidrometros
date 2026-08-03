import Dexie, { Table } from 'dexie';
import type { Side } from '../lib/towers';

export interface Campaign {
  id?: number;
  name?: string;
  month: number;
  year: number;
  createdAt: number;
  updatedAt: number;
  status: 'collecting' | 'indexing' | 'done';
  lastTower?: string;
  lastFloor?: number;
}

export interface MeterRecord {
  id?: number;
  campaignId: number;
  towerId: string;
  floor: number;
  unit: number;
  side: Side;
  aptCode: string;
  photo?: Blob | null;
  index?: number | null;
  capturedAt?: number | null;
  indexedAt?: number | null;
  updatedAt: number;
}

class MedicaoDB extends Dexie {
  campaigns!: Table<Campaign, number>;
  records!: Table<MeterRecord, number>;

  constructor() {
    super('fotos-hidrometros');
    this.version(1).stores({
      campaigns: '++id, name, year, month, createdAt',
      records: '++id, campaignId, towerId, aptCode, capturedAt, indexedAt',
    });
  }
}

export const db = new MedicaoDB();
