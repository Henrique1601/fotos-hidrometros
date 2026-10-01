import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { db, MeterRecord } from '../db/db';
import { updateCampaign, resetRecord, deleteRecord } from '../db/records';
import { getLastSyncAt, setLastSyncAt } from './sync';

const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
};
// @ts-expect-error test mock
globalThis.localStorage = mockLocalStorage;

describe('Cloud Sync Tracking and Campaign Locking', () => {
  beforeEach(async () => {
    await db.campaigns.clear();
    await db.records.clear();
    storage.clear();
  });

  it('rastreia timestamp da última sincronização corretamente', () => {
    expect(getLastSyncAt()).toBe(0);
    const ts = 1770000000000;
    setLastSyncAt(ts);
    expect(getLastSyncAt()).toBe(ts);
  });

  it('identifica registros pendentes de sincronização baseado no updatedAt', async () => {
    const lastSync = 1000;
    setLastSyncAt(lastSync);

    const oldRecord: MeterRecord = {
      campaignId: 1,
      towerId: 'A',
      floor: 4,
      unit: 6,
      side: 'left',
      aptCode: '46',
      updatedAt: 900,
    };

    const newRecord: MeterRecord = {
      campaignId: 1,
      towerId: 'A',
      floor: 4,
      unit: 5,
      side: 'left',
      aptCode: '45',
      updatedAt: 1100,
    };

    await db.records.bulkAdd([oldRecord, newRecord]);

    const all = await db.records.toArray();
    const pending = all.filter((r) => r.updatedAt > getLastSyncAt());

    expect(pending.length).toBe(1);
    expect(pending[0].aptCode).toBe('45');
  });

  it('permite alternar status de campanha entre collecting e done', async () => {
    const id = await db.campaigns.add({
      name: 'Medição Teste',
      month: 7,
      year: 2026,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'collecting',
    });

    let campaign = await db.campaigns.get(id);
    expect(campaign?.status).toBe('collecting');

    // Conclui e bloqueia medição
    await updateCampaign(id, { status: 'done' });
    campaign = await db.campaigns.get(id);
    expect(campaign?.status).toBe('done');

    // Reabre medição para edição
    await updateCampaign(id, { status: 'collecting' });
    campaign = await db.campaigns.get(id);
    expect(campaign?.status).toBe('collecting');
  });

  it('preserva dados da campanha ao atualizar o status', async () => {
    const id = await db.campaigns.add({
      name: 'Agosto 2026',
      month: 8,
      year: 2026,
      leiturista: 'Henrique',
      createdAt: 100,
      updatedAt: 100,
      status: 'collecting',
      lastTower: 'B',
      lastFloor: 12,
      lastApt: '121',
    });

    await updateCampaign(id, { status: 'done' });

    const c = await db.campaigns.get(id);
    expect(c?.name).toBe('Agosto 2026');
    expect(c?.leiturista).toBe('Henrique');
    expect(c?.lastTower).toBe('B');
    expect(c?.status).toBe('done');
  });

  it('remove foto e índice com resetRecord(campaignId, towerId, aptCode)', async () => {
    const fakeBlob = new Blob(['photo-data'], { type: 'image/jpeg' });
    const recId = await db.records.add({
      campaignId: 10,
      towerId: 'A',
      floor: 3,
      unit: 1,
      side: 'left',
      aptCode: '31',
      photo: fakeBlob,
      index: 12345,
      capturedAt: 1000,
      indexedAt: 2000,
      updatedAt: 1000,
    });

    await resetRecord(10, 'A', '31');

    const updated = await db.records.get(recId);
    expect(updated).toBeDefined();
    expect(updated?.photo).toBeNull();
    expect(updated?.index).toBeNull();
    expect(updated?.capturedAt).toBeNull();
    expect(updated?.indexedAt).toBeNull();
    expect(updated?.updatedAt).toBeGreaterThan(1000);
  });

  it('exclui registro completamente com deleteRecord(campaignId, towerId, aptCode)', async () => {
    await db.records.add({
      campaignId: 10,
      towerId: 'B',
      floor: 4,
      unit: 2,
      side: 'right',
      aptCode: '42',
      updatedAt: 1000,
    });

    let found = await db.records
      .where('campaignId')
      .equals(10)
      .and((r) => r.towerId === 'B' && r.aptCode === '42')
      .first();
    expect(found).toBeDefined();

    await deleteRecord(10, 'B', '42');

    found = await db.records
      .where('campaignId')
      .equals(10)
      .and((r) => r.towerId === 'B' && r.aptCode === '42')
      .first();
    expect(found).toBeUndefined();
  });
});
