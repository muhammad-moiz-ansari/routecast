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
  if (path.includes("/analysis/"))
    return Response.json({
      trip_id: "preview-trip",
      input_revision: 1,
      analysis_id: "preview-analysis",
      analysis_version: null,
      analysis_revision: null,
      status: "running",
      stage: "weather",
      stopped: false,
      error_code: null,
      completed_at: null,
      routing_stale: true,
      weather_stale: true,
      retained_previous: false,
      data: null,
    });
  return Response.json(
    { code: "not_found", message: "No synthetic response configured." },
    { status: 404 },
  );
}
