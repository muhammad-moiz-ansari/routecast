import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTripLifecycle } from "../features/trip-planner/hooks/useTripLifecycle";
import raw from "./fixtures/comparison.json";
let hidden = false;
let cooldown = false;
let stopped = false;
let retain = false;
const calls: { path: string; init: RequestInit }[] = [];
let client: QueryClient;
async function tick(ms = 30) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  cooldown = false;
  stopped = false;
  retain = false;
  calls.length = 0;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init = {}) => {
      const path = String(url);
      calls.push({ path, init });
      if (path.includes("/session/"))
        return Response.json({ csrf_token: "offline-token" });
      if (path.includes("/analysis/"))
        return Response.json({
          ...raw,
          stopped,
          status: stopped ? "stopped" : retain ? "running" : "complete",
          retained_previous: retain,
        });
      if (path.includes("/heartbeat/")) return Response.json({ status: "ok" });
      if (path.includes("/refresh/")) {
        if (cooldown)
          return Response.json(
            {
              code: "refresh_cooldown",
              message: "Wait",
              retry_after_seconds: 10,
            },
            { status: 429 },
          );
        retain = true;
        return Response.json(
          {
            analysis_id: "next",
            coalesced: false,
            retry_after_seconds: null,
            stopped: false,
          },
          { status: 202 },
        );
      }
      if (path.includes("/stop/")) {
        stopped = true;
        return Response.json({
          analysis_id: null,
          coalesced: false,
          retry_after_seconds: null,
          stopped: true,
        });
      }
      throw Error("Unexpected request");
    }),
  );
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
});
function mount() {
  return renderHook(() => useTripLifecycle("trip"), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}
it("polls completed active trips, pauses hidden polling/heartbeats, then resumes", async () => {
  const hook = mount();
  await tick();
  expect(hook.result.current.query.data?.data).toBeTruthy();
  await tick(15000);
  expect(calls.filter((c) => c.path.includes("/analysis/"))).toHaveLength(2);
  act(() => {
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const count = calls.length;
  await tick(65000);
  expect(calls).toHaveLength(count);
  act(() => {
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await tick();
  expect(calls.length).toBeGreaterThan(count);
  expect(
    calls
      .filter((c) => c.path.includes("/heartbeat/"))
      .every(
        (c) =>
          c.init.method === "POST" &&
          new Headers(c.init.headers).get("X-CSRFToken"),
      ),
  ).toBe(true);
  hook.unmount();
});
it("retains completed results on refresh, honors cooldown and stops future traffic", async () => {
  const hook = mount();
  await tick();
  await act(async () => {
    await hook.result.current.refresh.mutateAsync();
  });
  await tick();
  expect(hook.result.current.query.data?.retained_previous).toBe(true);
  expect(hook.result.current.query.data?.data?.routes.routes).toHaveLength(3);
  expect(hook.result.current.cooldownSeconds).toBeGreaterThan(0);
  await act(async () => {
    await hook.result.current.stop.mutateAsync();
  });
  await tick();
  expect(hook.result.current.stopped).toBe(true);
  const count = calls.length;
  await tick(70000);
  expect(calls).toHaveLength(count);
  expect(hook.result.current.query.data?.data).toBeTruthy();
  hook.unmount();
});
it("honors Retry-After without retrying the POST and cancels obsolete in-flight reads", async () => {
  const hook = mount();
  await tick();
  cooldown = true;
  await act(async () => {
    await hook.result.current.refresh.mutateAsync().catch(() => undefined);
  });
  await tick();
  expect(hook.result.current.cooldownSeconds).toBeGreaterThan(0);
  expect(hook.result.current.cooldownSeconds).toBeLessThanOrEqual(10);
  expect(calls.filter((c) => c.path.includes("/refresh/"))).toHaveLength(1);
  let aborted = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    ),
  );
  act(() => {
    void hook.result.current.query.refetch();
  });
  await tick();
  act(() => {
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await tick();
  expect(aborted).toBe(true);
  expect(hook.result.current.query.data?.data).toBeTruthy();
  hook.unmount();
});

it("ignores a refresh response after navigating to another trip", async () => {
  const hook = renderHook((id: string) => useTripLifecycle(id), {
    initialProps: "first",
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  await tick();
  const original = fetch;
  let finish: (r: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn((url, init) =>
      String(url).includes("/refresh/")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : original(url, init),
    ),
  );
  act(() => hook.result.current.refresh.mutate());
  await tick();
  hook.rerender("second");
  await tick();
  await act(async () => {
    finish(
      Response.json({
        analysis_id: "old",
        coalesced: false,
        retry_after_seconds: null,
        stopped: false,
      }),
    );
  });
  await tick();
  expect(hook.result.current.cooldownSeconds).toBe(0);
  expect(hook.result.current.query.data?.retained_previous).toBe(false);
  hook.unmount();
});
