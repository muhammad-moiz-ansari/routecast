import { it, expect } from "vitest";
import {
  renderField,
  type GeometryCache,
} from "../features/map/rendering/field";
import raw from "./fixtures/corridor.json";
import analysis from "./fixtures/comparison.json";
it("reuses geometry across hours without changing pixels or missing masks", () => {
  const geometry: GeometryCache = {};
  let t = performance.now();
  renderField(
    raw.data as any,
    analysis.data.routes.routes as any,
    "wind_mph",
    0,
    geometry,
  );
  const cold = performance.now() - t;
  t = performance.now();
  const warm = renderField(
    raw.data as any,
    analysis.data.routes.routes as any,
    "wind_mph",
    1,
    geometry,
  );
  const warmMs = performance.now() - t;
  const direct = renderField(
    raw.data as any,
    analysis.data.routes.routes as any,
    "wind_mph",
    1,
  );
  expect(warm).toEqual(direct);
  expect(Object.keys(geometry).length).toBeLessThanOrEqual(16);
});
