import { useEffect, useRef, useState } from "react";
import {
  Clock3,
  Database,
  Package,
  Route,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { ApiError } from "../../../api/client";
import type { SuggestionKind, SuggestionResult } from "../../../api/contracts";
import { requestSuggestions } from "../../../api/suggestions";
import { atTime } from "../presentation";
const icons: Record<SuggestionKind, typeof Route> = {
  route: Route,
  timing: Clock3,
  cargo: Package,
  caution: TriangleAlert,
  data: Database,
};
function failure(e: unknown) {
  if (!(e instanceof ApiError))
    return e instanceof Error ? e.message : "Suggestions could not be loaded.";
  const { code, retry_after_seconds: wait } = e.detail;
  if (code === "ai_not_configured")
    return "AI suggestions aren't set up on this server.";
  if (code === "provider_budget_exhausted" || code === "ai_rate_limit")
    return wait && wait <= 7200
      ? `The AI allowance is used up. Try again in about ${Math.ceil(wait / 60)} min.`
      : "The AI allowance is used up. Try again later.";
  return e.detail.message;
}
/** Advisory text only: it never changes the backend recommendation, ranking or eligibility. */
export function SuggestionsBox({
  tripId,
  analysisVersion,
  zone,
}: {
  tripId: string;
  analysisVersion: number;
  zone: string;
}) {
  const [result, setResult] = useState<SuggestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef(`${tripId}:${analysisVersion}`);
  // Each analysis version needs its own suggestions; late responses for an old one are dropped.
  useEffect(() => {
    current.current = `${tripId}:${analysisVersion}`;
    setResult(null);
    setError(null);
    setBusy(false);
  }, [tripId, analysisVersion]);
  async function load() {
    const key = current.current;
    setBusy(true);
    setError(null);
    try {
      const next = await requestSuggestions(tripId);
      if (current.current !== key) return;
      if (next.analysis_version === analysisVersion) setResult(next);
      else setError("The analysis changed. Request suggestions again.");
    } catch (e) {
      if (current.current === key) setError(failure(e));
    } finally {
      if (current.current === key) setBusy(false);
    }
  }
  return (
    <section className="ai-suggestions" aria-labelledby="ai-suggestions-title">
      <div className="ai-suggestions-heading">
        <Sparkles aria-hidden="true" size={15} />
        <h3 id="ai-suggestions-title">AI suggestions</h3>
      </div>
      <div aria-live="polite">
        {result ? (
          <ul>
            {result.suggestions.map((s, i) => {
              const Icon = icons[s.kind];
              return (
                <li key={i}>
                  <Icon aria-hidden="true" size={14} />
                  <span>{s.text}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ai-suggestions-note">
            Get a few plain-language tips about this assessment.
          </p>
        )}
      </div>
      {error && (
        <p className="state-warning" role="alert">
          {error}
        </p>
      )}
      {result ? (
        <p className="ai-suggestions-note">
          Generated {atTime(result.generated_at, zone)} for analysis{" "}
          {result.analysis_version}. AI-generated and may be wrong; the ranking
          above comes from RouteCast's rules.
        </p>
      ) : (
        <button type="button" onClick={load} disabled={busy}>
          {busy ? "Getting suggestions…" : "Get suggestions"}
        </button>
      )}
    </section>
  );
}
