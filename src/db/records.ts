import { db, Campaign, MeterRecord } from './db';
import { isValidCondoUnit } from '../lib/towers';

export async function cleanOrphanAndDuplicateRecords(
  campaignId?: number,
): Promise<{ removedOrphans: number; mergedDuplicates: number }> {
  const collection = campaignId !== undefined
    ? db.records.where('campaignId').equals(campaignId)
    : db.records.toCollection();

  const all = await collection.toArray();
  let removedOrphans = 0;
  let mergedDuplicates = 0;

  // 1. Remove registros orfaos que nao pertencem a nenhuma torre/andar/unidade valida
  for (const r of all) {
    if (!isValidCondoUnit(r.towerId, r.aptCode) && r.id) {
      await db.records.delete(r.id);
      removedOrphans++;
    }
  }

  // 2. Agrupa por (campaignId, towerId, aptCode) e funde duplicatas
  const groups = new Map<string, MeterRecord[]>();
  for (const r of all) {
    if (!isValidCondoUnit(r.towerId, r.aptCode)) continue;
    const k = `${r.campaignId}:${r.towerId}:${r.aptCode}`;
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }

  for (const [, list] of groups) {
    if (list.length > 1) {
      const primary =
        list.find((m) => m.photo && m.index !== null && m.index !== undefined) ??
        list.find((m) => m.photo) ??
        list.find((m) => m.index !== null && m.index !== undefined) ??
        list[0];

      const mergedPhoto = list.find((m) => m.photo)?.photo ?? primary.photo ?? null;
      const mergedIndex =
        list.find((m) => m.index !== null && m.index !== undefined)?.index ?? primary.index ?? null;
      const latestCapturedAt =
        Math.max(...list.map((m) => m.capturedAt ?? 0)) || primary.capturedAt || null;
      const latestIndexedAt =
        Math.max(...list.map((m) => m.indexedAt ?? 0)) || primary.indexedAt || null;

      await db.records.put({
        ...primary,
        photo: mergedPhoto,
        index: mergedIndex,
        capturedAt: latestCapturedAt,
        indexedAt: latestIndexedAt,
        updatedAt: Date.now(),
      });

      for (const item of list) {
        if (item.id && item.id !== primary.id) {
          await db.records.delete(item.id);
          mergedDuplicates++;
        }
      }
    }
  }

  return { removedOrphans, mergedDuplicates };
}

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
