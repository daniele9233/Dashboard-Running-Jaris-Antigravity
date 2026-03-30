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
}

const WAKE_WORD_RE = /\bjarvis\b/i;
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

  const browserSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const updateOrbState = useCallback((s: OrbState) => {
    orbStateRef.current = s;
    setOrbState(s);
    onOrbStateChange(s);
  }, [onOrbStateChange]);


  const speak = useCallback((text: string, onEnd?: () => void) => {
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'it-IT';
    utt.rate = 1.05;
    utt.pitch = 0.95;
    utt.onstart = () => updateOrbState('speaking');
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
        text: 'I had trouble connecting. Please try again.',
        action: { type: 'speak_only' },
      };
    }

    setResponse(result.text);
    onAction(result.action);

    speak(result.text, () => {
      // After speaking, resume listening only for speak_only (no nav)
      if (result.action.type === 'speak_only') {
        updateOrbState('listening');
      }
    });
  }, [onAction, speak, updateOrbState]);

  const SpeechRecognitionAPI =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  // Crea sempre una nuova istanza — Chrome non gestisce bene il riuso della stessa
  const createRecognition = useCallback(() => {
    if (!SpeechRecognitionAPI) return null;
    const r: AnySpeechRecognition = new SpeechRecognitionAPI();
    r.lang = 'it-IT';
    r.continuous = false; // false = più stabile, ricreiamo dopo ogni frase
    r.interimResults = true;
    return r;
  }, [SpeechRecognitionAPI]);

  const startRecognitionInstance = useCallback(() => {
    if (!isListeningRef.current) return;
    if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking') return;

    const recognition: AnySpeechRecognition = createRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking') return;

      let full = '';
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript;
      }
      console.log('[JARVIS] Sentito:', full);
      const lower = full.toLowerCase();

      if (WAKE_WORD_RE.test(lower)) {
        const match = lower.match(/\bjarvis\b(.*)/i);
        const afterWake = (match?.[1] ?? '').trim();
        pendingCommandRef.current = afterWake;

        updateOrbState('listening');
        onWakeWord();
        setTranscript(afterWake || '...');

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const cmd = pendingCommandRef.current.trim();
          pendingCommandRef.current = '';
          if (cmd.split(' ').length >= MIN_COMMAND_WORDS) {
            sendCommand(cmd);
          }
        }, 1500);
      }
    };

    recognition.onend = () => {
      // Ricrea una nuova istanza dopo 400ms
      setTimeout(() => startRecognitionInstance(), 400);
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        console.warn('[JARVIS] Microfono non autorizzato');
        isListeningRef.current = false;
        updateOrbState('idle');
      }
      // aborted, no-speech, network: ignorati — onend si occupa del restart
    };

    try { recognition.start(); } catch { /* già avviato */ }
  }, [createRecognition, updateOrbState, onWakeWord, sendCommand]);

  const startListening = useCallback(() => {
    if (!browserSupported) return;
    isListeningRef.current = true;
    updateOrbState('listening');
    startRecognitionInstance();
  }, [browserSupported, updateOrbState, startRecognitionInstance]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    synthRef.current.cancel();
    recognitionRef.current?.stop();
    updateOrbState('idle');
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, [updateOrbState]);

  // Start on mount when enabled
  useEffect(() => {
    if (enabled && browserSupported) {
      startListening();
    }
    return () => {
      stopListening();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    transcript,
    response,
    orbState,
    browserSupported,
    startListening,
    stopListening,
  };
}
