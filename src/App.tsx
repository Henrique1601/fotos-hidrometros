import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { WifiOff } from 'lucide-react';
import Background from './components/Background';
import ErrorBoundary from './components/ErrorBoundary';
import { Screen } from './nav';

const Home = lazy(() => import('./screens/Home'));
const NewCampaign = lazy(() => import('./screens/NewCampaign'));
const Collect = lazy(() => import('./screens/Collect'));
const Indices = lazy(() => import('./screens/Indices'));
const Export = lazy(() => import('./screens/Export'));
const DataScreen = lazy(() => import('./screens/DataScreen'));
const SyncScreen = lazy(() => import('./screens/SyncScreen'));
const HistoryScreen = lazy(() => import('./screens/HistoryScreen'));
const ConsumptionScreen = lazy(() => import('./screens/ConsumptionScreen'));

function ScreenLoader() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
      <div className="chip" style={{ opacity: 0.5 }}>Carregando…</div>
    </div>
  );
}

export type NotifyFn = (msg: string, duration?: number) => void;

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const notify = useCallback((msg: string, duration = 2600) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), duration);
  }, []);

  const go = useCallback((s: Screen) => {
    setScreen(s);
    window.scrollTo({ top: 0 });
  }, []);

  useRegisterSW({
    onNeedRefresh() {
      setNeedRefresh(true);
    },
  });

  const updateSW = useCallback(() => {
    if (!('serviceWorker' in navigator)) {
      window.location.reload();
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg?.waiting) {
        window.location.reload();
        return;
      }
      const onControllerChange = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    setNeedRefresh(false);
  }, []);

  return (
    <div className="app">
      <Background />
      {!online && (
        <div className="offline-bar">
          <WifiOff size={14} /> Offline
        </div>
      )}
      <main className={screen.name === 'home' ? 'app-main app-main--wide' : 'app-main'}>
        <ErrorBoundary>
          <Suspense fallback={<ScreenLoader />}>
            <ScreenSwitch screen={screen} go={go} toast={notify} />
          </Suspense>
        </ErrorBoundary>
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {needRefresh && (
        <div className="toast toast-action" role="alert">
          <span>Nova versão disponível.</span>
          <button onClick={updateSW}>Atualizar</button>
        </div>
      )}
    </div>
  );
}

interface ScreenSwitchProps {
  screen: Screen;
  go: (s: Screen) => void;
  toast: NotifyFn;
}

function ScreenSwitch({ screen, go, toast }: ScreenSwitchProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
    );
  }, [screen]);

  return (
    <div ref={rootRef}>
      {screen.name === 'home' && <Home go={go} toast={toast} />}
      {screen.name === 'new-campaign' && <NewCampaign go={go} toast={toast} />}
      {screen.name === 'collect' && (
        <Collect
          campaignId={screen.campaignId}
          towerId={screen.towerId}
          go={go}
          toast={toast}
        />
      )}
      {screen.name === 'indices' && <Indices campaignId={screen.campaignId} go={go} toast={toast} />}
      {screen.name === 'export' && <Export campaignId={screen.campaignId} go={go} toast={toast} />}
      {screen.name === 'data' && <DataScreen go={go} toast={toast} />}
      {screen.name === 'sync' && <SyncScreen go={go} toast={toast} />}
      {screen.name === 'history' && <HistoryScreen towerId={screen.towerId} aptCode={screen.aptCode} go={go} toast={toast} />}
      {screen.name === 'consumption' && <ConsumptionScreen campaignId={screen.campaignId} go={go} toast={toast} />}
    </div>
  );
}
