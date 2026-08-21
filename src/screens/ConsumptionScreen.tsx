import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, BarChart3, Droplets, AlertTriangle, TrendingUp } from 'lucide-react';
import { db } from '../db/db';
import { TOWERS, towerTotalUnits } from '../lib/towers';
import { Consumption, loadConsumption, keyOf } from '../lib/consumption';
import { campaignLabel } from '../lib/utils';
import GlassCard from '../components/GlassCard';
import { Screen } from '../nav';
import { NotifyFn } from '../App';

interface Props {
  campaignId: number;
  go: (s: Screen) => void;
  toast: NotifyFn;
}

export default function ConsumptionScreen({ campaignId, go, toast }: Props) {
  const campaign = useLiveQuery(() => db.campaigns.get(campaignId), [campaignId]);
  const records = useLiveQuery(() => db.records.where('campaignId').equals(campaignId).toArray(), [campaignId]) ?? [];

  const [consumption, setConsumption] = useState<Map<string, Consumption>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaign) return;
    let cancelled = false;
    loadConsumption(campaign, records).then((map) => {
      if (!cancelled) {
        setConsumption(map);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [campaign, records]);

  const label = campaign ? campaignLabel(campaign.name, campaign.month, campaign.year) : '';

  const stats = useMemo(() => {
    const values = [...consumption.values()].filter((c) => c.consumption !== null);
    if (values.length === 0) return null;
    const consumptions = values.map((v) => v.consumption!);
    const total = consumptions.reduce((a, b) => a + b, 0);
    const avg = total / consumptions.length;
    const max = Math.max(...consumptions);
    const min = Math.min(...consumptions);
    const anomalies = values.filter((v) => v.status === 'anomaly').length;
    const noBase = [...consumption.values()].filter((v) => v.status === 'no-base').length;
    return { total, avg, max, min, anomalies, noBase, count: values.length };
  }, [consumption]);

  const towerStats = useMemo(() => {
    return TOWERS.map((tower) => {
      const total = towerTotalUnits(tower);
      const towerConsumptions = records
        .filter((r) => r.towerId === tower.id && r.index !== null && r.index !== undefined)
        .map((r) => {
          const c = consumption.get(keyOf(r.towerId, r.aptCode));
          return { aptCode: r.aptCode, ...c };
        })
        .filter((c) => c.consumption !== null);
      const avg = towerConsumptions.length > 0
        ? towerConsumptions.reduce((a, b) => a + (b.consumption ?? 0), 0) / towerConsumptions.length
        : 0;
      const anomalies = towerConsumptions.filter((c) => c.status === 'anomaly').length;
      return { tower, total, indexed: towerConsumptions.length, avg, anomalies };
    });
  }, [records, consumption]);

  const handleExportPdf = async () => {
    toast('Exportando relatório…');
    const { buildPdf } = await import('../lib/exportPdf');
    const { blob, name } = await buildPdf(campaign!, false);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    toast('PDF exportado!');
  };

  if (!campaign) return null;

  return (
    <div>
      <header className="app-header">
        <button className="icon-btn glass" onClick={() => go({ name: 'home' })} aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="display-title" style={{ fontSize: '1.1rem' }}>Consumo</h1>
          <p className="app-subtitle">{label}</p>
        </div>
      </header>

      {loading ? (
        <GlassCard className="empty-state">
          <BarChart3 size={28} />
          <p>Calculando consumo…</p>
        </GlassCard>
      ) : stats ? (
        <div className="consumption-grid">
          <GlassCard className="consumption-summary">
            <div className="consumption-stat">
              <TrendingUp size={16} />
              <span className="consumption-stat-label">Média</span>
              <span className="consumption-stat-value">{stats.avg.toFixed(1)} m³</span>
            </div>
            <div className="consumption-stat">
              <Droplets size={16} />
              <span className="consumption-stat-label">Total</span>
              <span className="consumption-stat-value">{stats.total.toFixed(0)} m³</span>
            </div>
            <div className="consumption-stat">
              <AlertTriangle size={16} />
              <span className="consumption-stat-label">Anomalias</span>
              <span className="consumption-stat-value consumption-stat-danger">{stats.anomalies}</span>
            </div>
            <div className="consumption-stat">
              <span className="consumption-stat-label">Sem base</span>
              <span className="consumption-stat-value consumption-stat-muted">{stats.noBase}</span>
            </div>
          </GlassCard>

          <GlassCard className="consumption-range">
            <span>Menor: {stats.min} m³</span>
            <span>·</span>
            <span>Maior: {stats.max} m³</span>
          </GlassCard>

          <h3 className="section-title" style={{ margin: '16px 0 8px' }}>Por torre</h3>
          {towerStats.map(({ tower, total, indexed, avg, anomalies }) => (
            <GlassCard key={tower.id} className="tower-consumption-card">
              <div className="tower-consumption-header">
                <span className="tower-consumption-name">Torre {tower.id}</span>
                <span className="tower-consumption-meta">
                  {indexed}/{total} · {avg.toFixed(1)} m³
                </span>
              </div>
              <div className="tower-consumption-bar">
                <span
                  className={`tower-consumption-bar-fill ${anomalies > 0 ? 'tower-consumption-bar-anomaly' : ''}`}
                  style={{ width: `${total > 0 ? (indexed / total) * 100 : 0}%` }}
                />
              </div>
              {anomalies > 0 && (
                <span className="tower-consumption-anomaly">
                  <AlertTriangle size={12} /> {anomalies} anomalia{anomalies > 1 ? 's' : ''}
                </span>
              )}
            </GlassCard>
          ))}

          <button className="btn-primary" onClick={handleExportPdf} style={{ marginTop: 16 }}>
            Exportar PDF
          </button>
        </div>
      ) : (
        <GlassCard className="empty-state">
          <BarChart3 size={28} />
          <p>Nenhum índice informado ainda.<br />Vá em "Índices" para preencher.</p>
        </GlassCard>
      )}
    </div>
  );
}
