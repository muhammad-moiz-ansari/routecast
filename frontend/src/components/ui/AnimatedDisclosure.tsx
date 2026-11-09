import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import "./AnimatedDisclosure.css";

export function AnimatedDisclosure({
  question,
  children,
  className = "",
  compact = false,
}: {
  question: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div
      className={`animated-disclosure ${compact ? "disclosure-compact" : ""} ${className}`}
    >
      <h3>
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <ChevronRight aria-hidden="true" size={18} />
          <span>{question}</span>
        </button>
      </h3>
      {/* Grid keeps both opening and closing smooth; inert excludes collapsed content from navigation. */}
      <div
        id={id}
        className={`disclosure-panel ${open ? "is-open" : ""}`}
        inert={!open}
        aria-hidden={!open}
      >
        <div>
          <div className="disclosure-copy">{children}</div>
        </div>
      </div>
    </div>
  );
}
