import type { ReactNode } from "react";
export function PlannerSidebar({
  children,
  hasTrip,
  expanded,
  onExpand,
}: {
  children: ReactNode;
  hasTrip: boolean;
  expanded: boolean;
  onExpand: () => void;
}) {
  return (
    <section
      className="planner-panel"
      id="planner"
      tabIndex={-1}
      aria-labelledby={hasTrip ? "planner-title" : "trip-form-title"}
    >
      {hasTrip && (
        <div className="sheet-controls">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="planner-content"
            onClick={onExpand}
          >
            {expanded ? "Collapse panel" : "Expand panel"}
          </button>
        </div>
      )}
      <div id="planner-content">{children}</div>
    </section>
  );
}
