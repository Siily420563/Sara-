/**
 * PWA Installation & Background Sync Service
 * Manages native app installation prompts, periodic background sync, and service worker events.
 */

let deferredInstallPrompt: any = null;
let installChangeListeners: Array<(canInstall: boolean) => void> = [];

export function hasDeferredInstallPrompt(): boolean {
  return !!deferredInstallPrompt;
}

export function initPwaListeners() {
  if (typeof window === 'undefined') return;

  // Capture beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installChangeListeners.forEach(listener => listener(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installChangeListeners.forEach(listener => listener(false));
  });
}

export function subscribeToInstallPrompt(callback: (canInstall: boolean) => void): () => void {
  installChangeListeners.push(callback);
  callback(!!deferredInstallPrompt);
  return () => {
    installChangeListeners = installChangeListeners.filter(l => l !== callback);
  };
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    return false;
  }

  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installChangeListeners.forEach(listener => listener(false));
    return outcome === 'accepted';
  } catch (err) {
    console.warn('PWA install prompt error:', err);
    return false;
  }
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Registers Periodic Background Sync (for Chrome/Edge/Android PWAs)
 */
export async function registerPeriodicBackgroundSync(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('periodicSync' in registration) {
      const periodicSync = (registration as any).periodicSync;
      const tags = await periodicSync.getTags();
      if (!tags.includes('sara-daily-sync')) {
        await periodicSync.register('sara-daily-sync', {
          minInterval: 12 * 60 * 60 * 1000, // 12 hours minimum interval
        });
      }
      return true;
    }
  } catch (err) {
    console.log('Periodic Background Sync registration note (expected in non-installed PWA or standard tabs):', err);
  }
  return false;
}

/**
 * Triggers One-off Background Sync
 */
export async function registerOneOffSync(tag: string = 'sara-sync-reminders'): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as any).sync.register(tag);
      return true;
    }
  } catch (err) {
    console.log('Background Sync register note:', err);
  }
  return false;
}
