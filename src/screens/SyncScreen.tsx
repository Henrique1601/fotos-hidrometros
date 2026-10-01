import { useEffect, useState } from 'react';
import { ArrowLeft, Cloud, CloudOff, Info, LogIn, LogOut, UserPlus } from 'lucide-react';
import { isSupabaseConfigured, getSession, signIn, signUp, signOut, syncAll } from '../lib/sync';
import GlassCard from '../components/GlassCard';
import { Screen } from '../nav';

interface Props {
  go: (s: Screen) => void;
  toast: (m: string) => void;
}

export default function SyncScreen({ go, toast }: Props) {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  useEffect(() => {
    void getSession().then(setSession);
  }, []);

  const handleAuth = async () => {
    if (!email || !password || syncBusy) return;
    setSyncBusy(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
        toast('Conta criada com sucesso! Conectando...');
        try {
          await signIn(email.trim(), password);
          setSession(await getSession());
        } catch {
          // Caso precise de confirmação
        }
      } else {
        await signIn(email.trim(), password);
        setPassword('');
        setSession(await getSession());
        toast('Conectado à nuvem Supabase!');
      }
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
      toast(`Sincronizado com a nuvem: ${s.campaigns} medições, ${s.records} registros.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSyncBusy(false);
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
              <button className="btn-primary btn-full" onClick={() => void handleSync()} disabled={syncBusy}>
                <Cloud size={16} /> {syncBusy ? 'Sincronizando…' : 'Sincronizar agora'}
              </button>
              <button className="btn-ghost btn-full" onClick={() => void handleLogout()}>
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
              <label className="field-label">Senha</label>
              <input
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="text-input"
              />
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
    </div>
  );
}
