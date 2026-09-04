import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import gsap from 'gsap';
import { BarChart3, Camera, Clock, Cloud, Droplets, FolderDown, HardDrive, ListOrdered, Pencil, Play, Plus, Search, Trash2, X } from 'lucide-react';
import { db } from '../db/db';
import { deleteCampaign, updateCampaign, cleanOrphanAndDuplicateRecords } from '../db/records';
import { CONDO_TOTAL_UNITS, isValidCondoUnit } from '../lib/towers';
import { campaignLabel, monthName } from '../lib/utils';
import { calculateMeasurementStats, formatDuration, formatPace } from '../lib/measurementStats';
import GlassCard from '../components/GlassCard';
import ConfirmModal from '../components/ConfirmModal';
import { Screen } from '../nav';
import { NotifyFn } from '../App';

interface Props {
  go: (s: Screen) => void;
  toast: NotifyFn;
}

const TOTAL_UNITS = CONDO_TOTAL_UNITS;

export default function Home({ go, toast }: Props) {
  const campaigns =
    useLiveQuery(() => db.campaigns.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const records = useLiveQuery(() => db.records.toArray(), []) ?? [];
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCfg, setConfirmCfg] = useState<{
    title: string;
    message: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<{ id: number; name: string; month: number; year: number } | null>(null);

  useEffect(() => {
    void cleanOrphanAndDuplicateRecords();
  }, []);

  const [burstSetting, setBurstSetting] = useState<boolean>(() => {
    try {
      return localStorage.getItem('foto-hidro:burst') === 'true';
    } catch {
      return false;
    }
  });
  const [torchSetting, setTorchSetting] = useState<boolean>(() => {
    try {
      return localStorage.getItem('foto-hidro:torch') === 'true';
    } catch {
      return false;
    }
  });

  const toggleBurstSetting = (checked: boolean) => {
    setBurstSetting(checked);
    try {
      localStorage.setItem('foto-hidro:burst', String(checked));
    } catch {
      // ignore
    }
    toast(checked ? 'Modo Burst ativado.' : 'Modo Burst desativado.');
  };

  const toggleTorchSetting = (checked: boolean) => {
    setTorchSetting(checked);
    try {
      localStorage.setItem('foto-hidro:torch', String(checked));
    } catch {
      // ignore
    }
    toast(checked ? 'Lanterna contínua ativada.' : 'Lanterna contínua desativada.');
  };

  const { photosByCampaign, idxByCampaign } = useMemo(() => {
    const photos = new Map<number, number>();
    const idxs = new Map<number, number>();

    const unique = new Map<string, (typeof records)[0]>();
    for (const r of records) {
      if (!isValidCondoUnit(r.towerId, r.aptCode)) continue;
      const key = `${r.campaignId}:${r.towerId}:${r.aptCode}`;
      const existing = unique.get(key);
      if (!existing) {
        unique.set(key, r);
      } else {
        unique.set(key, {
          ...existing,
          ...r,
          photo: r.photo ?? existing.photo,
          index: r.index !== null && r.index !== undefined ? r.index : existing.index,
        });
      }
    }

    for (const r of unique.values()) {
      if (r.photo) photos.set(r.campaignId, (photos.get(r.campaignId) ?? 0) + 1);
      if (r.index !== null && r.index !== undefined) {
        idxs.set(r.campaignId, (idxs.get(r.campaignId) ?? 0) + 1);
      }
    }

    return { photosByCampaign: photos, idxByCampaign: idxs };
  }, [records]);

  const filtered = useMemo(() => {
    if (!search.trim()) return campaigns;
    const q = search.toLowerCase();
    return campaigns.filter((c) => campaignLabel(c.name, c.month, c.year).toLowerCase().includes(q));
  }, [campaigns, search]);

  const introRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = introRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.gs-home-item', { opacity: 0, y: 16 }, { opacity: 1, y: 0, stagger: 0.04, duration: 0.3, ease: 'power2.out' });
    }, el);
    return () => ctx.revert();
  }, []);

  const handleDelete = (c: { id?: number; name?: string; month: number; year: number }) => {
    if (!c.id) return;
    const label = campaignLabel(c.name, c.month, c.year);
    setConfirmCfg({
      title: 'Excluir medição?',
      message: `Excluir "${label}" e todas as fotos dela? Essa ação não pode ser desfeita.`,
      danger: true,
      onConfirm: async () => {
        await deleteCampaign(c.id!);
        toast('Medição excluída.');
      },
    });
    setConfirmOpen(true);
  };

  const openEdit = (c: { id: number; name?: string; month: number; year: number }) => {
    setEditCampaign({ id: c.id, name: c.name ?? '', month: c.month, year: c.year });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editCampaign) return;
    await updateCampaign(editCampaign.id, {
      name: editCampaign.name || undefined,
      month: editCampaign.month,
      year: editCampaign.year,
    });
    toast('Medição atualizada.');
    setEditOpen(false);
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
        <div className="home-toolbar">
          <button
            className={`icon-btn glass${burstSetting || torchSetting ? ' has-badge' : ''}`}
            onClick={() => setCameraModalOpen(true)}
            aria-label="Câmera e Captura"
            title="Opções de Câmera e Captura"
          >
            <Camera size={18} />
          </button>
          <button
            className="icon-btn glass"
            onClick={() => go({ name: 'data' })}
            aria-label="Dados"
            title="Dados e Backup"
          >
            <HardDrive size={18} />
          </button>
          <button
            className="icon-btn glass"
            onClick={() => go({ name: 'sync' })}
            aria-label="Sincronização"
            title="Sincronização Nuvem"
          >
            <Cloud size={18} />
          </button>
        </div>
      </header>

      <button
        className="btn-primary btn-hero gs-home-item"
        onClick={() => go({ name: 'new-campaign' })}
      >
        <Plus size={20} /> Nova medição
      </button>

      {campaigns.length > 0 && (
        <div className="search-bar gs-home-item">
          <Search size={16} className="search-icon" />
          <input
            className="search-input"
            placeholder="Buscar medição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <section className="campaign-list">
        {campaigns.length === 0 && (
          <GlassCard className="empty-state gs-home-item">
            <Camera size={28} />
            <p>Nenhuma medição ainda.<br />Toque em "Nova medição" para começar.</p>
          </GlassCard>
        )}

        {filtered.length === 0 && campaigns.length > 0 && (
          <GlassCard className="empty-state gs-home-item">
            <Search size={28} />
            <p>Nenhuma medição encontrada.</p>
          </GlassCard>
        )}

        {filtered.map((c) => {
          const label = campaignLabel(c.name, c.month, c.year);
          const photos = photosByCampaign.get(c.id!) ?? 0;
          const idx = idxByCampaign.get(c.id!) ?? 0;
          const pct = Math.round((photos / TOTAL_UNITS) * 100);
          const campRecords = records.filter((r) => r.campaignId === c.id);
          const stats = calculateMeasurementStats(campRecords);
          return (
            <GlassCard key={c.id} className="campaign-card gs-home-item">
              <div className="campaign-head">
                <div>
                  <h2 className="campaign-name">{label}</h2>
                  <p className="campaign-meta">
                    <span>{photos}/{TOTAL_UNITS} fotos · {idx} índices</span>
                    {stats.activeTimeMs > 0 && (
                      <span className="campaign-meta-time">
                        <Clock size={12} /> {formatDuration(stats.activeTimeMs)} ({formatPace(stats.avgSecondsPerPhoto)})
                      </span>
                    )}
                  </p>
                </div>
                <div className="campaign-head-actions">
                  <button
                    className="icon-btn"
                    onClick={() => openEdit({ id: c.id!, name: c.name, month: c.month, year: c.year })}
                    aria-label="Editar medição"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={() => handleDelete(c)}
                    aria-label="Excluir medição"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="campaign-bar">
                <span className="campaign-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              {c.lastTower && (
                <button
                  className="campaign-resume-banner"
                  onClick={() => go({ name: 'collect', campaignId: c.id!, towerId: c.lastTower })}
                >
                  <span className="campaign-resume-text">
                    <Play size={15} className="campaign-resume-icon" /> Continuar Torre {c.lastTower}{c.lastFloor ? ` · andar ${String(c.lastFloor).padStart(2, '0')}` : ''}
                  </span>
                  <span className="campaign-resume-arrow">→</span>
                </button>
              )}
              <div className="campaign-actions-grid">
                <button className="btn-ghost campaign-action-btn" onClick={() => go({ name: 'collect', campaignId: c.id! })}>
                  <Camera size={16} /> Fotos
                </button>
                <button className="btn-ghost campaign-action-btn" onClick={() => go({ name: 'indices', campaignId: c.id! })}>
                  <ListOrdered size={16} /> Índices
                </button>
                <button className="btn-ghost campaign-action-btn" onClick={() => go({ name: 'consumption', campaignId: c.id! })}>
                  <BarChart3 size={16} /> Consumo
                </button>
                <button className="btn-ghost campaign-action-btn" onClick={() => go({ name: 'export', campaignId: c.id! })}>
                  <FolderDown size={16} /> Exportar
                </button>
              </div>
            </GlassCard>
          );
        })}
      </section>

      <ConfirmModal
        open={confirmOpen}
        title={confirmCfg?.title ?? ''}
        message={confirmCfg?.message ?? ''}
        danger={confirmCfg?.danger}
        confirmLabel={confirmCfg?.danger ? 'Excluir' : 'Confirmar'}
        onConfirm={() => {
          confirmCfg?.onConfirm();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      {cameraModalOpen && (
        <div className="modal-overlay" onClick={() => setCameraModalOpen(false)}>
          <GlassCard className="edit-campaign-modal">
            <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Camera size={20} style={{ color: 'var(--cyan)' }} />
                  <h2 className="modal-title" style={{ margin: 0 }}>Câmera & Captura</h2>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setCameraModalOpen(false)}
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="check-row" style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={burstSetting}
                    onChange={(e) => toggleBurstSetting(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text)', fontSize: '0.9rem' }}>Modo Burst</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.3, display: 'block', marginTop: 2 }}>
                      Disparo rápido e avanço instantâneo para o próximo apartamento
                    </span>
                  </div>
                </label>

                <label className="check-row" style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={torchSetting}
                    onChange={(e) => toggleTorchSetting(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text)', fontSize: '0.9rem' }}>Lanterna contínua</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.3, display: 'block', marginTop: 2 }}>
                      Manter o flash/lanterna sempre ligado durante a captura das fotos
                    </span>
                  </div>
                </label>
              </div>

              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button className="btn-primary" style={{ width: '100%' }} onClick={() => setCameraModalOpen(false)}>
                  Concluído
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {editOpen && editCampaign && (
        <div className="modal-overlay" onClick={() => setEditOpen(false)}>
          <GlassCard className="edit-campaign-modal">
            <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h2 className="modal-title">Editar medição</h2>
            <label className="field-label">
              Nome
              <input
                className="modal-input"
                placeholder="Ex: Julho 2026"
                value={editCampaign.name}
                onChange={(e) => setEditCampaign({ ...editCampaign, name: e.target.value })}
              />
            </label>
            <div className="modal-row">
              <label className="field-label" style={{ flex: 1 }}>
                Mês
                <select
                  className="modal-input"
                  value={editCampaign.month}
                  onChange={(e) => setEditCampaign({ ...editCampaign, month: Number(e.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
                  ))}
                </select>
              </label>
              <label className="field-label" style={{ flex: 1 }}>
                Ano
                <input
                  className="modal-input"
                  type="number"
                  min={2024}
                  max={2030}
                  value={editCampaign.year}
                  onChange={(e) => setEditCampaign({ ...editCampaign, year: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveEdit}>Salvar</button>
            </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
