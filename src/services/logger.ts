export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  module: 'PERMISSIONS' | 'IMAGE_GEN' | 'CHAT' | 'VOICE' | 'SYSTEM' | 'NETWORK' | 'NEET';
  message: string;
  details?: string;
}

const STORAGE_KEY = 'sara_system_logs_v1';
const MAX_LOGS = 150;

let memoryLogs: LogEntry[] = [];
let listeners: Array<(logs: LogEntry[]) => void> = [];

// Initialize logs from sessionStorage or seed with system init
try {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    memoryLogs = JSON.parse(saved);
  }
} catch (e) {
  // Ignore storage access error
}

if (memoryLogs.length === 0) {
  memoryLogs.push({
    id: 'init-' + Date.now(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    level: 'info',
    module: 'SYSTEM',
    message: 'SARA System Diagnostic Logger initialized',
    details: 'Tracking permissions, image generation, audio & AI model calls.'
  });
}

function persistLogs() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memoryLogs.slice(0, MAX_LOGS)));
  } catch (e) {}
  notifyListeners();
}

function notifyListeners() {
  const snapshot = [...memoryLogs];
  listeners.forEach(cb => {
    try { cb(snapshot); } catch (e) {}
  });
}

export function addClientLog(
  level: 'info' | 'success' | 'warn' | 'error',
  module: LogEntry['module'],
  message: string,
  details?: string
): LogEntry {
  const entry: LogEntry = {
    id: Math.random().toString(36).slice(2) + Date.now(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    level,
    module,
    message,
    details
  };

  memoryLogs.unshift(entry);
  if (memoryLogs.length > MAX_LOGS) {
    memoryLogs.pop();
  }

  persistLogs();
  return entry;
}

export function getClientLogs(): LogEntry[] {
  return [...memoryLogs];
}

export function clearClientLogs(): void {
  memoryLogs = [{
    id: 'cleared-' + Date.now(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    level: 'info',
    module: 'SYSTEM',
    message: 'Logs cleared by user'
  }];
  persistLogs();
}

export function subscribeToLogs(callback: (logs: LogEntry[]) => void): () => void {
  listeners.push(callback);
  callback([...memoryLogs]);
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
}

// Global window error listener for automated diagnostic catching
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    addClientLog('error', 'SYSTEM', `Client Exception: ${event.message}`, event.filename ? `${event.filename}:${event.lineno}` : undefined);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || (typeof reason === 'string' ? reason : 'Promise rejected');
    addClientLog('error', 'SYSTEM', `Unhandled Rejection: ${msg}`);
  });
}
