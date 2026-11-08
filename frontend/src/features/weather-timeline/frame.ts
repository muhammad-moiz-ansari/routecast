import type {
  Analysis,
  CorridorDataset,
  CorridorProjection,
  ForecastLayer,
} from "../../api/contracts";
export const layerNames: Record<ForecastLayer, string> = {
  wind_mph: "Wind",
  rain_inches_per_hour: "Rain",
  snow_inches_per_hour: "Snow",
  risk: "Combined risk",
};
export const scalarColors = [
  "#215c91",
  "#287e8e",
  "#997000",
  "#b04f14",
  "#a62c47",
];
export const riskColors = {
  low: "#17633b",
  moderate: "#825100",
  high: "#a5430a",
  severe: "#b91c1c",
  no_travel: "#592c75",
  unknown: "#52636c",
};
export const limits = {
  wind_mph: [25, 35, 45, 55],
  rain_inches_per_hour: [0.1, 0.25, 0.5, 1],
  snow_inches_per_hour: [0.5, 1, 2, 3],
};
export function aligned(
  analysis: Analysis,
  corridor: CorridorProjection | undefined,
) {
  return (
    !!corridor?.data &&
    corridor.analysis_version === analysis.analysis_version &&
    corridor.data.analysis_version === analysis.analysis_version &&
    analysis.analysis_revision === analysis.input_revision
  );
}
export function frameIndex(timestamps: string[], absolute: string | null) {
  if (!absolute) return 0;
  const exact = timestamps.indexOf(absolute);
  if (exact >= 0) return exact;
  let best = 0;
  for (let i = 1; i < timestamps.length; i++)
    if (
      Math.abs(Date.parse(timestamps[i]) - Date.parse(absolute)) <
      Math.abs(Date.parse(timestamps[best]) - Date.parse(absolute))
    )
      best = i;
  return best;
}

export function layerMissing(
  data: CorridorDataset,
  layer: ForecastLayer,
  sample: number,
  frame: number,
) {
  return layer === "risk"
    ? Object.values(data.missing).some(
        (rows) => rows[sample]?.[frame] !== false,
      )
    : data.missing[layer]?.[sample]?.[frame] !== false;
}
