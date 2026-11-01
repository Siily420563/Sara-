/**
 * Persistent Storage API Service
 * Ensures browser avoids evicting SARA's long-term memory, chat logs, and cached assets.
 */

export interface StorageStatus {
  isPersistent: boolean;
  supported: boolean;
  quotaUsedBytes: number;
  quotaTotalBytes: number;
  usagePercentage: number;
}

export async function checkStorageStatus(): Promise<StorageStatus> {
  const result: StorageStatus = {
    isPersistent: false,
    supported: false,
    quotaUsedBytes: 0,
    quotaTotalBytes: 0,
    usagePercentage: 0,
  };

  if (typeof navigator === 'undefined' || !navigator.storage) {
    return result;
  }

  result.supported = true;

  try {
    if (navigator.storage.persisted) {
      result.isPersistent = await navigator.storage.persisted();
    }

    if (navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      result.quotaUsedBytes = estimate.usage || 0;
      result.quotaTotalBytes = estimate.quota || 0;
      if (result.quotaTotalBytes > 0) {
        result.usagePercentage = Math.round((result.quotaUsedBytes / result.quotaTotalBytes) * 100);
      }
    }
  } catch (err) {
    console.warn('Error querying storage persistence estimate:', err);
  }

  return result;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return false;
  }

  try {
    const isAlreadyPersistent = await navigator.storage.persisted();
    if (isAlreadyPersistent) {
      return true;
    }

    const granted = await navigator.storage.persist();
    return granted;
  } catch (err) {
    console.warn('Persistent storage request failed:', err);
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
