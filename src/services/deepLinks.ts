/**
 * SARA AI - Deep Link & App Automation Engine
 * Supports seamless direct app opening, pre-written drafts, and browser fallbacks for:
 * - WhatsApp (App intent, wa.me, api.whatsapp.com, web.whatsapp.com)
 * - YouTube (YouTube app intent, mobile/desktop web search, YouTube Music)
 * - Phone Dialer (tel: protocol)
 * - SMS (sms: protocol with pre-filled body)
 * - Web navigation & Tab management
 */

export interface DeepLinkResult {
  opened: boolean;
  appUrl?: string;
  webUrl: string;
  fallbackUrl?: string;
  type: 'whatsapp' | 'telegram' | 'youtube' | 'phone' | 'sms' | 'web';
}

/**
 * Strips non-digit characters from phone numbers and handles Indian standard 10-digit format
 */
export function formatPhoneNumberForDeepLink(rawPhone?: string): { clean: string; intl: string } {
  if (!rawPhone) return { clean: '', intl: '' };
  const digitsOnly = String(rawPhone).replace(/[^0-9]/g, '');
  if (!digitsOnly) return { clean: '', intl: '' };

  // If 10 digits, default to Indian country code 91
  let intl = digitsOnly;
  if (digitsOnly.length === 10) {
    intl = '91' + digitsOnly;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    intl = '91' + digitsOnly.slice(1);
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    intl = digitsOnly;
  }

  return { clean: digitsOnly, intl };
}

/**
 * Builds WhatsApp deep links and fallbacks
 */
export function getWhatsAppLinks(phone?: string, message?: string): {
  appUrl: string;
  waMeUrl: string;
  apiUrl: string;
  webUrl: string;
} {
  const { intl } = formatPhoneNumberForDeepLink(phone);
  const msgEncoded = encodeURIComponent((message || '').trim());

  const appUrl = intl 
    ? `whatsapp://send?phone=${intl}&text=${msgEncoded}`
    : `whatsapp://send?text=${msgEncoded}`;

  // Universal HTTPS link that works 100% reliably on Android & iOS without blank tab errors or web QR redirects
  const waMeUrl = intl
    ? `https://wa.me/${intl}?text=${msgEncoded}`
    : `https://wa.me/?text=${msgEncoded}`;

  // Use wa.me as the API URL as well (api.whatsapp.com is deprecated and redirects to desktop web QR code on mobile)
  const apiUrl = waMeUrl;

  const webUrl = waMeUrl;

  return { appUrl, waMeUrl, apiUrl, webUrl };
}

/**
 * Builds Telegram deep links, universal web links, and pre-filled draft sharing
 */
export function getTelegramLinks(options?: {
  phone?: string;
  phoneNumber?: string;
  username?: string;
  message?: string;
}): {
  appUrl: string;
  webUrl: string;
  shareUrl: string;
  directUrl: string;
} {
  const targetPhone = options?.phoneNumber || options?.phone;
  const { intl } = formatPhoneNumberForDeepLink(targetPhone);
  const rawUser = (options?.username || '').replace(/^@/, '').trim();
  const message = (options?.message || '').trim();
  const msgEncoded = encodeURIComponent(message);

  let appUrl = '';
  let webUrl = '';
  let directUrl = '';
  const shareUrl = msgEncoded ? `https://t.me/share/url?url=&text=${msgEncoded}` : 'https://t.me';

  if (rawUser) {
    // Direct chat by Telegram Username with text parameter
    appUrl = msgEncoded 
      ? `tg://resolve?domain=${encodeURIComponent(rawUser)}&text=${msgEncoded}`
      : `tg://resolve?domain=${encodeURIComponent(rawUser)}`;
    webUrl = msgEncoded 
      ? `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${rawUser}`)}&text=${msgEncoded}` 
      : `https://t.me/${encodeURIComponent(rawUser)}`;
    directUrl = `https://t.me/${encodeURIComponent(rawUser)}`;
  } else if (intl) {
    // Direct chat by Phone Number via Telegram native protocol with text parameter
    appUrl = msgEncoded 
      ? `tg://resolve?phone=${intl}&text=${msgEncoded}`
      : `tg://resolve?phone=${intl}`;
    webUrl = msgEncoded 
      ? `https://t.me/share/url?url=&text=${msgEncoded}` 
      : `https://t.me/+${intl}`;
    directUrl = `https://t.me/+${intl}`;
  } else {
    // Pre-filled draft message / general Telegram share
    appUrl = msgEncoded ? `tg://msg_url?url=&text=${msgEncoded}` : `tg://resolve?domain=telegram`;
    webUrl = msgEncoded ? `https://t.me/share/url?url=&text=${msgEncoded}` : `https://web.telegram.org`;
    directUrl = webUrl;
  }

  // If a message draft exists, prioritize the app scheme that pre-fills the message
  if (msgEncoded && !rawUser && !intl) {
    appUrl = `tg://msg_url?url=&text=${msgEncoded}`;
  }

  return { appUrl, webUrl, shareUrl, directUrl };
}

