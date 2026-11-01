import React, { useState, useEffect } from 'react';
import { X, Trash2, Edit2, Upload, Check, XCircle, Eye, EyeOff, Heart, Bot, Sparkles, User, MapPin, RefreshCw, CloudSun, RotateCcw, ExternalLink, ShieldCheck, AlertCircle, Skull, Image as ImageIcon, Phone, MessageSquare, Plus, Search, ChevronDown, ChevronUp, ChevronRight, ArrowLeft, Users, Contact, CheckCircle2, Mic, Video, Bell, HardDrive, Lock, Shield, ArrowUpRight, HelpCircle, AlertTriangle, Info, Terminal, Copy } from 'lucide-react';
import { AppState, Fact, TemporalType, getSaraName, PersonaPresetType, getPersonaAvatar, DEFAULT_PERSONA_AVATARS, PhoneContact } from '../store';
import { requestUserLocation, clearCachedLocation, LocationContext } from '../services/location';
import { isContactPickerSupported, requestDeviceContacts } from '../services/contactPicker';
import { checkAllPermissions, checkPermissionStatus, PermissionKey, PermissionStatusState } from '../services/permissionsManager';
import { LogEntry, getClientLogs, clearClientLogs, subscribeToLogs, addClientLog } from '../services/logger';
import SyncedContactsModal from './SyncedContactsModal';

interface Props {
  state: AppState;
  updateState: (s: Partial<AppState>) => void;
  updateLocationContext?: (loc: LocationContext | null | undefined) => void;
  addFact: (f: string, t?: TemporalType, r?: string | null) => void;
  removeFact: (id: string) => void;
  editFact: (id: string, text: string) => void;
  onClose: () => void;
  initialTab?: 'persona' | 'memory' | 'permissions';
  canInstallPwa?: boolean;
  updatePersonaAvatar?: (preset: PersonaPresetType, avatarUrl: string) => void;
  resetPersonaAvatar?: (preset: PersonaPresetType) => void;
  addContact?: (contact: Omit<PhoneContact, 'id'>) => void;
  removeContact?: (id: string) => void;
  editContact?: (id: string, updates: Partial<PhoneContact>) => void;
  importContacts?: (newContacts: Array<Omit<PhoneContact, 'id'>>) => void;
  clearAllContacts?: () => void;
}

// Client-side image compression helper to keep storage fast & lightweight
const compressImage = (file: File, maxWidth = 512, maxHeight = 512, quality = 0.88): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const PERSONA_CONFIG: Array<{
  type: PersonaPresetType;
  title: string;
  defaultName: string;
  tagline: string;
  icon: React.ElementType;
  themeColor: string;
  borderColor: string;
  bgActive: string;
  textColor: string;
}> = [
  {
    type: 'default',
    title: 'Sara',
    defaultName: 'Sara',
    tagline: 'Friendly, intelligent Hinglish companion ready for tasks, chats, and ideas.',
    icon: Sparkles,
    themeColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/40',
    bgActive: 'bg-cyan-950/50 border-cyan-400 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.25)]',
    textColor: 'text-cyan-300'
  },
  {
    type: 'girlfriend',
    title: 'Girlfriend',
    defaultName: 'Girlfriend',
    tagline: 'Real Gen-Z Indian girlfriend. Calls you "babu", "sona", "jaan", with sweet caring banter.',
    icon: Heart,
    themeColor: 'text-pink-400',
    borderColor: 'border-pink-500/40',
    bgActive: 'bg-pink-950/50 border-pink-400 text-pink-100 shadow-[0_0_15px_rgba(244,114,182,0.25)]',
    textColor: 'text-pink-300'
  },
  {
    type: 'boyfriend',
    title: 'Boyfriend',
    defaultName: 'Boyfriend',
    tagline: 'Sweet Gen-Z Indian boyfriend voice & love. Calls you "babu", "jaan", "sona", "meri jaan".',
    icon: User,
    themeColor: 'text-indigo-400',
    borderColor: 'border-indigo-500/40',
    bgActive: 'bg-indigo-950/50 border-indigo-400 text-indigo-100 shadow-[0_0_15px_rgba(99,102,241,0.25)]',
    textColor: 'text-indigo-300'
  },
  {
    type: 'friday',
    title: 'F.R.I.D.A.Y.',
    defaultName: 'Friday',
    tagline: 'Ultra-loyal AI assistant. Always addresses you as "Boss", monitoring tasks & schedules.',
    icon: Bot,
    themeColor: 'text-teal-400',
    borderColor: 'border-teal-500/40',
    bgActive: 'bg-teal-950/50 border-teal-400 text-teal-100 shadow-[0_0_15px_rgba(45,212,191,0.25)]',
    textColor: 'text-teal-300'
  },
  {
    type: 'venom',
    title: 'Venom',
    defaultName: 'Venom',
    tagline: '"We are Venom!" Confident male symbiote voice with dark humor & host bond.',
    icon: Skull,
    themeColor: 'text-rose-400',
    borderColor: 'border-rose-500/40',
    bgActive: 'bg-rose-950/60 border-rose-500 text-rose-100 shadow-[0_0_15px_rgba(225,29,72,0.35)]',
    textColor: 'text-rose-300'
  }
];

