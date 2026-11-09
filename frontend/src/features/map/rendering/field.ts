import type {
  CorridorDataset,
  ForecastLayer,
  RouteCandidate,
} from "../../../api/contracts";
import {
  angular,
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
  const a = rgb(scalarColors[i]),
    b = rgb(scalarColors[i + 1]);
  return a.map((x, j) => Math.round(x + (b[j] - x) * t));
}
// Nonoverlapping Mercator tiles; at most 1,048,576 pixels per job. No global-image stretching.
export function renderField(
  data: CorridorDataset,
  routes: RouteCandidate[],
  layer: ForecastLayer,
  frame: number,
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
      .map((b, i) => ({ a: r.geometry.coordinates[i], b, route, index: i })),
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
      const n = distanceToArc(p, s.a, s.b);
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
    const pixels = new Uint8ClampedArray(256 * 256 * 4);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const p = geographic(
          left + ((x + 0.5) * span) / 256,
          bottom + ((255.5 - y) * span) / 256,
        );
        if (Math.abs(p[1]) > 85) continue;
        const near = nearestSegment(p);
        if (near.distance >= width) continue;
        const neighbors = samples
          .map((q, i) => ({ i, distance: angular(p, q) * R }))
          .filter(
            (n) =>
              Math.abs(samples[n.i][1]) <= 85 &&
              n.distance <= radius &&
              support[n.i].segment?.route === near.segment?.route &&
              Math.abs(support[n.i].segment.index - near.segment.index) <= 1,
          )
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 6);
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
          alpha = Math.min(1, (width - near.distance) / (width * 0.15)) * 185;
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
        const offset = (y * 256 + x) * 4;
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
