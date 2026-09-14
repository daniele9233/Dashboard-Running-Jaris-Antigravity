import { StrictMode, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './i18n';
import { ThemeProvider } from './context/ThemeContext';
import { IntroGate } from './components/hero/IntroGate';
import { initTelemetry } from './utils/telemetry';

// Inizializza error reporting (window.error / unhandledrejection).
initTelemetry();

// La dashboard è il pezzo pesante: arriva in un chunk a parte, richiesto solo
// quando l'intro ha finito di entrare. Così la hero dipinge subito.
const App = lazy(() => import('./App.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <IntroGate>
          <App />
        </IntroGate>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
