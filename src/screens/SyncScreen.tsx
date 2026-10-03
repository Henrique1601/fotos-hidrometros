import { useEffect, useState } from 'react';
import { ArrowLeft, Cloud, CloudOff, Download, Eye, EyeOff, Info, Loader2, LogIn, LogOut, RefreshCw, UserPlus } from 'lucide-react';
import { isSupabaseConfigured, getSession, signIn, signUp, signOut, syncAll, resetPassword, downloadCloudBackup, pullAll } from '../lib/sync';
import GlassCard from '../components/GlassCard';
import ConfirmModal from '../components/ConfirmModal';
import { Screen } from '../nav';

interface Props {
  go: (s: Screen) => void;
  toast: (m: string) => void;
}

export default function SyncScreen({ go, toast }: Props) {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadCount, setDownloadCount] = useState<number | null>(null);
  const [pullBusy, setPullBusy] = useState(false);
  const [pullModalOpen, setPullModalOpen] = useState(false);

  useEffect(() => {
    void getSession().then(setSession);
  }, []);

  const handleAuth = async () => {
    if (!email || !password || syncBusy) return;
    setSyncBusy(true);
    try {
      if (isSignUp) {
        if (password.length < 6) {
          toast('A senha deve ter no mínimo 6 caracteres.');
          return;
        }
        const { isNewUser, needsEmailConfirmation } = await signUp(email.trim(), password);
        if (!isNewUser) {
          toast('Este e-mail já está cadastrado. Alterne para "Já tenho conta" para entrar.');
          setIsSignUp(false);
          return;
        }
        if (needsEmailConfirmation) {
          toast('Conta criada! Verifique o link de confirmação no seu e-mail para ativar o acesso.');
          setIsSignUp(false);
          return;
        }
        const newSession = await signIn(email.trim(), password);
        setSession(newSession);
        setPassword('');
        toast('Conta criada e conectada com sucesso à nuvem!');
      } else {
        const currentSession = await signIn(email.trim(), password);
        setPassword('');
        setSession(currentSession);
        toast('Conectado à nuvem Supabase!');
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast('Digite seu e-mail no campo acima para recuperar a senha.');
      return;
    }
    try {
      await resetPassword(email.trim());
      toast('Link de redefinição de senha enviado para seu e-mail.');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setSession(null);
    toast('Sessão encerrada.');
  };

  const [syncProgress, setSyncProgress] = useState<{ stage: 'push' | 'pull'; done: number; total: number } | null>(null);

  const handleSync = async () => {
    if (syncBusy || !session) return;
    setSyncBusy(true);
    setSyncProgress(null);
    try {
      const s = await syncAll((p) => {
        setSyncProgress(p);
      });
      toast(`Sincronizado com a nuvem: ${s.campaigns} medições, ${s.records} registros.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSyncBusy(false);
      setSyncProgress(null);
    }
  };

  const handleDownloadCloud = async () => {
    if (downloadBusy || !session) return;
    setDownloadBusy(true);
    setDownloadCount(null);
    try {
      const res = await downloadCloudBackup((done) => {
        setDownloadCount(done);
      });
      toast(`Backup da nuvem baixado com sucesso: ${res.campaigns} medições, ${res.records} registros salvos!`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setDownloadBusy(false);
      setDownloadCount(null);
    }
  };

  const handlePullCloud = async () => {
    if (pullBusy || !session) return;
    setPullBusy(true);
    try {
      const s = await pullAll();
      toast(`Dados baixados da nuvem: ${s.campaigns} medições e ${s.records} registros atualizados neste aparelho.`);
      setPullModalOpen(false);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setPullBusy(false);
    }
  };

  const configured = isSupabaseConfigured();

  return (
    <div>
      <header className="app-header">
        <button className="icon-btn glass" onClick={() => go({ name: 'home' })} aria-label="Voltar">
          <ArrowLeft size={22} />
        </button>
        <div className="header-center">
          <h2 className="header-title">Sincronização</h2>
          <span className="header-sub">Nuvem Supabase</span>
        </div>
        <div className="header-spacer" />
      </header>

      <div className="page-stack">
        <GlassCard className="page-card">
          <div className="page-card-icon">
            <Cloud size={24} />
          </div>
          <h3 className="page-card-title">Sincronize seus dados na Nuvem</h3>
          <p className="page-card-desc">
            Mantenha suas medições salvas na nuvem com PostgreSQL. Se trocar de celular ou acessar do computador,
            seus dados e fotos estarão protegidos.
          </p>
        </GlassCard>

        {!configured ? (
          <GlassCard className="page-card">
            <div className="page-card-icon warn">
              <CloudOff size={24} />
            </div>
            <h3 className="page-card-title-sm">Não configurado</h3>
            <p className="page-card-desc-sm">
              A sincronização não está configurada neste aparelho. Use o Backup para guardar os dados
              localmente.
            </p>
          </GlassCard>
        ) : session ? (
          <GlassCard className="page-card">
            <div className="sync-status">
              <div className="sync-status-dot online" />
              <span className="sync-status-email">{session.user.email}</span>
            </div>
            <div className="page-card-actions">
              <button
                className="btn-primary btn-full"
                onClick={() => void handleSync()}
                disabled={syncBusy || downloadBusy || pullBusy}
              >
                <Cloud size={16} />
                {syncBusy
                  ? syncProgress
                    ? syncProgress.stage === 'push'
                      ? `Enviando fotos (${syncProgress.done}/${syncProgress.total})…`
                      : `Baixando dados (${syncProgress.done})…`
                    : 'Sincronizando…'
                  : 'Sincronizar agora'}
              </button>

              <button
                className="btn-ghost btn-full"
                onClick={() => void handleDownloadCloud()}
                disabled={syncBusy || downloadBusy || pullBusy}
              >
                {downloadBusy ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                {downloadBusy
                  ? downloadCount !== null
                    ? `Baixando da nuvem (${downloadCount} hidrômetros)…`
                    : 'Baixando backup da nuvem…'
                  : 'Baixar Backup da Nuvem (.json)'}
              </button>

              <button
                className="btn-ghost btn-full"
                onClick={() => setPullModalOpen(true)}
                disabled={syncBusy || downloadBusy || pullBusy}
              >
                {pullBusy ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                {pullBusy ? 'Restaurando…' : 'Restaurar Nuvem para este Aparelho'}
              </button>

              <button
                className="btn-ghost btn-full"
                onClick={() => void handleLogout()}
                disabled={syncBusy || downloadBusy || pullBusy}
              >
                <LogOut size={16} /> Sair da conta
              </button>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="page-card">
            <div className="page-card-header-row" style={{ marginBottom: 8 }}>
              <h3 className="page-card-title-sm">{isSignUp ? 'Criar Nova Conta' : 'Acessar Conta'}</h3>
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? 'Já tenho conta (Entrar)' : 'Criar nova conta'}
              </button>
            </div>

            <div className="sync-form">
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label className="field-label" style={{ margin: 0 }}>Senha</label>
                {!isSignUp && (
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    style={{ fontSize: '0.72rem', border: 'none', padding: '2px 0' }}
                    onClick={() => void handleResetPassword()}
                  >
                    Esqueci a senha
                  </button>
                )}
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? 'Mínimo 6 caracteres' : '••••••••'}
                  className="text-input"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  className="icon-btn"
                  style={{ position: 'absolute', right: 4, width: 32, height: 32, opacity: 0.7 }}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button
                className="btn-primary btn-full"
                disabled={syncBusy || !email || !password}
                onClick={() => void handleAuth()}
              >
                {isSignUp ? <UserPlus size={16} /> : <LogIn size={16} />}
                {syncBusy
                  ? isSignUp
                    ? 'Cadastrando…'
                    : 'Entrando…'
                  : isSignUp
                  ? 'Criar Conta e Sincronizar'
                  : 'Entrar e Sincronizar'}
              </button>
            </div>
          </GlassCard>
        )}

        <div className="page-hint">
          <Info size={14} />
          <span>
            A nuvem Supabase trabalha em conjunto com o Backup JSON local: você tem segurança dupla tanto em arquivo
            quanto online.
          </span>
        </div>
      </div>

      <ConfirmModal
        open={pullModalOpen}
        title="Restaurar dados da Nuvem?"
        message="Deseja baixar todas as medições e fotos salvas na nuvem Supabase e atualizar este aparelho? Os dados locais mais antigos serão atualizados com os dados da nuvem."
        confirmLabel={pullBusy ? 'Restaurando…' : 'Restaurar da Nuvem'}
        onConfirm={() => void handlePullCloud()}
        onCancel={() => setPullModalOpen(false)}
      />
    </div>
  );
}
