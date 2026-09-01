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
  try {
    const binary = atob(p.data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: p.type || 'image/jpeg' });
  } catch (e) {
    console.warn('Erro ao deserializar foto:', e);
    return null;
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = (reader.result as string) || '';
        const comma = res.indexOf(',');
        resolve(comma >= 0 ? res.slice(comma + 1) : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
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

export async function generateBackupBlob(
  onProgress?: (done: number, total: number) => void,
): Promise<{ blob: Blob; fileName: string }> {
  const campaigns = await db.campaigns.toArray();
  const totalRecords = await db.records.count();

  const chunks: BlobPart[] = [];
  chunks.push(
    '{\n  "app": "' +
      BACKUP_APP +
      '",\n  "version": ' +
      BACKUP_VERSION +
      ',\n  "exportedAt": ' +
      JSON.stringify(new Date().toISOString()) +
      ',\n  "campaigns": ' +
      JSON.stringify(campaigns) +
      ',\n  "records": [\n',
  );

  const batchSize = 15;
  let processed = 0;
  let isFirst = true;

  for (let offset = 0; offset < totalRecords; offset += batchSize) {
    const batch = await db.records.offset(offset).limit(batchSize).toArray();
    for (const r of batch) {
      let photoData: SerializedPhoto | null = null;
      if (r.photo) {
        const base64 = await blobToBase64(r.photo);
        photoData = { type: r.photo.type || 'image/jpeg', data: base64 };
      }
      const serializedRec: SerializedRecord = {
        id: r.id,
        campaignId: r.campaignId,
        towerId: r.towerId,
        floor: r.floor,
        unit: r.unit,
        side: r.side,
        aptCode: r.aptCode,
        photo: photoData,
        index: r.index,
        capturedAt: r.capturedAt,
        indexedAt: r.indexedAt,
        updatedAt: r.updatedAt,
      };

      if (!isFirst) {
        chunks.push(',\n');
      } else {
        isFirst = false;
      }
      chunks.push(JSON.stringify(serializedRec));
      processed++;
      onProgress?.(processed, totalRecords);
    }
  }

  chunks.push('\n  ]\n}');
  const blob = new Blob(chunks, { type: 'application/json' });
  const fileName = createBackupFileName(campaigns);
  return { blob, fileName };
}

export async function serializeBackup(): Promise<BackupFile> {
  const campaigns = await db.campaigns.toArray();
  const records = await db.records.toArray();
  const file = buildBackup(campaigns, records);
  for (const r of file.records) {
    const src = records.find((x) => x.id === r.id);
    if (src?.photo) {
      r.photo = { type: src.photo.type || 'image/jpeg', data: await blobToBase64(src.photo) };
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
