import { useForm } from "react-hook-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { DeparturePicker } from "../features/trip-planner/components/DeparturePicker";
import type { PlannerValues } from "../features/trip-planner/schemas";

function Harness() {
  const form = useForm<PlannerValues>({
    defaultValues: { departure: "2026-11-09T12:30", timezone: "Asia/Karachi" },
  });
  return (
    <>
      <label htmlFor="departure">Departure date & time</label>
      <DeparturePicker form={form} disabled={false} />
    </>
  );
}
it("applies a themed calendar date and wall time without timezone conversion", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(
    screen.getByRole("button", { name: "Choose departure date and time" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Tuesday, November 10, 2026" }),
  );
  fireEvent.change(screen.getByLabelText("Local departure time"), {
    target: { value: "17:45" },
  });
  await user.click(screen.getByRole("button", { name: "Set departure" }));
  expect(screen.getByLabelText("Departure date & time")).toHaveValue(
    "2026-11-10T17:45",
  );
});
it("supports calendar arrow navigation and Escape without changing the saved departure", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole("button", {
    name: "Choose departure date and time",
  });
  await user.click(trigger);
  expect(
    screen.getByRole("button", { name: "Monday, November 9, 2026" }),
  ).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Tuesday, November 10, 2026" }),
    ).toHaveFocus(),
  );
  await user.keyboard("{Escape}");
  expect(screen.getByLabelText("Departure date & time")).toHaveValue(
    "2026-11-09T12:30",
  );
  expect(trigger).toHaveFocus();
});
