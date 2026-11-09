import type {
  CorridorDataset,
  ForecastLayer,
  RouteCandidate,
} from "../../../api/contracts";
import {
  angular,
  bearing,
  distanceToArc,
  mercator,
  geographic,
} from "../utils/corridorField";
import {
  layerMissing,
  limits,
  scalarColors,
} from "../../weather-timeline/frame";
import { riskColors } from "../../route-comparison/riskPalette";
export type GeometryCache = Record<
  string,
  ({ distance: number; neighbors: { i: number; distance: number }[] } | null)[]
>;
export type Tile = { coordinates: number[][]; pixels: Uint8ClampedArray };
const order = ["low", "moderate", "high", "severe", "no_travel", "unknown"];
export const conservativeRisk = (categories: string[]) =>
  categories.includes("unknown")
    ? "unknown"
    : [...categories].sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
export function interpolate(values: { distance: number; value: number }[]) {
  if (values[0]?.distance === 0) return values[0].value;
  let total = 0,
    weight = 0;
  for (const v of values) {
    const w = 1 / Math.max(1, v.distance) ** 2;
    total += v.value * w;
    weight += w;
  }
  return total / weight;
}
const palette = scalarColors.map((h) =>
  [1, 3, 5].map((n) => parseInt(h.slice(n, n + 2), 16)),
);
export function color(value: number, layer: Exclude<ForecastLayer, "risk">) {
  const stops = [0, ...limits[layer]];
  let i = 0;
  while (i < stops.length - 2 && value > stops[i + 1]) i++;
  const t = Math.max(
    0,
    Math.min(1, (value - stops[i]) / (stops[i + 1] - stops[i])),
  );
  const rgb = (h: string) =>
    [1, 3, 5].map((n) => parseInt(h.slice(n, n + 2), 16));
  const a = palette[i],
    b = palette[i + 1];
  return a.map((x, j) => Math.round(x + (b[j] - x) * t));
}
// Nonoverlapping Mercator tiles; at most 262,144 pixels per job. No global-image stretching.
export function renderField(
  data: CorridorDataset,
  routes: RouteCandidate[],
  layer: ForecastLayer,
  frame: number,
  geometry?: GeometryCache,
): Tile[] {
  const R = 6371008.8,
    world = 2 * Math.PI * R,
    width = data.grid.width_miles * 1609.344;
  if (!width || !routes.length) return [];
  const samples = data.grid.samples.map((s) => [
    s.coordinate.longitude,
    s.coordinate.latitude,
  ]);
  const segments = routes.flatMap((r, route) =>
    r.geometry.coordinates
      .slice(1)
      .map((b, i) => ({
        a: r.geometry.coordinates[i],
        b,
        route,
        index: i,
        length: angular(r.geometry.coordinates[i], b),
        bearing: bearing(r.geometry.coordinates[i], b),
      })),
  );
  const supported = samples.filter((p) => Math.abs(p[1]) <= 85);
  if (!supported.length) return [];
  const latitude =
    supported.reduce((s, p) => s + Math.abs(p[1]), 0) / supported.length;
  let z = Math.max(
    0,
    Math.min(
      18,
      Math.round(
        Math.log2(world / ((width * 4) / Math.cos((latitude * Math.PI) / 180))),
      ),
    ),
  );
  let span = world / 2 ** z;
  const keys = new Set<string>();
  do {
    keys.clear();
    span = world / 2 ** z;
    for (const p of supported) {
      const [x, y] = mercator(p);
      keys.add(
        `${Math.floor((x + world / 2) / span)},${Math.floor((y + world / 2) / span)}`,
      );
    }
    // Include adjacent tiles for support near tile edges; never silently truncate coverage.
    for (const key of [...keys]) {
      const [x, y] = key.split(",").map(Number);
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++) {
          const n = 2 ** z,
            yy = y + b;
          if (yy >= 0 && yy < n) keys.add(`${(((x + a) % n) + n) % n},${yy}`);
        }
    }
    if (keys.size <= 16) break;
    z--;
  } while (z >= 2);
  if (keys.size > 16)
    throw Error(
      "Corridor exceeds the bounded overlay extent. Sample values remain available.",
    );
  const nearestSegment = (p: number[]) => {
    let best = 0,
      d = Infinity;
    segments.forEach((s, i) => {
      const n = distanceToArc(p, s.a, s.b, s);
      if (n < d) {
        d = n;
        best = i;
      }
    });
    return { segment: segments[best], distance: d };
  };
  const support = samples.map(nearestSegment),
    radius =
      Math.hypot(
        data.grid.along_spacing_meters,
        data.grid.cross_spacing_meters,
      ) * 1.5;
  const tiles: Tile[] = [];
  for (const key of keys) {
    const [tx, ty] = key.split(",").map(Number),
      left = tx * span - world / 2,
      bottom = ty * span - world / 2;
    if (
      left < -world / 2 ||
      left + span > world / 2 ||
      bottom < -world / 2 ||
      bottom + span > world / 2
    )
      continue;
    const pixels = new Uint8ClampedArray(128 * 128 * 4);
    const cached = geometry?.[key];
    const records = cached ?? new Array(128 * 128).fill(null);
    if (geometry) geometry[key] = records;
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        let distance: number, neighbors: { i: number; distance: number }[];
        if (cached) {
          const record = cached[y * 128 + x];
          if (!record) continue;
          distance = record.distance;
          neighbors = record.neighbors;
        } else {
          const p = geographic(
            left + ((x + 0.5) * span) / 128,
            bottom + ((127.5 - y) * span) / 128,
          );
          if (Math.abs(p[1]) > 85) continue;
          const near = nearestSegment(p);
          if (near.distance >= width) continue;
          // Reject unsupported branches/latitude bands before expensive spherical distances.
          const candidates: { i: number; distance: number }[] = [];
          for (let i = 0; i < samples.length; i++) {
            const q = samples[i],
              segment = support[i].segment;
            if (
              Math.abs(q[1]) > 85 ||
              !segment ||
              !near.segment ||
              segment.route !== near.segment.route ||
              Math.abs(segment.index - near.segment.index) > 1 ||
              ((Math.abs(q[1] - p[1]) * Math.PI) / 180) * R > radius
            )
              continue;
            const distance = angular(p, q) * R;
            if (distance > radius) continue;
            let position = 0;
            while (
              position < candidates.length &&
              candidates[position].distance <= distance
            )
              position++;
            if (position < 6) {
              candidates.splice(position, 0, { i, distance });
              if (candidates.length > 6) candidates.pop();
            }
          }

          distance = near.distance;
          neighbors = candidates;
          records[y * 128 + x] = { distance, neighbors };
        }
        if (
          !neighbors.length ||
          layerMissing(data, layer, neighbors[0].i, frame)
        )
          continue;
        const valid = neighbors.filter(
          (n) => !layerMissing(data, layer, n.i, frame),
        );
        if (!valid.length) continue;
        let rgb: number[],
          alpha = Math.min(1, (width - distance) / (width * 0.15)) * 185;
        const absent = neighbors.find((n) =>
          layerMissing(data, layer, n.i, frame),
        );
        if (absent)
          alpha *= Math.max(
            0,
            Math.min(
              1,
              (absent.distance - neighbors[0].distance) / (radius * 0.1),
            ),
          );
        if (layer === "risk") {
          const categories = valid.map(
            (n) => data.risk_categories?.[n.i]?.[frame] ?? "unknown",
          );
          if (categories.includes("unknown")) continue;
          const category = conservativeRisk(
            categories,
          ) as keyof typeof riskColors;
          const hex = riskColors[category];
          rgb = [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16));
        } else {
          const values = valid
            .filter((n) => data.values[layer][n.i]?.[frame] != null)
            .map((n) => ({
              distance: n.distance,
              value: data.values[layer][n.i][frame]!,
            }));
          if (!values.length) continue;
          const value = interpolate(values);
          rgb = color(value, layer);
          if (layer !== "wind_mph")
            alpha *= Math.min(1, value / limits[layer][0]);
        }
        const offset = (y * 128 + x) * 4;
        pixels.set([...rgb, Math.round(alpha)], offset);
      }
    tiles.push({
      pixels,
      coordinates: [
        geographic(left, bottom + span),
        geographic(left + span, bottom + span),
        geographic(left + span, bottom),
        geographic(left, bottom),
      ],
    });
  }
  return tiles;
}
