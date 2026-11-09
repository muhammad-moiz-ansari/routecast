export interface Coordinate {
  latitude: number;
  longitude: number;
}
export interface LocationOption {
  id: string;
  label: string;
  coordinate: Coordinate;
}
export interface TripCreate {
  origin: Coordinate;
  destination: Coordinate;
  departure_at: string;
  timezone: string;
  cargo_load_lb: number;
  checkpoint_spacing_miles: 10 | 25 | 50;
}
export interface TripResponse extends TripCreate {
  id: string;
  analysis_id: string | null;
  status: string;
  input_revision: number;
  analysis_version: number;
  error_code: string | null;
}
export interface Analysis {
  trip_id: string;
  input_revision: number;
  analysis_id: string | null;
  analysis_version: number | null;
  analysis_revision: number | null;
  status: string;
  stage: string;
  stopped: boolean;
  error_code: string | null;
  completed_at: string | null;
  routing_stale: boolean;
  weather_stale: boolean;
  retained_previous: boolean;
  data: AnalysisSnapshot | null;
}
export interface ApiFailure {
  code: string;
  message: string;
  request_id?: string;
  retry_after_seconds?: number;
  field_errors?: { field: string; message: string }[];
}

export type RiskCategory =
  "low" | "moderate" | "high" | "severe" | "no_travel" | "unknown";
export interface RouteCandidate {
  id: string;
  label: string;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance_meters: number;
  duration_seconds: number;
  arrival_at: string;
  timing_points: {
    distance_meters: number;
    cumulative_travel_seconds: number;
  }[];
  timing_notice: string | null;
}
export interface RouteOptions {
  provider: string;
  fetched_at: string;
  analysis_version: number;
  available_route_count: number;
  routes: RouteCandidate[];
  notices: string[];
}
export interface Checkpoint {
  id: string;
  coordinate: Coordinate;
  distance_miles: number;
  distance_meters: number;
  cumulative_travel_seconds: number;
  arrival_at: string;
}
export interface CheckpointResult {
  route_id: string;
  analysis_version: number;
  spacing_miles: number;
  route_distance_meters: number;
  polyline_length_meters: number;
  distance_method: string;
  eta_method: string;
  timing_notice: string | null;
  checkpoints: Checkpoint[];
  intervals: {
    start_checkpoint_id: string;
    end_checkpoint_id: string;
    distance_meters: number;
    distance_miles: number;
  }[];
}
export interface RiskReason {
  code: string;
  observed_value: number;
  threshold: string;
  units: string;
  cargo_load_lb: number | null;
  message: string;
}
export interface CheckpointRisk {
  checkpoint_id: string;
  category: RiskCategory;
  coverage_complete: boolean;
  fresh: boolean;
  reasons: RiskReason[];
}
export interface RouteRiskSummary {
  route_id: string;
  analysis_version: number;
  rules_version: string;
  duration_seconds: number;
  total_miles: number;
  checkpoints: CheckpointRisk[];
  intervals: {
    start_checkpoint_id: string;
    end_checkpoint_id: string;
    distance_miles: number;
    category: RiskCategory;
    coverage_complete: boolean;
  }[];
  miles_by_category: Partial<Record<RiskCategory, number>>;
  unassessed_miles: number;
  average_risk: number | null;
  eligible: boolean;
  eligibility_reasons: string[];
}
export interface CheckpointWeather {
  route_id: string;
  checkpoint_id: string;
  arrival_at: string;
  fetched_at: string | null;
  interval_start: string | null;
  interval_end: string | null;
  wind_times: string[];
  wind_mph: number | null;
  rain_inches_per_hour: number | null;
  snow_inches_per_hour: number | null;
  coverage: string;
  freshness: string;
}
export interface Recommendation {
  state: "RECOMMENDED" | "NO_ELIGIBLE_ROUTE" | "INCOMPLETE_DATA" | "PENDING";
  analysis_version: number;
  rules_version: string;
  recommended_route_id: string | null;
  ranked_route_ids: string[];
  routes: RouteRiskSummary[];
  explanation: { code: string; message: string };
  notices: string[];
  stale: boolean;
  retained_previous: boolean;
  previous_recommended_route_id: string | null;
}
export interface AnalysisSnapshot {
  inputs: TripCreate;
  routes: RouteOptions;
  checkpoints: Record<string, CheckpointResult>;
  weather: {
    analysis_versions: Record<string, number>;
    checkpoints: CheckpointWeather[];
    provider_requests: number;
    unique_locations_requested: number;
    estimated_usage_units: number;
  };
  recommendation: Recommendation;
  routing_fetched_at: string;
  weather_fetched_at: string | null;
}

export interface RefreshResult {
  analysis_id: string | null;
  coalesced: boolean;
  retry_after_seconds: number | null;
  stopped: boolean;
}
export type ScalarLayer =
  "wind_mph" | "rain_inches_per_hour" | "snow_inches_per_hour";
export type ForecastLayer = ScalarLayer | "risk";
export interface CorridorDataset {
  dataset_id: string;
  analysis_version: number;
  anchor_at: string;
  fetched_at: string | null;
  timestamps: string[];
  grid: {
    samples: { id: string; coordinate: Coordinate }[];
    width_miles: number;
    along_spacing_meters: number;
    cross_spacing_meters: number;
    sample_cap: number;
    method: string;
  };
  values: Record<ScalarLayer, (number | null)[][]>;
  missing: Record<ScalarLayer, boolean[][]>;
  units: Record<ScalarLayer, string>;
  coverage: string;
  notices: string[];
  risk_categories?: RiskCategory[][];
  rules_version?: string;
}
export type SuggestionKind = "route" | "timing" | "cargo" | "caution" | "data";
export interface SuggestionResult {
  analysis_version: number;
  generated_at: string;
  model: string;
  cached: boolean;
  suggestions: { kind: SuggestionKind; text: string }[];
}
export interface CorridorProjection {
  status: string;
  analysis_version: number | null;
  error_code: string | null;
  data: CorridorDataset | null;
  stopped: boolean;
  stale: boolean;
}
