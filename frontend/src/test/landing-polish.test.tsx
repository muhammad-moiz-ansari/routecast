import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import {
  WorkflowPreview,
  ForecastPreview,
} from "../components/landing/LandingExamples";
import { AnimatedDisclosure } from "../components/ui/AnimatedDisclosure";
import { HoloCard } from "../components/ui/HoloCard";

it("presents inputs, arrival forecasts and eligibility as distinct illustrative workflow stages", () => {
  const view = render(<WorkflowPreview step={0} />);
  expect(screen.getByText("Warehouse A")).toBeVisible();
  expect(screen.getByText("42,000 lb")).toBeVisible();
  view.rerender(<WorkflowPreview step={1} />);
  expect(screen.queryByText("Warehouse A")).not.toBeInTheDocument();
  expect(screen.getByText("37 mph")).toBeVisible();
  expect(screen.getByText("Severe")).toBeVisible();
  view.rerender(<WorkflowPreview step={2} />);
  expect(screen.getByText("Eligible")).toBeVisible();
  expect(screen.getByText("Excluded by a No Travel segment")).toBeVisible();
  expect(screen.getByText("Incomplete forecast coverage")).toBeVisible();
  expect(screen.getByText(/Authored example/)).toBeVisible();
});

it("changes forecast readings and narrative for all three hours while keeping route geography fixed", () => {
  render(<ForecastPreview />);
  const map = screen.getByRole("img");
  const originalPath = map
    .querySelector("path[stroke-width='5']")
    ?.getAttribute("d");
  expect(map).toHaveAccessibleName(/Hour 0.*18.*28.*34/);
  fireEvent.click(screen.getByRole("button", { name: "Hour 12" }));
  expect(map).toHaveAccessibleName(/Hour 12.*24.*39.*46/);
  expect(
    screen.getByText("Stronger winds cross the middle and destination"),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Hour 24" }));
  expect(map).toHaveAccessibleName(/Hour 24.*16.*26.*21/);
  expect(screen.getByRole("button", { name: "Hour 24" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.getByText("Lighter winds return along the route"),
  ).toBeVisible();
  expect(map.querySelector("path[stroke-width='5']")).toHaveAttribute(
    "d",
    originalPath,
  );
  expect(screen.getByText(/Fixed scale: 0/)).toBeVisible();
});

it("opens and closes FAQ with keyboard and excludes its collapsed answer", async () => {
  const user = userEvent.setup();
  render(
    <AnimatedDisclosure question="Example question">
      <p>Example answer</p>
    </AnimatedDisclosure>,
  );
  const button = screen.getByRole("button", { name: "Example question" });
  const panel = document.getElementById(button.getAttribute("aria-controls")!)!;
  expect(panel).toHaveAttribute("inert");
  await user.tab();
  await user.keyboard("{Enter}");
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(panel).not.toHaveAttribute("inert");
  await user.keyboard(" ");
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(panel).toHaveAttribute("aria-hidden", "true");
  expect(panel).toHaveAttribute("inert");
  expect(button).toHaveFocus();
});

it("keeps pointer foil static with reduced motion and never starts a background loop", () => {
  const media = vi
    .spyOn(window, "matchMedia")
    .mockImplementation(
      (query) =>
        ({
          matches: query.includes("reduce") || query.includes("hover"),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
  const { container } = render(<HoloCard>Readable card</HoloCard>);
  const card = container.firstElementChild as HTMLElement;
  fireEvent.pointerMove(card, {
    clientX: 200,
    clientY: 100,
    pointerType: "mouse",
  });
  expect(card.style.getPropertyValue("--tilt-x")).toBe("");
  expect(screen.getByText("Readable card")).toBeVisible();
  media.mockRestore();
});
