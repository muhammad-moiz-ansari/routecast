import { ThemeToggle } from "../ui/ThemeToggle";
import { Route, ChevronLeft } from "lucide-react";
export function PlannerHeader({
  collapsed = false,
  onTogglePanel,
}: {
  collapsed?: boolean;
  onTogglePanel?: () => void;
}) {
  return (
    <header className="shell">
      <a className="brand site-brand" href="/" aria-label="RouteCast home">
        <Route size={26} />
        <span>RouteCast</span>
        <i className="brand-dot" aria-hidden="true" />
      </a>
      <h1 className="page-label">Route planner</h1>
      <div className="header-actions">
        {onTogglePanel && (
          <button
            type="button"
            className="panel-toggle"
            aria-label={collapsed ? "Show planner" : "Hide planner"}
            aria-expanded={!collapsed}
            aria-controls="planner"
            title={collapsed ? "Show trip panel" : "Hide trip panel"}
            onClick={onTogglePanel}
          >
            <ChevronLeft aria-hidden="true" size={18} />
            <span>{collapsed ? "Show panel" : "Hide panel"}</span>
          </button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
