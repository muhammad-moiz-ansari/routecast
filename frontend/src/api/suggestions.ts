import { request } from "./client";
import type { SuggestionResult } from "./contracts";
export const requestSuggestions = (id: string) =>
  request<SuggestionResult>(`/trips/${encodeURIComponent(id)}/suggestions/`, {
    method: "POST",
  });
