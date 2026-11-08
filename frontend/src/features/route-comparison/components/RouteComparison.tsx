import { routeIndex } from "../../map/utils/geometry";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Analysis, RouteOptions } from "../../../api/contracts";
import {
  atTime,
  currentRecommendation,
  duration,
  miles,
  quantity,
  riskLabels,
  riskOrder,
} from "../presentation";
import { RiskBadge } from "./RiskBadge";
import { CheckpointDetails } from "./CheckpointDetails";
const RouteMap = lazy(() => import("../../map/components/RouteMap"));
export function RouteComparison({
  analysis,
  pendingRoutes,
}: {
  analysis: Analysis;
  pendingRoutes?: RouteOptions;
}) {
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
  return (
    <div className="comparison">
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
            ? `Route ${recommended} · Recommended under the supplied rules`
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
      {data && (
        <p className="freshness">
          Analysis {analysis.analysis_version} · Completed{" "}
          {atTime(analysis.completed_at, zone)} · Routing fetched{" "}
          {atTime(data.routing_fetched_at, zone)} · Weather fetched{" "}
          {atTime(data.weather_fetched_at, zone)}
          {analysis.stopped && " · Trip stopped"}
          {analysis.retained_previous && " · Previous analysis retained"}
        </p>
      )}
      {analysis.error_code && (
        <p className="state-warning">
          Latest analysis: {analysis.error_code}. Retained results remain
          available.
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
      <nav className="result-tabs" aria-label="Trip views">
        <a href="#planner">Planner</a>
        <button
          aria-pressed={view === "routes"}
          onClick={() => setView("routes")}
        >
          Routes
        </button>
        <button aria-pressed={view === "map"} onClick={() => setView("map")}>
          Map
        </button>
      </nav>
      <div className={`comparison-grid mobile-${view}`}>
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
          {routes.map((r, i) => {
            const risk = data?.recommendation.routes.find(
              (s) => s.route_id === r.id,
            );
            return (
              <article
                className={`route-card ${selectedId === r.id ? "selected" : ""}`}
                key={r.id}
              >
                <div className="route-card-top">
                  <span
                    className={`route-identity route-color-${routeIndex(r.id, i)}`}
                  >
                    {r.id}
                  </span>
                  <h3>{r.label}</h3>
                </div>
                <div className="route-badges">
                  {recommended === r.id && (
                    <span className="recommended">Recommended</span>
                  )}
                  {selectedId === r.id && (
                    <span className="selected-badge">
                      Selected for inspection
                    </span>
                  )}
                </div>
                <p className="route-metrics">
                  {miles(r.distance_meters)} mi · {duration(r.duration_seconds)}
                </p>
                <p>Arrives {atTime(r.arrival_at, zone)}</p>
                <p>
                  <strong>
                    Severe: {quantity(risk?.miles_by_category.severe, "mi")}
                  </strong>{" "}
                  · High: {quantity(risk?.miles_by_category.high, "mi")}
                </p>
                <div className="risk-strip" aria-hidden="true">
                  {risk ? (
                    riskOrder.map((c) => (
                      <span
                        key={c}
                        className={`risk-${c}`}
                        style={{
                          flex: Math.max(0, risk.miles_by_category[c] ?? 0),
                        }}
                      />
                    ))
                  ) : (
                    <span className="risk-unknown" style={{ flex: 1 }} />
                  )}
                </div>
                <ul
                  className="risk-distribution"
                  aria-label={`Route ${r.id} risk mileage`}
                >
                  {riskOrder
                    .filter((c) => (risk?.miles_by_category[c] ?? 0) > 0)
                    .map((c) => (
                      <li key={c}>
                        {riskLabels[c]}:{" "}
                        {quantity(risk?.miles_by_category[c], "mi")}
                      </li>
                    ))}
                </ul>
                <p className="coverage-note">
                  {!risk
                    ? "Weather pending · Eligibility not assessed"
                    : stale
                      ? "Stale/previous coverage · Current eligibility withheld"
                      : risk.eligible
                        ? "Complete, fresh coverage · Eligible under supplied rules"
                        : "Not eligible for recommendation"}
                </p>
                {risk?.eligibility_reasons.map((reason, index) => (
                  <p className="state-warning" key={index}>
                    {reason.replaceAll("_", " ")}
                  </p>
                ))}
                {r.timing_notice && <p>{r.timing_notice}</p>}
                <button
                  aria-pressed={selectedId === r.id}
                  onClick={() => select(r.id)}
                >
                  Inspect route {r.id}
                </button>
              </article>
            );
          })}
        </section>
        <section className="map-and-details" aria-label="Map and checkpoints">
          <Suspense
            fallback={
              <p role="status">
                Loading map tools. Route and checkpoint text remains available.
              </p>
            }
          >
            <RouteMap
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
          <a className="map-skip" href="#checkpoint-table">
            Skip map to checkpoint list
          </a>
          <section
            id="checkpoint-table"
            tabIndex={-1}
            className="checkpoint-section"
          >
            <h3>Route {selectedId ?? "—"} checkpoints</h3>
            <p>
              Weather at estimated arrival · {zone}. Select a checkpoint for its
              forecast interval and applied rules.
            </p>
            {!points.length ? (
              <p>Checkpoint forecasts are not available yet.</p>
            ) : (
              <table>
                <caption className="sr-only">
                  Accessible checkpoint alternative to the map
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Checkpoint / distance</th>
                    <th scope="col">Arrival / risk</th>
                    <th scope="col">Wind / rain / snow</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => {
                    const risk = summary?.checkpoints.find(
                      (c) => c.checkpoint_id === p.id,
                    );
                    const w = data?.weather.checkpoints.find(
                      (w) =>
                        w.route_id === selectedId && w.checkpoint_id === p.id,
                    );
                    return (
                      <tr key={p.id}>
                        <th scope="row">
                          {p.id}
                          <small>{quantity(p.distance_miles, "mi")}</small>
                        </th>
                        <td>
                          {atTime(p.arrival_at, zone)}
                          <br />
                          <RiskBadge category={risk?.category ?? "unknown"} />
                          {(!risk?.coverage_complete || stale) && (
                            <small>
                              {stale
                                ? "Stale assessment"
                                : "Missing required data"}
                            </small>
                          )}
                        </td>
                        <td>
                          <span>Wind: {quantity(w?.wind_mph, "mph")}</span>
                          <br />
                          <span>
                            Rain: {quantity(w?.rain_inches_per_hour, "in/hr")}
                          </span>
                          <br />
                          <span>
                            Snow: {quantity(w?.snow_inches_per_hour, "in/hr")}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => inspect(p.id)}
                            aria-label={`Inspect checkpoint ${p.id}`}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </section>
      </div>
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
