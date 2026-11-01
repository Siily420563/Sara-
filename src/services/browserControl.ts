/**
 * SARA AI - Browser Control & Tab Management Service
 * Provides full browsing power, voice-activated site navigation, tab switching, and URL normalization.
 */

export interface OpenTabInfo {
  key: string;
  name: string;
  url: string;
  windowRef: Window | null;
  timestamp: number;
}

// In-memory tab registry for the session
const tabsRegistry: Map<string, OpenTabInfo> = new Map();
let lastActiveTabKey = '';

// Known service domains & shortcuts
const KNOWN_SERVICES: Record<string, string> = {
  google: 'https://www.google.com',
  youtube: 'https://www.youtube.com',
  yt: 'https://www.youtube.com',
  instagram: 'https://www.instagram.com',
  insta: 'https://www.instagram.com',
  ig: 'https://www.instagram.com',
  whatsapp: 'https://web.whatsapp.com',
  wa: 'https://web.whatsapp.com',
  twitter: 'https://x.com',
  x: 'https://x.com',
  facebook: 'https://www.facebook.com',
  fb: 'https://www.facebook.com',
  reddit: 'https://www.reddit.com',
  github: 'https://github.com',
  amazon: 'https://www.amazon.com',
  'amazon india': 'https://www.amazon.in',
  'amazon in': 'https://www.amazon.in',
  flipkart: 'https://www.flipkart.com',
  chatgpt: 'https://chatgpt.com',
  openai: 'https://chatgpt.com',
  gemini: 'https://gemini.google.com',
  claude: 'https://claude.ai',
  netflix: 'https://www.netflix.com',
  spotify: 'https://open.spotify.com',
  wikipedia: 'https://www.wikipedia.org',
  wiki: 'https://www.wikipedia.org',
  linkedin: 'https://www.linkedin.com',
  gmail: 'https://mail.google.com',
  maps: 'https://maps.google.com',
  'google maps': 'https://maps.google.com',
  drive: 'https://drive.google.com',
  'google drive': 'https://drive.google.com',
  pinterest: 'https://www.pinterest.com',
  twitch: 'https://www.twitch.tv',
  discord: 'https://discord.com/app',
  notion: 'https://www.notion.so',
  canva: 'https://www.canva.com',
  medium: 'https://medium.com',
  stackoverflow: 'https://stackoverflow.com',
  'stack overflow': 'https://stackoverflow.com',
  cricbuzz: 'https://www.cricbuzz.com',
  hotstar: 'https://www.hotstar.com',
  'prime video': 'https://www.primevideo.com',
  primevideo: 'https://www.primevideo.com',
  yahoo: 'https://www.yahoo.com',
  bing: 'https://www.bing.com',
  duckduckgo: 'https://duckduckgo.com',
  telegram: 'https://web.telegram.org',
  quora: 'https://www.quora.com',
  news: 'https://news.google.com',
  'google news': 'https://news.google.com',
  weather: 'https://www.google.com/search?q=weather',
};

/**
 * Normalizes input text into a valid navigable HTTPS URL.
 */
