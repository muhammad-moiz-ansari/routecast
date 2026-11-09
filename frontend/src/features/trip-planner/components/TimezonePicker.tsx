import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Globe2, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { PlannerValues } from "../schemas";
export function TimezonePicker({
  form,
  disabled,
}: {
  form: UseFormReturn<PlannerValues>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const zone = form.watch("timezone");
  const [draft, setDraft] = useState(zone);
  const [error, setError] = useState("");
  // Searching is a local draft: Escape must not alter a valid departure timezone.
  function apply(value: string) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      form.setValue("timezone", value, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setOpen(false);
    } catch {
      setError("Choose a valid IANA timezone, for example Europe/London.");
    }
  }
  const zones = ["UTC", ...Intl.supportedValuesOf("timeZone")];
  return (
    <div className="timezone-choice">
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setDraft(zone);
            setError("");
          }
          setOpen(next);
        }}
      >
        <Dialog.Trigger disabled={disabled} className="timezone-chip">
          <Globe2 size={16} />
          Timezone · {zone}
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="dialog timezone-dialog">
            <Dialog.Title>Departure timezone</Dialog.Title>
            <Dialog.Description>
              Search IANA timezones or enter one explicitly. Departure is
              interpreted in this timezone.
            </Dialog.Description>
            <label htmlFor="timezone">Timezone</label>
            <input
              id="timezone"
              autoComplete="off"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError("");
              }}
              aria-invalid={!!error}
            />
            <div className="timezone-results" aria-label="Matching timezones">
              {zones
                .filter((z) => z.toLowerCase().includes(draft.toLowerCase()))
                .slice(0, 12)
                .map((z) => (
                  <button type="button" key={z} onClick={() => apply(z)}>
                    {z}
                  </button>
                ))}
            </div>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="timezone-done"
              onClick={() => apply(draft)}
            >
              Use timezone
            </button>
            <Dialog.Close className="close" aria-label="Close timezone">
              <X />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {form.formState.errors.timezone && (
        <span className="error-text">
          {form.formState.errors.timezone.message}
        </span>
      )}
    </div>
  );
}
