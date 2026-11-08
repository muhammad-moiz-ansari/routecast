import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "../app/App";
import { departureInstant } from "../utils/time";
import { plannerSchema } from "../features/trip-planner/schemas";

function mount() {
  return render(
    <StrictMode>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <MemoryRouter>
          <Routes>
            <Route path="/:mode?/:id?" element={<App />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
const calls: { url: string; init: RequestInit }[] = [];
beforeEach(() => {
  calls.length = 0;
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init = {}) => {
      const path = String(url);
      calls.push({ url: path, init });
      if (path.includes("/session/"))
        return Response.json({ csrf_token: "offline-csrf" });
      if (path.includes("/locations/")) {
        const q = new URL(path, "http://localhost").searchParams.get("query")!;
        return Response.json([
          {
            id: q,
            label: q + " region",
            coordinate: { latitude: q === "Albany" ? 30 : 31, longitude: 70 },
          },
        ]);
      }
      if (path.endsWith("/trips/"))
        return Response.json(
          { id: "trip-123", analysis_id: "analysis-123", status: "queued" },
          { status: 202 },
        );
      if (path.includes("/analysis/"))
        return Response.json({
          trip_id: "trip-123",
          status: "running",
          stage: "weather",
          data: null,
        });
      throw new Error("Unexpected endpoint " + path);
    }),
  );
});

it("focuses an error summary without submitting unselected locations", async () => {
  mount();
  await userEvent.click(screen.getByRole("button", { name: "Compare routes" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  expect(calls.filter((c) => c.init.method === "POST")).toHaveLength(0);
});

it("selects places by keyboard and submits exactly once in StrictMode", async () => {
  mount();
  const user = userEvent.setup();
  const origin = screen.getByRole("combobox", { name: "Origin" });
  await user.type(origin, "Albany");
  await screen.findByRole("option", { name: "Albany region" });
  expect(origin).toHaveValue("Albany");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(origin).toHaveValue("Albany region");
  const destination = screen.getByRole("combobox", { name: "Destination" });
  await user.type(destination, "Boston");
  await screen.findByRole("option", { name: "Boston region" });
  await user.keyboard("{ArrowDown}{Enter}");
  await user.type(screen.getByLabelText("Cargo load"), "42000");
  await user.clear(screen.getByLabelText("Timezone"));
  await user.type(screen.getByLabelText("Timezone"), "Asia/Karachi");
  const departure = screen.getByLabelText("Departure date & time");
  await user.type(departure, "2099-11-09T12:00");
  await user.dblClick(screen.getByRole("button", { name: "Compare routes" }));
  await screen.findByRole("heading", {
    name: "Checking weather at arrival times",
  });
  const posts = calls.filter((c) => c.init.method === "POST");
  expect(posts).toHaveLength(1);
  expect(JSON.parse(String(posts[0].init.body))).toMatchObject({
    departure_at: "2099-11-09T07:00:00Z",
    timezone: "Asia/Karachi",
    cargo_load_lb: 42000,
    checkpoint_spacing_miles: 25,
  });
  expect(new Headers(posts[0].init.headers).get("X-CSRFToken")).toBe(
    "offline-csrf",
  );
  expect(origin).toHaveValue("Albany region");
});

it("closes methodology on Escape and restores focus", async () => {
  mount();
  const user = userEvent.setup();
  const button = screen.getByRole("button", { name: "Methodology" });
  await user.click(button);
  expect(screen.getByRole("dialog")).toBeVisible();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(button).toHaveFocus());
});

it("persists explicit theme preference", async () => {
  mount();
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Color theme" }),
    "night",
  );
  expect(document.documentElement.dataset.theme).toBe("night");
  expect(localStorage.getItem("routecast-theme")).toBe("night");
});

it.each(["2026-03-08T02:30", "2026-11-01T01:30"])(
  "rejects ambiguous or skipped New York time %s",
  (local) =>
    expect(() => departureInstant(local, "America/New_York")).toThrow(),
);
it("converts explicit IANA local time to a UTC instant", () =>
  expect(departureInstant("2099-11-09T12:00", "Asia/Karachi")).toBe(
    "2099-11-09T07:00:00Z",
  ));
it.each(["-1", "Infinity", "NaN", ""])("rejects invalid cargo %s", (cargo) => {
  const location = {
    id: "a",
    label: "A",
    coordinate: { latitude: 30, longitude: 70 },
  };
  expect(
    plannerSchema.safeParse({
      origin: location,
      destination: { ...location, coordinate: { latitude: 31, longitude: 70 } },
      departure: "2099-11-09T12:00",
      timezone: "UTC",
      cargo,
      spacing: "25",
    }).success,
  ).toBe(false);
});

it("dismisses location suggestions with Escape without selecting them", async () => {
  mount();
  const user = userEvent.setup();
  const input = screen.getByRole("combobox", { name: "Origin" });
  await user.type(input, "Albany");
  await screen.findByRole("option", { name: "Albany region" });
  await user.keyboard("{Escape}");
  expect(input).toHaveAttribute("aria-expanded", "false");
  expect(input).toHaveValue("Albany");
  expect(calls.filter((c) => c.init.method === "POST")).toHaveLength(0);
});

it("reports a place search failure without choosing a location", async () => {
  mount();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      String(url).includes("/session/")
        ? Response.json({ csrf_token: "token" })
        : Response.json(
            {
              code: "provider_rate_limit",
              message: "Place search limit reached. Try again later.",
            },
            { status: 429 },
          ),
    ),
  );
  await userEvent.type(
    screen.getByRole("combobox", { name: "Origin" }),
    "Albany",
  );
  await screen.findByText("Place search limit reached. Try again later.");
  expect(screen.getByRole("listbox")).toBeEmptyDOMElement();
});

