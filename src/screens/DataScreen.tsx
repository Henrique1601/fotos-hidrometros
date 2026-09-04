import { useRef, useState } from 'react';
import { ArrowLeft, Database, Download, HardDrive, Info, Loader2, Upload } from 'lucide-react';
import { generateBackupBlob, restoreBackup } from '../lib/backup';
import GlassCard from '../components/GlassCard';
import ConfirmModal from '../components/ConfirmModal';
import { Screen } from '../nav';

interface Props {
  go: (s: Screen) => void;
  toast: (m: string) => void;
}

export default function DataScreen({ go, toast }: Props) {
  const restoreRef = useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<unknown>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupProgress, setBackupProgress] = useState<{ done: number; total: number } | null>(null);
  const [loadingJuly, setLoadingJuly] = useState(false);

  const handleBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupProgress(null);
    try {
      const { blob, fileName } = await generateBackupBlob((done, total) => {
        setBackupProgress({ done, total });
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
    const text = await f.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      toast('Arquivo de backup inválido.');
      return;
    }
    setPendingData(data);
    setConfirmOpen(true);
  };

  const confirmRestore = async () => {
    if (!pendingData) return;
    try {
      const r = await restoreBackup(pendingData);
      toast(`Backup restaurado: ${r.campaigns} medições, ${r.records} registros.`);
    } catch (e) {
      toast((e as Error).message);
    }
    setPendingData(null);
    setConfirmOpen(false);
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
          <span className="header-sub">Backup e restauração</span>
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
            Todos os dados (fotos e índices) ficam apenas neste dispositivo. Faça backups periódicos
            para não perder nada.
          </p>
        </GlassCard>

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

        <GlassCard className="page-card">
          <div className="page-card-row">
            <div className="page-card-row-info">
              <h3 className="page-card-title-sm">Backup</h3>
              <p className="page-card-desc-sm">
                Baixa um arquivo JSON com todas as campanhas, registros e fotos.
              </p>
            </div>
            <button className="btn-primary" onClick={() => void handleBackup()} disabled={backupBusy}>
              {backupBusy ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
              {backupBusy
                ? backupProgress
                  ? `Gerando (${backupProgress.done}/${backupProgress.total})`
                  : 'Gerando…'
                : 'Baixar'}
            </button>
          </div>
        </GlassCard>

        <GlassCard className="page-card">
          <div className="page-card-row">
            <div className="page-card-row-info">
              <h3 className="page-card-title-sm">Restaurar</h3>
              <p className="page-card-desc-sm">
                Substitui todos os dados atuais pelos do arquivo de backup.
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

        <div className="page-hint">
          <Info size={14} />
          <span>Dica: faça backup antes de atualizar o app ou trocar de aparelho.</span>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Restaurar backup?"
        message="Substitui TODOS os dados atuais (medições e fotos). Continuar?"
        danger
        confirmLabel="Restaurar"
        onConfirm={() => void confirmRestore()}
        onCancel={() => { setConfirmOpen(false); setPendingData(null); }}
      />
    </div>
  );
}
