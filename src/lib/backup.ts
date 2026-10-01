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
  type?: BackupType;
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

export type BackupType = 'all' | 'indices' | 'photos';

export interface BackupOptions {
  type?: BackupType;
  campaignIds?: number[];
  onProgress?: (done: number, total: number) => void;
}

export function createBackupFileName(campaigns: Campaign[], type: BackupType = 'all'): string {
  const prefix = type === 'indices' ? 'indices' : type === 'photos' ? 'fotos' : 'tudo';
  const first = campaigns[0];
  if (!first) return `foto-hidro-backup-${prefix}-${todayStamp()}.json`;
  if (campaigns.length === 1) {
    return `foto-hidro-backup-${prefix}-${first.year}-${String(first.month).padStart(2, '0')}.json`;
  }
  return `foto-hidro-backup-${prefix}-${campaigns.length}medicoes-${todayStamp()}.json`;
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export async function generateBackupBlob(
  optionsOrProgress?: BackupOptions | ((done: number, total: number) => void),
): Promise<{ blob: Blob; fileName: string }> {
  let opts: BackupOptions = {};
  if (typeof optionsOrProgress === 'function') {
    opts = { onProgress: optionsOrProgress };
  } else if (optionsOrProgress) {
    opts = optionsOrProgress;
  }

  const type = opts.type || 'all';
  const onProgress = opts.onProgress;
  const allCampaigns = await db.campaigns.toArray();

  const campaigns = opts.campaignIds && opts.campaignIds.length > 0
    ? allCampaigns.filter((c) => c.id && opts.campaignIds!.includes(c.id))
    : allCampaigns;

  const validCampaignIds = new Set(campaigns.map((c) => c.id!));

  let recordsQuery = db.records.toCollection();
  if (opts.campaignIds && opts.campaignIds.length > 0) {
    recordsQuery = db.records.where('campaignId').anyOf(Array.from(validCampaignIds));
  }

  const allRecords = await recordsQuery.toArray();
  const recordsToExport = allRecords.filter((r) => {
    if (type === 'photos') return Boolean(r.photo);
    return true;
  });

  const totalRecords = recordsToExport.length;

  const chunks: BlobPart[] = [];
  chunks.push(
    '{\n  "app": "' +
      BACKUP_APP +
      '",\n  "version": ' +
      BACKUP_VERSION +
      ',\n  "type": ' +
      JSON.stringify(type) +
      ',\n  "exportedAt": ' +
      JSON.stringify(new Date().toISOString()) +
      ',\n  "campaigns": ' +
      JSON.stringify(campaigns) +
      ',\n  "records": [\n',
  );

  let processed = 0;
  let isFirst = true;

  for (const r of recordsToExport) {
    let photoData: SerializedPhoto | null = null;
    if (type !== 'indices' && r.photo) {
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

  chunks.push('\n  ]\n}');
  const blob = new Blob(chunks, { type: 'application/json' });
  const fileName = createBackupFileName(campaigns, type);
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

export type RestoreContentType = 'all' | 'indices' | 'photos';

export interface RestoreOptions {
  mode?: 'replace' | 'merge';
  contentType?: RestoreContentType;
  selectedCampaignIds?: number[];
}

export async function restoreBackup(
  data: unknown,
  optionsOrMode: RestoreOptions | 'replace' | 'merge' = 'replace',
): Promise<{ campaigns: number; records: number }> {
  if (!isValidBackup(data)) {
    throw new Error('Arquivo de backup inválido ou de outra versão.');
  }
  const file = data as BackupFile;
  const options: RestoreOptions =
    typeof optionsOrMode === 'string'
      ? { mode: optionsOrMode }
      : optionsOrMode || { mode: 'replace' };

  const mode = options.mode || 'replace';
  const contentType = options.contentType || 'all';

  // Filtra campanhas pelas IDs selecionadas (se informadas)
  const targetCampaigns =
    options.selectedCampaignIds && options.selectedCampaignIds.length > 0
      ? file.campaigns.filter((c) => c.id !== undefined && options.selectedCampaignIds!.includes(c.id))
      : file.campaigns;

  const validCampIdSet = new Set(
    targetCampaigns.map((c) => c.id).filter((id): id is number => id !== undefined),
  );

  // Filtra registros que pertencem às campanhas selecionadas
  const targetRecords = file.records.filter((r) => validCampIdSet.has(r.campaignId));

  if (mode === 'replace') {
    const campaigns = targetCampaigns.map((c, i) => ({ ...c, id: i + 1 }));
    const idMap = new Map<number, number>();
    targetCampaigns.forEach((c, i) => {
      if (c.id !== undefined) idMap.set(c.id, i + 1);
    });

    const records = targetRecords.map((r, i) => {
      const photoBlob = contentType === 'indices' ? null : deserializePhoto(r.photo);
      const indexVal = contentType === 'photos' ? null : r.index;
      const indexedAtVal = contentType === 'photos' ? null : r.indexedAt;
      const capturedAtVal = contentType === 'indices' ? null : r.capturedAt;
      const mappedCampId = (r.campaignId !== undefined ? idMap.get(r.campaignId) : undefined) ?? r.campaignId;

      return {
        ...r,
        id: i + 1,
        campaignId: mappedCampId,
        photo: photoBlob,
        index: indexVal,
        indexedAt: indexedAtVal,
        capturedAt: capturedAtVal,
      };
    });

    await db.transaction('rw', db.campaigns, db.records, async () => {
      await db.campaigns.clear();
      await db.records.clear();
      await db.campaigns.bulkAdd(campaigns);
      await db.records.bulkAdd(records);
    });

    return { campaigns: campaigns.length, records: records.length };
  }

  // Modo Merge: preserva campanhas existentes e atualiza/adiciona registros
  let processedCampaigns = 0;
  let processedRecords = 0;

  await db.transaction('rw', db.campaigns, db.records, async () => {
    const existingCampaigns = await db.campaigns.toArray();
    const campIdMap = new Map<number, number>();

    for (const fileCamp of targetCampaigns) {
      const match = existingCampaigns.find(
        (ec) => ec.year === fileCamp.year && ec.month === fileCamp.month && (ec.name || '') === (fileCamp.name || ''),
      );
      if (match && match.id) {
        if (fileCamp.id !== undefined) campIdMap.set(fileCamp.id, match.id);
        processedCampaigns++;
      } else {
        const { id: _, ...campWithoutId } = fileCamp;
        const newId = await db.campaigns.add(campWithoutId as Campaign);
        processedCampaigns++;
        if (fileCamp.id !== undefined) campIdMap.set(fileCamp.id, newId);
      }
    }

    const existingRecords = await db.records.toArray();

    for (const r of targetRecords) {
      const targetCampId = (r.campaignId !== undefined ? campIdMap.get(r.campaignId) : undefined) ?? r.campaignId;
      const photoBlob = contentType === 'indices' ? null : deserializePhoto(r.photo);

      const match = existingRecords.find(
        (er) => er.campaignId === targetCampId && er.towerId === r.towerId && er.aptCode === r.aptCode,
      );

      if (match && match.id) {
        if (contentType === 'indices') {
          await db.records.update(match.id, {
            index: r.index !== null && r.index !== undefined ? r.index : match.index,
            indexedAt: r.indexedAt || match.indexedAt,
            updatedAt: Math.max(r.updatedAt || 0, match.updatedAt || 0),
          });
        } else if (contentType === 'photos') {
          await db.records.update(match.id, {
            photo: photoBlob || match.photo,
            capturedAt: r.capturedAt || match.capturedAt,
            updatedAt: Math.max(r.updatedAt || 0, match.updatedAt || 0),
          });
        } else {
          await db.records.update(match.id, {
            index: r.index !== null && r.index !== undefined ? r.index : match.index,
            photo: photoBlob || match.photo,
            capturedAt: r.capturedAt || match.capturedAt,
            indexedAt: r.indexedAt || match.indexedAt,
            updatedAt: Math.max(r.updatedAt || 0, match.updatedAt || 0),
          });
        }
      } else {
        await db.records.add({
          campaignId: targetCampId,
          towerId: r.towerId,
          floor: r.floor,
          unit: r.unit,
          side: r.side,
          aptCode: r.aptCode,
          photo: contentType === 'indices' ? null : photoBlob,
          index: contentType === 'photos' ? null : r.index,
          capturedAt: contentType === 'indices' ? null : r.capturedAt,
          indexedAt: contentType === 'photos' ? null : r.indexedAt,
          updatedAt: r.updatedAt || Date.now(),
        });
      }
      processedRecords++;
    }
  });

  return { campaigns: processedCampaigns || targetCampaigns.length, records: processedRecords };
}
