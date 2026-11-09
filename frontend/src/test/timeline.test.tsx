import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Analysis, CorridorProjection } from "../api/contracts";
import raw from "./fixtures/corridor.json";
import analysisRaw from "./fixtures/comparison.json";
import {
  ForecastTimeline,
  loadPreferences,
} from "../features/weather-timeline/components/ForecastTimeline";
import { aligned, frameIndex } from "../features/weather-timeline/frame";
import {
  corridorCells,
  fieldFeatures,
} from "../features/map/utils/corridorField";
const fixture = () => structuredClone(raw) as unknown as CorridorProjection;
function Harness({ projection }: { projection: CorridorProjection }) {
  const [time, setTime] = useState<string | null>(null);
  const [prefs, setPrefs] = useState(loadPreferences);
  return (
    <ForecastTimeline
      corridor={projection}
      zone="Asia/Karachi"
      preferences={prefs}
      onPreferences={setPrefs}
      absoluteTime={time}
      onTime={setTime}
    />
  );
}
it("moves cached hours/layers without HTTP and preserves an absolute timestamp across datasets", () => {
  localStorage.clear();
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  const a = fixture();
  const ui = render(<Harness projection={a} />);
  fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
  const chosen = screen.getByRole("slider").getAttribute("aria-valuetext");
  expect(screen.getByRole("slider")).toHaveValue("12");
  fireEvent.change(screen.getByLabelText("Weather layer"), {
    target: { value: "risk" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Forecast details" }));
  expect(
    screen.getByText(/Combined risk uses the assessed cargo/),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Close forecast details" }),
  );
  const b = fixture();
  b.data!.dataset_id = "new";
  b.data!.timestamps = b.data!.timestamps.map((t) =>
    new Date(Date.parse(t) + 3600000).toISOString(),
  );
  ui.rerender(<Harness projection={b} />);
  expect(screen.getByRole("slider")).toHaveValue("11");
  expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toContain(
    chosen!.split(", hour")[0],
  );
  fireEvent.click(screen.getByRole("button", { name: "Next hour" }));
  expect(screen.getByRole("slider")).toHaveValue("12");
  fireEvent.click(screen.getByRole("button", { name: "Forecast details" }));
  fireEvent.click(screen.getByRole("button", { name: "First hour" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Close forecast details" }),
  );
  expect(screen.getByRole("button", { name: "Previous hour" })).toBeDisabled();
  expect(request).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: /play/i }),
  ).not.toBeInTheDocument();
});
it("keeps a truthful missing/partial state and provides sample text with fixed legends", () => {
  localStorage.clear();
  render(<Harness projection={fixture()} />);
  const legend = screen.getByLabelText("Wind fixed legend").textContent;
  fireEvent.click(screen.getByRole("button", { name: "Forecast details" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Forecast sample values" }),
  );
  expect(screen.getByText(/cell-000.*incomplete forecast/)).toHaveTextContent(
    "Unavailable",
  );
  expect(screen.getByText(/Forecast time is independent/)).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Close forecast details" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next hour" }));
  expect(screen.getByLabelText("Wind fixed legend").textContent).toBe(legend);
});
it("rejects invalid persisted preferences and gates dataset/revision mismatches", () => {
  localStorage.setItem(
    "routecast-display",
    JSON.stringify({ layer: "__proto__", overlay: false }),
  );
  expect(loadPreferences()).toEqual({ layer: "wind_mph", overlay: false });
  const a = analysisRaw as unknown as Analysis;
  const c = fixture();
  expect(aligned(a, c)).toBe(true);
  c.data!.analysis_version = 2;
  expect(aligned(a, c)).toBe(false);
  c.data!.analysis_version = 1;
  expect(aligned({ ...a, input_revision: 2 }, c)).toBe(false);
  expect(frameIndex(c.data!.timestamps, "1900-01-01T00:00:00Z")).toBe(0);
});
it("renders conservative disjoint scalar cells without additive overlaps or clear-weather missing values", () => {
  const c = fixture().data!;
  const routes = (analysisRaw as unknown as Analysis).data!.routes.routes;
  const cells = corridorCells(c, routes);
  expect(cells.length).toBeGreaterThan(0);
  expect(cells.length).toBeLessThanOrEqual(c.grid.samples.length * 25);
  expect(corridorCells(c, [...routes, ...routes])).toEqual(cells);
  const mesh = fieldFeatures(cells, c, "wind_mph", 0);
  expect(
    new Set(mesh.features.map((f) => JSON.stringify(f.geometry.coordinates)))
      .size,
  ).toBe(mesh.features.length);
  const cell = {
    coordinates: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
    sample: 0,
  };
  expect(
    fieldFeatures([cell], c, "wind_mph", 0).features[0].properties,
  ).toMatchObject({ missing: true, color: "#52636c" });
  c.values.wind_mph[0][0] = 0;
  c.missing.wind_mph[0][0] = false;
  expect(
    fieldFeatures([cell], c, "wind_mph", 0).features[0].properties!.missing,
  ).toBe(false);
});
it("clips field cells wholly inside an equatorial geographic corridor", () => {
  const d = fixture().data!;
  d.grid.samples = [{ id: "x", coordinate: { longitude: 0.5, latitude: 0 } }];
  d.grid.width_miles = 10;
  const r = structuredClone(analysisRaw.data.routes.routes[0]);
  r.geometry.coordinates = [
    [0, 0],
    [1, 0],
  ];
  const cells = corridorCells(d, [r as any]);
  expect(cells.length).toBeGreaterThan(0);
  for (const cell of cells)
    for (const [, lat] of cell.coordinates)
      expect(((Math.abs(lat) * Math.PI) / 180) * 6371008.8).toBeLessThanOrEqual(
        16093.44,
      );
});

it("announces corridor failure without invented values or noisy per-frame status", () => {
  localStorage.clear();
  const c = fixture();
  c.status = "failed";
  c.error_code = "corridor_failed";
  c.data = null;
  const ui = render(<Harness projection={c} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Corridor unavailable");
  expect(screen.getByRole("slider")).toBeDisabled();
  ui.rerender(<Harness projection={fixture()} />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