/**
 * Builds YouTube deep links and web URLs
 */
export function getYouTubeLinks(query: string): {
  appUrl: string;
  webUrl: string;
  musicUrl: string;
} {
  const q = (query || '').trim();
  const encoded = encodeURIComponent(q);

  return {
    appUrl: `vnd.youtube://results?search_query=${encoded}`,
    webUrl: `https://www.youtube.com/results?search_query=${encoded}`,
    musicUrl: `https://music.youtube.com/search?q=${encoded}`
  };
}

/**
 * Robustly executes an external deep link or app launch.
 * Handles iframe restrictions, mobile PWA browser constraints, and popup blockers.
 */
export function executeDeepLink(
  primaryUrl: string,
  options?: {
    fallbackUrl?: string;
    target?: string;
    isAppScheme?: boolean;
  }
): boolean {
  if (!primaryUrl) return false;

  const isCustomScheme = /^(whatsapp|intent|tg|tel|sms|vnd\.youtube):/i.test(primaryUrl);
  // Custom URI schemes must never be opened with target="_blank" because mobile browsers create an empty blank tab that fails to load
  const target = isCustomScheme ? '_self' : (options?.target || '_blank');

  try {
    if (isCustomScheme && typeof document !== 'undefined') {
      // Create or reuse hidden iframe to trigger the OS intent seamlessly without blank tab navigation
      let iframe = document.getElementById('sara-deep-link-frame') as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'sara-deep-link-frame';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
      }
      iframe.src = primaryUrl;

      // Also support universal fallback URL if provided (e.g. wa.me)
      if (options?.fallbackUrl && options.fallbackUrl !== primaryUrl) {
        setTimeout(() => {
          try {
            // Check if page is still visible (meaning native app didn't take foreground)
            if (document.visibilityState === 'visible' && options?.fallbackUrl) {
              window.location.assign(options.fallbackUrl);
            }
          } catch (e) {}
        }, 800);
      }
      return true;
    }

    // Standard HTTP / HTTPS URL handling via click
    const anchor = document.createElement('a');
    anchor.href = primaryUrl;
    anchor.target = target;
    anchor.rel = 'noopener noreferrer';
    anchor.style.position = 'fixed';
    anchor.style.left = '-9999px';
    anchor.style.top = '-9999px';
    anchor.style.opacity = '0';
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      try {
        if (anchor.parentNode) {
          anchor.parentNode.removeChild(anchor);
        }
      } catch (e) {}
    }, 400);

    return true;
  } catch (err) {
    console.warn("Anchor dispatch error, attempting fallback:", err);
    try {
      if (options?.fallbackUrl) {
        window.location.assign(options.fallbackUrl);
      } else {
        window.location.assign(primaryUrl);
      }
      return true;
    } catch (err2) {
      console.error("Critical deep link execution failed:", err2);
      return false;
    }
  }
}
