import { db, Campaign, MeterRecord } from './db';

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
  const matches = await db.records
    .where('campaignId')
    .equals(rec.campaignId)
    .and((r) => r.towerId === rec.towerId && r.aptCode === rec.aptCode)
    .toArray();

  if (matches.length > 0) {
    const primary = matches.find((m) => m.photo) ?? matches[0];
    const updatedPhoto = rec.photo !== undefined ? rec.photo : (primary.photo ?? matches.find((m) => m.photo)?.photo ?? null);
    const updatedIndex = rec.index !== undefined ? rec.index : (primary.index ?? matches.find((m) => m.index !== null && m.index !== undefined)?.index ?? null);

    const merged: MeterRecord = {
      ...primary,
      ...rec,
      photo: updatedPhoto,
      index: updatedIndex,
      updatedAt: now,
      id: primary.id,
    };

    await db.records.put(merged);

    // Se houver registros duplicados desse mesmo apartamento, remove os fantasmas
    if (matches.length > 1) {
      for (const other of matches) {
        if (other.id && other.id !== primary.id) {
          await db.records.delete(other.id);
        }
      }
    }
    return primary.id!;
  }
  return db.records.add({ ...rec, updatedAt: now });
}

export async function deleteCampaign(campaignId: number): Promise<void> {
  await db.transaction('rw', db.campaigns, db.records, async () => {
    await db.records.where('campaignId').equals(campaignId).delete();
    await db.campaigns.delete(campaignId);
  });
}

export async function deleteRecord(campaignId: number, aptCode: string, towerId: string): Promise<void> {
  const rec = await db.records
    .where('campaignId')
    .equals(campaignId)
    .and((r) => r.aptCode === aptCode && r.towerId === towerId)
    .first();
  if (rec?.id) {
    await db.records.delete(rec.id);
  }
}

export async function resetRecord(campaignId: number, aptCode: string, towerId: string): Promise<void> {
  const rec = await db.records
    .where('campaignId')
    .equals(campaignId)
    .and((r) => r.aptCode === aptCode && r.towerId === towerId)
    .first();
  if (rec?.id) {
    await db.records.update(rec.id, {
      photo: null,
      index: null,
      capturedAt: null,
      indexedAt: null,
      updatedAt: Date.now(),
    });
  }
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

export async function updateCampaign(id: number, changes: Partial<Omit<Campaign, 'id' | 'createdAt'>>): Promise<void> {
  await db.campaigns.update(id, { ...changes, updatedAt: Date.now() });
}
