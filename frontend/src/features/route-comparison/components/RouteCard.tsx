import type { RouteCandidate, RouteRiskSummary } from "../../../api/contracts";
import { routeIndex } from "../../map/utils/geometry";
import { riskColors } from "../riskPalette";
import {
  atTime,
  miles,
  duration,
  quantity,
  riskOrder,
  riskLabels,
} from "../presentation";
export function RouteCard({
  r,
  risk,
  stale,
  selected,
  recommended,
  zone,
  index,
  onSelect,
}: {
  r: RouteCandidate;
  risk: RouteRiskSummary | undefined;
  stale: boolean;
  selected: boolean;
  recommended: boolean;
  zone: string;
  index: number;
  onSelect: (id: string) => void;
}) {
  return (
    <article className={`route-card ${selected ? "selected" : ""}`} key={r.id}>
      <div className="route-card-top">
        <span
          className={`route-identity route-color-${routeIndex(r.id, index)}`}
        >
          {r.id}
        </span>
        <h3>{r.label}</h3>
      </div>
      <div className="route-badges">
        {recommended && <span className="recommended">Recommended</span>}
        {selected && (
          <span className="selected-badge">Selected for inspection</span>
        )}
      </div>
      <p className="route-metrics">
        {miles(r.distance_meters)} mi · {duration(r.duration_seconds)}
      </p>
      <p className="arrival-time">
        Arrives {atTime(r.arrival_at, zone)} · {zone}
      </p>
      {r.timing_notice && (
        <span className="timing-note">
          {r.timing_notice.toLowerCase().includes("proportional")
            ? "Proportional ETA"
            : "Estimated arrival · see timing details"}
        </span>
      )}
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
                background: riskColors[c],
              }}
            />
          ))
        ) : (
          <span
            className="risk-unknown"
            style={{ flex: 1, background: riskColors.unknown }}
          />
        )}
      </div>
      <ul
        className="risk-distribution sr-only"
        aria-label={`Route ${r.id} risk mileage`}
      >
        {riskOrder
          .filter((c) => (risk?.miles_by_category[c] ?? 0) > 0)
          .map((c) => (
            <li key={c}>
              {riskLabels[c]}: {quantity(risk?.miles_by_category[c], "mi")}
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
          {reason === "no_travel" ? "No Travel" : reason.replaceAll("_", " ")}
        </p>
      ))}

      <button aria-pressed={selected} onClick={() => onSelect(r.id)}>
        Inspect route {r.id}
      </button>
    </article>
  );
}
