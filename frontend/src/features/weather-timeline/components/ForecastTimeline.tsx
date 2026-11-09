import * as Dialog from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { RiskBadge } from "../../route-comparison/components/RiskBadge";
import { WeatherAttribution } from "../../../components/ui/WeatherAttribution";
import { useState } from "react";
import type { CorridorProjection, ForecastLayer } from "../../../api/contracts";
import {
  atTime,
  quantity,
  riskLabels,
  riskOrder,
} from "../../route-comparison/presentation";
import {
  frameIndex,
  layerNames,
  limits,
  scalarColors,
  layerMissing,
} from "../frame";
export interface DisplayPreferences {
  layer: ForecastLayer;
  overlay: boolean;
}
export function loadPreferences(): DisplayPreferences {
  try {
    const p = JSON.parse(localStorage.getItem("routecast-display") ?? "{}");
    return {
      layer: Object.hasOwn(layerNames, p.layer) ? p.layer : "wind_mph",
      overlay: typeof p.overlay === "boolean" ? p.overlay : true,
    };
  } catch {
    return { layer: "wind_mph", overlay: true };
  }
}
export function ForecastTimeline({
  corridor,
  zone,
  preferences,
  onPreferences,
  absoluteTime,
  onTime,
}: {
  corridor: CorridorProjection | undefined;
  zone: string;
  preferences: DisplayPreferences;
  onPreferences: (p: DisplayPreferences) => void;
  absoluteTime: string | null;
  onTime: (t: string) => void;
}) {
  const data = corridor?.data;
  const index = data ? frameIndex(data.timestamps, absoluteTime) : 0;
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const select = (i: number) => {
    if (data?.timestamps[i]) {
      onTime(data.timestamps[i]);
    }
  };
  const layer = preferences.layer;
  const values = data?.grid.samples.map((s, i) => ({
    id: s.id,
    coordinate: s.coordinate,
    missing: layerMissing(data, layer, i, index),
    value:
      layer === "risk"
        ? (data.risk_categories?.[i]?.[index] ?? "unknown")
        : data.missing[layer]?.[i]?.[index]
          ? null
          : (data.values[layer]?.[i]?.[index] ?? null),
  }));
  const missing =
    values?.filter((v) => v.missing || v.value == null || v.value === "unknown")
      .length ?? 0;
  return (
    <section
      className="forecast-timeline"
      data-mobile-open={mobileOpen}
      aria-labelledby="forecast-title"
    >
      <button
        className="forecast-mobile-toggle"
        type="button"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        Forecast · Hour {index} {mobileOpen ? "−" : "+"}
      </button>
      <div className="timeline-heading">
        <div>
          <span className="eyebrow">CORRIDOR FORECAST · {zone}</span>
          <h3 id="forecast-title">
            Forecast at {data ? atTime(data.timestamps[index], zone) : "—"}
          </h3>
        </div>
        <div className="timeline-controls">
          <button
            disabled={!data || index === 0}
            onClick={() => select(index - 1)}
            aria-label="Previous hour"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            disabled={!data || index === data.timestamps.length - 1}
            onClick={() => select(index + 1)}
            aria-label="Next hour"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="timeline-tools">
        <div
          className="layer-segments"
          role="group"
          aria-label="Weather layers"
        >
          {Object.entries(layerNames).map(([key, label]) => (
            <button
              key={key}
              disabled={key === "risk" && !data?.risk_categories}
              aria-pressed={layer === key}
              onClick={() =>
                onPreferences({ ...preferences, layer: key as ForecastLayer })
              }
            >
              {key === "risk" ? "Risk" : label}
            </button>
          ))}
        </div>
        <div className="compact-layer">
          <label className="sr-only" htmlFor="forecast-layer">
            Weather layer
          </label>
          <select
            id="forecast-layer"
            value={layer}
            onChange={(e) =>
              onPreferences({
                ...preferences,
                layer: e.target.value as ForecastLayer,
              })
            }
          >
            {Object.entries(layerNames).map(([key, label]) => (
              <option
                key={key}
                value={key}
                disabled={key === "risk" && !data?.risk_categories}
              >
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="overlay-switch">
          <input
            type="checkbox"
            checked={preferences.overlay}
            onChange={(e) =>
              onPreferences({ ...preferences, overlay: e.target.checked })
            }
          />
          Show overlay
        </label>
        <Dialog.Root>
          <Dialog.Trigger className="forecast-details-button">
            <SlidersHorizontal size={15} />
            <span>Forecast details</span>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="overlay" />
            <Dialog.Content className="dialog forecast-dialog">
              <Dialog.Title>Corridor forecast details</Dialog.Title>
              <Dialog.Description>
                Forecast time is independent of weather at checkpoint arrival.
                Moving this slider does not change route recommendations.
              </Dialog.Description>
              <p>
                {data
                  ? `${corridor?.stale ? "Stale · " : ""}${data.coverage} coverage · ${missing} of ${values?.length} samples unavailable for this layer. Fetched ${atTime(data.fetched_at, zone)}.`
                  : "Corridor forecast is still loading."}
              </p>
              <p>
                Samples spaced about{" "}
                {data
                  ? quantity(data.grid.along_spacing_meters / 1609.344, "mi")
                  : "—"}
                ; corridor half-width {data?.grid.width_miles ?? "—"} mi. Smooth
                scalar colors interpolate nearby supported samples without
                additive intensity. Unsupported regions remain transparent, with
                feathering only inside corridor boundaries. Risk preserves the
                highest supported category rather than averaging categories.
                Additional pixels are a visual estimate, not additional forecast
                observations.
              </p>
              {layer === "risk" && (
                <p>
                  Combined risk uses the assessed cargo load and backend rules{" "}
                  {data?.rules_version ?? "unavailable"}. Incomplete samples
                  preserve known hazards and remain marked missing.
                </p>
              )}
              {data?.grid.samples.some(
                (s) => Math.abs(s.coordinate.latitude) > 85,
              ) && (
                <p className="state-warning">
                  Polar samples beyond 85° latitude are omitted from the map
                  overlay. Their forecast values remain available below.
                </p>
              )}
              {data?.notices.map((n, i) => (
                <p className="state-warning" key={i}>
                  {n}
                </p>
              ))}
              <button disabled={!data || index === 0} onClick={() => select(0)}>
                First hour
              </button>
              <button
                disabled={!data}
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                Forecast sample values
              </button>
              {expanded && data && (
                <ul className="sample-values">
                  {values?.map((v) => (
                    <li key={v.id}>
                      {v.id} ({v.coordinate.latitude.toFixed(4)},{" "}
                      {v.coordinate.longitude.toFixed(4)}){" "}
                      {v.missing ? "(incomplete forecast)" : ""}:{" "}
                      {typeof v.value === "string"
                        ? riskLabels[v.value as keyof typeof riskLabels]
                        : quantity(
                            v.value,
                            data.units[layer as keyof typeof data.units] ?? "",
                          )}
                    </li>
                  ))}
                </ul>
              )}
              <WeatherAttribution />
              <Dialog.Close
                className="close"
                aria-label="Close forecast details"
              >
                <X />
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <label className="sr-only" htmlFor="forecast-hour">
        Forecast hour {index} of 48 · {zone}
      </label>
      <input
        id="forecast-hour"
        type="range"
        min="0"
        max={data ? data.timestamps.length - 1 : 48}
        step="1"
        value={index}
        disabled={!data}
        aria-valuetext={
          data
            ? `${atTime(data.timestamps[index], zone)}, ${zone}, hour ${index}`
            : "Forecast loading"
        }
        onChange={(e) => select(Number(e.target.value))}
      />
      <div className="hour-ticks" aria-hidden="true">
        <span>0h</span>
        <span>12h</span>
        <span>24h</span>
        <span>36h</span>
        <span>48h</span>
      </div>
      <div className="timeline-bottom">
        <div
          className="scalar-legend"
          aria-label={`${layerNames[layer]} fixed legend`}
        >
          {layer === "risk"
            ? riskOrder.map((c) => <RiskBadge key={c} category={c} />)
            : [0, ...limits[layer]].map((n, i) => (
                <span key={n}>
                  <b style={{ background: scalarColors[i] }} />
                  {i === 4 ? `${n}+` : `${n}–<${limits[layer][i]}`}{" "}
                  {data?.units[layer] ??
                    (layer === "wind_mph" ? "mph" : "in/hour")}
                </span>
              ))}
        </div>
        <span
          className="coverage-status"
          role={
            !data
              ? corridor?.status === "failed"
                ? "alert"
                : "status"
              : undefined
          }
        >
          {!data
            ? corridor?.status === "failed"
              ? `Corridor unavailable: ${corridor.error_code ?? "processing failed"}. Route results remain available.`
              : "Corridor forecast is still loading."
            : `${corridor?.stale ? "Stale · " : ""}${data.coverage} · ${missing} unavailable`}
        </span>
      </div>
      <p className="forecast-help">
        {layer === "risk"
          ? "Illustrative corridor risk"
          : "Forecast at selected time"}{" "}
        · Unpainted gaps = unavailable · Arrival forecasts determine
        recommendations.
      </p>
    </section>
  );
}