it("keeps entered values and focuses the summary after a failed submission", async () => {
  mount();
  const user = userEvent.setup();
  const original = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init = {}) => {
      if (String(url).endsWith("/trips/")) {
        calls.push({ url: String(url), init });
        return Response.json(
          {
            code: "queue_unavailable",
            message: "Planning is unavailable. Try again later.",
          },
          { status: 503 },
        );
      }
      return original(url, init);
    }),
  );
  for (const [name, text] of [
    ["Origin", "Albany"],
    ["Destination", "Boston"],
  ]) {
    await user.type(screen.getByRole("combobox", { name }), text);
    await screen.findByRole("option", { name: text + " region" });
    await user.keyboard("{ArrowDown}{Enter}");
  }
  fireEvent.change(screen.getByLabelText("Departure date & time"), {
    target: { value: "2099-11-09T12:00" },
  });
  fireEvent.change(screen.getByLabelText("Cargo load"), {
    target: { value: "42000" },
  });
  await user.click(screen.getByRole("button", { name: "Compare routes" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  expect(screen.getByLabelText("Cargo load")).toHaveValue("42000");
  expect(screen.getByRole("combobox", { name: "Origin" })).toHaveValue(
    "Albany region",
  );
  expect(calls.filter((c) => c.init.method === "POST")).toHaveLength(1);
});

it("shows an empty search state without selecting a place", async () => {
  mount();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      String(url).includes("/session/")
        ? Response.json({ csrf_token: "token" })
        : Response.json([]),
    ),
  );
  await userEvent.type(
    screen.getByRole("combobox", { name: "Origin" }),
    "Nowhere",
  );
  await screen.findByText("No places found. Try a more specific address.");
  expect(screen.getByRole("listbox")).toBeEmptyDOMElement();
});

it("cancels an obsolete place request when the input changes", async () => {
  mount();
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init = {}) => {
      if (String(url).includes("/session/"))
        return Response.json({ csrf_token: "token" });
      signal = init.signal as AbortSignal;
      return new Promise<Response>((_, reject) =>
        signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      );
    }),
  );
  const input = screen.getByRole("combobox", { name: "Origin" });
  await userEvent.type(input, "Obsolete");
  await waitFor(() => expect(signal).toBeDefined());
  await userEvent.clear(input);
  expect(signal?.aborted).toBe(true);
});
