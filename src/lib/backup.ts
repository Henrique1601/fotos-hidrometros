import { db, Campaign, MeterRecord } from '../db/db';

export const BACKUP_APP = 'fotos-hidrometros';
export const BACKUP_VERSION = 1;

export interface SerializedPhoto {
  type: string;
  data: string;
}

export interface SerializedRecord extends Omit<MeterRecord, 'photo'> {
  photo: SerializedPhoto | null;
}

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  campaigns: Campaign[];
  records: SerializedRecord[];
}

export function buildBackup(campaigns: Campaign[], records: MeterRecord[]): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    campaigns,
    records: records.map((r) => ({
      ...r,
      photo: null,
    })),
  };
}

export function isValidBackup(data: unknown): data is BackupFile {
  const b = data as BackupFile | null | undefined;
  return !!b && b.app === BACKUP_APP && b.version === BACKUP_VERSION && Array.isArray(b.records);
}

export function deserializePhoto(p: SerializedPhoto | null | undefined): Blob | null {
  if (!p || !p.data) return null;
  const bytes = Uint8Array.from(atob(p.data), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: p.type || 'image/jpeg' });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function createBackupFileName(campaigns: Campaign[]): string {
  const first = campaigns[0];
  if (!first) return `foto-hidro-backup-${todayStamp()}.json`;
  return `foto-hidro-backup-${first.year}-${String(first.month).padStart(2, '0')}.json`;
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export async function serializeBackup(): Promise<BackupFile> {
  const campaigns = await db.campaigns.toArray();
  const records = await db.records.toArray();
  const file = buildBackup(campaigns, records);
  for (const r of file.records) {
    const src = records.find((x) => x.id === r.id);
    if (src?.photo) {
      r.photo = { type: src.photo.type, data: await blobToBase64(src.photo) };
    }
  }
  return file;
}

export async function restoreBackup(data: unknown): Promise<{ campaigns: number; records: number }> {
  if (!isValidBackup(data)) {
    throw new Error('Arquivo de backup inválido ou de outra versão.');
  }
  const file = data as BackupFile;
  const campaigns = file.campaigns.map((c, i) => ({ ...c, id: i + 1 }));
  const idMap = new Map<number, number>();
  file.campaigns.forEach((c, i) => {
    if (c.id !== undefined) idMap.set(c.id, i + 1);
  });
  const records = file.records.map((r, i) => ({
    ...r,
    id: i + 1,
    campaignId: idMap.get(r.campaignId) ?? r.campaignId,
    photo: deserializePhoto(r.photo),
  }));

  await db.transaction('rw', db.campaigns, db.records, async () => {
    await db.campaigns.clear();
    await db.records.clear();
    await db.campaigns.bulkAdd(campaigns);
    await db.records.bulkAdd(records);
  });

  return { campaigns: campaigns.length, records: records.length };
}
