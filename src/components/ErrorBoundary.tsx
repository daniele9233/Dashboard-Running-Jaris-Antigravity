import React, { type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../utils/telemetry';
import i18n from '../i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: string;
  /** Boundary identificativo (per logging telemetry). */
  scope?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.scope ? `:${this.props.scope}` : ''}] Caught error:`, error, errorInfo);
    reportError(error, { scope: this.props.scope ?? 'global', componentStack: errorInfo.componentStack ?? null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex-1 flex items-center justify-center bg-[#050505] text-white">
          <div className="text-center p-8">
            <p className="text-2xl font-black text-rose-400 mb-2">{i18n.t('errors.somethingWrong')}</p>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="px-6 py-2 bg-[#C0FF00] text-black font-bold rounded-xl text-sm hover:bg-[#A0D000] transition-colors"
            >
              {i18n.t('errors.backToDashboard')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * WidgetBoundary — error boundary leggero per singolo widget.
 *
 * Differenze vs ErrorBoundary "page":
 * - Fallback compatto (non full-screen, non bottone "Torna alla Dashboard").
 * - Contiene il crash al singolo widget: il resto della dashboard continua a funzionare.
 * - Pulsante "Riprova" → reset interno (non navigation).
 *
 * Uso: wrappa ogni widget nel layout (es. dentro GridCard).
 */
export function WidgetBoundary({
  children,
  scope,
  label,
}: {
  children: ReactNode;
  /** Identificativo per logging (es. "VO2MaxChart"). */
  scope?: string;
  /** Label umano mostrato nel fallback. Default: "Errore widget". */
  label?: string;
}) {
  return (
    <_WidgetBoundaryImpl scope={scope} label={label}>
      {children}
    </_WidgetBoundaryImpl>
  );
}

class _WidgetBoundaryImpl extends React.Component<
  { children: ReactNode; scope?: string; label?: string },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[WidgetBoundary:${this.props.scope ?? '?'}]`, error, info);
    reportError(error, { scope: `widget:${this.props.scope ?? 'unknown'}`, componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-[#0a0a0a] border border-rose-500/30 rounded-xl p-4">
          <div className="text-center">
            <p className="text-xs font-bold text-rose-400 mb-1">{this.props.label ?? 'Errore widget'}</p>
            <p className="text-[10px] text-gray-500 mb-3 line-clamp-2">{this.state.error?.message ?? '—'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-[10px] px-3 py-1 bg-[#1E1E1E] hover:bg-[#2A2A2A] text-white rounded-md font-bold transition-colors"
            >
              Riprova
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
