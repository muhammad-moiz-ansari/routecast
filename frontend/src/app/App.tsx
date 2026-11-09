import { PlannerWelcome } from "../features/trip-planner/components/PlannerWelcome";
import { ProcessingRoute } from "../features/trip-planner/components/ProcessingRoute";
import { PlannerSidebar } from "../features/trip-planner/components/PlannerSidebar";
import { PlannerHeader } from "../components/layout/PlannerHeader";
import { TripForm } from "../features/trip-planner/components/TripForm";
import { TripSummary } from "../features/trip-planner/components/TripSummary";
import "../styles/planner.css";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Route, Clock3, MapPin } from "lucide-react";
import {
  plannerSchema,
  type PlannerValues,
} from "../features/trip-planner/schemas";
import { departureInstant, systemZone } from "../utils/time";
import { createTrip, readRoutes } from "../api/trips";
import { ApiError, fixtureMode } from "../api/client";
import { RouteComparison } from "../features/route-comparison/components/RouteComparison";
import { useTripLifecycle } from "../features/trip-planner/hooks/useTripLifecycle";
import { readCorridor } from "../api/corridor";
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
  const lifecycle = useTripLifecycle(id);
  const analysis = lifecycle.query;
  const processingActive =
    !analysis.error &&
    !analysis.data?.stopped &&
    !["failed", "cancelled", "complete", "stopped"].includes(
      analysis.data?.status ?? "queued",
    );
  const visible = lifecycle.active;
  const summary = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sidebar, setSidebar] = useState<HTMLDivElement | null>(null);
  const [panelView, setPanelView] = useState<
    "trip" | "routes" | "checkpoints" | "map"
  >(id ? "routes" : "trip");
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // Sidebar view changes reset only its scroll; map/cached time and form state stay mounted.
  useEffect(() => {
    const pane = sidebar?.closest(".planner-panel");
    if (pane) pane.scrollTop = 0;
  }, [panelView, sidebar]);
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
  const mutation = useMutation({
    mutationFn: createTrip,
    onSuccess: (trip) => {
      setSubmitted(true);
      setEditing(false);
      setPanelView("routes");
      navigate("/trips/" + trip.id);
    },
  });
  const corridor = useQuery({
    queryKey: ["corridor", id, analysis.data?.analysis_version],
    queryFn: ({ signal }) => readCorridor(id!, signal),
    enabled: (q) =>
      !!id &&
      visible &&
      !!analysis.data?.data &&
      (!lifecycle.stopped || !q.state.data),
    refetchInterval: (q) =>
      visible &&
      !lifecycle.stopped &&
      !q.state.error &&
      (!q.state.data ||
        ["pending", "processing"].includes(q.state.data.status) ||
        q.state.data.analysis_version !== analysis.data?.analysis_version)
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
  const restored = useRef<string | null>(null);
  useEffect(() => {
    const inputs = analysis.data?.data?.inputs;
    if (
      !id ||
      !inputs ||
      submitted ||
      restored.current === id ||
      form.formState.isDirty
    )
      return;
    restored.current = id;
    const local = new Intl.DateTimeFormat("sv-SE", {
      timeZone: inputs.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(new Date(inputs.departure_at))
      .replace(" ", "T");
    form.reset({
      origin: {
        id: "saved-origin",
        label: `${inputs.origin.latitude}, ${inputs.origin.longitude}`,
        coordinate: inputs.origin,
      },
      destination: {
        id: "saved-destination",
        label: `${inputs.destination.latitude}, ${inputs.destination.longitude}`,
        coordinate: inputs.destination,
      },
      departure: local,
      timezone: inputs.timezone,
      cargo: String(inputs.cargo_load_lb),
      spacing: String(inputs.checkpoint_spacing_miles) as "10" | "25" | "50",
    });
  }, [id, analysis.data?.data, submitted, form]);
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
  const status = analysis.data;
  const issue = mutation.error ?? analysis.error;
  const editTrip = () => {
    restored.current = id ?? null;
    sending.current = false;
    setSubmitted(false);
    mutation.reset();
    setEditing(true);
    setPanelView("trip");
    navigate("/plan");
  };
  return (
    <div
      className={`planner-app ${fixtureMode ? "has-fixtures" : ""}`}
      data-has-trip={!!id}
      data-view={panelView}
      data-expanded={expanded}
      data-collapsed={collapsed}
    >
      <a className="skip" href="#planner">
        Skip to trip planner
      </a>
      <PlannerHeader
        collapsed={collapsed}
        onTogglePanel={() => setCollapsed(!collapsed)}
      />
      <nav className="workspace-nav" aria-label="Workspace views">
        {(["trip", "routes", "checkpoints", "map"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={panelView === v}
            disabled={!id && v !== "trip"}
            onClick={() => {
              setPanelView(v);
              setCollapsed(false);
            }}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </nav>
      <main className="workspace">
        <PlannerSidebar
          hasTrip={!!id}
          expanded={expanded}
          onExpand={() => setExpanded(!expanded)}
        >
          <div hidden={!!id && !editing}>
            <div className="panel-heading">
              <span className="eyebrow">TRIP DETAILS</span>
              <h2 id="trip-form-title">Plan your route</h2>
              <p>Compare forecasts along the road ahead.</p>
            </div>
            <TripForm
              form={form}
              busy={busy}
              submitted={submitted || !!id}
              issue={issue}
              summary={summary}
              submit={submit}
              onNewTrip={editTrip}
            />
          </div>
          {id && <TripSummary values={form.watch()} onEdit={editTrip} />}
          {id && (
            <div className="trip-controls" aria-label="Trip update controls">
              <button
                disabled={
                  !visible ||
                  lifecycle.stopped ||
                  lifecycle.refresh.isPending ||
                  lifecycle.stop.isPending ||
                  lifecycle.cooldownSeconds > 0
                }
                onClick={() => lifecycle.refresh.mutate()}
              >
                {lifecycle.refresh.isPending
                  ? "Requesting refresh…"
                  : lifecycle.cooldownSeconds
                    ? `Refresh available in ${lifecycle.cooldownSeconds}s`
                    : "Refresh analysis"}
              </button>
              <button
                disabled={
                  !visible ||
                  lifecycle.stopped ||
                  lifecycle.stop.isPending ||
                  lifecycle.refresh.isPending
                }
                onClick={() => lifecycle.stop.mutate()}
              >
                {lifecycle.stopped ? "Trip stopped" : "Stop updates"}
              </button>
              {analysis.error && (
                <button onClick={() => analysis.refetch()} disabled={!visible}>
                  Retry status read
                </button>
              )}
              {corridor.error && (
                <button onClick={() => corridor.refetch()} disabled={!visible}>
                  Retry corridor read
                </button>
              )}
              <span role="status">
                {lifecycle.stopped
                  ? "Updates stopped. Completed results remain available."
                  : status?.retained_previous
                    ? "Refreshing; previous completed analysis remains visible."
                    : lifecycle.refresh.isSuccess
                      ? status?.status === "complete"
                        ? "Route comparison updated."
                        : "Refresh requested. Watching analysis status."
                      : "Analysis updates while this page is visible."}
              </span>
              {(lifecycle.refresh.error || lifecycle.stop.error) && (
                <p role="alert">
                  {(lifecycle.refresh.error ?? lifecycle.stop.error)?.message}
                </p>
              )}
            </div>
          )}
          {id && !status?.data && !pendingRoutes.data && (
            <div className="processing-inline">
              <strong>
                {analysis.error
                  ? "Unable to read analysis"
                  : status?.status === "failed"
                    ? "Analysis could not finish"
                    : status?.stopped
                      ? "Trip stopped"
                      : stageText[status?.stage ?? "queued"]}
              </strong>
              <p>
                Your trip is saved. Processing stages update as results become
                available.
              </p>
            </div>
          )}
          <div
            ref={setSidebar}
            className="route-slot"
            hidden={panelView === "trip"}
          />
        </PlannerSidebar>
        <section className="result-workspace" aria-labelledby="workspace-title">
          <h2 id="workspace-title" className="sr-only">
            Route planning workspace
          </h2>

          {id && status && (status.data || pendingRoutes.data) ? (
            <RouteComparison
              sidebar={sidebar}
              panelView={panelView}
              onPanelView={setPanelView}
              corridor={corridor.data}
              corridorError={corridor.error?.message}
              key={id}
              analysis={
                analysis.error
                  ? {
                      ...status,
                      routing_stale: true,
                      weather_stale: true,
                      retained_previous: true,
                    }
                  : status
              }
              pendingRoutes={pendingRoutes.data}
            />
          ) : id ? (
            <div
              className="processing"
              aria-live="polite"
              data-loading={processingActive}
            >
              <ProcessingRoute />
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
                    aria-current={
                      processingActive && s === (status?.stage ?? "queued")
                        ? "step"
                        : undefined
                    }
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
            <PlannerWelcome />
          )}
        </section>
      </main>
    </div>
  );
}
