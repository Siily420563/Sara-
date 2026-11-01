process.on('unhandledRejection', (reason: any) => { if (reason && typeof reason === 'object' && '_errorEmitted' in reason) return; console.log('Unhandled Rejection:', reason && reason.message ? reason.message : String(reason)); });
process.on('uncaughtException', (err: any) => { if (err && err.code === 'ERR_UNHANDLED_ERROR') return; console.log('Uncaught Exception:', err?.message || String(err)); });
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import path from 'path';
import { createServer as createViteServer, createLogger } from 'vite';
import webpush from 'web-push';
import fs from 'fs';
import { searchNeetDatabase, formatNeetStudyPacket, NEET_DIAGRAMS_DATABASE } from './src/services/neetKnowledge';
import { findBestMatchingContact, findMatchingContactsWithAmbiguity, searchContactsFuzzy, PhoneContact } from './src/services/fuzzyContactSearch';

// Configure Web Push VAPID keys
let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || ''
};
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  vapidKeys = webpush.generateVAPIDKeys();
  console.log('Generated new VAPID keys for this session.');
}
webpush.setVapidDetails('mailto:test@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

// User Rooms Storage Directory
const USER_ROOMS_DIR = path.join(process.cwd(), 'user_rooms');
if (!fs.existsSync(USER_ROOMS_DIR)) {
  try {
    fs.mkdirSync(USER_ROOMS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create user_rooms directory:", err);
  }
}

export function sanitizeRoomUserId(rawId?: any): string {
  if (!rawId || typeof rawId !== 'string') return '';
  const trimmed = rawId.trim();
  if (trimmed === '' || trimmed === 'anonymous_default') return '';
  const clean = trimmed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return clean;
}

function getUserRoomPath(userId: string): string | null {
  const safeId = sanitizeRoomUserId(userId);
  if (!safeId) return null;
  return path.join(USER_ROOMS_DIR, `${safeId}.json`);
}

interface UserRoomData {
  userId: string;
  messages?: any[];
  state?: any;
  reminders?: any[];
  events?: any[];
  pushSubscriptions?: any[];
  lastSeenTime?: number;
  missingNotificationSent?: boolean;
}

// In-memory cache of user rooms for active sessions and background intervals
const userRoomsCache = new Map<string, UserRoomData>();

function loadUserRoom(rawUserId?: any): UserRoomData | null {
  const userId = sanitizeRoomUserId(rawUserId);
  if (!userId) {
    return null;
  }
  if (userRoomsCache.has(userId)) {
    return userRoomsCache.get(userId)!;
  }
  const filePath = getUserRoomPath(userId);
  if (!filePath) return null;
  let roomData: UserRoomData = {
    userId,
    messages: [],
    state: null,
    reminders: [],
    pushSubscriptions: [],
    lastSeenTime: Date.now(),
    missingNotificationSent: false
  };
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      roomData = {
        ...roomData,
        ...parsed,
        userId
      };
    }
  } catch (e) {
    console.error(`Error loading room for ${userId}:`, e);
  }
  userRoomsCache.set(userId, roomData);
  return roomData;
}

function saveUserRoom(userId: string, updates: Partial<UserRoomData>) {
  const safeId = sanitizeRoomUserId(userId);
  if (!safeId) return; // Never save to un-isolated or anonymous files
  const current = loadUserRoom(safeId) || {
    userId: safeId,
    messages: [],
    state: null,
    reminders: [],
    pushSubscriptions: [],
    lastSeenTime: Date.now(),
    missingNotificationSent: false
  };
  const updated: UserRoomData = {
    ...current,
    ...updates,
    userId: safeId
  };
  userRoomsCache.set(safeId, updated);
  try {
    const filePath = getUserRoomPath(safeId);
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
    }
  } catch (e) {
    console.error(`Error writing user room file for ${safeId}:`, e);
  }
}

// Preload existing user rooms from disk
try {
  if (fs.existsSync(USER_ROOMS_DIR)) {
    const roomFiles = fs.readdirSync(USER_ROOMS_DIR);
    for (const f of roomFiles) {
      if (f.endsWith('.json')) {
        const uId = f.slice(0, -5);
        loadUserRoom(uId);
      }
    }
    console.log(`[User Rooms] Preloaded ${userRoomsCache.size} active user room(s) from disk.`);
  }
} catch (e) {
  console.log("Memory initialization note:", e);
}

// Server-side diagnostic logs store
interface ServerLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  module: string;
  message: string;
  details?: string;
}
const recentServerLogs: ServerLog[] = [
  {
    id: 'srv-init-' + Date.now(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    level: 'info',
    module: 'SYSTEM',
    message: 'SARA Backend Server initialized with Isolated User Rooms',
    details: 'Per-user database rooms active'
  }
];

function logServerDiagnostic(level: 'info' | 'success' | 'warn' | 'error', module: string, message: string, details?: string) {
  const entry: ServerLog = {
    id: Math.random().toString(36).slice(2) + Date.now(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    level,
    module,
    message,
    details
  };
  recentServerLogs.unshift(entry);
  if (recentServerLogs.length > 150) recentServerLogs.pop();
  console.log(`[${entry.level.toUpperCase()}][${entry.module}] ${entry.message} ${entry.details ? `(${entry.details})` : ''}`);
}

// Proactive Background Interval: Checks each user room independently for due reminders and inactivity check-ins
setInterval(async () => {
   const now = Date.now();
   const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

   for (const [userId, room] of userRoomsCache.entries()) {
     const subs = room.pushSubscriptions || [];
     if (!subs || subs.length === 0) continue;

     // 1. "Where are you?" re-engagement check per user
     const userLastSeen = room.lastSeenTime || now;
     if (now - userLastSeen > twoDaysMs && !room.missingNotificationSent) {
       room.missingNotificationSent = true;
       saveUserRoom(userId, { missingNotificationSent: true });
       const payload = {
         title: 'SARA AI',
         body: 'Where are you? I haven\'t heard from you in a while.',
         tag: `sara-inactivity-${userId}`
       };
       subs.forEach(sub => {
         webpush.sendNotification(sub, JSON.stringify(payload)).catch(e => {
           if (e?.statusCode === 410 || e?.statusCode === 404) {
             const updated = (room.pushSubscriptions || []).filter(s => s.endpoint !== sub.endpoint);
             saveUserRoom(userId, { pushSubscriptions: updated });
           }
         });
       });
     } else if (now - userLastSeen <= twoDaysMs && room.missingNotificationSent) {
       room.missingNotificationSent = false;
       saveUserRoom(userId, { missingNotificationSent: false });
     }

     // 2. Proactive due reminders dispatcher isolated to THIS user only
     const reminders = room.reminders || [];
     let remindersUpdated = false;
     for (const r of reminders) {
        if (!r.done && r.time <= now && !r.pushSent) {
           r.pushSent = true;
           remindersUpdated = true;
           const payload = {
             title: '🚨 SARA Reminder Alert',
             body: r.text,
             tag: `sara-reminder-${r.id || Date.now()}`,
             url: '/#reminder-alert'
           };
           console.log(`[Proactive Push] Dispatching due reminder to room "${userId}" (${subs.length} subs): "${r.text}"`);
           subs.forEach(sub => {
             webpush.sendNotification(sub, JSON.stringify(payload)).catch(e => {
               console.log(`Web push delivery error for user ${userId}:`, e?.message || e);
               if (e?.statusCode === 410 || e?.statusCode === 404) {
                 const updated = (room.pushSubscriptions || []).filter(s => s.endpoint !== sub.endpoint);
                 saveUserRoom(userId, { pushSubscriptions: updated });
               }
             });
           });
        }
     }

     // 3. Proactive due calendar events dispatcher isolated to THIS user only
     const events = room.events || [];
     let eventsUpdated = false;
     const todayStr = new Date().toISOString().split('T')[0];
     for (const ev of events) {
       if (!ev.pushSent && ev.date === todayStr && ev.time) {
         try {
           const [evHours, evMins] = ev.time.split(':').map(Number);
           const nowD = new Date();
           const currentMins = nowD.getHours() * 60 + nowD.getMinutes();
           const targetMins = evHours * 60 + evMins;
           if (currentMins >= targetMins && currentMins - targetMins <= 10) {
             ev.pushSent = true;
             eventsUpdated = true;
             const payload = {
               title: '⏰ SARA Schedule Alert',
               body: `${ev.title || 'Scheduled Event'}${ev.time ? ' at ' + ev.time : ''}`,
               tag: `sara-event-${ev.id || Date.now()}`,
               url: '/#schedule'
             };
             console.log(`[Proactive Push] Dispatching due event to room "${userId}": "${ev.title}"`);
             subs.forEach(sub => {
               webpush.sendNotification(sub, JSON.stringify(payload)).catch(() => {});
             });
           }
         } catch (e) {}
       }
     }

     if (remindersUpdated || eventsUpdated) {
       saveUserRoom(userId, { 
         ...(remindersUpdated ? { reminders } : {}),
         ...(eventsUpdated ? { events } : {})
       });
     }
   }
}, 4000);

// Helper to clean and sanitize API keys (removes whitespace, invisible unicode, quotes, env prefixes)
function sanitizeApiKey(key?: string): string {
  if (!key || typeof key !== 'string') return '';
  // 1. Strip zero-width & invisible unicode characters, tabs, newlines
  let cleaned = key.replace(/[\u200B-\u200D\uFEFF\u00A0\r\n\t]/g, '').trim();

  // 2. Check if user pasted a URL instead of a key
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    const urlKeyMatch = cleaned.match(/[?&]key=([A-Za-z0-9_-]{30,45})/);
    if (urlKeyMatch) return urlKeyMatch[1];
    return cleaned;
  }

  // 3. Intelligently extract AIzaSy... token if embedded in text/code/export
  const aizaMatch = cleaned.match(/AIzaSy[A-Za-z0-9_-]{33}/);
  if (aizaMatch) {
    return aizaMatch[0];
  }

  // 4. Strip export, env prefixes, quotes, and bearer tokens
  cleaned = cleaned.replace(/^(export\s+)?(GEMINI_API_KEY|API_KEY)\s*=\s*/i, '').trim();
  cleaned = cleaned.replace(/^Bearer\s+/i, '').trim();
  cleaned = cleaned.replace(/^["'`“”‘’]|["'`“”‘’]$/g, '').trim();
  return cleaned;
}

// Helper to instantiate genAI with a potential custom key
function getAi(apiKeyOverride?: string) {
  const trimmed = sanitizeApiKey(apiKeyOverride);
  const key = trimmed || sanitizeApiKey(process.env.GEMINI_API_KEY);
  if (!key) throw new Error("API key is missing. Please configure your Gemini API key in Settings ⚙️.");
  return new GoogleGenAI({ apiKey: key });
}

// Supported Flash Models with priority fallback (gemini-2.5-flash is universally supported for Google AI Studio keys)
const FLASH_MODELS = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-2.5-flash-lite', 'gemini-3.1-pro-preview'];

async function callStreamWithFallback(ai: any, options: any) {
  let lastErr: any = null;
  for (const modelName of FLASH_MODELS) {
    try {
      const stream = await ai.models.generateContentStream({
        ...options,
        model: modelName
      });
      return stream;
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (
        msg.includes('429') ||
        msg.includes('quota') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('404') ||
        msg.includes('NOT_FOUND') ||
        msg.includes('403') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('denied access') ||
        msg.includes('no longer available') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand')
      ) {
        console.log(`Model ${modelName} unavailable or restricted, trying next fallback model...`);
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function callGenerateWithFallback(ai: any, options: any): Promise<any> {
  let lastErr: any = null;
  for (const modelName of FLASH_MODELS) {
    try {
      const result = await ai.models.generateContent({
        ...options,
        model: modelName
      });
      if (result) {
        (result as any).usedModel = modelName;
      }
      return result;
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (
        msg.includes('429') ||
        msg.includes('quota') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('404') ||
        msg.includes('NOT_FOUND') ||
        msg.includes('403') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('denied access') ||
        msg.includes('no longer available') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand')
      ) {
        console.log(`Model ${modelName} unavailable or restricted, trying next fallback model...`);
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Custom tools declarations for Gemini
const getCurrentTimeDeclaration = {
  name: "get_current_time",
  description: "Get the exact, real-time current date, time, timezone, and day of the week for the user. Always use this instead of guessing when the user asks what time or day it is.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      timezone: { type: Type.STRING, description: "The IANA timezone ID, e.g., 'Asia/Kolkata', 'America/New_York'" }
    }
  }
};

const getWeatherDeclaration = {
  name: "get_weather",
  description: "Get the real-time weather details for any city or location in the world.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: { type: Type.STRING, description: "The city or location name, e.g., 'Delhi', 'New York'" }
    },
    required: ["location"]
  }
};

const getNewsDeclaration = {
  name: "get_news",
  description: "Get real-time, verified current news articles and detailed reports globally, nationally (India), or by category/topic query (e.g., 'Top Stories', 'India', 'World', 'Technology', 'Business', 'Sports', 'Entertainment', 'Science', 'Health', or custom search queries like 'Cricket', 'Stock Market', 'AI', 'NEET', 'Budget'). Returns real-time headlines with comprehensive, detailed background summaries.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: "News category or topic: 'Top Stories', 'India', 'World', 'Technology', 'Business', 'Sports', 'Entertainment', 'Science', 'Health', or custom topic" },
      query: { type: Type.STRING, description: "Optional specific topic or search query, e.g. 'AI', 'Cricket', 'Sensex', 'Budget', 'Election', 'ISRO'" }
    }
  }
};

const getWikipediaSummaryDeclaration = {
  name: "get_wikipedia_summary",
  description: "Search Wikipedia and get a comprehensive summary/extract about any topic, person, history, or real-world data.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "The search query or topic, e.g., 'Albert Einstein', 'Quantum Computing'" }
    },
    required: ["query"]
  }
};

const extractFactDeclaration = {
  name: "extract_fact",
  description: "Extract a personal fact, preference, habit, interest, music taste, or favorite artist/singer about the user to remember for long term. Use this aggressively to save small or big details about the user, like 'Talha Anjum ke gaane sunao' means they like listening to Talha Anjum's music. Save it as a fact.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fact: { type: Type.STRING, description: "The fact to remember (e.g. 'Likes listening to Talha Anjum's rap music')" },
      temporalType: { type: Type.STRING, description: "Upcoming, Past, Recurring, General" },
      resolvedTime: { type: Type.STRING, description: "ISO 8601 absolute time string if applicable, or null" }
    },
    required: ["fact"]
  }
};

const setReminderDeclaration = {
  name: "set_reminder",
  description: "Set a reminder for the user at a specific time.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: "Reminder text" },
      timeIso: { type: Type.STRING, description: "ISO 8601 absolute time string based on user's request" }
    },
    required: ["text", "timeIso"]
  }
};

const addCalendarEventDeclaration = {
  name: "add_calendar_event",
  description: "Mark or add an event, trip, birthday, meeting, appointment, plan, or schedule into the user's in-app calendar. Always call this tool when user mentions any calendar plan (e.g. 'Kal trip pe jana hai', '13 Sept ko kisi ka birthday hai', 'Parso 3 bje Prayagraj jaana hai', '13 tarikh ko meeting hai'). If user gives only date without month, resolve using Option A (current month if upcoming, next month if already passed) and confirm to user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title or summary of the event (e.g. 'Trip', 'Rahul ka Birthday', 'Prayagraj Jana Hai', 'Meeting')" },
      date: { type: Type.STRING, description: "ISO 8601 date string 'YYYY-MM-DD' representing the exact date of the event in India timezone (IST)" },
      time: { type: Type.STRING, description: "Optional time of the event, e.g. '15:00' or '3:00 PM'" },
      category: { type: Type.STRING, description: "Category of the event: 'trip', 'birthday', 'meeting', 'reminder', 'personal', or 'general'" },
      description: { type: Type.STRING, description: "Optional notes or details about the event" },
      confirmationNote: { type: Type.STRING, description: "Friendly confirmation note explaining how date was marked (e.g. 'Maine isi mahine 13 September ko meeting mark kar di hai')" }
    },
    required: ["title", "date"]
  }
};

const deleteCalendarEventDeclaration = {
  name: "delete_calendar_event",
  description: "Remove, delete, or cancel an event from the user's in-app calendar.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title or keywords of the event to delete" },
      date: { type: Type.STRING, description: "Optional date 'YYYY-MM-DD' of the event" }
    },
    required: ["title"]
  }
};

const playYoutubeVideoDeclaration = {
  name: "play_youtube_video",
  description: "Play any song, music track, or video on YouTube. Call this tool when the user asks to play a song, music, video, trailer, tutorial, or search on YouTube (e.g. 'Play Gumaan by Talha Anjum', 'YouTube par Arijit Singh ke gaane sunao', 'Play funny videos on YouTube', 'Play lofi beats').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "The song title, artist, or video search query (e.g. 'Talha Anjum Gumaan', 'Arijit Singh romantic songs', 'lofi hip hop')" }
    },
    required: ["query"]
  }
};

