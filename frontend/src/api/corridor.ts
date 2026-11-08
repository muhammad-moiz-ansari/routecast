import { request } from "./client";
import type { CorridorProjection } from "./contracts";
export const readCorridor = (id: string, signal: AbortSignal) =>
  request<CorridorProjection>(`/trips/${encodeURIComponent(id)}/corridor/`, {
    signal,
  });
