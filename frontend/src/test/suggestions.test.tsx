import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SuggestionsBox } from "../features/route-comparison/components/SuggestionsBox";
const calls: { url: string; init: RequestInit }[] = [];
let reply: (version: number) => Response;
function result(version: number) {
  return Response.json({
    analysis_version: version,
    generated_at: "2026-11-09T10:00:00Z",
    model: "openai/gpt-oss-20b",
    cached: false,
    suggestions: [
      { kind: "route", text: "Route B avoids the No Travel miles on Route A." },
      {
        kind: "cargo",
        text: "Cargo over 40,000 lb raises 35 mph wind to Severe.",
      },
    ],
  });
}
beforeEach(() => {
  calls.length = 0;
  reply = result;
  globalThis.fetch = vi.fn(
    async (url: RequestInfo | URL, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/session/"))
        return Response.json({ csrf_token: "token" });
      return reply(2);
    },
  ) as typeof fetch;
});
const box = (version = 2) => (
  <SuggestionsBox
    tripId="trip-1"
    analysisVersion={version}
    zone="Asia/Karachi"
  />
);
it("requests suggestions explicitly and labels them as advisory", async () => {
  render(box());
  expect(calls).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Get suggestions" }));
  expect(
    await screen.findByText("Route B avoids the No Travel miles on Route A."),
  ).toBeInTheDocument();
  expect(screen.getByText(/AI-generated and may be wrong/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Get suggestions" })).toBeNull();
  const post = calls.find((c) => c.url.endsWith("/trips/trip-1/suggestions/"))!;
  expect(post.init.method).toBe("POST");
  expect(new Headers(post.init.headers).get("X-CSRFToken")).toBe("token");
});
it("explains an unconfigured server and keeps the button available", async () => {
  reply = () =>
    Response.json(
      {
        code: "ai_not_configured",
        message: "AI suggestions are not configured.",
      },
      { status: 503 },
    );
  render(box());
  fireEvent.click(screen.getByRole("button", { name: "Get suggestions" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "AI suggestions aren't set up on this server.",
  );
  expect(screen.getByRole("button", { name: "Get suggestions" })).toBeEnabled();
});
it("shows the allowance wait time and rejects text for another analysis", async () => {
  reply = () =>
    Response.json(
      {
        code: "provider_budget_exhausted",
        message: "x",
        retry_after_seconds: 150,
      },
      { status: 429 },
    );
  const view = render(box());
  fireEvent.click(screen.getByRole("button", { name: "Get suggestions" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("about 3 min");
  reply = () => result(3);
  fireEvent.click(screen.getByRole("button", { name: "Get suggestions" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("The analysis changed"),
  );
  view.rerender(box(3));
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Get suggestions" }));
  expect(
    await screen.findByText(
      "Cargo over 40,000 lb raises 35 mph wind to Severe.",
    ),
  ).toBeInTheDocument();
});