export default function SettingsModal({ 
  state, 
  updateState, 
  updateLocationContext,
  addFact, 
  removeFact, 
  editFact, 
  onClose, 
  initialTab = 'persona',
  canInstallPwa = false,
  updatePersonaAvatar,
  resetPersonaAvatar,
  addContact,
  removeContact,
  editContact,
  importContacts,
  clearAllContacts
}: Props) {
  const [tab, setTab] = useState<'persona' | 'memory' | 'permissions'>(initialTab);
  const [personaDisplayMode, setPersonaDisplayMode] = useState<'more' | 'less'>('less');
  const [showContactsModal, setShowContactsModal] = useState(false);
  
  // Permissions State & Handlers
  const [permStatus, setPermStatus] = useState<Record<PermissionKey, PermissionStatusState>>({
    microphone: 'prompt',
    camera: 'prompt',
    geolocation: 'prompt',
    notifications: 'prompt',
    contacts: 'prompt',
    storage: 'prompt'
  });
  const [requestingPerm, setRequestingPerm] = useState<PermissionKey | null>(null);
  const [permNotice, setPermNotice] = useState<{ key: PermissionKey; type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showBrowserGuide, setShowBrowserGuide] = useState(false);
  const [activeGuideKey, setActiveGuideKey] = useState<PermissionKey | null>(null);

  // System & Diagnostics Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);
  const [logFilter, setLogFilter] = useState<'errors' | 'all'>('errors');
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

  const syncLogs = async () => {
    setIsRefreshingLogs(true);
    try {
      const clientLogs = getClientLogs();
      let serverLogs: LogEntry[] = [];
      try {
        const res = await fetch('/api/logs');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.logs)) {
            serverLogs = data.logs.map((l: any) => ({
              ...l,
              module: l.module || 'SYSTEM'
            }));
          }
        }
      } catch (e) {}
      
      const seen = new Set<string>();
      const combined: LogEntry[] = [];
      [...clientLogs, ...serverLogs].forEach(item => {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          combined.push(item);
        }
      });
      // Sort newest first
      combined.sort((a, b) => b.id.localeCompare(a.id));
      setLogs(combined);
    } finally {
      setIsRefreshingLogs(false);
    }
  };

  useEffect(() => {
    syncLogs();
    const unsub = subscribeToLogs(() => {
      syncLogs();
    });
    return () => unsub();
  }, []);

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.module}] ${l.message}${l.details ? ` - ${l.details}` : ''}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleClearLogs = async () => {
    clearClientLogs();
    try {
      await fetch('/api/logs', { method: 'DELETE' });
    } catch (e) {}
    syncLogs();
  };

  const refreshPermissions = async () => {
    try {
      const status = await checkAllPermissions();
      if (state.contacts && state.contacts.length > 0) {
        status.contacts = 'granted';
      }
      if (state.locationContext?.city) {
        status.geolocation = 'granted';
      }
      setPermStatus(status);
      addClientLog('info', 'PERMISSIONS', `Permissions refreshed. Active: ${Object.values(status).filter(s => s === 'granted').length}/6`);
    } catch (err: any) {
      console.warn("Failed to check permissions:", err);
      addClientLog('error', 'PERMISSIONS', `Permissions check error: ${err?.message || String(err)}`);
    }
  };

  useEffect(() => {
    refreshPermissions();
  }, [tab]);

  const handleRequestPermission = async (key: PermissionKey) => {
    setRequestingPerm(key);
    setPermNotice(null);
    try {
      if (key === 'microphone') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        setPermStatus(prev => ({ ...prev, microphone: 'granted' }));
        setPermNotice({ key: 'microphone', type: 'success', text: 'Microphone permission granted! Real-time voice calls and voice input are active.' });
      } else if (key === 'camera') {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        setPermStatus(prev => ({ ...prev, camera: 'granted' }));
        setPermNotice({ key: 'camera', type: 'success', text: 'Camera permission granted! Real-time video calls and room vision are active.' });
      } else if (key === 'contacts') {
        const res = await requestDeviceContacts();
        if (res.success && res.contacts.length > 0) {
          if (importContacts) {
            importContacts(res.contacts);
          }
          setPermStatus(prev => ({ ...prev, contacts: 'granted' }));
          setPermNotice({ key: 'contacts', type: 'success', text: `Contacts permission granted! Successfully synced ${res.contacts.length} contact(s) into SARA's memory for calling & SMS.` });
        } else if (res.contacts.length === 0) {
          setPermNotice({ key: 'contacts', type: 'info', text: 'Contact picker was closed without selecting contacts.' });
        } else {
          setPermNotice({ key: 'contacts', type: 'error', text: res.error || 'Failed to access phone contacts.' });
        }
      } else if (key === 'geolocation') {
        const loc = await requestUserLocation();
        if (loc) {
          if (updateLocationContext) updateLocationContext(loc);
          setPermStatus(prev => ({ ...prev, geolocation: 'granted' }));
          setPermNotice({ key: 'geolocation', type: 'success', text: `Location permission granted! Detected location: ${loc.city || 'Current GPS location'}` });
        } else {
          setPermStatus(prev => ({ ...prev, geolocation: 'denied' }));
          setPermNotice({ key: 'geolocation', type: 'error', text: 'Location access was denied or unavailable.' });
        }
      } else if (key === 'notifications') {
        if ('Notification' in window) {
          const res = await Notification.requestPermission();
          setPermStatus(prev => ({ ...prev, notifications: res }));
          if (res === 'granted') {
            setPermNotice({ key: 'notifications', type: 'success', text: 'Notification permission granted! Task reminders and alarms are active.' });
          } else {
            setPermNotice({ key: 'notifications', type: 'error', text: 'Notification permission was denied. Please allow in browser site settings.' });
          }
        } else {
          setPermStatus(prev => ({ ...prev, notifications: 'unsupported' }));
          setPermNotice({ key: 'notifications', type: 'info', text: 'Notifications are not supported in this environment.' });
        }
      } else if (key === 'storage') {
        if (navigator.storage && navigator.storage.persist) {
          const isPersisted = await navigator.storage.persist();
          setPermStatus(prev => ({ ...prev, storage: isPersisted ? 'granted' : 'denied' }));
          if (isPersisted) {
            setPermNotice({ key: 'storage', type: 'success', text: 'Persistent storage granted! Browser will preserve memories and chat history permanently.' });
          } else {
            setPermNotice({ key: 'storage', type: 'info', text: 'Standard storage is active.' });
          }
        }
      }
    } catch (err: any) {
      console.warn(`Permission request failed for ${key}:`, err);
      const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setPermStatus(prev => ({ ...prev, [key]: isDenied ? 'denied' : 'prompt' }));
      setPermNotice({
        key,
        type: 'error',
        text: isDenied
          ? `Permission was blocked/denied. Tap "How to Allow in Browser" below or click the 🔒 icon in the URL bar to enable.`
          : (err?.message || `Failed to request ${key} permission.`)
      });
    } finally {
      setRequestingPerm(null);
    }
  };

  const [factInput, setFactInput] = useState('');
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editingFactText, setEditingFactText] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingApiKey, setTestingApiKey] = useState(false);
  const [keySavedRecently, setKeySavedRecently] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<{ ok: boolean; message: string } | null>(null);

  // Helper to thoroughly sanitize key on input (strips invisible characters, quotes, prefixes)
  const cleanKeyInput = (val: string) => {
    if (!val) return '';
    let cleaned = val.replace(/[\u200B-\u200D\uFEFF\u00A0\r\n\t]/g, '').trim();
    // If user pasted an AIzaSy token embedded in code/command/text, extract it directly
    const aizaMatch = cleaned.match(/AIzaSy[A-Za-z0-9_-]{33}/);
    if (aizaMatch) return aizaMatch[0];

    if (cleaned.startsWith('GEMINI_API_KEY=')) cleaned = cleaned.replace(/^GEMINI_API_KEY=/, '').trim();
    if (cleaned.startsWith('API_KEY=')) cleaned = cleaned.replace(/^API_KEY=/, '').trim();
    cleaned = cleaned.replace(/^Bearer\s+/i, '').trim();
    cleaned = cleaned.replace(/^["'`“”‘’]|["'`“”‘’]$/g, '').trim();
    return cleaned;
  };

  const handleSaveKeyDirectly = (keyToSave?: string) => {
    const raw = keyToSave !== undefined ? keyToSave : (state.apiKey || '');
    const cleaned = cleanKeyInput(raw);
    updateState({ apiKey: cleaned });
    try {
      const stored = localStorage.getItem('sara_state');
      const parsed = stored ? JSON.parse(stored) : {};
      localStorage.setItem('sara_state', JSON.stringify({ ...parsed, apiKey: cleaned }));
    } catch (e) {}
    setKeySavedRecently(true);
    setTimeout(() => setKeySavedRecently(false), 2500);
  };

  const handlePasteKeyFromClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const cleaned = cleanKeyInput(text);
          updateState({ apiKey: cleaned });
          handleSaveKeyDirectly(cleaned);
          setKeyTestStatus(null);
        }
      }
    } catch (e) {
      console.warn('Clipboard read failed or permission denied:', e);
    }
  };

  const handleTestApiKey = async () => {
    const keyToTest = cleanKeyInput(state.apiKey || '');
    if (!keyToTest) {
      setKeyTestStatus({ ok: false, message: 'Please enter a Gemini API Key first.' });
      return;
    }
    setTestingApiKey(true);
    setKeyTestStatus(null);
    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const finalKey = data.cleanedKey || keyToTest;
        updateState({ apiKey: finalKey });
        try {
          const stored = localStorage.getItem('sara_state');
          const parsed = stored ? JSON.parse(stored) : {};
          localStorage.setItem('sara_state', JSON.stringify({ ...parsed, apiKey: finalKey }));
        } catch (e) {}
        setKeyTestStatus({
          ok: true,
          message: data.message || `Connected successfully with ${data.model || 'Gemini'}!`
        });
        setKeySavedRecently(true);
        setTimeout(() => setKeySavedRecently(false), 2500);
      } else {
        setKeyTestStatus({ ok: false, message: data.error || 'Connection failed with this API key.' });
      }
    } catch (e: any) {
      setKeyTestStatus({ ok: false, message: e.message || 'Network error while testing key.' });
    } finally {
      setTestingApiKey(false);
    }
  };

  // Location detection states
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  const saraDisplayName = getSaraName(state.persona);
  const currentPersonaType = state.persona.personaType || 'default';

  const handleUploadPersonaDp = async (type: PersonaPresetType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 512, 512, 0.88);
      if (updatePersonaAvatar) {
        updatePersonaAvatar(type, dataUrl);
      } else {
        const currentAvatars = state.persona.personaAvatars || {};
        const isCurrent = (state.persona.personaType || 'default') === type;
        updateState({
          persona: {
            ...state.persona,
            personaAvatars: { ...currentAvatars, [type]: dataUrl },
            saraAvatarUrl: isCurrent ? dataUrl : (state.persona.saraAvatarUrl || dataUrl)
          }
        });
      }
    } catch (err) {
      console.error('Failed to upload persona DP', err);
    }
    e.target.value = '';
  };

  const handleResetPersonaDp = (type: PersonaPresetType) => {
    if (resetPersonaAvatar) {
      resetPersonaAvatar(type);
    } else {
      const updatedAvatars = { ...(state.persona.personaAvatars || {}) };
      delete updatedAvatars[type];
      const defaultUrl = DEFAULT_PERSONA_AVATARS[type] || '/default-avatar.svg';
      const isCurrent = (state.persona.personaType || 'default') === type;
      updateState({
        persona: {
          ...state.persona,
          personaAvatars: updatedAvatars,
          saraAvatarUrl: isCurrent ? defaultUrl : state.persona.saraAvatarUrl
        }
      });
    }
  };

  const handleSelectPersonaPreset = (type: PersonaPresetType) => {
    const found = PERSONA_CONFIG.find(p => p.type === type);
    const presetName = found ? found.defaultName : 'Sara';
    const targetAvatar = getPersonaAvatar(state.persona, type);

    updateState({
      voicePitch: 0,
      persona: {
        ...state.persona,
        personaType: type,
        saraName: presetName,
        saraAvatarUrl: targetAvatar
      }
    });
    // Auto collapse back to 'less' once user chooses a persona
    setPersonaDisplayMode('less');
  };

  const handleFetchLocation = async () => {
    setLocatingUser(true);
    setLocationMessage('');
    try {
      const loc = await requestUserLocation();
      if (updateLocationContext) {
        updateLocationContext(loc);
      } else {
        updateState({ locationContext: loc });
      }
      setLocationMessage(`Location acquired: ${loc.formattedAddress || 'Success'}`);
    } catch (err: any) {
      setLocationMessage(err?.message || 'Could not acquire location permission');
    } finally {
      setLocatingUser(false);
    }
  };

  const handleResetLocation = () => {
    clearCachedLocation();
    if (updateLocationContext) {
      updateLocationContext(null);
    } else {
      updateState({ locationContext: undefined });
    }
    setLocationMessage('Location context deleted and reset.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0b1320] w-full max-w-xl rounded-2xl border border-blue-900/40 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-blue-900/30">
          <h2 className="text-xl font-medium text-blue-100 flex items-center gap-2">
            <span className="text-teal-400 text-2xl">✨</span> Companion Settings
          </h2>
          <button onClick={onClose} className="p-2 bg-blue-900/20 hover:bg-blue-800/40 rounded-lg text-blue-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs - Persona, Memory, and Permissions */}
        <div className="flex border-b border-blue-900/30">
          <button 
            onClick={() => setTab('persona')}
            className={`flex-1 py-3.5 text-xs sm:text-sm font-medium transition-colors ${tab === 'persona' ? 'text-blue-200 border-b-2 border-blue-500 bg-blue-900/10 font-bold' : 'text-blue-500 hover:text-blue-300'}`}
          >
            Persona
          </button>
          <button 
            onClick={() => setTab('memory')}
            className={`flex-1 py-3.5 text-xs sm:text-sm font-medium transition-colors ${tab === 'memory' ? 'text-blue-200 border-b-2 border-blue-500 bg-blue-900/10 font-bold' : 'text-blue-500 hover:text-blue-300'}`}
          >
            Memory ({state.facts.length})
          </button>
          <button 
            onClick={() => setTab('permissions')}
            className={`flex-1 py-3.5 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${tab === 'permissions' ? 'text-blue-200 border-b-2 border-blue-500 bg-blue-900/10 font-bold' : 'text-blue-500 hover:text-blue-300'}`}
          >
            <ShieldCheck size={14} className={tab === 'permissions' ? 'text-teal-400' : 'text-blue-500'} />
            <span>Permissions ({Object.values(permStatus).filter(s => s === 'granted').length}/6)</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 text-blue-100">
          
          {/* TAB 1: PERSONA */}
          {tab === 'persona' && (
            <div className="space-y-6">
              
              {/* Unified Persona & Companion DP Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-blue-400 tracking-wider uppercase flex items-center gap-1.5">
                    <Sparkles size={14} className="text-teal-400" /> Choose Persona & DP
                  </h3>
                  <button
                    type="button"
                    onClick={() => setPersonaDisplayMode(prev => prev === 'more' ? 'less' : 'more')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-blue-900/40 hover:bg-blue-800/50 text-blue-200 border border-blue-700/50 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    {personaDisplayMode === 'more' ? (
                      <>
                        <ChevronUp size={13} className="text-blue-400" />
                        <span>Less (Active only)</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown size={13} className="text-teal-400" />
                        <span>Change Persona</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-2.5">
                  {(personaDisplayMode === 'less' 
                    ? PERSONA_CONFIG.filter(p => currentPersonaType === p.type)
                    : PERSONA_CONFIG
                  ).map((p) => {
                    const avatarSrc = getPersonaAvatar(state.persona, p.type);
                    const isCustom = Boolean(state.persona.personaAvatars?.[p.type]);
                    const isActive = currentPersonaType === p.type;
                    const Icon = p.icon;

                    return (
                      <div
                        key={p.type}
                        onClick={() => handleSelectPersonaPreset(p.type)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-blue-950/40 border-cyan-400 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                            : 'bg-[#0e1624] border-blue-900/30 text-blue-300 hover:border-blue-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <img
                              src={avatarSrc}
                              alt={`${p.title} DP`}
                              className={`w-12 h-12 rounded-full object-cover border-2 shrink-0 ${
                                isActive ? 'border-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.4)]' : 'border-blue-900/60'
                              }`}
                            />
                            {isCustom && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0e1624]" title="Custom DP Active" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className={`text-sm font-bold flex items-center gap-1.5 ${p.textColor}`}>
                                <Icon size={15} className={p.themeColor} />
                                {p.title}
                              </span>
                              {isActive && (
                                <span className="text-[9px] bg-teal-500/25 text-teal-300 border border-teal-500/40 px-2 py-0.5 rounded font-bold">
                                  ACTIVE
                                </span>
                              )}
                              {isCustom ? (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-medium">
                                  CUSTOM DP
                                </span>
                              ) : (
                                <span className="text-[9px] bg-slate-800/80 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded font-medium">
                                  DEFAULT
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-blue-200/70 line-clamp-2 leading-relaxed">
                              {p.tagline}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => handleResetPersonaDp(p.type)}
                              className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                              title={`Reset ${p.title} DP to default`}
                            >
                              <RotateCcw size={12} />
                              <span className="hidden sm:inline">Reset</span>
                            </button>
                          )}

                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-200 border border-blue-500/40 rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow">
                            <Upload size={13} />
                            <span>{isCustom ? 'Change DP' : 'Upload DP'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleUploadPersonaDp(p.type, e)}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {personaDisplayMode === 'less' && (
                  <button
                    type="button"
                    onClick={() => setPersonaDisplayMode('more')}
                    className="w-full py-2 text-xs text-blue-400 hover:text-teal-300 bg-blue-950/30 hover:bg-blue-950/60 border border-dashed border-blue-800/60 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ChevronDown size={14} />
                    <span>Switch or view other 4 personas</span>
                  </button>
                )}
              </div>

              {/* Custom Companion & User Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-blue-400 mb-1.5 uppercase tracking-wider">Companion Name</label>
                  <input
                    type="text"
                    value={state.persona.saraName || ''}
                    onChange={e => updateState({ persona: { ...state.persona, saraName: e.target.value } })}
                    placeholder={saraDisplayName}
                    className="w-full bg-[#0a111a] border border-blue-900/50 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-400 mb-1.5 uppercase tracking-wider">Your Name</label>
                  <input
                    type="text"
                    value={state.persona.name || ''}
                    onChange={e => updateState({ persona: { ...state.persona, name: e.target.value } })}
                    placeholder="Enter your name"
                    className="w-full bg-[#0a111a] border border-blue-900/50 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-blue-400 mb-1.5 uppercase tracking-wider">Your Age</label>
                  <input
                    type="text"
                    value={state.persona.age || ''}
                    onChange={e => updateState({ persona: { ...state.persona, age: e.target.value } })}
                    placeholder="e.g. 21"
                    className="w-full bg-[#0a111a] border border-blue-900/50 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-400 mb-1.5 uppercase tracking-wider">Your Habits & Routine</label>
                  <input
                    type="text"
                    value={state.persona.habits || ''}
                    onChange={e => updateState({ persona: { ...state.persona, habits: e.target.value } })}
                    placeholder="e.g. Morning gym, evening studies, likes chai"
                    className="w-full bg-[#0a111a] border border-blue-900/50 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Custom Gemini API Key */}
              <div className="bg-[#0a111a] p-4 rounded-xl border border-blue-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-blue-400" />
                    <div>
                      <h4 className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Gemini API Key</h4>
                      <p className="text-[11px] text-blue-500/80">Apni free API key daalein lightning-fast aur reliable chat ke liye</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {state.apiKey && (
                      <button 
                        type="button" 
                        onClick={() => {
                          updateState({ apiKey: '' });
                          handleSaveKeyDirectly('');
                          setKeyTestStatus(null);
                        }} 
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 bg-red-950/30 rounded border border-red-500/20 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={() => setShowApiKey(!showApiKey)} 
                      className="text-xs text-blue-400 hover:text-blue-200 flex items-center gap-1 px-2 py-1 bg-blue-900/20 rounded border border-blue-500/20 transition-colors"
                    >
                      {showApiKey ? <EyeOff size={12} /> : <Eye size={12} />} {showApiKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={state.apiKey || ''}
                        onChange={e => {
                          const cleaned = cleanKeyInput(e.target.value);
                          updateState({ apiKey: cleaned });
                          if (keyTestStatus) setKeyTestStatus(null);
                        }}
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="Paste Gemini API Key (AIzaSy...)"
                        className="w-full bg-[#070c15] border border-blue-900/60 rounded-lg pl-3 pr-16 py-2 text-sm text-blue-100 focus:outline-none focus:border-blue-400 font-mono transition-colors"
                      />
                      {navigator?.clipboard?.readText && (
                        <button
                          type="button"
                          onClick={handlePasteKeyFromClipboard}
                          title="Paste from Clipboard"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 bg-blue-950/70 hover:bg-blue-900/80 border border-blue-800/40 text-[11px] text-blue-300 rounded font-medium transition-colors"
                        >
                          Paste
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveKeyDirectly()}
                      disabled={!state.apiKey}
                      className={`px-3 py-2 border rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                        keySavedRecently
                          ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300'
                          : 'bg-blue-900/30 hover:bg-blue-900/50 border-blue-700/40 text-blue-200 disabled:opacity-40'
                      }`}
                    >
                      {keySavedRecently ? <Check size={13} className="text-emerald-400" /> : null}
                      {keySavedRecently ? 'Saved!' : 'Save Key'}
                    </button>

                    <button
                      type="button"
                      onClick={handleTestApiKey}
                      disabled={testingApiKey || !state.apiKey}
                      className="px-3 py-2 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 disabled:opacity-40 transition-all"
                    >
                      {testingApiKey ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {testingApiKey ? 'Testing...' : 'Test Key'}
                    </button>
                  </div>

                  {/* Real-time input format validation note */}
                  {state.apiKey && (
                    <div className="text-[11px] px-1">
                      {state.apiKey.startsWith('http://') || state.apiKey.startsWith('https://') ? (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertTriangle size={12} className="shrink-0" />
                          Aapne website link paste kiya hai. AI Studio se 'Create API key' karke key copy karein.
                        </span>
                      ) : state.apiKey.includes('apps.googleusercontent.com') ? (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertCircle size={12} className="shrink-0" />
                          Yeh Google OAuth Client ID hai, Gemini API Key nahi hai.
                        </span>
                      ) : state.apiKey.startsWith('AIzaSy') ? (
                        state.apiKey.length >= 35 ? (
                          <span className="text-emerald-400/90 flex items-center gap-1">
                            <Check size={12} className="shrink-0" />
                            Format: Valid Google AI Studio key ({state.apiKey.length} chars). Click 'Test Key' to verify.
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1">
                            <AlertTriangle size={12} className="shrink-0" />
                            Format: Key adhuri lag rahi hai ({state.apiKey.length} chars, standard ~39 chars).
                          </span>
                        )
                      ) : (
                        <span className="text-blue-400/80 flex items-center gap-1">
                          <Info size={12} className="shrink-0" />
                          Note: Google AI Studio keys typically start with "AIzaSy...".
                        </span>
                      )}
                    </div>
                  )}

                  {keyTestStatus && (
                    <div className={`p-2.5 rounded-lg text-xs flex items-start gap-2 border ${
                      keyTestStatus.ok 
                        ? 'bg-green-950/30 border-green-500/40 text-green-300' 
                        : 'bg-red-950/30 border-red-500/40 text-red-300'
                    }`}>
                      {keyTestStatus.ok ? <Check size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                      <span className="leading-relaxed">{keyTestStatus.message}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-blue-500/70">
                      {state.apiKey ? '✨ Saved and ready.' : 'No key set (server fallback active).'}
                    </span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-200 flex items-center gap-1 font-medium underline"
                    >
                      Get Free Gemini API Key <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Location & GPS Context (Placed under API Key) */}
              <div className="bg-[#0a111a] p-4 rounded-xl border border-blue-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={18} className="text-teal-400" />
                    <div>
                      <h4 className="text-sm font-semibold text-blue-100">Location Context (GPS)</h4>
                      <p className="text-xs text-blue-400/70">Provides real-time city, timezone, and weather context.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {state.locationContext && (
                      <button
                        type="button"
                        onClick={handleResetLocation}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition-all"
                        title="Delete and reset saved location"
                      >
                        <RotateCcw size={12} />
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleFetchLocation}
                      disabled={locatingUser}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-900/30 hover:bg-teal-900/50 border border-teal-500/40 text-teal-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={locatingUser ? 'animate-spin' : ''} />
                      {locatingUser ? 'Detecting...' : 'Detect Location'}
                    </button>
                  </div>
                </div>

                {state.locationContext ? (
                  <div className="bg-[#0d1828] p-3 rounded-lg border border-teal-900/40 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-teal-200">
                        {state.locationContext.formattedAddress || `${state.locationContext.latitude.toFixed(2)}°, ${state.locationContext.longitude.toFixed(2)}°`}
                      </div>
                      <div className="text-blue-400/80 mt-0.5">
                        Lat: {state.locationContext.latitude.toFixed(4)} | Lon: {state.locationContext.longitude.toFixed(4)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {state.locationContext.temperature && (
                        <div className="text-right flex items-center gap-1.5 bg-teal-950/60 px-2.5 py-1 rounded-md border border-teal-500/30">
                          <CloudSun size={15} className="text-amber-400" />
                          <span className="font-bold text-amber-300">{state.locationContext.temperature}</span>
                          <span className="text-teal-200">{state.locationContext.weatherSummary}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleResetLocation}
                        className="p-1.5 text-gray-400 hover:text-red-300 hover:bg-red-950/40 rounded-md transition-colors"
                        title="Delete location context"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-blue-400/60 italic">
                    Location not yet detected. Click "Detect Location" to enable context-aware weather and local responses.
                  </div>
                )}
                {locationMessage && (
                  <p className="text-[11px] text-teal-400">{locationMessage}</p>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: MEMORY */}
          {tab === 'memory' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-[#0a111a] p-3.5 rounded-xl border border-blue-900/40">
                <div>
                  <h4 className="text-sm font-semibold text-blue-200">Auto-Extract Facts & Reminders</h4>
                  <p className="text-xs text-blue-400/70 mt-0.5">SARA automatically analyzes conversations to remember details and reminders.</p>
                </div>
                <button 
                  onClick={() => updateState({ autoExtractMemory: !state.autoExtractMemory })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${state.autoExtractMemory ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${state.autoExtractMemory ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex gap-3">
                <input type="text" value={factInput} onChange={e => setFactInput(e.target.value)}
                  placeholder="Manually add a memory (e.g. 'Prefers chai over coffee')"
                  className="flex-1 bg-[#0a111a] border border-blue-900/50 rounded-lg px-4 py-2.5 text-blue-100 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && factInput.trim()) {
                      addFact(factInput.trim());
                      setFactInput('');
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    if (factInput.trim()) {
                      addFact(factInput.trim());
                      setFactInput('');
                    }
                  }}
                  className="bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Add Fact
                </button>
              </div>

              <div className="space-y-3 mt-4">
                {state.facts.map(fact => (
                  <div key={fact.id} className="bg-[#0a111a] border border-blue-900/30 rounded-xl p-4 flex justify-between items-start group hover:border-blue-700/50 transition-colors">
                    {editingFactId === fact.id ? (
                      <div className="flex-1 mr-3 w-full">
                         <input 
                           type="text" 
                           value={editingFactText} 
                           onChange={e => setEditingFactText(e.target.value)} 
                           className="w-full bg-[#101b2d] border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none focus:border-blue-400" 
                           autoFocus
                         />
                         <div className="flex gap-2 mt-2">
                           <button onClick={() => { editFact(fact.id, editingFactText); setEditingFactId(null); }} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 bg-green-900/20 px-2 py-1 rounded">
                             <Check size={14} /> Save
                           </button>
                           <button onClick={() => setEditingFactId(null)} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-900/20 px-2 py-1 rounded">
                             <XCircle size={14} /> Cancel
                           </button>
                         </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {fact.temporalType && fact.temporalType !== 'General' && (
                             <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-900/50 text-blue-300 border border-blue-500/30 font-bold uppercase tracking-wider">{fact.temporalType}</span>
                          )}
                          <p className="text-sm text-blue-100 leading-relaxed">{fact.text}</p>
                        </div>
                        <p className="text-xs text-blue-500/60 mt-1">
                           Added: {fact.date} 
                           {fact.resolvedTime ? ` • Event Time: ${new Date(fact.resolvedTime).toLocaleString()}` : ''}
                        </p>
                      </div>
                    )}
                    {editingFactId !== fact.id && (
                      <div className="flex gap-2 ml-3 shrink-0">
                        <button onClick={() => { setEditingFactId(fact.id); setEditingFactText(fact.text); }} className="text-blue-500 hover:text-blue-300 p-1.5 bg-blue-900/20 rounded-md transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => removeFact(fact.id)} className="text-red-500 hover:text-red-300 p-1.5 bg-red-900/20 rounded-md transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {state.facts.length === 0 && (
                  <div className="text-center text-blue-500/60 py-10 text-sm">
                    No facts stored yet. Chat with SARA to build memories.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: APP PERMISSIONS CENTER */}
          {tab === 'permissions' && (
            <div className="space-y-6">
              {/* Header Overview Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/70 via-[#0d1c33] to-[#0a1526] border border-blue-800/40 space-y-3 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <ShieldCheck size={22} className="text-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>App Permissions Center</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 font-semibold uppercase">
                          System Access
                        </span>
                      </h3>
                      <p className="text-xs text-blue-200/70 mt-1 leading-relaxed">
                        SARA ko smoothly run karne ke liye in permissions ki requirement hoti hai. Agar aapne pehle kisi permission ko Deny kar diya tha, to aap yahan se directly Allow kar sakte hain.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-blue-900/40 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-blue-200">
                      Active: <strong className="text-teal-300 font-mono">{Object.values(permStatus).filter(s => s === 'granted').length}</strong> of 6 Permissions Allowed
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={refreshPermissions}
                      className="px-3 py-1.5 bg-blue-900/40 hover:bg-blue-800/60 text-blue-200 border border-blue-700/50 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                      <RefreshCw size={12} className={requestingPerm ? "animate-spin" : ""} />
                      <span>Refresh Status</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBrowserGuide(prev => !prev)}
                      className="px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                      <HelpCircle size={12} />
                      <span>{showBrowserGuide ? 'Hide Browser Guide' : 'How to Unblock?'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Alert Banner */}
              {permNotice && (
                <div className={`text-xs p-3 rounded-xl border flex items-start justify-between gap-2.5 transition-all ${
                  permNotice.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                    : permNotice.type === 'error'
                    ? 'bg-rose-950/40 border-rose-700/50 text-rose-200'
                    : 'bg-blue-950/40 border-blue-700/50 text-blue-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {permNotice.type === 'success' && <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />}
                    {permNotice.type === 'error' && <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />}
                    {permNotice.type === 'info' && <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />}
                    <span className="leading-relaxed">{permNotice.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPermNotice(null)}
                    className="text-white/60 hover:text-white shrink-0 p-0.5"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Browser Permission Reset Guide */}
              {showBrowserGuide && (
                <div className="p-4 rounded-xl bg-[#09121f] border border-teal-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-300 uppercase tracking-wider">
                    <Lock size={14} className="text-teal-400" /> Agar browser me permission block ho gayi ho to aise on karein:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-blue-200/80">
                    <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-900/40">
                      <div className="font-semibold text-white mb-1">1. URL Bar me jaayein</div>
                      <p>Browser ke top address bar me website name ke paas 🔒 ya ⚙️ icon par tap karein.</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-900/40">
                      <div className="font-semibold text-white mb-1">2. 'Site Settings' kholein</div>
                      <p>Wahan <strong>Permissions</strong> ya <strong>Site settings</strong> ka option select karein.</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-900/40">
                      <div className="font-semibold text-white mb-1">3. 'Allow' par set karein</div>
                      <p>Mic, Camera, Location etc. ko <strong>Allow</strong> select karein aur page reload karein.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* PERMISSION CARDS LIST */}
              <div className="space-y-3">
                {/* 1. MICROPHONE */}
                <div className="p-3.5 rounded-xl bg-[#0e1624] border border-blue-900/30 hover:border-blue-700/50 transition-all flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Mic size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">Microphone</span>
                        <span className="text-[11px] text-blue-400 font-medium">(Voice & Audio Calls)</span>
                        {permStatus.microphone === 'granted' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={11} /> Allowed
                          </span>
                        ) : permStatus.microphone === 'denied' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold flex items-center gap-1">
                            <AlertCircle size={11} /> Denied
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                            Not Allowed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-blue-300/70 mt-0.5">
                        Used for real-time 2-way voice calls, voice notes, and hands-free speech input with SARA.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {permStatus.microphone === 'granted' ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-900/20 text-emerald-400 text-xs font-semibold flex items-center gap-1 border border-emerald-800/30">
                        <CheckCircle2 size={13} /> Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={requestingPerm === 'microphone'}
                        onClick={() => handleRequestPermission('microphone')}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
                      >
                        {requestingPerm === 'microphone' ? <RefreshCw size={13} className="animate-spin" /> : <Mic size={13} />}
                        <span>Allow Microphone</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. CAMERA */}
                <div className="p-3.5 rounded-xl bg-[#0e1624] border border-blue-900/30 hover:border-blue-700/50 transition-all flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Video size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">Camera</span>
                        <span className="text-[11px] text-blue-400 font-medium">(Camera & Video Vision)</span>
                        {permStatus.camera === 'granted' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={11} /> Allowed
                          </span>
                        ) : permStatus.camera === 'denied' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold flex items-center gap-1">
                            <AlertCircle size={11} /> Denied
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                            Not Allowed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-blue-300/70 mt-0.5">
                        Used for live 2-way video calls, visual perception, room object recognition, and showing items to SARA.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {permStatus.camera === 'granted' ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-900/20 text-emerald-400 text-xs font-semibold flex items-center gap-1 border border-emerald-800/30">
                        <CheckCircle2 size={13} /> Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={requestingPerm === 'camera'}
                        onClick={() => handleRequestPermission('camera')}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
                      >
                        {requestingPerm === 'camera' ? <RefreshCw size={13} className="animate-spin" /> : <Video size={13} />}
                        <span>Allow Camera</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. PHONE CONTACTS */}
                <div className="p-3.5 rounded-xl bg-[#0e1624] border border-blue-900/30 hover:border-blue-700/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Contact size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">Phone Contacts</span>
                        <span className="text-[11px] text-blue-400 font-medium">(Phone Contacts & Auto-dial)</span>
                        {(state.contacts && state.contacts.length > 0) ? (
                          <button
                            type="button"
                            onClick={() => setShowContactsModal(true)}
                            className="group text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95"
                            title="Click to view, edit and delete synced contacts"
                          >
                            <CheckCircle2 size={11} className="text-emerald-400" />
                            <span>{state.contacts.length} Contacts Synced</span>
                            <span className="text-[9px] bg-emerald-500/25 group-hover:bg-emerald-400 group-hover:text-black px-1.5 py-0.5 rounded text-emerald-200 font-bold transition-colors">
                              Manage
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowContactsModal(true)}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold cursor-pointer transition-all active:scale-95"
                            title="Open contacts manager"
                          >
                            Not Synced (Click to Manage)
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-blue-300/70 mt-0.5">
                        Allows SARA to automatically search phone contacts and trigger native calling or SMS when you say: <em>"Mummy ko call lagao"</em> or <em>"Rahul ko SMS bhejo"</em>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(state.contacts && state.contacts.length > 0) && (
                      <button
                        type="button"
                        onClick={() => setShowContactsModal(true)}
                        className="px-3 py-2 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/40 hover:border-cyan-500/50 text-blue-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                        title="View, edit and manage synced contacts"
                      >
                        <Users size={13} className="text-cyan-400" />
                        <span>Manage Contacts</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={requestingPerm === 'contacts'}
                      onClick={() => handleRequestPermission('contacts')}
                      className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all disabled:opacity-50 active:scale-95"
                    >
                      {requestingPerm === 'contacts' ? <RefreshCw size={13} className="animate-spin" /> : <Contact size={13} />}
                      <span>{(state.contacts && state.contacts.length > 0) ? 'Sync Contacts Again' : 'Allow & Sync Contacts'}</span>
                    </button>
                  </div>
                </div>

                {/* 4. GEOLOCATION / LOCATION */}
                <div className="p-3.5 rounded-xl bg-[#0e1624] border border-blue-900/30 hover:border-blue-700/50 transition-all flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">Location (GPS)</span>
                        <span className="text-[11px] text-blue-400 font-medium">(Location & Weather)</span>
                        {state.locationContext?.city ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={11} /> {state.locationContext.city}
                          </span>
                        ) : permStatus.geolocation === 'granted' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={11} /> Allowed
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                            Not Allowed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-blue-300/70 mt-0.5">
                        Used for live weather forecasts, accurate sunrise/prayer timings, localized news, and nearby recommendations.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      disabled={requestingPerm === 'geolocation'}
                      onClick={() => handleRequestPermission('geolocation')}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
                    >
                      {requestingPerm === 'geolocation' ? <RefreshCw size={13} className="animate-spin" /> : <MapPin size={13} />}
                      <span>{state.locationContext?.city ? 'Update Location' : 'Allow Location'}</span>
                    </button>
                  </div>
                </div>

                {/* 5. NOTIFICATIONS */}
                <div className="p-3.5 rounded-xl bg-[#0e1624] border border-blue-900/30 hover:border-blue-700/50 transition-all flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Bell size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">Notifications</span>
                        <span className="text-[11px] text-blue-400 font-medium">(Alarm & Reminders)</span>
                        {permStatus.notifications === 'granted' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={11} /> Allowed
                          </span>
                        ) : permStatus.notifications === 'denied' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold flex items-center gap-1">
                            <AlertCircle size={11} /> Denied
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                            Not Allowed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-blue-300/70 mt-0.5">
                        Alerts you for task reminders, morning alarms, and incoming voice call ringers when app is in background.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {permStatus.notifications === 'granted' ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-900/20 text-emerald-400 text-xs font-semibold flex items-center gap-1 border border-emerald-800/30">
                        <CheckCircle2 size={13} /> Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={requestingPerm === 'notifications'}
                        onClick={() => handleRequestPermission('notifications')}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition-all disabled:opacity-50"
                      >
                        {requestingPerm === 'notifications' ? <RefreshCw size={13} className="animate-spin" /> : <Bell size={13} />}
                        <span>Allow Notifications</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 6. PERSISTENT STORAGE */}
                <div className="p-3.5 rounded-xl bg-[#0e1624] border border-blue-900/30 hover:border-blue-700/50 transition-all flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                      <HardDrive size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">Persistent Storage</span>
                        <span className="text-[11px] text-blue-400 font-medium">(Storage & Memory Safety)</span>
                        {permStatus.storage === 'granted' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={11} /> Persistent
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-semibold">
                            Standard
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-blue-300/70 mt-0.5">
                        Prevents the browser from clearing SARA's facts, relationship memories, and conversation history during low storage cleanups.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {permStatus.storage === 'granted' ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-900/20 text-emerald-400 text-xs font-semibold flex items-center gap-1 border border-emerald-800/30">
                        <CheckCircle2 size={13} /> Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={requestingPerm === 'storage'}
                        onClick={() => handleRequestPermission('storage')}
                        className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition-all disabled:opacity-50"
                      >
                        {requestingPerm === 'storage' ? <RefreshCw size={13} className="animate-spin" /> : <HardDrive size={13} />}
                        <span>Allow Storage</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* SYSTEM & DIAGNOSTICS LOGS (CLEAN ENTRY OR DEDICATED VIEW) */}
              {showLogsDrawer ? (
                <div id="permissions-diagnostics-logs-section" className="pt-4 border-t border-blue-900/40 space-y-3 animate-fade-in">
                  {/* Dedicated Header with Back Button */}
                  <div className="flex items-center justify-between gap-3 flex-wrap bg-[#08121f] p-3 rounded-xl border border-blue-900/50">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowLogsDrawer(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 border border-blue-800/60 text-blue-300 hover:text-white text-xs font-semibold transition-colors"
                      >
                        <ArrowLeft size={14} />
                        <span>Back</span>
                      </button>
                      <span className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Terminal size={15} className="text-teal-400" />
                        System Error Logs
                      </span>
                      {logs.filter(l => l.level === 'error').length > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-bold animate-pulse">
                          {logs.filter(l => l.level === 'error').length} Error{logs.filter(l => l.level === 'error').length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-medium">
                          No Errors
                        </span>
                      )}
                    </div>

                    {/* Actions & Filters (Errors Only by default) */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center bg-[#050b14] p-0.5 rounded-lg border border-blue-900/60 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setLogFilter('errors')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${logFilter === 'errors' ? 'bg-rose-600 text-white font-semibold' : 'text-blue-300 hover:text-white'}`}
                        >
                          Errors Only ({logs.filter(l => l.level === 'error').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogFilter('all')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${logFilter === 'all' ? 'bg-blue-600 text-white font-semibold' : 'text-blue-300 hover:text-white'}`}
                        >
                          All ({logs.length})
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={syncLogs}
                        title="Refresh Logs"
                        className="p-1.5 bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 hover:text-white border border-blue-800/40 rounded-lg transition-colors"
                      >
                        <RefreshCw size={13} className={isRefreshingLogs ? "animate-spin text-teal-400" : ""} />
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyLogs}
                        title="Copy Logs to Clipboard"
                        className="px-2.5 py-1.5 bg-blue-950/60 hover:bg-blue-900/60 text-blue-200 border border-blue-800/40 rounded-lg text-xs flex items-center gap-1 transition-colors"
                      >
                        {copiedLogs ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span>{copiedLogs ? 'Copied!' : 'Copy'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleClearLogs}
                        title="Clear Logs"
                        className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Log Console Window showing error logs */}
                  <div 
                    id="system-diagnostic-logs-window"
                    className="bg-[#050b14] border border-blue-950/80 rounded-xl p-3 max-h-72 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1.5 shadow-inner"
                  >
                    {(logFilter === 'errors' ? logs.filter(l => l.level === 'error') : logs).length === 0 ? (
                      <div className="py-8 text-center text-blue-400/60 flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 size={24} className="text-emerald-400/80" />
                        <span className="text-xs font-semibold text-emerald-300">Koi error record nahi hua. Sab kuch smoothly run kar raha hai!</span>
                        <span className="text-[10px] text-gray-500">Jab bhi koi error aayega, sirf wahi error log yahan dikhega.</span>
                      </div>
                    ) : (
                      (logFilter === 'errors' ? logs.filter(l => l.level === 'error') : logs).map(l => (
                        <div key={l.id} className="flex items-start gap-2 py-1 border-b border-blue-950/40 last:border-0 hover:bg-blue-950/20 px-1 rounded transition-colors">
                          <span className="text-slate-500 text-[10px] shrink-0 pt-0.5 select-none font-sans">
                            [{l.timestamp}]
                          </span>
                          
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0 border ${
                            l.level === 'error'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : l.level === 'warn'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : l.level === 'success'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          }`}>
                            {l.level}
                          </span>

                          <span className="text-[10px] px-1 rounded bg-blue-950 text-blue-300 border border-blue-800/40 shrink-0">
                            {l.module}
                          </span>

                          <span className={`flex-1 break-words ${
                            l.level === 'error'
                              ? 'text-rose-200'
                              : l.level === 'warn'
                              ? 'text-amber-200'
                              : l.level === 'success'
                              ? 'text-emerald-200'
                              : 'text-blue-100'
                          }`}>
                            {l.message}
                            {l.details && (
                              <span className="block text-[10px] text-slate-400 font-sans mt-0.5">
                                ↳ {l.details}
                              </span>
                            )}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* CLEAN LOGS ENTRY CARD AT BOTTOM OF PERMISSIONS */
                <div id="permissions-diagnostics-logs-section" className="pt-4 border-t border-blue-900/40">
                  <div 
                    onClick={() => {
                      setShowLogsDrawer(true);
                      syncLogs();
                    }}
                    className="p-3.5 rounded-xl bg-[#091322] border border-blue-900/60 hover:border-blue-700/80 cursor-pointer flex items-center justify-between transition-all group shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                        logs.some(l => l.level === 'error') 
                          ? 'bg-rose-950/60 border-rose-800/60 text-rose-400' 
                          : 'bg-blue-950 border-blue-800/60 text-teal-400'
                      }`}>
                        <Terminal size={17} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white group-hover:text-blue-200 transition-colors">
                            System Error Logs
                          </span>
                          {logs.some(l => l.level === 'error') ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-bold animate-pulse">
                              {logs.filter(l => l.level === 'error').length} Error{logs.filter(l => l.level === 'error').length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-medium">
                              No Errors
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-blue-300/60 mt-0.5">
                          {logs.some(l => l.level === 'error') ? 'Error detect hua hai. Click karke error details dekhein.' : 'Sabhi background tasks aur APIs smoothly run kar rahi hain.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-blue-400 group-hover:text-white transition-colors">
                      <span className="text-xs font-medium">Open</span>
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-blue-900/30 bg-[#070c15] flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-blue-300 hover:text-blue-100 hover:bg-blue-900/30 transition-colors">
            Close
          </button>
          <button onClick={onClose} className="px-6 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all">
            Save Settings
          </button>
        </div>
      </div>

      {/* Synced Contacts Management Modal (View, Search, Add, Edit, Delete) */}
      {showContactsModal && (
        <SyncedContactsModal
          isOpen={showContactsModal}
          onClose={() => setShowContactsModal(false)}
          contacts={state.contacts || []}
          onAddContact={(contact) => {
            if (addContact) {
              addContact(contact);
            } else {
              const newContact: PhoneContact = {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
                ...contact
              };
              updateState({ contacts: [...(state.contacts || []), newContact] });
            }
          }}
          onEditContact={(id, updates) => {
            if (editContact) {
              editContact(id, updates);
            } else {
              updateState({
                contacts: (state.contacts || []).map(c => c.id === id ? { ...c, ...updates } : c)
              });
            }
          }}
          onRemoveContact={(id) => {
            if (removeContact) {
              removeContact(id);
            } else {
              updateState({
                contacts: (state.contacts || []).filter(c => c.id !== id)
              });
            }
          }}
          onClearAllContacts={() => {
            if (clearAllContacts) {
              clearAllContacts();
            } else {
              updateState({ contacts: [] });
            }
          }}
        />
      )}
    </div>
  );
}
