import { useFieldOverlay } from "../rendering/useFieldOverlay";
import { WeatherAttribution } from "../../../components/ui/WeatherAttribution";
import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type GeoJSONSource,
  type Map as GLMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  Checkpoint,
  CheckpointRisk,
  RouteCandidate,
  RouteRiskSummary,
  CorridorDataset,
  ForecastLayer,
} from "../../../api/contracts";
import { fixtureMode } from "../../../api/client";
import {
  pointFeatures,
  routeBounds,
  routeFeatures,
  labelFeatures,
  routeColors,
  routeIndex,
} from "../utils/geometry";
import {
  riskLabels,
  riskOrder,
  riskSymbols,
} from "../../route-comparison/presentation";
import { riskColors as colors } from "../../route-comparison/riskPalette";
import { RiskBadge } from "../../route-comparison/components/RiskBadge";
import { LocateFixed, Layers } from "lucide-react";
export interface MapProps {
  corridor?: CorridorDataset;
  forecastFrame?: number;
  forecastLayer?: ForecastLayer;
  showForecast?: boolean;
  routes: RouteCandidate[];
  selectedId: string | null;
  points: Checkpoint[];
  risks: CheckpointRisk[];
  routeRisks: RouteRiskSummary[];
  selectedPointId: string | null;
  onSelectRoute: (id: string) => void;
  onSelectPoint: (id: string) => void;
  weatherProvider?: string;
}
function styleForTheme(): string | StyleSpecification {
  const night = document.documentElement.dataset.theme === "night";
  const url = night
    ? import.meta.env.VITE_MAP_STYLE_NIGHT
    : import.meta.env.VITE_MAP_STYLE_DAY;
  // Fixtures never request tiles, sprites or glyphs. An unconfigured basemap is explicitly labeled.
  return !fixtureMode &&
    import.meta.env.VITE_MAP_STYLE_DAY &&
    import.meta.env.VITE_MAP_STYLE_NIGHT &&
    url
    ? url
    : {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": night ? "#0e2135" : "#e7eef6" },
          },
        ],
      };
}
function fit(map: GLMap, routes: RouteCandidate[]) {
  const bounds = routeBounds(routes);
  if (bounds) map.fitBounds(bounds, { padding: 48, maxZoom: 12, duration: 0 });
}
export default function RouteMap(props: MapProps) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const fieldStatus = useFieldOverlay(mapRef, props, styleEpoch);
  const latest = useRef(props);
  latest.current = props;
  const fitted = useRef(false);
  const [failed, setFailed] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const legendTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!legendOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector('[role="dialog"]'))
        return;
      setLegendOpen(false);
      legendTrigger.current?.focus();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [legendOpen]);
  function update(map: GLMap) {
    const p = latest.current;
    for (const [index, route] of p.routes.entries()) {
      if (map.hasImage(`route-${route.id}`)) continue;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = routeColors[routeIndex(route.id, index)];
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(route.id, 32, 34);
      map.addImage(`route-${route.id}`, ctx.getImageData(0, 0, 64, 64), {
        pixelRatio: 2,
      });
    }

    (map.getSource("routes") as GeoJSONSource | undefined)?.setData(
      routeFeatures(p.routes, p.selectedId, p.routeRisks),
    );
    (map.getSource("points") as GeoJSONSource | undefined)?.setData(
      pointFeatures(p.points, p.risks),
    );
    (map.getSource("route-labels") as GeoJSONSource | undefined)?.setData(
      labelFeatures(p.routes),
    );
    const selected = p.routes.find((r) => r.id === p.selectedId);
    (map.getSource("endpoints") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: selected
        ? [
            selected.geometry.coordinates[0],
            selected.geometry.coordinates.at(-1)!,
          ].map((coordinates, i) => ({
            type: "Feature",
            properties: { icon: i ? "destination-label" : "origin-label" },
            geometry: { type: "Point", coordinates },
          }))
        : [],
    });
    if (map.getLayer("selected-point"))
      map.setFilter("selected-point", [
        "==",
        ["get", "id"],
        p.selectedPointId ?? "",
      ]);
    if (!fitted.current && p.routes.length) {
      fit(map, p.routes);
      fitted.current = true;
    }
  }
  useEffect(() => {
    let map: GLMap;
    try {
      map = new maplibregl.Map({
        container: host.current!,
        style: styleForTheme(),
        center: [0, 20],
        zoom: 1,
        attributionControl: { compact: false },
        renderWorldCopies: false,
      });
      mapRef.current = map;
    } catch {
      setFailed(true);
      return;
    }
    map
      .getCanvas()
      .setAttribute(
        "aria-label",
        "Route comparison map. Use arrow keys to pan; plus and minus to zoom. Use Checkpoint list for a text alternative.",
      );
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }));
    function install() {
      try {
        // Local icon bitmaps avoid a remote glyph service and keep non-color risk cues in map layers.
        for (const c of riskOrder) {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 48;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = colors[c];
          ctx.beginPath();
          ctx.arc(24, 24, 21, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 28px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(riskSymbols[c], 24, 25);
          if (!map.hasImage(c))
            map.addImage(c, ctx.getImageData(0, 0, 48, 48), { pixelRatio: 2 });
        }
        map.addSource("routes", {
          type: "geojson",
          data: routeFeatures(
            latest.current.routes,
            latest.current.selectedId,
            latest.current.routeRisks,
          ),
        });
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "routes",
          paint: {
            "line-color": "#ffffff",
            "line-width": ["case", ["get", "selected"], 10, 7],
          },
        });
        map.addLayer({
          id: "route-lines",
          type: "line",
          source: "routes",
          paint: {
            "line-color": [
              "case",
              ["get", "selected"],
              "#2563eb",
              ["get", "color"],
            ],
            "line-width": ["case", ["get", "selected"], 6, 3],
          },
        });
        map.addLayer({
          id: "unknown-routes",
          type: "line",
          source: "routes",
          filter: ["==", ["get", "treatment"], "unknown"],
          paint: {
            "line-color": "#ffffff",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
        map.addLayer({
          id: "blocked-routes",
          type: "line",
          source: "routes",
          filter: ["==", ["get", "treatment"], "blocked"],
          paint: {
            "line-color": "#14252d",
            "line-width": 2,
            "line-dasharray": [1, 2],
          },
        });
        map.addSource("route-labels", {
          type: "geojson",
          data: labelFeatures(latest.current.routes),
        });
        map.addLayer({
          id: "route-labels",
          type: "symbol",
          source: "route-labels",
          layout: { "icon-image": ["get", "icon"], "icon-allow-overlap": true },
        });
        map.addLayer({
          id: "route-hit",
          type: "line",
          source: "routes",
          paint: {
            "line-color": "#000000",
            "line-opacity": 0,
            "line-width": 24,
          },
        });
        for (const [icon, label] of [
          ["origin-label", "Origin"],
          ["destination-label", "Destination"],
        ]) {
          const canvas = document.createElement("canvas");
          canvas.width = 200;
          canvas.height = 56;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#10213a";
          ctx.fillRect(0, 0, 200, 56);
          ctx.strokeStyle = "#85b2ff";
          ctx.lineWidth = 3;
          ctx.strokeRect(1, 1, 198, 54);
          ctx.fillStyle = "#fff";
          ctx.font = "600 23px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, 100, 28);
          if (!map.hasImage(icon))
            map.addImage(icon, ctx.getImageData(0, 0, 200, 56), {
              pixelRatio: 2,
            });
        }
        map.addSource("endpoints", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "endpoints",
          type: "symbol",
          source: "endpoints",
          layout: {
            "icon-image": ["get", "icon"],
            "icon-offset": [0, -26],
            "icon-allow-overlap": true,
          },
        });
        map.addSource("points", {
          type: "geojson",
          data: pointFeatures(latest.current.points, latest.current.risks),
          cluster: true,
          clusterRadius: 36,
          clusterMaxZoom: 7,
        });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "points",
          filter: ["has", "point_count"],
          paint: {
            "circle-radius": 8,
            "circle-color": "#52636c",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1.5,
          },
        });
        map.addLayer({
          id: "selected-point",
          type: "circle",
          source: "points",
          filter: ["==", ["get", "id"], latest.current.selectedPointId ?? ""],
          paint: {
            "circle-radius": 12,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#14252d",
            "circle-stroke-width": 2,
          },
        });
        // Cluster visuals stay small while retaining a comfortable interaction target.
        map.addLayer({
          id: "cluster-hit",
          type: "circle",
          source: "points",
          filter: ["has", "point_count"],
          paint: { "circle-radius": 22, "circle-opacity": 0 },
        });
        map.addLayer({
          id: "checkpoint-hit",
          type: "circle",
          source: "points",
          filter: ["!", ["has", "point_count"]],
          paint: { "circle-radius": 24, "circle-opacity": 0 },
        });
        map.addLayer({
          id: "checkpoints",
          type: "symbol",
          source: "points",
          filter: ["!", ["has", "point_count"]],
          layout: { "icon-image": ["get", "icon"], "icon-allow-overlap": true },
        });
        map.moveLayer("endpoints");
        update(map);
        setStyleEpoch((v) => v + 1);
      } catch {
        setFailed(true);
      }
    }
    map.on("style.load", install);
    map.on("error", () => setTileError(true));
    map.on("webglcontextlost", () => setFailed(true));
    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [
          "checkpoint-hit",
          "cluster-hit",
          "clusters",
          "route-hit",
        ].filter((id) => !!map.getLayer(id)),
      });
      const f = features[0];
      if (!f) return;
      if (f.layer.id === "clusters" || f.layer.id === "cluster-hit") {
        if (f.geometry.type !== "Point") return;
        const coordinate = f.geometry.coordinates as [number, number];
        map.jumpTo({ center: coordinate, zoom: map.getZoom() + 2 });
      } else if (f.layer.id === "checkpoint-hit")
        latest.current.onSelectPoint(String(f.properties.id));
      else latest.current.onSelectRoute(String(f.properties.id));
    });
    const theme = new MutationObserver(() => {
      setTileError(false);
      map.setStyle(styleForTheme());
    });
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(host.current!);
    return () => {
      theme.disconnect();
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      fitted.current = false;
    };
  }, []);
  useEffect(() => {
    if (mapRef.current?.isStyleLoaded()) update(mapRef.current);
  }, [
    props.corridor,
    props.forecastFrame,
    props.forecastLayer,
    props.showForecast,
    props.routes,
    props.selectedId,
    props.points,
    props.risks,
    props.routeRisks,
    props.selectedPointId,
  ]);
  const configured =
    !!(
      import.meta.env.VITE_MAP_STYLE_DAY && import.meta.env.VITE_MAP_STYLE_NIGHT
    ) && !fixtureMode;
  return (
    <div className="map-region" role="region" aria-label="Route map">
      <div className="map-stage">
        <div className="map-toolbar">
          <strong>Route overview</strong>
          <button
            onClick={() => {
              if (mapRef.current) fit(mapRef.current, latest.current.routes);
            }}
            disabled={failed}
            aria-label="Fit routes"
          >
            <LocateFixed size={18} />
            <span>Fit routes</span>
          </button>
        </div>
        {(failed || tileError || !configured) && (
          <p className="map-status" role={failed ? "alert" : undefined}>
            {failed
              ? "Map unavailable. Use the route comparison and checkpoint list."
              : tileError
                ? "Map rendering or basemap failed. Text remains available."
                : !configured
                  ? "Geometry-only view · Basemap not configured"
                  : null}
          </p>
        )}
        <div
          ref={host}
          className={`map-canvas ${failed ? "map-hidden" : ""}`}
        />
        <button
          className="map-legend-toggle"
          ref={legendTrigger}
          aria-label="Map legend"
          aria-expanded={legendOpen}
          aria-controls="map-legend"
          onClick={() => setLegendOpen(!legendOpen)}
        >
          <Layers size={18} />
        </button>
        {legendOpen && (
          <div
            className="map-legend"
            id="map-legend"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setLegendOpen(false);
                legendTrigger.current?.focus();
              }
            }}
          >
            <strong>Routes & checkpoints</strong>
            <p>
              Selected route: blue with wide casing. Alternatives retain A/B/C
              identity. White dashes: unassessed; dark dashes: blocked.
            </p>
            <div>
              {riskOrder.map((c) => (
                <RiskBadge key={c} category={c} />
              ))}
            </div>
            <p>
              Origin and destination labels mark the selected trip endpoints.
              Cluster circles expand on click.
            </p>
            <button
              onClick={() => {
                setLegendOpen(false);
                legendTrigger.current?.focus();
              }}
            >
              Close legend
            </button>
          </div>
        )}
      </div>
      <div className="map-credits">
        {fieldStatus && <span role="status">{fieldStatus}</span>}
        <small>
          MapLibre GL JS · Routing: <a href="https://www.tomtom.com/">TomTom</a>
        </small>
        <WeatherAttribution provider={props.weatherProvider} />
      </div>
    </div>
  );
}
