import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import gsap from 'gsap';
import { Camera, Droplets, FolderDown, ListOrdered, Plus, Trash2 } from 'lucide-react';
import { db } from '../db/db';
import { deleteCampaign } from '../db/records';
import { TOWERS, towerTotalUnits } from '../lib/towers';
import { campaignLabel } from '../lib/utils';
import GlassCard from '../components/GlassCard';
import { Screen } from '../nav';

interface Props {
  go: (s: Screen) => void;
  toast: (m: string) => void;
}

const TOTAL_UNITS = TOWERS.reduce((acc, t) => acc + towerTotalUnits(t), 0);

export default function Home({ go, toast }: Props) {
  const campaigns =
    useLiveQuery(() => db.campaigns.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const records = useLiveQuery(() => db.records.toArray(), []) ?? [];

  const photosByCampaign = new Map<number, number>();
  const idxByCampaign = new Map<number, number>();
  for (const r of records) {
    if (r.photo) photosByCampaign.set(r.campaignId, (photosByCampaign.get(r.campaignId) ?? 0) + 1);
    if (r.index !== null && r.index !== undefined) {
      idxByCampaign.set(r.campaignId, (idxByCampaign.get(r.campaignId) ?? 0) + 1);
    }
  }

  const introRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = introRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.gs-home-item', { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.5, ease: 'power2.out' });
    }, el);
    return () => ctx.revert();
  }, []);

  const handleDelete = async (c: { id?: number; month: number; year: number }) => {
    if (!c.id) return;
    if (!window.confirm('Excluir esta medição e todas as fotos dela?')) return;
    await deleteCampaign(c.id);
    toast('Medição excluída.');
  };

  return (
    <div ref={introRef}>
      <header className="app-header gs-home-item">
        <div className="logo-row">
          <span className="logo-badge">
            <Droplets size={22} />
          </span>
          <div>
            <h1 className="display-title">FotoHidro</h1>
            <p className="app-subtitle">Leitura e fotos de hidrômetros</p>
          </div>
        </div>
      </header>

      <button
        className="btn-primary btn-hero gs-home-item"
        onClick={() => go({ name: 'new-campaign' })}
      >
        <Plus size={20} /> Nova medição
      </button>

      <section className="campaign-list">
        {campaigns.length === 0 && (
          <GlassCard className="empty-state gs-home-item">
            <Camera size={28} />
            <p>Nenhuma medição ainda.<br />Toque em "Nova medição" para começar.</p>
          </GlassCard>
        )}

        {campaigns.map((c) => {
          const label = campaignLabel(c.name, c.month, c.year);
          const photos = photosByCampaign.get(c.id!) ?? 0;
          const idx = idxByCampaign.get(c.id!) ?? 0;
          const pct = Math.round((photos / TOTAL_UNITS) * 100);
          return (
            <GlassCard key={c.id} className="campaign-card gs-home-item">
              <div className="campaign-head">
                <div>
                  <h3 className="campaign-name">{label}</h3>
                  <p className="campaign-meta">
                    {photos}/{TOTAL_UNITS} fotos · {idx} índices
                  </p>
                </div>
                <button
                  className="icon-btn danger"
                  onClick={() => handleDelete(c)}
                  aria-label="Excluir medição"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="campaign-bar">
                <span className="campaign-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="campaign-actions">
                <button className="btn-ghost" onClick={() => go({ name: 'collect', campaignId: c.id! })}>
                  <Camera size={16} /> Fotos
                </button>
                <button className="btn-ghost" onClick={() => go({ name: 'indices', campaignId: c.id! })}>
                  <ListOrdered size={16} /> Índices
                </button>
                <button className="btn-ghost" onClick={() => go({ name: 'export', campaignId: c.id! })}>
                  <FolderDown size={16} /> Exportar
                </button>
              </div>
            </GlassCard>
          );
        })}
      </section>
    </div>
  );
}
