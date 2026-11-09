import type { FeatureCollection, Polygon } from "geojson";
import type {
  CorridorDataset,
  ForecastLayer,
  RouteCandidate,
} from "../../../api/contracts";
import {
  limits,
  riskColors,
  scalarColors,
  layerMissing,
} from "../../weather-timeline/frame";
const R = 6371008.8,
  rad = Math.PI / 180;
export const angular = (a: number[], b: number[]) =>
  2 *
  Math.asin(
    Math.min(
      1,
      Math.sqrt(
        Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 +
          Math.cos(a[1] * rad) *
            Math.cos(b[1] * rad) *
            Math.sin(((b[0] - a[0]) * rad) / 2) ** 2,
      ),
    ),
  );
export const bearing = (a: number[], b: number[]) =>
  Math.atan2(
    Math.sin((b[0] - a[0]) * rad) * Math.cos(b[1] * rad),
    Math.cos(a[1] * rad) * Math.sin(b[1] * rad) -
      Math.sin(a[1] * rad) *
        Math.cos(b[1] * rad) *
        Math.cos((b[0] - a[0]) * rad),
  );
export function distanceToArc(p: number[], a: number[], b: number[], prepared?: {length:number; bearing:number}) {
  const d = angular(a, p),
    length = prepared?.length ?? angular(a, b);
  if (length < 1e-10) return d * R;
  const delta = bearing(a, p) - (prepared?.bearing ?? bearing(a, b));
  const along = Math.atan2(Math.sin(d) * Math.cos(delta), Math.cos(d));
  return along < 0 || along > length
    ? Math.min(d, angular(b, p)) * R
    : Math.abs(
        Math.asin(Math.max(-1, Math.min(1, Math.sin(d) * Math.sin(delta)))),
      ) * R;
}
export const mercator = (p: number[]) => [
  p[0] * rad * R,
  Math.log(Math.tan(Math.PI / 4 + (p[1] * rad) / 2)) * R,
];
export const geographic = (x: number, y: number) => [
  x / R / rad,
  (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / rad,
];
export interface FieldCell {
  coordinates: number[][];
  sample: number;
}
export function corridorCells(
  data: CorridorDataset,
  routes: RouteCandidate[],
): FieldCell[] {
  const width = data.grid.width_miles * 1609.344,
    step = width / 3;
  if (!routes.length || !step) return [];
  const anchor = routes[0].geometry.coordinates[0][0];
  const unwrap = (lon: number) => anchor + ((lon - anchor + 540) % 360) - 180;
  const samples = data.grid.samples.map((s) => [
    unwrap(s.coordinate.longitude),
    s.coordinate.latitude,
  ]);
  const segments = routes.flatMap((r) =>
    r.geometry.coordinates
      .slice(1)
      .map((p, i) => [r.geometry.coordinates[i], p]),
  );
  const cells = new Map<string, FieldCell>();
  // A bounded shared lattice gives disjoint scalar cells, so overlapping routes never add intensity.
  for (const sample of samples) {
    if (Math.abs(sample[1]) > 85) continue;
    const [x, y] = mercator(sample);
    const ix = Math.floor(x / step),
      iy = Math.floor(y / step);
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++) {
        const a = ix + dx,
          b = iy + dy,
          key = `${a}:${b}`;
        if (cells.has(key)) continue;
        const center = geographic((a + 0.5) * step, (b + 0.5) * step);
        const corners = [
          [a, b],
          [a + 1, b],
          [a + 1, b + 1],
          [a, b + 1],
          [a, b],
        ].map(([u, v]) => geographic(u * step, v * step));
        const radius = Math.max(...corners.map((p) => angular(center, p) * R));
        const distance = Math.min(
          ...segments.map(([u, v]) => distanceToArc(center, u, v)),
        );
        // Distance is 1-Lipschitz: this conservative circumradius test keeps the entire cell inside the tube union.
        if (distance + radius > width) continue;
        let nearest = 0;
        for (let i = 1; i < samples.length; i++)
          if (angular(center, samples[i]) < angular(center, samples[nearest]))
            nearest = i;
        cells.set(key, { coordinates: corners, sample: nearest });
      }
  }
  return [...cells.values()];
}
export function fieldFeatures(
  cells: FieldCell[],
  data: CorridorDataset,
  layer: ForecastLayer,
  frame: number,
): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: cells.map((cell) => {
      let color: string;
      let missing: boolean;
      if (layer === "risk") {
        const category =
          data.risk_categories?.[cell.sample]?.[frame] ?? "unknown";
        color = riskColors[category];
        missing =
          category === "unknown" ||
          layerMissing(data, layer, cell.sample, frame);
      } else {
        const value = data.values[layer][cell.sample]?.[frame];
        missing =
          value == null || data.missing[layer][cell.sample]?.[frame] !== false;
        color = missing
          ? "#52636c"
          : scalarColors[limits[layer].filter((n) => value! >= n).length];
      }
      return {
        type: "Feature",
        properties: { color, missing },
        geometry: { type: "Polygon", coordinates: [cell.coordinates] },
      };
    }),
  };
}
