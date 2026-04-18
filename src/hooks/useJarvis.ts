import { useRef, useState, useEffect, useCallback } from 'react';
import type { OrbState, JarvisAction, JarvisResponse } from '../types/jarvis';
import { jarvisChat } from '../api';

// Web Speech API — available in Chrome/Edge but not always typed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

interface UseJarvisOptions {
  onAction: (action: JarvisAction) => void;
  onOrbStateChange: (state: OrbState) => void;
  onWakeWord: () => void;
  enabled: boolean;
}

interface UseJarvisReturn {
  transcript: string;
  response: string;
  orbState: OrbState;
  browserSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  analyser: AnalyserNode | null;
}

const WAKE_WORD_RE = /\b(jarvis|giarvis|gervis|giavis|ehi jarvis|hey jarvis|hi jarvis|ok jarvis|service|servizio)\b/i;
const MIN_COMMAND_WORDS = 1;

// ── Instant local navigation (no API call, no wake word needed) ────────────
// Matched from speech recognition final results → instant route + browser TTS
const DIRECT_NAV: Array<{ re: RegExp; route: string; label: string }> = [
  { re: /\b(dashboard|home|apri\s+dashboard|vai\s+a\s+home)\b/i,          route: '/',            label: 'Dashboard' },
  { re: /\b(allenamento|training|piano|apri\s+allenamento|vai\s+ad?\s+allenamento)\b/i, route: '/training',   label: 'piano di allenamento' },
  { re: /\b(attivit[àa]|corse|activities|apri\s+attivit|le\s+mie\s+corse)\b/i,          route: '/activities', label: 'le attività' },
  { re: /\b(statistiche?|stats|statistics|apri\s+statistiche?)\b/i,        route: '/statistics',  label: 'le statistiche' },
  { re: /\b(runner\s*dna|il\s+mio\s+dna|apri\s+dna|visualizza\s+dna)\b/i, route: '/runner-dna',  label: 'Runner DNA' },
  { re: /\b(profilo|profile|apri\s+profilo|il\s+mio\s+profilo)\b/i,       route: '/profile',     label: 'il profilo' },
];

