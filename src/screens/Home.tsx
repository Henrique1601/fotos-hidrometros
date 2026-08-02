import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import gsap from 'gsap';
import { Camera, Cloud, CloudOff, Download, Droplets, FolderDown, ListOrdered, Plus, Trash2, Upload } from 'lucide-react';
import { db } from '../db/db';
import { deleteCampaign } from '../db/records';
import { createBackupFileName, restoreBackup, serializeBackup } from '../lib/backup';
import { isSupabaseConfigured, getSession, signIn, signOut, syncAll } from '../lib/sync';
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
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);

  useEffect(() => {
    void getSession().then(setSession);
  }, []);

  const photosByCampaign = new Map<number, number>();
  const idxByCampaign = new Map<number, number>();
  for (const r of records) {
    if (r.photo) photosByCampaign.set(r.campaignId, (photosByCampaign.get(r.campaignId) ?? 0) + 1);
    if (r.index !== null && r.index !== undefined) {
      idxByCampaign.set(r.campaignId, (idxByCampaign.get(r.campaignId) ?? 0) + 1);
    }
  }

  const introRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
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

  const handleBackup = async () => {
    try {
      const file = await serializeBackup();
      const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = createBackupFileName(file.campaigns);
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup salvo.');
    } catch (e) {
      console.error(e);
      toast('Falha ao gerar backup.');
    }
  };

  const handleRestore = async (f: File) => {
    const text = await f.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      toast('Arquivo de backup inválido.');
      return;
    }
    if (!window.confirm('Restaurar substitui TODOS os dados atuais (medições e fotos). Continuar?')) {
      return;
    }
    try {
      const r = await restoreBackup(data);
      toast(`Backup restaurado: ${r.campaigns} medições, ${r.records} registros.`);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const handleLogin = async () => {
    if (!email || !password || syncBusy) return;
    setSyncBusy(true);
    try {
      await signIn(email.trim(), password);
      setPassword('');
      setSession(await getSession());
      toast('Conectado à nuvem.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setSession(null);
    toast('Sessão encerrada.');
  };

  const handleSync = async () => {
    if (syncBusy || !session) return;
    setSyncBusy(true);
    try {
      const s = await syncAll();
      toast(`Sincronizado: ${s.campaigns} medições, ${s.records} registros.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
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

      <section className="campaign-list">        {campaigns.length === 0 && (
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

      <GlassCard className="data-card gs-home-item">
        <h3 className="display-small">Seus dados</h3>
        <p className="hint">
          Os dados ficam apenas no seu dispositivo. Faça backups periódicos ou ative a
          sincronização na nuvem.
        </p>
        <div className="export-buttons">
          <button className="btn-ghost" onClick={() => void handleBackup()} aria-label="Fazer backup">
            <Download size={16} /> Backup
          </button>
          <button
            className="btn-ghost"
            onClick={() => restoreRef.current?.click()}
            aria-label="Restaurar backup"
          >
            <Upload size={16} /> Restaurar
          </button>
        </div>
        <input
          ref={restoreRef}
          type="file"
          accept="application/json,.json"
          className="hidden-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleRestore(f);
            e.target.value = '';
          }}
        />

        <div className="sync-box">
          {!isSupabaseConfigured() ? (
            <p className="hint">
              <CloudOff size={14} style={{ verticalAlign: 'text-bottom' }} /> Sincronização não
              configurada neste aparelho. Use o Backup para guardar os dados.
            </p>
          ) : session ? (
            <div className="sync-auth">
              <p className="sync-email">
                <Cloud size={14} style={{ verticalAlign: 'text-bottom' }} /> {session.user.email}
              </p>
              <div className="export-buttons">
                <button className="btn-ghost" onClick={() => void handleSync()} disabled={syncBusy}>
                  <Cloud size={16} /> {syncBusy ? 'Sincronizando…' : 'Sincronizar'}
                </button>
                <button className="btn-ghost" onClick={() => void handleLogout()}>
                  Sair
                </button>
              </div>
            </div>
          ) : (
            <div className="sync-auth">
              <label className="field-label">E-mail</label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="text-input"
              />
              <label className="field-label">Senha</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="text-input"
              />
              <button
                className="btn-primary"
                disabled={syncBusy || !email || !password}
                onClick={() => void handleLogin()}
              >
                <Cloud size={16} /> {syncBusy ? 'Entrando…' : 'Entrar e sincronizar'}
              </button>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
