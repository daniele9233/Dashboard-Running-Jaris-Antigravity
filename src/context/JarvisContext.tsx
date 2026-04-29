import { createContext, lazy, Suspense, useContext, useState, type ReactNode } from 'react';

// Lazy-load JarvisOverlay: il chunk (Gemini SDK + audio init) viene scaricato
// solo quando l'utente abilita JARVIS, non al primo paint dell'app.
// Evita anche permission prompt microfono al mount globale.
const JarvisOverlay = lazy(() =>
  import('../components/JarvisOverlay').then((m) => ({ default: m.JarvisOverlay })),
);

interface JarvisContextType {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  JarvisPortal: ReactNode;
}

const JarvisContext = createContext<JarvisContextType | null>(null);

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  const JarvisPortal = enabled ? (
    <Suspense fallback={null}>
      <JarvisOverlay />
    </Suspense>
  ) : null;

  return (
    <JarvisContext.Provider value={{ enabled, setEnabled, JarvisPortal }}>
      {children}
    </JarvisContext.Provider>
  );
}

export function useJarvisContext() {
  const ctx = useContext(JarvisContext);
  if (!ctx) throw new Error('useJarvisContext must be used within JarvisProvider');
  return ctx;
}