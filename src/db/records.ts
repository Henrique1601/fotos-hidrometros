import { db, MeterRecord } from './db';

export async function listCampaignRecords(campaignId: number): Promise<MeterRecord[]> {
  return db.records.where('campaignId').equals(campaignId).toArray();
}

export async function listTowerRecords(campaignId: number, towerId: string): Promise<MeterRecord[]> {
  return db.records
    .where('campaignId')
    .equals(campaignId)
    .and((r) => r.towerId === towerId)
    .toArray();
}

export async function upsertRecord(rec: Omit<MeterRecord, 'updatedAt'>): Promise<number> {
  const now = Date.now();
  const existing = await db.records
    .where('campaignId')
    .equals(rec.campaignId)
    .and((r) => r.towerId === rec.towerId && r.aptCode === rec.aptCode)
    .first();
  if (existing) {
    const merged: MeterRecord = {
      ...existing,
      ...rec,
      photo: rec.photo ?? existing.photo,
      index: rec.index !== undefined ? rec.index : existing.index,
      updatedAt: now,
      id: existing.id,
    };
    await db.records.update(existing.id!, merged);
    return existing.id!;
  }
  return db.records.add({ ...rec, updatedAt: now });
}

export async function deleteCampaign(campaignId: number): Promise<void> {
  await db.transaction('rw', db.campaigns, db.records, async () => {
    await db.records.where('campaignId').equals(campaignId).delete();
    await db.campaigns.delete(campaignId);
  });
}

export interface TowerProgress {
  photos: number;
  indices: number;
  total: number;
}

export function towerProgress(records: MeterRecord[], total: number): TowerProgress {
  return {
    photos: records.filter((r) => r.photo).length,
    indices: records.filter((r) => r.index !== null && r.index !== undefined).length,
    total,
  };
}
