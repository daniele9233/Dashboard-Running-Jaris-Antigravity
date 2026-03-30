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

const WAKE_WORD_RE = /\b(jarvis|giarvis|gervis|hi jarvis|ehi jarvis|hey jarvis)\b/i;
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

  const startListening = useCallback(() => {
    if (!browserSupported) return;
    isListeningRef.current = true;
    updateOrbState('listening');

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition: AnySpeechRecognition = new SpeechRecognitionAPI();
    recognition.lang = 'it-IT';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking') return;

      let full = '';
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript;
      }
      const lower = full.toLowerCase();

      if (WAKE_WORD_RE.test(lower)) {
        // Correctly extract command after any variant in the regex
        const match = lower.match(new RegExp(`${WAKE_WORD_RE.source}(.*)`, 'i'));
        const afterWake = (match?.[match.length - 1] ?? '').trim();
        pendingCommandRef.current = afterWake;

        updateOrbState('listening');
        onWakeWord();
        setTranscript(afterWake || '...');

        // Reset silence timer — send after 1.5s of no new words
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const cmd = pendingCommandRef.current.trim();
          pendingCommandRef.current = '';
          if (cmd.split(' ').length >= MIN_COMMAND_WORDS) {
            // Immediate UI feedback
            updateOrbState('thinking');
            sendCommand(cmd);
          }
        }, 1500);
      }
    };

    recognition.onend = () => {
      // Chrome auto-stops after silence — restart if still supposed to listen
      if (isListeningRef.current && orbStateRef.current !== 'thinking' && orbStateRef.current !== 'speaking') {
        // Add a tiny delay to avoid rapid-fire restarts
        setTimeout(() => {
          if (isListeningRef.current) {
            try { recognition.start(); } catch { /* already started */ }
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
      // Setup audio ONLY if listener starts correctly
      setupAudio();
    } catch { /* already running */ }
  }, [browserSupported, updateOrbState, onWakeWord, sendCommand]);

  const setupAudio = async () => {
    if (analyserRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ana = ctx.createAnalyser();
      ana.fftSize = 64; // Low res for light visualization
      const source = ctx.createMediaStreamSource(stream);
      source.connect(ana);
      audioContextRef.current = ctx;
      analyserRef.current = ana;
      setAnalyser(ana);
    } catch (err) {
      console.warn('[JARVIS] Audio setup failed:', err);
    }
  };

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
    analyser,
  };
}
