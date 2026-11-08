import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Analysis } from "../api/contracts";
import stored from "./fixtures/comparison.json";
import { RouteComparison } from "../features/route-comparison/components/RouteComparison";
import { currentRecommendation } from "../features/route-comparison/presentation";
import {
  routeBounds,
  pointFeatures,
  routeFeatures,
} from "../features/map/utils/geometry";
const harness = vi.hoisted(() => ({ maps: [] as any[], fail: false }));
vi.mock("maplibre-gl", () => {
  class FakeMap {
    events: Record<string, Function[]> = {};
    sources = new Map();
    layers = new Map();
    fitBounds = vi.fn();
    remove = vi.fn();
    resize = vi.fn();
    setFilter = vi.fn();
    jumpTo = vi.fn();
    getZoom = () => 5;
    picked: any[] = [];
    queryRenderedFeatures = () => this.picked;
    constructor() {
      if (harness.fail) throw Error("WebGL unavailable");
      harness.maps.push(this);
    }
    getCanvas = () => document.createElement("canvas");
    addControl = vi.fn();
    images = new Set<string>();
    addImage = vi.fn((id: string) => {
      if (this.images.has(id)) throw Error("Duplicate sprite");
      this.images.add(id);
    });
    hasImage = (id: string) => this.images.has(id);
    on(name: string, fn: Function) {
      (this.events[name] ??= []).push(fn);
    }
    fire(name: string, event: any = {}) {
      this.events[name]?.forEach((fn) => fn(event));
    }
    addSource(id: string, source: any) {
      this.sources.set(id, { ...source, setData: vi.fn() });
    }
    getSource(id: string) {
      return this.sources.get(id);
    }
    addLayer(layer: any) {
      this.layers.set(layer.id, layer);
    }
    getLayer(id: string) {
      return this.layers.get(id);
    }
    isStyleLoaded = () => this.layers.has("route-lines");
    setStyle = vi.fn(() => {
      this.layers.clear();
      this.sources.clear();
      this.fire("style.load");
    });
  }
  return {
    default: {
      Map: FakeMap,
      NavigationControl: class {},
      ScaleControl: class {},
    },
  };
});
const fixture = () => structuredClone(stored) as unknown as Analysis;
beforeEach(() => {
  harness.maps.length = 0;
  harness.fail = false;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    fillText() {},
    getImageData() {
      return {
        width: 48,
        height: 48,
        data: new Uint8ClampedArray(48 * 48 * 4),
      };
    },
  } as any);
});
async function ready() {
  await waitFor(() => expect(harness.maps.length).toBeGreaterThan(0));
  const map = harness.maps.at(-1);
  act(() => map.fire("style.load"));
  return map;
}
it("synchronizes list/map inspection without changing backend recommendation or refitting camera", async () => {
  const a = fixture();
  const ui = render(<RouteComparison analysis={a} />);
  const map = await ready();
  expect(
    screen.getByRole("button", { name: "Inspect route B" }),
  ).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Inspect route A" }));
  expect(screen.getByText("Route A checkpoints")).toBeVisible();
  expect(
    map
      .getSource("routes")
      .setData.mock.lastCall[0].features.find(
        (f: any) => f.properties.id === "A",
      ).properties.selected,
  ).toBe(true);
  expect(currentRecommendation(a)).toBe("B");
  map.picked = [{ layer: { id: "route-hit" }, properties: { id: "C" } }];
  act(() => map.fire("click", { point: { x: 1, y: 1 } }));
  expect(
    screen.getByRole("button", { name: "Inspect route C" }),
  ).toHaveAttribute("aria-pressed", "true");
  const updated = fixture();
  updated.data!.recommendation.recommended_route_id = "B";
  updated.analysis_version = 2;
  ui.rerender(<RouteComparison analysis={updated} />);
  expect(
    screen.getByRole("button", { name: "Inspect route C" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Fit routes" }));
  expect(map.fitBounds).toHaveBeenCalledTimes(2);
});
it("withholds stale or ineligible recommendations while leaving blocked routes inspectable", async () => {
  const a = fixture();
  a.data!.recommendation.recommended_route_id = "A";
  expect(currentRecommendation(a)).toBeNull();
  a.routing_stale = true;
  render(<RouteComparison analysis={a} />);
  await ready();
  expect(screen.getByText("Current recommendation withheld")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Inspect route A" }));
  expect(screen.getAllByText("No Travel").length).toBeGreaterThan(0);
  expect(screen.queryByText("Recommended")).not.toBeInTheDocument();
});
it("preserves inspection when the recommendation changes and explains disappearing routes", async () => {
  const a = fixture();
  const ui = render(<RouteComparison analysis={a} />);
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Inspect route A" }));
  const b = fixture();
  b.data!.recommendation.recommended_route_id = "C";
  b.data!.recommendation.routes.find((r) => r.route_id === "C")!.eligible =
    true;
  ui.rerender(<RouteComparison analysis={b} />);
  expect(
    screen.getByRole("button", { name: "Inspect route A" }),
  ).toHaveAttribute("aria-pressed", "true");
  b.data!.routes.routes = b.data!.routes.routes.filter((r) => r.id !== "A");
  ui.rerender(<RouteComparison analysis={{ ...b }} />);
  expect(
    screen.getByText(/Previously inspected route A is no longer available/),
  ).toBeVisible();
});
it("keeps checkpoint data and dialog usable when WebGL fails; missing values stay unavailable", async () => {
  harness.fail = true;
  render(<RouteComparison analysis={fixture()} />);
  await screen.findByText(/Map unavailable/);
  fireEvent.click(screen.getByRole("button", { name: "Inspect route C" }));
  const trigger = screen.getByRole("button", {
    name: "Inspect checkpoint C-0002",
  });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByText(/Required forecast data is missing/),
  ).toBeVisible();
  expect(within(dialog).getAllByText("Unavailable").length).toBe(3);
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
});
it("map checkpoint activation opens matching arrival/weather/rule details", async () => {
  render(<RouteComparison analysis={fixture()} />);
  const map = await ready();
  map.picked = [
    { layer: { id: "checkpoint-hit" }, properties: { id: "B-0001" } },
  ];
  act(() => map.fire("click", { point: {} }));
  expect(screen.getByRole("dialog")).toHaveTextContent("37 mph");
  expect(screen.getByRole("dialog")).toHaveTextContent("Load override");
});
it("renders partial, no eligible, pending-weather and zero-route states without invented metrics", async () => {
  const a = fixture();
  a.data!.routes.routes = a.data!.routes.routes.slice(0, 1);
  a.data!.recommendation.state = "NO_ELIGIBLE_ROUTE";
  a.data!.recommendation.recommended_route_id = null;
  const ui = render(<RouteComparison analysis={a} />);
  await ready();
  expect(screen.getByText(/1 of up to 3/)).toBeVisible();
  expect(
    screen.getByText("No route is recommended under the current conditions"),
  ).toBeVisible();
  const routes = a.data!.routes;
  ui.rerender(
    <RouteComparison analysis={{ ...a, data: null }} pendingRoutes={routes} />,
  );
  expect(screen.getByText(/Weather pending/)).toBeVisible();
  expect(screen.getByText(/Severe:/)).toHaveTextContent("Unavailable");
  ui.rerender(
    <RouteComparison
      analysis={{ ...a, data: null }}
      pendingRoutes={{ ...routes, routes: [] }}
    />,
  );
  expect(screen.getByText(/No route options are available/)).toBeVisible();
});
it("keeps GeoJSON longitude first and fits a dateline crossing without a global camera jump", () => {
  const a = fixture();
  const route = a.data!.routes.routes[0];
  route.geometry.coordinates = [
    [179, 20],
    [-179, 21],
  ];
  expect(routeBounds([route])).toEqual([
    [179, 20],
    [181, 21],
  ]);
  const p = a.data!.checkpoints.A.checkpoints[0];
  expect(pointFeatures([p], []).features[0].geometry.coordinates).toEqual([
    p.coordinate.longitude,
    p.coordinate.latitude,
  ]);
});

it("reuses sprites across theme changes and preserves the camera", async () => {
  render(<RouteComparison analysis={fixture()} />);
  const map = await ready();
  expect(map.addImage).toHaveBeenCalledTimes(9);
  await act(async () => {
    document.documentElement.dataset.theme =
      document.documentElement.dataset.theme === "night" ? "day" : "night";
  });
  await waitFor(() => expect(map.setStyle).toHaveBeenCalled());
  expect(map.addImage).toHaveBeenCalledTimes(9);
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Map unavailable/)).not.toBeInTheDocument();
});
it("withholds current claims while offline and keeps known text visible", async () => {
  render(<RouteComparison analysis={fixture()} />);
  await ready();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  fireEvent(window, new Event("offline"));
  expect(screen.getByRole("alert")).toHaveTextContent("Browser offline");
  expect(screen.getByText("Current recommendation withheld")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Inspect checkpoint B-0001" }),
  ).toBeEnabled();
});
it("keeps route identity stable when fewer alternatives remain", () => {
  const r = fixture().data!.routes.routes[1];
  expect(routeFeatures([r], r.id).features[0].properties!.color).toBe(
    "#7939ad",
  );
});