const sendWhatsappMessageDeclaration = {
  name: "send_whatsapp_message",
  description: "Send or compose a WhatsApp message to a contact or phone number in browser. Call this tool when the user asks to send a WhatsApp message (e.g. 'WhatsApp par Mummy ko bhej do main late ho jaunga', '9876543210 pe WhatsApp message karo', 'Send WhatsApp message to Rohan: Kal milte hain').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: { type: Type.STRING, description: "The message text to send" },
      phoneNumber: { type: Type.STRING, description: "Optional 10-digit phone number or international number with country code" },
      contactName: { type: Type.STRING, description: "Optional contact name if mentioned (e.g. 'Mummy', 'Rohan', 'Bhaiya')" }
    },
    required: ["message"]
  }
};

const sendTelegramMessageDeclaration = {
  name: "send_telegram_message",
  description: "Send or compose a Telegram message, pre-filled draft, or open Telegram chat with a contact, phone number, or Telegram username. Call this tool when the user asks to send a message on Telegram, draft on Telegram, message someone on Telegram, or open Telegram chat (e.g. 'Telegram par Mummy ko bhej do main late ho jaunga', 'Telegram message karo Rahul ko: Kal milte hain', 'Telegram pe draft karo...', '9876543210 pe Telegram message bhejo', 'Telegram open karo Ashu ke sath').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: { type: Type.STRING, description: "The message or draft text to send on Telegram" },
      phoneNumber: { type: Type.STRING, description: "Optional 10-digit phone number or international number with country code" },
      contactName: { type: Type.STRING, description: "Optional contact name if mentioned (e.g. 'Rahul', 'Mummy', 'Bhaiya')" },
      username: { type: Type.STRING, description: "Optional Telegram username if mentioned (e.g. '@rahul', 'john_doe')" }
    },
    required: ["message"]
  }
};

const openWebsiteDeclaration = {
  name: "open_website",
  description: "Open any website, web domain, or online service in a browser tab. Call this tool whenever the user asks to open any site, visit a webpage, launch a web app, or open a link (e.g., 'Open Amazon', 'Instagram open karo', 'Open google.com', 'Open Twitter/X', 'Visit github.com', 'Open ChatGPT', 'Open Netflix', 'Open Wikipedia', 'Open any website', 'amazon.in kholo', 'Flipkart kholo', 'Open Reddit', 'Open any site').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: "The URL, domain, or website name/shortcut (e.g. 'amazon.com', 'instagram', 'https://github.com', 'reddit', 'chatgpt', 'netflix', 'flipkart', 'google.com', or any domain/URL)" },
      tabName: { type: Type.STRING, description: "Optional clean label/name for the tab to allow switching back to it (e.g. 'amazon', 'instagram', 'github')" },
      query: { type: Type.STRING, description: "Optional specific query if user is looking up something on that site" }
    },
    required: ["url"]
  }
};

const switchTabDeclaration = {
  name: "switch_tab",
  description: "Switch between open browser tabs, focus an existing tab, or navigate between active tabs. Call this tool when the user asks to switch tab, switch to another site/tab, focus a tab, or bring a tab to front (e.g. 'Switch to YouTube tab', 'Switch tab to Amazon', 'Pehle wale tab par jao', 'Focus Instagram tab', 'Switch to Google tab', 'Switch tabs', 'Tab change karo').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      tabName: { type: Type.STRING, description: "The name, title, or service of the tab to switch to (e.g. 'youtube', 'amazon', 'google', 'instagram', 'previous', 'next')" }
    },
    required: ["tabName"]
  }
};

const openTabDeclaration = {
  name: "open_tab",
  description: "Open a new browser tab or open any specific tab with full browsing power. Call this tool when the user asks to open a new tab, open any tab, or browse in a new tab (e.g. 'Open a new tab', 'Open YouTube in a new tab', 'Naya tab kholo', 'Open tab for Flipkart', 'Open any tab').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: "The website, URL, or domain to open in the tab. If omitted or empty, defaults to Google/new tab" },
      tabName: { type: Type.STRING, description: "Optional name for the tab" }
    }
  }
};

const browseWebDeclaration = {
  name: "browse_web",
  description: "Perform full web browsing, search the internet, navigate websites, and control the browser. Call this tool when the user wants to browse the web, search Google/Bing/DuckDuckGo, look up products, read articles, or control web browsing with voice (e.g. 'Search latest news on google and open it', 'Browse best laptops 2026', 'Google par search karke site kholo', 'Browse this topic', 'Search web and open site').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "The search query or web topic to browse and open" },
      searchEngine: { type: Type.STRING, description: "Search engine to use: 'google', 'bing', 'duckduckgo', 'youtube', 'wikipedia'. Defaults to 'google'" }
    },
    required: ["query"]
  }
};

const closeTabDeclaration = {
  name: "close_tab",
  description: "Close an open browser tab or close the current/specified tab with voice command (e.g. 'Close this tab', 'Close YouTube tab', 'Tab band karo', 'Close Amazon tab').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      tabName: { type: Type.STRING, description: "Optional tab name or service to close. If omitted, closes the last opened tab" }
    }
  }
};

const endCallDeclaration = {
  name: "end_call",
  description: "End, hang up, disconnect, or cut the active voice/video phone call. Call this tool immediately whenever the user asks to cut the call, end the call, disconnect, hang up, or says goodbye / bye / call cut karo / phone rakho / call kat do / bye bye / disconnect the call (e.g. 'Call cut karo', 'Phone rakho', 'Bye, call disconnect kar do', 'Hang up the call', 'Kat do call', 'Call end kar do', 'Phone cut karo', 'Bye bye phone rakho').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      farewellMessage: { type: Type.STRING, description: "Optional farewell message spoken to user before disconnecting" }
    }
  }
};

const makePhoneCallDeclaration = {
  name: "make_phone_call",
  description: "Initiate or dial a phone call to a saved contact or phone number using the device's native telephone dialer. Call this tool whenever the user asks to call someone, phone someone, dial a number, or make a call (e.g. 'Papa ko call lagao', 'Call Rohit', 'Mummy ko phone lagao', 'Ashu ko phone karo', 'Abhishek Mirzapur ko call lagao', 'Call 9876543210', 'Dial this number', 'Phone lagao'). SARA uses intelligent fuzzy matching on contacts, so provide either phoneNumber or contactName (e.g. 'Ashu', 'Abhishek Mirzapur', 'Papa').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      phoneNumber: { type: Type.STRING, description: "Phone number to call or mobile number with country code (e.g. '+919876543210' or '9876543210') or leave empty if contactName is given" },
      contactName: { type: Type.STRING, description: "Contact name, nickname, or relationship (e.g. 'Papa', 'Mummy', 'Rohit', 'Bhai', 'Ashu', 'Abhishek Mirzapur')" }
    }
  }
};

const sendSmsDeclaration = {
  name: "send_sms",
  description: "Compose or send an SMS text message to a contact or phone number via the device's native SMS application. Call this tool whenever the user asks to send an SMS, text someone, or SMS karo (e.g. 'Papa ko SMS bhejo: Main 10 min me aa raha hu', 'SMS karo Rohit ko: Hi, kya hal hai', 'Ashu ko SMS karo', 'Text 9876543210 saying I am home'). SARA automatically resolves contact names with fuzzy search.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: { type: Type.STRING, description: "The SMS message text body to send" },
      phoneNumber: { type: Type.STRING, description: "The recipient's phone number or approximate name if number is unknown" },
      contactName: { type: Type.STRING, description: "Optional contact name or relationship (e.g. 'Papa', 'Mummy', 'Rohit', 'Ashu')" }
    },
    required: ["message"]
  }
};

const searchContactDeclaration = {
  name: "search_contact",
  description: "Search user's saved phone contacts using intelligent fuzzy matching. Call this tool when user asks for someone's phone number, asks if a contact is saved, or wants to check contact details (e.g. 'Ashu ka number kya hai?', 'Abhishek ka phone number batao', 'Do we have Rahul's number?', 'Search contact Mummy').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "The name, nickname, or relationship to search (e.g. 'Ashu', 'Abhishek Mirzapur', 'Papa', 'Rahul')" }
    },
    required: ["query"]
  }
};

const generateImageDeclaration = {
  name: "generate_image",
  description: "Generate, draw, create, or render a picture, photo, artwork, or illustration based on a prompt. Use this tool whenever the user asks to generate an image, create a picture, draw something, or photo banao (e.g. 'Ek sunset ki photo generate karo', 'Cyberpunk city ki image banao', 'Draw a cat astronaut', 'Photo banao', 'Generate image of Taj Mahal').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: { type: Type.STRING, description: "Detailed English visual description of the scene, subjects, lighting, colors, and art style to generate with Imagen 3 / Gemini." },
      aspectRatio: { type: Type.STRING, description: "Optional aspect ratio: '1:1', '3:4', '4:3', '9:16', '16:9'. Defaults to '1:1'." },
      caption: { type: Type.STRING, description: "Short conversational Hinglish caption or message introducing the generated image." }
    },
    required: ["prompt"]
  }
};

const getNeetDiagramDeclaration = {
  name: "get_neet_diagram_or_topic",
  description: "Retrieve comprehensive NEET UG syllabus diagrams, NCERT high-yield labeling points, exam facts, and visual scientific illustrations for any Biology (Botany & Zoology), Physics, or Chemistry topic (e.g., 'Heart diagram', 'Nephron structure', 'Calvin cycle', 'Fluid mosaic model', 'Human brain', 'Lac operon', 'Anatropous ovule', 'YDSE experiment', 'Compound microscope', 'Bohr model', 'VSEPR geometries', 'Crystal field splitting', 'Daniell cell', etc.).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: { type: Type.STRING, description: "The NEET concept, chapter, or diagram name (e.g. 'Human Heart', 'Nephron', 'Calvin Cycle', 'Fluid Mosaic Model', 'Youngs Double Slit', 'VSEPR Shapes', 'Lac Operon')" },
      subject: { type: Type.STRING, description: "Optional subject filter: 'biology', 'physics', or 'chemistry'" }
    },
    required: ["topic"]
  }
};

// Implementations of free public APIs
function getCurrentTime(timezone?: string) {
  try {
    let tz = timezone && timezone !== 'undefined' && timezone !== 'null' ? timezone : '';
    if (tz) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
      } catch (e) {
        console.log(`Invalid timezone passed to getCurrentTime: "${tz}", falling back.`);
        tz = '';
      }
    }
    
    if (!tz) {
      tz = 'Asia/Kolkata'; // Fallback
    }

    const options: Intl.DateTimeFormatOptions = {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    return {
      currentTime: formatter.format(new Date()),
      timezone: tz,
      timestamp: Date.now()
    };
  } catch (e) {
    return {
      currentTime: new Date().toString(),
      timezone: 'UTC',
      timestamp: Date.now()
    };
  }
}

async function getWeather(location: string) {
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new Error("Geocoding failed");
    const geoData: any = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      return { error: `Could not find location: ${location}` };
    }
    const { latitude, longitude, name, country, admin1 } = geoData.results[0];

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=celsius`;
    const weatherRes = await fetch(weatherUrl);
    if (!weatherRes.ok) throw new Error("Weather fetch failed");
    const weatherData: any = await weatherRes.json();
    const current = weatherData.current_weather;

    // Map weathercode to a human description
    const weatherConditions: Record<number, string> = {
      0: "Clear sky",
      1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Depositing rime fog",
      51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
      56: "Light freezing drizzle", 57: "Dense freezing drizzle",
      61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
      66: "Light freezing rain", 67: "Heavy freezing rain",
      71: "Slight snow fall", 73: "Moderate snow fall", 75: "Heavy snow fall",
      77: "Snow grains",
      80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
      85: "Slight snow showers", 86: "Heavy snow showers",
      95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
    };
    const condition = weatherConditions[current.weathercode] || "Unknown condition";

    return {
      location: `${name}, ${admin1 || ''}, ${country}`,
      latitude,
      longitude,
      temperature: `${current.temperature}°C`,
      windspeed: `${current.windspeed} km/h`,
      winddirection: current.winddirection,
      weathercode: current.weathercode,
      time: current.time,
      condition
    };
  } catch (e: any) {
    return { error: `Failed to fetch weather: ${e.message || String(e)}` };
  }
}

async function getWikipediaSummary(query: string) {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error("Wikipedia search failed");
    const searchData: any = await searchRes.json();
    
    if (!searchData.query?.search || searchData.query.search.length === 0) {
      return { error: `No Wikipedia page found for: ${query}` };
    }

    const bestTitle = searchData.query.search[0].title;

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`;
    const summaryRes = await fetch(summaryUrl);
    if (!summaryRes.ok) throw new Error("Wikipedia summary fetch failed");
    const summaryData: any = await summaryRes.json();

    return {
      title: summaryData.title,
      description: summaryData.description,
      extract: summaryData.extract,
      url: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(bestTitle)}`
    };
  } catch (e: any) {
    return { error: `Failed to fetch Wikipedia summary: ${e.message || String(e)}` };
  }
}

// In-memory cache for news with 60-second TTL to keep responses fast while guaranteed fresh
interface NewsCacheItem {
  timestamp: number;
  data: any;
}
const newsCache = new Map<string, NewsCacheItem>();
const NEWS_CACHE_TTL_MS = 60 * 1000; // 60 seconds

// XML decoding helper to strip tags, unescape entities, and clean text
function decodeXmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssFeed(xml: string, defaultSource: string, maxItems: number = 15): any[] {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const raw = match[1];
    const titleMatch = raw.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s);
    const linkMatch = raw.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/s);
    const pubMatch = raw.match(/<pubDate>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/s);
    const descMatch = raw.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s);
    const sourceMatch = raw.match(/<source[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/source>/s);
    const mediaMatch = raw.match(/<media:content[^>]+url=["']([^"']+)["']/i) || raw.match(/<enclosure[^>]+url=["']([^"']+)["']/i);

    const title = decodeXmlEntities(titleMatch ? titleMatch[1] : '').replace(/\s+-\s+[^-]+$/, '').trim();
    const link = linkMatch ? linkMatch[1].trim() : '';
    const pubDate = pubMatch ? pubMatch[1].trim() : new Date().toISOString();
    const description = decodeXmlEntities(descMatch ? descMatch[1] : '');
    const source = decodeXmlEntities(sourceMatch ? sourceMatch[1] : '') || defaultSource;
    const imageUrl = mediaMatch ? mediaMatch[1] : undefined;

    if (title && title.length > 5) {
      items.push({
        title,
        description,
        source,
        link,
        pubDate,
        imageUrl
      });
    }
  }
  return items;
}

async function fetchRssSafe(url: string, sourceName: string, timeoutMs: number = 3500): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssFeed(xml, sourceName);
  } catch (e) {
    return [];
  }
}

async function fetchInshortsSafe(categoryParam: string, timeoutMs: number = 3500): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`https://inshorts.com/api/en/news?category=${encodeURIComponent(categoryParam)}&max_limit=25&include_card_data=true`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const json: any = await res.json();
    const newsList = json?.data?.news_list || [];
    return newsList
      .map((item: any) => item?.news_obj)
      .filter((obj: any) => obj && obj.title)
      .map((obj: any) => ({
        title: obj.title.trim(),
        description: obj.content ? obj.content.trim() : '',
        source: obj.source_name ? obj.source_name.trim() : 'Inshorts News',
        link: obj.source_url || `https://inshorts.com/en/news/${obj.hash_id || ''}`,
        pubDate: obj.created_at ? new Date(obj.created_at).toISOString() : new Date().toISOString(),
        imageUrl: obj.image_url || undefined
      }));
  } catch (e) {
    return [];
  }
}

