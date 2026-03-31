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

const WAKE_WORD_RE = /\b(jarvis|giarvis|gervis|giavis|ehi jarvis|hey jarvis|hi jarvis|ok jarvis)\b/i;
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

  const updateOrbState = useCallback((s: OrbState) => {
    orbStateRef.current = s;
    setOrbState(s);
    onOrbStateChange(s);
  }, [onOrbStateChange]);


  const setupAudio = async () => {
    if (analyserRef.current) return;
    try {
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

  const speak = useCallback((text: string, onEnd?: () => void) => {
    synthRef.current.cancel();
    updateOrbState('speaking');
    
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'it-IT';
    utt.rate = 1.05;
    utt.pitch = 0.95;
    
    utt.onend = () => {
      updateOrbState('idle');
      onEnd?.();
    };
    utt.onerror = () => {
      updateOrbState('idle');
      onEnd?.();
    };
    synthRef.current.speak(utt);
  }, [updateOrbState]);

  const startListeningRef = useRef<() => void>(() => {});

  const sendCommand = useCallback(async (command: string) => {
    if (!command.trim() || command.trim().split(' ').length < MIN_COMMAND_WORDS) {
      updateOrbState('listening');
      return;
    }

    updateOrbState('thinking');
    setTranscript(command);

    let result: JarvisResponse;
    try {
      result = await jarvisChat(command);
    } catch {
      result = {
        text: 'Ho avuto un problema di connessione. Riprova tra un istante.',
        action: { type: 'speak_only' },
      };
    }

    setResponse(result.text);
    onAction(result.action);

    speak(result.text, () => {
      // After speaking, resume listening
      updateOrbState('listening');
      startListeningRef.current();
    });
  }, [onAction, speak, updateOrbState]);

  const startListening = useCallback(() => {
    if (!browserSupported) return;
    isListeningRef.current = true;
    updateOrbState('listening');

    // Resume AudioContext if suspended (browser requirement)
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(console.warn);
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }

    const recognition: AnySpeechRecognition = new SpeechRecognitionAPI();
    recognition.lang = 'it-IT';
    // continuous: false is more robust for command detection as it resets the buffer
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking') return;

      const result = event.results[event.results.length - 1];
      const lower = result[0].transcript.toLowerCase();

      // Show real-time transcript
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
            // Stop recognition while thinking/speaking to clear buffer and avoid self-triggering
            recognition.stop();
            sendCommand(cmd);
          }
        }, 1500);
      }
    };

    recognition.onend = () => {
      // Restart if still supposed to listen and not busy
      if (isListeningRef.current && orbStateRef.current === 'listening') {
        setTimeout(() => {
          if (isListeningRef.current && orbStateRef.current === 'listening') {
            try { 
              recognition.start(); 
            } catch { 
              // Usually already started
            }
          }
        }, 300);
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[JARVIS] SpeechRecognition error:', e.error);
      }
    };

    try {
      recognition.start();
      setupAudio();
    } catch { /* ignore */ }
  }, [browserSupported, updateOrbState, onWakeWord, sendCommand]);

  // Keep the ref in sync for sendCommand to use
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    synthRef.current.cancel();
    recognitionRef.current?.stop();
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
    if (enabled && browserSupported) {
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

