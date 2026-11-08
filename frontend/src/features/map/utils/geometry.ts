import type { FeatureCollection, LineString, Point } from "geojson";
import type {
  Checkpoint,
  CheckpointRisk,
  RouteCandidate,
  RouteRiskSummary,
} from "../../../api/contracts";
export const routeColors = ["#1457c5", "#7939ad", "#08786d"];
export const routeIndex = (id: string, fallback = 0) =>
  ({ A: 0, B: 1, C: 2 })[id] ?? fallback % 3;
export function routeFeatures(
  routes: RouteCandidate[],
  selectedId: string | null,
  risks: RouteRiskSummary[] = [],
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: routes.map((r, i) => ({
      type: "Feature",
      properties: {
        id: r.id,
        color: routeColors[routeIndex(r.id, i)],
        selected: r.id === selectedId,
        treatment: risks
          .find((s) => s.route_id === r.id)
          ?.eligibility_reasons.includes("no_travel")
          ? "blocked"
          : !risks.find((s) => s.route_id === r.id)?.eligible
            ? "unknown"
            : "assessed",
      },
      geometry: r.geometry,
    })),
  };
}
export function pointFeatures(
  points: Checkpoint[],
  risks: CheckpointRisk[],
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      properties: {
        id: p.id,
        icon:
          risks.find((r) => r.checkpoint_id === p.id)?.category ?? "unknown",
      },
      geometry: {
        type: "Point",
        coordinates: [p.coordinate.longitude, p.coordinate.latitude],
      },
    })),
  };
}
export function routeBounds(
  routes: RouteCandidate[],
): [[number, number], [number, number]] | null {
  const positions = routes.flatMap((r) => r.geometry.coordinates);
  if (!positions.length) return null;
  // Unwrap longitude around the first point so dateline trips fit their short geographic span.
  const anchor = positions[0][0];
  const values = positions.map(([lon, lat]) => [
    anchor + ((lon - anchor + 540) % 360) - 180,
    lat,
  ]);
  let west = Infinity,
    east = -Infinity,
    south = Infinity,
    north = -Infinity;
  for (const [lon, lat] of values) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

export function labelFeatures(
  routes: RouteCandidate[],
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: routes.map((r) => ({
      type: "Feature",
      properties: { icon: `route-${r.id}` },
      geometry: {
        type: "Point",
        coordinates:
          r.geometry.coordinates[
            Math.min(1, r.geometry.coordinates.length - 1)
          ],
      },
    })),
  };
}
