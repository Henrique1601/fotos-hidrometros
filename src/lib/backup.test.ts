import { describe, expect, it } from 'vitest';
import { BACKUP_APP, buildBackup, createBackupFileName, deserializePhoto, isValidBackup } from './backup';
import type { Campaign } from '../db/db';

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
});
