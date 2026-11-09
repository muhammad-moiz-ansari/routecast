import { ThemeToggle } from "../ui/ThemeToggle";
import * as Dialog from "@radix-ui/react-dialog";
import { Route, HelpCircle, X, ChevronLeft } from "lucide-react";
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
        <Dialog.Root>
          <Dialog.Trigger className="help" aria-label="Methodology">
            <HelpCircle size={18} />
            <span>Methodology</span>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="overlay" />
            <Dialog.Content className="dialog">
              <Dialog.Title>How RouteCast compares routes</Dialog.Title>
              <Dialog.Description>
                Plan and check information while stopped. RouteCast is a
                planning assessment, not a certified navigation system.
              </Dialog.Description>
              <p>
                The backend requests up to three distinct truck routes,
                estimates checkpoint arrivals, then matches forecasts to those
                times. Fewer routes and missing forecasts are reported
                explicitly.
              </p>
              <p>
                Eligible routes are ranked by Severe miles, High miles, average
                risk, then travel time. Cargo load is separate from gross
                vehicle weight and dimensions.
              </p>
              <Dialog.Close className="close" aria-label="Close methodology">
                <X />
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}
