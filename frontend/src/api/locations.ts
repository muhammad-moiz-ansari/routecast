import { request } from "./client";
import type { LocationOption } from "./contracts";
export const searchLocations = (query: string, signal: AbortSignal) =>
  request<LocationOption[]>(
    "/locations/search/?" + new URLSearchParams({ query, limit: "5" }),
    { signal },
  );
