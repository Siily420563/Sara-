import React, { useState, useRef, useEffect } from 'react';
import { Settings, BrainCircuit, Phone, Video, Trash2, Send, Mic, Image as ImageIcon, Volume2, VolumeX, Bell, Clock, Camera, X, Sparkles, Quote, RefreshCw, Newspaper, ExternalLink, MessageSquareText, Search, Globe, Square, Download, MapPin, Play, MessageCircle, Youtube, MessageSquare, FileText, FileUp, Upload, Copy, Check, Calendar, CalendarDays } from 'lucide-react';
import { useAppState, getSaraName, getPersonaAvatar, EventCategory } from './store';
import SettingsModal from './components/SettingsModal';
import CallScreen from './components/CallScreen';
import CameraOverlay from './components/CameraOverlay';
import PwaInstallModal from './components/PwaInstallModal';
import ScheduleHubModal, { HubTab } from './components/ScheduleHubModal';
import ImageGenModal from './components/ImageGenModal';
import { getTodayObservance } from './observances';
import { initPwaListeners, subscribeToInstallPrompt, promptPwaInstall, registerPeriodicBackgroundSync, registerOneOffSync } from './services/pwa';
import { requestPersistentStorage, checkStorageStatus } from './services/storage';
import { requestUserLocation, formatLocationPromptString } from './services/location';
import { playAudioChunk, resetAudioQueue, isAudioPlaying, playAlarmChime } from './audio';
import { openWebsite, switchTab, browseWeb, closeTab } from './services/browserControl';
import { addClientLog } from './services/logger';
import { executeDeepLink, getWhatsAppLinks, getTelegramLinks, getYouTubeLinks } from './services/deepLinks';
import { getUserId } from './services/userRoom';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface AutomationAction {
  type: 'youtube' | 'whatsapp' | 'telegram' | 'phone_call' | 'sms' | 'generated_image' | 'neet_diagram';
  title: string;
  query?: string;
  recipient?: string;
  phone?: string;
  username?: string;
  message?: string;
  prompt?: string;
  url: string;
  appUrl?: string;
  webUrl?: string;
  waMeUrl?: string;
  status: 'ready' | 'opened';
  labelingPoints?: string[];
  neetFacts?: string[];
  subject?: string;
}

export interface AttachmentItem {
  id: string;
  mimeType: string;
  data: string;
  url: string;
  name?: string;
  size?: number;
}

interface Message {
  id: string;
  role: 'user' | 'sara';
  text: string;
  time: string;
  inlineData?: { mimeType: string; data: string; name?: string; size?: number };
  attachments?: Array<{ mimeType: string; data: string; name?: string; size?: number }>;
  action?: AutomationAction;
}