export function normalizeUrl(input: string, searchEngine = 'google'): { url: string; serviceName: string } {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return { url: 'https://www.google.com', serviceName: 'Google' };
  }

  // Check known shortcuts
  const lower = trimmed.toLowerCase().replace(/^(open|visit|go to|kholo|chalao)\s+/i, '').trim();
  if (KNOWN_SERVICES[lower]) {
    return { url: KNOWN_SERVICES[lower], serviceName: lower };
  }

  // If already absolute URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return { url: trimmed, serviceName: parsed.hostname.replace(/^www\./, '') };
    } catch {
      return { url: trimmed, serviceName: trimmed };
    }
  }

  // Check if it's a domain pattern like 'xyz.com', 'abc.co.in', 'sub.domain.io', 'tech.org'
  const domainPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i;
  if (domainPattern.test(trimmed)) {
    return {
      url: `https://${trimmed}`,
      serviceName: trimmed.split('/')[0].replace(/^www\./, '')
    };
  }

  // Check if starts with www.
  if (/^www\./i.test(trimmed)) {
    return {
      url: `https://${trimmed}`,
      serviceName: trimmed.replace(/^www\./, '').split('/')[0]
    };
  }

  // Treat as a search query
  let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  if (searchEngine === 'bing') {
    searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`;
  } else if (searchEngine === 'duckduckgo') {
    searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  } else if (searchEngine === 'youtube') {
    searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`;
  } else if (searchEngine === 'wikipedia') {
    searchUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(trimmed)}`;
  }

  return { url: searchUrl, serviceName: `Search: ${trimmed}` };
}

/**
 * Normalizes tab key name for consistent switching
 */
function normalizeTabKey(name?: string, fallbackUrl?: string): string {
  if (name && name.trim()) {
    return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  }
  if (fallbackUrl) {
    try {
      const u = new URL(fallbackUrl);
      return u.hostname.replace(/^www\./, '').replace(/[^a-z0-9_-]/g, '_');
    } catch {
      // fallback
    }
  }
  return `tab_${Date.now()}`;
}

/**
 * Open any website in the background/foreground tab.
 */
export function openWebsite(targetUrlOrQuery: string, options?: { tabName?: string; searchEngine?: string }): {
  success: boolean;
  url: string;
  tabKey: string;
  serviceName: string;
  message: string;
} {
  try {
    const { url, serviceName } = normalizeUrl(targetUrlOrQuery, options?.searchEngine);
    const tabKey = normalizeTabKey(options?.tabName, url);

    // Open or reuse named window
    let win: Window | null = null;
    try {
      win = window.open(url, tabKey);
      if (win) {
        win.focus();
      }
    } catch (e) {
      console.warn('Direct window.open notice:', e);
    }

    tabsRegistry.set(tabKey, {
      key: tabKey,
      name: options?.tabName || serviceName,
      url,
      windowRef: win,
      timestamp: Date.now(),
    });
    lastActiveTabKey = tabKey;

    return {
      success: true,
      url,
      tabKey,
      serviceName,
      message: `Opened ${serviceName} in tab "${tabKey}"`,
    };
  } catch (error: any) {
    console.error('Failed to open website:', error);
    return {
      success: false,
      url: targetUrlOrQuery,
      tabKey: 'error',
      serviceName: 'Browser',
      message: error?.message || 'Could not open website',
    };
  }
}

/**
 * Switch focus to an existing open tab.
 */
export function switchTab(tabNameOrQuery: string): {
  success: boolean;
  tabKey: string;
  message: string;
} {
  try {
    const query = (tabNameOrQuery || '').trim().toLowerCase();
    
    // Look for exact key match or closest name/url match
    let targetTab: OpenTabInfo | undefined = tabsRegistry.get(query);
    
    if (!targetTab) {
      for (const [key, tab] of tabsRegistry.entries()) {
        if (key.includes(query) || tab.name.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query)) {
          targetTab = tab;
          break;
        }
      }
    }

    if (!targetTab) {
      // If user asks for "previous" or "last" tab
      if (['previous', 'last', 'back', 'purana', 'pehle'].some(w => query.includes(w))) {
        const all = Array.from(tabsRegistry.values());
        if (all.length > 1) {
          targetTab = all[all.length - 2];
        }
      }
    }

    if (targetTab) {
      // Focus existing window reference
      if (targetTab.windowRef && !targetTab.windowRef.closed) {
        targetTab.windowRef.focus();
      } else {
        // Re-open/focus named target
        const win = window.open('', targetTab.key);
        if (win) win.focus();
      }
      lastActiveTabKey = targetTab.key;
      return {
        success: true,
        tabKey: targetTab.key,
        message: `Switched to tab: ${targetTab.name}`,
      };
    }

    // If tab wasn't explicitly in registry yet, open it directly using tab name
    const { url, serviceName } = normalizeUrl(query);
    const newKey = normalizeTabKey(query, url);
    const win = window.open(url, newKey);
    if (win) win.focus();

    tabsRegistry.set(newKey, {
      key: newKey,
      name: serviceName,
      url,
      windowRef: win,
      timestamp: Date.now(),
    });
    lastActiveTabKey = newKey;

    return {
      success: true,
      tabKey: newKey,
      message: `Navigated to ${serviceName}`,
    };
  } catch (error: any) {
    console.error('Failed to switch tab:', error);
    return {
      success: false,
      tabKey: tabNameOrQuery,
      message: error?.message || 'Failed to switch tab',
    };
  }
}

/**
 * Close an active or named tab.
 */
export function closeTab(tabNameOrQuery?: string): {
  success: boolean;
  message: string;
} {
  try {
    let targetKey = (tabNameOrQuery || '').trim().toLowerCase();
    if (!targetKey && lastActiveTabKey) {
      targetKey = lastActiveTabKey;
    }

    if (targetKey) {
      const tab = tabsRegistry.get(targetKey);
      if (tab && tab.windowRef && !tab.windowRef.closed) {
        tab.windowRef.close();
        tabsRegistry.delete(targetKey);
        return { success: true, message: `Closed tab: ${tab.name}` };
      }
      // Try searching by name/url
      for (const [key, t] of tabsRegistry.entries()) {
        if (key.includes(targetKey) || t.name.toLowerCase().includes(targetKey)) {
          if (t.windowRef && !t.windowRef.closed) {
            t.windowRef.close();
          }
          tabsRegistry.delete(key);
          return { success: true, message: `Closed tab: ${t.name}` };
        }
      }
    }

    return { success: true, message: 'Tab closed' };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Could not close tab' };
  }
}

/**
 * Execute a web search and browse results.
 */
export function browseWeb(query: string, searchEngine = 'google'): {
  success: boolean;
  url: string;
  message: string;
} {
  const result = openWebsite(query, { searchEngine });
  return {
    success: result.success,
    url: result.url,
    message: `Browsing results for "${query}"`,
  };
}

/**
 * Returns list of tracked tabs
 */
export function getTrackedTabs(): OpenTabInfo[] {
  return Array.from(tabsRegistry.values());
}
