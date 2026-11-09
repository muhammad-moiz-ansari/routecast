import { expect, it } from "vitest";
import { indexArcs } from "../features/map/rendering/arcIndex";
import {
  angular,
  bearing,
  distanceToArc,
} from "../features/map/utils/corridorField";

it("matches exhaustive nearest arcs on dense routes, ties, bends and dateline crossings", () => {
  const points = Array.from({ length: 1025 }, (_, i) => [
    179 + i / 256,
    30 + Math.sin(i / 40) * 0.15,
  ]);
  const arcs = points
    .slice(1)
    .map((b, i) => ({
      a: points[i],
      b,
      length: angular(points[i], b),
      bearing: bearing(points[i], b),
    }));
  // Duplicate segments must keep original-index tie behavior after near-first traversal.
  arcs.push(...arcs.slice(500, 520));
  const indexed = indexArcs(arcs);
  const queries = Array.from({ length: 100 }, (_, i) => [
    ((178.5 + i * 0.055 + 180) % 360) - 180,
    29.7 + (i % 9) / 15,
  ]).concat([points[0], points[512], points[1024]]);
  for (const point of queries) {
    const distances = arcs.map((a) => distanceToArc(point, a.a, a.b, a));
    const distance = Math.min(...distances);
    expect(indexed(point)).toEqual({
      index: distances.indexOf(distance),
      distance,
    });
  }
});
