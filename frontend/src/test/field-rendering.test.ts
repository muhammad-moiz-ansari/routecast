import { expect, it } from "vitest";
import {
  color,
  interpolate,
  renderField,
} from "../features/map/rendering/field";
import raw from "./fixtures/corridor.json";
import analysis from "./fixtures/comparison.json";
import type { CorridorDataset, RouteCandidate } from "../api/contracts";
it("paints between samples across hundreds of small road segments without filling missing regions", async () => {
  const { mercator } = await import("../features/map/utils/corridorField");
  const data = structuredClone(raw.data) as unknown as CorridorDataset;
  data.grid = {
    ...data.grid,
    width_miles: 2,
    along_spacing_meters: 5000,
    cross_spacing_meters: 1000,
    samples: [0.02, 0.05, 0.08].map((longitude, i) => ({
      id: String(i),
      coordinate: { longitude, latitude: 0 },
    })),
  };
  data.values.wind_mph = [[18], [18], [18]];
  data.missing.wind_mph = [[false], [false], [false]];
  const routes = structuredClone(
    analysis.data.routes.routes.slice(0, 1),
  ) as unknown as RouteCandidate[];
  routes[0].geometry.coordinates = Array.from({ length: 1001 }, (_, i) => [
    i / 10000,
    0,
  ]);
  const alpha = (tiles: ReturnType<typeof renderField>, longitude: number) => {
    const p = mercator([longitude, 0.001]);
    for (const tile of tiles) {
      const a = mercator(tile.coordinates[0]),
        b = mercator(tile.coordinates[2]);
      if (p[0] >= a[0] && p[0] < b[0] && p[1] <= a[1] && p[1] > b[1]) {
        const x = Math.floor(((p[0] - a[0]) / (b[0] - a[0])) * 128);
        const y = Math.floor(((a[1] - p[1]) / (a[1] - b[1])) * 128);
        return tile.pixels[(y * 128 + x) * 4 + 3];
      }
    }
    return 0;
  };
  const geometry = {};
  const valid = renderField(data, routes, "wind_mph", 0, geometry);
  for (const longitude of [0.025, 0.035, 0.045, 0.055, 0.065, 0.075])
    expect(alpha(valid, longitude)).toBeGreaterThan(0);
  data.missing.wind_mph[1][0] = true;
  expect(alpha(renderField(data, routes, "wind_mph", 0, geometry), 0.05)).toBe(0);
});
it("recovers exact values and bounds normalized interpolation without additive overlap", () => {
  expect(
    interpolate([
      { distance: 0, value: 12 },
      { distance: 10, value: 40 },
    ]),
  ).toBe(12);
  const values = [
    { distance: 10, value: 10 },
    { distance: 20, value: 30 },
  ];
  expect(interpolate(values)).toBeGreaterThanOrEqual(10);
  expect(interpolate(values)).toBeLessThanOrEqual(30);
  expect(interpolate([...values, ...values])).toBeCloseTo(interpolate(values));
  expect(color(35, "wind_mph")).toEqual(color(35, "wind_mph"));
});
it("keeps missing support transparent in bounded dateline-safe tiles", () => {
  const data = structuredClone(raw.data) as unknown as CorridorDataset;
  const routes = analysis.data.routes.routes as unknown as RouteCandidate[];
  for (const layer of Object.keys(
    data.missing,
  ) as (keyof typeof data.missing)[])
    data.missing[layer] = data.missing[layer].map((row) => row.map(() => true));
  const tiles = renderField(data, routes, "wind_mph", 0);
  expect(tiles.length).toBeLessThanOrEqual(16);
  expect(tiles.every((t) => t.pixels.every((x) => x === 0))).toBe(true);
  expect(
    tiles.every(
      (t) => Math.abs(t.coordinates[1][0] - t.coordinates[0][0]) < 180,
    ),
  ).toBe(true);
});
it("never averages down categorical hazards", async () => {
  const { conservativeRisk } = await import("../features/map/rendering/field");
  expect(conservativeRisk(["low", "no_travel", "severe"])).toBe("no_travel");
  expect(conservativeRisk(["low", "severe"])).toBe("severe");
  expect(conservativeRisk(["low", "unknown"])).toBe("unknown");
});
it("splits dateline support into bounded tiles rather than a world-spanning image", () => {
  const d = structuredClone(raw.data) as unknown as CorridorDataset;
  d.grid.samples = d.grid.samples
    .slice(0, 2)
    .map((s, i) => ({
      ...s,
      coordinate: { latitude: 30, longitude: i ? -179.9 : 179.9 },
    }));
  for (const layer of Object.keys(d.missing) as (keyof typeof d.missing)[])
    d.missing[layer] = d.missing[layer].map((row) => row.map(() => true));
  const r = structuredClone(
    analysis.data.routes.routes.slice(0, 1),
  ) as unknown as RouteCandidate[];
  r[0].geometry.coordinates = [
    [179.9, 30],
    [-179.9, 30],
  ];
  const tiles = renderField(d, r, "wind_mph", 0);
  expect(tiles.length).toBeGreaterThan(0);
  expect(tiles.length).toBeLessThanOrEqual(16);
  expect(
    tiles.every((t) => t.coordinates[1][0] - t.coordinates[0][0] < 2),
  ).toBe(true);
});
it("preserves a missing hole surrounded by valid samples and gives outside pixels zero alpha", async () => {
  const { mercator } = await import("../features/map/utils/corridorField");
  const d = structuredClone(raw.data) as unknown as CorridorDataset;
  d.grid = {
    ...d.grid,
    width_miles: 2,
    along_spacing_meters: 10000,
    cross_spacing_meters: 1000,
    samples: [0.02, 0.05, 0.08].map((longitude, i) => ({
      id: String(i),
      coordinate: { longitude, latitude: 0 },
    })),
  };
  d.values.wind_mph = [0, 1, 2].map(() => [18]);
  d.missing.wind_mph = [[false], [true], [false]];
  const routes = structuredClone(
    analysis.data.routes.routes.slice(0, 1),
  ) as unknown as RouteCandidate[];
  routes[0].geometry.coordinates = [
    [0, 0],
    [0.1, 0],
  ];
  const tiles = renderField(d, routes, "wind_mph", 0);
  const alpha = (p: number[]) => {
    const q = mercator(p);
    for (const t of tiles) {
      const a = mercator(t.coordinates[0]),
        b = mercator(t.coordinates[2]);
      if (q[0] >= a[0] && q[0] < b[0] && q[1] <= a[1] && q[1] > b[1]) {
        const x = Math.floor(((q[0] - a[0]) / (b[0] - a[0])) * 128),
          y = Math.floor(((a[1] - q[1]) / (a[1] - b[1])) * 128);
        return t.pixels[(y * 128 + x) * 4 + 3];
      }
    }
    return 0;
  };
  expect(alpha([0.02, 0.001])).toBeGreaterThan(0);
  expect(alpha([0.05, 0.001])).toBe(0);
  expect(alpha([0.05, 0.04])).toBe(0);
  d.values.rain_inches_per_hour = [0, 1, 2].map(() => [0]);
  d.missing.rain_inches_per_hour = [0, 1, 2].map(() => [false]);
  expect(
    renderField(d, routes, "rain_inches_per_hour", 0).every((t) =>
      t.pixels.every((v, i) => i % 4 !== 3 || v === 0),
    ),
  ).toBe(true);
});
