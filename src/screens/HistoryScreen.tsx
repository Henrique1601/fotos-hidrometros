import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Gauge, ImageOff } from 'lucide-react';
import { db } from '../db/db';
import { campaignLabel, formatIndex, pad2, sideLabel } from '../lib/utils';
import GlassCard from '../components/GlassCard';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import { Screen } from '../nav';

interface Props {
  towerId: string;
  aptCode: string;
  go: (s: Screen) => void;
  toast: (m: string) => void;
}

export default function HistoryScreen({ towerId, aptCode, go }: Props) {
  const campaigns = useLiveQuery(() => db.campaigns.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const allRecords = useLiveQuery(() => db.records.toArray(), []) ?? [];

  const records = useMemo(
    () => allRecords.filter((r) => r.towerId === towerId && r.aptCode === aptCode),
    [allRecords, towerId, aptCode],
  );

  const campaignMap = useMemo(() => new Map(campaigns.map((c) => [c.id!, c])), [campaigns]);

  const entries = useMemo(() => {
    return records
      .map((r) => ({
        record: r,
        campaign: campaignMap.get(r.campaignId),
      }))
      .filter((e) => e.campaign)
      .sort((a, b) => (b.campaign!.year - a.campaign!.year) || (b.campaign!.month - a.campaign!.month));
  }, [records, campaignMap]);

  return (
    <div>
      <header className="app-header">
        <button className="icon-btn glass" onClick={() => go({ name: 'home' })} aria-label="Voltar">
          <ArrowLeft size={22} />
        </button>
        <div className="header-center">
          <h2 className="header-title">Histórico</h2>
          <span className="header-sub">
            Torre {towerId} · Apt {aptCode}
          </span>
        </div>
        <div className="header-spacer" />
      </header>

      {entries.length === 0 ? (
        <GlassCard className="empty-state">
          <ImageOff size={26} />
          <p>Nenhum registro encontrado para este apartamento.</p>
        </GlassCard>
      ) : (
        <div className="history-list">
          {entries.map(({ record: r, campaign: c }) => (
            <GlassCard key={r.id} className="history-card">
              <div className="history-head">
                <h3 className="history-label">
                  {campaignLabel(c!.name, c!.month, c!.year)}
                </h3>
                {r.index !== null && r.index !== undefined && (
                  <span className="history-index mono">
                    <Gauge size={14} /> {formatIndex(r.index)}
                  </span>
                )}
              </div>
              <div className="history-meta">
                <span>Andar {pad2(r.floor)} · {sideLabel(r.side)}</span>
                {r.capturedAt && (
                  <span>Fotografado: {new Date(r.capturedAt).toLocaleDateString('pt-BR')}</span>
                )}
                {r.indexedAt && (
                  <span>Indexado: {new Date(r.indexedAt).toLocaleDateString('pt-BR')}</span>
                )}
              </div>
              {r.photo && (
                <HistoryThumb blob={r.photo} aptCode={r.aptCode} />
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryThumb({ blob, aptCode }: { blob: Blob; aptCode: string }) {
  const url = usePhotoUrl(blob);
  if (!url) return null;
  return (
    <div className="history-thumb-wrap">
      <img src={url} alt={`Foto ${aptCode}`} className="history-thumb" />
    </div>
  );
}
