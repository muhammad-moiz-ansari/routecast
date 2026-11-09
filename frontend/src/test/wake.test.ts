import { expect, it, vi } from "vitest";
import { wakeBackend } from "../api/client";
it("sends one cookie-free liveness request and never throws", async () => {
  const request = vi.fn(() => Promise.reject(new Error("asleep")));
  vi.stubGlobal("fetch", request);
  expect(() => wakeBackend()).not.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith("/api/v1/health/", {
    credentials: "omit",
    cache: "no-store",
  });
  // A rejected wake-up is swallowed rather than surfacing as an unhandled rejection.
  await Promise.resolve();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("blocked");
    }),
  );
  expect(() => wakeBackend()).not.toThrow();
  vi.unstubAllGlobals();
});
