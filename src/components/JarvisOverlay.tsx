import { useReducer, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { JarvisOrb } from './JarvisOrb';
import { useJarvis } from '../hooks/useJarvis';
import { syncStrava, syncGarminAll, clearRunnerDnaCache } from '../api';
import type { JarvisAction, JarvisDisplayMode, OrbState } from '../types/jarvis';

// ── Voice commands list ────────────────────────────────────────────────────
const COMMANDS = [
  // Navigazione
  { text: '"Jarvis, apri dashboard"',           cat: 'nav'    },
  { text: '"Jarvis, apri allenamento"',         cat: 'nav'    },
  { text: '"Jarvis, apri attività"',            cat: 'nav'    },
  { text: '"Jarvis, apri statistiche"',         cat: 'nav'    },
  { text: '"Jarvis, apri runner DNA"',          cat: 'nav'    },
  { text: '"Jarvis, apri profilo"',             cat: 'nav'    },
  // Dati
  { text: '"Jarvis, qual è il mio VO2max?"',    cat: 'data'   },
  { text: '"Jarvis, come mi sento?"',           cat: 'data'   },
  { text: '"Jarvis, ultima corsa"',             cat: 'data'   },
  { text: '"Jarvis, migliore 10K?"',            cat: 'data'   },
  { text: '"Jarvis, quanti km questa settimana?"', cat: 'data' },
  { text: '"Jarvis, sono pronto per la gara?"', cat: 'data'   },
  { text: '"Jarvis, migliori performance"',     cat: 'data'   },
  { text: '"Jarvis, mostra fitness freshness"', cat: 'data'   },
  { text: '"Jarvis, piano di allenamento"',     cat: 'data'   },
  // Azioni
  { text: '"Jarvis, sincronizza Strava"',       cat: 'action' },
  { text: '"Jarvis, sincronizza Garmin"',       cat: 'action' },
  { text: '"Jarvis, rigenera il mio DNA"',      cat: 'action' },
];

const CAT_STYLE: Record<string, string> = {
  nav:    'text-[#C0FF00]/70',
  data:   'text-[#00FFAA]/70',
  action: 'text-white/50',
};
const CAT_DOT: Record<string, string> = {
  nav:    'bg-[#C0FF00]',
  data:   'bg-[#00FFAA]',
  action: 'bg-white/40',
};

// ── State machine ──────────────────────────────────────────────────────────
interface JarvisState {
  displayMode: JarvisDisplayMode;
  orbState: OrbState;
  hasNavigated: boolean;
}

type JarvisEvent =
  | { type: 'WAKE_WORD' }
  | { type: 'MINI_CLICK' }
  | { type: 'DISMISS' }
  | { type: 'NAVIGATE' }
  | { type: 'ORB_STATE'; orbState: OrbState };

function reducer(state: JarvisState, event: JarvisEvent): JarvisState {
  switch (event.type) {
    case 'ORB_STATE':
      return { ...state, orbState: event.orbState };
    case 'WAKE_WORD':
      return { ...state, displayMode: 'fullscreen' };
    case 'MINI_CLICK':
      return { ...state, displayMode: 'fullscreen' };
    case 'DISMISS':
      return { ...state, displayMode: 'mini' };
    case 'NAVIGATE':
      return { ...state, displayMode: 'mini', hasNavigated: true };
    default:
      return state;
  }
}

export function JarvisOverlay() {
  const navigate = useNavigate();

  const [state, dispatch] = useReducer(reducer, {
    displayMode: 'fullscreen',
    orbState: 'idle',
    hasNavigated: false,
  });

  const handleAction = useCallback((action: JarvisAction) => {
    switch (action.type) {
      case 'navigate':
        if (action.route) {
          navigate(action.route);
          dispatch({ type: 'NAVIGATE' });
        }
        break;
      case 'show_data': {
        const routeMap: Record<string, string> = {
          fitness_freshness: '/statistics',
          best_efforts: '/activities',
          training_plan: '/training',
          vdot: '/statistics',
          last_run: '/activities',
        };
        if (action.data_key && routeMap[action.data_key]) {
          navigate(routeMap[action.data_key]);
          dispatch({ type: 'NAVIGATE' });
        }
        break;
      }
      case 'sync_strava':
        syncStrava().catch(console.error);
        break;
      case 'sync_garmin':
        syncGarminAll().catch(console.error);
        break;
      case 'regenerate_dna':
        clearRunnerDnaCache()
          .then(() => { navigate('/runner-dna'); dispatch({ type: 'NAVIGATE' }); })
          .catch(console.error);
        break;
      // speak_only: no navigation, orb stays fullscreen
    }
  }, [navigate]);

  const handleOrbStateChange = useCallback((s: OrbState) => {
    dispatch({ type: 'ORB_STATE', orbState: s });
  }, []);

  const handleWakeWord = useCallback(() => {
    dispatch({ type: 'WAKE_WORD' });
  }, []);

  const { transcript, response, orbState, browserSupported, analyser } = useJarvis({
    onAction: handleAction,
    onOrbStateChange: handleOrbStateChange,
    onWakeWord: handleWakeWord,
    enabled: true,
  });

  // Resume AudioContext on user interaction (browser autoplay policy)
  useEffect(() => {
    const resume = () => {
      if (analyser) {
        const ctx = analyser.context as AudioContext;
        if (ctx.state === 'suspended') ctx.resume();
      }
    };
    window.addEventListener('click', resume);
    return () => window.removeEventListener('click', resume);
  }, [analyser]);

  const statusText = () => {
    if (!browserSupported) return 'Voice requires Chrome or Edge';
    switch (orbState) {
      case 'listening': return transcript ? transcript : 'Listening…';
      case 'thinking':  return 'Processing…';
      case 'speaking':  return response;
      default:          return 'Say "Jarvis…" or click the orb';
    }
  };

  return createPortal(
    <>
      {/* ── FULLSCREEN ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {state.displayMode === 'fullscreen' && (
          <motion.div
            key="jarvis-fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 bg-black z-[9999] flex flex-col overflow-hidden"
          >
            {/* Dismiss button */}
            {state.hasNavigated && (
              <button
                onClick={() => dispatch({ type: 'DISMISS' })}
                className="absolute top-5 right-6 z-10 text-white/30 hover:text-white/70 text-xs font-black tracking-[0.3em] uppercase transition-colors"
              >
                ESC
              </button>
            )}

            {/* Orb — fills the screen */}
            <div className="flex-1 relative">
              <JarvisOrb state={orbState} analyser={analyser} />

              {/* JARVIS label */}
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                <p className="text-[10px] font-black tracking-[0.6em] text-white/15 uppercase mb-3">
                  J · A · R · V · I · S
                </p>
                <p className="text-sm font-mono tracking-widest text-[#C0FF00]/60 min-h-[1.5em]">
                  {statusText()}
                </p>
              </div>
            </div>

            {/* Commands list — bottom left */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="absolute bottom-6 left-6 space-y-1 pointer-events-none"
            >
              <p className="text-[9px] font-black tracking-[0.35em] text-white/20 uppercase mb-2">
                Voice Commands
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                {COMMANDS.map((cmd, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={`w-1 h-1 rounded-full shrink-0 ${CAT_DOT[cmd.cat]}`} />
                    <span className={`text-[10px] font-mono ${CAT_STYLE[cmd.cat]}`}>
                      {cmd.text}
                    </span>
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-[#C0FF00]" />
                  <span className="text-[8px] text-white/20 uppercase tracking-widest">Navigation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-[#00FFAA]" />
                  <span className="text-[8px] text-white/20 uppercase tracking-widest">Data</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-white/40" />
                  <span className="text-[8px] text-white/20 uppercase tracking-widest">Actions</span>
                </div>
              </div>
            </motion.div>

            {/* Browser warning */}
            {!browserSupported && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2">
                <p className="text-xs text-amber-400 font-medium">
                  Voice recognition requires Chrome or Edge
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MINI ORB ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {state.displayMode === 'mini' && (
          <motion.button
            key="jarvis-mini"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={() => dispatch({ type: 'MINI_CLICK' })}
            className="fixed bottom-6 left-6 z-[9999] w-14 h-14 rounded-full bg-black border border-[#C0FF00]/40 cursor-pointer flex items-center justify-center"
            style={{
              boxShadow: orbState === 'listening' || orbState === 'speaking'
                ? '0 0 30px rgba(192,255,0,0.5), 0 0 60px rgba(192,255,0,0.2)'
                : '0 0 15px rgba(192,255,0,0.25)',
            }}
            title="Click to open Jarvis"
          >
            {/* Animated rings */}
            <div className="absolute inset-0 rounded-full border border-[#C0FF00]/20 animate-ping" />
            {/* Core dot */}
            <div
              className="w-5 h-5 rounded-full"
              style={{
                background: orbState === 'thinking' || orbState === 'speaking'
                  ? 'radial-gradient(circle, #00FFAA, #00FFAA44)'
                  : 'radial-gradient(circle, #C0FF00, #C0FF0044)',
              }}
            />
          </motion.button>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
