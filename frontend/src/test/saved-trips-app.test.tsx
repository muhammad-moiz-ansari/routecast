import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { App } from "../app/App";
import { ThemeProvider } from "../app/ThemeProvider";
import stored from "./fixtures/comparison.json";
import corridor from "./fixtures/corridor.json";

it("loads a different saved trip's inputs even when its assessment failed", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const calls: { path: string; method: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init = {}) => {
      const path = String(url);
      calls.push({ path, method: init.method ?? "GET" });
      if (path.includes("/session/"))
        return Response.json({ csrf_token: "offline-token" });
      if (path.includes("/heartbeat/")) return Response.json({ status: "ok" });
      if (path.includes("/corridor/")) return Response.json(corridor);
      if (path.includes("/trips/saved/?"))
        return Response.json({
          items: [
            {
              id: "second",
              title: "Saved second journey",
              saved_at: "2026-11-10T12:00:00Z",
              departure_at: stored.data.inputs.departure_at,
              timezone: "Asia/Karachi",
              status: "routing_failed",
            },
          ],
          next_offset: null,
        });
      if (path.includes("/second/analysis/"))
        return Response.json({
          ...stored,
          trip_id: "second",
          status: "failed",
          stage: "routing",
          data: null,
          error_code: "provider_rate_limit",
        });
      if (path.endsWith("/second/"))
        return Response.json({
          ...stored.data.inputs,
          id: "second",
          cargo_load_lb: 12000,
        });
      if (path.includes("/first/analysis/"))
        return Response.json({ ...stored, trip_id: "first" });
      throw Error(`Unexpected offline request: ${path}`);
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={["/trips/first"]}>
          <Routes>
            <Route path="/:mode/:id?" element={<App />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Cargo load")).toHaveValue("42000"),
  );
  fireEvent.click(screen.getByRole("button", { name: "My Trips" }));
  fireEvent.click(
    await screen.findByRole("link", { name: /Saved second journey/ }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Cargo load")).toHaveValue("12000"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit trip" }));
  fireEvent.change(screen.getByLabelText("Cargo load"), {
    target: { value: "999" },
  });
  fireEvent.click(screen.getByRole("button", { name: "My Trips" }));
  fireEvent.click(
    await screen.findByRole("link", { name: /Saved second journey/ }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Cargo load")).toHaveValue("12000"),
  );
  expect(
    calls
      .filter((call) => call.method !== "GET")
      .every((call) => call.path.endsWith("/heartbeat/")),
  ).toBe(true);
  expect(calls.every((call) => call.path.startsWith("/api/v1/"))).toBe(true);
  client.clear();
});