export default function App() {
  const { state, updateState, addFact, removeFact, editFact, addMemory, resolveMemory, addReminder, markReminderDone, deleteReminder, addCalendarEvent, deleteCalendarEvent, editCalendarEvent, markEventReminded, updateGreetingState, updatePersonaAvatar, resetPersonaAvatar, addContact, removeContact, editContact, importContacts, clearAllContacts } = useAppState();
  const saraDisplayName = getSaraName(state.persona);
  const saraAvatarUrl = getPersonaAvatar(state.persona);
  
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem('sara_chat_history');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const [loadingMemory, setLoadingMemory] = useState(true);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'info' | 'reminder' }>>([]);
  const [activeAutomation, setActiveAutomation] = useState<{
    type: 'youtube' | 'whatsapp' | 'telegram' | 'phone_call' | 'sms' | 'web';
    title: string;
    message?: string;
    url: string;
    appUrl?: string;
    webUrl?: string;
    label: string;
  } | null>(null);

  const [showNewsModal, setShowNewsModal] = useState(false);
  const [showImageGenModal, setShowImageGenModal] = useState(false);
  const [newsArticles, setNewsArticles] = useState<Array<{ title: string; source: string; link: string; pubDate?: string; description?: string; imageUrl?: string; category?: string }>>([]);
  const [newsCategory, setNewsCategory] = useState<string>('Top Stories');
  const [newsSearchQuery, setNewsSearchQuery] = useState<string>('');
  const [loadingNews, setLoadingNews] = useState<boolean>(false);
  const [newsError, setNewsError] = useState<string>('');

  const fetchNewsData = async (cat?: string, q?: string) => {
    setLoadingNews(true);
    setNewsError('');
    const categoryToFetch = cat !== undefined ? cat : newsCategory;
    const queryToFetch = q !== undefined ? q : newsSearchQuery;
    try {
      const params = new URLSearchParams();
      if (categoryToFetch && categoryToFetch !== 'Top Stories') params.append('category', categoryToFetch);
      if (queryToFetch) params.append('q', queryToFetch);
      
      const res = await fetch(`/api/news?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch news");
      const data = await res.json();
      if (data.error) {
        setNewsError(data.error);
        setNewsArticles([]);
      } else if (data.articles) {
        setNewsArticles(data.articles);
      } else {
        setNewsArticles([]);
      }
    } catch (e: any) {
      setNewsError(e.message || "Could not fetch live news right now.");
      setNewsArticles([]);
    } finally {
      setLoadingNews(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'info' | 'reminder' = 'info') => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const handleAddFactWithToast = (text: string, temporalType?: any, resolvedTime?: string | null) => {
    addFact(text, temporalType, resolvedTime);
    showToast(`${saraDisplayName} remembered: "${text}"`, 'success');
  };

  const handleAddReminderWithToast = (text: string, time: number) => {
    addReminder(text, time);
    showToast(`Reminder scheduled: "${text}"`, 'reminder');
  };

  const handleInsertGeneratedImage = (imagePrompt: string, imageUrl: string) => {
    const saraMsgId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: saraMsgId,
      role: 'sara',
      text: `Maine tumhare liye ye AI image generate ki hai: "${imagePrompt}"`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: {
        type: 'generated_image',
        title: imagePrompt,
        prompt: imagePrompt,
        url: imageUrl,
        status: 'ready'
      }
    }]);
    showToast(`🎨 Image added to chat: "${imagePrompt.slice(0, 25)}..."`, 'info');
  };

  const fetchDailyInsight = async (forceRefresh = false) => {
    const todayIsoDate = new Date().toISOString().split('T')[0];
    if (!forceRefresh && state.dailyInsight && state.dailyInsight.date === todayIsoDate) {
      return;
    }
    setLoadingInsight(true);
    try {
      const res = await fetch('/api/daily-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facts: state.facts,
          userContext: state.persona,
          customApiKey: state.apiKey
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tipOrQuote) {
          updateState({
            dailyInsight: {
              date: todayIsoDate,
              tipOrQuote: data.tipOrQuote,
              category: data.category || 'Productivity Tip'
            }
          });
        }
      }
    } catch (e) {
      console.error("Failed to fetch daily insight:", e);
    } finally {
      setLoadingInsight(false);
    }
  };

  // Safe chat history persistence effect
  useEffect(() => {
    try {
      const sanitized = messages.slice(-30).map(m => ({
        ...m,
        attachments: m.attachments ? m.attachments.map(a => ({
          mimeType: a.mimeType,
          data: (a.data && a.data.length > 3000) ? '' : a.data
        })) : undefined,
        inlineData: m.inlineData ? {
          mimeType: m.inlineData.mimeType,
          data: (m.inlineData.data && m.inlineData.data.length > 3000) ? '' : m.inlineData.data
        } : undefined
      }));
      localStorage.setItem('sara_chat_history', JSON.stringify(sanitized));
    } catch (e) {
      console.warn("Failed to persist chat history:", e);
    }
  }, [messages]);

  const chatWsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Audio Context init on first interaction
  const initAudio = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx({ sampleRate: 24000 });
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch (e) {
      console.warn("AudioContext init error:", e);
    }
  };

  const stopSpeaking = () => {
    resetAudioQueue();
    if (chatWsRef.current && chatWsRef.current.readyState === WebSocket.OPEN) {
      try {
        chatWsRef.current.send(JSON.stringify({ interrupt: true }));
      } catch (e) {}
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {}
      sourceNodeRef.current = null;
    }
    setSaraState('IDLE');
  };

  const playTTS = async (base64: string) => {
    if (audioMuted || !base64) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {}
    }
    
    setSaraState('SPEAKING');
    try {
      playAudioChunk(ctx, base64, state.playbackSpeed || 1.0, state.voicePitch || 0);
      setTimeout(() => {
        if (!isAudioPlaying()) {
          setSaraState('IDLE');
        }
      }, 1000);
    } catch(e) {
      console.log(e?.message || String(e));
      setSaraState('IDLE');
    }
  };

  const speakVoicePrompt = async (text: string) => {
    if (audioMuted || !text) return;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          customApiKey: state.apiKey,
          personaType: state.persona.personaType
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          playTTS(data.audioBase64);
        }
      }
    } catch (e) {
      console.log("Voice prompt notice:", e);
    }
  };

  const handleToolExecution = (toolCall: { name: string; args: any }, targetMsgId: string) => {
    const { name, args } = toolCall;
    if (name === 'extract_fact') {
      handleAddFactWithToast(args.fact, args.temporalType || 'General', args.resolvedTime || null);
    } else if (name === 'set_reminder') {
      handleAddReminderWithToast(args.text, new Date(args.timeIso).getTime());
      const reminderTimeStr = new Date(args.timeIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const fallbackReminderMsg = `Ji! Maine reminder set kar diya hai: **"${args.text}"** (${reminderTimeStr}). Time hote hi main aapko alert kar dungi! ⏰`;
      setMessages(prev => prev.map(m => m.id === targetMsgId ? {
        ...m,
        text: m.text?.trim() ? m.text : fallbackReminderMsg
      } : m));
    } else if (name === 'add_calendar_event') {
      const { title, date, time, category, description, confirmationNote } = args;
      const rawCat = (category || 'general').toLowerCase().trim();
      let safeCategory: EventCategory = 'general';
      if (['trip', 'birthday', 'meeting', 'reminder', 'personal', 'study', 'health', 'general'].includes(rawCat)) {
        safeCategory = rawCat as EventCategory;
      } else if (rawCat.includes('trip') || rawCat.includes('travel') || rawCat.includes('tour') || rawCat.includes('flight')) {
        safeCategory = 'trip';
      } else if (rawCat.includes('birth') || rawCat.includes('party') || rawCat.includes('anniversary')) {
        safeCategory = 'birthday';
      } else if (rawCat.includes('meet') || rawCat.includes('work') || rawCat.includes('office') || rawCat.includes('interview')) {
        safeCategory = 'meeting';
      } else if (rawCat.includes('study') || rawCat.includes('exam') || rawCat.includes('test') || rawCat.includes('neet') || rawCat.includes('class')) {
        safeCategory = 'study';
      } else if (rawCat.includes('health') || rawCat.includes('doc') || rawCat.includes('med') || rawCat.includes('gym')) {
        safeCategory = 'health';
      } else if (rawCat.includes('remind') || rawCat.includes('alarm') || rawCat.includes('todo') || rawCat.includes('task')) {
        safeCategory = 'reminder';
      } else if (rawCat.includes('person') || rawCat.includes('family')) {
        safeCategory = 'personal';
      }

      addCalendarEvent({
        title: title || 'Calendar Event',
        date: date,
        time: time || undefined,
        category: safeCategory,
        description: description || undefined
      });
      showToast(`📅 Calendar: "${title}" (${date}${time ? ' ' + time : ''})`, 'reminder');

      const fallbackConfirmation = confirmationNote || `Ji! Maine aapke calendar me mark kar diya hai: **${title}** on **${date}**${time ? ` at **${time}**` : ''}. Event aane par main aapko inform kar dungi! 📅`;
      setMessages(prev => prev.map(m => m.id === targetMsgId ? {
        ...m,
        text: m.text?.trim() ? m.text : fallbackConfirmation
      } : m));

      if (confirmationNote && !audioMuted) {
        speakVoicePrompt(confirmationNote);
      }
    } else if (name === 'delete_calendar_event') {
      const { title, date } = args;
      const match = (state.events || []).find(e => 
        e.title.toLowerCase().includes((title || '').toLowerCase()) && 
        (!date || e.date === date)
      );
      if (match) {
        deleteCalendarEvent(match.id);
        showToast(`🗑️ Event removed: "${match.title}"`, 'info');
        setMessages(prev => prev.map(m => m.id === targetMsgId ? {
          ...m,
          text: m.text?.trim() ? m.text : `Ji! Maine "${match.title}" aapke calendar se remove kar diya hai.`
        } : m));
      }
    } else if (name === 'play_youtube_video') {
      const q = args?.query || (toolCall as any)?.result?.query || '';
      const { appUrl, webUrl } = getYouTubeLinks(q);
      const chosenUrl = (toolCall as any)?.result?.url || webUrl;
      const targetAppUrl = (toolCall as any)?.result?.appUrl || appUrl;
      
      executeDeepLink(targetAppUrl, { fallbackUrl: chosenUrl });

      setMessages(prev => prev.map(m => m.id === targetMsgId ? {
        ...m,
        action: {
          type: 'youtube',
          title: `Play "${q}" on YouTube`,
          query: q,
          url: chosenUrl,
          appUrl: targetAppUrl,
          webUrl: chosenUrl,
          status: 'ready'
        }
      } : m));

      setActiveAutomation({
        type: 'youtube',
        title: `YouTube: "${q}"`,
        url: chosenUrl,
        appUrl: targetAppUrl,
        webUrl: chosenUrl,
        label: 'Play on YouTube'
      });

      showToast(`🎵 Opening YouTube: "${q}"...`, 'info');
    } else if (name === 'send_whatsapp_message') {
      const recipient = args?.contactName || args?.recipient || args?.name || (toolCall as any)?.result?.contactName || '';
      const rawPhone = args?.phoneNumber || args?.phone || (toolCall as any)?.result?.phoneNumber || '';
      const waMsg = args?.message || args?.text || (toolCall as any)?.result?.message || '';

      const { appUrl, waMeUrl, apiUrl, webUrl } = getWhatsAppLinks(rawPhone, waMsg);
      const chosenUrl = (toolCall as any)?.result?.url || apiUrl;
      const chosenAppUrl = (toolCall as any)?.result?.appUrl || appUrl;
      const chosenWebUrl = (toolCall as any)?.result?.webUrl || webUrl;

      executeDeepLink(chosenAppUrl, { fallbackUrl: chosenUrl });

      setMessages(prev => prev.map(m => m.id === targetMsgId ? {
        ...m,
        action: {
          type: 'whatsapp',
          title: `Send WhatsApp to ${recipient || rawPhone || 'Contact'}`,
          recipient: recipient || rawPhone,
          phone: rawPhone,
          message: waMsg,
          url: chosenUrl,
          appUrl: chosenAppUrl,
          webUrl: chosenWebUrl,
          waMeUrl: waMeUrl,
          status: 'ready'
        }
      } : m));

      setActiveAutomation({
        type: 'whatsapp',
        title: `WhatsApp to ${recipient || rawPhone || 'Contact'}`,
        message: waMsg,
        url: chosenUrl,
        appUrl: chosenAppUrl,
        webUrl: chosenWebUrl,
        label: 'Open WhatsApp Chat'
      });

      showToast(`💬 Opening WhatsApp for ${recipient || rawPhone || 'Contact'}...`, 'info');
    } else if (name === 'send_telegram_message') {
      const recipient = args?.contactName || args?.recipient || args?.name || (toolCall as any)?.result?.contactName || '';
      const rawPhone = args?.phoneNumber || args?.phone || (toolCall as any)?.result?.phoneNumber || '';
      const username = args?.username || (toolCall as any)?.result?.username || '';
      const tgMsg = args?.message || args?.text || (toolCall as any)?.result?.message || '';

      const { appUrl, webUrl, directUrl } = getTelegramLinks({ phoneNumber: rawPhone, username, message: tgMsg });
      const chosenUrl = (toolCall as any)?.result?.url || directUrl || webUrl;
      const chosenAppUrl = (toolCall as any)?.result?.appUrl || appUrl;
      const chosenWebUrl = (toolCall as any)?.result?.webUrl || webUrl;

      if (tgMsg) {
        try {
          navigator.clipboard?.writeText(tgMsg);
        } catch (e) {}
      }

      executeDeepLink(chosenAppUrl, { fallbackUrl: chosenUrl });

      const displayRecipient = recipient || (username ? `@${username}` : (rawPhone ? `+${rawPhone}` : 'Contact'));

      setMessages(prev => prev.map(m => m.id === targetMsgId ? {
        ...m,
        action: {
          type: 'telegram',
          title: `Telegram to ${displayRecipient}`,
          recipient: displayRecipient,
          phone: rawPhone,
          username: username,
          message: tgMsg,
          url: chosenUrl,
          appUrl: chosenAppUrl,
          webUrl: chosenWebUrl,
          status: 'ready'
        }
      } : m));

      setActiveAutomation({
        type: 'telegram',
        title: `Telegram to ${displayRecipient}`,
        message: tgMsg,
        url: chosenUrl,
        appUrl: chosenAppUrl,
        webUrl: chosenWebUrl,
        label: 'Open Telegram'
      });

      showToast(`✈️ Opening Telegram for ${displayRecipient}...`, 'info');
    } else if (name === 'open_website' || name === 'open_tab') {
      const url = args?.url || args?.query || (toolCall as any)?.result?.url || '';
      const tabName = args?.tabName;
      openWebsite(url, { tabName });
      executeDeepLink(url);
      setActiveAutomation({
        type: 'web',
        title: `Opening ${url || 'website'}`,
        url,
        label: 'Open Website'
      });
      showToast(`🌐 Opening ${url || 'website'} in browser...`, 'info');
    } else if (name === 'switch_tab') {
      const tabName = args?.tabName || '';
      switchTab(tabName);
      showToast(`🔄 Switching to ${tabName} tab...`, 'info');
    } else if (name === 'browse_web') {
      const query = args?.query || '';
      const searchEngine = args?.searchEngine || 'google';
      browseWeb(query, searchEngine);
      showToast(`🔍 Browsing "${query}" on ${searchEngine}...`, 'info');
    } else if (name === 'close_tab') {
      const tabName = args?.tabName;
      closeTab(tabName);
      showToast(`❌ Closed ${tabName || 'browser'} tab`, 'info');
    } else if (name === 'end_call') {
      if (callMode !== 'none') {
        setCallMode('none');
      }
      showToast(`📞 Call ended`, 'info');
    } else if (name === 'make_phone_call') {
      const rawPhone = args?.phoneNumber || args?.phone || (toolCall as any)?.result?.phoneNumber || '';
      const contactName = args?.contactName || args?.name || (toolCall as any)?.result?.contactName || '';
      const cleanPhone = String(rawPhone || '').replace(/[^0-9+]/g, '');
      if (cleanPhone) {
        const telUrl = `tel:${cleanPhone}`;
        executeDeepLink(telUrl, { target: '_self' });
        setMessages(prev => prev.map(m => m.id === targetMsgId ? {
          ...m,
          action: {
            type: 'phone_call' as const,
            title: `Call ${contactName || cleanPhone}`,
            recipient: contactName,
            phone: cleanPhone,
            url: telUrl,
            status: 'ready'
          }
        } : m));
        setActiveAutomation({
          type: 'phone_call',
          title: `Calling ${contactName ? `${contactName} (${cleanPhone})` : cleanPhone}`,
          url: telUrl,
          label: 'Call Now'
        });
        showToast(`📞 Dialing ${contactName ? `${contactName} (${cleanPhone})` : cleanPhone}...`, 'info');
      }
    } else if (name === 'send_sms') {
      const rawPhone = args?.phoneNumber || args?.phone || (toolCall as any)?.result?.phoneNumber || '';
      const contactName = args?.contactName || args?.name || (toolCall as any)?.result?.contactName || '';
      const smsMsg = args?.message || args?.text || (toolCall as any)?.result?.message || '';
      const cleanPhone = String(rawPhone || '').replace(/[^0-9+]/g, '');
      if (cleanPhone) {
        const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(smsMsg || '')}`;
        executeDeepLink(smsUrl, { target: '_self' });
        setMessages(prev => prev.map(m => m.id === targetMsgId ? {
          ...m,
          action: {
            type: 'sms' as const,
            title: `Send SMS to ${contactName || cleanPhone}`,
            recipient: contactName,
            phone: cleanPhone,
            message: smsMsg,
            url: smsUrl,
            status: 'ready'
          }
        } : m));
        setActiveAutomation({
          type: 'sms',
          title: `SMS to ${contactName || cleanPhone}`,
          message: smsMsg,
          url: smsUrl,
          label: 'Open SMS App'
        });
        showToast(`✉️ SMS ready for ${contactName || cleanPhone}`, 'info');
      }
    } else if (name === 'generate_image') {
      const { prompt, aspectRatio } = args || {};
      const imgUrl = (toolCall as any)?.result?.imageUrl;
      const model = (toolCall as any)?.result?.model || 'AI Engine';
      if (imgUrl) {
        setMessages(prev => prev.map(m => m.id === targetMsgId ? {
          ...m,
          action: {
            type: 'generated_image',
            title: prompt || 'AI Generated Image',
            prompt: prompt,
            url: imgUrl,
            status: 'ready'
          }
        } : m));
        addClientLog('success', 'IMAGE_GEN', `Image rendered in chat: "${(prompt || '').slice(0, 45)}"`, `Engine: ${model}`);
        showToast(`🎨 Image generated: "${(prompt || 'Visual').slice(0, 30)}..."`, 'info');
      } else {
        addClientLog('info', 'IMAGE_GEN', `Requesting fallback visual engine for prompt: "${(prompt || '').slice(0, 45)}"`);
        const fallbackDirectUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent((prompt || 'peaceful serene art').trim())}?width=1024&height=1024&model=turbo&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

        fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, aspectRatio, customApiKey: state.apiKey })
        })
        .then(res => res.json())
        .then(data => {
          const finalUrl = data.imageUrl || fallbackDirectUrl;
          setMessages(prev => prev.map(m => m.id === targetMsgId ? {
            ...m,
            action: {
              type: 'generated_image',
              title: prompt || 'AI Generated Image',
              prompt: prompt,
              url: finalUrl,
              status: 'ready'
            }
          } : m));
          addClientLog('success', 'IMAGE_GEN', `Image received and rendered`, `Engine: ${data.model || 'AI Art Engine (Turbo HD)'}`);
          showToast(`🎨 Image generated: "${(prompt || 'Visual').slice(0, 30)}..."`, 'info');
        })
        .catch(err => {
          console.warn("Fallback to client visual URL:", err);
          setMessages(prev => prev.map(m => m.id === targetMsgId ? {
            ...m,
            action: {
              type: 'generated_image',
              title: prompt || 'AI Generated Image',
              prompt: prompt,
              url: fallbackDirectUrl,
              status: 'ready'
            }
          } : m));
          addClientLog('info', 'IMAGE_GEN', `Rendered via direct Edge CDN fallback`);
          showToast(`🎨 Image generated: "${(prompt || 'Visual').slice(0, 30)}..."`, 'info');
        });
      }
    } else if (name === 'get_neet_diagram_or_topic') {
      const { topic } = args || {};
      const result = (toolCall as any)?.result;
      const diagram = result?.diagram;
      const imgUrl = result?.imageUrl || (topic ? `https://image.pollinations.ai/prompt/${encodeURIComponent(`NCERT scientific textbook diagram of ${topic} for NEET UG entrance exam, clear labels, clean white background`)}?width=1024&height=1024&model=turbo&nologo=true&seed=888` : '');
      
      if (imgUrl) {
        setMessages(prev => prev.map(m => m.id === targetMsgId ? {
          ...m,
          action: {
            type: 'neet_diagram',
            title: diagram?.title || topic || 'NEET NCERT Diagram',
            prompt: diagram?.title || topic,
            url: imgUrl,
            status: 'ready',
            labelingPoints: diagram?.keyLabelingPoints || result?.keyLabelingPoints,
            neetFacts: diagram?.neetHighYieldFacts || result?.highYieldFacts,
            subject: diagram?.subject
          }
        } : m));
        addClientLog('success', 'NEET', `NEET diagram & NCERT notes loaded: "${diagram?.title || topic}"`);
        showToast(`🩺 NEET Diagram: "${(diagram?.title || topic || 'Concept').slice(0, 28)}"`, 'info');
      }
    }
  };

  const fallbackHttpChat = async ({
    userMessage,
    attachments = [],
    history = [],
    saraMsgId,
    signal
  }: {
    userMessage: string;
    attachments?: Array<{ mimeType: string; data: string }>;
    history?: Message[];
    saraMsgId: string;
    signal?: AbortSignal;
  }) => {
    const currentUid = getUserId();
    const chatRes = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUid
      },
      signal,
      body: JSON.stringify({
        userId: currentUid,
        message: userMessage,
        history: (history || []).slice(-10).map(m => ({ role: m.role, text: m.text })),
        inlineDataList: attachments,
        facts: state.facts,
        userContext: state.persona,
        customApiKey: state.apiKey,
        localTime: new Date().toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locationContext: formatLocationPromptString(state.locationContext),
        contacts: state.contacts || []
      })
    });

    if (signal?.aborted) return;
    if (!chatRes.ok) {
      const errData = await chatRes.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${chatRes.status}`);
    }

    const reader = chatRes.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let accumulatedText = "";
    let done = false;
    let buffer = "";

    while (!done) {
      if (signal?.aborted) {
        try { await reader.cancel(); } catch (e) {}
        break;
      }
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";
        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine.startsWith('data: ')) continue;
          const dataStr = cleanLine.slice(6).trim();
          if (dataStr === '[DONE]') {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.toolCall) {
              handleToolExecution(parsed.toolCall, saraMsgId);
            }
            if (parsed.text) {
              accumulatedText += parsed.text;
              setMessages(prev => prev.map(m => m.id === saraMsgId ? { ...m, text: accumulatedText } : m));
            }
          } catch (e) {}
        }
      }
    }

    // Call Google Gemini Cloud TTS on fallback to avoid native Android TTS completely
    if (!audioMuted && accumulatedText.trim() && !signal?.aborted) {
      speakVoicePrompt(accumulatedText.slice(0, 500));
    }
  };

  const streamGeminiLiveChat = ({
    userMessage,
    attachments = [],
    history = [],
    saraMsgId,
    signal
  }: {
    userMessage: string;
    attachments?: Array<{ mimeType: string; data: string }>;
    history?: Message[];
    saraMsgId: string;
    signal?: AbortSignal;
  }): Promise<void> => {
    return new Promise((resolve, reject) => {
      initAudio();
      stopSpeaking();

      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl = `${wsProto}//${window.location.host}/live?name=${encodeURIComponent(state.persona.name || 'User')}&saraName=${encodeURIComponent(saraDisplayName)}&personaType=${encodeURIComponent(state.persona.personaType || 'default')}&userId=${encodeURIComponent(getUserId())}`;
      const factsStr = (state.facts || []).map(f => typeof f === 'string' ? f : f.text).join('|');
      if (factsStr) wsUrl += `&facts=${encodeURIComponent(factsStr)}`;
      if (state.apiKey) wsUrl += `&customApiKey=${encodeURIComponent(state.apiKey)}`;
      wsUrl += `&localTime=${encodeURIComponent(new Date().toLocaleString())}`;
      wsUrl += `&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`;
      if (state.locationContext) {
        wsUrl += `&locationContext=${encodeURIComponent(formatLocationPromptString(state.locationContext))}`;
      }
      if (state.contacts && state.contacts.length > 0) {
        wsUrl += `&contacts=${encodeURIComponent(JSON.stringify(state.contacts))}`;
      }

      let accumulatedText = "";
      let hasCompleted = false;

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        console.warn("Failed to instantiate WebSocket, using HTTP fallback:", e);
        fallbackHttpChat({ userMessage, attachments, history, saraMsgId, signal })
          .then(resolve)
          .catch(reject);
        return;
      }

      chatWsRef.current = ws;

      const finishStream = () => {
        if (hasCompleted) return;
        hasCompleted = true;
        setIsTyping(false);
        setIsGenerating(false);
        try { ws.close(); } catch (e) {}
        setTimeout(() => {
          if (!isAudioPlaying()) {
            setSaraState('IDLE');
          }
        }, 800);
        resolve();
      };

      if (signal) {
        signal.addEventListener('abort', () => {
          try { ws.close(); } catch (e) {}
          stopSpeaking();
          finishStream();
        });
      }

      ws.onopen = () => {
        if (signal?.aborted) {
          ws.close();
          return;
        }

        const formattedTurns: any[] = [];
        (history || []).slice(-8).forEach(msg => {
          const parts: any[] = [{ text: msg.text || " " }];
          if (msg.attachments && Array.isArray(msg.attachments)) {
            msg.attachments.forEach(att => {
              parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
            });
          }
          formattedTurns.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts
          });
        });

        const currentParts: any[] = [];
        if (userMessage) currentParts.push({ text: userMessage });
        (attachments || []).forEach(att => {
          currentParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
        });
        if (currentParts.length === 0) currentParts.push({ text: " " });

        formattedTurns.push({ role: 'user', parts: currentParts });

        ws.send(JSON.stringify({
          clientContent: {
            turns: formattedTurns,
            turnComplete: true
          }
        }));
      };

      ws.onmessage = (event) => {
        if (signal?.aborted) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.error) {
            console.warn("Live chat message error:", msg.error);
            const errText = typeof msg.error === 'string' ? msg.error : JSON.stringify(msg.error);
            setMessages(prev => prev.map(m => m.id === saraMsgId ? { ...m, text: errText } : m));
            finishStream();
            return;
          }

          if (msg.interrupted) {
            resetAudioQueue();
            setSaraState('IDLE');
          }

          // Word-by-word streaming audio playback via Google Gemini Live API!
          if (msg.audio) {
            if (!audioMuted) {
              setSaraState('SPEAKING');
              if (audioCtxRef.current) {
                if (audioCtxRef.current.state === 'suspended') {
                  audioCtxRef.current.resume().catch(() => {});
                }
                playAudioChunk(
                  audioCtxRef.current,
                  msg.audio,
                  state.playbackSpeed || 1.0,
                  state.voicePitch || 0
                );
              }
            }
          }

          // Real-time transcribed text streaming
          if (msg.text) {
            accumulatedText += msg.text;
            setIsTyping(false);
            setMessages(prev => prev.map(m => m.id === saraMsgId ? { ...m, text: accumulatedText } : m));
          }

          // Execute tool calls in real-time
          if (msg.toolCall) {
            handleToolExecution(msg.toolCall, saraMsgId);
          }

          if (msg.turnComplete) {
            finishStream();
          }
        } catch (err) {
          console.error("Chat WebSocket parsing error:", err);
        }
      };

      ws.onerror = (err) => {
        console.warn("WebSocket error, falling back to HTTP:", err);
        fallbackHttpChat({ userMessage, attachments, history, saraMsgId, signal })
          .then(resolve)
          .catch(reject)
          .finally(finishStream);
      };

      ws.onclose = () => {
        finishStream();
      };
    });
  };
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'persona' | 'memory' | 'permissions'>('persona');
  const [showScheduleHub, setShowScheduleHub] = useState(false);
  const [hubTab, setHubTab] = useState<HubTab>('calendar');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [callMode, setCallMode] = useState<'none' | 'voice' | 'video'>('none');
  const [showCameraOverlay, setShowCameraOverlay] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [saraState, setSaraState] = useState<'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'>('IDLE');
  const [previewImage, setPreviewImage] = useState<{ url: string; prompt: string } | null>(null);
  
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeReminders, setActiveReminders] = useState<string[]>([]);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStop = () => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {
        console.warn("Abort error:", e);
      }
      abortControllerRef.current = null;
    }
    stopSpeaking();
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {}
      sourceNodeRef.current = null;
    }
    setIsGenerating(false);
    setIsTyping(false);
    setSaraState('IDLE');

    // If the latest message was an empty SARA message placeholder, remove it cleanly
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === 'sara' && !lastMsg.text.trim()) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  };

  const initializedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load persistent memory from server on startup
  useEffect(() => {
    async function loadServerMemory() {
      try {
        const userId = getUserId();
        const res = await fetch(`/api/load-memory?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
            localStorage.setItem('sara_chat_history', JSON.stringify(data.messages));
          }
          if (data.state) {
            // Preserve local apiKey from localStorage if server state does not have one
            let savedApiKey = (state.apiKey || '').trim();
            if (!savedApiKey) {
              try {
                const storedLocal = localStorage.getItem('sara_state');
                if (storedLocal) {
                  const parsed = JSON.parse(storedLocal);
                  if (parsed.apiKey && typeof parsed.apiKey === 'string') {
                    savedApiKey = parsed.apiKey.trim();
                  }
                }
              } catch(e) {}
            }
            const effectiveKey = (data.state.apiKey && data.state.apiKey.trim()) ? data.state.apiKey.trim() : savedApiKey;
            const mergedState = {
              ...data.state,
              apiKey: effectiveKey
            };
            updateState(mergedState);
            localStorage.setItem('sara_state', JSON.stringify(mergedState));
          }
        }
      } catch (e) {
        console.error("Failed to load memory from server:", e);
      } finally {
        setLoadingMemory(false);
      }
    }
    loadServerMemory();
  }, []);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    return (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'default';
  });

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) {
      showToast('Notifications are not supported in this browser.', 'info');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        showToast('Notifications enabled! Reminders will pop up even when app is closed.', 'success');
        if ('serviceWorker' in navigator) {
          const swReg = await navigator.serviceWorker.ready;
          let subscription = await swReg.pushManager.getSubscription();
          if (!subscription) {
            const res = await fetch('/api/vapidPublicKey');
            const vapidPublicKey = await res.text();
            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
            subscription = await swReg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedVapidKey
            });
          }
          await fetch('/api/subscribe', {
            method: 'POST',
            body: JSON.stringify({ userId: getUserId(), subscription }),
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } else {
        showToast('Notification permission denied.', 'info');
      }
    } catch(e) {
      console.error('Notification permission error:', e);
    }
  };

  // Save messages to server and localstorage whenever they change (after initial load is done)
  useEffect(() => {
    if (loadingMemory || isTyping) return;
    localStorage.setItem('sara_chat_history', JSON.stringify(messages));
    fetch('/api/save-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId(), messages })
    }).catch(e => console.error("Failed to save messages to server:", e));
  }, [messages, loadingMemory, isTyping]);

  // Save state to server whenever it changes (after initial load is done)
  useEffect(() => {
    if (loadingMemory) return;
    fetch('/api/save-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId(), state })
    }).catch(e => console.error("Failed to save state to server:", e));
  }, [state, loadingMemory]);

  // Request Notification Permissions & Subscribe to Push
  useEffect(() => {
    async function setupPush() {
      if ('Notification' in window && 'serviceWorker' in navigator) {
        try {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            try {
              const swReg = await navigator.serviceWorker.ready;
              let subscription = await swReg.pushManager.getSubscription();
              if (!subscription) {
                const res = await fetch('/api/vapidPublicKey');
                if (res.ok) {
                  const vapidPublicKey = await res.text();
                  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
                  if (convertedVapidKey.length > 0) {
                    subscription = await swReg.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: convertedVapidKey
                    });
                  }
                }
              }
              if (subscription) {
                await fetch('/api/subscribe', {
                  method: 'POST',
                  body: JSON.stringify({ userId: getUserId(), subscription }),
                  headers: { 'Content-Type': 'application/json' }
                });
              }
            } catch(e) {
              console.log('Push setup failed', (e as any)?.message || String(e));
            }
          }
        } catch(e) {
          console.log('Notification permission request failed', e);
        }
      }
    }
    setupPush().catch(e => console.log('Push setup error:', e));
  }, []);

  // Initialize PWA install prompt listeners, background sync, storage persistence and GPS
  useEffect(() => {
    initPwaListeners();
    const unsub = subscribeToInstallPrompt((canInstall) => {
      setCanInstallPwa(canInstall);
    });

    registerPeriodicBackgroundSync();
    registerOneOffSync();
    requestPersistentStorage().then(() => checkStorageStatus()).catch(() => {});

    // Check if location permission is already available and fetch if so
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(res => {
        if (res.state === 'granted') {
          requestUserLocation().then(loc => updateState({ locationContext: loc })).catch(() => {});
        }
      }).catch(() => {});
    }

    return () => {
      unsub();
    };
  }, []);

  // Ping backend to update last seen time
  useEffect(() => {
    const ping = () => fetch('/api/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() })
    }).catch(() => {});
    ping(); // Ping on load
    const interval = setInterval(ping, 60000); // Ping every minute while app is open
    return () => clearInterval(interval);
  }, []);

  // Sync reminders and calendar events to backend for background push delivery & alarms
  useEffect(() => {
    fetch('/api/syncReminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: getUserId(), 
        reminders: state.reminders,
        events: state.events 
      })
    }).catch(e => console.log(e?.message || String(e)));
  }, [state.reminders, state.events]);

  const showBrowserNotification = async (title: string, options?: any) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, options);
          return;
        }
      }
    } catch (err) {
      console.warn('SW showNotification failed:', err);
    }

    try {
      new Notification(title, options);
    } catch (err) {
      console.warn('Notification constructor failed:', err);
    }
  };

  // Real-time Reminder Interval Check & Conversation Interruption
  useEffect(() => {
    const checkReminders = async () => {
      const now = Date.now();
      const dueReminders = state.reminders.filter(r => !r.done && r.time <= now);
      
      for (const r of dueReminders) {
        if (!activeReminders.includes(r.id)) {
          setActiveReminders(prev => [...prev, r.id]);
          
          // 1. Immediately interrupt any ongoing speech or TTS
          stopSpeaking();

          // 1b. Play synthesized 3-tone alarm alert sound
          playAlarmChime(audioCtxRef.current);
          
          // 2. Trigger browser notification if allowed
          if ('Notification' in window && Notification.permission === 'granted') {
             showBrowserNotification('🚨 SARA Reminder Alert', { 
               body: r.text, 
               icon: '/pwa-192x192.png',
               badge: '/pwa-192x192.png',
               vibrate: [300, 150, 300, 150, 450],
               requireInteraction: true
             });
          }
          
          // 3. Add explicit interruption turn from SARA into chat history
          const interruptMsg = `🚨 **REMINDER INTERRUPT!**\n\nSuno! Pehle tumhe ye remind karana tha: **${r.text}**. Pehle ye kaam dekh lo, phir hum apni baat aage continue karte hain! 😊`;
          
          setMessages(prev => [...prev, {
             id: Date.now().toString(),
             role: 'sara', 
             text: interruptMsg, 
             time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
          }]);

          // 4. Speak interruption out loud immediately using Gemini Voice
          if (!audioMuted) {
             speakVoicePrompt(`Suno! Ek second roko. Pehle tumhe ye remind karana hai: ${r.text}. Pehle ye kar lo, phir hum baate continue karte hain!`);
          }

          // 5. Toast alert
          showToast(`🚨 Reminder Interrupt: "${r.text}"`, 'reminder');

          // 6. Mark reminder done
          markReminderDone(r.id);
        }
      }

      // Check Calendar Events for today & due times (India Standard Time)
      const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      const istParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).formatToParts(new Date());
      const istH = parseInt(istParts.find(p => p.type === 'hour')?.value || '0', 10);
      const istM = parseInt(istParts.find(p => p.type === 'minute')?.value || '0', 10);
      const nowMinutes = istH * 60 + istM;
      const dueEvents = (state.events || []).filter(e => {
        if (e.reminded) return false;
        if (e.date < todayIso) return false;
        if (e.date === todayIso) {
          if (!e.time) return true;
          let eventMinutes = -1;
          const match24 = e.time.match(/^(\d{1,2}):(\d{2})$/);
          if (match24) {
            eventMinutes = parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
          } else {
            const match12 = e.time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (match12) {
              let h = parseInt(match12[1], 10);
              const m = parseInt(match12[2], 10);
              const isPm = match12[3].toUpperCase() === 'PM';
              if (isPm && h < 12) h += 12;
              if (!isPm && h === 12) h = 0;
              eventMinutes = h * 60 + m;
            }
          }
          if (eventMinutes >= 0) {
            return nowMinutes >= eventMinutes;
          }
          return true;
        }
        return false;
      });

      for (const ev of dueEvents) {
        markEventReminded(ev.id);
        stopSpeaking();
        playAlarmChime(audioCtxRef.current);

        if ('Notification' in window && Notification.permission === 'granted') {
          showBrowserNotification(`📅 SARA Calendar Alert: ${ev.title}`, {
            body: `Aaj ka plan: ${ev.title}${ev.time ? ` at ${ev.time}` : ''}${ev.description ? ` (${ev.description})` : ''}`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            vibrate: [300, 150, 300, 150, 450],
            requireInteraction: true
          });
        }

        const calendarMsg = `📅 **CALENDAR SCHEDULE ALERT!**\n\nSuno! Aaj tumhara scheduled plan hai: **${ev.title}**${ev.time ? ` at **${ev.time}**` : ''}${ev.description ? `\n*Details: ${ev.description}*` : ''}. All the best! 😊`;
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'sara',
          text: calendarMsg,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        if (!audioMuted) {
          speakVoicePrompt(`Suno! Calendar event alert: Aaj tumhara schedule hai — ${ev.title}${ev.time ? ' at ' + ev.time : ''}.`);
        }

        showToast(`📅 Calendar Alert: "${ev.title}"`, 'reminder');
      }
    };
    const interval = setInterval(checkReminders, 2500);

    // Immediate check on tab visibility change
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkReminders();
        fetch('/api/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: getUserId() })
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [state.reminders, state.events, activeReminders, audioMuted]);

  // Listen to Service Worker messages when user clicks on background push notification
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const messageHandler = (event: MessageEvent) => {
        if (event.data && event.data.type === 'REMINDER_PUSH_CLICKED') {
          const reminderText = event.data.text;
          if (reminderText) {
            stopSpeaking();
            showToast(`🚨 Reminder Alert: "${reminderText}"`, 'reminder');
            if (!audioMuted) {
              speakVoicePrompt(`Suno! Pehle tumhe ye remind karana tha: ${reminderText}.`);
            }
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', messageHandler);
      return () => {
        navigator.serviceWorker.removeEventListener('message', messageHandler);
      };
    }
  }, [audioMuted]);

  const handleTestAlarm = () => {
    playAlarmChime(audioCtxRef.current);
    if ('Notification' in window && Notification.permission === 'granted') {
      showBrowserNotification(`🚨 ${saraDisplayName} Alarm Alert`, {
        body: 'Alarm test ringing! Background notifications and alarm sound are fully operational.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [300, 150, 300, 150, 450],
        requireInteraction: true
      });
    }
    showToast('🚨 Alarm chime & notification tested!', 'reminder');
    if (!audioMuted) {
      speakVoicePrompt(`Alarm test successful! SARA notification alert system fully active hai.`);
    }
  };
  
  // Smart Greeting Logic (First Open of Day vs Same-Day Re-open) & Persistent Memory
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    const initGreeting = async () => {
      const now = new Date();
      const todayIsoDate = now.toISOString().split('T')[0]; // e.g. "2026-08-12"
      const lastGreetingDate = state.lastGreetingDate || localStorage.getItem('sara_last_greeting_date') || '';
      const isFirstOpenOfDay = lastGreetingDate !== todayIsoDate;

      const hour = now.getHours();
      let timeOfDay = "Morning";
      if (hour >= 12 && hour < 17) {
        timeOfDay = "Afternoon";
      } else if (hour >= 17 && hour < 21) {
        timeOfDay = "Evening";
      } else if (hour >= 21 || hour < 5) {
        timeOfDay = "Night";
      }

      // Check today's observance / international day if any
      const todayObservance = getTodayObservance(now);

      // Fetch daily insight if needed
      fetchDailyInsight();

      const upcomingReminders = state.reminders.filter(r => !r.done && r.time > Date.now());
      let missedReminders = state.reminders.filter(r => !r.done && r.time <= Date.now());

      // Get pending memory follow-ups
      const dueMemories = (state.memories || []).filter(m => !m.resolved && m.followUpDate <= todayIsoDate);
      
      let shouldTriggerGreeting = false;
      let promptPrefix = "";
      
      const storedHistoryStr = localStorage.getItem('sara_chat_history');
      let currentHistory: Message[] = [];
      try {
        if (storedHistoryStr) currentHistory = JSON.parse(storedHistoryStr);
      } catch(e) {}
      
      const nowTime = Date.now();
      const lastInteractionTime = state.lastInteractionTimestamp || parseInt(localStorage.getItem('sara_last_interaction_time') || '0', 10);
      const minsSinceLastInteraction = lastInteractionTime ? Math.floor((nowTime - lastInteractionTime) / 60000) : 999;
      
      if (currentHistory.length === 0) {
        shouldTriggerGreeting = true;
        promptPrefix += `This is the user's very first interaction ever with you! Give a warm, welcoming introduction as SARA, their intelligent Hinglish companion. `;
        updateGreetingState(todayIsoDate, 'full');
        localStorage.setItem('sara_last_greeting_date', todayIsoDate);
      } else if (isFirstOpenOfDay) {
        shouldTriggerGreeting = true;
        updateGreetingState(todayIsoDate, 'full');
        localStorage.setItem('sara_last_greeting_date', todayIsoDate);
        promptPrefix += `GREETING_TYPE: FULL (FIRST OPEN OF THE DAY).
Structure your greeting like this:
1. Warm ${timeOfDay} salutation in Hinglish (e.g., "Good morning ${state.persona.name || 'friend'}!").
2. Day + full date ("Aaj ${now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} hai").
3. International / Observance Day if any today: ${todayObservance ? `"${todayObservance}" (mention briefly in 1 line)` : "None special"}.
4. Pending task/reminder summary (1-2 lines max).
5. One proactive memory follow-up if due today: ${dueMemories.length > 0 ? `"${dueMemories[0].text}"` : "None"}.
6. Short open-ended line: "Bolo, kya karna hai aaj?" `;
      } else if (minsSinceLastInteraction > 15) {
        shouldTriggerGreeting = true;
        updateGreetingState(todayIsoDate, 'short');
        promptPrefix += `GREETING_TYPE: SHORT (SAME-DAY RE-OPEN).
The user just re-opened the app (${minsSinceLastInteraction} minutes since last interaction).
Give a SHORT, VARIED, casual greeting based on time gap (e.g. "Haan bolo, wapas aa gaye!", "Kaisa chal raha hai din?", "Shaam ho gayi — din kaisa raha?").
CRITICAL: Do NOT repeat the date, day of the week, or international day again on the same day! `;
      }
      
      localStorage.setItem('sara_last_interaction_time', nowTime.toString());
      
      if (state.facts && state.facts.length > 0) {
        promptPrefix += `Facts & Memories: ${JSON.stringify(state.facts.map(f => f.text))}. `;
      }

      if (missedReminders.length > 0) {
        if (!shouldTriggerGreeting) {
          shouldTriggerGreeting = true;
        }
        promptPrefix += `Mention missed reminders naturally: ${missedReminders.map(r => r.text).join(', ')}. `;
        missedReminders.forEach(r => markReminderDone(r.id));
      }

      if (upcomingReminders.length > 0) {
        promptPrefix += `Upcoming reminders: ${JSON.stringify(upcomingReminders.map(r => ({ text: r.text, time: new Date(r.time).toLocaleTimeString() })))}. `;
      }
      
      if (shouldTriggerGreeting) {
         setIsTyping(true);
         setSaraState('THINKING');
         stopSpeaking();
         const saraMsgId = Date.now().toString();

         // Append SARA greeting placeholder
         setMessages(prev => [...prev, { 
           id: saraMsgId, 
           role: 'sara', 
           text: '', 
           time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
         }]);

         try {
           await streamGeminiLiveChat({
             userMessage: "SYSTEM EVENT: USER_APP_OPENED. " + promptPrefix,
             history: currentHistory.slice(-6),
             saraMsgId
           });
         } catch(e: any) {
            const errorMsg = e?.message || String(e);
            if (errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("API key")) {
              console.warn("Greeting quota limitation:", errorMsg);
            } else {
              console.error("Failed to initialize greeting:", e);
            }
            setIsTyping(false);
            setSaraState('IDLE');
            const timeGreet = timeOfDay === "Morning" ? "Good morning" : (timeOfDay === "Afternoon" ? "Good afternoon" : "Good evening");
            const friendlyMsg = `${timeGreet}${state.persona.name ? ' ' + state.persona.name : ''}! Mai ${saraDisplayName} hoon, aapki AI companion. Aaj kya baat karni hai?`;
            setMessages(prev => prev.map(m => m.id === saraMsgId ? { ...m, text: friendlyMsg } : m));
         }
      }
    };
    
    initGreeting();
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isGenerating || isTyping) return;
    
    const text = input.trim();
    const currentAttachments = [...attachments];
    
    setInput('');
    setAttachments([]);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    initAudio();
    stopSpeaking(); // Stop SARA from speaking immediately on user interaction/send
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text, 
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      attachments: currentAttachments.map(a => ({ mimeType: a.mimeType, data: a.data, name: a.name, size: a.size }))
    };

    setMessages(prev => [...prev, userMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);
    setIsTyping(true);
    setSaraState('THINKING');

    // Track interaction time
    try {
      localStorage.setItem('sara_last_interaction_time', Date.now().toString());
    } catch (e) {
      console.warn("localStorage write error:", e);
    }

    const saraMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { 
      id: saraMsgId, 
      role: 'sara', 
      text: '', 
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
    }]);

    try {
      const hasPdfOrDocument = currentAttachments.some(a => 
        a.mimeType === 'application/pdf' || 
        a.name?.toLowerCase().endsWith('.pdf') || 
        a.mimeType.startsWith('text/')
      );

      if (hasPdfOrDocument) {
        // Deep Document & PDF analysis via Gemini 3.8 Flash fallbackHttpChat
        await fallbackHttpChat({
          userMessage: text,
          attachments: currentAttachments.map(a => ({ mimeType: a.mimeType, data: a.data })),
          history: messages.slice(-10),
          saraMsgId,
          signal: controller.signal
        });
      } else {
        await streamGeminiLiveChat({
          userMessage: text,
          attachments: currentAttachments.map(a => ({ mimeType: a.mimeType, data: a.data })),
          history: messages.slice(-10),
          saraMsgId,
          signal: controller.signal
        });
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || controller.signal.aborted) {
        setSaraState('IDLE');
        setIsTyping(false);
        setIsGenerating(false);
        return;
      }

      let cleanErrMsg = e?.message || String(e);
      try {
        if (cleanErrMsg.startsWith('{') || cleanErrMsg.includes('{"error"')) {
          const parsed = JSON.parse(cleanErrMsg.slice(cleanErrMsg.indexOf('{')));
          if (parsed.error?.message) cleanErrMsg = parsed.error.message;
          else if (parsed.error) cleanErrMsg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
        }
      } catch (err) {}

      setSaraState('IDLE');
      setIsTyping(false);
      setMessages(prev => prev.map(m => m.id === saraMsgId ? {
        ...m,
        text: cleanErrMsg.startsWith('Error:') ? cleanErrMsg : `Error: ${cleanErrMsg}`
      } : m));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
      setIsTyping(false);
    }
  };
  
  const handleClear = () => {
    setMessages([]);
    localStorage.removeItem('sara_chat_history');
    setAttachments([]);
    fetch('/api/save-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId(), messages: [] })
    }).catch(e => console.error("Failed to save cleared memory:", e));
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    if (sourceNodeRef.current) {
       sourceNodeRef.current.stop();
       setSaraState('IDLE');
    }
    setShowDeleteConfirm(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isDocument?: boolean) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        const [prefix, base64] = result.split(',');
        let mimeType = prefix.match(/:(.*?);/)?.[1];
        if (!mimeType || mimeType === 'application/octet-stream') {
          if (file.name.toLowerCase().endsWith('.pdf')) {
            mimeType = 'application/pdf';
          } else if (file.name.toLowerCase().endsWith('.txt')) {
            mimeType = 'text/plain';
          } else if (file.name.toLowerCase().endsWith('.csv')) {
            mimeType = 'text/csv';
          } else if (file.name.toLowerCase().endsWith('.json')) {
            mimeType = 'application/json';
          } else if (file.name.toLowerCase().endsWith('.md')) {
            mimeType = 'text/markdown';
          } else {
            mimeType = file.type || (isDocument ? 'application/pdf' : 'image/jpeg');
          }
        }
        const newAttachment: AttachmentItem = {
          id: Math.random().toString(36).slice(2) + Date.now(),
          mimeType,
          data: base64,
          url: result,
          name: file.name,
          size: file.size
        };
        setAttachments(prev => [...prev, newAttachment]);
        showToast(mimeType === 'application/pdf' ? `📄 PDF attached: "${file.name}"` : `📎 File attached: "${file.name}"`, 'info');
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'sara',
        text: "Error: Speech recognition is not supported in this browser.",
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }]);
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
       const transcript = Array.from(event.results)
         .map((result: any) => result[0].transcript)
         .join('');
       setInput(transcript);
    };
    recognition.onerror = (e: any) => {
       console.log("Speech reco error", e?.message || e?.error || String(e));
       setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    
    try {
      recognition.start();
    } catch (e) {
      console.warn("Speech recognition start error:", e);
      setIsListening(false);
    }
  };

  if (callMode !== 'none') {
    return <CallScreen mode={callMode} state={state} onEndCall={() => setCallMode('none')} addFact={handleAddFactWithToast} addReminder={handleAddReminderWithToast} addCalendarEvent={addCalendarEvent} deleteCalendarEvent={deleteCalendarEvent} />;
  }

  const todayIsoForBadge = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const activeAlarmsCount = state.reminders.filter(r => !r.done && r.time > Date.now()).length;
  const todayCalendarEventsCount = (state.events || []).filter(e => e.date === todayIsoForBadge).length;
  const hubTotalBadgeCount = activeAlarmsCount + todayCalendarEventsCount;

  return (
    <div className="flex flex-col h-screen bg-[#060B14] text-gray-100 font-sans overflow-hidden">
      <header className="p-4 flex items-center justify-between border-b border-[#0F1A2A] bg-[#0B111A] z-20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <h1 className="font-bold tracking-widest text-white uppercase text-base">{saraDisplayName}</h1>
        </div>
        <div className="flex gap-1.5 sm:gap-2 items-center">
          {/* Combined Schedule Hub Button: Daily Quotes + Alarms + Calendar */}
          <button 
            onClick={() => { setHubTab('calendar'); setShowScheduleHub(true); }} 
            className={`p-2 relative rounded-xl transition-all border flex items-center justify-center ${
              hubTotalBadgeCount > 0
                ? 'text-cyan-300 hover:text-white bg-gradient-to-r from-cyan-950/60 to-purple-950/60 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                : 'text-[#4889A1] hover:text-white hover:bg-[#1A2A40] bg-[#0D1624] border-[#162A40]'
            }`}
            title="Schedule Hub (Daily Quotes • Alarms & Timers • In-App Calendar)"
          >
            <CalendarDays size={18} />
            {hubTotalBadgeCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 text-black text-[9px] font-extrabold flex items-center justify-center shadow">
                {hubTotalBadgeCount}
              </span>
            )}
          </button>
          <button onClick={() => { 
            const newMuted = !audioMuted;
            setAudioMuted(newMuted); 
            if (newMuted) {
              if (sourceNodeRef.current) sourceNodeRef.current.stop();
              stopSpeaking();
            }
          }} className="p-2 text-[#4889A1] hover:text-white hover:bg-[#1A2A40] bg-[#0D1624] rounded-xl transition-all border border-[#162A40]">
            {audioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button onClick={() => setCallMode('voice')} className="p-2 text-[#4889A1] hover:text-white hover:bg-[#1A2A40] bg-[#0D1624] rounded-xl transition-all border border-[#162A40]" title="Voice Call">
            <Phone size={18} />
          </button>
          <button onClick={() => setCallMode('video')} className="p-2 text-[#4889A1] hover:text-white hover:bg-[#1A2A40] bg-[#0D1624] rounded-xl transition-all border border-[#162A40]" title="Video Call">
            <Video size={18} />
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-[#4889A1] hover:text-white hover:bg-[#1A2A40] bg-[#0D1624] rounded-xl transition-all border border-[#162A40]" title="Delete Chat History">
            <Trash2 size={18} />
          </button>
          <button onClick={() => { setSettingsTab('persona'); setShowSettings(true); }} className="p-2 text-[#4889A1] hover:text-white hover:bg-[#1A2A40] bg-[#0D1624] rounded-xl transition-all border border-[#162A40]" title="Settings">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Character Display Area */}
      <div className="flex flex-col items-center justify-center py-8 border-b border-[#0F1A2A] bg-[#060B14] relative z-10">
         <div className="relative w-28 h-28 mb-3 flex items-center justify-center group">
            {saraState === 'SPEAKING' && <div className="absolute inset-0 rounded-full border border-[#2B90B5] animate-ping"></div>}
            {saraState === 'THINKING' && <div className="absolute inset-1 rounded-full border border-[#2B90B5] animate-spin"></div>}
            <div className={`w-24 h-24 rounded-full bg-[#060B14] border-2 flex items-center justify-center transition-all duration-500 border-[#1C4E63] overflow-hidden shadow-[0_0_20px_rgba(43,144,181,0.25)]`}>
              <img 
                src={saraAvatarUrl} 
                alt={saraDisplayName} 
                className="w-full h-full object-cover" 
              />
            </div>
         </div>
         <div className="text-[10px] text-[#2B90B5] font-mono uppercase tracking-[0.2em] font-semibold bg-[#0D1624] px-3 py-1 rounded-md border border-[#162A40]">
            {saraDisplayName} {saraState === 'IDLE' ? 'SLEEPING / IDLE' : saraState}
         </div>
      </div>

      {/* Reminders Bubble */}
      {state.reminders.filter(r => r.time <= Date.now() && r.done && Date.now() - r.time < 60000).map(r => (
         <div key={r.id} className="mx-4 mt-4 bg-[#0D1624] border border-[#162A40] text-[#4889A1] px-4 py-2 rounded-lg flex items-center gap-3 text-sm animate-pulse">
           <Bell size={16} /> <span>Reminder: {r.text}</span>
         </div>
      ))}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 relative z-10 bg-[#060B14] scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
             {msg.role === 'sara' && (
                <div className="flex items-center gap-2 mb-1 pl-1">
                   <img src={saraAvatarUrl} className="w-5 h-5 rounded-full object-cover" alt={saraDisplayName}/>
                   <span className="text-[10px] text-[#4889A1] uppercase tracking-wider">{saraDisplayName}</span>
                </div>
             )}
             {msg.role === 'user' && (
                <div className="flex items-center justify-end gap-2 mb-1 pr-1 self-end w-full">
                   <span className="text-[10px] text-[#4889A1] uppercase tracking-wider">You</span>
                   {state.persona.userPhotoUrl ? (
                      <img src={state.persona.userPhotoUrl} className="w-5 h-5 rounded-full object-cover animate-wobble"/>
                   ) : (
                      <div className="w-5 h-5 rounded-full bg-[#0D1624] border border-[#162A40] flex items-center justify-center text-[8px] text-[#2B90B5] font-bold">
                         U
                      </div>
                   )}
                </div>
             )}
            <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-[#0D62A6] text-white rounded-2xl rounded-br-sm' 
                  : 'bg-[#0F1724] border border-[#162A40] text-[#D1D5DB] rounded-2xl rounded-tl-sm'
              }`}>
                {msg.inlineData && (
                  msg.inlineData.mimeType === 'application/pdf' || msg.inlineData.name?.toLowerCase().endsWith('.pdf') ? (
                    <div className="mb-2.5 p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-100 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">
                          {msg.inlineData.name || 'Document.pdf'}
                        </div>
                        <div className="text-[10px] text-red-300/80 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono uppercase px-1.5 py-0.5 bg-red-900/60 rounded text-[9px]">PDF</span>
                          {msg.inlineData.size ? <span>{(msg.inlineData.size / 1024).toFixed(1)} KB</span> : null}
                          <span>• Analyzed by Gemini</span>
                        </div>
                      </div>
                    </div>
                  ) : msg.inlineData.data ? (
                    <img 
                       src={`data:${msg.inlineData.mimeType};base64,${msg.inlineData.data}`} 
                       className="max-w-[200px] max-h-[200px] object-cover rounded-lg mb-2 border border-[#162A40]" 
                       alt="attachment" 
                    />
                  ) : (
                    <div className="text-xs text-gray-300 italic mb-2 flex items-center gap-1.5 bg-[#0A121E] px-2.5 py-1.5 rounded-lg border border-[#162A40]">
                       <ImageIcon size={14} className="text-[#4889A1]" /> <span>Image Attached</span>
                    </div>
                  )
                )}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.attachments.map((att, idx) => {
                      const isPdf = att.mimeType === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf');
                      if (isPdf) {
                        return (
                          <div key={idx} className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-100 flex items-center gap-3 w-full max-w-sm">
                            <div className="w-9 h-9 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                              <FileText size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white truncate">
                                {att.name || `Document-${idx + 1}.pdf`}
                              </div>
                              <div className="text-[10px] text-red-300/80 flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono uppercase px-1.5 py-0.5 bg-red-900/60 rounded text-[9px]">PDF</span>
                                {att.size ? <span>{(att.size / 1024).toFixed(1)} KB</span> : null}
                                <span>• Analyzed by Gemini</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return att.data ? (
                        <img 
                           key={idx}
                           src={`data:${att.mimeType};base64,${att.data}`} 
                           className="max-h-[140px] max-w-[140px] object-cover rounded-lg border border-[#162A40]" 
                           alt={`attachment-${idx}`} 
                        />
                      ) : (
                        <div key={idx} className="text-xs text-gray-300 italic bg-[#0A121E] px-2.5 py-1.5 rounded-lg border border-[#162A40] flex items-center gap-1.5">
                           <ImageIcon size={14} className="text-[#4889A1]" /> <span>Image Attached</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {msg.text}

                {/* AI Generated Image or NEET Diagram Card - Clean, no prompt text, compact download icon button */}
                {msg.action && (msg.action.type === 'generated_image' || msg.action.type === 'neet_diagram') && (
                  <div className="mt-3 relative group rounded-2xl overflow-hidden border border-cyan-500/30 bg-black/50 shadow-xl max-w-sm">
                    {msg.action.type === 'neet_diagram' && (
                      <div className="px-3 py-1.5 bg-gradient-to-r from-emerald-950/80 to-cyan-950/80 border-b border-emerald-500/30 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          🩺 NEET NCERT High-Yield Diagram
                        </span>
                        {msg.action.subject && (
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                            {msg.action.subject}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="relative">
                      <img 
                        src={msg.action.url} 
                        alt={msg.action.title || "NEET Diagram"} 
                        className="w-full max-h-80 object-contain rounded-b-2xl cursor-pointer transition-transform duration-200 group-hover:scale-[1.01] bg-[#0A1018]"
                        loading="lazy"
                        onClick={() => setPreviewImage({ url: msg.action!.url, prompt: '' })}
                        onError={(e) => {
                          const target = e.currentTarget;
                          const fallback = `https://image.pollinations.ai/prompt/${encodeURIComponent((msg.action?.prompt || 'medical diagram').trim())}?width=1024&height=1024&model=turbo&nologo=true&seed=999`;
                          if (target.src !== fallback) {
                            target.src = fallback;
                          }
                        }}
                      />
                      
                      {/* Compact Download Icon Button (No Text) */}
                      <a
                        href={msg.action.url}
                        download={`${(msg.action.title || 'neet-diagram').toLowerCase().replace(/\s+/g, '-')}.jpg`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download Diagram"
                        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/65 hover:bg-black/85 text-white/90 hover:text-white backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg transition-all active:scale-90 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size={15} />
                      </a>
                    </div>

                    {msg.action.type === 'neet_diagram' && msg.action.labelingPoints && msg.action.labelingPoints.length > 0 && (
                      <div className="p-3 bg-[#0A131F] border-t border-cyan-900/30 text-xs">
                        <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-1.5">
                          NCERT Key Labeling Points:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {msg.action.labelingPoints.map((pt, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-800/40 text-cyan-200">
                              {pt}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Automation Action Cards */}
                {msg.action && msg.action.type === 'youtube' && (
                  <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-red-950/50 via-[#1A0A0E] to-[#120A0F] border border-red-900/50 text-red-100 flex flex-col gap-2.5 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                        <Youtube size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-red-300 uppercase tracking-wider">
                          YouTube Automation
                        </div>
                        <div className="text-xs text-gray-200 font-medium truncate">
                          {msg.action.query || msg.action.title}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-red-900/30">
                      <button
                        type="button"
                        onClick={() => executeDeepLink(msg.action.appUrl || msg.action.url, { fallbackUrl: msg.action.webUrl || msg.action.url })}
                        className="flex-1 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-red-900/30 transition-colors"
                      >
                        <Play size={13} fill="currentColor" />
                        Play on YouTube
                        <ExternalLink size={12} className="opacity-70 ml-0.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeDeepLink(msg.action.webUrl || msg.action.url, { target: '_blank' })}
                        className="py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-medium transition-colors"
                      >
                        Web
                      </button>
                    </div>
                  </div>
                )}

                {msg.action && msg.action.type === 'whatsapp' && (
                  <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/50 via-[#0A1A12] to-[#0A1410] border border-emerald-900/50 text-emerald-100 flex flex-col gap-2.5 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                        <MessageCircle size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                          WhatsApp Automation
                        </div>
                        <div className="text-xs text-gray-200 font-medium">
                          To: <span className="text-emerald-200 font-semibold">{msg.action.recipient || msg.action.phone || 'Contact'}</span>
                        </div>
                      </div>
                    </div>
                    {msg.action.message && (
                      <div className="relative text-xs text-gray-200 bg-black/50 p-2.5 rounded-lg border border-emerald-900/40 italic flex items-center justify-between gap-2">
                        <span className="truncate">"{msg.action.message}"</span>
                        <button
                          type="button"
                          title="Copy draft"
                          onClick={() => {
                            if (msg.action.message) {
                              navigator.clipboard.writeText(msg.action.message);
                              showToast("📋 Draft copied to clipboard!", "success");
                            }
                          }}
                          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-emerald-300 transition-colors shrink-0"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1 border-t border-emerald-900/30">
                      <button
                        type="button"
                        onClick={() => executeDeepLink(msg.action.appUrl || msg.action.url, { fallbackUrl: msg.action.webUrl || msg.action.url })}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30 transition-colors"
                      >
                        <Send size={13} />
                        Open WhatsApp Chat
                        <ExternalLink size={12} className="opacity-70 ml-0.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeDeepLink(msg.action.webUrl || msg.action.url, { target: '_blank' })}
                        className="py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-medium transition-colors"
                      >
                        Web
                      </button>
                    </div>
                  </div>
                )}

                {msg.action && msg.action.type === 'telegram' && (
                  <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-[#0C2438]/85 via-[#0A1B2A]/85 to-[#081522]/85 border border-sky-500/40 text-sky-100 flex flex-col gap-2.5 shadow-lg shadow-sky-950/20">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-600/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
                        <Send size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-sky-300 uppercase tracking-wider">
                          Telegram Automation
                        </div>
                        <div className="text-xs text-gray-200 font-medium">
                          To: <span className="text-sky-200 font-semibold">{msg.action.recipient || msg.action.username || msg.action.phone || 'Recipient'}</span>
                        </div>
                      </div>
                    </div>
                    {msg.action.message && (
                      <div className="relative text-xs text-gray-200 bg-black/50 p-2.5 rounded-lg border border-sky-900/40 italic flex items-center justify-between gap-2">
                        <span className="truncate">"{msg.action.message}"</span>
                        <button
                          type="button"
                          title="Copy draft"
                          onClick={() => {
                            if (msg.action.message) {
                              navigator.clipboard.writeText(msg.action.message);
                              showToast("📋 Draft copied to clipboard!", "success");
                            }
                          }}
                          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-sky-300 transition-colors shrink-0"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-sky-900/30">
                      <button
                        type="button"
                        onClick={() => {
                          if (msg.action.message) {
                            try {
                              navigator.clipboard?.writeText(msg.action.message);
                              showToast("📋 Draft copied to clipboard!", "success");
                            } catch (e) {}
                          }
                          executeDeepLink(msg.action.appUrl || msg.action.url, { fallbackUrl: msg.action.webUrl || msg.action.url });
                        }}
                        className="flex-1 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-sky-900/30 transition-colors"
                      >
                        <Send size={13} />
                        Open Telegram Chat
                        <ExternalLink size={12} className="opacity-70 ml-0.5" />
                      </button>
                      {msg.action.message && (
                        <button
                          type="button"
                          onClick={() => {
                            const shareUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(msg.action.message)}`;
                            executeDeepLink(`tg://msg_url?url=&text=${encodeURIComponent(msg.action.message)}`, { fallbackUrl: shareUrl });
                          }}
                          className="py-2 px-2.5 rounded-lg bg-sky-950/70 hover:bg-sky-900/80 text-sky-200 border border-sky-600/40 text-xs font-medium transition-colors"
                          title="Share draft to any contact"
                        >
                          Share Draft
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => executeDeepLink(msg.action.webUrl || msg.action.url, { target: '_blank' })}
                        className="py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-medium transition-colors"
                      >
                        Web
                      </button>
                    </div>
                  </div>
                )}

                {msg.action && msg.action.type === 'phone_call' && (
                  <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/60 via-[#0A1A12] to-[#0A1410] border border-emerald-800/60 text-emerald-100 flex flex-col gap-2.5 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                        <Phone size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                          Native Phone Call
                        </div>
                        <div className="text-xs text-white font-medium">
                          {msg.action.recipient ? `${msg.action.recipient} (${msg.action.phone})` : msg.action.phone}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-emerald-900/30">
                      <button
                        type="button"
                        onClick={() => executeDeepLink(msg.action.url, { target: '_self' })}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30 transition-colors"
                      >
                        <Phone size={13} />
                        Call Now
                      </button>
                    </div>
                  </div>
                )}

                {msg.action && msg.action.type === 'sms' && (
                  <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/60 via-[#091826] to-[#07121E] border border-cyan-800/60 text-cyan-100 flex flex-col gap-2.5 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                        <MessageSquare size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                          SMS Text Draft
                        </div>
                        <div className="text-xs text-white font-medium">
                          To: {msg.action.recipient ? `${msg.action.recipient} (${msg.action.phone})` : msg.action.phone}
                        </div>
                      </div>
                    </div>
                    {msg.action.message && (
                      <div className="relative text-xs text-gray-200 bg-black/50 p-2.5 rounded-lg border border-cyan-900/40 italic flex items-center justify-between gap-2">
                        <span className="truncate">"{msg.action.message}"</span>
                        <button
                          type="button"
                          title="Copy draft"
                          onClick={() => {
                            if (msg.action.message) {
                              navigator.clipboard.writeText(msg.action.message);
                              showToast("📋 Draft copied to clipboard!", "success");
                            }
                          }}
                          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-cyan-300 transition-colors shrink-0"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1 border-t border-cyan-900/30">
                      <button
                        type="button"
                        onClick={() => executeDeepLink(msg.action.url, { target: '_self' })}
                        className="flex-1 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-900/30 transition-colors"
                      >
                        <Send size={13} />
                        Send SMS
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-[#4889A1]/50 mt-1.5 px-1">{msg.time}</span>
            </div>
          </div>
        ))}
        {isTyping && (
           <div className="flex flex-col items-start">
             <div className="flex items-center gap-2 mb-1 pl-1">
                <img src={saraAvatarUrl} className="w-5 h-5 rounded-full object-cover" alt={saraDisplayName}/>
                <span className="text-[10px] text-[#4889A1] uppercase tracking-wider">{saraDisplayName}</span>
             </div>
             <div className="bg-[#0F1724] border border-[#162A40] rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
               <div className="w-1.5 h-1.5 bg-[#4889A1] rounded-full animate-bounce"></div>
               <div className="w-1.5 h-1.5 bg-[#4889A1] rounded-full animate-bounce delay-100"></div>
               <div className="w-1.5 h-1.5 bg-[#4889A1] rounded-full animate-bounce delay-200"></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#060B14] flex flex-col relative z-20">
        {/* Floating Active Automation Quick Action Bar */}
        {activeAutomation && (
          <div className="max-w-4xl w-full mx-auto mb-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-teal-950/95 via-[#0A1A22]/95 to-[#0A141A]/95 border border-teal-500/60 shadow-[0_4px_20px_rgba(20,184,166,0.25)] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
                {activeAutomation.type === 'youtube' && <Youtube size={15} className="text-red-400" />}
                {activeAutomation.type === 'whatsapp' && <MessageCircle size={15} className="text-emerald-400" />}
                {activeAutomation.type === 'telegram' && <Send size={15} className="text-sky-400" />}
                {activeAutomation.type === 'phone_call' && <Phone size={15} className="text-blue-400" />}
                {activeAutomation.type === 'sms' && <MessageSquare size={15} className="text-cyan-400" />}
                {activeAutomation.type === 'web' && <Globe size={15} className="text-amber-400" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {activeAutomation.title}
                </div>
                {activeAutomation.message && (
                  <div className="text-[11px] text-teal-200/80 truncate italic">
                    "{activeAutomation.message}"
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  executeDeepLink(activeAutomation.appUrl || activeAutomation.url, { fallbackUrl: activeAutomation.webUrl || activeAutomation.url });
                }}
                className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-black font-bold text-xs flex items-center gap-1 shadow transition-colors"
              >
                {activeAutomation.label}
                <ExternalLink size={12} />
              </button>
              {activeAutomation.webUrl && activeAutomation.appUrl && (
                <button
                  type="button"
                  onClick={() => {
                    executeDeepLink(activeAutomation.webUrl!, { target: '_blank' });
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-medium transition-colors"
                >
                  Web
                </button>
              )}
              <button
                type="button"
                aria-label="Dismiss automation"
                onClick={() => setActiveAutomation(null)}
                className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {attachments.length > 0 && (
           <div className="max-w-4xl w-full mx-auto mb-3 relative flex flex-wrap gap-2 justify-start">
             {attachments.map((att) => {
               const isPdf = att.mimeType === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf');
               if (isPdf) {
                 return (
                   <div key={att.id} className="relative flex items-center gap-2.5 p-2.5 pr-8 rounded-xl bg-red-950/40 border border-red-700/50 group">
                     <div className="w-8 h-8 rounded-lg bg-red-600/30 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                       <FileText size={16} />
                     </div>
                     <div className="min-w-0 max-w-[160px]">
                       <div className="text-xs font-semibold text-white truncate">{att.name || 'Document.pdf'}</div>
                       <div className="text-[10px] text-red-300/80 uppercase font-mono">PDF • Ready to analyze</div>
                     </div>
                     <button 
                       type="button"
                       onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))} 
                       className="absolute top-2 right-2 text-gray-400 hover:text-red-400 transition-colors"
                     >
                       <X size={14} />
                     </button>
                   </div>
                 );
               }
               return (
                 <div key={att.id} className="relative inline-block group">
                   <img src={att.url} alt="attachment" className="h-16 w-16 object-cover rounded-xl border border-[#233A54]" />
                   <button 
                     type="button"
                     onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))} 
                     className="absolute -top-2 -right-2 bg-red-500/90 text-white rounded-full p-1 hover:bg-red-500 transition-transform hover:scale-110"
                   >
                     <X size={12} />
                   </button>
                 </div>
               );
             })}
           </div>
        )}
        <div className="max-w-4xl w-full mx-auto relative flex items-center gap-2">
          {/* Gallery / Attachment Picker Button with Popover */}
          <div className="relative">
            <button 
              id="open-attachment-sheet-btn"
              type="button" 
              onClick={() => setShowAttachmentMenu(prev => !prev)} 
              title="Gallery & Documents"
              className={`p-3 rounded-xl border border-[#233A54] bg-[#0F1724] hover:bg-[#162A40] transition-colors flex-shrink-0 flex items-center justify-center ${
                showAttachmentMenu ? 'text-cyan-400 border-cyan-500/60 bg-[#162A40]' : 'text-[#4889A1] hover:text-cyan-400'
              }`}
            >
              <ImageIcon size={18} />
            </button>

            {/* Floating Popover: Gallery Photos & PDF (Dedicated camera button is separate) */}
            {showAttachmentMenu && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setShowAttachmentMenu(false)}
                />
                <div 
                  id="attachment-popover-menu"
                  className="absolute bottom-full mb-2.5 left-0 z-40 bg-[#121B28] border border-[#223852] rounded-2xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] min-w-[205px] animate-in fade-in zoom-in-95 duration-150"
                >
                  <button
                    type="button"
                    id="popover-photos-btn"
                    onClick={() => {
                      setShowAttachmentMenu(false);
                      photoInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-medium text-gray-200 hover:text-white hover:bg-[#1A2D44] transition-colors"
                  >
                    <ImageIcon size={18} className="text-cyan-400 shrink-0" />
                    <span>Gallery Photos</span>
                  </button>
                  <button
                    type="button"
                    id="popover-pdf-btn"
                    onClick={() => {
                      setShowAttachmentMenu(false);
                      docInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-medium text-gray-200 hover:text-white hover:bg-[#1A2D44] transition-colors"
                  >
                    <FileText size={18} className="text-rose-400 shrink-0" />
                    <span>PDF & Documents</span>
                  </button>
                  <button
                    type="button"
                    id="popover-ai-image-btn"
                    onClick={() => {
                      setShowAttachmentMenu(false);
                      setShowImageGenModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-medium text-gray-200 hover:text-white hover:bg-[#1A2D44] transition-colors"
                  >
                    <Sparkles size={18} className="text-purple-400 shrink-0" />
                    <span>Generate AI Image</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Camera Button (dedicated button next to gallery button) */}
          <button 
            id="open-camera-btn"
            type="button" 
            onClick={() => setShowCameraOverlay(true)} 
            title="Camera Vision & Capture"
            className="text-[#4889A1] p-3 rounded-xl border border-[#233A54] bg-[#0F1724] hover:bg-[#162A40] hover:text-cyan-400 transition-colors flex-shrink-0 flex items-center justify-center"
          >
            <Camera size={18} />
          </button>
          
          {/* Hidden file input for photos */}
          <input 
            type="file" 
            accept="image/*" 
            multiple 
            style={{ display: 'none' }} 
            ref={photoInputRef} 
            onChange={(e) => handleFileChange(e, false)} 
          />
          {/* Hidden file input for PDF and documents */}
          <input 
            type="file" 
            accept=".pdf,application/pdf,text/*,.txt,.csv,.json,.md,.doc,.docx" 
            multiple 
            style={{ display: 'none' }} 
            ref={docInputRef} 
            onChange={(e) => handleFileChange(e, true)} 
          />
          
          <div className="relative flex-1">
             <input 
               type="text" 
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
               placeholder={`Ask ${saraDisplayName} anything... btao na, yaara`}
               className="w-full bg-[#0F1724] border border-[#233A54] rounded-xl py-3 pl-4 pr-20 text-sm text-gray-200 placeholder-[#4889A1]/60 focus:outline-none focus:border-[#4889A1] transition-colors"
             />
             <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
               <button 
                 type="button"
                 onClick={toggleListening}
                 className={`p-1.5 rounded-lg transition-colors ${isListening ? 'text-red-400 bg-red-500/20 animate-pulse' : 'text-[#4889A1] hover:text-[#78C5E7]'}`}
               >
                 <Mic size={16} />
               </button>
               {isGenerating || isTyping ? (
                 <button 
                   type="button"
                   onClick={handleStop}
                   title="Stop response"
                   className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-lg transition-all shadow-sm shadow-red-500/20 flex items-center justify-center animate-pulse"
                 >
                   <Square size={14} className="fill-current" />
                 </button>
               ) : (
                 <button 
                   type="button"
                   onClick={handleSend}
                   disabled={(!input.trim() && attachments.length === 0)}
                   className="p-1.5 text-[#2B90B5] hover:text-[#78C5E7] disabled:opacity-30 transition-colors"
                   title="Send message"
                 >
                   <Send size={16} />
                 </button>
               )}
             </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal 
          state={state} 
          updateState={updateState} 
          updateLocationContext={(loc) => updateState({ locationContext: loc })}
          canInstallPwa={canInstallPwa}
          addFact={addFact} 
          removeFact={removeFact} 
          editFact={editFact} 
          onClose={() => setShowSettings(false)} 
          initialTab={settingsTab} 
          updatePersonaAvatar={updatePersonaAvatar}
          resetPersonaAvatar={resetPersonaAvatar}
          addContact={addContact}
          removeContact={removeContact}
          editContact={editContact}
          importContacts={importContacts}
          clearAllContacts={clearAllContacts}
        />
      )}
      
      {showCameraOverlay && (
        <CameraOverlay 
          onClose={() => setShowCameraOverlay(false)} 
          onCapture={(att) => {
            const newAttachment = {
              id: Math.random().toString(36).slice(2) + Date.now(),
              mimeType: att.mimeType,
              data: att.data,
              url: att.url
            };
            setAttachments(prev => [...prev, newAttachment]);
            setShowCameraOverlay(false);
          }} 
        />
      )}

      {/* Real-Time News Feed Modal */}
      {showNewsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#0B111A] border border-[#1E3A5F] rounded-2xl max-w-2xl w-full h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#1E3A5F] bg-[#080D14] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                  <Newspaper size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">Real-Time News Feed</h2>
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Live
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Latest headlines & global breaking stories</p>
                </div>
              </div>
              <button 
                onClick={() => setShowNewsModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#162A40] rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search and Category Filters */}
            <div className="p-4 border-b border-[#1E3A5F]/60 bg-[#0A121E] space-y-3">
              {/* Search Bar */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchNewsData(newsCategory, newsSearchQuery);
                }} 
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={newsSearchQuery}
                    onChange={(e) => setNewsSearchQuery(e.target.value)}
                    placeholder="Search any news topic (e.g., AI, NEET, Cricket, Tech)..."
                    className="w-full bg-[#060B14] border border-[#1E3A5F] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  {newsSearchQuery && (
                    <button 
                      type="button" 
                      onClick={() => { setNewsSearchQuery(''); fetchNewsData(newsCategory, ''); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loadingNews}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-cyan-600/20"
                >
                  <Search size={16} />
                  Find
                </button>
              </form>

              {/* Category Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {['Top Stories', 'India', 'World', 'Technology', 'Business', 'Sports', 'Entertainment', 'Health', 'Science'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setNewsCategory(cat);
                      fetchNewsData(cat, newsSearchQuery);
                    }}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-medium ${
                      newsCategory === cat
                        ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-sm'
                        : 'bg-[#0E1826] border border-[#182C44] text-gray-400 hover:text-gray-200 hover:bg-[#15253B]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Articles List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#060B14]">
              {loadingNews ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <RefreshCw size={28} className="text-cyan-400 animate-spin" />
                  <p className="text-sm text-gray-400 font-medium">Fetching real-time news headlines...</p>
                </div>
              ) : newsError ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm text-center">
                  {newsError}
                  <button
                    onClick={() => fetchNewsData()}
                    className="mt-2 block mx-auto text-xs px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : newsArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
                  <Globe size={32} className="text-gray-600" />
                  <p className="text-sm text-gray-400 font-medium">No articles found for "{newsSearchQuery || newsCategory}"</p>
                  <p className="text-xs text-gray-500">Try adjusting your search terms or selecting another category.</p>
                </div>
              ) : (
                newsArticles.map((article, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#0B121E] border border-[#162A42] hover:border-cyan-500/40 transition-all flex flex-col gap-2.5 group shadow-sm hover:shadow-cyan-950/20"
                  >
                    <div className="flex gap-3 items-start">
                      {article.imageUrl && (
                        <img
                          src={article.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-[#122238] border border-[#1C324E]"
                          onError={(e) => {
                            // Hide broken image gracefully
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-100 group-hover:text-cyan-200 leading-snug transition-colors">
                          {article.title}
                        </h3>
                        {article.description && (
                          <p className="text-xs text-gray-300 mt-1.5 leading-relaxed line-clamp-3">
                            {article.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 pt-2 border-t border-[#122238] mt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 text-[11px] font-medium">
                          {article.source}
                        </span>
                        {article.pubDate && (
                          <span className="text-gray-500 text-[11px]">
                            {new Date(article.pubDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setShowNewsModal(false);
                            setInput(`Mujhe iss news ke baare mein poori detail me samjhao: "${article.title}" (${article.source}). Kya hua, kyu hua, aur iska kya impact hai?`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#14263D] hover:bg-cyan-600 hover:text-white text-cyan-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                          title="Ask SARA to explain this news in detail"
                        >
                          <MessageSquareText size={12} />
                          Detail me samjhao
                        </button>
                        {article.link && (
                          <a
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            title="Open original article"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0B111A] border border-[#1E3A5F] rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Delete Chat History?</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Are you sure you want to delete all chats? This action cannot be undone.<br />
                <span className="text-teal-400 font-medium mt-1 inline-block">Your memories and facts will NOT be deleted.</span>
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#1E3A5F] bg-[#0F1724] text-gray-300 hover:bg-[#162A40] text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium shadow-lg shadow-red-600/30 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule & Quotes Hub Modal */}
      {showScheduleHub && (
        <ScheduleHubModal
          initialTab={hubTab}
          onClose={() => setShowScheduleHub(false)}
          reminders={state.reminders}
          onAddReminder={handleAddReminderWithToast}
          onMarkDone={markReminderDone}
          onDeleteReminder={deleteReminder}
          onTestAlarm={handleTestAlarm}
          notifPermission={notifPermission}
          onRequestPermission={requestNotifPermission}
          events={state.events || []}
          onAddEvent={addCalendarEvent}
          onDeleteEvent={deleteCalendarEvent}
          onEditEvent={editCalendarEvent}
          saraName={saraDisplayName}
          onSpeakQuote={(text) => {
            if (!audioMuted) {
              speakVoicePrompt(text);
            }
          }}
          dailyInsight={state.dailyInsight}
          onRefreshInsight={() => fetchDailyInsight(true)}
          loadingInsight={loadingInsight}
        />
      )}

      {/* PWA Installation Modal */}
      {showInstallModal && (
        <PwaInstallModal
          onClose={() => setShowInstallModal(false)}
          saraName={saraDisplayName}
        />
      )}

      {/* AI Image Generation Modal */}
      {showImageGenModal && (
        <ImageGenModal
          isOpen={showImageGenModal}
          onClose={() => setShowImageGenModal(false)}
          onSendToChat={handleInsertGeneratedImage}
          onInsertImage={handleInsertGeneratedImage}
          customApiKey={state.apiKey}
          saraName={saraDisplayName}
        />
      )}

      {/* Fullscreen AI Artwork Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-[#10071C] border border-purple-800/80 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-purple-900/40">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <span className="text-xs font-semibold text-purple-200">AI Visual Studio</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.url}
                  download="sara-ai-artwork.jpg"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download Image"
                  className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                >
                  <Download size={15} />
                </a>
                <button 
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[75vh]">
              <img 
                src={previewImage.url} 
                alt="AI Artwork" 
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-sm w-full px-4 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-[#0D1624]/95 border border-[#2B90B5]/50 text-gray-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm pointer-events-auto backdrop-blur-md animate-pulse">
            <BrainCircuit className="text-teal-400 shrink-0" size={18} />
            <div className="flex-1">
              <span className="font-semibold text-teal-300 text-xs block uppercase tracking-wider">
                {t.type === 'success' ? 'Memory Synced' : t.type === 'reminder' ? 'Reminder Set' : 'Notice'}
              </span>
              <span className="text-xs text-gray-200">{t.message}</span>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="text-gray-400 hover:text-white shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
