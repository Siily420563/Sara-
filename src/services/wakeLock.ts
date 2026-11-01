/**
 * Screen Wake Lock API Service
 * Prevents screen from dimming or locking during active voice calls, video sessions, or assistant tasks.
 */

class ScreenWakeLockManager {
  private wakeLockSentinel: any = null;
  private isRequested: boolean = false;
  private listenersAttached: boolean = false;

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  public async acquire(source: string = 'app'): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    this.isRequested = true;

    try {
      if (this.wakeLockSentinel && !this.wakeLockSentinel.released) {
        return true;
      }

      this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });

      if (!this.listenersAttached && typeof document !== 'undefined') {
        this.listenersAttached = true;
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
      }

      return true;
    } catch (err: any) {
      console.warn(`Screen wake lock acquisition failed for [${source}]:`, err?.message || err);
      return false;
    }
  }

  public async release(source: string = 'app'): Promise<void> {
    this.isRequested = false;

    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch (err) {
        // ignore
      }
      this.wakeLockSentinel = null;
    }
  }

  public isActive(): boolean {
    return !!(this.wakeLockSentinel && !this.wakeLockSentinel.released);
  }

  private handleVisibilityChange = async () => {
    if (this.isRequested && document.visibilityState === 'visible') {
      try {
        await this.acquire('visibility_restore');
      } catch (e) {
        // ignore
      }
    }
  };
}

export const wakeLockService = new ScreenWakeLockManager();
