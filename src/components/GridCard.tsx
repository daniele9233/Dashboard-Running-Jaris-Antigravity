import { ReactNode } from "react";
import { GripVertical } from "lucide-react";

/**
 * GridCard — wrapper for widgets inside ResponsiveReactGridLayout.
 *
 * Preserves the children's existing visual styling (bg, border, rounded).
 * Adds a floating drag handle (top-left, shown on hover) that RGL targets
 * via the `.drag-handle` selector — so the rest of the widget body remains
 * fully interactive (charts, tabs, tooltips work unchanged).
 *
 * The resize handle (bottom-right) is injected automatically by
 * react-grid-layout when `resizeHandles: ['se']` is passed to the grid.
 */
export function GridCard({
  children,
  disabled = false,
}: {
  children: ReactNode;
  /** If true, hide drag grip (used when drag disabled on mobile). */
  disabled?: boolean;
}) {
  return (
    <div className="relative h-full group">
      {!disabled && (
        <div
          className="drag-handle absolute top-2 left-2 z-30 p-1 rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-white/10 transition-all cursor-move"
          title="Trascina per spostare"
        >
          <GripVertical size={14} className="text-white" />
        </div>
      )}
      <div className="h-full">{children}</div>
    </div>
  );
}
