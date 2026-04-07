import { createContext, useContext, useState, type ReactNode } from 'react';
import { JarvisOverlay } from '../components/JarvisOverlay';

interface JarvisContextType {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  JarvisPortal: ReactNode;
}

const JarvisContext = createContext<JarvisContextType | null>(null);

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  const JarvisPortal = enabled ? <JarvisOverlay /> : null;

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