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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const browserSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListeningRef = useRef<() => void>(() => {});

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
    synthRef.current.cancel();
    updateOrbState('speaking');

    // If we have Native Gemini Audio (Base64), use AudioContext for high-quality playback
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
          console.log('[JARVIS] Native Gemini Audio finished');
          updateOrbState('idle');
          onEnd?.();
        };
        
        source.start(0);
        return;
      } catch (err) {
        console.warn('[JARVIS] Native playback failed, falling back to local TTS:', err);
      }
    }
    
    // Fallback: Browser Text-to-Speech
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'it-IT';
    utt.rate = 1.05;
    utt.pitch = 0.95;
    
    utt.onend = () => {
      console.log('[JARVIS] Browser TTS finished');
      updateOrbState('idle');
      onEnd?.();
    };
    utt.onerror = (e) => {
      console.warn('[JARVIS] TTS error:', e);
      updateOrbState('idle');
      onEnd?.();
    };
    synthRef.current.speak(utt);
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
      console.log('[JARVIS] Heard:', lower);

      if (orbStateRef.current === 'listening') {
        const displayTranscript = lower.length > 40 ? `...${lower.slice(-37)}` : lower;
        setTranscript(displayTranscript);
      }

      if (WAKE_WORD_RE.test(lower)) {
        const wakeWordMatch = lower.match(WAKE_WORD_RE);
        const wakeWord = wakeWordMatch?.[0] || 'jarvis';
        const startIndex = lower.indexOf(wakeWord.toLowerCase()) + wakeWord.length;
        const rawAfter = lower.slice(startIndex);
        const afterWake = rawAfter.replace(/^[^a-z0-9]+/, '').trim();

        pendingCommandRef.current = afterWake;

        if (orbStateRef.current === 'idle') {
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
        }, 1500);
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
