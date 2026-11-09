import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../app/ThemeProvider";
export function ThemeToggle() {
  const { night, toggle } = useTheme();
  const label = night ? "Switch to light mode" : "Switch to dark mode";
  return (
    <span className="theme-switch">
      <button type="button" onClick={toggle} aria-label={label}>
        {night ? (
          <Sun aria-hidden="true" size={20} />
        ) : (
          <Moon aria-hidden="true" size={20} />
        )}
      </button>
      <span className="theme-tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
}
