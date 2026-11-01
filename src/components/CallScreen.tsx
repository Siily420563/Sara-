import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Youtube, MessageCircle, Phone, MessageSquare, Globe, ExternalLink, X, Send, Image as ImageIcon, Sparkles } from 'lucide-react';
import { AppState, TemporalType, getSaraName, getPersonaAvatar } from '../store';
import { pcmToBase64, playAudioChunk, resetAudioQueue, startBackgroundAudio, stopBackgroundAudio, updateMediaSessionMute } from '../audio';
import { wakeLockService } from '../services/wakeLock';
import { getCachedLocation, formatLocationPromptString } from '../services/location';
import { openWebsite, switchTab, browseWeb, closeTab } from '../services/browserControl';
import { executeDeepLink, getWhatsAppLinks, getTelegramLinks, getYouTubeLinks } from '../services/deepLinks';
import { getUserId } from '../services/userRoom';

interface Props {
  mode: 'voice' | 'video';
  state: AppState;
  onEndCall: () => void;
  addFact?: (text: string, type?: TemporalType, time?: string | null) => void;
  addReminder?: (text: string, time: number) => void;
  addCalendarEvent?: (event: any) => void;
  deleteCalendarEvent?: (id: string) => void;
}

// Manually downsample buffer from input rate (e.g. 44100Hz/48000Hz) to exactly 16000Hz
function downsampleBuffer(buffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export default function CallScreen({ mode, state, onEndCall, addFact, addReminder, addCalendarEvent, deleteCalendarEvent }: Props) {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [quality, setQuality] = useState('STABLE');
  const [activeReminderAlert, setActiveReminderAlert] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const userEndingCallRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const [inCallAction, setInCallAction] = useState<{
    type: 'youtube' | 'whatsapp' | 'telegram' | 'phone' | 'sms' | 'web' | 'image' | 'neet';
    title: string;
    message?: string;
    url: string;
    appUrl?: string;
    webUrl?: string;
    label: string;
  } | null>(null);
  
  const saraDisplayName = getSaraName(state.persona);

  const handleHangup = () => {
    userEndingCallRef.current = true;
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, "User ended call");
      } catch {}
    }
    onEndCall();
  };

  const toggleMute = () => {
    setMuted(prev => {
      const next = !prev;
      mutedRef.current = next;
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(t => t.enabled = !next);
      }
      updateMediaSessionMute(next, saraDisplayName);
      return next;
    });
  };

  // Audio reactive indicator bars
  const bar1Ref = useRef<HTMLDivElement>(null);
  const bar2Ref = useRef<HTMLDivElement>(null);
  const bar3Ref = useRef<HTMLDivElement>(null);
  const bar4Ref = useRef<HTMLDivElement>(null);
  const bar5Ref = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const handledRemindersRef = useRef<Set<string>>(new Set());

  // Real-time reminder checker during live call
  useEffect(() => {
    const reminderInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      const due = (state.reminders || []).filter(r => !r.done && r.time <= now && !handledRemindersRef.current.has(r.id));

      for (const rem of due) {
        handledRemindersRef.current.add(rem.id);
        // 1. Immediately cut off current speech
        resetAudioQueue();

        // 2. Display alert banner
        setActiveReminderAlert(rem.text);

        // 3. Send interrupt instruction over WebSocket
        wsRef.current.send(JSON.stringify({
          clientContent: {
            turns: [{
              role: "user",
              parts: [{
                text: `SYSTEM EVENT - REMINDER DUE NOW: The scheduled reminder "${rem.text}" is due right NOW at this exact moment! IMMEDIATELY STOP what you were saying, excuse yourself warmly in Hinglish (e.g., "Suno, ek minute roko! Pehle ${saraDisplayName} reminder alert: ${rem.text}. Pehle ye kaam dekh lo, phir hum apni baat aage continue karte hain!"), deliver the reminder clearly to the user, and ask if they want to continue.`
              }]
            }],
            turnComplete: true
          }
        }));

        // Hide alert banner after 8 seconds
        setTimeout(() => {
          setActiveReminderAlert(null);
        }, 8000);
      }
    }, 2000);

    return () => clearInterval(reminderInterval);
  }, [state.reminders, saraDisplayName]);

  useEffect(() => {
    let active = true;
    let inputAnalyser: AnalyserNode | null = null;
    let outputAnalyser: AnalyserNode | null = null;
    let animationFrameId: number;
    let heartbeatId: any;
    let heartbeatWorker: Worker | null = null;
    let handleVisibilityChange: (() => void) | null = null;

    const initCall = async () => {
      try {
        // Init single robust Audio Context for both input and output
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        resetAudioQueue();

        // Setup Analysers
        inputAnalyser = audioCtx.createAnalyser();
        inputAnalyser.fftSize = 64;
        const inputData = new Uint8Array(inputAnalyser.frequencyBinCount);

        outputAnalyser = audioCtx.createAnalyser();
        outputAnalyser.fftSize = 64;
        const outputData = new Uint8Array(outputAnalyser.frequencyBinCount);

        const constraints: MediaStreamConstraints = { audio: true };
        if (mode === 'video') constraints.video = { facingMode: 'user' };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (mode === 'video' && videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(inputAnalyser);

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        
        source.connect(processor);
        processor.connect(audioCtx.destination);

        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let wsUrl = `${wsProto}//${window.location.host}/live?name=${encodeURIComponent(state.persona.name)}&saraName=${encodeURIComponent(saraDisplayName)}&personaType=${encodeURIComponent(state.persona.personaType || 'default')}&userId=${encodeURIComponent(getUserId())}`;
        const factsStr = state.facts.map(f => f.text).join('|');
        if (factsStr) wsUrl += `&facts=${encodeURIComponent(factsStr)}`;
        if (state.apiKey) wsUrl += `&customApiKey=${encodeURIComponent(state.apiKey)}`;
        
        wsUrl += `&localTime=${encodeURIComponent(new Date().toLocaleString())}`;
        wsUrl += `&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`;
        
        const cachedLoc = getCachedLocation();
        if (cachedLoc) {
          wsUrl += `&locationContext=${encodeURIComponent(formatLocationPromptString(cachedLoc))}`;
        }
        if (state.contacts && state.contacts.length > 0) {
          wsUrl += `&contacts=${encodeURIComponent(JSON.stringify(state.contacts))}`;
        }
        
        // Acquire screen wake lock to keep display active during voice/video call
        wakeLockService.acquire('call-screen');

        // Start background audio keeper & MediaSession to ensure call continues in background
        startBackgroundAudio(
          `${saraDisplayName} Live ${mode === 'video' ? 'Video' : 'Voice'} Call`,
          `${saraDisplayName} AI Companion`,
          handleHangup,
          toggleMute
        );

        // Keep audio context and WebSocket resilient against background suspension & app switching
        handleVisibilityChange = () => {
          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume().catch(() => {});
          }
          if (document.visibilityState === 'visible') {
            if (!userEndingCallRef.current) {
              if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume().catch(() => {});
              }
              if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED || wsRef.current.readyState === WebSocket.CLOSING) {
                console.log("[CallScreen] App foreground restored, reconnecting live call session...");
                connectSocket(false);
              }
            }
          }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const connectSocket = (isFirst = false) => {
          if (!active || userEndingCallRef.current) return;
          try {
            if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
              return;
            }
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
              if (!active || userEndingCallRef.current) return;
              setConnected(true);
              setReconnecting(false);
              reconnectAttemptsRef.current = 0;
              if (isFirst) {
                ws.send(JSON.stringify({
                  clientContent: {
                     turns: [{ role: "user", parts: [{ text: "SYSTEM EVENT: USER_CALL_STARTED. Greet the user warmly and naturally in short. Don't act like a robot, act like you are picking up a call. Keep it very conversational and short." }] }],
                     turnComplete: true
                  }
                }));
              } else {
                ws.send(JSON.stringify({
                  clientContent: {
                     turns: [{ role: "user", parts: [{ text: "SYSTEM EVENT: CALL_RECONNECTED. We are back on the call smoothly. Acknowledge warmly and continue naturally." }] }],
                     turnComplete: true
                  }
                }));
              }
            };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.status === 'refreshing') {
              setReconnecting(true);
              return;
            }
            if (msg.error) {
              setQuality('ERROR');
              setErrorMsg(typeof msg.error === 'string' ? msg.error : JSON.stringify(msg.error));
              return;
            }
            setReconnecting(false);
            setConnected(true);
            if (msg.interrupted || msg.turnComplete) {
              if (msg.interrupted) resetAudioQueue();
            }
            if (msg.audio) {
               if (audioCtx.state === 'suspended') {
                 audioCtx.resume().catch(() => {});
               }
               playAudioChunk(
                 audioCtx,
                 msg.audio,
                 state.playbackSpeed || 1.0,
                 state.voicePitch || 0,
                 outputAnalyser
               );
            }
            if (msg.toolCall) {
              if (msg.toolCall.name === 'extract_fact' && addFact) {
                const args = msg.toolCall.args;
                addFact(args.fact, args.temporalType || 'General', args.resolvedTime || null);
              } else if (msg.toolCall.name === 'set_reminder' && addReminder) {
                const args = msg.toolCall.args;
                addReminder(args.text, new Date(args.timeIso).getTime());
              } else if (msg.toolCall.name === 'add_calendar_event' && addCalendarEvent) {
                const args = msg.toolCall.args;
                addCalendarEvent({
                  title: args.title || 'Event',
                  date: args.date,
                  time: args.time || undefined,
                  category: args.category || 'general',
                  description: args.description || undefined
                });
              } else if (msg.toolCall.name === 'delete_calendar_event' && deleteCalendarEvent) {
                const args = msg.toolCall.args;
                const match = (state.events || []).find(e =>
                  e.title.toLowerCase().includes((args.title || '').toLowerCase()) &&
                  (!args.date || e.date === args.date)
                );
                if (match) {
                  deleteCalendarEvent(match.id);
                }
              } else if (msg.toolCall.name === 'play_youtube_video') {
                const query = msg.toolCall.args?.query || msg.toolCall.result?.query || '';
                if (query) {
                  const { appUrl, webUrl } = getYouTubeLinks(query);
                  const targetUrl = msg.toolCall.result?.url || webUrl;
                  const targetAppUrl = msg.toolCall.result?.appUrl || appUrl;
                  executeDeepLink(targetAppUrl, { fallbackUrl: targetUrl });
                  setInCallAction({
                    type: 'youtube',
                    title: `Play "${query}" on YouTube`,
                    url: targetUrl,
                    appUrl: targetAppUrl,
                    webUrl: targetUrl,
                    label: 'Open YouTube'
                  });
                }
              } else if (msg.toolCall.name === 'send_whatsapp_message') {
                const phone = msg.toolCall.result?.phoneNumber || msg.toolCall.args?.phoneNumber || msg.toolCall.args?.phone || '';
                const contactName = msg.toolCall.result?.contactName || msg.toolCall.args?.contactName || msg.toolCall.args?.recipient || '';
                const message = msg.toolCall.result?.message || msg.toolCall.args?.message || '';
                const { appUrl, waMeUrl } = getWhatsAppLinks(phone, message);
                const targetUrl = msg.toolCall.result?.waMeUrl || waMeUrl || msg.toolCall.result?.url || appUrl;
                const targetAppUrl = msg.toolCall.result?.appUrl || appUrl;
                
                // Show high-visibility action card on CallScreen with full recipient details
                setInCallAction({
                  type: 'whatsapp',
                  title: `WhatsApp: ${contactName || (phone ? '+' + phone : 'Contact')}`,
                  message: message,
                  url: targetUrl,
                  appUrl: targetAppUrl,
                  webUrl: targetUrl,
                  label: 'Open WhatsApp'
                });

                // Execute safe deep link (navigates intent cleanly without orphan blank tabs)
                executeDeepLink(targetAppUrl, { fallbackUrl: targetUrl });
              } else if (msg.toolCall.name === 'send_telegram_message') {
                const phone = msg.toolCall.result?.phoneNumber || msg.toolCall.args?.phoneNumber || msg.toolCall.args?.phone || '';
                const contactName = msg.toolCall.result?.contactName || msg.toolCall.args?.contactName || msg.toolCall.args?.recipient || '';
                const username = msg.toolCall.result?.username || msg.toolCall.args?.username || '';
                const message = msg.toolCall.result?.message || msg.toolCall.args?.message || '';
                const { appUrl, webUrl, directUrl } = getTelegramLinks({ phoneNumber: phone, username, message });
                const targetUrl = msg.toolCall.result?.url || directUrl || webUrl;
                const targetAppUrl = msg.toolCall.result?.appUrl || appUrl;
                const targetWebUrl = msg.toolCall.result?.webUrl || webUrl;
                executeDeepLink(targetAppUrl, { fallbackUrl: targetUrl });
                setInCallAction({
                  type: 'telegram',
                  title: `Telegram: ${contactName || (username ? '@' + username : (phone ? '+' + phone : 'Chat'))}`,
                  message: message,
                  url: targetUrl,
                  appUrl: targetAppUrl,
                  webUrl: targetWebUrl,
                  label: 'Open Telegram'
                });
              } else if (msg.toolCall.name === 'make_phone_call') {
                const rawPhone = msg.toolCall.result?.phoneNumber || msg.toolCall.args?.phoneNumber || msg.toolCall.args?.phone || '';
                const contactName = msg.toolCall.result?.contactName || msg.toolCall.args?.contactName || msg.toolCall.args?.recipient || '';
                const cleanPhone = String(rawPhone || '').replace(/[^0-9+]/g, '');
                if (cleanPhone) {
                  const telUrl = `tel:${cleanPhone}`;
                  executeDeepLink(telUrl, { target: '_self' });
                  setInCallAction({
                    type: 'phone',
                    title: `Call ${contactName ? `${contactName} (${cleanPhone})` : cleanPhone}`,
                    url: telUrl,
                    label: 'Call Now'
                  });
                }
              } else if (msg.toolCall.name === 'send_sms') {
                const rawPhone = msg.toolCall.result?.phoneNumber || msg.toolCall.args?.phoneNumber || msg.toolCall.args?.phone || '';
                const contactName = msg.toolCall.result?.contactName || msg.toolCall.args?.contactName || msg.toolCall.args?.recipient || '';
                const message = msg.toolCall.result?.message || msg.toolCall.args?.message || '';
                const cleanPhone = String(rawPhone || '').replace(/[^0-9+]/g, '');
                if (cleanPhone) {
                  const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(message || '')}`;
                  executeDeepLink(smsUrl, { target: '_self' });
                  setInCallAction({
                    type: 'sms',
                    title: `SMS to ${contactName || cleanPhone}`,
                    message: message,
                    url: smsUrl,
                    label: 'Open SMS'
                  });
                }
              } else if (msg.toolCall.name === 'open_website' || msg.toolCall.name === 'open_tab') {
                const url = msg.toolCall.args?.url || msg.toolCall.args?.query || '';
                const tabName = msg.toolCall.args?.tabName;
                openWebsite(url, { tabName });
                executeDeepLink(url);
                setInCallAction({
                  type: 'web',
                  title: `Opening: ${url || 'website'}`,
                  url,
                  label: 'Open Website'
                });
              } else if (msg.toolCall.name === 'switch_tab') {
                const tabName = msg.toolCall.args?.tabName || '';
                switchTab(tabName);
              } else if (msg.toolCall.name === 'browse_web') {
                const query = msg.toolCall.args?.query || '';
                const searchEngine = msg.toolCall.args?.searchEngine || 'google';
                browseWeb(query, searchEngine);
              } else if (msg.toolCall.name === 'close_tab') {
                const tabName = msg.toolCall.args?.tabName;
                closeTab(tabName);
              } else if (msg.toolCall.name === 'generate_image') {
                const imgUrl = msg.toolCall.result?.imageUrl;
                const prompt = msg.toolCall.args?.prompt || msg.toolCall.result?.prompt || 'Generated Image';
                if (imgUrl) {
                  setInCallAction({
                    type: 'image',
                    title: `Image: ${prompt.length > 28 ? prompt.slice(0, 25) + '...' : prompt}`,
                    url: imgUrl,
                    label: 'View'
                  });
                }
              } else if (msg.toolCall.name === 'get_neet_diagram_or_topic') {
                const topic = msg.toolCall.args?.topic || msg.toolCall.result?.diagram?.title || 'NEET Diagram';
                const imgUrl = msg.toolCall.result?.imageUrl;
                if (imgUrl) {
                  setInCallAction({
                    type: 'neet',
                    title: `NEET: ${topic.length > 28 ? topic.slice(0, 25) + '...' : topic}`,
                    url: imgUrl,
                    label: 'Diagram'
                  });
                }
              } else if (msg.toolCall.name === 'end_call') {
                userEndingCallRef.current = true;
                setTimeout(() => {
                  if (active) onEndCall();
                }, 1800);
              }
            }
          } catch (e) {
            console.error("Error parsing WebSocket message:", e);
          }
        };

        ws.onclose = (event) => {
          if (!active) return;
          if (userEndingCallRef.current || event.code === 1000) {
            onEndCall();
            return;
          }
          // Resilient auto-reconnect: keep connection alive during app switching or background blips
          if (reconnectAttemptsRef.current < 50) {
            reconnectAttemptsRef.current += 1;
            setConnected(false);
            setReconnecting(true);
            const delay = Math.min(1000 + (reconnectAttemptsRef.current * 400), 4000);
            setTimeout(() => {
              if (active && !userEndingCallRef.current) {
                connectSocket(false);
              }
            }, delay);
          } else {
            onEndCall();
          }
        };
      } catch (wsErr) {
        console.error("Error creating WebSocket:", wsErr);
      }
    };

    connectSocket(true);

    // Downsample & stream PCM microphone audio in real-time
    let lastFrameTime = 0;
    const nativeSampleRate = audioCtx.sampleRate;
    
    processor.onaudioprocess = (e) => {
      if (!active || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      
      if (!mutedRef.current) {
        const inputChannelData = e.inputBuffer.getChannelData(0);
        // Robustly downsample to 16000Hz expected by Gemini Live API
        const downsampled = downsampleBuffer(inputChannelData, nativeSampleRate, 16000);
        const base64Audio = pcmToBase64(downsampled);
        wsRef.current.send(JSON.stringify({ audio: base64Audio }));
      }

      // Video frames for perception (2 FPS to save bandwidth)
      if (mode === 'video' && videoRef.current && canvasRef.current) {
        const now = Date.now();
        if (now - lastFrameTime > 500) {
          lastFrameTime = now;
          const canvas = canvasRef.current;
          const video = videoRef.current;
          if (video.videoWidth > 0) {
             canvas.width = 320;
             canvas.height = (320 / video.videoWidth) * video.videoHeight;
             const ctx = canvas.getContext('2d');
             if (ctx && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
               ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
               const base64Jpeg = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
               wsRef.current.send(JSON.stringify({ video: base64Jpeg }));
             }
          }
        }
      }
    };

    // Keep WebSocket connection warm with Web Worker heartbeat to bypass mobile browser background timer throttling
    try {
      const workerBlob = new Blob([
        `let interval = null;
         self.onmessage = function(e) {
           if (e.data === 'start') {
             if (!interval) interval = setInterval(function() { self.postMessage('ping'); }, 8000);
           } else if (e.data === 'stop') {
             if (interval) { clearInterval(interval); interval = null; }
           }
         };`
      ], { type: 'application/javascript' });
      heartbeatWorker = new Worker(URL.createObjectURL(workerBlob));
      heartbeatWorker.onmessage = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          } catch (e) {}
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      };
      heartbeatWorker.postMessage('start');
    } catch (e) {
      heartbeatId = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          } catch (err) {}
        }
      }, 8000);
    }

        // Responsive Lag-Free Visualizer Loop
        const updateVisuals = () => {
          if (!active) return;

          let micLevel = 0;
          let saraLevel = 0;

          if (inputAnalyser) {
            inputAnalyser.getByteFrequencyData(inputData);
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
              sum += inputData[i];
            }
            micLevel = sum / inputData.length;
          }

          if (outputAnalyser) {
            outputAnalyser.getByteFrequencyData(outputData);
            let sum = 0;
            for (let i = 0; i < outputData.length; i++) {
              sum += outputData[i];
            }
            saraLevel = sum / outputData.length;
          }

          // Animate the status bar indicator
          const bars = [bar1Ref.current, bar2Ref.current, bar3Ref.current, bar4Ref.current, bar5Ref.current];
          bars.forEach((bar, idx) => {
            if (bar) {
              const speakerVol = !muted && micLevel > 4 ? micLevel : (saraLevel > 4 ? saraLevel : 1.5);
              const noise = Math.sin(Date.now() * 0.015 + idx) * 3;
              const targetHeight = Math.max(4, Math.min(22, (speakerVol / 128) * 20 + noise + 6));
              bar.style.height = `${targetHeight}px`;

              if (!muted && micLevel > 4) {
                bar.style.backgroundColor = '#2dd4bf'; // Active microphone input (teal)
              } else if (saraLevel > 4) {
                bar.style.backgroundColor = '#3b82f6'; // Active SARA playback (blue)
              } else {
                bar.style.backgroundColor = '#60a5fa'; // idle
              }
            }
          });

          // Animate Central Pulse Rings & Avatar (Voice mode)
          const pulseRing1 = document.getElementById('pulse-ring-1');
          const pulseRing2 = document.getElementById('pulse-ring-2');
          const pulseRing3 = document.getElementById('pulse-ring-3');
          const avatarContainer = document.getElementById('avatar-container');

          if (avatarContainer) {
            const activeLevel = Math.max(muted ? 0 : micLevel, saraLevel);
            const scale = 1 + (activeLevel / 150) * 0.12;
            avatarContainer.style.transform = `scale(${scale})`;

            if (saraLevel > 4) {
              avatarContainer.style.borderColor = `rgba(59, 130, 246, ${0.4 + (saraLevel / 128) * 0.6})`;
              avatarContainer.style.boxShadow = `0 0 ${25 + (saraLevel / 128) * 45}px rgba(59, 130, 246, ${0.35 + (saraLevel / 128) * 0.55})`;
            } else if (!muted && micLevel > 4) {
              avatarContainer.style.borderColor = `rgba(45, 212, 191, ${0.4 + (micLevel / 128) * 0.6})`;
              avatarContainer.style.boxShadow = `0 0 ${25 + (micLevel / 128) * 45}px rgba(45, 212, 191, ${0.35 + (micLevel / 128) * 0.55})`;
            } else {
              avatarContainer.style.borderColor = 'rgba(59, 130, 246, 0.4)';
              avatarContainer.style.boxShadow = '0 0 30px rgba(59, 130, 246, 0.15)';
            }
          }

          if (pulseRing1) {
            const scale1 = 1 + (saraLevel / 128) * 0.75 + (!muted && micLevel > 4 ? (micLevel / 128) * 0.35 : 0);
            pulseRing1.style.transform = `scale(${scale1})`;
            pulseRing1.style.opacity = String(0.1 + (saraLevel / 128) * 0.55 + (micLevel > 4 ? 0.25 : 0));
            pulseRing1.style.borderColor = saraLevel > 4 ? 'rgba(59, 130, 246, 0.45)' : (!muted && micLevel > 4 ? 'rgba(45, 212, 191, 0.45)' : 'rgba(59, 130, 246, 0.2)');
          }
          if (pulseRing2) {
            const scale2 = 1.35 + (saraLevel / 128) * 1.35 + (!muted && micLevel > 4 ? (micLevel / 128) * 0.65 : 0);
            pulseRing2.style.transform = `scale(${scale2})`;
            pulseRing2.style.opacity = String(0.05 + (saraLevel / 128) * 0.35 + (micLevel > 4 ? 0.15 : 0));
            pulseRing2.style.borderColor = saraLevel > 4 ? 'rgba(59, 130, 246, 0.3)' : (!muted && micLevel > 4 ? 'rgba(45, 212, 191, 0.3)' : 'rgba(59, 130, 246, 0.15)');
          }
          if (pulseRing3) {
            const scale3 = 1.7 + (saraLevel / 128) * 1.95 + (!muted && micLevel > 4 ? (micLevel / 128) * 0.95 : 0);
            pulseRing3.style.transform = `scale(${scale3})`;
            pulseRing3.style.opacity = String(0.02 + (saraLevel / 128) * 0.18 + (micLevel > 4 ? 0.08 : 0));
            pulseRing3.style.borderColor = saraLevel > 4 ? 'rgba(59, 130, 246, 0.18)' : (!muted && micLevel > 4 ? 'rgba(45, 212, 191, 0.18)' : 'rgba(59, 130, 246, 0.08)');
          }

          animationFrameId = requestAnimationFrame(updateVisuals);
        };

        animationFrameId = requestAnimationFrame(updateVisuals);

      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
           console.warn("Call init failed (expected in iframe if permissions not granted):", err);
        } else {
           console.log("Call init failed:", err);
        }
        if (active) {
          setQuality('ERROR');
          if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
             setErrorMsg('Microphone/Camera permission denied. If you are in AI Studio, please open the app in a new tab (top right corner) to grant permissions.');
          } else {
             setErrorMsg(err.message || 'Failed to access camera or microphone.');
          }
        }
      }
    };

    initCall();

    return () => {
      active = false;
      stopBackgroundAudio();
      wakeLockService.release('call-screen');
      cancelAnimationFrame(animationFrameId);
      if (heartbeatId) clearInterval(heartbeatId);
      if (heartbeatWorker) {
        try {
          heartbeatWorker.postMessage('stop');
          heartbeatWorker.terminate();
        } catch (e) {}
      }
      if (handleVisibilityChange) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (wsRef.current) wsRef.current.close();
      if (processorRef.current) processorRef.current.disconnect();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [mode]);
  
  // Tap to interrupt
  const handleTap = () => {
     resetAudioQueue();
     // Send explicit interrupt to the server
     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ interrupt: true }));
     }
  };

  return (
    <div className="fixed inset-0 bg-[#0a111a] z-40 flex flex-col items-center justify-between overflow-hidden" onClick={handleTap}>
      
      {/* Background Video if mode is video */}
      {mode === 'video' && (
        <video 
           ref={videoRef} 
           autoPlay 
           playsInline 
           muted 
           style={{ transform: 'scaleX(-1)' }}
           className="absolute inset-0 w-full h-full object-cover opacity-80" 
        />
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="relative z-10 w-full pt-16 flex flex-col items-center select-none">
        <div className="flex items-center gap-2 mb-2 text-teal-400 text-xs font-bold tracking-widest uppercase">
           <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
           {saraDisplayName.toUpperCase()} {mode.toUpperCase()} CALL
        </div>
        <h1 className="text-4xl font-black text-white tracking-wider mb-4">{saraDisplayName.toUpperCase()}</h1>
        <div className="flex gap-3 text-xs font-bold uppercase mb-2">
           <div className={`px-4 py-1.5 rounded-full ${connected ? 'bg-teal-500/20 text-teal-300' : (reconnecting ? 'bg-amber-500/20 text-amber-300 animate-pulse' : 'bg-gray-500/20 text-gray-400')}`}>
             {connected ? 'Connected' : (reconnecting ? 'Reconnecting...' : 'Connecting...')}
           </div>
           <div className="px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-300 flex items-center gap-1.5">
             <div className="flex gap-0.5 items-end h-4">
               <div ref={bar1Ref} className="w-1 h-2 bg-blue-400 rounded-full transition-[height,background-color] duration-75"></div>
               <div ref={bar2Ref} className="w-1 h-3 bg-blue-400 rounded-full transition-[height,background-color] duration-75"></div>
               <div ref={bar3Ref} className="w-1 h-4 bg-blue-400 rounded-full transition-[height,background-color] duration-75"></div>
               <div ref={bar4Ref} className="w-1 h-3 bg-blue-400 rounded-full transition-[height,background-color] duration-75"></div>
               <div ref={bar5Ref} className="w-1 h-2 bg-blue-400 rounded-full transition-[height,background-color] duration-75"></div>
             </div>
             {quality}
           </div>
        </div>
        {errorMsg && (
           <div className="mt-2 bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-lg text-xs max-w-[80%] text-center">
             {errorMsg}
           </div>
        )}
        {activeReminderAlert && (
           <div className="mt-3 bg-amber-500/20 border-2 border-amber-400 text-amber-200 px-5 py-2.5 rounded-2xl text-xs max-w-[85%] text-center font-semibold shadow-[0_0_25px_rgba(245,158,11,0.4)] animate-bounce flex items-center gap-2">
             <span>🚨 REMINDER INTERRUPT:</span>
             <span className="text-white">{activeReminderAlert}</span>
           </div>
        )}
        {inCallAction && inCallAction.type === 'whatsapp' && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              executeDeepLink(inCallAction.appUrl || inCallAction.url, { fallbackUrl: inCallAction.webUrl || inCallAction.url });
            }}
            className="mt-3 w-[94%] max-w-md bg-gradient-to-r from-emerald-950/95 via-[#06241a]/95 to-[#041913]/95 border-2 border-emerald-400/80 text-white p-3 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.45)] flex flex-col gap-2.5 cursor-pointer hover:border-emerald-300 transition-all z-40 animate-in fade-in slide-in-from-top-3 duration-300"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/25 border border-emerald-400/60 flex items-center justify-center shrink-0">
                  <MessageCircle size={18} className="text-emerald-400 fill-emerald-400/20" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span>{inCallAction.title}</span>
                    <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded-full font-medium">Ready</span>
                  </div>
                  <div className="text-[10px] text-emerald-200/70">Call stays active in background</div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Dismiss action"
                className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setInCallAction(null);
                }}
              >
                <X size={15} />
              </button>
            </div>

            {inCallAction.message && (
              <div className="bg-black/30 border border-emerald-500/20 rounded-xl px-2.5 py-1.5 text-xs text-emerald-100 italic line-clamp-2">
                "{inCallAction.message}"
              </div>
            )}

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all active:scale-[0.98]"
                onClick={(e) => {
                  e.stopPropagation();
                  executeDeepLink(inCallAction.appUrl || inCallAction.url, { fallbackUrl: inCallAction.webUrl || inCallAction.url });
                }}
              >
                <MessageCircle size={14} className="fill-black" />
                <span>Open WhatsApp Chat</span>
                <ExternalLink size={12} />
              </button>
              {inCallAction.message && (
                <button
                  type="button"
                  title="Copy message draft"
                  className="px-2.5 py-2 rounded-xl bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 text-xs font-semibold hover:bg-emerald-800/80 transition-all flex items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard?.writeText(inCallAction.message || '');
                  }}
                >
                  <span>Copy</span>
                </button>
              )}
            </div>
          </div>
        )}

        {inCallAction && inCallAction.type !== 'whatsapp' && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              executeDeepLink(inCallAction.appUrl || inCallAction.url, { fallbackUrl: inCallAction.webUrl || inCallAction.url });
            }}
            className="mt-3 w-[90%] max-w-sm bg-gradient-to-r from-teal-950/90 via-[#0A1A22]/90 to-[#0A141A]/90 border border-teal-500/60 text-white px-3.5 py-2.5 rounded-2xl shadow-[0_0_25px_rgba(20,184,166,0.35)] flex items-center justify-between gap-2.5 cursor-pointer hover:border-teal-400 transition-all z-30 animate-fade-in"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
                {inCallAction.type === 'youtube' && <Youtube size={16} className="text-red-400" />}
                {inCallAction.type === 'telegram' && <Send size={16} className="text-sky-400" />}
                {inCallAction.type === 'phone' && <Phone size={16} className="text-blue-400" />}
                {inCallAction.type === 'sms' && <MessageSquare size={16} className="text-cyan-400" />}
                {inCallAction.type === 'web' && <Globe size={16} className="text-amber-400" />}
                {inCallAction.type === 'image' && <ImageIcon size={16} className="text-purple-400" />}
                {inCallAction.type === 'neet' && <Sparkles size={16} className="text-emerald-400" />}
              </div>
              <div className="min-w-0 text-left">
                <div className="font-bold text-white text-xs truncate">{inCallAction.title}</div>
                {inCallAction.message && (
                  <div className="text-[11px] text-teal-200/90 truncate italic">"{inCallAction.message}"</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-black font-bold text-[11px] flex items-center gap-1 shadow transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  executeDeepLink(inCallAction.appUrl || inCallAction.url, { fallbackUrl: inCallAction.webUrl || inCallAction.url });
                }}
              >
                {inCallAction.label}
                <ExternalLink size={11} />
              </button>
              <button
                type="button"
                aria-label="Dismiss action"
                className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setInCallAction(null);
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        <div className="text-[10px] text-teal-300/70 tracking-widest uppercase mt-2">Secure End-to-End Link</div>
      </div>

      {/* Center Visual (only for voice mode) */}
      {mode === 'voice' && (
        <div className="relative z-10 w-72 h-72 flex items-center justify-center">
          {/* Audio reactive pulse rings */}
          <div id="pulse-ring-1" className="absolute inset-4 rounded-full border border-blue-500/20 transition-all duration-75 ease-out"></div>
          <div id="pulse-ring-2" className="absolute inset-8 rounded-full border border-blue-500/10 transition-all duration-75 ease-out"></div>
          <div id="pulse-ring-3" className="absolute inset-12 rounded-full border border-blue-500/5 transition-all duration-75 ease-out"></div>
          
          <div id="avatar-container" className="w-48 h-48 rounded-full bg-[#101b2d] overflow-hidden border-2 border-blue-500/40 shadow-[0_0_40px_rgba(59,130,246,0.25)] relative z-20 flex items-center justify-center transition-all duration-75 ease-out">
            <img src={getPersonaAvatar(state.persona)} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={state.persona.saraName || 'SARA'} />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="relative z-10 pb-16 flex gap-6" onClick={(e) => e.stopPropagation()}>
        <button 
           onClick={toggleMute}
           className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-white text-gray-900' : 'bg-[#2a303c] text-white hover:bg-[#353c4b]'}`}
        >
          {muted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        <button 
           onClick={handleHangup}
           className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-colors"
        >
          <PhoneOff size={24} />
        </button>
      </div>

    </div>
  );
}
