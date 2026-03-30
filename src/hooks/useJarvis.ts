import { useRef, useState, useEffect, useCallback } from 'react';
import type { OrbState, JarvisAction, JarvisResponse } from '../types/jarvis';
import { jarvisChat } from '../api';

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

export function useJarvis({
  onAction,
  onOrbStateChange,
  onWakeWord,
  enabled,
}: UseJarvisOptions): UseJarvisReturn {
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [orbState, setOrbState] = useState<OrbState>('idle');

  const isListeningRef   = useRef(false);
  const orbStateRef      = useRef<OrbState>('idle');
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCmdRef    = useRef('');
  const restartTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const synthRef         = useRef(window.speechSynthesis);

  // Callback refs — evitano closure stale senza dipendenze instabili
  const onActionRef     = useRef(onAction);
  const onWakeWordRef   = useRef(onWakeWord);
  const onOrbChangeRef  = useRef(onOrbStateChange);
  useEffect(() => { onActionRef.current = onAction; }, [onAction]);
  useEffect(() => { onWakeWordRef.current = onWakeWord; }, [onWakeWord]);
  useEffect(() => { onOrbChangeRef.current = onOrbStateChange; }, [onOrbStateChange]);

  const browserSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const updateOrbState = useCallback((s: OrbState) => {
    orbStateRef.current = s;
    setOrbState(s);
    onOrbChangeRef.current(s);
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'it-IT';
    utt.rate = 1.05;
    utt.pitch = 0.95;
    utt.onstart = () => updateOrbState('speaking');
    utt.onend   = () => { updateOrbState('idle'); onEnd?.(); };
    utt.onerror = () => { updateOrbState('idle'); onEnd?.(); };
    synthRef.current.speak(utt);
  }, [updateOrbState]);

  const sendCommand = useCallback(async (command: string) => {
    updateOrbState('thinking');
    setTranscript(command);
    let result: JarvisResponse;
    try {
      result = await jarvisChat(command);
    } catch {
      result = { text: 'Problemi di connessione. Riprova.', action: { type: 'speak_only' } };
    }
    setResponse(result.text);
    onActionRef.current(result.action);
    speak(result.text, () => {
      if (result.action.type === 'speak_only') updateOrbState('listening');
    });
  }, [speak, updateOrbState]);

  // Usa un ref per la funzione di avvio — evita closure stale in onend
  const startInstanceRef = useRef<() => void>(() => {});

  startInstanceRef.current = () => {
    if (!isListeningRef.current) return;
    if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking') return;

    const API = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!API) return;

    const rec: AnySpeechRecognition = new API();
    rec.lang = 'it-IT';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking') return;
      let full = '';
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript;
      }
      console.log('[JARVIS] Sentito:', full);
      const lower = full.toLowerCase();
      if (!WAKE_WORD_RE.test(lower)) return;

      const afterWake = (lower.match(/\bjarvis\b(.*)/i)?.[1] ?? '').trim();
      pendingCmdRef.current = afterWake;
      updateOrbState('listening');
      onWakeWordRef.current();
      setTranscript(afterWake || '...');

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const cmd = pendingCmdRef.current.trim();
        pendingCmdRef.current = '';
        if (cmd.length > 0) sendCommand(cmd);
      }, 1500);
    };

    rec.onend = () => {
      if (!isListeningRef.current) return;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => startInstanceRef.current(), 400);
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        console.warn('[JARVIS] Microfono non autorizzato');
        isListeningRef.current = false;
        updateOrbState('idle');
      }
      // aborted / no-speech / network → onend gestisce il restart
    };

    try { rec.start(); } catch { /* già avviato */ }
  };

  const startListening = useCallback(() => {
    if (!browserSupported) return;
    isListeningRef.current = true;
    updateOrbState('listening');
    startInstanceRef.current();
  }, [browserSupported, updateOrbState]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    synthRef.current.cancel();
    updateOrbState('idle');
  }, [updateOrbState]);

  useEffect(() => {
    if (enabled && browserSupported) startListening();
    return () => stopListening();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { transcript, response, orbState, browserSupported, startListening, stopListening };
}
