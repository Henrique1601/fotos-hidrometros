import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckSquare,
  Cloud,
  Database,
  Download,
  FileCheck,
  FileSpreadsheet,
  HardDrive,
  Image,
  Info,
  Loader2,
  RefreshCw,
  Square,
  Upload,
} from 'lucide-react';
import { db, Campaign } from '../db/db';
import {
  BackupFile,
  BackupType,
  generateBackupBlob,
  isValidBackup,
  restoreBackup,
  RestoreContentType,
} from '../lib/backup';
import { campaignLabel } from '../lib/utils';
import GlassCard from '../components/GlassCard';
import { Screen } from '../nav';

interface Props {
  go: (s: Screen) => void;
  toast: (m: string) => void;
}

export default function DataScreen({ go, toast }: Props) {
  const restoreRef = useRef<HTMLInputElement>(null);
  const [backupType, setBackupType] = useState<BackupType>('all');
  const [selectedIds, setSelectedIds] = useState<number[] | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupProgress, setBackupProgress] = useState<{ done: number; total: number } | null>(null);
  const [loadingJuly, setLoadingJuly] = useState(false);

  // Restore state
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [restoreContentType, setRestoreContentType] = useState<RestoreContentType>('all');
  const [restoreSelectedIds, setRestoreSelectedIds] = useState<number[] | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);

  const campaigns = useLiveQuery(() => db.campaigns.toArray(), []) ?? [];
  const records = useLiveQuery(() => db.records.toArray(), []) ?? [];

  // Active campaign IDs to backup (default to all if not set)
  const activeCampaignIds = useMemo(() => {
    if (selectedIds !== null) return selectedIds;
    return campaigns.filter((c) => c.id !== undefined).map((c) => c.id as number);
  }, [campaigns, selectedIds]);

  const toggleCampaign = (id: number) => {
    if (activeCampaignIds.includes(id)) {
      setSelectedIds(activeCampaignIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...activeCampaignIds, id]);
    }
  };

  const selectAll = () => {
    setSelectedIds(campaigns.filter((c) => c.id !== undefined).map((c) => c.id as number));
  };

  const selectNone = () => {
    setSelectedIds([]);
  };

  // Restore active campaign IDs
  const fileCampaigns = pendingBackup?.campaigns ?? [];
  const activeRestoreIds = useMemo(() => {
    if (restoreSelectedIds !== null) return restoreSelectedIds;
    return fileCampaigns.filter((c) => c.id !== undefined).map((c) => c.id as number);
  }, [fileCampaigns, restoreSelectedIds]);

  const toggleRestoreCampaign = (id: number) => {
    if (activeRestoreIds.includes(id)) {
      setRestoreSelectedIds(activeRestoreIds.filter((x) => x !== id));
    } else {
      setRestoreSelectedIds([...activeRestoreIds, id]);
    }
  };

  const selectAllRestore = () => {
    setRestoreSelectedIds(fileCampaigns.filter((c) => c.id !== undefined).map((c) => c.id as number));
  };

  const selectNoneRestore = () => {
    setRestoreSelectedIds([]);
  };

  const handleBackup = async () => {
    if (backupBusy) return;
    if (campaigns.length > 0 && activeCampaignIds.length === 0) {
      toast('Selecione ao menos um período para o backup.');
      return;
    }

    setBackupBusy(true);
    setBackupProgress(null);
    try {
      const { blob, fileName } = await generateBackupBlob({
        type: backupType,
        campaignIds: activeCampaignIds.length > 0 ? activeCampaignIds : undefined,
        onProgress: (done, total) => {
          setBackupProgress({ done, total });
        },
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup salvo com sucesso!');
    } catch (e) {
      console.error(e);
      toast('Falha ao gerar backup.');
    } finally {
      setBackupBusy(false);
      setBackupProgress(null);
    }
  };

  const handleRestoreFile = async (f: File) => {
    let data: unknown;
    try {
      const text = await f.text();
      data = JSON.parse(text);
    } catch {
      toast('Arquivo inválido ou corrompido.');
      return;
    }

    if (!isValidBackup(data)) {
      toast('Arquivo de backup inválido ou incompatível com o sistema.');
      return;
    }

    const file = data as BackupFile;
    setPendingBackup(file);
    setRestoreMode('replace');
    setRestoreContentType(file.type || 'all');
    setRestoreSelectedIds(
      file.campaigns.filter((c) => c.id !== undefined).map((c) => c.id as number),
    );
  };

  const confirmRestore = async () => {
    if (!pendingBackup || restoreBusy) return;
    if (pendingBackup.campaigns.length > 0 && activeRestoreIds.length === 0) {
      toast('Selecione ao menos uma medição do arquivo para restaurar.');
      return;
    }

    setRestoreBusy(true);
    try {
      const r = await restoreBackup(pendingBackup, {
        mode: restoreMode,
        contentType: restoreContentType,
        selectedCampaignIds: activeRestoreIds,
      });

      const typeLabel =
        restoreContentType === 'indices'
          ? ' (apenas índices)'
          : restoreContentType === 'photos'
          ? ' (apenas fotos)'
          : '';

      toast(
        restoreMode === 'replace'
          ? `Backup restaurado${typeLabel}: ${r.campaigns} medições, ${r.records} registros.`
          : `Backup mesclado${typeLabel}: ${r.campaigns} medições processadas, ${r.records} registros sincronizados.`,
      );
      setPendingBackup(null);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setRestoreBusy(false);
    }
  };

  const handleLoadJulyBase = async () => {
    setLoadingJuly(true);
    try {
      const { loadJuly2026Base } = await import('../lib/seedJuly2026');
      const result = await loadJuly2026Base();
      toast(`Base de Julho/2026 carregada: ${result.count} índices salvos!`);
    } catch (e) {
      console.error(e);
      toast('Erro ao carregar base de Julho.');
    } finally {
      setLoadingJuly(false);
    }
  };

  return (
    <div>
      <header className="app-header">
        <button className="icon-btn glass" onClick={() => go({ name: 'home' })} aria-label="Voltar">
          <ArrowLeft size={22} />
        </button>
        <div className="header-center">
          <h2 className="header-title">Dados</h2>
          <span className="header-sub">Backup e restauração flexível</span>
        </div>
        <div className="header-spacer" />
      </header>

      <div className="page-stack">
        <GlassCard className="page-card">
          <div className="page-card-icon">
            <HardDrive size={24} />
          </div>
          <h3 className="page-card-title">Seus dados ficam aqui</h3>
          <p className="page-card-desc">
            Todos os dados (fotos e índices) ficam salvos localmente neste aparelho. Faça backups
            periódicos ou selecione períodos específicos para arquivar.
          </p>
          <div className="db-stats-badge">
            <Database size={14} />
            <span>
              {campaigns.length} mediç{campaigns.length === 1 ? 'ão' : 'ões'} · {records.length} registros
            </span>
          </div>
        </GlassCard>

        {/* ---------- Base de Julho/2026 ---------- */}
        <GlassCard className="page-card">
          <div className="page-card-row">
            <div className="page-card-row-info">
              <h3 className="page-card-title-sm">Base de Julho/2026</h3>
              <p className="page-card-desc-sm">
                Carrega 1.435 índices anteriores de Julho/2026 para cálculo automático de consumo e conferência.
              </p>
            </div>
            <button className="btn-primary" onClick={() => void handleLoadJulyBase()} disabled={loadingJuly}>
              {loadingJuly ? <Loader2 size={16} className="spin" /> : <Database size={16} />}
              {loadingJuly ? 'Carregando…' : 'Carregar Base'}
            </button>
          </div>
        </GlassCard>

        {/* ---------- Configuração do Backup ---------- */}
        <GlassCard className="page-card">
          <div className="page-card-header-row">
            <div>
              <h3 className="page-card-title-sm">1. Tipo de Backup</h3>
              <p className="page-card-desc-sm">Escolha o conteúdo que deseja salvar</p>
            </div>
          </div>

          <div className="backup-type-grid">
            <button
              type="button"
              className={`backup-type-card ${backupType === 'all' ? 'active' : ''}`}
              onClick={() => setBackupType('all')}
            >
              <FileCheck size={20} className="backup-card-icon" />
              <div className="backup-card-text">
                <strong>Completo (Tudo)</strong>
                <span>Fotos originais + índices digitados</span>
              </div>
              {backupType === 'all' && <Check size={16} className="backup-card-check" />}
            </button>

            <button
              type="button"
              className={`backup-type-card ${backupType === 'indices' ? 'active' : ''}`}
              onClick={() => setBackupType('indices')}
            >
              <FileSpreadsheet size={20} className="backup-card-icon" />
              <div className="backup-card-text">
                <strong>Apenas Índices</strong>
                <span>Ultraleve (sem fotos), apenas leituras</span>
              </div>
              {backupType === 'indices' && <Check size={16} className="backup-card-check" />}
            </button>

            <button
              type="button"
              className={`backup-type-card ${backupType === 'photos' ? 'active' : ''}`}
              onClick={() => setBackupType('photos')}
            >
              <Image size={20} className="backup-card-icon" />
              <div className="backup-card-text">
                <strong>Apenas Fotos</strong>
                <span>Fotos capturadas dos hidrômetros</span>
              </div>
              {backupType === 'photos' && <Check size={16} className="backup-card-check" />}
            </button>
          </div>
        </GlassCard>

        {/* ---------- Seleção de Período / Campanhas ---------- */}
        <GlassCard className="page-card">
          <div className="page-card-header-row">
            <div>
              <h3 className="page-card-title-sm">2. Período / Medições</h3>
              <p className="page-card-desc-sm">
                Selecione os meses que deseja incluir no arquivo
              </p>
            </div>
            {campaigns.length > 1 && (
              <div className="campaign-select-actions">
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={activeCampaignIds.length === campaigns.length ? selectNone : selectAll}
                >
                  {activeCampaignIds.length === campaigns.length ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>
            )}
          </div>

          {campaigns.length === 0 ? (
            <p className="text-dim text-sm" style={{ padding: '8px 0' }}>
              Nenhuma medição criada ainda.
            </p>
          ) : (
            <div className="backup-campaign-list">
              {campaigns.map((c: Campaign) => {
                if (!c.id) return null;
                const selected = activeCampaignIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`backup-campaign-item ${selected ? 'selected' : ''}`}
                    onClick={() => toggleCampaign(c.id!)}
                  >
                    {selected ? <CheckSquare size={18} className="text-cyan" /> : <Square size={18} />}
                    <div className="backup-campaign-item-label">
                      <strong>{campaignLabel(c.name, c.month, c.year)}</strong>
                      <span className="backup-campaign-item-sub">
                        {c.leiturista ? `Leiturista: ${c.leiturista} · ` : ''}
                        Status: {c.status === 'done' ? 'Concluída' : 'Em andamento'}
                      </span>
                    </div>
                    <Calendar size={15} className="backup-item-cal" />
                  </button>
                );
              })}
            </div>
          )}

          <div className="backup-action-footer">
            <button
              className="btn-primary btn-backup-main"
              onClick={() => void handleBackup()}
              disabled={backupBusy || (campaigns.length > 0 && activeCampaignIds.length === 0)}
            >
              {backupBusy ? <Loader2 size={18} className="spin" /> : <Download size={18} />}
              {backupBusy
                ? backupProgress
                  ? `Gerando backup (${backupProgress.done}/${backupProgress.total})…`
                  : 'Gerando arquivo de backup…'
                : `Baixar Backup (${activeCampaignIds.length} ${
                    activeCampaignIds.length === 1 ? 'mês' : 'meses'
                  })`}
            </button>
          </div>
        </GlassCard>

        {/* ---------- Seção de Restauração ---------- */}
        <GlassCard className="page-card">
          <div className="page-card-row">
            <div className="page-card-row-info">
              <h3 className="page-card-title-sm">Restaurar Backup</h3>
              <p className="page-card-desc-sm">
                Carregue um arquivo JSON gerado anteriormente no app para restaurar ou mesclar.
              </p>
            </div>
            <button className="btn-ghost" onClick={() => restoreRef.current?.click()}>
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
              if (f) void handleRestoreFile(f);
              e.target.value = '';
            }}
          />
        </GlassCard>

        {/* ---------- Nuvem Supabase ---------- */}
        <GlassCard className="page-card">
          <div className="page-card-row">
            <div className="page-card-row-info">
              <h3 className="page-card-title-sm">Nuvem Supabase (PostgreSQL)</h3>
              <p className="page-card-desc-sm">
                Sincronize medições e fotos na nuvem para manter backup online e acessar de múltiplos aparelhos.
              </p>
            </div>
            <button className="btn-ghost" onClick={() => go({ name: 'sync' })}>
              <Cloud size={16} /> Abrir Nuvem
            </button>
          </div>
        </GlassCard>

        <div className="page-hint">
          <Info size={14} />
          <span>
            Dica: você tem proteção dupla — pode gerar arquivos JSON de backup localmente e também sincronizar com a nuvem Supabase.
          </span>
        </div>
      </div>

      {/* ---------- Modal de Confirmação e Modo de Restauração ---------- */}
      {pendingBackup && (
        <div className="modal-overlay" onClick={() => !restoreBusy && setPendingBackup(null)}>
          <div className="modal-panel glass modal-panel-scroll" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Restaurar Backup</h3>

            {/* Resumo do Arquivo */}
            <div className="restore-summary-box">
              <p className="restore-summary-head">
                <strong>Arquivo de Backup detectado:</strong>
              </p>
              <ul className="restore-summary-list">
                <li>
                  📅 Medições no arquivo: <strong>{pendingBackup.campaigns.length}</strong>
                </li>
                <li>
                  📊 Registros / Hidrômetros: <strong>{pendingBackup.records.length}</strong>
                </li>
                {pendingBackup.type && (
                  <li>
                    🏷️ Tipo do arquivo:{' '}
                    <strong>
                      {pendingBackup.type === 'indices'
                        ? 'Apenas Índices'
                        : pendingBackup.type === 'photos'
                        ? 'Apenas Fotos'
                        : 'Completo (Tudo)'}
                    </strong>
                  </li>
                )}
                <li>
                  🕒 Data de geração:{' '}
                  <strong>
                    {pendingBackup.exportedAt ? new Date(pendingBackup.exportedAt).toLocaleDateString('pt-BR') : '—'}
                  </strong>
                </li>
              </ul>
            </div>

            {/* 1. Tipo de Conteúdo a Restaurar */}
            <div className="restore-step-section">
              <label className="field-label">1. Conteúdo a Restaurar:</label>
              <div className="backup-type-grid">
                <button
                  type="button"
                  className={`backup-type-card ${restoreContentType === 'all' ? 'active' : ''}`}
                  onClick={() => setRestoreContentType('all')}
                  disabled={pendingBackup.type === 'indices'}
                >
                  <FileCheck size={18} className="backup-card-icon" />
                  <div className="backup-card-text">
                    <strong>Completo (Tudo)</strong>
                    <span>Fotos e índices presentes no arquivo</span>
                  </div>
                  {restoreContentType === 'all' && <Check size={16} className="backup-card-check" />}
                </button>

                <button
                  type="button"
                  className={`backup-type-card ${restoreContentType === 'indices' ? 'active' : ''}`}
                  onClick={() => setRestoreContentType('indices')}
                >
                  <FileSpreadsheet size={18} className="backup-card-icon" />
                  <div className="backup-card-text">
                    <strong>Apenas Índices</strong>
                    <span>Restaura/atualiza somente as leituras</span>
                  </div>
                  {restoreContentType === 'indices' && <Check size={16} className="backup-card-check" />}
                </button>

                <button
                  type="button"
                  className={`backup-type-card ${restoreContentType === 'photos' ? 'active' : ''}`}
                  onClick={() => setRestoreContentType('photos')}
                  disabled={pendingBackup.type === 'indices'}
                >
                  <Image size={18} className="backup-card-icon" />
                  <div className="backup-card-text">
                    <strong>Apenas Fotos</strong>
                    <span>Restaura/atualiza somente as fotos</span>
                  </div>
                  {restoreContentType === 'photos' && <Check size={16} className="backup-card-check" />}
                </button>
              </div>
            </div>

            {/* 2. Seleção de Períodos / Medições do Arquivo */}
            <div className="restore-step-section">
              <div className="page-card-header-row" style={{ marginBottom: 6 }}>
                <label className="field-label" style={{ margin: 0 }}>
                  2. Medições do Arquivo:
                </label>
                {pendingBackup.campaigns.length > 1 && (
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={activeRestoreIds.length === pendingBackup.campaigns.length ? selectNoneRestore : selectAllRestore}
                  >
                    {activeRestoreIds.length === pendingBackup.campaigns.length ? 'Desmarcar todos' : 'Marcar todos'}
                  </button>
                )}
              </div>

              {pendingBackup.campaigns.length === 0 ? (
                <p className="text-dim text-sm">Nenhuma medição encontrada no arquivo.</p>
              ) : (
                <div className="backup-campaign-list" style={{ maxHeight: 180 }}>
                  {pendingBackup.campaigns.map((c: Campaign) => {
                    if (!c.id) return null;
                    const selected = activeRestoreIds.includes(c.id);
                    const recordCount = pendingBackup.records.filter((r) => r.campaignId === c.id).length;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`backup-campaign-item ${selected ? 'selected' : ''}`}
                        onClick={() => toggleRestoreCampaign(c.id!)}
                      >
                        {selected ? <CheckSquare size={18} className="text-cyan" /> : <Square size={18} />}
                        <div className="backup-campaign-item-label">
                          <strong>{campaignLabel(c.name, c.month, c.year)}</strong>
                          <span className="backup-campaign-item-sub">
                            {recordCount} registros {c.leiturista ? `· Leiturista: ${c.leiturista}` : ''}
                          </span>
                        </div>
                        <Calendar size={15} className="backup-item-cal" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Modo de Restauração */}
            <div className="restore-step-section">
              <label className="field-label">3. Modo de Aplicação:</label>

              <div className="restore-mode-picker">
                <label className={`restore-mode-option ${restoreMode === 'replace' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="restoreMode"
                    value="replace"
                    checked={restoreMode === 'replace'}
                    onChange={() => setRestoreMode('replace')}
                  />
                  <div className="restore-mode-desc">
                    <strong>Substituir tudo</strong>
                    <span>Apaga os dados atuais do aparelho e coloca os períodos selecionados do arquivo.</span>
                  </div>
                </label>

                <label className={`restore-mode-option ${restoreMode === 'merge' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="restoreMode"
                    value="merge"
                    checked={restoreMode === 'merge'}
                    onChange={() => setRestoreMode('merge')}
                  />
                  <div className="restore-mode-desc">
                    <strong>Mesclar / Adicionar</strong>
                    <span>Mantém suas medições locais e adiciona/atualiza registros a partir do arquivo.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button
                className="btn-ghost"
                onClick={() => setPendingBackup(null)}
                disabled={restoreBusy}
              >
                Cancelar
              </button>
              <button
                className={`btn-primary ${restoreMode === 'replace' ? 'btn-danger' : ''}`}
                onClick={() => void confirmRestore()}
                disabled={restoreBusy || (pendingBackup.campaigns.length > 0 && activeRestoreIds.length === 0)}
              >
                {restoreBusy ? <RefreshCw size={16} className="spin" /> : <Upload size={16} />}
                {restoreBusy
                  ? 'Restaurando…'
                  : restoreMode === 'replace'
                  ? `Substituir (${activeRestoreIds.length} ${activeRestoreIds.length === 1 ? 'mês' : 'meses'})`
                  : `Mesclar (${activeRestoreIds.length} ${activeRestoreIds.length === 1 ? 'mês' : 'meses'})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
