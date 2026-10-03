import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { db, MeterRecord, Campaign } from '../db/db';
import {
  BACKUP_APP,
  BACKUP_VERSION,
  BackupFile,
  blobToBase64,
  deserializePhoto,
  restoreBackup,
  RestoreOptions,
} from './backup';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export function isSupabaseConfigured(): boolean {
  if (client) return true;
  return !!url && !!anonKey;
}

let client: SupabaseClient | null = null;

export function setSupabaseClientForTesting(mock: unknown): void {
  client = mock as SupabaseClient | null;
}

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!isSupabaseConfigured()) return null;
  client = createClient(url!, anonKey!);
  return client;
}

export async function getSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('email not confirmed')) {
      throw new Error('E-mail ainda não confirmado. Verifique sua caixa de entrada.');
    }
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      throw new Error('E-mail ou senha incorretos. Se ainda não possui conta, clique em "Criar nova conta".');
    }
    throw new Error(error.message);
  }
  return data.session;
}

export async function signUp(
  email: string,
  password: string,
): Promise<{ isNewUser: boolean; needsEmailConfirmation: boolean }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(error.message);

  // Se o usuário já existe no Supabase, a lista de identities vem vazia
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { isNewUser: false, needsEmailConfirmation: false };
  }

  const needsEmailConfirmation = !data.session && !data.user?.email_confirmed_at;
  return { isNewUser: true, needsEmailConfirmation };
}

export async function resetPassword(email: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');
  const { error } = await sb.auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

interface RemoteCampaign {
  client_id: number;
  name: string | null;
  month: number;
  year: number;
  created_at: number;
  updated_at: number;
  status: 'collecting' | 'indexing' | 'done';
  leiturista?: string | null;
  last_tower?: string | null;
  last_floor?: number | null;
  last_apt?: string | null;
}

interface RemoteRecord {
  campaign_client_id: number;
  apt_code: string;
  tower_id: string;
  floor: number;
  unit: number;
  side: 'left' | 'right';
  index_value: number | null;
  captured_at: number | null;
  indexed_at: number | null;
  updated_at: number;
  photo_base64: string | null;
  photo_type: string | null;
}

function toRemoteRecord(r: MeterRecord): RemoteRecord {
  return {
    campaign_client_id: r.campaignId,
    apt_code: r.aptCode,
    tower_id: r.towerId,
    floor: r.floor,
    unit: r.unit,
    side: r.side,
    index_value: r.index ?? null,
    captured_at: r.capturedAt ?? null,
    indexed_at: r.indexedAt ?? null,
    updated_at: r.updatedAt,
    photo_base64: null,
    photo_type: null,
  };
}

function fromRemoteRecord(r: RemoteRecord): Omit<MeterRecord, 'id'> {
  return {
    campaignId: r.campaign_client_id,
    towerId: r.tower_id,
    floor: r.floor,
    unit: r.unit,
    side: r.side,
    aptCode: r.apt_code,
    index: r.index_value,
    capturedAt: r.captured_at,
    indexedAt: r.indexed_at,
    updatedAt: r.updated_at,
    photo: deserializePhoto(
      r.photo_base64 ? { type: r.photo_type ?? 'image/jpeg', data: r.photo_base64 } : null,
    ),
  };
}

export interface SyncStats {
  campaigns: number;
  records: number;
}

export const LAST_SYNC_KEY = 'foto-hidro:last-sync-at';

export function getLastSyncAt(): number {
  try {
    const v = localStorage.getItem(LAST_SYNC_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

export function setLastSyncAt(ts: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(ts));
  } catch {
    // Ignore localStorage errors
  }
}

export async function pushAll(onProgress?: (done: number, total: number) => void): Promise<SyncStats> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');
  const session = await getSession();
  if (!session) throw new Error('Faça login antes de sincronizar.');

  const campaigns = await db.campaigns.toArray();
  const records = await db.records.toArray();

  const campRows = campaigns.map((c) => ({
    client_id: c.id!,
    month: c.month,
    year: c.year,
    name: c.name ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    status: c.status,
    leiturista: c.leiturista ?? null,
    last_tower: c.lastTower ?? null,
    last_floor: c.lastFloor ?? null,
    last_apt: c.lastApt ?? null,
  }));

  for (const c of campRows) {
    const { error } = await sb.from('campaigns').upsert(c);
    if (error) throw new Error(`Erro ao enviar campanhas: ${error.message}`);
  }

  // Envia registros em lotes de 25 com streaming para economizar memória em celulares antigos
  const BATCH_SIZE = 25;
  const total = records.length;
  let processed = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const slice = records.slice(i, i + BATCH_SIZE);
    const batch: RemoteRecord[] = [];

    for (const r of slice) {
      let b64: string | null = null;
      if (r.photo) {
        b64 = await blobToBase64(r.photo);
      }
      batch.push({
        ...toRemoteRecord(r),
        photo_base64: b64,
        photo_type: r.photo?.type ?? null,
      });
    }

    const { error } = await sb.from('records').upsert(batch);
    if (error) throw new Error(`Erro ao enviar registros: ${error.message}`);

    processed += slice.length;
    onProgress?.(processed, total);
  }

  return { campaigns: campaigns.length, records: total };
}