export function useJarvis({
  onAction,
  onOrbStateChange,
  onWakeWord,
  enabled,
}: UseJarvisOptions): UseJarvisReturn {
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [orbState, setOrbState] = useState<OrbState>('idle');

  const recognitionRef = useRef<AnySpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const isActuallyStartedRef = useRef(false);
  const orbStateRef = useRef<OrbState>('idle');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCommandRef = useRef('');
  const synthRef = useRef(window.speechSynthesis);
  const synthResumeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const vadLoopRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number>(0);
  const isSpeakingMicRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const [localWhisperActive, setLocalWhisperActive] = useState(false);
  const localWhisperActiveRef = useRef(false);

  const browserSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListeningRef = useRef<() => void>(() => {});
  // Keep latest onAction in a ref so recognition handlers can call it directly
  const onActionRef = useRef(onAction);
  useEffect(() => { onActionRef.current = onAction; }, [onAction]);

  const updateOrbState = useCallback((s: OrbState) => {
    console.log('[JARVIS] State transition:', orbStateRef.current, '->', s);
    orbStateRef.current = s;
    setOrbState(s);
    onOrbStateChange(s);
  }, [onOrbStateChange]);

  const setupAudio = async () => {
    if (analyserRef.current) return;
    try {
      console.log('[JARVIS] Setting up AudioContext...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ana = ctx.createAnalyser();
      ana.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(ana);
      audioContextRef.current = ctx;
      analyserRef.current = ana;
      setAnalyser(ana);
    } catch (err) {
      console.warn('[JARVIS] Audio setup failed:', err);
    }
  };

  const speak = useCallback(async (text: string, audioBase64?: string, onEnd?: () => void) => {
    // Cancel any ongoing speech
    synthRef.current.cancel();
    updateOrbState('speaking');

    // If we have Fish Audio base64, use AudioContext for high-quality playback
    if (audioBase64 && audioContextRef.current && analyserRef.current) {
      try {
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        const audioData = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0)).buffer;
        const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect to the same analyser as the mic for visual feedback
        source.connect(analyserRef.current);
        source.connect(audioContextRef.current.destination);
        
        source.onended = () => {
          console.log('[JARVIS] Fish Audio finished');
          updateOrbState('idle');
          onEnd?.();
        };
        
        source.start(0);
        return;
      } catch (err) {
        console.warn('[JARVIS] Fish Audio playback failed, falling back to browser TTS:', err);
      }
    }
    
    // Fallback: Browser Text-to-Speech
    // Chrome bug fix: delay speak() after cancel() to avoid stuck 'pending' state
    setTimeout(() => {
      // Chrome bug fix: pause/resume unsticks the synthesis queue
      synthRef.current.pause();
      synthRef.current.resume();

      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'it-IT';
      utt.rate = 1.05;
      utt.pitch = 0.95;
      
      // Chrome bug fix: periodic resume keeps speechSynthesis alive during long speech
      if (synthResumeIntervalRef.current) clearInterval(synthResumeIntervalRef.current);
      synthResumeIntervalRef.current = setInterval(() => {
        if (synthRef.current.speaking) {
          synthRef.current.pause();
          synthRef.current.resume();
        } else {
          if (synthResumeIntervalRef.current) clearInterval(synthResumeIntervalRef.current);
        }
      }, 5000);

      utt.onend = () => {
        console.log('[JARVIS] Browser TTS finished');
        if (synthResumeIntervalRef.current) clearInterval(synthResumeIntervalRef.current);
        updateOrbState('idle');
        onEnd?.();
      };
      utt.onerror = (e) => {
        console.warn('[JARVIS] TTS error:', e);
        if (synthResumeIntervalRef.current) clearInterval(synthResumeIntervalRef.current);
        updateOrbState('idle');
        onEnd?.();
      };
      synthRef.current.speak(utt);
      console.log('[JARVIS] Browser TTS speak() called for:', text.substring(0, 40));
    }, 150);
  }, [updateOrbState]);

  const sendCommand = useCallback(async (command: string) => {
    if (!command.trim() || command.trim().split(' ').length < MIN_COMMAND_WORDS) {
      updateOrbState('listening');
      startListeningRef.current();
      return;
    }

    updateOrbState('thinking');
    setTranscript(command);

    let result: JarvisResponse;
    try {
      result = await jarvisChat(command);
    } catch (err) {
      console.error('[JARVIS] API Error:', err);
      result = {
        text: 'Ho avuto un problema di connessione. Riprova tra un istante.',
        action: { type: 'speak_only' },
      };
    }

    setResponse(result.text);
    onAction(result.action);

    speak(result.text, result.audio, () => {
      console.log('[JARVIS] Resuming after speech');
      updateOrbState('listening');
      startListeningRef.current();
    });
  }, [onAction, speak, updateOrbState]);

  const processFinalText = useCallback((lowerText: string) => {
    // ── INSTANT LOCAL NAVIGATION ──
    for (const nav of DIRECT_NAV) {
      if (nav.re.test(lowerText)) {
        console.log('[JARVIS] Direct nav detected:', nav.route);
        if (orbStateRef.current === 'idle' || orbStateRef.current === 'listening') {
          updateOrbState('listening');
          onWakeWord();
        }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        pendingCommandRef.current = '';
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch { /* ignore */ }
        }
        onActionRef.current({ type: 'navigate', route: nav.route });
        setTranscript(lowerText);
        speak(`Apro ${nav.label}.`, undefined, () => {
          updateOrbState('listening');
          startListeningRef.current();
        });
        return;
      }
    }

    // ── WAKE WORD + COMMAND ──
    if (WAKE_WORD_RE.test(lowerText)) {
      const wakeWordMatch = lowerText.match(WAKE_WORD_RE);
      const wakeWord = wakeWordMatch?.[0] || 'jarvis';
      const startIndex = lowerText.indexOf(wakeWord.toLowerCase()) + wakeWord.length;
      const rawAfter = lowerText.slice(startIndex);
      const cmd = rawAfter.replace(/^[^a-z0-9]+/, '').trim();

      if (orbStateRef.current === 'idle' || orbStateRef.current === 'listening') {
        updateOrbState('listening');
        onWakeWord();
      }

      if (cmd.split(' ').length >= MIN_COMMAND_WORDS) {
        console.log('[JARVIS] Voice Command fully detected:', cmd);
        updateOrbState('thinking');
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch { /* ignore */ }
        }
        sendCommand(cmd);
      }
    } else {
      // Not a wake word and not a direct nav. Ignored.
      console.log('[JARVIS] Ignored (no wake word or command):', lowerText);
      // restart listening if local whisper
      if (localWhisperActiveRef.current && isListeningRef.current) {
         startListeningRef.current();
      }
    }
  }, [onWakeWord, sendCommand, speak, updateOrbState]);

  // ── LOCAL WHISPER VAD LOOP ──
  const startLocalWhisperVAD = useCallback(async () => {
    if (!streamRef.current || !analyserRef.current) await setupAudio();
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try { await audioContextRef.current.resume(); } catch (e) { console.warn(e); }
    }
    if (!streamRef.current || !analyserRef.current) return;

    // Reset states
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
         mediaRecorderRef.current.stop();
      }
    } catch {}

    const mr = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
    audioChunksRef.current = [];
    mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    
    mr.onstop = async () => {
      if (vadLoopRef.current !== null) cancelAnimationFrame(vadLoopRef.current);
      if (!isListeningRef.current || orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking') return;
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = [];
      if (audioBlob.size < 5000) {
          // Too small, probably empty
          if (isListeningRef.current) {
             startLocalWhisperVAD();
          }
          return;
      }

      console.log('[JARVIS] VAD Silence detected. Sending 4080 Whisper chunk...');
      updateOrbState('thinking');

      const fd = new FormData();
      fd.append('file', audioBlob, 'audio.webm');

      try {
        const res = await fetch('http://localhost:9000/transcribe', { method: 'POST', body: fd });
        const data = await res.json();
        console.log(`[JARVIS] RTX 4080 WHISPER (${data.time_ms}ms):`, data.text);
        
        const lowerText = data.text.toLowerCase();
        setTranscript(lowerText);
        
        // Use the exact same logic as Chrome's isFinal
        processFinalText(lowerText);

      } catch (err) {
        console.error('[JARVIS] Local Whisper failed:', err);
        updateOrbState('listening');
        if (isListeningRef.current) startLocalWhisperVAD();
      }
    };

    mediaRecorderRef.current = mr;
    mr.start();
    isSpeakingMicRef.current = false;
    silenceStartRef.current = 0;

    const checkSilence = () => {
      if (!analyserRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      
      const isSpeaking = avg > 1.5; // very sensitive VAD threshold
      
      if (isSpeaking) {
          isSpeakingMicRef.current = true;
          silenceStartRef.current = 0;
      } else if (isSpeakingMicRef.current) {
          if (silenceStartRef.current === 0) {
              silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current > 1200) {
              // Silence for 1.2s -> Stop and transcribe
              mediaRecorderRef.current.stop();
              return; // exit loop
          }
      }
      
      vadLoopRef.current = requestAnimationFrame(checkSilence);
    };

    vadLoopRef.current = requestAnimationFrame(checkSilence);
  }, [processFinalText, updateOrbState]);

  const startListening = useCallback(async () => {
    // Resume context to wake up orb visualization
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try { await audioContextRef.current.resume(); } catch (e) {}
    }

    if ((!browserSupported && !localWhisperActiveRef.current) || !isListeningRef.current) return;
    
    if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking' || orbStateRef.current === 'navigating') {
      console.log('[JARVIS] Postponing start, state is busy:', orbStateRef.current);
      return;
    }

    // ── LOCAL WHISPER INTERCEPT ──
    if (localWhisperActiveRef.current) {
        if (isActuallyStartedRef.current) return;
        isActuallyStartedRef.current = true;
        console.log('[JARVIS] Starting Local RTC 4080 VAD loop...');
        await startLocalWhisperVAD();
        return;
    }

    // ── CHROME WEBSPEECH FALLBACK ──
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    if (isActuallyStartedRef.current) {
      console.log('[JARVIS] Recognition already active');
      return;
    }

    const recognition: AnySpeechRecognition = new SpeechRecognitionAPI();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      isActuallyStartedRef.current = true;
      console.log('[JARVIS] Recognition session started');
    };

    recognition.onresult = (event: any) => {
      if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking' || orbStateRef.current === 'navigating') return;

      const result = event.results[event.results.length - 1];
      const lower = result[0].transcript.toLowerCase();
      const isFinal = result.isFinal;
      console.log('[JARVIS] Heard:', lower, isFinal ? '(final)' : '(interim)');

      if (orbStateRef.current === 'listening') {
        const displayTranscript = lower.length > 40 ? `...${lower.slice(-37)}` : lower;
        setTranscript(displayTranscript);
      }

      if (isFinal) {
         processFinalText(lower);
         return;
      }

      // If interim, we do the 2500ms fallback command trigger
      if (!isFinal && WAKE_WORD_RE.test(lower)) {
        const wakeWordMatch = lower.match(WAKE_WORD_RE);
        const wakeWord = wakeWordMatch?.[0] || 'jarvis';
        const startIndex = lower.indexOf(wakeWord.toLowerCase()) + wakeWord.length;
        const rawAfter = lower.slice(startIndex);
        const afterWake = rawAfter.replace(/^[^a-z0-9]+/, '').trim();

        pendingCommandRef.current = afterWake;

        if (orbStateRef.current === 'idle' || orbStateRef.current === 'listening') {
          updateOrbState('listening');
          onWakeWord();
        }

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const cmd = pendingCommandRef.current.trim();
          pendingCommandRef.current = '';
          if (cmd.split(' ').length >= MIN_COMMAND_WORDS) {
            console.log('[JARVIS] Command detected (interim fallback):', cmd);
            updateOrbState('thinking');
            try { recognition.stop(); } catch { /* ignore */ }
            sendCommand(cmd);
          }
        }, 2500);
      }
    };

    recognition.onend = () => {
      isActuallyStartedRef.current = false;
      console.log('[JARVIS] Recognition session ended');
      
      if (isListeningRef.current && orbStateRef.current === 'listening') {
        const restartDelay = 800;
        setTimeout(() => {
          if (isListeningRef.current && orbStateRef.current === 'listening' && !isActuallyStartedRef.current) {
            console.log('[JARVIS] Restarting recognition...');
            try { recognition.start(); } catch { /* ignore aborted */ }
          }
        }, restartDelay);
      }
    };

    recognition.onerror = (e: any) => {
      isActuallyStartedRef.current = false;
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[JARVIS] Error:', e.error);
      }
    };

    try {
      recognition.start();
      console.log('[JARVIS] Called recognition.start()');
    } catch (err) {
      console.warn('[JARVIS] Start failed (likely running)');
    }
  }, [browserSupported, updateOrbState, onWakeWord, sendCommand]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  useEffect(() => {
    if (enabled && browserSupported) {
      setupAudio();
    }
  }, [enabled, browserSupported]);

  const stopListening = useCallback(() => {
    console.log('[JARVIS] Stopping all voice systems');
    isListeningRef.current = false;
    isActuallyStartedRef.current = false;
    synthRef.current.cancel();
    if (synthResumeIntervalRef.current) clearInterval(synthResumeIntervalRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    if (vadLoopRef.current) cancelAnimationFrame(vadLoopRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    updateOrbState('idle');
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
      analyserRef.current = null;
      streamRef.current = null;
      setAnalyser(null);
    }
  }, [updateOrbState]);

  // LOCAL WHISPER HEALTH CHECK ON MOUNT
  useEffect(() => {
    fetch('http://localhost:9000/status', { method: 'GET', mode: 'cors' })
      .then(r => r.json())
      .then(() => {
         console.log('✅ [JARVIS] LOCAL WHISPER RTX 4080 DETECTED! Bypassing Chrome Speech Rec.');
         setLocalWhisperActive(true);
         localWhisperActiveRef.current = true;
      })
      .catch(() => {
         console.log('⚠️ [JARVIS] Local Whisper offline. Using Chrome Web Speech API fallback.');
         setLocalWhisperActive(false);
         localWhisperActiveRef.current = false;
      });
  }, []);

  useEffect(() => {
    console.log('[JARVIS] Hook configuration changed');
    if (enabled && browserSupported) {
      isListeningRef.current = true;
      startListening();
    }
    return () => {
      stopListening();
    };
  }, [enabled, browserSupported, startListening, stopListening]);

  return {
    transcript,
    response,
    orbState,
    browserSupported,
    startListening,
    stopListening,
    analyser,
  };
}
