import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    listeners.forEach((fn) => fn());
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    listeners.forEach((fn) => fn());
  });
}

const DISMISS_KEY = 'foto-hidro:pwa-dismissed';

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(() => globalDeferredPrompt);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );

  const isIos = typeof window !== 'undefined' && /iphone|ipad|ipod/.test(
    window.navigator.userAgent.toLowerCase(),
  );

  useEffect(() => {
    const handler = () => {
      setPromptEvent(globalDeferredPrompt);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // ignore
    }
  }, []);

  const triggerInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    if (globalDeferredPrompt) {
      const prompt = globalDeferredPrompt;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      globalDeferredPrompt = null;
      setPromptEvent(null);
      return choice.outcome;
    }
    return 'manual';
  }, []);

  const canInstall = !isStandalone && !isDismissed && (!!promptEvent || isIos);

  return {
    canInstall,
    isStandalone,
    isIos,
    hasPrompt: !!promptEvent,
    triggerInstall,
    dismiss,
  };
}
