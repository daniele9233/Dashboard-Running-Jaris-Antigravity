import React from 'react';
import { Maximize2, X } from 'lucide-react';

type ChartFullscreenModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
  details?: React.ReactNode;
};

export function ChartFullscreenModal({
  open,
  onClose,
  title,
  subtitle,
  accent: _accent = '#C0FF00',
  children,
  details,
}: ChartFullscreenModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-ea-surface-1 border border-ea-hairline rounded-2xl p-5 w-[92vw] max-w-[1500px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex flex-col"
        style={{ height: '68vh' }}
      >
        <div className="flex justify-between items-center mb-6 gap-4">
          <div>
            <h2 className="text-white font-bold text-lg tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-xs mt-0.5 text-ea-text-muted">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-[#222] hover:bg-[#2A2A2A] rounded-full text-white transition-colors border border-[#333] shrink-0"
            aria-label="Chiudi fullscreen"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 min-h-0 w-full">
          {children}
        </div>

        {details && <div className="mt-6 shrink-0">{details}</div>}
      </div>
    </div>
  );
}

export function ChartExpandButton({
  onClick,
  title = 'Espandi',
}: {
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[#2A2A2A] text-[#555] hover:text-[#C0FF00]"
      title={title}
      aria-label={title}
    >
      <Maximize2 size={15} />
    </button>
  );
}

