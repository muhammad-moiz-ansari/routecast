import { request } from "./client";
import type {
  TripCreate,
  TripResponse,
  Analysis,
  RouteOptions,
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
