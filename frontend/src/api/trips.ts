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

export const readTrip = (id: string, signal: AbortSignal) =>
  request<TripResponse>(`/trips/${encodeURIComponent(id)}/`, { signal });

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

export type SavedTrip = {
  id: string;
  title: string;
  saved_at: string;
  departure_at: string;
  timezone: string;
  status: string;
};
export type SavedTripPage = { items: SavedTrip[]; next_offset: number | null };

/** Bookmark stored results; saving never starts another analysis. */
export const saveTrip = (id: string, title: string) =>
  request<SavedTrip>(`/trips/${encodeURIComponent(id)}/save/`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });

export const readSavedTrips = (offset: number, signal: AbortSignal) =>
  request<SavedTripPage>(`/trips/saved/?limit=20&offset=${offset}`, { signal });
