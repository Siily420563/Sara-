export function pcmToBase64(pcmData: Float32Array): string {
  const buffer = new ArrayBuffer(pcmData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    let s = Math.max(-1, Math.min(1, pcmData[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(i * 2, s, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Dynamically generate a valid 2-second PCM 16-bit 44.1kHz silence WAV Blob URL.
// Real multi-second valid PCM data prevents Android AudioTrack / ExoPlayer buffer starvation and prevents mobile browsers from freezing background tabs.
let cachedSilentAudioUrl: string | null = null;

function getValidSilentAudioUrl(): string {
  if (cachedSilentAudioUrl) return cachedSilentAudioUrl;
  try {
    const sampleRate = 44100;
    const numChannels = 1;
    const durationSec = 2;
    const numSamples = sampleRate * durationSec;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const blob = new Blob([buffer], { type: 'audio/wav' });
    cachedSilentAudioUrl = URL.createObjectURL(blob);
    return cachedSilentAudioUrl;
  } catch (e) {
    return "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  }
}

let backgroundAudioElement: HTMLAudioElement | null = null;
let speechKeepAliveTimer: any = null;

/**
 * Starts a silent looping background audio track and configures MediaSession API
 * to prevent browsers (iOS Safari, Android Chrome, background tabs) from suspending
 * the AudioContext and WebSocket during background calls and speech synthesis.
 * Provides lock screen and notification shade call controls (Mute / End Call).
 */
export function startBackgroundAudio(
  title: string = "S.A.R.A. Voice Call Active",
  artist: string = "S.A.R.A. AI Companion",
  onHangup?: () => void,
  onToggleMute?: () => void
) {
  if (typeof window === 'undefined') return;

  try {
    if (!backgroundAudioElement) {
      backgroundAudioElement = new Audio(getValidSilentAudioUrl());
      backgroundAudioElement.loop = true;
      (backgroundAudioElement as any).playsInline = true;
      backgroundAudioElement.setAttribute('playsinline', 'true');
      backgroundAudioElement.setAttribute('webkit-playsinline', 'true');
      backgroundAudioElement.volume = 0.05;
    }

    backgroundAudioElement.play().catch(() => {
      // User gesture might be required initially; already in click/start flow
    });

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title,
          artist: artist,
          album: "Live 2-Way Voice Call",
          artwork: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" }
          ]
        });
        navigator.mediaSession.playbackState = "playing";

        navigator.mediaSession.setActionHandler("play", () => {
          if (backgroundAudioElement) backgroundAudioElement.play().catch(() => {});
          if (onToggleMute) onToggleMute();
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          // Pause/Play from headphones or lock screen acts as Mute / Unmute
          if (onToggleMute) onToggleMute();
        });
        navigator.mediaSession.setActionHandler("stop", () => {
          stopBackgroundAudio();
          if (onHangup) onHangup();
        });
        navigator.mediaSession.setActionHandler("hangup" as any, () => {
          stopBackgroundAudio();
          if (onHangup) onHangup();
        });

        // W3C Media Session togglemicrophone action (supported on modern Android/desktop browsers)
        try {
          (navigator.mediaSession as any).setActionHandler("togglemicrophone", () => {
            if (onToggleMute) onToggleMute();
          });
        } catch (e) {}
      } catch (e) {
        console.log("MediaSession handler registration note:", e);
      }
    }
  } catch (err) {
    console.warn("Background audio activation note:", err);
  }
}

/**
 * Updates MediaSession metadata title to reflect mute/active call state
 */
export function updateMediaSessionMute(muted: boolean, companionName: string = "S.A.R.A.") {
  if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
    try {
      if (navigator.mediaSession.metadata) {
        navigator.mediaSession.metadata.title = muted
          ? `[MUTED] ${companionName} Voice Call`
          : `${companionName} Voice Call (Active)`;
      }
    } catch (e) {}
  }
}

/**
 * Stops background audio and resets MediaSession
 */
export function stopBackgroundAudio() {
  if (typeof window === 'undefined') return;

  try {
    if (backgroundAudioElement) {
      backgroundAudioElement.pause();
      backgroundAudioElement.currentTime = 0;
    }
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = "none";
      } catch (e) {}
    }
  } catch (e) {}
}

export function stopSpeechKeepAlive() {
  // Browser SpeechSynthesis completely removed in favor of Google Gemini Live Audio
}

export function startSpeechKeepAlive() {
  // Browser SpeechSynthesis completely removed in favor of Google Gemini Live Audio
}

// Queue for gapless playback
let nextStartTime = 0;
let activeSources: AudioBufferSourceNode[] = [];

export async function playAudioChunk(
  audioCtx: AudioContext,
  base64: string,
  playbackSpeed: number = 1,
  voicePitch: number = 0, // in cents
  analyser?: AnalyserNode,
  isVenom: boolean = false
) {
  if (!base64) return;
  try {
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const buffer = bytes.buffer;

    // Gemini Live API returns 24kHz PCM 16-bit
    // We decode it raw because it's not a WAV file
    const numChannels = 1;
    const sampleRate = 24000;
    const float32Array = new Float32Array(buffer.byteLength / 2);
    const dataView = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      float32Array[i] = dataView.getInt16(i * 2, true) / 32768;
    }

    const audioBuffer = audioCtx.createBuffer(numChannels, float32Array.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = playbackSpeed || 1;
    source.detune.value = voicePitch || 0; // Detune in cents

    if (analyser) {
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
    } else {
      source.connect(audioCtx.destination);
    }

    if (nextStartTime < audioCtx.currentTime) {
      nextStartTime = audioCtx.currentTime;
    }

    source.start(nextStartTime);
    
    activeSources.push(source);
    source.onended = () => {
      activeSources = activeSources.filter(s => s !== source);
    };

    // adjust next start time by the duration of the buffer divided by effective playback rate
    const effectiveRate = Math.max(0.1, (playbackSpeed || 1) * Math.pow(2, (voicePitch || 0) / 1200));
    nextStartTime += (audioBuffer.duration / effectiveRate);

  } catch (err) {
    console.log("Audio playback error:", err);
  }
}

export function isAudioPlaying(): boolean {
  return activeSources.length > 0;
}

export function resetAudioQueue() {
  nextStartTime = 0;
  activeSources.forEach(source => {
    try {
      source.stop();
    } catch (e) {}
  });
  activeSources = [];
}

/**
 * Synthesizes a crisp, pleasant alarm alert tone (3 dual-tone beeps)
 * using the Web Audio API without needing external audio file downloads.
 */
export function playAlarmChime(audioCtx?: AudioContext | null) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = audioCtx || new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const startTime = now + (i * 0.35);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // First tone 880Hz (A5), ramp up to 1174.66Hz (D6)
      osc.frequency.setValueAtTime(880, startTime);
      osc.frequency.exponentialRampToValueAtTime(1174.66, startTime + 0.16);

      gain.gain.setValueAtTime(0.28, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.26);
    }
  } catch (err) {
    console.warn("Alarm chime audio error:", err);
  }
}
