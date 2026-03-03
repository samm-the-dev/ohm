import { useState, useEffect, useRef, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [isInstallable, setIsInstallable] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already running as installed PWA -- nothing to offer
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const onInstalled = () => {
      deferredPrompt.current = null;
      setIsInstallable(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // prompt() is single-use — clear the ref and hide the button.
    // A future beforeinstallprompt event will re-enable it if the browser offers again.
    deferredPrompt.current = null;
    setIsInstallable(false);
  }, []);

  return { isInstallable, installApp } as const;
}
