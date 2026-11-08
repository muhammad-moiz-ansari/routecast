import type { Analysis, RiskCategory } from "../../api/contracts";
export const riskOrder: RiskCategory[] = [
  "low",
  "moderate",
  "high",
  "severe",
  "no_travel",
  "unknown",
];
export const riskLabels: Record<RiskCategory, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
  no_travel: "No Travel",
  unknown: "Unknown",
};
export const riskSymbols: Record<RiskCategory, string> = {
  low: "L",
  moderate: "M",
  high: "H",
  severe: "!",
  no_travel: "×",
  unknown: "?",
};
export function currentRecommendation(analysis: Analysis): string | null {
  const data = analysis.data;
  // Frozen assessments retain historical flags; outer freshness/revision governs current claims.
  if (
    !data ||
    analysis.routing_stale ||
    analysis.weather_stale ||
    analysis.retained_previous ||
    analysis.analysis_revision !== analysis.input_revision ||
    data.recommendation.state !== "RECOMMENDED"
  )
    return null;
  const id = data.recommendation.recommended_route_id;
  return data.recommendation.routes.some((r) => r.route_id === id && r.eligible)
    ? id
    : null;
}
export const miles = (meters: number) =>
  (meters / 1609.344).toLocaleString(undefined, { maximumFractionDigits: 1 });
export const quantity = (value: number | null | undefined, unit: string) =>
  value == null
    ? "Unavailable"
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
export function atTime(value: string | null | undefined, zone: string) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: zone,
      }).format(new Date(value))
    : "Unavailable";
}
export function duration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}
