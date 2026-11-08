import type { ApiFailure } from "./contracts";
export const fixtureMode =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIXTURES === "true";
export class ApiError extends Error {
  constructor(
    public detail: ApiFailure,
    public status: number,
  ) {
    super(detail.message);
  }
}
let session: Promise<string> | undefined;
async function transport(path: string, init: RequestInit) {
  if (fixtureMode) {
    const { fixtureFetch } = await import("../test/fixtures/api");
    return fixtureFetch(path, init);
  }
  return fetch("/api/v1" + path, { ...init, credentials: "same-origin" });
}
export function ensureSession(): Promise<string> {
  // Concurrent searches share bootstrap; no trip is ever created from a mount effect.
  return (session ??= (async () => {
    try {
      const r = await transport("/session/", {});
      if (!r.ok) throw new Error();
      return (await r.json()).csrf_token as string;
    } catch {
      session = undefined;
      throw new Error(
        "Could not start a planning session. Check the backend connection and try again.",
      );
    }
  })());
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await ensureSession();
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (init.method && init.method !== "GET") headers.set("X-CSRFToken", token);
  let r: Response;
  try {
    r = await transport(path, { ...init, headers });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error(
      "Server unreachable. Check your connection; your form values have been kept.",
    );
  }
  if (!r.ok) {
    let detail: ApiFailure;
    try {
      detail = await r.json();
    } catch {
      detail = {
        code: "server_error",
        message: "The server could not complete this request. Try again later.",
      };
    }
    if (r.status === 401 || r.status === 403) session = undefined;
    throw new ApiError(detail, r.status);
  }
  return r.json() as Promise<T>;
}
