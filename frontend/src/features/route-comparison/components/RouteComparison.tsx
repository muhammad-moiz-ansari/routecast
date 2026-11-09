import { createPortal } from "react-dom";
import { providerBudgetMessage } from "../../../api/providerMessages";
import { AnimatedDisclosure } from "../../../components/ui/AnimatedDisclosure";
import { RouteCard } from "./RouteCard";
import { CheckpointList } from "./CheckpointList";
import {
  ForecastTimeline,
  loadPreferences,
} from "../../weather-timeline/components/ForecastTimeline";
import { aligned, frameIndex } from "../../weather-timeline/frame";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type {
  Analysis,
  RouteOptions,
  CorridorProjection,
} from "../../../api/contracts";
import { atTime, currentRecommendation } from "../presentation";
import { CheckpointDetails } from "./CheckpointDetails";
const RouteMap = lazy(() => import("../../map/components/RouteMap"));
export function RouteComparison({
  analysis,
  pendingRoutes,
  corridor,
  corridorError,
  sidebar,
  panelView,
  onPanelView,
}: {
  analysis: Analysis;
  pendingRoutes?: RouteOptions;
  corridor?: CorridorProjection;
  corridorError?: string;
  sidebar?: HTMLElement | null;
  panelView?: "trip" | "routes" | "checkpoints" | "map";
  onPanelView?: (view: "trip" | "routes" | "checkpoints" | "map") => void;
}) {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [absoluteTime, setAbsoluteTime] = useState<string | null>(null);
  const synchronized = aligned(analysis, corridor)
    ? {
        ...corridor!,
        stale:
          corridor!.stale ||
          analysis.retained_previous ||
          analysis.weather_stale ||
          !corridor!.data?.fetched_at ||
          Date.now() - Date.parse(corridor!.data!.fetched_at!) > 900000,
      }
    : undefined;
  useEffect(() => {
    localStorage.setItem("routecast-display", JSON.stringify(preferences));
  }, [preferences]);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const data = analysis.data;
  const options = data?.routes ?? pendingRoutes;
  const routes = options?.routes ?? [];
  const recommended = online ? currentRecommendation(analysis) : null;
  const [selectedId, setSelectedId] = useState<string | null>(
    () => recommended ?? routes[0]?.id ?? null,
  );
  const [pointId, setPointId] = useState<string | null>(null);
  const [view, setView] = useState("routes");
  const activeView = panelView ?? view;
  const changeView = (v: "routes" | "checkpoints") => {
    setView(v);
    onPanelView?.(v);
  };
  const returnFocus = useRef<HTMLElement | null>(null);
  // Recommendation updates never change inspection selection; disappearing IDs require an explicit replacement.
  const selected = routes.find((r) => r.id === selectedId);
  useEffect(() => {
    if (!selectedId && routes[0]) setSelectedId(recommended ?? routes[0].id);
  }, [routes, recommended, selectedId]);
  const stale =
    !online ||
    analysis.routing_stale ||
    analysis.weather_stale ||
    analysis.retained_previous ||
    analysis.analysis_revision !== analysis.input_revision;
  const summary = data?.recommendation.routes.find(
    (r) => r.route_id === selectedId,
  );
  const points = selected
    ? (data?.checkpoints[selected.id]?.checkpoints ?? [])
    : [];
  const point = points.find((p) => p.id === pointId);
  const zone = data?.inputs.timezone ?? "UTC";
  function select(id: string) {
    setSelectedId(id);
    setPointId(null);
  }
  function inspect(id: string) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPointId(id);
  }
  function closeDetails() {
    setPointId(null);
    setTimeout(() => returnFocus.current?.focus(), 0);
  }
  // A stable portal target keeps camera, inspection and cached forecast time outside pane navigation.
  const sideContent = (
    <div className="assessment-sidebar">
      <nav className="assessment-tabs" aria-label="Assessment panels">
        <button
          aria-pressed={activeView !== "checkpoints"}
          onClick={() => changeView("routes")}
        >
          Routes
        </button>
        <button
          aria-pressed={activeView === "checkpoints"}
          onClick={() => changeView("checkpoints")}
        >
          Checkpoint list
        </button>
      </nav>
      <div hidden={activeView === "checkpoints"}>
        {!online && (
          <p className="state-warning" role="alert">
            Browser offline. Showing loaded analysis; forecasts cannot be
            confirmed current.
          </p>
        )}
        <div className="comparison-heading">
          <span className="eyebrow">Route assessment</span>
          <h2>Compare your options</h2>
          <p>
            {routes.length} of up to 3 routes available · {zone}
          </p>
        </div>
        <div className="recommendation-summary" role="status">
          <strong>
            {recommended
              ? `Route ${recommended} recommended`
              : stale
                ? "Current recommendation withheld"
                : data?.recommendation.state === "NO_ELIGIBLE_ROUTE"
                  ? "No route is recommended under the current conditions"
                  : "Assessment incomplete"}
          </strong>
          <p>
            {stale
              ? "Showing a previous or stale assessment. Historical risk and weather remain inspectable; they do not establish current eligibility."
              : (data?.recommendation.explanation.message ??
                "Routes are available. Weather at arrival is still being assessed.")}
          </p>
        </div>
        <section className="route-list" aria-label="Route options">
          {!routes.length && (
            <p>
              No route options are available. Check your trip details before
              planning again.
            </p>
          )}
          {selectedId && !selected && (
            <p role="status">
              Previously inspected route {selectedId} is no longer available.
              Choose an available route below.
            </p>
          )}
          {routes.map((r, i) => (
            <RouteCard
              key={r.id}
              r={r}
              index={i}
              risk={data?.recommendation.routes.find(
                (s) => s.route_id === r.id,
              )}
              stale={stale}
              selected={selectedId === r.id}
              recommended={recommended === r.id}
              zone={zone}
              onSelect={select}
            />
          ))}
        </section>{" "}
        {data && (
          <AnimatedDisclosure
            compact
            className="assessment-metadata"
            question="Assessment details & timing"
          >
            <p className="freshness">
              Analysis {analysis.analysis_version} · Completed{" "}
              {atTime(analysis.completed_at, zone)} · Routing fetched{" "}
              {atTime(data.routing_fetched_at, zone)} · Weather fetched{" "}
              {atTime(data.weather_fetched_at, zone)}
              {analysis.stopped && " · Trip stopped"}
              {analysis.retained_previous && " · Previous analysis retained"}
            </p>
            {routes.some((r) => r.timing_notice) && (
              <p>{routes.find((r) => r.timing_notice)?.timing_notice}</p>
            )}
          </AnimatedDisclosure>
        )}
        {analysis.error_code && (
          <p className="state-warning">
            {providerBudgetMessage(analysis.error_code) ??
              `Latest analysis: ${analysis.error_code}. Retained results remain available.`}
          </p>
        )}
        {[
          ...(options?.notices ?? []),
          ...(data?.recommendation.notices ?? []),
        ].map((n, i) => (
          <p className="state-warning" key={i}>
            {n}
          </p>
        ))}
      </div>
      <div hidden={activeView !== "checkpoints"}>
        <CheckpointList
          selectedId={selectedId}
          zone={zone}
          points={points}
          summary={summary}
          data={data}
          stale={stale}
          inspect={inspect}
        />
      </div>
    </div>
  );
  return (
    <div
      className={`comparison ${sidebar ? "has-sidebar" : "standalone-comparison"}`}
    >
      {sidebar ? createPortal(sideContent, sidebar) : sideContent}
      <section className="map-and-details" aria-label="Map and checkpoints">
        <a
          className="map-skip"
          href="#checkpoint-table"
          onClick={() => {
            changeView("checkpoints");
            requestAnimationFrame(() =>
              document.getElementById("checkpoint-table")?.focus(),
            );
          }}
        >
          Skip map to checkpoint list
        </a>
        <Suspense
          fallback={
            <p role="status">
              Loading map tools. Route and checkpoint text remains available.
            </p>
          }
        >
          <RouteMap
            corridor={synchronized?.data ?? undefined}
            forecastFrame={
              synchronized?.data
                ? frameIndex(synchronized.data.timestamps, absoluteTime)
                : 0
            }
            forecastLayer={preferences.layer}
            showForecast={preferences.overlay}
            routes={routes}
            selectedId={selectedId}
            points={points}
            risks={summary?.checkpoints ?? []}
            routeRisks={data?.recommendation.routes ?? []}
            selectedPointId={pointId}
            onSelectRoute={select}
            onSelectPoint={inspect}
          />
        </Suspense>
        {corridorError && (
          <p className="state-warning" role="alert">
            Corridor read failed: {corridorError}. Loaded route results remain
            available.
          </p>
        )}
        {corridor?.data && !synchronized && (
          <p className="state-warning">
            Waiting for corridor data matching this analysis. Mismatched weather
            is hidden.
          </p>
        )}
        <ForecastTimeline
          corridor={synchronized ?? (corridor?.data ? undefined : corridor)}
          zone={zone}
          preferences={preferences}
          onPreferences={setPreferences}
          absoluteTime={absoluteTime}
          onTime={setAbsoluteTime}
        />
      </section>
      {data && (
        <CheckpointDetails
          point={point}
          routeId={selectedId ?? ""}
          data={data}
          stale={stale}
          onClose={closeDetails}
        />
      )}
    </div>
  );
}
