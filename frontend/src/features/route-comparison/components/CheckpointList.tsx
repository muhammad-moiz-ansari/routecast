import type {
  AnalysisSnapshot,
  Checkpoint,
  RouteRiskSummary,
} from "../../../api/contracts";
import { atTime, quantity } from "../presentation";
import { RiskBadge } from "./RiskBadge";
export function CheckpointList({
  selectedId,
  zone,
  points,
  summary,
  data,
  stale,
  inspect,
}: {
  selectedId: string | null;
  zone: string;
  points: Checkpoint[];
  summary: RouteRiskSummary | undefined;
  data: AnalysisSnapshot | null | undefined;
  stale: boolean;
  inspect: (id: string) => void;
}) {
  return (
    <section id="checkpoint-table" tabIndex={-1} className="checkpoint-section">
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
                (w) => w.route_id === selectedId && w.checkpoint_id === p.id,
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
                        {stale ? "Stale assessment" : "Missing required data"}
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
  );
}
