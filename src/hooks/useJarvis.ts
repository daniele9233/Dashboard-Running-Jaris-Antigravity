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
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ana = ctx.createAnalyser();
      ana.fftSize = 64;
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

  const startListening = useCallback(() => {
    if (!browserSupported || !isListeningRef.current) return;
    
    if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking') {
      console.log('[JARVIS] Postponing start, state is busy:', orbStateRef.current);
      return;
    }

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
      if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking') return;

      const result = event.results[event.results.length - 1];
      const lower = result[0].transcript.toLowerCase();
      const isFinal = result.isFinal;
      console.log('[JARVIS] Heard:', lower, isFinal ? '(final)' : '(interim)');

      if (orbStateRef.current === 'listening') {
        const displayTranscript = lower.length > 40 ? `...${lower.slice(-37)}` : lower;
        setTranscript(displayTranscript);
      }

      // ── INSTANT LOCAL NAVIGATION (no wake word, no API call) ──────────────
      // Only on final results to avoid false positives from interim transcripts
      if (isFinal && orbStateRef.current !== 'thinking' && orbStateRef.current !== 'speaking') {
        for (const nav of DIRECT_NAV) {
          if (nav.re.test(lower)) {
            console.log('[JARVIS] Direct nav detected:', nav.route);
            // Show fullscreen if in mini/idle mode
            if (orbStateRef.current === 'idle' || orbStateRef.current === 'listening') {
              updateOrbState('listening');
              onWakeWord();
            }
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            pendingCommandRef.current = '';
            try { recognition.stop(); } catch { /* ignore */ }
            // Navigate immediately
            onActionRef.current({ type: 'navigate', route: nav.route });
            setTranscript(lower);
            // Quick local browser TTS — no API call needed
            speak(`Apro ${nav.label}.`, undefined, () => {
              updateOrbState('listening');
              startListeningRef.current();
            });
            return;
          }
        }
      }

      // ── WAKE WORD + COMMAND (AI backend for data queries) ─────────────────
      if (WAKE_WORD_RE.test(lower)) {
        const wakeWordMatch = lower.match(WAKE_WORD_RE);
        const wakeWord = wakeWordMatch?.[0] || 'jarvis';
        const startIndex = lower.indexOf(wakeWord.toLowerCase()) + wakeWord.length;
        const rawAfter = lower.slice(startIndex);
        const afterWake = rawAfter.replace(/^[^a-z0-9]+/, '').trim();

        pendingCommandRef.current = afterWake;

        // Always fire onWakeWord to restore fullscreen — even from mini/listening mode
        if (orbStateRef.current === 'idle' || orbStateRef.current === 'listening') {
          updateOrbState('listening');
          onWakeWord();
        }

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const cmd = pendingCommandRef.current.trim();
          pendingCommandRef.current = '';
          if (cmd.split(' ').length >= MIN_COMMAND_WORDS) {
            console.log('[JARVIS] Command detected:', cmd);
            updateOrbState('thinking');
            try { recognition.stop(); } catch { /* ignore */ }
            sendCommand(cmd);
          }
        }, 2500); // 2500ms: gives time for sentence completion + Render cold start
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
    updateOrbState('idle');
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
      analyserRef.current = null;
      setAnalyser(null);
    }
  }, [updateOrbState]);

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
