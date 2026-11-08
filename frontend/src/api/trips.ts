import { request } from "./client";
import type { TripCreate, TripResponse, Analysis } from "./contracts";
export const createTrip = (body: TripCreate) =>
  request<TripResponse>("/trips/", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const readAnalysis = (id: string, signal: AbortSignal) =>
  request<Analysis>(`/trips/${encodeURIComponent(id)}/analysis/`, { signal });
