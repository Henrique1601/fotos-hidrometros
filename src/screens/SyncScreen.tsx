import { useEffect, useState } from 'react';
import { ArrowLeft, Cloud, CloudOff, Info, LogOut } from 'lucide-react';
import { isSupabaseConfigured, getSession, signIn, signOut, syncAll } from '../lib/sync';
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
  const [syncBusy, setSyncBusy] = useState(false);

  useEffect(() => {
    void getSession().then(setSession);
  }, []);

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
          <h3 className="page-card-title">Sincronize seus dados</h3>
          <p className="page-card-desc">
            Mantenha suas medições seguras na nuvem. Os dados são criptografados e associados à sua conta.
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
                <LogOut size={16} /> Sair
              </button>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="page-card">
            <h3 className="page-card-title-sm">Entrar</h3>
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="text-input"
              />
              <button
                className="btn-primary btn-full"
                disabled={syncBusy || !email || !password}
                onClick={() => void handleLogin()}
              >
                <Cloud size={16} /> {syncBusy ? 'Entrando…' : 'Entrar e sincronizar'}
              </button>
            </div>
          </GlassCard>
        )}

        <div className="page-hint">
          <Info size={14} />
          <span>A sincronização envia seus dados para o Supabase e permite restaurar em outro aparelho.</span>
        </div>
      </div>
    </div>
  );
}
