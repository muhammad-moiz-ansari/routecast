import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "../app/App";
import stored from "./fixtures/comparison.json";
import corridor from "./fixtures/corridor.json";
it("integrates working routes then a completed snapshot without any trip POST or provider request", async () => {
  let complete = false;
  let failure = false;
  let stage = "weather";
  const calls: string[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  // This integration check exercises the text fallback; actual WebGL is reviewed in the browser.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init = {}) => {
      expect(init.method ?? "GET").toBe(
        String(url).includes("/heartbeat/") ? "POST" : "GET",
      );
      const path = String(url);
      calls.push(path);
      if (path.includes("/heartbeat/")) return Response.json({ status: "ok" });
      if (path.includes("/corridor/")) return Response.json(corridor);
      if (path.includes("/session/"))
        return Response.json({ csrf_token: "offline-token" });
      if (path.includes("/analysis/") && failure)
        return Response.json(
          { code: "unavailable", message: "Read unavailable" },
          { status: 503 },
        );
      if (path.includes("/analysis/"))
        return Response.json(
          complete
            ? stored
            : {
                ...stored,
                data: null,
                status: "running",
                stage,
                analysis_version: null,
                analysis_revision: null,
              },
        );
      if (path.includes("/routes/")) return Response.json(stored.data.routes);
      throw Error("Unexpected network destination");
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/trips/preview-trip"]}>
        <Routes>
          <Route path="/:mode?/:id?" element={<App />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(
    () => expect(screen.getAllByText(/Weather pending/)).toHaveLength(3),
    { timeout: 5000 },
  );
  stage = "assessing";
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["analysis", "preview-trip"] });
  });
  expect(screen.getAllByText(/Weather pending/)).toHaveLength(3);
  complete = true;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["analysis", "preview-trip"] });
  });
  expect(
    await screen.findByText("Route B · Recommended under the supplied rules"),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Inspect checkpoint A-0001" }),
  ).toBeEnabled();
  expect(calls.every((p) => p.startsWith("/api/v1/"))).toBe(true);
  expect(calls.filter((p) => p.includes("/routes/"))).toHaveLength(1);
  expect(await screen.findByRole("slider")).toBeEnabled();
  expect(screen.getByLabelText("Cargo load")).toHaveValue("42000");
  failure = true;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["analysis", "preview-trip"] });
  });
  expect(
    await screen.findByText("Current recommendation withheld"),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Inspect checkpoint A-0001" }),
  ).toBeEnabled();
  failure = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry status read" }));
  expect(
    await screen.findByText("Route B · Recommended under the supplied rules"),
  ).toBeVisible();
  client.clear();
});
