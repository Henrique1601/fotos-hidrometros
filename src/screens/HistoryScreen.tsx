import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Gauge, ImageOff, Maximize2, X } from 'lucide-react';
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
  const [zoomPhoto, setZoomPhoto] = useState<{ blob: Blob; label: string } | null>(null);

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
                <HistoryThumb
                  blob={r.photo}
                  aptCode={r.aptCode}
                  onClick={() => setZoomPhoto({ blob: r.photo!, label: `${campaignLabel(c!.name, c!.month, c!.year)} · Apt ${r.aptCode}` })}
                />
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {zoomPhoto && (
        <div className="photo-lightbox" onClick={() => setZoomPhoto(null)}>
          <div className="photo-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="icon-btn glass photo-lightbox-close"
              onClick={() => setZoomPhoto(null)}
              aria-label="Fechar ampliação"
            >
              <X size={24} />
            </button>
            <HistoryModalPhoto blob={zoomPhoto.blob} label={zoomPhoto.label} />
            <span className="photo-lightbox-badge mono">{zoomPhoto.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryThumb({ blob, aptCode, onClick }: { blob: Blob; aptCode: string; onClick?: () => void }) {
  const url = usePhotoUrl(blob);
  if (!url) return null;
  return (
    <div className="history-thumb-wrap" onClick={onClick} role="button" tabIndex={0} aria-label={`Ampliar foto do apt ${aptCode}`}>
      <img src={url} alt={`Foto ${aptCode}`} className="history-thumb" />
      <span className="history-thumb-hint">
        <Maximize2 size={12} /> Ampliar
      </span>
    </div>
  );
}

function HistoryModalPhoto({ blob, label }: { blob: Blob; label: string }) {
  const url = usePhotoUrl(blob);
  if (!url) return null;
  return <img src={url} alt={label} className="iv-photo" />;
}
