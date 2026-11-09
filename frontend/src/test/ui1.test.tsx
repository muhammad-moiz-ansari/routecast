import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routes } from "../app/routes";
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("Landing must not fetch");
    }),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
function mount(path = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
it("renders complete illustrative landing without operational fetches and controls motion", () => {
  mount();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Know the weather",
  );
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Pause illustration" }));
  expect(
    screen.getByRole("button", { name: "Resume illustration" }),
  ).toBeVisible();
  expect(document.querySelector(".hero-scene")).toHaveClass("scene-paused");
  fireEvent.click(screen.getByRole("button", { name: /See conditions ahead/ }));
  expect(screen.getAllByText("See conditions ahead")).toHaveLength(2);
});
it("persists shared theme across lazy planner navigation and returns to landing", async () => {
  const router = mount();
  fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
  expect(localStorage.getItem("routecast-theme")).toBe("night");
  await act(async () => {
    await router.navigate("/plan");
  });
  expect(
    await screen.findByRole(
      "button",
      { name: "Compare routes" },
      { timeout: 5000 },
    ),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => {
    await router.navigate("/");
  });
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Know the weather",
  );
});
it("provides a genuine not-found route and a keyboard-dismissable menu", async () => {
  const router = mount("/unknown/page");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "wasn't found",
  );
  await act(async () => {
    await router.navigate("/");
  });
  const button = screen.getByRole("button", { name: "Open navigation" });
  fireEvent.click(button);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute("aria-expanded", "false");
});

it("shows a static scene for reduced motion and cleans up scene observers", () => {
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {
        disconnect();
      }
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduced-motion"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  const ui = render(<RouterProvider router={router} />);
  expect(document.querySelector(".hero-scene")).toHaveClass("scene-paused");
  expect(screen.getByRole("img")).toBeVisible();
  ui.unmount();
  expect(disconnect).toHaveBeenCalled();
});
