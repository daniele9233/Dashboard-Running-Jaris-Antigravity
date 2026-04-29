import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

/**
 * InfoTooltip — small ⓘ icon with hover tooltip portal-rendered to document.body.
 *
 * Estratto da DashboardView.tsx (round 6 — #14 god component split continuation).
 * Pure presentational. Tooltip clamped a 384px max e 70vh max-height.
 */
export function InfoTooltip({ title, lines }: { title: string; lines: string[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: rect.bottom + 12,
        left: Math.min(window.innerWidth - 384, Math.max(16, rect.right - 384)),
      });
    }
    setOpen(true);
  };

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onMouseEnter={showTooltip}
        onMouseLeave={() => setOpen(false)}
        onFocus={showTooltip}
        onBlur={() => setOpen(false)}
        className="text-[#555] hover:text-[#A0A0A0] transition-colors focus:outline-none"
        aria-label={`Info: ${title}`}
      >
        <Info size={13} />
      </button>
      {open &&
        createPortal(
          <div
            className="fixed z-[9999] w-96 max-h-[70vh] overflow-y-auto bg-[#111] border border-white/15 rounded-2xl p-4 shadow-2xl pointer-events-none"
            style={{ top: position.top, left: position.left }}
            role="tooltip"
          >
            <div className="text-[#C0FF00] text-[10px] font-black tracking-widest mb-2">{title}</div>
            <ul className="space-y-1.5">
              {lines.map((l, i) => (
                <li key={i} className="text-[#D6D6D6] text-[11px] leading-relaxed flex gap-1.5">
                  <span className="text-[#555] shrink-0">·</span>
                  {l}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
