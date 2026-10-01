import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  BACKUP_APP,
  buildBackup,
  createBackupFileName,
  deserializePhoto,
  isValidBackup,
  restoreBackup,
} from './backup';
import { db, Campaign } from '../db/db';

const campaigns: Campaign[] = [
  {
    id: 1,
    name: 'Julho',
    month: 7,
    year: 2026,
    createdAt: 1,
    updatedAt: 1,
    status: 'collecting' as const,
  },
];
const records = [
  {
    id: 1,
    campaignId: 1,
    towerId: 'A',
    floor: 4,
    unit: 6,
    side: 'left' as const,
    aptCode: '46',
    capturedAt: 1,
    indexedAt: null,
    updatedAt: 1,
  },
];

describe('backup', () => {
  beforeEach(async () => {
    await db.campaigns.clear();
    await db.records.clear();
  });

  it('buildBackup serializa sem fotos quando ausentes', () => {
    const file = buildBackup(campaigns, records);
    expect(file.app).toBe(BACKUP_APP);
    expect(file.version).toBe(1);
    expect(file.records[0].aptCode).toBe('46');
    expect(file.records[0].photo).toBeNull();
  });

  it('isValidBackup rejeita dados estranhos', () => {
    expect(isValidBackup(null)).toBe(false);
    expect(isValidBackup({})).toBe(false);
    expect(isValidBackup({ app: 'outro', version: 1, records: [] })).toBe(false);
    expect(isValidBackup(buildBackup(campaigns, records))).toBe(true);
  });

  it('round-trip de foto base64', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const { blobToBase64 } = await import('./backup');
    const b64 = await blobToBase64(blob);
    const back = deserializePhoto({ type: 'image/jpeg', data: b64 });
    expect(back).not.toBeNull();
    expect(back!.type).toBe('image/jpeg');
    const buf = new Uint8Array(await back!.arrayBuffer());
    expect(Array.from(buf)).toEqual([1, 2, 3]);
  });

  it('deserializePhoto null retorna null', () => {
    expect(deserializePhoto(null)).toBeNull();
    expect(deserializePhoto(undefined)).toBeNull();
  });

  it('createBackupFileName gera nomes adequados de acordo com o tipo', () => {
    const fnAll = createBackupFileName(campaigns, 'all');
    expect(fnAll).toContain('tudo-2026-07');

    const fnIndices = createBackupFileName(campaigns, 'indices');
    expect(fnIndices).toContain('indices-2026-07');

    const fnPhotos = createBackupFileName(campaigns, 'photos');
    expect(fnPhotos).toContain('fotos-2026-07');

    const multiCamp: Campaign[] = [
      { id: 1, month: 7, year: 2026, createdAt: 1, updatedAt: 1, status: 'done' },
      { id: 2, month: 8, year: 2026, createdAt: 2, updatedAt: 2, status: 'done' },
    ];
    const fnMulti = createBackupFileName(multiCamp, 'all');
    expect(fnMulti).toContain('2medicoes');
  });

  it('restoreBackup com selectedCampaignIds restaura apenas campanhas escolhidas', async () => {
    const testFile = {
      app: BACKUP_APP,
      version: 1,
      exportedAt: new Date().toISOString(),
      campaigns: [
        { id: 10, name: 'Julho', month: 7, year: 2026, createdAt: 1, updatedAt: 1, status: 'done' as const },
        { id: 20, name: 'Agosto', month: 8, year: 2026, createdAt: 2, updatedAt: 2, status: 'done' as const },
      ],
      records: [
        { id: 1, campaignId: 10, towerId: 'A', floor: 4, unit: 6, side: 'left' as const, aptCode: '46', photo: null, index: 100, capturedAt: 1, indexedAt: 1, updatedAt: 1 },
        { id: 2, campaignId: 20, towerId: 'A', floor: 4, unit: 6, side: 'left' as const, aptCode: '46', photo: null, index: 120, capturedAt: 2, indexedAt: 2, updatedAt: 2 },
      ],
    };

    const res = await restoreBackup(testFile, {
      mode: 'replace',
      selectedCampaignIds: [20],
    });

    expect(res.campaigns).toBe(1);
    expect(res.records).toBe(1);

    const savedCamps = await db.campaigns.toArray();
    expect(savedCamps).toHaveLength(1);
    expect(savedCamps[0].month).toBe(8);

    const savedRecs = await db.records.toArray();
    expect(savedRecs).toHaveLength(1);
    expect(savedRecs[0].index).toBe(120);
  });

  it('restoreBackup com contentType: indices no merge preserva foto existente', async () => {
    // Insere campanha e registro local com foto fictícia
    const campId = await db.campaigns.add({
      name: 'Julho',
      month: 7,
      year: 2026,
      createdAt: 1,
      updatedAt: 1,
      status: 'collecting',
    });
    const fakePhotoBlob = new Blob(['foto-original'], { type: 'image/jpeg' });
    await db.records.add({
      campaignId: campId,
      towerId: 'A',
      floor: 4,
      unit: 6,
      side: 'left',
      aptCode: '46',
      photo: fakePhotoBlob,
      index: null,
      capturedAt: 100,
      indexedAt: null,
      updatedAt: 100,
    });

    // Backup contém apenas índice
    const backupData = {
      app: BACKUP_APP,
      version: 1,
      exportedAt: new Date().toISOString(),
      campaigns: [
        { id: 1, name: 'Julho', month: 7, year: 2026, createdAt: 1, updatedAt: 1, status: 'done' as const },
      ],
      records: [
        { id: 1, campaignId: 1, towerId: 'A', floor: 4, unit: 6, side: 'left' as const, aptCode: '46', photo: null, index: 350.5, capturedAt: null, indexedAt: 200, updatedAt: 200 },
      ],
    };

    await restoreBackup(backupData, {
      mode: 'merge',
      contentType: 'indices',
    });

    const recs = await db.records.toArray();
    expect(recs).toHaveLength(1);
    expect(recs[0].index).toBe(350.5);
    expect(recs[0].photo).not.toBeNull();
    expect(recs[0].capturedAt).toBe(100);
  });

  it('restoreBackup com contentType: photos no merge preserva indice existente', async () => {
    const campId = await db.campaigns.add({
      name: 'Julho',
      month: 7,
      year: 2026,
      createdAt: 1,
      updatedAt: 1,
      status: 'indexing',
    });
    await db.records.add({
      campaignId: campId,
      towerId: 'A',
      floor: 4,
      unit: 6,
      side: 'left',
      aptCode: '46',
      photo: null,
      index: 890,
      capturedAt: null,
      indexedAt: 50,
      updatedAt: 50,
    });

    // Backup com foto em base64
    const backupData = {
      app: BACKUP_APP,
      version: 1,
      exportedAt: new Date().toISOString(),
      campaigns: [
        { id: 1, name: 'Julho', month: 7, year: 2026, createdAt: 1, updatedAt: 1, status: 'done' as const },
      ],
      records: [
        {
          id: 1,
          campaignId: 1,
          towerId: 'A',
          floor: 4,
          unit: 6,
          side: 'left' as const,
          aptCode: '46',
          photo: { type: 'image/jpeg', data: btoa('foto-backup') },
          index: null,
          capturedAt: 150,
          indexedAt: null,
          updatedAt: 150,
        },
      ],
    };

    await restoreBackup(backupData, {
      mode: 'merge',
      contentType: 'photos',
    });

    const recs = await db.records.toArray();
    expect(recs).toHaveLength(1);
    expect(recs[0].index).toBe(890);
    expect(recs[0].photo).not.toBeNull();
    expect(recs[0].capturedAt).toBe(150);
  });
});

