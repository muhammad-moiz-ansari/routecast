import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  ArrowDownUp,
  Route,
  Sun,
  HelpCircle,
  X,
  Clock3,
  MapPin,
} from "lucide-react";
import {
  plannerSchema,
  type PlannerValues,
} from "../features/trip-planner/schemas";
import { PlaceSearch } from "../features/trip-planner/components/PlaceSearch";
import { departureInstant, systemZone } from "../utils/time";
import { createTrip, readAnalysis, readRoutes } from "../api/trips";
import { ApiError, fixtureMode } from "../api/client";
import { RouteComparison } from "../features/route-comparison/components/RouteComparison";
const stages = [
  "queued",
  "routing",
  "checkpoints",
  "weather",
  "assessing",
  "complete",
];
const stageText: Record<string, string> = {
  queued: "Trip queued for analysis",
  routing: "Finding route options",
  checkpoints: "Estimating checkpoint arrivals",
  weather: "Checking weather at arrival times",
  assessing: "Comparing weather exposure",
  complete: "Analysis completed",
};
export function App() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(!document.hidden);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("routecast-theme") ?? "system",
  );
  const summary = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<PlannerValues>({
    resolver: zodResolver(plannerSchema),
    shouldFocusError: false,
    defaultValues: {
      origin: null,
      destination: null,
      departure: "",
      timezone: systemZone(),
      cargo: "",
      spacing: "25",
    },
  });
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "night" : "day") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    localStorage.setItem("routecast-theme", theme);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  const mutation = useMutation({
    mutationFn: createTrip,
    onSuccess: (trip) => {
      setSubmitted(true);
      navigate("/trips/" + trip.id);
    },
  });
  const analysis = useQuery({
    queryKey: ["analysis", id],
    queryFn: ({ signal }) => readAnalysis(id!, signal),
    enabled: !!id && visible,
    refetchInterval: (q) =>
      visible &&
      !q.state.error &&
      !["complete", "failed", "stopped", "cancelled", "superseded"].includes(
        q.state.data?.status ?? "",
      )
        ? 15000
        : false,
  });
  const pendingRoutes = useQuery({
    queryKey: ["pending-routes", id, analysis.data?.analysis_id],
    queryFn: ({ signal }) => readRoutes(id!, signal),
    enabled:
      !!id &&
      visible &&
      !!analysis.data &&
      !analysis.data.data &&
      ["checkpoints", "weather", "assessing"].includes(analysis.data.stage),
  });
  async function submit(v: PlannerValues) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await mutation.mutateAsync({
        origin: v.origin!.coordinate,
        destination: v.destination!.coordinate,
        departure_at: departureInstant(v.departure, v.timezone),
        timezone: v.timezone,
        cargo_load_lb: Number(v.cargo),
        checkpoint_spacing_miles: Number(v.spacing) as 10 | 25 | 50,
      });
    } catch (e) {
      sending.current = false;
      if (e instanceof ApiError)
        for (const err of e.detail.field_errors ?? []) {
          const key = err.field.includes("cargo")
            ? "cargo"
            : err.field.includes("departure")
              ? "departure"
              : err.field.includes("timezone")
                ? "timezone"
                : err.field.includes("destination")
                  ? "destination"
                  : err.field.includes("origin")
                    ? "origin"
                    : null;
          if (key) form.setError(key, { message: err.message });
        }
      setTimeout(() => summary.current?.focus(), 0);
    } finally {
      setBusy(false);
    }
  }
  const errors = form.formState.errors;
  const errorList = Object.entries(errors).map(([key, v]) => ({
    key,
    message: v.message,
  }));
  const status = analysis.data;
  const issue = mutation.error ?? analysis.error;
  const comparing =
    busy ||
    (submitted &&
      !["complete", "failed", "stopped", "cancelled", "superseded"].includes(
        status?.status ?? "",
      ));
  return (
    <>
      <a className="skip" href="#planner">
        Skip to trip planner
      </a>
      <header className="shell">
        <a className="brand" href="/" aria-label="RouteCast home">
          <Route size={26} />
          <span>RouteCast</span>
        </a>
        <span className="page-label">Trip planner</span>
        <div className="header-actions">
          <label className="theme">
            <Sun size={16} aria-hidden="true" />
            <select
              aria-label="Color theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="system">System</option>
              <option value="day">Day</option>
              <option value="night">Night</option>
            </select>
          </label>
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
                  Eligible routes are ranked by Severe miles, High miles,
                  average risk, then travel time. Cargo load is separate from
                  gross vehicle weight and dimensions.
                </p>
                <Dialog.Close className="close" aria-label="Close methodology">
                  <X />
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>
      {fixtureMode && (
        <div className="fixture-banner" role="note">
          Development preview · Synthetic locations and responses · No live
          route or weather data
        </div>
      )}
      <main className="workspace">
        <section
          className="planner-panel"
          id="planner"
          aria-labelledby="planner-title"
        >
          <div className="panel-heading">
            <span className="eyebrow">Plan ahead</span>
            <h1 id="planner-title">Where are you headed?</h1>
            <p>Compare the weather along your route.</p>
          </div>
          <form
            noValidate
            onSubmit={form.handleSubmit(submit, () =>
              setTimeout(() => summary.current?.focus(), 0),
            )}
          >
            {(errorList.length > 0 || issue) && (
              <div
                className="error-summary"
                tabIndex={-1}
                ref={summary}
                role="alert"
              >
                <strong>
                  {issue
                    ? "Request needs attention"
                    : "Check your trip details"}
                </strong>
                {issue && (
                  <p>
                    {issue.message}
                    {issue instanceof ApiError &&
                    issue.detail.retry_after_seconds
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
              <small id="departure-note">
                Local time in the timezone below.
              </small>
              {errors.departure && (
                <span id="departure-error" className="error-text">
                  {errors.departure.message}
                </span>
              )}
            </div>
            <div className="field">
              <label htmlFor="timezone">Timezone</label>
              <input
                id="timezone"
                list="timezones"
                {...form.register("timezone")}
                disabled={busy || submitted}
                aria-invalid={!!errors.timezone}
                aria-describedby="timezone-note timezone-error"
              />
              <datalist id="timezones">
                {[
                  "UTC",
                  "Asia/Karachi",
                  "America/New_York",
                  "America/Chicago",
                  "America/Denver",
                  "America/Los_Angeles",
                  "Europe/London",
                ].map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
              <small id="timezone-note">
                IANA name, for example Asia/Karachi.
              </small>
              {errors.timezone && (
                <span id="timezone-error" className="error-text">
                  {errors.timezone.message}
                </span>
              )}
            </div>
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
                    <input
                      type="radio"
                      value={s}
                      {...form.register("spacing")}
                    />
                    <span>{s} mi</span>
                  </label>
                ))}
              </div>
              <small>
                Smaller spacing samples more locations and may take longer.
              </small>
            </fieldset>
            <button
              className="primary"
              disabled={busy || submitted}
              type="submit"
            >
              {busy ? "Comparing routes…" : "Compare routes"}
              <ArrowRight size={19} />
            </button>
            {submitted && (
              <button
                type="button"
                className="another"
                onClick={() => {
                  sending.current = false;
                  setSubmitted(false);
                  mutation.reset();
                  navigate("/");
                }}
              >
                Plan another trip
              </button>
            )}
            <p className="privacy-note">
              No account needed. Trip access stays in this browser session.
            </p>
          </form>
        </section>
        <section className="result-workspace" aria-labelledby="workspace-title">
          <div
            className={
              status?.data || pendingRoutes.data
                ? "workspace-heading sr-only"
                : "workspace-heading"
            }
          >
            <div>
              <span className="eyebrow">Weather-aware routing</span>
              <h2 id="workspace-title">A clearer view of the road ahead.</h2>
            </div>
            <span className="workspace-tag">
              <Clock3 size={15} /> Trip planning
            </span>
          </div>
          {id && status && (status.data || pendingRoutes.data) ? (
            <RouteComparison
              key={id}
              analysis={status}
              pendingRoutes={pendingRoutes.data}
            />
          ) : id ? (
            <div className="processing" aria-live="polite">
              <div className="workspace-icon">
                <Route size={34} />
              </div>
              <span className="eyebrow">
                {status?.data ? "Latest completed analysis" : "Trip submitted"}
              </span>
              <h3>
                {analysis.error
                  ? "Unable to read analysis"
                  : status?.stopped
                    ? "Trip stopped"
                    : status?.status === "cancelled"
                      ? "Analysis cancelled"
                      : status?.status === "complete"
                        ? "Route analysis is ready"
                        : status?.status === "failed"
                          ? "Analysis could not finish"
                          : (stageText[status?.stage ?? "queued"] ??
                            "Reading analysis status…")}
              </h3>
              <p>
                {status?.status === "failed"
                  ? `The backend reported ${status.error_code ?? "an analysis failure"}. Your trip remains saved.`
                  : status?.status === "complete"
                    ? "Your route analysis has finished. Your trip reference is saved below."
                    : "Your trip is saved. Each processing stage updates as it finishes. Arrival times and forecasts remain estimates."}
              </p>
              <ol className="stages" aria-label="Analysis stages">
                {stages.map((s, i) => (
                  <li
                    key={s}
                    className={
                      i <= stages.indexOf(status?.stage ?? "queued")
                        ? "reached"
                        : ""
                    }
                  >
                    <span className="stage-dot" />
                    {stageText[s]}
                  </li>
                ))}
              </ol>
              <span className="trip-reference">Trip reference · {id}</span>
              {analysis.error && (
                <button type="button" onClick={() => analysis.refetch()}>
                  Retry status read
                </button>
              )}
            </div>
          ) : (
            <div className="empty-workspace">
              <div className="route-sketch" aria-hidden="true">
                <svg viewBox="0 0 420 190">
                  <path d="M36 145 C100 145 65 47 156 47 S235 143 309 113 S355 42 390 45" />
                  <circle cx="36" cy="145" r="9" />
                  <circle cx="390" cy="45" r="9" />
                </svg>
                <span className="sketch-a">A</span>
                <span className="sketch-b">B</span>
              </div>
              <span className="eyebrow">Start with your trip</span>
              <h3>
                Your route comparison
                <br />
                starts here.
              </h3>
              <p>
                Enter your origin, destination and departure.
                <br />
                RouteCast will check weather at estimated arrival times along
                available routes.
              </p>
              <div className="empty-facts">
                <span>
                  <MapPin size={17} /> Choose exact locations
                </span>
                <span>
                  <Clock3 size={17} /> Set your departure time
                </span>
                <span>
                  <Route size={17} /> Compare available options
                </span>
              </div>
            </div>
          )}
          <footer className="workspace-footer">
            <span>Plan and review while stopped.</span>
            <span>Forecasts and arrival times are estimates.</span>
          </footer>
        </section>
      </main>
    </>
  );
}
