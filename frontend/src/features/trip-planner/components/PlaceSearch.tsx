import { useEffect, useId, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import type { LocationOption } from "../../../api/contracts";
import { searchLocations } from "../../../api/locations";
export function PlaceSearch({
  label,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string;
  value: LocationOption | null;
  onChange: (v: LocationOption | null) => void;
  error?: string;
  disabled: boolean;
}) {
  const client = useQueryClient();
  const id = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const previous = useRef(value);
  useEffect(() => {
    if (value || previous.current) setText(value?.label ?? "");
    previous.current = value;
  }, [value]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const results = useQuery({
    queryKey: ["locations", debounced],
    queryFn: ({ signal }) => searchLocations(debounced, signal),
    enabled: open && !value && debounced.length >= 2,
    staleTime: 300000,
  });
  const options = text.trim() === debounced ? (results.data ?? []) : [];
  const visible = open && !value && text.trim().length >= 2;
  function select(o: LocationOption) {
    onChange(o);
    setText(o.label);
    setOpen(false);
    setActive(-1);
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-icon">
        <MapPin size={18} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          autoComplete="off"
          placeholder="Search city, address or place"
          value={text}
          disabled={disabled}
          aria-expanded={visible}
          aria-controls={id + "-list"}
          aria-autocomplete="list"
          aria-activedescendant={
            visible && active >= 0 ? id + "-" + active : undefined
          }
          aria-invalid={!!error}
          aria-describedby={error ? id + "-error" : undefined}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            void client.cancelQueries({
              queryKey: ["locations", debounced],
              exact: true,
            });
            previous.current = null;
            setText(e.target.value);
            onChange(null);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setActive(-1);
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((i) =>
                options.length
                  ? e.key === "ArrowDown"
                    ? Math.min(i + 1, options.length - 1)
                    : Math.max(0, i - 1)
                  : -1,
              );
            }
            if (e.key === "Enter" && visible) {
              e.preventDefault();
              if (active >= 0 && options[active]) select(options[active]);
            }
          }}
        />
      </div>
      {error && (
        <span className="error-text" id={id + "-error"}>
          {error}
        </span>
      )}
      {visible && (
        <div className="suggestions">
          <ul role="listbox" id={id + "-list"} aria-label={label + " results"}>
            {options.map((o, i) => (
              <li
                id={id + "-" + i}
                role="option"
                aria-selected={i === active}
                key={o.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(o)}
              >
                {o.label}
              </li>
            ))}
          </ul>
          <div className="search-status" role="status">
            {results.isFetching || text.trim() !== debounced
              ? "Searching places…"
              : results.error
                ? results.error.message
                : options.length === 0
                  ? "No places found. Try a more specific address."
                  : `${options.length} results. Use arrow keys and Enter to select.`}
          </div>
        </div>
      )}
    </div>
  );
}
