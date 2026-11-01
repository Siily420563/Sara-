/**
 * User Room Service
 * Manages unique, client-isolated room identity without adding any UI clutter.
 * Automatically generates and persists a unique userId/roomId per client device.
 */

const STORAGE_KEY = 'sara_user_room_id';

export function getUserId(): string {
  if (typeof window === 'undefined') {
    return 'default_client';
  }

  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id || id.trim().length === 0) {
      // Generate a collision-resistant unique room ID
      const randomPart = Math.random().toString(36).substring(2, 10);
      const timePart = Date.now().toString(36);
      id = `usr_${randomPart}_${timePart}`;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch (e) {
    // Fallback if localStorage is restricted
    return 'usr_session_' + Date.now().toString(36);
  }
}

export function sanitizeUserId(userId?: string | null): string {
  if (!userId || typeof userId !== 'string') return 'anonymous_default';
  const sanitized = userId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return sanitized.slice(0, 64) || 'anonymous_default';
}
