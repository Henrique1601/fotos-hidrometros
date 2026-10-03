import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../db/db';
import { isValidBackup } from './backup';
import {
  fetchCloudBackupData,
  restoreFromCloud,
  setSupabaseClientForTesting,
} from './sync';

describe('Cloud Backup Download and Restore', () => {
  beforeEach(async () => {
    await db.campaigns.clear();
    await db.records.clear();
    setSupabaseClientForTesting(null);
  });

  it('falha ao buscar backup da nuvem se não estiver logado', async () => {
    setSupabaseClientForTesting({
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
      },
    });

    await expect(fetchCloudBackupData()).rejects.toThrow('Faça login antes de baixar o backup da nuvem.');
  });

  it('baixa dados da nuvem e gera um BackupFile válido', async () => {
    const mockCampaigns = [
      {
        client_id: 1,
        name: 'Agosto 2026',
        month: 8,
        year: 2026,
        created_at: 1000,
        updated_at: 2000,
        status: 'collecting',
        leiturista: 'Carlos',
        last_tower: 'A',
        last_floor: 3,
        last_apt: '31',
      },
    ];

    const mockRecords = [
      {
        campaign_client_id: 1,
        apt_code: '31',
        tower_id: 'A',
        floor: 3,
        unit: 1,
        side: 'left',
        index_value: 1420,
        captured_at: 1050,
        indexed_at: 1060,
        updated_at: 2000,
        photo_base64: 'aGVsbG8=',
        photo_type: 'image/jpeg',
      },
    ];

    const mockClient = {
      auth: {
        getSession: () =>
          Promise.resolve({
            data: { session: { user: { id: 'usr-123', email: 'test@example.com' } } },
          }),
      },
      from: (table: string) => {
        if (table === 'campaigns') {
          return {
            select: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: mockCampaigns, error: null }),
              }),
            }),
          };
        }
        if (table === 'records') {
          return {
            select: () => ({
              order: () => ({
                range: () => Promise.resolve({ data: mockRecords, error: null }),
              }),
            }),
          };
        }
        return {};
      },
    };

    setSupabaseClientForTesting(mockClient);

    const backup = await fetchCloudBackupData();
    expect(isValidBackup(backup)).toBe(true);
    expect(backup.campaigns.length).toBe(1);
    expect(backup.campaigns[0].name).toBe('Agosto 2026');
    expect(backup.records.length).toBe(1);
    expect(backup.records[0].aptCode).toBe('31');
    expect(backup.records[0].photo?.data).toBe('aGVsbG8=');
  });

  it('restaura medições e registros da nuvem diretamente para o banco local via restoreFromCloud', async () => {
    const mockCampaigns = [
      {
        client_id: 2,
        name: 'Setembro 2026',
        month: 9,
        year: 2026,
        created_at: 5000,
        updated_at: 6000,
        status: 'done',
        leiturista: 'Lucas',
      },
    ];

    const mockRecords = [
      {
        campaign_client_id: 2,
        apt_code: '41',
        tower_id: 'B',
        floor: 4,
        unit: 1,
        side: 'right',
        index_value: 8520,
        captured_at: 5100,
        indexed_at: 5200,
        updated_at: 6000,
        photo_base64: null,
        photo_type: null,
      },
    ];

    const mockClient = {
      auth: {
        getSession: () =>
          Promise.resolve({
            data: { session: { user: { id: 'usr-123', email: 'test@example.com' } } },
          }),
      },
      from: (table: string) => {
        if (table === 'campaigns') {
          return {
            select: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: mockCampaigns, error: null }),
              }),
            }),
          };
        }
        if (table === 'records') {
          return {
            select: () => ({
              order: () => ({
                range: () => Promise.resolve({ data: mockRecords, error: null }),
              }),
            }),
          };
        }
        return {};
      },
    };

    setSupabaseClientForTesting(mockClient);

    const result = await restoreFromCloud('replace');
    expect(result.campaigns).toBe(1);
    expect(result.records).toBe(1);

    const savedCamps = await db.campaigns.toArray();
    expect(savedCamps.length).toBe(1);
    expect(savedCamps[0].name).toBe('Setembro 2026');
    expect(savedCamps[0].status).toBe('done');

    const savedRecs = await db.records.toArray();
    expect(savedRecs.length).toBe(1);
    expect(savedRecs[0].aptCode).toBe('41');
    expect(savedRecs[0].index).toBe(8520);
  });
});
