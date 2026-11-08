import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { AnalysisSnapshot, Checkpoint } from "../../../api/contracts";
import { atTime, quantity } from "../presentation";
import { RiskBadge } from "./RiskBadge";
export function CheckpointDetails({
  point,
  routeId,
  data,
  stale,
  onClose,
}: {
  point: Checkpoint | undefined;
  routeId: string;
  data: AnalysisSnapshot;
  stale: boolean;
  onClose: () => void;
}) {
  const risk = data.recommendation.routes
    .find((r) => r.route_id === routeId)
    ?.checkpoints.find((r) => r.checkpoint_id === point?.id);
  const weather = data.weather.checkpoints.find(
    (w) => w.route_id === routeId && w.checkpoint_id === point?.id,
  );
  const zone = data.inputs.timezone;
  return (
    <Dialog.Root
      open={!!point}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog checkpoint-dialog">
          <Dialog.Title>Checkpoint {point?.id}</Dialog.Title>
          <Dialog.Description>
            Weather at estimated arrival, independent of corridor forecast time.
          </Dialog.Description>
          <RiskBadge category={risk?.category ?? "unknown"} />
          <dl className="detail-grid">
            <dt>Distance from origin</dt>
            <dd>{quantity(point?.distance_miles, "mi")}</dd>
            <dt>Estimated arrival</dt>
            <dd>
              {atTime(point?.arrival_at, zone)} · {zone}
            </dd>
            <dt>Accumulation interval (start exclusive, end inclusive)</dt>
            <dd>
              {atTime(weather?.interval_start, zone)} →{" "}
              {atTime(weather?.interval_end, zone)}
            </dd>
            <dt>Wind sample times</dt>
            <dd>
              {weather?.wind_times.map((t) => atTime(t, zone)).join(" / ") ||
                "Unavailable"}
            </dd>
            <dt>Wind</dt>
            <dd>{quantity(weather?.wind_mph, "mph")}</dd>
            <dt>Rain</dt>
            <dd>{quantity(weather?.rain_inches_per_hour, "in/hr")}</dd>
            <dt>Snow</dt>
            <dd>{quantity(weather?.snow_inches_per_hour, "in/hr")}</dd>
            <dt>Cargo load</dt>
            <dd>{quantity(data.inputs.cargo_load_lb, "lb")}</dd>
            <dt>Forecast fetched</dt>
            <dd>{atTime(weather?.fetched_at, zone)}</dd>
            <dt>Freshness / coverage</dt>
            <dd>
              {stale ? "Stale assessment" : (weather?.freshness ?? "missing")} ·{" "}
              {weather?.coverage ?? "unavailable"}
            </dd>
          </dl>
          {(!risk?.coverage_complete ||
            weather?.wind_mph == null ||
            weather?.rain_inches_per_hour == null ||
            weather?.snow_inches_per_hour == null) && (
            <p className="state-warning">
              Required forecast data is missing. This is not a Low-risk
              clearance.
            </p>
          )}
          <h3>Applied rules</h3>
          {risk?.reasons.length ? (
            <ul>
              {risk.reasons.map((r, i) => (
                <li key={i}>
                  {r.message
                    .replaceAll("wind_mph", "Wind (mph)")
                    .replaceAll("rain_inches_per_hour", "Rain (in/hr)")
                    .replaceAll("snow_inches_per_hour", "Snow (in/hr)")}
                  {r.cargo_load_lb != null && (
                    <span>
                      {" "}
                      Load override: {quantity(r.cargo_load_lb, "lb")}.
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No applied rule details available.</p>
          )}
          <Dialog.Close className="close" aria-label="Close checkpoint details">
            <X />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
