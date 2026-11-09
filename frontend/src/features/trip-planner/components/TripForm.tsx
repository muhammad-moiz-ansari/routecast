import { Controller, type UseFormReturn } from "react-hook-form";
import type { RefObject } from "react";
import { ArrowRight, ArrowDownUp } from "lucide-react";
import { PlaceSearch } from "./PlaceSearch";
import { TimezonePicker } from "./TimezonePicker";
import { SpecularButton } from "../../../components/ui/SpecularAction";
import { ApiError } from "../../../api/client";
import type { PlannerValues } from "../schemas";
export function TripForm({
  form,
  busy,
  submitted,
  issue,
  summary,
  submit,
  onNewTrip,
}: {
  form: UseFormReturn<PlannerValues>;
  busy: boolean;
  submitted: boolean;
  issue: Error | null;
  summary: RefObject<HTMLDivElement | null>;
  submit: (v: PlannerValues) => Promise<void>;
  onNewTrip: () => void;
}) {
  const errors = form.formState.errors;
  const errorList = Object.entries(errors).map(([key, v]) => ({
    key,
    message: v.message,
  }));
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(submit, () =>
        setTimeout(() => summary.current?.focus(), 0),
      )}
    >
      {(errorList.length > 0 || issue) && (
        <div className="error-summary" tabIndex={-1} ref={summary} role="alert">
          <strong>
            {issue ? "Request needs attention" : "Check your trip details"}
          </strong>
          {issue && (
            <p>
              {issue.message}
              {issue instanceof ApiError && issue.detail.retry_after_seconds
                ? ` Wait ${issue.detail.retry_after_seconds} seconds before trying again.`
                : ""}
            </p>
          )}
          <ul>
            {errorList.map((e) => (
              <li key={e.key}>{e.message}</li>
            ))}
          </ul>
          <p>Your entered values have been kept.</p>
        </div>
      )}
      <Controller
        control={form.control}
        name="origin"
        render={({ field }) => (
          <PlaceSearch
            label="Origin"
            value={field.value}
            onChange={field.onChange}
            error={errors.origin?.message}
            disabled={busy || submitted}
          />
        )}
      />
      <div className="swap-row">
        <span className="connector" />
        <button
          className="swap"
          type="button"
          disabled={busy || submitted}
          onClick={() => {
            const a = form.getValues("origin");
            form.setValue("origin", form.getValues("destination"));
            form.setValue("destination", a);
          }}
        >
          <ArrowDownUp size={16} /> Swap locations
        </button>
      </div>
      <Controller
        control={form.control}
        name="destination"
        render={({ field }) => (
          <PlaceSearch
            label="Destination"
            value={field.value}
            onChange={field.onChange}
            error={errors.destination?.message}
            disabled={busy || submitted}
          />
        )}
      />
      <div className="form-divider" />
      <div className="field">
        <label htmlFor="departure">Departure date & time</label>
        <input
          id="departure"
          type="datetime-local"
          {...form.register("departure")}
          disabled={busy || submitted}
          aria-invalid={!!errors.departure}
          aria-describedby="departure-note departure-error"
        />
        <small id="departure-note">Local time in the timezone below.</small>
        {errors.departure && (
          <span id="departure-error" className="error-text">
            {errors.departure.message}
          </span>
        )}
      </div>
      <TimezonePicker form={form} disabled={busy || submitted} />
      <div className="field">
        <label htmlFor="cargo">Cargo load</label>
        <div className="input-suffix">
          <input
            id="cargo"
            inputMode="decimal"
            {...form.register("cargo")}
            disabled={busy || submitted}
            placeholder="e.g. 30000"
            aria-invalid={!!errors.cargo}
            aria-describedby="cargo-note cargo-error"
          />
          <span>lb</span>
        </div>
        <small id="cargo-note">Used for the weather/load rules.</small>
        {errors.cargo && (
          <span className="error-text" id="cargo-error">
            {errors.cargo.message}
          </span>
        )}
      </div>
      <fieldset className="spacing" disabled={busy || submitted}>
        <legend>Checkpoint spacing</legend>
        <div className="segments">
          {["10", "25", "50"].map((s) => (
            <label key={s}>
              <input type="radio" value={s} {...form.register("spacing")} />
              <span>{s} mi</span>
            </label>
          ))}
        </div>
        <small>
          Smaller spacing samples more locations and may take longer.
        </small>
      </fieldset>
      <SpecularButton
        className="primary"
        disabled={busy || submitted}
        type="submit"
      >
        {busy ? "Comparing routes…" : "Compare routes"}
        <ArrowRight size={19} />
      </SpecularButton>
      {submitted && (
        <button type="button" className="another" onClick={onNewTrip}>
          Plan another trip
        </button>
      )}
      <p className="privacy-note">
        No account needed. Trip access stays in this browser session.
      </p>
    </form>
  );
}
