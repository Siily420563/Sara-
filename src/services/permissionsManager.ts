/**
 * Permissions Manager Service
 * Detects, queries, and requests all browser & device permissions needed by SARA:
 * - Microphone (Audio)
 * - Camera (Video)
 * - Geolocation (Location)
 * - Notifications
 * - Contacts (Phone Contacts via Contact Picker API)
 * - Persistent Storage (Storage API)
 */

export type PermissionKey = 'microphone' | 'camera' | 'geolocation' | 'notifications' | 'contacts' | 'storage';

export type PermissionStatusState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'checking';

export interface AppPermissionInfo {
  key: PermissionKey;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  icon: string;
  status: PermissionStatusState;
  details?: string;
}

export async function checkPermissionStatus(key: PermissionKey): Promise<PermissionStatusState> {
  if (typeof window === 'undefined') return 'unsupported';

  try {
    switch (key) {
      case 'microphone': {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'unsupported';
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const res = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            return res.state;
          } catch {
            // Some browsers don't support querying microphone directly
          }
        }
        return 'prompt';
      }

      case 'camera': {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'unsupported';
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const res = await navigator.permissions.query({ name: 'camera' as PermissionName });
            return res.state;
          } catch {
            // Some browsers don't support querying camera directly
          }
        }
        return 'prompt';
      }

      case 'geolocation': {
        if (!navigator.geolocation) return 'unsupported';
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            return res.state;
          } catch {
            // query failed
          }
        }
        return 'prompt';
      }

      case 'notifications': {
        if (!('Notification' in window)) return 'unsupported';
        if (Notification.permission === 'granted') return 'granted';
        if (Notification.permission === 'denied') return 'denied';
        return 'prompt';
      }

      case 'contacts': {
        const isSupported = typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
        if (!isSupported) return 'unsupported';
        
        // In Web Contacts API, permission is tied to user invoking the contact picker
        // Check if user has previously synced contacts in localStorage
        try {
          const raw = localStorage.getItem('sara_companion_state');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.contacts && parsed.contacts.length > 0) {
              return 'granted';
            }
          }
        } catch {
          // ignore
        }
        return 'prompt';
      }

      case 'storage': {
        if (navigator.storage && navigator.storage.persisted) {
          const isPersisted = await navigator.storage.persisted();
          return isPersisted ? 'granted' : 'prompt';
        }
        return 'prompt';
      }

      default:
        return 'prompt';
    }
  } catch (err) {
    console.warn(`Error checking permission ${key}:`, err);
    return 'prompt';
  }
}

export async function checkAllPermissions(): Promise<Record<PermissionKey, PermissionStatusState>> {
  const keys: PermissionKey[] = ['microphone', 'camera', 'geolocation', 'notifications', 'contacts', 'storage'];
  const results: Record<PermissionKey, PermissionStatusState> = {
    microphone: 'prompt',
    camera: 'prompt',
    geolocation: 'prompt',
    notifications: 'prompt',
    contacts: 'prompt',
    storage: 'prompt'
  };

  await Promise.all(
    keys.map(async (k) => {
      results[k] = await checkPermissionStatus(k);
    })
  );

  return results;
}
