import { renderHook, waitFor, act } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { useFieldOverlay } from "../features/map/rendering/useFieldOverlay";
import corridor from "./fixtures/corridor.json";
it("terminates obsolete work and rejects late results after a newer frame", async () => {
  const workers: any[] = [];
  vi.stubGlobal(
    "Worker",
    class {
      onmessage: any;
      onerror: any;
      job: any;
      terminate = vi.fn();
      constructor() {
        workers.push(this);
      }
      postMessage(job: any) {
        this.job = job;
      }
    },
  );
  const map = {
    current: {
      getLayer: (id:string) => id === "route-casing",
      getSource: () => false,
      addSource: vi.fn(),
      addLayer: vi.fn(),
    },
  } as any;
  const props = {
    corridor: corridor.data,
    routes: [],
    forecastLayer: "wind_mph",
    forecastFrame: 0,
    showForecast: true,
  } as any;
  const hook = renderHook(
    ({ frame }) => useFieldOverlay(map, { ...props, forecastFrame: frame }, 1),
    { initialProps: { frame: 0 } },
  );
  await waitFor(() => expect(workers).toHaveLength(1));
  hook.rerender({ frame: 1 });
  await waitFor(() => expect(workers).toHaveLength(2));
  expect(workers[0].terminate).toHaveBeenCalled();
  act(() =>
    workers[0].onmessage({ data: { id: workers[0].job.id, tiles: [] } }),
  );
  expect(hook.result.current).toContain("Updating");
  act(() =>
    workers[1].onmessage({ data: { id: workers[1].job.id, tiles: [] } }),
  );
  expect(hook.result.current).toBe("");
  hook.unmount();
  expect(workers[1].terminate).toHaveBeenCalled();
});