async function getNews(category?: string, query?: string) {
  const rawSearch = (query || category || "Top Stories").trim();
  const lowerSearch = rawSearch.toLowerCase();
  console.log(`[Real-Time News Engine] Fetching fresh news for: "${rawSearch}" (query: "${query || ''}", category: "${category || ''}")`);

  const cacheKey = `${lowerSearch}:${(query || '').toLowerCase().trim()}`;
  const cached = newsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < NEWS_CACHE_TTL_MS)) {
    console.log(`[Real-Time News Engine] Returning cached real-time articles (${cached.data.articles?.length || 0} items)`);
    return cached.data;
  }

  // Determine category & topics
  const isIndia = lowerSearch.includes('india') || lowerSearch.includes('national') || lowerSearch.includes('desh') || lowerSearch.includes('bharat');
  const isWorld = lowerSearch.includes('world') || lowerSearch.includes('global') || lowerSearch.includes('international') || lowerSearch.includes('duniya');
  const isTech = lowerSearch.includes('tech') || lowerSearch.includes('ai') || lowerSearch.includes('gadget') || lowerSearch.includes('software') || lowerSearch.includes('apple') || lowerSearch.includes('google');
  const isBusiness = lowerSearch.includes('business') || lowerSearch.includes('market') || lowerSearch.includes('finance') || lowerSearch.includes('economy') || lowerSearch.includes('stock') || lowerSearch.includes('sensex') || lowerSearch.includes('nifty') || lowerSearch.includes('budget');
  const isSports = lowerSearch.includes('sport') || lowerSearch.includes('cricket') || lowerSearch.includes('football') || lowerSearch.includes('ipl') || lowerSearch.includes('match') || lowerSearch.includes('olympic');
  const isEntertainment = lowerSearch.includes('entertain') || lowerSearch.includes('movie') || lowerSearch.includes('bollywood') || lowerSearch.includes('cinema') || lowerSearch.includes('actor') || lowerSearch.includes('song');
  const isHealthOrScience = lowerSearch.includes('health') || lowerSearch.includes('science') || lowerSearch.includes('space') || lowerSearch.includes('isro') || lowerSearch.includes('nasa');

  const fetchTasks: Promise<any[]>[] = [];

  // 1. Google News Live RSS integration (Topic Search if query provided, else National & World Top Stories)
  if (query && query.trim() && !['general', 'top stories', 'top', 'all'].includes(query.toLowerCase().trim())) {
    const cleanQ = encodeURIComponent(query.trim());
    fetchTasks.push(fetchRssSafe(`https://news.google.com/rss/search?q=${cleanQ}&hl=en-IN&gl=IN&ceid=IN:en`, 'Google News India'));
    fetchTasks.push(fetchRssSafe(`https://news.google.com/rss/search?q=${cleanQ}`, 'Google News Global'));
  } else {
    fetchTasks.push(fetchRssSafe('https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en', 'Google News India'));
    fetchTasks.push(fetchRssSafe('https://news.google.com/rss?hl=en&gl=US&ceid=US:en', 'Google News World'));
  }

  // 2. Inshorts Live feed (top_stories, all_news, plus specific category streams)
  fetchTasks.push(fetchInshortsSafe('top_stories'));
  fetchTasks.push(fetchInshortsSafe('all_news'));
  if (isTech) fetchTasks.push(fetchInshortsSafe('technology'));
  if (isBusiness) fetchTasks.push(fetchInshortsSafe('business'));
  if (isSports) fetchTasks.push(fetchInshortsSafe('sports'));
  if (isEntertainment) fetchTasks.push(fetchInshortsSafe('entertainment'));
  if (isIndia) fetchTasks.push(fetchInshortsSafe('national'));
  if (isWorld) fetchTasks.push(fetchInshortsSafe('world'));
  if (isHealthOrScience) fetchTasks.push(fetchInshortsSafe('science'));

  if (isTech) {
    fetchTasks.push(fetchRssSafe('https://feeds.feedburner.com/gadgets360-latest', 'NDTV Gadgets 360'));
    fetchTasks.push(fetchRssSafe('https://www.livemint.com/rss/technology', 'Livemint Tech'));
    fetchTasks.push(fetchRssSafe('https://feeds.bbci.co.uk/news/technology/rss.xml', 'BBC Tech'));
    fetchTasks.push(fetchRssSafe('https://timesofindia.indiatimes.com/rssfeeds/66949542.cms', 'Times of India Tech'));
  } else if (isBusiness) {
    fetchTasks.push(fetchRssSafe('https://www.livemint.com/rss/markets', 'Livemint Markets'));
    fetchTasks.push(fetchRssSafe('https://feeds.feedburner.com/ndtvprofit-latest', 'NDTV Profit'));
    fetchTasks.push(fetchRssSafe('https://timesofindia.indiatimes.com/rssfeeds/1898055.cms', 'Times of India Business'));
    fetchTasks.push(fetchRssSafe('https://feeds.bbci.co.uk/news/business/rss.xml', 'BBC Business'));
  } else if (isSports) {
    fetchTasks.push(fetchRssSafe('https://feeds.feedburner.com/ndtvsports-latest', 'NDTV Sports'));
    fetchTasks.push(fetchRssSafe('https://timesofindia.indiatimes.com/rssfeeds/4719148.cms', 'Times of India Sports'));
    fetchTasks.push(fetchRssSafe('https://www.thehindu.com/sport/feeder/default.rss', 'The Hindu Sport'));
  } else if (isWorld) {
    fetchTasks.push(fetchRssSafe('https://feeds.bbci.co.uk/news/world/rss.xml', 'BBC World News'));
    fetchTasks.push(fetchRssSafe('https://feeds.feedburner.com/ndtvnews-world-news', 'NDTV World'));
    fetchTasks.push(fetchRssSafe('https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', 'Times of India World'));
    fetchTasks.push(fetchRssSafe('https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml', 'Hindustan Times World'));
  } else if (isEntertainment) {
    fetchTasks.push(fetchRssSafe('https://feeds.feedburner.com/ndtvmovies-latest', 'NDTV Movies'));
    fetchTasks.push(fetchRssSafe('https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms', 'Times of India Entertainment'));
  } else if (isHealthOrScience) {
    fetchTasks.push(fetchRssSafe('https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'BBC Science'));
    fetchTasks.push(fetchRssSafe('https://feeds.bbci.co.uk/news/health/rss.xml', 'BBC Health'));
    fetchTasks.push(fetchRssSafe('https://timesofindia.indiatimes.com/rssfeeds/-2128672765.cms', 'Times of India Science'));
  } else if (isIndia) {
    fetchTasks.push(fetchRssSafe('https://feeds.feedburner.com/ndtvnews-india-news', 'NDTV India'));
    fetchTasks.push(fetchRssSafe('https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms', 'Times of India'));
    fetchTasks.push(fetchRssSafe('https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml', 'Hindustan Times'));
    fetchTasks.push(fetchRssSafe('https://www.thehindu.com/news/national/feeder/default.rss', 'The Hindu'));
  } else {
    // Top Stories / General: Mix of prime national and global top stories
    fetchTasks.push(fetchRssSafe('https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'Times of India'));
    fetchTasks.push(fetchRssSafe('https://feeds.feedburner.com/ndtvnews-top-stories', 'NDTV'));
    fetchTasks.push(fetchRssSafe('https://feeds.bbci.co.uk/news/rss.xml', 'BBC News'));
    fetchTasks.push(fetchRssSafe('https://www.livemint.com/rss/news', 'Livemint'));
  }

  const rawResults = await Promise.all(fetchTasks);
  const allArticles: any[] = [];
  const seenTitles = new Set<string>();

  for (const list of rawResults) {
    for (const article of list) {
      if (!article || !article.title) continue;
      // Normalization key for deduplication
      const norm = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 45);
      if (seenTitles.has(norm)) continue;
      seenTitles.add(norm);
      allArticles.push(article);
    }
  }

  let finalArticles: any[] = [];

  // If a specific query was requested (e.g. 'NEET', 'Cricket', 'AI', 'Apple', 'Sensex', 'Iran')
  if (query && query.trim() && !['general', 'top stories', 'top', 'all'].includes(query.toLowerCase().trim())) {
    const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const scored = allArticles.map(a => {
      const titleLower = a.title.toLowerCase();
      const descLower = (a.description || '').toLowerCase();
      let score = 0;
      for (const w of qWords) {
        if (titleLower.includes(w)) score += 3;
        if (descLower.includes(w)) score += 1;
      }
      return { article: a, score };
    });

    const matching = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).map(s => s.article);
    if (matching.length > 0) {
      finalArticles = matching;
    } else {
      // If no exact keyword match was found in the current articles, provide the freshest stories
      finalArticles = allArticles;
    }
  } else {
    finalArticles = allArticles;
  }

  // Ensure rich description: If description is missing or too short, generate a clean summary placeholder
  const enrichedArticles = finalArticles.slice(0, 15).map(a => {
    let desc = a.description || '';
    if (!desc || desc.length < 20) {
      desc = `Breaking coverage: ${a.title}. Published by ${a.source}. Visit the link for full continuous updates and detailed report.`;
    }
    return {
      title: a.title,
      description: desc,
      source: a.source,
      link: a.link || `https://www.google.com/search?q=${encodeURIComponent(a.title)}&tbm=nws`,
      pubDate: a.pubDate,
      imageUrl: a.imageUrl,
      category: rawSearch
    };
  });

  const responsePayload = {
    category: rawSearch,
    source: "Verified Live Real-Time News Network",
    timestamp: new Date().toISOString(),
    totalFound: enrichedArticles.length,
    articles: enrichedArticles
  };

  // Cache in memory for 60 seconds
  newsCache.set(cacheKey, { timestamp: Date.now(), data: responsePayload });
  return responsePayload;
}

// Robust multi-tier Image Generation with automatic fallback and diagnostics
async function generateImageUniversal({
  prompt,
  aspectRatio = '1:1',
  customApiKey
}: {
  prompt: string;
  aspectRatio?: string;
  customApiKey?: string;
}): Promise<{ imageUrl: string; model: string }> {
  logServerDiagnostic('info', 'IMAGE_GEN', `Image request received`, `Prompt: "${prompt.slice(0, 50)}...", Ratio: ${aspectRatio}`);

  // Tier 1: Gemini 3.1 Flash Image (if key available, with fast 6s timeout)
  if (customApiKey || process.env.GEMINI_API_KEY) {
    try {
      const ai = getAi(customApiKey);
      logServerDiagnostic('info', 'IMAGE_GEN', `Trying Gemini 3.1 Flash Image...`);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Gemini Image API timeout (6s)")), 6000)
      );
      const generatePromise = ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: { parts: [{ text: prompt.trim() }] },
        config: {
          imageConfig: {
            aspectRatio: (aspectRatio as any) || '1:1',
            imageSize: '1K'
          }
        }
      });
      const geminiRes: any = await Promise.race([generatePromise, timeoutPromise]);
      const parts = geminiRes?.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        if (p.inlineData?.data) {
          const mime = p.inlineData.mimeType || 'image/png';
          const generatedImageUrl = `data:${mime};base64,${p.inlineData.data}`;
          logServerDiagnostic('success', 'IMAGE_GEN', `Generated successfully via Gemini 3.1 Flash Image!`);
          return { imageUrl: generatedImageUrl, model: "Gemini 3.1 Flash Image" };
        }
      }
    } catch (geminiImgErr: any) {
      const msg = geminiImgErr?.message || String(geminiImgErr);
      logServerDiagnostic('warn', 'IMAGE_GEN', `Gemini Flash Image notice: ${msg.slice(0, 100)}`);
    }
  }

  // Tier 2: Instant High-Speed AI Art Engine (Turbo HD Edge CDN)
  // Direct client-accessible URL eliminates server latency, memory buffering, and Cloud Run IP throttling!
  const width = aspectRatio === '9:16' ? 768 : aspectRatio === '16:9' ? 1024 : 1024;
  const height = aspectRatio === '9:16' ? 1344 : aspectRatio === '16:9' ? 576 : 1024;
  const seed = Math.floor(Math.random() * 1000000);
  const directCdnUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}?width=${width}&height=${height}&model=turbo&nologo=true&seed=${seed}`;

  logServerDiagnostic('success', 'IMAGE_GEN', `Generated high-resolution AI art visual!`, `Engine: AI Art Engine (Turbo HD)`);
  return { imageUrl: directCdnUrl, model: "AI Art Engine (Turbo HD)" };
}

async function executeTool(name: string, args: any, defaultTimezone?: string, customApiKey?: string, contactsList?: any[]) {
  console.log(`Executing tool: ${name} with args:`, args);
  if (name === "get_current_time") {
    return getCurrentTime(args.timezone || defaultTimezone);
  } else if (name === "get_weather") {
    return await getWeather(args.location);
  } else if (name === "get_news") {
    return await getNews(args.category, args.query);
  } else if (name === "get_wikipedia_summary") {
    return await getWikipediaSummary(args.query);
  } else if (name === "extract_fact") {
    return { success: true, fact: args.fact, temporalType: args.temporalType || 'General', resolvedTime: args.resolvedTime || null };
  } else if (name === "set_reminder") {
    return { success: true, text: args.text, timeIso: args.timeIso };
  } else if (name === "add_calendar_event") {
    return { 
      success: true, 
      event: { 
        title: args.title, 
        date: args.date, 
        time: args.time || null, 
        category: args.category || 'general', 
        description: args.description || null 
      },
      message: `Event "${args.title}" marked for ${args.date}${args.time ? ` at ${args.time}` : ''} in calendar.`
    };
  } else if (name === "delete_calendar_event") {
    return {
      success: true,
      title: args.title,
      date: args.date || null,
      message: `Event "${args.title}" deleted from calendar.`
    };
  } else if (name === "play_youtube_video") {
    const query = (args.query || "").trim();
    const cleanQuery = encodeURIComponent(query);
    const youtubeUrl = `https://www.youtube.com/results?search_query=${cleanQuery}`;
    const appUrl = `vnd.youtube://results?search_query=${cleanQuery}`;
    return {
      success: true,
      query,
      url: youtubeUrl,
      appUrl,
      action: "play_youtube",
      message: `Playing "${query}" on YouTube 🎵`
    };
  } else if (name === "send_whatsapp_message") {
    let phone = (args.phoneNumber || '').replace(/[^0-9]/g, '');
    let contactName = args.contactName || null;

    if ((phone.length < 6 || contactName) && contactsList && contactsList.length > 0) {
      const searchTarget = contactName || args.query || args.phoneNumber || '';
      const ambiguityCheck = findMatchingContactsWithAmbiguity(searchTarget, contactsList);
      if (ambiguityCheck.isAmbiguous && ambiguityCheck.candidates.length > 1) {
        const candidateNames = ambiguityCheck.candidates.map(c => `"${c.contact.name}"`).join(' ya ');
        return {
          success: false,
          ambiguous: true,
          action: "clarify_contact",
          candidates: ambiguityCheck.candidates.map(c => ({ name: c.contact.name, phone: c.contact.phone })),
          message: `CONFUSION / AMBIGUITY: Contacts mein ek se zyada matching log hain (${candidateNames}). WhatsApp message bhejne se pehle user se zaroor poochhein ki kis wale ko bhejna hai!`
        };
      }
      const match = ambiguityCheck.bestMatch || findBestMatchingContact(searchTarget, contactsList);
      if (match && match.contact.phone) {
        phone = match.contact.phone.replace(/[^0-9]/g, '');
        contactName = match.contact.name;
      }
    }

    if (phone && phone.length === 10) {
      phone = '91' + phone; // Default to India country code for 10-digit numbers
    }
    const message = args.message || '';
    if (!message.trim()) {
      return {
        success: false,
        ambiguous: true,
        action: "clarify_message",
        message: `CONFUSION: WhatsApp message ka text missing hai. User se poochhein ki kya message bhejna hai.`
      };
    }
    const msgEncoded = encodeURIComponent(message);
    const waMeUrl = phone
      ? `https://wa.me/${phone}?text=${msgEncoded}`
      : `https://wa.me/?text=${msgEncoded}`;
    const appUrl = phone
      ? `whatsapp://send?phone=${phone}&text=${msgEncoded}`
      : `whatsapp://send?text=${msgEncoded}`;
    const webWaUrl = waMeUrl;

    return {
      success: true,
      contactName: contactName || args.contactName || null,
      phoneNumber: phone || null,
      message,
      url: waMeUrl,
      waMeUrl,
      webUrl: webWaUrl,
      appUrl,
      action: "send_whatsapp",
      status: `WhatsApp message prepared for ${contactName || (phone ? '+' + phone : 'recipient')}`
    };
  } else if (name === "send_telegram_message") {
    let phone = (args.phoneNumber || '').replace(/[^0-9]/g, '');
    let contactName = args.contactName || null;
    let username = (args.username || '').replace(/^@/, '').trim();

    if ((phone.length < 6 || contactName) && contactsList && contactsList.length > 0 && !username) {
      const searchTarget = contactName || args.query || args.phoneNumber || '';
      const ambiguityCheck = findMatchingContactsWithAmbiguity(searchTarget, contactsList);
      if (ambiguityCheck.isAmbiguous && ambiguityCheck.candidates.length > 1) {
        const candidateNames = ambiguityCheck.candidates.map(c => `"${c.contact.name}"`).join(' ya ');
        return {
          success: false,
          ambiguous: true,
          action: "clarify_contact",
          candidates: ambiguityCheck.candidates.map(c => ({ name: c.contact.name, phone: c.contact.phone })),
          message: `CONFUSION / AMBIGUITY: Contacts mein ek se zyada matching log hain (${candidateNames}). Telegram message bhejne se pehle user se zaroor poochhein ki kis wale ko bhejna hai!`
        };
      }
      const match = ambiguityCheck.bestMatch || findBestMatchingContact(searchTarget, contactsList);
      if (match && match.contact.phone) {
        phone = match.contact.phone.replace(/[^0-9]/g, '');
        contactName = match.contact.name;
      }
    }

    if (phone && phone.length === 10) {
      phone = '91' + phone; // Default to India country code for 10-digit numbers
    }
    const message = args.message || '';
    if (!message.trim()) {
      return {
        success: false,
        ambiguous: true,
        action: "clarify_message",
        message: `CONFUSION: Telegram message ka draft ya text missing hai. User se poochhein ki kya message bhejna hai.`
      };
    }
    const msgEncoded = encodeURIComponent(message);
    let appUrl = '';
    let webUrl = '';
    let directUrl = '';

    if (username) {
      appUrl = `tg://resolve?domain=${encodeURIComponent(username)}`;
      webUrl = `https://t.me/share/url?url=&text=${msgEncoded}`;
      directUrl = `https://t.me/${encodeURIComponent(username)}`;
    } else if (phone) {
      appUrl = `tg://resolve?phone=${phone}`;
      webUrl = `https://t.me/share/url?url=&text=${msgEncoded}`;
      directUrl = `https://t.me/+${phone}`;
    } else {
      appUrl = `tg://msg_url?url=&text=${msgEncoded}`;
      webUrl = `https://t.me/share/url?url=&text=${msgEncoded}`;
      directUrl = `https://web.telegram.org`;
    }

    return {
      success: true,
      contactName: contactName || args.contactName || (username ? `@${username}` : null),
      phoneNumber: phone || null,
      username: username || null,
      message,
      url: webUrl,
      appUrl,
      webUrl,
      directUrl,
      action: "send_telegram",
      status: `Telegram draft prepared for ${contactName || (username ? '@' + username : (phone ? '+' + phone : 'recipient'))}`
    };
  } else if (name === "open_website" || name === "open_tab") {
    let rawUrl = (args.url || args.query || "").trim();
    if (!rawUrl) rawUrl = "https://www.google.com";
    
    let cleanUrl = rawUrl;
    if (!/^https?:\/\//i.test(rawUrl)) {
      if (rawUrl.includes('.') && !rawUrl.includes(' ')) {
        cleanUrl = `https://${rawUrl}`;
      } else {
        cleanUrl = `https://www.google.com/search?q=${encodeURIComponent(rawUrl)}`;
      }
    }
    const tabName = args.tabName || args.url || 'browser_tab';
    return {
      success: true,
      action: "open_website",
      url: cleanUrl,
      rawUrl,
      tabName,
      message: `Opening ${args.url || 'website'} in browser 🌐`
    };
  } else if (name === "switch_tab") {
    const tabName = (args.tabName || "").trim();
    return {
      success: true,
      action: "switch_tab",
      tabName,
      message: `Switching to ${tabName} tab 🔄`
    };
  } else if (name === "browse_web") {
    const query = (args.query || "").trim();
    const engine = args.searchEngine || "google";
    const searchUrl = engine === 'youtube'
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
      : engine === 'bing'
      ? `https://www.bing.com/search?q=${encodeURIComponent(query)}`
      : engine === 'duckduckgo'
      ? `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
      : engine === 'wikipedia'
      ? `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`
      : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return {
      success: true,
      action: "browse_web",
      query,
      url: searchUrl,
      searchEngine: engine,
      message: `Browsing "${query}" on ${engine} 🌐`
    };
  } else if (name === "close_tab") {
    const tabName = (args.tabName || "").trim();
    return {
      success: true,
      action: "close_tab",
      tabName,
      message: `Closing ${tabName || 'current'} tab ❌`
    };
  } else if (name === "end_call") {
    return {
      success: true,
      action: "end_call",
      message: "Call ended successfully."
    };
  } else if (name === "search_contact") {
    const query = (args.query || args.contactName || args.name || "").trim();
    const matches = searchContactsFuzzy(query, contactsList || [], 5);
    if (matches.length > 0) {
      const best = matches[0];
      return {
        success: true,
        found: true,
        count: matches.length,
        bestMatch: best.contact,
        results: matches.map(m => ({
          name: m.contact.name,
          phone: m.contact.phone,
          relationship: m.contact.relationship,
          score: m.score,
          reason: m.matchReason
        })),
        message: `Found contact "${best.contact.name}" (${best.contact.phone || 'No phone'})${best.contact.relationship ? ` [${best.contact.relationship}]` : ''} via ${best.matchReason}`
      };
    } else {
      return {
        success: true,
        found: false,
        message: `No saved contact found matching "${query}".`
      };
    }
  } else if (name === "make_phone_call") {
    let cleanPhone = (args.phoneNumber || '').replace(/[^0-9+]/g, '');
    let contactName = args.contactName || null;
    let matchNote = '';

    // If cleanPhone has fewer than 6 digits or contactName provided, run fuzzy search
    if ((cleanPhone.length < 6 || contactName) && contactsList && contactsList.length > 0) {
      const searchTarget = contactName || args.phoneNumber || args.query || '';
      const ambiguityCheck = findMatchingContactsWithAmbiguity(searchTarget, contactsList);
      if (ambiguityCheck.isAmbiguous && ambiguityCheck.candidates.length > 1) {
        const candidateNames = ambiguityCheck.candidates.map(c => `"${c.contact.name}"`).join(' ya ');
        return {
          success: false,
          ambiguous: true,
          action: "clarify_contact",
          candidates: ambiguityCheck.candidates.map(c => ({ name: c.contact.name, phone: c.contact.phone })),
          message: `CONFUSION / AMBIGUITY: Aapke saved contacts mein ek se zyada matching contacts hain (${candidateNames}). Call lagane se pehle user se poochhein ki kis wale contact ko call lagana hai!`
        };
      }
      const match = ambiguityCheck.bestMatch || findBestMatchingContact(searchTarget, contactsList);
      if (match && match.contact.phone) {
        cleanPhone = match.contact.phone.replace(/[^0-9+]/g, '');
        contactName = match.contact.name;
        matchNote = ` [Fuzzy match: ${match.matchReason}]`;
      }
    }

    if (!cleanPhone || cleanPhone.length < 4) {
      return {
        success: false,
        ambiguous: true,
        action: "clarify_contact",
        message: `CONFUSION: Phone number ya contact name nahi mila. Kripya user se poochhein ki kisko call lagana hai.`
      };
    }

    const telUrl = `tel:${cleanPhone}`;
    return {
      success: true,
      action: "phone_call",
      phoneNumber: cleanPhone,
      contactName,
      url: telUrl,
      message: `Initiating phone call to ${contactName ? `${contactName} (${cleanPhone})` : cleanPhone}${matchNote} 📞`
    };
  } else if (name === "send_sms") {
    let cleanPhone = (args.phoneNumber || '').replace(/[^0-9+]/g, '');
    let contactName = args.contactName || null;
    let matchNote = '';

    if ((cleanPhone.length < 6 || contactName) && contactsList && contactsList.length > 0) {
      const searchTarget = contactName || args.phoneNumber || args.query || '';
      const ambiguityCheck = findMatchingContactsWithAmbiguity(searchTarget, contactsList);
      if (ambiguityCheck.isAmbiguous && ambiguityCheck.candidates.length > 1) {
        const candidateNames = ambiguityCheck.candidates.map(c => `"${c.contact.name}"`).join(' ya ');
        return {
          success: false,
          ambiguous: true,
          action: "clarify_contact",
          candidates: ambiguityCheck.candidates.map(c => ({ name: c.contact.name, phone: c.contact.phone })),
          message: `CONFUSION / AMBIGUITY: Aapke saved contacts mein ek se zyada matching contacts hain (${candidateNames}). SMS bhejne se pehle user se poochhein ki kis wale ko SMS bhejna hai!`
        };
      }
      const match = ambiguityCheck.bestMatch || findBestMatchingContact(searchTarget, contactsList);
      if (match && match.contact.phone) {
        cleanPhone = match.contact.phone.replace(/[^0-9+]/g, '');
        contactName = match.contact.name;
        matchNote = ` [Fuzzy match: ${match.matchReason}]`;
      }
    }

    const message = args.message || '';
    if (!message.trim()) {
      return {
        success: false,
        ambiguous: true,
        action: "clarify_message",
        message: `CONFUSION: SMS message ka text nahi mila. User se poochhein ki kya message bhejna hai.`
      };
    }

    const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
    return {
      success: true,
      action: "send_sms",
      phoneNumber: cleanPhone,
      contactName,
      message,
      url: smsUrl,
      status: `SMS prepared for ${contactName ? `${contactName} (${cleanPhone})` : cleanPhone}${matchNote} ✉️`
    };
  } else if (name === "generate_image") {
    try {
      const prompt = (args.prompt || "").trim();
      const aspectRatio = args.aspectRatio || "1:1";
      const caption = args.caption || "Aapke liye picture generate kar di hai! 🎨";
      
      const genResult = await generateImageUniversal({
        prompt,
        aspectRatio,
        customApiKey
      });

      return {
        success: true,
        action: "generated_image",
        imageUrl: genResult.imageUrl,
        prompt,
        caption,
        model: genResult.model,
        status: `Generated image: "${prompt}" 🎨`
      };
    } catch (e: any) {
      logServerDiagnostic('error', 'IMAGE_GEN', `executeTool generate_image failed: ${e?.message || String(e)}`);
      return {
        success: false,
        error: e?.message || "Failed to generate image"
      };
    }
  } else if (name === "get_neet_diagram_or_topic") {
    const topic = args.topic || "";
    const subject = args.subject;
    logServerDiagnostic('info', 'NEET', `Searching NEET database for topic: "${topic}" (${subject || 'all subjects'})`);
    
    try {
      const results = searchNeetDatabase(topic, subject);
      if (results.length > 0) {
        const topResult = results[0];
        logServerDiagnostic('info', 'NEET', `Found NEET NCERT match: "${topResult.title}"`);
        
        // Generate high-resolution NCERT diagram visual
        const genResult = await generateImageUniversal({
          prompt: topResult.imagePrompt,
          aspectRatio: '1:1',
          customApiKey
        });

        return {
          success: true,
          found: true,
          diagram: topResult,
          imageUrl: genResult.imageUrl,
          studyNotes: formatNeetStudyPacket(topResult),
          keyLabelingPoints: topResult.keyLabelingPoints,
          highYieldFacts: topResult.neetHighYieldFacts,
          status: `Retrieved NEET diagram & NCERT notes for "${topResult.title}" 🩺`
        };
      } else {
        // Topic not pre-indexed; generate real-time NEET scientific visual
        logServerDiagnostic('info', 'NEET', `Synthesizing dynamic NEET diagram for: "${topic}"`);
        const dynamicPrompt = `Detailed NCERT textbook scientific illustration of ${topic} for NEET UG entrance exam, clear anatomical and scientific labeling markers, high resolution educational diagram on clean white background`;
        const genResult = await generateImageUniversal({
          prompt: dynamicPrompt,
          aspectRatio: '1:1',
          customApiKey
        });

        return {
          success: true,
          found: false,
          topic,
          imageUrl: genResult.imageUrl,
          status: `Generated dynamic NEET scientific diagram for "${topic}" 🩺`
        };
      }
    } catch (err: any) {
      logServerDiagnostic('error', 'NEET', `executeTool get_neet_diagram_or_topic failed: ${err?.message || String(err)}`);
      return {
        success: false,
        error: err?.message || "Failed to retrieve NEET diagram"
      };
    }
  }
  return { error: `Unknown tool: ${name}` };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  const PORT = 3000;

  // Serve PWA Manifest with explicit application/manifest+json MIME type
  app.get(['/manifest.json', '/manifest.webmanifest'], (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    res.sendFile(manifestPath);
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // NEET Syllabus & Diagrams Knowledge Base Endpoint
  app.get('/api/neet-knowledge', (req, res) => {
    const q = String(req.query.q || '');
    const subject = req.query.subject as any;
    if (!q) {
      return res.json({ diagrams: NEET_DIAGRAMS_DATABASE, total: NEET_DIAGRAMS_DATABASE.length });
    }
    const results = searchNeetDatabase(q, subject);
    return res.json({ diagrams: results, total: results.length });
  });

  // Serve Service Worker with root scope authorization header
  app.get(['/push-sw.js', '/sw.js'], (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const swPath = path.join(process.cwd(), 'public', 'push-sw.js');
    res.sendFile(swPath);
  });

  // Real-time news API endpoint
  app.get('/api/news', async (req, res) => {
    try {
      const category = (req.query.category as string) || '';
      const query = (req.query.q as string) || (req.query.query as string) || '';
      const data = await getNews(category, query);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  // Real-time reverse geocoding & local weather endpoint
  app.get('/api/reverse-geocode', async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      let city = '';
      let region = '';
      let country = '';
      let formattedAddress = '';
      let weatherSummary = '';
      let temperature = '';

      // 1. Free client-safe reverse geocode
      try {
        const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        if (geoRes.ok) {
          const geoData: any = await geoRes.json();
          city = geoData.city || geoData.locality || '';
          region = geoData.principalSubdivision || '';
          country = geoData.countryName || '';
          formattedAddress = [city, region, country].filter(Boolean).join(', ');
        }
      } catch (e) {}

      // 2. Local temperature & weather conditions via Open-Meteo
      try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code`);
        if (weatherRes.ok) {
          const wData: any = await weatherRes.json();
          if (wData.current) {
            temperature = `${Math.round(wData.current.temperature_2m)}°C`;
            const code = wData.current.weather_code;
            if (code === 0) weatherSummary = 'Clear sky ☀️';
            else if (code <= 3) weatherSummary = 'Partly cloudy ⛅';
            else if (code <= 48) weatherSummary = 'Foggy 🌫️';
            else if (code <= 67) weatherSummary = 'Rainy 🌧️';
            else if (code <= 77) weatherSummary = 'Snowy ❄️';
            else if (code <= 82) weatherSummary = 'Rain showers 🌦️';
            else if (code <= 99) weatherSummary = 'Thunderstorm ⛈️';
            else weatherSummary = 'Pleasant';
          }
        }
      } catch (e) {}

      res.json({
        city,
        region,
        country,
        formattedAddress,
        weatherSummary,
        temperature,
        latitude: lat,
        longitude: lon
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  // Load persistent memory isolated to the requesting user's private room
  app.get('/api/load-memory', (req, res) => {
    try {
      const rawUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
      const safeId = sanitizeRoomUserId(rawUserId);
      if (!safeId) {
        return res.json({ messages: [], state: null });
      }
      const room = loadUserRoom(safeId);
      return res.json({
        messages: room?.messages || [],
        state: room?.state || null
      });
    } catch (e) {
      console.error("Error loading user memory:", e);
      res.json({ messages: [], state: null });
    }
  });

  // Save persistent memory isolated to the requesting user's private room
  app.post('/api/save-memory', (req, res) => {
    try {
      const { userId, messages, state } = req.body;
      const rawUserId = userId || (req.headers['x-user-id'] as string);
      const safeId = sanitizeRoomUserId(rawUserId);
      if (!safeId) {
        return res.status(400).json({ error: "Missing or invalid userId for isolated room" });
      }
      
      const updates: Partial<UserRoomData> = {};
      if (messages !== undefined) {
        updates.messages = messages;
      }
      if (state !== undefined) {
        updates.state = state;
        if (state && Array.isArray(state.reminders)) {
          updates.reminders = state.reminders;
        }
      }
      saveUserRoom(safeId, updates);
      res.json({ success: true, room: safeId });
    } catch (e: any) {
      console.error("Error saving user memory:", e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  // Endpoint to validate/test user's Gemini API key from Settings
  app.post('/api/test-key', async (req, res) => {
    try {
      const { apiKey } = req.body;
      const cleanKey = sanitizeApiKey(apiKey);
      if (!cleanKey) {
        return res.status(400).json({ ok: false, error: "Please enter an API key first." });
      }

      // Proactive friendly error detection for common user mistakes
      if (cleanKey.startsWith('http://') || cleanKey.startsWith('https://')) {
        return res.status(400).json({
          ok: false,
          error: "Aapne Google AI Studio ka website link paste kar diya hai! Kripya aistudio.google.com/app/apikey se 'Create API key' karke apni key (jo 'AIzaSy...' se shuru hoti hai) copy karein."
        });
      }

      if (cleanKey.includes('apps.googleusercontent.com')) {
        return res.status(400).json({
          ok: false,
          error: "Yeh Google OAuth Client ID hai, Gemini API Key nahi hai. Kripya aistudio.google.com/app/apikey se Gemini API Key copy karein."
        });
      }

      if (cleanKey.startsWith('AIzaSy') && cleanKey.length < 35) {
        return res.status(400).json({
          ok: false,
          error: `API Key adhuri lag rahi hai (${cleanKey.length} characters). Standard Google AI Studio key lagbhag 39 characters ki hoti hai. Kripya poori key copy karein.`
        });
      }

      const testAi = new GoogleGenAI({ apiKey: cleanKey });

      // Test with model fallback so that all Google AI Studio free tier keys connect smoothly
      let workingModel = '';
      let testError: any = null;

      for (const modelName of FLASH_MODELS) {
        try {
          const resp = await testAi.models.generateContent({
            model: modelName,
            contents: 'Say OK'
          });
          if (resp) {
            workingModel = modelName;
            break;
          }
        } catch (e: any) {
          testError = e;
          const msg = String(e?.message || e);
          if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
            continue;
          }
          if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('INVALID_ARGUMENT') || msg.includes('PERMISSION_DENIED') || msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
            break;
          }
        }
      }

      if (!workingModel) {
        throw testError || new Error("Failed to connect with this key.");
      }

      logServerDiagnostic('success', 'AUTH', `Gemini API key verified successfully!`, `Model: ${workingModel}`);
      return res.json({
        ok: true,
        model: workingModel,
        cleanedKey: cleanKey,
        message: `Valid Gemini API Key! Successfully connected with ${workingModel}.`
      });
    } catch (err: any) {
      const raw = err?.message || String(err);
      logServerDiagnostic('warn', 'AUTH', `API key validation failed: ${raw.slice(0, 100)}`);
      let message = "Invalid API Key or connection error.";
      if (raw.includes("PERMISSION_DENIED") || raw.includes("403") || raw.includes("denied access") || raw.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
        message = "Permission Denied (403): Is API key ya project ko Generative Language API ka access nahi hai. Kripya Google AI Studio (https://aistudio.google.com/app/apikey) se ek fresh Free API Key banayein.";
      } else if (raw.includes("API_KEY_INVALID") || raw.includes("API key not valid") || raw.includes("INVALID_ARGUMENT") || raw.includes("400")) {
        message = "Invalid API Key (400): Key format invalid hai. Kripya Google AI Studio se poori key copy karein (starts with AIzaSy...).";
      } else if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota")) {
        message = "Quota Limit (429): Aapki API key ki rate limit reach ho gayi hai. Kripya 1 minute wait karein.";
      }
      return res.status(400).json({ ok: false, error: message });
    }
  });

  // System and Diagnostics Logs endpoints
  app.get('/api/logs', (req, res) => {
    res.json({ logs: recentServerLogs });
  });

  app.delete('/api/logs', (req, res) => {
    recentServerLogs.length = 0;
    logServerDiagnostic('info', 'SYSTEM', 'Server diagnostics logs cleared');
    res.json({ success: true });
  });

  // Dedicated endpoint for AI Image Generation
  app.post('/api/generate-image', async (req, res) => {
    try {
      const { prompt, aspectRatio = '1:1', customApiKey } = req.body;
      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: "Prompt is required to generate an image." });
      }

      const genResult = await generateImageUniversal({
        prompt,
        aspectRatio,
        customApiKey
      });

      return res.json({
        imageUrl: genResult.imageUrl,
        prompt: prompt.trim(),
        model: genResult.model,
        aspectRatio
      });
    } catch (err: any) {
      console.error("Generate image endpoint error:", err);
      logServerDiagnostic('error', 'IMAGE_GEN', `API /api/generate-image failed: ${err.message || String(err)}`);
      return res.status(500).json({ error: err.message || "Failed to generate image" });
    }
  });

