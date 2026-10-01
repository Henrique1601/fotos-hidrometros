import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, getSupabase, getSession, getLastSyncAt } from '../lib/sync';
import type { Campaign, MeterRecord } from '../db/db';

export type CloudStatusType = 'unconfigured' | 'offline' | 'pending' | 'synced';

export interface CloudStatusInfo {
  status: CloudStatusType;
  session: Session | null;
  pendingCount: number;
  isConfigured: boolean;
  tooltip: string;
}

export function useCloudStatus(campaigns: Campaign[] = [], records: MeterRecord[] = []): CloudStatusInfo {
  const isConfigured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!isConfigured) return;

    void getSession().then(setSession);

    const sb = getSupabase();
    if (!sb) return;

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const lastSyncAt = getLastSyncAt();

  const pendingRecords = records.filter((r) => r.updatedAt > lastSyncAt).length;
  const pendingCampaigns = campaigns.filter((c) => c.updatedAt > lastSyncAt).length;
  const pendingCount = pendingRecords + pendingCampaigns;

  let status: CloudStatusType = 'offline';
  let tooltip = 'Nuvem desconectada · Toque para entrar';

  if (!isConfigured) {
    status = 'unconfigured';
    tooltip = 'Nuvem não configurada';
  } else if (!session) {
    status = 'offline';
    tooltip = 'Nuvem desconectada · Toque para entrar';
  } else if (pendingCount > 0) {
    status = 'pending';
    tooltip = `Nuvem: ${pendingCount} alteraç${pendingCount === 1 ? 'ão pendente' : 'ões pendentes'} de sincronização`;
  } else {
    status = 'synced';
    tooltip = `Nuvem sincronizada (${session.user.email})`;
  }

  return {
    status,
    session,
    pendingCount,
    isConfigured,
    tooltip,
  };
}
