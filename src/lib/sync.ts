import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { db, MeterRecord } from '../db/db';
import { blobToBase64, deserializePhoto } from './backup';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export function isSupabaseConfigured(): boolean {
  return !!url && !!anonKey;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) client = createClient(url!, anonKey!);
  return client;
}

export async function getSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error('E-mail ou senha inválidos.');
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

export async function pushAll(): Promise<SyncStats> {
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
  }));

  for (const c of campRows) {
    const { error } = await sb.from('campaigns').upsert(c);
    if (error) throw new Error(`Erro ao enviar campanhas: ${error.message}`);
  }

  const photos = new Map<number, string | null>();
  for (const r of records) {
    photos.set(r.id!, r.photo ? await blobToBase64(r.photo) : null);
  }

  const recRows: RemoteRecord[] = records.map((r) => ({
    ...toRemoteRecord(r),
    photo_base64: photos.get(r.id!) ?? null,
    photo_type: r.photo?.type ?? null,
  }));

  for (let i = 0; i < recRows.length; i += 50) {
    const batch = recRows.slice(i, i + 50);
    const { error } = await sb.from('records').upsert(batch);
    if (error) throw new Error(`Erro ao enviar registros: ${error.message}`);
  }

  return { campaigns: campaigns.length, records: records.length };
}

export async function pullAll(): Promise<SyncStats> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');
  const session = await getSession();
  if (!session) throw new Error('Faça login antes de sincronizar.');

  const [campRes, recRes] = await Promise.all([
    sb.from('campaigns').select('*').limit(1000),
    sb.from('records').select('*').limit(5000),
  ]);
  if (campRes.error) throw new Error(`Erro ao baixar campanhas: ${campRes.error.message}`);
  if (recRes.error) throw new Error(`Erro ao baixar registros: ${recRes.error.message}`);

  const localCamps = await db.campaigns.toArray();
  const localRecs = await db.records.toArray();

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
      });
      campCount++;
    }
  }

  let recCount = 0;
  for (const row of recRes.data as RemoteRecord[]) {
    const local = localRecs.find(
      (r) => r.campaignId === row.campaign_client_id && r.aptCode === row.apt_code,
    );
    if (!local || row.updated_at > local.updatedAt) {
      const remote = fromRemoteRecord(row);
      await db.records.put({
        ...remote,
        photo: local?.photo ?? remote.photo,
      });
      recCount++;
    }
  }

  return { campaigns: campCount, records: recCount };
}

export async function syncAll(): Promise<SyncStats> {
  const pushed = await pushAll();
  const pulled = await pullAll();
  if (pulled.campaigns > 0 || pulled.records > 0) {
    await pushAll();
  }
  return { campaigns: pushed.campaigns + pulled.campaigns, records: pushed.records + pulled.records };
}
