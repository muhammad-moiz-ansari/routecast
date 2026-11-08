import { useMemo } from "react";
import { corridorCells, fieldFeatures } from "../utils/corridorField";
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
}
const colors = {
  low: "#17633b",
  moderate: "#825100",
  high: "#a5430a",
  severe: "#b91c1c",
  no_travel: "#592c75",
  unknown: "#52636c",
};
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
            paint: { "background-color": night ? "#182b35" : "#e9eeec" },
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
  const cells = useMemo(
    () => (props.corridor ? corridorCells(props.corridor, props.routes) : []),
    [props.corridor?.dataset_id, props.routes],
  );
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const latest = useRef(props);
  latest.current = props;
  const fitted = useRef(false);
  const [failed, setFailed] = useState(false);
  const [tileError, setTileError] = useState(false);
  function update(map: GLMap) {
    const p = latest.current;
    for (const [index, route] of p.routes.entries()) {
      if (map.hasImage(`route-${route.id}`)) continue;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = routeColors[routeIndex(route.id, index)];
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 5;
      ctx.strokeRect(0, 0, 64, 64);
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
    (map.getSource("corridor-field") as GeoJSONSource | undefined)?.setData(
      p.corridor && p.showForecast
        ? fieldFeatures(
            cellsRef.current,
            p.corridor,
            p.forecastLayer ?? "wind_mph",
            p.forecastFrame ?? 0,
          )
        : { type: "FeatureCollection", features: [] },
    );
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
        "Route comparison map. Use arrow keys to pan; plus and minus to zoom. A checkpoint list follows.",
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
        map.addSource("corridor-field", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "corridor-field",
          type: "fill",
          source: "corridor-field",
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.85 },
        });
        map.addLayer({
          id: "corridor-missing",
          type: "line",
          source: "corridor-field",
          filter: ["==", ["get", "missing"], true],
          paint: {
            "line-color": "#ffffff",
            "line-width": 1,
            "line-dasharray": [2, 2],
          },
        });
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
            "line-color": ["get", "color"],
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
            "circle-radius": 16,
            "circle-color": "#52636c",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 3,
          },
        });
        map.addLayer({
          id: "selected-point",
          type: "circle",
          source: "points",
          filter: ["==", ["get", "id"], latest.current.selectedPointId ?? ""],
          paint: {
            "circle-radius": 19,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#14252d",
            "circle-stroke-width": 3,
          },
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
        update(map);
      } catch {
        setFailed(true);
      }
    }
    map.on("style.load", install);
    map.on("error", () => setTileError(true));
    map.on("webglcontextlost", () => setFailed(true));
    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["checkpoint-hit", "clusters", "route-hit"].filter(
          (id) => !!map.getLayer(id),
        ),
      });
      const f = features[0];
      if (!f) return;
      if (f.layer.id === "clusters") {
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
      <div className="map-toolbar">
        <strong>Route overview</strong>
        <button
          onClick={() => {
            if (mapRef.current) fit(mapRef.current, latest.current.routes);
          }}
          disabled={failed}
        >
          Fit routes
        </button>
      </div>
      <p className="map-status">
        {failed
          ? "Map unavailable. Use the route comparison and checkpoint list below."
          : tileError
            ? "Map rendering or basemap failed. Route data and text remain available."
            : !configured
              ? "Geometry-only view · No basemap configured or requested"
              : "Basemap and route geometry"}
      </p>
      <div ref={host} className={`map-canvas ${failed ? "map-hidden" : ""}`} />
      <div className="map-legend">
        <p>
          Route identity: A blue · B violet · C teal. Wide halo = selected.
          Select a line to inspect. White dashes = unassessed; dark dashes =
          blocked.
        </p>
        <p>Checkpoint symbols (cluster circles expand on click):</p>
        <div>
          {riskOrder.map((c) => (
            <span key={c}>
              <b className={`risk-badge risk-${c}`}>{riskSymbols[c]}</b>{" "}
              {riskLabels[c]}
            </span>
          ))}
        </div>
        <small>MapLibre GL JS · Routing: TomTom · Weather: Open-Meteo</small>
      </div>
    </div>
  );
}
