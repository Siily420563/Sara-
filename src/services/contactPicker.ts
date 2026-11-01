/**
 * Contact Picker Service for PWA
 * Interacts with modern navigator.contacts API (supported in Chrome/Edge on Android and standalone PWAs)
 */

export interface PickedContact {
  name: string;
  phone: string;
  email?: string;
}

export function isContactPickerSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    'ContactsManager' in window &&
    typeof (navigator as any).contacts?.select === 'function'
  );
}

export async function requestDeviceContacts(): Promise<{
  success: boolean;
  contacts: PickedContact[];
  error?: string;
}> {
  if (!isContactPickerSupported()) {
    return {
      success: false,
      contacts: [],
      error: 'Contact Picker API is not supported on this browser or platform. Please use manual contact entry.'
    };
  }

  try {
    const props = ['name', 'tel', 'email'];
    const opts = { multiple: true };
    const rawContacts = await (navigator as any).contacts.select(props, opts);

    if (!rawContacts || !Array.isArray(rawContacts) || rawContacts.length === 0) {
      return { success: true, contacts: [] };
    }

    const formatted: PickedContact[] = rawContacts
      .map((c: any) => {
        const name = (c.name && c.name[0]) ? String(c.name[0]).trim() : 'Unknown';
        const rawPhone = (c.tel && c.tel[0]) ? String(c.tel[0]).trim() : '';
        const phone = rawPhone.replace(/[^\d+]/g, '');
        const email = (c.email && c.email[0]) ? String(c.email[0]).trim() : undefined;
        return { name, phone, email };
      })
      .filter((c: PickedContact) => c.phone || c.name !== 'Unknown');

    return { success: true, contacts: formatted };
  } catch (err: any) {
    // User cancelled or permission denied
    if (err.name === 'SecurityError' || err.name === 'AbortError') {
      return { success: false, contacts: [], error: 'Contact selection was cancelled.' };
    }
    console.warn('Contact picker error:', err);
    return {
      success: false,
      contacts: [],
      error: err?.message || 'Failed to access device contacts.'
    };
  }
}
