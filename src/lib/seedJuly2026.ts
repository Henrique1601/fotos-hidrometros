import { db } from '../db/db';
import julyData from '../data/july2026Records.json';
import { unitSide } from './towers';

export async function loadJuly2026Base(): Promise<{ count: number; campaignId: number }> {
  const ts = new Date('2026-07-31T20:00:00.000Z').getTime();

  let campaign = await db.campaigns
    .where('year')
    .equals(2026)
    .filter((c) => c.month === 7)
    .first();

  let campaignId: number;
  if (campaign && campaign.id) {
    campaignId = campaign.id;
  } else {
    campaignId = await db.campaigns.add({
      name: 'Julho 2026',
      month: 7,
      year: 2026,
      status: 'done',
      createdAt: ts,
      updatedAt: ts,
    });
  }

  const records = julyData.records;
  let count = 0;

  await db.transaction('rw', db.records, async () => {
    for (const r of records) {
      const existing = await db.records
        .where('campaignId')
        .equals(campaignId)
        .filter((rec) => rec.towerId === r.towerId && rec.aptCode === r.aptCode)
        .first();

      if (existing && existing.id) {
        await db.records.update(existing.id, {
          index: r.index,
          indexedAt: ts,
          updatedAt: Date.now(),
        });
      } else {
        await db.records.add({
          campaignId,
          towerId: r.towerId,
          floor: r.floor,
          unit: r.unit,
          side: unitSide(r.unit),
          aptCode: r.aptCode,
          photo: null,
          index: r.index,
          capturedAt: ts,
          indexedAt: ts,
          updatedAt: ts,
        });
      }
      count++;
    }
  });

  return { count, campaignId };
}
