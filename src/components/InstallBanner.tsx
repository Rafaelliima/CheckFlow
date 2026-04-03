import { useEffect, useState } from 'react';

const DISMISS_KEY = 'checkflow_install_banner_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setHidden(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden || !deferredPrompt) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  const install = async () => {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setHidden(true);
      setDeferredPrompt(null);
      return;
    }
    dismiss();
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-100">Instale o CheckFlow</p>
          <p className="text-xs text-slate-400">Acesso rápido e experiência offline no seu dispositivo.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={install}
            className="rounded-md bg-cyan-900/70 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}
