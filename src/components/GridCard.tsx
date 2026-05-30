import { ReactNode } from "react";
import { GripVertical, X } from "lucide-react";
import { WidgetBoundary } from "./ErrorBoundary";

/**
 * GridCard — wrapper for widgets inside ResponsiveReactGridLayout.
 *
 * Preserves the children's existing visual styling (bg, border, rounded).
 * Adds a floating drag handle (top-left, shown on hover) that RGL targets
 * via the `.drag-handle` selector — so the rest of the widget body remains
 * fully interactive (charts, tabs, tooltips work unchanged).
 *
 * Children wrappati in WidgetBoundary: crash di un widget non abbatte la
 * dashboard intera. Vedi ErrorBoundary.tsx → WidgetBoundary.
 *
 * The resize handle (bottom-right) is injected automatically by
 * react-grid-layout when `resizeHandles: ['se']` is passed to the grid.
 */
export function GridCard({
  children,
  disabled = false,
  onRemove,
  scope,
}: {
  children: ReactNode;
  /** If true, hide drag grip (used when drag disabled on mobile). */
  disabled?: boolean;
  /** If provided, shows an X button top-right to hide the widget. */
  onRemove?: () => void;
  /** Scope identificativo per logging telemetria (es. "VO2MaxChart"). */
  scope?: string;
}) {
  return (
    <div className="relative h-full group">
      {!disabled && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Trascina per spostare widget"
          className="drag-handle absolute top-2 left-2 z-30 p-2 rounded-xl opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-white/10 focus-visible:opacity-100 focus-visible:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C0FF00]/60 transition-opacity cursor-move"
          title="Trascina per spostare"
        >
          <GripVertical size={14} className="text-white" />
        </div>
      )}
      {!disabled && onRemove && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Rimuovi widget"
          aria-label="Rimuovi widget"
          className="absolute top-2 right-2 z-30 w-11 h-11 rounded-xl bg-black/40 hover:bg-[#F43F5E]/80 flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F43F5E]/60 transition-opacity"
        >
          <X size={14} className="text-white" />
        </button>
      )}
      <div className="h-full">
        <WidgetBoundary scope={scope}>{children}</WidgetBoundary>
      </div>
    </div>
  );
}
