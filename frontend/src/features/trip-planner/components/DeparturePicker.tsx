import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { PlannerValues } from "../schemas";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const fromDay = (day: string) => new Date(`${day}T12:00:00Z`);
const move = (day: string, count: number) => {
  const date = fromDay(day);
  date.setUTCDate(date.getUTCDate() + count);
  return iso(date);
};

export function DeparturePicker({
  form,
  disabled,
}: {
  form: UseFormReturn<PlannerValues>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("12:00");
  const [month, setMonth] = useState("");
  const [focused, setFocused] = useState("");
  const grid = useRef<HTMLDivElement>(null);
  const zone = form.watch("timezone");
  const selected = form.watch("departure");
  function today() {
    try {
      const parts = new Intl.DateTimeFormat("en", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      return ["year", "month", "day"]
        .map((type) => parts.find((p) => p.type === type)!.value)
        .join("-");
    } catch {
      return iso(new Date());
    }
  }
  function focusDay(value: string) {
    setFocused(value);
    setMonth(value.slice(0, 7));
    requestAnimationFrame(() =>
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${value}"]`)
        ?.focus(),
    );
  }
  function changeMonth(amount: number) {
    const date = fromDay(`${month}-01`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    const value = iso(date);
    setMonth(value.slice(0, 7));
    setFocused(value);
  }
  const currentDay = today();
  const first = month ? fromDay(`${month}-01`) : new Date();
  const offset = (first.getUTCDay() + 6) % 7;
  return (
    <div className="departure-picker">
      <input
        id="departure"
        type="datetime-local"
        {...form.register("departure")}
        disabled={disabled}
        aria-invalid={!!form.formState.errors.departure}
        aria-describedby="departure-note departure-error"
      />
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (next) {
            const value = selected?.slice(0, 10) || today();
            setDay(value);
            setFocused(value);
            setMonth(value.slice(0, 7));
            setTime(selected?.slice(11, 16) || "12:00");
          }
          setOpen(next);
        }}
      >
        <Dialog.Trigger
          type="button"
          className="departure-calendar-trigger"
          disabled={disabled}
          aria-label="Choose departure date and time"
        >
          <CalendarDays size={19} aria-hidden="true" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content
            className="dialog departure-dialog"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              grid.current
                ?.querySelector<HTMLButtonElement>('[tabindex="0"]')
                ?.focus();
            }}
          >
            <Dialog.Title>When are you heading out?</Dialog.Title>
            <Dialog.Description>
              Choose a departure date and local time in {zone}.
            </Dialog.Description>
            <div className="calendar-month">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <strong aria-live="polite">
                {first.toLocaleDateString("en", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </strong>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => changeMonth(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="calendar-weekdays" aria-hidden="true">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div
              className="calendar-days"
              ref={grid}
              aria-label="Departure calendar"
            >
              {Array.from({ length: 42 }, (_, i) => {
                const value = move(iso(first), i - offset);
                const date = fromDay(value);
                return (
                  <button
                    key={value}
                    type="button"
                    data-day={value}
                    tabIndex={focused === value ? 0 : -1}
                    className={
                      value.slice(0, 7) === month ? "" : "outside-month"
                    }
                    aria-label={date.toLocaleDateString("en", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                    aria-pressed={day === value}
                    aria-current={value === currentDay ? "date" : undefined}
                    onFocus={() => setFocused(value)}
                    onClick={() => {
                      setDay(value);
                      setFocused(value);
                      setMonth(value.slice(0, 7));
                    }}
                    onKeyDown={(event) => {
                      const steps: Record<string, number> = {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                        Home: -((date.getUTCDay() + 6) % 7),
                        End: 6 - ((date.getUTCDay() + 6) % 7),
                      };
                      if (event.key in steps) {
                        event.preventDefault();
                        focusDay(move(value, steps[event.key]));
                      }
                    }}
                  >
                    {date.getUTCDate()}
                  </button>
                );
              })}
            </div>
            <div className="calendar-time">
              <label htmlFor="departure-time">Local departure time</label>
              <input
                id="departure-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="calendar-actions">
              <button
                type="button"
                onClick={() => {
                  const value = today();
                  setDay(value);
                  focusDay(value);
                }}
              >
                Today
              </button>
              <button
                type="button"
                className="calendar-apply"
                disabled={!day || !time}
                onClick={() => {
                  // Store wall time unchanged; existing Temporal validation owns timezone/DST interpretation.
                  form.setValue("departure", `${day}T${time}`, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setOpen(false);
                }}
              >
                Set departure
              </button>
            </div>
            <Dialog.Close
              className="close"
              aria-label="Close departure calendar"
            >
              <X size={20} />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
