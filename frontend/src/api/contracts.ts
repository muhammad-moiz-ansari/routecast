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
  data: Record<string, unknown> | null;
}
export interface ApiFailure {
  code: string;
  message: string;
  request_id?: string;
  retry_after_seconds?: number;
  field_errors?: { field: string; message: string }[];
}
