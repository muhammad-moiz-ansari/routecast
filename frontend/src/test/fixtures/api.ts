import storedAnalysis from "./comparison.json";
import storedCorridor from "./corridor.json";
let version = 1;
let refreshPending = 0;
let stopped = false;
export async function fixtureFetch(
  path: string,
  init: RequestInit,
): Promise<Response> {
  if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (path === "/session/")
    return Response.json({ csrf_token: "synthetic-token" });
  if (path.startsWith("/locations/search/")) {
    const q = new URLSearchParams(path.split("?")[1]).get("query") ?? "";
    return Response.json([
      {
        id: q,
        label: q + " · Synthetic location",
        coordinate: {
          latitude: q.toLowerCase().startsWith("b") ? 31 : 30,
          longitude: 70,
        },
      },
    ]);
  }
  if (path === "/trips/" && init.method === "POST")
    return Response.json(
      {
        ...JSON.parse(String(init.body)),
        id: "preview-trip",
        analysis_id: "preview-analysis",
        status: "queued",
        input_revision: 1,
        analysis_version: 0,
        error_code: null,
      },
      { status: 202 },
    );
  if (path.endsWith("/heartbeat/")) return Response.json({ status: "ok" });
  if (path.endsWith("/refresh/")) {
    if (
      new URLSearchParams(window.location.search).get("fixture") === "cooldown"
    )
      return Response.json(
        {
          code: "refresh_cooldown",
          message: "Wait before refreshing again.",
          retry_after_seconds: 30,
        },
        { status: 429 },
      );
    refreshPending = 1;
    return Response.json(
      {
        analysis_id: `preview-analysis-${version + 1}`,
        coalesced: false,
        retry_after_seconds: null,
        stopped: false,
      },
      { status: 202 },
    );
  }
  if (path.endsWith("/stop/")) {
    stopped = true;
    return Response.json({
      analysis_id: null,
      coalesced: false,
      retry_after_seconds: null,
      stopped: true,
    });
  }
  if (path.endsWith("/corridor/")) {
    const result = structuredClone(storedCorridor);
    result.stopped = stopped;
    result.stale = refreshPending > 0;
    result.analysis_version = version;
    result.data.analysis_version = version;
    result.data.dataset_id = `synthetic-corridor-${version}`;
    result.data.timestamps = result.data.timestamps.map((t) =>
      new Date(Date.parse(t) + (version - 1) * 3600000).toISOString(),
    );
    result.data.anchor_at = result.data.timestamps[0];
    return Response.json(result);
  }
  if (path.includes("/analysis/")) {
    const analysis = structuredClone(storedAnalysis);
    if (refreshPending === 2) {
      version++;
      refreshPending = 0;
    } else if (refreshPending === 1) {
      refreshPending = 2;
      analysis.status = "running";
      analysis.stage = "weather";
      analysis.retained_previous = true;
    }
    analysis.analysis_version = version;
    analysis.data.routes.analysis_version = version;
    analysis.data.recommendation.analysis_version = version;
    for (const cp of Object.values(analysis.data.checkpoints))
      cp.analysis_version = version;
    for (const key of Object.keys(analysis.data.weather.analysis_versions))
      (analysis.data.weather.analysis_versions as Record<string, number>)[key] =
        version;
    analysis.stopped = stopped;
    if (stopped) analysis.status = "stopped";
    const scenario = new URLSearchParams(window.location.search).get("fixture");
    if (scenario === "stale") {
      analysis.routing_stale = true;
      analysis.weather_stale = true;
      analysis.retained_previous = true;
      analysis.status = "running";
      analysis.stage = "weather";
    }
    if (scenario === "partial") {
      analysis.data.routes.routes = analysis.data.routes.routes.slice(0, 2);
      analysis.data.routes.available_route_count = 2;
      analysis.data.routes.notices.push(
        "Only two distinct routes are available.",
      );
    }
    if (scenario === "blocked") {
      analysis.data.routes.routes = analysis.data.routes.routes.slice(0, 1);
      analysis.data.routes.available_route_count = 1;
      analysis.data.recommendation.routes =
        analysis.data.recommendation.routes.slice(0, 1);
      Object.assign(analysis.data.recommendation, {
        state: "NO_ELIGIBLE_ROUTE",
        recommended_route_id: null,
        ranked_route_ids: [],
        explanation: {
          code: "all_routes_blocked",
          message: "No route is recommended under the current conditions.",
        },
      });
    }
    return Response.json(analysis);
  }
  return Response.json(
    { code: "not_found", message: "No synthetic response configured." },
    { status: 404 },
  );
}
