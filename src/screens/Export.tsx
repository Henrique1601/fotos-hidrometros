import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Clock,
  FileSpreadsheet,
  FileText,
  FolderDown,
  Share2,
} from 'lucide-react';
import { db, MeterRecord } from '../db/db';
import { cleanOrphanAndDuplicateRecords } from '../db/records';
import { TOWERS, towerTotalUnits, isValidCondoUnit } from '../lib/towers';
import { campaignLabel } from '../lib/utils';
import { calculateMeasurementStats, formatDuration, formatPace } from '../lib/measurementStats';
import { buildExcel, exportExcel } from '../lib/exportExcel';
import { buildPdf, exportPdf } from '../lib/exportPdf';
import { exportPhotosZip, NamedBlob } from '../lib/exportZip';
import GlassCard from '../components/GlassCard';
import { Screen } from '../nav';

interface Props {
  campaignId: number;
  go: (s: Screen) => void;
  toast: (m: string) => void;
}

export default function Export({ campaignId, go, toast }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [withPhotos, setWithPhotos] = useState(true);
  const [towerId, setTowerId] = useState<string>('');
  const [watermark, setWatermark] = useState(false);
  const campaign = useLiveQuery(() => db.campaigns.get(campaignId), [campaignId]);
  const records =
    useLiveQuery(
      () => db.records.where('campaignId').equals(campaignId).toArray(),
      [campaignId],
    ) ?? [];

  useEffect(() => {
    void cleanOrphanAndDuplicateRecords(campaignId);
  }, [campaignId]);

  const validRecords = useMemo(() => {
    const map = new Map<string, MeterRecord>();
    for (const r of records) {
      if (!isValidCondoUnit(r.towerId, r.aptCode)) continue;
      const key = `${r.towerId}:${r.aptCode}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, r);
      } else {
        map.set(key, {
          ...existing,
          ...r,
          photo: r.photo ?? existing.photo,
          index: r.index !== null && r.index !== undefined ? r.index : existing.index,
        });
      }
    }
    return Array.from(map.values());
  }, [records]);

  const byTower = useMemo(() => {
    const map = new Map<string, { photos: number; indices: number }>();
    for (const t of TOWERS) map.set(t.id, { photos: 0, indices: 0 });
    for (const r of validRecords) {
      const cur = map.get(r.towerId);
      if (!cur) continue;
      if (r.photo) cur.photos += 1;
      if (r.index !== null && r.index !== undefined) cur.indices += 1;
    }
    return map;
  }, [validRecords]);

  const photos = validRecords.filter((r) => r.photo).length;
  const indices = validRecords.filter((r) => r.index !== null && r.index !== undefined).length;
  const stats = useMemo(() => calculateMeasurementStats(validRecords), [validRecords]);

  const run = async (kind: 'pdf' | 'excel' | 'zip') => {
    if (busy || !campaign) return;
    setBusy(kind);
    try {
      if (kind === 'pdf') {
        await exportPdf(campaign, withPhotos, { towerId: towerId || undefined, watermark });
        toast('PDF exportado.');
      } else if (kind === 'excel') {
        await exportExcel(campaign, { towerId: towerId || undefined });
        toast('Excel exportado.');
      } else {
        await exportPhotosZip(campaign, { towerId: towerId || undefined, watermark });
        toast('ZIP com fotos exportado.');
      }
    } catch (e) {
      console.error(e);
      toast('Falha no export. Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    if (busy || !campaign) return;
    setBusy('share');
    try {
      const files: NamedBlob[] = [
        await buildPdf(campaign, withPhotos, { towerId: towerId || undefined, watermark }),
        await buildExcel(campaign, { towerId: towerId || undefined }),
      ];
      const shareFiles = files.map((f) => new File([f.blob], f.name, { type: f.blob.type }));
      if (navigator.share && navigator.canShare?.({ files: shareFiles })) {
        await navigator.share({
          title: campaignLabel(campaign.name, campaign.month, campaign.year),
          files: shareFiles,
        });
      } else {
        for (const f of files) {
          const url = URL.createObjectURL(f.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = f.name;
          a.click();
          URL.revokeObjectURL(url);
        }
        toast('Arquivos baixados para compartilhar.');
      }
    } catch (e) {
      console.error(e);
      toast('Falha ao compartilhar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <header className="app-header">
        <button className="icon-btn glass" onClick={() => go({ name: 'home' })} aria-label="Voltar">
          <ArrowLeft size={22} />
        </button>
        <div className="header-center">
          <h2 className="header-title">
            {campaign ? campaignLabel(campaign.name, campaign.month, campaign.year) : ''}
          </h2>
          <span className="header-sub">Resumo e exportação</span>
        </div>
        <div className="header-spacer" />
      </header>

      <div className="tower-pills">
        {TOWERS.map((t) => {
          const s = byTower.get(t.id)!;
          const done = s.photos === towerTotalUnits(t);
          return (
            <span key={t.id} className={`tower-pill${done ? ' tower-pill-done' : ''}`}>
              {t.id} {s.photos}/{towerTotalUnits(t)}
            </span>
          );
        })}
      </div>

      {stats.activeTimeMs > 0 && (
        <GlassCard className="export-card">
          <h3 className="display-small">
            <Clock size={16} /> Produtividade & Tempo
          </h3>
          <div className="stats-grid">
            <div className="stats-item">
              <span className="stats-label">Tempo Ativo</span>
              <strong className="stats-val mono">{formatDuration(stats.activeTimeMs)}</strong>
            </div>
            <div className="stats-item">
              <span className="stats-label">Ritmo Médio</span>
              <strong className="stats-val mono">{formatPace(stats.avgSecondsPerPhoto)}</strong>
            </div>
            <div className="stats-item">
              <span className="stats-label">Velocidade</span>
              <strong className="stats-val mono">{stats.photosPerHour} un/h</strong>
            </div>
          </div>
        </GlassCard>
      )}

      <GlassCard className="export-card">
        <h3 className="display-small">Resumo por torre</h3>
        <div className="tower-detail">
          {TOWERS.map((t) => {
            const s = byTower.get(t.id)!;
            const total = towerTotalUnits(t);
            const photosDone = s.photos === total;
            const idxDone = s.indices === s.photos;
            const tStat = stats.towerStats[t.id];
            return (
              <div key={t.id} className={`tower-detail-row${photosDone ? ' is-done' : ''}`}>
                <span className="mono tower-detail-id">Torre {t.id}</span>
                <span className="tower-detail-stats">
                  {s.photos}/{total} fotos
                  <span className="tower-detail-dot" aria-hidden="true" />
                  {idxDone ? s.indices : `${s.indices}/${s.photos}`} índices
                  {tStat && tStat.activeTimeMs > 0 && (
                    <>
                      <span className="tower-detail-dot" aria-hidden="true" />
                      <span className="mono text-dim">{formatDuration(tStat.activeTimeMs)}</span>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <p className="hint">
          {photos} fotos capturadas · {indices} índices preenchidos.
        </p>
      </GlassCard>

      <GlassCard className="export-card">
        <h3 className="display-small">Exportar</h3>

        <label className="check-row">
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
          Incluir fotos no PDF
        </label>

        <label className="check-row">
          <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />
          Marca d'água com apt e data nas fotos
        </label>

        <p className="section-label">Torre</p>
        <div className="chip-row">
          <button
            className={`chip${towerId === '' ? ' chip-active' : ''}`}
            onClick={() => setTowerId('')}
          >
            Todas
          </button>
          {TOWERS.map((t) => (
            <button
              key={t.id}
              className={`chip${towerId === t.id ? ' chip-active' : ''}`}
              onClick={() => setTowerId(t.id)}
            >
              {t.id}
            </button>
          ))}
        </div>

        <div className="export-buttons">
          <button className="btn-primary" disabled={busy !== null} onClick={() => void run('pdf')}>
            <FileText size={18} />
            {busy === 'pdf' ? 'Gerando…' : 'PDF'}
          </button>
          <button className="btn-primary" disabled={busy !== null} onClick={() => void run('excel')}>
            <FileSpreadsheet size={18} />
            {busy === 'excel' ? 'Gerando…' : 'Excel'}
          </button>
          <button className="btn-primary" disabled={busy !== null} onClick={() => void run('zip')}>
            <FolderDown size={18} />
            {busy === 'zip' ? 'Gerando…' : 'Fotos (ZIP)'}
          </button>
        </div>

        <button
          className="btn-ghost btn-share"
          disabled={busy !== null}
          onClick={() => void handleShare()}
          aria-label="Compartilhar campanha"
        >
          <Share2 size={16} />
          {busy === 'share' ? 'Compartilhando…' : 'Compartilhar'}
        </button>

        <p className="hint">
          {towerId ? `Exportando apenas a Torre ${towerId}.` : 'Exportando todas as torres.'} Os
          arquivos são salvos na pasta de downloads do seu dispositivo.
        </p>
      </GlassCard>
    </div>
  );
}
