import storedAnalysis from "./comparison.json";
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
  if (path.includes("/analysis/")) {
    const analysis = structuredClone(storedAnalysis);
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