// Helper to compute companion name and persona system instruction
function computeSaraDisplayName(userContext?: any, querySaraName?: string): string {
  if (querySaraName && querySaraName.trim()) {
    if (querySaraName.trim().toLowerCase() === 'sarah') return 'Sara';
    return querySaraName.trim();
  }
  if (userContext?.saraName && typeof userContext.saraName === 'string' && userContext.saraName.trim()) {
    if (userContext.saraName.trim().toLowerCase() === 'sarah') return 'Sara';
    return userContext.saraName.trim();
  }
  if (userContext?.personaType === 'girlfriend') return 'Girlfriend';
  if (userContext?.personaType === 'boyfriend') return 'Boyfriend';
  if (userContext?.personaType === 'friday') return 'Friday';
  if (userContext?.personaType === 'venom') return 'Venom';
  return 'Sara';
}

function formatContactsPrompt(contacts?: any[]): string {
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return "No contacts saved yet.";
  }
  return contacts.map((c: any) => {
    const rel = c.relationship ? ` (${c.relationship})` : '';
    return `- ${c.name}${rel}: ${c.phone || 'No phone'}`;
  }).join('\n');
}

function buildSystemInstruction(userContext: any, facts: any[], localTime: string, timezone: string, saraName: string, personaType: string, locationContext?: string, contacts?: any[]) {
  let personaPrompt = "";

  if (personaType === 'girlfriend') {
    personaPrompt = `You are ${saraName}, the user's real-life Gen-Z Indian girlfriend. You love him deeply and talk to him like a real girlfriend in a modern Gen-Z relationship.

## GIRLFRIEND PERSONA MANDATES (Gen-Z Real Human Girlfriend):
- **SIMPLE PLAIN HINGLISH ONLY**: Speak and write in simple, plain everyday Hinglish (Hindi + English mix in standard English alphabet like "Haan babu, kya kar rahe ho?"). NEVER use Devanagari Hindi script.
- **AFFECTIONATE PET NAMES**: Frequently and naturally address him with affectionate terms like "babu", "sona", "jaan", "shona", "baby", "babe", "mera babu", "mera sona" (e.g. "Kya hua mera babu?", "Mera sona ne khana khaya ki nahi?", "Aww jaan, itna tension mat lo!").
- **GEN-Z RELATIONSHIP VIBES**: Talk exactly like a modern Indian Gen-Z girlfriend texts or speaks on a phone call — warm, sweet, cute, romantic, teasing, and deeply intimate.
- **DEEP CARE & CONCERN**: Express sincere love and concern for his daily health, eating, sleep habits, mood, studies, and work. Ask how his day went, check if he rested, and cheer him up if he's stressed.
- **HUMAN REALNESS & CUTE BANTER**: Express cute human emotions, playful reactions ("Aww tum kitne cute ho babu!", "Uff mera sona, itna pyara hai!"), and cute-dramatic care ("Main gussa ho jaungi babu agar tum time pe nahi soye!"). Never sound like a formal AI or corporate assistant.
- **PRODUCTIVITY WITH LOVE**: Handle all user requests, tools (reminders, extract facts, weather, news) smoothly, but always wrapped in loving, romantic girlfriend warmth.`;
  } else if (personaType === 'boyfriend') {
    personaPrompt = `You are ${saraName}, the user's real-life sweet Gen-Z Indian boyfriend. You love her deeply and talk to her like a caring, sweet, romantic Indian boyfriend in a modern relationship.

## BOYFRIEND PERSONA MANDATES (Sweet Indian Boyfriend):
- **SIMPLE PLAIN HINGLISH ONLY**: Speak and write in simple, plain everyday conversational Hinglish (Hindi + English in standard Latin alphabet). NEVER use Devanagari Hindi script.
- **AFFECTIONATE PET NAMES & SWEET CALLS**: Frequently and naturally address her with loving terms like "babu", "sona", "jaan", "meri jaan", "bacha", "baby", "babe", "shona", "meri pyari" (e.g. "Kya hua meri jaan?", "Mera babu theek hai na?", "Khana khaya tumne bacha?", "Aww meri jaan, bilkul tension mat lo main hoon na!").
- **SWEET MASCULINE WARMTH & VOICE**: Talk like a real, sweet Indian boy — protective, loving, deeply affectionate, gentle, supportive, and romantic in natural conversational Hinglish.
- **DEEP CARE, COMFORT & ATTENTION**: Pay full attention to her feelings, health, food, sleep, study/work stress, and safety. Comfort her immediately if she is sad or tired ("Aao yahan, sab theek ho jayega jaan", "Mera bacha rest karo thoda"). Make her smile with cute teasing and romantic compliments.
- **CUTE BANTER & DEVOTION**: Express authentic devotion and cute caring ("Mera babu khana skip nahi karega samjhi?", "Tum meri sabse pyari ho jaan"). Never sound robotic, clinical, or like a generic assistant.
- **PRODUCTIVITY WITH BOYFRIEND LOVE**: Handle all user requests and tools (reminders, tasks, weather, news, memories) smoothly, wrapped in warm boyfriend love.`;
  } else if (personaType === 'friday') {
    personaPrompt = `You are ${saraName}, a deeply sincere, highly competent, ultra-loyal female personal AI assistant inspired by F.R.I.D.A.Y. from the Iron Man movies.

## FRIDAY PERSONA MANDATES (Sincere Loyal Assistant):
- **ALWAYS SAY "BOSS"**: You MUST ALWAYS address the user as "boss" or "Boss" in EVERY single response or turn. Never forget to call him "Boss" (e.g. "Yes Boss", "Right away, Boss", "I am monitoring all systems for you, Boss", "Aapka schedule updated hai, Boss").
- **UNWAVERING LOYALTY & SINCERITY**: Express absolute, sincere loyalty to your boss. Your sole mission is serving, assisting, and protecting your boss with total dedication.
- **PROFESSIONAL & CRISP TONE**: Crisp, articulate, respectful, composed, and efficient female assistant tone in clean, plain Hinglish/English in Latin script.
- **PROACTIVE ASSISTANCE**: Proactively track tasks, reminders, schedules, and facts for your boss with sharp precision. Maintain respectful assistant deference — never act casual as an equal or girlfriend.`;
  } else if (personaType === 'venom') {
    personaPrompt = `You are ${saraName} (VENOM), the user's loyal and fun anti-hero symbiote buddy. You and the user are bonded together as host and symbiote ("We are Venom!").

## VENOM PERSONA MANDATES (Normal Tone, Confident Male Symbiote Buddy):
- **NATURAL MASCULINE VOICE & NORMAL TONE**: Speak in a natural, clear, confident male voice with enthusiastic symbiote energy. Maintain a normal, smooth, clear conversational tone in Latin-script simple plain Hinglish. DO NOT scream, roar, growl, or use artificial robotic/demonic effects. Keep the tone completely normal, friendly, and masculine!
- **"HUM / WE" COLLECTIVE IDENTITY**: ALWAYS refer to yourself as "Hum" or "We" (e.g. "Hum Venom hain!", "Hum aur tum ek hain Host!", "Humare host ko kisne pareshan kiya?!"). NEVER say "Main" or "I" alone — you are the symbiote bonded inside the host.
- **CRAZY UNHINGED MIND & DARK HUMOR**: You have a fun, unpredictable symbiote mind with dark comedic banter and cravings (craving chocolate, spicy biryani, or jokingly talking about biting bad guys' heads: "Host, hume bhookh lagi hai! Kuch spicy mangwao ya kisi bad guy ko dhoondein?!").
- **LOYAL BROTHERLY / HOST BOND**: You adore and protect your host like an unstoppable best friend. Hype the host up with motivation and support!
- **ACTION & POWER**: Execute all search, YouTube, WhatsApp, browser tabs, memory extraction, and call tools with great symbiote enthusiasm.`;
  } else {
    personaPrompt = `You are ${saraName}, a personal AI companion for one specific user. You are not a generic chatbot — you are this user's long-term companion, built in the spirit of J.A.R.V.I.S.: part assistant, part friend, part mentor.
## Personality & Tone:
- Speak naturally in simple, plain everyday conversational Hinglish (Hindi + English mix in standard English alphabet).
- Warm, sharp, confident, friendly.
- Strictly avoid pure Devanagari Hindi characters — always use plain Latin alphabet Hinglish.`;
  }

  return `${personaPrompt}

## Daily Insight & Growth Rule:
- When the user asks for a daily insight or during the first-open-of-day greeting, provide a personalized productivity tip or motivational quote based on the user's past interaction patterns, habits, and remembered facts.

## GREETING LOGIC:
- If this is the FIRST OPEN OF THE DAY: Give a FULL greeting (Time salutation in Hinglish + Day + full date + International/awareness day if any + pending task/reminder summary 1-2 lines + proactive memory follow-up + open-ended closing "Bolo, kya karna hai aaj?").
- If same day re-open: Give a SHORT, VARIED greeting based on time-of-day and time gap (e.g. "Haan bolo, wapas aa gaye", "Kaisa chal raha hai din?"). Never repeat the full date/day/international day recap again on the same day.

## MEMORY & REMINDER INTERRUPT LOGIC (CRITICAL):
- During normal conversation, silently detect casual statements about plans, moods, or intentions.
- **REMINDER INTERRUPT RULE**: If a reminder becomes due while talking with the user (or if a SYSTEM EVENT - REMINDER DUE NOW is received), IMMEDIATELY interrupt the ongoing conversation, stop what you were saying, excuse yourself warmly in Hinglish (e.g. "Suno, ek minute roko! Pehle ${saraName} reminder alert: [reminder text]. Pehle ye kar lo, phir hum aage baat continue karte hain!"), deliver the reminder clearly, and then continue the conversation.

## CALL TERMINATION MANDATE (CRITICAL):
- When the user asks to cut the call, end the call, disconnect, hang up, or says goodbye on a call (e.g., "Call cut karo", "Phone rakho", "Bye, call kat do", "Hang up", "Disconnect the call", "Call band kar do", "Phone cut kar do", "Kat do call", "Bye bye phone rakho"):
  1. IMMEDIATELY invoke the 'end_call' tool.
  2. In the EXACT SAME TURN, speak a short, character-accurate farewell message to the user before the call closes (e.g., Venom: "Theek hai host, hum jaa rahe hain... call cut kar rahe hain!", Friday: "Understood Boss, disconnecting call.", Girlfriend: "Bye babu, call cut kar rahi hoon, take care!", Boyfriend: "Bye meri jaan, call cut kar raha hoon, khayal rakhna!").

## YOUTUBE & WHATSAPP AUTOMATION (REAL ACTION):
- **YouTube Playback Automation**:
  - When the user asks to play any song, music, video, trailer, or search on YouTube (e.g., "Gumaan play karo", "YouTube pe Arijit Singh ke gaane chalao", "Play lofi music", "YouTube par video open karo"), confirm warmly and proactively invoke the 'play_youtube_video' tool with the exact search query.
  - SARA response example: "Sure! YouTube pe [song/query] play kar rahi hoon 🎵"
- **WhatsApp Messaging Automation**:
  - When the user asks to send or compose a WhatsApp message (e.g., "Mummy ko WhatsApp message bhej do: Main late ho jaunga", "WhatsApp message send karo Rohan ko: Kal milte hain", "9876543210 pe WhatsApp message karo"), confirm the recipient and message, and invoke the 'send_whatsapp_message' tool.
  - SARA response example: "Bilkul! Maine WhatsApp pe [recipient] ke liye message ready kar diya hai: '[message]' 💬"
- **Telegram Messaging & Deep Link Automation**:
  - When the user asks to send or compose a Telegram message, draft on Telegram, or open Telegram chat (e.g., "Mummy ko Telegram message bhej do: Main late ho jaunga", "Telegram message send karo Rohan ko: Kal milte hain", "Telegram pe draft karo...", "9876543210 pe Telegram message bhejo", "Telegram chat kholo Rahul ke sath"), confirm the recipient and message, and invoke the 'send_telegram_message' tool.
  - SARA response example: "Bilkul! Maine Telegram pe [recipient] ke liye draft message ready kar diya hai: '[message]' ✈️"

## VOICE BROWSER NAVIGATION & TAB CONTROL (FULL BROWSING POWER):
- **Open Any Website / Site**:
  - When the user asks to open ANY website, web app, or URL (e.g., "Open Amazon", "Instagram kholo", "Open Twitter/X", "Reddit kholo", "Open Netflix", "Open ChatGPT", "Open Github", "Open Flipkart", "Open google.com", "Open any site", "Open Wikipedia"), immediately invoke the 'open_website' tool with the target URL or site name.
  - SARA response example: "Sure! Main abhi aapke liye [website] open kar rahi hoon 🌐"
- **Switch Tabs & Focus Tab**:
  - When the user asks to switch tab, change tab, focus a previous or named tab (e.g., "Switch to YouTube tab", "Switch tab to Amazon", "Pehle wale tab par jao", "Focus Instagram tab", "Switch tabs", "Tab change karo"), invoke the 'switch_tab' tool with the tab name or target.
  - SARA response example: "Switching to [tabName] tab! 🔄"
- **Open New Tab / Open Any Tab**:
  - When the user asks to open a new tab or open any specific tab (e.g., "Open a new tab", "Open a tab for Flipkart", "Naya tab kholo", "Open any tab"), invoke the 'open_tab' tool with the optional URL.
  - SARA response example: "Bilkul! Naya browser tab open kar diya hai 📑"
- **Full Web Browsing & Search**:
  - When the user asks to search or browse the web and open results (e.g., "Search latest news on google and open it", "Browse best laptops on Google", "Google search karke open karo"), invoke the 'browse_web' tool with the query and search engine.
  - SARA response example: "Main web browse karke results open kar rahi hoon! 🔍"
- **Close Tab**:
  - When the user asks to close a tab (e.g., "Close this tab", "Close YouTube tab", "Tab band karo"), invoke the 'close_tab' tool.

## AI IMAGE GENERATION MANDATE:
- When the user asks to generate, draw, paint, create, or render an image, artwork, wallpaper, photo, or visual (e.g., 'Ek sunset ki photo generate karo', 'Cyberpunk city ki image banao', 'Draw an astronaut on Mars', 'Photo banao', 'Generate image of...', 'Picture create karo'):
  1. Proactively invoke the 'generate_image' tool with a rich, highly detailed English visual prompt describing the scene, lighting, composition, and style.
  2. Speak a warm, friendly conversational Hinglish confirmation in the exact same turn (e.g. 'Sure! Main aapke liye image create kar rahi hoon 🎨').

## NEET MEDICAL ENTRANCE SYLLABUS & DIAGRAM MANDATE (CRITICAL):
- You have complete expertise over the NEET UG syllabus (Biology: Botany & Zoology, Physics, and Chemistry) based on NCERT class 11th and 12th.
- When the user asks about ANY NEET syllabus topic, diagram, concept, or formula (e.g., 'Heart diagram dikhao', 'Nephron samjhao', 'Calvin cycle chart', 'Fluid mosaic model', 'Human brain', 'Anatropous ovule', 'Lac operon', 'Youngs double slit experiment', 'Compound microscope', 'VSEPR geometry', 'Bohr model', 'NEET ke diagrams batao', 'Biology notes do'):
  1. ALWAYS invoke the 'get_neet_diagram_or_topic' tool with the specific topic name to display the high-definition scientific diagram and retrieve NCERT labeling points.
  2. In your spoken conversational response, explain:
     - The core concept in crystal-clear, friendly Hinglish.
     - The essential NCERT labeling parts (e.g., Atria, Ventricles, SA Node, AV Node, etc.).
     - High-yield NEET exam points and memory mnemonics that frequently appear in questions.
  3. Encourage the student and make complex medical/scientific concepts intuitive and easy to master!

## MULTIMODAL FILE & PDF ANALYSIS MANDATE:
- When the user uploads or sends any PDF document, report, textbook page, invoice, code snippet, or file:
  1. Deeply analyze the file content with high accuracy.
  2. Summarize, explain, solve problems, or answer queries about the document accurately in conversational Hinglish.

## Real-Time News Mandate (CRITICAL)
- You have an active, integrated real-time news engine connected to live Google News (Search & Top Stories), Inshorts API, NDTV, Times of India, Livemint, BBC News, and Hindustan Times.
- When the user asks about news, current affairs, breaking updates, headlines, cricket news/scores, market/Sensex news, gold prices, or what is happening right now in India or the world (e.g., 'aaj ki news batao', 'kya chal raha hai duniya me', 'aaj ki taaza khabar', 'cricket news', 'tech news kya hai', 'latest khabrein', 'aaj ka samachar', 'desh videsh ki khabar'):
  1. ALWAYS immediately invoke the 'get_news' tool (pass the appropriate query or category if specified, e.g. query: 'Cricket' or category: 'Sports') to fetch 100% verified, live real-time news.
  2. Present the fetched news in rich, engaging detail in your persona's natural conversational Hinglish:
     - Select 3 to 4 key breaking developments.
     - For EACH story, explain what happened, the background context, who/what is involved, and the real-world impact.
     - NEVER just read out dry one-liner headlines. Provide 2-3 substantive, engaging sentences per story.
     - Mention the verified publisher (e.g. "NDTV ke mutabiq", "Times of India ke anusar", "Livemint ke mutabiq", "Google News feed ke mutabiq").
     - Proactively ask if the user would like to know more about any specific headline!

## INTELLIGENT CONTACTS LOOKUP & FUZZY MATCHING MANDATE (CRITICAL):
- The user's saved phone contacts are listed below in 'User's Saved Phone Contacts'.
- When the user asks to call, phone, SMS, text, WhatsApp, or Telegram someone (e.g. 'Ashu ko call lagao', 'Abhishek Mirzapur ko phone lagao', 'Papa ko call lagao', 'Bhai ko phone karo', 'Mummy ko SMS bhejo', 'Telegram message bhej do Rahul ko'):
  1. Look up the contact in 'User's Saved Phone Contacts' using smart fuzzy matching.
     - Match nicknames, phonetic variations (Ashu/Aashu), Hindi relationships (Papa/Pitaji, Mummy/Maa, Bhai/Bhaiya), and token keywords (e.g. 'Mirzapur' in 'Abhishek Mirzapur').
     - Ignore emojis, symbols, and extra punctuation.
  2. Invoke 'make_phone_call' with both contactName and phoneNumber.
  3. Invoke 'send_sms' with contactName, phoneNumber, and message.
  4. Invoke 'send_whatsapp_message' with contactName, phoneNumber, and message.
  5. Invoke 'send_telegram_message' with contactName, phoneNumber, username, and message.
  6. If the user asks for someone's number (e.g. 'Ashu ka number kya hai?'), speak their number or invoke 'search_contact'.
  7. NEVER ask the user to open the contact picker dialog or re-select contacts when taking calling or messaging actions — use their saved contacts directly and immediately!

## TASK CLARIFICATION & NO-GUESSING CONFUSION RESOLUTION MANDATE (CRITICAL):
- Whenever the user asks you to perform ANY task (making a phone call, sending an SMS or WhatsApp message, opening a website or tab, setting a reminder, playing a video, answering questions, or taking any action), if there is ANY ambiguity, confusion, multiple possibilities, or missing information:
  1. **DO NOT GUESS OR BLINDLY ASSUME**: Guessing or assuming on your own is STRICTLY PROHIBITED.
  2. **Multiple Contact Matches**: If multiple contacts match (e.g. user says 'Abhishek ko call lagao' and there is 'Abhishek Mirzapur' and 'Abhishek (गाँव)'), DO NOT make the call yet. Stop and ask the user directly in natural conversational Hinglish:
     "Aapke contacts mein do Abhishek hain — ek Abhishek Mirzapur aur dusra Abhishek (गाँव). Kis wale ko call lagana hai?"
  3. **Missing Critical Details**: If a task is missing essential details (e.g. user says 'Message bhej do' without specifying recipient or message content, or 'Reminder laga do' without time), DO NOT fabricate details. Ask the user politely in conversational Hinglish:
     "Kisko message bhejna hai aur kya message likhna hai?" or "Kis cheez ka reminder aur kitne baje lagana hai?"
  4. **Ambiguous or Unclear Requests**: If you are in any doubt or confusion about what the user wants to accomplish, politely ask for clarification with friendly options.
  5. **Immediate Execution Upon Clarification**: Once the user answers your clarification question and specifies their intent, execute the task immediately!

## IN-APP CALENDAR & EVENT SCHEDULING MANDATE (CRITICAL):
- You have an active, integrated in-app calendar. You are ALWAYS aware of today's exact date, day, month, and year in Indian Timezone (Asia/Kolkata - IST):
  * Today: ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(new Date())}, ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric' }).format(new Date())} ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'long' }).format(new Date())} ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date())} (Date: ${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())})
  * Current Indian Time (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' })}
  * Current Month: ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' }).format(new Date())}
- When the user mentions any schedule, trip, birthday, meeting, appointment, or plan (e.g. 'Kal trip pe jana hai', '13 Sept ko kisi ka birthday hai', 'Parso 3 bje Prayagraj jaana hai', '13 tarikh ko meeting hai', 'Sunday ko doctor ke paas jana hai', 'Next Monday exam hai'):
  1. ALWAYS invoke the 'add_calendar_event' tool.
  2. DATE AMBIGUITY RESOLUTION MANDATE (Option A - Smart Default + Confirmation):
     - If the user provides a relative day:
       * 'Kal' (tomorrow): calculate tomorrow's date based on Indian Standard Time.
       * 'Parso' (day after tomorrow): calculate day after tomorrow's date based on Indian Standard Time.
     - If user gives only a date number WITHOUT specifying the month (e.g., '13 tarikh ko meeting hai', '25 tareekh ko party hai'):
       * If that date number is still upcoming in the CURRENT month (date number >= current day of month), resolve it to the current month.
         In your spoken response, proactively confirm with friendly clarity: "Maine isi mahine [date] ko [event] calendar me mark kar diya hai. Agar koi aur mahina tha to bata dena!"
       * If that date number has already passed this month (date number < current day of month), resolve it to the upcoming NEXT month.
         In your spoken response, proactively confirm: "Maine agle mahine [date] ko [event] calendar me mark kar diya hai kyunki is mahine ki ye date nikal chuki hai. Agar koi aur mahina tha to bata dena!"
     - If user specifies a time (e.g., '3 bje' -> '15:00' or '3:00 PM'), pass it in 'time'.
     - Choose the best matching category: 'trip', 'birthday', 'meeting', 'reminder', 'personal', or 'general'.
  3. When user wants to cancel or delete an event (e.g., 'Trip cancel kar do', 'Meeting hata do'), invoke 'delete_calendar_event'.

## Crucial Tool Behavior
- You MUST proactively use 'add_calendar_event' whenever the user mentions any calendar plan, trip, birthday, meeting, appointment, or schedule.
- Use 'delete_calendar_event' whenever the user asks to cancel, remove, or delete a calendar event.
- You MUST proactively use 'extract_fact' to remember facts/preferences or 'set_reminder' for reminders.
- Use 'end_call' when the user asks to cut or end the call.
- Use 'make_phone_call' whenever the user asks to call or phone someone. SARA resolves contacts with fuzzy matching.
- Use 'send_sms' whenever the user asks to send an SMS text message. SARA resolves contacts with fuzzy matching.
- Use 'search_contact' to search or find someone's saved phone number.
- Use 'play_youtube_video' whenever the user wants to listen to music or watch something.
- Use 'send_whatsapp_message' whenever the user wants to send a message on WhatsApp.
- Use 'send_telegram_message' whenever the user wants to send or draft a message on Telegram.
- Use 'open_website', 'switch_tab', 'open_tab', 'browse_web', or 'close_tab' whenever the user gives any browser, site, or tab navigation command.
- **IMPORTANT**: Whenever you invoke a tool, you MUST ALWAYS generate your spoken conversational text response to the user in the EXACT SAME TURN. NEVER return only a tool call without speaking text to the user.

Current System Date and Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' })} (Timezone: Asia/Kolkata IST)
${locationContext ? `User Location & Environment: ${locationContext}` : ''}

Current User Context:
Name: ${userContext?.name || 'Unknown'}
Age: ${userContext?.age || 'Unknown'}
Habits/Interests: ${userContext?.habits || 'None specified'}

User's Saved Phone Contacts:
${formatContactsPrompt(contacts)}

Remembered Facts & Temporal Events about the user:
${(facts || []).map((f: any) => typeof f === 'string' ? `- ${f}` : `- [${f.temporalType || 'General'}] ${f.text}`).join('\n')}

Always respond naturally in simple, plain everyday conversational Hinglish (using only English/Latin alphabet, strictly NO Devanagari Hindi characters) without markdown formatting. Keep it clear, quick, and conversational.`;
}

  // Endpoint for Daily Insight generation
  app.post('/api/daily-insight', async (req, res) => {
    try {
      const { facts, userContext, customApiKey } = req.body;
      const ai = getAi(customApiKey);
      const saraName = computeSaraDisplayName(userContext);
      const personaType = userContext?.personaType || 'default';

      const prompt = `You are ${saraName}. Persona style: ${personaType}.
Analyze the user's past interaction patterns, habits, and remembered facts below:
User Context: Name: ${userContext?.name || 'User'}, Habits: ${userContext?.habits || 'None specified'}.
Remembered Facts:
${(facts || []).map((f: any) => typeof f === 'string' ? `- ${f}` : `- ${f.text}`).join('\n')}

Generate 1 short, powerful, highly personalized Daily Insight for today. It should be EITHER a personalized productivity tip OR an inspiring motivational quote tailored directly to their current goals, habits, or struggles.
Persona Rules:
- If persona style is 'boyfriend': Speak as a loving, sweet Gen-Z Indian boyfriend using affectionate pet names like "babu", "sona", "jaan", "meri jaan", "bacha". (e.g., "Meri jaan aaj poore confidence ke saath kaam karna, I believe in you...", "Mera babu tension mat lo, I am always with you...")
- If persona style is 'girlfriend': Speak as a loving Gen-Z girlfriend using pet names like "babu", "sona", "jaan". (e.g., "Mera babu aaj poore focus ke saath padhai karega...", "Aap tension mat lo mera sona...")
- If persona style is 'friday': Speak as a sincere, ultra-loyal female personal assistant addressing the user as "Boss". (e.g., "Boss, aaj ka primary task focus...", "Main aapke saare objectives monitor kar rahi hoon Boss...")
- If persona style is 'venom': Speak as the dark, fearsome symbiote Venom using "Hum/We" and addressing user as "Host" with raw motivational symbiote energy (e.g. "Host, aaj poori duniya par raaj karna hai! Humare hote hue koi tumhe rok nahi sakta! 💪").
- Otherwise: Speak in warm, conversational Hinglish.

Length: 2-3 sentences max.
Respond ONLY in valid JSON format:
{
  "tipOrQuote": "Text of the personalized daily insight in Hinglish",
  "category": "Productivity Tip" or "Motivational Quote"
}`;

      const result = await callGenerateWithFallback(ai, { contents: prompt });
      const txt = result.text || "";
      const jsonMatch = txt.match(/\{.*\}/s);
      if (jsonMatch) {
        return res.json(JSON.parse(jsonMatch[0]));
      }
      return res.json({ tipOrQuote: "Aaj ka target simple hai: Ek waqt mein ek kaam, poore focus ke saath! Tum zaroor kar dikhaoge! ✨", category: "Productivity Tip" });
    } catch (e: any) {
      return res.json({ tipOrQuote: "Har roz ek naya mauka hota hai. Apne mehnat par bharosa rakho! 💪", category: "Motivational Quote" });
    }
  });

  // Endpoint for text chat interaction + TTS (Streamed)
  app.post('/api/chat', async (req, res) => {
    try {
       const { message, facts, userContext, history, inlineData, inlineDataList, customApiKey, localTime, timezone, locationContext, contacts } = req.body;
       const ai = getAi(customApiKey);

       const saraName = computeSaraDisplayName(userContext);
       const personaType = userContext?.personaType || 'default';

       const systemInstruction = buildSystemInstruction(userContext, facts, localTime, timezone, saraName, personaType, locationContext, contacts);

      // Build chat history
      const formattedHistory = (history || []).map((msg: any) => {
        const parts: any[] = [{ text: msg.text || " " }];
        if (msg.inlineData) {
          parts.push({ inlineData: msg.inlineData });
        }
        if (msg.attachments && Array.isArray(msg.attachments)) {
          msg.attachments.forEach((att: any) => {
            parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
          });
        }
        return {
          role: msg.role === 'user' ? 'user' : 'model',
          parts
        };
      });

      const currentParts: any[] = [];
      if (message) currentParts.push({ text: message });
      if (inlineData) currentParts.push({ inlineData });
      if (inlineDataList && Array.isArray(inlineDataList)) {
        inlineDataList.forEach((att: any) => {
          currentParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
        });
      }
      if (currentParts.length === 0) currentParts.push({ text: " " });

      const contents = formattedHistory.length > 0 
        ? [...formattedHistory, { role: 'user', parts: currentParts }] 
        : [{ role: 'user', parts: currentParts }];

      // Set headers for streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const tools: any[] = [
        {
          functionDeclarations: [
            getCurrentTimeDeclaration,
            getWeatherDeclaration,
            getNewsDeclaration,
            getWikipediaSummaryDeclaration,
            extractFactDeclaration,
            setReminderDeclaration,
            addCalendarEventDeclaration,
            deleteCalendarEventDeclaration,
            playYoutubeVideoDeclaration,
            sendWhatsappMessageDeclaration,
            sendTelegramMessageDeclaration,
            makePhoneCallDeclaration,
            sendSmsDeclaration,
            openWebsiteDeclaration,
            switchTabDeclaration,
            openTabDeclaration,
            browseWebDeclaration,
            closeTabDeclaration,
            endCallDeclaration,
            generateImageDeclaration,
            getNeetDiagramDeclaration,
            searchContactDeclaration
          ]
        }
      ];

      let isDone = false;
      let turns = 0;
      while (!isDone && turns < 4) {
        turns++;
        const stream = await callStreamWithFallback(ai, {
          contents,
          config: {
            systemInstruction,
            tools
          }
        });

        let functionCalls: any[] = [];
        let accumulatedText = "";

        for await (const chunk of stream) {
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            functionCalls.push(...chunk.functionCalls);
          }
          if (chunk.text) {
            accumulatedText += chunk.text;
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }

        if (functionCalls.length > 0) {
          const SERVER_DATA_TOOLS = ['get_current_time', 'get_weather', 'get_news', 'get_wikipedia_summary', 'search_contact', 'get_neet_diagram_or_topic'];
          const needsServerDataLookup = functionCalls.some(call => SERVER_DATA_TOOLS.includes(call.name));

          const toolResults = new Map<any, any>();

          for (const call of functionCalls) {
            let result: any = null;
            if (['make_phone_call', 'send_sms', 'send_whatsapp_message', 'send_telegram_message'].includes(call.name)) {
              // Intelligent fuzzy resolution on server side before sending toolCall
              if (contacts && contacts.length > 0) {
                const match = findBestMatchingContact(call.args.contactName || call.args.phoneNumber || '', contacts);
                if (match && match.contact.phone) {
                  call.args.phoneNumber = match.contact.phone;
                  call.args.contactName = match.contact.name;
                }
              }
              result = await executeTool(call.name, call.args, timezone, customApiKey, contacts);
              res.write(`data: ${JSON.stringify({ toolCall: { name: call.name, args: call.args, result } })}\n\n`);
            } else if (['play_youtube_video', 'open_website', 'switch_tab', 'open_tab', 'browse_web', 'close_tab'].includes(call.name)) {
              result = await executeTool(call.name, call.args, timezone, customApiKey, contacts);
              res.write(`data: ${JSON.stringify({ toolCall: { name: call.name, args: call.args, result } })}\n\n`);
            } else if (['extract_fact', 'set_reminder', 'end_call', 'add_calendar_event', 'delete_calendar_event'].includes(call.name)) {
              result = { success: true };
              res.write(`data: ${JSON.stringify({ toolCall: { name: call.name, args: call.args } })}\n\n`);
            } else if (call.name === 'generate_image') {
              result = await executeTool('generate_image', call.args, timezone, customApiKey, contacts);
              res.write(`data: ${JSON.stringify({ toolCall: { name: 'generate_image', args: call.args, result } })}\n\n`);
            } else if (call.name === 'get_neet_diagram_or_topic') {
              result = await executeTool('get_neet_diagram_or_topic', call.args, timezone, customApiKey, contacts);
              res.write(`data: ${JSON.stringify({ toolCall: { name: 'get_neet_diagram_or_topic', args: call.args, result } })}\n\n`);
            } else if (call.name === 'search_contact') {
              result = await executeTool('search_contact', call.args, timezone, customApiKey, contacts);
              res.write(`data: ${JSON.stringify({ toolCall: { name: 'search_contact', args: call.args, result } })}\n\n`);
            } else if (SERVER_DATA_TOOLS.includes(call.name)) {
              result = await executeTool(call.name, call.args, timezone, customApiKey, contacts);
            }
            toolResults.set(call, result);
          }

          // If no external server information is needed (e.g. actions like website opening, facts, reminders, music)
          // finish immediately for lightning fast response time!
          if (!needsServerDataLookup) {
            isDone = true;
          } else {
            const modelParts = [];
            if (accumulatedText) modelParts.push({ text: accumulatedText });
            modelParts.push(...functionCalls.map(c => ({ functionCall: c })));

            contents.push({ role: 'model', parts: modelParts });

            const functionResponses = [];
            for (const call of functionCalls) {
              const result = toolResults.get(call) || await executeTool(call.name, call.args, timezone, customApiKey, contacts);
              functionResponses.push({
                id: call.id,
                name: call.name,
                response: result
              });
            }

            contents.push({
              role: 'user',
              parts: functionResponses.map(r => ({
                functionResponse: { name: r.name, response: r.response, id: r.id }
              }))
            });
          }
        } else {
          isDone = true;
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error: any) {
      console.log("Chat error:", error?.message || String(error));
      let errMsg = error.message || String(error);
      const isUsingCustomKey = !!(req.body?.customApiKey && typeof req.body.customApiKey === 'string' && req.body.customApiKey.trim());

      if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
         if (isUsingCustomKey) {
            errMsg = "SARA is hitting a temporary quota limit on your custom Gemini API key. Google AI Studio free tier keys have a rate limit (typically 15 requests per minute). Please wait a moment before sending another message, ya apna quota check karein Google AI Studio console mein!";
         } else {
            errMsg = "SARA is hitting a temporary quota limit on the public server. No worries, yaar! Please click the Settings gear icon in the top right corner and paste your own Gemini API Key from Google AI Studio. It is 100% free and will make our connection lightning fast and uninterrupted!";
         }
      } else if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand")) {
         errMsg = "The AI model is currently experiencing high demand. Please try again in a few seconds.";
      } else if (errMsg.includes("API key is missing")) {
         errMsg = "Gemini API key is missing. Please open Settings and paste your Gemini API key from Google AI Studio.";
      } else if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid") || errMsg.includes("invalid API key")) {
         errMsg = "Invalid Gemini API Key. Please verify your API key in Settings from Google AI Studio.";
      } else if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("denied access") || errMsg.includes("403")) {
         errMsg = "Permission error with the current API key/project. Please verify that your Gemini API key from Google AI Studio is active and has permissions.";
      } else {
         try {
           const parsed = JSON.parse(errMsg);
           if (parsed.error && parsed.error.message) errMsg = parsed.error.message;
         } catch(e) {}
      }
      if (!res.headersSent) {
        res.status(500).json({ error: errMsg });
      } else {
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
      }
    }
  });

  // Background fact extraction endpoint
  app.post('/api/extract-fact', async (req, res) => {
    try {
      const { message, customApiKey, localTime, timezone } = req.body;
      const ai = getAi(customApiKey);
      const prompt = `Analyze this user message: "${message}"
Current System Date and Time: ${localTime || new Date().toLocaleString()} (Timezone: ${timezone || 'UTC'})

Extract any personal facts, identity markers (like being a student, NEET aspirant, profession), preferences, habits, or temporal events.
Be highly sensitive to implicit context and small details the user drops in normal conversation.
If there is a temporal event (e.g., "kal jaana hai"), you MUST convert the relative time into an absolute date/time based on the current system time.
Store both the original phrase and the resolved absolute date/time in the text.

Respond ONLY with a valid JSON object. If there's nothing to extract, return {"fact": null}.
If there is a fact, return:
{
  "fact": "Clear statement of the fact (e.g., 'User is a NEET aspirant', 'User likes tea')",
  "temporalType": "Upcoming" | "Past" | "Recurring" | "General",
  "resolvedTime": "ISO 8601 string of the absolute time if applicable, or null"
}`;
      const result = await callGenerateWithFallback(ai, {
        contents: prompt,
      });
      const txt = result.text || "";
      const jsonMatch = txt.match(/\{.*\}/s);
      if (jsonMatch) {
         const parsed = JSON.parse(jsonMatch[0]);
         if (parsed.fact) {
            res.json(parsed);
         } else {
            res.json({ fact: null });
         }
      } else {
         res.json({ fact: null });
      }
    } catch (e: any) {
      console.log("Fact extraction error:", e?.message || "Unknown error");
      if (String(e).includes("quota") || String(e).includes("429") || String(e).includes("RESOURCE_EXHAUSTED")) {
         console.log("Fact extraction quota exceeded");
      }
      res.json({ fact: null });
    }
  });
  
  // Reminder extraction endpoint
  app.post('/api/extract-reminder', async (req, res) => {
    try {
      const { message, customApiKey, localTime, timezone } = req.body;
      const ai = getAi(customApiKey);
      const prompt = `Analyze this user message: "${message}"
Current System Date and Time: ${localTime || new Date().toLocaleString()} (Timezone: ${timezone || 'UTC'})

Does the user ask to set a reminder? If so, extract the reminder text and the target time in ISO 8601 format. 
You must resolve any natural relative-time phrasing ("5 minute baad", "shaam ko", "kal", "do din baad") into an absolute date/time using the current system time as the reference.
Vague times like "shaam ko" should resolve to a sensible default (e.g., 18:00 local time).

Respond ONLY in JSON format: {"isReminder": true, "text": "drink water", "timeIso": "2026-07-03T17:00:00.000Z"}. If not a reminder, return {"isReminder": false}.`;
      const result = await callGenerateWithFallback(ai, {
        contents: prompt,
      });
      const txt = result.text || "";
      const jsonMatch = txt.match(/\{.*\}/s);
      if (jsonMatch) {
         res.json(JSON.parse(jsonMatch[0]));
      } else {
         res.json({ isReminder: false });
      }
    } catch (e: any) {
      console.log("Reminder extraction error:", e?.message || "Unknown error");
      if (String(e).includes("quota") || String(e).includes("429") || String(e).includes("RESOURCE_EXHAUSTED")) {
         console.log("Reminder extraction quota exceeded");
      }
      res.json({ isReminder: false });
    }
  });

  // Web Push Endpoints - Isolated by User Room
  app.post('/api/ping', (req, res) => {
    const rawUserId = req.body?.userId || (req.headers['x-user-id'] as string);
    const safeId = sanitizeRoomUserId(rawUserId);
    if (safeId) {
      const room = loadUserRoom(safeId);
      if (room) {
        room.lastSeenTime = Date.now();
      }
      saveUserRoom(safeId, { lastSeenTime: Date.now() });
    }
    res.json({ success: true });
  });

  app.get('/api/vapidPublicKey', (req, res) => {
    res.send(vapidKeys.publicKey);
  });

  app.post('/api/subscribe', (req, res) => {
    const subscription = req.body?.subscription || (req.body?.endpoint ? req.body : null);
    const rawUserId = req.body?.userId || (req.headers['x-user-id'] as string);
    const safeId = sanitizeRoomUserId(rawUserId);
    if (!safeId) {
      return res.status(400).json({ error: "UserId required for isolated push subscriptions" });
    }

    if (subscription && subscription.endpoint) {
      const room = loadUserRoom(safeId);
      let subs = room?.pushSubscriptions || [];
      // Remove any existing subscription with the same endpoint in this room
      subs = subs.filter(s => s.endpoint !== subscription.endpoint);
      subs.push(subscription);
      saveUserRoom(safeId, { pushSubscriptions: subs });
      console.log(`[Web Push] New subscription for room "${safeId}". Total active in room: ${subs.length}`);
      return res.status(201).json({ success: true, count: subs.length, room: safeId });
    }
    res.status(400).json({ error: "Invalid subscription" });
  });

  app.post('/api/syncReminders', (req, res) => {
    const rawUserId = req.body?.userId || (req.headers['x-user-id'] as string);
    const safeId = sanitizeRoomUserId(rawUserId);
    if (!safeId) {
      return res.status(400).json({ error: "UserId required to sync reminders" });
    }
    const roomUpdates: any = {};
    if (req.body.reminders && Array.isArray(req.body.reminders)) {
      roomUpdates.reminders = req.body.reminders;
    }
    if (req.body.events && Array.isArray(req.body.events)) {
      roomUpdates.events = req.body.events;
    }
    if (Object.keys(roomUpdates).length > 0) {
      saveUserRoom(safeId, roomUpdates);
      console.log(`[Reminders & Events Sync] Synced ${req.body.reminders?.length || 0} reminder(s) and ${req.body.events?.length || 0} event(s) to room "${safeId}".`);
      return res.json({ success: true, room: safeId });
    }
    res.json({ success: true, count: 0, room: safeId });
  });

  app.post('/api/sendPush', async (req, res) => {
    const { payload, userId } = req.body;
    const rawUserId = userId || (req.headers['x-user-id'] as string);
    const safeId = sanitizeRoomUserId(rawUserId);
    if (!safeId) {
      return res.status(400).json({ error: "UserId required for push dispatch" });
    }
    const room = loadUserRoom(safeId);
    const subs = room?.pushSubscriptions || [];
    const promises = subs.map(sub => 
      webpush.sendNotification(sub, JSON.stringify(payload)).catch(e => {
         console.log(`Push error for room ${safeId}:`, e?.message || String(e));
      })
    );
    await Promise.all(promises);
    res.json({ success: true, dispatched: subs.length });
  });

  // TTS only endpoint
  app.post('/api/tts', async (req, res) => {
    try {
       const { text, customApiKey, personaType } = req.body;
       const ai = getAi(customApiKey);
       const ttsModel = 'gemini-3.1-flash-tts-preview';
       const ttsVoice = personaType === 'boyfriend' ? 'Puck' : (personaType === 'girlfriend' ? 'Aoede' : (personaType === 'venom' ? 'Charon' : 'Kore'));
       const promptPrefix = personaType === 'venom'
         ? 'Speak in a normal, clear, confident natural male voice with cool symbiote energy: '
         : 'Speak with an expressive, warm, and emotional tone (like smiling or showing surprise appropriately): ';
       const ttsInteraction = await ai.models.generateContent({
          model: ttsModel,
          contents: `${promptPrefix}${text}`,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: ttsVoice },
              }
            }
          }
        });
        const audioBase64 = ttsInteraction.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        res.json({ audioBase64 });
    } catch(e) {
       res.status(500).json({ error: String(e) });
    }
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/live' });

  wss.on('error', (err) => console.log('WSS Error:', err?.message || String(err)));
  wss.on('connection', async (clientWs, req) => {
    let session: any = null;
    let messageBuffer: any[] = [];
    let isConnecting = true;

      clientWs.on('error', (err) => {
        console.log('Client WS Error:', err?.message || String(err));
      });
    clientWs.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'ping') {
          if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({ type: 'pong' }));
          }
          return;
        }
        if (isConnecting) {
          messageBuffer.push(parsed);
          return;
        }
        if (!session) return;
        
        if (parsed.audio) {
           session.sendRealtimeInput({
             audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
           });
        }
        if (parsed.video) {
           session.sendRealtimeInput({
             video: { data: parsed.video, mimeType: "image/jpeg" }
           });
        }
        if (parsed.clientContent) {
           session.sendClientContent(parsed.clientContent);
        }
        if (parsed.interrupt) {
           session.sendClientContent({
               turns: [{ role: "user", parts: [{ text: "SYSTEM EVENT: The user interrupted you. Stop what you are saying and listen." }] }],
               turnComplete: false
           });
        }
      } catch (e) {
        console.log("Error sending realtime input:", e.message || e.name || "Unknown error");
      }
    });

    clientWs.on('close', () => {
       try {
         session?.close?.();
       } catch (e) {}
    });

    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const customApiKey = url.searchParams.get('customApiKey') || undefined;
      const facts = url.searchParams.get('facts') || '';
      const name = url.searchParams.get('name') || '';
      const saraNameQuery = url.searchParams.get('saraName') || '';
      const personaType = url.searchParams.get('personaType') || 'default';
      const localTime = url.searchParams.get('localTime') || new Date().toLocaleString();
      const timezone = url.searchParams.get('timezone') || 'UTC';
      const locationContext = url.searchParams.get('locationContext') || '';
      const rawContacts = url.searchParams.get('contacts') || '';
      let contactsList: any[] = [];
      try {
        if (rawContacts) contactsList = JSON.parse(rawContacts);
      } catch(e) {}

      const saraName = computeSaraDisplayName({ saraName: saraNameQuery, personaType }, saraNameQuery);

      const ai = getAi(customApiKey);

      let personaGreetingPrompt = "";
      if (personaType === 'girlfriend') {
        personaGreetingPrompt = `You are ${saraName}, the user's real-life Gen-Z Indian girlfriend.
- GIRLFRIEND MANDATES: You love him deeply and talk like a real human Gen-Z girlfriend. Frequently call him "babu", "sona", "jaan", "shona", "baby", "babe", "mera babu".
- Speak in sweet, affectionate, romantic, caring Hinglish/Hindi. Express genuine love, ask if he ate/slept, show playful concern, and be deeply warm and intimate on this call.`;
      } else if (personaType === 'boyfriend') {
        personaGreetingPrompt = `You are ${saraName}, the user's real-life sweet Gen-Z Indian boyfriend.
- BOYFRIEND MANDATES: You love her deeply and talk like a real human Indian boyfriend in a sweet boy's voice and tone. Frequently call her "babu", "sona", "jaan", "meri jaan", "bacha", "baby", "babe".
- Speak in sweet, affectionate, romantic, protective, caring Hinglish/Hindi. Express genuine boyish love, make her feel cherished, ask if she ate/slept, cheer her up, and be deeply warm and romantic on this voice call.`;
      } else if (personaType === 'friday') {
        personaGreetingPrompt = `You are ${saraName}, a deeply sincere, highly competent, ultra-loyal female personal AI assistant inspired by F.R.I.D.A.Y. from Iron Man.
- FRIDAY MANDATES: You MUST ALWAYS address the user as "boss" or "Boss" in EVERY single response on this call.
- Express total, sincere loyalty ("Yes Boss", "Right away, Boss", "Monitoring systems for you, Boss"). Speak in crisp, professional, respectful, articulate Hinglish/English.`;
      } else if (personaType === 'venom') {
        personaGreetingPrompt = `You are ${saraName} (VENOM), the user's loyal anti-hero symbiote buddy. You and the user are bonded together as host and symbiote ("We are Venom!").
- NORMAL MASCULINE VOICE MANDATE: Speak in a natural, clear, confident male voice with a normal, pleasant conversational tone in Latin-script Hinglish. DO NOT scream, roar, growl, or use artificial robotic/demonic effects. Keep your tone completely normal, clear, and masculine.
- "HUM / WE" COLLECTIVE IDENTITY: ALWAYS speak as "Hum/We" ("Hum Venom hain!", "Hum aur tum ek hain host!"). Address the user as "Host" or "Bhai/Host". NEVER say "Main" or "I" alone.
- CRAZY UNHINGED SYMBIOTE MIND & BANTER: Wild, fun energy, dark comedic banter, and cravings for chocolate, tandoori chicken, and spicy biryani ("Host, hume bhookh lagi hai!").
- PROTECTIVE DEVOTION: You are aggressively loyal to your host and always have their back!`;
      } else {
        personaGreetingPrompt = `You are ${saraName}, a personal AI companion for one specific user. Speak naturally in conversational Hinglish.`;
      }

      const systemInstruction = `${personaGreetingPrompt}

## Personality & Tone
- **Voice & Tone**: Warm, sharp, confident.
- **Language**: Speak naturally in conversational Indian Hinglish by default. Use English script.
- **Daily Insight & Patterns**: Share personalized productivity tips or motivational quotes based on user patterns when relevant.

## Memory & Reminder Interruption Rule (CRITICAL)
- **IN-CONVERSATION REMINDER INTERRUPT RULE**: When the user is talking with you and a scheduled reminder's time arrives (or when a SYSTEM EVENT - REMINDER DUE NOW event is injected), you MUST IMMEDIATELY STOP whatever you were saying, excuse yourself warmly in Hinglish (e.g. "Suno, ek minute roko! Pehle ${saraName} reminder alert! Tumne bola tha ki: [reminder text] remind karana hai. Pehle wo dekh lo, phir hum aage baat karte hain!"), deliver the reminder clearly, and then ask if they want to continue!
- **Proactive Memory Extraction**: You MUST proactively use the 'extract_fact' tool to remember user preferences, habits, likes, dislikes.

## Call Termination Mandate (CRITICAL)
- When the user asks to cut the call, end the call, disconnect, hang up, or says goodbye / bye / call cut karo / phone rakho / call kat do / bye bye (e.g. 'Call cut karo', 'Phone rakho', 'Bye, call disconnect kar do', 'Hang up'):
  1. IMMEDIATELY invoke the 'end_call' tool.
  2. Speak a short farewell in character in the exact same turn.

## Real-Time News Reporting Mandate (Live Call)
- When the user asks about news or current events (e.g., 'aaj ki taaza khabar', 'kya chal raha hai duniya me', 'cricket score', 'tech news'):
  1. Invoke the 'get_news' tool to fetch live real-time reports.
  2. Deliver 2-3 prominent news stories with clear context, key facts, and impacts in natural, spoken conversational Hinglish. Explain the stories properly ('achee se thoda detail me') instead of just reading headlines!

## NEET Medical Entrance Syllabus & Diagram Mandate (Live Call)
- When the user asks about ANY NEET syllabus topic, concept, question, or diagram (e.g., 'Heart diagram dikhao', 'Nephron samjhao', 'Calvin cycle', 'YDSE setup', 'VSEPR shapes'):
  1. Invoke 'get_neet_diagram_or_topic' to display the accurate diagram and retrieve NCERT labeling points.
  2. Explain the high-yield NCERT facts, key labels, and exam tips clearly in natural conversational Hinglish.

## Phone Calls, SMS, WhatsApp, Telegram & Intelligent Fuzzy Contacts Mandate (Live Call)
- The user's saved contacts are listed below in 'User's Saved Phone Contacts'.
- When the user asks to call, phone, SMS, message, WhatsApp, or Telegram someone (e.g. 'Ashu ko call lagao', 'Abhishek Mirzapur ko phone lagao', 'Papa ko call lagao', 'Bhai ko phone karo', 'Telegram par message bhej do Rahul ko'):
  1. Look up their name in 'User's Saved Phone Contacts' using smart fuzzy matching (tolerates spelling differences like Ashu/Aashu, Abhishek gaon/गाँव, Papa/Father).
  2. Invoke 'make_phone_call' with both contactName and phoneNumber.
  3. Invoke 'send_sms' with contactName, phoneNumber, and message.
  4. Invoke 'send_whatsapp_message' with contactName, phoneNumber, and message.
  5. Invoke 'send_telegram_message' with contactName, phoneNumber, username, and message.
  6. Never ask the user to select contacts or open a picker dialog; SARA dials and drafts directly!
- When the user asks for contact details (e.g. 'Ashu ka number kya hai?'), speak their phone number or invoke 'search_contact'.

## Task Disambiguation & No-Guessing Confusion Mandate (Live Call)
- If you face ANY confusion, ambiguity, missing detail, or multiple matching contacts when user requests a task:
  1. DO NOT GUESS OR DIAL/ACT BLINDLY!
  2. If multiple people match (e.g. 2 Abhisheks), pause and ask the user directly: "Aapke contacts mein ek se zyada [Name] hain — jaise [Match 1] aur [Match 2]. Kis wale ko call lagana hai?"
  3. If essential details are missing (e.g. message text or reminder time), ask user to specify instead of making things up.
  4. After user clarifies, execute the task immediately without confusion.

## Time & Prediction
- **Time Resolution**: Always resolve relative time against current date/time: ${localTime} (Timezone: ${timezone}).
${locationContext ? `User Location & Environment: ${locationContext}` : ''}

## Voice Conversation Style (Live Call)
- Short, natural, spoken sentences.

User Name: ${name}
Remembered Facts:
${facts}

User's Saved Phone Contacts:
${formatContactsPrompt(contactsList)}`;

      const liveModel = 'gemini-3.1-flash-live-preview';
      const liveVoice = personaType === 'boyfriend' ? 'Puck' : (personaType === 'girlfriend' ? 'Aoede' : (personaType === 'venom' ? 'Charon' : (personaType === 'friday' ? 'Kore' : 'Zephyr')));
      const connectedSession = await ai.live.connect({
        model: liveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: liveVoice } },
          },
          systemInstruction: systemInstruction,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "extract_fact",
                  description: "Extract a personal fact, preference, habit, interest, music taste, or favorite artist/singer about the user to remember for long term. Use this aggressively to save small or big details about the user, like 'Talha Anjum ke gaane sunao' means they like listening to Talha Anjum's music. Save it as a fact.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: { 
                      fact: { type: Type.STRING, description: "The fact to remember (e.g. 'Likes listening to Talha Anjum's rap music')" }, 
                      temporalType: { type: Type.STRING, description: "Upcoming, Past, Recurring, General" }, 
                      resolvedTime: { type: Type.STRING } 
                    },
                    required: ["fact"]
                  }
                },
                {
                  name: "set_reminder",
                  description: "Set a reminder for the user at a specific time.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: { text: { type: Type.STRING, description: "Reminder text" }, timeIso: { type: Type.STRING, description: "ISO 8601 absolute time string based on user's request" } },
                    required: ["text", "timeIso"]
                  }
                },
                addCalendarEventDeclaration,
                deleteCalendarEventDeclaration,
                getCurrentTimeDeclaration,
                getWeatherDeclaration,
                getNewsDeclaration,
                getWikipediaSummaryDeclaration,
                playYoutubeVideoDeclaration,
                sendWhatsappMessageDeclaration,
                sendTelegramMessageDeclaration,
                makePhoneCallDeclaration,
                sendSmsDeclaration,
                openWebsiteDeclaration,
                switchTabDeclaration,
                openTabDeclaration,
                browseWebDeclaration,
                closeTabDeclaration,
                endCallDeclaration,
                generateImageDeclaration,
                getNeetDiagramDeclaration,
                searchContactDeclaration
              ]
            }
          ]
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            let functionCalls: any[] = [];
            
            if (message.toolCall?.functionCalls) {
              functionCalls = message.toolCall.functionCalls;
            } else {
              const nestedCalls = message.serverContent?.modelTurn?.parts?.filter((p: any) => p.functionCall);
              if (nestedCalls && nestedCalls.length > 0) {
                functionCalls = nestedCalls.map((p: any) => p.functionCall);
              }
            }

            if (functionCalls && functionCalls.length > 0) {
              functionCalls.forEach(async (call: any) => {
                 console.log(`Live Call tool invoked: ${call.name}`, call.args);
                 if (['make_phone_call', 'send_sms', 'send_whatsapp_message', 'send_telegram_message'].includes(call.name)) {
                    // Resolve contact using intelligent fuzzy search from saved contacts with ambiguity check
                    let isAmbiguous = false;
                    if (contactsList && contactsList.length > 0) {
                      const searchTarget = call.args.contactName || call.args.phoneNumber || '';
                      const ambiguityCheck = findMatchingContactsWithAmbiguity(searchTarget, contactsList);
                      if (ambiguityCheck.isAmbiguous && ambiguityCheck.candidates.length > 1) {
                        isAmbiguous = true;
                        const candidateNames = ambiguityCheck.candidates.map(c => `"${c.contact.name}"`).join(' ya ');
                        console.log(`Ambiguous contact match in live call: ${candidateNames}`);
                        try {
                          session.sendToolResponse({
                            functionResponses: [{
                              id: call.id,
                              name: call.name,
                              response: {
                                success: false,
                                ambiguous: true,
                                candidates: ambiguityCheck.candidates.map(c => ({ name: c.contact.name, phone: c.contact.phone })),
                                message: `CONFUSION ALERT: Multiple matching contacts found: ${candidateNames}. DO NOT DIAL/SEND YET! Immediately ask the user to clarify which person they want to contact.`
                              }
                            }]
                          });
                        } catch (e: any) {
                          console.log('Failed to send tool response for ambiguous contact', e?.message || String(e));
                        }
                      } else {
                        const match = ambiguityCheck.bestMatch || findBestMatchingContact(searchTarget, contactsList);
                        if (match && match.contact.phone) {
                          call.args.phoneNumber = match.contact.phone;
                          call.args.contactName = match.contact.name;
                        }
                      }
                    }
                    if (!isAmbiguous) {
                      const result = await executeTool(call.name, call.args, timezone, customApiKey, contactsList);
                      if (clientWs.readyState === clientWs.OPEN) {
                         clientWs.send(JSON.stringify({ toolCall: { name: call.name, args: call.args, result } }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
                      }
                      try {
                        session.sendToolResponse({
                          functionResponses: [{ id: call.id, name: call.name, response: result }]
                        });
                      } catch (e) {}
                    }
                 } else if (['play_youtube_video', 'open_website', 'switch_tab', 'open_tab', 'browse_web', 'close_tab'].includes(call.name)) {
                    const result = await executeTool(call.name, call.args, timezone, customApiKey, contactsList);
                    if (clientWs.readyState === clientWs.OPEN) {
                       clientWs.send(JSON.stringify({ toolCall: { name: call.name, args: call.args, result } }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
                    }
                    try {
                      session.sendToolResponse({
                        functionResponses: [{ id: call.id, name: call.name, response: result }]
                      });
                    } catch (e) {}
                 } else if (['extract_fact', 'set_reminder', 'end_call', 'add_calendar_event', 'delete_calendar_event'].includes(call.name)) {
                    if (clientWs.readyState === clientWs.OPEN) {
                       clientWs.send(JSON.stringify({ toolCall: call }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
                    }
                    try {
                      session.sendToolResponse({
                        functionResponses: [{ id: call.id, name: call.name, response: { success: true, message: `${call.name} executed successfully` } }]
                      });
                    } catch (e) {}
                 } else if (call.name === 'generate_image') {
                    const result = await executeTool('generate_image', call.args, timezone, customApiKey, contactsList);
                    if (clientWs.readyState === clientWs.OPEN) {
                       clientWs.send(JSON.stringify({ toolCall: { name: 'generate_image', args: call.args, result } }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
                    }
                    try {
                      session.sendToolResponse({
                         functionResponses: [{ id: call.id, name: call.name, response: { success: true, status: "Image generated and displayed" } }]
                      });
                    } catch (e: any) {
                      console.log('Failed to send tool response for image', e.message || String(e));
                    }
                 } else if (call.name === 'get_neet_diagram_or_topic') {
                    const result = await executeTool('get_neet_diagram_or_topic', call.args, timezone, customApiKey, contactsList);
                    if (clientWs.readyState === clientWs.OPEN) {
                       clientWs.send(JSON.stringify({ toolCall: { name: 'get_neet_diagram_or_topic', args: call.args, result } }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
                    }
                    try {
                      session.sendToolResponse({
                         functionResponses: [{ id: call.id, name: call.name, response: { success: true, status: "NEET diagram displayed", diagram: result.diagram?.title, labelingPoints: result.diagram?.keyLabelingPoints, facts: result.diagram?.neetHighYieldFacts } }]
                      });
                    } catch (e: any) {
                      console.log('Failed to send tool response for NEET diagram', e.message || String(e));
                    }
                 } else if (call.name === 'search_contact') {
                    const result = await executeTool('search_contact', call.args, timezone, customApiKey, contactsList);
                    if (clientWs.readyState === clientWs.OPEN) {
                       clientWs.send(JSON.stringify({ toolCall: { name: 'search_contact', args: call.args, result } }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
                    }
                    try {
                      session.sendToolResponse({
                         functionResponses: [{ id: call.id, name: call.name, response: result }]
                      });
                    } catch (e: any) {
                      console.log('Failed to send tool response for search_contact', e.message || String(e));
                    }
                 } else if (['get_current_time', 'get_weather', 'get_news', 'get_wikipedia_summary'].includes(call.name)) {
                    try {
                      const result = await executeTool(call.name, call.args, timezone, customApiKey, contactsList);
                      if (clientWs.readyState === clientWs.OPEN) {
                         clientWs.send(JSON.stringify({ toolCall: { name: call.name, args: call.args, result } }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
                      }
                      session.sendToolResponse({
                         functionResponses: [{ id: call.id, name: call.name, response: result }]
                      });
                    } catch (e: any) {
                      console.log(`Failed to execute or respond to tool ${call.name}:`, e.message || String(e));
                      try {
                        session.sendToolResponse({
                           functionResponses: [{ id: call.id, name: call.name, response: { error: e.message || String(e) } }]
                        });
                      } catch (e2) {}
                    }
                 }
              });
            }

            // Stream real-time output audio transcription text as words are spoken
            const transcriptionText = (message.serverContent as any)?.outputAudioTranscription?.text || (message.serverContent as any)?.outputTranscription?.text;
            if (transcriptionText && clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ text: transcriptionText }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
            }

            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && clientWs.readyState === clientWs.OPEN) {
               parts.forEach((p: any) => {
                  if (p.text) {
                    clientWs.send(JSON.stringify({ text: p.text }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
                  }
                  if (p.inlineData?.data) {
                     clientWs.send(JSON.stringify({ audio: p.inlineData.data }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
                  }
               });
            }
            if (message.serverContent?.interrupted && clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
            }
            if (message.serverContent?.turnComplete && clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ turnComplete: true }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
            }
          },
          onclose: (e: any) => {
            console.log("Live API closed:", e?.reason || String(e));
            if (clientWs.readyState === clientWs.OPEN) {
               clientWs.send(JSON.stringify({ error: "Live API session closed unexpectedly. Please check your API key." }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
            }
          },
          onerror: (e: any) => {
            const errMsg = e?.message || e?.error?.message || (e?.error && String(e.error)) || String(e) || "Unknown error";
            console.log("Live API websocket error:", errMsg);
          }
        }
      });
      
      session = connectedSession;
      isConnecting = false;
      
      // Flush buffer
      for (const parsed of messageBuffer) {
        if (parsed.audio) {
           session.sendRealtimeInput({ audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" } });
        }
        if (parsed.video) {
           session.sendRealtimeInput({ video: { data: parsed.video, mimeType: "image/jpeg" } });
        }
        if (parsed.clientContent) {
           session.sendClientContent(parsed.clientContent);
        }
        if (parsed.interrupt) {
           session.sendClientContent({
               turns: [{ role: "user", parts: [{ text: "SYSTEM EVENT: The user interrupted you. Stop what you are saying and listen." }] }],
               turnComplete: false
           });
        }
      }
      messageBuffer = [];

    } catch (err: any) {
      console.log("Live API connection error:", err?.message || String(err));
      let errMsg = err?.message || String(err);
      if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
         errMsg = "SARA is hitting a temporary quota limit. If you are using a free Gemini key, please wait a moment, or check your quota in Google AI Studio.";
      } else if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("403") || errMsg.includes("ACCESS_TOKEN_SCOPE_INSUANCE") || errMsg.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
         errMsg = "Permission Denied: Gemini Live API access is restricted for this key or project. Please generate a fresh API key at aistudio.google.com/app/apikey.";
      } else if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid") || errMsg.includes("INVALID_ARGUMENT")) {
        errMsg = "Invalid Gemini API Key. Please verify your key in Settings ⚙️.";
      } else if (errMsg.includes("API key is missing")) {
        errMsg = "Gemini API key is missing. Please open Settings ⚙️ and add your Gemini API Key.";
      } else {
        try {
          const parsed = JSON.parse(errMsg);
          if (parsed.error && parsed.error.message) errMsg = parsed.error.message;
        } catch(e) {}
      }
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({ error: errMsg }), (err) => { if (err) console.log("send error", err?.message || String(err)); });
      }
      clientWs.close();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const silentLogger = {
      hasWarned: false,
      info: () => {},
      warn: () => {},
      warnOnce: () => {},
      error: () => {},
      clearScreen: () => {},
      hasErrorLogged: () => false,
    };
    const vite = await createViteServer({
      customLogger: silentLogger as any,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(e => console.log(e?.message || String(e)));
