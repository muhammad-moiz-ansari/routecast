import { request } from "./client";
import type {
  TripCreate,
  TripResponse,
  Analysis,
  RouteOptions,
  RefreshResult,
} from "./contracts";
export const createTrip = (body: TripCreate) =>
  request<TripResponse>("/trips/", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const readAnalysis = (id: string, signal: AbortSignal) =>
  request<Analysis>(`/trips/${encodeURIComponent(id)}/analysis/`, { signal });

export const readRoutes = (id: string, signal: AbortSignal) =>
  request<RouteOptions>(`/trips/${encodeURIComponent(id)}/routes/`, { signal });

export const refreshTrip = (id: string) =>
  request<RefreshResult>(`/trips/${encodeURIComponent(id)}/refresh/`, {
    method: "POST",
  });
export const stopTrip = (id: string) =>
  request<RefreshResult>(`/trips/${encodeURIComponent(id)}/stop/`, {
    method: "POST",
  });
export const heartbeat = (id: string, signal: AbortSignal) =>
  request<{ status: string }>(`/trips/${encodeURIComponent(id)}/heartbeat/`, {
    method: "POST",
    signal,
  });
