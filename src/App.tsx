import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useRegisterSW } from 'virtual:pwa-register/react';
import Background from './components/Background';
import Home from './screens/Home';
import NewCampaign from './screens/NewCampaign';
import Collect from './screens/Collect';
import Indices from './screens/Indices';
import Export from './screens/Export';
import { Screen } from './nav';

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [needRefresh, setNeedRefresh] = useState(false);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
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
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      });
    }
    setNeedRefresh(false);
    window.location.reload();
  }, []);

  return (
    <div className="app">
      <Background />
      <main className={screen.name === 'home' ? 'app-main app-main--wide' : 'app-main'}>
        <ScreenSwitch screen={screen} go={go} toast={notify} />
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
  toast: (m: string) => void;
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
    </div>
  );
}