export async function pullAll(onProgress?: (done: number, total: number) => void): Promise<SyncStats> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');
  const session = await getSession();
  if (!session) throw new Error('Faça login antes de sincronizar.');

  // Baixa campanhas
  const campRes = await sb.from('campaigns').select('*').limit(200);
  if (campRes.error) throw new Error(`Erro ao baixar campanhas: ${campRes.error.message}`);

  const localCamps = await db.campaigns.toArray();
  let campCount = 0;
  for (const row of campRes.data as RemoteCampaign[]) {
    const local = localCamps.find((c) => c.id === row.client_id);
    if (!local || row.updated_at > local.updatedAt) {
      await db.campaigns.put({
        id: row.client_id,
        name: row.name ?? undefined,
        month: row.month,
        year: row.year,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status,
        leiturista: row.leiturista ?? undefined,
        lastTower: row.last_tower ?? undefined,
        lastFloor: row.last_floor ?? undefined,
        lastApt: row.last_apt ?? undefined,
      });
      campCount++;
    }
  }

  // Baixa registros com paginação progressiva (.range) eliminando o limite fixo de 5000
  let allRemoteRecords: RemoteRecord[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await sb
      .from('records')
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Erro ao baixar registros: ${error.message}`);
    if (!data || data.length === 0) break;

    allRemoteRecords = allRemoteRecords.concat(data as RemoteRecord[]);
    onProgress?.(allRemoteRecords.length, allRemoteRecords.length);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const localRecs = await db.records.toArray();
  let recCount = 0;

  for (const row of allRemoteRecords) {
    const local = localRecs.find(
      (r) =>
        r.campaignId === row.campaign_client_id &&
        r.towerId === row.tower_id &&
        r.aptCode === row.apt_code,
    );
    if (!local || row.updated_at > local.updatedAt) {
      const remote = fromRemoteRecord(row);
      await db.records.put({
        ...remote,
        id: local?.id,
        photo: local?.photo ?? remote.photo,
      });
      recCount++;
    }
  }

  return { campaigns: campCount, records: recCount };
}

export async function syncAll(
  onProgress?: (info: { stage: 'push' | 'pull'; done: number; total: number }) => void,
): Promise<SyncStats> {
  const pushed = await pushAll((done, total) => onProgress?.({ stage: 'push', done, total }));
  const pulled = await pullAll((done, total) => onProgress?.({ stage: 'pull', done, total }));
  if (pulled.campaigns > 0 || pulled.records > 0) {
    await pushAll((done, total) => onProgress?.({ stage: 'push', done, total }));
  }
  setLastSyncAt();
  return { campaigns: pushed.campaigns + pulled.campaigns, records: pushed.records + pulled.records };
}

export async function fetchCloudBackupData(
  onProgress?: (done: number, total: number) => void,
): Promise<BackupFile> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');
  const session = await getSession();
  if (!session) throw new Error('Faça login antes de baixar o backup da nuvem.');

  const campRes = await sb
    .from('campaigns')
    .select('*')
    .order('client_id', { ascending: true })
    .limit(500);

  if (campRes.error) {
    throw new Error(`Erro ao baixar campanhas da nuvem: ${campRes.error.message}`);
  }

  const remoteCampaigns: Campaign[] = (campRes.data as RemoteCampaign[]).map((row) => ({
    id: row.client_id,
    name: row.name ?? undefined,
    month: row.month,
    year: row.year,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    leiturista: row.leiturista ?? undefined,
    lastTower: row.last_tower ?? undefined,
    lastFloor: row.last_floor ?? undefined,
    lastApt: row.last_apt ?? undefined,
  }));

  let allRemoteRecords: RemoteRecord[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await sb
      .from('records')
      .select('*')
      .order('campaign_client_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Erro ao baixar registros da nuvem: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    allRemoteRecords = allRemoteRecords.concat(data as RemoteRecord[]);
    onProgress?.(allRemoteRecords.length, allRemoteRecords.length);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const backup: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    type: 'all',
    exportedAt: new Date().toISOString(),
    campaigns: remoteCampaigns,
    records: allRemoteRecords.map((r) => ({
      campaignId: r.campaign_client_id,
      towerId: r.tower_id,
      floor: r.floor,
      unit: r.unit,
      side: r.side,
      aptCode: r.apt_code,
      index: r.index_value,
      capturedAt: r.captured_at,
      indexedAt: r.indexed_at,
      updatedAt: r.updated_at,
      photo: r.photo_base64
        ? {
            type: r.photo_type ?? 'image/jpeg',
            data: r.photo_base64,
          }
        : null,
    })),
  };

  return backup;
}

export async function downloadCloudBackup(
  onProgress?: (done: number, total: number) => void,
): Promise<{ fileName: string; campaigns: number; records: number; blob: Blob }> {
  const backup = await fetchCloudBackupData(onProgress);
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const fileName = `foto-hidro-backup-nuvem-${backup.campaigns.length}medicoes-${Date.now()}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return {
    fileName,
    campaigns: backup.campaigns.length,
    records: backup.records.length,
    blob,
  };
}

export async function restoreFromCloud(
  optionsOrMode: RestoreOptions | 'replace' | 'merge' = 'merge',
  onProgress?: (done: number, total: number) => void,
): Promise<{ campaigns: number; records: number }> {
  const backup = await fetchCloudBackupData(onProgress);
  return restoreBackup(backup, optionsOrMode);
}
